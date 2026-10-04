/**
 * Local Agent Skill management: scan the official skill roots, read one
 * skill, and create / update / enable / delete / export / import skills.
 *
 * Root conventions follow DSH's own skill-filesystem provider:
 *   user         <DSH_HOME>/skills            (default ~/.dsh/skills)
 *   agents       ~/.agents/skills
 *   project      <project root>/.dsh/skills   and  <project>/.agents/skills
 *   custom       whatever `customSkillDirs` lists
 *
 * A skill is either a directory carrying `SKILL.md` or a bare `<name>.md`.
 */

import { homedir } from "node:os";
import { join, dirname, basename, sep } from "node:path";
import {
  existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, statSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import {
  readdir, stat, mkdir, writeFile, rename, rm, copyFile, readFile,
} from "node:fs/promises";
import { parseFrontmatter, rewriteFrontmatter, quoteScalar } from "./frontmatter.js";
import { buildZip, readZipEntries, rebaseToSkillRoot, toText } from "./zip.js";

/** Display order of the source groups in the panel. */
export const SOURCE_GROUPS = [
  { key: "user", title: "User skills (~/.dsh/skills)", titleZh: "用户技能（~/.dsh/skills）", hint: "Global skills shared by every project on this machine" },
  { key: "project", title: "Project skills", titleZh: "项目技能", hint: "Inside the current workspace (.dsh/skills or .agents/skills)" },
  { key: "custom", title: "Custom directories", titleZh: "自定义目录", hint: "Extra roots from the plugin's customSkillDirs config" },
  { key: "agents", title: "Agent skills (~/.agents/skills)", titleZh: "Agent 技能（~/.agents/skills）", hint: "Shared with other agent harnesses" },
  { key: "other", title: "Other", titleZh: "其他", hint: "Bundled / runtime-registered skills" },
];

const LEVEL_GROUP = new Map([
  ["user-dsh", "user"],
  ["user-agents", "agents"],
  ["project-dsh", "project"],
  ["project-agents", "project"],
  ["custom", "custom"],
]);

/** Filesystem precedence across roots (project wins over custom wins over user). */
const LEVEL_RANK = new Map([
  ["project-dsh", 0],
  ["project-agents", 1],
  ["custom", 2],
  ["user-dsh", 3],
  ["user-agents", 4],
]);

/** Loose skill-name check: whatever survives as a directory name on Windows/macOS. */
export const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Resolve the dsh home directory (env override wins, like the harness itself). */
export function dshHomeDir(env = process.env) {
  return env.DSH_HOME?.trim() || join(homedir(), ".dsh");
}

/** Resolve the shared ~/.agents home. */
export function agentsHomeDir(env = process.env) {
  return env.DSH_AGENTS_HOME?.trim() || join(homedir(), ".agents");
}

/** Nearest ancestor directory containing .git (cwd itself when there is none). */
export function findProjectRoot(cwd) {
  let current = cwd;
  for (;;) {
    if (existsSync(join(current, ".git"))) return current;
    const parent = dirname(current);
    if (parent === current) return cwd;
    current = parent;
  }
}

/**
 * Every skill root to scan, in precedence order.
 * @param {{ dshHome?: string, agentsHome?: string, cwd?: string, projectRoots?: string[], customSkillDirs?: string[] }} options
 */
export function skillRoots(options = {}) {
  const dshHome = options.dshHome ?? dshHomeDir();
  const agentsHome = options.agentsHome ?? agentsHomeDir();
  const cwd = options.cwd ?? process.cwd();
  const roots = [];
  const projectRoots = [...new Set([findProjectRoot(cwd), ...(options.projectRoots ?? [])])];
  for (const root of projectRoots) {
    roots.push({ level: "project-dsh", dir: join(root, ".dsh", "skills"), projectRoot: root });
    roots.push({ level: "project-agents", dir: join(root, ".agents", "skills"), projectRoot: root });
  }
  for (const dir of options.customSkillDirs ?? []) roots.push({ level: "custom", dir });
  roots.push({ level: "user-dsh", dir: join(dshHome, "skills"), userRoot: true });
  roots.push({ level: "user-agents", dir: join(agentsHome, "skills") });
  return roots;
}

/** The default install root: the user skills directory. */
export function userSkillRoot(dshHome = dshHomeDir()) {
  return join(dshHome, "skills");
}

/** The project skill root for a workspace cwd. */
export function projectSkillRoot(cwd) {
  return join(findProjectRoot(cwd), ".dsh", "skills");
}

/** Skill file descriptor produced by the scan. */
function makeSkill(file, dir, level, parsed) {
  const fields = parsed.fields;
  let size = 0;
  let updatedAt = 0;
  try {
    const info = statSync(file);
    size = info.size;
    updatedAt = info.mtimeMs;
  } catch { /* keep zeros */ }
  const modelInvocable = fields["disable-model-invocation"] !== "true";
  return {
    name: fields.name ?? basename(file, ".md"),
    description: fields.description ?? "(no description)",
    whenToUse: fields.whenToUse,
    version: fields.version,
    level,
    group: LEVEL_GROUP.get(level) ?? "other",
    path: file,
    dir,
    linked: false,
    enabled: modelInvocable,
    modelInvocable,
    userInvocable: fields["user-invocable"] !== "false",
    bytes: size,
    updatedAt,
  };
}

/**
 * Scan one skill root (one level: `<name>/SKILL.md` or `<name>.md`).
 * @param {string} root directory to scan
 * @param {string} level source level key
 * @param {Map<string, object>} into accumulator keyed by skill name
 */
async function scanRoot(root, level, into) {
  if (!existsSync(root)) return;
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    let file = null;
    let dir = null;
    let linked = false;
    if (entry.isDirectory()) {
      dir = join(root, entry.name);
      file = join(dir, "SKILL.md");
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      file = join(root, entry.name);
      dir = root;
    } else if (entry.isSymbolicLink()) {
      linked = true;
      try {
        const target = await stat(join(root, entry.name));
        if (target.isDirectory()) {
          dir = join(root, entry.name);
          file = join(dir, "SKILL.md");
        } else if (target.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          file = join(root, entry.name);
          dir = root;
        } else {
          continue;
        }
      } catch {
        continue;
      }
    } else {
      continue;
    }
    if (!existsSync(file)) continue;
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const skill = makeSkill(file, dir, level, parseFrontmatter(content));
    skill.linked = linked;
    if (!NAME_PATTERN.test(skill.name)) continue;
    const existing = into.get(skill.name);
    if (existing !== undefined && (LEVEL_RANK.get(existing.level) ?? 99) <= (LEVEL_RANK.get(level) ?? 99)) continue;
    into.set(skill.name, skill);
  }
}

