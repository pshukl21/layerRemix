// Supabase Edge Function: send-notification-email
//
// A general-purpose notification email sender. Triggered by a Supabase
// Database Webhook (configured in the dashboard — see SETUP.md) whenever a
// row is inserted into `artworks`. This function decides whether that
// event warrants an email, renders the right template, and sends it via
// Resend.
//
// Designed to grow: adding a new notification type later (e.g. "someone
// downloaded your file") means adding one entry to TEMPLATES and one
// branch in buildNotification() — the webhook plumbing, email sending, and
// recipient lookup are all already generic.
//
// Required secrets (set via `supabase secrets set`):
//   RESEND_API_KEY      - from your Resend account
//   NOTIFICATION_FROM   - e.g. "LayerRemix <notifications@layerremix.com>"
//   SITE_URL            - e.g. "https://layerremix.com" (no trailing slash)
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically to
// every Edge Function — no need to set those yourself.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

interface EmailContent {
  toEmail: string;
  subject: string;
  html: string;
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NOTIFICATION_FROM = Deno.env.get('NOTIFICATION_FROM') || 'LayerRemix <notifications@layerremix.com>';
const SITE_URL = Deno.env.get('SITE_URL') || 'https://layerremix.com';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Shared email chrome so every notification type looks consistent without
// duplicating the wrapper markup.
function wrapEmail(bodyHtml: string): string {
  return `
  <div style="font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; background:#eef2f8; padding:32px 16px;">
    <div style="max-width:480px; margin:0 auto; background:white; border-radius:16px; overflow:hidden; border:1px solid #e2e8f0;">
      <div style="padding:28px 32px 0 32px;">
        <div style="font-weight:800; font-size:20px; color:#0f172a; letter-spacing:-0.02em;">LayerRemix</div>
      </div>
      <div style="padding:20px 32px 32px 32px;">
        ${bodyHtml}
      </div>
      <div style="background:#f8fafc; padding:16px 32px; border-top:1px solid #f1f5f9;">
        <a href="${SITE_URL}" style="color:#94a3b8; font-size:12px; text-decoration:none;">${SITE_URL.replace('https://', '')}</a>
      </div>
    </div>
  </div>`;
}

// One entry per notification type. To add a new type later: add a case
// here that returns { toEmail, subject, html } (or null to skip sending),
// then trigger it the same way the remix case is triggered below.
async function buildNotification(payload: WebhookPayload): Promise<EmailContent | null> {
  if (payload.type !== 'INSERT' || payload.table !== 'artworks') return null;
  const record = payload.record;
  if (!record) return null;

  // --- Remix notification ---
  if (record.type === 'Remix' && record.parent_artwork_id) {
    const { data: parent } = await supabaseAdmin
      .from('artworks')
      .select('id, title, owner_id')
      .eq('id', record.parent_artwork_id as string)
      .maybeSingle();

    if (!parent) return null;
    // Don't notify someone about remixing their own work.
    if (parent.owner_id === record.owner_id) return null;

    const { data: remixerProfile } = await supabaseAdmin
      .from('profiles')
      .select('username')
      .eq('id', record.owner_id as string)
      .maybeSingle();

    const { data: ownerUser, error: ownerErr } = await supabaseAdmin.auth.admin.getUserById(parent.owner_id as string);
    if (ownerErr || !ownerUser?.user?.email) return null;

    const remixerUsername = remixerProfile?.username || 'Someone';
    const remixTitle = (record.title as string) || 'Untitled remix';
    const remixUrl = `${SITE_URL}/art/${record.id}`;

    return {
      toEmail: ownerUser.user.email,
      subject: `${remixerUsername} just remixed "${parent.title}"`,
      html: wrapEmail(`
        <p style="font-size:15px; color:#334155; line-height:1.6; margin:0 0 20px 0;">
          <strong>@${remixerUsername}</strong> published a remix of your artwork
          <strong>"${parent.title}"</strong> — it's called <strong>"${remixTitle}"</strong>.
        </p>
        <a href="${remixUrl}" style="display:inline-block; background:#2563eb; color:white; font-weight:700; font-size:13px; text-transform:uppercase; letter-spacing:0.05em; padding:12px 24px; border-radius:8px; text-decoration:none;">
          View the remix
        </a>
      `),
    };
  }

  // Future notification types go here, e.g.:
  // if (payload.table === 'downloads' && payload.type === 'INSERT') { ... }

  return null;
}

async function sendEmail(content: EmailContent): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set — skipping send.');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFICATION_FROM,
      to: content.toEmail,
      subject: content.subject,
      html: content.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error('Resend API error:', res.status, body);
  }
}

Deno.serve(async (req: Request) => {
  try {
    const payload = (await req.json()) as WebhookPayload;
    const notification = await buildNotification(payload);
    if (notification) {
      await sendEmail(notification);
    }
    return new Response(JSON.stringify({ ok: true, sent: !!notification }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-notification-email error:', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
