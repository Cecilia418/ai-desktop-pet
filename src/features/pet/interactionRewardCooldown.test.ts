import { describe, expect, it } from "vitest";

import { InteractionRewardCooldownManager } from "./interactionRewardCooldown";

describe("InteractionRewardCooldownManager", () => {
  it("keeps mood and intimacy reward clocks independent", () => {
    let now = 0;
    const cooldowns = new InteractionRewardCooldownManager({
      PET_MOOD: 1_000,
      PET_INTIMACY: 10_000,
    }, () => now);

    expect(cooldowns.canTrigger("PET_MOOD")).toBe(true);
    expect(cooldowns.canTrigger("PET_INTIMACY")).toBe(true);
    cooldowns.record("PET_MOOD");
    expect(cooldowns.canTrigger("PET_MOOD")).toBe(false);
    expect(cooldowns.canTrigger("PET_INTIMACY")).toBe(true);

    now = 1_000;
    expect(cooldowns.canTrigger("PET_MOOD")).toBe(true);
    expect(cooldowns.canTrigger("PET_INTIMACY")).toBe(true);
  });
});
