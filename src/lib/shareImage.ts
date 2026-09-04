import { Artwork } from '../types';

// Generates a branded, shareable social image for an artwork entirely in
// the browser via Canvas — no server round-trip needed. Deliberately reuses
// the same visual language as the rest of the app (blueprint grid
// background, dark document-tab-bar treatment) so a shared image is
// instantly recognizable as LayerRemix.

const WIDTH = 1080;
const HEIGHT = 1350;

function loadImage(src: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgAspect = img.width / img.height;
  const boxAspect = w / h;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;
  if (imgAspect > boxAspect) {
    sw = img.height * boxAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / boxAspect;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

export async function generateShareImage(artwork: Artwork): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background: solid blue with a subtle blueprint grid, matching the
  // site's own visual signature.
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  for (let x = 0; x < WIDTH; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 110) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // Headline
  ctx.fillStyle = 'white';
  ctx.font = '700 46px Inter, sans-serif';
  ctx.textBaseline = 'top';
  const title = artwork.title.length > 34 ? artwork.title.slice(0, 34) + '…' : artwork.title;
  ctx.fillText(title, 72, 68);

  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`by @${artwork.author}`, 72, 130);

  // Canvas window card
  const cardX = 72;
  const cardY = 200;
  const cardW = WIDTH - 144;
  const cardH = 900;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = 'white';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();
  ctx.restore();

  // Document tab bar
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, 56, 24);
  ctx.clip();
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(cardX, cardY, cardW, 56);
  ctx.restore();

  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.arc(cardX + 30, cardY + 28, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f4f4f5';
  ctx.font = '700 18px Inter, sans-serif';
  const fileLabel = `${artwork.title}.psd`;
  ctx.fillText(fileLabel.length > 40 ? fileLabel.slice(0, 40) + '…' : fileLabel, cardX + 50, cardY + 18);

  // Artwork image, letterboxed into the remaining card area
  const imageY = cardY + 56;
  const imageH = cardH - 56 - 70;
  try {
    const img = await loadImage(artwork.image);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cardX, imageY, cardW, imageH);
    ctx.clip();
    drawCoverImage(ctx, img, cardX, imageY, cardW, imageH);
    ctx.restore();
  } catch {
    // If the image can't be loaded (e.g. CORS), just leave the area blank
    // rather than failing the whole share image.
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cardX, imageY, cardW, imageH);
  }

  // Status bar
  const statusY = imageY + imageH;
  ctx.fillStyle = '#eef1f5';
  ctx.fillRect(cardX, statusY, cardW, 70);
  ctx.fillStyle = '#64748b';
  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillText('LAYERED · EDITABLE PSD', cardX + 26, statusY + 26);
  ctx.textAlign = 'right';
  ctx.fillText('LAYERREMIX.COM', cardX + cardW - 26, statusY + 26);
  ctx.textAlign = 'left';

  // Footer CTA
  ctx.fillStyle = 'white';
  ctx.font = '700 30px Inter, sans-serif';
  ctx.fillText('Download the real PSD at layerremix.com', 72, cardY + cardH + 48);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
