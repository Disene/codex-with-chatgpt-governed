import { describe, expect, it } from "vitest";
import {
  canAddControl,
  decideCompletion,
  decideUncertainty,
  emptyGovernanceUsage,
  missingRequiredControls,
} from "../src/governance/policy.js";

describe("minimum sufficient governance policy", () => {
  it("GOV-001: L0 cannot create a Human Gate", () => {
    expect(canAddControl("L0", emptyGovernanceUsage(), "humanGate").allowed).toBe(false);
  });

  it("GOV-002: L1 cannot create a Human Gate", () => {
    expect(canAddControl("L1", emptyGovernanceUsage(), "humanGate").allowed).toBe(false);
  });

  it("GOV-003: ordinary L2 work does not get a Human Gate by default", () => {
    expect(canAddControl("L2", emptyGovernanceUsage(), "humanGate").allowed).toBe(false);
  });

  it("GOV-004: L3 requires exactly one final Human Gate", () => {
    const usage = emptyGovernanceUsage();
    expect(missingRequiredControls("L3", usage)).toContain("humanGate");
    expect(canAddControl("L3", usage, "humanGate").allowed).toBe(true);
    usage.humanGate = 1;
    expect(canAddControl("L3", usage, "humanGate").allowed).toBe(false);
  });

  it("GOV-009: uncertainty triggers investigation before escalation", () => {
    expect(decideUncertainty({ canInvestigateReadOnly: true, imminentEffect: "L3" })).toBe("INVESTIGATE");
    expect(decideUncertainty({ canInvestigateReadOnly: false, imminentEffect: "L3" })).toBe(
      "BLOCK_CONSEQUENTIAL_ACTION"
    );
  });

  it("GOV-010: satisfied success criteria bias to DONE", () => {
    expect(
      decideCompletion({
        successCriteriaMet: true,
        requiredTestsPassed: true,
        requiredReviewPassed: true,
        blockingRisk: false,
      })
    ).toBe("DONE");
  });

  it("GOV-011: the same risk cannot create duplicate governance stages", () => {
    const usage = emptyGovernanceUsage();
    usage.reviewLane = 1;
    expect(canAddControl("L1", usage, "reviewLane").allowed).toBe(false);
  });
});
