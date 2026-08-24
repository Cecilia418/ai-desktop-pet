# Milestone 5.5 — Windows Distribution & Automatic Update Design

Date: 2026-08-24  
Status: approved for implementation by the task request

## Scope

Milestone 5.5 turns the current Tauri desktop pet into a Windows Alpha distribution:

- semantic application versioning;
- a current-user Windows NSIS installer;
- signed Tauri updater artifacts;
- a single `stable-alpha` update channel backed by a static GitHub Releases manifest;
- a typed `UpdateService` with a small Settings presentation;
- persistence coordination before install/restart;
- upgrade compatibility checks for the existing SQLite data.

This milestone does not add AI, API keys, memory, cloud sync, accounts, shop,
coins, wardrobe, TTS, reminders, or chat-history persistence. It stops before
Milestone 6.

## Existing invariants

The current M5 Git baseline is commit `77831ce`. The application identifier is
`com.momdaughter.desktop`, and the SQLite database remains under Tauri's
`app_data_dir()` as `pet.db`. The installer and updater must never change either
identifier or data location.

The persisted `lastActivity` remains useful context for offline progression and
diagnostics. It is not a restart instruction. Hydration will calculate offline
progress with that context, while the new Runtime session always starts in
`IDLE`; it will not resume `WALKING`, movement direction, animation frame,
movement queue, drag, panel, or bubble state. Any future sleep decision must use
the existing state-machine transition path rather than restoring a transient
state directly.

## Installer strategy

Use the Tauri 2 Windows NSIS bundle as the Alpha installer:

- current-user install mode, so a friend can install without administrator
  privileges;
- normal Tauri WebView2 bootstrapper behavior;
- the existing temporary application icon remains valid for Alpha;
- `productName`, publisher metadata, identifier, and semantic version are
  explicit in Tauri configuration;
- `msi` is not the primary Alpha distribution target, avoiding an unnecessary
  second installer path and the additional MSI-only build prerequisite.

The normal `pnpm tauri build` command will produce the Windows setup executable
and updater artifact. Final verification must run without `--no-bundle`.

## Version strategy

`package.json` is the canonical version source. `src-tauri/tauri.conf.json` and
`src-tauri/Cargo.toml` contain the synchronized value required by their build
systems. `scripts/check-version.mjs` compares all three and fails on drift.

Versions follow `MAJOR.MINOR.PATCH`, starting from the existing `0.1.0` Alpha
version. `pnpm version:check` is required before a release build.

The runtime Settings panel reads the actual Tauri application version through
`@tauri-apps/api/app.getVersion()`, with a testable adapter boundary. It does
not display a separately maintained frontend version.

## Updater architecture

Use the official Tauri 2 updater and process plugins:

```text
SettingsPanel
    ↓ typed callbacks
UpdateService
    ↓ updater adapter
@tauri-apps/plugin-updater
    ↓ signed artifact check/download/install
@tauri-apps/plugin-process.relaunch()
```

`UpdateService` owns the state machine:

- `idle`
- `checking`
- `up-to-date`
- `available`
- `downloading`
- `ready`
- `installing`
- `error`

It exposes a snapshot and subscription API. A concurrent check is coalesced;
manual checking while a check/download/install is active does not create a
second request. Download progress is shown only when the official callback
provides a content length; otherwise the UI says “正在下载更新…” without a
fake percentage.

The service uses one session check at startup after a delay and one explicit
manual check. A failed network request changes only the update snapshot.

## Release channel and endpoint

Only one channel exists: `stable-alpha`. No beta/nightly/dev channel matrix is
introduced.

The production updater uses a static Tauri updater manifest hosted as a GitHub
Release asset named `latest.json`. The repository owner/name is a release
configuration value because this local checkout has no Git remote yet. Until a
real GitHub repository is configured, endpoint-dependent checks are disabled or
reported as unavailable rather than sending requests to a placeholder host.

