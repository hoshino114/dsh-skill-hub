/**
 * Extract one file from an Electron asar archive (read-only inspection of the
 * shipped dsh runtime). Usage: node scripts/asar-extract.mjs <asar> <pattern> [outDir]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const [asarPath, pattern, outDir = "tmp-asar"] = process.argv.slice(2);
if (!asarPath || !pattern) {
  console.error("usage: node scripts/asar-extract.mjs <asar> <regex> [outDir]");
  process.exit(1);
}

const fd = readFileSync(asarPath);
// asar layout: [uint32 pickle size][uint32 header pickle length][pickle: uint32 str length][JSON][file data]
const headerPickleSize = fd.readUInt32LE(4);
const jsonLength = fd.readUInt32LE(8);
const headerJson = fd.subarray(12, 12 + jsonLength).toString("utf8");
const header = JSON.parse(headerJson);
const dataOffset = 8 + headerPickleSize;

const regex = new RegExp(pattern, "i");
const matches = [];

function walk(node, path) {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const next = `${path}/${name}`;
    if (child.files) {
      walk(child, next);
    } else if (regex.test(next)) {
      matches.push({ path: next, offset: child.offset, size: child.size });
    }
  }
}
walk(header, "");

console.log(`matches: ${matches.length}`);
mkdirSync(outDir, { recursive: true });
for (const match of matches.slice(0, 40)) {
  const start = dataOffset + Number(match.offset);
  const bytes = fd.subarray(start, start + Number(match.size));
  const safe = match.path.replace(/[^A-Za-z0-9._-]+/gu, "_").slice(-120);
  const target = join(outDir, safe);
  writeFileSync(target, bytes);
  console.log(`  ${match.path} (${match.size}b) -> ${target}`);
}
