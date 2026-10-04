/**
 * Archive helpers over `fflate` (the only runtime dependency).
 *
 * - `readSkillArchive` turns a downloaded zip into safe, normalized entries.
 * - `buildSkillZip` packs one skill directory for export.
 *
 * Every entry path is normalized to forward slashes and rejected when it
 * escapes the target root (`..`, absolute, drive-letter or UNC prefixes).
 */

import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

/** Hard caps for a downloaded/imported skill archive. */
export const ARCHIVE_LIMITS = {
  maxEntries: 800,
  maxTotalBytes: 64 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024,
};

/**
 * Normalize one archive entry name, or return null when it is unsafe.
 * @param {string} name raw entry name
 * @returns {string | null} safe relative POSIX path
 */
export function safeEntryPath(name) {
  if (typeof name !== "string" || name.trim() === "") return null;
  let path = name.replace(/\\/gu, "/").replace(/^\.\//u, "");
  if (path.startsWith("/")) return null;
  if (/^[A-Za-z]:/u.test(path)) return null;
  const segments = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    segments.push(segment);
  }
  if (segments.length === 0) return null;
  return segments.join("/");
}

/**
 * Unzip an archive into safe entries, dropping directory markers.
 * @param {Uint8Array} bytes zip bytes
 * @returns {{ path: string, data: Uint8Array }[]} normalized file entries
 */
export function readZipEntries(bytes) {
  const files = unzipSync(bytes, { filter: () => true });
  const entries = [];
  let total = 0;
  for (const [rawName, data] of Object.entries(files)) {
    if (rawName.endsWith("/")) continue;
    const path = safeEntryPath(rawName);
    if (path === null) continue;
    total += data.length;
    if (data.length > ARCHIVE_LIMITS.maxEntryBytes) {
      throw new Error(`archive entry too large: ${path}`);
    }
    entries.push({ path, data });
    if (entries.length > ARCHIVE_LIMITS.maxEntries) {
      throw new Error(`archive has more than ${ARCHIVE_LIMITS.maxEntries} files`);
    }
    if (total > ARCHIVE_LIMITS.maxTotalBytes) {
      throw new Error(`archive is larger than ${ARCHIVE_LIMITS.maxTotalBytes} bytes`);
    }
  }
  return entries;
}

/**
 * If every entry shares one top-level directory (zip exports usually do),
 * strip it so the skill lands directly in the target folder.
 * @param {{ path: string, data: Uint8Array }[]} entries archive entries
 * @returns {{ path: string, data: Uint8Array }[]} rebased entries
 */
export function stripCommonRoot(entries) {
  if (entries.length === 0) return entries;
  const roots = new Set(entries.map((entry) => entry.path.split("/")[0]));
  if (roots.size !== 1) return entries;
  const root = [...roots][0];
  // Only strip when the shared root is a real folder that contains files below it.
  const nested = entries.filter((entry) => entry.path.includes("/"));
  if (nested.length === 0) return entries;
  return entries.map((entry) => ({ path: entry.path.slice(root.length + 1), data: entry.data }));
}

/**
 * Detect the directory that holds `SKILL.md` inside an archive and rebase onto
 * it (zip viewers wrap skills in `repo-version-sha/`, `skill/`, …).
 * @param {{ path: string, data: Uint8Array }[]} entries normalized entries
 * @returns {{ path: string, data: Uint8Array }[]} entries rooted at the SKILL.md directory
 */
export function rebaseToSkillRoot(entries) {
  const stripped = stripCommonRoot(entries);
  const withSkill = stripped.filter((entry) => /(^|\/)SKILL\.md$/iu.test(entry.path));
  if (withSkill.length === 0) return stripped;
  // Prefer the shallowest SKILL.md.
  const target = withSkill
    .slice()
    .sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  const dir = target.path.includes("/") ? target.path.slice(0, target.path.lastIndexOf("/")) : "";
  if (dir === "") return stripped;
  const prefix = `${dir}/`;
  return stripped
    .filter((entry) => entry.path.startsWith(prefix) || entry.path === dir)
    .map((entry) => ({ path: entry.path.slice(prefix.length), data: entry.data }));
}

/**
 * Pack a flat entry list into a zip buffer.
 * @param {{ path: string, data: Uint8Array | string }[]} entries files to pack
 * @returns {Uint8Array} zip bytes
 */
export function buildZip(entries) {
  const files = Object.create(null);
  for (const entry of entries) {
    const path = safeEntryPath(entry.path);
    if (path === null) continue;
    files[path] = typeof entry.data === "string" ? strToU8(entry.data) : entry.data;
  }
  return zipSync(files, { level: 6 });
}

/** UTF-8 decode helper shared by the sources. */
export const toText = (data) => strFromU8(data);
