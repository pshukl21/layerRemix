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
