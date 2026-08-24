import { describe, expect, it } from "vitest";

import {
  deriveCharacterDisplayMetrics,
  derivePetWindowLayoutSpecs,
  getPlaceholderMotion,
} from "./characterDisplay";

describe("character display metrics", () => {
  it("derives half-size character layout without halving the window below its minimum", () => {
    expect(deriveCharacterDisplayMetrics()).toEqual({
      scale: 0.5,
      characterSize: { width: 119, height: 150 },
      windowSize: { width: 260, height: 300 },
    });
  });

  it("only enables CSS fallback motion for one-frame animations", () => {
    expect(getPlaceholderMotion({
      frames: ["one"],
      fps: 1,
      loop: true,
      placeholderMotion: "idle-bob",
    })).toBe("idle-bob");
    expect(getPlaceholderMotion({
      frames: ["one", "two"],
      fps: 6,
      loop: true,
      placeholderMotion: "idle-bob",
    })).toBeNull();
  });

  it("defines stable pet lanes and content lanes for every presentation mode", () => {
    const specs = derivePetWindowLayoutSpecs();

    expect(specs["pet-only"].windowSize).toEqual({ width: 260, height: 300 });
    expect(specs["action-menu"].windowSize).toEqual({ width: 420, height: 340 });
    expect(specs["compact-panel"].windowSize).toEqual({ width: 420, height: 420 });
    expect(specs.chat.windowSize).toEqual({ width: 420, height: 560 });
    expect(specs["pet-only"].petLane.footCenterLocal).toEqual({
      x: 130,
      y: 282,
    });
    expect(specs["action-menu"].petLane.footCenterLocal.x).toBe(78);
    expect(specs["compact-panel"].petLane.footCenterLocal.x).toBe(78);
    expect(specs.chat.petLane.footCenterLocal.x).toBe(78);
    for (const spec of Object.values(specs)) {
      expect(spec.contentLane.width).toBeGreaterThan(0);
      expect(spec.contentLane.height).toBeGreaterThan(0);
      expect(spec.actionMenuLane.width).toBeGreaterThan(0);
      expect(spec.bubbleSafeRegion.width).toBeGreaterThan(0);
    }
  });
});
