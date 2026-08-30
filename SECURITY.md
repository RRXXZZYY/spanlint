# Security policy

## Supported versions

Security fixes are applied to the latest released minor version.

## Reporting a vulnerability

Please use GitHub's private security-advisory flow for vulnerabilities. Do not include real prompts, credentials, production trace payloads, or private service names. A minimal synthetic fixture is preferred.

## Trace handling boundary

The SpanLint CLI reads local files and does not make network requests. HTML reports redact known opt-in content and secrets-like keys, but custom attributes may still contain sensitive data. Treat reports as derived trace data and review them before sharing.

Generated HTML does not load remote scripts, styles, fonts, or images. Values are escaped before entering markup or embedded JSON. If you find a rendering escape or redaction bypass, report it privately.
