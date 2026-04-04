#!/usr/bin/env node
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { createInterface } from "node:readline/promises";
import { stdin as input, stderr as output } from "node:process";
import { Command } from "commander";
import { clearConfig, CONFIG_PATH, DEFAULT_API_URL, DEFAULT_GRAPHQL_VERSION, readConfig, redactCookieHeader, resolveConfig, saveCookieHeader } from "./config.js";
import { importCookiesFromAgentBrowser, validateAuth } from "./auth.js";
import { JobberApiClient, JobberApiError } from "./jobber-api.js";
import { fail, makeError, ok, printJson } from "./output.js";
import { OPERATION_INDEX, type OperationInventoryItem } from "./generated/operation-index.js";

type JsonOption = { json?: boolean };

function getCliVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../package.json") as { version?: unknown };
    return typeof pkg?.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonInput(filePath?: string, inline?: string): Promise<Record<string, unknown>> {
  if (inline?.trim()) return JSON.parse(inline) as Record<string, unknown>;
  if (!filePath) return {};
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function readQuery(filePath?: string, inline?: string): Promise<string> {
  if (inline?.trim()) return inline.trim();
  if (filePath) return (await fs.readFile(filePath, "utf8")).trim();
  throw new Error("Provide --query or --query-file");
}

async function promptForCookieHeader(): Promise<string> {
  const rl = createInterface({ input, output, terminal: true });
  try {
    process.stderr.write(`Saving to ${CONFIG_PATH}\n`);
    return (await rl.question("Jobber cookie header: ")).trim();
  } finally {
    rl.close();
  }
}

function listOperations(search?: string): OperationInventoryItem[] {
  const needle = search?.trim().toLowerCase();
  if (!needle) return OPERATION_INDEX;
  return OPERATION_INDEX.filter((item) => {
    return item.name.toLowerCase().includes(needle) || item.files.some((file) => file.url.toLowerCase().includes(needle));
  });
}

async function requireClient(json?: boolean): Promise<JobberApiClient> {
  const config = await resolveConfig();
  try {
    return JobberApiClient.fromConfig(config);
  } catch (error: any) {
    const envelope = fail(makeError(error, { code: "AUTH_MISSING", message: "No Jobber auth configured. Run `jobber auth import-agent-browser` or `jobber auth set-cookie-header`." }));
    if (json) printJson(envelope);
    else process.stderr.write(`${envelope.error.message}\n`);
    process.exitCode = 2;
    throw error;
  }
}

async function main(): Promise<void> {
  const program = new Command();
  program.name("jobber").description("Agent-first private-surface CLI for Jobber").version(getCliVersion());

  program
    .command("doctor")
    .option("--json", "Print JSON")
    .action(async (opts: JsonOption) => {
      try {
        const config = await resolveConfig();
        const validation = config.cookieHeader ? await validateAuth(config) : { ok: false, reason: "No cookie header configured" };
        const data = {
          configPath: CONFIG_PATH,
          hasCookieHeader: Boolean(config.cookieHeader),
          graphqlVersion: config.graphqlVersion || DEFAULT_GRAPHQL_VERSION,
          apiUrl: config.apiUrl || DEFAULT_API_URL,
          operationCount: OPERATION_INDEX.length,
          validation,
        };
        if (opts.json) printJson(ok(data));
        else console.log(`jobber: ${validation.ok ? "ready" : "needs auth"} (${OPERATION_INDEX.length} discovered operations)`);
      } catch (error: any) {
        const envelope = fail(makeError(error));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command("whoami")
    .description("Return the current Jobber user and account identity")
    .option("--json", "Print JSON")
    .action(async (opts: JsonOption) => {
      try {
        const client = await requireClient(opts.json);
        const data = await client.whoami();
        if (opts.json) printJson(ok(data));
        else console.log(`${data.user.fullName || "Unknown user"} @ ${data.account.name || "Unknown account"}`);
      } catch (error: any) {
        if (process.exitCode === 2) return;
        const envelope = fail(makeError(error));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = 1;
      }
    });

  const auth = program.command("auth").description("Manage Jobber auth");

  auth
    .command("status")
    .option("--json", "Print JSON")
    .action(async (opts: JsonOption) => {
      try {
        const config = await resolveConfig();
        const validation = config.cookieHeader ? await validateAuth(config) : { ok: false, reason: "No cookie header configured" };
        const data = {
          configPath: CONFIG_PATH,
          hasCookieHeader: Boolean(config.cookieHeader),
          cookiePreview: config.cookieHeader ? redactCookieHeader(config.cookieHeader) : null,
          graphqlVersion: config.graphqlVersion || DEFAULT_GRAPHQL_VERSION,
          validation,
        };
        if (opts.json) printJson(ok(data));
        else console.log(validation.ok ? "configured" : "missing_or_invalid");
      } catch (error: any) {
        const envelope = fail(makeError(error));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = 1;
      }
    });

  auth
    .command("import-agent-browser")
    .description("Import the current cookies from a live agent-browser session")
    .option("--graphql-version <version>", "Override x-jobber-graphql-version")
    .option("--json", "Print JSON")
    .action(async (opts: JsonOption & { graphqlVersion?: string }) => {
      try {
        const config = await importCookiesFromAgentBrowser({ graphqlVersion: opts.graphqlVersion });
        const validation = await validateAuth(config);
        const data = {
          configPath: CONFIG_PATH,
          cookiePreview: config.cookieHeader ? redactCookieHeader(config.cookieHeader) : null,
          graphqlVersion: config.graphqlVersion || DEFAULT_GRAPHQL_VERSION,
          validation,
        };
        if (opts.json) printJson(ok(data));
        else console.log("saved");
      } catch (error: any) {
        const envelope = fail(makeError(error));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = 1;
      }
    });

  auth
    .command("set-cookie-header")
    .description("Save a raw Cookie header")
    .option("--stdin", "Read cookie header from stdin")
    .option("--graphql-version <version>", "Override x-jobber-graphql-version")
    .option("--json", "Print JSON")
    .action(async (opts: JsonOption & { stdin?: boolean; graphqlVersion?: string }) => {
      try {
        const cookieHeader = opts.stdin ? (await readStdin()).trim() : await promptForCookieHeader();
        const config = await saveCookieHeader(cookieHeader, { graphqlVersion: opts.graphqlVersion });
        const validation = await validateAuth(config);
        if (opts.json) {
          printJson(
            ok({
              configPath: CONFIG_PATH,
              cookiePreview: config.cookieHeader ? redactCookieHeader(config.cookieHeader) : null,
              validation,
            }),
          );
        } else {
          console.log("saved");
        }
      } catch (error: any) {
        const envelope = fail(makeError(error));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = 1;
      }
    });

  auth.command("clear").option("--json", "Print JSON").action(async (opts: JsonOption) => {
    await clearConfig();
    if (opts.json) printJson(ok({ cleared: true, configPath: CONFIG_PATH }));
    else console.log("cleared");
  });

  const operations = program.command("operations").description("Browse discovered Jobber operations");

  operations
    .command("list")
    .option("--search <term>", "Filter operation names or source URLs")
    .option("--json", "Print JSON")
    .action(async (opts: JsonOption & { search?: string }) => {
      const items = listOperations(opts.search);
      if (opts.json) printJson(ok({ count: items.length, items }));
      else items.forEach((item) => console.log(item.name));
    });

  operations
    .command("inspect <name>")
    .option("--json", "Print JSON")
    .action(async (name: string, opts: JsonOption) => {
      const item = OPERATION_INDEX.find((entry) => entry.name === name);
      if (!item) {
        const envelope = fail(makeError({ status: 404 }, { code: "NOT_FOUND", message: `Operation not found: ${name}` }));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = 1;
        return;
      }
      if (opts.json) printJson(ok(item));
      else console.log(`${item.name}\n${item.files.map((file) => file.url).join("\n")}`);
    });

  const graphql = program.command("graphql").description("Run raw Jobber GraphQL");

  graphql
    .command("run")
    .option("--query-file <path>", "Path to a GraphQL document file")
    .option("--query <query>", "Inline GraphQL document")
    .option("--variables <json>", "Inline JSON variables")
    .option("--variables-file <path>", "Path to a JSON variables file")
    .option("--operation-name <name>", "Operation name")
    .option("--json", "Print JSON")
    .action(
      async (opts: JsonOption & { query?: string; queryFile?: string; variables?: string; variablesFile?: string; operationName?: string }) => {
      try {
        const client = await requireClient(opts.json);
        const query = await readQuery(opts.queryFile, opts.query);
        const variables = await readJsonInput(opts.variablesFile, opts.variables);
        const response = await client.graphql({
          operationName: opts.operationName,
          query,
          variables,
        });
        if (opts.json) printJson(ok(response));
        else console.log(JSON.stringify(response, null, 2));
      } catch (error: any) {
        if (process.exitCode === 2) return;
        const envelope = fail(makeError(error));
        if (opts.json) printJson(envelope);
        else process.stderr.write(`${envelope.error.message}\n`);
        process.exitCode = error instanceof JobberApiError ? 1 : 1;
      }
    },
  );

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  const envelope = fail(makeError(error));
  process.stderr.write(`${envelope.error.message}\n`);
  process.exitCode = 1;
});
