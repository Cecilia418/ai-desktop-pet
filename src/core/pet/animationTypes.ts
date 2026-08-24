export type PetAnimationName =
  | "idle"
  | "walk"
  | "sleep"
  | "pet"
  | "poke"
  | "drag"
  | "talk"
  | "eat"
  | "happy"
  | "annoyed";

export type PlaceholderMotion = "idle-bob" | "walk-bob" | "sleep-tilt";

export interface AnimationDefinition {
  frames: readonly string[];
  fps: number;
  loop: boolean;
  placeholderMotion?: PlaceholderMotion;
}

export interface OutfitDefinition {
  id: string;
  animations: Partial<Record<PetAnimationName, AnimationDefinition>>;
}

export interface CharacterAssetContract {
  canvas: {
    width: number;
    height: number;
  };
  standardSequenceCanvas: {
    width: number;
    height: number;
  };
  footAnchor: {
    x: number;
    y: number;
  };
}

export interface CharacterDefinition {
  id: string;
  defaultOutfit: string;
  assetContract: CharacterAssetContract;
  outfits: Readonly<Record<string, OutfitDefinition>>;
}
