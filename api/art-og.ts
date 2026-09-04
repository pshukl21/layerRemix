// Serves the correct per-artwork social share preview (title, description,
// image) for /art/:id links. Link-preview crawlers (Twitter, Discord,
// Slack, Facebook, iMessage, etc.) only ever read the raw HTML they're
// given — they don't run JavaScript — so a plain client-rendered SPA can't
// show a different image/title per artwork on its own; every route would
// share the same static tags from index.html.
//
// This works around that without any user-agent sniffing: EVERY request to
// /art/:id (both real visitors and crawlers) gets this same HTML, with the
// correct dynamic <meta> tags injected for this specific artwork. Real
// browsers don't care what the initial meta tags say — they load the same
// JS/CSS bundle referenced in the HTML and the normal React app boots up
// exactly as before. Only crawlers, which read tags and stop, ever notice
// the difference.
//
// Wired up via the rewrite rule in vercel.json (must come before the
// catch-all SPA rewrite).

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req: any, res: any) {
  const id = (req.query?.id || '').toString();
  const host = req.headers?.host || 'layerremix.com';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  const fallbackTitle = 'LayerRemix — Where scrapped PSDs become finished art';
  const fallbackDescription =
    'Upload unfinished PSDs, download real layered source files, and remix dormant projects into finished art.';
  const fallbackImage = `${baseUrl}/og-image.png`;

  let title = fallbackTitle;
  let description = fallbackDescription;
  let image = fallbackImage;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && id) {
    try {
      const query =
        `${supabaseUrl}/rest/v1/artworks` +
        `?id=eq.${encodeURIComponent(id)}` +
        `&select=title,description,image_path,owner:profiles!artworks_owner_id_fkey(username)`;
      const artworkResp = await fetch(query, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });
      if (artworkResp.ok) {
        const rows = await artworkResp.json();
        const artwork = Array.isArray(rows) ? rows[0] : null;
        if (artwork) {
          const author = artwork.owner?.username;
          title = author ? `${artwork.title} by @${author} — LayerRemix` : `${artwork.title} — LayerRemix`;
          if (artwork.description) {
            description = artwork.description;
          }
          if (artwork.image_path) {
            image = `${supabaseUrl}/storage/v1/object/public/previews/${artwork.image_path}`;
          }
        }
      }
    } catch (err) {
      console.error('art-og: failed to fetch artwork', err);
      // Fall through to the generic fallback tags — never blocks the page.
    }
  }

  let html: string;
  try {
    const htmlResp = await fetch(`${baseUrl}/index.html`);
    html = await htmlResp.text();
  } catch (err) {
    console.error('art-og: failed to fetch base index.html', err);
    res.statusCode = 500;
    res.end('Failed to load page');
    return;
  }

  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(`${baseUrl}/art/${id}`);

  html = html
    .replace(/<title>.*?<\/title>/s, `<title>${safeTitle}</title>`)
    .replace(/<meta name="description" content=".*?"\s*\/>/s, `<meta name="description" content="${safeDescription}" />`)
    .replace(/<meta property="og:title" content=".*?"\s*\/>/s, `<meta property="og:title" content="${safeTitle}" />`)
    .replace(/<meta property="og:description" content=".*?"\s*\/>/s, `<meta property="og:description" content="${safeDescription}" />`)
    .replace(/<meta property="og:image" content=".*?"\s*\/>/s, `<meta property="og:image" content="${safeImage}" />`)
    .replace(/<meta property="og:url" content=".*?"\s*\/>/s, `<meta property="og:url" content="${safeUrl}" />`)
    .replace(/<meta name="twitter:title" content=".*?"\s*\/>/s, `<meta name="twitter:title" content="${safeTitle}" />`)
    .replace(/<meta name="twitter:description" content=".*?"\s*\/>/s, `<meta name="twitter:description" content="${safeDescription}" />`)
    .replace(/<meta name="twitter:image" content=".*?"\s*\/>/s, `<meta name="twitter:image" content="${safeImage}" />`);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.statusCode = 200;
  res.end(html);
}
