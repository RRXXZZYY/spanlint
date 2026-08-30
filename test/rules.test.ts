import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseInputText } from "../src/otlp.js";
import { analyze } from "../src/rules.js";

async function analyzeExample(name: string, privacyMode: "notice" | "strict" = "notice") {
  const text = await readFile(`examples/${name}`, "utf8");
  const parsed = parseInputText(text, name);
  return analyze(parsed.spans, parsed.sourceFiles, { privacyMode });
}

test("valid example passes strict conformance without findings", async () => {
  const result = await analyzeExample("valid-agent.otlp.json");
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.summary, { score: 100, grade: "A", errors: 0, warnings: 0, infos: 0 });
  assert.equal(result.traces.length, 1);
  assert.equal(result.traces[0]?.spanCount, 4);
});

test("broken example exposes conformance, structure, privacy, and migration failures", async () => {
  const result = await analyzeExample("broken-agent.otlp.json");
  const ids = new Set(result.findings.map((finding) => finding.ruleId));
  for (const expected of [
    "GEN003",
    "GEN004",
    "GEN005",
    "GEN006",
    "GEN007",
    "GEN008",
    "GEN009",
    "MCP002",
    "MCP003",
    "MCP004",
    "STR001",
    "STR004",
    "ERR001",
    "PRIV001",
    "CARD001",
  ]) {
    assert.ok(ids.has(expected), `expected ${expected}`);
  }
  assert.ok(result.summary.score < 60);
  assert.ok(result.summary.errors > 0);
});

test("strict privacy promotes opt-in content findings to warnings", async () => {
  const result = await analyzeExample("broken-agent.otlp.json", "strict");
  const privacy = result.findings.filter((finding) => finding.ruleId === "PRIV001");
  assert.ok(privacy.length >= 2);
  assert.ok(privacy.every((finding) => finding.severity === "warning"));
});

test("token breakdown cannot exceed total", () => {
  const parsed = parseInputText(JSON.stringify({
    traceId: "trace",
    spanId: "span",
    name: "chat model",
    kind: 3,
    attributes: {
      "gen_ai.operation.name": "chat",
      "gen_ai.request.model": "model",
      "gen_ai.usage.input_tokens": 10,
      "gen_ai.usage.output_tokens": 5,
      "gen_ai.usage.cache_read.input_tokens": 11,
    },
  }));
  const result = analyze(parsed.spans);
  assert.ok(result.findings.some((finding) => finding.ruleId === "GEN008" && /exceeds/.test(finding.message)));
});
