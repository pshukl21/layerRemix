// A PSD (and PSB) file starts with a small, fixed-size 26-byte header that
// contains the document's real pixel dimensions, bit depth, and color mode.
// We only need to read those 26 bytes — never the whole file — regardless
// of whether the PSD itself is 2MB or 2GB. Format (all big-endian):
//   bytes  0-3  "8BPS" signature
//   bytes  4-5  version (1 = PSD, 2 = PSB)
//   bytes  6-11 reserved, must be zero
//   bytes 12-13 channel count
//   bytes 14-17 height (px)
//   bytes 18-21 width (px)
//   bytes 22-23 depth (bits per channel: 1, 8, 16, or 32)
//   bytes 24-25 color mode
// Reference: Adobe's official PSD/PSB file format specification.

export interface PsdInfo {
  widthPx: number;
  heightPx: number;
  depthBits: number;
  colorMode: string;
}

const COLOR_MODE_NAMES: Record<number, string> = {
  0: 'Bitmap',
  1: 'Grayscale',
  2: 'Indexed',
  3: 'RGB',
  4: 'CMYK',
  7: 'Multichannel',
  8: 'Duotone',
  9: 'Lab',
};

// Returns null if the file doesn't start with a valid PSD/PSB signature
// (e.g. someone renamed a different file type to .psd).
export async function parsePsdHeader(file: File): Promise<PsdInfo | null> {
  try {
    const headerBytes = await file.slice(0, 26).arrayBuffer();
    if (headerBytes.byteLength < 26) return null;

    const view = new DataView(headerBytes);
    const signature = String.fromCharCode(
      view.getUint8(0),
      view.getUint8(1),
      view.getUint8(2),
      view.getUint8(3)
    );
    if (signature !== '8BPS') return null;

    const heightPx = view.getUint32(14, false);
    const widthPx = view.getUint32(18, false);
    const depthBits = view.getUint16(22, false);
    const colorModeCode = view.getUint16(24, false);

    if (!widthPx || !heightPx) return null;

    return {
      widthPx,
      heightPx,
      depthBits,
      colorMode: COLOR_MODE_NAMES[colorModeCode] || 'RGB',
    };
  } catch {
    return null;
  }
}

export function formatPsdResolution(info: PsdInfo): string {
  return `${info.widthPx} x ${info.heightPx} PX • ${info.depthBits}-BIT ${info.colorMode.toUpperCase()}`;
}

// Fallback for uploads with no source PSD (image-only) — reads the actual
// dimensions of the preview image itself instead of guessing.
export function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function formatImageResolution(dims: { width: number; height: number }): string {
  return `${dims.width} x ${dims.height} PX`;
}

// -----------------------------------------------------------------------
// HD preview extraction via the PSD's full composite image.
//
// A PSD file's small embedded "Thumbnail Resource" (what Finder/Explorer
// show) is deliberately low-resolution and heavily JPEG-compressed — fine
// for an OS file icon, too blurry for a gallery preview. Photoshop also
// stores a full-resolution flattened "composite image" (the merged result
// of every visible layer), used so older/non-layer-aware software can still
// display the document correctly. That's what we extract here instead,
// using @webtoon/psd, a zero-dependency PSD parser — decoding pixel data
// correctly requires understanding Photoshop's internal compression, which
// isn't something to hand-roll from raw byte offsets like the header is.
//
// Both the thumbnail and the composite image only exist if "Maximize PSD
// and PSB File Compatibility" was on when the file was saved (Photoshop's
// default). If a file was saved with that off, there's genuinely nothing
// to extract — we don't fall back to a manual image upload, since that
// would reopen the exact "misleading preview" problem this exists to close.
//
// Note: unlike the lightweight header read above, this loads the entire
// file into memory to decode it, since pixel data can live anywhere in
// the file. For typical PSD sizes this is fine; very large files will
// take longer and use more memory in the browser.
// -----------------------------------------------------------------------

const PREVIEW_MAX_DIMENSION = 2000; // longest side, in px — HD but not the full multi-thousand-px original
const THUMBNAIL_RESOURCE_ID = 1036;

