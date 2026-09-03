import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFeishuGatePayload,
  clearFeishuConfig,
  createFeishuSignature,
  feishuConfigFile,
  markFeishuAttempt,
  normalizeFeishuWebhookUrl,
  planGateNotification,
  readFeishuConfig,
  writeFeishuConfig,
} from "../src/governance/notifications/index.js";
import { evaluateGateNotificationOnce } from "../src/governance/notifications/watcher.js";
import { createExecutionEnvelope } from "../src/governance/gate/envelope.js";
import { requestHumanGate, type HumanGate } from "../src/governance/gate/authorization.js";
import { createGovernanceState, type GovernanceState } from "../src/governance/state.js";
import { cleanup, makeTmpDir } from "./helpers.js";

function envelope() {
  return createExecutionEnvelope(
    {
      action: "promote serving v2",
      environment: "production",
      targets: ["serving-pointer"],
      allowedWrites: ["serving-pointer"],
      forbiddenWrites: ["official-kpi"],
      baseRef: "abc123",
      rollback: "restore previous pointer",
    },
    "2026-09-03T00:00:00.000Z"
  );
}

function gate(at = "2026-09-03T00:00:00.000Z"): HumanGate {
  return requestHumanGate(envelope(), at);
}

describe("notification routing", () => {
  it("sends immediately when AWAY and never for PRESENT", () => {
    const away = planGateNotification({
      gate: gate(),
      presence: "AWAY",
      now: "2026-09-03T00:00:00.000Z",
    });
    expect(away.sendFeishu).toBe(true);
    expect(away.reason).toBe("away");

    const present = planGateNotification({
      gate: gate(),
      presence: "PRESENT",
      now: "2026-09-03T00:00:00.000Z",
    });
    expect(present.sendFeishu).toBe(false);
    expect(present.reason).toBe("present");
  });

  it("backfills when a waiting Gate changes from PRESENT to AWAY", () => {
    const g = gate();
    const first = planGateNotification({
      gate: g,
      presence: "PRESENT",
      now: "2026-09-03T00:00:00.000Z",
    });
    const second = planGateNotification({
      gate: g,
      presence: "AWAY",
      previous: first.state,
      now: "2026-09-03T00:10:01.000Z",
    });
    expect(second.sendFeishu).toBe(true);
    expect(second.reason).toBe("away");
  });

  it("waits three minutes of continuous UNKNOWN before fallback", () => {
    const g = gate();
    const first = planGateNotification({
      gate: g,
      presence: "UNKNOWN",
      now: "2026-09-03T00:00:00.000Z",
    });
    expect(first.sendFeishu).toBe(false);
    expect(first.reason).toBe("unknown-wait");

    const early = planGateNotification({
      gate: g,
      presence: "UNKNOWN",
      previous: first.state,
      now: "2026-09-03T00:02:59.000Z",
    });
    expect(early.sendFeishu).toBe(false);

    const due = planGateNotification({
      gate: g,
      presence: "UNKNOWN",
      previous: early.state,
      now: "2026-09-03T00:03:00.000Z",
    });
    expect(due.sendFeishu).toBe(true);
    expect(due.reason).toBe("unknown-grace");
  });

  it("deduplicates success and backs off failures", () => {
    const g = gate();
    const planned = planGateNotification({
      gate: g,
      presence: "AWAY",
      now: "2026-09-03T00:00:00.000Z",
    });
    const success = markFeishuAttempt({
      state: planned.state,
      ok: true,
      now: "2026-09-03T00:00:01.000Z",
    });
    expect(
      planGateNotification({
        gate: g,
        presence: "AWAY",
        previous: success,
        now: "2026-09-03T01:00:00.000Z",
      }).reason
    ).toBe("already-notified");

    const failed = markFeishuAttempt({
      state: planned.state,
      ok: false,
      now: "2026-09-03T00:00:01.000Z",
      retryMs: 300_000,
      error: "network",
    });
    expect(
      planGateNotification({
        gate: g,
        presence: "AWAY",
        previous: failed,
        now: "2026-09-03T00:04:59.000Z",
      }).reason
    ).toBe("retry-backoff");
    expect(
      planGateNotification({
        gate: g,
        presence: "AWAY",
        previous: failed,
        now: "2026-09-03T00:05:01.000Z",
      }).sendFeishu
    ).toBe(true);
  });

  it("a new Gate gets a fresh notification lifecycle", () => {
    const firstGate = gate("2026-09-03T00:00:00.000Z");
    const first = planGateNotification({
      gate: firstGate,
      presence: "AWAY",
      now: "2026-09-03T00:00:00.000Z",
    });
    const notified = markFeishuAttempt({
      state: first.state,
      ok: true,
      now: "2026-09-03T00:00:01.000Z",
    });
    const secondGate = gate("2026-09-03T01:00:00.000Z");
    const next = planGateNotification({
      gate: secondGate,
      presence: "AWAY",
      previous: notified,
      now: "2026-09-03T01:00:00.000Z",
    });
    expect(secondGate.id).not.toBe(firstGate.id);
    expect(next.sendFeishu).toBe(true);
    expect(next.state.gateId).toBe(secondGate.id);
  });
});

