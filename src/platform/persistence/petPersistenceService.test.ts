import { describe, expect, it, vi } from "vitest";
import { PetPersistenceService } from "./petPersistenceService";
import type { PetPersistenceRepository } from "./petPersistenceRepository";
import type { PersistedPetState } from "./petPersistenceTypes";

const state: PersistedPetState = {
  stats: { hunger: 82, mood: 85, energy: 78, intimacy: 60 },
  lastRuntimeTimestamp: 1_700_000_000_000,
  lastActivity: "IDLE",
  position: { x: 100, y: 200 },
};

function repository(): PetPersistenceRepository & { saves: PersistedPetState[] } {
  const saves: PersistedPetState[] = [];
  return {
    saves,
    load: vi.fn(async () => state),
    save: vi.fn(async (next) => {
      saves.push(next);
    }),
  };
}

describe("PetPersistenceService", () => {
  it("coalesces scheduled changes and writes the latest state", async () => {
    vi.useFakeTimers();
    const repo = repository();
    const service = new PetPersistenceService({ repository: repo, debounceMs: 100 });
    service.scheduleSave(state);
    service.scheduleSave({ ...state, stats: { ...state.stats, mood: 90 } });

    await vi.advanceTimersByTimeAsync(100);
    expect(repo.saves).toEqual([
      { ...state, stats: { ...state.stats, mood: 90 } },
    ]);
    service.dispose();
    vi.useRealTimers();
  });

  it("flushes immediately and preserves writes requested during a write", async () => {
    let resolveFirst: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const repo: PetPersistenceRepository = {
      load: async () => null,
      save: vi.fn(async (next) => {
        if (next.stats.mood === 85) {
          await firstWrite;
        }
      }),
    };
    const service = new PetPersistenceService({ repository: repo });
    service.scheduleSave(state);
    const flushPromise = service.flush();
    service.scheduleSave({ ...state, stats: { ...state.stats, mood: 91 } });
    resolveFirst?.();
    await flushPromise;
    await service.flush();

    expect(repo.save).toHaveBeenCalledTimes(2);
    expect(repo.save).toHaveBeenLastCalledWith({
      ...state,
      stats: { ...state.stats, mood: 91 },
    });
    service.dispose();
  });

  it("reports repository failures without hiding the failure from flush callers", async () => {
    const error = new Error("disk full");
    const onError = vi.fn();
    const repo: PetPersistenceRepository = {
      load: async () => null,
      save: async () => {
        throw error;
      },
    };
    const service = new PetPersistenceService({ repository: repo, onError });

    await expect(service.flush(state)).rejects.toThrow("disk full");
    expect(onError).toHaveBeenCalledWith(error);
    service.dispose();
  });
});
