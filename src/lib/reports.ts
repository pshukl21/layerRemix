import { supabase, PREVIEWS_BUCKET, SOURCE_FILES_BUCKET } from './supabase';

export const REPORT_REASONS = [
  'Copyright infringement',
  'Inappropriate content',
  'Spam or scam',
  'Other',
] as const;

export interface Report {
  id: string;
  artworkId: string;
  artworkTitle: string;
  reporterUsername: string | null;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  createdAt: string;
}

export async function submitReport(
  artworkId: string,
  reporterId: string,
  reason: string,
  details: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reports').insert({
    artwork_id: artworkId,
    reporter_id: reporterId,
    reason,
    details: details.trim() || null,
  });
  return { error: error?.message || null };
}

// Admin-only in practice — enforced server-side by the "Only admins can
// view reports" RLS policy. A non-admin calling this just gets an empty
// result back, not an error, since select-with-no-matching-rows isn't a
// failure from Postgres's point of view.
export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, artwork_id, reason, details, status, created_at, artwork:artworks(title), reporter:profiles(username)')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    artworkId: row.artwork_id,
    artworkTitle: row.artwork?.title || '(deleted artwork)',
    reporterUsername: row.reporter?.username || null,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
  }));
}

export async function updateReportStatus(
  reportId: string,
  status: Report['status']
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reports').update({ status }).eq('id', reportId);
  return { error: error?.message || null };
}

// Admin-only in practice — enforced server-side by admin_delete_artwork's
// own is_admin check, not just this client-side call.
export async function adminDeleteArtwork(artworkId: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('admin_delete_artwork', { p_artwork_id: artworkId }).single();
  if (error) {
    return { error: error.message };
  }
  const row = data as { image_path: string | null; source_file_path: string | null } | null;
  if (row?.image_path) {
    await supabase.storage.from(PREVIEWS_BUCKET).remove([row.image_path]);
  }
  if (row?.source_file_path) {
    await supabase.storage.from(SOURCE_FILES_BUCKET).remove([row.source_file_path]);
  }
  return { error: null };
}
