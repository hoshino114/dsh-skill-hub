/**
 * Install flow: marketplace archive → local skill directory.
 */

import { getSource } from "./sources/index.js";
import { installSkillArchive, userSkillRoot, projectSkillRoot, dshHomeDir } from "./local.js";

/**
 * Download one remote skill and install it into a skill root.
 * @param {object} request install request
 * @param {string} request.source adapter id
 * @param {string} request.id host identity
 * @param {string} [request.owner] owner handle (ClawHub)
 * @param {string} [request.version] pin a version / revision
 * @param {string} [request.uuid] plaza detail uuid (QwenPaw)
 * @param {string} [request.name] override the installed directory name
 * @param {"user"|"project"} [request.root] target root, defaults to `user`
 * @param {string} [request.cwd] workspace cwd used for the `project` root
 * @param {boolean} [request.overwrite] replace an existing skill
 * @param {number} [request.timeoutMs]
 * @param {AbortSignal} [request.signal]
 * @returns {Promise<{ ok: true, source: string, id: string, name: string, path: string, files: string[], filename: string, targetRoot: string }>}
 */
export async function installFromSource(request) {
  const adapter = getSource(request.source);
  if (adapter === undefined) {
    throw Object.assign(new Error(`unknown source ${JSON.stringify(request.source)}`), { code: 400 });
  }
  const { bytes, filename } = await adapter.download({
    id: request.id,
    owner: request.owner,
    version: request.version,
    uuid: request.uuid,
    timeoutMs: request.timeoutMs,
    signal: request.signal,
  });
  const targetRoot = request.root === "project"
    ? projectSkillRoot(request.cwd ?? process.cwd())
    : userSkillRoot(request.dshHome ?? dshHomeDir());
  const installed = await installSkillArchive(bytes, targetRoot, {
    name: request.name,
    overwrite: request.overwrite === true,
  });
  return {
    ok: true,
    source: adapter.id,
    id: request.id,
    name: installed.name,
    path: installed.path,
    files: installed.files,
    filename,
    targetRoot,
  };
}

/**
 * Read one remote skill's detail (SKILL.md + metadata).
 * @param {object} request detail request
 * @returns {Promise<object>} normalized detail payload
 */
export async function detailFromSource(request) {
  const adapter = getSource(request.source);
  if (adapter === undefined) {
    throw Object.assign(new Error(`unknown source ${JSON.stringify(request.source)}`), { code: 400 });
  }
  return adapter.detail({
    id: request.id,
    owner: request.owner,
    version: request.version,
    uuid: request.uuid,
    timeoutMs: request.timeoutMs,
    signal: request.signal,
  });
}

/**
 * Search / browse one marketplace.
 * @param {object} request search request
 * @returns {Promise<{ source: string, items: object[], nextCursor?: string }>}
 */
export async function searchSource(request) {
  const adapter = getSource(request.source);
  if (adapter === undefined) {
    throw Object.assign(new Error(`unknown source ${JSON.stringify(request.source)}`), { code: 400 });
  }
  return adapter.search({
    q: request.q,
    limit: request.limit,
    cursor: request.cursor,
    timeoutMs: request.timeoutMs,
    signal: request.signal,
  });
}
