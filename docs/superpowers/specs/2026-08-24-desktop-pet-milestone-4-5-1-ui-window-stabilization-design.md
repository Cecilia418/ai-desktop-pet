# Milestone 4.5.1 — UI & Window Interaction Stabilization Design

## Status

Approved for implementation on 2026-08-24.

This milestone is a stabilization pass over Milestone 4.5. It addresses real
manual acceptance failures in window sizing, hide/show lifecycle, autonomous
movement, drag ownership, and transparent-window hit testing. It does not add
Milestone 5 features and does not change the accepted pet business rules.

## Goals and non-goals

### Goals

- Keep PET_ONLY compact and role-first.
- Give every formal presentation enough logical space to render complete
  Chinese labels, controls, and panels inside the same Tauri window.
- Preserve the character foot-center screen position across mode changes.
- Make real Tauri hide/show and tray recall observable by the React
  presentation layer.
- Give WALKING, DRAG, LAYOUT, and HIDDEN explicit position ownership.
- Serialize programmatic position writes and invalidate stale writes.
- Keep transparent expanded regions click-through except for actual registered
  DOM regions.
- Make resize, content changes, DPI changes, and tray recall refresh geometry.
- Add development-only diagnostics that describe the real window and write
  pipeline.

### Non-goals

- No SQLite, AI provider, memory, cloud sync, coins, shop, inventory,
  wardrobe, TTS, reminders, or Milestone 5 work.
- No second Tauri window.
- No CSS translation used as a substitute for desktop window movement.
- No replacement of the accepted interaction/state/stat semantics.
- No change to `defaultCharacterScale` or the six-frame idle manifest.

## Architecture boundary

The presentation layer selects a `PetWindowMode` and renders from the shared
`PetWindowLayoutSpec`. It does not call Tauri window APIs directly. All resize,
position, visibility, DPI, work-area, and cursor-passthrough operations remain
behind `DesktopWindowManager` and `WindowLayoutCoordinator`.

The data flow is:

```text
FormalPetView
  -> WindowLayoutCoordinator (mode, resize, anchor, reposition)
  -> DesktopWindowManager (Tauri adapter and native lifecycle)

PetRuntime
  -> MovementController (position proposal only)
  -> DesktopWindowManager (serialized movement write)

DOM refs + ResizeObserver + Tauri resize/scale events
  -> InteractiveGeometryRegistry
  -> CursorPassthroughController
```

React owns presentation state only. PetState remains `IDLE`, `WALKING`, or
`SLEEPING`; window mode is not a PetState.

## Presentation window modes

The formal mode set is:

| Mode | Initial logical size | Purpose | Visible content |
| --- | ---: | --- | --- |
| `PET_ONLY` | 260 × 300 | Default compact pet mode | Character, bubble/effects, `•••` affordance when revealed |
| `ACTION_MENU` | 420 × 340 | Formal action affordance | Character lane plus complete action menu |
| `COMPACT_PANEL` | 420 × 420 | Feed, Status, Settings | Character lane plus one major panel |
| `CHAT` | 420 × 560 | Chat presentation | Character lane plus header, transcript, input, send, close |

These are starting values, not a second source of truth. They can be adjusted
inside the shared display configuration after GUI inspection. The character
display metrics remain `defaultCharacterScale = 0.5`, producing the current
approximately 119 × 150 logical character.

Presentation transitions are:

```text
PET_ONLY -> ACTION_MENU -> COMPACT_PANEL -> PET_ONLY
PET_ONLY -> CHAT -> PET_ONLY
ACTION_MENU -> PET_ONLY
```

Only one major panel is open. Opening Feed, Status, Settings, or Chat closes
the action menu first. Closing any major panel returns to `PET_ONLY`; Chat
close also dispatches the existing `CHAT_CLOSE` interaction through Runtime.

Opening `ACTION_MENU`, `COMPACT_PANEL`, or `CHAT` pauses autonomous movement
and settles a walking pet to `IDLE`. Closing presentation does not immediately
restart WALKING in this milestone.

## Shared layout contract

`PetWindowLayoutSpec` is the single contract consumed by configuration,
React/CSS, and `WindowLayoutCoordinator`. Every mode defines:

- logical window size;
- the stable pet lane and target `footCenterLocal`;
- the logical rectangle available to the action/menu/panel content;
- the safe bubble rectangle or equivalent safe-area constraints;
- the mode-specific affordance anchor.

