# Roadmap

This roadmap is ordered by validation value, not by feature count. It is not a delivery promise.

## 0.1 — publishable core

- [x] OTLP JSON and JSONL parsing
- [x] GenAI and MCP semantic checks
- [x] topology, privacy, cardinality, and migration checks
- [x] terminal, JSON, SARIF, JUnit, and offline HTML output
- [x] passing and failing synthetic fixtures
- [x] GitHub Action, tests, and public rule documentation

## Evidence before breadth

- [ ] Validate synthetic equivalents of traces from three independent instrumentation libraries.
- [ ] Collect false positives as minimal public fixtures.
- [ ] Measure parser memory and report responsiveness on disclosed generated traces.
- [ ] Publish compatibility notes for the first released OpenTelemetry GenAI convention version.

## Candidate follow-ups

- [ ] Baseline only new findings during staged CI adoption.
- [ ] Compare two traces or rule snapshots during instrumentation upgrades.
- [ ] Accept OTLP protobuf through a separate optional adapter.
- [ ] Provide a collector-side adapter without adding network behavior to the core CLI.
- [ ] Export a compact machine-readable rule-pack manifest for other tools.

Features move into a release only after a real fixture proves the workflow.
