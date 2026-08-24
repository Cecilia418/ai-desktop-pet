import type { UnlistenFn } from "@tauri-apps/api/event";
import {
  containsPoint,
  type InteractiveRegion,
} from "../../core/pet/interactionGeometry";
import type { CursorSnapshot, DesktopWindowManager } from "./windowManager";

export type { InteractiveRegion } from "../../core/pet/interactionGeometry";

export type InteractiveRegionProvider = () => readonly InteractiveRegion[];

export function isCursorInsideInteractiveRegion(
  snapshot: CursorSnapshot,
  regions: readonly InteractiveRegion[],
): boolean {
  const scaleFactor = snapshot.scaleFactor > 0 ? snapshot.scaleFactor : 1;
  const localX = (snapshot.cursorX - snapshot.windowX) / scaleFactor;
  const localY = (snapshot.cursorY - snapshot.windowY) / scaleFactor;
  return regions.some((region) => containsPoint(region, { x: localX, y: localY }));
}

export class CursorPassthroughController {
  private removeListener: UnlistenFn | undefined;
  private ignoreState: boolean | undefined;
  private dragActive = false;
  private lastSnapshot: CursorSnapshot | undefined;

  public constructor(
    private readonly windowManager: DesktopWindowManager,
    private readonly getInteractiveRegions: InteractiveRegionProvider,
  ) {}

  public async start(): Promise<void> {
    if (this.removeListener) {
      return;
    }

    this.removeListener = await this.windowManager.listenCursorMoves((snapshot) => {
      this.lastSnapshot = snapshot;
      this.applySnapshot(snapshot);
    });
  }

  public async stop(): Promise<void> {
    this.removeListener?.();
    this.removeListener = undefined;
    this.dragActive = false;
    this.lastSnapshot = undefined;
    await this.setIgnoreState(false);
  }

  public setDragActive(active: boolean): void {
    this.dragActive = active;
    if (active) {
      void this.setIgnoreState(false);
    }
  }

  /**
   * Re-evaluates the current cursor against fresh DOM geometry even when the
   * physical pointer has not moved. ResizeObserver and window-layout changes
   * call this method.
   */
  public refresh(): void {
    if (this.lastSnapshot) {
      this.applySnapshot(this.lastSnapshot);
    }
  }

  private applySnapshot(snapshot: CursorSnapshot): void {
    const keepInteractive =
      this.dragActive ||
      snapshot.leftButtonDown ||
      isCursorInsideInteractiveRegion(snapshot, this.getInteractiveRegions());
    void this.setIgnoreState(!keepInteractive);
  }

  private async setIgnoreState(ignore: boolean): Promise<void> {
    if (this.ignoreState === ignore) {
      return;
    }

    this.ignoreState = ignore;
    try {
      await this.windowManager.setIgnoreCursorEvents(ignore);
    } catch {
      // A platform adapter may not support click-through yet. Keep the
      // interactive mode usable and let the normal window error surface it.
      this.ignoreState = undefined;
    }
  }
}