export interface PsdAnalysis {
  thumbnail: File | null;
  // Total layer count (including nested layers inside groups), read
  // directly from the PSD's own layer tree — not inferred from anything.
  // null means we couldn't determine it (e.g. an unparseable file).
  layerCount: number | null;
  // True when the HD composite came back looking like a degenerate,
  // collapsed-to-grayscale result (see isLikelyDegenerateGrayscale) —
  // regardless of whether the embedded-thumbnail fallback below found
  // something usable. Used to narrowly allow a manual preview override
  // only for this specific, hard-to-manufacture-on-purpose failure mode —
  // never for the general "no embedded preview at all" case, which stays
  // fully blocked.
  hadColorIssue: boolean;
}

// Detects an HD composite that's collapsed to flat grayscale — a known
// failure mode of @webtoon/psd's layer-compositing on some complex files
// (many adjustment layers, blend modes, large embedded smart objects),
// where it silently produces a degenerate single-channel result instead of
// throwing. Samples pixels across the image rather than checking every
// one, since this only needs to be a quick sanity check, not exhaustive.
// The 98% threshold is deliberately high: genuinely colorful art fails
// this near-instantly (a handful of saturated pixels is enough), while a
// real, intentionally black-and-white piece would also trip it — that's
// an acceptable tradeoff, since falling back to the embedded thumbnail in
// that case just means a slightly lower-res (but still correct) preview.
function isLikelyDegenerateGrayscale(imageData: ImageData): boolean {
  const { data, width, height } = imageData;
  const totalPixels = width * height;
  if (totalPixels === 0) return false;

  const targetSamples = 500;
  const step = Math.max(1, Math.floor(totalPixels / targetSamples));

  let sampled = 0;
  let grayLike = 0;
  for (let i = 0; i < totalPixels; i += step) {
    const idx = i * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
    if (maxDiff <= 4) grayLike++;
    sampled++;
  }

  return sampled > 0 && grayLike / sampled > 0.98;
}

function canvasToJpegFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob ? new File([blob], 'psd-preview.jpg', { type: 'image/jpeg' }) : null);
    }, 'image/jpeg', 0.92);
  });
}

// Fallback extraction: the small embedded "Thumbnail Resource" — the same
// preview macOS Finder / Windows Explorer show for a .psd file. Reads it
// directly from the Image Resources section via raw byte offsets, which is
// a completely independent code path from @webtoon/psd's layer compositing
// — it doesn't re-render anything, just reads a JPEG Photoshop already
// baked in. Lower resolution than the HD composite, but immune to whatever
// causes that path to fail on complex files.
async function extractEmbeddedThumbnailResource(file: File): Promise<File | null> {
  try {
    const headerAndCmLen = await file.slice(0, 30).arrayBuffer();
    if (headerAndCmLen.byteLength < 30) return null;
    const headerView = new DataView(headerAndCmLen);

    const signature = String.fromCharCode(
      headerView.getUint8(0),
      headerView.getUint8(1),
      headerView.getUint8(2),
      headerView.getUint8(3)
    );
    if (signature !== '8BPS') return null;

    const colorModeDataLen = headerView.getUint32(26, false);
    const imageResourcesLenOffset = 26 + 4 + colorModeDataLen;

    const irLenBytes = await file.slice(imageResourcesLenOffset, imageResourcesLenOffset + 4).arrayBuffer();
    if (irLenBytes.byteLength < 4) return null;
    const imageResourcesLen = new DataView(irLenBytes).getUint32(0, false);

    if (imageResourcesLen <= 0 || imageResourcesLen > 20 * 1024 * 1024) return null;

    const irStart = imageResourcesLenOffset + 4;
    const irBuffer = await file.slice(irStart, irStart + imageResourcesLen).arrayBuffer();
    const irView = new DataView(irBuffer);

    let pos = 0;
    while (pos + 4 <= imageResourcesLen) {
      const blockSig = String.fromCharCode(
        irView.getUint8(pos),
        irView.getUint8(pos + 1),
        irView.getUint8(pos + 2),
        irView.getUint8(pos + 3)
      );
      if (blockSig !== '8BIM') break;
      pos += 4;

      const resourceId = irView.getUint16(pos, false);
      pos += 2;

      const nameLen = irView.getUint8(pos);
      let nameFieldLen = 1 + nameLen;
      if (nameFieldLen % 2 !== 0) nameFieldLen += 1;
      pos += nameFieldLen;

      const dataLen = irView.getUint32(pos, false);
      pos += 4;
      const dataStart = pos;

      if (resourceId === THUMBNAIL_RESOURCE_ID && dataLen > 28) {
        const jpegStart = dataStart + 28;
        const jpegLen = dataLen - 28;
        if (jpegLen > 0 && jpegStart + jpegLen <= irBuffer.byteLength) {
          const jpegBytes = irBuffer.slice(jpegStart, jpegStart + jpegLen);
          return new File([jpegBytes], 'psd-thumbnail.jpg', { type: 'image/jpeg' });
        }
      }

      let paddedDataLen = dataLen;
      if (paddedDataLen % 2 !== 0) paddedDataLen += 1;
      pos = dataStart + paddedDataLen;
    }

    return null;
  } catch {
    return null;
  }
}

