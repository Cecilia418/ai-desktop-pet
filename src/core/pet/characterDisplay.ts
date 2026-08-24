export interface DisplaySize {
  width: number;
  height: number;
}

export interface LogicalPoint {
  x: number;
  y: number;
}

export interface CharacterDisplayConfig {
  defaultCharacterScale: number;
  referenceCharacterSize: DisplaySize;
  referenceWindowSize: DisplaySize;
  minimumWindowSize: DisplaySize;
  compactPetFootInset: number;
  actionMenuWindowSize: DisplaySize;
  compactPanelWindowSize: DisplaySize;
  chatWindowSize: DisplaySize;
}

export interface CharacterDisplayMetrics {
  scale: number;
  characterSize: DisplaySize;
  windowSize: DisplaySize;
}

export type PetWindowMode =
  | "pet-only"
  | "action-menu"
  | "compact-panel"
  | "chat";

export interface DisplayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PetWindowLayoutSpec {
  mode: PetWindowMode;
  windowSize: DisplaySize;
  petLane: {
    footCenterLocal: LogicalPoint;
  };
  contentLane: DisplayRect;
  actionMenuLane: {
    x: number;
    y: number;
    width: number;
  };
  bubbleSafeRegion: DisplayRect;
}

export interface PetWindowLayoutSpecs {
  "pet-only": PetWindowLayoutSpec;
  "action-menu": PetWindowLayoutSpec;
  "compact-panel": PetWindowLayoutSpec;
  chat: PetWindowLayoutSpec;
}

export const DEFAULT_CHARACTER_DISPLAY_CONFIG: Readonly<CharacterDisplayConfig> = {
  defaultCharacterScale: 0.5,
  referenceCharacterSize: { width: 238, height: 300 },
  referenceWindowSize: { width: 360, height: 420 },
  minimumWindowSize: { width: 260, height: 300 },
  compactPetFootInset: 18,
  actionMenuWindowSize: { width: 420, height: 340 },
  compactPanelWindowSize: { width: 420, height: 420 },
  chatWindowSize: { width: 420, height: 560 },
};

function scaled(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale));
}

export function deriveCharacterDisplayMetrics(
  config: Readonly<CharacterDisplayConfig> = DEFAULT_CHARACTER_DISPLAY_CONFIG,
): CharacterDisplayMetrics {
  const scale = Number.isFinite(config.defaultCharacterScale) &&
      config.defaultCharacterScale > 0
    ? config.defaultCharacterScale
    : 1;
  const scaledWindow = {
    width: scaled(config.referenceWindowSize.width, scale),
    height: scaled(config.referenceWindowSize.height, scale),
  };

  return {
    scale,
    characterSize: {
      width: scaled(config.referenceCharacterSize.width, scale),
      height: scaled(config.referenceCharacterSize.height, scale),
    },
    windowSize: {
      width: Math.max(scaledWindow.width, config.minimumWindowSize.width),
      height: Math.max(scaledWindow.height, config.minimumWindowSize.height),
    },
  };
}

export function derivePetWindowLayoutSpecs(
  config: Readonly<CharacterDisplayConfig> = DEFAULT_CHARACTER_DISPLAY_CONFIG,
): PetWindowLayoutSpecs {
  const metrics = deriveCharacterDisplayMetrics(config);
  const compactFootInset = Number.isFinite(config.compactPetFootInset)
    ? Math.max(0, config.compactPetFootInset)
    : 18;
  const petOnlyFootCenter = {
    x: metrics.windowSize.width / 2,
    y: Math.max(1, metrics.windowSize.height - compactFootInset),
  };
  const actionMenuWindowSize = expandedWindowSize(
    metrics.windowSize,
    config.actionMenuWindowSize,
  );
  const compactPanelWindowSize = expandedWindowSize(
    metrics.windowSize,
    config.compactPanelWindowSize,
  );
  const chatWindowSize = expandedWindowSize(
    metrics.windowSize,
    config.chatWindowSize,
  );

  const expandedFootCenter = {
    x: 78,
    y: 0,
  };

  return {
    "pet-only": {
      mode: "pet-only",
      windowSize: { ...metrics.windowSize },
      petLane: { footCenterLocal: { ...petOnlyFootCenter } },
      contentLane: {
        x: 0,
        y: 0,
        width: metrics.windowSize.width,
        height: metrics.windowSize.height,
      },
      actionMenuLane: {
        x: Math.round(
          petOnlyFootCenter.x + metrics.characterSize.width / 2 + 8,
        ),
        y: Math.max(
          12,
          Math.round(petOnlyFootCenter.y - metrics.characterSize.height + 12),
        ),
        width: Math.max(188, metrics.windowSize.width - 12),
      },
      bubbleSafeRegion: {
        x: 8,
        y: 10,
        width: Math.max(1, metrics.windowSize.width - 16),
        height: Math.max(1, metrics.windowSize.height - 20),
      },
    },
    "action-menu": {
      mode: "action-menu",
      windowSize: actionMenuWindowSize,
      petLane: {
        footCenterLocal: {
          x: expandedFootCenter.x,
          y: actionMenuWindowSize.height - compactFootInset,
        },
      },
      contentLane: {
        x: 142,
        y: 18,
        width: actionMenuWindowSize.width - 154,
        height: actionMenuWindowSize.height - 30,
      },
      actionMenuLane: {
        x: 142,
        y: 84,
        width: actionMenuWindowSize.width - 154,
      },
      bubbleSafeRegion: {
        x: 8,
        y: 10,
        width: 132,
        height: 150,
      },
    },
    "compact-panel": {
      mode: "compact-panel",
      windowSize: compactPanelWindowSize,
      petLane: {
        footCenterLocal: {
          x: expandedFootCenter.x,
          y: compactPanelWindowSize.height - compactFootInset,
        },
      },
      contentLane: {
        x: 142,
        y: 12,
        width: compactPanelWindowSize.width - 154,
        height: compactPanelWindowSize.height - 24,
      },
      actionMenuLane: {
        x: 142,
        y: 84,
        width: compactPanelWindowSize.width - 154,
      },
      bubbleSafeRegion: {
        x: 8,
        y: 10,
        width: 132,
        height: 190,
      },
    },
    chat: {
      mode: "chat",
      windowSize: chatWindowSize,
      petLane: {
        footCenterLocal: {
          x: expandedFootCenter.x,
          y: chatWindowSize.height - compactFootInset,
        },
      },
      contentLane: {
        x: 142,
        y: 12,
        width: chatWindowSize.width - 154,
        height: chatWindowSize.height - 24,
      },
      actionMenuLane: {
        x: 142,
        y: 84,
        width: chatWindowSize.width - 154,
      },
      bubbleSafeRegion: {
        x: 8,
        y: 10,
        width: 132,
        height: 250,
      },
    },
  };
}

function expandedWindowSize(
  minimum: DisplaySize,
  configured: DisplaySize,
): DisplaySize {
  return {
    width: Math.max(minimum.width, Math.round(configured.width)),
    height: Math.max(minimum.height, Math.round(configured.height)),
  };
}

export function getPlaceholderMotion(
  animation: AnimationDefinition,
): PlaceholderMotion | null {
  if (animation.frames.length !== 1) {
    return null;
  }

  return animation.placeholderMotion ?? null;
}
import type { AnimationDefinition, PlaceholderMotion } from "./animationTypes";
