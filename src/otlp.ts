import { readFile } from "node:fs/promises";
import type { NormalizedSpan, ParsedInput } from "./types.js";

type JsonRecord = Record<string, unknown>;

const SPAN_KIND: Record<number, string> = {
  0: "UNSPECIFIED",
  1: "INTERNAL",
  2: "SERVER",
  3: "CLIENT",
  4: "PRODUCER",
  5: "CONSUMER",
};

const STATUS_CODE: Record<number, string> = {
  0: "UNSET",
  1: "OK",
  2: "ERROR",
};

function safeBasename(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  return normalized.split("/").filter(Boolean).at(-1) ?? "trace.json";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pick<T>(record: JsonRecord, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in record) return record[key] as T;
  }
  return undefined;
}

export function decodeAnyValue(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if ("stringValue" in value) return value.stringValue;
  if ("boolValue" in value) return value.boolValue;
  if ("intValue" in value) {
    const raw = value.intValue;
    if (typeof raw === "number") return raw;
    if (typeof raw === "string" && /^-?\d+$/.test(raw)) {
      const parsed = Number(raw);
      return Number.isSafeInteger(parsed) ? parsed : raw;
    }
    return raw;
  }
  if ("doubleValue" in value) return value.doubleValue;
  if ("bytesValue" in value) return "[bytes]";
  if ("arrayValue" in value && isRecord(value.arrayValue)) {
    const values = pick<unknown[]>(value.arrayValue, "values") ?? [];
    return values.map(decodeAnyValue);
  }
  if ("kvlistValue" in value && isRecord(value.kvlistValue)) {
    return decodeAttributes(pick<unknown[]>(value.kvlistValue, "values") ?? []);
  }
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, decodeAnyValue(nested)]));
}

export function decodeAttributes(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const entries: Array<[string, unknown]> = [];
    for (const item of value) {
      if (!isRecord(item)) continue;
      const key = pick<string>(item, "key");
      if (!key) continue;
      entries.push([key, decodeAnyValue(pick(item, "value"))]);
    }
    return Object.fromEntries(entries);
  }
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, decodeAnyValue(nested)]));
  }
  return {};
}

function normalizeKind(value: unknown): string {
  if (typeof value === "number") return SPAN_KIND[value] ?? `UNKNOWN_${value}`;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isInteger(numeric) && value.trim() !== "") return SPAN_KIND[numeric] ?? `UNKNOWN_${value}`;
    return value.replace(/^SPAN_KIND_/, "").toUpperCase();
  }
  return "UNSPECIFIED";
}

function normalizeStatus(value: unknown): { code: string; message?: string } {
  if (!isRecord(value)) return { code: "UNSET" };
  const rawCode = pick<unknown>(value, "code");
  let code = "UNSET";
  if (typeof rawCode === "number") code = STATUS_CODE[rawCode] ?? `UNKNOWN_${rawCode}`;
  else if (typeof rawCode === "string") {
    const numeric = Number(rawCode);
    code = Number.isInteger(numeric) && rawCode.trim() !== ""
      ? STATUS_CODE[numeric] ?? `UNKNOWN_${rawCode}`
      : rawCode.replace(/^STATUS_CODE_/, "").toUpperCase();
  }
  const message = pick<string>(value, "message", "description");
  return message ? { code, message } : { code };
}

function toBigInt(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
}

interface SpanContext {
  resourceAttributes: Record<string, unknown>;
  scopeName?: string;
  schemaUrl?: string;
  sourceFile: string;
  sourceIndex: number;
}

function normalizeSpan(raw: JsonRecord, context: SpanContext): NormalizedSpan {
  const traceId = String(pick(raw, "traceId", "trace_id") ?? "missing-trace-id");
  const spanId = String(pick(raw, "spanId", "span_id") ?? `missing-span-${context.sourceIndex}`);
  const parentRaw = pick<unknown>(raw, "parentSpanId", "parent_span_id");
  const parentSpanId = parentRaw === undefined || parentRaw === null || parentRaw === "" ? undefined : String(parentRaw);
  const startTimeNs = toBigInt(pick(raw, "startTimeUnixNano", "start_time_unix_nano", "startTimeNs"));
  const endTimeNs = toBigInt(pick(raw, "endTimeUnixNano", "end_time_unix_nano", "endTimeNs"));
  const durationNs = startTimeNs !== undefined && endTimeNs !== undefined ? endTimeNs - startTimeNs : undefined;
  const status = normalizeStatus(pick(raw, "status"));
  const normalized: NormalizedSpan = {
    traceId,
    spanId,
    name: String(pick(raw, "name") ?? "unnamed-span"),
    kind: normalizeKind(pick(raw, "kind", "spanKind")),
    statusCode: status.code,
    attributes: decodeAttributes(pick(raw, "attributes")),
    resourceAttributes: context.resourceAttributes,
    sourceFile: context.sourceFile,
    sourceIndex: context.sourceIndex,
  };
  if (parentSpanId !== undefined) normalized.parentSpanId = parentSpanId;
  if (startTimeNs !== undefined) normalized.startTimeNs = startTimeNs;
  if (endTimeNs !== undefined) normalized.endTimeNs = endTimeNs;
  if (durationNs !== undefined) normalized.durationNs = durationNs;
  if (status.message !== undefined) normalized.statusMessage = status.message;
  if (context.scopeName !== undefined) normalized.scopeName = context.scopeName;
  if (context.schemaUrl !== undefined) normalized.schemaUrl = context.schemaUrl;
  return normalized;
}

