// Worker for reefquest.todosenlaweb.com. Everything is static assets except /video/*, which runs
// this script first (assets.runWorkerFirst in cloudflare.config.ts): the static-assets server
// ignores byte-range requests (it answers "Range: bytes=0-1" with the whole file, no
// Accept-Ranges), and Safari, on iPhones above all, won't play a <video> unless the server
// answers ranges with 206 Partial Content. So this script serves the demo videos and their
// posters (public/video, in Git) with range support:
//
// - Edge cache first (Cache API): it stores the whole file and answers a Range request itself
//   with a 206. The cache only works on the custom domain; on preview URLs and in local dev it
//   does nothing, and every request takes the path below.
// - Otherwise the whole file comes from the assets (each video is under 25 MiB), goes into the
//   cache in the background, and this request gets the slice it asked for.
// Every other path never reaches this script.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}
interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}
const edgeCache = (): EdgeCache | null => (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default ?? null;

/** A day in browsers and the edge cache: the files keep their names when the demo is re-recorded. */
const CACHE_CONTROL = "public, max-age=86400";

/** The byte range asked for, clamped to the file; null if there is none or it can't be served. */
function parseRange(header: string, size: number): { start: number; end: number } | "invalid" | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return null; // several ranges or junk: send the whole file
  let start: number, end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]); // "bytes=-500": the last 500 bytes
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

function headersFrom(src: Response): Headers {
  const h = new Headers();
  for (const k of ["content-type", "etag", "last-modified"]) {
    const v = src.headers.get(k);
    if (v) h.set(k, v);
  }
  h.set("accept-ranges", "bytes");
  h.set("cache-control", CACHE_CONTROL);
  return h;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/video/")) return env.ASSETS.fetch(request);
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { allow: "GET, HEAD" } });
    const head = request.method === "HEAD";
    const rangeHeader = request.headers.get("range");
    const cache = edgeCache();
    // Cache key: the URL alone (no Range, no cookies), always as a GET.
    const cacheKey = new Request(url.toString(), { method: "GET" });

    // The edge cache answers a Range request itself (206) from the stored whole file.
    if (cache && !head) {
      try {
        const hit = await cache.match(rangeHeader ? new Request(url.toString(), { headers: { range: rangeHeader } }) : cacheKey);
        if (hit && (!rangeHeader || hit.status === 206)) return hit;
      } catch {
        /* cache unavailable: read the asset */
      }
    }

    // The whole file from the assets (asked for without the Range header).
    const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: "GET" }));
    if (asset.status !== 200 || !(asset.headers.get("content-type") ?? "").match(/^(video|image)\//)) {
      // Not a video or poster (the SPA fallback answers unknown paths with index.html): a real 404.
      return asset.status === 200 ? new Response("Not found", { status: 404 }) : asset;
    }
    const body = await asset.arrayBuffer();
    const size = body.byteLength;
    const headers = headersFrom(asset);

    if (cache && !head) {
      const whole = new Headers(headers);
      whole.set("content-length", String(size));
      ctx.waitUntil(cache.put(cacheKey, new Response(body.slice(0), { headers: whole })).catch(() => undefined));
    }

    const range = rangeHeader ? parseRange(rangeHeader, size) : null;
    if (range === "invalid") {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    if (range) {
      headers.set("content-range", `bytes ${range.start}-${range.end}/${size}`);
      headers.set("content-length", String(range.end - range.start + 1));
      return new Response(head ? null : body.slice(range.start, range.end + 1), { status: 206, headers });
    }
    headers.set("content-length", String(size));
    return new Response(head ? null : body, { headers });
  },
};
