import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureGlobalFeishuNotifications } from "../src/cli/notification-setup.js";
import {
  readHiddenInput,
  type SecurePromptInput,
  type SecurePromptOutput,
} from "../src/cli/secure-prompt.js";
import {
  clearGlobalFeishuConfig,
  feishuConfigFile,
  feishuGlobalConfigFile,
  readEffectiveFeishuConfig,
  sendFeishuSetupTestNotification,
  writeFeishuConfig,
  writeGlobalFeishuConfig,
  type FeishuNotificationConfig,
} from "../src/governance/notifications/index.js";
import { Workspace } from "../src/workspace/manager.js";
import { cleanup, makeTmpDir } from "./helpers.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const originalStateDir = process.env.C2C_STATE_DIR;

class FakeTtyInput extends EventEmitter {
  isTTY = true;
  isRaw = false;
  readonly rawModes: boolean[] = [];
  paused = false;

  constructor(private readonly chunks: string[]) {
    super();
  }

  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    this.rawModes.push(mode);
    return this;
  }

  setEncoding(): this {
    return this;
  }

  resume(): this {
    queueMicrotask(() => {
      for (const chunk of this.chunks) this.emit("data", chunk);
    });
    return this;
  }

  pause(): this {
    this.paused = true;
    return this;
  }
}

function fakeOutput(): SecurePromptOutput & { text: string } {
  return {
    isTTY: true,
    text: "",
    write(value: string) {
      this.text += value;
      return true;
    },
  };
}

describe("Feishu config resolution and redaction", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    if (originalStateDir === undefined) delete process.env.C2C_STATE_DIR;
    else process.env.C2C_STATE_DIR = originalStateDir;
  });

  it("uses the global default and gives a workspace config precedence", () => {
    const stateDir = makeTmpDir("feishu-global-precedence");
    dirs.push(stateDir);
    process.env.C2C_STATE_DIR = stateDir;

    const global = writeGlobalFeishuConfig({
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/global-token",
      secret: "global-secret",
    });
    expect(readEffectiveFeishuConfig("workspace123")).toEqual({
      config: global,
      source: "global",
    });

    const workspace = writeFeishuConfig("workspace123", {
      webhookUrl: "https://open.larksuite.com/open-apis/bot/v2/hook/workspace-token",
      secret: "workspace-secret",
    });
    expect(readEffectiveFeishuConfig("workspace123")).toEqual({
      config: workspace,
      source: "workspace",
    });
  });

  it("stores global credentials owner-only and reports only redacted status", () => {
    const stateDir = makeTmpDir("feishu-global-status");
    const workspaceRoot = makeTmpDir("feishu-status-workspace");
    dirs.push(stateDir, workspaceRoot);
    process.env.C2C_STATE_DIR = stateDir;
    const webhookToken = "status-webhook-token";
    const secret = "status-signing-secret";
    writeGlobalFeishuConfig({
      webhookUrl: `https://open.feishu.cn/open-apis/bot/v2/hook/${webhookToken}`,
      secret,
    });

    const configFile = feishuGlobalConfigFile();
    if (process.platform !== "win32") {
      expect(fs.statSync(path.dirname(configFile)).mode & 0o777).toBe(0o700);
      expect(fs.statSync(configFile).mode & 0o777).toBe(0o600);
    }

    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx/esm",
        path.join(projectRoot, "src", "cli", "index.ts"),
        "governance",
        "notifications",
        "status",
        "--workspace",
        workspaceRoot,
        "--json",
      ],
      { cwd: projectRoot, encoding: "utf8", env: { ...process.env, C2C_STATE_DIR: stateDir } }
    );

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      ok: true,
      configured: true,
      enabled: true,
      signed: true,
      source: "global",
    });
    expect(result.stdout).not.toContain(webhookToken);
    expect(result.stdout).not.toContain(secret);
    expect(result.stderr).not.toContain(webhookToken);
    expect(result.stderr).not.toContain(secret);
  });
});

