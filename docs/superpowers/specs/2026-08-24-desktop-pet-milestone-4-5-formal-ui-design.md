# Desktop Pet Milestone 4.5 — Formal UI Design System & Interaction UI

## Status and scope

This document defines the implementation boundary for Milestone 4.5. Milestone 4
has been accepted. The direct user request supplies the visual direction: use the
attached Animal Crossing-like reference as inspiration for a warm, pastel,
rounded, cozy desktop companion UI. The supplied Milestone 4.5 brief supplies
the feature and verification constraints below.

Milestone 4.5 is a presentation refactor around the existing M4 runtime. It
replaces the disposable M4 temporary UI with the first formal UI system and
formal feature panels. It must not rewrite the interaction rules or begin
Milestone 5.

The implementation starts only after this design document is reviewed and
approved.

## Design goals

- Keep the desktop pet visually quiet: in the default state the desktop shows
  the character and occasional speech bubble, not a permanent dashboard.
- Use a soft, warm, pastel visual language inspired by the reference image:
  cream surfaces, sage green, pale blue, creamy yellow, light pink, rounded
  cards, small friendly labels, and restrained depth.
- Make the visual system reusable without turning this milestone into a large
  design-system project.
- Keep all business behavior behind the existing
  PetInteractionEvent -> PetRuntime.handleInteraction() boundary.
- Keep the Windows implementation behind DesktopWindowManager and a dedicated
  WindowLayoutCoordinator so a future macOS adapter can use the same UI
  contracts.
- Keep every visible panel and its cursor-hit geometry inside the physical
  bounds of the current Tauri window.

## Non-goals

This milestone does not include:

- DeepSeek, remote AI, a production AI provider, network requests, or TTS;
- SQLite, persistence, cloud sync, reminders, or automatic updates;
- coins, inventory, store, purchases, or a formal reward economy;
- full wardrobe, memory, relationship stages, growth journals, or personality
  growth;
- proactive AI behavior or a production settings implementation;
- new Tauri windows;
- new PetState values for panels, PET, POKE, FEED, CHAT, or dragging;
- new character animation frames or edits to the supplied PNG bytes;
- a second speech-bubble or interaction pipeline.

## Existing boundaries to preserve

The M4 runtime remains the source of truth:

    pointer samples / formal UI input
            |
            v
    PetInteractionEvent
            |
            v
    PetRuntime.handleInteraction()
            |
            +--> InteractionRules / PetVitals
            +--> PetStateMachine / forceWake()
            +--> SpeechBubbleController / reactions
            +--> PetEffectController
            +--> ChatService
            |
            v
    published snapshots -> React presentation

The formal UI may own presentation-only state:

- whether the action menu is visible;
- which single panel is active;
- whether the window is in compact pet mode or expanded chat mode;
- local input text and focus state.

The formal UI must not directly mutate PetStats, PetVitals, PetState,
SpeechBubbleController, or a Tauri window. The UI must not call a chat provider
directly. FEED, CHAT_START, CHAT_SEND, CHAT_CLOSE, and any future action event
continue through the typed PetInteractionEvent factory and PetRuntime.

## Visual direction

### Reference interpretation

The reference image is used as a mood and hierarchy reference, not as a literal
full-screen recreation. The UI should carry over:

- a warm cream base;
- sage and mint as the primary friendly color family;
- pale sky blue, soft yellow, and very light pink as secondary accents;
- large but controlled corner radii;
- light cards with gentle borders and soft shadows;
- short labels, clear grouping, and a scrapbook/sticker-like friendliness.

The desktop companion must remain much lighter than the reference page. There is
no persistent header, feed, chat transcript, or status dashboard around the
character.

### Visual rules

- Use dark warm gray for readable text; do not use pure black for large body
  copy.
- Use SVG line icons or small project assets for interface controls. Food
  artwork may continue to use the existing FoodDefinition asset placeholders
  until formal food art exists.
- Avoid neon or saturated green, heavy black borders, cyberpunk treatment,
  large gradients, complex glassmorphism, and strong neumorphic contrast.
- Use hover and pressed states through color, border, and shadow changes. Do not
  scale controls in a way that shifts neighboring layout.
- Keep UI motion between 120ms and 220ms. Use ease-out for entry and ease-in for
  exit. Respect prefers-reduced-motion by disabling nonessential motion.
