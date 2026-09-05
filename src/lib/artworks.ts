import { supabase, PREVIEWS_BUCKET, SOURCE_FILES_BUCKET } from './supabase';
import { Artwork, Profile } from '../types';

// Shape returned by a `select('*, owner:profiles(*)')` query against `artworks`.
interface ArtworkRow {
  id: string;
  title: string;
  description: string;
  tags: string[];
  open_challenges: string[];
  image_path: string;
  source_file_path: string | null;
  source_file_name: string | null;
  type: 'Original' | 'Remix';
  parent_artwork_id: string | null;
  downloads: number;
  forks: number;
  views: number;
  hearts_count: number;
  resolution: string | null;
  focal_x: number | null;
  focal_y: number | null;
  created_at: string;
  owner_id: string;
  owner: {
    username: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
}

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function rowToArtwork(row: ArtworkRow, parentUsername?: string): Artwork {
  return {
    id: row.id,
    title: row.title,
    author: row.owner?.username || 'unknown',
    authorAvatar: row.owner?.avatar_url || DEFAULT_AVATAR,
    image: supabase.storage.from(PREVIEWS_BUCKET).getPublicUrl(row.image_path).data.publicUrl,
    description: row.description,
    downloads: String(row.downloads),
    forks: String(row.forks),
    views: String(row.views),
    hearts: String(row.hearts_count ?? 0),
    tags: row.tags,
    openChallenges: row.open_challenges || [],
    type: row.type,
    parentArtworkId: row.parent_artwork_id || undefined,
    parentAuthor: parentUsername,
    resolution: row.resolution || undefined,
    focalX: typeof row.focal_x === 'number' ? row.focal_x : 50,
    focalY: typeof row.focal_y === 'number' ? row.focal_y : 50,
    timeAgo: timeAgo(row.created_at),
    createdAt: row.created_at,
    ownerId: row.owner_id,
    imagePath: row.image_path,
    sourceFilePath: row.source_file_path || undefined,
    sourceFileName: row.source_file_name || undefined,
  };
}

export const DEFAULT_AVATAR =
  'https://api.dicebear.com/7.x/thumbs/svg?seed=layerhub-default';

// Fetches every real (non-demo) artwork, newest first, joined with its owner's profile.
// Fetches any user's public profile by username — used to view someone
// else's profile page. Profiles are publicly readable, so this works
// whether or not the visitor is signed in.
// Checks whether a file with this exact content hash already exists on
// the platform. Used to give an immediate, friendly message when someone
// tries to upload a file that's already here — the real enforcement is
// the database's own unique index on file_hash, which this can't bypass
// even in a race condition; this is just for fast, clear UI feedback.
export async function findDuplicateByHash(fileHash: string): Promise<{ id: string; title: string; author: string } | null> {
  const { data } = await supabase
    .from('artworks')
    .select('id, title, owner:profiles!artworks_owner_id_fkey(username)')
    .eq('file_hash', fileHash)
    .maybeSingle();

  if (!data) return null;
  const owner = data.owner as unknown as { username: string } | null;
  return { id: data.id as string, title: data.title as string, author: owner?.username || 'someone' };
}

// Hearts or un-hearts an artwork for the current user. Returns the new
// state so the UI knows whether to show it as filled or outlined.
export async function toggleFavorite(artworkId: string): Promise<{ isFavorited: boolean | null; error: string | null }> {
  const { data, error } = await supabase.rpc('toggle_favorite', { p_artwork_id: artworkId });
  if (error) {
    return { isFavorited: null, error: error.message };
  }
  return { isFavorited: data as boolean, error: null };
}

// The current user's own hearted-artwork ids — private by design (RLS only
// allows a user to read their own favorites rows), used to show which
// hearts are filled in and to power the "Favorites" tab on their profile.
export async function fetchMyFavoriteIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from('favorites').select('artwork_id').eq('user_id', userId);
  if (error || !data) return new Set();
  return new Set(data.map((row) => row.artwork_id as string));
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    bio: data.bio || '',
    credits: typeof data.credits === 'number' ? data.credits : 0,
    createdAt: data.created_at,
  };
}

