# Desktop Pet Milestone 3.5 Interaction Foundation Design

## Scope and instruction separation

The supplied Milestone 3.5 request defines this iteration as an interaction foundation and a small set of Milestone 3 regression fixes. The implementation must stop after this milestone and must not begin Milestone 4.

The direct decisions confirmed for this document are:

- Use the recommended interaction architecture (方案 A).
- Keep the existing 4px pointer movement threshold; centralize it without changing its value.
- Keep the supplied character/outfit/animation abstractions and the existing `SpeechBubbleController` entry point.
- Keep Windows-specific behavior behind the desktop platform adapter so a future macOS adapter can replace it.

Milestone 3.5 includes:

- Diagnose and repair the existing WALKING window-movement regression without rewriting `AnimationController`.
- Make the development overlay hidden by default and add a development-only `Ctrl+Alt+D` toggle.
- Introduce a typed `PetInteractionEvent` model.
- Add a non-React `InteractionController` for pointer recognition.
- Route interaction consequences through `PetRuntime.handleInteraction(event)`.
- Add centralized interaction regions, local reactions, cooldowns, and tests.
- Keep speech-bubble lifecycle behavior in the existing `SpeechBubbleController`.

The following remain explicitly out of scope: AI or DeepSeek calls, feeding, food, store, coins, inventory, database/SQLite, memory, relationship or growth systems, personality systems, formal settings or state UI, outfit UI, TTS, auto-update, real pet/poke gesture recognition, and any other Milestone 4 feature.

## Design goals

The interaction path must be traceable and platform-independent:

```text
PetView raw pointer samples
        ↓
InteractionController
        ↓ PetInteractionEvent
PetRuntime.handleInteraction(event)
        ↓
state-machine / movement / reaction / speech-bubble delegates
        ↓
PetView renders published snapshots
```

`PetView` is a view and input adapter. It does not decide whether a gesture is a click or drag, write PetState, mutate vitals, choose a reaction, or directly wake the pet.

`PetRuntime` is the interaction boundary and coordinator, not a new God Object. It delegates reaction selection, cooldown checks, speech presentation, and movement pause/resume to small collaborators while retaining ownership of state-machine transitions.

## PetInteractionEvent model

Add a discriminated event model with a common envelope:

- `type`: `CLICK`, `PET`, `POKE`, `DRAG_START`, `DRAG_MOVE`, `DRAG_END`, `FEED`, `CHAT_START`, or `WAKE`.
- `timestamp`: event creation time in milliseconds.
- `source`: the producer, initially pointer/user input; the model leaves room for keyboard, system, debug, and future AI sources.
- `region`: optional resolved target region (`CHARACTER`, `HEAD`, or `BODY`).
- `payload`: optional typed extensible data. Future feed events can carry an item id without changing the envelope.

The initial pointer controller emits `CLICK`, `DRAG_START`, `DRAG_MOVE`, and `DRAG_END`. `PetRuntime` may derive a `WAKE` consequence from a sleeping character click; React must not synthesize a separate state update.

The event model is a value object. It contains no React references, DOM nodes, Tauri window objects, or business-state mutation methods.

## InteractionController pointer state machine

`InteractionController` is a framework-independent controller with injected event sink, clock, rendered-geometry resolver, and the centralized threshold configuration.

Pointer handling rules:

1. A pointer-down inside the rendered character rectangle starts a pending gesture and records pointer id and origin.
2. Movement whose distance remains below the configured 4px threshold keeps the gesture pending.
3. Pointer-up for a pending gesture emits exactly one `CLICK` and never emits drag events.
4. Movement at or beyond the 4px threshold emits exactly one `DRAG_START`, followed by `DRAG_MOVE` events for subsequent samples.
5. Pointer-up after drag emits exactly one `DRAG_END` and does not emit `CLICK`.
6. Pointer cancel/blur terminates the pending session without manufacturing a click.
7. Pointer capture is a view/input concern; the controller itself only receives normalized samples.

The threshold is a named configuration value, not a literal distributed through `PetView` or CSS. The current value remains exactly 4 logical pixels.

## Interaction regions and geometry

