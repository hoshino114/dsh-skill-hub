/**
 * Build the two plugin halves.
 *
 * 1. Browser bundle: esbuild → CJS with `react` external, wrapped into the
 *    harness client-module loader (`window.__ModuleLoader__.load`).
 * 2. Host bundle: esbuild → a single ESM file named by its content hash.
 *
 * The hashed host name matters: the loader caches imported modules by URL for
 * the life of the process, so a rebuilt `lib/index.js` at the same path would
 * never reach a running host. A new file name is a new URL, so toggling the
 * bundle (plugin-manager) remounts the fresh code without an app restart.
 * `package.json`'s `main` / `exports["."]` are repointed at the new bundle.
 *
 * Run: node scripts/build.mjs
 */

import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const intermediate = join(root, "lib", "client.built.cjs");
const outfile = join(root, "lib", "client.js");

mkdirSync(join(root, "lib"), { recursive: true });

// ------------------------------------------------------------------ client
await build({
  entryPoints: [join(root, "src", "client", "index.jsx")],
  outfile: intermediate,
  bundle: true,
  format: "cjs",
  platform: "browser",
  target: ["es2020"],
  jsx: "automatic",
  external: ["react", "react/jsx-runtime", "react-dom"],
  legalComments: "none",
  logLevel: "warning",
});

const raw = readFileSync(intermediate, "utf8");
const wrapped = `window.__ModuleLoader__.load({
\tid: "dsh-skill-hub",
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${raw}
\t\treturn module.exports;
\t}
});
`;
writeFileSync(outfile, wrapped, "utf8");
rmSync(intermediate);

// -------------------------------------------------------------------- host
const hostBuild = await build({
  entryPoints: [join(root, "lib", "index.js")],
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node20"],
  // The loader provides the dsh SDK packages at runtime; everything else
  // (fflate) is bundled so the install carries no runtime dependency tree.
  external: ["@deepseek-ai/*"],
  write: false,
  legalComments: "none",
  logLevel: "warning",
});
const hostCode = hostBuild.outputFiles[0].text;
const hostHash = createHash("sha256").update(hostCode).digest("hex").slice(0, 12);
const hostName = `host-${hostHash}.js`;
writeFileSync(join(root, "lib", hostName), hostCode, "utf8");
for (const file of readdirSync(join(root, "lib"))) {
  if (/^host-.*\.js$/u.test(file) && file !== hostName) rmSync(join(root, "lib", file));
}

const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
manifest.main = `./lib/${hostName}`;
manifest.exports = { ...(manifest.exports ?? {}), ".": `./lib/${hostName}` };
writeFileSync(join(root, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`built ${outfile} (${wrapped.length} bytes)`);
console.log(`built lib/${hostName} (${hostCode.length} bytes) -> package.json main`);
