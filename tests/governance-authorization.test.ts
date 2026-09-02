import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  consumeHumanGate,
  grantHumanGate,
  reconcileGateWithEnvelope,
  requestHumanGate,
} from "../src/governance/gate/authorization.js";
import { createExecutionEnvelope } from "../src/governance/gate/envelope.js";
import {
  createGovernanceState,
  externalWritesAllowed,
  governanceFile,
  readGovernanceState,
  setGovernanceMode,
  writeGovernanceState,
} from "../src/governance/state.js";
import { cleanup, makeTmpDir } from "./helpers.js";

function envelope(notes = "initial") {
  return createExecutionEnvelope(
    {
      action: "promote serving v2",
      environment: "production",
      targets: ["serving-pointer"],
      allowedWrites: ["serving-v2-metadata", "serving-pointer"],
      forbiddenWrites: ["legacy-tables", "official-kpi"],
      baseRef: "abc123",
      rollback: "restore previous serving pointer",
      notes,
    },
    "2026-09-03T00:00:00.000Z"
  );
}

describe("human authorization", () => {
  it("creates a new Gate ID for each request, even for the same envelope", () => {
    const env = envelope();
    const first = requestHumanGate(env, "2026-09-03T00:01:00.000Z");
    const second = requestHumanGate(env, "2026-09-03T00:02:00.000Z");
    expect(first.id).not.toBe(second.id);
    expect(first.envelopeFingerprint).toBe(second.envelopeFingerprint);
  });

  it("GOV-005: only the accepted human authorization source can grant", () => {
    const gate = requestHumanGate(envelope(), "2026-09-03T00:01:00.000Z");
    expect(() =>
      grantHumanGate(gate, { source: "codex" as "chatgpt-user" }, "2026-09-03T00:02:00.000Z")
    ).toThrow(/human authorization source/);
  });

  it("GOV-006: authorization is one-shot", () => {
    const env = envelope();
    const waiting = requestHumanGate(env, "2026-09-03T00:01:00.000Z");
    const granted = grantHumanGate(
      waiting,
      { source: "chatgpt-user", actor: "human" },
      "2026-09-03T00:02:00.000Z"
    );
    const consumed = consumeHumanGate(granted, env, "2026-09-03T00:03:00.000Z");
    expect(consumed.status).toBe("CONSUMED");
    expect(() => consumeHumanGate(consumed, env)).toThrow(/CONSUMED/);
  });

  it("GOV-007: material envelope drift invalidates authorization", () => {
    const original = envelope();
    const granted = grantHumanGate(requestHumanGate(original), { source: "chatgpt-user" });
    const changed = createExecutionEnvelope({
      ...original,
      allowedWrites: [...original.allowedWrites, "official-kpi"],
    });
    expect(reconcileGateWithEnvelope(granted, changed).status).toBe("INVALIDATED");
  });

  it("GOV-008: non-material note drift does not invalidate authorization", () => {
    const original = envelope("before");
    const granted = grantHumanGate(requestHumanGate(original), { source: "chatgpt-user" });
    const changedNotesOnly = envelope("after");
    expect(changedNotesOnly.fingerprint).toBe(original.fingerprint);
    expect(reconcileGateWithEnvelope(granted, changedNotesOnly).status).toBe("GRANTED");
  });
});

describe("governance sidecar state", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) cleanup(dir);
    dirs.length = 0;
    delete process.env.C2C_STATE_DIR;
  });

  it("stores governance independently from session state", () => {
    const dir = makeTmpDir("governance-state");
    dirs.push(dir);
    process.env.C2C_STATE_DIR = dir;
    writeGovernanceState(createGovernanceState("workspace123"));
    expect(governanceFile("workspace123")).toBe(path.join(dir, "governance", "workspace123.json"));
    expect(fs.existsSync(path.join(dir, "sessions", "workspace123.json"))).toBe(false);
    expect(readGovernanceState("workspace123")?.mode).toBe("normal");
  });

  it("safe mode fail-closes external writes without disabling local work", () => {
    const state = setGovernanceMode(createGovernanceState("workspace123"), "safe");
    expect(externalWritesAllowed(state)).toBe(false);
  });
});
