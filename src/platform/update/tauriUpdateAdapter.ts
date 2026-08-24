import { relaunch } from "@tauri-apps/plugin-process";
import {
  check as checkForUpdate,
  type DownloadEvent,
} from "@tauri-apps/plugin-updater";
import { productionUpdaterEnabled } from "./updateConfig";
import type {
  UpdateAdapter,
  UpdateCandidate,
  UpdateProgress,
} from "./updateTypes";

function mapProgress(
  event: DownloadEvent,
  downloadedBytes: number,
  contentLength: number | null,
): UpdateProgress {
  if (event.event === "Started") {
    return {
      downloadedBytes,
      contentLength: event.data.contentLength ?? null,
    };
  }
  if (event.event === "Progress") {
    return {
      downloadedBytes: downloadedBytes + event.data.chunkLength,
      contentLength,
    };
  }
  return { downloadedBytes, contentLength };
}

export class TauriUpdateAdapter implements UpdateAdapter {
  public readonly enabled = true;

  public async check(): Promise<UpdateCandidate | null> {
    const update = await checkForUpdate();
    if (!update) {
      return null;
    }

    return {
      version: update.version,
      notes: update.body ?? null,
      date: update.date ?? null,
      download: async (onProgress) => {
        let downloadedBytes = 0;
        let contentLength: number | null = null;
        await update.download((event) => {
          const next = mapProgress(event, downloadedBytes, contentLength);
          downloadedBytes = next.downloadedBytes;
          contentLength = next.contentLength;
          onProgress(next);
        });
      },
      install: () => update.install(),
      close: () => update.close(),
    };
  }

  public async relaunch(): Promise<void> {
    await relaunch();
  }
}

class DisabledUpdateAdapter implements UpdateAdapter {
  public readonly enabled = false;

  public async check(): Promise<UpdateCandidate | null> {
    return null;
  }

  public async relaunch(): Promise<void> {
    return;
  }
}

export function createDefaultUpdateAdapter(): UpdateAdapter {
  return productionUpdaterEnabled
    ? new TauriUpdateAdapter()
    : new DisabledUpdateAdapter();
}
