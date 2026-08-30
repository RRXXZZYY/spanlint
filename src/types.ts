export type Severity = "error" | "warning" | "info";
export type FindingCategory =
  | "conformance"
  | "quality"
  | "structure"
  | "privacy"
  | "cardinality"
  | "migration";

export type PrivacyMode = "off" | "notice" | "strict";

export interface NormalizedSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: string;
  startTimeNs?: bigint;
  endTimeNs?: bigint;
  durationNs?: bigint;
  statusCode: string;
  statusMessage?: string;
  attributes: Record<string, unknown>;
  resourceAttributes: Record<string, unknown>;
  scopeName?: string;
  schemaUrl?: string;
  sourceFile: string;
  sourceIndex: number;
}

export interface ParsedInput {
  spans: NormalizedSpan[];
  sourceFiles: string[];
}

export interface RuleMetadata {
  id: string;
  title: string;
  category: FindingCategory;
  defaultSeverity: Severity;
  summary: string;
  help: string;
  sourceUrl?: string;
}

export interface Finding {
  ruleId: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  message: string;
  help: string;
  sourceUrl?: string;
  traceId?: string;
  spanId?: string;
  spanName?: string;
  attribute?: string;
  sourceFile?: string;
  fingerprint: string;
}

export interface TraceSummary {
  traceId: string;
  spanCount: number;
  rootCount: number;
  durationNs?: bigint;
  errorSpanCount: number;
}

export interface ScoreSummary {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  errors: number;
  warnings: number;
  infos: number;
}

export interface AnalysisResult {
  generatedAt: string;
  ruleset: RulesetInfo;
  spans: NormalizedSpan[];
  traces: TraceSummary[];
  findings: Finding[];
  summary: ScoreSummary;
  sourceFiles: string[];
  privacyMode: PrivacyMode;
}

export interface AnalyzeOptions {
  privacyMode?: PrivacyMode;
}

export interface RulesetInfo {
  name: string;
  version: string;
  target: string;
  sourceCommit: string;
  sourceUpdatedAt: string;
  sourceUrl: string;
  disclaimer: string;
}

export interface SerializableSpan extends Omit<NormalizedSpan, "startTimeNs" | "endTimeNs" | "durationNs"> {
  startTimeNs?: string;
  endTimeNs?: string;
  durationNs?: string;
}

export interface SerializableAnalysis extends Omit<AnalysisResult, "spans" | "traces"> {
  spans: SerializableSpan[];
  traces: Array<Omit<TraceSummary, "durationNs"> & { durationNs?: string }>;
}
