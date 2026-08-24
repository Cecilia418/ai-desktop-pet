import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
} from "@tauri-apps/api/window";
import type { DesktopPosition, MovementBounds } from "../../core/pet/movementController";
import {
  PositionWriteQueue,
  type PositionWriteDebugSnapshot,
  type WindowPositionOwner,
} from "./positionWriteQueue";

export const CURSOR_MOVED_EVENT = "platform://cursor-moved";
export const WINDOW_VISIBILITY_EVENT = "platform://window-visibility";

export interface CursorSnapshot {
  cursorX: number;
  cursorY: number;
  windowX: number;
  windowY: number;
  scaleFactor: number;
  leftButtonDown: boolean;
}

export interface MovementContext {
  position: DesktopPosition;
  bounds: MovementBounds;
  windowSize?: { width: number; height: number };
  workArea?: {
    position: DesktopPosition;
    size: { width: number; height: number };
  };
  scaleFactor?: number;
}

export interface WindowLayoutSnapshot {
  position: DesktopPosition;
  size: { width: number; height: number };
  workArea: {
    position: DesktopPosition;
    size: { width: number; height: number };
  };
  scaleFactor: number;
}

export interface WindowVisibilitySnapshot {
  readonly visible: boolean;
}

export interface DesktopWindowManager {
  startDragging(): Promise<void>;
  hide(): Promise<void>;
  show(): Promise<void>;
  setPosition(
    position: DesktopPosition,
    owner?: WindowPositionOwner,
  ): Promise<void>;
  setSize(size: { width: number; height: number }): Promise<void>;
  getLayoutSnapshot?: () => Promise<WindowLayoutSnapshot | null>;
  getMovementContext(): Promise<MovementContext | null>;
  setIgnoreCursorEvents(ignore: boolean): Promise<void>;
  listenCursorMoves(handler: (snapshot: CursorSnapshot) => void): Promise<UnlistenFn>;
  onCloseRequested(handler: () => Promise<void>): Promise<UnlistenFn>;
  acquirePositionOwner?: (
    owner: Exclude<WindowPositionOwner, "HIDDEN">,
  ) => Promise<boolean>;
  releasePositionOwner?: (
    owner: Exclude<WindowPositionOwner, "HIDDEN">,
  ) => void;
  invalidateMovementPositionWrites?: () => void;
  getPositionWriteDebugSnapshot?: () => PositionWriteDebugSnapshot;
  onVisibilityChanged?: (
    handler: (visible: boolean) => void,
  ) => Promise<UnlistenFn>;
  onLayoutChanged?: (handler: () => void) => Promise<UnlistenFn>;
}

const currentWindow = getCurrentWindow();
const positionQueue = new PositionWriteQueue((position) =>
  currentWindow.setPosition(
    new PhysicalPosition(Math.round(position.x), Math.round(position.y)),
  ),
);
const visibilityListeners = new Set<(visible: boolean) => void>();

function notifyVisibility(visible: boolean): void {
  for (const listener of visibilityListeners) {
    listener(visible);
  }
}

function logWindowDebug(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    console.debug(...args);
  }
}

/**
 * The UI talks to this adapter instead of importing Tauri window APIs.
 * A future macOS implementation can provide the same interface without
 * changing the pet feature.
 */
