# Contributing

Small, evidence-backed contributions are welcome.

## Start here

```bash
npm install
npm test
```

For a rule change, include:

1. one minimal synthetic fixture or focused unit test;
2. the expected rule ID and severity;
3. an immutable upstream source when the rule derives from a convention;
4. a note saying whether it is required, recommended, or a SpanLint heuristic.

Do not submit real production traces, prompts, credentials, internal URLs, customer data, or proprietary instrumentation output.

## Pull-request checklist

- `npm test` passes on Node.js 20+.
- `npm run check` passes.
- `npm run demo` still produces a readable offline report.
- User-visible behavior is documented.
- No runtime dependency is added without a clear reason and license review.

Please keep generated changes narrow. Broad formatting rewrites make rule review harder.
