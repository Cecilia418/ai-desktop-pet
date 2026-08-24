import type {
  PetMovementDebugSnapshot,
  PetRuntimeSnapshot,
} from "../PetRuntime";
import type { PetWindowMode } from "../../../core/pet/characterDisplay";

interface DevPetOverlayProps {
  snapshot: PetRuntimeSnapshot;
  visible: boolean;
  movement: PetMovementDebugSnapshot;
  layoutMode: PetWindowMode;
  windowVisible: boolean;
  interactiveRegionCount: number;
}

export function DevPetOverlay({
  snapshot,
  visible,
  movement,
  layoutMode,
  windowVisible,
  interactiveRegionCount,
}: DevPetOverlayProps) {
  if (!import.meta.env.DEV || !visible) {
    return null;
  }

  return (
    <aside className="dev-pet-overlay" aria-label="开发调试数值">
      <span>STATE: {snapshot.state}</span>
      <span>LAYOUT: {layoutMode}</span>
      <span>VISIBLE: {windowVisible ? "YES" : "NO"}</span>
      <span>
        ANIM: {snapshot.animation.animationName}/{snapshot.animation.currentFrame}
      </span>
      <span>
        EFFECT: {snapshot.effect?.kind ?? "-"}
      </span>
      <span>
        INTERACTION: {snapshot.interaction.activeInteraction ?? "-"}
      </span>
      <span>
        POS: {snapshot.position ? `${snapshot.position.x},${snapshot.position.y}` : "-"}
      </span>
      <span>
        WINDOW: {movement.context?.position
          ? `${movement.context.position.x},${movement.context.position.y}`
          : "-"}
      </span>
      <span>
        REQUESTED: {movement.requestedPosition
          ? `${movement.requestedPosition.x},${movement.requestedPosition.y}`
          : "-"}
      </span>
      <span>OWNER: {movement.positionOwner ?? "-"}</span>
      <span>DELTA: {movement.lastPositionDelta
        ? `${movement.lastPositionDelta.x},${movement.lastPositionDelta.y}`
        : "-"}</span>
      <span>
        BOUNDS: {movement.context ? `${movement.context.bounds.minX}-${movement.context.bounds.maxX}` : "-"}
      </span>
      <span>
        RAW: {movement.context?.windowSize && movement.context.workArea
          ? `${movement.context.windowSize.width}/${movement.context.workArea.size.width}@${movement.context.scaleFactor ?? "?"}`
          : "-"}
      </span>
      <span>
        MOVE: {movement.paused ? "PAUSED" : movement.positionWriteInFlight ? "WRITE" : "READY"}
      </span>
      <span>
        QUEUE: {movement.queueLength}/{movement.writeInFlight ? "WRITE" : "IDLE"}
      </span>
      <span>REGIONS: {interactiveRegionCount}</span>
      {snapshot.error ? <span>ERROR: {snapshot.error}</span> : null}
      <span>HUNGER: {Math.round(snapshot.stats.hunger)}</span>
      <span>MOOD: {Math.round(snapshot.stats.mood)}</span>
      <span>ENERGY: {Math.round(snapshot.stats.energy)}</span>
      <span>INTIMACY: {Math.round(snapshot.stats.intimacy)}</span>
      <span>TIME: {snapshot.clock.timePeriod}</span>
    </aside>
  );
}
