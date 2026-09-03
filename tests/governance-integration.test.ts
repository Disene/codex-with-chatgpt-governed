import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Bridge } from "../src/bridge/server.js";
import { startServeLifecycle } from "../src/cli/serve-lifecycle.js";
import {
  consumeGovernanceGate,
  decideGovernanceGate,
  readGateLifecycleStatus,
  requestGovernanceGate,
} from "../src/governance/gate/lifecycle.js";
import type { ExecutionEnvelopeInput } from "../src/governance/gate/envelope.js";
import {
  createGovernanceState,
  readGovernanceState,
  setGovernanceMode,
  writeGovernanceState,
} from "../src/governance/state.js";
import { mergeSession, readSession, writeSession } from "../src/session/state.js";
import { Workspace } from "../src/workspace/manager.js";
import { cleanup, makeTmpDir, write } from "./helpers.js";

const projectRoot = process.cwd();

function envelopeInput(action = "promote serving v2"): ExecutionEnvelopeInput {
  return {
    action,
    environment: "production",
    targets: ["serving-pointer"],
    allowedWrites: ["serving-pointer", "serving-v2-metadata"],
    forbiddenWrites: ["legacy-tables", "official-kpi"],
    baseRef: "abc123",
    rollback: "restore previous serving pointer",
  };
}

