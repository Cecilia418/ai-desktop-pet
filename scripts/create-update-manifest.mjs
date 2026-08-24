import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8"),
);
const repository = process.env.RELEASE_REPOSITORY ?? process.env.GITHUB_REPOSITORY;
const assetPath = process.env.RELEASE_ASSET_PATH;
const signaturePath = process.env.RELEASE_SIGNATURE_PATH;
const version = process.env.RELEASE_VERSION ?? packageJson.version;
const tag = process.env.RELEASE_TAG ?? `v${version}`;

if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error("RELEASE_REPOSITORY must be set to owner/repository");
}
if (!assetPath || !signaturePath) {
  throw new Error(
    "RELEASE_ASSET_PATH and RELEASE_SIGNATURE_PATH must point to the Tauri updater artifact and .sig file",
  );
}
if (!fs.existsSync(assetPath) || !fs.existsSync(signaturePath)) {
  throw new Error("The updater artifact or signature file does not exist");
}
if (version !== packageJson.version) {
  throw new Error(
    `RELEASE_VERSION ${version} does not match package.json ${packageJson.version}`,
  );
}

const assetName = process.env.RELEASE_ASSET_NAME ?? path.basename(assetPath);
const signature = fs.readFileSync(signaturePath, "utf8").trim();
if (!signature) {
  throw new Error("The updater signature file is empty");
}

const manifest = {
  version,
  notes: process.env.RELEASE_NOTES ?? "稳定性和体验改进。",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`,
    },
  },
};

const outputPath = process.env.RELEASE_MANIFEST_PATH ??
  path.join(root, "release", "latest.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`Created Tauri updater manifest: ${path.relative(root, outputPath)}`);
