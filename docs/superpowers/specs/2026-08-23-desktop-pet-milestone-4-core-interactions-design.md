# Desktop Pet Milestone 4 — Core Interactions Design

## Scope and instruction separation

Milestone 3.5 has been accepted. This document defines the next implementation
iteration only: deterministic local core interactions for the existing Windows-first
desktop pet.

The supplied Milestone 4 request defines five interaction paths:

- `PET` — press and hold the rendered `HEAD` region;
- `POKE` — short click on `HEAD` or `BODY`;
- `DRAG` — native desktop-window dragging;
- `FEED` — choose one of three local test foods;
- `CHAT` — open a functional local chat shell.

The direct decisions confirmed for this document are:

- Keep the existing 4px drag threshold unchanged and centrally configured.
- Keep the existing `PetInteractionEvent -> PetRuntime.handleInteraction()` boundary.
- Extend `InteractionController` with long-press PET recognition.
- Let `PetRuntime` derive POKE from a short click and its resolved region.
- Add `InteractionRules`, `InteractionBalanceConfig`, and `FoodDefinition`.
- Keep dragging as an interaction mode; do not add `PetState.DRAGGING`.
- Let `PetRuntime` coordinate rules, reactions, wake-up, stats, and interaction
  exclusivity.
- Add `ChatService` with a `LocalPlaceholderChatProvider`; make no network or AI call.
- Use a small in-window `TemporaryActionMenu`, explicitly labelled `temporary` /
  `M4 placeholder`, as the only FEED and CHAT test entry.
- Do not add a Tauri window, formal menu, or keyboard shortcut.
- Do not enlarge the desktop window for the temporary UI. The temporary controls may
  expand their DOM hit area while open, and the hit area returns to the character-only
  geometry when closed.
- Keep the temporary UI visually disposable and independent from any future design
  system. Milestone 4.5 will replace it as a whole.

Implementation starts only after this document is reviewed and approved. This
milestone stops after its own verification and must not begin Milestone 4.5,
Milestone 5, or AI work.

## Goals

Milestone 4 must make the five interactions observable through the existing runtime
pipeline:

```text
pointer / temporary UI input
        ↓
PetInteractionEvent
        ↓
PetRuntime.handleInteraction()
        ↓
InteractionRules + session coordination
        ├─ local reaction / SpeechBubbleController
        ├─ independent visual effect layer
        └─ PetVitals mutation through its public API
        ↓
published runtime / service snapshots
        ↓
React rendering only
```

The implementation must keep immediate feedback and growth rewards separate:

```text
reaction cooldown      → limits speech/effect feedback frequency
stat reward cooldown   → limits mood/intimacy growth frequency
```

React may own presentation-only state such as whether the temporary chooser is
expanded or which temporary panel is visible. React must not directly change
`PetStats`, `PetVitals`, `PetState`, the speech bubble, or the desktop window position.

## Explicit non-goals

This milestone does not include:

- DeepSeek, OpenAI, any remote AI provider, or network requests;
- AI intent recognition, memory, personality, autonomous conversation, or TTS;
- SQLite, persistence, cloud sync, reminders, or offline interaction rewards;
- store, coins, inventory, purchases, or formal feeding systems;
- formal settings, formal Design System, formal interaction menu, or final chat UI;
- outfit, growth-stage, or relationship presentation UI;
- new PetState values for PET, POKE, FEED, CHAT, or DRAGGING;
- complex rubbing-path recognition, alpha-pixel hit testing, or a priority engine;
- a second pointer/event bus or a second speech-bubble implementation.

## Architecture extension

The existing M3.5 layers remain the source of truth:

```text
PetView
  └─ raw pointer samples + temporary UI events
       ↓
InteractionController
  └─ click / long-press / drag recognition
       ↓
PetInteractionEvent
       ↓
PetRuntime.handleInteraction()
  ├─ InteractionSession
  ├─ InteractionRules
  ├─ PetVitals
  ├─ PetStateMachine / forceWake()
  ├─ PetInteractionFeedback
  │    └─ LocalReactionRegistry + SpeechBubbleController
  ├─ PetEffectController
  └─ ChatService
       ↓
published snapshots
       ↓
PetView / TemporaryActionMenu / FeedChooser / ChatPanel
```

