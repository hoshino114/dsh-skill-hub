/**
 * The `/api/dsh-skill-hub/*` route family:
 *
 *   GET  health                          liveness + local skill count
 *   GET  sources                         configured marketplaces
 *   GET  local/list?q=                   grouped local skills + roots
 *   GET  local/read?name=&path=          one skill (frontmatter + body)
 *   POST local/create                    { root, name, description, whenToUse?, content }
 *   POST local/update                    { name, path, description, whenToUse?, content }
 *   POST local/set-enabled               { name, path, enabled }
 *   POST local/delete                    { name, path }
 *   GET  local/export?name=&path=        zip download of one skill
 *   POST local/import                    { zip(base64), root?, name?, overwrite? }
 *   GET  market/search?source=&q=&cursor=&limit=
 *   GET  market/detail?source=&id=&owner=&version=&uuid=
 *   POST market/install                  { source, id, owner?, version?, uuid?, name?, root?, overwrite? }
 *
 * Write routes only ever touch paths a fresh scan resolves, and every route is
 * behind the loopback trust fence (see web.js).
 */

import { join } from "node:path";
import {
  scanSkills, readSkill, createSkill, updateSkill, setSkillEnabled, trashSkill,
  exportSkillZip, installSkillArchive, userSkillRoot, projectSkillRoot,
  dshHomeDir, agentsHomeDir,
} from "./core/local.js";
import { searchSource, detailFromSource, installFromSource } from "./core/install.js";
import { describeSources, SOURCE_IDS } from "./core/sources/index.js";
import {
  writeJson, writeBytes, readJsonBody, queryParam, guard, errorStatus,
} from "./web.js";

/** Route paths (the client bundle mirrors these literals). */
export const ROUTES = {
  health: "/api/dsh-skill-hub/health",
  sources: "/api/dsh-skill-hub/sources",
  list: "/api/dsh-skill-hub/local/list",
  read: "/api/dsh-skill-hub/local/read",
  create: "/api/dsh-skill-hub/local/create",
  update: "/api/dsh-skill-hub/local/update",
  setEnabled: "/api/dsh-skill-hub/local/set-enabled",
  delete: "/api/dsh-skill-hub/local/delete",
  export: "/api/dsh-skill-hub/local/export",
  import: "/api/dsh-skill-hub/local/import",
  search: "/api/dsh-skill-hub/market/search",
  detail: "/api/dsh-skill-hub/market/detail",
  install: "/api/dsh-skill-hub/market/install",
};

/** Build stamp served by /health (identifies the loaded code without a restart). */
export const BUILD = "2026-10-04.3-merged-market";

/**
 * Build the route list for `ctx.webServer.register`.
 * @param {object} ctx host context (trust-fence lookup)
 * @param {object} deps shared services and configuration
 * @returns {object[]} web routes
 */
