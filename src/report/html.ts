import { CONTENT_ATTRIBUTES } from "../spec.js";
import { serializeAnalysis } from "../serialize.js";
import type { AnalysisResult, Finding, NormalizedSpan, Severity } from "../types.js";

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026");
}

function sensitiveKey(key: string): boolean {
  return CONTENT_ATTRIBUTES.has(key) || /(?:secret|password|passwd|api[_-]?key|authorization|cookie|credential|access[_-]?token|refresh[_-]?token)/i.test(key);
}

function sanitizeAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [key, sensitiveKey(key) ? "[redacted by SpanLint]" : value]),
  );
}

function sanitizedResult(result: AnalysisResult): ReturnType<typeof serializeAnalysis> {
  const serialized = serializeAnalysis(result);
  serialized.spans = serialized.spans.map((span) => ({
    ...span,
    attributes: sanitizeAttributes(span.attributes),
    resourceAttributes: sanitizeAttributes(span.resourceAttributes),
  }));
  return serialized;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function formatDuration(durationNs: bigint | undefined): string {
  if (durationNs === undefined) return "no timing";
  const value = Number(durationNs);
  if (value < 1_000) return `${value} ns`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} μs`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(1)} ms`;
  return `${(value / 1_000_000_000).toFixed(2)} s`;
}

function severityIcon(severity: Severity): string {
  if (severity === "error") return "×";
  if (severity === "warning") return "!";
  return "i";
}

function traceRows(result: AnalysisResult): string {
  const byTrace = new Map<string, NormalizedSpan[]>();
  for (const span of result.spans) {
    const spans = byTrace.get(span.traceId) ?? [];
    spans.push(span);
    byTrace.set(span.traceId, spans);
  }

  return [...byTrace.entries()].map(([traceId, spans]) => {
    const byId = new Map(spans.map((span) => [span.spanId, span]));
    const roots = spans.filter((span) => !span.parentSpanId || !byId.has(span.parentSpanId));
    const children = new Map<string, NormalizedSpan[]>();
    for (const span of spans) {
      if (!span.parentSpanId) continue;
      const list = children.get(span.parentSpanId) ?? [];
      list.push(span);
      children.set(span.parentSpanId, list);
    }
    const starts = spans.flatMap((span) => span.startTimeNs === undefined ? [] : [span.startTimeNs]);
    const ends = spans.flatMap((span) => span.endTimeNs === undefined ? [] : [span.endTimeNs]);
    const min = starts.length ? starts.reduce((a, b) => a < b ? a : b) : 0n;
    const max = ends.length ? ends.reduce((a, b) => a > b ? a : b) : min + 1n;
    const range = max > min ? Number(max - min) : 1;
    const seen = new Set<string>();
    const ordered: Array<{ span: NormalizedSpan; depth: number }> = [];
    const walk = (span: NormalizedSpan, depth: number): void => {
      if (seen.has(span.spanId)) return;
      seen.add(span.spanId);
      ordered.push({ span, depth });
      const nested = (children.get(span.spanId) ?? []).sort((a, b) => Number((a.startTimeNs ?? 0n) - (b.startTimeNs ?? 0n)));
      for (const child of nested) walk(child, depth + 1);
    };
    for (const root of roots.sort((a, b) => Number((a.startTimeNs ?? 0n) - (b.startTimeNs ?? 0n)))) walk(root, 0);
    for (const span of spans) if (!seen.has(span.spanId)) walk(span, 0);

    const rows = ordered.map(({ span, depth }) => {
      const startPct = span.startTimeNs === undefined ? 0 : Math.max(0, Math.min(98, (Number(span.startTimeNs - min) / range) * 100));
      const widthPct = span.durationNs === undefined ? 2 : Math.max(1.5, Math.min(100 - startPct, (Number(span.durationNs) / range) * 100));
      const operation = typeof span.attributes["gen_ai.operation.name"] === "string"
        ? span.attributes["gen_ai.operation.name"]
        : typeof span.attributes["mcp.method.name"] === "string"
          ? span.attributes["mcp.method.name"]
          : "span";
      const attrs = sanitizeAttributes(span.attributes);
      return `<details class="span-row" data-kind="${escapeHtml(span.kind)}">
        <summary>
          <span class="span-main" style="--depth:${depth}">
            <span class="chevron">›</span>
            <span class="kind kind-${escapeHtml(span.kind.toLowerCase())}">${escapeHtml(span.kind)}</span>
            <span class="span-name">${escapeHtml(span.name)}</span>
            <span class="span-id">${escapeHtml(shortId(span.spanId))}</span>
          </span>
          <span class="timeline"><i class="bar bar-${escapeHtml(String(operation).replaceAll(/[^a-z0-9]+/gi, "-"))}" style="left:${startPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%"></i></span>
          <span class="duration">${escapeHtml(formatDuration(span.durationNs))}</span>
        </summary>
        <div class="span-detail">
          <div><b>Trace</b><code>${escapeHtml(span.traceId)}</code></div>
          <div><b>Span</b><code>${escapeHtml(span.spanId)}</code></div>
          <div><b>Scope</b><code>${escapeHtml(span.scopeName ?? "not reported")}</code></div>
          <pre>${escapeHtml(JSON.stringify(attrs, null, 2))}</pre>
        </div>
      </details>`;
    }).join("");

    return `<section class="trace-card">
      <div class="trace-head">
        <div><span class="eyebrow">TRACE</span><strong>${escapeHtml(shortId(traceId))}</strong></div>
        <span>${spans.length} spans · ${escapeHtml(formatDuration(max - min))}</span>
      </div>
      <div class="timeline-ruler"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
      <div class="span-list">${rows}</div>
    </section>`;
  }).join("");
}

