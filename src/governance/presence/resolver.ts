export type PresenceMode = "AUTO" | "PRESENT" | "AWAY";
export type ResolvedPresence = "PRESENT" | "AWAY" | "UNKNOWN";

export const DEFAULT_IDLE_AWAY_AFTER_MS = 10 * 60 * 1_000;

export interface PresenceSignals {
  screenLocked: boolean | null;
  idleMs: number | null;
  errors?: string[];
}

export type PresenceReason =
  | "manual-present"
  | "manual-away"
  | "screen-locked"
  | "idle-threshold"
  | "active-unlocked"
  | "unsupported-platform"
  | "insufficient-signals";

export interface PresenceDecision {
  mode: PresenceMode;
  resolved: ResolvedPresence;
  reason: PresenceReason;
  idleAwayAfterMs: number;
  signals: PresenceSignals | null;
}

export interface ResolvePresenceOptions {
  mode?: PresenceMode;
  platform?: NodeJS.Platform;
  idleAwayAfterMs?: number;
  signals?: PresenceSignals | null;
}

/**
 * Resolve presence conservatively. AUTO only returns PRESENT when both the
 * lock and idle signals agree that the user is active. Missing signals are
 * UNKNOWN rather than optimistic guesses.
 */
export function resolvePresence(options: ResolvePresenceOptions = {}): PresenceDecision {
  const mode = options.mode ?? "AUTO";
  const idleAwayAfterMs = normalizeIdleThreshold(options.idleAwayAfterMs);

  if (mode === "PRESENT") {
    return { mode, resolved: "PRESENT", reason: "manual-present", idleAwayAfterMs, signals: null };
  }
  if (mode === "AWAY") {
    return { mode, resolved: "AWAY", reason: "manual-away", idleAwayAfterMs, signals: null };
  }

  const platform = options.platform ?? process.platform;
  const signals = options.signals ?? null;
  if (platform !== "darwin") {
    return { mode, resolved: "UNKNOWN", reason: "unsupported-platform", idleAwayAfterMs, signals };
  }

  if (signals?.screenLocked === true) {
    return { mode, resolved: "AWAY", reason: "screen-locked", idleAwayAfterMs, signals };
  }

  if (signals?.idleMs !== null && signals?.idleMs !== undefined && signals.idleMs >= idleAwayAfterMs) {
    return { mode, resolved: "AWAY", reason: "idle-threshold", idleAwayAfterMs, signals };
  }

  if (
    signals?.screenLocked === false &&
    signals.idleMs !== null &&
    signals.idleMs !== undefined &&
    signals.idleMs < idleAwayAfterMs
  ) {
    return { mode, resolved: "PRESENT", reason: "active-unlocked", idleAwayAfterMs, signals };
  }

  return { mode, resolved: "UNKNOWN", reason: "insufficient-signals", idleAwayAfterMs, signals };
}

function normalizeIdleThreshold(value: number | undefined): number {
  if (value === undefined) return DEFAULT_IDLE_AWAY_AFTER_MS;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("idleAwayAfterMs must be a finite non-negative number");
  }
  return value;
}
