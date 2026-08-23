# Desktop Pet Milestone 3 + Formal Character Display Design

## Scope and instruction separation

The pasted Milestone 3 document defines this iteration:

- hunger, mood, energy, and hidden intimacy, all bounded to 0..100.
- A reusable clock with MORNING, DAYTIME, EVENING, and LATE_NIGHT.
- Real elapsed-time progression and a pure offline calculator.
- The first energy-to-sleep and sleep-to-wake connection to PetStateMachine.
- A development-only debug overlay while preserving Ctrl+Alt+1/2/3.
- No AI, SQLite, feeding, food, store, inventory, coins, memory, relationship stages, formal UI, TTS, or Milestone 4 work.

The direct user request additionally requires:

- Copy IMG_0128.PNG into the default character asset directory without changing its bytes or source dimensions.
- Use it as the default frame for IDLE, WALKING, and SLEEPING until state-specific sequences arrive.
- Centralize defaultCharacterScale = 0.5.
- Scale rendering, window dimensions, collision/hit rectangles, and cursor passthrough geometry together.
- Preserve the future 1024x1200 PNG canvas and foot-center anchor contract.

No implementation begins until this design is reviewed and approved.

## Recommended architecture

Use pure core modules plus a small runtime coordinator:

1. PetStats/PetVitals owns snapshots and the only mutation API.
2. PetClock owns timestamps, elapsed duration, local hour, and TimePeriod.
3. OfflineProgressCalculator applies elapsed formulas without timers or per-second loops.
4. PetRuntime coordinates the existing state machine, animation, movement, clock, and vitals.
5. DevPetOverlay renders debug values only when import.meta.env.DEV is true.
6. CharacterDisplayConfig provides shared display metrics for React and the desktop adapter.

Putting all rules in PetRuntime would create a God Object. Putting time and vitals in React would make rendering frequency part of product balance. This split keeps rules deterministic and leaves M5 a clean persistence seam.

## Stats model

PetStatsSnapshot contains hunger, mood, energy, and intimacy numbers. The core API provides snapshot(), setStat(), applyDelta(), and clampStats(). Every write clamps to 0..100; callers never mutate fields directly. Invalid or non-finite deltas are treated as zero. Published snapshots are copied.

PetVitals.advance(elapsedMs, context) accepts IDLE, WALKING, or SLEEPING:

- Hunger decreases with real elapsed time.
- Energy decreases while walking and recovers while sleeping.
- Mood has no ordinary time decay in this milestone.
- Intimacy never changes because of time, including offline time.

## Balance configuration

All rates and thresholds are held in one PetBalanceConfig object:

- initialStats: hunger 82, mood 85, energy 78, intimacy 60
- hungerDecayPerHour: 4
- activeEnergyDecayPerHour: 12
- sleepEnergyRecoveryPerHour: 20
- offlineHungerFloor: 20
- offlineEnergyFloor: 25
- sleepThreshold: 25
- wakeThreshold: 70
- vitalsTickMs: 1000

These are test-friendly starting values, not final game balance. The hunger and energy floors prevent prolonged absence from becoming a punishment system. Mood and intimacy are unchanged by elapsed time.

## Time system

PetClock accepts an injected now(): number function for deterministic tests. It exposes the current timestamp, elapsed milliseconds, local hour, and TimePeriod.

Period boundaries are half-open:

- MORNING: 06:00 <= hour < 10:00
- DAYTIME: 10:00 <= hour < 18:00
- EVENING: 18:00 <= hour < 23:00
- LATE_NIGHT: 23:00 <= hour or hour < 06:00

If the system clock moves backwards, elapsed time is zero and the new timestamp becomes the next baseline. A large positive elapsed duration is passed to a formula directly.

The animation requestAnimationFrame loop may sample the clock, but vitals are accumulated and applied at vitalsTickMs granularity. Product values therefore depend on real elapsed time, not animation FPS.

## Offline progress

calculateOfflineProgress(previousStats, elapsedMs, context, config) is a pure function. It performs no database or filesystem work and does not iterate once per second.

Rules:

- Clamp negative or non-finite elapsed time to zero.
- Apply hunger decay using elapsed hours, then clamp at offlineHungerFloor.
- Apply energy decay or recovery from the activity context, respecting offlineEnergyFloor for active decay.
- Keep mood unchanged.
- Keep intimacy unchanged.
- Clamp the final snapshot.

Milestone 3 does not create ad-hoc persistence. M5 can pass a saved timestamp and activity context directly to this calculator when SQLite is introduced.

## State machine integration

