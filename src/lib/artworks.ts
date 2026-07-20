import { supabase, PREVIEWS_BUCKET, SOURCE_FILES_BUCKET } from './supabase';
import { Artwork } from '../types';

// Shape returned by a `select('*, owner:profiles(*)')` query against `artworks`.
interface ArtworkRow {
  id: string;
  title: string;
  description: string;
  tags: string[];
  image_path: string;
  source_file_path: string | null;
  source_file_name: string | null;
  type: 'Original' | 'Remix';
  parent_artwork_id: string | null;
  downloads: number;
  forks: number;
  views: number;
  resolution: string | null;
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
    tags: row.tags,
    type: row.type,
    parentArtworkId: row.parent_artwork_id || undefined,
    parentAuthor: parentUsername,
    resolution: row.resolution || undefined,
    timeAgo: timeAgo(row.created_at),
    ownerId: row.owner_id,
    imagePath: row.image_path,
    sourceFilePath: row.source_file_path || undefined,
    sourceFileName: row.source_file_name || undefined,
  };
}

export const DEFAULT_AVATAR =
  'https://api.dicebear.com/7.x/thumbs/svg?seed=layerhub-default';

// Fetches every real (non-demo) artwork, newest first, joined with its owner's profile.
export async function fetchArtworks(): Promise<Artwork[]> {
  const { data, error } = await supabase
    .from('artworks')
    .select('*, owner:profiles(username, display_name, avatar_url)')
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
  previewFile: File;
  sourceFile: File | null;
  ownerId: string;
  type: 'Original' | 'Remix';
  parentArtworkId?: string;
}

// Uploads the preview image (+ optional source file) to Storage, then inserts
// the artwork row. Returns the newly created artwork on success.
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

  let sourceFilePath: string | null = null;
  if (input.sourceFile) {
    const sourceExt = input.sourceFile.name.split('.').pop() || 'psd';
    sourceFilePath = `${folder}/${timestamp}-source.${sourceExt}`;
    const { error: sourceUploadError } = await supabase.storage
      .from(SOURCE_FILES_BUCKET)
      .upload(sourceFilePath, input.sourceFile, { upsert: false });
    if (sourceUploadError) {
      return { artwork: null, error: `Source file upload failed: ${sourceUploadError.message}` };
    }
  }

  const { data, error } = await supabase
    .from('artworks')
    .insert({
      title: input.title,
      description: input.description,
      tags: input.tags,
      image_path: previewPath,
      source_file_path: sourceFilePath,
      source_file_name: input.sourceFile?.name || null,
      type: input.type,
      parent_artwork_id: input.parentArtworkId || null,
      owner_id: input.ownerId,
      resolution: '4000 x 3000 PX • 16-BIT COLOR',
    })
    .select('*, owner:profiles(username, display_name, avatar_url)')
    .single();

  if (error || !data) {
    return { artwork: null, error: error?.message || 'Could not save the artwork.' };
  }

  // Bump the parent's fork count when this is a remix.
  if (input.parentArtworkId) {
    const { data: parent } = await supabase
      .from('artworks')
      .select('forks')
      .eq('id', input.parentArtworkId)
      .single();
    if (parent) {
      await supabase
        .from('artworks')
        .update({ forks: (parent.forks || 0) + 1 })
        .eq('id', input.parentArtworkId);
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
  newPreviewFile?: File | null;
  previousImagePath?: string;
}

// Updates an artwork's editable fields (title, description, tags) and,
// optionally, replaces its cover/preview image. The source PSD file itself
// is intentionally never touched here — only the preview image can change.
export async function updateArtwork(
  input: UpdateArtworkInput
): Promise<{ artwork: Artwork | null; error: string | null }> {
  const updates: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    tags: input.tags,
  };

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
    .select('*, owner:profiles(username, display_name, avatar_url)')
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
    return { url: publicUrl, filename: artwork.sourceFileName || `${artwork.title}.psd` };
  }
  return { url: artwork.image, filename: `${artwork.title}.jpg` };
}

// Best-effort download counter increment (non-atomic, fine for a demo gallery).
export async function incrementDownloads(artworkId: string, currentCount: number): Promise<void> {
  await supabase.from('artworks').update({ downloads: currentCount + 1 }).eq('id', artworkId);
}
