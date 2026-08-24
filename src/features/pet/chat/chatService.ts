import { buildConversationContext } from "./conversationContextBuilder";
import {
  ChatProviderError,
  LocalPlaceholderChatProvider,
  normalizeChatProviderResponse,
  type ChatProvider,
  type ChatProviderErrorCode,
} from "./chatProvider";

export interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export type ChatRequestStatus =
  | "idle"
  | "sending"
  | "response-received"
  | "cancelled"
  | "error";

export interface ChatServiceSnapshot {
  readonly isOpen: boolean;
  readonly messages: readonly ChatMessage[];
  readonly pending: boolean;
  readonly status: ChatRequestStatus;
  readonly error: string | null;
  readonly errorCode: ChatProviderErrorCode | null;
}

type SnapshotListener = (snapshot: ChatServiceSnapshot) => void;

interface ActiveRequest {
  readonly requestId: string;
  readonly generation: number;
}

let requestSequence = 0;

function nextRequestId(): string {
  requestSequence += 1;
  return `chat-${Date.now()}-${requestSequence}`;
}

function friendlyProviderError(error: unknown): ChatProviderError {
  if (error instanceof ChatProviderError) {
    return error;
  }
  return new ChatProviderError("PROVIDER_ERROR");
}

function cancelRequest(provider: ChatProvider, requestId: string): void {
  const cancel = provider.cancel;
  if (cancel) {
    void cancel.call(provider, requestId).catch(() => undefined);
  }
}

export class ChatService {
  private readonly listeners = new Set<SnapshotListener>();
  private currentSnapshot: ChatServiceSnapshot = {
    isOpen: false,
    messages: [],
    pending: false,
    status: "idle",
    error: null,
    errorCode: null,
  };
  private activeRequest: ActiveRequest | null = null;
  private generation = 0;
  private disposed = false;

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
    if (this.disposed || this.currentSnapshot.isOpen) {
      return;
    }

    this.publish({
      ...this.currentSnapshot,
      isOpen: true,
      pending: false,
      status: "idle",
      error: null,
      errorCode: null,
    });
  }

  public close(): void {
    if (this.disposed) {
      return;
    }

    const activeRequest = this.activeRequest;
    this.activeRequest = null;
    this.generation += 1;
    if (activeRequest) {
      cancelRequest(this.provider, activeRequest.requestId);
    }

    this.publish({
      ...this.currentSnapshot,
      isOpen: false,
      pending: false,
      status: activeRequest ? "cancelled" : this.currentSnapshot.status,
      error: null,
      errorCode: null,
    });
  }

  public async send(message: string): Promise<string | null> {
    const trimmedMessage = message.trim();
    if (
      this.disposed ||
      !trimmedMessage ||
      !this.currentSnapshot.isOpen ||
      this.currentSnapshot.pending
    ) {
      return null;
    }

    const requestId = nextRequestId();
    const generation = ++this.generation;
    const priorMessages = this.currentSnapshot.messages;
    this.activeRequest = { requestId, generation };
    this.publish({
      ...this.currentSnapshot,
      messages: [
        ...priorMessages,
        { role: "user", text: trimmedMessage },
      ],
      pending: true,
      status: "sending",
      error: null,
      errorCode: null,
    });

    try {
      const response = await this.provider.respond({
        requestId,
        messages: buildConversationContext(priorMessages, trimmedMessage),
      });
      if (!this.isCurrentRequest(requestId, generation)) {
        return null;
      }

      const text = normalizeChatProviderResponse(response);
      this.activeRequest = null;
      this.publish({
        ...this.currentSnapshot,
        messages: [
          ...this.currentSnapshot.messages,
          { role: "assistant", text },
        ],
        pending: false,
        status: "response-received",
        error: null,
        errorCode: null,
      });
      return text;
    } catch (error: unknown) {
      if (!this.isCurrentRequest(requestId, generation)) {
        return null;
      }

      const providerError = friendlyProviderError(error);
      this.activeRequest = null;
      if (providerError.code === "CANCELLED") {
        this.publish({
          ...this.currentSnapshot,
          pending: false,
          status: "cancelled",
          error: null,
          errorCode: null,
        });
        return null;
      }
      this.publish({
        ...this.currentSnapshot,
        pending: false,
        status: "error",
        error: providerError.message,
        errorCode: providerError.code,
      });
      return null;
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const activeRequest = this.activeRequest;
    this.activeRequest = null;
    this.generation += 1;
    if (activeRequest) {
      cancelRequest(this.provider, activeRequest.requestId);
    }
    this.currentSnapshot = {
      isOpen: false,
      messages: [],
      pending: false,
      status: "cancelled",
      error: null,
      errorCode: null,
    };
    this.listeners.clear();
  }

  private isCurrentRequest(requestId: string, generation: number): boolean {
    return !this.disposed &&
      this.currentSnapshot.isOpen &&
      this.activeRequest?.requestId === requestId &&
      this.activeRequest.generation === generation &&
      this.generation === generation;
  }

  private publish(snapshot: ChatServiceSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }
}

export type { ChatProvider } from "./chatProvider";
