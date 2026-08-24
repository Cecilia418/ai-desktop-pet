import type { PetStatsSnapshot } from "./petStats";

export type PetActivity = "IDLE" | "WALKING" | "SLEEPING";

export interface PetBalanceConfig {
  initialStats: PetStatsSnapshot;
  hungerDecayPerHour: number;
  activeEnergyDecayPerHour: number;
  sleepEnergyRecoveryPerHour: number;
  offlineHungerFloor: number;
  offlineEnergyFloor: number;
  sleepThreshold: number;
  wakeThreshold: number;
  vitalsTickMs: number;
}

export const DEFAULT_PET_BALANCE: Readonly<PetBalanceConfig> = {
  initialStats: {
    hunger: 82,
    mood: 85,
    energy: 78,
    intimacy: 60,
  },
  hungerDecayPerHour: 4,
  activeEnergyDecayPerHour: 12,
  sleepEnergyRecoveryPerHour: 20,
  offlineHungerFloor: 20,
  offlineEnergyFloor: 25,
  sleepThreshold: 25,
  wakeThreshold: 70,
  vitalsTickMs: 1_000,
};
