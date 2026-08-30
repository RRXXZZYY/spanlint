# Repository instructions

These instructions apply to the entire repository.

## Validate changes

Run:

```bash
npm test
npm run check
```

When the report renderer changes, also run `npm run demo` and inspect the offline HTML at desktop and narrow viewport widths.

## Rule changes

- Keep every rule deterministic and independently explainable.
- State whether behavior comes from an upstream requirement, an upstream recommendation, or a SpanLint heuristic.
- Pin convention-derived links to an immutable commit or release.
- Add a minimal synthetic fixture or focused unit test.
- Never add real prompts, credentials, production traces, private URLs, or customer data.

## Distribution

SpanLint intentionally has zero runtime dependencies. Explain any proposed runtime package and its license/supply-chain tradeoff before adding it.

`dist/` is committed for GitHub Action and `npx github:` use. Rebuild it after source changes and confirm `git diff --exit-code -- dist` is clean in CI.
