import { supabase } from './supabase';

const SITE_ASSETS_BUCKET = 'site-assets';

export interface SiteSettings {
  heroBeforeImageUrl: string | null;
  heroAfterImageUrl: string | null;
}

// Publicly readable — every visitor needs this to render the homepage hero.
export async function fetchSiteSettings(): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from('site_settings')
    .select('hero_before_image_path, hero_after_image_path')
    .eq('id', true)
    .maybeSingle();

  if (error || !data) {
    return { heroBeforeImageUrl: null, heroAfterImageUrl: null };
  }

  const toUrl = (path: string | null) =>
    path ? supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path).data.publicUrl : null;

  return {
    heroBeforeImageUrl: toUrl(data.hero_before_image_path as string | null),
    heroAfterImageUrl: toUrl(data.hero_after_image_path as string | null),
  };
}

// Admin-only in practice — enforced server-side by the `site_settings`
// UPDATE policy and the `site-assets` bucket's INSERT policy, both of which
// check profiles.is_admin. A non-admin calling this will simply get back an
// error from Supabase, not a silent no-op.
export async function updateHeroImage(
  side: 'before' | 'after',
  file: File
): Promise<{ error: string | null }> {
  const path = `hero-${side}-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`;

  const { error: uploadError } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(path, file, { upsert: false });
  if (uploadError) {
    return { error: uploadError.message };
  }

  const column = side === 'before' ? 'hero_before_image_path' : 'hero_after_image_path';
  const { error: updateError } = await supabase
    .from('site_settings')
    .update({ [column]: path, updated_at: new Date().toISOString() })
    .eq('id', true);

  if (updateError) {
    return { error: updateError.message };
  }

  return { error: null };
}
