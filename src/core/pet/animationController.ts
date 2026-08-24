import type { AnimationDefinition } from "./animationTypes";

export interface AnimationPlaybackSnapshot {
  animationName: string | null;
  currentFrame: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  isPlaying: boolean;
  isPaused: boolean;
}

export class AnimationController {
  private currentAnimationName: string | null = null;
  private currentAnimation: AnimationDefinition | null = null;
  private currentFrame = 0;
  private elapsedMs = 0;
  private playing = false;
  private paused = false;
  private completionCallback: (() => void) | undefined;

  public constructor(
    private readonly animations: Readonly<Record<string, AnimationDefinition>>,
  ) {}

  public play(animationName: string, onComplete?: () => void): AnimationPlaybackSnapshot {
    const animation = this.animations[animationName];
    if (!animation) {
      throw new Error(`Animation "${animationName}" is not registered`);
    }
    if (animation.frames.length === 0 || animation.fps <= 0) {
      throw new Error(`Animation "${animationName}" has invalid frame data`);
    }

    this.currentAnimationName = animationName;
    this.currentAnimation = animation;
    this.currentFrame = 0;
    this.elapsedMs = 0;
    this.playing = true;
    this.paused = false;
    this.completionCallback = onComplete;
    return this.snapshot();
  }

  public stop(): AnimationPlaybackSnapshot {
    this.playing = false;
    this.paused = false;
    this.currentFrame = 0;
    this.elapsedMs = 0;
    this.completionCallback = undefined;
    return this.snapshot();
  }

  public pause(): AnimationPlaybackSnapshot {
    if (this.playing) {
      this.paused = true;
    }
    return this.snapshot();
  }

  public resume(): AnimationPlaybackSnapshot {
    if (this.playing) {
      this.paused = false;
    }
    return this.snapshot();
  }

  public advance(deltaMs: number): AnimationPlaybackSnapshot {
    const animation = this.currentAnimation;
    if (!animation || !this.playing || this.paused || deltaMs <= 0) {
      return this.snapshot();
    }

    const frameDurationMs = 1000 / animation.fps;
    this.elapsedMs += deltaMs;

    while (this.elapsedMs >= frameDurationMs && this.playing) {
      this.elapsedMs -= frameDurationMs;

      if (this.currentFrame + 1 < animation.frames.length) {
        this.currentFrame += 1;
      } else if (animation.loop) {
        this.currentFrame = 0;
      } else {
        this.currentFrame = animation.frames.length - 1;
        this.playing = false;
        this.paused = false;
        const onComplete = this.completionCallback;
        this.completionCallback = undefined;
        onComplete?.();
      }
    }

    return this.snapshot();
  }

  public snapshot(): AnimationPlaybackSnapshot {
    return {
      animationName: this.currentAnimationName,
      currentFrame: this.currentFrame,
      frameCount: this.currentAnimation?.frames.length ?? 0,
      fps: this.currentAnimation?.fps ?? 0,
      loop: this.currentAnimation?.loop ?? false,
      isPlaying: this.playing,
      isPaused: this.paused,
    };
  }
}
