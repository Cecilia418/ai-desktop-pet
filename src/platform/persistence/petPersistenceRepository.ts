import { invoke } from "@tauri-apps/api/core";
import {
  normalizePersistedPetState,
  type PersistedPetState,
} from "./petPersistenceTypes";

export interface PetPersistenceRepository {
  load(): Promise<PersistedPetState | null>;
  save(state: PersistedPetState): Promise<void>;
}

export class TauriPetPersistenceRepository implements PetPersistenceRepository {
  public async load(): Promise<PersistedPetState | null> {
    const raw = await invoke<unknown>("load_pet_state");
    if (raw === null || raw === undefined) {
      return null;
    }
    const state = normalizePersistedPetState(raw);
    if (!state) {
      throw new Error("invalid persisted pet state returned by Tauri");
    }
    return state;
  }

  public async save(state: PersistedPetState): Promise<void> {
    const normalized = normalizePersistedPetState(state);
    if (!normalized) {
      throw new Error("invalid persisted pet state");
    }
    await invoke("save_pet_state", { state: normalized });
  }
}