React exposes these values as CSS custom properties. CSS positions the actual
DOM elements using those properties; it does not duplicate per-mode foot-center
magic numbers. `WindowLayoutCoordinator` uses the same spec for target window
size and work-area clamping. The measured rendered character rect remains the
final source of truth for the anchor correction.

The pet lane stays stable within each expanded mode. Expanded panels occupy a
separate content lane, so a panel does not move the character by flex-centering
or content-height changes. The character remains the current rendered size in
all modes.

## Foot-center anchor and resize sequence

Mode transitions use a controlled two-phase sequence:

1. Read the current physical outer position and monitor/work-area snapshot.
2. Measure the actual current character DOM rect and compute:

   `footCenterScreen = windowPosition + footCenterLocal * scaleFactor`

3. Claim `LAYOUT` position ownership and mark the presentation as transitioning
   so intermediate DOM/window frames are not presented as an interactive UI.
4. Resize the native window to the target logical size.
5. Request the target React mode from the shared layout spec.
6. Wait for React layout to settle, then measure the actual target character
   rect. Do not assume the target rect before React renders it.
7. Compute target native top-left from the captured screen foot center and the
   measured target foot center.
8. Clamp the target physical position to the current monitor work area.
9. Serialize one `LAYOUT` position write, then read back layout state and make
   only a necessary DPI rounding correction.
10. Refresh interactive geometry and release `LAYOUT` ownership.

While the transition is active, autonomous movement writes are suspended. A
newer transition invalidates the older request generation. The coordinator
never uses CSS compensation to hide an incorrect native position.

All layout sizes are logical pixels. Tauri position/work-area values are
converted consistently using the current monitor scale factor. The algorithm
must work at Windows 100%, 125%, and 150% DPI, with negative monitor origins
and taskbar-reduced work areas.

## Position ownership

The platform/runtime boundary uses `WindowPositionOwner`:

- `WALKING`: only autonomous MovementController proposals may be written.
- `DRAG`: native `startDragging()` owns the user movement; WALKING is paused
  and no programmatic movement write competes with it.
- `LAYOUT`: resize/reposition and DPI correction own the position; WALKING
  proposals are suspended and stale proposals are invalidated.
- `HIDDEN`: no autonomous or layout position writes are allowed while the
  window is hidden. Pending movement writes are discarded.

Only one owner is active at a time. Runtime interaction state continues to
represent drag and user interactions; no `DRAGGING` PetState is introduced.
Panel presentation pause is a separate runtime movement gate and does not
change PetState semantics.

## Position write queue

All programmatic `setPosition` calls pass through a serial write coordinator
inside the desktop platform adapter. The queue guarantees:

- at most one native write in flight;
- owner validation before execution;
- generation invalidation for stale movement/layout work;
- latest layout request wins over older layout requests;
- movement proposals are coalesced to the latest position;
- rejection/finally always releases the in-flight slot;
- hide invalidates and clears pending autonomous movement work;
- no queue deadlock after a rejected or never-successful request.

The Runtime still owns movement proposal timing and `MovementController` still
owns direction/boundary math. The queue owns only native write serialization
and ownership arbitration. A layout transition pauses Runtime movement before
claiming `LAYOUT`; a drag starts after movement is paused and releases the
runtime gate on drag end without repositioning the window back to a stale
snapshot.

## WALKING behavior and diagnostics

`Ctrl+Alt+2` remains a DEV-only request to the normal `PetStateMachine`. When
the transition is accepted, the Runtime refreshes the movement context and
the actual Tauri window receives repeated physical position writes. It must
move left/right and reverse at the monitor work-area edge. CSS transforms are
not involved.

The DEV overlay remains hidden by default and is not registered/rendered in
production. When shown with `Ctrl+Alt+D`, it reports at least:

- pet state and animation;
- presentation layout mode;
- window visible state;
- movement active/paused state and direction;
- real window X/Y and requested X/Y;
- last position delta;
- work-area bounds;
- logical window size and scale factor;
- position owner;
- queue length and write-in-flight state;
- registered interactive-region count;
- current error, if any.

## Hide and tray show lifecycle

Formal Hide follows one chain:

