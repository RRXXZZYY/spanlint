# Demo guide

Generate the bundled safe demo:

```bash
npm run demo
```

Open `spanlint-demo.html` in a browser. The file contains only synthetic service, trace, and content values.

The demo tells a short story:

1. The trace score makes the broken state visible.
2. The timeline shows two model/tool operations plus a detached tool.
3. Findings explain missing model identity, legacy token fields, an incoherent MCP transport, broken parentage, opt-in content, and high-cardinality names.
4. The “Ruleset & safety” tab explains scoring and report boundaries.
5. `examples/valid-agent.otlp.json` shows the corrected A-grade shape.

Terminal comparison:

```bash
node dist/src/cli.js examples/broken-agent.otlp.json --no-color
node dist/src/cli.js examples/valid-agent.otlp.json --strict --no-color
```

The demo is not a performance benchmark and does not call any external service.
