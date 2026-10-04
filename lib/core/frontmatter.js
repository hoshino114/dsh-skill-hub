/**
 * Minimal YAML frontmatter reader/writer for Agent Skills `SKILL.md` files.
 *
 * Deliberately dependency-free and loss-preserving: unknown keys and their raw
 * scalars survive a rewrite round-trip, so editing `description` never drops a
 * `metadata: {"clawdbot": ...}` line a skill carries.
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Unquote one YAML scalar ('' escapes inside single quotes, \" \n \\ inside double). */
function unquote(raw) {
  const text = raw.trim();
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) {
    return text.slice(1, -1).replace(/''/g, "'");
  }
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try {
      return JSON.parse(text);
    } catch {
      return text.slice(1, -1);
    }
  }
  return text;
}

/** Quote a scalar so `:`, `#`, leading/trailing spaces and newlines stay literal. */
export function quoteScalar(value) {
  const text = String(value ?? "").replace(/[\r\n]+/gu, " ").trim();
  return `'${text.replace(/'/g, "''")}'`;
}

/**
 * Parse `---\n<yaml>\n---\n<body>` into raw entries plus convenient scalars.
 * @param {string} content raw SKILL.md text
 * @returns {{ raw: Record<string, string>, fields: Record<string, string>, body: string, hasFrontmatter: boolean }}
 */
export function parseFrontmatter(content) {
  const text = String(content ?? "");
  const match = FRONTMATTER_RE.exec(text);
  const raw = Object.create(null);
  const fields = Object.create(null);
  if (match === null) {
    return { raw, fields, body: text, hasFrontmatter: false };
  }
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const pair = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line);
    if (pair === null) continue;
    const key = pair[1];
    let value = pair[2];
    // Fold block scalars (|, >) and continuation lines into the raw value.
    const block = /^[|>][+-]?$/.test(value.trim());
    while (block && i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
      i += 1;
      value += `\n${lines[i]}`;
    }
    raw[key] = value;
    if (!block) fields[key] = unquote(value);
  }
  return { raw, fields, body: match[2].replace(/^\r?\n/u, ""), hasFrontmatter: true };
}

/** Return only the markdown body of a SKILL.md (frontmatter stripped). */
export function stripFrontmatter(content) {
  return parseFrontmatter(content).body;
}

/**
 * Rebuild a SKILL.md with `updates` applied to the frontmatter block.
 * Existing keys keep their position and any non-updated keys keep their raw
 * scalar verbatim; new keys are appended in `updates` order.
 * @param {string} content current file text
 * @param {Record<string, string | number | boolean | undefined | null>} updates field values
 * @returns {string} rewritten file text
 */
export function rewriteFrontmatter(content, updates) {
  const text = String(content ?? "");
  const match = FRONTMATTER_RE.exec(text);
  const body = match === null ? text : match[2];
  const lines = match === null ? [] : match[1].split(/\r?\n/);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const pair = /^([A-Za-z0-9_.-]+):[ \t]*(.*)$/.exec(line);
    if (pair === null) {
      out.push(line);
      continue;
    }
    const key = pair[1];
    let value = pair[2];
    const block = /^[|>][+-]?$/.test(value.trim());
    const consumed = [line];
    while (block && i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
      i += 1;
      consumed.push(lines[i]);
    }
    if (!Object.prototype.hasOwnProperty.call(updates, key) || updates[key] === undefined) {
      out.push(...consumed);
      continue;
    }
    seen.add(key);
    // `null` removes the key entirely (used to re-enable a disabled skill).
    if (updates[key] !== null) out.push(`${key}: ${formatValue(updates[key])}`);
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null || seen.has(key)) continue;
    out.push(`${key}: ${formatValue(value)}`);
  }
  const block = out.length > 0 ? `---\n${out.join("\n")}\n---` : "";
  const rest = body.startsWith("\n") ? body : `\n${body}`;
  return `${block}${rest}`;
}

function formatValue(value) {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return quoteScalar(String(value));
}

/**
 * Set one boolean-ish frontmatter field on a file (atomic write).
 * Kept as a helper so route handlers and the installer share one rewrite path.
 * @param {(path: string) => string} read file reader
 * @param {(path: string, text: string) => void} write atomic file writer
 * @param {string} file SKILL.md path
 * @param {Record<string, string | number | boolean | undefined | null>} updates field updates
 * @returns {Record<string, string>} raw frontmatter after the rewrite
 */
export function updateFrontmatterFile(read, write, file, updates) {
  const next = rewriteFrontmatter(read(file), updates);
  write(file, next);
  return parseFrontmatter(next).raw;
}