`PetRuntime` remains a coordinator, not a replacement for the domain modules. New
modules have one responsibility each:

| Module | Responsibility | Must not do |
| --- | --- | --- |
| `InteractionController` | Recognize pointer gestures and emit typed events | Mutate stats, state, bubbles, or Tauri windows |
| `InteractionRules` | Purely decide semantic interaction outcomes and deltas | Show UI, hold timers, or persist data |
| `InteractionBalanceConfig` | Centralize thresholds, cooldowns, streak windows, and deltas | Hide numeric literals in feature code |
| `FoodDefinition` catalog | Describe the three local test foods | Manage inventory or purchases |
| `PokeStreakTracker` | Track a bounded short POKE sequence | Mutate mood or show reactions |
| `InteractionRewardCooldown` | Rate-limit stat rewards independently from feedback | Rate-limit required wake or drag behavior |
| `PetEffectController` | Publish short-lived visual-effect snapshots | Change stats or state |
| `ChatService` | Own chat-shell lifecycle and provider seam | Interpret user intent or call a remote API |
| `TemporaryActionMenu` | Expose temporary FEED/CHAT test controls | Become a production UI or own business state |

## Event model

The existing `PetInteractionEvent` envelope remains the common input value object.
M4 extends its semantic type set only where the functional chat shell needs it, but
it removes the generic `payload?: Record<string, unknown>` escape hatch. Each event
has a required payload whose shape is tied to its discriminating `type`:

```ts
type PetInteractionSource = "pointer" | "keyboard" | "system" | "debug" | "ai";
type PetInteractionRegion = "CHARACTER" | "HEAD" | "BODY";

interface PetInteractionEventBase<TType, TPayload> {
  type: TType;
  timestamp: number;
  source: PetInteractionSource;
  payload: TPayload;
}

type PetInteractionEvent =
  | (PetInteractionEventBase<"CLICK", {
      region: PetInteractionRegion;
      pointerId: number;
      x: number;
      y: number;
      durationMs: number;
      movementPx: number;
    }> & { region: PetInteractionRegion })
  | (PetInteractionEventBase<"PET", {
      region: "HEAD";
      pointerId: number;
      x: number;
      y: number;
      holdDurationMs: number;
      repeatIndex: number;
    }> & { region: "HEAD" })
  | (PetInteractionEventBase<"POKE", {
      region: "HEAD" | "BODY";
    }> & { region: "HEAD" | "BODY" })
  | (PetInteractionEventBase<"DRAG_START", PointerDragPayload> & {
      region: PetInteractionRegion;
    })
  | (PetInteractionEventBase<"DRAG_MOVE", PointerDragPayload> & {
      region: PetInteractionRegion;
    })
  | (PetInteractionEventBase<"DRAG_END", PointerDragEndPayload> & {
      region: PetInteractionRegion;
    })
  | PetInteractionEventBase<"FEED", { foodId: string }>
  | PetInteractionEventBase<"CHAT_START", EmptyInteractionPayload>
  | PetInteractionEventBase<"CHAT_SEND", { message: string }>
  | PetInteractionEventBase<"CHAT_CLOSE", EmptyInteractionPayload>
  | PetInteractionEventBase<"WAKE", { reason: "user-interrupt" }>;

interface PointerDragPayload {
  pointerId: number;
  x: number;
  y: number;
  deltaX?: number;
  deltaY?: number;
}

interface PointerDragEndPayload extends PointerDragPayload {
  cancelled?: boolean;
}

interface EmptyInteractionPayload {
  readonly kind: "empty";
}
```

The exact implementation may use a mapped payload map, but narrowing by
`event.type` must narrow `event.payload` at compile time. Event factories validate
the corresponding payload and region; callers may not construct an unrelated
payload and cast it to the common event type.