describe("Feishu webhook adapter", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
  });

  it("validates and stores config outside the project with owner-only permissions", () => {
    const dir = makeTmpDir("feishu-config");
    dirs.push(dir);
    process.env.C2C_STATE_DIR = dir;
    const stored = writeFeishuConfig("workspace123", {
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
      secret: "secret",
    });
    expect(readFeishuConfig("workspace123")?.webhookUrl).toBe(stored.webhookUrl);
    if (process.platform !== "win32") {
      expect(fs.statSync(feishuConfigFile("workspace123")).mode & 0o777).toBe(0o600);
    }
    clearFeishuConfig("workspace123");
    expect(readFeishuConfig("workspace123")).toBeNull();
  });

  it("rejects arbitrary webhook destinations", () => {
    expect(() => normalizeFeishuWebhookUrl("https://example.com/open-apis/bot/v2/hook/x")).toThrow();
    expect(() => normalizeFeishuWebhookUrl("http://open.feishu.cn/open-apis/bot/v2/hook/x")).toThrow();
  });

  it("generates Feishu signatures and never embeds secrets in message content", () => {
    expect(createFeishuSignature("secret", 1_700_000_000)).toBe(
      "fiWS2+gh28DOydAv7hzONH/mDn9+b1Y4Y5ivXWXy8vA="
    );
    const config = {
      version: 1 as const,
      enabled: true,
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
      secret: "secret",
      updatedAt: "2026-09-03T00:00:00.000Z",
    };
    const payload = buildFeishuGatePayload(
      config,
      { workspaceName: "Demo", envelope: envelope(), chatUrl: "https://chatgpt.com/c/demo" },
      1_700_000_000
    );
    const serialized = JSON.stringify(payload);
    expect(serialized).toContain("Governed C2C");
    expect(serialized).toContain("打开 ChatGPT");
    expect(serialized).not.toContain(config.webhookUrl);
    expect(serialized).not.toContain(config.secret);
  });
});

describe("notification watcher tick", () => {
  it("sends once for a waiting AWAY Gate and persists success", async () => {
    const env = envelope();
    const waiting = requestHumanGate(env, "2026-09-03T00:00:00.000Z");
    let state: GovernanceState = {
      ...createGovernanceState("workspace123"),
      envelope: env,
      gate: waiting,
    };
    const send = vi.fn(async () => undefined);

    const result = await evaluateGateNotificationOnce({
      workspaceId: "workspace123",
      workspaceName: "Demo",
      deps: {
        readState: () => state,
        writeState: (next) => {
          state = { ...next };
          return state;
        },
        readConfig: () => ({
          version: 1,
          enabled: true,
          webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
          updatedAt: "2026-09-03T00:00:00.000Z",
        }),
        readSession: () => null,
        detectPresence: () => ({
          mode: "AUTO",
          resolved: "AWAY",
          reason: "idle-threshold",
          idleAwayAfterMs: 600_000,
          signals: { screenLocked: false, idleMs: 700_000 },
        }),
        send,
        now: () => "2026-09-03T00:10:00.000Z",
      },
    });

    expect(result.sent).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(state.notification?.feishuNotifiedAt).toBe("2026-09-03T00:10:00.000Z");
  });

  it("does nothing after the Gate is no longer WAITING", async () => {
    const env = envelope();
    const waiting = requestHumanGate(env);
    const state: GovernanceState = {
      ...createGovernanceState("workspace123"),
      envelope: env,
      gate: { ...waiting, status: "GRANTED" },
    };
    const send = vi.fn(async () => undefined);
    const result = await evaluateGateNotificationOnce({
      workspaceId: "workspace123",
      deps: {
        readState: () => state,
        writeState: (next) => next,
        readConfig: () => null,
        send,
      },
    });
    expect(result.activeGate).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("does not overwrite a Gate that becomes GRANTED during notification bookkeeping", async () => {
    const env = envelope();
    const waiting = requestHumanGate(env, "2026-09-03T00:00:00.000Z");
    const granted: GovernanceState = {
      ...createGovernanceState("workspace123"),
      envelope: env,
      gate: { ...waiting, status: "GRANTED" },
    };
    let reads = 0;
    let written: GovernanceState | null = null;
    const send = vi.fn(async () => undefined);

    const result = await evaluateGateNotificationOnce({
      workspaceId: "workspace123",
      deps: {
        readState: () => {
          reads += 1;
          return reads === 1
            ? { ...createGovernanceState("workspace123"), envelope: env, gate: waiting }
            : granted;
        },
        writeState: (next) => {
          written = next;
          return next;
        },
        readConfig: () => ({
          version: 1,
          enabled: true,
          webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/example",
          updatedAt: "2026-09-03T00:00:00.000Z",
        }),
        readSession: () => null,
        detectPresence: () => ({
          mode: "AUTO",
          resolved: "PRESENT",
          reason: "active-unlocked",
          idleAwayAfterMs: 600_000,
          signals: { screenLocked: false, idleMs: 100 },
        }),
        send,
        now: () => "2026-09-03T00:00:01.000Z",
      },
    });

    expect(result.reason).toBe("gate-no-longer-waiting");
    expect(written).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
});
