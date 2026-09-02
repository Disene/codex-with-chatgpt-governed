import { createHash } from "node:crypto";
import type { ExecutionEnvelope } from "./envelope.js";

export type GateStatus = "WAITING" | "GRANTED" | "CONSUMED" | "INVALIDATED";
export type AuthorizationSource = "chatgpt-user";

export interface HumanAuthorization {
  source: AuthorizationSource;
  actor?: string;
}

export interface HumanGate {
  id: string;
  status: GateStatus;
  envelopeId: string;
  envelopeFingerprint: string;
  requestedAt: string;
  grantedAt?: string;
  consumedAt?: string;
  invalidatedAt?: string;
  actor?: string;
  reason?: string;
}

export function requestHumanGate(
  envelope: ExecutionEnvelope,
  now = new Date().toISOString()
): HumanGate {
  const requestFingerprint = createHash("sha256")
    .update(`${envelope.fingerprint}:${now}`)
    .digest("hex");
  return {
    id: `gate_${requestFingerprint.slice(0, 16)}`,
    status: "WAITING",
    envelopeId: envelope.id,
    envelopeFingerprint: envelope.fingerprint,
    requestedAt: now,
  };
}

export function grantHumanGate(
  gate: HumanGate,
  authorization: HumanAuthorization,
  now = new Date().toISOString()
): HumanGate {
  if (authorization.source !== "chatgpt-user") {
    throw new Error("human gate can only be granted by an accepted human authorization source");
  }
  if (gate.status !== "WAITING") {
    throw new Error(`cannot grant gate in ${gate.status} state`);
  }
  return {
    ...gate,
    status: "GRANTED",
    grantedAt: now,
    actor: authorization.actor,
  };
}

export function consumeHumanGate(
  gate: HumanGate,
  envelope: ExecutionEnvelope,
  now = new Date().toISOString()
): HumanGate {
  if (gate.status !== "GRANTED") {
    throw new Error(`cannot consume gate in ${gate.status} state`);
  }
  if (gate.envelopeFingerprint !== envelope.fingerprint || gate.envelopeId !== envelope.id) {
    throw new Error("authorization does not match the execution envelope");
  }
  return { ...gate, status: "CONSUMED", consumedAt: now };
}

export function reconcileGateWithEnvelope(
  gate: HumanGate,
  envelope: ExecutionEnvelope,
  now = new Date().toISOString()
): HumanGate {
  if (gate.status === "CONSUMED" || gate.status === "INVALIDATED") return gate;
  if (gate.envelopeFingerprint === envelope.fingerprint && gate.envelopeId === envelope.id) return gate;
  return {
    ...gate,
    status: "INVALIDATED",
    invalidatedAt: now,
    reason: "material execution envelope drift",
  };
}
