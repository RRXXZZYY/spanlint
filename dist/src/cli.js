#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { DEMO_TRACE } from "./demo.js";
import { parseInputFiles, parseInputText } from "./otlp.js";
import { renderHtml } from "./report/html.js";
import { formatJson, formatJunit, formatSarif, formatTerminal } from "./report/formats.js";
import { analyze } from "./rules.js";
import { RULE_BY_ID, RULES, RULESET } from "./spec.js";
const VERSION = "0.1.0";
const FORMATS = new Set(["pretty", "json", "sarif", "junit", "html"]);
const HELP = `
SpanLint ${VERSION} — lint and visualize OpenTelemetry GenAI + MCP traces

Usage
  spanlint check <trace.json|trace.jsonl>... [options]
  spanlint <trace.json>                         # implicit check
  spanlint demo [--out spanlint-demo.html]
  spanlint rules [--format pretty|json]
  spanlint explain <RULE_ID>

Options
  -f, --format <pretty|json|sarif|junit|html>   Output format (default: pretty)
  -o, --out <path>                              Write output to a file
      --privacy <off|notice|strict>             Content-capture policy (default: notice)
      --strict                                  Fail on warnings as well as errors
      --no-color                                Disable ANSI colors
  -v, --version                                 Print version
  -h, --help                                    Show help

Examples
  spanlint examples/valid-agent.otlp.json --strict
  spanlint check trace.json --format sarif --out spanlint.sarif
  spanlint demo --out spanlint-demo.html
`;
function parsePrivacy(value) {
    const privacy = value ?? "notice";
    if (!["off", "notice", "strict"].includes(privacy)) {
        throw new Error(`Unknown privacy mode "${privacy}". Use off, notice, or strict.`);
    }
    return privacy;
}
function render(result, format, noColor) {
    if (format === "pretty")
        return formatTerminal(result, !noColor && process.stdout.isTTY);
    if (format === "json")
        return formatJson(result);
    if (format === "sarif")
        return formatSarif(result);
    if (format === "junit")
        return formatJunit(result);
    if (format === "html")
        return renderHtml(result);
    throw new Error(`Unsupported format: ${format}`);
}
async function writeOrPrint(content, format, out) {
    const target = out ?? (format === "html" ? "spanlint-report.html" : undefined);
    if (target) {
        await writeFile(target, content, "utf8");
        process.stdout.write(`SpanLint wrote ${basename(target)}\n`);
        return;
    }
    process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
}
function parseOptions(args) {
    const parsed = parseArgs({
        args,
        allowPositionals: true,
        strict: true,
        options: {
            format: { type: "string", short: "f", default: "pretty" },
            out: { type: "string", short: "o" },
            privacy: { type: "string", default: "notice" },
            strict: { type: "boolean", default: false },
            "no-color": { type: "boolean", default: false },
            help: { type: "boolean", short: "h", default: false },
            version: { type: "boolean", short: "v", default: false },
        },
    });
    const format = parsed.values.format ?? "pretty";
    if (!FORMATS.has(format))
        throw new Error(`Unknown format "${format}". Use pretty, json, sarif, junit, or html.`);
    const options = {
        format,
        privacy: parsePrivacy(parsed.values.privacy),
        strict: parsed.values.strict ?? false,
        noColor: parsed.values["no-color"] ?? false,
    };
    if (parsed.values.out !== undefined)
        options.out = parsed.values.out;
    return {
        positionals: parsed.positionals,
        options,
        help: parsed.values.help ?? false,
        version: parsed.values.version ?? false,
    };
}
async function runCheck(paths, options) {
    if (paths.length === 0)
        throw new Error("No trace files supplied. Run spanlint --help for examples.");
    const parsed = await parseInputFiles(paths);
    const result = analyze(parsed.spans, parsed.sourceFiles, { privacyMode: options.privacy });
    await writeOrPrint(render(result, options.format, options.noColor), options.format, options.out);
    const fails = result.summary.errors > 0 || (options.strict && result.summary.warnings > 0);
    return fails ? 1 : 0;
}
async function runDemo(options) {
    const parsed = parseInputText(JSON.stringify(DEMO_TRACE), "synthetic-broken-agent.otlp.json");
    const result = analyze(parsed.spans, parsed.sourceFiles, { privacyMode: options.privacy });
    const format = options.format === "pretty" ? "html" : options.format;
    const out = options.out ?? (format === "html" ? "spanlint-demo.html" : undefined);
    await writeOrPrint(render(result, format, options.noColor), format, out);
    return 0;
}
function printRules(format) {
    if (format === "json") {
        process.stdout.write(`${JSON.stringify({ ruleset: RULESET, rules: RULES }, null, 2)}\n`);
        return;
    }
    process.stdout.write(`SpanLint ruleset ${RULESET.version}\n\n`);
    for (const rule of RULES) {
        process.stdout.write(`${rule.id.padEnd(8)} ${rule.defaultSeverity.padEnd(7)} ${rule.title}\n`);
    }
}
function explain(ruleId) {
    if (!ruleId)
        throw new Error("Supply a rule ID, for example: spanlint explain MCP004");
    const rule = RULE_BY_ID.get(ruleId.toUpperCase());
    if (!rule)
        throw new Error(`Unknown rule "${ruleId}". Run spanlint rules to list rule IDs.`);
    process.stdout.write(`${rule.id} — ${rule.title}\n\n${rule.summary}\n\nHow to fix\n${rule.help}\n`);
    if (rule.sourceUrl)
        process.stdout.write(`\nPinned source\n${rule.sourceUrl}\n`);
    return 0;
}
export async function main(argv = process.argv.slice(2)) {
    const parsed = parseOptions(argv);
    if (parsed.version) {
        process.stdout.write(`${VERSION}\n`);
        return 0;
    }
    if (parsed.help || parsed.positionals[0] === "help") {
        process.stdout.write(HELP.trimStart());
        return 0;
    }
    const first = parsed.positionals[0];
    if (first === "demo")
        return runDemo(parsed.options);
    if (first === "rules") {
        printRules(parsed.options.format);
        return 0;
    }
    if (first === "explain")
        return explain(parsed.positionals[1]);
    if (first === "check")
        return runCheck(parsed.positionals.slice(1), parsed.options);
    return runCheck(parsed.positionals, parsed.options);
}
const isEntrypoint = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntrypoint) {
    main().then((code) => { process.exitCode = code; }, (error) => {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`SpanLint: ${message}\n`);
        process.exitCode = 2;
    });
}
//# sourceMappingURL=cli.js.map