Temporary React controls create events through the typed event factory or an injected
callback. They do not call `runtime.vitals`, `transitionTo`, `speechBubble.show`, or
`setPosition`.

## Pointer gesture recognition

`InteractionController` remains framework-independent. It continues to receive
normalized pointer samples from `PetView` and uses the existing centralized
`POINTER_DRAG_THRESHOLD_PX = 4` value.

The controller receives an injected clock and timer scheduler so long-press tests do
not rely on real time. Its session records pointer id, origin, last point, resolved
region, press timestamp, drag state, and whether PET has already fired.

Recognition rules:

1. Pointer-down outside the rendered character is ignored.
2. Pointer-down inside `HEAD` starts a hold timer using the configured PET threshold.
3. Movement below 4px keeps the gesture pending.
4. Movement at or beyond 4px cancels the hold timer, emits exactly one
   `DRAG_START`, and then emits `DRAG_MOVE` samples.
5. A `HEAD` press held for the configured threshold emits one `PET` event. While the
   pointer remains down, additional PET feedback events may be emitted at the
   configured repeat interval; this is event-level repetition, not per-animation
   frame repetition.
6. Pointer-up after PET ends the session without emitting `CLICK` or `DRAG_END`.
   PET is not a drag, so no drag event is manufactured.
7. Pointer-up before the hold threshold emits exactly one `CLICK` when movement stayed
   below 4px. The event includes duration so the runtime can apply the short-click
   rule without duplicating pointer recognition in React.
8. A body press never becomes PET. A body release becomes POKE only when the runtime
   receives a `CLICK` whose `durationMs` is strictly below the configured PET hold
   threshold. A body hold at or beyond that threshold remains a generic CLICK and
   does not become POKE or receive repeated PET events.
9. Pointer-cancel and blur clear timers and sessions without manufacturing a click.
   An active drag still emits one `DRAG_END` with `cancelled: true`, preserving M3.5.

The controller does not know about PetVitals, state transitions, speech, or CSS.

## Semantic interaction rules

`InteractionRules` is a side-effect-free module. It consumes an event, current
snapshot/context, and the centralized balance configuration, then returns a typed
decision such as:

```text
{ kind: "PET", feedback: "PET", moodDelta: 3, intimacyReward: 1 }
{ kind: "POKE", feedback: "POKE_HEAD", moodDelta: 0 }
{ kind: "POKE", feedback: "POKE_ANNOYED", moodDelta: -1 }
{ kind: "FEED", food, feedback: "FEED_LOVE", hungerDelta: 12, moodDelta: 3 }
{ kind: "CHAT_START", openChat: true }
```

The runtime is responsible for applying the decision, checking reward cooldowns,
publishing snapshots, and invoking effect/reaction services.

### PET

- A PET event may always produce immediate visual/line feedback when its reaction
  cooldown allows; feedback repetition is independent from stat rewards.
- `mood +3` is attempted through `PetVitals.applyDelta` only when the separate PET
  mood-reward cooldown allows it.
- `intimacy +1` is attempted through the vitals API only when the separate PET
  intimacy-reward cooldown allows it.
- Mood and intimacy reward ledgers are independent, so one reward being blocked does
  not implicitly block the other.
- Repeated hold PET events therefore remain visibly responsive without applying
  `mood +3` or `intimacy +1` on every repeat.

### POKE

- A short `CLICK` in `HEAD` becomes `POKE_HEAD`.
- A short `CLICK` in `BODY` becomes `POKE_BODY`.
- POKE never reduces intimacy.
- The first two POKEs in the configured streak window use ordinary feedback and no
  mood penalty.
- From the third POKE onward, the streak may produce `POKE_ANNOYED` and `mood -1`,
  but only if the independent POKE mood-effect cooldown allows it.
- The streak tracker resets after the configured window and does not create an
  unbounded negative counter.

### DRAG