Define interaction regions centrally from the actual rendered character rectangle:

- `CHARACTER`: the full rendered character rectangle.
- `HEAD`: an approximate normalized rectangle in the upper character area.
- `BODY`: an approximate normalized rectangle in the lower character area.

Region definitions use percentages/normalized coordinates and intentionally do not inspect alpha pixels. The resolver checks the rendered rectangle first, then resolves the most specific region. Points outside the rendered rectangle are ignored.

The same geometry chain is used by both input and cursor passthrough:

```text
actual DOM character rect
        ↓
normalized CHARACTER/HEAD/BODY resolver
        ↓
cursor-passthrough interactive rectangle
```

No independent PNG-size hitbox or fixed window-size hitbox is introduced. Changing `defaultCharacterScale` therefore changes rendering, interaction regions, and passthrough together. The controller remains asset-agnostic and uses rendered bounds rather than a particular PNG.

Actual alpha-precise hit testing and real head-rubbing/pet gesture recognition are deferred.

## PetRuntime interaction pipeline

Expose `handleInteraction(event)` or an equivalent single runtime entry point. All pointer events pass through it before any consequence is applied.

The runtime delegates as follows:

- `CLICK`: resolve the current state and region, consult the cooldown/reaction collaborators, and request a local speech reaction when accepted. In `IDLE` and `WALKING`, the state remains unchanged.
- `CLICK` while `SLEEPING`: immediately take the user-interrupt path, call `forceWake()`, and request the normal `SLEEPING -> IDLE` transition. The hit region remains active while sleeping.
- `DRAG_START`: mark interaction active, pause/cancel autonomous movement, and invoke the platform window-drag adapter. No automatic movement may compete with the native drag.
- `DRAG_MOVE`: remain in the active drag session. Native window dragging owns physical movement; the runtime does not run autonomous deltas.
- `DRAG_END`: clear interaction-active state and settle to the current reasonable post-drag state. For the current milestone the intended settled state is `IDLE`, and it must not immediately auto-enter `WALKING`.
- Future `PET`, `POKE`, `FEED`, and `CHAT_START` events have model and routing seams but no product behavior beyond what this milestone explicitly implements.

The state enum remains `IDLE`, `WALKING`, and `SLEEPING`. Dragging is an interaction mode/flag, not a new formal PetState. Existing `forceWake()` remains the public user-interrupt seam and continues to delegate through `PetStateMachine`.

## Reaction module

Add a local reaction registry separate from the runtime and from AI:

- Registry keys support `CLICK`, `PET`, `POKE`, and `WAKE`.
- Entries contain local placeholder lines and may be selected randomly through an injected/randomizable selector for deterministic tests.
- M3.5 actively uses `CLICK` and `WAKE`; `PET` and `POKE` are extension points only.
- Reactions have no stats, reward, growth, memory, AI, or persistence side effects.

The reaction module asks the existing speech-bubble controller to present the selected line. It does not create another bubble component or duplicate lifecycle timers.

## Cooldown module

Add an `InteractionCooldownManager` with a centralized configuration and the following API:

- `canTrigger(type)`
- `record(type)`
- `remaining(type)`

Cooldowns are tracked independently by interaction type. The initial click cooldown is approximately 400ms and remains a configuration value; future PET, POKE, and WAKE values are separate entries. A sleeping click must still wake through `forceWake()` even if a local speech reaction is rate-limited; cooldown limits feedback frequency, not the required wake transition.

The manager accepts an injected clock for deterministic tests and does not use React timers.

## SpeechBubbleController lifecycle

Keep the existing `SpeechBubbleController` as the sole presentation entry point:

```text
hidden → showing → fading → hidden
```

Rules:

- The default state is `hidden`; idle rendering does not create a bubble.
- Accepted local `CLICK` and `WAKE` reactions call `show()` with a placeholder line.
- The display duration remains within the existing 3–5 second range, followed by a fade and then `hidden`.
- A repeated accepted trigger refreshes/replaces the current message and restarts its lifecycle rather than creating a second component.
- Future AI messages will call the same `show()` API.
- Lifecycle timing remains inside the controller and is testable with an injected scheduler.

## Drag and movement coordination

