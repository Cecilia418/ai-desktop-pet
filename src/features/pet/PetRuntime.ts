import {
  AnimationController,
  type AnimationPlaybackSnapshot,
} from "../../core/pet/animationController";
import {
  DEFAULT_PET_BALANCE,
  type PetActivity,
  type PetBalanceConfig,
} from "../../core/pet/petBalance";
import {
  DEFAULT_INTERACTION_BALANCE,
  type InteractionBalanceConfig,
} from "../../core/pet/interactionBalance";
import {
  getFoodDefinition,
} from "../../core/pet/foodDefinitions";
import {
  resolveClickInteraction,
  resolveFeedInteraction,
  resolvePokeReaction,
} from "../../core/pet/interactionRules";
import {
  PetClock,
  type ClockSource,
  type PetClockSnapshot,
} from "../../core/pet/petClock";
import { calculateOfflineProgress } from "../../core/pet/offlineProgress";
import {
  MovementController,
  type DesktopPosition,
  type MovementSnapshot,
} from "../../core/pet/movementController";
import {
  PetStateMachine,
  type PetState,
  type PetStateTransitionReason,
  type PetStateTransitionResult,
} from "../../core/pet/petStateMachine";
import { PetVitals } from "../../core/pet/petVitals";
import type { PetStatsSnapshot } from "../../core/pet/petStats";
import {
  getCharacterAnimation,
  type CharacterDefinition,
} from "./characterAssets";
import { ChatService } from "./chat/chatService";
import { InteractionCooldownManager } from "./interactionCooldown";
import {
  InteractionRewardCooldownManager,
  type InteractionRewardDurations,
} from "./interactionRewardCooldown";
import { PetEffectController, type PetEffectSnapshot } from "./petEffectController";
import type {
  ChatCloseInteractionEvent,
  ChatSendInteractionEvent,
  ClickInteractionEvent,
  FeedInteractionEvent,
  PetInteractionEvent,
  PetInteractionRegion,
  PetInteraction,
  PokeInteractionEvent,
  DragEndInteractionEvent,
} from "./petInteractionEvent";
import { PokeStreakTracker } from "./pokeStreakTracker";
import { PetInteractionFeedback } from "./interactionFeedback";
import type {
  DesktopWindowManager,
  MovementContext,
} from "../../platform/desktop/windowManager";
import type { WindowPositionOwner } from "../../platform/desktop/positionWriteQueue";
import { PetPersistenceService } from "../../platform/persistence/petPersistenceService";
import type { PersistedPetState } from "../../platform/persistence/petPersistenceTypes";

const STATE_ANIMATIONS: Readonly<Record<PetState, "idle" | "walk" | "sleep">> = {
  IDLE: "idle",
  WALKING: "walk",
  SLEEPING: "sleep",
};

const WALKING_TEST_DURATION_MS = 6_000;

export interface InteractionSessionSnapshot {
  readonly activeInteraction: "PET" | "POKE" | "DRAG" | "FEED" | "CHAT" | null;
  readonly startedAt: number | null;
}

export interface PetRuntimeSnapshot {
  state: PetState;
  animation: AnimationPlaybackSnapshot;
  stats: PetStatsSnapshot;
  clock: PetClockSnapshot;
  position: DesktopPosition | null;
  effect: PetEffectSnapshot | null;
  interaction: InteractionSessionSnapshot;
  error: string | null;
}

export interface PetMovementDebugSnapshot {
  context: MovementContext | null;
  movement: MovementSnapshot | null;
  paused: boolean;
  movementActive: boolean;
  positionWriteInFlight: boolean;
  positionOwner: WindowPositionOwner | null;
  requestedPosition: DesktopPosition | null;
  lastPositionDelta: DesktopPosition | null;
  windowVisible: boolean;
  queueLength: number;
  writeInFlight: boolean;
}

