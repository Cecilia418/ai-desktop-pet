import { describe, expect, it, vi } from "vitest";
import { UpdateService } from "./updateService";
import type { UpdateAdapter, UpdateCandidate } from "./updateTypes";

function candidate(overrides: Partial<UpdateCandidate> = {}): UpdateCandidate {
  return {
    version: "0.1.1",
    notes: "稳定性改进",
    date: null,
    download: vi.fn(async () => undefined),
    install: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...overrides,
  };
}

function adapter(overrides: Partial<UpdateAdapter> = {}): UpdateAdapter {
  return {
    enabled: true,
    check: vi.fn(async () => null),
    relaunch: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("UpdateService", () => {
  it("reports an up-to-date production session", async () => {
    const updateAdapter = adapter();
    const service = new UpdateService({
      adapter: updateAdapter,
      getCurrentVersion: async () => "0.1.0",
    });

    await service.initialize();
    await service.checkForUpdate();

    expect(service.snapshot.currentVersion).toBe("0.1.0");
    expect(service.snapshot.status).toBe("up-to-date");
    expect(updateAdapter.check).toHaveBeenCalledOnce();
  });

  it("coalesces concurrent checks and exposes an available update", async () => {
    let resolveCheck: ((value: UpdateCandidate) => void) | undefined;
    const available = candidate();
    const updateAdapter = adapter({
      check: vi.fn(
        () => new Promise<UpdateCandidate>((resolve) => {
          resolveCheck = resolve;
        }),
      ),
    });
    const service = new UpdateService({
      adapter: updateAdapter,
      getCurrentVersion: async () => "0.1.0",
    });

    const first = service.checkForUpdate();
    const second = service.checkForUpdate();
    expect(first).toBe(second);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updateAdapter.check).toHaveBeenCalledOnce();

    resolveCheck?.(available);
    await first;

    expect(service.snapshot.status).toBe("available");
    expect(service.snapshot.availableVersion).toBe("0.1.1");
  });

  it("downloads, installs, and relaunches only after preparation flush succeeds", async () => {
    const download = vi.fn(async (onProgress: (progress: { downloadedBytes: number; contentLength: number }) => void) => {
      onProgress({ downloadedBytes: 50, contentLength: 100 });
    });
    const install = vi.fn(async () => undefined);
    const available = candidate({ download, install });
    const updateAdapter = adapter({ check: vi.fn(async () => available) });
    const resume = vi.fn();
    const prepareForInstall = vi.fn(async () => resume);
    const service = new UpdateService({
      adapter: updateAdapter,
      getCurrentVersion: async () => "0.1.0",
      prepareForInstall,
    });

    await service.checkForUpdate();
    await service.installAvailable();

    expect(prepareForInstall).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledOnce();
    expect(install).toHaveBeenCalledOnce();
    expect(updateAdapter.relaunch).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
    expect(service.snapshot.status).toBe("installing");
  });

  it("publishes the complete available-to-install lifecycle", async () => {
    const statuses: string[] = [];
    const available = candidate({
      download: vi.fn(async (onProgress) => {
        onProgress({ downloadedBytes: 100, contentLength: 100 });
      }),
    });
    const service = new UpdateService({
      adapter: adapter({ check: vi.fn(async () => available) }),
      getCurrentVersion: async () => "0.1.0",
      prepareForInstall: async () => undefined,
    });
    service.subscribe((snapshot) => statuses.push(snapshot.status));

    await service.checkForUpdate();
    await service.installAvailable();

    expect(statuses).toEqual(expect.arrayContaining([
      "checking",
      "available",
      "downloading",
      "ready",
      "installing",
    ]));
    expect(available.close).not.toHaveBeenCalled();
  });

  it("closes a failed update candidate and reports the error without relaunch", async () => {
    const available = candidate({
      download: vi.fn(async () => {
        throw new Error("download failed");
      }),
    });
    const updateAdapter = adapter({ check: vi.fn(async () => available) });
    const resume = vi.fn();
    const service = new UpdateService({
      adapter: updateAdapter,
      getCurrentVersion: async () => "0.1.0",
      prepareForInstall: async () => resume,
    });

    await service.checkForUpdate();
    await service.installAvailable();

    expect(resume).toHaveBeenCalledOnce();
    expect(available.close).toHaveBeenCalledOnce();
    expect(updateAdapter.relaunch).not.toHaveBeenCalled();
    expect(service.snapshot.status).toBe("error");
  });

  it("does not install when persistence preparation fails", async () => {
    const available = candidate();
    const updateAdapter = adapter({ check: vi.fn(async () => available) });
    const service = new UpdateService({
      adapter: updateAdapter,
      getCurrentVersion: async () => "0.1.0",
      prepareForInstall: async () => {
        throw new Error("flush failed");
      },
    });

    await service.checkForUpdate();
    await service.installAvailable();

    expect(available.download).not.toHaveBeenCalled();
    expect(available.install).not.toHaveBeenCalled();
    expect(updateAdapter.relaunch).not.toHaveBeenCalled();
    expect(service.snapshot.status).toBe("error");
    expect(service.snapshot.message).toContain("无法检查更新");
  });

  it("keeps development updater disabled without invoking the adapter", async () => {
    const updateAdapter = adapter({ enabled: false });
    const service = new UpdateService({
      adapter: updateAdapter,
      getCurrentVersion: async () => "0.1.0",
    });

    await service.checkForUpdate();
    await service.installAvailable();

    expect(updateAdapter.check).not.toHaveBeenCalled();
    expect(service.snapshot.enabled).toBe(false);
    expect(service.snapshot.message).toContain("未启用更新检查");
  });
});
