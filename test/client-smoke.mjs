/**
 * Client smoke test: execute the built browser bundle exactly the way the
 * harness client-module loader does, register the panel against a fake slot
 * registry, then server-render the page body to catch render-time errors.
 *
 * Run: node test/client-smoke.mjs  (after scripts/build.mjs)
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = readFileSync(join(root, "lib", "client.js"), "utf8");
const require_ = createRequire(join(root, "package.json"));

// --- minimal DOM for style injection -----------------------------------------
const styleNodes = new Map();
globalThis.document = {
  getElementById: (id) => styleNodes.get(id) ?? null,
  createElement: () => ({ id: "", textContent: "" }),
  head: { appendChild: (node) => styleNodes.set(node.id, node) },
  body: { appendChild() {} },
};
globalThis.window = globalThis;

// --- the loader shim ---------------------------------------------------------
let loaded = null;
globalThis.__ModuleLoader__ = {
  load(entry) {
    loaded = entry;
  },
};
const moduleRequire = (id) => {
  if (id === "react") return require_("react");
  if (id === "react/jsx-runtime") return require_("react/jsx-runtime");
  throw new Error(`unexpected client require: ${id}`);
};

const run = new Function("window", "document", "navigator", "self", `${source};`);
run(globalThis, globalThis.document, globalThis.navigator, globalThis);
assert.ok(loaded, "the bundle did not register with __ModuleLoader__");
assert.equal(loaded.id, "dsh-skill-hub");
assert.equal(typeof loaded.factory, "function");

const clientModule = loaded.factory(moduleRequire);
assert.equal(typeof clientModule.apply, "function");
assert.deepEqual(clientModule.inject, ["slots"]);

// --- fake slot registry ------------------------------------------------------
const registrations = [];
const fakeCtx = {
  slots: {
    inject(name, cb) {
      const dispose = cb();
      return typeof dispose === "function" ? dispose : () => {};
    },
    register(definition, component) {
      registrations.push({ definition, component });
      return () => {
        const index = registrations.findIndex((entry) => entry.component === component);
        if (index >= 0) registrations.splice(index, 1);
      };
    },
  },
  reflect: { get: () => undefined },
  effect(fn) {
    const dispose = fn();
    return typeof dispose === "function" ? dispose : () => {};
  },
};

clientModule.apply(fakeCtx);
assert.equal(registrations.length, 2, "expected the panel entry and page registrations");
const entry = registrations.find((item) => item.definition.name === "sidebar.panellist");
const page = registrations.find((item) => item.definition.name === "main");
assert.ok(entry && page, "missing sidebar.panellist / main registrations");
assert.equal(page.definition.key, entry.definition.id);
assert.equal(typeof entry.definition.label(), "string");

// --- render the page body ----------------------------------------------------
const React = require_("react");
const { renderToString } = require_("react-dom/server");
const html = renderToString(React.createElement(page.component, page.definition.inject()));
assert.ok(html.includes("dsh-skill-hub"), `unexpected markup: ${html.slice(0, 200)}`);
assert.ok(styleNodes.size === 1, "stylesheet was not injected");

console.log("client smoke ok");
console.log(`  entry id      : ${entry.definition.id}`);
console.log(`  registrations : ${registrations.map((item) => item.definition.name).join(", ")}`);
console.log(`  rendered      : ${html.length} bytes`);
