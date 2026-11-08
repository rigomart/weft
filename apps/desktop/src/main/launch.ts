import { join, resolve } from "node:path";

/** What a run of the desktop host is pointed at, read from its environment before Electron is ready. */
export type Launch = {
  /** The user-data folder: the database, and Chromium's own files. */
  userData: string;
  /** The Chromium debugging port, only when an unpackaged run asks for one. */
  debugPort?: number;
  /** Vite's dev server, only in an unpackaged run. */
  rendererUrl?: string;
  /** Requests a packaged build refused, for the log. */
  ignored: string[];
};

export type LaunchInput = {
  isPackaged: boolean;
  env: Record<string, string | undefined>;
  /** `app.getAppPath()`: `apps/desktop` in an unpackaged run. */
  appPath: string;
  /**
   * Electron's own user-data folder, `~/Library/Application Support/Weft`. Asking Electron for it
   * creates it, so it is read only when a packaged run uses it.
   */
  releaseUserData: () => string;
};

/**
 * `WEFT_USER_DATA` points any run, packaged or not, at another folder. Without it an unpackaged run
 * uses `apps/desktop/.dev-user-data`, never the release folder. `WEFT_DEBUG_PORT` and
 * `WEFT_RENDERER_URL` count only in an unpackaged run: a debugging port gives full control of the app
 * to anything on the machine.
 */
export function launchSettings({
  isPackaged,
  env,
  appPath,
  releaseUserData,
}: LaunchInput): Launch {
  const userDataOverride = env.WEFT_USER_DATA || undefined;
  const userData = userDataOverride
    ? resolve(userDataOverride)
    : isPackaged
      ? releaseUserData()
      : join(appPath, ".dev-user-data");
  const ignored: string[] = [];
  const debugPortRequest = env.WEFT_DEBUG_PORT || undefined;
  const rendererUrl = env.WEFT_RENDERER_URL || undefined;
  if (isPackaged) {
    if (debugPortRequest) ignored.push("WEFT_DEBUG_PORT");
    if (rendererUrl) ignored.push("WEFT_RENDERER_URL");
    return { userData, ignored };
  }
  return {
    userData,
    debugPort:
      debugPortRequest === undefined ? undefined : parsePort(debugPortRequest),
    rendererUrl,
    ignored,
  };
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!/^\d+$/.test(value) || port < 1 || port > 65535) {
    throw new Error(
      `WEFT_DEBUG_PORT must be a port from 1 to 65535, not "${value}".`,
    );
  }
  return port;
}