describe("secure interactive configuration", () => {
  it("accepts credentials only through hidden prompts and returns a redacted summary", async () => {
    const webhookUrl = "https://open.feishu.cn/open-apis/bot/v2/hook/configure-token";
    const secret = "configure-secret";
    const prompt: typeof readHiddenInput = vi.fn(async (label) =>
      label === "Webhook URL" ? webhookUrl : secret
    );
    const writeConfig = vi.fn(
      (input: { webhookUrl: string; secret?: string; enabled?: boolean }): FeishuNotificationConfig => ({
        version: 1,
        enabled: input.enabled ?? true,
        webhookUrl: input.webhookUrl,
        secret: input.secret,
        updatedAt: "2026-09-03T00:00:00.000Z",
      })
    );

    const summary = await configureGlobalFeishuNotifications({ prompt, writeConfig });

    expect(prompt).toHaveBeenNthCalledWith(1, "Webhook URL");
    expect(prompt).toHaveBeenNthCalledWith(2, "Signing Secret", { optional: true });
    expect(writeConfig).toHaveBeenCalledWith({ webhookUrl, secret });
    expect(summary).toEqual({ configured: true, enabled: true, signed: true });
    expect(JSON.stringify(summary)).not.toContain(webhookUrl);
    expect(JSON.stringify(summary)).not.toContain(secret);
  });

  it("handles hidden input, backspace, raw-mode restoration, and Ctrl-C without echoing", async () => {
    const input = new FakeTtyInput(["abcX\u007fY\r"]);
    const output = fakeOutput();
    await expect(
      readHiddenInput("Webhook URL", {
        input: input as unknown as SecurePromptInput,
        output,
      })
    ).resolves.toBe("abcY");
    expect(input.rawModes).toEqual([true, false]);
    expect(input.paused).toBe(true);
    expect(output.text).not.toContain("abcY");

    const cancelled = new FakeTtyInput(["private-value\u0003"]);
    const cancelledOutput = fakeOutput();
    await expect(
      readHiddenInput("Signing Secret", {
        input: cancelled as unknown as SecurePromptInput,
        output: cancelledOutput,
      })
    ).rejects.toThrow("secure interactive configuration cancelled");
    expect(cancelled.rawModes).toEqual([true, false]);
    expect(cancelledOutput.text).not.toContain("private-value");
  });

  it("fails closed without a TTY and exposes no credential argv options", async () => {
    const input = new FakeTtyInput([]);
    input.isTTY = false;
    await expect(
      readHiddenInput("Webhook URL", {
        input: input as unknown as SecurePromptInput,
        output: fakeOutput(),
      })
    ).rejects.toThrow("secure interactive configuration requires a terminal");

    const help = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx/esm",
        path.join(projectRoot, "src", "cli", "index.ts"),
        "governance",
        "notifications",
        "configure",
        "--help",
      ],
      { cwd: projectRoot, encoding: "utf8" }
    );
    expect(help.status, help.stderr).toBe(0);
    expect(help.stdout).not.toContain("--webhook");
    expect(help.stdout).not.toContain("--secret");
  });
});

describe("global clear", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    if (originalStateDir === undefined) delete process.env.C2C_STATE_DIR;
    else process.env.C2C_STATE_DIR = originalStateDir;
  });

  it("is idempotent and never removes a workspace override", () => {
    const stateDir = makeTmpDir("feishu-global-clear");
    dirs.push(stateDir);
    process.env.C2C_STATE_DIR = stateDir;
    writeGlobalFeishuConfig({
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/global-clear-token",
    });
    writeFeishuConfig("workspace123", {
      webhookUrl: "https://open.feishu.cn/open-apis/bot/v2/hook/workspace-keep-token",
    });

    clearGlobalFeishuConfig();
    clearGlobalFeishuConfig();

    expect(fs.existsSync(feishuGlobalConfigFile())).toBe(false);
    expect(fs.existsSync(feishuConfigFile("workspace123"))).toBe(true);
    expect(readEffectiveFeishuConfig("workspace123").source).toBe("workspace");
  });
});

describe("notify-only setup test transport", () => {
  const config: FeishuNotificationConfig = {
    version: 1,
    enabled: true,
    webhookUrl: "https://open.larksuite.com/open-apis/bot/v2/hook/setup-test-token",
    secret: "setup-signing-secret",
    updatedAt: "2026-09-03T00:00:00.000Z",
  };

  it("sends a signed setup-only payload through the approved shared transport", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, msg: "success" }), { status: 200 })
    );

    await sendFeishuSetupTestNotification({
      config,
      message: { workspaceName: "Local Demo" },
      timestampSeconds: 1_700_000_000,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(config.webhookUrl);
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(payload).toMatchObject({ timestamp: "1700000000" });
    expect(payload).toHaveProperty("sign");
    expect(serialized).toContain("Governed C2C 通知测试");
    expect(serialized).toContain("不代表存在待授权动作");
    expect(serialized).not.toContain("gateId");
    expect(serialized).not.toContain("fingerprint");
    expect(serialized).not.toContain(config.webhookUrl);
    expect(serialized).not.toContain(config.secret);
  });

  it("rejects an invalid direct config before fetch and keeps transport errors generic", async () => {
    const invalidFetch = vi.fn(async () =>
      new Response(JSON.stringify({ code: 0, msg: "success" }), { status: 200 })
    );
    await expect(
      sendFeishuSetupTestNotification({
        config: { ...config, webhookUrl: "https://example.com/open-apis/bot/v2/hook/evil" },
        message: { workspaceName: "Local Demo" },
        fetchImpl: invalidFetch,
      })
    ).rejects.toThrow();
    expect(invalidFetch).toHaveBeenCalledTimes(0);

    const rawError = `network error ${config.webhookUrl} ${config.secret}`;
    const failingFetch = vi.fn(async () => {
      throw new Error(rawError);
    });
    await expect(
      sendFeishuSetupTestNotification({
        config,
        message: { workspaceName: "Local Demo" },
        fetchImpl: failingFetch,
      })
    ).rejects.toThrow("Feishu notification delivery failed");
    try {
      await sendFeishuSetupTestNotification({
        config,
        message: { workspaceName: "Local Demo" },
        fetchImpl: failingFetch,
      });
    } catch (error) {
      expect(String(error)).not.toContain(config.webhookUrl);
      expect(String(error)).not.toContain(config.secret);
      expect(String(error)).not.toContain(rawError);
    }
  });
});
