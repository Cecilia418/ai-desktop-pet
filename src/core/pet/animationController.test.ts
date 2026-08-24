import { describe, expect, it, vi } from "vitest";
import { AnimationController } from "./animationController";

describe("AnimationController", () => {
  it("advances frames at the configured fps and loops", () => {
    const controller = new AnimationController({
      idle: { frames: ["a", "b", "c"], fps: 10, loop: true },
    });
    controller.play("idle");

    controller.advance(100);
    expect(controller.snapshot().currentFrame).toBe(1);
    controller.advance(200);
    expect(controller.snapshot().currentFrame).toBe(0);
    expect(controller.snapshot().isPlaying).toBe(true);
  });

  it("stops at the final frame and calls completion for non-loop animation", () => {
    const onComplete = vi.fn();
    const controller = new AnimationController({
      poke: { frames: ["a", "b"], fps: 10, loop: false },
    });
    controller.play("poke", onComplete);

    controller.advance(200);

    expect(controller.snapshot()).toMatchObject({
      currentFrame: 1,
      isPlaying: false,
      isPaused: false,
    });
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("pauses and resumes without losing the current frame", () => {
    const controller = new AnimationController({
      idle: { frames: ["a", "b"], fps: 5, loop: true },
    });
    controller.play("idle");
    controller.advance(200);
    controller.pause();
    controller.advance(1000);

    expect(controller.snapshot().currentFrame).toBe(1);
    expect(controller.snapshot().isPaused).toBe(true);

    controller.resume();
    controller.advance(200);
    expect(controller.snapshot().currentFrame).toBe(0);
  });
});