function findingRows(findings: Finding[]): string {
  if (findings.length === 0) {
    return `<div class="empty-state"><span>✓</span><strong>No findings</strong><p>This trace passes the selected ruleset.</p></div>`;
  }
  return findings.map((finding) => `<article class="finding" data-severity="${finding.severity}" data-search="${escapeHtml(`${finding.ruleId} ${finding.title} ${finding.message} ${finding.spanName ?? ""}`.toLowerCase())}">
    <div class="severity-icon severity-${finding.severity}">${severityIcon(finding.severity)}</div>
    <div class="finding-copy">
      <div class="finding-title"><code>${escapeHtml(finding.ruleId)}</code><strong>${escapeHtml(finding.title)}</strong><span>${escapeHtml(finding.category)}</span></div>
      <p>${escapeHtml(finding.message)}</p>
      <details><summary>How to fix</summary><p>${escapeHtml(finding.help)}</p>${finding.sourceUrl ? `<a href="${escapeHtml(finding.sourceUrl)}" rel="noreferrer">Pinned convention source ↗</a>` : ""}</details>
      <div class="finding-location">${escapeHtml(finding.spanName ?? "trace")} · ${escapeHtml(shortId(finding.spanId ?? finding.traceId ?? "unknown"))}</div>
    </div>
  </article>`).join("");
}

