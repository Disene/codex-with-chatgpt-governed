import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "../../config/paths.js";
import type { GateNotificationState } from "./router.js";

export interface NotificationRuntimeState {
  version: 1;
  workspaceId: string;
  notification?: GateNotificationState;
  updatedAt: string;
}

export function notificationRuntimeStateFile(workspaceId: string): string {
  return path.join(getStateDir(), "governance-notification-state", `${workspaceId}.json`);
}

export function readNotificationRuntimeState(workspaceId: string): NotificationRuntimeState | null {
  return readJsonIfExists<NotificationRuntimeState>(notificationRuntimeStateFile(workspaceId));
}

export function writeNotificationRuntimeState(
  state: NotificationRuntimeState
): NotificationRuntimeState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeSecureJson(notificationRuntimeStateFile(state.workspaceId), next);
  return next;
}
