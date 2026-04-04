import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type JobberConfig = {
  cookieHeader?: string;
  graphqlVersion?: string;
  apiUrl?: string;
  appUrl?: string;
};

export const DEFAULT_API_URL = "https://api.getjobber.com/api/graphql?location=j";
export const DEFAULT_APP_URL = "https://secure.getjobber.com";
export const DEFAULT_GRAPHQL_VERSION = "2026-03-10";

export const CONFIG_DIR = path.join(os.homedir(), ".config", "jobber");
export const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function redactCookieHeader(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parts = trimmed.split(/;\s*/).map((cookie) => {
    const eq = cookie.indexOf("=");
    if (eq === -1) return cookie;
    const name = cookie.slice(0, eq);
    const rawValue = cookie.slice(eq + 1);
    if (rawValue.length <= 8) return `${name}=****`;
    return `${name}=${rawValue.slice(0, 4)}…${rawValue.slice(-4)}`;
  });
  return parts.join("; ");
}

export async function readConfig(): Promise<JobberConfig | null> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JobberConfig;
  } catch (error: any) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function ensureConfigDir(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(CONFIG_DIR, 0o700);
}

export async function writeConfig(config: JobberConfig): Promise<void> {
  await ensureConfigDir();
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(CONFIG_PATH, 0o600);
}

export async function clearConfig(): Promise<void> {
  try {
    await fs.unlink(CONFIG_PATH);
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
}

export async function saveCookieHeader(cookieHeader: string, overrides: Partial<JobberConfig> = {}): Promise<JobberConfig> {
  const normalized = cookieHeader.trim();
  if (!normalized) throw new Error("Cookie header is empty");
  const config: JobberConfig = {
    cookieHeader: normalized,
    graphqlVersion: overrides.graphqlVersion || DEFAULT_GRAPHQL_VERSION,
    apiUrl: overrides.apiUrl || DEFAULT_API_URL,
    appUrl: overrides.appUrl || DEFAULT_APP_URL,
  };
  await writeConfig(config);
  return config;
}

export async function resolveConfig(): Promise<JobberConfig> {
  const config = (await readConfig()) || {};
  const cookieHeader = process.env.JOBBER_COOKIE_HEADER?.trim() || config.cookieHeader;
  const graphqlVersion = process.env.JOBBER_GRAPHQL_VERSION?.trim() || config.graphqlVersion || DEFAULT_GRAPHQL_VERSION;
  const apiUrl = process.env.JOBBER_API_URL?.trim() || config.apiUrl || DEFAULT_API_URL;
  const appUrl = process.env.JOBBER_APP_URL?.trim() || config.appUrl || DEFAULT_APP_URL;
  return { cookieHeader, graphqlVersion, apiUrl, appUrl };
}
