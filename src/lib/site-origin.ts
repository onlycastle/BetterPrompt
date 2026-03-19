export const DEFAULT_SITE_ORIGIN = 'http://localhost:3000';

function isLocalHost(host: string): boolean {
  return host.startsWith('localhost')
    || host.startsWith('127.0.0.1')
    || host.startsWith('[::1]');
}

export function normalizeSiteOrigin(candidate?: string | null): string {
  if (!candidate) return DEFAULT_SITE_ORIGIN;
  return new URL(candidate).origin;
}

export function resolveSiteOrigin(headers: {
  host?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  origin?: string | null;
  referer?: string | null;
}): string {
  const host = headers.forwardedHost ?? headers.host;

  if (host) {
    const protocol = headers.forwardedProto ?? (isLocalHost(host) ? 'http' : 'https');
    return normalizeSiteOrigin(`${protocol}://${host}`);
  }

  return normalizeSiteOrigin(headers.origin ?? headers.referer);
}

export function getBrowserSiteOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return DEFAULT_SITE_ORIGIN;
}

export function buildAbsoluteSiteUrl(path: string, origin: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(normalizedPath, origin).toString();
}
