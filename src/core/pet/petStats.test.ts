import { describe, expect, it } from "vitest";

import { applyDelta, clampStats, setStat } from "./petStats";

describe("pet stats", () => {
  it("clamps every stat to 0..100", () => {
    expect(
      clampStats({ hunger: -1, mood: 101, energy: Number.NaN, intimacy: 50 }),
    ).toEqual({ hunger: 0, mood: 100, energy: 0, intimacy: 50 });
  });

  it("uses unified set and delta updates", () => {
    const stats = { hunger: 50, mood: 50, energy: 50, intimacy: 50 };
    expect(setStat(stats, "mood", 120).mood).toBe(100);
    expect(applyDelta(stats, "hunger", -60).hunger).toBe(0);
    expect(applyDelta(stats, "energy", Number.NaN).energy).toBe(50);
  });
});