export async function analyzePsd(file: File): Promise<PsdAnalysis> {
  let layerCount: number | null = null;
  let hadColorIssue = false;

  try {
    const Psd = (await import('@webtoon/psd')).default;
    const buffer = await file.arrayBuffer();
    const psdFile = Psd.parse(buffer);
    layerCount = Array.isArray(psdFile.layers) ? psdFile.layers.length : null;

    const pixels = await psdFile.composite();
    if (pixels && psdFile.width && psdFile.height) {
      const imageData = new ImageData(
        new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength),
        psdFile.width,
        psdFile.height
      );

      // Only trust the HD composite if it doesn't look like a degenerate,
      // collapsed-to-grayscale result — a known failure mode on some
      // complex files (see isLikelyDegenerateGrayscale above).
      if (!isLikelyDegenerateGrayscale(imageData)) {
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = psdFile.width;
        sourceCanvas.height = psdFile.height;
        const sourceCtx = sourceCanvas.getContext('2d');

        if (sourceCtx) {
          sourceCtx.putImageData(imageData, 0, 0);

          // Downscale to a reasonable max size for a gallery preview —
          // still sharp/HD, just not needlessly huge.
          const longestSide = Math.max(psdFile.width, psdFile.height);
          const scale = Math.min(1, PREVIEW_MAX_DIMENSION / longestSide);
          const outWidth = Math.round(psdFile.width * scale);
          const outHeight = Math.round(psdFile.height * scale);

          const outCanvas = document.createElement('canvas');
          outCanvas.width = outWidth;
          outCanvas.height = outHeight;
          const outCtx = outCanvas.getContext('2d');
          if (outCtx) {
            outCtx.drawImage(sourceCanvas, 0, 0, outWidth, outHeight);
            const hdThumbnail = await canvasToJpegFile(outCanvas);
            if (hdThumbnail) {
              return { thumbnail: hdThumbnail, layerCount, hadColorIssue: false };
            }
          }
        }
      } else {
        hadColorIssue = true;
      }
    }
  } catch {
    // Fall through to the independent fallback below.
  }

  // The HD path either failed outright or produced a suspiciously flat
  // result — fall back to the PSD's own embedded thumbnail resource. This
  // uses a completely different extraction method, so it isn't affected by
  // whatever caused the HD path to fail.
  const fallbackThumbnail = await extractEmbeddedThumbnailResource(file);
  return { thumbnail: fallbackThumbnail, layerCount, hadColorIssue };
}

// Minimum real layer count to be accepted as genuine layered work — a
// single-layer (or unlayered/flattened) PSD isn't the kind of file this
// platform exists for, regardless of how large the file itself is.
export const MIN_LAYER_COUNT = 5;

