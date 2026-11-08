import { net, protocol } from "electron";
import { stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";
import { pathToFileURL } from "node:url";

/*
 * The built renderer is served from `app://weft/`, a standard secure origin, so its module scripts
 * load without granting file:// extra privileges.
 */

const SCHEME = "app";
const HOST = "weft";
export const RENDERER_URL = `${SCHEME}://${HOST}/`;

/** Inline styles stay for the style attributes React and Base UI set. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

/** Call before the app is ready. */
export function registerRendererScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true },
    },
  ]);
}

/** Serves the files under `root`; any other path gets `index.html`. */
export function serveRenderer(root: string) {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response(null, { status: 404 });
    let path: string;
    try {
      path = join(root, decodeURIComponent(url.pathname));
    } catch {
      return new Response(null, { status: 400 });
    }
    const inside = relative(root, path);
    if (inside.startsWith("..") || isAbsolute(inside))
      return new Response(null, { status: 404 });
    const file = (await isFile(path)) ? path : join(root, "index.html");
    const response = await net.fetch(pathToFileURL(file).href);
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  });
}

function isFile(path: string): Promise<boolean> {
  return stat(path).then(
    (stats) => stats.isFile(),
    () => false,
  );
}
