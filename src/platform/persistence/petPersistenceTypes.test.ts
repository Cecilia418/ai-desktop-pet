import { describe, expect, it } from "vitest";
import { normalizePersistedPetState } from "./petPersistenceTypes";

describe("normalizePersistedPetState", () => {
  it("clamps valid stats and preserves the durable boundary", () => {
    expect(normalizePersistedPetState({
      stats: { hunger: 120, mood: 40, energy: 20, intimacy: 60 },
      lastRuntimeTimestamp: 1_700_000_000_000,
      lastActivity: "SLEEPING",
      position: { x: 10, y: 20 },
      activePanel: "chat",
    })).toEqual({
      stats: { hunger: 100, mood: 40, energy: 20, intimacy: 60 },
      lastRuntimeTimestamp: 1_700_000_000_000,
      lastActivity: "SLEEPING",
      position: { x: 10, y: 20 },
    });
  });

  it("rejects invalid timestamps, activities, and positions", () => {
    expect(normalizePersistedPetState({
      stats: { hunger: 50, mood: 50, energy: 50, intimacy: 50 },
      lastRuntimeTimestamp: 0,
      lastActivity: "IDLE",
      position: null,
    })).toBeNull();
    expect(normalizePersistedPetState({
      stats: { hunger: 50, mood: 50, energy: 50, intimacy: 50 },
      lastRuntimeTimestamp: 1_700_000_000_000,
      lastActivity: "CHAT",
      position: null,
    })).toBeNull();
    expect(normalizePersistedPetState({
      stats: { hunger: 50, mood: 50, energy: 50, intimacy: 50 },
      lastRuntimeTimestamp: 1_700_000_000_000,
      lastActivity: "IDLE",
      position: { x: Number.NaN, y: 20 },
    })).toBeNull();
  });
});
