/**
 * QwenPaw adapter — the QwenPaw skill plaza on the AgentScope Platform
 * (https://platform.agentscope.io, "skills" tab).
 *
 * QwenPaw (github.com/agentscope-ai/QwenPaw, AgentScope team) is an OpenClaw-
 * compatible agent harness; its plaza publishes Agent Skills in exactly the
 * `SKILL.md` format DSH loads. Endpoints (reads anonymous):
 *   search   GET /openapi/v1/skills?page_size=&page_number=&search= → { data:{ total, skills[] } }
 *   download GET /skills/{@owner/name}/archive/zip/{version}        → application/zip
 *            GET /api/v1/skills/{uuid}/download                     → application/zip
 *
 * There is no JSON detail endpoint (the `/skills/{id}` URL serves the SPA), so
 * `detail` reads the SKILL.md straight out of the archive and caches it.
 */

import { fetchJson, fetchBytes, query, encodePathId } from "../http.js";
import { readZipEntries, rebaseToSkillRoot, toText } from "../zip.js";

export const SOURCE_ID = "qwenpaw";
export const BASE_URL = "https://platform.agentscope.io";

/** Small TTL cache so opening a detail card twice does not re-download the zip. */
const detailCache = new Map();
const DETAIL_TTL_MS = 5 * 60 * 1000;
const DETAIL_CACHE_MAX = 24;

function remember(key, value) {
  detailCache.set(key, { at: Date.now(), value });
  if (detailCache.size > DETAIL_CACHE_MAX) {
    const oldest = detailCache.keys().next().value;
    detailCache.delete(oldest);
  }
}

function recall(key) {
  const hit = detailCache.get(key);
  if (hit === undefined) return undefined;
  if (Date.now() - hit.at > DETAIL_TTL_MS) {
    detailCache.delete(key);
    return undefined;
  }
  return hit.value;
}

function normalize(item) {
  const locale = item.locales?.zh ?? item.locales?.en ?? {};
  return {
    source: SOURCE_ID,
    id: item.id,
    owner: item.owner ?? String(item.id ?? "").split("/")[0]?.replace(/^@/u, ""),
    ownerName: item.owner ?? item.developer,
    avatar: item.logo_url ?? item.avatar,
    name: String(item.id ?? "").split("/").slice(1).join("/") || item.id,
    displayName: item.display_name ?? locale.display_name ?? String(item.id ?? "").split("/").slice(1).join("/"),
    summary: locale.description ?? item.description ?? "",
    version: item.version,
    downloads: item.downloads ?? 0,
    installs: 0,
    stars: 0,
    license: item.license,
    category: locale.category,
    categories: [item.locales?.zh?.category, item.locales?.en?.category].filter(Boolean),
    topics: [],
    url: item.details_url ?? `${BASE_URL}/skills/${encodePathId(item.id ?? "")}`,
    uuid: item.details_url?.split("/").pop(),
    installable: true,
  };
}

/** @type {import("./index.js").SourceAdapter} */
export const qwenpaw = {
  id: SOURCE_ID,
  label: "QwenPaw",
  baseUrl: BASE_URL,
  homeUrl: `${BASE_URL}/skills`,
  capabilities: { search: true, browse: true, detail: true, download: true },

  async search({ q, limit = 24, cursor, timeoutMs, signal }) {
    const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);
    const size = Math.min(Math.max(1, limit), 100);
    const body = await fetchJson(`${BASE_URL}/openapi/v1/skills${query({
      search: String(q ?? "").trim(),
      page_number: page,
      page_size: size,
    })}`, { timeoutMs, signal });
    const data = body.data ?? {};
    const items = (data.skills ?? []).map(normalize);
    const total = Number(data.total ?? 0);
    return {
      source: SOURCE_ID,
      items,
      nextCursor: page * size < total ? String(page + 1) : undefined,
    };
  },

  async detail({ id, version, timeoutMs, signal }) {
    const key = `${id}@${version ?? ""}`;
    const cached = recall(key);
    if (cached !== undefined) return cached;
    const { bytes } = await this.download({ id, version, timeoutMs, signal });
    const entries = rebaseToSkillRoot(readZipEntries(bytes));
    const skillFile = entries.find((entry) => entry.path.toLowerCase() === "skill.md");
    const skillMd = skillFile === undefined ? undefined : toText(skillFile.data);
    const value = {
      skill: {
        source: SOURCE_ID,
        id,
        owner: String(id).split("/")[0]?.replace(/^@/u, ""),
        name: String(id).split("/").slice(1).join("/"),
        displayName: String(id).split("/").slice(1).join("/"),
        summary: "",
        version,
        downloads: 0,
        installs: 0,
        stars: 0,
        url: `${BASE_URL}/skills/${encodePathId(id)}`,
        installable: true,
      },
      skillMd,
      files: entries.map((entry) => ({ path: entry.path, size: entry.data.length, type: "blob" })),
      meta: { downloaded: true },
    };
    remember(key, value);
    return value;
  },

  async download({ id, version, uuid, timeoutMs, signal }) {
    const attempts = [];
    // The uuid download route is the plaza's own "Download" button.
    if (uuid) attempts.push({ url: `${BASE_URL}/api/v1/skills/${encodeURIComponent(uuid)}/download`, label: uuid.slice(0, 8) });
    if (version) attempts.push({ url: `${BASE_URL}/skills/${encodePathId(id)}/archive/zip/${encodeURIComponent(version)}`, label: version });
    attempts.push({ url: `${BASE_URL}/skills/${encodePathId(id)}/archive/zip/main`, label: "main" });
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const bytes = await fetchBytes(attempt.url, { timeoutMs, signal });
        return { bytes, filename: `${String(id).split("/").slice(1).join("-")}-${attempt.label}.zip` };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`QwenPaw archive unavailable for ${id}`);
  },
};
