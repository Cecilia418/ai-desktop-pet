import { describe, expect, it } from "vitest";
import { MovementController } from "./movementController";

describe("MovementController", () => {
  it("moves along the bottom bound and reverses at the edge", () => {
    const controller = new MovementController(100);
    controller.reset({ x: 10, y: 0 });
    const bounds = { minX: 10, maxX: 30, bottomY: 800 };

    expect(controller.advance(100, bounds)).toMatchObject({
      position: { x: 20, y: 800 },
      direction: 1,
    });
    expect(controller.advance(200, bounds)).toMatchObject({
      position: { x: 30, y: 800 },
      direction: -1,
    });
    expect(controller.advance(100, bounds)).toMatchObject({
      position: { x: 20, y: 800 },
      direction: -1,
    });
  });
});
