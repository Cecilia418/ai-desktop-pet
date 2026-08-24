import { describe, expect, it } from "vitest";
import {
  InteractiveGeometryRegistry,
} from "./interactiveGeometryRegistry";

function fakeElement(rect: {
  left: number;
  top: number;
  width: number;
  height: number;
}): HTMLElement {
  return {
    getBoundingClientRect: () => ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    }),
  } as HTMLElement;
}

describe("InteractiveGeometryRegistry", () => {
  it("refreshes the current DOM region and removes closed registrations", () => {
    const registry = new InteractiveGeometryRegistry();
    const rect = { left: 10, top: 20, width: 40, height: 30 };
    const unregister = registry.register("panel", fakeElement(rect));

    expect(registry.getRegions()).toEqual([
      { x: 10, y: 20, width: 40, height: 30 },
    ]);

    rect.left = 30;
    registry.refresh();
    expect(registry.getRegion("panel")).toEqual({
      x: 30,
      y: 20,
      width: 40,
      height: 30,
    });

    unregister();
    expect(registry.getRegions()).toEqual([]);
    registry.dispose();
  });
});
