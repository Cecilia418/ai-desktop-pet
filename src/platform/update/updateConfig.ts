export interface UpdaterBuildEnvironment {
  readonly dev: boolean;
  readonly production: boolean;
  readonly enabledFlag: string | undefined;
}

/** Delay the one-shot launch check until the pet has settled on the desktop. */
export const UPDATE_CHECK_DELAY_MS = 15_000;

export function isProductionUpdaterEnabled({
  dev,
  production,
  enabledFlag,
}: UpdaterBuildEnvironment): boolean {
  return production && !dev && enabledFlag === "true";
}

export const productionUpdaterEnabled = isProductionUpdaterEnabled({
  dev: import.meta.env.DEV,
  production: import.meta.env.PROD,
  enabledFlag: import.meta.env.VITE_UPDATE_ENABLED,
});