- `DRAG_START` activates the interaction session, pauses autonomous movement, clears
  pending autonomous position writes, and calls the desktop adapter's native drag
  method.
- DRAG never changes hunger, mood, intimacy, or energy through an interaction rule.
- `DRAG_MOVE` is accepted while the drag session owns the interaction. No autonomous
  movement write may compete with it.
- `DRAG_END` clears the session, settles to `IDLE`, and refreshes movement context
  without immediately entering `WALKING`.
- If another event arrives while dragging, it is ignored except for the matching
  drag-end path.

### FEED

`FEED` carries a `foodId`, which is looked up in the immutable local test catalog.
Unknown ids are rejected without changing stats.

For a known food, first compare the current hunger with `fullThreshold`:

- if `hunger >= fullThreshold`, return only the `FULL` reaction/effect decision;
  do not increase hunger, mood, or intimacy, and do not run the normal food effect;
- otherwise, continue with the normal food rules below.

For a non-full pet:

- `hunger` applies the food's `hungerRestore` through `PetVitals.applyDelta` and is
  clamped to the existing maximum of 100;
- `mood` applies the food's configured `moodDelta` through the same API;
- LOVE and LIKE foods may grant `intimacy +1` only when the independent feed
  relationship reward cooldown allows it;
- NORMAL foods do not grant intimacy;
- DISLIKE foods do not reduce intimacy;
- `FULL` is the only full-hunger outcome, preventing repeated feeding at the cap from
  farming hunger, mood, or intimacy.

The three initial definitions are centralized and intentionally provisional:

| id | display | preference | hunger | mood |
| --- | --- | --- | ---: | ---: |
| `strawberry` | 草莓 / 🍓 | `LOVE` | +12 | +3 |
| `rice_ball` | 饭团 / 🍙 | `NORMAL` | +25 | +1 |
| `carrot` | 胡萝卜 / 🥕 | `DISLIKE` | +18 | -1 |

The catalog has no inventory, balance, purchase, or persistence concepts.

### CHAT

- `CHAT_START` first wakes a sleeping pet and settles a walking pet to `IDLE`, then
  asks `ChatService` to open the shell.
- `CHAT_SEND` is accepted only by the open chat service. It sends trimmed text to the
  local provider, stores the local response in the service snapshot, and presents the
  response through the shared `SpeechBubbleController`.
- `CHAT_CLOSE` closes the shell through the runtime/service boundary.
- CHAT changes no PetVitals value and does not grant intimacy.
- The local provider returns a deterministic placeholder response and performs no
  network request. The provider interface is the future replacement seam, not a
  present AI abstraction.

## Interaction state and conflict handling

Add a small `InteractionSession` owned by `PetRuntime`:

```ts
interface InteractionSessionSnapshot {
  activeInteraction: "PET" | "POKE" | "DRAG" | "FEED" | "CHAT" | null;
  startedAt: number | null;
}
```

This is not a PetState and is not rendered as a formal product status. It only
prevents obvious conflicts:

- DRAG owns the session until `DRAG_END`;
- FEED, PET, and POKE interrupt autonomous movement, settle WALKING to IDLE, then
  execute their rule;
- CHAT interrupts autonomous movement before opening;
- a second FEED/PET/POKE while a feed effect is active is allowed only according to
  its reaction/reward cooldown, but it does not run a competing movement loop;
- a temporary UI action cannot bypass the runtime session check.

Sleeping interactions use the existing `forceWake()` seam, not direct state writes:

- CLICK/POKE wakes first; the sleeping click path keeps the existing single WAKE
  reaction to avoid a double POKE + WAKE bubble;
- PET wakes first and then applies the PET rule;
- FEED wakes first and then applies the food rule;
- CHAT_START wakes first and then opens the local chat shell.

## Interaction balance and cooldowns

Create one centralized `InteractionBalanceConfig` (or equivalent configuration object)
for all M4 values. No interaction module may scatter `+3`, `800`, `5_000`, or similar
business numbers in its logic.

The initial configuration contains at least:

