import {
  resolveInteractionRegion,
  type InteractiveRegion,
  type InteractionPoint,
  type PetInteractionRegion,
} from "../../core/pet/interactionGeometry";
import {
  createPetInteractionEvent,
  type PetInteractionEvent,
} from "./petInteractionEvent";

export const POINTER_DRAG_THRESHOLD_PX = 4;

export interface PointerSample extends InteractionPoint {
  pointerId: number;
  button?: number;
}

export interface InteractionControllerOptions {
  getCharacterRegion: () => InteractiveRegion | null;
  onEvent: (event: PetInteractionEvent) => void;
  now?: () => number;
  dragThresholdPx?: number;
  petHoldThresholdMs?: number;
  petRepeatIntervalMs?: number;
  scheduler?: InteractionTimerScheduler;
}

export interface InteractionTimerScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const defaultScheduler: InteractionTimerScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

interface PointerSession {
  pointerId: number;
  origin: InteractionPoint;
  last: InteractionPoint;
  region: PetInteractionRegion;
  startedAt: number;
  dragging: boolean;
  petTriggered: boolean;
  petRepeatIndex: number;
  holdTimer: ReturnType<typeof setTimeout> | undefined;
  repeatTimer: ReturnType<typeof setTimeout> | undefined;
}

export class InteractionController {
  private readonly getCharacterRegion: () => InteractiveRegion | null;
  private readonly onEvent: (event: PetInteractionEvent) => void;
  private readonly now: () => number;
  private readonly dragThresholdPx: number;
  private readonly petHoldThresholdMs: number;
  private readonly petRepeatIntervalMs: number;
  private readonly scheduler: InteractionTimerScheduler;
  private session: PointerSession | null = null;

  public constructor({
    getCharacterRegion,
    onEvent,
    now = () => Date.now(),
    dragThresholdPx = POINTER_DRAG_THRESHOLD_PX,
    petHoldThresholdMs = 520,
    petRepeatIntervalMs = 1_000,
    scheduler = defaultScheduler,
  }: InteractionControllerOptions) {
    this.getCharacterRegion = getCharacterRegion;
    this.onEvent = onEvent;
    this.now = now;
    this.dragThresholdPx = dragThresholdPx;
    this.petHoldThresholdMs = Math.max(0, petHoldThresholdMs);
    this.petRepeatIntervalMs = Math.max(1, petRepeatIntervalMs);
    this.scheduler = scheduler;
  }

  public get isDragging(): boolean {
    return this.session?.dragging ?? false;
  }

  public pointerDown(sample: PointerSample): boolean {
    if (sample.button !== undefined && sample.button !== 0) {
      return false;
    }

    const characterRegion = this.getCharacterRegion();
    if (!characterRegion) {
      return false;
    }

    const region = resolveInteractionRegion(sample, characterRegion);
    if (!region) {
      return false;
    }

    this.cancel();
    this.session = {
      pointerId: sample.pointerId,
      origin: { x: sample.x, y: sample.y },
      last: { x: sample.x, y: sample.y },
      region,
      startedAt: this.now(),
      dragging: false,
      petTriggered: false,
      petRepeatIndex: 0,
      holdTimer: undefined,
      repeatTimer: undefined,
    };
    if (region === "HEAD") {
      this.schedulePetHold(this.session);
    }
    return true;
  }

  public pointerMove(sample: PointerSample): boolean {
    const session = this.sessionFor(sample);
    if (!session) {
      return false;
    }

    const deltaX = sample.x - session.last.x;
    const deltaY = sample.y - session.last.y;
    session.last = { x: sample.x, y: sample.y };

    if (!session.dragging) {
      if (session.petTriggered) {
        return false;
      }

      const distance = Math.hypot(
        sample.x - session.origin.x,
        sample.y - session.origin.y,
      );
      if (distance < this.dragThresholdPx) {
        return false;
      }

      session.dragging = true;
      this.clearPetTimers(session);
      this.emitDragStart(session.region, {
        pointerId: session.pointerId,
        x: sample.x,
        y: sample.y,
        deltaX,
        deltaY,
      });
      return true;
    }

    this.emitDragMove(session.region, {
      pointerId: session.pointerId,
      x: sample.x,
      y: sample.y,
      deltaX,
      deltaY,
    });
    return true;
  }