/**
 * Collect every local skill, grouped for the panel.
 * @param {object} options see {@link skillRoots}
 * @returns {Promise<{ skills: object[], groups: object[], roots: object[] }>}
 */
export async function scanSkills(options = {}) {
  const roots = skillRoots(options);
  const byName = new Map();
  await Promise.all(roots.map((root) => scanRoot(root.dir, root.level, byName)));
  const skills = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  const grouped = new Map();
  for (const skill of skills) {
    const list = grouped.get(skill.group) ?? [];
    list.push(skill);
    grouped.set(skill.group, list);
  }
  const groups = SOURCE_GROUPS.filter((group) => (grouped.get(group.key) ?? []).length > 0)
    .map((group) => ({ ...group, skills: grouped.get(group.key) }));
  return {
    skills,
    groups,
    roots: roots.map((root) => ({ level: root.level, dir: root.dir, exists: existsSync(root.dir) })),
  };
}

/** Read one skill file: frontmatter fields plus the markdown body. */
export function readSkill(file) {
  const content = readFileSync(file, "utf8");
  const parsed = parseFrontmatter(content);
  return {
    path: file,
    name: parsed.fields.name ?? basename(file, ".md"),
    description: parsed.fields.description ?? "",
    whenToUse: parsed.fields.whenToUse,
    version: parsed.fields.version,
    frontmatter: parsed.raw,
    content: parsed.body.trim(),
    raw: content,
  };
}

/** Keep a raw scalar verbatim when it is already a YAML scalar/flow collection. */
function rawScalar(value) {
  const text = String(value ?? "").trim();
  return /^['"]|^[[{]/.test(text) ? text : quoteScalar(text);
}

/** Build SKILL.md text for a new/edited skill. */
export function buildSkillContent({ name, description, whenToUse, content, extra, disabled }) {
  const lines = ["---", `name: ${quoteScalar(name)}`, `description: ${quoteScalar(description)}`];
  if (whenToUse !== undefined && String(whenToUse).trim() !== "") {
    lines.push(`whenToUse: ${quoteScalar(whenToUse)}`);
  }
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value === undefined || value === null || String(value).trim() === "") continue;
    lines.push(`${key}: ${rawScalar(value)}`);
  }
  if (disabled === true) lines.push("disable-model-invocation: true");
  lines.push("---", "", String(content ?? "").trim(), "");
  return lines.join("\n");
}

/** Atomic text write (temp file + rename), same trick the harness uses. */
function atomicWrite(file, text) {
  const tmp = `${file}.${Date.now().toString(36)}.${randomBytes(4).toString("hex")}.tmp`;
  try {
    writeFileSync(tmp, text, { encoding: "utf8", flag: "wx" });
    renameSync(tmp, file);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch { /* ignore */ }
    throw error;
  }
}

/** Create a new skill directory under `baseDir`. Returns the SKILL.md path. */
export async function createSkill(baseDir, { name, description, whenToUse, content, extra }) {
  const skillName = String(name ?? "").trim();
  if (!NAME_PATTERN.test(skillName)) {
    throw Object.assign(new Error("skill name must use letters, digits, dot, dash or underscore"), { code: 400 });
  }
  const dir = join(baseDir, skillName);
  const target = join(dir, "SKILL.md");
  if (existsSync(target)) {
    throw Object.assign(new Error(`skill ${skillName} already exists at ${target}`), { code: 409 });
  }
  await mkdir(dir, { recursive: true });
  await writeFile(target, buildSkillContent({ name: skillName, description, whenToUse, content, extra }), "utf8");
  return target;
}