- Keep speech-bubble copy short and keep the bubble away from the character's
  face whenever the current window geometry permits.

## Design tokens

Create one small token layer, preferably under src/styles:

- tokens.css — colors, radii, shadows, spacing, and type sizes;
- typography.css — safe font stacks and text roles;
- animations.css — shared short transitions and reduced-motion overrides.

Equivalent files are acceptable if the separation remains clear. Feature CSS
must consume tokens rather than scatter literal theme values.

The initial token contract is:

    --color-bg
    --color-surface
    --color-surface-secondary
    --color-primary
    --color-primary-soft
    --color-accent-yellow
    --color-accent-blue
    --color-accent-pink
    --color-text-primary
    --color-text-secondary
    --color-border

    --radius-sm
    --radius-md
    --radius-lg
    --radius-pill

    --shadow-sm
    --shadow-md

    --spacing-xs
    --spacing-sm
    --spacing-md
    --spacing-lg

    --font-size-xs
    --font-size-sm
    --font-size-md
    --font-size-lg

Suggested starting values are deliberately restrained and may be tuned during
GUI verification:

    --color-bg: #fffaf0
    --color-surface: #fffdf8
    --color-surface-secondary: #f4f0df
    --color-primary: #8eaf63
    --color-primary-soft: #dcebc1
    --color-accent-yellow: #f4d88b
    --color-accent-blue: #b9deea
    --color-accent-pink: #f3c6d6
    --color-text-primary: #4c4b46
    --color-text-secondary: #756f66
    --color-border: #ded8c8

    --radius-sm: 8px
    --radius-md: 12px
    --radius-lg: 18px
    --radius-pill: 999px

    --shadow-sm: 0 3px 10px rgba(91, 77, 55, 0.10)
    --shadow-md: 0 10px 24px rgba(91, 77, 55, 0.14)

The implementation may define semantic aliases such as panel background and
focus ring, but it must keep one source of truth for the base tokens.

### Typography

Do not download or bundle a font for this milestone. Use:

    "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif

for Chinese text and the system UI stack for English and numbers. Friendly
character should come from weight, spacing, rounded surfaces, and hierarchy
rather than a hard-to-read decorative font. Normal text must target at least
4.5:1 contrast against its surface.

## Component boundaries

Only repeated visual patterns become design-system components. The planned
minimum set is:

    src/ui/design-system/
      Button.tsx
      Card.tsx
      Panel.tsx
      ProgressBar.tsx
      StatusChip.tsx
      Popover.tsx
      PanelHeader.tsx
      Divider.tsx

The exact folder layout may follow existing feature structure, but design-system
components must not import PetRuntime or know about PetState. They receive
presentation props and callbacks. Feature components own business-specific
labels and event creation:

    src/ui/pet/
      PetActionMenu.tsx
      PetStatusPanel.tsx
      SpeechBubble.tsx

    src/ui/feeding/
      FeedPanel.tsx

    src/ui/chat/
      ChatPanel.tsx

No component should be extracted only to match the reference image. A pattern
must be genuinely reused at least twice or make a boundary materially clearer.

## Presentation state and panel coordination

Add a presentation-level coordinator in the React/application layer. It is not
PetState and it does not alter the runtime:

    type ActivePanel = null | "feed" | "status" | "chat" | "settings";

The coordinator guarantees:

- at most one major panel is visible;
- opening Chat closes Feed or Status before entering chat mode;
- opening Feed or Status closes Chat first;
- closing the active panel returns activePanel to null;
- the action menu can be visible with no major panel, but it is replaced or
  hidden when a major panel opens;
- settings is a very small placeholder shell only; it does not implement
  preferences.

PetView continues to collect raw pointer samples. InteractionController still
decides CLICK, PET, POKE, and drag events. The event dispatcher sends the
resulting PetInteractionEvent to PetRuntime first. A separate presentation
observer may close the action menu in response to PET, POKE, or DRAG_START, but
it must never open the action menu from a character CLICK. M4 defines a short
character click as POKE, so the same gesture must never produce both POKE and
an action-menu open.

## Formal pet action menu

Replace TemporaryActionMenu and remove its M4 TEMP / PLACEHOLDER path from
production rendering.

Default state:

- no action menu is visible;
- the character remains the main desktop content;
- the existing speech bubble appears only when SpeechBubbleController says it
  should.

The action menu is opened only by an independent presentation affordance. The
first version uses a small '•••' / circular button near the character. It is
shown on character hover or keyboard focus, remains outside the character
button's interaction geometry, and has its own registered DOM rect. Activating
that button opens the action menu; activating the character still follows the
M4 interaction semantics:

    short click HEAD/BODY -> POKE only
    long press HEAD       -> PET
    movement past 4px      -> DRAG
    '•••' affordance       -> presentation ActionMenu open

The affordance and action menu must remain inside the current Tauri window.
The affordance is intentionally small enough that it does not become a
permanent toolbar or alter the default pet-first composition.

When open, the action menu:

- stays near the character without covering the face when possible;
- provides primary actions for Feed and Chat;
- provides an overflow action for Status, Hide, and the small Settings shell;
- uses text plus consistent SVG/project icons, with aria-labels on every
  control.

The action bar is a presentation affordance. Feed, Chat, Status, Hide, and
Settings are routed as follows:

    Feed / Chat -> typed PetInteractionEvent -> PetRuntime
    Status      -> presentation panel coordinator only
    Hide        -> platform adapter through a presentation-facing command
    Settings    -> presentation placeholder only

Hide must call DesktopWindowManager.hide through an injected adapter or
coordinator. It must not set DOM display or alter PetState.

### ActionMenu lifecycle

ActionMenu presentation state is independent from PetState and has a centrally
configured inactivity timeout, initially 5,000ms (within the required 4–6
second range). The menu closes when:

- any action is selected;
- a major panel opens;
- PET, POKE, or DRAG_START is recognized;
- the Hide action succeeds or is requested;
- the host window emits a reliable blur event;
- the inactivity timer expires.

Every affordance/menu interaction resets the timer. Do not rely on
click-outside: transparent click-through areas may deliver the click to the
desktop instead of the WebView. An optional blur listener is additive; the
timer and explicit lifecycle events remain authoritative when platform blur is
unavailable.

## Status UI

PetStatusPanel is a compact in-window panel. It shows only:

- hunger;
- mood;
- energy.

It must never render intimacy, an intimacy label, or an intimacy numeric value.
The panel consumes the published PetRuntime snapshot and uses a pure
presentation mapping module. The mapping does not mutate PetVitals:

    hunger >= 80 -> 吃得饱饱的
    hunger >= 50 -> 还不错
    hunger >= 20 -> 有点饿
    otherwise    -> 肚子空空的

    mood >= 80 -> 很开心
    mood >= 50 -> 心情不错
    mood >= 20 -> 有点闷
    otherwise  -> 不太开心

    energy >= 80 -> 精神满满
    energy >= 50 -> 还挺有精神
    energy >= 20 -> 有点困
    otherwise   -> 快睡着啦

The UI may show an icon, semantic text, and a progress bar. Numeric values are
optional in this first formal presentation; if shown during implementation,
they remain the three public vitals only. Color must not be the sole state
indicator.

## Speech bubble presentation

Continue using the existing SpeechBubbleController and its hidden, showing, and
fading lifecycle. Replace only the presentation:

- cream-white or very light surface;
- large rounded corners;
- a small pointer/arrow;
- short readable copy with constrained width;
- restrained scale/fade entry and fade exit;
- automatic placement above the character, then left-top or right-top when
  needed;
- never position the bubble outside the current Tauri window.

The SpeechBubble component is presentation-only. It subscribes to the existing
controller snapshot and never starts a second timer or message lifecycle.

If the compact window cannot contain a bubble without clipping, prefer an
internal layout adjustment. A window resize is not required for bubbles in this
milestone; any future resize path must go through WindowLayoutCoordinator.

## Feed panel

Replace the temporary chooser with FeedPanel. It is a small floating panel
inside the current compact window and shows the three existing test foods:

- 草莓;
- 饭团;
- 胡萝卜.

Each item shows its configured name and asset. Do not show price, coins, or
inventory. Selecting an item:

    click food
      -> create FEED { foodId }
      -> PetRuntime.handleInteraction(event)
      -> close FeedPanel through the panel coordinator