```ts
interface InteractionBalanceConfig {
  pet: {
    holdThresholdMs: number;       // approximately 520
    repeatIntervalMs: number;      // approximately 1_000
    moodDelta: number;             // +3
    intimacyDelta: number;         // +1
    reactionCooldownMs: number;    // approximately 800
    moodRewardCooldownMs: number;  // independent mood limit
    intimacyRewardCooldownMs: number; // approximately 10_000
  };
  poke: {
    reactionCooldownMs: number;
    streakWindowMs: number;        // approximately 5_000
    annoyedAfterCount: number;     // 3
    moodPenalty: number;            // -1
    statEffectCooldownMs: number;
  };
  feed: {
    reactionCooldownMs: number;
    intimacyRewardCooldownMs: number;
    fullThreshold: number;         // 95
  };
  chat: {
    localInteractionCooldownMs: number;
  };
  drag: {
    settleDelayMs: number;
  };
}
```

The existing `InteractionCooldownManager` remains dedicated to immediate reaction
feedback. Add a separate reward/effect cooldown ledger for stat rewards. The two
ledgers must have independent keys and timestamps:

- PET reaction cooldown does not block the rule from evaluating mood/intimacy rewards;
- PET mood reward cooldown blocks only the mood increment;
- PET intimacy reward cooldown blocks only the intimacy increment;
- FEED reaction cooldown does not block hunger/mood application;
- FEED intimacy cooldown blocks only the relationship increment;
- POKE annoyed mood cooldown prevents rapid mood collapse;
- cooldowns never block `forceWake()`, drag release, or chat close.

## Reactions and speech bubbles

Extend `LocalReactionRegistry` with deterministic local placeholder entries:

```text
PET
POKE_HEAD
POKE_BODY
POKE_ANNOYED
FEED_LOVE
FEED_NORMAL
FEED_DISLIKE
FULL
WAKE
```

The registry selects text only. It does not modify stats, start effects, or call AI.
`PetInteractionFeedback` decides whether an immediate reaction cooldown allows the
selected line, then uses the existing sole `SpeechBubbleController`.

Chat responses are dynamic provider text rather than registry keys, but they still
call the same `SpeechBubbleController.show()` entry point. No `PetBubble`,
`FeedBubble`, or `ChatBubble` controller/component is introduced.

The current hidden → showing → fading → hidden lifecycle remains unchanged. Feed,
PET, POKE, WAKE, and local chat response presentation all reuse it.

## Visual effect layer

Add a small non-business `PetEffectController` (or equivalent) that publishes
short-lived effect snapshots with a monotonically increasing effect id. It may expose
effects such as:

```text
PET       → small press/scale + heart
POKE      → quick horizontal shake + squash + 💢
FEED      → independent food symbol travelling toward the mouth
DRAG      → small lift/settle placeholder while the native drag owns the window
```

The controller has no PetState or PetVitals dependency. The view renders it as a
separate effect layer, so future `pet/`, `poke/`, and `eat/` frame sequences can
replace the placeholder presentation without changing rules or runtime event flow.

Food effects are triggered after a valid FEED event and use the selected definition's
asset/symbol. The effect may shrink and fade after reaching the mouth; numerical
changes happen at the deterministic FEED rule boundary, not at an animation frame.

## Animation presentation fallback

The existing `AnimationController` remains responsible only for frame playback.
Presentation code will derive whether a CSS placeholder motion is allowed from the
selected `AnimationDefinition`:

```text
frames.length > 1 → do not add the corresponding CSS fallback motion
frames.length = 1 → allow the configured placeholderMotion, if any
```

This prevents the six-frame idle manifest from receiving duplicate bobbing. It also
keeps the rule reusable when walk/sleep/pet/eat sequences are later added. PET, POKE,
and FEED effects remain independent from the base animation fallback decision.

## Temporary action UI

`TemporaryActionMenu` is a disposable React presentation component inside the current
transparent pet window:

