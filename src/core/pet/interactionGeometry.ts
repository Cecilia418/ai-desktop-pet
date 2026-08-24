export interface InteractiveRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PetInteractionRegion = "CHARACTER" | "HEAD" | "BODY";

export interface InteractionPoint {
  x: number;
  y: number;
}

interface NormalizedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Approximate regions intentionally use the rendered character rectangle.
 * They are not alpha-pixel hitboxes and therefore remain stable when assets
 * are replaced or defaultCharacterScale changes.
 */
export const INTERACTION_REGION_DEFINITIONS: Readonly<
  Record<Exclude<PetInteractionRegion, "CHARACTER">, NormalizedRegion>
> = {
  HEAD: { x: 0.12, y: 0.03, width: 0.76, height: 0.5 },
  BODY: { x: 0.12, y: 0.43, width: 0.76, height: 0.54 },
};

export function containsPoint(
  region: InteractiveRegion,
  point: InteractionPoint,
): boolean {
  return (
    point.x >= region.x &&
    point.x <= region.x + region.width &&
    point.y >= region.y &&
    point.y <= region.y + region.height
  );
}

export function resolveInteractionRegion(
  point: InteractionPoint,
  characterRegion: InteractiveRegion,
): PetInteractionRegion | null {
  if (!containsPoint(characterRegion, point)) {
    return null;
  }

  const localX = (point.x - characterRegion.x) / characterRegion.width;
  const localY = (point.y - characterRegion.y) / characterRegion.height;

  if (isInsideNormalizedRegion(localX, localY, INTERACTION_REGION_DEFINITIONS.HEAD)) {
    return "HEAD";
  }

  if (isInsideNormalizedRegion(localX, localY, INTERACTION_REGION_DEFINITIONS.BODY)) {
    return "BODY";
  }

  return "CHARACTER";
}

function isInsideNormalizedRegion(
  x: number,
  y: number,
  region: NormalizedRegion,
): boolean {
  return (
    x >= region.x &&
    x <= region.x + region.width &&
    y >= region.y &&
    y <= region.y + region.height
  );
}
