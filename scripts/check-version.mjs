import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const tauriConfig = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const cargoToml = fs.readFileSync(
  path.join(root, "src-tauri", "Cargo.toml"),
  "utf8",
);

const version = packageJson.version;
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

if (typeof version !== "string" || !semverPattern.test(version)) {
  throw new Error(`package.json version is not SemVer: ${String(version)}`);
}

const versions = {
  "package.json": version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": cargoVersion,
};
const mismatches = Object.entries(versions).filter(([, value]) => value !== version);

if (mismatches.length > 0) {
  throw new Error(
    "Application version mismatch:\n" +
      Object.entries(versions)
        .map(([file, value]) => `- ${file}: ${String(value)}`)
        .join("\n"),
  );
}

console.log(`Version consistency OK: ${version}`);
