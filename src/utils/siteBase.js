export function getSiteBaseHref() {
  if (typeof document === 'undefined' || !document.baseURI) return '/';
  try {
    return new URL('./', document.baseURI).href;
  } catch (_) {
    return '/';
  }
}

export function resolveSiteUrl(path) {
  const base = getSiteBaseHref();
  if (!path) return base;
  try {
    return new URL(path, base).href;
  } catch (_) {
    return `${base}${String(path).replace(/^\/+/, '')}`;
  }
}
