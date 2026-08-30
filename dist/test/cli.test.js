import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
function run(...args) {
    return spawnSync(process.execPath, ["dist/src/cli.js", ...args], {
        cwd: process.cwd(),
        encoding: "utf8",
    });
}
test("CLI exposes help and version", () => {
    const help = run("--help");
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /OpenTelemetry GenAI \+ MCP/);
    const version = run("--version");
    assert.equal(version.status, 0, version.stderr);
    assert.equal(version.stdout.trim(), "0.1.0");
});
test("strict mode passes the valid fixture", () => {
    const result = run("check", "examples/valid-agent.otlp.json", "--strict", "--no-color");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /100\/100/);
});
test("strict mode fails the broken fixture with a rule report", () => {
    const result = run("examples/broken-agent.otlp.json", "--strict", "--no-color");
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /GEN008/);
    assert.match(result.stdout, /MCP004/);
});
test("invalid input is a usage error", () => {
    const result = run("check");
    assert.equal(result.status, 2);
    assert.match(result.stderr, /No trace files supplied/);
});
//# sourceMappingURL=cli.test.js.map