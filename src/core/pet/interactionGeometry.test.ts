import { describe, expect, it } from "vitest";

import { resolveInteractionRegion } from "./interactionGeometry";

const characterRegion = { x: 10, y: 20, width: 100, height: 120 };

describe("interaction geometry", () => {
  it("resolves approximate head and body regions from the rendered rectangle", () => {
    expect(resolveInteractionRegion({ x: 60, y: 35 }, characterRegion)).toBe("HEAD");
    expect(resolveInteractionRegion({ x: 60, y: 120 }, characterRegion)).toBe("BODY");
  });

  it("falls back to CHARACTER inside the rendered rectangle", () => {
    expect(resolveInteractionRegion({ x: 18, y: 78 }, characterRegion)).toBe(
      "CHARACTER",
    );
  });

  it("ignores points outside the rendered rectangle", () => {
    expect(resolveInteractionRegion({ x: 111, y: 80 }, characterRegion)).toBeNull();
  });
});
