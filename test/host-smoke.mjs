/**
 * Host route smoke test: serve the /api/dsh-skill-hub routes from a real
 * node:http server with a mock ctx and hit them over the wire.
 *
 * Run: node test/host-smoke.mjs
 */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { makeRoutes } from "../lib/routes.js";

const calls = [];
const ctx = {
  webServer: { register: (route) => () => calls.push(route.path) },
  sessions: { list: () => [{ header: { cwd: process.cwd() } }] },
  tools: { register: () => () => {} },
  logger: Object.assign(() => ({ warn: () => {} }), { warn: () => {}, info: () => {} }),
};

const config = () => ({
  enabled: true,
  installRoot: "user",
  defaultSource: "clawhub",
  disabledSources: [],
  customSkillDirs: [],
  requestTimeoutMs: 20000,
  enableTools: true,
});

const routes = makeRoutes(ctx, {
  config,
  logger: { warn: (error) => console.error("route error:", error) },
  sessionCwds: () => [process.cwd()],
});

const table = new Map(routes.map((route) => [route.path, route]));
assert.ok(table.size >= 12, `expected the route family, got ${table.size}`);

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url ?? "/", "http://x").pathname;
    const route = table.get(pathname);
    if (route === undefined) {
      res.writeHead(404);
      res.end();
      return;
    }
    await route.handler(req, res);
  } catch (error) {
    console.error("UNCAUGHT", error);
    if (!res.headersSent) {
      res.writeHead(400);
      res.end();
    }
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;

async function call(path, options = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : {},
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  return { status: response.status, text, json: safeJson(text) };
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// health
let response = await call("/api/dsh-skill-hub/health");
assert.equal(response.status, 200, `health: ${response.status} ${response.text}`);
assert.equal(response.json.ok, true);

// sources
response = await call("/api/dsh-skill-hub/sources");
assert.equal(response.status, 200, `sources: ${response.status} ${response.text}`);
assert.deepEqual(response.json.sources.map((source) => source.id), ["clawhub", "modelscope", "qwenpaw"]);

// local list
response = await call("/api/dsh-skill-hub/local/list");
assert.equal(response.status, 200, `list: ${response.status} ${response.text}`);
assert.ok(response.json.skills.length > 0, "expected local skills");
const skill = response.json.skills.find((entry) => entry.name === "weather") ?? response.json.skills[0];

// local read
response = await call(`/api/dsh-skill-hub/local/read?name=${encodeURIComponent(skill.name)}&path=${encodeURIComponent(skill.path)}`);
assert.equal(response.status, 200, `read: ${response.status} ${response.text}`);
assert.equal(response.json.name, skill.name);

// market search (live)
response = await call("/api/dsh-skill-hub/market/search?source=clawhub&q=weather&limit=3");
assert.equal(response.status, 200, `search: ${response.status} ${response.text}`);
assert.ok(response.json.items.length > 0, "expected marketplace results");

// bad input
response = await call("/api/dsh-skill-hub/market/search?source=nope");
assert.equal(response.status, 400);

server.close();
console.log("host smoke ok");
console.log(`  routes: ${table.size}`);
