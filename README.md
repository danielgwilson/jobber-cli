# jobber-cli

Agent-first private-surface CLI for Jobber.

This package is intentionally v0:

- browser-assisted auth bootstrap
- raw GraphQL execution
- current user / account identity checks
- generated operation inventory from authenticated frontend bundles
- read-first defaults

## Agent Quickstart

From a live logged-in Jobber browser session on the same machine:

```bash
jobber auth import-agent-browser
jobber doctor --json
jobber whoami --json
jobber operations list --search client --json
```

For raw one-off GraphQL without creating temp files:

```bash
jobber graphql run \
  --operation-name CurrentAccount \
  --query 'query CurrentAccount { account { id name inTrial industry } }' \
  --json
```

## Install

Local:

```bash
git clone https://github.com/danielgwilson/jobber-cli.git
cd jobber-cli
npm install
npm link
```

Global:

```bash
npm install -g jobber-cli
```

## Auth

Preferred from a live logged-in `agent-browser` session:

```bash
jobber auth import-agent-browser
jobber auth status --json
```

Manual auth:

```bash
printf '%s' "$JOBBER_COOKIE_HEADER" | jobber auth set-cookie-header --stdin
jobber auth status --json
```

Saved config lives at `~/.config/jobber/config.json` with `0600` permissions.

Supported env vars:

- `JOBBER_COOKIE_HEADER`
- `JOBBER_GRAPHQL_VERSION`
- `JOBBER_API_URL`

## Skill Install

This repo includes both a root `SKILL.md` and a nested `skills/jobber/SKILL.md` so external installers and repo-based skill flows have an obvious entry point.

## Main Commands

```bash
jobber doctor --json
jobber whoami --json
jobber auth status --json
jobber operations list --json
jobber operations list --search client --json
jobber operations inspect ClientDefaults --json
jobber graphql run --operation-name CurrentAccount --query 'query CurrentAccount { account { id name inTrial industry } }' --json
jobber graphql run --query-file ./query.graphql --variables-file ./vars.json --json
```

## Notes

- This adapter depends on Jobber's private web surface and is therefore fragile.
- `operations list` is a discovered inventory, not a guarantee that every operation has a recovered query document yet.
- `graphql run` is intentionally generic so new workflows can be tested before typed subcommands are added.
- `auth import-agent-browser` assumes a live authenticated `agent-browser` session or attached browser on the same machine.
