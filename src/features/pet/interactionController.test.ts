import { describe, expect, it } from "vitest";

import {
  InteractionController,
  POINTER_DRAG_THRESHOLD_PX,
} from "./interactionController";

const characterRegion = { x: 10, y: 20, width: 100, height: 120 };

function sample(
  x: number,
  y: number,
  pointerId = 1,
  button = 0,
) {
  return { pointerId, x, y, button };
}

function createScheduler(nowRef: { value: number }) {
  let nextId = 0;
  const timers = new Map<number, { callback: () => void; dueAt: number }>();
  return {
    setTimeout(callback: () => void, delayMs: number) {
      const id = ++nextId;
      timers.set(id, { callback, dueAt: nowRef.value + delayMs });
      return id as ReturnType<typeof setTimeout>;
    },
    clearTimeout(handle: ReturnType<typeof setTimeout>) {
      timers.delete(handle as unknown as number);
    },
    advanceTo(timestamp: number) {
      nowRef.value = timestamp;
      let nextTimer = [...timers.entries()]
        .filter(([, timer]) => timer.dueAt <= timestamp)
        .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
      while (nextTimer) {
        timers.delete(nextTimer[0]);
        nextTimer[1].callback();
        nextTimer = [...timers.entries()]
          .filter(([, timer]) => timer.dueAt <= timestamp)
          .sort(([, left], [, right]) => left.dueAt - right.dueAt)[0];
      }
    },
  };
}

describe("InteractionController", () => {
  it("keeps a short movement as one click", () => {
    const events: string[] = [];
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push(event.type),
    });

    expect(controller.pointerDown(sample(60, 55))).toBe(true);
    controller.pointerMove(sample(60 + POINTER_DRAG_THRESHOLD_PX - 1, 55));
    controller.pointerUp(sample(61, 55));

    expect(events).toEqual(["CLICK"]);
  });

  it("starts a drag at the configured 4px threshold and never clicks", () => {
    const events: string[] = [];
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push(event.type),
    });

    controller.pointerDown(sample(60, 55));
    controller.pointerMove(sample(60 + POINTER_DRAG_THRESHOLD_PX, 55));
    controller.pointerMove(sample(70, 60));
    controller.pointerUp(sample(75, 65));

    expect(events).toEqual(["DRAG_START", "DRAG_MOVE", "DRAG_END"]);
  });

  it("ignores pointer-down outside the rendered character", () => {
    const events: string[] = [];
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push(event.type),
    });

    expect(controller.pointerDown(sample(200, 200))).toBe(false);
    expect(controller.pointerUp(sample(200, 200))).toBe(false);
    expect(events).toEqual([]);
  });

  it("ends an active drag on pointer cancel without manufacturing a click", () => {
    const events: string[] = [];
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push(event.type),
    });

    controller.pointerDown(sample(60, 55));
    controller.pointerMove(sample(64, 55));
    controller.pointerCancel(sample(68, 55));

    expect(events).toEqual(["DRAG_START", "DRAG_END"]);
  });

  it("recognizes a head long press as repeatable PET events without a click", () => {
    const events: Array<{ type: string; repeatIndex?: number }> = [];
    const now = { value: 0 };
    const scheduler = createScheduler(now);
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push({
        type: event.type,
        repeatIndex: event.type === "PET" ? event.payload.repeatIndex : undefined,
      }),
      now: () => now.value,
      scheduler,
      petHoldThresholdMs: 520,
      petRepeatIntervalMs: 1_000,
    });

    controller.pointerDown(sample(60, 55));
    scheduler.advanceTo(519);
    expect(events).toEqual([]);
    scheduler.advanceTo(520);
    expect(events).toEqual([{ type: "PET", repeatIndex: 0 }]);
    scheduler.advanceTo(1_520);
    expect(events).toEqual([
      { type: "PET", repeatIndex: 0 },
      { type: "PET", repeatIndex: 1 },
    ]);
    controller.pointerUp(sample(60, 55));

    expect(events).toHaveLength(2);
  });

  it("keeps body long press as CLICK so runtime can reject POKE by duration", () => {
    const events: Array<{ type: string; durationMs?: number }> = [];
    const now = { value: 0 };
    const scheduler = createScheduler(now);
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push({
        type: event.type,
        durationMs: event.type === "CLICK" ? event.payload.durationMs : undefined,
      }),
      now: () => now.value,
      scheduler,
    });

    controller.pointerDown(sample(60, 110));
    scheduler.advanceTo(700);
    controller.pointerUp(sample(60, 110));

    expect(events).toEqual([{ type: "CLICK", durationMs: 700 }]);
  });

  it("cancels the PET timer when the pointer reaches the 4px drag threshold", () => {
    const events: string[] = [];
    const now = { value: 0 };
    const scheduler = createScheduler(now);
    const controller = new InteractionController({
      getCharacterRegion: () => characterRegion,
      onEvent: (event) => events.push(event.type),
      now: () => now.value,
      scheduler,
    });

    controller.pointerDown(sample(60, 55));
    now.value = 4;
    controller.pointerMove(sample(64, 55));
    scheduler.advanceTo(1_000);
    controller.pointerUp(sample(70, 55));

    expect(events).toEqual(["DRAG_START", "DRAG_END"]);
  });
});
