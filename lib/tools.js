/**
 * Model-facing tools: one `skill_hub` tool covering local skill management and
 * the three marketplaces, so the agent can browse, install and maintain skills
 * without leaving the conversation.
 */

import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  scanSkills, readSkill, createSkill, updateSkill, setSkillEnabled, trashSkill,
  userSkillRoot, projectSkillRoot,
} from "./core/local.js";
import { searchSource, detailFromSource, installFromSource } from "./core/install.js";
import { SOURCE_IDS, describeSources } from "./core/sources/index.js";

const ACTIONS = [
  "local_list",
  "local_read",
  "local_create",
  "local_update",
  "local_set_enabled",
  "local_delete",
  "market_search",
  "market_detail",
  "market_install",
  "sources",
];

/** Cut long markdown so a tool result never floods the context. */
function clamp(text, max = 8000) {
  const value = String(text ?? "");
  return value.length <= max ? value : `${value.slice(0, max)}\n… (truncated, ${value.length} chars total)`;
}

/**
 * Register the skill tools.
 * @param {object} ctx host context (`ctx.tools` must be available)
 * @param {() => object} config live config reader
 * @returns {() => void} disposer
 */
export function registerTools(ctx, config) {
  const scanOptions = () => ({
    dshHome: config().dshHome ?? undefined,
    agentsHome: config().agentsHome ?? undefined,
    customSkillDirs: config().customSkillDirs ?? [],
    cwd: process.cwd(),
  });

  /** Resolve a skill by name from a fresh scan. */
  const resolve = async (name) => {
    const { skills } = await scanSkills(scanOptions());
    const skill = skills.find((candidate) => candidate.name === name);
    if (skill === undefined) throw new Error(`skill ${name} not found locally`);
    return skill;
  };

  return ctx.tools.register(defineTool({
    name: "skill_hub",
    description:
      "Manage local Agent Skills and browse/download skills from the ClawHub, ModelScope and QwenPaw marketplaces. "
      + "Actions: sources (list marketplaces), local_list (list installed skills), local_read, local_create, "
      + "local_update, local_set_enabled, local_delete, market_search (search one marketplace), market_detail "
      + "(read a marketplace skill's SKILL.md before installing), market_install (download a skill into ~/.dsh/skills). "
      + "Use market_detail before market_install when the user has not asked for a specific skill.",
    parameters: {
      action: {
        type: "string",
        enum: ACTIONS,
        required: true,
        description: "Which operation to perform.",
      },
      name: {
        type: "string",
        description: "Local skill name (local_read / local_update / local_set_enabled / local_delete / local_create).",
      },
      q: {
        type: "string",
        description: "Search query for local_list / market_search.",
      },
      source: {
        type: "string",
        enum: SOURCE_IDS,
        description: "Marketplace id for market_search / market_detail / market_install.",
      },
      id: {
        type: "string",
        description: "Marketplace skill id (ClawHub slug, ModelScope `path/name`, QwenPaw `@owner/name`).",
      },
      owner: {
        type: "string",
        description: "Owner handle; required by ClawHub when a slug is ambiguous.",
      },
      version: {
        type: "string",
        description: "Version / revision to install (defaults to the latest).",
      },
      description: {
        type: "string",
        description: "Skill description (local_create / local_update).",
      },
      whenToUse: {
        type: "string",
        description: "Optional whenToUse hint (local_create / local_update).",
      },
      content: {
        type: "string",
        description: "Markdown body of SKILL.md (local_create / local_update).",
      },
      enabled: {
        type: "boolean",
        description: "Enable or disable model invocation (local_set_enabled).",
      },
      root: {
        type: "string",
        enum: ["user", "project"],
        description: "Install target: `user` = ~/.dsh/skills (global), `project` = workspace .dsh/skills.",
      },
      limit: {
        type: "integer",
        description: "Result cap for market_search (default 15, max 50).",
      },
      overwrite: {
        type: "boolean",
        description: "Replace an existing skill of the same name when installing.",
      },
    },
    output: {
      schema: { type: "json" },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const limit = Math.min(Math.max(Number(args.limit ?? 15) || 15, 1), 50);
      switch (args.action) {
        case "sources":
          return { sources: describeSources() };

        case "local_list": {
          const { groups, roots } = await scanSkills(scanOptions());
          const q = String(args.q ?? "").trim().toLowerCase();
          return {
            groups: groups.map((group) => ({
              key: group.key,
              title: group.title,
              skills: group.skills
                .filter((skill) => q === "" || `${skill.name} ${skill.description}`.toLowerCase().includes(q))
                .map((skill) => ({
                  name: skill.name,
                  description: skill.description,
                  enabled: skill.enabled,
                  level: skill.level,
                  path: skill.path,
                })),
            })).filter((group) => group.skills.length > 0),
            roots: roots.filter((root) => root.exists),
          };
        }

        case "local_read": {
          const skill = await resolve(args.name);
          const detail = readSkill(skill.path);
          return {
            name: detail.name,
            description: detail.description,
            whenToUse: detail.whenToUse,
            path: detail.path,
            content: clamp(detail.content, 16000),
          };
        }

        case "local_create": {
          if (typeof args.name !== "string" || typeof args.description !== "string" || typeof args.content !== "string") {
            throw new Error("local_create needs name, description and content");
          }
          const base = args.root === "project"
            ? projectSkillRoot(exec?.agent?.session?.header?.cwd ?? process.cwd())
            : userSkillRoot(config().dshHome ?? undefined);
          const path = await createSkill(base, {
            name: args.name,
            description: args.description,
            whenToUse: args.whenToUse,
            content: args.content,
          });
          return { ok: true, name: args.name, path };
        }

        case "local_update": {
          const skill = await resolve(args.name);
          const path = await updateSkill(skill.path, {
            description: args.description,
            whenToUse: args.whenToUse,
            content: args.content,
          });
          return { ok: true, name: args.name, path };
        }

        case "local_set_enabled": {
          const skill = await resolve(args.name);
          await setSkillEnabled(skill.path, args.enabled !== false);
          return { ok: true, name: args.name, enabled: args.enabled !== false };
        }

        case "local_delete": {
          const skill = await resolve(args.name);
          return { ok: true, name: args.name, moved: await trashSkill(skill.path) };
        }

        case "market_search": {
          if (!SOURCE_IDS.includes(args.source)) throw new Error(`source must be one of ${SOURCE_IDS.join(", ")}`);
          const result = await searchSource({ source: args.source, q: args.q, limit });
          return {
            source: args.source,
            count: result.items.length,
            items: result.items.map((item) => ({
              id: item.id,
              owner: item.owner,
              displayName: item.displayName,
              summary: clamp(item.summary, 400),
              version: item.version,
              downloads: item.downloads,
              url: item.url,
            })),
            nextCursor: result.nextCursor,
          };
        }

        case "market_detail": {
          if (!SOURCE_IDS.includes(args.source)) throw new Error(`source must be one of ${SOURCE_IDS.join(", ")}`);
          if (typeof args.id !== "string") throw new Error("market_detail needs id");
          const detail = await detailFromSource({ source: args.source, id: args.id, owner: args.owner, version: args.version });
          return {
            skill: detail.skill,
            meta: detail.meta,
            files: (detail.files ?? []).slice(0, 40),
            skillMd: clamp(detail.skillMd ?? detail.readme ?? "", 12000),
          };
        }

        case "market_install": {
          if (!SOURCE_IDS.includes(args.source)) throw new Error(`source must be one of ${SOURCE_IDS.join(", ")}`);
          if (typeof args.id !== "string") throw new Error("market_install needs id");
          return installFromSource({
            source: args.source,
            id: args.id,
            owner: args.owner,
            version: args.version,
            name: args.name,
            root: args.root === "project" ? "project" : "user",
            cwd: exec?.agent?.session?.header?.cwd ?? process.cwd(),
            overwrite: args.overwrite === true,
            dshHome: config().dshHome ?? undefined,
            timeoutMs: 60000,
          });
        }

        default:
          throw new Error(`unknown action ${JSON.stringify(args.action)}`);
      }
    },
  }));
}