Before changing movement code, diagnose the complete existing chain:

1. Confirm `WALKING` transition reaches movement-context initialization.
2. Confirm `advanceMovement()` runs while the runtime loop is active.
3. Confirm Tauri position writes are actually issued and not permanently suppressed by the in-flight guard.
4. Confirm logical/physical coordinates and the 260x300 window bounds are consistent.
5. Confirm the per-frame delta is visible and reverses at the work-area edges.
6. Confirm cursor passthrough and interaction-active flags do not block autonomous movement outside a drag session.

Use focused tests/diagnostics to isolate the failing link, then make the smallest repair. Do not rewrite `AnimationController` and do not replace the movement system with a second animation loop.

During a drag session, `MovementController` must be paused or cancelled through the runtime interaction path. Its autonomous timer/frame work must not write competing positions. Releasing the drag clears the pause and settles the runtime to `IDLE` without immediately starting a walk.

## Development-only overlay and shortcuts

`DevPetOverlay` remains a development diagnostic surface only:

- Its default visibility is `false`.
- `Ctrl+Alt+D` toggles visibility only when `import.meta.env.DEV` is true.
- The shortcut is kept in the removable development shortcut module and is not part of the formal interaction event path.
- Production does not register the shortcut and does not render the overlay. The production bundle must be checked for the debug registration/overlay branch.
- No formal product UI, button, tray entry, hunger/mood/energy panel, or intimacy display is introduced. Intimacy remains hidden from any future formal user-facing surface.

The existing development state shortcuts remain separate and continue to call the state-machine path rather than changing React display state.

## Testing plan

Add or extend tests for:

### Pointer recognition

- below-threshold movement followed by release emits `CLICK`;
- the exact centralized 4px threshold is used;
- movement at/over threshold emits one `DRAG_START`;
- drag samples emit `DRAG_MOVE`;
- release emits `DRAG_END`;
- drag never emits `CLICK`;
- sleeping hit regions remain active.

### Runtime consequences

- `IDLE` click stays `IDLE` and can show a local reaction;
- `WALKING` click stays `WALKING` and can show a local reaction;
- `SLEEPING` click calls `forceWake()` and ends in `IDLE`;
- `DRAG_START` pauses autonomous movement;
- `DRAG_END` leaves a valid settled state and does not immediately start walking.

### Bubble and reactions

- default bubble state is hidden;
- accepted click shows a line;
- timeout transitions through fade and hides;
- an accepted repeated trigger refreshes/replaces the current bubble;
- reaction selection is local and deterministic under an injected selector.

### Cooldowns

- first trigger is accepted;
- rapid duplicate is blocked;
- trigger is accepted after the configured duration expires;
- types do not share an accidental global cooldown.

### Regions and build boundary

- points resolve to `HEAD`, `BODY`, `CHARACTER`, or outside as expected;
- outside points are ignored;
- resolved geometry follows the rendered rectangle/scale;
- production build has no debug overlay shortcut registration or overlay rendering path.

Existing M3 regression tests for vitals, sleep/wake, and display metrics must remain green.

## GUI verification plan

Run `pnpm tauri dev` and manually verify:

- the character appears with the default bubble hidden;
- `Ctrl+Alt+2` visibly moves left/right and reverses at work-area edges;
- a click shows a bubble which later disappears;
- `Ctrl+Alt+3` puts the pet to sleep and a click wakes it;
- a short movement is a click, while a real drag does not produce a click reaction;
- dragging pauses autonomous movement and release leaves the character stable;
- transparent space outside the rendered character remains click-through;
- tray hide/recall still works;
- `Ctrl+Alt+D` shows and hides the overlay, which is hidden on startup.

If GUI automation is unavailable, record these as manual verification items rather than treating a successful build as proof of visual movement or click-through behavior.

## Verification commands

The implementation phase will run, repair, and rerun:

```text
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build
cargo fmt --check
cargo check
pnpm tauri build --no-bundle
pnpm tauri dev
```

No Milestone 4 work begins after these checks.

## Approval gate

This document is the implementation contract for Milestone 3.5. Code changes begin only after the user reviews and confirms this committed design.
