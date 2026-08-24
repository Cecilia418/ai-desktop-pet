import type { RefObject } from "react";
import type { FoodDefinition } from "../../core/pet/foodDefinitions";
import { Button, Panel, PanelHeader } from "../design-system";

interface FeedPanelProps {
  readonly foods: readonly FoodDefinition[];
  readonly panelRef: RefObject<HTMLDivElement | null>;
  readonly onSelect: (foodId: string) => void;
  readonly onClose: () => void;
}

export function FeedPanel({
  foods,
  panelRef,
  onSelect,
  onClose,
}: FeedPanelProps) {
  return (
    <div ref={panelRef} className="pet-panel-shell pet-panel-shell--feed">
      <Panel className="pet-feed-panel" tone="yellow">
        <PanelHeader
          title="给女儿吃点东西"
          subtitle="挑一个她今天想吃的"
          onClose={onClose}
        />
        <div className="pet-feed-list">
          {foods.map((food) => (
            <Button
              key={food.id}
              className="pet-feed-item"
              variant="ghost"
              type="button"
              onClick={() => onSelect(food.id)}
            >
              <span className="pet-feed-item__asset" aria-hidden="true">
                {food.asset ?? "·"}
              </span>
              <span>{food.name}</span>
            </Button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
