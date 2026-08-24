import {
  LocalPlaceholderChatProvider,
  type ChatProvider,
} from "./chatProvider";

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface ChatServiceSnapshot {
  readonly isOpen: boolean;
  readonly messages: readonly ChatMessage[];
  readonly pending: boolean;
  readonly error: string | null;
}

type SnapshotListener = (snapshot: ChatServiceSnapshot) => void;

export class ChatService {
  private readonly listeners = new Set<SnapshotListener>();
  private currentSnapshot: ChatServiceSnapshot = {
    isOpen: false,
    messages: [],
    pending: false,
    error: null,
  };

  public constructor(
    private readonly provider: ChatProvider = new LocalPlaceholderChatProvider(),
  ) {}

  public get snapshot(): ChatServiceSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public open(): void {
    if (this.currentSnapshot.isOpen) {
      return;
    }

    this.publish({
      ...this.currentSnapshot,
      isOpen: true,
      error: null,
    });
  }

  public close(): void {
    if (!this.currentSnapshot.isOpen && this.currentSnapshot.messages.length === 0) {
      return;
    }

    this.publish({
      isOpen: false,
      messages: [],
      pending: false,
      error: null,
    });
  }

  public async send(message: string): Promise<string | null> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || !this.currentSnapshot.isOpen || this.currentSnapshot.pending) {
      return null;
    }

    this.publish({
      ...this.currentSnapshot,
      messages: [
        ...this.currentSnapshot.messages,
        { role: "user", text: trimmedMessage },
      ],
      pending: true,
      error: null,
    });

    try {
      const response = (await this.provider.respond(trimmedMessage)).trim();
      if (!response) {
        throw new Error("empty chat response");
      }

      this.publish({
        ...this.currentSnapshot,
        messages: [
          ...this.currentSnapshot.messages,
          { role: "assistant", text: response },
        ],
        pending: false,
        error: null,
      });
      return response;
    } catch {
      this.publish({
        ...this.currentSnapshot,
        pending: false,
        error: "本地聊天暂时不可用",
      });
      return null;
    }
  }

  public dispose(): void {
    this.listeners.clear();
  }

  private publish(snapshot: ChatServiceSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }
}

export type { ChatProvider } from "./chatProvider";