- collapsed by default;
- visibly labelled `M4 TEMP` / `M4 PLACEHOLDER`;
- contains a tiny trigger and two temporary actions: `喂饭` and `聊天`;
- opens `FeedChooser` or `ChatPanel` in the same window;
- does not create a new Tauri window, tray entry, formal menu, or keyboard shortcut;
- does not enlarge the Tauri window;
- every menu, chooser, panel, button, bubble, and hit target is rendered inside the
  current Tauri window's physical viewport; no portal, popup, fixed-position element,
  or DOM hit target may extend outside that viewport;
- when a panel is open it occupies/overlays space inside the existing window and may
  temporarily cover part of the character; it must be clipped to the window bounds;
- uses simple component-local CSS only, with no future Design System primitives;
- can temporarily add its own DOM interactive region to cursor passthrough while open;
- returns passthrough geometry to the character-only region after close.

`FeedChooser` renders the three catalog entries and emits only a `FEED` event with
`foodId` when a choice is selected. `ChatPanel` emits `CHAT_START`, `CHAT_SEND`, and
`CHAT_CLOSE` events through its injected callback. It subscribes to `ChatService`
snapshots for the transcript/open state and keeps only input text as local
presentation state.

The exception is presentation-only menu state (`collapsed`, `activePanel`, and input
text). That state does not represent PetState, PetStats, interaction rewards, or
desktop position. All pet consequences still pass through `PetRuntime`.

Because the existing window stays compact, the menu must remain small. An opened
panel may occupy the window's internal space rather than expanding the desktop
window. Cursor passthrough receives the union of the rendered character region and
the currently visible, viewport-clamped temporary panel region; when the panel closes,
the provider returns only the rendered character region. Character geometry continues
to come from the actual rendered DOM rectangle. No interaction depends on DOM that is
outside the Tauri window.

## Chat service seam

Use a small provider interface:

```ts
interface ChatProvider {
  respond(message: string): Promise<string>;
}

interface ChatServiceSnapshot {
  isOpen: boolean;
  messages: readonly { role: "user" | "assistant"; text: string }[];
  pending: boolean;
  error: string | null;
}
```

`LocalPlaceholderChatProvider` implements `respond()` locally with the fixed or
deterministically selected placeholder response, for example:

```text
妈妈，我现在还在学习怎么和你聊天呢～
```

The service owns provider invocation and publishes snapshots. It does not update
PetVitals or PetState. A future provider can replace the local implementation without
requiring ChatPanel to be rewritten, while the formal AIProvider design remains out
of scope for M4.

## Geometry and platform boundary

Character `HEAD`/`BODY` regions continue to resolve from the actual rendered character
rectangle in `interactionGeometry`. The temporary menu contributes only its own
viewport-clamped DOM rectangle to the cursor-passthrough provider; it does not
introduce a second character hitbox. The root layout is clipped to the current
window's physical/logical viewport, and the menu never relies on an outside portal or
outside-window hit target.

Windows behavior remains behind `DesktopWindowManager`:

- native drag uses `startDragging()`;
- cursor passthrough uses the existing platform adapter;
- no new Windows-specific logic is added to rules, chat, food, or React business code.

The future macOS adapter can implement the same window operations without changing
the M4 interaction rules or services.

## Error handling

- Unknown food ids are ignored and surfaced as a temporary UI error or bubble only if
  the existing feedback path supports it; they must not mutate stats.
- Empty/whitespace chat messages are not sent.
- Local provider failures keep the panel open, publish `error`, and do not mutate pet
  stats or state.
- A rejected native drag preserves the current runtime error surface and clears the
  interaction session safely.
- A blocked cooldown is not an error; it may still allow the configured visual/reaction
  behavior when the rule distinguishes feedback from reward.
- All timer handles (PET hold/repeat, bubble, effect, chat pending if any) are
  disposed when their owning controller/runtime is disposed.

## Tests

Add focused tests while preserving all M3 regression tests.

### InteractionController

