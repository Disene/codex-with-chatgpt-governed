import { createHash } from "node:crypto";

export interface ExecutionEnvelopeInput {
  action: string;
  environment: string;
  targets: string[];
  allowedWrites: string[];
  forbiddenWrites?: string[];
  baseRef?: string;
  rollback?: string;
  notes?: string;
}

export interface ExecutionEnvelope extends ExecutionEnvelopeInput {
  id: string;
  effect: "L3";
  issuedAt: string;
  fingerprint: string;
}

function sorted(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort((a, b) => a.localeCompare(b));
}

/**
 * Only fields that change the consequential action belong in the material fingerprint.
 * Human-readable notes and issuedAt deliberately do not invalidate authorization.
 */
export function materialEnvelopePayload(input: ExecutionEnvelopeInput): object {
  return {
    action: input.action,
    environment: input.environment,
    targets: sorted(input.targets),
    allowedWrites: sorted(input.allowedWrites),
    forbiddenWrites: sorted(input.forbiddenWrites),
    baseRef: input.baseRef ?? null,
    rollback: input.rollback ?? null,
  };
}

export function envelopeFingerprint(input: ExecutionEnvelopeInput): string {
  return createHash("sha256").update(JSON.stringify(materialEnvelopePayload(input))).digest("hex");
}

export function createExecutionEnvelope(
  input: ExecutionEnvelopeInput,
  now = new Date().toISOString()
): ExecutionEnvelope {
  const fingerprint = envelopeFingerprint(input);
  return {
    ...input,
    effect: "L3",
    id: `env_${fingerprint.slice(0, 16)}`,
    issuedAt: now,
    fingerprint,
  };
}

export function isMateriallySameEnvelope(
  previous: ExecutionEnvelopeInput,
  next: ExecutionEnvelopeInput
): boolean {
  return envelopeFingerprint(previous) === envelopeFingerprint(next);
}
