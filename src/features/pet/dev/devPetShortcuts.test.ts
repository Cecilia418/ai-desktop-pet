import { afterEach, describe, expect, it, vi } from "vitest";

import { registerDevPetShortcuts } from "./devPetShortcuts";

describe("registerDevPetShortcuts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("routes DEV overlay and state shortcuts to their target", () => {
    if (!import.meta.env.DEV) {
      return;
    }

    let listener: ((event: KeyboardEvent) => void) | undefined;
    const addEventListener = vi.fn((_: string, handler: EventListenerOrEventListenerObject) => {
      listener = handler as (event: KeyboardEvent) => void;
    });
    const removeEventListener = vi.fn();
    vi.stubGlobal("window", { addEventListener, removeEventListener });

    const transitionTo = vi.fn().mockReturnValue({
      accepted: true,
      changed: true,
      from: "IDLE",
      to: "WALKING",
      reason: "debug",
    });
    const toggleOverlay = vi.fn();
    const remove = registerDevPetShortcuts({ transitionTo, toggleOverlay });

    const preventDefault = vi.fn();
    listener?.({
      ctrlKey: true,
      altKey: true,
      repeat: false,
      key: "@",
      code: "KeyD",
      preventDefault,
    } as unknown as KeyboardEvent);
    listener?.({
      ctrlKey: true,
      altKey: true,
      repeat: false,
      key: "@",
      code: "Digit2",
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(toggleOverlay).toHaveBeenCalledTimes(1);
    expect(transitionTo).toHaveBeenCalledWith("WALKING", "debug");
    expect(preventDefault).toHaveBeenCalledTimes(2);

    remove();
    expect(removeEventListener).toHaveBeenCalledTimes(1);
  });
});
