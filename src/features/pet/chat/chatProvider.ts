import {
  aiErrorCodeFromUnknown,
  friendlyAiErrorMessage,
  type AIConfigurationService,
} from "../../../platform/ai/aiConfigurationService";
import type {
  AiChatMessage,
  AiErrorCode,
  AiPlatformAdapter,
} from "../../../platform/ai/aiTypes";

export interface ChatProviderRequest {
  readonly requestId: string;
  readonly messages: readonly AiChatMessage[];
}

export interface ChatProviderResponse {
  readonly text: string;
}

export type ChatProviderErrorCode = AiErrorCode;

export class ChatProviderError extends Error {
  public readonly code: ChatProviderErrorCode;

  public constructor(
    code: ChatProviderErrorCode,
    message = friendlyAiErrorMessage(code),
  ) {
    super(message);
    this.name = "ChatProviderError";
    this.code = code;
  }
}

export interface ChatProvider {
  respond(request: ChatProviderRequest): Promise<ChatProviderResponse>;
  cancel?(requestId: string): Promise<void>;
}

export class LocalPlaceholderChatProvider implements ChatProvider {
  public async respond(_request: ChatProviderRequest): Promise<ChatProviderResponse> {
    throw new ChatProviderError("NOT_CONFIGURED");
  }
}

export class TauriDeepSeekChatProvider implements ChatProvider {
  public constructor(private readonly adapter: AiPlatformAdapter) {}

  public async respond(request: ChatProviderRequest): Promise<ChatProviderResponse> {
    try {
      const response = await this.adapter.complete(request.requestId, request.messages);
      const text = response.text.trim();
      if (!text) {
        throw new ChatProviderError("EMPTY_RESPONSE");
      }
      return { text };
    } catch (error: unknown) {
      if (error instanceof ChatProviderError) {
        throw error;
      }
      throw new ChatProviderError(aiErrorCodeFromUnknown(error));
    }
  }

  public cancel(requestId: string): Promise<void> {
    return this.adapter.cancelRequest(requestId);
  }
}

export class ConfiguredChatProvider implements ChatProvider {
  public constructor(
    private readonly configuration: AIConfigurationService,
    private readonly deepSeekProvider: ChatProvider,
    private readonly localProvider: ChatProvider = new LocalPlaceholderChatProvider(),
  ) {}

  public async respond(request: ChatProviderRequest): Promise<ChatProviderResponse> {
    const state = await this.configuration.resolveConfiguration();
    if (state === "unavailable") {
      throw new ChatProviderError("CREDENTIAL_STORE_UNAVAILABLE");
    }
    return (state === "configured" ? this.deepSeekProvider : this.localProvider)
      .respond(request);
  }

  public async cancel(requestId: string): Promise<void> {
    await this.deepSeekProvider.cancel?.(requestId);
    await this.localProvider.cancel?.(requestId);
  }
}

export function normalizeChatProviderResponse(
  response: ChatProviderResponse,
): string {
  const text = response.text.trim();
  if (!text) {
    throw new ChatProviderError("EMPTY_RESPONSE");
  }
  return text;
}

export type { AiChatMessage } from "../../../platform/ai/aiTypes";
