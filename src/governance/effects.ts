export type EffectLevel = "L0" | "L1" | "L2" | "L3";

export type EffectKind =
  | "observe"
  | "workspace-write"
  | "remote-reversible"
  | "consequential";

export interface EffectDescriptor {
  level: EffectLevel;
  kind: EffectKind;
  summary?: string;
}

const EFFECT_RANK: Record<EffectLevel, number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
};

export function compareEffectLevel(a: EffectLevel, b: EffectLevel): number {
  return EFFECT_RANK[a] - EFFECT_RANK[b];
}

export function isConsequential(effect: EffectDescriptor | EffectLevel): boolean {
  return (typeof effect === "string" ? effect : effect.level) === "L3";
}
