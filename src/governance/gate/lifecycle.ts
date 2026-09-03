import {
  consumeHumanGate,
  grantHumanGate,
  reconcileGateWithEnvelope,
  requestHumanGate,
  type HumanGate,
} from "./authorization.js";
import {
  createExecutionEnvelope,
  type ExecutionEnvelope,
  type ExecutionEnvelopeInput,
} from "./envelope.js";
import {
  createGovernanceState,
  externalWritesAllowed,
  readGovernanceState,
  writeGovernanceState,
  type GovernanceState,
} from "../state.js";

export type HumanGateDecision = "grant" | "cancel";

export interface GateLifecycleResult {
  state: GovernanceState;
  envelope: ExecutionEnvelope;
  gate: HumanGate;
  created: boolean;
  reused: boolean;
}

export interface GateLifecycleStatus {
  workspaceId: string;
  mode: GovernanceState["mode"];
  envelope: ExecutionEnvelope | null;
  gate: HumanGate | null;
}

const CANCEL_REASON = "human cancelled consequential action";

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field);
}

function stringArray(value: unknown, field: string, required: boolean): string[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${field} must be an array of non-empty strings`);
  }
  if (required && value.length === 0) {
    throw new Error(`${field} must not be empty`);
  }
  return value.map((item) => item.trim());
}

/** Validate untrusted CLI JSON, then hand normalization/fingerprinting to the existing envelope helper. */
export function parseExecutionEnvelopeInput(value: unknown): ExecutionEnvelopeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("envelope file must contain a JSON object");
  }
  const input = value as Record<string, unknown>;
  return {
    action: requiredString(input.action, "action"),
    environment: requiredString(input.environment, "environment"),
    targets: stringArray(input.targets, "targets", true)!,
    allowedWrites: stringArray(input.allowedWrites, "allowedWrites", true)!,
    forbiddenWrites: stringArray(input.forbiddenWrites, "forbiddenWrites", false),
    baseRef: optionalString(input.baseRef, "baseRef"),
    rollback: optionalString(input.rollback, "rollback"),
    notes: optionalString(input.notes, "notes"),
  };
}

/** Read-only status. Missing state is reported as the default normal mode without creating a file. */
export function readGateLifecycleStatus(workspaceId: string): GateLifecycleStatus {
  const state = readGovernanceState(workspaceId);
  return {
    workspaceId,
    mode: state?.mode ?? "normal",
    envelope: state?.envelope ?? null,
    gate: state?.gate ?? null,
  };
}

export function requestGovernanceGate(params: {
  workspaceId: string;
  input: ExecutionEnvelopeInput;
  retryConsumed?: boolean;
  now?: string;
}): GateLifecycleResult {
  const now = params.now ?? new Date().toISOString();
  const envelope = createExecutionEnvelope(params.input, now);
  const current = readGovernanceState(params.workspaceId) ?? createGovernanceState(params.workspaceId);
  const gate = current.gate;

  if (gate && current.envelope) {
    const reconciled = reconcileGateWithEnvelope(gate, envelope, now);
    const storedEnvelopeMatchesGate =
      current.envelope.id === gate.envelopeId &&
      current.envelope.fingerprint === gate.envelopeFingerprint;
    const sameMaterial =
      storedEnvelopeMatchesGate &&
      current.envelope.id === envelope.id &&
      current.envelope.fingerprint === envelope.fingerprint;
    if (
      sameMaterial &&
      reconciled === gate &&
      (gate.status === "WAITING" || gate.status === "GRANTED")
    ) {
      return {
        state: current,
        envelope: current.envelope,
        gate,
        created: false,
        reused: true,
      };
    }
    if (sameMaterial && gate.status === "CONSUMED" && !params.retryConsumed) {
      throw new Error(
        "consumed authorization cannot be replayed; establish the actual outcome before an explicit retry"
      );
    }
  }

  const nextGate = requestHumanGate(envelope, now);
  const state = writeGovernanceState({
    ...current,
    workspaceId: params.workspaceId,
    envelope,
    gate: nextGate,
  });
  return { state, envelope, gate: nextGate, created: true, reused: false };
}

export function decideGovernanceGate(params: {
  workspaceId: string;
  decision: HumanGateDecision;
  gateId: string;
  fingerprint: string;
  now?: string;
}): GateLifecycleResult {
  const state = readGovernanceState(params.workspaceId);
  if (!state?.gate || !state.envelope) throw new Error("no active human gate");
  const gate = state.gate;
  if (state.envelope.id !== gate.envelopeId || state.envelope.fingerprint !== gate.envelopeFingerprint) {
    throw new Error("stored execution envelope does not match the active authorization");
  }
  if (gate.id !== params.gateId || gate.envelopeFingerprint !== params.fingerprint) {
    throw new Error("human gate identity does not match the active authorization");
  }

  const now = params.now ?? new Date().toISOString();
  if (params.decision === "grant") {
    if (gate.status === "GRANTED") {
      return { state, envelope: state.envelope, gate, created: false, reused: true };
    }
    const granted = grantHumanGate(gate, { source: "chatgpt-user" }, now);
    const next = writeGovernanceState({ ...state, gate: granted });
    return { state: next, envelope: state.envelope, gate: granted, created: false, reused: false };
  }

  if (gate.status === "CONSUMED") throw new Error("cannot cancel gate in CONSUMED state");
  if (gate.status !== "WAITING" && gate.status !== "GRANTED") {
    throw new Error(`cannot cancel gate in ${gate.status} state`);
  }
  const cancelled: HumanGate = {
    ...gate,
    status: "INVALIDATED",
    invalidatedAt: now,
    reason: CANCEL_REASON,
  };
  const next = writeGovernanceState({ ...state, gate: cancelled });
  return { state: next, envelope: state.envelope, gate: cancelled, created: false, reused: false };
}

export function consumeGovernanceGate(params: {
  workspaceId: string;
  gateId: string;
  input: ExecutionEnvelopeInput;
  now?: string;
}): GateLifecycleResult {
  const state = readGovernanceState(params.workspaceId);
  if (!state?.gate || !state.envelope) throw new Error("no active human gate");
  if (state.gate.id !== params.gateId) {
    throw new Error("human gate identity does not match the active authorization");
  }

  const now = params.now ?? new Date().toISOString();
  const envelope = createExecutionEnvelope(params.input, now);
  const storedEnvelopeMatchesGate =
    state.envelope.id === state.gate.envelopeId &&
    state.envelope.fingerprint === state.gate.envelopeFingerprint;
  if (!storedEnvelopeMatchesGate) throw new Error("stored execution envelope does not match the active authorization");

  const reconciled = reconcileGateWithEnvelope(state.gate, envelope, now);
  if (reconciled !== state.gate) {
    writeGovernanceState({ ...state, gate: reconciled });
    throw new Error("authorization does not match the execution envelope");
  }
  if (!externalWritesAllowed(state)) {
    throw new Error("safe mode blocks consequential external writes");
  }

  const consumed = consumeHumanGate(state.gate, envelope, now);
  const next = writeGovernanceState({ ...state, gate: consumed });
  return { state: next, envelope: state.envelope, gate: consumed, created: false, reused: false };
}
