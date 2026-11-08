// Main process changes need a restart.
import { createRequire } from "node:module";
import { join } from "node:path";
import { createServer } from "vite";

import { buildMain } from "./build-main.ts";

const root = join(import.meta.dir, "..");

await buildMain();
const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
});
await server.listen();
const rendererUrl = server.resolvedUrls?.local[0];
if (!rendererUrl) throw new Error("Vite did not report a local URL.");
server.printUrls();

// Some editors built on Electron set this, which turns Electron into plain Node.
const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;
const electron = Bun.spawn(
  [createRequire(import.meta.url)("electron") as string, root],
  {
    cwd: root,
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...env, WEFT_RENDERER_URL: rendererUrl },
  },
);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => electron.kill(signal));
}
const code = await electron.exited;
await server.close();
process.exit(code);
