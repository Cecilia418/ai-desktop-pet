import { describe, expect, it } from "vitest";

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

describe("SpeechBubbleController", () => {
  it("starts hidden and transitions showing -> fading -> hidden", () => {
    const { callbacks, scheduler } = createScheduler();
    const controller = new SpeechBubbleController(scheduler);

    expect(controller.snapshot).toEqual({ state: "hidden", message: null });
    controller.show("你好", 3_000);
    expect(controller.snapshot).toEqual({ state: "showing", message: "你好" });

    callbacks[0]?.();
    expect(controller.snapshot.state).toBe("fading");
    callbacks[1]?.();
    expect(controller.snapshot).toEqual({ state: "hidden", message: null });
  });

  it("refreshes the same presentation when a new message arrives", () => {
    const { callbacks, scheduler } = createScheduler();
    const controller = new SpeechBubbleController(scheduler);

    controller.show("第一句", 3_000);
    controller.show("第二句", 3_000);

    expect(controller.snapshot).toEqual({ state: "showing", message: "第二句" });
    expect(callbacks).toHaveLength(2);
  });
});
