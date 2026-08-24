# Windows Alpha Release

This project distributes one channel, `stable-alpha`, using the Tauri 2 NSIS
installer and signed updater artifacts. Release commands are intentionally
manual at the final upload step; no script uploads secrets or creates a remote
release automatically.

## One-time updater key setup

Run the local Tauri CLI and keep the private key outside the repository:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.tauri" | Out-Null
pnpm tauri signer generate -w "$env:USERPROFILE\.tauri\ai-daughter-desktop-pet.key"
```

Store the printed public key in the release secret/configuration manager. Never
commit the private key or its password.

## Release prerequisites

Set these values in the release PowerShell session. `.env` files are not used
for signing:

```powershell
$env:MOMDAD_UPDATE_ENDPOINT = "https://github.com/<owner>/<repository>/releases/latest/download/latest.json"
$env:TAURI_UPDATER_PUBLIC_KEY = "<public-key-content>"
$env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\ai-daughter-desktop-pet.key"
# Set only when the generated key has a password.
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "<password>"
```

The endpoint must be HTTPS and must point to the static Tauri updater manifest.

## Build and validate

```powershell
pnpm version:check
pnpm release:check
pnpm test
pnpm exec tsc --noEmit
pnpm exec vite build
pnpm release:build
```

The bundled output is under `src-tauri/target/release/bundle/nsis/`. The setup
executable is the friend-facing installer. The signed setup artifact and its
`.sig` file are the updater assets.

## Generate the manifest

After the signed build, point the helper at the generated artifact and
signature:

```powershell
$env:RELEASE_REPOSITORY = "<owner>/<repository>"
$env:RELEASE_ASSET_PATH = "<absolute-path-to-setup-exe>"
$env:RELEASE_SIGNATURE_PATH = "<absolute-path-to-setup-exe.sig>"
$env:RELEASE_NOTES = "本次 Alpha 更新包含稳定性改进。"
pnpm release:manifest
```

The helper writes `release/latest.json` using the Tauri updater schema. It does
not upload the file.

## Publish manually

Create a GitHub Release tagged `v<version>` in the `stable-alpha` channel and
upload:

- the NSIS setup executable;
- its updater signature file if retained as a release artifact;
- `latest.json`.

The manifest's `platforms.windows-x86_64.url` must resolve to the uploaded setup
artifact, and its inline signature must match the generated `.sig` content.

## Upgrade smoke test

Install the previous Alpha, create visible pet state, close and reopen once,
then publish the next version. From the old installation:

1. open Settings;
2. select “检查更新”;
3. choose “更新”;
4. wait for the signed installer to finish and the app to relaunch;
5. verify stats and compact window position are still present.

If the release endpoint is not configured, only local installer, persistence,
offline, and no-network checks can be claimed; do not call that a completed
updater E2E test.