FeedPanel must not compute LOVE, NORMAL, DISLIKE, stat deltas, or FULL behavior.
Those remain in FoodDefinition, InteractionRules, and PetRuntime. The existing
food effect, SpeechBubbleController, and stat pipeline must remain unchanged.

## Chat panel

Replace the temporary chat presentation while keeping LocalPlaceholderChatProvider
behind ChatService. ChatPanel is a formal first-version shell, not an AI
feature. It contains:

- a header with a small daughter avatar/project asset;
- a friendly title such as 和女儿聊天;
- a light presence hint such as 陪着妈妈;
- transcript;
- single-line input or naturally growing small textarea;
- Send and Close controls.

Message presentation:

- mama messages use a soft sage bubble;
- daughter messages use a cream or pale yellow bubble;
- both remain short, readable, and clearly attributed;
- no markdown toolbar, code block, model selector, token usage, or AI settings.

Input rules:

- Enter sends;
- Shift+Enter inserts a newline when a textarea is used;
- trimmed empty messages are disabled;
- pending state disables duplicate sending;
- errors use aria-live or role=alert.

The panel creates CHAT_START, CHAT_SEND, and CHAT_CLOSE events and observes
ChatService.snapshot. It never imports or calls ChatProvider.

## Window modes and layout

### Modes

Use two window modes:

    compact pet mode -> current logical compact bounds, initially 260 x 300
    expanded chat mode -> same Tauri window, initially 360 x 500

Feed and Status remain inside compact pet mode. They may use an in-window sheet
or popover that temporarily occupies part of the compact surface; they must not
create a second window. If content needs scrolling, constrain the panel to the
current logical window bounds rather than letting DOM overflow outside it.

Chat alone may enter expanded chat mode. CHAT_CLOSE returns to compact pet mode.
Closing Chat is not application exit.

### WindowLayoutCoordinator

Create an independent platform/layout coordinator, preferably:

    src/platform/desktop/windowLayoutCoordinator.ts

It depends on DesktopWindowManager and owns:

- compact and expanded logical sizes;
- the transition between compact and chat modes;
- Windows DPI conversion;
- screen-anchor capture;
- target position calculation;
- work-area clamping;
- serialized resize/reposition operations.

React may request a mode transition and provide a measurement callback, but it
must not import @tauri-apps/api/window or call setSize/setPosition directly.
The coordinator may use the existing DesktopWindowManager methods or extend that
adapter with a platform-neutral layout snapshot operation.

### Foot-center anchor contract

WindowLayoutCoordinator must not guess a future React rect from the current
window size. Compact and expanded layouts share one pure
PetWindowLayoutSpec contract, derived from the existing character display
metrics:

    PetWindowLayoutSpec {
      mode: "compact" | "chat",
      windowSize: LogicalSize,
      petLane: {
        footCenterLocal: LogicalPoint
      }
    }

The spec is the only source for the logical window sizes and stable pet-lane
anchor. React uses it to provide CSS layout variables, and
WindowLayoutCoordinator uses the same values for target calculations. CSS,
React, and the platform adapter must not each maintain independent anchor
magic numbers. The pet-lane point is a placement contract, not a second
character hitbox; CHARACTER / HEAD / BODY still come only from the actual
rendered DOM geometry.

The preferred transition is a controlled two-phase operation:

1. Capture phase: read the current character DOM rect and the adapter layout
   snapshot. Convert the current DOM foot-center to a screen coordinate using
   the current scaleFactor.
2. Prepare phase: request the target mode from the presentation coordinator,
   render the target layout using the shared PetWindowLayoutSpec, and hold a
   short layout-transition lock so an intermediate resize frame is not visible.
3. Measure phase: after React layout has committed and ResizeObserver has
   settled, read the actual target character DOM rect. Use its measured
   foot-center local value, with the shared pet-lane value as the expected
   contract, to calculate the target top-left.
4. Commit phase: apply target logical size and target physical position through
   one serialized adapter operation. The platform adapter may choose the safe
   order for Windows, but the transition lock stays active until both complete.
5. Verify phase: read the layout snapshot again and make at most a minimal
   correction for DPI rounding or work-area clamping, then release the lock.

If a platform can prove the shared pet-lane contract is exact for a layout,
the measure phase may be a verification-only pass. It must still be available
for content-driven layout changes. The lock prevents a resize intermediate
frame from showing the character at an incorrect screen position; it is not a
large animation.

