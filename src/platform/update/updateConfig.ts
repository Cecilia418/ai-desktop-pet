export interface UpdaterBuildEnvironment {
  readonly dev: boolean;
  readonly production: boolean;
  readonly enabledFlag: string | undefined;
}

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
