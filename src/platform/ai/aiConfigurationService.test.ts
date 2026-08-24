import { describe, expect, it } from "vitest";

import {
  AIConfigurationService,
  friendlyAiErrorMessage,
} from "./aiConfigurationService";
import {
  DEEPSEEK_PROVIDER,
  type AiChatMessage,
  type AiChatResponse,
  type AiConfigurationStatus,
  type AiPlatformAdapter,
} from "./aiTypes";

class FakeAiAdapter implements AiPlatformAdapter {
  public configured = false;
  public testError: { readonly code: string } | null = null;
  public savedKey: string | null = null;

  public getConfigurationStatus(): Promise<AiConfigurationStatus> {
    return Promise.resolve({
      provider: DEEPSEEK_PROVIDER,
      configured: this.configured,
      storageAvailable: true,
      state: this.configured ? "configured" : "not-configured",
    });
  }

  public saveApiKey(apiKey: string): Promise<void> {
    this.savedKey = apiKey;
    this.configured = true;
    return Promise.resolve();
  }

  public deleteApiKey(): Promise<void> {
    this.savedKey = null;
    this.configured = false;
    return Promise.resolve();
  }

  public testConnection(_requestId: string): Promise<void> {
    if (this.testError) {
      return Promise.reject(this.testError);
    }
    return Promise.resolve();
  }

  public complete(
    _requestId: string,
    _messages: readonly AiChatMessage[],
  ): Promise<AiChatResponse> {
    return Promise.resolve({ text: "好呀" });
  }

  public cancelRequest(_requestId: string): Promise<void> {
    return Promise.resolve();
  }
}

describe("AIConfigurationService", () => {
  it("exposes only provider configuration status and clears the input seam on success", async () => {
    const adapter = new FakeAiAdapter();
    const service = new AIConfigurationService(adapter);

    await service.refresh();
    expect(service.snapshot).toMatchObject({
      provider: DEEPSEEK_PROVIDER,
      configured: false,
      status: "not-configured",
    });

    expect(await service.saveApiKey("test-key")).toBe(true);
    expect(adapter.savedKey).toBe("test-key");
    expect(service.snapshot.configured).toBe(true);
    expect(service.snapshot).not.toHaveProperty("apiKey");
    expect(await service.deleteApiKey()).toBe(true);
    expect(service.snapshot.configured).toBe(false);
    service.dispose();
  });

  it("keeps HTTP 402 as the dedicated insufficient balance message", async () => {
    const adapter = new FakeAiAdapter();
    adapter.configured = true;
    adapter.testError = { code: "INSUFFICIENT_BALANCE" };
    const service = new AIConfigurationService(adapter);

    await service.refresh();
    expect(await service.testConnection()).toBe(false);
    expect(service.snapshot.errorCode).toBe("INSUFFICIENT_BALANCE");
    expect(service.snapshot.message).toBe("DeepSeek API 余额不足，请充值后再试");
    expect(friendlyAiErrorMessage("INSUFFICIENT_BALANCE"))
      .toBe("DeepSeek API 余额不足，请充值后再试");
    service.dispose();
  });
});
