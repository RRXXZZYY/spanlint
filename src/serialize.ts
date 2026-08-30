import type { AnalysisResult, NormalizedSpan, SerializableAnalysis, SerializableSpan } from "./types.js";

export function serializeSpan(span: NormalizedSpan): SerializableSpan {
  const { startTimeNs, endTimeNs, durationNs, ...rest } = span;
  return {
    ...rest,
    attributes: structuredClone(span.attributes),
    resourceAttributes: structuredClone(span.resourceAttributes),
    ...(startTimeNs !== undefined ? { startTimeNs: startTimeNs.toString() } : {}),
    ...(endTimeNs !== undefined ? { endTimeNs: endTimeNs.toString() } : {}),
    ...(durationNs !== undefined ? { durationNs: durationNs.toString() } : {}),
  };
}

export function serializeAnalysis(result: AnalysisResult): SerializableAnalysis {
  return {
    ...result,
    spans: result.spans.map(serializeSpan),
    traces: result.traces.map((trace) => {
      const { durationNs, ...rest } = trace;
      return {
        ...rest,
        ...(durationNs !== undefined ? { durationNs: durationNs.toString() } : {}),
      };
    }),
  };
}
