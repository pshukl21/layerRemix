import { zip } from 'fflate';
import { supabase, supabaseUrlForUpload, supabaseAnonKeyForUpload, SOURCE_FILES_BUCKET } from './supabase';

// Computes a SHA-256 hex digest of a file's raw bytes — used to detect
// someone re-uploading an exact copy of a file already on the platform
// (e.g. downloading someone else's PSD, unchanged, to farm another
// credit). Hashing the original PSD (not the zip we upload) avoids any
// chance of the zip container's own metadata affecting the hash for
// otherwise-identical content.
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Source PSD size limits — kept in sync with the "Global file size limit"
// and the source-files bucket's own restriction in the Supabase dashboard.
// Checked immediately on file selection so people get instant feedback
// instead of waiting through a whole upload just to be told it's too big.
export const MIN_SOURCE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_SOURCE_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Returns an error message if the file is outside the allowed size range,
// or null if it's fine.
export function validateSourceFileSize(file: File): string | null {
  if (file.size > MAX_SOURCE_FILE_SIZE_BYTES) {
    return `This file is ${formatFileSize(file.size)}, which is over the 2 GB limit. Please upload a smaller file.`;
  }
  if (file.size < MIN_SOURCE_FILE_SIZE_BYTES) {
    return `This file is ${formatFileSize(file.size)}, which is under the 5 MB minimum. Please upload a different file.`;
  }
  return null;
}

// A unique path for a source file, generated client-side before the artwork
// row exists yet — the file is uploaded up-front (with progress shown), well
// before the user clicks "Publish", so we can't wait for a DB-issued id.
export function buildSourceStagingPath(ownerId: string): string {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${ownerId}/${uniqueId}-source.zip`;
}

// Best-effort cleanup for a staged upload that's being replaced (the user
// picked a different file) or abandoned. Non-fatal if it fails.
export async function deleteStagedSourceFile(path: string): Promise<void> {
  try {
    await supabase.storage.from(SOURCE_FILES_BUCKET).remove([path]);
  } catch {
    // best-effort only
  }
}

// Wraps a file in a .zip archive containing it, using fflate's async
// (Worker-backed) zip() so large PSDs don't freeze the page while zipping.
// Compression level 0 (store, no compression) is used deliberately — PSDs
// are usually already internally compressed, so there's little to gain,
// and skipping compression keeps this fast even for very large files.
export function zipFile(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      // Everything here runs inside a FileReader event callback, not the
      // Promise executor's own synchronous scope — a throw in here would
      // NOT automatically reject this promise unless we catch it ourselves.
      // Without this try/catch, a failure here (e.g. from fflate's zip())
      // becomes a truly uncaught exception, which — with no error boundary
      // in the app — can unmount the entire React tree to a blank screen.
      try {
        const bytes = new Uint8Array(reader.result as ArrayBuffer);
        zip(
          { [file.name]: [bytes, { level: 0 }] },
          (err, data) => {
            if (err) {
              reject(err);
              return;
            }
            const zipName = file.name.replace(/\.[^./\\]+$/, '') + '.zip';
            resolve(new File([data], zipName, { type: 'application/zip' }));
          }
        );
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// Uploads a file to Supabase Storage with real byte-level progress, via a
// direct XHR request to the Storage REST endpoint — the supabase-js client's
// upload() method doesn't expose progress events (it's fetch-based), so this
// bypasses it specifically to get genuine upload progress for the UI.
export async function uploadFileWithProgress(
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void
): Promise<{ error: string | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { error: 'Please sign in first.' };
  }
  if (!supabaseUrlForUpload || !supabaseAnonKeyForUpload) {
    return { error: 'Backend is not configured.' };
  }

  const url = `${supabaseUrlForUpload}/storage/v1/object/${bucket}/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', supabaseAnonKeyForUpload);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'false');

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve({ error: null });
      } else {
        let message = `Upload failed (status ${xhr.status}).`;
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.message) message = parsed.message;
        } catch {
          // ignore parse failures, use default message
        }
        resolve({ error: message });
      }
    };

    xhr.onerror = () => resolve({ error: 'Network error during upload.' });
    xhr.send(file);
  });
}
