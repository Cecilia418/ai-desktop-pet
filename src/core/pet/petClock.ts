export type TimePeriod =
  | "MORNING"
  | "DAYTIME"
  | "EVENING"
  | "LATE_NIGHT";

export interface PetClockSnapshot {
  currentTimestamp: number;
  elapsedMs: number;
  localHour: number;
  timePeriod: TimePeriod;
}

export type ClockSource = () => number;

export function getTimePeriod(localHour: number): TimePeriod {
  if (localHour >= 6 && localHour < 10) {
    return "MORNING";
  }
  if (localHour >= 10 && localHour < 18) {
    return "DAYTIME";
  }
  if (localHour >= 18 && localHour < 23) {
    return "EVENING";
  }
  return "LATE_NIGHT";
}

function safeTimestamp(timestamp: number, fallback: number): number {
  return Number.isFinite(timestamp) ? timestamp : fallback;
}

function createSnapshot(timestamp: number, elapsedMs: number): PetClockSnapshot {
  const localHour = new Date(timestamp).getHours();
  return {
    currentTimestamp: timestamp,
    elapsedMs,
    localHour,
    timePeriod: getTimePeriod(localHour),
  };
}

export class PetClock {
  private lastTimestamp: number;
  private currentSnapshot: PetClockSnapshot;

  public constructor(private readonly now: ClockSource = () => Date.now()) {
    this.lastTimestamp = safeTimestamp(this.now(), 0);
    this.currentSnapshot = createSnapshot(this.lastTimestamp, 0);
  }

  public get snapshot(): PetClockSnapshot {
    return this.currentSnapshot;
  }

  public sample(timestamp = this.now()): PetClockSnapshot {
    const currentTimestamp = safeTimestamp(timestamp, this.lastTimestamp);
    const elapsedMs = Math.max(0, currentTimestamp - this.lastTimestamp);
    this.lastTimestamp = currentTimestamp;
    this.currentSnapshot = createSnapshot(currentTimestamp, elapsedMs);
    return this.currentSnapshot;
  }

  public reset(timestamp = this.now()): PetClockSnapshot {
    this.lastTimestamp = safeTimestamp(timestamp, this.lastTimestamp);
    this.currentSnapshot = createSnapshot(this.lastTimestamp, 0);
    return this.currentSnapshot;
  }
}
