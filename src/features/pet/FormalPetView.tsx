import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { getCharacterAnimation, DEFAULT_CHARACTER_ID } from "./characterAssets";
import type { PetRuntimeSnapshot } from "./PetRuntime";
import { usePetRuntime } from "./usePetRuntime";
import { InteractionController } from "./interactionController";
import { registerDevPetShortcuts } from "./dev/devPetShortcuts";
import { DevPetOverlay } from "./dev/DevPetOverlay";
import { CursorPassthroughController } from "../../platform/desktop/cursorPassthrough";
import { InteractiveGeometryRegistry } from "../../platform/desktop/interactiveGeometryRegistry";
import { WindowLayoutCoordinator } from "../../platform/desktop/windowLayoutCoordinator";
import {
  deriveCharacterDisplayMetrics,
  derivePetWindowLayoutSpecs,
  getPlaceholderMotion,
  type PetWindowMode,
} from "../../core/pet/characterDisplay";
import { DEFAULT_INTERACTION_BALANCE } from "../../core/pet/interactionBalance";
import { DEFAULT_FOOD_DEFINITIONS } from "../../core/pet/foodDefinitions";
import { desktopWindowManager } from "../../platform/desktop/windowManager";
import { desktopWindowCommand } from "../../platform/desktop/windowCommands";
import {
  createPetInteractionEvent,
  type PetInteractionEvent,
} from "./petInteractionEvent";
import { PanelCoordinator, type ActivePanel } from "../../ui/pet/panelCoordinator";
import { DEFAULT_ACTION_MENU_BALANCE } from "../../ui/pet/actionMenuBalance";
import { ActionAffordanceController } from "../../ui/pet/actionAffordanceController";
import { PetActionMenu, type PetAction } from "../../ui/pet/PetActionMenu";
import { PetStatusPanel } from "../../ui/pet/PetStatusPanel";
import { SpeechBubble } from "../../ui/pet/SpeechBubble";
import { SettingsPanel } from "../../ui/pet/SettingsPanel";
import { FeedPanel } from "../../ui/feeding/FeedPanel";
import { ChatPanel } from "../../ui/chat/ChatPanel";
import { getAppVersion } from "../../platform/update/appVersion";
import { createDefaultUpdateAdapter } from "../../platform/update/tauriUpdateAdapter";
import { UpdateService } from "../../platform/update/updateService";
import type { AiConfigurationSnapshot } from "../../platform/ai/aiTypes";
import type {
  ResumeAfterUpdatePreparation,
  UpdateSnapshot,
} from "../../platform/update/updateTypes";
import "./FormalPetView.css";

interface FormalPetViewProps {
  characterId?: string;
}

function stateClass(snapshot: PetRuntimeSnapshot): string {
  return "pet-state-" + snapshot.state.toLowerCase();
}

