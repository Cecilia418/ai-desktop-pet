export const PET_STAT_MIN = 0;
export const PET_STAT_MAX = 100;

export interface PetStatsSnapshot {
  hunger: number;
  mood: number;
  energy: number;
  intimacy: number;
}

export type PetStatName = keyof PetStatsSnapshot;

export function clampStat(value: number): number {
  if (!Number.isFinite(value)) {
    return PET_STAT_MIN;
  }

  return Math.min(PET_STAT_MAX, Math.max(PET_STAT_MIN, value));
}

export function clampStats(stats: PetStatsSnapshot): PetStatsSnapshot {
  return {
    hunger: clampStat(stats.hunger),
    mood: clampStat(stats.mood),
    energy: clampStat(stats.energy),
    intimacy: clampStat(stats.intimacy),
  };
}

export function setStat(
  stats: PetStatsSnapshot,
  stat: PetStatName,
  value: number,
): PetStatsSnapshot {
  return clampStats({ ...stats, [stat]: value });
}

export function applyDelta(
  stats: PetStatsSnapshot,
  stat: PetStatName,
  delta: number,
): PetStatsSnapshot {
  const safeDelta = Number.isFinite(delta) ? delta : 0;
  return setStat(stats, stat, stats[stat] + safeDelta);
}
