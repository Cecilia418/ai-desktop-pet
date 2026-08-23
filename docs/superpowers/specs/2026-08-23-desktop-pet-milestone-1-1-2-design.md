# Desktop Pet Milestone 1.1 + 2 Design

## Scope

This iteration keeps the existing Tauri 2 + React + TypeScript desktop shell and adds only:

- Windows transparent-area click-through while preserving character interaction.
- Animation asset manifests that can later point at PNG sequence frames.
- A pure `AnimationController`.
- A pure `PetStateMachine` with `IDLE`, `WALKING`, and `SLEEPING`.
- A separate movement controller that moves the Tauri window during `WALKING`.
- Development-only keyboard shortcuts: `Ctrl+Alt+1`, `Ctrl+Alt+2`, and `Ctrl+Alt+3`.

AI, SQLite, needs/relationship values, economy, inventory, feeding, memory, formal sleep scheduling, position persistence, and multi-monitor restoration remain out of scope.

## Milestone 1.1: Interaction and click-through

Tauri's `setIgnoreCursorEvents` is a whole-window switch. It does not provide a reliable per-pixel hit-test, and an ignored WebView cannot use its own mouse-enter event to turn interaction back on. The Windows platform adapter therefore samples the global cursor position at a low fixed rate and emits a small cursor snapshot to the WebView.

The snapshot contains the screen cursor position, the current main-window screen position, scale factor, and left-button state. The frontend platform controller converts this to logical window coordinates and checks explicit interactive rectangles supplied by the rendered pet view. The character and control strip are interactive rectangles; the remaining transparent area is set to ignore cursor events. While the left mouse button is down or a drag is active, cursor events remain enabled until the interaction ends.

The platform-specific sampling is isolated under `src-tauri/src/platform/`. The React layer only supplies hitbox geometry and consumes the platform adapter interface. Non-Windows builds keep a no-op monitor implementation so a future macOS adapter can replace the sampler without changing the pet feature.

This is a rectangular hitbox approximation, not alpha-pixel hit-testing. It is intentionally stable and maintainable; transparent padding inside the SVG/PNG bounds may still be interactive.

## Milestone 2: Assets and animation

Character assets use a definition with an outfit map and animation map. Each animation has `frames`, `fps`, and `loop`. The default outfit manifest currently references the placeholder SVG for all three supported states. Later PNG sequences can replace those arrays without changing the state machine or movement code.

`AnimationController` owns playback state: current animation name, frame index, elapsed frame time, playing/paused state, loop behavior, and completion callbacks. Its `advance(deltaMs)` method is deterministic and is the unit-test seam. A runtime loop calls it; `PetView` never owns frame timers or frame-index decisions.

`PetStateMachine` owns transition validation and current state. The runtime asks it to transition and then maps the resulting state to an animation name. User interaction while sleeping requests the normal `SLEEPING -> IDLE` transition.

`MovementController` owns only horizontal movement math and edge reversal. The desktop window adapter supplies the current monitor work area and applies physical window positions. Animation and movement remain separate: `WALKING` plays a walk animation while the movement controller independently advances the window position.

## Runtime and rendering layers

The runtime owns the state machine, animation controller, movement controller, and requestAnimationFrame loop. It publishes a snapshot to React. Rendering is split conceptually into:

1. Character layer: current manifest frame.
2. Effect layer: placeholder bob/tilt/Zzz visuals based on the current state.
3. Speech layer: the existing local interaction bubble.

The placeholder motion is CSS/runtime presentation only. It is not embedded in the character asset.

## Development shortcuts

The shortcut listener is a small development-only module registered only when `import.meta.env.DEV` is true. It forwards a target state to `PetStateMachine.transition`; it never writes a React state directly. The listener is removed with the runtime cleanup function and does not add a formal product control, tray item, or production shortcut.

## Error handling and verification

Platform calls are promise-based and report failures to the existing lightweight error text. The cursor sampler tolerates unavailable window geometry and continues polling. Pure tests cover state transitions, animation timing, looping, and non-loop completion. Build verification covers TypeScript, Vite, Rust, and Tauri. GUI verification covers idle rendering, debug state switching, movement bounds, waking from sleep, drag continuity, tray hide/show, and click-through behavior.
