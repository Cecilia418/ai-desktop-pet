import { describe, expect, it } from "vitest";

import { PetVitals } from "./petVitals";

const initialStats = {
  hunger: 82,
  mood: 85,
  energy: 78,
  intimacy: 60,
};

describe("PetVitals", () => {
  it("decays hunger and active energy using elapsed hours", () => {
    const vitals = new PetVitals(initialStats);

    const next = vitals.advance(30 * 60 * 1_000, "WALKING");

    expect(next.hunger).toBe(80);
    expect(next.energy).toBe(72);
    expect(next.mood).toBe(85);
    expect(next.intimacy).toBe(60);
  });

  it("recovers energy while sleeping without changing relationship values", () => {
    const vitals = new PetVitals({ ...initialStats, energy: 30 });

    const next = vitals.advance(30 * 60 * 1_000, "SLEEPING");

    expect(next.energy).toBe(40);
    expect(next.mood).toBe(85);
    expect(next.intimacy).toBe(60);
  });

  it("keeps mood stable while idle", () => {
    const vitals = new PetVitals(initialStats);

    expect(vitals.advance(24 * 60 * 60 * 1_000, "IDLE")).toMatchObject({
      hunger: 0,
      mood: 85,
      energy: 78,
      intimacy: 60,
    });
  });
});
