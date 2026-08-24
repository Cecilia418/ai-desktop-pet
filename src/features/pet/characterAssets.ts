import { defaultCharacterDefinition } from "../../assets/characters/default/manifest";
import type {
  AnimationDefinition,
  CharacterDefinition,
  PetAnimationName,
} from "../../core/pet/animationTypes";

export type {
  AnimationDefinition,
  CharacterDefinition,
  PetAnimationName,
} from "../../core/pet/animationTypes";

export const DEFAULT_CHARACTER_ID = "default";

const characterRegistry: Readonly<Record<string, CharacterDefinition>> = {
  [DEFAULT_CHARACTER_ID]: defaultCharacterDefinition,
};

export function getCharacterDefinition(
  characterId: string = DEFAULT_CHARACTER_ID,
): CharacterDefinition {
  return characterRegistry[characterId] ?? characterRegistry[DEFAULT_CHARACTER_ID];
}

export function getOutfitDefinition(
  character: CharacterDefinition,
  outfitId: string = character.defaultOutfit,
) {
  return character.outfits[outfitId] ?? character.outfits[character.defaultOutfit];
}

export function getCharacterAnimation(
  character: CharacterDefinition,
  animationName: PetAnimationName,
  outfitId: string = character.defaultOutfit,
): AnimationDefinition {
  const outfit = getOutfitDefinition(character, outfitId);
  const requested = outfit?.animations[animationName];
  if (requested) {
    return requested;
  }

  const fallback = outfit?.animations.idle;
  if (!fallback) {
    throw new Error(`Character "${character.id}" has no idle animation`);
  }

  return fallback;
}
