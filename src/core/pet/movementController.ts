export interface DesktopPosition {
  x: number;
  y: number;
}

export interface MovementBounds {
  minX: number;
  maxX: number;
  bottomY: number;
}

export interface MovementSnapshot {
  position: DesktopPosition;
  direction: -1 | 1;
}

export class MovementController {
  private position: DesktopPosition | null = null;
  private direction: -1 | 1 = 1;

  public constructor(private readonly speedPxPerSecond = 42) {}

  public reset(position: DesktopPosition, direction: -1 | 1 = 1): void {
    this.position = { ...position };
    this.direction = direction;
  }

  public advance(deltaMs: number, bounds: MovementBounds): MovementSnapshot {
    const current = this.position ?? { x: bounds.minX, y: bounds.bottomY };
    const minX = Math.min(bounds.minX, bounds.maxX);
    const maxX = Math.max(bounds.minX, bounds.maxX);
    let nextX = current.x + (this.direction * this.speedPxPerSecond * deltaMs) / 1000;

    if (nextX <= minX) {
      nextX = minX;
      this.direction = 1;
    } else if (nextX >= maxX) {
      nextX = maxX;
      this.direction = -1;
    }

    this.position = { x: Math.round(nextX), y: bounds.bottomY };
    return {
      position: { ...this.position },
      direction: this.direction,
    };
  }

  public snapshot(): MovementSnapshot | null {
    return this.position
      ? { position: { ...this.position }, direction: this.direction }
      : null;
  }
}