export async function fetchArtworks(): Promise<Artwork[]> {
  const { data, error } = await supabase
    .from('artworks')
    .select('*, owner:profiles!artworks_owner_id_fkey(username, display_name, avatar_url)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load artworks:', error.message);
    return [];
  }

  const rows = (data || []) as ArtworkRow[];
  const idToUsername = new Map(rows.map((r) => [r.id, r.owner?.username]));

  return rows.map((row) =>
    rowToArtwork(row, row.parent_artwork_id ? idToUsername.get(row.parent_artwork_id) : undefined)
  );
}

interface PublishInput {
  title: string;
  description: string;
  tags: string[];
  openChallenges: string[];
  previewFile: File;
  // The source file (zipped PSD) is uploaded up-front, with progress shown
  // to the user, well before "Publish" is clicked — so by this point we
  // only need the path/name it already lives at, not the file itself.
  sourceFilePath: string | null;
  sourceFileName: string | null;
  ownerId: string;
  type: 'Original' | 'Remix';
  parentArtworkId?: string;
  resolution: string;
  focalX?: number;
  fileHash: string | null;
  focalY?: number;
}

// Uploads the preview image to Storage, then inserts the artwork row
// (the source file has already been uploaded separately — see lib/upload.ts).
// Returns the newly created artwork on success.
export async function publishArtwork(input: PublishInput): Promise<{ artwork: Artwork | null; error: string | null }> {
  const folder = input.ownerId;
  const timestamp = Date.now();

  const previewExt = input.previewFile.name.split('.').pop() || 'jpg';
  const previewPath = `${folder}/${timestamp}-preview.${previewExt}`;

  const { error: previewUploadError } = await supabase.storage
    .from(PREVIEWS_BUCKET)
    .upload(previewPath, input.previewFile, { upsert: false });
  if (previewUploadError) {
    return { artwork: null, error: `Preview upload failed: ${previewUploadError.message}` };
  }

  const { data, error } = await supabase
    .from('artworks')
    .insert({
      title: input.title,
      description: input.description,
      tags: input.tags,
      open_challenges: input.openChallenges,
      image_path: previewPath,
      source_file_path: input.sourceFilePath,
      source_file_name: input.sourceFileName,
      type: input.type,
      parent_artwork_id: input.parentArtworkId || null,
      owner_id: input.ownerId,
      resolution: input.resolution,
      focal_x: input.focalX ?? 50,
      focal_y: input.focalY ?? 50,
      file_hash: input.fileHash,
    })
    .select('*, owner:profiles!artworks_owner_id_fkey(username, display_name, avatar_url)')
    .single();

  if (error || !data) {
    // Backstop for the rare race condition where two identical uploads
    // land at nearly the same time — the client-side pre-check (see
    // findDuplicateByHash) catches this in the normal case, but the
    // database's unique index is what actually guarantees it can't slip
    // through either way.
    if (error?.message.includes('artworks_file_hash_unique')) {
      return { artwork: null, error: 'This exact file has already been uploaded to LayerRemix.' };
    }
    return { artwork: null, error: error?.message || 'Could not save the artwork.' };
  }

  // Bump the parent's fork count when this is a remix. Uses an RPC (not a
  // plain update) because the person forking almost never owns the parent
  // artwork — a direct update would be silently blocked by the "Users can
  // update their own artworks" RLS policy.
  if (input.parentArtworkId) {
    const { error: forkCountError } = await supabase.rpc('increment_artwork_forks', {
      p_artwork_id: input.parentArtworkId,
    });
    if (forkCountError) {
      console.error('Failed to bump fork count:', forkCountError.message);
    }
  }

  return { artwork: rowToArtwork(data as ArtworkRow), error: null };
}

interface UpdateArtworkInput {
  artworkId: string;
  ownerId: string;
  title: string;
  description: string;
  tags: string[];
  openChallenges: string[];
  newPreviewFile?: File | null;
  previousImagePath?: string;
  focalX?: number;
  focalY?: number;
}

