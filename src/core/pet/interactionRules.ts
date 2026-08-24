import type { InteractionBalanceConfig } from "./interactionBalance";
import type { PetStatsSnapshot } from "./petStats";
import type {
  PetInteractionEvent,
  PetInteractionRegion,
} from "../../features/pet/petInteractionEvent";
import type { FoodDefinition } from "./foodDefinitions";

export type ClickResolution =
  | {
      readonly kind: "CLICK";
      readonly region: PetInteractionRegion;
    }
  | {
      readonly kind: "POKE";
      readonly region: "HEAD" | "BODY";
      readonly durationMs: number;
    };

export function resolveClickInteraction(
  event: Extract<PetInteractionEvent, { type: "CLICK" }>,
  balance: Readonly<InteractionBalanceConfig>,
): ClickResolution {
  const { durationMs } = event.payload;
  const { region } = event;
  if (
    durationMs < balance.pet.holdThresholdMs &&
    (region === "HEAD" || region === "BODY")
  ) {
    return {
      kind: "POKE",
      region,
      durationMs,
    };
  }

  return { kind: "CLICK", region };
}

export type PokeReactionKey = "POKE_HEAD" | "POKE_BODY" | "POKE_ANNOYED";

export function resolvePokeReaction(
  region: "HEAD" | "BODY",
  streakCount: number,
  balance: Readonly<InteractionBalanceConfig>,
): PokeReactionKey {
  if (streakCount >= balance.poke.annoyedAfterCount) {
    return "POKE_ANNOYED";
  }

  return region === "HEAD" ? "POKE_HEAD" : "POKE_BODY";
}

export interface FeedDecision {
  readonly kind: "FEED";
  readonly food: FoodDefinition;
  readonly isFull: boolean;
  readonly hungerDelta: number;
  readonly moodDelta: number;
  readonly intimacyEligible: boolean;
}

export function resolveFeedInteraction(
  food: FoodDefinition,
  stats: PetStatsSnapshot,
  balance: Readonly<InteractionBalanceConfig>,
): FeedDecision {
  const isFull = stats.hunger >= balance.feed.fullThreshold;
  if (isFull) {
    return {
      kind: "FEED",
      food,
      isFull: true,
      hungerDelta: 0,
      moodDelta: 0,
      intimacyEligible: false,
    };
  }

  return {
    kind: "FEED",
    food,
    isFull: false,
    hungerDelta: food.hungerRestore,
    moodDelta: food.moodDelta,
    intimacyEligible: food.preference === "LOVE" || food.preference === "LIKE",
  };
}
