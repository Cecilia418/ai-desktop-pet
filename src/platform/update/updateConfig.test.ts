import { describe, expect, it } from "vitest";
import { isProductionUpdaterEnabled } from "./updateConfig";

describe("isProductionUpdaterEnabled", () => {
  it("requires production mode and an explicit build flag", () => {
    expect(isProductionUpdaterEnabled({ dev: false, production: true, enabledFlag: "true" })).toBe(true);
    expect(isProductionUpdaterEnabled({ dev: true, production: true, enabledFlag: "true" })).toBe(false);
    expect(isProductionUpdaterEnabled({ dev: false, production: false, enabledFlag: "true" })).toBe(false);
    expect(isProductionUpdaterEnabled({ dev: false, production: true, enabledFlag: undefined })).toBe(false);
  });
});
