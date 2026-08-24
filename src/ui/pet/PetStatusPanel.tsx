import type { RefObject } from "react";
import type { PetStatsSnapshot } from "../../core/pet/petStats";
import {
  Panel,
  PanelHeader,
  ProgressBar,
  StatusChip,
} from "../design-system";
import {
  mapEnergyPresentation,
  mapHungerPresentation,
  mapMoodPresentation,
} from "./statusMapping";

interface PetStatusPanelProps {
  readonly stats: Pick<PetStatsSnapshot, "hunger" | "mood" | "energy">;
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly onClose: () => void;
}

export function PetStatusPanel({
  stats,
  panelRef,
  onClose,
}: PetStatusPanelProps) {
  const rows = [
    {
      key: "hunger",
      name: "饱腹",
      value: stats.hunger,
      presentation: mapHungerPresentation(stats.hunger),
    },
    {
      key: "mood",
      name: "心情",
      value: stats.mood,
      presentation: mapMoodPresentation(stats.mood),
    },
    {
      key: "energy",
      name: "精力",
      value: stats.energy,
      presentation: mapEnergyPresentation(stats.energy),
    },
  ] as const;

  return (
    <div ref={panelRef} className="pet-panel-shell pet-panel-shell--status">
      <Panel className="pet-status-panel" tone="surface">
        <PanelHeader
          title="女儿状态"
          subtitle="今天也陪着妈妈"
          onClose={onClose}
        />
        <div className="pet-status-list">
          {rows.map((row) => (
            <div className="pet-status-row" key={row.key}>
              <div className="pet-status-row__label">
                <span>{row.name}</span>
                <StatusChip tone={row.presentation.tone}>
                  {row.presentation.label}
                </StatusChip>
              </div>
              <ProgressBar
                value={row.value}
                tone={row.presentation.tone}
                label={row.name}
              />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
