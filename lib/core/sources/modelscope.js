/**
 * ModelScope adapter — 魔搭 "Skills 技能中心" (https://modelscope.cn/skills).
 *
 * Endpoints (reads are anonymous; writes need MODELSCOPE_API_TOKEN):
 *   search   GET /openapi/v1/skills?search=&page_number=&page_size=  → { success, data:{ skills[], total } }
 *   detail   GET /api/v1/skills/{path}/{name}                        → { Data:{ ReadMeContent = full SKILL.md, ... } }
 *   files    GET /api/v1/skills/{path}/{name}/repo/files?Revision=   → { Data:{ Files[] } }
 *   download GET /api/v1/skills/{path}/{name}/archive/zip/{rev}      → application/zip
 *
 * A skill id is `{Path}/{Name}` where Path may be `@anthropics`-style for
 * GitHub-synced orgs, so the last segment is the name and everything before it
 * is the path.
 */

import { fetchJson, fetchBytes, query, encodePathId, HttpError } from "../http.js";

export const SOURCE_ID = "modelscope";
export const BASE_URL = "https://modelscope.cn";

/** Split a ModelScope skill id into its repo path and skill name. */
export function splitId(id) {
  const text = String(id ?? "");
  const cut = text.lastIndexOf("/");
  if (cut <= 0) return { path: "", name: text };
  return { path: text.slice(0, cut), name: text.slice(cut + 1) };
}

function normalize(item) {
  return {
    source: SOURCE_ID,
    id: item.id ?? `${item.Path ?? item.path ?? ""}/${item.Name ?? item.name ?? ""}`,
    owner: item.owner ?? item.Owner,
    name: splitId(item.id ?? item.Name ?? item.name).name,
    displayName: item.display_name ?? item.DisplayName ?? splitId(item.id).name,
    summary: item.description ?? item.Description ?? "",
    version: item.version ?? item.Version,
    downloads: item.downloads ?? item.DownloadCount ?? 0,
    installs: item.installs ?? 0,
    stars: item.likes ?? item.Likes ?? 0,
    license: item.license ?? item.License,
    category: item.category ?? item.L1?.Name,
    categories: [
      item.category ?? item.L1?.Name,
      ...(item.tags ?? item.Tags ?? [])
        .filter((tag) => String(tag).startsWith("category:"))
        .map((tag) => String(tag).slice("category:".length)),
    ].filter(Boolean),
    avatar: item.logo_url ?? item.LogoURL,
    ownerName: item.developer ?? item.Developer ?? item.owner ?? item.Owner,
    topics: item.tags ?? item.Tags ?? [],
    url: `${BASE_URL}/skills/${encodePathId(item.id ?? "")}`,
    updatedAt: Date.parse(item.last_modified ?? item.GmtModify ?? "") || undefined,
    installable: true,
  };
}

/** @type {import("./index.js").SourceAdapter} */
export const modelscope = {
  id: SOURCE_ID,
  label: "ModelScope",
  baseUrl: BASE_URL,
  homeUrl: `${BASE_URL}/skills`,
  capabilities: { search: true, browse: true, detail: true, download: true },

  async search({ q, limit = 24, cursor, timeoutMs, signal }) {
    const page = Math.max(1, Number.parseInt(cursor ?? "1", 10) || 1);
    const size = Math.min(Math.max(1, limit), 50);
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

  async detail({ id, timeoutMs, signal }) {
    const { path, name } = splitId(id);
    let body;
    try {
      body = await fetchJson(`${BASE_URL}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name)}`, { timeoutMs, signal });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        throw Object.assign(new Error(`ModelScope skill ${id} was not found`), { code: 404 });
      }
      throw error;
    }
    const data = body.Data ?? body.data ?? {};
    const skill = normalize({ ...data, id, name });
    let files;
    try {
      const tree = await fetchJson(`${BASE_URL}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name)}/repo/files${query({ Revision: "master" })}`, { timeoutMs, signal });
      const list = tree.Data?.Files ?? tree.data?.Files ?? [];
      files = list.map((entry) => ({ path: entry.Path ?? entry.path, size: entry.Size ?? entry.size, type: entry.Type ?? entry.type }));
    } catch { /* file tree is optional for the preview */ }
    const readme = data.ReadMeContent ?? data.readMeContent ?? "";
    return {
      skill,
      skillMd: readme.startsWith("---") ? readme : undefined,
      readme: readme.startsWith("---") ? undefined : readme,
      files,
      meta: {
        developer: data.Developer ?? data.developer,
        sourceUrl: data.SourceURL ?? data.source_url,
        syncStatus: data.SyncStatus ?? data.sync_status,
        category: data.Category ?? data.category,
      },
    };
  },

  async download({ id, version, timeoutMs, signal }) {
    const { path, name } = splitId(id);
    const revision = version ?? "master";
    const url = `${BASE_URL}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name)}/archive/zip/${encodeURIComponent(revision)}`;
    try {
      const bytes = await fetchBytes(url, { timeoutMs, signal });
      return { bytes, filename: `${name}-${revision}.zip` };
    } catch (error) {
      if (error instanceof HttpError && error.status === 404 && version === undefined) {
        const bytes = await fetchBytes(`${BASE_URL}/api/v1/skills/${encodePathId(path)}/${encodeURIComponent(name)}/archive/zip/main`, { timeoutMs, signal });
        return { bytes, filename: `${name}-main.zip` };
      }
      throw error;
    }
  },
};
