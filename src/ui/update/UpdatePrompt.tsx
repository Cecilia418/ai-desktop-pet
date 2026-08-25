import { Button, Panel, StatusChip } from "../design-system";
import type { RefObject } from "react";
import type { UpdateSnapshot } from "../../platform/update/updateTypes";

function summarizeNotes(notes: string | null): string | null {
  if (!notes) {
    return null;
  }
  const normalized = notes.replace(/\s+/g, " ").trim();
  return normalized.length > 140
    ? normalized.slice(0, 137) + "…"
    : normalized;
}

export function UpdatePrompt({
  promptRef,
  snapshot,
  onInstall,
  onDismiss,
}: {
  readonly promptRef: RefObject<HTMLDivElement | null>;
  readonly snapshot: UpdateSnapshot;
  readonly onInstall: () => void;
  readonly onDismiss: () => void;
}) {
  const notes = summarizeNotes(snapshot.notes);

  return (
    <div
      ref={promptRef}
      className="pet-update-prompt-shell"
      role="dialog"
      aria-label="软件更新提示"
    >
      <Panel className="pet-update-prompt" tone="blue">
        <div className="pet-update-prompt__heading">
          <div>
            <span className="pet-update-prompt__eyebrow">软件更新</span>
            <h2>发现新版本啦</h2>
          </div>
          <StatusChip tone="blue">{snapshot.availableVersion ?? "新版本"}</StatusChip>
        </div>
        <p className="pet-update-prompt__versions">
          当前 {snapshot.currentVersion ?? "读取中…"} · 更新至 {snapshot.availableVersion ?? "读取中…"}
        </p>
        {notes ? <p className="pet-update-prompt__notes">{notes}</p> : null}
        <div className="pet-update-prompt__actions">
          <Button type="button" variant="quiet" onClick={onDismiss}>
            稍后提醒
          </Button>
          <Button type="button" variant="primary" onClick={onInstall}>
            更新
          </Button>
        </div>
      </Panel>
    </div>
  );
}
