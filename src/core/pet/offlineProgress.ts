import {
  DEFAULT_PET_BALANCE,
  type PetActivity,
  type PetBalanceConfig,
} from "./petBalance";
import { clampStats, type PetStatsSnapshot } from "./petStats";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;

export interface OfflineProgressContext {
  activity: PetActivity;
}

function safeHours(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }

  return elapsedMs / MILLISECONDS_PER_HOUR;
}

export function calculateOfflineProgress(
  previousStats: PetStatsSnapshot,
  elapsedMs: number,
  context: OfflineProgressContext,
  config: Readonly<PetBalanceConfig> = DEFAULT_PET_BALANCE,
): PetStatsSnapshot {
  const hours = safeHours(elapsedMs);
  const previous = clampStats(previousStats);
  const hunger = Math.max(
    config.offlineHungerFloor,
    previous.hunger - config.hungerDecayPerHour * hours,
  );

  let energy = previous.energy;
  if (context.activity === "WALKING") {
    energy = Math.max(
      config.offlineEnergyFloor,
      energy - config.activeEnergyDecayPerHour * hours,
    );
  } else if (context.activity === "SLEEPING") {
    energy = energy + config.sleepEnergyRecoveryPerHour * hours;
  }

  return clampStats({
    hunger,
    mood: previous.mood,
    energy,
    intimacy: previous.intimacy,
  });
}
