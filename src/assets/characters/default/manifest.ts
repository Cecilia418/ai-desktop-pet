import type {
  AnimationDefinition,
  CharacterDefinition,
} from "../../../core/pet/animationTypes";
import idleFrame1 from "./idle/idle_001.png.png";
import idleFrame2 from "./idle/idle_002.png.png";
import idleFrame3 from "./idle/idle_003.png.png";
import idleFrame4 from "./idle/idle_004.png.png";
import idleFrame5 from "./idle/idle_005.png.png";
import idleFrame6 from "./idle/idle_006.png.png";

const defaultFrames = [
  idleFrame1,
  idleFrame2,
  idleFrame3,
  idleFrame4,
  idleFrame5,
  idleFrame6,
] as const;

function defaultAnimation(): AnimationDefinition {
  return {
    frames: defaultFrames,
    fps: 6,
    loop: true,
  };
}

export const defaultCharacterDefinition: CharacterDefinition = {
  id: "default",
  defaultOutfit: "default",
  assetContract: {
    canvas: { width: 1037, height: 1156 },
    standardSequenceCanvas: { width: 1024, height: 1200 },
    footAnchor: { x: 0.5, y: 1 },
  },
  outfits: {
    default: {
      id: "default",
      animations: {
        idle: defaultAnimation(),
        walk: defaultAnimation(),
        sleep: defaultAnimation(),
      },
    },
  },
};
