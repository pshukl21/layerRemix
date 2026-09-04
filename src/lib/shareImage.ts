import { Artwork } from '../types';

// Generates a branded, shareable social image for an artwork entirely in
// the browser via Canvas — no server round-trip needed. Deliberately reuses
// the same visual language as the rest of the app (blueprint grid
// background, dark document-tab-bar treatment, 4:5 image crop matching the
// home page cards) so a shared image is instantly recognizable as
// LayerRemix.

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

  // Headline — centered, since the card below is now centered too.
  ctx.fillStyle = 'white';
  ctx.font = '700 44px Inter, sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const title = artwork.title.length > 30 ? artwork.title.slice(0, 30) + '…' : artwork.title;
  ctx.fillText(title, WIDTH / 2, 64);

  ctx.font = '600 22px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`by @${artwork.author}`, WIDTH / 2, 122);
  ctx.textAlign = 'left';

  // Canvas window card — image area is a real 4:5 crop, matching exactly
  // what the home page gallery cards show.
  const cardW = 650;
  const cardX = (WIDTH - cardW) / 2;
  const cardY = 210;
  const tabBarH = 56;
  const statusBarH = 70;
  const imageH = Math.round(cardW * (5 / 4));
  const cardH = tabBarH + imageH + statusBarH;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 25;
  ctx.fillStyle = 'white';
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.fill();
  ctx.restore();

  // Everything below is clipped to the exact same rounded shape as the
  // card itself — this is what actually prevents any square-cornered fill
  // (the tab bar, the image, the status bar) from poking out past the
  // rounded silhouette and showing a sliver of white/background behind it.
  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 22);
  ctx.clip();

  // Document tab bar
  ctx.fillStyle = '#3f3f46';
  ctx.fillRect(cardX, cardY, cardW, tabBarH);
  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.arc(cardX + 28, cardY + tabBarH / 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f4f4f5';
  ctx.font = '700 17px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  const fileLabel = `${artwork.title}.psd`;
  ctx.fillText(
    fileLabel.length > 34 ? fileLabel.slice(0, 34) + '…' : fileLabel,
    cardX + 48,
    cardY + tabBarH / 2 + 1
  );
  ctx.textBaseline = 'top';

  // Artwork image, real 4:5 crop
  const imageY = cardY + tabBarH;
  try {
    const img = await loadImage(artwork.image);
    drawCoverImage(ctx, img, cardX, imageY, cardW, imageH);
  } catch {
    // If the image can't be loaded (e.g. CORS), leave the area a neutral
    // fill rather than failing the whole share image.
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(cardX, imageY, cardW, imageH);
  }

  // Status bar
  const statusY = imageY + imageH;
  ctx.fillStyle = '#eef1f5';
  ctx.fillRect(cardX, statusY, cardW, statusBarH);
  ctx.fillStyle = '#64748b';
  ctx.font = '700 13px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAYERED · EDITABLE', cardX + 22, statusY + statusBarH / 2 + 1);
  ctx.textAlign = 'right';
  ctx.fillText('LAYERREMIX.COM', cardX + cardW - 22, statusY + statusBarH / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  ctx.restore(); // remove the card clip

  // CTA — a centered pill/oval below the card, sized to fit its own text.
  const ctaText = '⬇  Download the real PSD at layerremix.com';
  ctx.font = '700 24px Inter, sans-serif';
  const ctaTextWidth = ctx.measureText(ctaText).width;
  const ctaPaddingX = 40;
  const ctaH = 74;
  const ctaW = ctaTextWidth + ctaPaddingX * 2;
  const ctaX = (WIDTH - ctaW) / 2;
  const ctaY = cardY + cardH + 46;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = 'white';
  drawRoundedRect(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = '#0f172a';
  ctx.font = '700 24px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ctaText, WIDTH / 2, ctaY + ctaH / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
