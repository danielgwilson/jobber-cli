---
name: jobber
description: |
  Use this skill whenever you need to inspect or operate Jobber through the local `jobber` CLI.
  Typical uses include validating auth, identifying the current Jobber user/account, browsing discovered operations,
  and running raw GraphQL against Jobber's private web API.
---

# Jobber

Use this skill whenever you need to inspect or operate Jobber through the local `jobber` CLI.

Important naming detail:

- npm package name: `jobber-cli`
- CLI binary name: `jobber`

Resolution order:

1. If `jobber` is already on `$PATH`, use it directly.
2. Otherwise run the published package explicitly with `npx -y jobber-cli <args>`.

Do not guess alternate package names unless they are explicitly published later.

## Default workflow

- If auth is missing, run `jobber auth import-agent-browser`
- Sanity check auth: `jobber doctor --json`
- Check current identity: `jobber whoami --json`
- Browse operation inventory: `jobber operations list --search client --json`
- Inspect one operation: `jobber operations inspect ClientDefaults --json`
- Run raw GraphQL when needed: `jobber graphql run --query-file ./query.graphql --variables-file ./vars.json --json`

## Auth

Preferred from a live logged-in browser session:

- `jobber auth import-agent-browser`

Other supported paths:

- `printf '%s' "$JOBBER_COOKIE_HEADER" | jobber auth set-cookie-header --stdin`
- `JOBBER_COOKIE_HEADER=... jobber doctor --json`

Avoid pasting full cookie headers into logs or chat.

## Constraints

- This is a private-surface adapter and is therefore fragile by definition.
- Prefer read operations before mutations.
- `operations list` is a discovered inventory, not a guarantee that every operation has a recovered query document.
- Use `graphql run` to prototype unsupported workflows before adding typed commands.
