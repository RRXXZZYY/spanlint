import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseInputText } from "../src/otlp.js";
import { formatJunit, formatSarif } from "../src/report/formats.js";
import { renderHtml } from "../src/report/html.js";
import { analyze } from "../src/rules.js";

test("HTML report is self-contained and redacts opt-in content", async () => {
  const text = await readFile("examples/broken-agent.otlp.json", "utf8");
  const parsed = parseInputText(text, "broken-agent.otlp.json");
  const html = renderHtml(analyze(parsed.spans, parsed.sourceFiles));
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /window\.__SPANLINT_REPORT__/);
  assert.match(html, /\[redacted by SpanLint\]/);
  assert.doesNotMatch(html, /Synthetic demo content; HTML reports redact this value/);
  assert.doesNotMatch(html, /https:\/\/fonts\.|cdn\.|unpkg\.|jsdelivr/);
});

test("HTML report escapes hostile span names in markup and embedded JSON", () => {
  const parsed = parseInputText(JSON.stringify({
    traceId: "trace",
    spanId: "span",
    name: "<script>alert(1)</script>",
    kind: 1,
    attributes: { "gen_ai.operation.name": "plan" },
  }));
  const html = renderHtml(analyze(parsed.spans));
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("SARIF and JUnit outputs are machine-readable", async () => {
  const text = await readFile("examples/broken-agent.otlp.json", "utf8");
  const parsed = parseInputText(text, "broken-agent.otlp.json");
  const result = analyze(parsed.spans, parsed.sourceFiles);
  const sarif = JSON.parse(formatSarif(result)) as { version: string; runs: unknown[] };
  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs.length, 1);
  const junit = formatJunit(result);
  assert.match(junit, /^<\?xml version="1\.0"/);
  assert.match(junit, /<testsuites/);
  assert.match(junit, /GEN008/);
});
