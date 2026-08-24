import {
  DEEPSEEK_PROVIDER,
  type AiCommandError,
  type AiConfigurationSnapshot,
  type AiConfigurationState,
  type AiErrorCode,
  type AiPlatformAdapter,
} from "./aiTypes";

type SnapshotListener = (snapshot: AiConfigurationSnapshot) => void;

const ERROR_CODES: readonly AiErrorCode[] = [
  "NOT_CONFIGURED",
  "CREDENTIAL_STORE_UNAVAILABLE",
  "INVALID_REQUEST",
  "AUTHENTICATION",
  "NETWORK",
  "TIMEOUT",
  "RATE_LIMIT",
  "INSUFFICIENT_BALANCE",
  "PROVIDER_ERROR",
  "INVALID_RESPONSE",
  "EMPTY_RESPONSE",
  "CANCELLED",
];

let requestSequence = 0;

function nextRequestId(prefix: string): string {
  requestSequence += 1;
  return `${prefix}-${Date.now()}-${requestSequence}`;
}

export function aiErrorCodeFromUnknown(error: unknown): AiErrorCode {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && ERROR_CODES.includes(code as AiErrorCode)) {
      return code as AiErrorCode;
    }
  }
  return "PROVIDER_ERROR";
}

export function friendlyAiErrorMessage(code: AiErrorCode): string {
  switch (code) {
    case "NOT_CONFIGURED":
      return "还没有配置 AI 服务哦～";
    case "CREDENTIAL_STORE_UNAVAILABLE":
      return "系统安全存储暂时不可用，请稍后再试";
    case "INVALID_REQUEST":
      return "请检查 AI 服务设置";
    case "AUTHENTICATION":
      return "API Key 好像不对";
    case "NETWORK":
      return "现在网络连不上";
    case "TIMEOUT":
      return "回复等太久了，再试一次吧";
    case "RATE_LIMIT":
      return "请求太频繁了，稍后再试";
    case "INSUFFICIENT_BALANCE":
      return "DeepSeek API 余额不足，请充值后再试";
    case "INVALID_RESPONSE":
      return "AI 回复格式异常，请再试一次";
    case "EMPTY_RESPONSE":
      return "没有收到有效回复，请再试一次";
    case "CANCELLED":
      return "";
    case "PROVIDER_ERROR":
      return "AI 服务暂时不可用";
  }
}

const initialSnapshot: AiConfigurationSnapshot = {
  provider: DEEPSEEK_PROVIDER,
  configured: false,
  storageAvailable: true,
  status: "loading",
  errorCode: null,
  message: null,
};

export class AIConfigurationService {
  private readonly listeners = new Set<SnapshotListener>();
  private currentSnapshot: AiConfigurationSnapshot = initialSnapshot;
  private disposed = false;

  public constructor(private readonly adapter: AiPlatformAdapter) {}

  public get snapshot(): AiConfigurationSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public async refresh(): Promise<AiConfigurationSnapshot> {
    if (this.disposed) {
      return this.currentSnapshot;
    }
    try {
      const status = await this.adapter.getConfigurationStatus();
      if (status.state === "unavailable" || !status.storageAvailable) {
        return this.publishError("CREDENTIAL_STORE_UNAVAILABLE", false);
      }
      return this.publish({
        provider: DEEPSEEK_PROVIDER,
        configured: status.configured,
        storageAvailable: true,
        status: status.configured ? "configured" : "not-configured",
        errorCode: null,
        message: null,
      });
    } catch (error: unknown) {
      return this.publishError(aiErrorCodeFromUnknown(error), false);
    }
  }

  public async saveApiKey(apiKey: string): Promise<boolean> {
    if (this.disposed || apiKey.trim() === "") {
      this.publishError("INVALID_REQUEST", this.currentSnapshot.configured);
      return false;
    }

    this.publish({
      ...this.currentSnapshot,
      status: "saving",
      errorCode: null,
      message: "正在保存…",
    });
    try {
      await this.adapter.saveApiKey(apiKey);
      await this.refresh();
      return this.currentSnapshot.configured;
    } catch (error: unknown) {
      this.publishError(aiErrorCodeFromUnknown(error), this.currentSnapshot.configured);
      return false;
    }
  }

  public async deleteApiKey(): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    this.publish({
      ...this.currentSnapshot,
      status: "deleting",
      errorCode: null,
      message: "正在删除…",
    });
    try {
      await this.adapter.deleteApiKey();
      await this.refresh();
      return !this.currentSnapshot.configured;
    } catch (error: unknown) {
      this.publishError(aiErrorCodeFromUnknown(error), this.currentSnapshot.configured);
      return false;
    }
  }

  public async testConnection(): Promise<boolean> {
    if (this.disposed) {
      return false;
    }
    const current = this.currentSnapshot.status === "loading"
      ? await this.refresh()
      : this.currentSnapshot;
    if (!current.configured) {
      this.publishError(current.errorCode ?? "NOT_CONFIGURED", false);
      return false;
    }

    this.publish({
      ...current,
      status: "testing",
      errorCode: null,
      message: "正在验证…",
    });
    try {
      await this.adapter.testConnection(nextRequestId("ai-test"));
      this.publish({
        ...this.currentSnapshot,
        configured: true,
        storageAvailable: true,
        status: "available",
        errorCode: null,
        message: "AI 服务可用",
      });
      return true;
    } catch (error: unknown) {
      this.publishError(aiErrorCodeFromUnknown(error), true);
      return false;
    }
  }

  public async resolveConfiguration(): Promise<AiConfigurationState> {
    const snapshot = await this.refresh();
    if (!snapshot.storageAvailable) {
      return "unavailable";
    }
    return snapshot.configured ? "configured" : "not-configured";
  }

  public dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private publishError(
    code: AiErrorCode,
    configured: boolean,
  ): AiConfigurationSnapshot {
    return this.publish({
      provider: DEEPSEEK_PROVIDER,
      configured,
      storageAvailable: code !== "CREDENTIAL_STORE_UNAVAILABLE",
      status: "error",
      errorCode: code,
      message: friendlyAiErrorMessage(code),
    });
  }

  private publish(snapshot: AiConfigurationSnapshot): AiConfigurationSnapshot {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    return snapshot;
  }
}

export function createDefaultAIConfigurationService(
  adapter: AiPlatformAdapter,
): AIConfigurationService {
  return new AIConfigurationService(adapter);
}

export function isAiCommandError(error: unknown): error is AiCommandError {
  return typeof error === "object" && error !== null && "code" in error;
}

export type { AiConfigurationUiStatus } from "./aiTypes";
