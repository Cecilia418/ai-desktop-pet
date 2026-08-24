import type { AppVersionProvider } from "./appVersion";
import type {
  ResumeAfterUpdatePreparation,
  UpdateAdapter,
  UpdateCandidate,
  UpdateProgress,
  UpdateSnapshot,
} from "./updateTypes";

export interface UpdateServiceOptions {
  readonly adapter: UpdateAdapter;
  readonly getCurrentVersion: AppVersionProvider;
  readonly prepareForInstall?: () => Promise<ResumeAfterUpdatePreparation | void>;
  readonly onError?: (error: unknown) => void;
}

type SnapshotListener = (snapshot: UpdateSnapshot) => void;

const INITIAL_SNAPSHOT: UpdateSnapshot = {
  enabled: false,
  status: "idle",
  currentVersion: null,
  availableVersion: null,
  notes: null,
  progress: null,
  message: null,
};

function friendlyError(): string {
  return "暂时无法检查更新，请稍后再试。";
}

export class UpdateService {
  private readonly adapter: UpdateAdapter;
  private readonly getCurrentVersion: AppVersionProvider;
  private readonly prepareForInstall?: UpdateServiceOptions["prepareForInstall"];
  private readonly onError?: (error: unknown) => void;
  private readonly listeners = new Set<SnapshotListener>();
  private currentSnapshot: UpdateSnapshot;
  private currentCandidate: UpdateCandidate | null = null;
  private operation: Promise<void> | null = null;
  private initialization: Promise<void> | null = null;

  public constructor({
    adapter,
    getCurrentVersion,
    prepareForInstall,
    onError,
  }: UpdateServiceOptions) {
    this.adapter = adapter;
    this.getCurrentVersion = getCurrentVersion;
    this.prepareForInstall = prepareForInstall;
    this.onError = onError;
    this.currentSnapshot = {
      ...INITIAL_SNAPSHOT,
      enabled: adapter.enabled,
      message: adapter.enabled ? null : "当前构建未启用更新检查。",
    };
  }

  public get snapshot(): UpdateSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public initialize(): Promise<void> {
    if (this.initialization) {
      return this.initialization;
    }
    this.initialization = this.getCurrentVersion()
      .then((currentVersion) => {
        this.publish({ currentVersion });
      })
      .catch((error: unknown) => {
        this.handleError(error);
      })
      .finally(() => {
        this.initialization = null;
      });
    return this.initialization;
  }

  public checkForUpdate(): Promise<void> {
    if (!this.adapter.enabled) {
      this.publish({ message: "当前构建未启用更新检查。" });
      return Promise.resolve();
    }
    if (this.operation) {
      return this.operation;
    }

    this.operation = this.performCheck().finally(() => {
      this.operation = null;
    });
    return this.operation;
  }

  public installAvailable(): Promise<void> {
    if (
      !this.adapter.enabled ||
      !this.currentCandidate ||
      (this.currentSnapshot.status !== "available" &&
        this.currentSnapshot.status !== "ready")
    ) {
      return Promise.resolve();
    }
    if (this.operation) {
      return this.operation;
    }

    this.operation = this.performInstall().finally(() => {
      this.operation = null;
    });
    return this.operation;
  }

  public dispose(): void {
    this.listeners.clear();
    this.currentCandidate = null;
  }

  private async performCheck(): Promise<void> {
    this.publish({
      status: "checking",
      message: null,
      availableVersion: null,
      notes: null,
      progress: null,
    });
    try {
      await this.initialize();
      const candidate = await this.adapter.check();
      this.currentCandidate = candidate;
      if (!candidate) {
        this.publish({
          status: "up-to-date",
          message: "已经是最新版本。",
          progress: null,
        });
        return;
      }
      this.publish({
        status: "available",
        availableVersion: candidate.version,
        notes: candidate.notes,
        message: "发现新版本啦。",
        progress: null,
      });
    } catch (error: unknown) {
      this.handleError(error);
    }
  }

  private async performInstall(): Promise<void> {
    const candidate = this.currentCandidate;
    if (!candidate) {
      return;
    }

    let resume: ResumeAfterUpdatePreparation | void = undefined;
    try {
      resume = await this.prepareForInstall?.();
      this.publish({
        status: "downloading",
        message: "正在下载更新…",
        progress: null,
      });
      await candidate.download((progress) => this.publishProgress(progress));
      this.publish({
        status: "ready",
        message: "更新已下载，准备安装。",
        progress: 100,
      });
      this.publish({
        status: "installing",
        message: "正在安装更新…",
      });
      await candidate.install();
      await this.adapter.relaunch();
    } catch (error: unknown) {
      resume?.();
      if (candidate.close) {
        await candidate.close().catch(() => undefined);
      }
      this.handleError(error);
    }
  }

  private publishProgress(progress: UpdateProgress): void {
    const percentage = progress.contentLength && progress.contentLength > 0
      ? Math.min(100, (progress.downloadedBytes / progress.contentLength) * 100)
      : null;
    this.publish({
      status: "downloading",
      message: percentage === null ? "正在下载更新…" : `正在下载更新 ${Math.round(percentage)}%`,
      progress: percentage,
    });
  }

  private handleError(error: unknown): void {
    this.onError?.(error);
    this.publish({
      status: "error",
      message: friendlyError(),
      progress: null,
    });
  }

  private publish(patch: Partial<UpdateSnapshot>): void {
    this.currentSnapshot = { ...this.currentSnapshot, ...patch };
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }
}
