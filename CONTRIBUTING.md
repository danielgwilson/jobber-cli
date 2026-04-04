# Contributing

## Local development

```bash
npm install
npm run lint
npm test
```

## Principles

- Keep the CLI agent-first and JSON-first
- Keep private-surface assumptions explicit
- Prefer safe read paths before adding mutations
- Never commit live auth or raw browser captures
