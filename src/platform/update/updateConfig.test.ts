import { describe, expect, it } from "vitest";
import {
  isProductionUpdaterEnabled,
  UPDATE_CHECK_DELAY_MS,
} from "./updateConfig";

describe("isProductionUpdaterEnabled", () => {
  it("requires production mode and an explicit build flag", () => {
    expect(isProductionUpdaterEnabled({ dev: false, production: true, enabledFlag: "true" })).toBe(true);
    expect(isProductionUpdaterEnabled({ dev: true, production: true, enabledFlag: "true" })).toBe(false);
    expect(isProductionUpdaterEnabled({ dev: false, production: false, enabledFlag: "true" })).toBe(false);
    expect(isProductionUpdaterEnabled({ dev: false, production: true, enabledFlag: undefined })).toBe(false);
  });

  it("waits for the desktop pet to settle before the launch check", () => {
    expect(UPDATE_CHECK_DELAY_MS).toBeGreaterThanOrEqual(10_000);
    expect(UPDATE_CHECK_DELAY_MS).toBeLessThanOrEqual(30_000);
  });
});