Add vitals and user-interrupt as transition reasons while keeping the existing states and debug shortcuts. Reserve a public PetRuntime.forceWake() method for user interruption; the current sleeping click will use it, and future AI/dialogue interactions can call the same method.

During a normal vitals tick:

- If energy <= sleepThreshold, no drag/interaction is active, and state is IDLE or WALKING, request SLEEPING.
- Sleeping applies recovery. A sleep session entered below wakeThreshold is armed to wake at wakeThreshold.
- A manually forced debug sleep entered with high energy remains available for visual testing and does not immediately auto-wake.
- Clicking a sleeping character calls forceWake() and requests the normal SLEEPING -> IDLE user-interrupt transition.
- Energy never automatically starts WALKING. M3 removes the old fixed IDLE -> WALKING test timer; WALKING remains reachable through Ctrl+Alt+2 and future explicit activity/AI behavior.
- Hunger never changes the state in this milestone.

The shortcut module remains removable. It calls PetRuntime.transitionTo(), which delegates to PetStateMachine, and never writes React state or stat fields.

## Formal character asset and display metrics

The supplied image is copied byte-for-byte to src/assets/characters/default/idle/default_idle.png. The manifest references it for the three current animations and records the shared source-canvas contract for future 1024x1200 sequences. Future assets can use the clearer structure default/idle, default/walk, and default/sleep without a generic character.png name.

Centralized display inputs:

- defaultCharacterScale = 0.5
- referenceCharacterSize = 238x300 logical pixels
- referenceWindowSize = 360x420 logical pixels
- minimumScaledWindowSize = 260x300 logical pixels

Derived defaults are approximately:

- character layout: 119x150 logical pixels;
- window bootstrap/layout: 260x300 logical pixels, allowing speech, effects, controls, and future outfit affordances;
- character and control hitboxes: actual rendered DOM rectangles;
- cursor passthrough: those rectangles converted by the platform adapter.

The raw PNG remains high-resolution. Layout width controls display size; object-fit contain and the shared canvas contract preserve frame alignment. Transparent padding remains part of the canvas and does not change the foot-center anchor.

The Tauri static window size is changed to 260x300, and the frontend applies the same metrics at runtime. The window is smaller than the original 360x420 but is not reduced mechanically to half, avoiding a cramped speech/control area.

Sleeping does not disable interaction. The character hitbox remains present in every state, the sleeping CSS animation does not set pointer-events to none, and the platform cursor passthrough controller continues to include the character rectangle while SLEEPING.

## Speech bubble controller

Speech behavior is moved behind a dedicated SpeechBubbleController rather than being managed independently by each click handler or future AI feature. It owns the states hidden, showing, and fading, and exposes show(message, duration), hide(), snapshot(), and subscription methods.

- Default state is hidden; the existing always-visible idle bubble is removed.
- A local click calls show() for 3 to 5 seconds, then transitions through fading to hidden.
- Future AI dialogue calls the same show() API.
- Timers live inside the controller, not inside PetView. The controller accepts an injected scheduler for deterministic tests.

## Deferred hide entry

Milestone 3 keeps tray-only hide and recall. It does not add a character interaction menu, settings panel, or formal close/hide button. Those entry points are recorded for M4/M4.5 UI work and are intentionally not implemented here.

## Development overlay

DevPetOverlay is a small pointer-transparent layer shown only in development. It displays state, hunger, mood, energy, intimacy, and TimePeriod. It has no formal controls and is removed by the Vite production branch. The existing Ctrl+Alt+1/2/3 shortcuts remain the state test controls.

## Error handling

- Stats and offline calculations always return bounded values.
- Clock anomalies do not create negative progression.
- Platform resize/position errors use the existing lightweight runtime error path.
- Missing frames use the existing idle-resource fallback.
- Large elapsed durations are calculated in constant time.

## Verification plan

Add tests for stats clamp, hunger decay, active energy decay, sleeping recovery, stable mood, stable intimacy, offline 30 minutes/8 hours/24 hours/7 days, hunger protection floor, sleep and wake thresholds, no automatic WALKING from energy, forceWake/user-interrupt behavior, all time periods and boundaries, constant-time large elapsed duration, derived 0.5 display metrics/hitbox geometry, speech bubble lifecycle, and sleeping hitbox availability.

Run tsc, Vitest, Vite build, cargo fmt --check, cargo check, Tauri build, and Tauri dev. GUI verification checks the debug overlay, hunger/energy changes, sleep recovery, shortcuts, walking movement, dragging, click-through, and tray hide/show. Stop after Milestone 3.