export function renderHtml(result: AnalysisResult): string {
  const sanitized = sanitizedResult(result);
  const sourceLabel = result.sourceFiles.length ? result.sourceFiles.join(", ") : "in-memory trace";
  const gradeTone = result.summary.score >= 90 ? "good" : result.summary.score >= 60 ? "warn" : "bad";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<link rel="icon" href="data:,">
<title>SpanLint report · ${escapeHtml(sourceLabel)}</title>
<style>
:root{--bg:#080b12;--panel:#0f1420;--panel2:#131a28;--line:#263043;--text:#f4f7fb;--muted:#94a3b8;--cyan:#5ee7f1;--blue:#6c8cff;--purple:#b68cff;--red:#ff6b78;--yellow:#ffc857;--green:#5ce1a4;--shadow:0 28px 70px rgba(0,0,0,.35)}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(900px 500px at 8% -10%,rgba(108,140,255,.18),transparent 60%),radial-gradient(800px 480px at 92% 0,rgba(94,231,241,.11),transparent 55%),var(--bg);color:var(--text);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;min-height:100vh}
button,input{font:inherit}.shell{max-width:1440px;margin:auto;padding:28px}.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:34px}.brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:20px;letter-spacing:-.03em}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(94,231,241,.45);border-radius:12px;background:linear-gradient(145deg,rgba(94,231,241,.18),rgba(108,140,255,.14));box-shadow:0 0 28px rgba(94,231,241,.12)}.brand-mark svg{width:24px;height:24px}.spec-pill{color:var(--muted);border:1px solid var(--line);padding:8px 12px;border-radius:999px;background:rgba(15,20,32,.72);font-size:12px}
.hero{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr);gap:24px;margin-bottom:24px}.hero-main,.score-card,.panel,.trace-card{border:1px solid var(--line);background:linear-gradient(150deg,rgba(19,26,40,.94),rgba(12,16,26,.94));box-shadow:var(--shadow)}.hero-main{border-radius:22px;padding:34px;position:relative;overflow:hidden}.hero-main:after{content:"";position:absolute;width:280px;height:280px;border-radius:50%;background:rgba(108,140,255,.12);filter:blur(20px);right:-110px;top:-140px}.eyebrow{font-size:10px;letter-spacing:.17em;color:var(--cyan);font-weight:800}.hero h1{font-size:clamp(30px,4vw,54px);line-height:1.02;letter-spacing:-.055em;margin:12px 0 15px;max-width:780px}.hero p{color:var(--muted);font-size:16px;max-width:700px;margin:0}.source{display:flex;gap:10px;align-items:center;margin-top:24px;color:#cbd5e1}.source code{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text)}
.score-card{border-radius:22px;padding:28px;display:grid;grid-template-columns:1fr auto;align-items:center;gap:18px}.score-ring{--score:${result.summary.score};width:138px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;background:conic-gradient(${gradeTone === "good" ? "var(--green)" : gradeTone === "warn" ? "var(--yellow)" : "var(--red)"} calc(var(--score)*1%),#20293a 0);position:relative}.score-ring:after{content:"";position:absolute;inset:10px;background:var(--panel);border-radius:50%}.score-value{position:relative;z-index:1;text-align:center}.score-value strong{display:block;font-size:38px;line-height:1;letter-spacing:-.06em}.score-value span{font-size:11px;color:var(--muted)}.grade{font-size:12px;color:var(--muted)}.grade strong{display:block;color:var(--text);font-size:52px;line-height:1}.counts{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.count{border:1px solid var(--line);border-radius:12px;padding:10px;text-align:center;background:#0b101a}.count b{display:block;font-size:18px}.count.error b{color:var(--red)}.count.warning b{color:var(--yellow)}.count.info b{color:var(--cyan)}
.tabs{display:flex;gap:8px;margin:24px 0 14px}.tab{border:1px solid var(--line);background:rgba(15,20,32,.72);color:var(--muted);padding:9px 14px;border-radius:10px;cursor:pointer}.tab.active{color:var(--text);border-color:#536480;background:#182133}.view{display:none}.view.active{display:block}.layout{display:grid;grid-template-columns:minmax(0,1.12fr) minmax(340px,.88fr);gap:20px}.panel{border-radius:18px;overflow:hidden}.panel-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--line)}.panel-head h2{font-size:15px;margin:0}.panel-head span{color:var(--muted);font-size:12px}.trace-card{border-radius:16px;overflow:hidden;margin-bottom:16px}.trace-head{display:flex;justify-content:space-between;align-items:center;padding:15px 17px;border-bottom:1px solid var(--line);color:var(--muted);font-size:12px}.trace-head div{display:flex;align-items:center;gap:10px}.trace-head strong{color:var(--text);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}.timeline-ruler{display:grid;grid-template-columns:repeat(5,1fr);text-align:right;padding:9px 84px 7px 46%;font-size:9px;color:#64748b;border-bottom:1px solid rgba(38,48,67,.6)}
.span-row{border-bottom:1px solid rgba(38,48,67,.55)}.span-row summary{list-style:none;display:grid;grid-template-columns:minmax(300px,46%) 1fr 72px;align-items:center;min-height:47px;cursor:pointer}.span-row summary::-webkit-details-marker{display:none}.span-main{display:flex;align-items:center;gap:8px;padding-left:calc(12px + var(--depth)*18px);min-width:0}.chevron{font-size:20px;color:#64748b;transition:.2s}.span-row[open] .chevron{transform:rotate(90deg)}.kind{font-size:8px;font-weight:800;letter-spacing:.06em;border:1px solid #39455a;color:#9fb0c8;border-radius:5px;padding:2px 4px;flex:none}.kind-client{color:var(--cyan);border-color:rgba(94,231,241,.35)}.kind-server{color:var(--purple);border-color:rgba(182,140,255,.4)}.kind-internal{color:var(--green);border-color:rgba(92,225,164,.34)}.span-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:650}.span-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;color:#64748b}.timeline{position:relative;height:25px;border-left:1px solid rgba(100,116,139,.25);background:repeating-linear-gradient(90deg,transparent 0,transparent calc(25% - 1px),rgba(100,116,139,.12) 25%)}.bar{position:absolute;height:9px;top:8px;border-radius:999px;background:linear-gradient(90deg,var(--blue),var(--cyan));box-shadow:0 0 16px rgba(94,231,241,.18)}.bar-execute-tool,.bar-tools-call{background:linear-gradient(90deg,var(--purple),#e48cff)}.bar-invoke-agent{background:linear-gradient(90deg,var(--green),var(--cyan))}.duration{text-align:right;padding-right:13px;color:var(--muted);font-variant-numeric:tabular-nums;font-size:11px}.span-detail{margin:0 14px 14px;padding:14px;border:1px solid var(--line);border-radius:11px;background:#090d15;color:var(--muted)}.span-detail>div{display:grid;grid-template-columns:56px 1fr;gap:8px;margin:4px 0}.span-detail code{color:#d7e0ec;overflow-wrap:anywhere}.span-detail pre{overflow:auto;max-height:260px;padding:12px;border-radius:8px;background:#060910;color:#a9b8cc;font-size:11px}.empty-state{padding:70px 20px;text-align:center;color:var(--muted)}.empty-state span{display:grid;place-items:center;margin:0 auto 12px;width:50px;height:50px;border-radius:50%;background:rgba(92,225,164,.12);color:var(--green);font-size:26px}.empty-state strong{display:block;color:var(--text);font-size:18px}
.finding-tools{display:flex;gap:8px;padding:14px;border-bottom:1px solid var(--line);flex-wrap:wrap}.filter{border:1px solid var(--line);color:var(--muted);background:#0b101a;padding:7px 10px;border-radius:8px;cursor:pointer;font-size:12px}.filter.active{background:#1c2638;color:var(--text);border-color:#52617a}.search{min-width:160px;flex:1;border:1px solid var(--line);background:#090d15;color:var(--text);padding:7px 10px;border-radius:8px;outline:none}.search:focus{border-color:var(--blue)}.finding{display:grid;grid-template-columns:30px 1fr;gap:12px;padding:17px;border-bottom:1px solid rgba(38,48,67,.65)}.finding.hidden{display:none}.severity-icon{display:grid;place-items:center;width:26px;height:26px;border-radius:8px;font-weight:900}.severity-error{color:var(--red);background:rgba(255,107,120,.12);border:1px solid rgba(255,107,120,.26)}.severity-warning{color:var(--yellow);background:rgba(255,200,87,.1);border:1px solid rgba(255,200,87,.23)}.severity-info{color:var(--cyan);background:rgba(94,231,241,.09);border:1px solid rgba(94,231,241,.22)}.finding-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.finding-title code{color:var(--cyan);font-weight:800;font-size:11px}.finding-title span{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#77879d}.finding-copy>p{color:#c4cfdd;margin:7px 0}.finding-copy details{color:var(--muted);font-size:12px}.finding-copy details summary{cursor:pointer;color:#9fb0c8}.finding-copy details p{margin:7px 0}.finding-copy a{color:var(--cyan);text-decoration:none}.finding-location{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;color:#64748b;margin-top:9px}.about{padding:28px;max-width:900px}.about h2{font-size:26px;margin:0 0 12px}.about p,.about li{color:var(--muted)}.about code{color:var(--cyan)}.footer{display:flex;justify-content:space-between;gap:20px;color:#66758b;font-size:11px;margin-top:24px;padding:15px 2px}.footer a{color:#92a4bd}
@media(max-width:1000px){.hero,.layout{grid-template-columns:1fr}.score-card{grid-template-columns:auto 1fr}.timeline-ruler{padding-left:40%}.span-row summary{grid-template-columns:minmax(250px,40%) 1fr 68px}}@media(max-width:680px){.shell{padding:16px}.topbar{align-items:flex-start;gap:12px}.spec-pill{display:none}.hero-main{padding:24px}.score-card{grid-template-columns:1fr auto}.layout{display:block}.layout>.panel{margin-bottom:16px}.span-row summary{grid-template-columns:1fr 62px}.timeline{display:none}.timeline-ruler{display:none}.span-main{padding-left:calc(8px + var(--depth)*10px)}.span-id{display:none}.footer{display:block}}
</style>
</head>
<body>
<main class="shell">
  <header class="topbar">
    <div class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16M4 12h10M4 19h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="17" cy="12" r="3" fill="#5ee7f1"/></svg></span>SpanLint</div>
    <div class="spec-pill">Ruleset ${escapeHtml(result.ruleset.version)} · pinned ${escapeHtml(result.ruleset.sourceUpdatedAt)}</div>
  </header>
  <section class="hero">
    <div class="hero-main">
      <span class="eyebrow">AGENT TRACE HEALTH</span>
      <h1>See the telemetry gaps<br>before production does.</h1>
      <p>Deterministic conformance, topology, privacy, cardinality, and migration checks for OpenTelemetry GenAI and MCP traces.</p>
      <div class="source"><span>Input</span><code>${escapeHtml(sourceLabel)}</code></div>
    </div>
    <aside class="score-card">
      <div class="score-ring"><div class="score-value"><strong>${result.summary.score}</strong><span>out of 100</span></div></div>
      <div class="grade">Trace grade<strong>${result.summary.grade}</strong></div>
      <div class="counts">
        <div class="count error"><b>${result.summary.errors}</b>errors</div>
        <div class="count warning"><b>${result.summary.warnings}</b>warnings</div>
        <div class="count info"><b>${result.summary.infos}</b>notices</div>
      </div>
    </aside>
  </section>
  <nav class="tabs" aria-label="Report sections">
    <button class="tab active" data-view="overview">Overview</button>
    <button class="tab" data-view="about">Ruleset & safety</button>
  </nav>
  <section class="view active" id="view-overview">
    <div class="layout">
      <div>${traceRows(result)}</div>
      <section class="panel">
        <div class="panel-head"><h2>Findings</h2><span id="visible-count">${result.findings.length} visible</span></div>
        <div class="finding-tools">
          <button class="filter active" data-severity="all">All ${result.findings.length}</button>
          <button class="filter" data-severity="error">Errors ${result.summary.errors}</button>
          <button class="filter" data-severity="warning">Warnings ${result.summary.warnings}</button>
          <button class="filter" data-severity="info">Notices ${result.summary.infos}</button>
          <input class="search" id="finding-search" type="search" placeholder="Filter rules or spans" aria-label="Filter findings">
        </div>
        <div id="findings">${findingRows(result.findings)}</div>
      </section>
    </div>
  </section>
  <section class="view" id="view-about">
    <section class="panel about">
      <span class="eyebrow">TRANSPARENT BY DESIGN</span>
      <h2>What this report does—and does not—prove</h2>
      <p>SpanLint targets a pinned development snapshot of the OpenTelemetry GenAI and MCP semantic conventions. Required-attribute checks are separated from recommended quality checks. The score subtracts 15 points per error, 5 per warning, and 1 per notice, with a floor of zero.</p>
      <ul>
        <li>It does not call a model, upload a trace, or claim official OpenTelemetry certification.</li>
        <li>Opt-in message, prompt, tool, retrieval, and memory content is redacted from this HTML file.</li>
        <li>Secrets-like attribute names are also redacted. Review access control and retention before sharing any trace.</li>
        <li>Convention development can move. Upgrade SpanLint deliberately and review its pinned ruleset.</li>
      </ul>
      <p><a href="${escapeHtml(result.ruleset.sourceUrl)}" rel="noreferrer">Inspect the exact convention snapshot ↗</a></p>
    </section>
  </section>
  <footer class="footer"><span>Generated ${escapeHtml(result.generatedAt)} · fully offline HTML</span><span>${escapeHtml(result.ruleset.disclaimer)}</span></footer>
</main>
<script>window.__SPANLINT_REPORT__=${safeJson(sanitized)};
(()=>{let severity="all";const cards=[...document.querySelectorAll(".finding")],search=document.querySelector("#finding-search"),count=document.querySelector("#visible-count");const apply=()=>{const q=search.value.trim().toLowerCase();let visible=0;for(const card of cards){const show=(severity==="all"||card.dataset.severity===severity)&&(!q||card.dataset.search.includes(q));card.classList.toggle("hidden",!show);if(show)visible++}count.textContent=visible+" visible"};for(const button of document.querySelectorAll(".filter")){button.addEventListener("click",()=>{for(const item of document.querySelectorAll(".filter"))item.classList.remove("active");button.classList.add("active");severity=button.dataset.severity;apply()})}search.addEventListener("input",apply);for(const tab of document.querySelectorAll(".tab")){tab.addEventListener("click",()=>{for(const item of document.querySelectorAll(".tab"))item.classList.remove("active");for(const view of document.querySelectorAll(".view"))view.classList.remove("active");tab.classList.add("active");document.querySelector("#view-"+tab.dataset.view).classList.add("active")})}})();</script>
</body>
</html>`;
}
