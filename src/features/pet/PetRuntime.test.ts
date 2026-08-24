import { afterEach, describe, expect, it, vi } from "vitest";

import { getCharacterDefinition } from "./characterAssets";
import { PetRuntime } from "./PetRuntime";
import { createPetInteractionEvent } from "./petInteractionEvent";
import { DEFAULT_PET_BALANCE } from "../../core/pet/petBalance";
import type { DesktopWindowManager } from "../../platform/desktop/windowManager";
import { PetPersistenceService } from "../../platform/persistence/petPersistenceService";
import type { PetPersistenceRepository } from "../../platform/persistence/petPersistenceRepository";

function createWindowManager() {
  const setPosition = vi.fn().mockResolvedValue(undefined);
  const manager: DesktopWindowManager = {
    startDragging: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setPosition,
    setSize: vi.fn().mockResolvedValue(undefined),
    getMovementContext: vi.fn().mockResolvedValue({
      position: { x: 100, y: 500 },
      bounds: { minX: 0, maxX: 600, bottomY: 500 },
    }),
    setIgnoreCursorEvents: vi.fn().mockResolvedValue(undefined),
    listenCursorMoves: vi.fn().mockResolvedValue(() => undefined),
    onCloseRequested: vi.fn().mockResolvedValue(() => undefined),
  };

  return { manager, setPosition };
}

