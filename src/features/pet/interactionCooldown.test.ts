import { describe, expect, it } from "vitest";

import {
  InteractionCooldownManager,
  DEFAULT_INTERACTION_COOLDOWNS,
} from "./interactionCooldown";

describe("InteractionCooldownManager", () => {
  it("accepts the first trigger, blocks rapid duplicates, and expires by type", () => {
    let now = 1_000;
    const manager = new InteractionCooldownManager(
      DEFAULT_INTERACTION_COOLDOWNS,
      () => now,
    );

    expect(manager.canTrigger("CLICK")).toBe(true);
    manager.record("CLICK");
    expect(manager.canTrigger("CLICK")).toBe(false);
    expect(manager.remaining("CLICK")).toBe(400);
    expect(manager.canTrigger("WAKE")).toBe(true);

    now += 399;
    expect(manager.canTrigger("CLICK")).toBe(false);
    now += 1;
    expect(manager.canTrigger("CLICK")).toBe(true);
  });
});