export interface PetRuntimeOptions {
  character: CharacterDefinition;
  windowManager: DesktopWindowManager;
  balance?: Readonly<PetBalanceConfig>;
  interactionBalance?: Readonly<InteractionBalanceConfig>;
  now?: ClockSource;
  interactionFeedback?: PetInteractionFeedback;
  rewardCooldowns?: InteractionRewardCooldownManager;
  pokeStreak?: PokeStreakTracker;
  effectController?: PetEffectController;
  chatService?: ChatService;
  persistenceService?: PetPersistenceService;
}

type SnapshotListener = (snapshot: PetRuntimeSnapshot) => void;

export class PetRuntime {
  private readonly stateMachine = new PetStateMachine();
  private readonly animationController: AnimationController;
  private readonly movementController = new MovementController();
  private readonly vitals: PetVitals;
  private readonly clock: PetClock;
  private readonly listeners = new Set<SnapshotListener>();
  private readonly windowManager: DesktopWindowManager;
  private readonly balance: Readonly<PetBalanceConfig>;
  private readonly interactionBalance: Readonly<InteractionBalanceConfig>;
  private readonly interactionFeedback: PetInteractionFeedback;
  private readonly rewardCooldowns: InteractionRewardCooldownManager;
  private readonly pokeStreak: PokeStreakTracker;
  private readonly effectController: PetEffectController;
  private readonly chatService: ChatService;
  private readonly persistenceService?: PetPersistenceService;
  private readonly now: ClockSource;
  private readonly removeEffectListener: () => void;
  private movementContext: MovementContext | null = null;
  private position: DesktopPosition | null = null;
  private stateElapsedMs = 0;
  private vitalsElapsedMs = 0;
  private lastFrameTimestamp: number | undefined;
  private frameHandle: number | undefined;
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private positionWriteInFlight = false;
  private pendingPosition: DesktopPosition | null = null;
  private movementContextRequestId = 0;
  private interactionActive = false;
  private movementPaused = false;
  private windowVisible = true;
  private requestedPosition: DesktopPosition | null = null;
  private lastPositionDelta: DesktopPosition | null = null;
  private lastCompactPosition: DesktopPosition | null = null;
  private startupRestoredPosition: DesktopPosition | null = null;
  private lastPersistenceKey: string | null = null;
  private compactPositionPersistenceEnabled = true;
  private persistenceReady = false;
  private initializationPromise: Promise<void> | null = null;
  private sleepWakeArmed = false;
  private running = false;
  private currentInteraction: InteractionSessionSnapshot = {
    activeInteraction: null,
    startedAt: null,
  };
  private currentSnapshot: PetRuntimeSnapshot;

  public constructor({
    character,
    windowManager,
    balance = DEFAULT_PET_BALANCE,
    interactionBalance = DEFAULT_INTERACTION_BALANCE,
    now,
    interactionFeedback,
    rewardCooldowns,
    pokeStreak,
    effectController,
    chatService,
    persistenceService,
  }: PetRuntimeOptions) {
    this.windowManager = windowManager;
    this.balance = balance;
    this.interactionBalance = interactionBalance;
    this.now = now ?? (() => Date.now());
    this.persistenceService = persistenceService;
    this.vitals = new PetVitals(balance.initialStats, balance);
    this.clock = new PetClock(this.now);
    this.animationController = new AnimationController(
      this.animationCatalog(character),
    );
    this.animationController.play("idle");
    this.interactionFeedback = interactionFeedback ??
      new PetInteractionFeedback({
        cooldowns: new InteractionCooldownManager({
          CLICK: 400,
          PET: interactionBalance.pet.reactionCooldownMs,
          POKE: interactionBalance.poke.reactionCooldownMs,
          POKE_HEAD: interactionBalance.poke.reactionCooldownMs,
          POKE_BODY: interactionBalance.poke.reactionCooldownMs,
          POKE_ANNOYED: interactionBalance.poke.reactionCooldownMs,
          FEED_LOVE: interactionBalance.feed.reactionCooldownMs,
          FEED_NORMAL: interactionBalance.feed.reactionCooldownMs,
          FEED_DISLIKE: interactionBalance.feed.reactionCooldownMs,
          FULL: interactionBalance.feed.reactionCooldownMs,
          WAKE: 400,
          CHAT: interactionBalance.chat.localInteractionCooldownMs,
        }, this.now),
      });
    this.rewardCooldowns = rewardCooldowns ?? new InteractionRewardCooldownManager(
      this.rewardDurations(interactionBalance),
      this.now,
    );
    this.pokeStreak = pokeStreak ?? new PokeStreakTracker(
      interactionBalance.poke.streakWindowMs,
    );
    this.effectController = effectController ?? new PetEffectController(
      undefined,
      this.now,
    );
    this.chatService = chatService ?? new ChatService();
    this.currentSnapshot = this.buildSnapshot();
    this.removeEffectListener = this.effectController.subscribe(() => this.publish());
  }