function collectFromObject(root: unknown, sourceFile: string): NormalizedSpan[] {
  const spans: NormalizedSpan[] = [];
  let sourceIndex = 0;

  const visit = (
    value: unknown,
    resourceAttributes: Record<string, unknown> = {},
    scopeName?: string,
    schemaUrl?: string,
  ): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, resourceAttributes, scopeName, schemaUrl);
      return;
    }
    if (!isRecord(value)) return;

    const resourceSpans = pick<unknown[]>(value, "resourceSpans", "resource_spans");
    if (Array.isArray(resourceSpans)) {
      for (const item of resourceSpans) visit(item, resourceAttributes, scopeName, schemaUrl);
      return;
    }

    const resource = pick<JsonRecord>(value, "resource");
    const nextResource = resource && isRecord(resource)
      ? { ...resourceAttributes, ...decodeAttributes(pick(resource, "attributes")) }
      : resourceAttributes;

    const nextSchema = pick<string>(value, "schemaUrl", "schema_url") ?? schemaUrl;
    const scopeSpans = pick<unknown[]>(value, "scopeSpans", "scope_spans", "instrumentationLibrarySpans");
    if (Array.isArray(scopeSpans)) {
      for (const item of scopeSpans) visit(item, nextResource, scopeName, nextSchema);
      return;
    }

    const scope = pick<JsonRecord>(value, "scope", "instrumentationLibrary");
    const nextScope = scope && isRecord(scope) ? pick<string>(scope, "name") ?? scopeName : scopeName;
    const directSpans = pick<unknown[]>(value, "spans");
    if (Array.isArray(directSpans)) {
      for (const raw of directSpans) {
        if (!isRecord(raw)) continue;
        spans.push(normalizeSpan(raw, {
          resourceAttributes: nextResource,
          sourceFile,
          sourceIndex: sourceIndex++,
          ...(nextScope !== undefined ? { scopeName: nextScope } : {}),
          ...(nextSchema !== undefined ? { schemaUrl: nextSchema } : {}),
        }));
      }
      return;
    }

    if (("traceId" in value || "trace_id" in value) && ("spanId" in value || "span_id" in value)) {
      spans.push(normalizeSpan(value, {
        resourceAttributes: nextResource,
        sourceFile,
        sourceIndex: sourceIndex++,
        ...(nextScope !== undefined ? { scopeName: nextScope } : {}),
        ...(nextSchema !== undefined ? { schemaUrl: nextSchema } : {}),
      }));
    }
  };

  visit(root);
  return spans;
}

function parseJsonOrJsonLines(text: string, sourceFile: string): NormalizedSpan[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    return collectFromObject(JSON.parse(trimmed), sourceFile);
  } catch (jsonError) {
    const parsedLines: unknown[] = [];
    const lines = trimmed.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) continue;
      try {
        parsedLines.push(JSON.parse(line));
      } catch {
        const reason = jsonError instanceof Error ? jsonError.message : String(jsonError);
        throw new Error(`Could not parse ${sourceFile} as JSON or JSONL (line ${index + 1}). Initial JSON error: ${reason}`);
      }
    }
    return collectFromObject(parsedLines, sourceFile);
  }
}

export async function parseInputFiles(paths: string[]): Promise<ParsedInput> {
  const spans: NormalizedSpan[] = [];
  const sourceFiles: string[] = [];
  for (const path of paths) {
    const sourceFile = safeBasename(path);
    const text = await readFile(path, "utf8");
    const parsed = parseJsonOrJsonLines(text, sourceFile);
    if (parsed.length === 0) throw new Error(`No spans found in ${sourceFile}. Expected OTLP JSON, JSONL, or a span array.`);
    spans.push(...parsed);
    sourceFiles.push(sourceFile);
  }
  return { spans, sourceFiles };
}

export function parseInputText(text: string, sourceFile = "inline.json"): ParsedInput {
  const safeName = safeBasename(sourceFile);
  const spans = parseJsonOrJsonLines(text, safeName);
  if (spans.length === 0) throw new Error(`No spans found in ${safeName}. Expected OTLP JSON, JSONL, or a span array.`);
  return { spans, sourceFiles: [safeName] };
}
