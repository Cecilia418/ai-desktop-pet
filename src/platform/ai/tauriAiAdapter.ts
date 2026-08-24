import { invoke } from "@tauri-apps/api/core";
import {
  DEEPSEEK_PROVIDER,
  type AiChatMessage,
  type AiChatResponse,
  type AiConfigurationStatus,
  type AiPlatformAdapter,
} from "./aiTypes";

export class TauriAiAdapter implements AiPlatformAdapter {
  public getConfigurationStatus(): Promise<AiConfigurationStatus> {
    return invoke<AiConfigurationStatus>("ai_get_configuration_status");
  }

  public saveApiKey(apiKey: string): Promise<void> {
    return invoke<void>("ai_save_api_key", {
      request: {
        provider: DEEPSEEK_PROVIDER,
        apiKey,
      },
    });
  }

  public deleteApiKey(): Promise<void> {
    return invoke<void>("ai_delete_api_key", {
      request: { provider: DEEPSEEK_PROVIDER },
    });
  }

  public testConnection(requestId: string): Promise<void> {
    return invoke<void>("ai_test_connection", {
      request: { requestId },
    });
  }

  public complete(
    requestId: string,
    messages: readonly AiChatMessage[],
  ): Promise<AiChatResponse> {
    return invoke<AiChatResponse>("ai_chat_completion", {
      request: {
        requestId,
        messages,
      },
    });
  }

  public async cancelRequest(requestId: string): Promise<void> {
    await invoke("ai_cancel_request", {
      request: { requestId },
    });
  }
}

export function createDefaultAiAdapter(): AiPlatformAdapter {
  return new TauriAiAdapter();
}
