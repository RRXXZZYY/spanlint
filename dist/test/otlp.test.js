import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { decodeAnyValue, parseInputText } from "../src/otlp.js";
test("decodes OTLP AnyValue shapes", () => {
    assert.equal(decodeAnyValue({ stringValue: "hello" }), "hello");
    assert.equal(decodeAnyValue({ intValue: "42" }), 42);
    assert.deepEqual(decodeAnyValue({ arrayValue: { values: [{ boolValue: true }, { doubleValue: 1.5 }] } }), [true, 1.5]);
    assert.deepEqual(decodeAnyValue({ kvlistValue: { values: [{ key: "nested", value: { stringValue: "value" } }] } }), { nested: "value" });
});
test("parses standard OTLP JSON and strips source paths to basenames", async () => {
    const text = await readFile("examples/valid-agent.otlp.json", "utf8");
    const parsed = parseInputText(text, "C:\\synthetic\\fixtures\\trace.json");
    assert.equal(parsed.spans.length, 4);
    assert.equal(parsed.spans[0]?.sourceFile, "trace.json");
    assert.equal(parsed.spans[1]?.kind, "CLIENT");
    assert.equal(parsed.spans[1]?.attributes["gen_ai.usage.input_tokens"], 684);
    assert.equal(parsed.spans[0]?.resourceAttributes["service.name"], "incident-agent-demo");
});
test("parses newline-delimited flat spans", () => {
    const text = [
        JSON.stringify({ traceId: "t1", spanId: "s1", name: "root", kind: "SPAN_KIND_INTERNAL", attributes: {} }),
        JSON.stringify({ traceId: "t1", spanId: "s2", parentSpanId: "s1", name: "child", kind: 3, attributes: {} }),
    ].join("\n");
    const parsed = parseInputText(text, "flat.jsonl");
    assert.equal(parsed.spans.length, 2);
    assert.equal(parsed.spans[0]?.kind, "INTERNAL");
    assert.equal(parsed.spans[1]?.kind, "CLIENT");
});
test("rejects inputs without spans", () => {
    assert.throws(() => parseInputText('{"resourceSpans":[]}', "empty.json"), /No spans found/);
});
//# sourceMappingURL=otlp.test.js.map