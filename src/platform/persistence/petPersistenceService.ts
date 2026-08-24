import type { PetPersistenceRepository } from "./petPersistenceRepository";
import type { PersistedPetState } from "./petPersistenceTypes";

export interface PetPersistenceServiceOptions {
  readonly repository: PetPersistenceRepository;
  readonly debounceMs?: number;
  readonly onError?: (error: unknown) => void;
}

/** Coordinates durable writes without knowing SQL or React presentation state. */
export class PetPersistenceService {
  private readonly repository: PetPersistenceRepository;
  private readonly debounceMs: number;
  private readonly onError?: (error: unknown) => void;
  private pending: PersistedPetState | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private writeInFlight: Promise<void> | null = null;
  private disposed = false;

  public constructor({ repository, debounceMs = 1_000, onError }: PetPersistenceServiceOptions) {
    this.repository = repository;
    this.debounceMs = debounceMs;
    this.onError = onError;
  }

  public load(): Promise<PersistedPetState | null> {
    return this.repository.load();
  }

  public scheduleSave(state: PersistedPetState): void {
    if (this.disposed) {
      return;
    }
    this.pending = state;
    if (this.timer !== undefined || this.writeInFlight !== null) {
      return;
    }
    this.timer = globalThis.setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch(() => undefined);
    }, this.debounceMs);
  }

  public async flush(state?: PersistedPetState): Promise<void> {
    if (state) {
      this.pending = state;
    }
    if (this.timer !== undefined) {
      globalThis.clearTimeout(this.timer);
      this.timer = undefined;
    }

    while (this.pending !== null || this.writeInFlight !== null) {
      if (this.writeInFlight !== null) {
        await this.writeInFlight;
        continue;
      }

      const next = this.pending;
      this.pending = null;
      if (!next) {
        continue;
      }

      this.writeInFlight = this.repository.save(next);
      try {
        await this.writeInFlight;
      } catch (error) {
        this.onError?.(error);
        throw error;
      } finally {
        this.writeInFlight = null;
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    if (this.timer !== undefined) {
      globalThis.clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = null;
  }
}
