import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const endpoint = process.env.MOMDAD_UPDATE_ENDPOINT;
const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY;
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
const privateKeyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;

if (!endpoint || !endpoint.startsWith("https://")) {
  throw new Error("MOMDAD_UPDATE_ENDPOINT must be an HTTPS production endpoint");
}
if (!publicKey) {
  throw new Error("TAURI_UPDATER_PUBLIC_KEY is required for a signed release build");
}
if (!privateKey && !privateKeyPath) {
  throw new Error(
    "TAURI_SIGNING_PRIVATE_KEY or TAURI_SIGNING_PRIVATE_KEY_PATH is required for a signed release build",
  );
}

const releaseConfig = {
  bundle: {
    createUpdaterArtifacts: true,
    targets: ["nsis"],
  },
  plugins: {
    updater: {
      pubkey: publicKey,
      endpoints: [endpoint],
      windows: {
        installMode: "passive",
      },
    },
  },
};

const releaseConfigDirectory = path.join(root, ".release");
const releaseConfigPath = path.join(releaseConfigDirectory, "tauri.conf.json");
fs.mkdirSync(releaseConfigDirectory, { recursive: true });
fs.writeFileSync(
  releaseConfigPath,
  JSON.stringify(releaseConfig, null, 2) + "\n",
  "utf8",
);

const command = process.platform === "win32"
  ? (process.env.ComSpec ?? "cmd.exe")
  : "pnpm";
const args = process.platform === "win32"
  ? ["/d", "/s", "/c", "pnpm.cmd tauri build --config %MOMDAD_RELEASE_CONFIG_PATH%"]
  : ["tauri", "build", "--config", releaseConfigPath];
const result = spawnSync(
  command,
  args,
  {
    cwd: root,
    env: {
      ...process.env,
      MOMDAD_RELEASE_CONFIG_PATH: releaseConfigPath,
      TAURI_SIGNING_PRIVATE_KEY: privateKey ?? privateKeyPath,
      VITE_UPDATE_ENABLED: "true",
      VITE_UPDATE_CHANNEL: "stable-alpha",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
