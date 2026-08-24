import { describe, expect, it, vi } from "vitest";
import { derivePetWindowLayoutSpecs } from "../../core/pet/characterDisplay";
import type { DesktopWindowManager } from "./windowManager";
import { WindowLayoutCoordinator } from "./windowLayoutCoordinator";

function createManager() {
  const setSize = vi.fn().mockResolvedValue(undefined);
  const setPosition = vi.fn().mockResolvedValue(undefined);
  const manager: DesktopWindowManager = {
    startDragging: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    setPosition,
    setSize,
    getLayoutSnapshot: vi.fn().mockResolvedValue({
      position: { x: 100, y: 100 },
      size: { width: 260, height: 300 },
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1600, height: 1600 },
      },
      scaleFactor: 2,
    }),
    getMovementContext: vi.fn().mockResolvedValue(null),
    setIgnoreCursorEvents: vi.fn().mockResolvedValue(undefined),
    listenCursorMoves: vi.fn().mockResolvedValue(() => undefined),
    onCloseRequested: vi.fn().mockResolvedValue(() => undefined),
  };
  return { manager, setSize, setPosition };
}

describe("WindowLayoutCoordinator", () => {
  it("preserves the captured foot-center while entering chat mode", async () => {
    const { manager, setSize, setPosition } = createManager();
    const coordinator = new WindowLayoutCoordinator({
      windowManager: manager,
      specs: derivePetWindowLayoutSpecs(),
      waitForLayout: async () => undefined,
    });
    let mode = "pet-only";
    let transitioning = false;

    await coordinator.transitionTo("chat", {
      requestMode: (next) => {
        mode = next;
      },
      setTransitioning: (next) => {
        transitioning = next;
      },
      measureCharacterRect: () => ({
        left: 70,
        top: 132,
        width: 119,
        height: 150,
        bottom: 282,
      }),
    });

    expect(mode).toBe("chat");
    expect(transitioning).toBe(false);
    expect(setSize).toHaveBeenLastCalledWith({ width: 420, height: 560 });
    expect(setPosition).toHaveBeenLastCalledWith({ x: 100, y: 100 }, "LAYOUT");
    expect(coordinator.mode).toBe("chat");
  });

  it("uses the shared sizes for action menu and compact panel modes", async () => {
    const { manager, setSize, setPosition } = createManager();
    const coordinator = new WindowLayoutCoordinator({
      windowManager: manager,
      specs: derivePetWindowLayoutSpecs(),
      waitForLayout: async () => undefined,
    });
    const requestMode = vi.fn();
    const hooks = {
      requestMode,
      setTransitioning: vi.fn(),
      measureCharacterRect: () => ({
        left: 70,
        top: 132,
        width: 119,
        height: 150,
        bottom: 282,
      }),
    };

    await coordinator.transitionTo("action-menu", hooks);
    await coordinator.transitionTo("compact-panel", hooks);

    expect(setSize).toHaveBeenNthCalledWith(1, { width: 420, height: 340 });
    expect(setSize).toHaveBeenNthCalledWith(2, { width: 420, height: 420 });
    expect(requestMode).toHaveBeenNthCalledWith(1, "action-menu");
    expect(requestMode).toHaveBeenNthCalledWith(2, "compact-panel");
    expect(setPosition).toHaveBeenCalledWith(expect.any(Object), "LAYOUT");
    expect(coordinator.mode).toBe("compact-panel");
  });

  it("clamps expanded layouts to the monitor work area", async () => {
    const { manager, setPosition } = createManager();
    manager.getLayoutSnapshot = vi.fn().mockResolvedValue({
      position: { x: 1_500, y: 1_450 },
      size: { width: 260, height: 300 },
      workArea: {
        position: { x: 0, y: 0 },
        size: { width: 1_600, height: 1_600 },
      },
      scaleFactor: 1,
    });
    const coordinator = new WindowLayoutCoordinator({
      windowManager: manager,
      specs: derivePetWindowLayoutSpecs(),
      waitForLayout: async () => undefined,
    });

    await coordinator.transitionTo("chat", {
      requestMode: () => undefined,
      setTransitioning: () => undefined,
      measureCharacterRect: () => ({
        left: 130,
        top: 132,
        width: 119,
        height: 150,
        bottom: 282,
      }),
    });

    const layoutPosition = setPosition.mock.calls[0]?.[0] as {
      x: number;
      y: number;
    };
    expect(layoutPosition.x).toBe(1_180);
    expect(layoutPosition.y).toBe(1_040);
  });
});
