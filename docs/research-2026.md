# Why SpanLint: 2026 direction research

Snapshot date: 2026-08-30.

This document records the decision that preceded the code. Ratings are product judgment on a five-point scale, not measured market size or promised GitHub performance.

## Market signals

The strongest employment signal is not “can build a chatbot.” It is “can make AI systems observable, reliable, secure, and operable.”

- The World Economic Forum lists AI and big data, networks and cybersecurity, and technological literacy as the three fastest-growing skill groups through 2030. Its jobs outlook also places big-data specialists, AI/ML specialists, and software developers among the fastest-growing roles. Sources: [skills outlook](https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/3-skills-outlook/) and [jobs outlook](https://www.weforum.org/publications/the-future-of-jobs-report-2025/in-full/2-jobs-outlook/).
- LinkedIn's 2026 Jobs on the Rise analysis highlights AI engineers across European markets, with common skills including LLMs, machine learning, deep learning, and PyTorch. Source: [LinkedIn News Europe](https://www.linkedin.com/pulse/linkedin-jobs-rise-2026-fastest-growing-roles-europe-gabvc/).
- OpenAI's current Software Engineer, Observability role explicitly combines distributed logging, time-series and trace storage, AI-native debugging tools, and product UI; the listed US compensation is $255K–$405K plus equity. Source: [OpenAI Careers](https://openai.com/careers/software-engineer-observability-san-francisco/).
- Anthropic's current careers catalog includes AI reliability, observability, developer productivity, research infrastructure, data infrastructure, inference, and agent runtime roles. Source: [Anthropic Careers](https://www.anthropic.com/careers/jobs).

The open-source signal points in the same direction:

- GitHub's 2025 Octoverse reports 4.3 million AI projects, more than 1.1 million public repositories using an LLM SDK, and TypeScript becoming GitHub's most-used language. Source: [GitHub Octoverse](https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/).
- CNCF's 2025 annual report says OpenTelemetry commits rose 39% and its contributor base grew from 1,301 to 1,756, making it CNCF's second-largest project by the report's measure. Source: [CNCF Annual Report 2025](https://www.cncf.io/wp-content/uploads/2026/03/cncf_ar25_033126a.pdf).
- The MCP roadmap names audit trails, observability, conformance suites, enterprise security, and gateway behavior as priority work. The August 2026 update also reflects the 2026-07-28 stateless/HTTP-native protocol shift. Sources: [MCP roadmap](https://modelcontextprotocol.io/development/roadmap) and [August 2026 roadmap update](https://blog.modelcontextprotocol.io/posts/mcp-roadmap/).
- OpenTelemetry now maintains dedicated GenAI semantic conventions for inference, agents, workflows, tools, evaluations, and MCP. The conventions are still under active development, which makes versioned validation useful. Source: [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai).

## Direction comparison

| Direction | Hiring relevance | 2–4 week strong demo | Differentiation room | Open-source shareability | Main constraint |
| --- | :---: | :---: | :---: | :---: | --- |
| AI inference infrastructure | 5 | 1 | 2 | 4 | credible work needs GPUs, load testing, and systems depth beyond a short MVP |
| Generic Agent/MCP tools | 4 | 5 | 1 | 5 | severe wrapper, directory, server, and inspector saturation |
| Full observability/evaluation platform | 5 | 2 | 2 | 4 | mature projects already cover storage, dashboards, datasets, and eval workflows |
| Developer tooling | 4 | 5 | 4 | 5 | must solve a repeated workflow, not just produce another static checklist |
| Data infrastructure | 5 | 2 | 2 | 3 | useful differentiation usually needs connectors, real workloads, and long validation |
| **Trace-quality CI at the intersection** | **5** | **5** | **4** | **5** | conventions evolve, so rules must be explicit and version-pinned |

### Why not AI infrastructure

Inference engines, schedulers, serving runtimes, and GPU observability are excellent career signals, but a defensible project needs hardware access and honest throughput/latency evaluation. A small repository that only wraps an existing engine would add little.

### Why not another MCP server or inspector

The ecosystem already has the official [MCP Inspector](https://github.com/modelcontextprotocol/inspector), large server catalogs, gateways, security scanners, and many generic testing CLIs. Another server or chat UI would be fast to build but hard to distinguish.

### Why not a complete LLM observability platform

Projects such as [Langfuse](https://github.com/langfuse/langfuse), [MLflow](https://github.com/mlflow/mlflow), and [Opik](https://github.com/comet-ml/opik) already provide broad tracing, evaluation, prompt, dataset, and dashboard workflows. Rebuilding their storage and UI surface in a month would optimize for breadth rather than a sharp user problem.

### Why not data contracts

Data contracts and lineage remain valuable, but established specifications and engines already occupy the obvious surfaces. Demonstrating production-grade value would require warehouse adapters and real pipeline fixtures, reducing the time available for product polish.

## Selected wedge

**SpanLint is a small deterministic gate between instrumentation and an observability backend.**

Target users:

1. AI platform engineers instrumenting model and agent runtimes.
2. Observability/SRE teams standardizing GenAI telemetry across services.
3. MCP SDK, client, server, and gateway maintainers.
4. Library authors who need conformance fixtures before releasing instrumentation.

The job-to-be-done is concrete: “Given the trace my system already exports, tell me what will make it hard to debug, aggregate, migrate, or share—and fail CI when required.”

## Differentiation

- **Post-export, vendor-neutral:** no SDK wrapper and no backend replacement.
- **Deterministic:** no LLM judge, API key, or stochastic result.
- **Version-pinned:** findings link to the exact upstream convention snapshot.
- **Structure-aware:** checks parentage, timing, agent/tool topology, and double instrumentation—not only attribute presence.
- **Shareable output:** one self-contained HTML file plus SARIF, JUnit, JSON, and terminal gates.
- **Privacy-aware:** opt-in content and secrets-like attribute keys are redacted from HTML.
- **Honest boundary:** required conformance, recommended quality, and project scoring are clearly separated.

## Minimum publishable scope

The first release is intentionally narrow:

- OTLP JSON/JSONL ingestion;
- GenAI inference, agent, workflow, plan, tool, and MCP span recognition;
- a compact rule pack with explainable fixes;
- deterministic exit codes;
- terminal, JSON, SARIF, JUnit, and offline HTML output;
- synthetic passing and failing traces;
- tests, GitHub Action, documentation, and a visual demo.

It does not ingest live OTLP traffic, run an observability backend, evaluate model quality, call production tools, or claim security certification.

## Propagation hooks

Potential is not a forecast. The launch surface is designed around artifacts developers can verify and share:

1. `npx ... demo` creates the visual report without an account or API key.
2. A “broken trace → exact rule → fixed A-grade trace” story is understandable in one screenshot.
3. SARIF makes findings native to GitHub code scanning.
4. Stable rule IDs make issues and instrumentation fixes linkable.
5. Synthetic fixtures let maintainers reproduce behavior without exposing production prompts.
6. The project can accept small, high-signal contributions: one fixture and one rule.

## Next validation milestones

1. Validate fixtures from at least three independent instrumentation libraries.
2. Add rule-pack snapshots for released OpenTelemetry GenAI versions when upstream publishes them.
3. Test large-trace memory and report responsiveness with generated, disclosed fixtures.
4. Add a baseline mode only after real CI feedback proves the workflow is needed.
5. Contribute clarified ambiguities or reference scenarios upstream rather than silently inventing semantics.
