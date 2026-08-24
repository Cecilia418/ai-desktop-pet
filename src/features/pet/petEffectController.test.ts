import { describe, expect, it } from "vitest";

import {
  PetEffectController,
  type PetEffectScheduler,
} from "./petEffectController";

function createScheduler() {
  const callbacks: Array<() => void> = [];
  const scheduler: PetEffectScheduler = {
    setTimeout: (callback) => {
      callbacks.push(callback);
      return callbacks.length as ReturnType<typeof setTimeout>;
    },
    clearTimeout: () => undefined,
  };
  return { callbacks, scheduler };
}

describe("PetEffectController", () => {
  it("publishes independent transient effects and expires them", () => {
    const { callbacks, scheduler } = createScheduler();
    const effects: Array<string | null> = [];
    const controller = new PetEffectController(scheduler, () => 10);
    controller.subscribe((snapshot) => effects.push(snapshot?.kind ?? null));

    controller.trigger("FEED", { asset: "🍓", foodId: "strawberry" });
    expect(controller.snapshot).toMatchObject({ kind: "FEED", asset: "🍓" });
    expect(effects).toEqual([null, "FEED"]);

    callbacks[0]?.();
    expect(controller.snapshot).toBeNull();
    expect(effects).toEqual([null, "FEED", null]);
    controller.dispose();
  });
});