All UI dimensions remain logical pixels. Physical screen coordinates are used
only inside the platform/layout boundary. The coordinator must prefer
preserving the captured foot-center over centering the new window. If the work
area makes exact preservation impossible, clamp by the smallest necessary
displacement and keep the character visible.

Transitions are serialized. A second request waits for or supersedes the
previous layout request according to the latest activePanel mode; stale
reposition results must not move the window after Chat has already closed.

## Cursor passthrough and physical bounds

The existing CursorPassthroughController remains the platform bridge.

Add a unified InteractiveGeometryRegistry for all visible interactive DOM
elements. It owns registration, unregistration, cached logical rects, and
refresh notifications:

    register("character", characterElement)
    register("affordance", affordanceElement)
    register("action-menu", actionMenuElement)
    register("panel", activePanelElement)

The registry uses ResizeObserver (or an equivalent platform-safe observer) on
each registered element and refreshes after:

- element resize;
- window resize or compact/expanded mode change;
- panel open/close and panel transition;
- content height changes, including transcript growth and validation/error
  messages;
- a DPI scale-factor change or a fresh platform cursor snapshot.

The observer updates the cached rect and requests CursorPassthroughController
to recompute its current ignore/interactive state from the latest snapshot.
The cursor controller must retain the last cursor snapshot so a geometry
refresh works even when the physical pointer has not moved. A cursor event may
also request a fresh registry read; no stale cache may be used after a
refresh.

Interactive regions are derived from the registry's current DOM rects:

- character button rect;
- the independent affordance rect when visible;
- action menu rect when visible;
- the one active panel rect when visible;
- any visible modal/close control contained in that panel.

When a panel or affordance closes, its registration is removed immediately.
The expanded window's otherwise transparent area remains click-through. The
root remains clipped to the physical Tauri window and panels may not rely on
DOM rendered outside that window for input.

Character geometry rules remain unchanged:

- actual rendered character DOM geometry is the source of CHARACTER, HEAD, and
  BODY regions;
- the same geometry feeds InteractionController and cursor passthrough;
- ResizeObserver refreshes this same character rect; it never creates a
  parallel character geometry record;
- window resizing changes the coordinate transform, not the hitbox definition;
- no alpha-pixel hitbox or parallel character-size table is introduced.

When drag is active, passthrough remains disabled for the duration of the native
drag, as in M4. Opening or closing a panel must not make autonomous movement
compete with user drag.

## Animation and character assets

Continue using the existing six-frame IDLE animation and the current character
asset manifest. Do not modify PNG bytes or add the missing walk, sleep, pet,
poke, or eat frame sets in this milestone. Existing fallback/effect behavior
remains valid. The formal UI must not make animation state decisions or add a
second CSS idle fallback for the multi-frame IDLE animation.

## Accessibility and interaction details

- Every button has an accessible name.
- All action controls have visible focus-visible styling.
- Feed and Chat are keyboard operable.
- Chat input has a label and sends according to the Enter/Shift+Enter rules.
- Speech bubble and chat errors use appropriate live-region semantics.
- State is communicated through text/icon/progress together, not color alone.
- Nonessential motion is disabled under prefers-reduced-motion.
- Hover feedback uses color, shadow, or border transitions without layout shift.

## Production cleanup

After the formal UI is in the production path:

- remove TemporaryActionMenu and the old temporary FeedChooser/ChatPanel path;
- remove M4 TEMP / PLACEHOLDER labels and disposable CSS;
- keep any test-only fixtures outside the production component tree;
- keep DevPetOverlay and Ctrl+Alt+D dev-only, hidden by default, and absent from
  the production rendering path;
- keep tray hide/show behavior alongside the formal Hide action.

## Testing plan

Add behavior tests; do not assert implementation-specific pixel styling.

### Panel coordinator

- only one major panel is open;
- opening Chat closes Feed and Status;
- closing Chat returns activePanel to null and requests compact mode;
- opening Feed or Status closes any other panel.

### Action menu

