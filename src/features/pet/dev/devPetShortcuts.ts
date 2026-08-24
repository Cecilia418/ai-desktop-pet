import type { PetState, PetStateTransitionResult } from "../../../core/pet/petStateMachine";

interface DevPetShortcutTarget {
  transitionTo(
    next: PetState,
    reason: "debug",
  ): PetStateTransitionResult;
  toggleOverlay(): void;
}

const SHORTCUT_STATES: Readonly<Record<string, PetState>> = {
  "1": "IDLE",
  "2": "WALKING",
  "3": "SLEEPING",
};

const SHORTCUT_STATE_CODES: Readonly<Record<string, PetState>> = {
  Digit1: "IDLE",
  Digit2: "WALKING",
  Digit3: "SLEEPING",
};

export function registerDevPetShortcuts(target: DevPetShortcutTarget): () => void {
  if (!import.meta.env.DEV) {
    return () => undefined;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!event.ctrlKey || !event.altKey || event.repeat) {
      return;
    }

    if (event.key.toLowerCase() === "d" || event.code === "KeyD") {
      event.preventDefault();
      target.toggleOverlay();
      return;
    }

    const next = SHORTCUT_STATES[event.key] ?? SHORTCUT_STATE_CODES[event.code];
    if (!next) {
      return;
    }

    event.preventDefault();
    target.transitionTo(next, "debug");
  };

  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
}
