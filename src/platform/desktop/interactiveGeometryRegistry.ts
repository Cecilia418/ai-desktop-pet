import {
  type InteractiveRegion,
} from "../../core/pet/interactionGeometry";

export type InteractiveGeometryKey =
  | "character"
  | "affordance"
  | "action-menu"
  | "panel"
  | "update-prompt";

export type GeometryListener = () => void;

function readElementRegion(element: HTMLElement): InteractiveRegion | null {
  const rect = element.getBoundingClientRect();
  const viewportWidth =
    typeof document !== "undefined"
      ? document.documentElement.clientWidth || window.innerWidth
      : rect.right;
  const viewportHeight =
    typeof document !== "undefined"
      ? document.documentElement.clientHeight || window.innerHeight
      : rect.bottom;
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(viewportWidth, rect.right);
  const bottom = Math.min(viewportHeight, rect.bottom);
  if (right <= left || bottom <= top) {
    return null;
  }
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Keeps actual rendered DOM geometry as the single source of truth for
 * passthrough. The registry is presentation/platform glue; it has no pet
 * state or business behavior.
 */
export class InteractiveGeometryRegistry {
  private readonly elements = new Map<
    InteractiveGeometryKey,
    HTMLElement
  >();
  private readonly regions = new Map<
    InteractiveGeometryKey,
    InteractiveRegion
  >();
  private readonly listeners = new Set<GeometryListener>();
  private readonly resizeObserver: ResizeObserver | null;
  private readonly onWindowResize = () => {
    this.refresh();
  };

  public constructor() {
    this.resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => this.refresh())
        : null;
    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onWindowResize);
    }
  }

  public register(
    key: InteractiveGeometryKey,
    element: HTMLElement | null,
  ): () => void {
    const previous = this.elements.get(key);
    if (previous && previous !== element) {
      this.resizeObserver?.unobserve(previous);
    }

    if (!element) {
      this.elements.delete(key);
      this.regions.delete(key);
      this.notify();
      return () => undefined;
    }

    this.elements.set(key, element);
    this.resizeObserver?.observe(element);
    this.refresh();
    return () => {
      if (this.elements.get(key) !== element) {
        return;
      }
      this.resizeObserver?.unobserve(element);
      this.elements.delete(key);
      this.regions.delete(key);
      this.notify();
    };
  }

  public subscribe(listener: GeometryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getRegion(key: InteractiveGeometryKey): InteractiveRegion | null {
    const element = this.elements.get(key);
    if (!element) {
      return null;
    }
    const region = readElementRegion(element);
    if (region) {
      this.regions.set(key, region);
    } else {
      this.regions.delete(key);
    }
    return region;
  }

  public getRegions(): readonly InteractiveRegion[] {
    const regions: InteractiveRegion[] = [];
    for (const key of this.elements.keys()) {
      const region = this.getRegion(key);
      if (region) {
        regions.push(region);
      }
    }
    return regions;
  }

  public refresh(): void {
    let changed = false;
    for (const [key, element] of this.elements) {
      const next = readElementRegion(element);
      const previous = this.regions.get(key);
      if (!sameRegion(previous, next)) {
        changed = true;
      }
      if (next) {
        this.regions.set(key, next);
      } else {
        this.regions.delete(key);
      }
    }
    if (changed) {
      this.notify();
    }
  }

  public dispose(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onWindowResize);
    }
    if (this.resizeObserver) {
      for (const element of this.elements.values()) {
        this.resizeObserver.unobserve(element);
      }
      this.resizeObserver.disconnect();
    }
    this.elements.clear();
    this.regions.clear();
    this.listeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function sameRegion(
  a: InteractiveRegion | undefined,
  b: InteractiveRegion | null,
): boolean {
  if (!a && !b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height
  );
}
