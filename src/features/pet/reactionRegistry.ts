export type LocalReactionType =
  | "CLICK"
  | "PET"
  | "POKE"
  | "POKE_HEAD"
  | "POKE_BODY"
  | "POKE_ANNOYED"
  | "FEED_LOVE"
  | "FEED_NORMAL"
  | "FEED_DISLIKE"
  | "FULL"
  | "CHAT"
  | "WAKE";

export const DEFAULT_LOCAL_REACTIONS: Readonly<
  Record<LocalReactionType, readonly string[]>
> = {
  CLICK: [
    "嘿，被妈妈发现啦。",
    "我会乖乖待在桌面上的。",
    "妈妈，今天也要记得休息。",
  ],
  PET: [
    "嗯……这样摸摸很舒服。",
    "嘿嘿，再摸一下嘛。",
    "最喜欢妈妈摸我啦。",
  ],
  POKE: ["诶？轻一点嘛。"],
  POKE_HEAD: ["妈妈干嘛戳我脸！"],
  POKE_BODY: ["痒！不要戳啦。"],
  POKE_ANNOYED: ["妈妈，再戳我真的要生气啦。"],
  FEED_LOVE: ["草莓！这是我最喜欢的。"],
  FEED_NORMAL: ["谢谢妈妈，我吃饱一点啦。"],
  FEED_DISLIKE: ["唔……胡萝卜也要吃吗？"],
  FULL: ["妈妈，我真的吃不下啦～"],
  CHAT: ["妈妈想和我聊天吗？"],
  WAKE: ["唔……妈妈把我叫醒啦。"],
};

export class LocalReactionRegistry {
  public constructor(
    private readonly reactions: Readonly<
      Partial<Record<LocalReactionType, readonly string[]>>
    > = DEFAULT_LOCAL_REACTIONS,
    private readonly random: () => number = () => Math.random(),
  ) {}

  public pick(type: LocalReactionType): string | null {
    const lines = this.reactions[type];
    if (!lines || lines.length === 0) {
      return null;
    }

    const index = Math.min(
      lines.length - 1,
      Math.max(0, Math.floor(this.random() * lines.length)),
    );
    return lines[index] ?? null;
  }
}
