import type { Logger } from "../../logger/index.js";
import { nullLogger } from "../../logger/index.js";
import { readSession as readSessionState, type SavedSession } from "../../session/state.js";
import {
  getPresenceMode,
  readGovernanceState,
  writeGovernanceState,
  type GovernanceState,
} from "../state.js";
import { detectPresence, type PresenceDecision } from "../presence/index.js";
import { readFeishuConfig, type FeishuNotificationConfig } from "./config.js";
import { sendFeishuGateNotification } from "./feishu.js";
import {
  markFeishuAttempt,
  planGateNotification,
  type GateNotificationState,
} from "./router.js";

export const DEFAULT_NOTIFICATION_CHECK_INTERVAL_MS = 30_000;

export interface NotificationTickResult {
  activeGate: boolean;
  presence?: PresenceDecision;
  sent: boolean;
  reason: string;
}

export interface NotificationWatcherDeps {
  readState?: typeof readGovernanceState;
  writeState?: typeof writeGovernanceState;
  readConfig?: typeof readFeishuConfig;
  readSession?: (workspaceId: string) => SavedSession | null;
  detectPresence?: typeof detectPresence;
  send?: typeof sendFeishuGateNotification;
  now?: () => string;
}

function persistNotificationIfWaiting(params: {
  workspaceId: string;
  gateId: string;
  notification: GateNotificationState;
  readState: typeof readGovernanceState;
  writeState: typeof writeGovernanceState;
}): GovernanceState | null {
  const latest = params.readState(params.workspaceId);
  if (!latest?.gate || latest.gate.id !== params.gateId || latest.gate.status !== "WAITING") {
    return latest;
  }
  return params.writeState({ ...latest, notification: params.notification });
}

export async function evaluateGateNotificationOnce(params: {
  workspaceId: string;
  workspaceName?: string;
  unknownGraceMs?: number;
  retryMs?: number;
  logger?: Logger;
  deps?: NotificationWatcherDeps;
}): Promise<NotificationTickResult> {
  const deps = params.deps ?? {};
  const logger = params.logger ?? nullLogger;
  const readState = deps.readState ?? readGovernanceState;
  const writeState = deps.writeState ?? writeGovernanceState;
  const readConfig = deps.readConfig ?? readFeishuConfig;
  const readSession = deps.readSession ?? readSessionState;
  const presenceDetector = deps.detectPresence ?? detectPresence;
  const send = deps.send ?? sendFeishuGateNotification;
  const now = deps.now?.() ?? new Date().toISOString();

  const state = readState(params.workspaceId);
  if (!state?.gate || state.gate.status !== "WAITING" || !state.envelope) {
    return { activeGate: false, sent: false, reason: "no-waiting-gate" };
  }

  const config: FeishuNotificationConfig | null = readConfig(params.workspaceId);
  if (!config?.enabled) {
    return { activeGate: true, sent: false, reason: "feishu-not-configured" };
  }

  const presence = presenceDetector({ mode: getPresenceMode(state) });
  const plan = planGateNotification({
    gate: state.gate,
    presence: presence.resolved,
    previous: state.notification,
    now,
    unknownGraceMs: params.unknownGraceMs,
  });

  if (JSON.stringify(state.notification) !== JSON.stringify(plan.state)) {
    const persisted = persistNotificationIfWaiting({
      workspaceId: params.workspaceId,
      gateId: state.gate.id,
      notification: plan.state,
      readState,
      writeState,
    });
    if (!persisted?.gate || persisted.gate.status !== "WAITING" || persisted.gate.id !== state.gate.id) {
      return { activeGate: false, presence, sent: false, reason: "gate-no-longer-waiting" };
    }
  }

  if (!plan.sendFeishu) {
    return { activeGate: true, presence, sent: false, reason: plan.reason };
  }

  const latest = readState(params.workspaceId);
  if (
    !latest?.gate ||
    latest.gate.status !== "WAITING" ||
    latest.gate.id !== state.gate.id ||
    !latest.envelope
  ) {
    return { activeGate: false, presence, sent: false, reason: "gate-no-longer-waiting" };
  }

  const session = readSession(params.workspaceId);
  try {
    await send({
      config,
      message: {
        workspaceName: params.workspaceName ?? params.workspaceId,
        envelope: latest.envelope,
        chatUrl: session?.url ?? session?.projectUrl ?? null,
      },
    });
    persistNotificationIfWaiting({
      workspaceId: params.workspaceId,
      gateId: state.gate.id,
      notification: markFeishuAttempt({
        state: plan.state,
        ok: true,
        now,
        retryMs: params.retryMs,
      }),
      readState,
      writeState,
    });
    return { activeGate: true, presence, sent: true, reason: plan.reason };
  } catch {
    logger.warn("Gate notification delivery failed; retry scheduled");
    persistNotificationIfWaiting({
      workspaceId: params.workspaceId,
      gateId: state.gate.id,
      notification: markFeishuAttempt({
        state: plan.state,
        ok: false,
        now,
        error: "feishu-send-failed",
        retryMs: params.retryMs,
      }),
      readState,
      writeState,
    });
    return { activeGate: true, presence, sent: false, reason: "feishu-send-failed" };
  }
}

export function startGateNotificationWatcher(params: {
  workspaceId: string;
  workspaceName?: string;
  intervalMs?: number;
  unknownGraceMs?: number;
  retryMs?: number;
  logger?: Logger;
  deps?: NotificationWatcherDeps;
}): { stop(): void; tick(): Promise<NotificationTickResult> } {
  let stopped = false;
  let running = false;
  const logger = params.logger ?? nullLogger;

  const tick = async (): Promise<NotificationTickResult> => {
    if (stopped || running) {
      return { activeGate: false, sent: false, reason: stopped ? "stopped" : "tick-in-flight" };
    }
    running = true;
    try {
      return await evaluateGateNotificationOnce(params);
    } catch {
      logger.warn("Gate notification watcher tick failed; will retry on the next interval");
      return { activeGate: false, sent: false, reason: "watcher-error" };
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(
    () => void tick(),
    params.intervalMs ?? DEFAULT_NOTIFICATION_CHECK_INTERVAL_MS
  );
  timer.unref?.();

  return {
    stop(): void {
      stopped = true;
      clearInterval(timer);
    },
    tick,
  };
}
