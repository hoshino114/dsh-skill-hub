/**
 * Install dsh-skill-hub into a dsh profile.
 *
 *   node scripts/install.mjs [--profile <dir>] [--uninstall]
 *
 * Strategy (pnpm-stable, no registry lookup for our own package):
 *   1. stage the built package under <profile>/packages/dsh-skill-hub
 *      (with its runtime dependencies vendored into its own node_modules)
 *   2. link <profile>/node_modules/dsh-skill-hub at it (junction / symlink)
 *   3. declare `"dsh-skill-hub": "file:./packages/dsh-skill-hub"` plus the
 *      bundle entry in <profile>/package.json
 *
 * The `file:` spec matters: an unrelated `dsh-skill-hub` exists on npm, so a
 * plain version range would be resolved from the registry on the next
 * `pnpm install` and silently replace this plugin.
 */

import {
  existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, cpSync,
  readdirSync, statSync, symlinkSync, lstatSync, copyFileSync,
} from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const argValue = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const profile = resolve(argValue("--profile") ?? join(homedir(), ".dsh", "profiles", "desktop"));
const packageName = "dsh-skill-hub";
const bundleId = "skill-hub";

/** Runtime dependencies vendored into the staged package (peers resolve from the loader). */
const VENDORED_DEPS = [
  { dep: "fflate", required: true },
  { dep: "@deepseek-ai/schemastery", required: true },
  // Transitive dependencies of schemastery; resolved from its own context below.
  { dep: "@deepseek-ai/cosmokit", required: false },
  { dep: "@standard-schema/spec", required: false },
];

const profilePkgPath = join(profile, "package.json");
if (!existsSync(profilePkgPath)) {
  console.error(`no dsh profile at ${profile} (pass --profile <dir>)`);
  process.exit(1);
}

const profilePkg = JSON.parse(readFileSync(profilePkgPath, "utf8"));
const bundles = profilePkg?.dsh?.profile?.bundles ?? [];
const stagedDir = join(profile, "packages", packageName);
const linkedDir = join(profile, "node_modules", packageName);

// ------------------------------------------------------------------ uninstall
if (args.includes("--uninstall")) {
  const nextBundles = bundles.filter((entry) => entry !== packageName);
  if (profilePkg.dependencies) delete profilePkg.dependencies[packageName];
  profilePkg.dsh = { ...(profilePkg.dsh ?? {}), profile: { ...(profilePkg.dsh?.profile ?? {}), bundles: nextBundles } };
  writeFileSync(profilePkgPath, `${JSON.stringify(profilePkg, null, 2)}\n`, "utf8");
  removeLink(linkedDir);
  rmSync(stagedDir, { recursive: true, force: true });
  console.log(`removed ${packageName} from ${profile}`);
  console.log("restart dsh to drop the plugin from the running composition");
  process.exit(0);
}

// --------------------------------------------------------------------- checks
const required = ["package.json", "cordis.patch.yml", "lib/index.js", "lib/client.js"];
for (const file of required) {
  if (!existsSync(join(root, file))) {
    console.error(`missing ${file} — run \`node scripts/build.mjs\` first`);
    process.exit(1);
  }
}

// --------------------------------------------------------------------- backup
const stamp = new Date().toISOString().replace(/[:.]/gu, "-");
for (const file of ["package.json", "pnpm-lock.yaml"]) {
  const source = join(profile, file);
  if (existsSync(source)) copyFileSync(source, `${source}.bak-${stamp}`);
}

// --------------------------------------------------------------- stage package
rmSync(stagedDir, { recursive: true, force: true });
mkdirSync(stagedDir, { recursive: true });
for (const file of ["package.json", "cordis.patch.yml", "README.md", "icon.svg"]) {
  if (existsSync(join(root, file))) copyFileSync(join(root, file), join(stagedDir, file));
}
cpSync(join(root, "lib"), join(stagedDir, "lib"), { recursive: true });

// Vendor runtime dependencies next to the package so the install is
// self-contained even before any pnpm run. `@deepseek-ai/dsh-tools` is
// deliberately NOT vendored: the loader provides the runtime SDK, and a
// registry copy here would shadow it.
mkdirSync(join(stagedDir, "node_modules"), { recursive: true });

/** Locate an installed package's directory, resolving from `fromDir`'s context. */
function resolvePackageDir(dep, fromDir) {
  const requireFrom = createRequire(join(fromDir, "package.json"));
  try {
    return dirname(requireFrom.resolve(`${dep}/package.json`));
  } catch { /* fall through */ }
  try {
    let dir = dirname(requireFrom.resolve(dep));
    for (let depth = 0; depth < 8; depth += 1) {
      const manifest = join(dir, "package.json");
      if (existsSync(manifest) && JSON.parse(readFileSync(manifest, "utf8")).name === dep) return dir;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch { /* fall through */ }
  return join(fromDir, "node_modules", dep);
}

// Vendor the runtime dependencies transitively (pnpm nests transitive
// dependencies under .pnpm, so each package resolves its own deps).
const vendored = new Map();
const queue = VENDORED_DEPS.map(({ dep, required }) => ({ dep, from: root, required }));
while (queue.length > 0) {
  const { dep, from, required } = queue.shift();
  if (vendored.has(dep)) continue;
  const source = resolvePackageDir(dep, from);
  if (!existsSync(join(source, "package.json"))) {
    if (required) {
      console.error(`missing dependency ${dep} — run pnpm install in ${root} first`);
      process.exit(1);
    }
    continue;
  }
  vendored.set(dep, source);
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  for (const child of Object.keys(manifest.dependencies ?? {})) queue.push({ dep: child, from: source, required: false });
}
for (const [dep, source] of vendored) {
  const target = join(stagedDir, "node_modules", dep);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(source, target, { recursive: true, dereference: true });
}

// ---------------------------------------------------------------- link + patch
removeLink(linkedDir);
mkdirSync(dirname(linkedDir), { recursive: true });
try {
  symlinkSync(stagedDir, linkedDir, "junction");
} catch (error) {
  // Fall back to a straight copy when the platform refuses symlinks.
  console.warn(`symlink failed (${error.message}); copying instead`);
  cpSync(stagedDir, linkedDir, { recursive: true, dereference: true });
}

profilePkg.dependencies = {
  ...(profilePkg.dependencies ?? {}),
  [packageName]: `file:./${relative(profile, stagedDir).split(sep).join("/")}`,
};
if (!bundles.includes(packageName)) bundles.push(packageName);
profilePkg.dsh = { ...(profilePkg.dsh ?? {}), profile: { ...(profilePkg.dsh?.profile ?? {}), bundles } };
writeFileSync(profilePkgPath, `${JSON.stringify(profilePkg, null, 2)}\n`, "utf8");

console.log(`staged  ${stagedDir}`);
console.log(`linked  ${linkedDir}`);
console.log(`patched ${profilePkgPath}`);
console.log(`  dependencies.${packageName} = ${profilePkg.dependencies[packageName]}`);
console.log(`  dsh.profile.bundles += ${packageName} (row id ${bundleId})`);
console.log("");
console.log("next: restart DeepSeek Harness — the Skills panel appears in the left sidebar.");

function removeLink(path) {
  if (!existsSync(path)) return;
  try {
    const info = lstatSync(path);
    if (info.isSymbolicLink() || info.isLink?.()) {
      rmSync(path, { recursive: true, force: true });
      return;
    }
  } catch { /* fall through */ }
  rmSync(path, { recursive: true, force: true });
}
