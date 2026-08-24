import { describe, expect, it } from "vitest";
import {
  mapEnergyPresentation,
  mapHungerPresentation,
  mapMoodPresentation,
} from "./statusMapping";

describe("status presentation mapping", () => {
  it("uses floating-point-safe descending hunger thresholds", () => {
    expect(mapHungerPresentation(80).label).toBe("吃得饱饱的");
    expect(mapHungerPresentation(79.999).label).toBe("还不错");
    expect(mapHungerPresentation(50).label).toBe("还不错");
    expect(mapHungerPresentation(49.999).label).toBe("有点饿");
    expect(mapHungerPresentation(20).label).toBe("有点饿");
    expect(mapHungerPresentation(19.999).label).toBe("肚子空空的");
  });

  it("maps mood and energy without exposing intimacy", () => {
    expect(mapMoodPresentation(80).label).toBe("很开心");
    expect(mapMoodPresentation(50).label).toBe("心情不错");
    expect(mapMoodPresentation(20).label).toBe("有点闷");
    expect(mapEnergyPresentation(80).label).toBe("精神满满");
    expect(mapEnergyPresentation(50).label).toBe("还挺有精神");
    expect(mapEnergyPresentation(20).label).toBe("有点困");
  });
});
