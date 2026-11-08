import { app, BrowserWindow, dialog } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { openDatabase, type Database } from "./database.ts";
import { launchSettings, type Launch } from "./launch.ts";
import {
  registerRendererScheme,
  RENDERER_URL,
  serveRenderer,
} from "./renderer-protocol.ts";

/*
 * The desktop host: one window on the interface, and the SQLite file in the user-data folder, opened
 * here in the main process (ADR 0005).
 */

let database: Database | undefined;
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
  // Before anything else reads it: the single-instance lock and Chromium's files live here too.
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

  // The lock is per user-data folder: one Weft per data folder, and other folders run alongside.
  if (!app.requestSingleInstanceLock()) {
    console.info(
      `Weft is already open on ${launch.userData}; showing its window.`,
    );
    app.quit();
    return;
  }
  app.on("second-instance", showWindow);
  app.on("window-all-closed", () => app.quit());
  app.on("will-quit", () => database?.client.close());
  app.whenReady().then(
    () => start(launch),
    (error: unknown) => fail("Weft could not start", error),
  );
}

async function start(launch: Launch) {
  try {
    database = await openDatabase(join(launch.userData, "weft.db"));
  } catch (error) {
    fail("Weft could not open its database", error);
    return;
  }
  console.info(
    `Weft opened ${database.path} (SQLite ${database.sqliteVersion})`,
  );

  serveRenderer(join(app.getAppPath(), "dist/renderer"));
  window = new BrowserWindow({
    title: "Weft",
    width: 1100,
    height: 760,
    show: false,
    webPreferences: {
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
