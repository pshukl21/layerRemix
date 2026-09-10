// Supabase Edge Function: authorize-download
//
// The single, server-side source of truth for "can this person download
// this file, and if it costs a credit, has that credit actually been
// charged?" Previously, this logic was split between storage RLS (which
// handled contest-locking and the remix-gate) and the client's own
// JavaScript (which decided whether to call spend_credit before asking
// for a download link). That split meant the credit charge was never
// actually enforced by the database — a request straight to Supabase's
// storage API, bypassing the site's own code entirely, could get a valid
// signed URL for any non-locked, non-gated file without ever touching a
// credit balance. This function closes that gap by being the ONLY way to
// get a signed download URL for a source file: it checks ownership,
// admin status, contest-locking, the remix-gate, and — if none of those
// make it free — charges the credit and confirms that succeeded, all
// before it will generate a link. The storage bucket's own RLS is
// tightened alongside this (see schema.sql) so direct client requests for
// anyone but the file's own owner or an admin are refused outright.
//
// No secrets need to be set for this one — SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided automatically to every Edge
// Function.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Service-role client — bypasses RLS entirely. Used only for reads that
// need the full picture (artwork/contest/profile lookups) and, once every
// check below has passed, for actually generating the signed URL.
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Not authorized' }, 401);
    }

    // A client scoped to the CALLER's own identity (not service role) —
    // used for auth.uid() and for spending their credit, so that only
    // ever happens as the actual signed-in caller, never as an admin
    // acting on someone else's behalf by accident. The anon/publishable
    // key is read from the request's own `apikey` header rather than an
    // env var — Supabase is mid-migration between key formats, and
    // whatever the client is actually configured with is guaranteed to
    // match, where a cached env var might not on newer projects.
    const anonKey = req.headers.get('apikey') || '';
    const supabaseAsCaller = createClient(SUPABASE_URL, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAsCaller.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: 'Not authorized' }, 401);
    }

    const { artworkId } = await req.json();
    if (!artworkId || typeof artworkId !== 'string') {
      return jsonResponse({ error: 'Missing artworkId' }, 400);
    }

    const { data: artwork, error: artworkError } = await supabaseAdmin
      .from('artworks')
      .select('id, title, owner_id, parent_artwork_id, source_file_path, source_file_name, requires_remix_unlock')
      .eq('id', artworkId)
      .maybeSingle();

    if (artworkError || !artwork) {
      return jsonResponse({ error: 'Artwork not found' }, 404);
    }
    if (!artwork.source_file_path) {
      return jsonResponse({ error: 'This artwork has no downloadable source file.' }, 404);
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle();
    const isAdmin = !!profile?.is_admin;
    const isOwner = artwork.owner_id === user.id;

    // Contest base files are always free, regardless of credits — that's
    // the whole point of a contest (get people downloading and remixing
    // it). Also determines whether THIS artwork is a still-locked entry
    // of some contest, in which case only the owner/admin may download it
    // at all right now, free or not.
    const { data: baseContest } = await supabaseAdmin
      .from('contests')
      .select('id')
      .eq('base_artwork_id', artwork.id)
      .maybeSingle();
    const isContestBase = !!baseContest;

    if (!isOwner && !isAdmin && artwork.parent_artwork_id) {
      const { data: parentContest } = await supabaseAdmin
        .from('contests')
        .select('deadline')
        .eq('base_artwork_id', artwork.parent_artwork_id)
        .maybeSingle();
      if (parentContest?.deadline && new Date(parentContest.deadline).getTime() > Date.now()) {
        return jsonResponse(
          {
            error: `This is a contest entry — downloads unlock for everyone once judging closes on ${new Date(
              parentContest.deadline
            ).toLocaleDateString()}.`,
          },
          403
        );
      }
    }

    if (!isOwner && !isAdmin && artwork.requires_remix_unlock) {
      const { count } = await supabaseAdmin
        .from('artworks')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .eq('type', 'Remix');
      if (!count || count < 1) {
        return jsonResponse(
          {
            error:
              "This download unlocks once you've published your first remix — fork any piece on the site, make it your own, and publish it.",
          },
          403
        );
      }
    }

    const downloadIsFree = isOwner || isAdmin || isContestBase;

    if (!downloadIsFree) {
      // Atomic on the database side (WHERE credits > 0), so this can't be
      // tricked into overdrawing even under concurrent requests. If this
      // fails, we stop here — no signed URL is ever generated.
      const { error: spendError } = await supabaseAsCaller.rpc('spend_credit', { p_user_id: user.id });
      if (spendError) {
        const message = spendError.message.includes('Not enough credits')
          ? 'out of download credits'
          : spendError.message;
        return jsonResponse({ error: message }, 402);
      }
    }

    const baseName = (artwork.source_file_name || artwork.title || 'download').replace(/\.[^./\\]+$/, '');
    const filename = `${baseName}.zip`;

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from('source-files')
      .createSignedUrl(artwork.source_file_path, 60, { download: filename });

    if (signError || !signed) {
      return jsonResponse({ error: 'Could not generate a download link right now.' }, 500);
    }

    return jsonResponse({ url: signed.signedUrl, filename });
  } catch (err) {
    console.error('authorize-download error:', err);
    return jsonResponse({ error: 'Something went wrong.' }, 500);
  }
});
