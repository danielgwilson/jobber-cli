# Jobber CLI Contract v1

- JSON envelopes on stdout when `--json` is used
- progress and human guidance on stderr
- explicit auth posture
- read-first behavior by default
- raw GraphQL execution available for unsupported workflows

Error shape:

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_MISSING",
    "message": "No Jobber auth configured.",
    "retryable": false
  }
}
```
