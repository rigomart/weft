import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

export async function buildMain() {
  await rm(join(root, "dist/main"), { recursive: true, force: true });
  await rm(join(root, "dist/preload"), { recursive: true, force: true });
  await build("main process", {
    entrypoints: [join(root, "src/main/main.ts")],
    outdir: join(root, "dist/main"),
    target: "node",
    format: "esm",
    // libsql loads its native binding at runtime, from node_modules.
    external: ["electron", "@libsql/client"],
    sourcemap: "linked",
  });
  // A sandboxed preload runs as a CommonJS script that may require only Electron's renderer modules.
  await build("preload", {
    entrypoints: [join(root, "src/preload/preload.ts")],
    outdir: join(root, "dist/preload"),
    naming: "[name].cjs",
    target: "browser",
    format: "cjs",
    external: ["electron"],
  });
}

async function build(name: string, config: Bun.BuildConfig) {
  const result = await Bun.build(config);
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error(`The ${name} did not build.`);
  }
}

if (import.meta.main) await buildMain();
