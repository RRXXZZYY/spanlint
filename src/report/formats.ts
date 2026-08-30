import { RULES } from "../spec.js";
import { serializeAnalysis } from "../serialize.js";
import type { AnalysisResult, Finding, Severity } from "../types.js";

const ANSI = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
};

function colorize(text: string, color: keyof typeof ANSI, enabled: boolean): string {
  return enabled ? `${ANSI[color]}${text}${ANSI.reset}` : text;
}

function severityGlyph(severity: Severity): string {
  return severity === "error" ? "✖" : severity === "warning" ? "▲" : "●";
}

function severityColor(severity: Severity): keyof typeof ANSI {
  return severity === "error" ? "red" : severity === "warning" ? "yellow" : "cyan";
}

function shortId(id: string | undefined): string {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export function formatTerminal(result: AnalysisResult, useColor = process.stdout.isTTY): string {
  const lines: string[] = [];
  lines.push(colorize("SpanLint", "bold", useColor) + colorize(`  ${result.ruleset.version}`, "dim", useColor));
  lines.push(
    `${colorize(`${result.summary.score}/100`, result.summary.score >= 90 ? "green" : result.summary.score >= 60 ? "yellow" : "red", useColor)} ` +
      `grade ${colorize(result.summary.grade, "bold", useColor)} · ${result.spans.length} spans · ${result.traces.length} traces`,
  );
  lines.push(
    `${colorize(String(result.summary.errors), "red", useColor)} errors  ` +
      `${colorize(String(result.summary.warnings), "yellow", useColor)} warnings  ` +
      `${colorize(String(result.summary.infos), "cyan", useColor)} notices`,
  );

  if (result.findings.length === 0) {
    lines.push("");
    lines.push(colorize("✓ No findings. The trace passes the selected ruleset.", "green", useColor));
    return lines.join("\n");
  }

  lines.push("");
  for (const finding of result.findings) {
    const glyph = colorize(severityGlyph(finding.severity), severityColor(finding.severity), useColor);
    const location = finding.spanName
      ? `${finding.spanName} (${shortId(finding.spanId)})`
      : finding.sourceFile ?? "trace";
    lines.push(`${glyph} ${colorize(finding.ruleId, "bold", useColor)} ${finding.title}`);
    lines.push(`  ${finding.message}`);
    lines.push(colorize(`  ↳ ${location}`, "dim", useColor));
  }
  lines.push("");
  lines.push(colorize("Score weights: error −15, warning −5, notice −1. This is not an OpenTelemetry certification.", "dim", useColor));
  return lines.join("\n");
}

export function formatJson(result: AnalysisResult): string {
  return JSON.stringify(serializeAnalysis(result), null, 2);
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatJunit(result: AnalysisResult): string {
  const failures = result.findings.filter((finding) => finding.severity === "error").length;
  const skipped = result.findings.filter((finding) => finding.severity === "info").length;
  const cases = result.findings.length === 0
    ? '    <testcase classname="spanlint" name="trace conformance" />'
    : result.findings.map((finding) => {
      const name = xmlEscape(`${finding.ruleId} ${finding.title}`);
      const location = xmlEscape(`${finding.spanName ?? "trace"} ${finding.spanId ?? ""}`.trim());
      const message = xmlEscape(finding.message);
      if (finding.severity === "info") {
        return `    <testcase classname="spanlint.${finding.category}" name="${name}"><skipped message="${message}" /></testcase>`;
      }
      const type = finding.severity === "error" ? "failure" : "system-out";
      if (type === "failure") {
        return `    <testcase classname="spanlint.${finding.category}" name="${name}"><failure message="${message}">${location}</failure></testcase>`;
      }
      return `    <testcase classname="spanlint.${finding.category}" name="${name}"><system-out>${message} — ${location}</system-out></testcase>`;
    }).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuites name="SpanLint" tests="${Math.max(1, result.findings.length)}" failures="${failures}" skipped="${skipped}">`,
    `  <testsuite name="OpenTelemetry GenAI and MCP" tests="${Math.max(1, result.findings.length)}" failures="${failures}" skipped="${skipped}">`,
    cases,
    "  </testsuite>",
    "</testsuites>",
  ].join("\n");
}

function sarifLevel(finding: Finding): "error" | "warning" | "note" {
  return finding.severity === "info" ? "note" : finding.severity;
}

export function formatSarif(result: AnalysisResult): string {
  const activeRuleIds = new Set(result.findings.map((finding) => finding.ruleId));
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "SpanLint",
            version: "0.1.0",
            informationUri: "https://github.com/RRXXZZYY/spanlint",
            rules: RULES.filter((rule) => activeRuleIds.has(rule.id)).map((rule) => ({
              id: rule.id,
              name: rule.title.replace(/\s+/g, ""),
              shortDescription: { text: rule.summary },
              help: { text: rule.help, markdown: rule.sourceUrl ? `${rule.help}\n\n[Convention source](${rule.sourceUrl})` : rule.help },
              defaultConfiguration: { level: rule.defaultSeverity === "info" ? "note" : rule.defaultSeverity },
              properties: { category: rule.category },
            })),
          },
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel(finding),
          message: { text: finding.message },
          fingerprints: { spanlintFingerprint: finding.fingerprint },
          locations: finding.sourceFile ? [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.sourceFile },
                region: { startLine: 1 },
              },
              logicalLocations: finding.spanName ? [{ name: finding.spanName, kind: "span" }] : [],
            },
          ] : [],
          properties: {
            category: finding.category,
            traceId: finding.traceId,
            spanId: finding.spanId,
            attribute: finding.attribute,
          },
        })),
      },
    ],
  };
  return JSON.stringify(sarif, null, 2);
}
