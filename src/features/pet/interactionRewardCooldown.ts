export type InteractionRewardType =
  | "PET_MOOD"
  | "PET_INTIMACY"
  | "FEED_INTIMACY"
  | "POKE_MOOD";

export type InteractionRewardDurations = Readonly<
  Partial<Record<InteractionRewardType, number>>
>;

export class InteractionRewardCooldownManager {
  private readonly lastTriggeredAt = new Map<InteractionRewardType, number>();

  public constructor(
    private readonly durations: InteractionRewardDurations,
    private readonly now: () => number = () => Date.now(),
  ) {}

  public canTrigger(type: InteractionRewardType, at = this.now()): boolean {
    return this.remaining(type, at) <= 0;
  }

  public record(type: InteractionRewardType, at = this.now()): void {
    this.lastTriggeredAt.set(type, at);
  }

  public remaining(type: InteractionRewardType, at = this.now()): number {
    const lastTriggeredAt = this.lastTriggeredAt.get(type);
    if (lastTriggeredAt === undefined) {
      return 0;
    }

    const duration = Math.max(0, this.durations[type] ?? 0);
    return Math.max(0, duration - (at - lastTriggeredAt));
  }
}
