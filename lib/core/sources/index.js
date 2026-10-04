/**
 * Marketplace source registry.
 *
 * Every adapter normalizes its host's catalog into one `RemoteSkill` shape and
 * exposes the same three operations, so the routes and the model tools never
 * branch on the host.
 *
 * @typedef {Object} RemoteSkill
 * @property {string} source adapter id (`clawhub` | `modelscope` | `qwenpaw`)
 * @property {string} id host identity (slug, `path/name`, `@owner/name`)
 * @property {string} [owner] owner handle, kept because ClawHub slugs collide
 * @property {string} name
 * @property {string} displayName
 * @property {string} summary
 * @property {string} [version]
 * @property {number} [downloads]
 * @property {number} [installs]
 * @property {number} [stars]
 * @property {string} [license]
 * @property {string} [category]
 * @property {string[]} [topics]
 * @property {string} [url]
 * @property {boolean} [installable]
 *
 * @typedef {Object} SourceAdapter
 * @property {string} id
 * @property {string} label
 * @property {string} baseUrl
 * @property {string} homeUrl
 * @property {{search:boolean, browse:boolean, detail:boolean, download:boolean}} capabilities
 * @property {(req: {q?: string, limit?: number, cursor?: string, timeoutMs?: number, signal?: AbortSignal}) => Promise<{items: RemoteSkill[], nextCursor?: string}>} search
 * @property {(req: {id: string, owner?: string, version?: string, timeoutMs?: number, signal?: AbortSignal}) => Promise<{skill: RemoteSkill, skillMd?: string, readme?: string, files?: object[], versions?: object[], meta?: object}>} detail
 * @property {(req: {id: string, owner?: string, version?: string, uuid?: string, timeoutMs?: number, signal?: AbortSignal}) => Promise<{bytes: Uint8Array, filename: string}>} download
 */

import { clawhub } from "./clawhub.js";
import { modelscope } from "./modelscope.js";
import { qwenpaw } from "./qwenpaw.js";

/** All bundled sources, in the order the UI shows them. */
export const SOURCES = [clawhub, modelscope, qwenpaw];

/** Source ids accepted by the routes and tools. */
export const SOURCE_IDS = SOURCES.map((source) => source.id);

/** Resolve one adapter by id. */
export function getSource(id) {
  return SOURCES.find((source) => source.id === String(id ?? "").toLowerCase());
}

/** Public descriptor list for the UI (`/sources`). */
export function describeSources() {
  return SOURCES.map((source) => ({
    id: source.id,
    label: source.label,
    baseUrl: source.baseUrl,
    homeUrl: source.homeUrl,
    capabilities: source.capabilities,
  }));
}
