export interface PokeStreakSnapshot {
  readonly count: number;
  readonly lastTriggeredAt: number | null;
}

export class PokeStreakTracker {
  private count = 0;
  private lastTriggeredAt: number | null = null;

  public constructor(private readonly windowMs: number) {}

  public record(at: number): PokeStreakSnapshot {
    if (
      this.lastTriggeredAt === null ||
      at - this.lastTriggeredAt > Math.max(0, this.windowMs)
    ) {
      this.count = 1;
    } else {
      this.count += 1;
    }

    this.lastTriggeredAt = at;
    return this.snapshot;
  }

  public reset(): void {
    this.count = 0;
    this.lastTriggeredAt = null;
  }

  public get snapshot(): PokeStreakSnapshot {
    return {
      count: this.count,
      lastTriggeredAt: this.lastTriggeredAt,
    };
  }
}
