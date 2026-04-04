import test from "node:test";
import assert from "node:assert/strict";
import { CLIENT_DEFAULTS_QUERY, CURRENT_ACCOUNT_QUERY, CURRENT_USER_QUERY, JobberApiClient } from "../src/jobber-api.js";

test("graphql sends cookie and version headers", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ data: { ok: true } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const client = new JobberApiClient({
      cookieHeader: "session=abc123",
      graphqlVersion: "2026-03-10",
      apiUrl: "https://api.getjobber.com/api/graphql?location=j",
    });
    await client.graphql({ operationName: "TestQuery", query: "query TestQuery { ok }", variables: { x: 1 } });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.getjobber.com/api/graphql?location=j");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.cookie, "session=abc123");
    assert.equal(headers["x-jobber-graphql-version"], "2026-03-10");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("validateAuth uses the recovered ClientDefaults query", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    assert.equal(body.operationName, "ClientDefaults");
    assert.equal(body.query, CLIENT_DEFAULTS_QUERY);
    return new Response(
      JSON.stringify({
        data: {
          clientCustomFields: { nodes: [] },
          propertyCustomFields: { nodes: [] },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const client = new JobberApiClient({ cookieHeader: "session=abc123" });
    const auth = await client.validateAuth();
    assert.equal(auth.ok, true);
    assert.equal(auth.customFieldCounts.client, 0);
    assert.equal(auth.customFieldCounts.property, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("whoami uses recovered current user and account queries", async () => {
  const queries: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || "{}"));
    queries.push(body.query);

    if (body.operationName === "getCurrentUserQueryData") {
      return new Response(
        JSON.stringify({
          data: {
            user: {
              id: "usr_123",
              fullName: "Test User",
              isOwner: true,
              isAdmin: true,
              email: { raw: "test@example.com", isValid: true },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    if (body.operationName === "CurrentAccount") {
      return new Response(
        JSON.stringify({
          data: {
            account: {
              id: "acct_123",
              name: "Test Account",
              createdAt: "2026-01-01T00:00:00Z",
              inTrial: true,
              industry: "HVAC",
              tester: false,
              settings: {
                calendar: { calendarFirstDay: "MONDAY" },
                localization: { countryCode: "US", languageCode: "en" },
              },
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ errors: [{ message: "unexpected operation" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const client = new JobberApiClient({ cookieHeader: "session=abc123" });
    const whoami = await client.whoami();
    assert.equal(whoami.user.fullName, "Test User");
    assert.equal(whoami.account.name, "Test Account");
    assert.ok(queries.includes(CURRENT_USER_QUERY));
    assert.ok(queries.includes(CURRENT_ACCOUNT_QUERY));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
