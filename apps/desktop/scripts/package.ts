// Builds the app and packages it as an ad-hoc signed macOS app for this Mac's architecture, in
// out/Weft-darwin-<arch>/Weft.app. Not the release build: no disk image, notarisation or icon (#24).
import { FuseV1Options, FuseVersion, flipFuses } from "@electron/fuses";
import { packager } from "@electron/packager";
import { existsSync, realpathSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

const root = join(import.meta.dir, "..");
const out = join(root, "out");
const stage = join(out, "stage");

if (process.platform !== "darwin") {
  throw new Error("Weft packages only for macOS for now.");
}
const arch = process.arch;
if (arch !== "arm64" && arch !== "x64")
  throw new Error(`Weft can't package for ${arch}.`);

type Manifest = {
  name: string;
  productName?: string;
  version: string;
  main?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const readManifest = async (dir: string): Promise<Manifest> =>
  JSON.parse(await readFile(join(dir, "package.json"), "utf8"));

const desktop = await readManifest(root);
const productName = desktop.productName ?? desktop.name;
const electronDir = packageDir(root, "electron");
if (!electronDir) throw new Error("electron is not installed.");
const electronVersion = (await readManifest(electronDir)).version;
// The main process bundles everything except @libsql/client, which loads its native binding at runtime.
const runtimeDependency = "@libsql/client";

await run(["bun", "run", "build"]);
await rm(out, { recursive: true, force: true });

// The app folder holds only what the built app loads, so the packager never reads bun's symlinks.
await mkdir(stage, { recursive: true });
await cp(join(root, "dist"), join(stage, "dist"), { recursive: true });
await writeFile(
  join(stage, "package.json"),
  JSON.stringify(
    {
      name: desktop.name,
      // Names the user-data folder: ~/Library/Application Support/Weft.
      productName,
      version: desktop.version,
      type: "module",
      main: desktop.main,
    },
    null,
    2,
  ),
);
const libsql = packageDir(root, runtimeDependency);
if (!libsql) throw new Error(`${runtimeDependency} is not installed.`);
await copyRuntimeDependencies(libsql, join(stage, "node_modules"));

const [appDir] = await packager({
  dir: stage,
  out,
  name: productName,
  appBundleId: "com.weft.desktop",
  appCategoryType: "public.app-category.productivity",
  platform: "darwin",
  arch,
  electronVersion,
  // The stage has no devDependencies, and its node_modules are already real folders.
  prune: false,
  asar: { unpack: "**/*.node" },
});
if (!appDir) throw new Error("The packager produced no app.");
const appBundle = join(appDir, `${productName}.app`);

// Nothing but the app's own, unaltered archive runs in its binary: no Node from ELECTRON_RUN_AS_NODE
// or NODE_OPTIONS, no --inspect, and no code outside app.asar.
await flipFuses(appBundle, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
});

// Ad-hoc signed as one bundle, which Apple silicon needs to run it at all. Not notarised.
await run(["codesign", "--force", "--deep", "--sign", "-", appBundle]);
await run(["codesign", "--verify", "--deep", "--strict", appBundle]);
await rm(stage, { recursive: true });

console.info(`Packaged ${appBundle}`);

/**
 * Copies `from` and everything it depends on into a flat `node_modules`, following bun's symlinks.
 * Optional dependencies that aren't installed (other platforms' libsql bindings) are skipped. Two
 * versions of one package would need nesting, so that fails instead.
 */
async function copyRuntimeDependencies(from: string, nodeModules: string) {
  const copied = new Map<string, string>();
  const pending = [from];
  for (let dir = pending.pop(); dir; dir = pending.pop()) {
    const manifest = await readManifest(dir);
    const seen = copied.get(manifest.name);
    if (seen === manifest.version) continue;
    if (seen !== undefined) {
      throw new Error(
        `${manifest.name} is needed at ${seen} and ${manifest.version}; packaging can't nest versions yet.`,
      );
    }
    copied.set(manifest.name, manifest.version);
    await cp(dir, join(nodeModules, manifest.name), {
      recursive: true,
      dereference: true,
    });
    for (const name of Object.keys(manifest.dependencies ?? {})) {
      const found = packageDir(dir, name);
      if (!found) throw new Error(`${manifest.name} needs ${name}, not found.`);
      pending.push(found);
    }
    for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
      const found = packageDir(dir, name);
      if (found) pending.push(found);
    }
  }
}

/** Where `name` resolves from `dir`, as Node looks it up: each ancestor's node_modules. */
function packageDir(dir: string, name: string): string | undefined {
  for (let at = realpathSync(dir); ; at = dirname(at)) {
    if (basename(at) !== "node_modules") {
      const candidate = join(at, "node_modules", name);
      if (existsSync(join(candidate, "package.json")))
        return realpathSync(candidate);
    }
    if (dirname(at) === at) return undefined;
  }
}

async function run(command: string[]) {
  const child = Bun.spawn(command, {
    cwd: root,
    stdio: ["inherit", "inherit", "inherit"],
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`${command.join(" ")} exited with ${code}`);
}
