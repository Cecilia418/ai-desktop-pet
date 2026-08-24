import { describe, expect, it } from "vitest";

import { InteractionCooldownManager } from "./interactionCooldown";
import { PetInteractionFeedback } from "./interactionFeedback";
import { LocalReactionRegistry } from "./reactionRegistry";
import {
  SpeechBubbleController,
  type SpeechBubbleScheduler,
} from "./speechBubbleController";

function createScheduler() {
  const callbacks: Array<() => void> = [];
  const scheduler: SpeechBubbleScheduler = {
    setTimeout: (callback) => {
      callbacks.push(callback);
      return callbacks.length as ReturnType<typeof setTimeout>;
    },
    clearTimeout: () => undefined,
  };

  return { callbacks, scheduler };
}

describe("PetInteractionFeedback", () => {
  it("uses the local registry and the shared bubble controller", () => {
    let now = 0;
    const { scheduler } = createScheduler();
    const bubble = new SpeechBubbleController(scheduler);
    const feedback = new PetInteractionFeedback({
      speechBubble: bubble,
      reactions: new LocalReactionRegistry({
        CLICK: ["第一句", "第二句"],
        PET: [],
        POKE: [],
        WAKE: ["醒来"],
      }, () => 0),
      cooldowns: new InteractionCooldownManager({ CLICK: 400, PET: 500, POKE: 500, WAKE: 400 }, () => now),
    });

    expect(feedback.trigger("CLICK")).toBe(true);
    expect(bubble.snapshot).toEqual({ state: "showing", message: "第一句" });
    expect(feedback.trigger("CLICK")).toBe(false);

    now = 400;
    expect(feedback.trigger("CLICK")).toBe(true);
    expect(bubble.snapshot).toEqual({ state: "showing", message: "第一句" });

    feedback.dispose();
  });
});
