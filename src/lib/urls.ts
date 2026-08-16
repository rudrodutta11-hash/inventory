/**
 * URL construction for QR codes.
 *
 * Stickers are physical objects. A sticker printed with the wrong host is 40
 * bottles to peel, so the host is derived from where the app is actually
 * served and shown on screen before printing.
 */

/** Join an origin and a base path into an absolute app root with a trailing slash. */
export function appRoot(origin: string, baseUrl: string): string {
  const cleanOrigin = origin.replace(/\/+$/, '');
  const base = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`;
  return `${cleanOrigin}${base.endsWith('/') ? base : `${base}/`}`;
}

/** Absolute URL for a hash route, e.g. appUrl(origin, base, '/b/017'). */
export function appUrl(origin: string, baseUrl: string, hashPath: string): string {
  const path = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
  return `${appRoot(origin, baseUrl)}#${path}`;
}

/** A host we must not print stickers for. Accepts an origin or a full URL. */
export function isLocalHost(originOrUrl: string): boolean {
  if (originOrUrl.startsWith('file://')) return true;
  try {
    const { hostname } = new URL(originOrUrl);
    return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '::1'].includes(hostname)
      || hostname.endsWith('.local');
  } catch {
    return false;
  }
}

/** Runtime values for the current document. */
export function currentOrigin(): string {
  return window.location.origin;
}

export function currentBase(): string {
  return import.meta.env.BASE_URL;
}

/**
 * The root the printed codes will point at.
 *
 * Normally that is wherever the app is being served from. A `?host=` search
 * param on the stickers route overrides it, so a sheet can be produced for
 * the published address before the app is reachable there — the override is
 * always shown on screen, so what gets printed is never a guess.
 */
export function printRoot(search?: string): { root: string; overridden: boolean } {
  const params = new URLSearchParams(search ?? '');
  const override = params.get('host');
  if (override) {
    try {
      const url = new URL(override);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        return { root: appRoot(url.origin, url.pathname), overridden: true };
      }
    } catch {
      // unparseable override falls through to the served location
    }
  }
  return { root: appRoot(currentOrigin(), currentBase()), overridden: false };
}

export function stickerUrl(serial: string, root?: string): string {
  return `${root ?? appRoot(currentOrigin(), currentBase())}#/b/${serial}`;
}

export function cabinetUrl(root?: string): string {
  return `${root ?? appRoot(currentOrigin(), currentBase())}#/`;
}
