import type { RefObject } from "react";
import {
  Button,
  Panel,
  PanelHeader,
  ProgressBar,
  StatusChip,
} from "../design-system";
import type { UpdateSnapshot } from "../../platform/update/updateTypes";

export function SettingsPanel({
  panelRef,
  onClose,
  updateSnapshot,
  onCheckUpdate,
  onInstallUpdate,
}: {
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
  readonly updateSnapshot: UpdateSnapshot;
  readonly onCheckUpdate: () => void;
  readonly onInstallUpdate: () => void;
}) {
  const busy = updateSnapshot.status === "checking" ||
    updateSnapshot.status === "downloading" ||
    updateSnapshot.status === "installing";
  const canInstall = updateSnapshot.status === "available" ||
    updateSnapshot.status === "ready";

  return (
    <div ref={panelRef} className="pet-panel-shell pet-panel-shell--settings">
      <Panel className="pet-settings-panel" tone="surface">
        <PanelHeader
          title="设置"
          subtitle="更多陪伴功能正在准备中"
          onClose={onClose}
        />
        <p className="pet-settings-copy">
          这里会在后续版本加入可调节的桌宠偏好。
        </p>
        <div className="pet-settings-update" aria-label="软件更新">
          <div className="pet-settings-version">
            <span>当前版本</span>
            <strong>{updateSnapshot.currentVersion ?? "读取中…"}</strong>
          </div>
          {updateSnapshot.availableVersion ? (
            <div className="pet-settings-update__available">
              <StatusChip tone="blue">新版本 {updateSnapshot.availableVersion}</StatusChip>
              {updateSnapshot.notes ? <span>{updateSnapshot.notes}</span> : null}
            </div>
          ) : null}
          {updateSnapshot.progress !== null ? (
            <ProgressBar
              value={updateSnapshot.progress}
              tone="blue"
              label="更新下载进度"
            />
          ) : null}
          {updateSnapshot.message ? (
            <p className="pet-settings-update__message" role="status" aria-live="polite">
              {updateSnapshot.message}
            </p>
          ) : null}
          <div className="pet-settings-update__actions">
            <Button
              type="button"
              variant="soft"
              disabled={!updateSnapshot.enabled || busy}
              onClick={onCheckUpdate}
            >
              {busy ? "处理中…" : "检查更新"}
            </Button>
            {canInstall ? (
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={onInstallUpdate}
              >
                更新
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>
    </div>
  );
}