- short HEAD press emits one CLICK and no PET;
- a HEAD hold at the configured threshold emits PET;
- continued hold repeats PET at the configured interval, not per frame;
- release after PET emits no CLICK;
- body hold never emits PET or POKE;
- a body POKE is produced only when runtime accepts a CLICK with
  `durationMs < pet.holdThresholdMs`;
- exact 4px movement starts one drag;
- drag cancels PET and never emits CLICK;
- pointer cancel clears timers and does not create a click.

### InteractionRules / balance

- repeated PET feedback can repeat while mood and intimacy rewards are independently
  cooldown-gated;
- PET mood and intimacy reward cooldowns do not share an accidental timestamp;
- HEAD and BODY clicks resolve different POKE feedback keys;
- the third POKE in a 5-second session can become annoyed;
- POKE never changes intimacy;
- food definitions return the configured hunger/mood/preference behavior;
- hunger clamps at 100;
- full hunger produces only FULL reaction/effect and changes no hunger, mood, or
  intimacy;
- DISLIKE does not reduce intimacy;
- all decisions use centralized configuration.

### PetRuntime

- PET updates mood through the vitals API and publishes a snapshot;
- PET intimacy respects the independent reward cooldown;
- POKE reaction keys differ by region;
- repeated POKE cannot rapidly collapse mood;
- sleeping PET/FEED/CHAT wakes through `forceWake()`;
- walking PET/POKE/FEED/CHAT settles to IDLE before acting;
- FEED modifies only the configured hunger/mood/intimacy values;
- DRAG pauses movement and leaves stats unchanged;
- conflicting interaction events cannot compete with an active drag;
- CHAT events open/close/send through the service and leave stats unchanged.

### Services and presentation

- reaction cooldown and reward cooldown are independent;
- all reaction text uses the shared speech-bubble lifecycle;
- food effect is independent from the character PNG/frame animation;
- six-frame idle does not receive duplicate CSS idle motion;
- a one-frame animation can receive configured fallback motion;
- local chat provider returns a response without network access;
- temporary menu emits events and does not call business mutations directly;
- every temporary UI rectangle is inside the current Tauri window viewport;
- opening/closing the temporary panel changes passthrough regions without changing
  the character geometry.

## GUI verification

Run `pnpm tauri dev` and manually verify:

1. The six-frame idle loop plays without an extra strong idle bob.
2. The bubble is hidden on startup.
3. Holding the head for about half a second shows PET feedback and a heart effect.
4. Repeated holding gives visual feedback without rapidly increasing intimacy.
5. Short head and body clicks produce different POKE feedback.
6. Repeated POKE produces a mild annoyed feedback and no severe mood collapse.
7. Dragging pauses autonomous movement, changes no stats, and settles to stable IDLE.
8. The `M4 TEMP` entry opens the temporary chooser without a new window.
9. Strawberry, rice ball, and carrot change hunger and reactions according to their
   definitions.
10. Feeding at full hunger produces only FULL feedback/effect and changes no stats.
11. The temporary chat panel opens, accepts input, displays the local placeholder
    response, and shows it through the shared bubble.
12. Chat close works and no network request is made.
13. Sleeping pet wakes before PET/FEED/CHAT behavior.
14. Walking pet settles before PET/POKE/FEED/CHAT behavior.
15. Transparent space remains click-through; open temporary controls remain clickable;
    closing them restores the compact character-only hit range.
16. Existing walking, tray hide/recall, cursor passthrough, and `Ctrl+Alt+D` remain
    functional.

If GUI automation cannot reliably focus the transparent WebView, record the affected
items as manual verification rather than treating a successful build as visual proof.

## Verification commands

The implementation phase will run and repair any issues found by:

```text
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build
cargo fmt --check
cargo check
pnpm tauri build --no-bundle
pnpm tauri dev
```

The production bundle will also be checked to ensure no new formal UI or development
shortcut is introduced by the temporary interaction work.

## Approval gate

This document is the implementation contract for Milestone 4. After it is committed,
the user reviews the written design. Implementation begins only after explicit approval
and then stops after Milestone 4 verification.
