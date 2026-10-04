/**
 * dsh-skill-hub — browser half.
 *
 * Registers the Skill Hub panel: a sidebar entry (`sidebar.panellist`) and its
 * central page (`main`). Both seats are declared by shell plugins this package
 * does not depend on at runtime, so each registration is wrapped in
 * `ctx.slots.inject` — a shell that never declares the seat leaves the panel
 * absent instead of failing boot.
 */

import React from "react";
import { SkillHubApp, PanelIcon } from "./app.jsx";
import { injectStyles } from "./styles.js";

/** Sidebar entry id; the `main` slot is keyed by the same string. */
const PANEL_ID = "skill-hub";
const PANEL_ORDER = 20;

/** Services the loader waits for before running `apply`. */
export const inject = ["slots"];

/** The page body the `main` slot renders. */
function SkillHubPanel(props) {
  return React.createElement(SkillHubApp, { locale: props?.locale, onBack: props?.onBack });
}

/**
 * Mount the Skill Hub panel.
 * @param {object} ctx client root context (services: slots)
 */
export function apply(ctx) {
  injectStyles();
  const slots = ctx.slots;
  const locale = ctx.reflect?.get?.("locale");
  /** Return the center column to the conversation (`layout.selectPanel(null)`). */
  const onBack = () => {
    try {
      ctx.get?.("layout", false)?.selectPanel?.(null);
    } catch (error) {
      console.warn("[skill-hub] back to conversation failed:", error);
    }
  };
  const disposers = [];

  try {
    disposers.push(slots.inject("sidebar.panellist", () => slots.register({
      name: "sidebar.panellist",
      id: PANEL_ID,
      order: PANEL_ORDER,
      label: () => "Skills",
    }, PanelIcon)));
  } catch (error) {
    console.warn("[skill-hub] sidebar entry registration failed:", error);
  }

  try {
    disposers.push(slots.inject("main", () => slots.register({
      name: "main",
      key: PANEL_ID,
      inject: () => ({ locale, onBack }),
    }, SkillHubPanel)));
  } catch (error) {
    console.warn("[skill-hub] page registration failed:", error);
  }

  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose();
  }, "skill-hub: ui mounts");
}
