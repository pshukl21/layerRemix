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

export interface PsdAnalysis {
  thumbnail: File | null;
  // Total layer count (including nested layers inside groups), read
  // directly from the PSD's own layer tree — not inferred from anything.
  // null means we couldn't determine it (e.g. an unparseable file).
  layerCount: number | null;
}

export async function analyzePsd(file: File): Promise<PsdAnalysis> {
  try {
    const Psd = (await import('@webtoon/psd')).default;
    const buffer = await file.arrayBuffer();
    const psdFile = Psd.parse(buffer);

    const layerCount = Array.isArray(psdFile.layers) ? psdFile.layers.length : null;

    const pixels = await psdFile.composite();
    if (!pixels || !psdFile.width || !psdFile.height) {
      return { thumbnail: null, layerCount };
    }

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = psdFile.width;
    sourceCanvas.height = psdFile.height;
    const sourceCtx = sourceCanvas.getContext('2d');
    if (!sourceCtx) return { thumbnail: null, layerCount };

    const imageData = new ImageData(
      new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.byteLength),
      psdFile.width,
      psdFile.height
    );
    sourceCtx.putImageData(imageData, 0, 0);

    // Downscale to a reasonable max size for a gallery preview — still
    // sharp/HD, just not needlessly huge (the real full-quality asset is
    // the PSD file itself, not this preview).
    const longestSide = Math.max(psdFile.width, psdFile.height);
    const scale = Math.min(1, PREVIEW_MAX_DIMENSION / longestSide);
    const outWidth = Math.round(psdFile.width * scale);
    const outHeight = Math.round(psdFile.height * scale);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return { thumbnail: null, layerCount };
    outCtx.drawImage(sourceCanvas, 0, 0, outWidth, outHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      outCanvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92);
    });
    if (!blob) return { thumbnail: null, layerCount };

    return { thumbnail: new File([blob], 'psd-preview.jpg', { type: 'image/jpeg' }), layerCount };
  } catch {
    return { thumbnail: null, layerCount: null };
  }
}

// Minimum real layer count to be accepted as genuine layered work — a
// single-layer (or unlayered/flattened) PSD isn't the kind of file this
// platform exists for, regardless of how large the file itself is.
export const MIN_LAYER_COUNT = 2;

