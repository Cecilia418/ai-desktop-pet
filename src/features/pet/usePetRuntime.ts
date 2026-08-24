import { useEffect, useMemo, useState } from "react";
import { getCharacterDefinition } from "./characterAssets";
import { PetRuntime } from "./PetRuntime";
import { desktopWindowManager } from "../../platform/desktop/windowManager";
import { PetPersistenceService } from "../../platform/persistence/petPersistenceService";
import { TauriPetPersistenceRepository } from "../../platform/persistence/petPersistenceRepository";

export function usePetRuntime(characterId: string) {
  const character = useMemo(() => getCharacterDefinition(characterId), [characterId]);
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
    }),
    [character, persistenceService],
  );
  const [snapshot, setSnapshot] = useState(runtime.snapshot);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = runtime.subscribe(setSnapshot);
    let active = true;
    void runtime.initialize().then(() => {
      if (active) {
        setReady(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
      void runtime.shutdown().finally(() => runtime.dispose());
    };
  }, [runtime]);

  return {
    runtime,
    ready,
    snapshot,
    character,
    speechBubble: runtime.speechBubble,
    chatService: runtime.chat,
  };
}