```text
UI action
  -> presentation hide command
  -> DesktopWindowManager.hide()
  -> native Tauri window.hide()
  -> visibility notification
  -> Runtime hidden gate + pending-write invalidation
```

The implementation must call the native hide API. CSS `display: none`,
`visibility`, and `opacity` are not used to simulate application hiding.
The Tauri app, tray, Runtime instance, vitals, and character resources remain
alive.

The Rust tray emits a window-visibility event after native show/hide. The
desktop adapter exposes that event to React. A tray Show/Recall event causes:

1. the same `main` Tauri window to show and focus;
2. Runtime visibility to become active and movement context to resynchronize;
3. action menu and active panel state to reset;
4. the layout coordinator to return to `PET_ONLY`;
5. geometry and cursor passthrough to re-register from current DOM rects.

If the pet was hidden during Chat, recall still returns to PET_ONLY. No new
window or Runtime is created, and stats are not reset.

Development logging covers `UI hide requested`, `WindowCommand.hide()`,
`DesktopWindowManager.hide()`, `Tauri hide invoked`, and the post-call
visibility result.

## Interactive geometry and cursor passthrough

`InteractiveGeometryRegistry` registers only actual rendered elements:

- character;
- action affordance;
- visible action menu;
- active panel.

The registry remains the only source for cursor-passthrough regions. It uses
`ResizeObserver` for registered element/content changes, the browser resize
event for logical layout changes, and Tauri resize/scale-factor events for
native/DPI changes. Mode transitions explicitly refresh after the measure and
position phases; tray show refreshes after presentation reset. Unmounting or
closing a panel removes its old registration immediately.

The character DOM rect continues to define Character/Head/Body interaction
geometry. Window expansion never creates a second character hitbox. The
cursor controller keeps all other transparent window pixels click-through and
temporarily keeps the active drag interactive.

## UI layout rules

The existing pastel/cozy design-system tokens remain in use. Layout is fixed
by mode size and shared lanes rather than by shrinking role, typography,
buttons, or padding.

- `ACTION_MENU` has enough room for complete primary actions and an overflow
  list containing Status, Hide, and Settings.
- `COMPACT_PANEL` presents Feed, Status, or Settings within the panel lane;
  Feed shows strawberry, rice ball, and carrot without clipping; Status shows
  hunger, mood, and energy.
- `CHAT` contains a complete header, transcript, input, send, and close
  controls inside the physical Tauri window.
- Speech bubbles remain within their mode safe area and use the existing
  `SpeechBubbleController` lifecycle.
- Character drag is enabled in PET_ONLY. Major panels disable character drag
  at the presentation boundary so panel controls cannot compete with native
  dragging. UI controls never route pointer events into the character
  InteractionController.

## Tests and verification

Automated coverage is added for:

- four mode specs and transitions;
- foot-center anchor, clamp, DPI correction, and stale transition handling;
- position owners, serialization, coalescing, invalidation, and failure
  recovery;
- WALKING writes, X changes, edge reversal, layout blocking, and hidden
  blocking;
- native drag pause/release behavior and no click/POKE collision;
- hide visibility notification and tray show reset using the same adapter;
- geometry refresh on resize, DPI, show, content change, and stale removal;
- existing PET, POKE, FEED, CHAT, Status, bubble, idle-frame, shortcut, and
  panel regressions.

Verification commands:

```text
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build
cmd /d /s /c "call \"E:\VS community\Common7\Tools\VsDevCmd.bat\" -arch=x64 && \"C:\Users\HUAWEI\.cargo\bin\cargo.exe\" fmt --check"
cmd /d /s /c "call \"E:\VS community\Common7\Tools\VsDevCmd.bat\" -arch=x64 && \"C:\Users\HUAWEI\.cargo\bin\cargo.exe\" check --manifest-path D:\Projects\ai-daughter-desktop-pet\src-tauri\Cargo.toml"
pnpm tauri build --no-bundle
pnpm tauri dev
```

Automated checks and real GUI smoke checks are reported separately. The GUI
check must include default PET_ONLY, all panel sizes, foot stability during
resize, transparent click-through, native hide, tray recall, actual WALKING
X movement and edge reversal, native drag release position, panel movement
pause, PET/POKE/FEED/Chat, and six-frame idle playback. The milestone ends
after M4.5.1 verification; Milestone 5 remains paused.

