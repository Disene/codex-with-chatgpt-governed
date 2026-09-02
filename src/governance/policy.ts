import type { EffectLevel } from "./effects.js";

export type GovernanceControl =
  | "humanGate"
  | "reviewLane"
  | "formalPreflight"
  | "postWriteReadback"
  | "executionEnvelope";

export interface GovernanceBudget {
  floor: Record<GovernanceControl, number>;
  ceiling: Record<GovernanceControl, number>;
}

export interface GovernanceUsage extends Record<GovernanceControl, number> {}

const ZERO_USAGE: GovernanceUsage = {
  humanGate: 0,
  reviewLane: 0,
  formalPreflight: 0,
  postWriteReadback: 0,
  executionEnvelope: 0,
};

const budget = (floor: Partial<GovernanceUsage>, ceiling: Partial<GovernanceUsage>): GovernanceBudget => ({
  floor: { ...ZERO_USAGE, ...floor },
  ceiling: { ...ZERO_USAGE, ...ceiling },
});

/**
 * Minimum sufficient governance: each effect level has both a floor and a ceiling.
 * A model may not add governance merely because it feels uncertain or cautious.
 */
export const DEFAULT_GOVERNANCE_BUDGETS: Record<EffectLevel, GovernanceBudget> = {
  L0: budget({}, {}),
  L1: budget({ reviewLane: 1 }, { reviewLane: 1 }),
  L2: budget(
    { reviewLane: 1, postWriteReadback: 1 },
    { reviewLane: 1, formalPreflight: 1, postWriteReadback: 1 }
  ),
  L3: budget(
    {
      humanGate: 1,
      reviewLane: 1,
      formalPreflight: 1,
      postWriteReadback: 1,
      executionEnvelope: 1,
    },
    {
      humanGate: 1,
      reviewLane: 1,
      formalPreflight: 1,
      postWriteReadback: 1,
      executionEnvelope: 1,
    }
  ),
};

export function emptyGovernanceUsage(): GovernanceUsage {
  return { ...ZERO_USAGE };
}

export interface ControlDecision {
  allowed: boolean;
  reason: string;
}

export function canAddControl(
  level: EffectLevel,
  usage: GovernanceUsage,
  control: GovernanceControl
): ControlDecision {
  const ceiling = DEFAULT_GOVERNANCE_BUDGETS[level].ceiling[control];
  if (usage[control] >= ceiling) {
    return {
      allowed: false,
      reason: `governance ceiling reached: ${level}.${control} <= ${ceiling}`,
    };
  }
  return { allowed: true, reason: "within governance ceiling" };
}

export function missingRequiredControls(
  level: EffectLevel,
  usage: GovernanceUsage
): GovernanceControl[] {
  const floor = DEFAULT_GOVERNANCE_BUDGETS[level].floor;
  return (Object.keys(floor) as GovernanceControl[]).filter((control) => usage[control] < floor[control]);
}

export type UncertaintyDecision = "INVESTIGATE" | "BLOCK_CONSEQUENTIAL_ACTION";

/** Uncertainty causes read-only investigation, not automatic risk escalation. */
export function decideUncertainty(params: {
  canInvestigateReadOnly: boolean;
  imminentEffect: EffectLevel;
}): UncertaintyDecision {
  if (params.canInvestigateReadOnly) return "INVESTIGATE";
  return params.imminentEffect === "L3" ? "BLOCK_CONSEQUENTIAL_ACTION" : "INVESTIGATE";
}

export type CompletionDecision = "DONE" | "CONTINUE";

/** Once the success contract is satisfied, optional improvements cannot block DONE. */
export function decideCompletion(params: {
  successCriteriaMet: boolean;
  requiredTestsPassed: boolean;
  requiredReviewPassed: boolean;
  blockingRisk: boolean;
}): CompletionDecision {
  return params.successCriteriaMet &&
    params.requiredTestsPassed &&
    params.requiredReviewPassed &&
    !params.blockingRisk
    ? "DONE"
    : "CONTINUE";
}
