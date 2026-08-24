# Desktop Pet M4.5.2 Affordance Usability and Milestone 5 Persistence Design

Date: 2026-08-24

## Scope

This design covers two consecutive, bounded phases:

1. M4.5.2 fixes the `•••` presentation affordance handoff and establishes a clean Git baseline.
2. Milestone 5 adds local SQLite persistence for the existing pet runtime.

M4.5.2 does not change the four window modes, interaction semantics, business rules, AI, or data model. M5 does not add AI, memory, shop, coins, inventory, auto-update, or M5.5 work.

## M4.5.2 Affordance Lifecycle

The affordance receives a small presentation-only controller with three states:

- `hidden`: no button is rendered and no geometry is registered;
- `visible`: the button is rendered and its actual DOM rect is interactive;
- `pending-hide`: the button remains rendered and interactive while a hide timer is pending.

The controller owns `isPointerOverCharacter`, `isPointerOverAffordance`, `isActionMenuOpen`, `visibleSince`, and one hide timer. It does not know PetState, PetStats, interaction rules, or persistence.

Configuration is centralized in `actionMenuBalance.ts`:

- `affordanceGracePeriodMs = 1000`;
- `affordanceMinimumVisibleMs = 2200`;
- affordance button hit target is at least `36 × 36` logical pixels while the icon remains visually small.

When the pointer leaves the character, the controller enters `pending-hide` and waits for both the grace period and the remaining minimum-visible duration. Entering the affordance cancels the timer. Leaving both character and affordance starts a new delayed hide. A pointer over the affordance therefore cannot be invalidated by the character's earlier `pointerleave`.

Opening ActionMenu cancels the affordance timer and marks the menu open. The affordance timer can never close ActionMenu. ActionMenu retains its independent approximately five-second inactivity timeout and closes on its already-defined actions, major-panel open, interaction start, hide, blur, and inactivity.

PET, POKE, and DRAG remain independent interaction semantics. The affordance remains a presentation entry point and is never opened by a character short click.

## M4.5.2 Geometry Contract

`InteractiveGeometryRegistry` registers the actual character, affordance, menu, and panel DOM elements. A visible or pending-hide affordance remains registered; only the transition to `hidden` removes it. `ResizeObserver`, window resize, panel transitions, and content changes continue to refresh actual rects. The cursor passthrough layer consumes the registry and never maintains a second affordance hitbox.

## M5 Persistence Architecture

The persistence flow is:

```text
PetRuntime.initialize()
  -> PetPersistenceService.load()
  -> TauriPetPersistenceRepository
  -> Rust SQLite repository and migrations
  -> calculateOfflineProgress(savedStats, elapsed, savedActivity)
  -> validate/clamp saved compact position to current work area
  -> hydrate PetRuntime
  -> start runtime and render
```

The recommended implementation is a native Rust SQLite repository using `rusqlite` with the bundled SQLite library. TypeScript exposes a narrow repository interface and invokes typed Tauri commands; React does not open the database or contain persistence rules.

The service provides:

- `load()` for startup hydration;
- trailing debounced autosave of the latest durable snapshot;
- `flush()` for shutdown and dispose paths;
- validation/error fallback without exposing corrupt data to the runtime.

The Runtime owns the durable snapshot boundary but not SQL. It persists only when durable values change and skips transient presentation state.

## Database Location and Migration

The database is `pet.db` inside Tauri `app.path().app_data_dir()`. Rust creates the directory before opening the database. A `schema_migrations` table records applied versions. Migration 1 creates the single-row `pet_state` table and is idempotent.

The persisted row contains:

- `hunger`, `mood`, `energy`, `intimacy`;
- `last_runtime_timestamp`;
- `last_activity` (`IDLE`, `WALKING`, or `SLEEPING`) for the existing offline calculator context;
- compact PET_ONLY position `x` and `y`;
- `updated_at`.

It does not contain animation frame, bubble/effect, active panel, ActionMenu, affordance state, cooldowns, drag session, chat transcript, API keys, or user-private data.

## Hydration and Offline Progression

The saved timestamp is compared with the current clock using a non-negative, finite elapsed duration. The existing `calculateOfflineProgress` pure function is reused with the saved activity. Invalid or unavailable persisted state falls back to the existing configured initial stats and records a non-fatal runtime error in development diagnostics.

Hydration completes before the Runtime is marked ready for visible UI data. The initial default stats are not rendered and then replaced by saved stats. The current animation and presentation state start fresh from IDLE/PET_ONLY.

## Autosave, Flush, and Position

The service coalesces durable changes and saves the latest state after the configured debounce interval. Runtime snapshots never cause per-frame SQL writes when durable values are unchanged; movement changes are coalesced.

Only the last eligible compact pet position is retained. Expanded ActionMenu, compact-panel, and Chat window geometry are never persisted. When the saved position is restored, it is clamped against the current monitor work area and current PET_ONLY window size. If the monitor or DPI changed, the clamped visible position is used.

Shutdown/dispose performs a final `flush()` with the latest eligible compact snapshot. A failed save is non-fatal and is surfaced through development diagnostics; the runtime continues to function in memory.

## Validation and Security Boundary

Rust validates finite numeric stats, valid activity values, valid timestamps, and finite positions before accepting database rows or writes. Stats are clamped at the existing domain boundary. Invalid rows are ignored safely rather than hydrated.

SQLite may contain intimacy because it is a core stat, but no secret is stored there. Future DeepSeek credentials must use OS secure storage and must not be written to `pet.db`, JSON config, logs, or the persistence repository.

## Verification

M4.5.2 tests cover lifecycle transitions, grace/minimum timing, pointer handoff, menu timer independence, geometry registration, and POKE/PET/DRAG regressions.

M5 tests cover migration idempotence, repository load/save, validation/recovery, hydration, offline progression, autosave coalescing, flush, restart simulation, position clamping, and the persistence boundary. Existing M4.5.1 window/movement tests remain required.

The final sequence is:

```text
M4.5.2 implementation -> tests -> pnpm tauri dev GUI check
-> .gitignore review -> complete baseline commit
-> M5 implementation -> tests -> pnpm tauri dev GUI check -> STOP
```

