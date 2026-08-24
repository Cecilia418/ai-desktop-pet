import type { DesktopPosition } from "../../core/pet/movementController";
import { clampStats, type PetStatsSnapshot } from "../../core/pet/petStats";
import type { PetActivity } from "../../core/pet/petBalance";

export type PersistedPetActivity = PetActivity;

export interface PersistedPetState {
  readonly stats: PetStatsSnapshot;
  readonly lastRuntimeTimestamp: number;
  readonly lastActivity: PersistedPetActivity;
  readonly position: DesktopPosition | null;
}

export function normalizePersistedPetState(
  value: unknown,
): PersistedPetState | null {
  if (!isRecord(value) || !isRecord(value.stats)) {
    return null;
  }

  const stats = value.stats;
  const numericStats = [stats.hunger, stats.mood, stats.energy, stats.intimacy];
  if (
    numericStats.some(
      (stat) => typeof stat !== "number" || !Number.isFinite(stat),
    ) ||
    typeof value.lastRuntimeTimestamp !== "number" ||
    !Number.isFinite(value.lastRuntimeTimestamp) ||
    value.lastRuntimeTimestamp <= 0 ||
    !isActivity(value.lastActivity)
  ) {
    return null;
  }

  let position: DesktopPosition | null = null;
  if (value.position !== null && value.position !== undefined) {
    if (
      !isRecord(value.position) ||
      typeof value.position.x !== "number" ||
      typeof value.position.y !== "number" ||
      !Number.isFinite(value.position.x) ||
      !Number.isFinite(value.position.y)
    ) {
      return null;
    }
    position = { x: value.position.x, y: value.position.y };
  }

  return {
    stats: clampStats({
      hunger: stats.hunger,
      mood: stats.mood,
      energy: stats.energy,
      intimacy: stats.intimacy,
    }),
    lastRuntimeTimestamp: value.lastRuntimeTimestamp,
    lastActivity: value.lastActivity,
    position,
  };
}

function isActivity(value: unknown): value is PersistedPetActivity {
  return value === "IDLE" || value === "WALKING" || value === "SLEEPING";
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null;
}
