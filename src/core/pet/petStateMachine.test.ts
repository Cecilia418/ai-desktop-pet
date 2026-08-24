import { describe, expect, it } from "vitest";
import { PetStateMachine } from "./petStateMachine";

describe("PetStateMachine", () => {
  it("starts in IDLE", () => {
    expect(new PetStateMachine().state).toBe("IDLE");
  });

  it("accepts the supported development transitions", () => {
    const machine = new PetStateMachine();

    expect(machine.transition("WALKING", "debug")).toMatchObject({
      accepted: true,
      changed: true,
      from: "IDLE",
      to: "WALKING",
    });
    expect(machine.transition("IDLE", "timer")).toMatchObject({
      accepted: true,
      changed: true,
      from: "WALKING",
      to: "IDLE",
    });
    expect(machine.transition("SLEEPING", "debug")).toMatchObject({
      accepted: true,
      changed: true,
      from: "IDLE",
      to: "SLEEPING",
    });
    expect(machine.transition("IDLE", "user-interrupt")).toMatchObject({
      accepted: true,
      changed: true,
      from: "SLEEPING",
      to: "IDLE",
    });
  });

  it("rejects a transition out of SLEEPING except waking to IDLE", () => {
    const machine = new PetStateMachine("SLEEPING");
    const result = machine.transition("WALKING", "debug");

    expect(result.accepted).toBe(false);
    expect(machine.state).toBe("SLEEPING");
  });
});
