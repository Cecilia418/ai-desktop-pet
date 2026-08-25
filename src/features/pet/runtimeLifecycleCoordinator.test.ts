import { afterEach, describe, expect, it, vi } from "vitest";

import { getCharacterDefinition } from "./characterAssets";
import { PetRuntime } from "./PetRuntime";
import { RuntimeLifecycleCoordinator } from "./runtimeLifecycleCoordinator";
import type { DesktopWindowManager } from "../../platform/desktop/windowManager";

function createWindowManager(): DesktopWindowManager {
  return {
    startDragging: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    getMovementContext: vi.fn().mockResolvedValue({
      position: { x: 100, y: 500 },
      bounds: { minX: 0, maxX: 600, bottomY: 500 },
    }),
    setIgnoreCursorEvents: vi.fn().mockResolvedValue(undefined),
    listenCursorMoves: vi.fn().mockResolvedValue(() => undefined),
    onCloseRequested: vi.fn().mockResolvedValue(() => undefined),
  };
}

describe("RuntimeLifecycleCoordinator", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps idle RAF and snapshots alive across StrictMode cleanup and setup", async () => {
    const frameCallbacks: Array<(timestamp: number) => void> = [];
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", (callback: (timestamp: number) => void) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const runtime = new PetRuntime({
      character: getCharacterDefinition(),
      windowManager: createWindowManager(),
    });
    const shutdown = vi.spyOn(runtime, "shutdown");
    const snapshots: number[] = [];
    const unsubscribe = runtime.subscribe((snapshot) => {
      snapshots.push(snapshot.animation.currentFrame);
    });
    const coordinator = new RuntimeLifecycleCoordinator<PetRuntime>();

    runtime.start();
    const firstSetup = coordinator.claim(runtime);
    coordinator.release(firstSetup, (ownedRuntime) => {
      void ownedRuntime.shutdown();
    });
    coordinator.claim(runtime);

    await Promise.resolve();

    expect(shutdown).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).not.toHaveBeenCalled();

    frameCallbacks[0]?.(0);
    frameCallbacks[1]?.(167);
    frameCallbacks[2]?.(334);

    expect(runtime.snapshot.animation).toMatchObject({
      animationName: "idle",
      currentFrame: 2,
      frameCount: 6,
      isPlaying: true,
    });
    expect(snapshots).toEqual(expect.arrayContaining([0, 1, 2]));

    unsubscribe();
    runtime.stop();
    runtime.dispose();
  });

  it("shuts down only the runtime captured by a replaced lease", async () => {
    const firstRuntime = { shutdown: vi.fn(async () => undefined) };
    const secondRuntime = { shutdown: vi.fn(async () => undefined) };
    const coordinator = new RuntimeLifecycleCoordinator<typeof firstRuntime>();

    const firstLease = coordinator.claim(firstRuntime);
    coordinator.release(firstLease, (runtime) => {
      void runtime.shutdown();
    });
    coordinator.claim(secondRuntime);

    await Promise.resolve();

    expect(firstRuntime.shutdown).toHaveBeenCalledOnce();
    expect(secondRuntime.shutdown).not.toHaveBeenCalled();
  });
});