export function FormalPetView({
  characterId = DEFAULT_CHARACTER_ID,
}: FormalPetViewProps) {
  const {
    runtime,
    ready,
    snapshot,
    character,
    speechBubble,
    chatService,
    aiConfiguration,
  } = usePetRuntime(characterId);
  const [bubbleSnapshot, setBubbleSnapshot] = useState(speechBubble.snapshot);
  const [chatSnapshot, setChatSnapshot] = useState(chatService.snapshot);
  const [aiConfigurationSnapshot, setAiConfigurationSnapshot] = useState<
    AiConfigurationSnapshot
  >(aiConfiguration.snapshot);
  const [devOverlayVisible, setDevOverlayVisible] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [windowMode, setWindowMode] = useState<PetWindowMode>("pet-only");
  const [windowVisible, setWindowVisible] = useState(true);
  const [layoutTransitioning, setLayoutTransitioning] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionMenuOverflowOpen, setActionMenuOverflowOpen] = useState(false);
  const [actionAffordanceVisible, setActionAffordanceVisible] = useState(false);
  const [actionMenuActivity, setActionMenuActivity] = useState(0);
  const [panelSnapshot, setPanelSnapshot] = useState(
    () => ({ activePanel: null } as { activePanel: ActivePanel }),
  );

  const characterRef = useRef<HTMLButtonElement>(null);
  const affordanceRef = useRef<HTMLButtonElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const displayMetrics = useMemo(() => deriveCharacterDisplayMetrics(), []);
  const layoutSpecs = useMemo(() => derivePetWindowLayoutSpecs(), []);
  const layoutCoordinator = useMemo(
    () =>
      new WindowLayoutCoordinator({
        windowManager: desktopWindowManager,
        specs: layoutSpecs,
      }),
    [layoutSpecs],
  );
  const panelCoordinator = useMemo(() => new PanelCoordinator(), []);
  const affordanceController = useMemo(
    () => new ActionAffordanceController(),
    [],
  );
  const geometryRegistry = useMemo(
    () => new InteractiveGeometryRegistry(),
    [],
  );
  const prepareForUpdateRef = useRef<
    (() => Promise<ResumeAfterUpdatePreparation | void>) | null
  >(null);
  const updateService = useMemo(
    () =>
      new UpdateService({
        adapter: createDefaultUpdateAdapter(),
        getCurrentVersion: getAppVersion,
        prepareForInstall: () =>
          prepareForUpdateRef.current?.() ?? Promise.resolve(),
        onError: (error) => {
          if (import.meta.env.DEV) {
            console.error("Updater error", error);
          }
        },
      }),
    [],
  );
  const [updateSnapshot, setUpdateSnapshot] = useState<UpdateSnapshot>(
    updateService.snapshot,
  );

  const closeActionMenu = useCallback(() => {
    affordanceController.setActionMenuOpen(false);
    setActionMenuOpen(false);
    setActionMenuOverflowOpen(false);
  }, [affordanceController]);

  const revealActionAffordance = useCallback(() => {
    affordanceController.pointerEnterCharacter();
  }, [affordanceController]);

  const revealActionArea = useCallback(() => {
    affordanceController.pointerEnterActionArea();
  }, [affordanceController]);

  const scheduleActionAreaHide = useCallback(() => {
    affordanceController.pointerLeaveActionArea();
  }, [affordanceController]);

  const revealActionAffordanceButton = useCallback(() => {
    affordanceController.pointerEnterAffordance();
  }, [affordanceController]);

  const scheduleActionAffordanceHide = useCallback(() => {
    affordanceController.pointerLeaveCharacter();
  }, [affordanceController]);

  const scheduleActionAffordanceButtonHide = useCallback(() => {
    affordanceController.pointerLeaveAffordance();
  }, [affordanceController]);

  const touchActionMenu = useCallback(() => {
    setActionMenuActivity((value) => value + 1);
  }, []);

  const getCharacterRegion = useCallback(
    () => geometryRegistry.getRegion("character"),
    [geometryRegistry],
  );

  const getInteractiveRegions = useCallback(
    () => geometryRegistry.getRegions(),
    [geometryRegistry],
  );

  const cursorPassthrough = useMemo(
    () =>
      new CursorPassthroughController(
        desktopWindowManager,
        getInteractiveRegions,
      ),
    [getInteractiveRegions],
  );

  const observeInteraction = useCallback(
    (event: PetInteractionEvent) => {
      if (
        event.type === "CLICK" ||
        event.type === "POKE" ||
        event.type === "PET" ||
        event.type === "DRAG_START"
      ) {
        closeActionMenu();
        affordanceController.interactionStarted();
      }
    },
    [affordanceController, closeActionMenu],
  );

  const dispatchInteraction = useCallback(
    (event: PetInteractionEvent) => {
      runtime.handleInteraction(event);
      observeInteraction(event);
    },
    [observeInteraction, runtime],
  );

  const transitionWindow = useCallback(
    (mode: PetWindowMode, rethrow = false): Promise<void> => {
      runtime.setCompactPositionPersistenceEnabled(false);
      return layoutCoordinator
        .transitionTo(mode, {
          requestMode: setWindowMode,
          setTransitioning: (transitioning) => {
            setLayoutTransitioning(transitioning);
            runtime.setMovementPaused(transitioning);
          },
          measureCharacterRect: () =>
            characterRef.current?.getBoundingClientRect() ?? null,
        })
        .then(() => runtime.syncPosition())
        .then(() => {
          runtime.setCompactPositionPersistenceEnabled(mode === "pet-only");
        })
        .catch((error: unknown) => {
          setWindowError("暂时无法调整桌面窗口布局");
          setLayoutTransitioning(false);
          runtime.setMovementPaused(false);
          if (rethrow) {
            throw error;
          }
        });
    },
    [layoutCoordinator, runtime],
  );

  const prepareForUpdate = useCallback(async () => {
    if (runtime.snapshot.interaction.activeInteraction === "DRAG") {
      throw new Error("正在拖动桌面女儿，请稍后再更新");
    }

    closeActionMenu();
    panelCoordinator.close();
    runtime.setPresentationActive(false);
    runtime.setMovementPaused(true, true);
    layoutCoordinator.invalidatePendingTransition();
    setLayoutTransitioning(false);

    try {
      await transitionWindow("pet-only", true);
      runtime.setCompactPositionPersistenceEnabled(true);
      runtime.setMovementPaused(true, true);
      await runtime.flushPersistenceForUpdate();
      return () => runtime.setMovementPaused(false);
    } catch (error) {
      runtime.setMovementPaused(false);
      throw error;
    }
  }, [
    closeActionMenu,
    layoutCoordinator,
    panelCoordinator,
    runtime,
    transitionWindow,
  ]);
  prepareForUpdateRef.current = prepareForUpdate;

  const openPanel = useCallback(
    (panel: Exclude<ActivePanel, null>) => {
      closeActionMenu();
      runtime.setPresentationActive(true);
      panelCoordinator.open(panel);
    },
    [closeActionMenu, panelCoordinator, runtime],
  );

  const closeChat = useCallback(() => {
    dispatchInteraction(
      createPetInteractionEvent({
        type: "CHAT_CLOSE",
        source: "pointer",
        payload: { kind: "empty" },
      }),
    );
    panelCoordinator.close();
  }, [dispatchInteraction, panelCoordinator]);

  const openSettingsFromChat = useCallback(() => {
    closeChat();
    openPanel("settings");
  }, [closeChat, openPanel]);

  const saveAiKey = useCallback(
    (apiKey: string) => aiConfiguration.saveApiKey(apiKey),
    [aiConfiguration],
  );
  const deleteAiKey = useCallback(
    () => aiConfiguration.deleteApiKey(),
    [aiConfiguration],
  );
  const testAiConnection = useCallback(
    () => aiConfiguration.testConnection(),
    [aiConfiguration],
  );

  const hidePet = useCallback(async () => {
    if (import.meta.env.DEV) {
      console.debug("UI hide requested");
    }
    closeActionMenu();
    panelCoordinator.close();
    layoutCoordinator.invalidatePendingTransition();
    setLayoutTransitioning(false);
    runtime.setWindowVisible(false);
    runtime.setMovementPaused(false);
    setWindowVisible(false);
    try {
      await desktopWindowCommand.hide();
    } catch {
      runtime.setWindowVisible(true);
      setWindowVisible(true);
      setWindowError("暂时无法隐藏窗口");
    }
  }, [closeActionMenu, layoutCoordinator, panelCoordinator, runtime]);

  const handleAction = useCallback(
    (action: PetAction) => {
      closeActionMenu();
      switch (action) {
        case "feed":
          openPanel("feed");
          return;
        case "chat":
          runtime.setPresentationActive(true);
          dispatchInteraction(
            createPetInteractionEvent({
              type: "CHAT_START",
              source: "pointer",
              payload: { kind: "empty" },
            }),
          );
          panelCoordinator.open("chat");
          return;
        case "status":
          openPanel("status");
          return;
        case "settings":
          openPanel("settings");
          return;
        case "hide":
          void hidePet();
          return;
      }
    },
    [
      closeActionMenu,
      dispatchInteraction,
      openPanel,
      panelCoordinator,
      hidePet,
      runtime,
    ],
  );

  const handlePanelClose = useCallback(() => {
    if (panelSnapshot.activePanel === "chat") {
      closeChat();
      return;
    }
    panelCoordinator.close();
  }, [closeChat, panelCoordinator, panelSnapshot.activePanel]);

  const handleFeedSelect = useCallback(
    (foodId: string) => {
      dispatchInteraction(
        createPetInteractionEvent({
          type: "FEED",
          source: "pointer",
          payload: { foodId },
        }),
      );
      panelCoordinator.close();
    },
    [dispatchInteraction, panelCoordinator],
  );

  const interactionController = useMemo(
    () =>
      new InteractionController({
        getCharacterRegion,
        onEvent: dispatchInteraction,
        petHoldThresholdMs: DEFAULT_INTERACTION_BALANCE.pet.holdThresholdMs,
        petRepeatIntervalMs: DEFAULT_INTERACTION_BALANCE.pet.repeatIntervalMs,
      }),
    [dispatchInteraction, getCharacterRegion],
  );

  useEffect(() => {
    const unsubscribe = affordanceController.subscribe((next) => {
      setActionAffordanceVisible(next.visibility !== "hidden");
    });
    return () => {
      unsubscribe();
      affordanceController.dispose();
    };
  }, [affordanceController]);

  useEffect(() => {
    const unsubscribe = panelCoordinator.subscribe((next) => {
      setPanelSnapshot(next);
    });
    return () => {
      unsubscribe();
      panelCoordinator.dispose();
    };
  }, [panelCoordinator]);

  useEffect(() => {
    runtime.setPresentationActive(
      actionMenuOpen || panelSnapshot.activePanel !== null,
    );
  }, [actionMenuOpen, panelSnapshot.activePanel, runtime]);

  useEffect(() => {
    if (!ready || !windowVisible) {
      return;
    }
    const nextMode: PetWindowMode = panelSnapshot.activePanel === "chat"
      ? "chat"
      : panelSnapshot.activePanel
        ? "compact-panel"
        : actionMenuOpen
          ? "action-menu"
          : "pet-only";
    void transitionWindow(nextMode);
  }, [
    actionMenuOpen,
    panelSnapshot.activePanel,
    ready,
    transitionWindow,
    windowVisible,
  ]);

  useEffect(() => {
    const unregister = [
      geometryRegistry.register("character", characterRef.current),
      geometryRegistry.register(
        "affordance",
        actionAffordanceVisible || actionMenuOpen ? affordanceRef.current : null,
      ),
      geometryRegistry.register(
        "action-menu",
        actionMenuOpen ? actionMenuRef.current : null,
      ),
      geometryRegistry.register(
        "panel",
        panelSnapshot.activePanel ? panelRef.current : null,
      ),
    ];
    geometryRegistry.refresh();
    return () => unregister.forEach((remove) => remove());
  }, [
    actionAffordanceVisible,
    actionMenuOpen,
    actionMenuOverflowOpen,
    chatSnapshot.error,
    chatSnapshot.messages.length,
    chatSnapshot.pending,
    geometryRegistry,
    panelSnapshot.activePanel,
    windowMode,
  ]);

  useEffect(() => {
    const unsubscribe = geometryRegistry.subscribe(() => {
      cursorPassthrough.refresh();
    });
    return unsubscribe;
  }, [cursorPassthrough, geometryRegistry]);

  useEffect(() => {
    if (!desktopWindowManager.onLayoutChanged) {
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void desktopWindowManager
      .onLayoutChanged(() => {
        if (!cancelled) {
          geometryRegistry.refresh();
        }
      })
      .then((removeListener) => {
        if (cancelled) {
          removeListener();
        } else {
          unlisten = removeListener;
        }
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [geometryRegistry]);

  useEffect(() => {
    void cursorPassthrough.start().catch(() => {
      setWindowError("透明区域穿透暂不可用");
    });
    return () => {
      void cursorPassthrough.stop();
    };
  }, [cursorPassthrough]);

  useEffect(() => {
    const unsubscribe = speechBubble.subscribe(setBubbleSnapshot);
    return unsubscribe;
  }, [speechBubble]);

  useEffect(() => {
    const unsubscribe = chatService.subscribe(setChatSnapshot);
    return unsubscribe;
  }, [chatService]);

  useEffect(() => {
    const unsubscribe = aiConfiguration.subscribe(setAiConfigurationSnapshot);
    return unsubscribe;
  }, [aiConfiguration]);

  useEffect(() => {
    const unsubscribe = updateService.subscribe(setUpdateSnapshot);
    void updateService.initialize();
    return () => {
      unsubscribe();
      updateService.dispose();
    };
  }, [updateService]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const timer = globalThis.setTimeout(() => {
      void updateService.checkForUpdate();
    }, 3_500);
    return () => globalThis.clearTimeout(timer);
  }, [ready, updateService]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    void layoutCoordinator
      .initialize()
      .then(() => desktopWindowManager.show())
      .then(() => runtime.syncPosition())
      .catch(() => setWindowError("暂时无法调整桌面窗口尺寸"));
  }, [layoutCoordinator, ready, runtime]);

  useEffect(() => {
    if (!desktopWindowManager.onVisibilityChanged) {
      return;
    }
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void desktopWindowManager
      .onVisibilityChanged((visible) => {
        if (cancelled) {
          return;
        }
        setWindowVisible(visible);
        if (!visible) {
          layoutCoordinator.invalidatePendingTransition();
          setLayoutTransitioning(false);
          closeActionMenu();
          panelCoordinator.close();
          runtime.setWindowVisible(false);
          runtime.setMovementPaused(false);
          return;
        }

        closeActionMenu();
        panelCoordinator.close();
        runtime.setWindowVisible(true);
      })
      .then((removeListener) => {
        if (cancelled) {
          removeListener();
        } else {
          unlisten = removeListener;
        }
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [closeActionMenu, layoutCoordinator, panelCoordinator, runtime]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void desktopWindowManager
      .onCloseRequested(async () => {
        await hidePet();
      })
      .then((removeListener) => {
        if (cancelled) {
          removeListener();
        } else {
          unlisten = removeListener;
        }
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [hidePet]);

  useEffect(() => {
    const handleBlur = () => {
      closeActionMenu();
      affordanceController.blur();
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, [affordanceController, closeActionMenu]);

  useEffect(() => {
    if (!actionMenuOpen) {
      return;
    }
    const timer = globalThis.setTimeout(
      closeActionMenu,
      DEFAULT_ACTION_MENU_BALANCE.autoCloseMs,
    );
    return () => globalThis.clearTimeout(timer);
  }, [actionMenuActivity, actionMenuOpen, closeActionMenu]);

  useEffect(
    () => () => {
      interactionController.cancel();
      layoutCoordinator.invalidatePendingTransition();
      geometryRegistry.dispose();
    },
    [geometryRegistry, interactionController, layoutCoordinator],
  );

  useEffect(
    () =>
      registerDevPetShortcuts({
        transitionTo: (next, reason) => runtime.transitionTo(next, reason),
        toggleOverlay: () => setDevOverlayVisible((visible) => !visible),
      }),
    [runtime],
  );

  const pointerSample = (event: ReactPointerEvent<HTMLButtonElement>) => ({
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    button: event.button,
  });

  const releasePointerCapture = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cursorPassthrough.setDragActive(false);
  };

  const handleCharacterPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (!ready || !windowVisible || layoutTransitioning || panelSnapshot.activePanel !== null) {
      return;
    }
    if (!interactionController.pointerDown(pointerSample(event))) {
      return;
    }
    cursorPassthrough.setDragActive(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCharacterPointerMove = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    interactionController.pointerMove(pointerSample(event));
  };

  const handleCharacterPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    interactionController.pointerUp(pointerSample(event));
    releasePointerCapture(event);
  };

  const handleCharacterPointerCancel = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    interactionController.pointerCancel(pointerSample(event));
    releasePointerCapture(event);
  };

  const animationName =
    snapshot.animation.animationName === "walk" ||
    snapshot.animation.animationName === "sleep"
      ? snapshot.animation.animationName
      : "idle";
  const animation = getCharacterAnimation(character, animationName);
  const placeholderMotion = getPlaceholderMotion(animation);
  const frameSource =
    animation.frames[snapshot.animation.currentFrame % animation.frames.length] ??
    animation.frames[0] ??
    "";
  const combinedError = snapshot.error ?? windowError;
  const effect = snapshot.effect;
  const effectClass = effect ? " pet-effect-" + effect.kind.toLowerCase() : "";
  const layoutSpec = layoutSpecs[windowMode];
  const displayStyle = {
    width: layoutSpec.windowSize.width + "px",
    height: layoutSpec.windowSize.height + "px",
    "--pet-character-width": displayMetrics.characterSize.width + "px",
    "--pet-character-height": displayMetrics.characterSize.height + "px",
    "--pet-character-half-width": displayMetrics.characterSize.width / 2 + "px",
    "--pet-foot-center-x": layoutSpec.petLane.footCenterLocal.x + "px",
    "--pet-foot-center-y": layoutSpec.petLane.footCenterLocal.y + "px",
    "--pet-content-left": layoutSpec.contentLane.x + "px",
    "--pet-content-top": layoutSpec.contentLane.y + "px",
    "--pet-content-width": layoutSpec.contentLane.width + "px",
    "--pet-content-height": layoutSpec.contentLane.height + "px",
    "--pet-action-left": layoutSpec.actionMenuLane.x + "px",
    "--pet-action-top": layoutSpec.actionMenuLane.y + "px",
    "--pet-action-width": layoutSpec.actionMenuLane.width + "px",
    "--pet-action-hit-target-size":
      DEFAULT_ACTION_MENU_BALANCE.affordanceHitTargetSize + "px",
    "--pet-bubble-max-width": layoutSpec.bubbleSafeRegion.width + "px",
  } as CSSProperties;
  const activePanel = panelSnapshot.activePanel;

  return (
    <main
      className={
        "pet-root" +
        (!ready ? " is-runtime-hydrating" : "") +
        (layoutTransitioning ? " is-layout-transitioning" : "") +
        " pet-window-mode-" + windowMode +
        (windowMode === "chat" ? " is-chat-mode" : "")
      }
      aria-label={character.id}
      style={displayStyle}
    >
      <section className="pet-stage">
        <SpeechBubble snapshot={bubbleSnapshot} />

        <div className="pet-effect-layer" aria-hidden="true">
          {snapshot.state === "SLEEPING" ? <span className="pet-zzz">Zzz</span> : null}
          {effect?.kind === "PET" ? (
            <span key={effect.id} className="pet-interaction-effect pet-effect-heart">
              ♥
            </span>
          ) : null}
          {effect?.kind === "POKE" || effect?.kind === "POKE_ANNOYED" ? (
            <span key={effect.id} className="pet-interaction-effect pet-effect-poke">
              {effect.kind === "POKE_ANNOYED" ? "!" : "·"}
            </span>
          ) : null}
          {effect?.kind === "FULL" ? (
            <span key={effect.id} className="pet-interaction-effect pet-effect-full">
              吃饱啦
            </span>
          ) : null}
          {effect?.kind === "FEED" ? (
            <span
              key={effect.id}
              className="pet-interaction-effect pet-effect-food"
            >
              {effect.asset ?? "·"}
            </span>
          ) : null}
        </div>

        <button
          ref={characterRef}
          className={
            "pet-character " +
            stateClass(snapshot) +
            (placeholderMotion ? " pet-motion-" + placeholderMotion : "") +
            effectClass +
            (bubbleSnapshot.state === "showing" ? " is-reacting" : "")
          }
          type="button"
          aria-label="和女儿互动并拖动她"
          onPointerEnter={revealActionAffordance}
          onPointerLeave={scheduleActionAffordanceHide}
          onFocus={revealActionAffordance}
          onPointerDown={handleCharacterPointerDown}
          onPointerMove={handleCharacterPointerMove}
          onPointerUp={handleCharacterPointerUp}
          onPointerCancel={handleCharacterPointerCancel}
        >
          {frameSource ? (
            <img src={frameSource} alt="桌面女儿角色" draggable={false} />
          ) : (
            <span className="pet-missing-asset">缺少角色素材</span>
          )}
        </button>

        <PetActionMenu
          affordanceVisible={actionAffordanceVisible}
          menuOpen={actionMenuOpen}
          overflowOpen={actionMenuOverflowOpen}
          affordanceRef={affordanceRef}
          menuRef={actionMenuRef}
          onAffordanceClick={() => {
            if (actionMenuOpen) {
              closeActionMenu();
            } else {
              affordanceController.setActionMenuOpen(true);
              runtime.setPresentationActive(true);
              setActionMenuOpen(true);
              setActionMenuActivity((value) => value + 1);
            }
          }}
          onAction={handleAction}
          onOverflowToggle={() => setActionMenuOverflowOpen((value) => !value)}
          onActivity={touchActionMenu}
          onPointerEnter={revealActionArea}
          onPointerLeave={scheduleActionAreaHide}
          onAffordancePointerEnter={revealActionAffordanceButton}
          onAffordancePointerLeave={scheduleActionAffordanceButtonHide}
          onFocus={revealActionAffordanceButton}
        />

        {activePanel === "feed" ? (
          <FeedPanel
            foods={DEFAULT_FOOD_DEFINITIONS}
            panelRef={panelRef}
            onSelect={handleFeedSelect}
            onClose={handlePanelClose}
          />
        ) : null}
        {activePanel === "status" ? (
          <PetStatusPanel
            stats={snapshot.stats}
            panelRef={panelRef}
            onClose={handlePanelClose}
          />
        ) : null}
        {activePanel === "settings" ? (
          <SettingsPanel
            panelRef={panelRef}
            onClose={handlePanelClose}
            updateSnapshot={updateSnapshot}
            onCheckUpdate={() => void updateService.checkForUpdate()}
            onInstallUpdate={() => void updateService.installAvailable()}
            aiSnapshot={aiConfigurationSnapshot}
            onSaveAiKey={saveAiKey}
            onDeleteAiKey={deleteAiKey}
            onTestAiConnection={testAiConnection}
          />
        ) : null}
        {activePanel === "chat" ? (
          <ChatPanel
            snapshot={chatSnapshot}
            panelRef={panelRef}
            onEvent={dispatchInteraction}
            onClose={closeChat}
            onOpenSettings={openSettingsFromChat}
          />
        ) : null}

        {combinedError ? (
          <p className="pet-error" role="alert">{combinedError}</p>
        ) : null}
        <DevPetOverlay
          snapshot={snapshot}
          visible={devOverlayVisible}
          movement={runtime.movementDebugSnapshot}
          layoutMode={windowMode}
          windowVisible={windowVisible}
          interactiveRegionCount={geometryRegistry.getRegions().length}
        />
      </section>
    </main>
  );
}