- the independent affordance opens the formal action menu;
- a short character click still emits POKE and does not open ActionMenu;
- PET, POKE, and DRAG_START close ActionMenu;
- selecting an action closes ActionMenu;
- the configured 4–6 second inactivity timeout closes ActionMenu;
- reliable blur closes ActionMenu when available;
- no click-outside behavior is required for transparent desktop areas;
- Feed opens FeedPanel;
- Chat emits CHAT_START and opens ChatPanel;
- Status opens the status presentation;
- Hide invokes the platform abstraction;
- settings opens only the small placeholder shell.

### Status

- hunger mapping is correct at all range boundaries;
- mood mapping is correct at all range boundaries;
- energy mapping is correct at all range boundaries;
- mapping uses floating-point-safe descending >= threshold checks;
- intimacy is never rendered in the production status tree.

### Feed

- all three catalog foods render;
- selecting a food emits FEED with the configured foodId;
- FeedPanel does not mutate stats directly;
- existing FULL behavior and food reactions remain unchanged.

### Chat

- opening emits CHAT_START;
- sending emits CHAT_SEND;
- closing emits CHAT_CLOSE;
- ChatPanel renders ChatService.snapshot;
- ChatPanel does not call ChatProvider directly;
- pending and empty-input behavior are preserved.

### Layout and passthrough

- compact and chat mode use the same Tauri window;
- both modes consume the same PetWindowLayoutSpec pet-lane contract;
- the controlled resize -> measure -> reposition path does not expose an
  intermediate character jump;
- foot-center anchor remains stable across enter/exit within the tolerance
  permitted by logical-to-physical DPI rounding;
- expanded transparent regions remain click-through;
- visible panel rects are included;
- closed panel rects are removed;
- geometry refreshes after resize, panel transition, content height change,
  and DPI scale-factor change even when the pointer is stationary;
- character geometry is unchanged as the hitbox source;
- drag, PET, POKE, sleeping wake, and movement pause behavior do not regress.

### Production checks

- no M4 TEMP / PLACEHOLDER label is rendered;
- no temporary production menu remains;
- no intimacy value is present in the production UI;
- the DEV overlay and DEV shortcuts do not render/register in production.

## GUI verification

Run:

    pnpm exec tsc --noEmit
    pnpm test
    pnpm exec vite build
    cargo fmt --check
    cargo check
    pnpm tauri build --no-bundle
    pnpm tauri dev

Manually verify:

1. Default mode shows the character without a permanent large UI.
2. The six-frame IDLE animation continues to play.
3. Clicking the character opens a small in-window action bar.
4. Feed, Status, and Settings stay within the current window bounds.
5. Status shows hunger, mood, and energy only.
6. Feed shows the three local foods and preserves the M4 FEED pipeline.
7. Opening Chat expands the same Tauri window without a visible character jump.
8. Local placeholder chat sends and receives a reply.
9. Closing Chat returns to compact pet mode and preserves the character anchor.
10. Speech Bubble keeps its lifecycle, placement, and restrained animation.
11. Transparent areas without visible UI still pass through to the desktop.
12. Panel areas are clickable only while visible.
13. Dragging, PET, POKE, sleeping wake, and tray hide/show still work.
14. Windows display scaling does not produce an obvious resize/reposition jump.

## Planned implementation areas

The exact file organization may follow the existing feature tree, but the
implementation is expected to touch only the following concerns:

- src/styles/ design tokens, typography, and shared transitions;
- src/ui/design-system/ reusable presentational primitives;
- src/ui/pet/ formal action menu, status panel, and speech bubble;
- src/ui/feeding/ formal feed panel;
- src/ui/chat/ formal chat panel;
- a presentation panel coordinator;
- src/platform/desktop/windowLayoutCoordinator.ts and the adapter contract;
- PetView composition and DOM-region registration;
- focused behavior tests for panels, presentation mappings, layout, and
  passthrough;
- removal of the M4 temporary UI production path.

No unrelated refactor is part of Milestone 4.5.

## Known limitations after this milestone

- Chat remains a local placeholder provider and has no AI behavior.
- Settings is only a small presentation shell.
- The character still uses the existing animation catalog and fallback behavior.
- There is no persistence, economy, wardrobe, or relationship progression.
- The formal UI is a first desktop companion system, not a complete product
  design system for future milestones.

## Completion gate

Milestone 4.5 ends after the formal UI, tests, builds, and GUI verification
listed above. Do not start Milestone 5 without a separate explicit instruction.
