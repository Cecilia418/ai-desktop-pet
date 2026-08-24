import { describe, expect, it } from "vitest";

import {
  isCursorInsideInteractiveRegion,
  type InteractiveRegion,
} from "./cursorPassthrough";

describe("isCursorInsideInteractiveRegion", () => {
  const snapshot = {
    cursorX: 220,
    cursorY: 160,
    windowX: 100,
    windowY: 100,
    scaleFactor: 2,
    leftButtonDown: false,
  };

  const characterRegion: InteractiveRegion = {
    x: 50,
    y: 20,
    width: 40,
    height: 30,
  };

  it("converts physical cursor coordinates into the logical window region", () => {
    expect(
      isCursorInsideInteractiveRegion(snapshot, [characterRegion]),
    ).toBe(true);
  });

  it("returns false for the transparent area outside all regions", () => {
    expect(
      isCursorInsideInteractiveRegion(
        { ...snapshot, cursorX: 190, cursorY: 160 },
        [characterRegion],
      ),
    ).toBe(false);
  });
});
