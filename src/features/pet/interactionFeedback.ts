import { SpeechBubbleController } from "./speechBubbleController";
import {
  InteractionCooldownManager,
  type InteractionCooldownType,
} from "./interactionCooldown";
import {
  LocalReactionRegistry,
  type LocalReactionType,
} from "./reactionRegistry";

export interface PetInteractionFeedbackOptions {
  speechBubble?: SpeechBubbleController;
  reactions?: LocalReactionRegistry;
  cooldowns?: InteractionCooldownManager;
}

export class PetInteractionFeedback {
  public readonly speechBubble: SpeechBubbleController;
  private readonly reactions: LocalReactionRegistry;
  private readonly cooldowns: InteractionCooldownManager;

  public constructor({
    speechBubble = new SpeechBubbleController(),
    reactions = new LocalReactionRegistry(),
    cooldowns = new InteractionCooldownManager(),
  }: PetInteractionFeedbackOptions = {}) {
    this.speechBubble = speechBubble;
    this.reactions = reactions;
    this.cooldowns = cooldowns;
  }

  public trigger(type: LocalReactionType): boolean {
    const cooldownType = type as InteractionCooldownType;
    if (!this.cooldowns.canTrigger(cooldownType)) {
      return false;
    }

    const line = this.reactions.pick(type);
    if (!line) {
      return false;
    }

    this.cooldowns.record(cooldownType);
    this.speechBubble.show(line);
    return true;
  }

  public triggerMessage(
    message: string,
    cooldownType: InteractionCooldownType = "CHAT",
  ): boolean {
    if (!this.cooldowns.canTrigger(cooldownType)) {
      return false;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return false;
    }

    this.cooldowns.record(cooldownType);
    this.speechBubble.show(trimmedMessage);
    return true;
  }

  public dispose(): void {
    this.speechBubble.dispose();
  }
}
