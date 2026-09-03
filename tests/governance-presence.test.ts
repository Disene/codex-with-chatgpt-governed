import { describe, expect, it, vi } from "vitest";
import {
  detectPresence,
  parseMacIdleMs,
  parseMacScreenLocked,
  readMacPresenceSignals,
  resolvePresence,
  type CommandRunner,
} from "../src/governance/presence/index.js";
import {
  createGovernanceState,
  getPresenceMode,
  setPresenceMode,
} from "../src/governance/state.js";

const LOCKED_XML = `
<plist version="1.0"><dict>
<key>IOConsoleUsers</key><array><dict>
<key>kCGSSessionOnConsoleKey</key><true/>
<key>CGSSessionScreenIsLocked</key><true/>
</dict></array>
</dict></plist>`;

const UNLOCKED_XML = `
<plist version="1.0"><dict>
<key>IOConsoleUsers</key><array><dict>
<key>kCGSSessionOnConsoleKey</key><true/>
<key>kCGSSessionUserNameKey</key><string>disene</string>
</dict></array>
</dict></plist>`;

describe("presence resolution", () => {
  it("manual PRESENT overrides machine signals", () => {
    const result = resolvePresence({
      mode: "PRESENT",
      platform: "darwin",
      signals: { screenLocked: true, idleMs: 999_999 },
    });
    expect(result.resolved).toBe("PRESENT");
    expect(result.reason).toBe("manual-present");
    expect(result.signals).toBeNull();
  });

  it("manual AWAY overrides machine signals", () => {
    const result = resolvePresence({
      mode: "AWAY",
      platform: "darwin",
      signals: { screenLocked: false, idleMs: 0 },
    });
    expect(result.resolved).toBe("AWAY");
    expect(result.reason).toBe("manual-away");
  });

  it("AUTO resolves locked screen as AWAY", () => {
    const result = resolvePresence({
      mode: "AUTO",
      platform: "darwin",
      signals: { screenLocked: true, idleMs: 1_000 },
    });
    expect(result.resolved).toBe("AWAY");
    expect(result.reason).toBe("screen-locked");
  });

  it("AUTO resolves idle threshold as AWAY", () => {
    const result = resolvePresence({
      mode: "AUTO",
      platform: "darwin",
      idleAwayAfterMs: 600_000,
      signals: { screenLocked: false, idleMs: 600_000 },
    });
    expect(result.resolved).toBe("AWAY");
    expect(result.reason).toBe("idle-threshold");
  });

  it("AUTO resolves only unlocked and active signals as PRESENT", () => {
    const result = resolvePresence({
      mode: "AUTO",
      platform: "darwin",
      signals: { screenLocked: false, idleMs: 5_000 },
    });
    expect(result.resolved).toBe("PRESENT");
    expect(result.reason).toBe("active-unlocked");
  });

  it("AUTO returns UNKNOWN when a required signal is missing", () => {
    const result = resolvePresence({
      mode: "AUTO",
      platform: "darwin",
      signals: { screenLocked: false, idleMs: null },
    });
    expect(result.resolved).toBe("UNKNOWN");
    expect(result.reason).toBe("insufficient-signals");
  });

  it("AUTO returns UNKNOWN on unsupported platforms", () => {
    const result = resolvePresence({ mode: "AUTO", platform: "linux" });
    expect(result.resolved).toBe("UNKNOWN");
    expect(result.reason).toBe("unsupported-platform");
  });

  it("rejects invalid idle thresholds", () => {
    expect(() => resolvePresence({ idleAwayAfterMs: -1 })).toThrow(/idleAwayAfterMs/);
  });
});

describe("macOS read-only signals", () => {
  it("parses locked and unlocked console sessions", () => {
    expect(parseMacScreenLocked(LOCKED_XML)).toBe(true);
    expect(parseMacScreenLocked(UNLOCKED_XML)).toBe(false);
    expect(parseMacScreenLocked("unrelated output")).toBeNull();
  });

  it("parses HIDIdleTime nanoseconds as milliseconds", () => {
    expect(parseMacIdleMs('    "HIDIdleTime" = 6500000000')).toBe(6_500);
    expect(parseMacIdleMs("no idle property")).toBeNull();
  });

  it("uses only targeted ioreg read probes and returns both signals", () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const run: CommandRunner = (command, args) => {
      calls.push({ command, args });
      if (args.includes("Root")) return { status: 0, stdout: UNLOCKED_XML, stderr: "" };
      return { status: 0, stdout: '"HIDIdleTime" = 42000000', stderr: "" };
    };

    expect(readMacPresenceSignals(run)).toEqual({ screenLocked: false, idleMs: 42, errors: [] });
    expect(calls).toEqual([
      { command: "/usr/sbin/ioreg", args: ["-n", "Root", "-d1", "-a"] },
      {
        command: "/usr/sbin/ioreg",
        args: ["-r", "-c", "IOHIDSystem", "-k", "HIDIdleTime", "-d", "1"],
      },
    ]);
  });

  it("fails soft when probes cannot provide signals", () => {
    const run: CommandRunner = () => ({ status: 1, stdout: "", stderr: "denied" });
    const signals = readMacPresenceSignals(run);
    expect(signals.screenLocked).toBeNull();
    expect(signals.idleMs).toBeNull();
    expect(signals.errors).toHaveLength(2);
  });
});

describe("presence detector and persisted mode", () => {
  it("manual mode does not probe macOS", () => {
    const probeMac = vi.fn(() => ({ screenLocked: false, idleMs: 0 }));
    expect(detectPresence({ mode: "AWAY", platform: "darwin", probeMac }).resolved).toBe("AWAY");
    expect(probeMac).not.toHaveBeenCalled();
  });

  it("AUTO probes macOS exactly once", () => {
    const probeMac = vi.fn(() => ({ screenLocked: false, idleMs: 1_000 }));
    expect(detectPresence({ mode: "AUTO", platform: "darwin", probeMac }).resolved).toBe("PRESENT");
    expect(probeMac).toHaveBeenCalledTimes(1);
  });

  it("defaults existing governance state to AUTO and persists manual override", () => {
    const initial = createGovernanceState("workspace123");
    expect(getPresenceMode(initial)).toBe("AUTO");
    const away = setPresenceMode(initial, "AWAY");
    expect(getPresenceMode(away)).toBe("AWAY");
    expect(away.mode).toBe("normal");
  });
});
