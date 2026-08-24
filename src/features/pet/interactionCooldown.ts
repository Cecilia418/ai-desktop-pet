export type InteractionCooldownType =
  | "CLICK"
  | "PET"
  | "POKE"
  | "WAKE"
  | "POKE_HEAD"
  | "POKE_BODY"
  | "POKE_ANNOYED"
  | "FEED_LOVE"
  | "FEED_NORMAL"
  | "FEED_DISLIKE"
  | "FULL"
  | "CHAT";

export const DEFAULT_INTERACTION_COOLDOWNS: Readonly<
  Record<InteractionCooldownType, number>
> = {
  CLICK: 400,
  PET: 800,
  POKE: 500,
  WAKE: 400,
  POKE_HEAD: 500,
  POKE_BODY: 500,
  POKE_ANNOYED: 500,
  FEED_LOVE: 800,
  FEED_NORMAL: 800,
  FEED_DISLIKE: 800,
  FULL: 800,
  CHAT: 800,
};

export class InteractionCooldownManager {
  private readonly lastTriggeredAt = new Map<InteractionCooldownType, number>();

  public constructor(
    private readonly durations: Readonly<
      Partial<Record<InteractionCooldownType, number>>
    > = DEFAULT_INTERACTION_COOLDOWNS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  public canTrigger(type: InteractionCooldownType): boolean {
    return this.remaining(type) <= 0;
  }

  public record(type: InteractionCooldownType): void {
    this.lastTriggeredAt.set(type, this.now());
  }

  public remaining(type: InteractionCooldownType): number {
    const lastTriggeredAt = this.lastTriggeredAt.get(type);
    if (lastTriggeredAt === undefined) {
      return 0;
    }

    const duration = Math.max(0, this.durations[type] ?? 0);
    return Math.max(0, duration - (this.now() - lastTriggeredAt));
  }
}
