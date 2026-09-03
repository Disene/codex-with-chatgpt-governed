import { createHmac } from "node:crypto";
import type { ExecutionEnvelope } from "../gate/envelope.js";
import { normalizeFeishuWebhookUrl, type FeishuNotificationConfig } from "./config.js";

export interface FeishuGateMessage {
  workspaceName: string;
  envelope: ExecutionEnvelope;
  chatUrl?: string | null;
}

export interface FeishuSetupTestMessage {
  workspaceName: string;
}

export function createFeishuSignature(secret: string, timestampSeconds: number): string {
  const stringToSign = `${timestampSeconds}\n${secret}`;
  return createHmac("sha256", stringToSign).update("").digest("base64");
}

function applySignature(
  config: FeishuNotificationConfig,
  payload: Record<string, unknown>,
  timestampSeconds: number
): Record<string, unknown> {
  if (!config.secret) return payload;
  return {
    ...payload,
    timestamp: String(timestampSeconds),
    sign: createFeishuSignature(config.secret, timestampSeconds),
  };
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

  return applySignature(
    config,
    {
      msg_type: "post",
      content: {
        post: {
          zh_cn: {
            title: "🔐 Governed C2C 需要人工授权",
            content: lines,
          },
        },
      },
    },
    timestampSeconds
  );
}

export function buildFeishuSetupTestPayload(
  config: FeishuNotificationConfig,
  message: FeishuSetupTestMessage,
  timestampSeconds = Math.floor(Date.now() / 1000)
): Record<string, unknown> {
  return applySignature(
    config,
    {
      msg_type: "post",
      content: {
        post: {
          zh_cn: {
            title: "✅ Governed C2C 通知测试",
            content: [
              [{ tag: "text", text: `项目：${message.workspaceName}` }],
              [{ tag: "text", text: "状态：飞书通知通道已连通" }],
              [
                {
                  tag: "text",
                  text: "说明：这是一条配置测试消息，不代表存在待授权动作，也不能在飞书中授权执行。",
                },
              ],
            ],
          },
        },
      },
    },
    timestampSeconds
  );
}

async function sendFeishuPayload(params: {
  config: FeishuNotificationConfig;
  payload: Record<string, unknown>;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const normalizedWebhookUrl = normalizeFeishuWebhookUrl(params.config.webhookUrl);
  let response: Response;
  try {
    response = await fetchImpl(normalizedWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(params.payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new Error("Feishu notification delivery failed");
  }

  const body = (await response.json().catch(() => null)) as
    | { code?: number; msg?: string; StatusCode?: number; StatusMessage?: string }
    | null;
  const code = body?.code ?? body?.StatusCode ?? 0;
  if (!response.ok || code !== 0) {
    throw new Error(`Feishu webhook rejected notification (HTTP ${response.status}, code ${code})`);
  }
}

export async function sendFeishuGateNotification(params: {
  config: FeishuNotificationConfig;
  message: FeishuGateMessage;
  fetchImpl?: typeof fetch;
  timestampSeconds?: number;
}): Promise<void> {
  await sendFeishuPayload({
    config: params.config,
    payload: buildFeishuGatePayload(params.config, params.message, params.timestampSeconds),
    fetchImpl: params.fetchImpl,
  });
}

export async function sendFeishuSetupTestNotification(params: {
  config: FeishuNotificationConfig;
  message: FeishuSetupTestMessage;
  fetchImpl?: typeof fetch;
  timestampSeconds?: number;
}): Promise<void> {
  await sendFeishuPayload({
    config: params.config,
    payload: buildFeishuSetupTestPayload(params.config, params.message, params.timestampSeconds),
    fetchImpl: params.fetchImpl,
  });
}
