import { zip } from 'fflate';
import { supabase, supabaseUrlForUpload, supabaseAnonKeyForUpload, SOURCE_FILES_BUCKET } from './supabase';

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
