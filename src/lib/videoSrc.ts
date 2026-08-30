/**
 * Where the site's video files are served from.
 *
 * WHY THIS EXISTS (2026-08-30). The ten videos the site plays are large —
 * 519MB as exported, 282MB re-encoded — and `/public/videos` is gitignored,
 * so they are not part of the repository. That is deliberate (Noah's call:
 * keep the repo lean and host the video elsewhere), but it means a deploy
 * built from git has no video files in it at all, and every clip on the site
 * would 404.
 *
 * So the path is no longer hard-wired to the site's own origin. Set
 * NEXT_PUBLIC_VIDEO_BASE_URL to wherever the files actually live — a Vercel
 * Blob store, a CDN bucket, anything that serves them over https — and every
 * `/videos/...` reference in the content is rewritten to point there.
 *
 *     NEXT_PUBLIC_VIDEO_BASE_URL=https://xxxx.public.blob.vercel-storage.com/videos
 *
 * Leave it unset and nothing changes: paths stay as `/videos/...` and are
 * served out of `public/`, which is what makes `npm run dev` keep working on
 * a machine that has the files on disk.
 *
 * NEXT_PUBLIC_ so the value is inlined into the client bundle — these videos
 * are chosen in client components (the grid's hover reel picks its source
 * from a map at render time), so a server-only variable would be undefined
 * exactly where it is needed. There is nothing secret in a CDN base URL.
 */

/** No trailing slash, so joining below never produces a double slash. */
const BASE = (process.env.NEXT_PUBLIC_VIDEO_BASE_URL ?? "").replace(/\/+$/, "");

const LOCAL_PREFIX = "/videos/";

/**
 * Rewrite a `/videos/...` path onto the configured host.
 *
 * Anything else is returned untouched: an absolute URL is already pointing
 * where it means to, and a path that is not under /videos is not ours to
 * move.
 */
export function videoSrc(path: string): string;
export function videoSrc(path: null | undefined): null;
export function videoSrc(path: string | null | undefined): string | null;
export function videoSrc(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!BASE) return path;
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;
  if (!path.startsWith(LOCAL_PREFIX)) return path;
  return BASE + path.slice(LOCAL_PREFIX.length - 1);
}