  public pointerUp(sample: PointerSample): boolean {
    const session = this.sessionFor(sample);
    if (!session) {
      return false;
    }

    this.session = null;
    this.clearPetTimers(session);
    if (session.dragging) {
      this.emitDragEnd(session.region, {
        pointerId: session.pointerId,
        x: sample.x,
        y: sample.y,
      });
      return true;
    }

    if (session.petTriggered) {
      return true;
    }

    const characterRegion = this.getCharacterRegion();
    const region = characterRegion
      ? resolveInteractionRegion(sample, characterRegion)
      : null;
    if (!region) {
      return false;
    }

    this.onEvent(
      createPetInteractionEvent({
        type: "CLICK",
        timestamp: this.now(),
        source: "pointer",
        region,
        payload: {
          pointerId: session.pointerId,
          x: sample.x,
          y: sample.y,
          durationMs: Math.max(0, this.now() - session.startedAt),
          movementPx: Math.hypot(
            sample.x - session.origin.x,
            sample.y - session.origin.y,
          ),
        },
      }),
    );
    return true;
  }

  public pointerCancel(sample: PointerSample): boolean {
    const session = this.sessionFor(sample);
    if (!session) {
      return false;
    }

    this.session = null;
    this.clearPetTimers(session);
    if (!session.dragging) {
      return true;
    }

    this.emitDragEnd(session.region, {
      pointerId: session.pointerId,
      x: sample.x,
      y: sample.y,
      cancelled: true,
    });
    return true;
  }

  private sessionFor(sample: PointerSample): PointerSession | null {
    if (!this.session || this.session.pointerId !== sample.pointerId) {
      return null;
    }
    return this.session;
  }

  public cancel(): void {
    if (this.session) {
      this.clearPetTimers(this.session);
    }
    this.session = null;
  }

  private schedulePetHold(session: PointerSession): void {
    session.holdTimer = this.scheduler.setTimeout(() => {
      if (this.session !== session || session.dragging || session.petTriggered) {
        return;
      }

      this.emitPet(session);
      this.schedulePetRepeat(session);
    }, this.petHoldThresholdMs);
  }

  private schedulePetRepeat(session: PointerSession): void {
    session.repeatTimer = this.scheduler.setTimeout(() => {
      if (this.session !== session || session.dragging) {
        return;
      }

      this.emitPet(session);
      this.schedulePetRepeat(session);
    }, this.petRepeatIntervalMs);
  }

  private emitPet(session: PointerSession): void {
    session.petTriggered = true;
    const repeatIndex = session.petRepeatIndex;
    session.petRepeatIndex += 1;
    const sample = session.last;
    this.onEvent(
      createPetInteractionEvent({
        type: "PET",
        timestamp: this.now(),
        source: "pointer",
        region: "HEAD",
        payload: {
          pointerId: session.pointerId,
          x: sample.x,
          y: sample.y,
          holdDurationMs: Math.max(0, this.now() - session.startedAt),
          repeatIndex,
        },
      }),
    );
  }

  private clearPetTimers(session: PointerSession): void {
    if (session.holdTimer !== undefined) {
      this.scheduler.clearTimeout(session.holdTimer);
      session.holdTimer = undefined;
    }
    if (session.repeatTimer !== undefined) {
      this.scheduler.clearTimeout(session.repeatTimer);
      session.repeatTimer = undefined;
    }
  }

  private emitDragStart(
    region: PetInteractionRegion,
    payload: {
      pointerId: number;
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
    },
  ): void {
    this.onEvent(
      createPetInteractionEvent({
        type: "DRAG_START",
        timestamp: this.now(),
        source: "pointer",
        region,
        payload,
      }),
    );
  }

  private emitDragMove(
    region: PetInteractionRegion,
    payload: {
      pointerId: number;
      x: number;
      y: number;
      deltaX: number;
      deltaY: number;
    },
  ): void {
    this.onEvent(
      createPetInteractionEvent({
        type: "DRAG_MOVE",
        timestamp: this.now(),
        source: "pointer",
        region,
        payload,
      }),
    );
  }

  private emitDragEnd(
    region: PetInteractionRegion,
    payload: {
      pointerId: number;
      x: number;
      y: number;
      cancelled?: boolean;
    },
  ): void {
    this.onEvent(
      createPetInteractionEvent({
        type: "DRAG_END",
        timestamp: this.now(),
        source: "pointer",
        region,
        payload,
      }),
    );
  }
}
