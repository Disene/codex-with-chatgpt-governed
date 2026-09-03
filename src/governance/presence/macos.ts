import { spawnSync } from "node:child_process";
import type { PresenceSignals } from "./resolver.js";

export interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}

export type CommandRunner = (command: string, args: string[]) => CommandResult;

export const defaultCommandRunner: CommandRunner = (command, args) => {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 2_000,
    windowsHide: true,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
};

/**
 * Parse the first console session from `ioreg -n Root -d1 -a`.
 * macOS generally omits CGSSessionScreenIsLocked while unlocked.
 */
export function parseMacScreenLocked(output: string): boolean | null {
  const xmlMarker = "<key>IOConsoleUsers</key>";
  const markerIndex = output.indexOf(xmlMarker);
  if (markerIndex >= 0) {
    const arrayIndex = output.indexOf("<array>", markerIndex);
    const dictStart = output.indexOf("<dict>", arrayIndex >= 0 ? arrayIndex : markerIndex);
    const dictEnd = dictStart >= 0 ? output.indexOf("</dict>", dictStart) : -1;
    if (dictStart >= 0 && dictEnd > dictStart) {
      const firstSession = output.slice(dictStart, dictEnd + "</dict>".length);
      const lockedKey = firstSession.indexOf("<key>CGSSessionScreenIsLocked</key>");
      if (lockedKey >= 0) {
        const afterKey = firstSession.slice(lockedKey);
        if (/^<key>CGSSessionScreenIsLocked<\/key>\s*<true\s*\/>/s.test(afterKey)) return true;
        if (/^<key>CGSSessionScreenIsLocked<\/key>\s*<false\s*\/>/s.test(afterKey)) return false;
      }
      return false;
    }
  }

  const textMatch = output.match(/"CGSSessionScreenIsLocked"\s*=\s*(Yes|No|true|false)/i);
  if (textMatch) return /^(Yes|true)$/i.test(textMatch[1]);
  return null;
}

/** Parse HIDIdleTime nanoseconds from a targeted `ioreg` property query. */
export function parseMacIdleMs(output: string): number | null {
  const match =
    output.match(/"HIDIdleTime"\s*=\s*(\d+)/) ??
    output.match(/<key>HIDIdleTime<\/key>\s*<integer>(\d+)<\/integer>/s);
  if (!match) return null;

  try {
    const milliseconds = BigInt(match[1]) / 1_000_000n;
    if (milliseconds > BigInt(Number.MAX_SAFE_INTEGER)) return Number.MAX_SAFE_INTEGER;
    return Number(milliseconds);
  } catch {
    return null;
  }
}

/** Read-only macOS presence signals. No polling, persistence, or notification. */
export function readMacPresenceSignals(run: CommandRunner = defaultCommandRunner): PresenceSignals {
  const errors: string[] = [];

  const lockResult = run("/usr/sbin/ioreg", ["-n", "Root", "-d1", "-a"]);
  let screenLocked: boolean | null = null;
  if (lockResult.status === 0 && !lockResult.error) {
    screenLocked = parseMacScreenLocked(lockResult.stdout);
    if (screenLocked === null) errors.push("screen lock signal unavailable");
  } else {
    errors.push(`screen lock probe failed${lockResult.stderr ? `: ${lockResult.stderr.trim()}` : ""}`);
  }

  const idleResult = run("/usr/sbin/ioreg", [
    "-r",
    "-c",
    "IOHIDSystem",
    "-k",
    "HIDIdleTime",
    "-d",
    "1",
  ]);
  let idleMs: number | null = null;
  if (idleResult.status === 0 && !idleResult.error) {
    idleMs = parseMacIdleMs(idleResult.stdout);
    if (idleMs === null) errors.push("idle signal unavailable");
  } else {
    errors.push(`idle probe failed${idleResult.stderr ? `: ${idleResult.stderr.trim()}` : ""}`);
  }

  return { screenLocked, idleMs, errors };
}
