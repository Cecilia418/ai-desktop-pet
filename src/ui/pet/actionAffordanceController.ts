import { DEFAULT_ACTION_MENU_BALANCE, type ActionMenuBalanceConfig } from "./actionMenuBalance";

export type AffordanceVisibility = "hidden" | "visible" | "pending-hide";

export interface ActionAffordanceSnapshot {
  readonly visibility: AffordanceVisibility;
  readonly pointerOverCharacter: boolean;
  readonly pointerOverAffordance: boolean;
  readonly actionMenuOpen: boolean;
  readonly visibleSince: number | null;
}

type SnapshotListener = (snapshot: ActionAffordanceSnapshot) => void;
type TimerHandle = ReturnType<typeof setTimeout>;

/** Presentation-only lifecycle for the small action affordance. */
export class ActionAffordanceController {
  private readonly listeners = new Set<SnapshotListener>();
  private readonly now: () => number;
  private readonly config: Readonly<ActionMenuBalanceConfig>;
  private hideTimer: TimerHandle | undefined;
  private current: ActionAffordanceSnapshot = {
    visibility: "hidden",
    pointerOverCharacter: false,
    pointerOverAffordance: false,
    actionMenuOpen: false,
    visibleSince: null,
  };

  public constructor(
    config: Readonly<ActionMenuBalanceConfig> = DEFAULT_ACTION_MENU_BALANCE,
    now: () => number = () => Date.now(),
  ) {
    this.config = config;
    this.now = now;
  }

  public get snapshot(): ActionAffordanceSnapshot {
    return this.current;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.current);
    return () => this.listeners.delete(listener);
  }

  public pointerEnterCharacter(): void {
    this.patch({ pointerOverCharacter: true });
    this.show();
  }

  public pointerLeaveCharacter(): void {
    this.patch({ pointerOverCharacter: false });
    this.scheduleHide();
  }

  public pointerEnterAffordance(): void {
    this.patch({ pointerOverAffordance: true });
    this.show();
  }

  public pointerLeaveAffordance(): void {
    this.patch({ pointerOverAffordance: false });
    this.scheduleHide();
  }

  public pointerEnterActionArea(): void {
    this.show();
  }

  public pointerLeaveActionArea(): void {
    this.scheduleHide();
  }

  public setActionMenuOpen(open: boolean): void {
    if (open) {
      this.clearHideTimer();
      this.show();
      this.patch({ actionMenuOpen: true });
      return;
    }

    this.patch({ actionMenuOpen: false });
    this.scheduleHide();
  }

  public interactionStarted(): void {
    this.clearHideTimer();
    this.current = {
      visibility: "hidden",
      pointerOverCharacter: false,
      pointerOverAffordance: false,
      actionMenuOpen: false,
      visibleSince: null,
    };
    this.notify();
  }

  public blur(): void {
    this.interactionStarted();
  }

  public dispose(): void {
    this.clearHideTimer();
    this.listeners.clear();
  }

  private show(): void {
    this.clearHideTimer();
    if (this.current.visibility === "hidden") {
      this.current = {
        ...this.current,
        visibility: "visible",
        visibleSince: this.now(),
      };
      this.notify();
      return;
    }

    if (this.current.visibility === "pending-hide") {
      this.patch({ visibility: "visible" });
    }
  }

  private scheduleHide(): void {
    if (
      this.current.actionMenuOpen ||
      this.current.pointerOverCharacter ||
      this.current.pointerOverAffordance ||
      this.current.visibility === "hidden"
    ) {
      return;
    }

    this.clearHideTimer();
    const visibleSince = this.current.visibleSince ?? this.now();
    const visibleElapsed = Math.max(0, this.now() - visibleSince);
    const delay = Math.max(
      this.config.affordanceGracePeriodMs,
      this.config.affordanceMinimumVisibleMs - visibleElapsed,
    );

    this.patch({ visibility: "pending-hide" });
    this.hideTimer = globalThis.setTimeout(() => {
      this.hideTimer = undefined;
      if (
        this.current.actionMenuOpen ||
        this.current.pointerOverCharacter ||
        this.current.pointerOverAffordance
      ) {
        this.show();
        return;
      }

      this.current = {
        ...this.current,
        visibility: "hidden",
        visibleSince: null,
      };
      this.notify();
    }, delay);
  }

  private clearHideTimer(): void {
    if (this.hideTimer !== undefined) {
      globalThis.clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  private patch(patch: Partial<ActionAffordanceSnapshot>): void {
    const next = { ...this.current, ...patch };
    if (
      next.visibility === this.current.visibility &&
      next.pointerOverCharacter === this.current.pointerOverCharacter &&
      next.pointerOverAffordance === this.current.pointerOverAffordance &&
      next.actionMenuOpen === this.current.actionMenuOpen &&
      next.visibleSince === this.current.visibleSince
    ) {
      return;
    }
    this.current = next;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.current);
    }
  }
}
