export type ActivePanel = "feed" | "status" | "chat" | "settings" | null;

export interface PanelCoordinatorSnapshot {
  readonly activePanel: ActivePanel;
}

type PanelListener = (snapshot: PanelCoordinatorSnapshot) => void;

/**
 * Presentation-only panel state. It deliberately knows nothing about
 * PetState, PetVitals, or the runtime business rules.
 */
export class PanelCoordinator {
  private readonly listeners = new Set<PanelListener>();
  private currentSnapshot: PanelCoordinatorSnapshot = { activePanel: null };

  public get snapshot(): PanelCoordinatorSnapshot {
    return this.currentSnapshot;
  }

  public subscribe(listener: PanelListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public open(panel: Exclude<ActivePanel, null>): void {
    if (this.currentSnapshot.activePanel === panel) {
      return;
    }
    this.publish({ activePanel: panel });
  }

  public close(): void {
    if (this.currentSnapshot.activePanel === null) {
      return;
    }
    this.publish({ activePanel: null });
  }

  public dispose(): void {
    this.listeners.clear();
  }

  private publish(snapshot: PanelCoordinatorSnapshot): void {
    this.currentSnapshot = snapshot;
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
