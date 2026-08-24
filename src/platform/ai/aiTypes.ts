export const DEEPSEEK_PROVIDER = "deepseek" as const;

export type AiErrorCode =
  | "NOT_CONFIGURED"
  | "CREDENTIAL_STORE_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "AUTHENTICATION"
  | "NETWORK"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "INSUFFICIENT_BALANCE"
  | "PROVIDER_ERROR"
  | "INVALID_RESPONSE"
  | "EMPTY_RESPONSE"
  | "CANCELLED";

export interface AiCommandError {
  readonly code: AiErrorCode;
  readonly message?: string;
}

export type AiConfigurationState =
  | "configured"
  | "not-configured"
  | "unavailable";

export interface AiConfigurationStatus {
  readonly provider: typeof DEEPSEEK_PROVIDER;
  readonly configured: boolean;
  readonly storageAvailable: boolean;
  readonly state: AiConfigurationState;
}

export interface AiChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface AiChatResponse {
  readonly text: string;
}

export interface AiPlatformAdapter {
  getConfigurationStatus(): Promise<AiConfigurationStatus>;
  saveApiKey(apiKey: string): Promise<void>;
  deleteApiKey(): Promise<void>;
  testConnection(requestId: string): Promise<void>;
  complete(requestId: string, messages: readonly AiChatMessage[]): Promise<AiChatResponse>;
  cancelRequest(requestId: string): Promise<void>;
}

export type AiConfigurationUiStatus =
  | "loading"
  | "not-configured"
  | "configured"
  | "saving"
  | "deleting"
  | "testing"
  | "available"
  | "error";

export interface AiConfigurationSnapshot {
  readonly provider: typeof DEEPSEEK_PROVIDER;
  readonly configured: boolean;
  readonly storageAvailable: boolean;
  readonly status: AiConfigurationUiStatus;
  readonly errorCode: AiErrorCode | null;
  readonly message: string | null;
}
