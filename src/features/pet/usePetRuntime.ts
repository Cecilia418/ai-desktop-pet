import { useEffect, useMemo, useRef, useState } from "react";
import { getCharacterDefinition } from "./characterAssets";
import { PetRuntime } from "./PetRuntime";
import { RuntimeLifecycleCoordinator } from "./runtimeLifecycleCoordinator";
import { desktopWindowManager } from "../../platform/desktop/windowManager";
import { PetPersistenceService } from "../../platform/persistence/petPersistenceService";
import { TauriPetPersistenceRepository } from "../../platform/persistence/petPersistenceRepository";
import { AIConfigurationService } from "../../platform/ai/aiConfigurationService";
import { registerApplicationShutdown } from "../../platform/app/applicationLifecycle";
import {
  createDefaultAiAdapter,
} from "../../platform/ai/tauriAiAdapter";
import { TauriDeepSeekChatProvider, ConfiguredChatProvider } from "./chat/chatProvider";
import { ChatService } from "./chat/chatService";

export function usePetRuntime(characterId: string) {
  const character = useMemo(() => getCharacterDefinition(characterId), [characterId]);
  const aiAdapter = useMemo(() => createDefaultAiAdapter(), []);
  const aiConfiguration = useMemo(
    () => new AIConfigurationService(aiAdapter),
    [aiAdapter],
  );
  const deepSeekProvider = useMemo(
    () => new TauriDeepSeekChatProvider(aiAdapter),
    [aiAdapter],
  );
  const chatProvider = useMemo(
    () => new ConfiguredChatProvider(aiConfiguration, deepSeekProvider),
    [aiConfiguration, deepSeekProvider],
  );
  const chatService = useMemo(() => new ChatService(chatProvider), [chatProvider]);
  const persistenceService = useMemo(
    () => new PetPersistenceService({
      repository: new TauriPetPersistenceRepository(),
      onError: (error) => {
        if (import.meta.env.DEV) {
          console.error("Pet persistence error", error);
        }
      },
    }),
    [],
  );
  const runtime = useMemo(
    () => new PetRuntime({
      character,
      windowManager: desktopWindowManager,
      persistenceService,
      chatService,
    }),
    [character, chatService, persistenceService],
  );
  const [snapshot, setSnapshot] = useState(runtime.snapshot);
  const [ready, setReady] = useState(false);
  const runtimeLifecycleRef = useRef<RuntimeLifecycleCoordinator<PetRuntime> | null>(null);
  if (runtimeLifecycleRef.current === null) {
    runtimeLifecycleRef.current = new RuntimeLifecycleCoordinator<PetRuntime>();
  }
  const runtimeLifecycle = runtimeLifecycleRef.current;

  useEffect(() => {
    const unsubscribe = runtime.subscribe(setSnapshot);
    const lease = runtimeLifecycle.claim(runtime);
    const unregisterApplicationShutdown = registerApplicationShutdown(() => {
      aiConfiguration.dispose();
      void runtime.shutdown().finally(() => runtime.dispose());
    });
    let active = true;
    void aiConfiguration.refresh();
    void runtime.initialize().then(() => {
      if (active) {
        setReady(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
      unregisterApplicationShutdown();
      runtimeLifecycle.release(lease, (ownedRuntime) => {
        void ownedRuntime.shutdown();
      });
    };
  }, [aiConfiguration, runtime, runtimeLifecycle]);

  return {
    runtime,
    ready,
    snapshot,
    character,
    speechBubble: runtime.speechBubble,
    chatService,
    aiConfiguration,
  };
}
