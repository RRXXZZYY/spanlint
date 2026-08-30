export { analyze } from "./rules.js";
export { parseInputFiles, parseInputText, decodeAnyValue, decodeAttributes } from "./otlp.js";
export { renderHtml } from "./report/html.js";
export { formatJson, formatJunit, formatSarif, formatTerminal } from "./report/formats.js";
export { RULES, RULESET } from "./spec.js";
export type {
  AnalysisResult,
  AnalyzeOptions,
  Finding,
  NormalizedSpan,
  ParsedInput,
  PrivacyMode,
  RuleMetadata,
  Severity,
} from "./types.js";
