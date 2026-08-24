import { describe, expect, it } from "vitest";

import { DEFAULT_INTERACTION_BALANCE } from "./interactionBalance";
import {
  resolveClickInteraction,
  resolveFeedInteraction,
  resolvePokeReaction,
} from "./interactionRules";
import { DEFAULT_FOOD_DEFINITIONS } from "./foodDefinitions";
import { createPetInteractionEvent } from "../../features/pet/petInteractionEvent";

function click(
  region: "HEAD" | "BODY" | "CHARACTER",
  durationMs: number,
) {
  return createPetInteractionEvent({
    type: "CLICK",
    timestamp: 1,
    source: "pointer",
    region,
    payload: {
      pointerId: 1,
      x: 0,
      y: 0,
      durationMs,
      movementPx: 0,
    },
  });
}

describe("interaction rules", () => {
  it("derives POKE only from a short HEAD/BODY click", () => {
    expect(
      resolveClickInteraction(click("HEAD", 100), DEFAULT_INTERACTION_BALANCE),
    ).toMatchObject({ kind: "POKE", region: "HEAD" });
    expect(
      resolveClickInteraction(click("BODY", 100), DEFAULT_INTERACTION_BALANCE),
    ).toMatchObject({ kind: "POKE", region: "BODY" });
    expect(
      resolveClickInteraction(
        click("BODY", DEFAULT_INTERACTION_BALANCE.pet.holdThresholdMs),
        DEFAULT_INTERACTION_BALANCE,
      ),
    ).toEqual({ kind: "CLICK", region: "BODY" });
  });

  it("uses region-specific POKE reactions and bounded annoyed threshold", () => {
    expect(
      resolvePokeReaction("HEAD", 1, DEFAULT_INTERACTION_BALANCE),
    ).toBe("POKE_HEAD");
    expect(
      resolvePokeReaction("BODY", 2, DEFAULT_INTERACTION_BALANCE),
    ).toBe("POKE_BODY");
    expect(
      resolvePokeReaction("BODY", 3, DEFAULT_INTERACTION_BALANCE),
    ).toBe("POKE_ANNOYED");
  });

  it("returns only FULL when hunger reaches the full threshold", () => {
    const strawberry = DEFAULT_FOOD_DEFINITIONS[0]!;
    expect(
      resolveFeedInteraction(
        strawberry,
        { hunger: 95, mood: 50, energy: 60, intimacy: 40 },
        DEFAULT_INTERACTION_BALANCE,
      ),
    ).toMatchObject({
      isFull: true,
      hungerDelta: 0,
      moodDelta: 0,
      intimacyEligible: false,
    });
  });
});
