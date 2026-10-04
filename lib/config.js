/**
 * Plugin Config (schemastery).
 *
 * Every field is marked `.volatile()`: on dsh >= 0.1.7 the settings form is
 * projected from those marks and reads go through live references, so a value
 * saved in the form reaches the next request without a restart. `liveConfig`
 * unwraps the volatile references for the rest of the plugin.
 */

import Schema from "@deepseek-ai/schemastery";

/** Marketplace ids, in UI order. */
export const SOURCE_CHOICES = ["clawhub", "modelscope", "qwenpaw"];

const configFields = () => ({
  enabled: Schema.boolean()
    .default(true)
    .description("Enable the Skill Hub routes and tools. 关闭后插件完全不挂载。"),
  installRoot: Schema.union(["user", "project"])
    .default("user")
    .description("Default install target: `user` (~/.dsh/skills, global) or `project` (workspace .dsh/skills). 默认安装位置。"),
  defaultSource: Schema.union(SOURCE_CHOICES)
    .default("clawhub")
    .description("Marketplace selected by default in the panel and by the tools. 默认技能市场。"),
  disabledSources: Schema.array(Schema.union(SOURCE_CHOICES))
    .default([])
    .description("Marketplaces to hide. 隐藏的技能市场。"),
  customSkillDirs: Schema.array(Schema.string())
    .default([])
    .description("Extra skill roots to list/manage alongside the standard ones. 额外的本地技能目录。"),
  dshHome: Schema.string()
    .description("Override the dsh home directory (default: $DSH_HOME or ~/.dsh)."),
  agentsHome: Schema.string()
    .description("Override the shared ~/.agents directory (default: $DSH_AGENTS_HOME or ~/.agents)."),
  requestTimeoutMs: Schema.number()
    .default(20000)
    .min(3000)
    .max(120000)
    .description("HTTP timeout for marketplace calls in milliseconds. 市场请求超时。"),
  enableTools: Schema.boolean()
    .default(true)
    .description("Expose the `skill_hub` tool to the model. 是否给模型暴露 skill_hub 工具。"),
});

/** The entry's own Config (volatile fields = live-editable settings form). */
export const Config = Schema.object((() => {
  const marked = {};
  for (const [key, schema] of Object.entries(configFields())) marked[key] = schema.volatile();
  return marked;
})());

/** Read one field whatever shape the host handed us (volatile reference or plain). */
function readLive(value) {
  return value !== null && typeof value === "object" && typeof value.get === "function" ? value.get() : value;
}

/**
 * Flatten the entry config to plain values, read fresh at each call so settings
 * edits apply without a restart.
 * @param {object} raw the config object `apply` received
 * @returns {Record<string, any>} plain configuration
 */
export function liveConfig(raw) {
  const out = {};
  for (const [key, value] of Object.entries(raw ?? {})) out[key] = readLive(value);
  return out;
}