The manifest uses the Tauri schema, including SemVer, release notes, publication
date, platform key, artifact URL, and the inline artifact signature. A small
release helper validates/builds this metadata but does not upload releases or
handle secrets.

## Signing boundary

The Tauri updater public key is distributed in the production Tauri
configuration. The private key is generated and stored outside the repository,
then supplied only through the official build environment variable
`TAURI_SIGNING_PRIVATE_KEY`; an optional password uses
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

The private key, password, CI token, and release credentials are excluded by
`.gitignore` and are never placed in the frontend bundle, SQLite, logs, design
documents, or release artifacts. The release helper checks for accidental
private-key files in tracked files and in `dist`.

## Update lifecycle and persistence coordination

Before update installation:

1. `UpdateService` asks the application lifecycle coordinator to prepare.
2. The coordinator rejects the action while native drag is active and leaves
   the current app untouched.
3. It closes ActionMenu, Feed, Status, Chat, and Settings.
4. It stops autonomous walking, invalidates queued position writes, and exits
   the interaction session.
5. It calls `PetRuntime.shutdown()` / `PetPersistenceService.flush()`.
6. A flush failure prevents install/restart and returns a user-friendly error.
7. Only after a successful flush does the service download/install and request
   a process relaunch.

If the process exits during or after installer execution, the next launch uses
the existing SQLite migration, offline progression, vitals hydration, and
compact-position restoration path.

## Production and development boundary

Development builds do not query the production endpoint by default. The
development adapter is disabled unless an explicit test configuration is
provided. Production builds use the signed configured endpoint. No update
private key is ever embedded in development or production frontend code.

## Settings presentation

The existing Settings placeholder becomes a small panel containing only:

- current version;
- “检查更新”;
- an available-version line and “更新” action;
- a compact status/error message.

It remains inside the current transparent Tauri window and preserves the
existing one-major-panel rule. Settings does not know updater plugin details.

## Failure and rollback behavior

The current installed version remains usable when there is no network, the
endpoint is unavailable, the manifest is invalid, the signature is invalid,
the download fails, the installer fails, or no update exists. No custom binary
patcher, PowerShell downloader, or unsigned executable execution is added.

The updater's signed artifact validation is the trust boundary. Installer
rollback is delegated to the Tauri/NSIS update lifecycle; application code does
not delete or migrate `pet.db` as part of an update.

Uninstall behavior is documented as installer/platform-defined. This milestone
does not delete `app_data_dir` and does not add a “reset all data” feature.

## Release workflow

`docs/releasing.md` will describe the human-confirmed flow:

1. bump the canonical package version;
2. run version and regression checks;
3. provide signing-key environment variables from a secure local/CI secret;
4. run the full bundled Windows build;
5. validate installer, updater artifact, signature, and generated manifest;
6. create a GitHub Release in `stable-alpha`;
7. upload the installer, signed updater artifact, signature/manifest assets;
8. install the old build and perform the update smoke test.

The helper never uploads, creates releases, prints private secrets, or mutates
remote release state automatically.

## Verification plan

Automated coverage:

- version consistency and SemVer checks;
- updater state transitions, coalesced checks, errors, and progress handling;
- disabled development adapter boundary;
- flush-before-install success and failure;
- SQLite survival across a simulated version restart;
- saved `WALKING` activity is used for offline calculation but restart state is
  `IDLE`;
- Settings version/check/update wiring without direct plugin access;
- existing PET, POKE, DRAG, FEED, CHAT placeholder, WALKING, hide/tray, SQLite,
  offline progression, and window-position tests.

Local Windows verification:

- `pnpm tauri build` with bundling enabled;
- inspect generated NSIS installer and signed artifact names;
- install the generated Alpha build;
- verify the database remains under the stable app-data path;
- run a no-network smoke test;
- verify real update E2E only after a real GitHub repository, release, endpoint,
  and signing secret are supplied.

## Out of scope

No M6 AI or any of the prohibited product systems are implemented.

