import type {
  PetWindowLayoutSpec,
  PetWindowLayoutSpecs,
  PetWindowMode,
  LogicalPoint,
} from "../../core/pet/characterDisplay";
import type {
  DesktopWindowManager,
  WindowLayoutSnapshot,
} from "./windowManager";

export interface CharacterRectLike {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly bottom: number;
}

export interface WindowLayoutTransitionHooks {
  requestMode(mode: PetWindowMode): void;
  setTransitioning(transitioning: boolean): void;
  measureCharacterRect(): CharacterRectLike | null;
}

export interface WindowLayoutCoordinatorOptions {
  readonly windowManager: DesktopWindowManager;
  readonly specs: PetWindowLayoutSpecs;
  readonly waitForLayout?: () => Promise<void>;
}

/**
 * Coordinates logical window layout and physical screen positioning. React
 * supplies measurements and presentation callbacks, but this class owns all
 * window API calls and anchor math.
 */
export class WindowLayoutCoordinator {
  private readonly windowManager: DesktopWindowManager;
  private readonly specs: PetWindowLayoutSpecs;
  private readonly waitForLayout: () => Promise<void>;
  private requestId = 0;
  private currentMode: PetWindowMode = "pet-only";
  private pendingMode: PetWindowMode | null = null;

  public constructor({
    windowManager,
    specs,
    waitForLayout = waitForNextLayout,
  }: WindowLayoutCoordinatorOptions) {
    this.windowManager = windowManager;
    this.specs = specs;
    this.waitForLayout = waitForLayout;
  }

  public get mode(): PetWindowMode {
    return this.currentMode;
  }

  public async initialize(): Promise<void> {
    await this.windowManager.setSize(this.specs["pet-only"].windowSize);
    this.currentMode = "pet-only";
    this.pendingMode = null;
  }

  public async transitionTo(
    mode: PetWindowMode,
    hooks: WindowLayoutTransitionHooks,
  ): Promise<void> {
    if (mode === this.currentMode && this.pendingMode === null) {
      return;
    }

    const requestId = ++this.requestId;
    this.pendingMode = mode;
    hooks.setTransitioning(true);
    const acquired = this.windowManager.acquirePositionOwner
      ? await this.windowManager.acquirePositionOwner("LAYOUT")
      : true;
    if (!acquired || requestId !== this.requestId) {
      if (requestId === this.requestId) {
        hooks.setTransitioning(false);
      }
      if (acquired) {
        this.windowManager.releasePositionOwner?.("LAYOUT");
      }
      if (requestId === this.requestId) {
        this.pendingMode = null;
      }
      return;
    }

    const beforeLayout = await this.readLayoutSnapshot();
    if (requestId !== this.requestId) {
      this.windowManager.releasePositionOwner?.("LAYOUT");
      return;
    }

    const beforeRect = hooks.measureCharacterRect();
    const screenAnchor = beforeLayout && beforeRect
      ? toScreenPoint(footCenter(beforeRect), beforeLayout)
      : null;

    try {
      await this.windowManager.setSize(this.specs[mode].windowSize);
      if (requestId !== this.requestId) {
        return;
      }

      hooks.requestMode(mode);
      await this.waitForLayout();
      if (requestId !== this.requestId) {
        return;
      }

      const targetSpec = this.specs[mode];
      const targetRect = hooks.measureCharacterRect();
      const targetFootCenter = targetRect
        ? footCenter(targetRect)
        : targetSpec.petLane.footCenterLocal;
      const targetPosition = screenAnchor && beforeLayout
        ? clampPosition(
            {
              x: screenAnchor.x - targetFootCenter.x * beforeLayout.scaleFactor,
              y: screenAnchor.y - targetFootCenter.y * beforeLayout.scaleFactor,
            },
            targetSpec,
            beforeLayout,
          )
        : null;

      if (targetPosition) {
        await this.windowManager.setPosition(targetPosition, "LAYOUT");
      }
      if (requestId !== this.requestId) {
        return;
      }

      await this.correctForDpiRounding(
        requestId,
        screenAnchor,
        targetSpec,
        targetFootCenter,
      );
      if (requestId === this.requestId) {
        this.currentMode = mode;
        this.pendingMode = null;
      }
    } finally {
      if (requestId === this.requestId) {
        this.pendingMode = null;
        hooks.setTransitioning(false);
      }
      this.windowManager.releasePositionOwner?.("LAYOUT");
    }
  }

  public invalidatePendingTransition(): void {
    this.requestId += 1;
    this.pendingMode = null;
  }

  private async correctForDpiRounding(
    requestId: number,
    screenAnchor: LogicalPoint | null,
    targetSpec: PetWindowLayoutSpec,
    targetFootCenter: LogicalPoint,
  ): Promise<void> {
    if (!screenAnchor || requestId !== this.requestId) {
      return;
    }
    const afterLayout = await this.readLayoutSnapshot();
    if (!afterLayout || requestId !== this.requestId) {
      return;
    }

    const corrected = clampPosition(
      {
        x: screenAnchor.x - targetFootCenter.x * afterLayout.scaleFactor,
        y: screenAnchor.y - targetFootCenter.y * afterLayout.scaleFactor,
      },
      targetSpec,
      afterLayout,
    );
    const current = afterLayout.position;
    if (
      Math.abs(current.x - corrected.x) > 1 ||
      Math.abs(current.y - corrected.y) > 1
    ) {
      await this.windowManager.setPosition(corrected, "LAYOUT");
    }
  }

  private async readLayoutSnapshot(): Promise<WindowLayoutSnapshot | null> {
    if (this.windowManager.getLayoutSnapshot) {
      return this.windowManager.getLayoutSnapshot();
    }

    const context = await this.windowManager.getMovementContext();
    if (!context || !context.windowSize || !context.workArea) {
      return null;
    }
    const scaleFactor = context.scaleFactor && context.scaleFactor > 0
      ? context.scaleFactor
      : 1;
    return {
      position: { ...context.position },
      size: {
        width: context.windowSize.width / scaleFactor,
        height: context.windowSize.height / scaleFactor,
      },
      workArea: {
        position: { ...context.workArea.position },
        size: { ...context.workArea.size },
      },
      scaleFactor,
    };
  }
}

function footCenter(rect: CharacterRectLike): LogicalPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom,
  };
}

function toScreenPoint(
  localPoint: LogicalPoint,
  layout: WindowLayoutSnapshot,
): LogicalPoint {
  return {
    x: layout.position.x + localPoint.x * layout.scaleFactor,
    y: layout.position.y + localPoint.y * layout.scaleFactor,
  };
}

function clampPosition(
  position: { x: number; y: number },
  targetSpec: PetWindowLayoutSpec,
  layout: WindowLayoutSnapshot,
): { x: number; y: number } {
  const scale = layout.scaleFactor > 0 ? layout.scaleFactor : 1;
  const targetWidth = targetSpec.windowSize.width * scale;
  const targetHeight = targetSpec.windowSize.height * scale;
  const minX = layout.workArea.position.x;
  const minY = layout.workArea.position.y;
  const maxX = Math.max(
    minX,
    layout.workArea.position.x + layout.workArea.size.width - targetWidth,
  );
  const maxY = Math.max(
    minY,
    layout.workArea.position.y + layout.workArea.size.height - targetHeight,
  );
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function waitForNextLayout(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}
