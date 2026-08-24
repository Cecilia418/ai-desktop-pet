export type PetEffectKind =
  | "PET"
  | "POKE"
  | "POKE_ANNOYED"
  | "FEED"
  | "FULL"
  | "DRAG";

export interface PetEffectSnapshot {
  readonly id: number;
  readonly kind: PetEffectKind;
  readonly startedAt: number;
  readonly asset?: string;
  readonly foodId?: string;
}

export interface PetEffectScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const defaultScheduler: PetEffectScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

const DEFAULT_EFFECT_DURATIONS: Readonly<Record<PetEffectKind, number>> = {
  PET: 620,
  POKE: 520,
  POKE_ANNOYED: 620,
  FEED: 900,
  FULL: 720,
  DRAG: 420,
};

type SnapshotListener = (snapshot: PetEffectSnapshot | null) => void;

export interface TriggerPetEffectOptions {
  readonly asset?: string;
  readonly foodId?: string;
  readonly durationMs?: number;
  readonly startedAt?: number;
}

export class PetEffectController {
  private readonly listeners = new Set<SnapshotListener>();
  private currentSnapshot: PetEffectSnapshot | null = null;
  private expirationTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 0;

  public constructor(
    private readonly scheduler: PetEffectScheduler = defaultScheduler,
    private readonly now: () => number = () => Date.now(),
  ) {}

  public get snapshot(): PetEffectSnapshot | null {
    return this.currentSnapshot;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public trigger(
    kind: PetEffectKind,
    options: TriggerPetEffectOptions = {},
  ): PetEffectSnapshot {
    this.clearExpirationTimer();
    const snapshot: PetEffectSnapshot = {
      id: ++this.nextId,
      kind,
      startedAt: options.startedAt ?? this.now(),
      ...(options.asset ? { asset: options.asset } : {}),
      ...(options.foodId ? { foodId: options.foodId } : {}),
    };
    this.publish(snapshot);

    const duration = Math.max(
      0,
      options.durationMs ?? DEFAULT_EFFECT_DURATIONS[kind],
    );
    this.expirationTimer = this.scheduler.setTimeout(() => {
      this.expirationTimer = undefined;
      this.publish(null);
    }, duration);
    return snapshot;
  }

  public clear(): void {
    this.clearExpirationTimer();
    if (this.currentSnapshot !== null) {
      this.publish(null);
    }
  }

  public dispose(): void {
    this.clearExpirationTimer();
    this.listeners.clear();
  }

  private publish(snapshot: PetEffectSnapshot | null): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private clearExpirationTimer(): void {
    if (this.expirationTimer !== undefined) {
      this.scheduler.clearTimeout(this.expirationTimer);
      this.expirationTimer = undefined;
    }
  }
}
