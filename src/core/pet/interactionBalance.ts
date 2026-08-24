export interface InteractionBalanceConfig {
  readonly pet: {
    readonly holdThresholdMs: number;
    readonly repeatIntervalMs: number;
    readonly moodDelta: number;
    readonly intimacyDelta: number;
    readonly reactionCooldownMs: number;
    readonly moodRewardCooldownMs: number;
    readonly intimacyRewardCooldownMs: number;
  };
  readonly poke: {
    readonly reactionCooldownMs: number;
    readonly streakWindowMs: number;
    readonly annoyedAfterCount: number;
    readonly moodPenalty: number;
    readonly statEffectCooldownMs: number;
  };
  readonly feed: {
    readonly reactionCooldownMs: number;
    readonly intimacyRewardCooldownMs: number;
    readonly fullThreshold: number;
  };
  readonly chat: {
    readonly localInteractionCooldownMs: number;
  };
  readonly drag: {
    readonly settleDelayMs: number;
  };
}

export const DEFAULT_INTERACTION_BALANCE: Readonly<InteractionBalanceConfig> = {
  pet: {
    holdThresholdMs: 520,
    repeatIntervalMs: 1_000,
    moodDelta: 3,
    intimacyDelta: 1,
    reactionCooldownMs: 800,
    moodRewardCooldownMs: 1_600,
    intimacyRewardCooldownMs: 10_000,
  },
  poke: {
    reactionCooldownMs: 500,
    streakWindowMs: 5_000,
    annoyedAfterCount: 3,
    moodPenalty: -1,
    statEffectCooldownMs: 4_000,
  },
  feed: {
    reactionCooldownMs: 800,
    intimacyRewardCooldownMs: 10_000,
    fullThreshold: 95,
  },
  chat: {
    localInteractionCooldownMs: 800,
  },
  drag: {
    settleDelayMs: 120,
  },
};
