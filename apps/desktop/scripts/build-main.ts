// Builds the main process into dist/main.
import { rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

export async function buildMain() {
  await rm(join(root, "dist/main"), { recursive: true, force: true });
  const build = await Bun.build({
    entrypoints: [join(root, "src/main/main.ts")],
    outdir: join(root, "dist/main"),
    target: "node",
    format: "esm",
    // libsql loads its native binding at runtime, from node_modules.
    external: ["electron", "@libsql/client"],
    sourcemap: "linked",
  });
  if (!build.success) {
    for (const log of build.logs) console.error(log);
    throw new Error("The main process did not build.");
  }
}

if (import.meta.main) await buildMain();
