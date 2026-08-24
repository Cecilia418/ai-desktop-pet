import type { RefObject } from "react";
import { Panel, PanelHeader } from "../design-system";

export function SettingsPanel({
  panelRef,
  onClose,
}: {
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
}) {
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
      </Panel>
    </div>
  );
}
