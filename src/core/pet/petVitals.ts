import {
  applyDelta,
  clampStats,
  type PetStatName,
  type PetStatsSnapshot,
} from "./petStats";
import {
  DEFAULT_PET_BALANCE,
  type PetActivity,
  type PetBalanceConfig,
} from "./petBalance";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1_000;

function elapsedHours(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }

  return elapsedMs / MILLISECONDS_PER_HOUR;
}

export class PetVitals {
  private current: PetStatsSnapshot;

  public constructor(
    initialStats: PetStatsSnapshot = DEFAULT_PET_BALANCE.initialStats,
    private readonly config: Readonly<PetBalanceConfig> = DEFAULT_PET_BALANCE,
  ) {
    this.current = clampStats(initialStats);
  }

  public snapshot(): PetStatsSnapshot {
    return { ...this.current };
  }

  public setSnapshot(stats: PetStatsSnapshot): PetStatsSnapshot {
    this.current = clampStats(stats);
    return this.snapshot();
  }

  public setStat(stat: PetStatName, value: number): PetStatsSnapshot {
    this.current = clampStats({ ...this.current, [stat]: value });
    return this.snapshot();
  }

  public applyDelta(
    stat: PetStatName,
    delta: number,
  ): PetStatsSnapshot {
    this.current = applyDelta(this.current, stat, delta);
    return this.snapshot();
  }

  public advance(
    elapsedMs: number,
    activity: PetActivity,
  ): PetStatsSnapshot {
    const hours = elapsedHours(elapsedMs);
    if (hours === 0) {
      return this.snapshot();
    }

    let next = this.applyDeltaToSnapshot(
      this.current,
      "hunger",
      -this.config.hungerDecayPerHour * hours,
    );

    if (activity === "WALKING") {
      next = this.applyDeltaToSnapshot(
        next,
        "energy",
        -this.config.activeEnergyDecayPerHour * hours,
      );
    } else if (activity === "SLEEPING") {
      next = this.applyDeltaToSnapshot(
        next,
        "energy",
        this.config.sleepEnergyRecoveryPerHour * hours,
      );
    }

    this.current = clampStats(next);
    return this.snapshot();
  }

  private applyDeltaToSnapshot(
    stats: PetStatsSnapshot,
    stat: PetStatName,
    delta: number,
  ): PetStatsSnapshot {
    return applyDelta(stats, stat, delta);
  }
}
