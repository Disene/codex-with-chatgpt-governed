import fs from "node:fs";
import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "../../config/paths.js";

export interface FeishuNotificationConfig {
  version: 1;
  enabled: boolean;
  webhookUrl: string;
  secret?: string;
  updatedAt: string;
}

export type FeishuConfigSource = "workspace" | "global";

export interface EffectiveFeishuConfig {
  config: FeishuNotificationConfig | null;
  source: FeishuConfigSource | null;
}

const ALLOWED_HOSTS = new Set(["open.feishu.cn", "open.larksuite.com"]);

export function normalizeFeishuWebhookUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error("Feishu webhook must use HTTPS on an approved Feishu/Lark host");
  }
  if (!/^\/open-apis\/bot\/v2\/hook\/[^/]+$/.test(url.pathname) || url.search || url.hash) {
    throw new Error("Feishu webhook URL has an unexpected path or parameters");
  }
  return url.toString();
}

export function feishuConfigFile(workspaceId: string): string {
  return path.join(getStateDir(), "governance-notifications", `${workspaceId}.json`);
}

export function feishuGlobalConfigFile(): string {
  return path.join(getStateDir(), "governance-notifications", "default.json");
}

export function readEffectiveFeishuConfig(workspaceId: string): EffectiveFeishuConfig {
  const workspace = readJsonIfExists<FeishuNotificationConfig>(feishuConfigFile(workspaceId));
  if (workspace) return { config: workspace, source: "workspace" };
  const global = readJsonIfExists<FeishuNotificationConfig>(feishuGlobalConfigFile());
  return global ? { config: global, source: "global" } : { config: null, source: null };
}

export function readFeishuConfig(workspaceId: string): FeishuNotificationConfig | null {
  return readEffectiveFeishuConfig(workspaceId).config;
}

export function writeFeishuConfig(
  workspaceId: string,
  input: { webhookUrl: string; secret?: string; enabled?: boolean },
  now = new Date().toISOString()
): FeishuNotificationConfig {
  const config: FeishuNotificationConfig = {
    version: 1,
    enabled: input.enabled ?? true,
    webhookUrl: normalizeFeishuWebhookUrl(input.webhookUrl),
    secret: input.secret?.trim() || undefined,
    updatedAt: now,
  };
  writeSecureJson(feishuConfigFile(workspaceId), config);
  return config;
}

export function clearFeishuConfig(workspaceId: string): void {
  try {
    fs.rmSync(feishuConfigFile(workspaceId), { force: true });
  } catch {
    // best effort
  }
}

export function writeGlobalFeishuConfig(
  input: { webhookUrl: string; secret?: string; enabled?: boolean },
  now = new Date().toISOString()
): FeishuNotificationConfig {
  const config: FeishuNotificationConfig = {
    version: 1,
    enabled: input.enabled ?? true,
    webhookUrl: normalizeFeishuWebhookUrl(input.webhookUrl),
    secret: input.secret?.trim() || undefined,
    updatedAt: now,
  };
  writeSecureJson(feishuGlobalConfigFile(), config);
  return config;
}

export function clearGlobalFeishuConfig(): void {
  fs.rmSync(feishuGlobalConfigFile(), { force: true });
}

export function feishuConfigSummary(config: FeishuNotificationConfig | null): {
  configured: boolean;
  enabled: boolean;
  signed: boolean;
} {
  return {
    configured: Boolean(config),
    enabled: Boolean(config?.enabled),
    signed: Boolean(config?.secret),
  };
}
