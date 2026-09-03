import { readMacPresenceSignals } from "./macos.js";
import {
  resolvePresence,
  type PresenceDecision,
  type PresenceMode,
  type PresenceSignals,
  type ResolvePresenceOptions,
} from "./resolver.js";

export interface DetectPresenceOptions
  extends Omit<ResolvePresenceOptions, "signals"> {
  probeMac?: () => PresenceSignals;
}

/**
 * Resolve a current snapshot. Manual modes never probe the machine. AUTO uses
 * the macOS read-only probe and returns UNKNOWN on unsupported platforms.
 */
export function detectPresence(options: DetectPresenceOptions = {}): PresenceDecision {
  const mode: PresenceMode = options.mode ?? "AUTO";
  const platform = options.platform ?? process.platform;

  if (mode !== "AUTO" || platform !== "darwin") {
    return resolvePresence({ ...options, mode, platform, signals: null });
  }

  const signals = (options.probeMac ?? readMacPresenceSignals)();
  return resolvePresence({ ...options, mode, platform, signals });
}

export * from "./resolver.js";
export * from "./macos.js";