describe("PetRuntime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays walk animation and moves the desktop window together", async () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { manager, setPosition } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      now: () => 0,
    });

    runtime.start();
    await Promise.resolve();
    runtime.transitionTo("WALKING", "debug");
    await Promise.resolve();

    frameCallbacks[0]?.(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    frameCallbacks[1]?.(250);

    expect(runtime.snapshot.state).toBe("WALKING");
    expect(runtime.snapshot.animation.animationName).toBe("walk");
    expect(setPosition).toHaveBeenLastCalledWith({ x: 111, y: 500 }, "WALKING");

    runtime.stop();
  });

  it("hydrates offline progress and restores a clamped compact position", async () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { manager, setPosition } = createWindowManager();
    const saved = {
      stats: { hunger: 82, mood: 85, energy: 78, intimacy: 60 },
      lastRuntimeTimestamp: 1_700_000_000_000,
      lastActivity: "SLEEPING" as const,
      position: { x: 9_999, y: 9_999 },
    };
    const repository: PetPersistenceRepository = {
      load: vi.fn(async () => saved),
      save: vi.fn(async () => undefined),
    };
    const persistenceService = new PetPersistenceService({ repository });
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      now: () => 1_700_000_000_000 + 2 * 60 * 60 * 1_000,
      persistenceService,
    });

    await runtime.initialize();

    expect(runtime.snapshot.stats).toEqual({
      hunger: 74,
      mood: 85,
      energy: 100,
      intimacy: 60,
    });
    expect(runtime.snapshot.state).toBe("IDLE");
    expect(runtime.snapshot.position).toEqual({ x: 600, y: 500 });
    expect(setPosition).toHaveBeenCalledWith({ x: 600, y: 500 }, "LAYOUT");
    expect(frameCallbacks).toHaveLength(1);

    await runtime.shutdown();
    expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      stats: runtime.snapshot.stats,
      position: { x: 600, y: 500 },
    }));
    runtime.dispose();
  });

  it("wakes from sleeping through the normal state transition", () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });

    runtime.transitionTo("SLEEPING", "debug");
    expect(runtime.snapshot.animation.animationName).toBe("sleep");

    runtime.wake();
    expect(runtime.snapshot.state).toBe("IDLE");
    expect(runtime.snapshot.animation.animationName).toBe("idle");
  });

  it("does not start walking just because time passes while idle", async () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    let now = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      now: () => now,
    });

    runtime.start();
    frameCallbacks[0]?.(0);
    now = 7_000;
    frameCallbacks[1]?.(7_000);

    expect(runtime.snapshot.state).toBe("IDLE");
    runtime.stop();
  });

  it("blocks autonomous movement while the real window is hidden", async () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { manager, setPosition } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });

    runtime.start();
    await Promise.resolve();
    runtime.transitionTo("WALKING", "debug");
    await Promise.resolve();
    runtime.setWindowVisible(false);
    frameCallbacks[0]?.(0);
    frameCallbacks[1]?.(250);

    expect(runtime.snapshot.state).toBe("IDLE");
    expect(setPosition).not.toHaveBeenCalled();
    expect(runtime.movementDebugSnapshot.positionOwner).toBe("HIDDEN");

    runtime.setWindowVisible(true);
    expect(runtime.snapshot.state).toBe("IDLE");
    runtime.stop();
  });

  it("sleeps at the energy threshold and wakes at the configured threshold", () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    let now = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      balance: {
        ...DEFAULT_PET_BALANCE,
        initialStats: { ...DEFAULT_PET_BALANCE.initialStats, energy: 20 },
        sleepEnergyRecoveryPerHour: 60,
      },
      now: () => now,
    });

    runtime.start();
    frameCallbacks[0]?.(0);
    now = 1_000;
    frameCallbacks[1]?.(1_000);
    expect(runtime.snapshot.state).toBe("SLEEPING");

    now += 60 * 60 * 1_000;
    frameCallbacks[2]?.(2_000);
    expect(runtime.snapshot.state).toBe("IDLE");
    expect(runtime.snapshot.stats.energy).toBe(80);
    runtime.stop();
  });

  it("routes an idle click through the local reaction and shared bubble", () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "CLICK",
        timestamp: 1,
        source: "pointer",
        region: "HEAD",
        payload: {
          pointerId: 1,
          x: 60,
          y: 55,
          durationMs: 80,
          movementPx: 0,
        },
      }),
    );

    expect(runtime.snapshot.state).toBe("IDLE");
    expect(runtime.speechBubble.snapshot.state).toBe("showing");
    runtime.dispose();
  });

  it("wakes sleeping through a click event and forceWake path", () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });

    runtime.transitionTo("SLEEPING", "debug");
    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "CLICK",
        timestamp: 1,
        source: "pointer",
        region: "CHARACTER",
        payload: {
          pointerId: 1,
          x: 60,
          y: 80,
          durationMs: 80,
          movementPx: 0,
        },
      }),
    );

    expect(runtime.snapshot.state).toBe("IDLE");
    expect(runtime.speechBubble.snapshot.message).toBe("唔……妈妈把我叫醒啦。");
    runtime.dispose();
  });

  it("pauses autonomous movement during drag and settles to idle", async () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { manager, setPosition } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });

    runtime.start();
    await Promise.resolve();
    runtime.transitionTo("WALKING", "debug");
    await Promise.resolve();
    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "DRAG_START",
        timestamp: 1,
        source: "pointer",
        region: "BODY",
        payload: {
          pointerId: 1,
          x: 60,
          y: 100,
          deltaX: 4,
          deltaY: 0,
        },
      }),
    );

    frameCallbacks[0]?.(0);
    frameCallbacks[1]?.(250);
    await Promise.resolve();

    expect(manager.startDragging).toHaveBeenCalledTimes(1);
    expect(setPosition).not.toHaveBeenCalled();

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "DRAG_END",
        timestamp: 2,
        source: "pointer",
        region: "BODY",
        payload: {
          pointerId: 1,
          x: 70,
          y: 100,
        },
      }),
    );
    expect(runtime.snapshot.state).toBe("IDLE");
    runtime.dispose();
  });

  it("limits PET mood and intimacy rewards independently while repeating feedback", () => {
    let now = 0;
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      now: () => now,
    });
    const petEvent = (timestamp: number) => createPetInteractionEvent({
      type: "PET",
      timestamp,
      source: "pointer",
      region: "HEAD",
      payload: {
        pointerId: 1,
        x: 60,
        y: 55,
        holdDurationMs: timestamp,
        repeatIndex: timestamp === 0 ? 0 : 1,
      },
    });

    runtime.handleInteraction(petEvent(0));
    expect(runtime.snapshot.stats).toMatchObject({ mood: 88, intimacy: 61 });
    const firstEffectId = runtime.snapshot.effect?.id;

    now = 500;
    runtime.handleInteraction(petEvent(500));
    expect(runtime.snapshot.stats).toMatchObject({ mood: 88, intimacy: 61 });
    expect(runtime.snapshot.effect?.id).toBeGreaterThan(firstEffectId ?? 0);

    now = 1_700;
    runtime.handleInteraction(petEvent(1_700));
    expect(runtime.snapshot.stats).toMatchObject({ mood: 91, intimacy: 61 });

    now = 10_001;
    runtime.handleInteraction(petEvent(10_001));
    expect(runtime.snapshot.stats).toMatchObject({ mood: 94, intimacy: 62 });
    runtime.dispose();
  });

  it("does not derive POKE from a BODY click at the PET hold threshold", () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });
    const before = runtime.snapshot.stats;

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "CLICK",
        timestamp: 1,
        source: "pointer",
        region: "BODY",
        payload: {
          pointerId: 1,
          x: 60,
          y: 110,
          durationMs: 520,
          movementPx: 0,
        },
      }),
    );

    expect(runtime.snapshot.stats).toEqual(before);
    expect(runtime.snapshot.effect).toBeNull();
    runtime.dispose();
  });

  it("only produces FULL feedback/effect and no stat changes when already full", () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      balance: {
        ...DEFAULT_PET_BALANCE,
        initialStats: { ...DEFAULT_PET_BALANCE.initialStats, hunger: 96 },
      },
    });
    const before = runtime.snapshot.stats;

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "FEED",
        timestamp: 1,
        source: "pointer",
        payload: { foodId: "strawberry" },
      }),
    );

    expect(runtime.snapshot.stats).toEqual(before);
    expect(runtime.speechBubble.snapshot.message).toBe("妈妈，我真的吃不下啦～");
    expect(runtime.snapshot.effect?.kind).toBe("FULL");
    runtime.dispose();
  });

  it("applies food values through the runtime and limits intimacy at full", () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
      balance: {
        ...DEFAULT_PET_BALANCE,
        initialStats: { ...DEFAULT_PET_BALANCE.initialStats, hunger: 80 },
      },
    });

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "FEED",
        timestamp: 1,
        source: "pointer",
        payload: { foodId: "strawberry" },
      }),
    );
    expect(runtime.snapshot.stats).toMatchObject({
      hunger: 92,
      mood: 88,
      intimacy: 61,
    });

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "FEED",
        timestamp: 2,
        source: "pointer",
        payload: { foodId: "strawberry" },
      }),
    );
    expect(runtime.snapshot.stats).toMatchObject({
      hunger: 100,
      mood: 91,
      intimacy: 61,
    });

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "FEED",
        timestamp: 3,
        source: "pointer",
        payload: { foodId: "strawberry" },
      }),
    );
    expect(runtime.snapshot.stats).toMatchObject({
      hunger: 100,
      mood: 91,
      intimacy: 61,
    });
    runtime.dispose();
  });

  it("opens local chat and keeps chat interactions out of stats", async () => {
    const { manager } = createWindowManager();
    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: manager,
    });
    const before = runtime.snapshot.stats;

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "CHAT_START",
        timestamp: 1,
        source: "pointer",
        payload: { kind: "empty" },
      }),
    );
    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "CHAT_SEND",
        timestamp: 2,
        source: "pointer",
        payload: { message: "妈妈今天好累" },
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runtime.chat.snapshot.messages).toEqual([
      { role: "user", text: "妈妈今天好累" },
      { role: "assistant", text: "妈妈，我现在还在学习怎么和你聊天呢～" },
    ]);
    expect(runtime.snapshot.stats).toEqual(before);

    runtime.handleInteraction(
      createPetInteractionEvent({
        type: "CHAT_CLOSE",
        timestamp: 3,
        source: "pointer",
        payload: { kind: "empty" },
      }),
    );
    expect(runtime.chat.snapshot.isOpen).toBe(false);
    runtime.dispose();
  });
});