/** Frontmatter keys owned by the editor form (everything else is preserved). */
const KNOWN_KEYS = new Set(["name", "description", "whenToUse", "disable-model-invocation"]);

/** Overwrite an existing SKILL.md, preserving its enabled state and extra keys. */
export async function updateSkill(file, { name, description, whenToUse, content, extra }) {
  const current = readSkill(file);
  const mergedExtra = { ...(extra ?? {}) };
  for (const [key, value] of Object.entries(current.frontmatter)) {
    if (KNOWN_KEYS.has(key) || key in mergedExtra) continue;
    mergedExtra[key] = String(value).trim();
  }
  const disabled = current.frontmatter["disable-model-invocation"] === "true";
  atomicWrite(file, buildSkillContent({
    name: name ?? current.name,
    description: description ?? current.description,
    whenToUse: whenToUse ?? current.whenToUse,
    content: content ?? current.content,
    extra: mergedExtra,
    disabled,
  }));
  return file;
}

/** Enable or disable model invocation for one skill (rewrites one frontmatter key). */
export async function setSkillEnabled(file, enabled) {
  atomicWrite(file, rewriteFrontmatter(readFileSync(file, "utf8"), {
    "disable-model-invocation": enabled ? null : true,
  }));
  return enabled;
}

/** Move a skill file to its `.trash` sibling (recoverable delete). */
export async function trashSkill(file) {
  const trashDir = join(dirname(file), ".trash");
  await mkdir(trashDir, { recursive: true });
  const target = join(trashDir, `${Date.now()}-${basename(file)}`);
  await rename(file, target);
  return target;
}

/**
 * Export one skill as a zip (its whole directory, or the single .md file).
 * @param {string} file SKILL.md path
 * @returns {Promise<{ name: string, bytes: Uint8Array }>}
 */
export async function exportSkillZip(file) {
  const skill = readSkill(file);
  const dir = dirname(file);
  const entries = [];
  if (basename(file) === "SKILL.md") {
    const stack = [dir];
    while (stack.length > 0 && entries.length < 800) {
      const current = stack.pop();
      const items = await readdir(current, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith(".") || item.name === "node_modules") continue;
        const full = join(current, item.name);
        if (item.isDirectory()) {
          stack.push(full);
        } else if (item.isFile()) {
          const rel = full.slice(dir.length + 1).split(sep).join("/");
          entries.push({ path: rel, data: await readFile(full) });
        }
      }
    }
  } else {
    entries.push({ path: `${skill.name}.md`, data: await readFile(file) });
  }
  return { name: skill.name, bytes: buildZip(entries) };
}

/**
 * Install a zip into `baseDir` as one skill directory.
 * @param {Uint8Array} bytes archive bytes
 * @param {string} baseDir target skills root
 * @param {{ name?: string, overwrite?: boolean }} options naming/overwrite policy
 * @returns {Promise<{ name: string, path: string, files: string[] }>}
 */
export async function installSkillArchive(bytes, baseDir, options = {}) {
  const entries = rebaseToSkillRoot(readZipEntries(bytes));
  const skillFile = entries.find((entry) => entry.path.toLowerCase() === "skill.md");
  if (skillFile === undefined) {
    throw Object.assign(new Error("archive has no SKILL.md at its skill root"), { code: 400 });
  }
  const parsed = parseFrontmatter(toText(skillFile.data));
  const name = String(options.name ?? parsed.fields.name ?? "imported-skill").trim();
  if (!NAME_PATTERN.test(name)) {
    throw Object.assign(new Error(`invalid skill name ${JSON.stringify(name)}`), { code: 400 });
  }
  const dir = join(baseDir, name);
  const target = join(dir, "SKILL.md");
  if (existsSync(target) && options.overwrite !== true) {
    throw Object.assign(new Error(`skill ${name} already exists at ${target}`), { code: 409 });
  }
  await mkdir(dir, { recursive: true });
  const files = [];
  for (const entry of entries) {
    const dest = join(dir, ...entry.path.split("/"));
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, entry.data);
    files.push(entry.path);
  }
  if (parsed.fields.name !== name) {
    atomicWrite(target, rewriteFrontmatter(readFileSync(target, "utf8"), { name }));
  }
  return { name, path: target, files };
}

/** Copy a single file into a skill directory. */
export async function copyIntoSkill(dir, source, relPath) {
  const dest = join(dir, ...relPath.split("/"));
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(source, dest);
  return dest;
}

/** Remove an installed skill directory entirely (install rollback). */
export async function removeSkillDir(dir) {
  await rm(dir, { recursive: true, force: true });
}