describe("Governance Integration V1", () => {
  const dirs: string[] = [];

  function isolate(name: string): string {
    const dir = makeTmpDir(name);
    dirs.push(dir);
    process.env.C2C_STATE_DIR = dir;
    return dir;
  }

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
    vi.restoreAllMocks();
  });

  describe("A. request lifecycle", () => {
    it("creates once, reuses WAITING and GRANTED, and replaces material drift in one write", () => {
      isolate("gate-request");
      const workspaceId = "workspace-request";
      const input = envelopeInput();
      writeGovernanceState({
        ...createGovernanceState(workspaceId),
        currentEffect: { level: "L1", kind: "workspace-write", summary: "local preparation" },
      });

      const created = requestGovernanceGate({ workspaceId, input, now: "2026-09-03T01:00:00.000Z" });
      expect(created.created).toBe(true);
      expect(created.gate.status).toBe("WAITING");
      expect(created.state.currentEffect).toMatchObject({ level: "L1", kind: "workspace-write" });

      const waiting = requestGovernanceGate({ workspaceId, input, now: "2026-09-03T01:01:00.000Z" });
      expect(waiting).toMatchObject({ created: false, reused: true });
      expect(waiting.gate.id).toBe(created.gate.id);

      decideGovernanceGate({
        workspaceId,
        decision: "grant",
        gateId: created.gate.id,
        fingerprint: created.gate.envelopeFingerprint,
        now: "2026-09-03T01:02:00.000Z",
      });
      const granted = requestGovernanceGate({ workspaceId, input, now: "2026-09-03T01:03:00.000Z" });
      expect(granted).toMatchObject({ created: false, reused: true });
      expect(granted.gate).toMatchObject({ id: created.gate.id, status: "GRANTED" });

      const drifted = requestGovernanceGate({
        workspaceId,
        input: envelopeInput("promote serving v3"),
        now: "2026-09-03T01:04:00.000Z",
      });
      expect(drifted).toMatchObject({ created: true, reused: false });
      expect(drifted.gate.status).toBe("WAITING");
      expect(drifted.gate.id).not.toBe(created.gate.id);
      expect(readGovernanceState(workspaceId)?.gate?.id).toBe(drifted.gate.id);
    });
  });

  describe("B. human decision", () => {
    it("grants exactly and idempotently, rejects stale identity, and maps cancel to INVALIDATED", () => {
      isolate("gate-decision");
      const workspaceId = "workspace-decision";
      const waiting = requestGovernanceGate({ workspaceId, input: envelopeInput() });

      expect(() =>
        decideGovernanceGate({
          workspaceId,
          decision: "grant",
          gateId: "gate_stale",
          fingerprint: waiting.gate.envelopeFingerprint,
        })
      ).toThrow(/identity/);
      expect(() =>
        decideGovernanceGate({
          workspaceId,
          decision: "grant",
          gateId: waiting.gate.id,
          fingerprint: "wrong-fingerprint",
        })
      ).toThrow(/identity/);

      const granted = decideGovernanceGate({
        workspaceId,
        decision: "grant",
        gateId: waiting.gate.id,
        fingerprint: waiting.gate.envelopeFingerprint,
      });
      expect(granted.gate.status).toBe("GRANTED");
      const duplicate = decideGovernanceGate({
        workspaceId,
        decision: "grant",
        gateId: waiting.gate.id,
        fingerprint: waiting.gate.envelopeFingerprint,
      });
      expect(duplicate).toMatchObject({ reused: true });
      expect(duplicate.gate.id).toBe(waiting.gate.id);

      const cancelled = decideGovernanceGate({
        workspaceId,
        decision: "cancel",
        gateId: waiting.gate.id,
        fingerprint: waiting.gate.envelopeFingerprint,
      });
      expect(cancelled.gate).toMatchObject({
        status: "INVALIDATED",
        reason: "human cancelled consequential action",
      });

      expect(() => requestGovernanceGate({ workspaceId, input: envelopeInput() })).toThrow(
        /invalidated authorization cannot be replayed/
      );
      expect(readGateLifecycleStatus(workspaceId).gate).toMatchObject({
        id: waiting.gate.id,
        status: "INVALIDATED",
      });

      const nextWaiting = requestGovernanceGate({
        workspaceId,
        input: envelopeInput(),
        retry: true,
        now: "2026-09-03T01:05:00.000Z",
      });
      expect(nextWaiting).toMatchObject({ created: true, reused: false });
      expect(nextWaiting.gate.id).not.toBe(waiting.gate.id);
      const cancelledWaiting = decideGovernanceGate({
        workspaceId,
        decision: "cancel",
        gateId: nextWaiting.gate.id,
        fingerprint: nextWaiting.gate.envelopeFingerprint,
      });
      expect(cancelledWaiting.gate.status).toBe("INVALIDATED");
    });
  });

  describe("C. consume boundary", () => {
    it("blocks safe mode, then persists one-shot CONSUMED before the simulated effect", () => {
      isolate("gate-consume");
      const workspaceId = "workspace-consume";
      const input = envelopeInput();
      const waiting = requestGovernanceGate({ workspaceId, input });
      decideGovernanceGate({
        workspaceId,
        decision: "grant",
        gateId: waiting.gate.id,
        fingerprint: waiting.gate.envelopeFingerprint,
      });

      const granted = readGovernanceState(workspaceId)!;
      writeGovernanceState(setGovernanceMode(granted, "safe"));
      expect(() => consumeGovernanceGate({ workspaceId, gateId: waiting.gate.id, input })).toThrow(/safe mode/);
      expect(readGovernanceState(workspaceId)?.gate?.status).toBe("GRANTED");

      writeGovernanceState(setGovernanceMode(readGovernanceState(workspaceId)!, "normal"));
      consumeGovernanceGate({ workspaceId, gateId: waiting.gate.id, input });
      const observedAtEffectBoundary = readGovernanceState(workspaceId)?.gate?.status;
      expect(observedAtEffectBoundary).toBe("CONSUMED");
      expect(() => consumeGovernanceGate({ workspaceId, gateId: waiting.gate.id, input })).toThrow(/CONSUMED/);
      expect(() =>
        decideGovernanceGate({
          workspaceId,
          decision: "cancel",
          gateId: waiting.gate.id,
          fingerprint: waiting.gate.envelopeFingerprint,
        })
      ).toThrow(/CONSUMED/);
    });
  });

  describe("D. restart and resume", () => {
    it("recovers WAITING and GRANTED, while CONSUMED status never creates a retry Gate", () => {
      isolate("gate-restart");
      const workspaceId = "workspace-restart";
      const input = envelopeInput();
      const waiting = requestGovernanceGate({ workspaceId, input, now: "2026-09-03T02:00:00.000Z" });

      expect(readGateLifecycleStatus(workspaceId).gate).toMatchObject({ id: waiting.gate.id, status: "WAITING" });
      expect(requestGovernanceGate({ workspaceId, input })).toMatchObject({ created: false, reused: true });

      decideGovernanceGate({
        workspaceId,
        decision: "grant",
        gateId: waiting.gate.id,
        fingerprint: waiting.gate.envelopeFingerprint,
      });
      expect(readGateLifecycleStatus(workspaceId).gate).toMatchObject({ id: waiting.gate.id, status: "GRANTED" });
      expect(requestGovernanceGate({ workspaceId, input })).toMatchObject({ created: false, reused: true });

      consumeGovernanceGate({ workspaceId, gateId: waiting.gate.id, input });
      const firstRead = readGateLifecycleStatus(workspaceId);
      const secondRead = readGateLifecycleStatus(workspaceId);
      expect(firstRead.gate).toMatchObject({ id: waiting.gate.id, status: "CONSUMED" });
      expect(secondRead.gate).toEqual(firstRead.gate);

      expect(() => requestGovernanceGate({ workspaceId, input })).toThrow(/consumed authorization cannot be replayed/);
      expect(readGateLifecycleStatus(workspaceId).gate).toMatchObject({ id: waiting.gate.id, status: "CONSUMED" });

      const explicitRetry = requestGovernanceGate({
        workspaceId,
        input,
        retry: true,
        now: "2026-09-03T02:01:00.000Z",
      });
      expect(explicitRetry).toMatchObject({ created: true, reused: false });
      expect(explicitRetry.gate.id).not.toBe(waiting.gate.id);

      decideGovernanceGate({
        workspaceId,
        decision: "grant",
        gateId: explicitRetry.gate.id,
        fingerprint: explicitRetry.gate.envelopeFingerprint,
      });
      consumeGovernanceGate({ workspaceId, gateId: explicitRetry.gate.id, input });
      const differentAction = requestGovernanceGate({
        workspaceId,
        input: envelopeInput("promote serving v3"),
        now: "2026-09-03T02:02:00.000Z",
      });
      expect(differentAction).toMatchObject({ created: true, reused: false });
      expect(differentAction.gate).toMatchObject({ status: "WAITING" });
      expect(differentAction.gate.id).not.toBe(explicitRetry.gate.id);
    });
  });

  describe("E. serve watcher lifecycle", () => {
    it("starts one watcher after the bridge and stops it before one idempotent bridge close", async () => {
      const events: string[] = [];
      const close = vi.fn(async () => {
        events.push("bridge:close");
      });
      const bridge = {
        workspace: { id: "workspace-serve", name: "Serve Workspace" },
        close,
      } as unknown as Bridge;
      const stop = vi.fn(() => events.push("watcher:stop"));
      const startBridge = vi.fn(async () => {
        events.push("bridge:start");
        return bridge;
      });
      const startWatcher = vi.fn(() => {
        events.push("watcher:start");
        return {
          stop,
          tick: async () => ({ activeGate: false, sent: false, reason: "no-waiting-gate" }),
        };
      });

      const lifecycle = await startServeLifecycle(
        { workspaceRoot: "/unused" },
        { startBridge, startWatcher }
      );
      expect(startWatcher).toHaveBeenCalledOnce();
      expect(startWatcher).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceId: "workspace-serve", workspaceName: "Serve Workspace" })
      );
      await Promise.all([lifecycle.shutdown(), lifecycle.shutdown()]);
      expect(stop).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce();
      expect(events).toEqual(["bridge:start", "watcher:start", "watcher:stop", "bridge:close"]);
    });
  });

  describe("F. protocol and Session contract", () => {
    it("keeps protocolState while USER waits and Gate CLI does not write Session", () => {
      const stateDir = isolate("gate-cli-session");
      const workspaceRoot = makeTmpDir("gate-cli-workspace");
      dirs.push(workspaceRoot);
      const workspace = new Workspace(workspaceRoot);
      const initial = mergeSession(null, {
        taskId: "c2c_ab12",
        checkpoint: { protocolState: "EXECUTING", waitingFor: "none" },
      });
      writeSession(workspace.id, initial);
      const envelopeFile = write(workspaceRoot, "envelope.json", JSON.stringify(envelopeInput()));

      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx/esm",
          path.join(projectRoot, "src", "cli", "index.ts"),
          "governance",
          "gate",
          "request",
          "--workspace",
          workspaceRoot,
          "--envelope-file",
          envelopeFile,
          "--json",
        ],
        { cwd: projectRoot, encoding: "utf8", env: { ...process.env, C2C_STATE_DIR: stateDir } }
      );
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, created: true });
      expect(readSession(workspace.id)?.checkpoint).toMatchObject({
        protocolState: "EXECUTING",
        waitingFor: "none",
      });

      const waiting = mergeSession(readSession(workspace.id), {
        checkpoint: { protocolState: "EXECUTING", waitingFor: "USER" },
      });
      expect(waiting.checkpoint).toMatchObject({ protocolState: "EXECUTING", waitingFor: "USER" });
      const resumed = mergeSession(waiting, {
        checkpoint: { protocolState: "EXECUTING", waitingFor: "none" },
      });
      expect(resumed.checkpoint).toMatchObject({ protocolState: "EXECUTING", waitingFor: "none" });

      expect(fs.existsSync(path.join(stateDir, "sessions", `${workspace.id}.json`))).toBe(true);
      expect(readGovernanceState(workspace.id)?.gate?.status).toBe("WAITING");
    });

    it("reports missing Gate status without creating Governance state", () => {
      const stateDir = isolate("gate-status-readonly");
      expect(readGateLifecycleStatus("workspace-none")).toMatchObject({ gate: null, envelope: null, mode: "normal" });
      expect(fs.existsSync(path.join(stateDir, "governance", "workspace-none.json"))).toBe(false);
      expect(readGovernanceState("workspace-none")).toBeNull();
    });
  });
});
