import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { CHANNELS, type Call } from "../ipc/protocol.ts";
import { forwardChanges, serveWeft } from "../ipc/serve.ts";
import { openWeftAt, type OpenedWeft } from "./database.ts";
import { launchSettings, type Launch } from "./launch.ts";
import {
  registerRendererScheme,
  RENDERER_URL,
  serveRenderer,
} from "./renderer-protocol.ts";

let opened: OpenedWeft | undefined;
let window: BrowserWindow | null = null;

const launch = readLaunch();
if (launch) setUp(launch);

function readLaunch(): Launch | undefined {
  try {
    return launchSettings({
      isPackaged: app.isPackaged,
      env: process.env,
      appPath: app.getAppPath(),
      releaseUserData: () => app.getPath("userData"),
    });
  } catch (error) {
    fail("Weft could not start", error);
    return undefined;
  }
}

function setUp(launch: Launch) {
  for (const name of launch.ignored) {
    console.warn(`Weft ignores ${name} in a packaged build.`);
  }
  // Set before Electron reads it for the single-instance lock and Chromium's own files.
  mkdirSync(launch.userData, { recursive: true });
  app.setPath("userData", launch.userData);

  // Chromium reads these switches from the command line too, so a packaged build drops them.
  if (app.isPackaged) {
    app.commandLine.removeSwitch("remote-debugging-port");
    app.commandLine.removeSwitch("remote-debugging-pipe");
  } else if (launch.debugPort !== undefined) {
    app.commandLine.appendSwitch(
      "remote-debugging-port",
      String(launch.debugPort),
    );
  }

  registerRendererScheme();

  // Electron keys the single-instance lock to the user-data folder.
  if (!app.requestSingleInstanceLock()) {
    console.info(
      `Weft is already open on ${launch.userData}; showing its window.`,
    );
    app.quit();
    return;
  }
  app.on("second-instance", showWindow);
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => void opened?.database.close());
  app
    .whenReady()
    .then(() => start(launch))
    .catch((error: unknown) => fail("Weft could not start", error));
}

async function start(launch: Launch) {
  try {
    opened = await openWeftAt(join(launch.userData, "weft.db"));
  } catch (error) {
    fail("Weft could not open its database", error);
    return;
  }
  console.info(`Weft opened ${opened.path} (SQLite ${opened.sqliteVersion})`);
  serveToWindow(opened);

  serveRenderer(join(app.getAppPath(), "dist/renderer"));
  window = new BrowserWindow({
    title: "Weft",
    width: 1100,
    height: 760,
    show: false,
    webPreferences: {
      preload: join(app.getAppPath(), "dist/preload/preload.cjs"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.once("ready-to-show", () => {
    window?.show();
    console.info(`Weft showed ${window?.webContents.getURL()}`);
  });
  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error(`Weft could not load ${url}: ${description} (${code})`);
  });
  // A packaged build has no developer tools, so the window's warnings and errors come here.
  window.webContents.on(
    "console-message",
    ({ level, message, sourceId, lineNumber }) => {
      if (level === "warning" || level === "error") {
        console.error(
          `Weft's window ${level}: ${message} (${sourceId}:${lineNumber})`,
        );
      }
    },
  );
  window.webContents.on("render-process-gone", (_event, { reason }) => {
    console.error(`Weft's window stopped: ${reason}`);
  });
  window.on("closed", () => {
    window = null;
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  await window.loadURL(launch.rendererUrl ?? RENDERER_URL);
}

/** Serves the contract to the window over IPC (ADR 0010). */
function serveToWindow({ weft }: OpenedWeft) {
  const handlers = serveWeft(weft, (call, error) =>
    console.error(`Weft failed on ${call}: ${describe(error)}`),
  );
  for (const call of ["run", "read"] satisfies Call[]) {
    ipcMain.handle(CHANNELS[call], (event, message: unknown) => {
      if (!window || event.sender !== window.webContents) {
        throw new Error("Weft answers only its own window.");
      }
      return handlers[call](message);
    });
  }
  forwardChanges(
    weft,
    () => {
      if (!window || window.isDestroyed()) return undefined;
      const { webContents } = window;
      if (webContents.isDestroyed()) return undefined;
      return { send: (change) => webContents.send(CHANNELS.changed, change) };
    },
    (error) =>
      console.error(
        `Weft failed to tell its window of a change: ${describe(error)}`,
      ),
  );
}

function describe(error: unknown): string {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

function showWindow() {
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  app.focus({ steal: true });
}

function fail(title: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${title}: ${message}`);
  dialog.showErrorBox(title, message);
  app.exit(1);
}
