import { describe, expect, it } from "vitest";

import { calculateOfflineProgress } from "./offlineProgress";

const previousStats = {
  hunger: 82,
  mood: 85,
  energy: 78,
  intimacy: 60,
};

describe("calculateOfflineProgress", () => {
  it("calculates 30 minutes without iteration or persistence", () => {
    expect(
      calculateOfflineProgress(previousStats, 30 * 60 * 1_000, { activity: "IDLE" }),
    ).toEqual({ hunger: 80, mood: 85, energy: 78, intimacy: 60 });
  });

  it("calculates 8 hours of active offline time", () => {
    expect(
      calculateOfflineProgress(previousStats, 8 * 60 * 60 * 1_000, {
        activity: "WALKING",
      }),
    ).toEqual({ hunger: 50, mood: 85, energy: 25, intimacy: 60 });
  });

  it("protects hunger across 24 hours and 7 days", () => {
    const oneDay = calculateOfflineProgress(
      previousStats,
      24 * 60 * 60 * 1_000,
      { activity: "IDLE" },
    );
    const sevenDays = calculateOfflineProgress(
      previousStats,
      7 * 24 * 60 * 60 * 1_000,
      { activity: "IDLE" },
    );

    expect(oneDay.hunger).toBe(20);
    expect(sevenDays.hunger).toBe(20);
    expect(sevenDays.intimacy).toBe(60);
  });

  it("recovers sleeping energy directly from a large duration", () => {
    expect(
      calculateOfflineProgress(previousStats, 24 * 60 * 60 * 1_000, {
        activity: "SLEEPING",
      }).energy,
    ).toBe(100);
  });
});
