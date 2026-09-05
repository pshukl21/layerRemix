import { supabase } from './supabase';

export interface Contest {
  id: string;
  title: string;
  description: string;
  baseArtworkId: string;
  deadline: string | null;
  createdAt: string;
  prizeFirst: string | null;
  prizeSecond: string | null;
  prizeThird: string | null;
  // Joined from the base artwork, for display without a second query.
  baseTitle: string;
  baseImage: string;
  baseAuthor: string;
}

function rowToContest(row: any): Contest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    baseArtworkId: row.base_artwork_id,
    deadline: row.deadline,
    createdAt: row.created_at,
    prizeFirst: row.prize_first || null,
    prizeSecond: row.prize_second || null,
    prizeThird: row.prize_third || null,
    baseTitle: row.base?.title || '',
    baseImage: row.base?.image_path
      ? supabase.storage.from('previews').getPublicUrl(row.base.image_path).data.publicUrl
      : '',
    baseAuthor: row.base?.owner?.username || '',
  };
}

// Publicly readable — every visitor needs this to browse contests.
export async function fetchContests(): Promise<Contest[]> {
  const { data, error } = await supabase
    .from('contests')
    .select('*, base:artworks!contests_base_artwork_id_fkey(title, image_path, owner:profiles!artworks_owner_id_fkey(username))')
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map(rowToContest);
}

export async function fetchContestById(id: string): Promise<Contest | null> {
  const { data, error } = await supabase
    .from('contests')
    .select('*, base:artworks!contests_base_artwork_id_fkey(title, image_path, owner:profiles!artworks_owner_id_fkey(username))')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToContest(data);
}

// Admin-only in practice — enforced server-side by the contests table's
// RLS policies, which check profiles.is_admin.
export async function createContest(
  title: string,
  description: string,
  baseArtworkId: string,
  deadline: string | null,
  createdBy: string,
  prizeFirst: string | null,
  prizeSecond: string | null,
  prizeThird: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('contests').insert({
    title,
    description,
    base_artwork_id: baseArtworkId,
    deadline,
    created_by: createdBy,
    prize_first: prizeFirst,
    prize_second: prizeSecond,
    prize_third: prizeThird,
  });
  return { error: error?.message || null };
}

// Admin-only in practice — enforced server-side by the contests table's
// RLS policies, which check profiles.is_admin.
export async function updateContest(
  id: string,
  title: string,
  description: string,
  baseArtworkId: string,
  deadline: string | null,
  prizeFirst: string | null,
  prizeSecond: string | null,
  prizeThird: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('contests')
    .update({
      title,
      description,
      base_artwork_id: baseArtworkId,
      deadline,
      prize_first: prizeFirst,
      prize_second: prizeSecond,
      prize_third: prizeThird,
    })
    .eq('id', id);
  return { error: error?.message || null };
}

export async function deleteContest(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('contests').delete().eq('id', id);
  return { error: error?.message || null };
}