export function makeRoutes(ctx, deps) {
  const { config: readRawConfig, logger, sessionCwds } = deps;

  /** Config reads are fail-soft: a broken settings value must not 500 every route. */
  const config = () => {
    try {
      return readRawConfig() ?? {};
    } catch (error) {
      logger?.warn?.(error);
      return {};
    }
  };

  const roots = () => ({
    dshHome: config().dshHome ?? dshHomeDir(),
    agentsHome: config().agentsHome ?? agentsHomeDir(),
    customSkillDirs: config().customSkillDirs ?? [],
    cwd: sessionCwds()[0] ?? process.cwd(),
    projectRoots: sessionCwds().map((cwd) => cwd),
  });

  /** Collect options for a scan, honoring an explicit `cwd` query parameter. */
  const scanOptions = (cwd) => ({
    ...roots(),
    ...(cwd ? { cwd } : {}),
    projectRoots: sessionCwds(),
  });

  /** Resolve one skill by name through a fresh scan (never trusts a raw path). */
  const resolveSkill = async (name, expectedPath, cwd) => {
    const { skills } = await scanSkills(scanOptions(cwd));
    const skill = skills.find((candidate) => candidate.name === name);
    if (skill === undefined) {
      throw Object.assign(new Error(`skill ${name} not found`), { code: 404 });
    }
    if (skill.path !== expectedPath) {
      throw Object.assign(new Error(`skill ${name} changed since the panel loaded; refresh and retry`), { code: 409 });
    }
    return skill;
  };

  const handle = (method, handler) => async (req, res) => {
    try {
      if (!guard(ctx, req, res, method)) return;
      await handler(req, res);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      logger?.warn?.(error);
      try {
        const status = errorStatus(error);
        writeJson(res, status, { error: message, detail: stack });
      } catch { /* writeJson already degrades to a bare end() */ }
    }
  };

  return [
    {
      kind: "exact",
      path: ROUTES.health,
      handler: handle("GET", async (req, res) => {
        const { skills } = await scanSkills(scanOptions());
        writeJson(res, 200, { ok: true, plugin: "skill-hub", build: BUILD, skills: skills.length, sources: SOURCE_IDS });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.sources,
      handler: handle("GET", async (req, res) => {
        const conf = config();
        writeJson(res, 200, {
          sources: describeSources().map((source) => ({
            ...source,
            enabled: (conf.disabledSources ?? []).includes(source.id) === false,
          })),
          defaultSource: conf.defaultSource ?? SOURCE_IDS[0],
          installRoot: conf.installRoot ?? "user",
        });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.list,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const q = (queryParam(url, "q") ?? "").trim().toLowerCase();
        const payload = await scanSkills(scanOptions(queryParam(url, "cwd")));
        const groups = payload.groups
          .map((group) => ({
            ...group,
            skills: q === "" ? group.skills : group.skills.filter((skill) =>
              `${skill.name} ${skill.description}`.toLowerCase().includes(q)),
          }))
          .filter((group) => group.skills.length > 0);
        writeJson(res, 200, { ...payload, groups, total: payload.skills.length });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.read,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name = queryParam(url, "name");
        const path = queryParam(url, "path");
        if (name === undefined || path === undefined || path.trim() === "") {
          writeJson(res, 400, { error: "expected ?name=<skill>&path=<absolute SKILL.md>" });
          return;
        }
        const skill = await resolveSkill(name, path);
        writeJson(res, 200, readSkill(skill.path));
      }),
    },
    {
      kind: "exact",
      path: ROUTES.create,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 4 * 1024 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { root, name, description, whenToUse, content, cwd } = body;
        if (typeof description !== "string" || description.trim() === "") {
          writeJson(res, 400, { error: "description is required" });
          return;
        }
        if (typeof content !== "string" || content.trim() === "") {
          writeJson(res, 400, { error: "content is required" });
          return;
        }
        const base = root === "project"
          ? projectSkillRoot(cwd ?? roots().cwd)
          : userSkillRoot(roots().dshHome);
        writeJson(res, 200, {
          ok: true,
          name,
          path: await createSkill(base, { name, description, whenToUse, content }),
        });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.update,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 4 * 1024 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { name, path, description, whenToUse, content } = body;
        if (typeof name !== "string" || typeof path !== "string") {
          writeJson(res, 400, { error: "expected { name, path, description, content }" });
          return;
        }
        const skill = await resolveSkill(name, path);
        if (skill.linked === true) {
          writeJson(res, 400, { error: `skill ${name} is a symlink and cannot be edited here` });
          return;
        }
        writeJson(res, 200, {
          ok: true,
          name,
          path: await updateSkill(skill.path, { name, description, whenToUse, content }),
        });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.setEnabled,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { name, path, enabled } = body;
        if (typeof name !== "string" || typeof path !== "string" || typeof enabled !== "boolean") {
          writeJson(res, 400, { error: "expected { name, path, enabled }" });
          return;
        }
        const skill = await resolveSkill(name, path);
        await setSkillEnabled(skill.path, enabled);
        writeJson(res, 200, { ok: true, name, enabled, path: skill.path });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.delete,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { name, path } = body;
        if (typeof name !== "string" || typeof path !== "string") {
          writeJson(res, 400, { error: "expected { name, path }" });
          return;
        }
        const skill = await resolveSkill(name, path);
        if (skill.linked === true) {
          writeJson(res, 400, { error: `skill ${name} is a symlink and cannot be deleted here` });
          return;
        }
        writeJson(res, 200, { ok: true, name, moved: await trashSkill(skill.path) });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.export,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const name = queryParam(url, "name");
        const path = queryParam(url, "path");
        if (name === undefined || path === undefined) {
          writeJson(res, 400, { error: "expected ?name=<skill>&path=<absolute SKILL.md>" });
          return;
        }
        const skill = await resolveSkill(name, path);
        const { bytes } = await exportSkillZip(skill.path);
        writeBytes(res, 200, bytes, "application/zip", `${skill.name}.zip`);
      }),
    },
    {
      kind: "exact",
      path: ROUTES.import,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 24 * 1024 * 1024 });
        if (body === null || typeof body.zip !== "string") {
          writeJson(res, 400, { error: "expected { zip: <base64> }" });
          return;
        }
        const bytes = new Uint8Array(Buffer.from(body.zip, "base64"));
        const base = body.root === "project"
          ? projectSkillRoot(body.cwd ?? roots().cwd)
          : userSkillRoot(roots().dshHome);
        writeJson(res, 200, {
          ok: true,
          ...(await installSkillArchive(bytes, base, { name: body.name, overwrite: body.overwrite === true })),
        });
      }),
    },
    {
      kind: "exact",
      path: ROUTES.search,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const source = queryParam(url, "source");
        if (source === undefined || !SOURCE_IDS.includes(source)) {
          writeJson(res, 400, { error: `source must be one of ${SOURCE_IDS.join(", ")}` });
          return;
        }
        const limit = Number.parseInt(queryParam(url, "limit") ?? "24", 10);
        writeJson(res, 200, await searchSource({
          source,
          q: queryParam(url, "q"),
          cursor: queryParam(url, "cursor"),
          limit: Number.isFinite(limit) ? limit : 24,
          timeoutMs: config().requestTimeoutMs,
        }));
      }),
    },
    {
      kind: "exact",
      path: ROUTES.detail,
      handler: handle("GET", async (req, res) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const source = queryParam(url, "source");
        const id = queryParam(url, "id");
        if (source === undefined || id === undefined || !SOURCE_IDS.includes(source)) {
          writeJson(res, 400, { error: "expected ?source=<clawhub|modelscope|qwenpaw>&id=<skill>" });
          return;
        }
        writeJson(res, 200, await detailFromSource({
          source,
          id,
          owner: queryParam(url, "owner"),
          version: queryParam(url, "version"),
          uuid: queryParam(url, "uuid"),
          timeoutMs: config().requestTimeoutMs,
        }));
      }),
    },
    {
      kind: "exact",
      path: ROUTES.install,
      handler: handle("POST", async (req, res) => {
        const body = await readJsonBody(req, { maxBytes: 256 * 1024 });
        if (body === null) {
          writeJson(res, 400, { error: "invalid JSON body" });
          return;
        }
        const { source, id, owner, version, uuid, name, root, overwrite, cwd } = body;
        if (typeof source !== "string" || typeof id !== "string" || !SOURCE_IDS.includes(source)) {
          writeJson(res, 400, { error: "expected { source, id, owner?, version?, name?, root?, overwrite? }" });
          return;
        }
        writeJson(res, 200, await installFromSource({
          source,
          id,
          owner,
          version,
          uuid,
          name,
          root: root === "project" ? "project" : "user",
          cwd: cwd ?? roots().cwd,
          overwrite: overwrite === true,
          dshHome: roots().dshHome,
          timeoutMs: Math.max(config().requestTimeoutMs ?? 20000, 60000),
        }));
      }),
    },
  ];
}

/** Convenience for tools: the default install root directory. */
export function installRootDir(config, root, cwd) {
  return root === "project"
    ? projectSkillRoot(cwd ?? process.cwd())
    : join(userSkillRoot(config?.dshHome ?? dshHomeDir()));
}