  public get snapshot(): PetRuntimeSnapshot {
    return this.currentSnapshot;
  }

  public get speechBubble() {
    return this.interactionFeedback.speechBubble;
  }

  public get chat(): ChatService {
    return this.chatService;
  }

  public get movementDebugSnapshot(): PetMovementDebugSnapshot {
    const queue = this.windowManager.getPositionWriteDebugSnapshot?.();
    const movementActive = this.canAutonomousMove();
    return {
      context: this.movementContext
        ? {
            position: { ...this.movementContext.position },
            bounds: { ...this.movementContext.bounds },
            windowSize: this.movementContext.windowSize
              ? { ...this.movementContext.windowSize }
              : undefined,
            workArea: this.movementContext.workArea
              ? {
                  position: { ...this.movementContext.workArea.position },
                  size: { ...this.movementContext.workArea.size },
                }
              : undefined,
            scaleFactor: this.movementContext.scaleFactor,
          }
        : null,
      movement: this.movementController.snapshot(),
      paused: !movementActive,
      movementActive,
      positionWriteInFlight: this.positionWriteInFlight ||
        (queue?.writeInFlight ?? false),
      positionOwner: queue?.owner ?? (
        !this.windowVisible
          ? "HIDDEN"
          : this.interactionActive
            ? "DRAG"
            : movementActive
              ? "WALKING"
              : null
      ),
      requestedPosition: this.requestedPosition
        ? { ...this.requestedPosition }
        : queue?.requestedPosition ?? null,
      lastPositionDelta: this.lastPositionDelta
        ? { ...this.lastPositionDelta }
        : null,
      windowVisible: this.windowVisible,
      queueLength: queue?.queueLength ?? (this.positionWriteInFlight ? 1 : 0),
      writeInFlight: queue?.writeInFlight ?? this.positionWriteInFlight,
    };
  }

