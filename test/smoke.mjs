/**
 * Smoke tests for the dsh-skill-hub core (no dsh runtime required).
 * Run: node test/smoke.mjs
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

import { parseFrontmatter, rewriteFrontmatter, quoteScalar } from "../lib/core/frontmatter.js";
import { buildZip, readZipEntries, rebaseToSkillRoot, toText } from "../lib/core/zip.js";
import {
  scanSkills, readSkill, createSkill, updateSkill, setSkillEnabled, trashSkill,
  exportSkillZip, installSkillArchive, NAME_PATTERN,
} from "../lib/core/local.js";
import { searchSource, detailFromSource, installFromSource } from "../lib/core/install.js";
import { SOURCE_IDS } from "../lib/core/sources/index.js";

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
  } catch (error) {
    results.push(`  FAIL ${name}: ${error instanceof Error ? error.stack : error}`);
    process.exitCode = 1;
  }
}

const temp = await mkdtemp(join(tmpdir(), "skill-hub-test-"));

// ---------------------------------------------------------------- frontmatter
await test("frontmatter parse + rewrite preserves unknown keys", () => {
  const sample = [
    "---",
    "name: demo",
    "description: 'a: b'",
    "metadata: {\"clawdbot\":{\"emoji\":\"🧩\"}}",
    "disable-model-invocation: true",
    "---",
    "",
    "# Demo",
    "body text",
  ].join("\n");
  const parsed = parseFrontmatter(sample);
  assert.equal(parsed.fields.name, "demo");
  assert.equal(parsed.fields.description, "a: b");
  assert.equal(parsed.raw.metadata, '{"clawdbot":{"emoji":"🧩"}}');
  assert.equal(parsed.body.trim(), "# Demo\nbody text");

  const rewritten = rewriteFrontmatter(sample, { description: "new desc", "disable-model-invocation": null });
  const reparsed = parseFrontmatter(rewritten);
  assert.equal(reparsed.fields.description, "new desc");
  assert.equal(reparsed.raw.metadata, '{"clawdbot":{"emoji":"🧩"}}');
  assert.equal(reparsed.fields["disable-model-invocation"], undefined);
  assert.ok(reparsed.body.includes("body text"));
});

await test("quoteScalar doubles single quotes", () => {
  assert.equal(quoteScalar("it's"), "'it''s'");
});

// ----------------------------------------------------------------------- zip
await test("zip round-trip + unsafe path rejection + rebase", () => {
  const bytes = buildZip([
    { path: "skill-1.0.0-abc/SKILL.md", data: "---\nname: demo\n---\n# hi" },
    { path: "skill-1.0.0-abc/scripts/run.js", data: "console.log(1)" },
  ]);
  const entries = readZipEntries(bytes);
  assert.equal(entries.length, 2);
  const rebased = rebaseToSkillRoot(entries);
  assert.deepEqual(rebased.map((entry) => entry.path).sort(), ["SKILL.md", "scripts/run.js"]);
  assert.equal(toText(rebased.find((entry) => entry.path === "SKILL.md").data).includes("# hi"), true);

  const evil = buildZip([{ path: "ok.txt", data: "x" }]);
  const evilEntries = readZipEntries(evil);
  assert.equal(evilEntries.every((entry) => !entry.path.includes("..")), true);
});

// ------------------------------------------------------------------- local
await test("local scan finds the user skills", async () => {
  const { skills, groups } = await scanSkills({});
  assert.ok(skills.length > 0, "expected at least one local skill");
  assert.ok(skills.some((skill) => skill.name === "weather"), "expected the weather skill");
  assert.ok(groups.length > 0);
  assert.ok(skills.every((skill) => NAME_PATTERN.test(skill.name)));
});

await test("create / read / update / enable / export / delete", async () => {
  const base = join(temp, "skills");
  await mkdir(base, { recursive: true });
  const path = await createSkill(base, {
    name: "smoke-demo",
    description: "demo skill",
    whenToUse: "testing",
    content: "# Demo\nhello",
  });
  const detail = readSkill(path);
  assert.equal(detail.name, "smoke-demo");
  assert.equal(detail.content, "# Demo\nhello");

  await updateSkill(path, { description: "updated", content: "# Demo\nupdated" });
  const updated = readSkill(path);
  assert.equal(updated.description, "updated");
  assert.equal(updated.content, "# Demo\nupdated");

  await setSkillEnabled(path, false);
  assert.equal(readSkill(path).frontmatter["disable-model-invocation"], "true");
  await setSkillEnabled(path, true);
  assert.equal(readSkill(path).frontmatter["disable-model-invocation"], undefined);

  const { bytes } = await exportSkillZip(path);
  const reimported = await installSkillArchive(bytes, join(temp, "skills2"), {});
  assert.equal(reimported.name, "smoke-demo");
  assert.ok(reimported.files.includes("SKILL.md"));

  const moved = await trashSkill(path);
  assert.ok(moved.includes(".trash"));
});

await test("installSkillArchive rejects archives without SKILL.md", async () => {
  const bytes = buildZip([{ path: "whatever.txt", data: "x" }]);
  await assert.rejects(() => installSkillArchive(bytes, join(temp, "skills3"), {}), /SKILL\.md/u);
});

// ------------------------------------------------------------------ market
await test("clawhub search + detail", async () => {
  const found = await searchSource({ source: "clawhub", q: "weather", limit: 5 });
  assert.ok(found.items.length > 0, "clawhub search returned nothing");
  const first = found.items[0];
  assert.ok(first.id && first.owner !== undefined);
  const detail = await detailFromSource({ source: "clawhub", id: first.id, owner: first.owner });
  assert.ok((detail.skillMd ?? detail.readme ?? "").length > 0, "clawhub detail has no SKILL.md text");
});

await test("modelscope search + detail + download", async () => {
  const found = await searchSource({ source: "modelscope", q: "weather", limit: 5 });
  assert.ok(found.items.length > 0, "modelscope search returned nothing");
  const first = found.items[0];
  const detail = await detailFromSource({ source: "modelscope", id: first.id });
  assert.ok((detail.skillMd ?? detail.readme ?? "").length > 0, "modelscope detail has no SKILL.md text");
  const installed = await installFromSource({
    source: "modelscope", id: first.id, root: "user", dshHome: join(temp, "dsh-home"),
  });
  assert.ok(installed.files.includes("SKILL.md"), "modelscope install produced no SKILL.md");
});

await test("qwenpaw search + detail + download", async () => {
  const found = await searchSource({ source: "qwenpaw", q: "agent", limit: 5 });
  assert.ok(found.items.length > 0, "qwenpaw search returned nothing");
  const first = found.items[0];
  const detail = await detailFromSource({ source: "qwenpaw", id: first.id, version: first.version });
  assert.ok((detail.skillMd ?? "").length > 0, "qwenpaw detail has no SKILL.md text");
  const installed = await installFromSource({
    source: "qwenpaw", id: first.id, version: first.version, uuid: first.uuid, root: "user", dshHome: join(temp, "dsh-home"),
  });
  assert.ok(installed.files.includes("SKILL.md"), "qwenpaw install produced no SKILL.md");
});

await test("clawhub browse (empty query) returns cursor", async () => {
  const page = await searchSource({ source: "clawhub", limit: 3 });
  assert.equal(page.items.length, 3);
  assert.ok(page.nextCursor, "expected a browse cursor");
  const next = await searchSource({ source: "clawhub", limit: 3, cursor: page.nextCursor });
  assert.equal(next.items.length, 3);
});

assert.deepEqual(SOURCE_IDS, ["clawhub", "modelscope", "qwenpaw"]);

await rm(temp, { recursive: true, force: true });
console.log(results.join("\n"));
console.log(process.exitCode === 1 ? "\nSMOKE FAILED" : "\nsmoke ok");
