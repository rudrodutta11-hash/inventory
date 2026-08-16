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

/** A host we must not print stickers for. */
export function isLocalHost(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(origin)
    || origin.startsWith('file://');
}

/** Runtime values for the current document. */
export function currentOrigin(): string {
  return window.location.origin;
}

export function currentBase(): string {
  return import.meta.env.BASE_URL;
}

export function stickerUrl(serial: string): string {
  return appUrl(currentOrigin(), currentBase(), `/b/${serial}`);
}

export function cabinetUrl(): string {
  return appUrl(currentOrigin(), currentBase(), '/');
}
