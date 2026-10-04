/**
 * dsh-skill-hub — host half.
 *
 * Mounts the `/api/dsh-skill-hub/*` route family (local skill management plus
 * the ClawHub / ModelScope / QwenPaw marketplaces) and the `skill_hub` model
 * tool. The browser half (./client) renders the Skill Hub panel.
 */

import { Config, liveConfig } from "./config.js";
import { makeRoutes } from "./routes.js";
import { registerTools } from "./tools.js";

/** Stable cordis plugin name (the profile patch's row id). */
export const name = "skill-hub";

/** Services required before the routes and tools can mount. */
export const inject = ["webServer", "sessions", "tools"];

export { Config };

/**
 * Mount routes + tools.
 * @param {object} ctx host plugin context carrying webServer/sessions/tools
 * @param {object} config entry config (volatile fields are live references)
 */
export function apply(ctx, config) {
  const conf = () => liveConfig(config);
  if (conf().enabled === false) return;

  const logger = ctx.logger?.("skill-hub") ?? console;

  /** Active session workspace cwds (degraded to [] when sessions are unavailable). */
  const sessionCwds = () => {
    try {
      return (ctx.sessions?.list?.() ?? [])
        .map((session) => session.header?.cwd)
        .filter((cwd) => typeof cwd === "string" && cwd !== "");
    } catch {
      return [];
    }
  };

  ctx.effect(() => {
    const disposers = makeRoutes(ctx, { config: conf, logger, sessionCwds })
      .map((route) => ctx.webServer.register(route));
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, "skill-hub: routes");

  if (conf().enableTools !== false) {
    ctx.effect(() => registerTools(ctx, conf), "skill-hub: tools");
  }

  logger.info?.("skill-hub ready: local skills + ClawHub / ModelScope / QwenPaw");
}
