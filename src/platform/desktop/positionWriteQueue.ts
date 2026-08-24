import type { DesktopPosition } from "../../core/pet/movementController";

export type WindowPositionOwner = "WALKING" | "LAYOUT" | "DRAG" | "HIDDEN";

export interface PositionWriteDebugSnapshot {
  readonly owner: WindowPositionOwner | null;
  readonly queueLength: number;
  readonly writeInFlight: boolean;
  readonly generation: number;
  readonly requestedPosition: DesktopPosition | null;
  readonly completedPosition: DesktopPosition | null;
}

interface PendingMovementWrite {
  readonly position: DesktopPosition;
  readonly generation: number;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

type ActiveOwner = Exclude<WindowPositionOwner, "HIDDEN">;

/**
 * Serializes programmatic desktop position writes and gives layout/drag
 * transitions a way to invalidate stale autonomous movement proposals.
 */
export class PositionWriteQueue {
  private owner: WindowPositionOwner | null = null;
  private generation = 0;
  private writeInFlight = false;
  private pendingMovement: PendingMovementWrite | null = null;
  private requestedPosition: DesktopPosition | null = null;
  private completedPosition: DesktopPosition | null = null;
  private idleWaiters: Array<() => void> = [];

  public constructor(
    private readonly write: (position: DesktopPosition) => Promise<void>,
  ) {}

  public get debugSnapshot(): PositionWriteDebugSnapshot {
    return {
      owner: this.owner,
      queueLength: (this.pendingMovement ? 1 : 0) +
        (this.writeInFlight ? 1 : 0),
      writeInFlight: this.writeInFlight,
      generation: this.generation,
      requestedPosition: this.requestedPosition
        ? { ...this.requestedPosition }
        : null,
      completedPosition: this.completedPosition
        ? { ...this.completedPosition }
        : null,
    };
  }

  public async acquire(owner: ActiveOwner): Promise<boolean> {
    if (this.owner === "HIDDEN") {
      return false;
    }

    if (this.owner === "DRAG" && owner !== "DRAG") {
      return false;
    }

    if (this.owner === "LAYOUT" && owner !== "LAYOUT") {
      return false;
    }

    this.owner = owner;
    this.invalidateMovementWrites();
    await this.waitForIdle();
    return this.owner === owner;
  }

  public release(owner: ActiveOwner): void {
    if (this.owner !== owner) {
      return;
    }
    this.owner = null;
  }

  public setHidden(): void {
    this.invalidateMovementWrites();
    this.owner = "HIDDEN";
  }

  public setVisible(): void {
    if (this.owner === "HIDDEN") {
      this.owner = null;
    }
  }

  public invalidateMovementWrites(): void {
    this.generation += 1;
    if (this.pendingMovement) {
      this.pendingMovement.resolve();
      this.pendingMovement = null;
    }
  }

  public enqueueMovement(position: DesktopPosition): Promise<void> {
    if (this.owner === "HIDDEN" || this.owner === "LAYOUT" || this.owner === "DRAG") {
      return Promise.resolve();
    }

    if (!this.owner) {
      this.owner = "WALKING";
    }

    const generation = this.generation;
    return new Promise<void>((resolve, reject) => {
      this.pendingMovement?.resolve();
      this.pendingMovement = {
        position: { ...position },
        generation,
        resolve,
        reject,
      };
      this.requestedPosition = { ...position };
      void this.flushMovement();
    });
  }

  public async writeLayout(position: DesktopPosition): Promise<void> {
    if (this.owner !== "LAYOUT") {
      return;
    }

    await this.waitForIdle();
    if (this.owner !== "LAYOUT") {
      return;
    }

    this.requestedPosition = { ...position };
    this.writeInFlight = true;
    try {
      await this.write(position);
      this.completedPosition = { ...position };
    } finally {
      this.writeInFlight = false;
      this.notifyIdle();
    }
  }

  private async flushMovement(): Promise<void> {
    if (
      this.writeInFlight ||
      !this.pendingMovement ||
      this.owner !== "WALKING"
    ) {
      return;
    }

    const request = this.pendingMovement;
    this.pendingMovement = null;
    if (request.generation !== this.generation) {
      request.resolve();
      return;
    }

    this.writeInFlight = true;
    try {
      await this.write(request.position);
      this.completedPosition = { ...request.position };
      request.resolve();
    } catch (error) {
      request.reject(error);
    } finally {
      this.writeInFlight = false;
      this.notifyIdle();
      const pendingMovement = this.pendingMovement as PendingMovementWrite | null;
      if (
        this.owner === "WALKING" &&
        pendingMovement &&
        pendingMovement.generation === this.generation
      ) {
        void this.flushMovement();
      }
    }
  }

  private waitForIdle(): Promise<void> {
    if (!this.writeInFlight) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleWaiters.push(resolve);
    });
  }

  private notifyIdle(): void {
    if (this.writeInFlight) {
      return;
    }
    const waiters = this.idleWaiters.splice(0);
    for (const resolve of waiters) {
      resolve();
    }
  }
}
