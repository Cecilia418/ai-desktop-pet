import { describe, expect, it, vi } from "vitest";
import { ActionAffordanceController } from "./actionAffordanceController";

describe("ActionAffordanceController", () => {
  it("keeps the affordance visible through the character-to-button handoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = new ActionAffordanceController();

    controller.pointerEnterCharacter();
    controller.pointerLeaveCharacter();
    expect(controller.snapshot.visibility).toBe("pending-hide");

    vi.advanceTimersByTime(900);
    controller.pointerEnterAffordance();
    vi.advanceTimersByTime(2_000);

    expect(controller.snapshot.visibility).toBe("visible");
    expect(controller.snapshot.pointerOverAffordance).toBe(true);
    controller.dispose();
    vi.useRealTimers();
  });

  it("respects both the grace period and minimum visible duration", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = new ActionAffordanceController();

    controller.pointerEnterCharacter();
    controller.pointerLeaveCharacter();
    vi.advanceTimersByTime(2_199);
    expect(controller.snapshot.visibility).toBe("pending-hide");
    vi.advanceTimersByTime(1);
    expect(controller.snapshot.visibility).toBe("hidden");
    controller.dispose();
    vi.useRealTimers();
  });

  it("does not let the old affordance timer close ActionMenu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const controller = new ActionAffordanceController();

    controller.pointerEnterCharacter();
    controller.pointerLeaveCharacter();
    controller.setActionMenuOpen(true);
    vi.advanceTimersByTime(10_000);

    expect(controller.snapshot.visibility).toBe("visible");
    expect(controller.snapshot.actionMenuOpen).toBe(true);

    controller.setActionMenuOpen(false);
    vi.advanceTimersByTime(2_200);
    expect(controller.snapshot.visibility).toBe("hidden");
    controller.dispose();
    vi.useRealTimers();
  });

  it("hides immediately for interaction start without leaving a stale state", () => {
    const controller = new ActionAffordanceController();
    controller.pointerEnterCharacter();
    controller.interactionStarted();

    expect(controller.snapshot).toEqual({
      visibility: "hidden",
      pointerOverCharacter: false,
      pointerOverAffordance: false,
      actionMenuOpen: false,
      visibleSince: null,
    });
    controller.dispose();
  });
});
