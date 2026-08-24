export type SpeechBubbleState = "hidden" | "showing" | "fading";

export interface SpeechBubbleSnapshot {
  state: SpeechBubbleState;
  message: string | null;
}

export interface SpeechBubbleScheduler {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const DEFAULT_DURATION_MS = 3_600;
const MIN_DURATION_MS = 3_000;
const MAX_DURATION_MS = 5_000;
const FADE_DURATION_MS = 260;

const defaultScheduler: SpeechBubbleScheduler = {
  setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clearTimeout: (handle) => globalThis.clearTimeout(handle),
};

type SnapshotListener = (snapshot: SpeechBubbleSnapshot) => void;

export class SpeechBubbleController {
  private readonly listeners = new Set<SnapshotListener>();
  private currentSnapshot: SpeechBubbleSnapshot = {
    state: "hidden",
    message: null,
  };
  private hideTimer: ReturnType<typeof setTimeout> | undefined;
  private removeTimer: ReturnType<typeof setTimeout> | undefined;

  public constructor(
    private readonly scheduler: SpeechBubbleScheduler = defaultScheduler,
  ) {}

  public get snapshot(): SpeechBubbleSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public show(message: string, durationMs = DEFAULT_DURATION_MS): void {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    this.clearTimers();
    this.publish({ state: "showing", message: trimmedMessage });
    const duration = Math.min(
      MAX_DURATION_MS,
      Math.max(MIN_DURATION_MS, durationMs),
    );
    this.hideTimer = this.scheduler.setTimeout(() => {
      this.publish({ state: "fading", message: trimmedMessage });
      this.removeTimer = this.scheduler.setTimeout(() => {
        this.publish({ state: "hidden", message: null });
      }, FADE_DURATION_MS);
    }, duration);
  }

  public hide(): void {
    this.clearTimers();
    this.publish({ state: "hidden", message: null });
  }

  public dispose(): void {
    this.clearTimers();
    this.listeners.clear();
  }

  private publish(snapshot: SpeechBubbleSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }

  private clearTimers(): void {
    if (this.hideTimer !== undefined) {
      this.scheduler.clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
    if (this.removeTimer !== undefined) {
      this.scheduler.clearTimeout(this.removeTimer);
      this.removeTimer = undefined;
    }
  }
}
