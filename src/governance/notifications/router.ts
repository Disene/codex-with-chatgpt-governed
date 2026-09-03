import type { HumanGate } from "../gate/authorization.js";
import type { ResolvedPresence } from "../presence/resolver.js";

export const DEFAULT_UNKNOWN_GRACE_MS = 3 * 60 * 1_000;
export const DEFAULT_FEISHU_RETRY_MS = 5 * 60 * 1_000;

export interface GateNotificationState {
  gateId: string;
  firstSeenAt: string;
  lastPresence: ResolvedPresence;
  unknownSince?: string;
  feishuNotifiedAt?: string;
  lastFeishuAttemptAt?: string;
  nextFeishuRetryAt?: string;
  lastFailure?: string;
}

export interface GateNotificationPlan {
  sendFeishu: boolean;
  reason: "already-notified" | "present" | "away" | "unknown-wait" | "unknown-grace" | "retry-backoff";
  state: GateNotificationState;
}

function atOrAfter(now: string, target: string | undefined): boolean {
  if (!target) return true;
  return Date.parse(now) >= Date.parse(target);
}

function initialize(gate: HumanGate, presence: ResolvedPresence, now: string): GateNotificationState {
  return {
    gateId: gate.id,
    firstSeenAt: now,
    lastPresence: presence,
    unknownSince: presence === "UNKNOWN" ? now : undefined,
  };
}

export function planGateNotification(params: {
  gate: HumanGate;
  presence: ResolvedPresence;
  previous?: GateNotificationState;
  now?: string;
  unknownGraceMs?: number;
}): GateNotificationPlan {
  const now = params.now ?? new Date().toISOString();
  const unknownGraceMs = params.unknownGraceMs ?? DEFAULT_UNKNOWN_GRACE_MS;
  let state =
    params.previous?.gateId === params.gate.id
      ? { ...params.previous, lastPresence: params.presence }
      : initialize(params.gate, params.presence, now);

  if (state.feishuNotifiedAt) {
    return { sendFeishu: false, reason: "already-notified", state };
  }

  if (!atOrAfter(now, state.nextFeishuRetryAt)) {
    return { sendFeishu: false, reason: "retry-backoff", state };
  }

  if (params.presence === "PRESENT") {
    state = { ...state, unknownSince: undefined };
    return { sendFeishu: false, reason: "present", state };
  }

  if (params.presence === "AWAY") {
    state = { ...state, unknownSince: undefined };
    return { sendFeishu: true, reason: "away", state };
  }

  const unknownSince = state.unknownSince ?? now;
  state = { ...state, unknownSince };
  const elapsed = Date.parse(now) - Date.parse(unknownSince);
  return {
    sendFeishu: elapsed >= unknownGraceMs,
    reason: elapsed >= unknownGraceMs ? "unknown-grace" : "unknown-wait",
    state,
  };
}

export function markFeishuAttempt(params: {
  state: GateNotificationState;
  ok: boolean;
  now?: string;
  error?: string;
  retryMs?: number;
}): GateNotificationState {
  const now = params.now ?? new Date().toISOString();
  if (params.ok) {
    return {
      ...params.state,
      feishuNotifiedAt: now,
      lastFeishuAttemptAt: now,
      nextFeishuRetryAt: undefined,
      lastFailure: undefined,
    };
  }

  const retryMs = params.retryMs ?? DEFAULT_FEISHU_RETRY_MS;
  return {
    ...params.state,
    lastFeishuAttemptAt: now,
    nextFeishuRetryAt: new Date(Date.parse(now) + retryMs).toISOString(),
    lastFailure: (params.error ?? "notification failed").slice(0, 200),
  };
}
