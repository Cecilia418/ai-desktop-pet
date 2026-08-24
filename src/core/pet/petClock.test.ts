import { describe, expect, it } from "vitest";

import { getTimePeriod, PetClock } from "./petClock";

describe("PetClock", () => {
  it("classifies all four periods at their boundaries", () => {
    expect(getTimePeriod(5)).toBe("LATE_NIGHT");
    expect(getTimePeriod(6)).toBe("MORNING");
    expect(getTimePeriod(9)).toBe("MORNING");
    expect(getTimePeriod(10)).toBe("DAYTIME");
    expect(getTimePeriod(17)).toBe("DAYTIME");
    expect(getTimePeriod(18)).toBe("EVENING");
    expect(getTimePeriod(22)).toBe("EVENING");
    expect(getTimePeriod(23)).toBe("LATE_NIGHT");
  });

  it("uses injected timestamps and ignores backwards time", () => {
    let now = 1_000;
    const clock = new PetClock(() => now);

    now = 6_000;
    expect(clock.sample()).toMatchObject({
      currentTimestamp: 6_000,
      elapsedMs: 5_000,
    });

    now = 2_000;
    expect(clock.sample()).toMatchObject({
      currentTimestamp: 2_000,
      elapsedMs: 0,
    });
  });
});
