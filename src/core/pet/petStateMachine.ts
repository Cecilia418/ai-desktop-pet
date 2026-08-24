export type PetState = "IDLE" | "WALKING" | "SLEEPING";
export type PetStateTransitionReason =
  | "debug"
  | "timer"
  | "interaction"
  | "vitals"
  | "user-interrupt";

export interface PetStateTransitionResult {
  accepted: boolean;
  changed: boolean;
  from: PetState;
  to: PetState;
  reason: PetStateTransitionReason;
}

const validTransitions: Readonly<Record<PetState, readonly PetState[]>> = {
  IDLE: ["WALKING", "SLEEPING"],
  WALKING: ["IDLE", "SLEEPING"],
  SLEEPING: ["IDLE"],
};

export class PetStateMachine {
  private current: PetState;

  public constructor(initialState: PetState = "IDLE") {
    this.current = initialState;
  }

  public get state(): PetState {
    return this.current;
  }

  public canTransitionTo(next: PetState): boolean {
    return next === this.current || validTransitions[this.current].includes(next);
  }

  public transition(
    next: PetState,
    reason: PetStateTransitionReason,
  ): PetStateTransitionResult {
    const from = this.current;
    const accepted = this.canTransitionTo(next);
    if (accepted) {
      this.current = next;
    }

    return {
      accepted,
      changed: accepted && from !== next,
      from,
      to: this.current,
      reason,
    };
  }
}