  public async initialize(): Promise<void> {
    if (this.running) {
      return;
    }
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.restorePersistedState()
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          const detail = error instanceof Error ? error.message : String(error);
          this.setError("暂时无法读取本地存档: " + detail);
        }
      })
      .finally(() => {
        this.persistenceReady = true;
        this.start();
        this.initializationPromise = null;
      });
    return this.initializationPromise;
  }

  public async shutdown(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
    this.stop();
    if (!this.persistenceService || !this.persistenceReady) {
      return;
    }
    try {
      await this.persistenceService.flush(this.buildPersistedState());
    } catch (error: unknown) {
      if (import.meta.env.DEV) {
        const detail = error instanceof Error ? error.message : String(error);
        this.setError("暂时无法保存本地存档: " + detail);
      }
    }
  }

  public setCompactPositionPersistenceEnabled(enabled: boolean): void {
    if (this.compactPositionPersistenceEnabled === enabled) {
      return;
    }
    this.compactPositionPersistenceEnabled = enabled;
    if (enabled) {
      this.publish();
    }
  }

  public start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.lastFrameTimestamp = undefined;
    this.vitalsElapsedMs = 0;
    this.clock.reset();
    void this.refreshMovementContext(false);
    this.frameHandle = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.running = false;
    this.interactionActive = false;
    this.currentInteraction = { activeInteraction: null, startedAt: null };
    this.pendingPosition = null;
    this.lastFrameTimestamp = undefined;
    if (this.frameHandle !== undefined) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = undefined;
    }
    if (this.settleTimer !== undefined) {
      globalThis.clearTimeout(this.settleTimer);
      this.settleTimer = undefined;
    }
  }

  public dispose(): void {
    this.stop();
    this.removeEffectListener();
    this.interactionFeedback.dispose();
    this.effectController.dispose();
    this.chatService.dispose();
    this.persistenceService?.dispose();
  }

  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.currentSnapshot);
    return () => this.listeners.delete(listener);
  }

  public transitionTo(
    next: PetState,
    reason: PetStateTransitionReason,
  ): PetStateTransitionResult {
    const result = this.stateMachine.transition(next, reason);
    if (!result.accepted || !result.changed) {
      return result;
    }

    this.animationController.play(STATE_ANIMATIONS[result.to]);
    this.stateElapsedMs = 0;
    if (result.to === "SLEEPING") {
      this.sleepWakeArmed =
        this.vitals.snapshot().energy < this.balance.wakeThreshold;
    } else {
      this.sleepWakeArmed = false;
    }
    if (result.to === "WALKING") {
      void this.refreshMovementContext(true);
    }
    this.publish();
    return result;
  }

  public forceWake(): PetStateTransitionResult {
    return this.transitionTo("IDLE", "user-interrupt");
  }

  public wake(): PetStateTransitionResult {
    return this.forceWake();
  }

  public handleInteraction(event: PetInteractionEvent): void {
    if (
      this.interactionActive &&
      event.type !== "DRAG_MOVE" &&
      event.type !== "DRAG_END"
    ) {
      return;
    }

    switch (event.type) {
      case "CLICK":
        this.handleClick(event);
        return;
      case "PET":
        this.handlePet(event);
        return;
      case "POKE":
        this.handlePoke(event);
        return;
      case "WAKE":
        this.handleWake();
        return;
      case "DRAG_START":
        this.handleDragStart(event.region);
        return;
      case "DRAG_MOVE":
        return;
      case "DRAG_END":
        this.handleDragEnd(event);
        return;
      case "FEED":
        this.handleFeed(event);
        return;
      case "CHAT_START":
        this.handleChatStart();
        return;
      case "CHAT_SEND":
        void this.handleChatSend(event);
        return;
      case "CHAT_CLOSE":
        this.handleChatClose(event);
        return;
    }
  }

  public setInteractionActive(active: boolean): void {
    this.interactionActive = active;
    if (!active && this.windowVisible && !this.movementPaused) {
      void this.refreshMovementContext(true);
    }
    this.publish();
  }

  public setPresentationActive(active: boolean): void {
    this.setMovementPaused(active, active);
  }

  public setMovementPaused(paused: boolean, settleToIdle = false): void {
    this.movementPaused = paused;
    if (paused) {
      this.pendingPosition = null;
      this.windowManager.invalidateMovementPositionWrites?.();
      if (settleToIdle && this.stateMachine.state === "WALKING") {
        this.transitionTo("IDLE", "interaction");
        return;
      }
    }
    this.publish();
  }

  public setWindowVisible(visible: boolean): void {
    if (this.windowVisible === visible) {
      if (visible) {
        void this.refreshMovementContext(true);
      }
      return;
    }

    this.windowVisible = visible;
    this.movementContextRequestId += 1;
    this.pendingPosition = null;
    this.windowManager.invalidateMovementPositionWrites?.();
    if (!visible && this.stateMachine.state === "WALKING") {
      this.transitionTo("IDLE", "interaction");
      return;
    }
    if (visible) {
      void this.refreshMovementContext(true);
    }
    this.publish();
  }

  public async syncPosition(): Promise<void> {
    await this.refreshMovementContext(true);
  }

  private handleClick(event: ClickInteractionEvent): void {
    if (this.stateMachine.state === "SLEEPING") {
      this.wakeWithReaction();
      return;
    }

    const resolution = resolveClickInteraction(event, this.interactionBalance);
    if (resolution.kind === "POKE") {
      this.handlePoke({
        type: "POKE",
        timestamp: event.timestamp,
        source: event.source,
        region: resolution.region,
        payload: {
          durationMs: resolution.durationMs,
          source: "short-click",
        },
      });
      return;
    }

    if (!this.prepareTransientInteraction("POKE")) {
      return;
    }
    try {
      this.interactionFeedback.trigger("CLICK");
    } finally {
      this.finishTransientInteraction();
    }
  }

  private handlePet(event: PetInteraction): void {
    if (!this.prepareTransientInteraction("PET")) {
      return;
    }

    try {
      const at = event.timestamp;
      if (this.rewardCooldowns.canTrigger("PET_MOOD", at)) {
        this.vitals.applyDelta("mood", this.interactionBalance.pet.moodDelta);
        this.rewardCooldowns.record("PET_MOOD", at);
      }
      if (this.rewardCooldowns.canTrigger("PET_INTIMACY", at)) {
        this.vitals.applyDelta(
          "intimacy",
          this.interactionBalance.pet.intimacyDelta,
        );
        this.rewardCooldowns.record("PET_INTIMACY", at);
      }
      this.interactionFeedback.trigger("PET");
      this.effectController.trigger("PET", { startedAt: at });
      this.publish();
    } finally {
      this.finishTransientInteraction();
    }
  }

  private handlePoke(event: PokeInteractionEvent): void {
    if (this.stateMachine.state === "SLEEPING") {
      this.wakeWithReaction();
      return;
    }
    if (!this.prepareTransientInteraction("POKE")) {
      return;
    }

    try {
      const streak = this.pokeStreak.record(event.timestamp);
      const reaction = resolvePokeReaction(
        event.region,
        streak.count,
        this.interactionBalance,
      );
      this.interactionFeedback.trigger(reaction);
      this.effectController.trigger(
        reaction === "POKE_ANNOYED" ? "POKE_ANNOYED" : "POKE",
        { startedAt: event.timestamp },
      );
      if (
        reaction === "POKE_ANNOYED" &&
        this.rewardCooldowns.canTrigger("POKE_MOOD", event.timestamp)
      ) {
        this.vitals.applyDelta(
          "mood",
          this.interactionBalance.poke.moodPenalty,
        );
        this.rewardCooldowns.record("POKE_MOOD", event.timestamp);
      }
      this.publish();
    } finally {
      this.finishTransientInteraction();
    }
  }

  private handleDragStart(region: PetInteractionRegion): void {
    if (this.interactionActive) {
      return;
    }

    this.interactionActive = true;
    this.pendingPosition = null;
    this.windowManager.invalidateMovementPositionWrites?.();
    this.setInteractionSession("DRAG");
    if (this.stateMachine.state === "WALKING") {
      this.transitionTo("IDLE", "interaction");
    }
    this.effectController.trigger("DRAG");
    void this.windowManager.startDragging().catch(() => {
      this.windowManager.releasePositionOwner?.("DRAG");
      this.setError("暂时无法拖动窗口");
    });
    void region;
  }

  private handleDragEnd(_event: DragEndInteractionEvent): void {
    if (!this.interactionActive) {
      return;
    }

    this.interactionActive = false;
    this.pendingPosition = null;
    this.windowManager.releasePositionOwner?.("DRAG");
    this.setInteractionSession(null);
    if (this.stateMachine.state !== "IDLE") {
      this.transitionTo("IDLE", "interaction");
    } else {
      this.publish();
    }

    if (this.settleTimer !== undefined) {
      globalThis.clearTimeout(this.settleTimer);
    }
    this.settleTimer = globalThis.setTimeout(() => {
      this.settleTimer = undefined;
      if (!this.interactionActive && this.windowVisible) {
        void this.refreshMovementContext(true);
      }
    }, Math.max(0, this.interactionBalance.drag.settleDelayMs));
  }

  private handleFeed(event: FeedInteractionEvent): void {
    const food = getFoodDefinition(event.payload.foodId);
    if (!food || !this.prepareTransientInteraction("FEED")) {
      return;
    }

    try {
      const decision = resolveFeedInteraction(
        food,
        this.vitals.snapshot(),
        this.interactionBalance,
      );
      if (decision.isFull) {
        this.interactionFeedback.trigger("FULL");
        this.effectController.trigger("FULL", { startedAt: event.timestamp });
        this.publish();
        return;
      }

      this.vitals.applyDelta("hunger", decision.hungerDelta);
      this.vitals.applyDelta("mood", decision.moodDelta);
      if (
        decision.intimacyEligible &&
        this.rewardCooldowns.canTrigger("FEED_INTIMACY", event.timestamp)
      ) {
        this.vitals.applyDelta("intimacy", this.interactionBalance.pet.intimacyDelta);
        this.rewardCooldowns.record("FEED_INTIMACY", event.timestamp);
      }
      this.interactionFeedback.trigger(food.reactionKey);
      this.effectController.trigger("FEED", {
        startedAt: event.timestamp,
        asset: food.asset,
        foodId: food.id,
      });
      this.publish();
    } finally {
      this.finishTransientInteraction();
    }
  }

  private handleChatStart(): void {
    if (!this.prepareTransientInteraction("CHAT")) {
      return;
    }

    try {
      this.chatService.open();
      this.interactionFeedback.trigger("CHAT");
      this.publish();
    } finally {
      this.finishTransientInteraction();
    }
  }

  private async handleChatSend(event: ChatSendInteractionEvent): Promise<void> {
    if (this.interactionActive || !this.chatService.snapshot.isOpen) {
      return;
    }

    const response = await this.chatService.send(event.payload.message);
    if (response) {
      this.interactionFeedback.triggerMessage(response, "CHAT");
    }
  }

  private handleChatClose(_event: ChatCloseInteractionEvent): void {
    if (this.interactionActive) {
      return;
    }
    this.chatService.close();
  }

  private handleWake(): void {
    this.wakeWithReaction();
  }

  private wakeWithReaction(): void {
    if (this.forceWake().accepted) {
      this.interactionFeedback.trigger("WAKE");
    }
  }

  private prepareTransientInteraction(
    kind: "PET" | "POKE" | "FEED" | "CHAT",
  ): boolean {
    if (this.interactionActive) {
      return false;
    }

    if (this.stateMachine.state === "SLEEPING") {
      this.wakeWithReaction();
    }
    if (this.stateMachine.state === "WALKING") {
      this.transitionTo("IDLE", "interaction");
    }
    this.setInteractionSession(kind);
    return true;
  }

  private finishTransientInteraction(): void {
    if (!this.interactionActive) {
      this.setInteractionSession(null);
    }
  }

  private setInteractionSession(
    activeInteraction: InteractionSessionSnapshot["activeInteraction"],
  ): void {
    this.currentInteraction = {
      activeInteraction,
      startedAt: activeInteraction ? this.now() : null,
    };
    this.publish();
  }

  private readonly frame = (timestamp: number): void => {
    if (!this.running) {
      return;
    }

    const deltaMs = this.lastFrameTimestamp === undefined
      ? 0
      : Math.min(Math.max(timestamp - this.lastFrameTimestamp, 0), 250);
    this.lastFrameTimestamp = timestamp;
    this.stateElapsedMs += deltaMs;

    this.animationController.advance(deltaMs);
    const clockSnapshot = this.clock.sample();
    this.vitalsElapsedMs += clockSnapshot.elapsedMs;
    if (this.vitalsElapsedMs >= this.balance.vitalsTickMs) {
      const elapsedMs = this.vitalsElapsedMs;
      this.vitalsElapsedMs = 0;
      this.vitals.advance(elapsedMs, this.stateMachine.state as PetActivity);
      this.applyVitalsState();
    }

    this.applyTestTransitions();
    if (this.stateMachine.state === "WALKING") {
      this.advanceMovement(deltaMs);
    }

    this.publish();
    this.frameHandle = requestAnimationFrame(this.frame);
  };

  private applyVitalsState(): void {
    if (this.interactionActive) {
      return;
    }

    const energy = this.vitals.snapshot().energy;
    if (this.stateMachine.state === "SLEEPING") {
      if (this.sleepWakeArmed && energy >= this.balance.wakeThreshold) {
        this.transitionTo("IDLE", "vitals");
      }
      return;
    }

    if (
      energy <= this.balance.sleepThreshold &&
      (this.stateMachine.state === "IDLE" ||
        this.stateMachine.state === "WALKING")
    ) {
      this.transitionTo("SLEEPING", "vitals");
    }
  }

  private applyTestTransitions(): void {
    if (this.interactionActive) {
      return;
    }

    if (
      this.stateMachine.state === "WALKING" &&
      this.stateElapsedMs >= WALKING_TEST_DURATION_MS
    ) {
      this.transitionTo("IDLE", "timer");
    }
  }

  private async restorePersistedState(): Promise<void> {
    const now = this.now();
    this.clock.reset(now);
    if (!this.persistenceService) {
      return;
    }

    const saved = await this.persistenceService.load();
    if (!saved) {
      return;
    }

    const elapsedMs = Math.max(0, now - saved.lastRuntimeTimestamp);
    const restoredStats = calculateOfflineProgress(
      saved.stats,
      elapsedMs,
      { activity: saved.lastActivity },
      this.balance,
    );
    this.vitals.setSnapshot(restoredStats);
    this.stateElapsedMs = 0;
    this.vitalsElapsedMs = 0;
    this.lastCompactPosition = saved.position
      ? { ...saved.position }
      : null;

    if (saved.position) {
      const context = await this.windowManager.getMovementContext();
      if (context) {
        const position = clampRestoredPosition(saved.position, context);
        await this.windowManager.setPosition(position, "LAYOUT");
        this.position = position;
        this.lastCompactPosition = { ...position };
        this.startupRestoredPosition = { ...position };
        this.movementContext = { ...context, position: { ...position } };
        this.movementController.reset(position);
      }
    }
    this.lastPersistenceKey = null;
    this.publish();
  }

  private advanceMovement(deltaMs: number): void {
    if (!this.movementContext || !this.canAutonomousMove()) {
      return;
    }

    const next = this.movementController.advance(deltaMs, this.movementContext.bounds);
    this.position = next.position;
    this.pendingPosition = { ...next.position };
    this.requestedPosition = { ...next.position };
    this.flushPositionWrite();
  }

  private flushPositionWrite(): void {
    if (
      this.positionWriteInFlight ||
      !this.pendingPosition ||
      !this.canAutonomousMove()
    ) {
      return;
    }

    const nextPosition = this.pendingPosition;
    this.pendingPosition = null;
    this.positionWriteInFlight = true;
    void this.windowManager
      .setPosition(nextPosition, "WALKING")
      .then(() => {
        if (!this.canAutonomousMove()) {
          return;
        }
        const previousPosition = this.movementContext?.position ?? this.position;
        if (previousPosition) {
          this.lastPositionDelta = {
            x: nextPosition.x - previousPosition.x,
            y: nextPosition.y - previousPosition.y,
          };
        }
        this.position = { ...nextPosition };
        if (this.movementContext) {
          this.movementContext = {
            ...this.movementContext,
            position: { ...nextPosition },
          };
        }
        this.setError(null);
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          const detail = error instanceof Error ? error.message : String(error);
          this.setError("暂时无法移动桌面女儿: " + detail);
          return;
        }
        this.setError("暂时无法移动桌面女儿");
      })
      .finally(() => {
        this.positionWriteInFlight = false;
        if (this.pendingPosition && this.running && this.canAutonomousMove()) {
          this.flushPositionWrite();
        }
      });
  }

  private async refreshMovementContext(resetMovement: boolean): Promise<void> {
    if (!this.windowVisible) {
      return;
    }
    const requestId = ++this.movementContextRequestId;
    try {
      const context = await this.windowManager.getMovementContext();
      if (requestId !== this.movementContextRequestId || !context) {
        return;
      }

      const position = this.startupRestoredPosition ?? context.position;
      this.movementContext = { ...context, position: { ...position } };
      this.position = { ...position };
      this.startupRestoredPosition = null;
      if (resetMovement || !this.movementController.snapshot()) {
        this.movementController.reset(context.position);
      }
      this.setError(null);
    } catch {
      this.setError("暂时无法读取桌面位置");
    }
  }

  private canAutonomousMove(): boolean {
    return this.running &&
      this.windowVisible &&
      !this.movementPaused &&
      !this.interactionActive &&
      this.stateMachine.state === "WALKING";
  }

  private rewardDurations(
    config: Readonly<InteractionBalanceConfig>,
  ): InteractionRewardDurations {
    return {
      PET_MOOD: config.pet.moodRewardCooldownMs,
      PET_INTIMACY: config.pet.intimacyRewardCooldownMs,
      FEED_INTIMACY: config.feed.intimacyRewardCooldownMs,
      POKE_MOOD: config.poke.statEffectCooldownMs,
    };
  }

  private animationCatalog(
    character: CharacterDefinition,
  ): Readonly<Record<string, ReturnType<typeof getCharacterAnimation>>> {
    return {
      idle: getCharacterAnimation(character, "idle"),
      walk: getCharacterAnimation(character, "walk"),
      sleep: getCharacterAnimation(character, "sleep"),
    };
  }

  private buildPersistedState(): PersistedPetState {
    const position = this.compactPositionPersistenceEnabled
      ? this.position ?? this.lastCompactPosition
      : this.lastCompactPosition;
    return {
      stats: this.vitals.snapshot(),
      lastRuntimeTimestamp: this.now(),
      lastActivity: this.stateMachine.state as PetActivity,
      position: position ? { ...position } : null,
    };
  }

  private schedulePersistenceIfChanged(): void {
    if (!this.persistenceService || !this.persistenceReady) {
      return;
    }

    const persisted = this.buildPersistedState();
    const key = JSON.stringify({
      stats: persisted.stats,
      lastActivity: persisted.lastActivity,
      position: persisted.position,
    });
    if (key === this.lastPersistenceKey) {
      return;
    }

    this.lastPersistenceKey = key;
    if (this.compactPositionPersistenceEnabled && this.position) {
      this.lastCompactPosition = { ...this.position };
    }
    this.persistenceService.scheduleSave(persisted);
  }

  private buildSnapshot(): PetRuntimeSnapshot {
    return {
      state: this.stateMachine.state,
      animation: this.animationController.snapshot(),
      stats: this.vitals.snapshot(),
      clock: this.clock.snapshot,
      position: this.position ? { ...this.position } : null,
      effect: this.effectController.snapshot,
      interaction: this.currentInteraction,
      error: null,
    };
  }

  private publish(): void {
    this.currentSnapshot = {
      state: this.stateMachine.state,
      animation: this.animationController.snapshot(),
      stats: this.vitals.snapshot(),
      clock: { ...this.clock.snapshot },
      position: this.position ? { ...this.position } : null,
      effect: this.effectController.snapshot,
      interaction: this.currentInteraction,
      error: this.currentSnapshot.error,
    };
    this.schedulePersistenceIfChanged();
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }

  private setError(error: string | null): void {
    if (this.currentSnapshot.error === error) {
      return;
    }

    this.currentSnapshot = { ...this.currentSnapshot, error };
    for (const listener of this.listeners) {
      listener(this.currentSnapshot);
    }
  }
}

function clampRestoredPosition(
  position: DesktopPosition,
  context: MovementContext,
): DesktopPosition {
  const workArea = context.workArea;
  const windowSize = context.windowSize;
  const minX = workArea?.position.x ?? context.bounds.minX;
  const minY = workArea?.position.y ?? 0;
  const maxX = workArea && windowSize
    ? workArea.position.x + Math.max(0, workArea.size.width - windowSize.width)
    : context.bounds.maxX;
  const maxY = workArea && windowSize
    ? workArea.position.y + Math.max(0, workArea.size.height - windowSize.height - 8)
    : context.bounds.bottomY;

  return {
    x: Math.round(Math.min(Math.max(position.x, minX), maxX)),
    y: Math.round(Math.min(Math.max(position.y, minY), maxY)),
  };
}
