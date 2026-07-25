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
// Embedded thumbnail extraction.
//
// A PSD's "Image Resources" section (right after the header + color mode
// data) holds a list of small metadata blocks. Resource ID 1036 is the
// "Thumbnail Resource" — a JPEG preview Photoshop generates automatically
// whenever "Maximize Compatibility" is on when saving (the default, and
// virtually always on unless a user deliberately disabled it). This is the
// exact same preview macOS Finder / Windows Explorer show for a .psd file.
// We read only as much of the file as needed to reach this section — never
// the (potentially huge) layer data that follows it.
// Reference: Adobe's official PSD/PSB file format specification, section
// on Image Resource Blocks / resource ID 1036.
// -----------------------------------------------------------------------

const THUMBNAIL_RESOURCE_ID = 1036;

export async function extractPsdThumbnail(file: File): Promise<File | null> {
  try {
    // Header is 26 bytes; next 4 bytes are the Color Mode Data section length.
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

    // Image Resources section: 4-byte length, then the resource blocks.
    const irLenBytes = await file.slice(imageResourcesLenOffset, imageResourcesLenOffset + 4).arrayBuffer();
    if (irLenBytes.byteLength < 4) return null;
    const imageResourcesLen = new DataView(irLenBytes).getUint32(0, false);

    // Sanity guard — this section is normally at most a few hundred KB.
    // Anything wildly larger suggests a corrupt/unexpected file; bail out
    // rather than reading an unbounded amount of data.
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
      if (blockSig !== '8BIM') break; // malformed or end of well-formed blocks
      pos += 4;

      const resourceId = irView.getUint16(pos, false);
      pos += 2;

      // Resource name: Pascal string (1-byte length + bytes), padded to even total length.
      const nameLen = irView.getUint8(pos);
      let nameFieldLen = 1 + nameLen;
      if (nameFieldLen % 2 !== 0) nameFieldLen += 1;
      pos += nameFieldLen;

      const dataLen = irView.getUint32(pos, false);
      pos += 4;
      const dataStart = pos;

      if (resourceId === THUMBNAIL_RESOURCE_ID && dataLen > 28) {
        // Thumbnail resource sub-header is 28 bytes (format, width, height,
        // widthBytes, totalSize, sizeAfterCompression, bitsPerPixel, planes),
        // and the raw JPEG bytes follow immediately after.
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
