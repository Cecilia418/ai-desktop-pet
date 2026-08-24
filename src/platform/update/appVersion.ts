import { getVersion } from "@tauri-apps/api/app";
import packageJson from "../../../package.json";

export type AppVersionProvider = () => Promise<string>;

/** Reads Tauri's runtime version with the canonical package version as a browser fallback. */
export const getAppVersion: AppVersionProvider = async () => {
  try {
    return await getVersion();
  } catch {
    return packageJson.version;
  }
};
