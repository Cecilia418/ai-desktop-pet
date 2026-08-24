import { useEffect, useMemo, useState } from "react";
import { getCharacterDefinition } from "./characterAssets";
import { PetRuntime } from "./PetRuntime";
import { desktopWindowManager } from "../../platform/desktop/windowManager";
import { PetPersistenceService } from "../../platform/persistence/petPersistenceService";
import { TauriPetPersistenceRepository } from "../../platform/persistence/petPersistenceRepository";
import { AIConfigurationService } from "../../platform/ai/aiConfigurationService";
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

  useEffect(() => {
    const unsubscribe = runtime.subscribe(setSnapshot);
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
      void runtime.shutdown().finally(() => {
        runtime.dispose();
        aiConfiguration.dispose();
      });
    };
  }, [aiConfiguration, runtime]);

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
