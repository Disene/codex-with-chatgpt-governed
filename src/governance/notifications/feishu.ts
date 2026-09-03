import { createHmac } from "node:crypto";
import type { ExecutionEnvelope } from "../gate/envelope.js";
import { normalizeFeishuWebhookUrl, type FeishuNotificationConfig } from "./config.js";

export interface FeishuGateMessage {
  workspaceName: string;
  envelope: ExecutionEnvelope;
  chatUrl?: string | null;
}

export function createFeishuSignature(secret: string, timestampSeconds: number): string {
  const stringToSign = `${timestampSeconds}\n${secret}`;
  return createHmac("sha256", stringToSign).update("").digest("base64");
}

export function buildFeishuGatePayload(
  config: FeishuNotificationConfig,
  message: FeishuGateMessage,
  timestampSeconds = Math.floor(Date.now() / 1000)
): Record<string, unknown> {
  const lines: Array<Array<Record<string, string>>> = [
    [{ tag: "text", text: `项目：${message.workspaceName}` }],
    [{ tag: "text", text: `准备执行：${message.envelope.action}` }],
    [{ tag: "text", text: `环境：${message.envelope.environment}` }],
    [{ tag: "text", text: `目标：${message.envelope.targets.slice(0, 3).join(", ") || "未指定"}` }],
    [{ tag: "text", text: "状态：等待你的决定。飞书仅用于提醒，不能在此授权执行。" }],
  ];
  if (message.chatUrl) {
    lines.push([{ tag: "a", text: "打开 ChatGPT 查看并授权", href: message.chatUrl }]);
  }

  const payload: Record<string, unknown> = {
    msg_type: "post",
    content: {
      post: {
        zh_cn: {
          title: "🔐 Governed C2C 需要人工授权",
          content: lines,
        },
      },
    },
  };

  if (config.secret) {
    payload.timestamp = String(timestampSeconds);
    payload.sign = createFeishuSignature(config.secret, timestampSeconds);
  }
  return payload;
}

export async function sendFeishuGateNotification(params: {
  config: FeishuNotificationConfig;
  message: FeishuGateMessage;
  fetchImpl?: typeof fetch;
  timestampSeconds?: number;
}): Promise<void> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const normalizedWebhookUrl = normalizeFeishuWebhookUrl(params.config.webhookUrl);
  const response = await fetchImpl(normalizedWebhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(
      buildFeishuGatePayload(params.config, params.message, params.timestampSeconds)
    ),
    signal: AbortSignal.timeout(5_000),
  });

  const body = (await response.json().catch(() => null)) as
    | { code?: number; msg?: string; StatusCode?: number; StatusMessage?: string }
    | null;
  const code = body?.code ?? body?.StatusCode ?? 0;
  if (!response.ok || code !== 0) {
    throw new Error(`Feishu webhook rejected notification (HTTP ${response.status}, code ${code})`);
  }
}