// Updates an artwork's editable fields (title, description, tags, crop
// focus point) and, optionally, replaces its cover/preview image. The
// source PSD file itself is intentionally never touched here — only the
// preview image (and how it's cropped) can change.
export async function updateArtwork(
  input: UpdateArtworkInput
): Promise<{ artwork: Artwork | null; error: string | null }> {
  const updates: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    tags: input.tags,
    open_challenges: input.openChallenges,
  };
  if (typeof input.focalX === 'number') updates.focal_x = input.focalX;
  if (typeof input.focalY === 'number') updates.focal_y = input.focalY;

  let newImagePath: string | null = null;
  if (input.newPreviewFile) {
    const ext = input.newPreviewFile.name.split('.').pop() || 'jpg';
    newImagePath = `${input.ownerId}/${Date.now()}-preview.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(PREVIEWS_BUCKET)
      .upload(newImagePath, input.newPreviewFile, { upsert: false });
    if (uploadError) {
      return { artwork: null, error: `Preview upload failed: ${uploadError.message}` };
    }
    updates.image_path = newImagePath;
  }

  const { data, error } = await supabase
    .from('artworks')
    .update(updates)
    .eq('id', input.artworkId)
    .select('*, owner:profiles!artworks_owner_id_fkey(username, display_name, avatar_url)')
    .single();

  if (error || !data) {
    return { artwork: null, error: error?.message || 'Could not update the artwork.' };
  }

  // Best-effort cleanup of the old preview file now that the DB row points
  // at the new one. Non-fatal if it fails (e.g. storage delete policy not
  // yet applied) — the update itself has already succeeded.
  if (newImagePath && input.previousImagePath) {
    await supabase.storage.from(PREVIEWS_BUCKET).remove([input.previousImagePath]).catch(() => {});
  }

  return { artwork: rowToArtwork(data as ArtworkRow), error: null };
}

// Resolves a real, fetchable download URL + suggested filename for an artwork.
// Falls back to the preview image if no source file was uploaded (e.g. demo seed art).
export function getDownloadTarget(artwork: Artwork): { url: string; filename: string } {
  if (artwork.sourceFilePath) {
    const { publicUrl } = supabase.storage.from(SOURCE_FILES_BUCKET).getPublicUrl(artwork.sourceFilePath).data;
    // The stored file is always a .zip (containing the original .psd) — the
    // suggested download filename needs to match that, or the browser saves
    // a file with a .psd extension that's actually zip-archive bytes inside.
    const baseName = (artwork.sourceFileName || artwork.title).replace(/\.[^./\\]+$/, '');
    return { url: publicUrl, filename: `${baseName}.zip` };
  }
  return { url: artwork.image, filename: `${artwork.title}.jpg` };
}

// Best-effort download counter increment. Uses an RPC rather than a plain
// update — a direct update would be silently blocked by RLS whenever the
// downloader doesn't own the artwork, which is the common case.
export async function incrementDownloads(artworkId: string, _currentCount?: number): Promise<void> {
  const { error } = await supabase.rpc('increment_artwork_downloads', { p_artwork_id: artworkId });
  if (error) {
    console.error('Failed to bump download count:', error.message);
  }
}

// Best-effort view counter increment, called once per page visit to an
// artwork. Works for signed-out visitors too (granted to the anon role).
export async function incrementArtworkViews(artworkId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_artwork_views', { p_artwork_id: artworkId });
  if (error) {
    console.error('Failed to bump view count:', error.message);
  }
}

// Atomically spends one download credit for the given user via the
// `spend_credit` RPC (server-side guarded — see supabase/schema.sql).
// Returns the new balance on success, or an error if they had none left.
export async function spendDownloadCredit(userId: string): Promise<{ credits: number | null; error: string | null }> {
  const { data, error } = await supabase.rpc('spend_credit', { p_user_id: userId });
  if (error) {
    if (error.message.includes('Not enough credits')) {
      return { credits: null, error: "You're out of download credits. Publish an original piece or a remix to earn more." };
    }
    return { credits: null, error: error.message };
  }
  return { credits: data as number, error: null };
}

// Deletes an artwork row (RLS restricts this to the owner) and best-effort
// cleans up its files from storage. The DB delete is the source of truth —
// if storage cleanup fails partway, the artwork is still gone from the site.
export async function deleteArtwork(artworkId: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .rpc('delete_artwork_with_credit_check', { p_artwork_id: artworkId })
    .single();

  if (error) {
    if (error.message.includes('Not enough credits')) {
      return {
        error:
          'Insufficient credits: you need at least 1 credit in your account balance to delete a post. Upload another PSD to restore your deletion ability.',
      };
    }
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
