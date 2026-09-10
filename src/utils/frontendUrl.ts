/**
 * FRONTEND_URL must be the SPA origin only, e.g. https://app.example.com
 * (not https://app.example.com/auth/callback).
 */
export function getFrontendOrigin(fallback = 'http://localhost:3000'): string {
  let url = (process.env.FRONTEND_URL || fallback || '').trim();
  if (!url) return '';
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/auth\/callback$/i, '');
  url = url.replace(/\/+$/, '');
  return url;
}
