type RequestLike = {
  protocol: string;
  get(name: string): string | undefined;
};

function forcePublicHttps(url: string): string {
  if (!url || /localhost|127\.0\.0\.1/i.test(url)) return url;
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * FRONTEND_URL must be the SPA origin only, e.g. https://www.trustichain.com
 * (not https://www.trustichain.com/auth/callback).
 */
export function getFrontendOrigin(fallback = 'http://localhost:3000'): string {
  let url = (process.env.FRONTEND_URL || fallback || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/auth\/callback$/i, '');
  url = url.replace(/\/+$/, '');
  return forcePublicHttps(url);
}

/** Public API origin for OAuth redirects. Prefer the incoming request so stale http RENDER_URL cannot break sign-in. */
export function getPublicBackendUrl(req?: RequestLike): string {
  const envUrl = (
    process.env.RENDER_EXTERNAL_URL ||
    process.env.RENDER_URL ||
    process.env.BACKEND_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const host = (req?.get('x-forwarded-host') || req?.get('host') || '').split(',')[0].trim();
  const proto = (req?.get('x-forwarded-proto') || '').split(',')[0].trim() || req?.protocol || 'https';
  const fromReq = host ? `${proto}://${host}` : '';
  let url = fromReq || envUrl || 'http://localhost:3000';
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return forcePublicHttps(url.replace(/\/+$/, ''));
}
