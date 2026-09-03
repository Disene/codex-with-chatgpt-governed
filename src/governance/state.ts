import path from "node:path";
import { getStateDir, readJsonIfExists, writeSecureJson } from "../config/paths.js";
import type { EffectDescriptor } from "./effects.js";
import type { HumanGate } from "./gate/authorization.js";
import type { PresenceMode } from "./presence/resolver.js";

export type GovernanceMode = "normal" | "safe";

export interface GovernanceState {
  version: 1;
  workspaceId: string;
  mode: GovernanceMode;
  presenceMode?: PresenceMode;
  currentEffect?: EffectDescriptor;
  gate?: HumanGate;
  updatedAt: string;
}

export function governanceFile(workspaceId: string): string {
  return path.join(getStateDir(), "governance", `${workspaceId}.json`);
}

export function createGovernanceState(
  workspaceId: string,
  mode: GovernanceMode = "normal",
  now = new Date().toISOString()
): GovernanceState {
  return { version: 1, workspaceId, mode, updatedAt: now };
}

export function readGovernanceState(workspaceId: string): GovernanceState | null {
  return readJsonIfExists<GovernanceState>(governanceFile(workspaceId));
}

export function writeGovernanceState(state: GovernanceState): GovernanceState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  writeSecureJson(governanceFile(state.workspaceId), next);
  return next;
}

export function setGovernanceMode(state: GovernanceState, mode: GovernanceMode): GovernanceState {
  return { ...state, mode, updatedAt: new Date().toISOString() };
}

export function getPresenceMode(state: GovernanceState): PresenceMode {
  return state.presenceMode === "PRESENT" || state.presenceMode === "AWAY" ? state.presenceMode : "AUTO";
}

export function setPresenceMode(state: GovernanceState, presenceMode: PresenceMode): GovernanceState {
  return { ...state, presenceMode, updatedAt: new Date().toISOString() };
}

export function externalWritesAllowed(state: GovernanceState): boolean {
  return state.mode !== "safe";
}
