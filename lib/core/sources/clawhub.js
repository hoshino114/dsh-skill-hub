/**
 * ClawHub adapter — "a fast skill registry for agents, with vector search".
 * Canonical host https://clawhub.ai (clawhub.com 307-redirects there).
 *
 * Endpoints (all reads anonymous):
 *   search   GET /api/v1/search?q=&limit=            → { results[] }
 *   browse   GET /api/v1/skills?limit=&sort=&cursor=  → { items[], nextCursor }
 *   detail   GET /api/v1/skills/:slug?ownerHandle=    → { skill:{ description = full SKILL.md }, latestVersion, owner }
 *   install  GET /api/v1/skills/:slug/install?ownerHandle= → { archive:{ downloadUrl } }
 *   download GET /api/v1/download?slug=&ownerHandle=&version= → application/zip
 *
 * Slugs collide across owners: detail/download answer 409 "Ambiguous skill
 * slug" unless `ownerHandle` is passed, so every list/search result carries its
 * owner and the UI keeps it.
 */

import { fetchJson, fetchBytes, query, HttpError } from "../http.js";

export const SOURCE_ID = "clawhub";
export const BASE_URL = "https://clawhub.ai";
export const SOURCE_URL = "https://clawhub.com";

function normalizeSearchResult(item) {
  const stats = item.native?.skill?.stats ?? {};
  return {
    source: SOURCE_ID,
    id: item.slug ?? item.id,
    owner: item.ownerHandle ?? item.owner?.handle ?? item.install?.reference?.split("/")[0],
    ownerName: item.owner?.displayName ?? item.publisher?.displayName,
    avatar: item.owner?.image ?? item.publisher?.image,
    name: item.slug ?? item.id,
    displayName: item.displayName ?? item.slug,
    summary: item.summary ?? "",
    version: item.version ?? item.native?.skill?.tags?.latest,
    downloads: stats.downloads ?? item.downloads ?? 0,
    installs: stats.installs ?? item.metrics?.rolling60DayInstalls ?? 0,
    stars: stats.stars ?? 0,
    license: item.latestVersion?.license,
    topics: item.native?.skill?.topics ?? item.topics ?? [],
    categories: item.native?.skill?.categories ?? [],
    category: item.native?.skill?.categories?.[0],
    url: item.canonicalUrl ? `${BASE_URL}${item.canonicalUrl}` : `${SOURCE_URL}/${item.slug}`,
    updatedAt: item.updatedAt,
    installable: (item.install?.kind ?? "clawhub") === "clawhub" || item.source === "clawhub",
  };
}

function normalizeBrowseItem(item) {
  return {
    source: SOURCE_ID,
    id: item.slug,
    owner: item.ownerHandle,
    ownerName: item.owner?.displayName ?? item.ownerHandle,
    avatar: item.owner?.image,
    name: item.slug,
    displayName: item.displayName ?? item.slug,
    summary: item.summary ?? "",
    version: item.tags?.latest ?? item.latestVersion?.version,
    downloads: item.stats?.downloads ?? 0,
    installs: item.stats?.installs ?? 0,
    stars: item.stats?.stars ?? 0,
    license: item.latestVersion?.license ?? null,
    topics: item.topics ?? [],
    categories: item.categories ?? [],
    category: item.categories?.[0],
    url: `${SOURCE_URL}/${item.ownerHandle}/${item.slug}`,
    updatedAt: item.updatedAt,
    installable: true,
  };
}

/** @type {import("./index.js").SourceAdapter} */
export const clawhub = {
  id: SOURCE_ID,
  label: "ClawHub",
  baseUrl: BASE_URL,
  homeUrl: SOURCE_URL,
  capabilities: { search: true, browse: true, detail: true, download: true },

  async search({ q, limit = 24, cursor, timeoutMs, signal }) {
    const trimmed = String(q ?? "").trim();
    if (trimmed === "") {
      const body = await fetchJson(`${BASE_URL}/api/v1/skills${query({ limit: Math.min(limit, 200), sort: "downloads", cursor })}`, { timeoutMs, signal });
      return {
        source: SOURCE_ID,
        items: (body.items ?? []).map(normalizeBrowseItem),
        nextCursor: body.nextCursor ?? undefined,
      };
    }
    const body = await fetchJson(`${BASE_URL}/api/v1/search${query({ q: trimmed, limit: Math.min(limit, 100) })}`, { timeoutMs, signal });
    return {
      source: SOURCE_ID,
      items: (body.results ?? []).map(normalizeSearchResult),
      nextCursor: undefined,
    };
  },

  async detail({ id, owner, timeoutMs, signal }) {
    let body;
    try {
      body = await fetchJson(`${BASE_URL}/api/v1/skills/${encodeURIComponent(id)}${query({ ownerHandle: owner })}`, { timeoutMs, signal });
    } catch (error) {
      if (error instanceof HttpError && error.status === 409) {
        throw Object.assign(new Error(`${id} is ambiguous on ClawHub; pass the owner handle (e.g. owner=${owner ?? "?"})`), { code: 409 });
      }
      throw error;
    }
    const skill = body.skill ?? {};
    const ownerInfo = body.owner ?? {};
    return {
      skill: normalizeBrowseItem({ ...skill, ownerHandle: ownerInfo.handle ?? owner, latestVersion: body.latestVersion }),
      skillMd: typeof skill.description === "string" && skill.description.startsWith("---") ? skill.description : undefined,
      readme: typeof skill.description === "string" && !skill.description.startsWith("---") ? skill.description : undefined,
      versions: body.latestVersion ? [{ version: body.latestVersion.version, createdAt: body.latestVersion.createdAt, changelog: body.latestVersion.changelog }] : [],
      meta: {
        license: body.latestVersion?.license,
        moderation: body.moderation?.verdict,
        changelog: body.latestVersion?.changelog,
        ownerName: ownerInfo.displayName,
        ownerImage: ownerInfo.image,
      },
    };
  },

  async download({ id, owner, version, timeoutMs, signal }) {
    if (version) {
      const bytes = await fetchBytes(`${BASE_URL}/api/v1/download${query({ slug: id, ownerHandle: owner, version })}`, { timeoutMs });
      return { bytes, filename: `${id}-${version}.zip` };
    }
    const plan = await fetchJson(`${BASE_URL}/api/v1/skills/${encodeURIComponent(id)}/install${query({ ownerHandle: owner })}`, { timeoutMs, signal });
    const url = plan.archive?.downloadUrl;
    if (typeof url !== "string" || url === "") {
      throw new Error(`ClawHub returned no archive for ${id}`);
    }
    const bytes = await fetchBytes(url, { timeoutMs });
    return { bytes, filename: `${id}-${plan.archive?.version ?? "latest"}.zip` };
  },
};