export const desktopWindowManager: DesktopWindowManager = {
  startDragging: async () => {
    const acquired = await positionQueue.acquire("DRAG");
    if (!acquired) {
      throw new Error("desktop position is not available for dragging");
    }
    try {
      await currentWindow.startDragging();
    } catch (error) {
      positionQueue.release("DRAG");
      throw error;
    }
  },
  hide: async () => {
    logWindowDebug("DesktopWindowManager.hide()");
    positionQueue.setHidden();
    await currentWindow.hide();
    logWindowDebug("Tauri hide invoked");
    notifyVisibility(false);
    try {
      logWindowDebug("visibility after hide", await currentWindow.isVisible());
    } catch {
      logWindowDebug("visibility after hide", "unknown");
    }
  },
  show: async () => {
    positionQueue.setVisible();
    await currentWindow.show();
    await currentWindow.setFocus();
    notifyVisibility(true);
  },
  setPosition: (position, owner = "WALKING") => {
    if (owner === "LAYOUT") {
      return positionQueue.writeLayout(position);
    }
    if (owner === "WALKING") {
      return positionQueue.enqueueMovement(position);
    }
    return Promise.resolve();
  },
  setSize: (size) =>
    currentWindow.setSize(new LogicalSize(size.width, size.height)),
  getLayoutSnapshot: async () => {
    const [position, size, monitor] = await Promise.all([
      currentWindow.outerPosition(),
      currentWindow.innerSize(),
      currentMonitor(),
    ]);
    if (!monitor) {
      return null;
    }

    const scaleFactor = monitor.scaleFactor > 0 ? monitor.scaleFactor : 1;
    return {
      position: { x: position.x, y: position.y },
      size: {
        width: size.width / scaleFactor,
        height: size.height / scaleFactor,
      },
      workArea: {
        position: {
          x: monitor.workArea.position.x,
          y: monitor.workArea.position.y,
        },
        size: {
          width: monitor.workArea.size.width,
          height: monitor.workArea.size.height,
        },
      },
      scaleFactor,
    };
  },
  getMovementContext: async () => {
    const [position, size, monitor] = await Promise.all([
      currentWindow.outerPosition(),
      currentWindow.innerSize(),
      currentMonitor(),
    ]);
    if (!monitor) {
      return null;
    }

    const workArea = monitor.workArea;
    const windowWidth = Math.min(size.width, workArea.size.width);
    const windowHeight = Math.min(size.height, workArea.size.height);
    const minX = workArea.position.x;
    const maxX = Math.max(
      minX,
      workArea.position.x + workArea.size.width - windowWidth,
    );

    return {
      position: { x: position.x, y: position.y },
      bounds: {
        minX,
        maxX,
        bottomY: workArea.position.y + workArea.size.height - windowHeight - 8,
      },
      windowSize: { width: windowWidth, height: windowHeight },
      workArea: {
        position: {
          x: workArea.position.x,
          y: workArea.position.y,
        },
        size: {
          width: workArea.size.width,
          height: workArea.size.height,
        },
      },
      scaleFactor: monitor.scaleFactor,
    };
  },
  setIgnoreCursorEvents: (ignore) => currentWindow.setIgnoreCursorEvents(ignore),
  listenCursorMoves: (handler) =>
    listen<CursorSnapshot>(CURSOR_MOVED_EVENT, (event) => handler(event.payload)),
  onCloseRequested: async (handler) =>
    currentWindow.onCloseRequested((event) => {
      event.preventDefault();
      void handler();
    }),
  acquirePositionOwner: (owner) => positionQueue.acquire(owner),
  releasePositionOwner: (owner) => positionQueue.release(owner),
  invalidateMovementPositionWrites: () => positionQueue.invalidateMovementWrites(),
  getPositionWriteDebugSnapshot: () => positionQueue.debugSnapshot,
  onVisibilityChanged: async (handler) => {
    const listener = (visible: boolean) => handler(visible);
    visibilityListeners.add(listener);
    const removeNative = await listen<WindowVisibilitySnapshot>(
      WINDOW_VISIBILITY_EVENT,
      (event) => {
        if (event.payload.visible) {
          positionQueue.setVisible();
        } else {
          positionQueue.setHidden();
        }
        notifyVisibility(event.payload.visible);
      },
    );
    return () => {
      visibilityListeners.delete(listener);
      removeNative();
    };
  },
  onLayoutChanged: async (handler) => {
    const removeResize = await currentWindow.onResized(() => handler());
    const removeScale = await currentWindow.onScaleChanged(() => handler());
    return () => {
      removeResize();
      removeScale();
    };
  },
};
