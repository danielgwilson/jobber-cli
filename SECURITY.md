# Security

- Do not paste live Jobber cookies, session identifiers, account URLs with sensitive params, or exported browser artifacts into issues, PRs, or logs.
- Prefer `JOBBER_COOKIE_HEADER`, `jobber auth set-cookie-header --stdin`, or `jobber auth import-agent-browser`.
- Never pass secrets via CLI flags.
- Do not commit raw HAR files, browser traces, cookie dumps, or similar auth-bearing captures.
- Treat all private-surface Jobber responses as potentially sensitive until explicitly sanitized.
