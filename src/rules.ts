import {
  CONTENT_ATTRIBUTES,
  GENAI_OPERATIONS,
  INFERENCE_OPERATIONS,
  LEGACY_ATTRIBUTES,
  RULE_BY_ID,
  RULESET,
} from "./spec.js";
import type {
  AnalysisResult,
  AnalyzeOptions,
  Finding,
  NormalizedSpan,
  PrivacyMode,
  Severity,
  TraceSummary,
} from "./types.js";

type Attrs = Record<string, unknown>;

function safeBasename(path: string): string {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "trace.json";
}

function stringAttr(attributes: Attrs, key: string): string | undefined {
  const value = attributes[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numericAttr(attributes: Attrs, key: string): number | undefined {
  const value = attributes[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  return undefined;
}

function hasPrefix(attributes: Attrs, prefix: string): boolean {
  return Object.keys(attributes).some((key) => key.startsWith(prefix));
}

function isMcpSpan(span: NormalizedSpan): boolean {
  return hasPrefix(span.attributes, "mcp.") || /(?:^|[./_-])mcp(?:$|[./_-])/i.test(span.scopeName ?? "");
}

function inferredOperation(span: NormalizedSpan): string | undefined {
  const operation = stringAttr(span.attributes, "gen_ai.operation.name");
  if (operation) return operation;
  return [...GENAI_OPERATIONS].find((candidate) => span.name === candidate || span.name.startsWith(`${candidate} `));
}

function isGenAiSpan(span: NormalizedSpan): boolean {
  if (inferredOperation(span)) return true;
  const meaningfulKeys = [
    "gen_ai.request.model",
    "gen_ai.response.model",
    "gen_ai.provider.name",
    "gen_ai.agent.name",
    "gen_ai.workflow.name",
    "gen_ai.usage.input_tokens",
    "gen_ai.usage.output_tokens",
  ];
  return meaningfulKeys.some((key) => key in span.attributes);
}

function fingerprint(ruleId: string, span: NormalizedSpan | undefined, attribute: string | undefined, message: string): string {
  return [ruleId, span?.traceId ?? "trace", span?.spanId ?? "span", attribute ?? "attribute", message]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function makeFinding(
  ruleId: string,
  message: string,
  span?: NormalizedSpan,
  options: { attribute?: string; severity?: Severity } = {},
): Finding {
  const metadata = RULE_BY_ID.get(ruleId);
  if (!metadata) throw new Error(`Unknown SpanLint rule: ${ruleId}`);
  const finding: Finding = {
    ruleId,
    title: metadata.title,
    category: metadata.category,
    severity: options.severity ?? metadata.defaultSeverity,
    message,
    help: metadata.help,
    fingerprint: fingerprint(ruleId, span, options.attribute, message),
  };
  if (metadata.sourceUrl !== undefined) finding.sourceUrl = metadata.sourceUrl;
  if (span) {
    finding.traceId = span.traceId;
    finding.spanId = span.spanId;
    finding.spanName = span.name;
    finding.sourceFile = safeBasename(span.sourceFile);
  }
  if (options.attribute !== undefined) finding.attribute = options.attribute;
  return finding;
}

function expectedGenAiName(span: NormalizedSpan, operation: string): string | undefined {
  if (operation === "invoke_agent") {
    const agent = stringAttr(span.attributes, "gen_ai.agent.name");
    return agent ? `invoke_agent ${agent}` : "invoke_agent";
  }
  if (operation === "execute_tool") {
    const tool = stringAttr(span.attributes, "gen_ai.tool.name");
    return tool ? `execute_tool ${tool}` : "execute_tool";
  }
  if (operation === "invoke_workflow") {
    const workflow = stringAttr(span.attributes, "gen_ai.workflow.name");
    return workflow ? `invoke_workflow ${workflow}` : "invoke_workflow";
  }
  if (operation === "plan") {
    const agent = stringAttr(span.attributes, "gen_ai.agent.name");
    return agent ? `plan ${agent}` : "plan";
  }
  if (INFERENCE_OPERATIONS.has(operation)) {
    const model = stringAttr(span.attributes, "gen_ai.request.model");
    return model ? `${operation} ${model}` : operation;
  }
  return undefined;
}

function checkSpanSemantics(span: NormalizedSpan, privacyMode: PrivacyMode): Finding[] {
  const findings: Finding[] = [];
  const attributes = span.attributes;
  const mcp = isMcpSpan(span);
  const genAi = isGenAiSpan(span);
  const operation = stringAttr(attributes, "gen_ai.operation.name");
  const inferred = inferredOperation(span);

  if (genAi && !operation && !(mcp && inferred === undefined)) {
    findings.push(makeFinding("GEN001", "This span looks like a GenAI operation but has no gen_ai.operation.name.", span, {
      attribute: "gen_ai.operation.name",
    }));
  }

  if (operation && !GENAI_OPERATIONS.has(operation)) {
    findings.push(makeFinding("GEN002", `Operation "${operation}" is not in the pinned well-known operation set.`, span, {
      attribute: "gen_ai.operation.name",
    }));
  }

  if (operation === "execute_tool" || stringAttr(attributes, "mcp.method.name") === "tools/call") {
    const tool = stringAttr(attributes, "gen_ai.tool.name");
    if (!tool) {
      findings.push(makeFinding("GEN003", "Tool execution is missing gen_ai.tool.name.", span, {
        attribute: "gen_ai.tool.name",
      }));
    }
  }

  if (operation && !mcp) {
    const expected = expectedGenAiName(span, operation);
    if (expected && span.name !== expected) {
      findings.push(makeFinding("GEN004", `Expected span name "${expected}", found "${span.name}".`, span));
    }
  }

  if (operation && ["invoke_workflow", "plan"].includes(operation) && span.kind !== "INTERNAL") {
    findings.push(makeFinding("GEN005", `${operation} spans should use INTERNAL kind; found ${span.kind}.`, span));
  }
  if (operation === "execute_tool" && !mcp && span.kind !== "INTERNAL") {
    findings.push(makeFinding("GEN005", `Direct execute_tool spans should use INTERNAL kind; found ${span.kind}.`, span));
  }
  if (operation && INFERENCE_OPERATIONS.has(operation) && !["CLIENT", "INTERNAL"].includes(span.kind)) {
    findings.push(makeFinding("GEN005", `Inference spans should use CLIENT or INTERNAL kind; found ${span.kind}.`, span));
  }

  if (operation && INFERENCE_OPERATIONS.has(operation)) {
    if (!("gen_ai.request.model" in attributes) && !("gen_ai.response.model" in attributes)) {
      findings.push(makeFinding("GEN006", "Neither gen_ai.request.model nor gen_ai.response.model is present.", span));
    }
    const hasInput = "gen_ai.usage.input_tokens" in attributes;
    const hasOutput = "gen_ai.usage.output_tokens" in attributes;
    const missing = operation === "embeddings" ? !hasInput : !hasInput || !hasOutput;
    if (missing) {
      const expected = operation === "embeddings"
        ? "gen_ai.usage.input_tokens"
        : "gen_ai.usage.input_tokens and gen_ai.usage.output_tokens";
      findings.push(makeFinding("GEN007", `Recommended usage telemetry is incomplete; expected ${expected}.`, span));
    }
  }

  const tokenKeys = Object.keys(attributes).filter((key) => key.startsWith("gen_ai.usage.") && key.endsWith("_tokens"));
  for (const key of tokenKeys) {
    const value = numericAttr(attributes, key);
    if (value === undefined || !Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      findings.push(makeFinding("GEN008", `${key} must be a non-negative integer; found ${JSON.stringify(attributes[key])}.`, span, {
        attribute: key,
      }));
    }
  }
  const inputTotal = numericAttr(attributes, "gen_ai.usage.input_tokens");
  const outputTotal = numericAttr(attributes, "gen_ai.usage.output_tokens");
  for (const key of tokenKeys) {
    if (key === "gen_ai.usage.input_tokens" || key === "gen_ai.usage.output_tokens") continue;
    const value = numericAttr(attributes, key);
    if (value === undefined || value < 0) continue;
    const relevantTotal = key.endsWith("input_tokens") ? inputTotal : key.endsWith("output_tokens") ? outputTotal : undefined;
    if (relevantTotal !== undefined && value > relevantTotal) {
      findings.push(makeFinding("GEN008", `${key} (${value}) exceeds its reported total (${relevantTotal}).`, span, { attribute: key }));
    }
  }

  for (const [legacy, replacement] of Object.entries(LEGACY_ATTRIBUTES)) {
    if (legacy in attributes) {
      findings.push(makeFinding("GEN009", `${legacy} is legacy; migrate to ${replacement}.`, span, { attribute: legacy }));
    }
  }

  if (mcp) {
    const method = stringAttr(attributes, "mcp.method.name");
    if (!method) {
      findings.push(makeFinding("MCP001", "This MCP span has no mcp.method.name.", span, { attribute: "mcp.method.name" }));
    } else {
      const target = stringAttr(attributes, "gen_ai.tool.name") ?? stringAttr(attributes, "gen_ai.prompt.name");
      const expected = target ? `${method} ${target}` : method;
      if (span.name !== expected) {
        findings.push(makeFinding("MCP002", `Expected span name "${expected}", found "${span.name}".`, span));
      }
    }
    if (!("mcp.protocol.version" in attributes)) {
      findings.push(makeFinding("MCP003", "mcp.protocol.version is not present.", span, { attribute: "mcp.protocol.version" }));
    }
    const transport = stringAttr(attributes, "network.transport");
    const protocol = stringAttr(attributes, "network.protocol.name");
    const incompatible =
      (transport === "pipe" && protocol !== undefined) ||
      (protocol === "http" && transport !== undefined && !["tcp", "quic"].includes(transport));
    if (incompatible) {
      findings.push(makeFinding("MCP004", `network.transport=${transport ?? "<missing>"} conflicts with network.protocol.name=${protocol ?? "<missing>"}.`, span));
    }
  }

  if (span.statusCode === "ERROR" && !("error.type" in attributes)) {
    findings.push(makeFinding("ERR001", "Span status is ERROR but error.type is absent.", span, { attribute: "error.type" }));
  }

  if (privacyMode !== "off") {
    for (const attribute of CONTENT_ATTRIBUTES) {
      if (attribute in attributes) {
        findings.push(makeFinding(
          "PRIV001",
          `${attribute} contains opt-in content. SpanLint redacts its value from HTML reports.`,
          span,
          { attribute, severity: privacyMode === "strict" ? "warning" : "info" },
        ));
      }
    }
  }

  const resourceUri = stringAttr(attributes, "mcp.resource.uri");
  const looksHighCardinality =
    /https?:\/\//i.test(span.name) ||
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(span.name) ||
    /\b[0-9a-f]{16,}\b/i.test(span.name) ||
    (resourceUri !== undefined && span.name.includes(resourceUri));
  if (looksHighCardinality) {
    findings.push(makeFinding("CARD001", `Span name "${span.name}" appears request-specific.`, span));
  }

  return findings;
}

function checkTopology(spans: NormalizedSpan[]): Finding[] {
  const findings: Finding[] = [];
  const byTrace = new Map<string, NormalizedSpan[]>();
  for (const span of spans) {
    const list = byTrace.get(span.traceId) ?? [];
    list.push(span);
    byTrace.set(span.traceId, list);
  }

  for (const traceSpans of byTrace.values()) {
    const byId = new Map<string, NormalizedSpan>();
    const duplicateIds = new Set<string>();
    for (const span of traceSpans) {
      if (byId.has(span.spanId)) duplicateIds.add(span.spanId);
      else byId.set(span.spanId, span);
    }
    for (const id of duplicateIds) {
      const span = traceSpans.find((candidate) => candidate.spanId === id);
      if (span) findings.push(makeFinding("STR003", `traceId/spanId pair is duplicated (${span.traceId}/${span.spanId}).`, span));
    }

    const agentIds = new Set(
      traceSpans
        .filter((span) => stringAttr(span.attributes, "gen_ai.operation.name") === "invoke_agent")
        .map((span) => span.spanId),
    );

    for (const span of traceSpans) {
      if (span.parentSpanId && !byId.has(span.parentSpanId)) {
        findings.push(makeFinding("STR001", `parentSpanId ${span.parentSpanId} is not present in trace ${span.traceId}.`, span));
      }
      if (span.durationNs !== undefined && span.durationNs < 0n) {
        findings.push(makeFinding("STR002", "Span end timestamp is earlier than its start timestamp.", span));
      }
      const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
      if (
        parent?.startTimeNs !== undefined && parent.endTimeNs !== undefined &&
        span.startTimeNs !== undefined && span.endTimeNs !== undefined &&
        (span.startTimeNs < parent.startTimeNs || span.endTimeNs > parent.endTimeNs)
      ) {
        findings.push(makeFinding("STR002", `Span interval lies outside parent "${parent.name}"; check clock skew or parentage.`, span, {
          severity: "warning",
        }));
      }

      const operation = stringAttr(span.attributes, "gen_ai.operation.name");
      const toolName = stringAttr(span.attributes, "gen_ai.tool.name");
      if (operation === "execute_tool" || stringAttr(span.attributes, "mcp.method.name") === "tools/call") {
        if (agentIds.size > 0) {
          let ancestor = parent;
          let connected = false;
          const visited = new Set<string>();
          while (ancestor && !visited.has(ancestor.spanId)) {
            visited.add(ancestor.spanId);
            if (agentIds.has(ancestor.spanId)) {
              connected = true;
              break;
            }
            ancestor = ancestor.parentSpanId ? byId.get(ancestor.parentSpanId) : undefined;
          }
          if (!connected) findings.push(makeFinding("STR004", "Tool execution is detached from the trace's invoke_agent span.", span));
        }

        if (parent) {
          const parentOperation = stringAttr(parent.attributes, "gen_ai.operation.name");
          const parentMethod = stringAttr(parent.attributes, "mcp.method.name");
          const parentTool = stringAttr(parent.attributes, "gen_ai.tool.name");
          const sameExecution =
            (parentOperation === "execute_tool" || parentMethod === "tools/call") &&
            toolName !== undefined && parentTool === toolName;
          if (sameExecution) {
            findings.push(makeFinding("MCP005", `Nested span "${parent.name}" appears to duplicate tool "${toolName}".`, span));
          }
        }
      }
    }
  }
  return findings;
}

function summarizeTraces(spans: NormalizedSpan[]): TraceSummary[] {
  const groups = new Map<string, NormalizedSpan[]>();
  for (const span of spans) {
    const group = groups.get(span.traceId) ?? [];
    group.push(span);
    groups.set(span.traceId, group);
  }
  return [...groups.entries()].map(([traceId, traceSpans]) => {
    const starts = traceSpans.flatMap((span) => span.startTimeNs === undefined ? [] : [span.startTimeNs]);
    const ends = traceSpans.flatMap((span) => span.endTimeNs === undefined ? [] : [span.endTimeNs]);
    const start = starts.length ? starts.reduce((a, b) => a < b ? a : b) : undefined;
    const end = ends.length ? ends.reduce((a, b) => a > b ? a : b) : undefined;
    const durationNs = start !== undefined && end !== undefined ? end - start : undefined;
    return {
      traceId,
      spanCount: traceSpans.length,
      rootCount: traceSpans.filter((span) => !span.parentSpanId).length,
      errorSpanCount: traceSpans.filter((span) => span.statusCode === "ERROR").length,
      ...(durationNs !== undefined ? { durationNs } : {}),
    };
  });
}

function score(findings: Finding[]): AnalysisResult["summary"] {
  const errors = findings.filter((finding) => finding.severity === "error").length;
  const warnings = findings.filter((finding) => finding.severity === "warning").length;
  const infos = findings.filter((finding) => finding.severity === "info").length;
  const value = Math.max(0, 100 - errors * 15 - warnings * 5 - infos);
  const grade = value >= 90 ? "A" : value >= 75 ? "B" : value >= 60 ? "C" : value >= 40 ? "D" : "F";
  return { score: value, grade, errors, warnings, infos };
}

export function analyze(spans: NormalizedSpan[], sourceFiles: string[] = [], options: AnalyzeOptions = {}): AnalysisResult {
  const privacyMode = options.privacyMode ?? "notice";
  const rawFindings = [
    ...spans.flatMap((span) => checkSpanSemantics(span, privacyMode)),
    ...checkTopology(spans),
  ];
  const unique = new Map(rawFindings.map((finding) => [finding.fingerprint, finding]));
  const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  const findings = [...unique.values()].sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity] ||
    a.ruleId.localeCompare(b.ruleId) ||
    (a.spanName ?? "").localeCompare(b.spanName ?? ""),
  );
  return {
    generatedAt: new Date().toISOString(),
    ruleset: RULESET,
    spans,
    traces: summarizeTraces(spans),
    findings,
    summary: score(findings),
    sourceFiles: sourceFiles.map(safeBasename),
    privacyMode,
  };
}
