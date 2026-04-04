import test from "node:test";
import assert from "node:assert/strict";
import { redactCookieHeader } from "../src/config.js";

test("redactCookieHeader masks cookie values", () => {
  const redacted = redactCookieHeader("session=abcdefghijklmnopqrstuvwxyz; short=1234");
  assert.match(redacted, /session=abcd…wxyz/);
  assert.match(redacted, /short=\*\*\*\*/);
});
