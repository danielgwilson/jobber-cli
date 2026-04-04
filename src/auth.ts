import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { saveCookieHeader, type JobberConfig } from "./config.js";
import { JobberApiClient } from "./jobber-api.js";

const execFileAsync = promisify(execFile);

export type AuthValidation = {
  ok: boolean;
  reason?: string;
  sample?: {
    graphqlVersion: string;
    customFieldCounts: { client: number; property: number };
  };
};

export async function validateAuth(config: JobberConfig): Promise<AuthValidation> {
  try {
    const client = JobberApiClient.fromConfig(config);
    const sample = await client.validateAuth();
    return { ok: true, sample };
  } catch (error: any) {
    return {
      ok: false,
      reason: error?.message || "Validation failed",
    };
  }
}

export async function importCookiesFromAgentBrowser(overrides: Partial<JobberConfig> = {}): Promise<JobberConfig> {
  const { stdout } = await execFileAsync("agent-browser", ["cookies"], { maxBuffer: 10 * 1024 * 1024 });
  const cookies = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes("="))
    .filter((line) => !line.startsWith("✓"));

  if (!cookies.length) throw new Error("No cookies returned from agent-browser");
  return saveCookieHeader(cookies.join("; "), overrides);
}
