# Rule reference

Ruleset: `2026.08`, targeting OpenTelemetry GenAI semantic conventions commit [`67dff02`](https://github.com/open-telemetry/semantic-conventions-genai/commit/67dff024110be5bd9f318006e733f4078e0f4c97).

`error` findings represent required fields, internally inconsistent data, or broken topology. `warning` findings cover recommended conventions and strong operational risks. `info` records visible opt-in content under the default privacy policy.

| Rule | Default | Category | Meaning |
| --- | --- | --- | --- |
| `GEN001` | error | conformance | recognized GenAI span lacks `gen_ai.operation.name` |
| `GEN002` | warning | quality | operation is outside the pinned well-known set |
| `GEN003` | error | conformance | tool execution lacks `gen_ai.tool.name` |
| `GEN004` | warning | quality | span name does not follow the operation's low-cardinality pattern |
| `GEN005` | warning | quality | span kind is inconsistent with the represented operation |
| `GEN006` | warning | quality | inference lacks request and response model identity |
| `GEN007` | warning | quality | recommended token usage is incomplete |
| `GEN008` | error | conformance | token value is invalid or a breakdown exceeds its total |
| `GEN009` | warning | migration | legacy attribute has a current replacement |
| `MCP001` | error | conformance | MCP span lacks `mcp.method.name` |
| `MCP002` | warning | quality | MCP span name is not method plus optional low-cardinality target |
| `MCP003` | warning | quality | negotiated `mcp.protocol.version` is absent |
| `MCP004` | error | conformance | transport and protocol attributes conflict |
| `MCP005` | warning | structure | nested spans appear to duplicate one tool execution |
| `STR001` | error | structure | parent span is absent from the trace export |
| `STR002` | error/warning | structure | timestamp order is impossible or child interval is outside parent |
| `STR003` | error | structure | trace ID and span ID pair is duplicated |
| `STR004` | warning | structure | tool span is detached from an agent span in the same trace |
| `ERR001` | error | conformance | failed operation lacks low-cardinality `error.type` |
| `PRIV001` | info/warning | privacy | an opt-in content attribute is captured |
| `CARD001` | warning | cardinality | span name includes a URL or request-specific identifier |

## Severity policy

`--strict` changes the CI gate, not rule severities: warnings still render as warnings but produce exit code 1.

`--privacy strict` promotes `PRIV001` from info to warning. `--privacy off` suppresses the finding, but HTML values remain redacted.

## False positives and incomplete traces

OpenTelemetry allows documented system-specific naming, and distributed exports can be partial. SpanLint therefore treats naming differences as warnings. Missing parents are errors because topology analysis cannot be trusted without them; if partial exports are intentional, lint the complete batch intended for evaluation or post-process findings under your own policy.

Open an issue with a minimal synthetic fixture when a rule conflicts with a legitimate convention-compliant trace.
