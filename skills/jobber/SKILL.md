# Jobber

Use this skill whenever you need to inspect or operate Jobber through the local `jobber` CLI.

Typical uses:

- inspect discovered Jobber operations
- run raw GraphQL queries against Jobber
- validate Jobber auth
- bootstrap auth from a live `agent-browser` session
- prototype new Jobber workflows before adding typed commands

Suggested workflow:

1. `jobber doctor --json`
2. `jobber operations list --search <term> --json`
3. `jobber operations inspect <name> --json`
4. `jobber graphql run ... --json`

Notes:

- This adapter is private-surface and fragile by definition.
- Prefer read operations before mutations.
- If auth is missing, use `jobber auth import-agent-browser` while a logged-in Jobber browser session is open.
