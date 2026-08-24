# Milestone 6 — AI Provider & DeepSeek Integration Design

Date: 2026-08-24  
Status: awaiting user review; implementation has not started

## Scope

Milestone 6 adds the first real remote AI provider to the existing desktop pet
without changing the pet's core life loop:

- one production remote provider: DeepSeek;
- one local fallback: `LocalPlaceholderChatProvider`;
- a provider abstraction that can later support another provider, streaming,
  or thinking mode without changing `ChatPanel` or `ChatService` boundaries;
- secure Windows API-key storage behind a Rust/Tauri command boundary;
- short current-session context for multi-turn chat;
- complete AI responses in `ChatPanel` and a short presentation through the
  existing `SpeechBubbleController`;
- typed provider/application errors, timeout, cancellation, and stale-response
  protection;
- Settings controls for save, delete, and test connection.

This milestone stops at a reliable text-only chat integration. It does not
enter Milestone 7.

## Explicit non-goals

The following are deliberately excluded:

- provider marketplace, provider discovery, or model selector;
- multiple remote providers, model routing, fallback ensembles, load
  balancing, or an agent framework;
- DeepSeek tools, function calling, file access, shell commands, system
  control, screen reading, or application awareness;
- streaming UI in this milestone;
- long-term memory, SQLite chat transcript persistence, mother profile,
  relationship history, personality growth, growth diary, or hidden stat
  values in prompts;
- proactive AI, reminders, TTS, coins, shop, inventory, wardrobe, cloud sync,
  or onboarding redesign;
- AI-controlled changes to `hunger`, `mood`, `energy`, or `intimacy`;
- updater signing-key UI or any change to the M5.5 updater trust boundary.

## Official DeepSeek API contract

The implementation uses the current official OpenAI-compatible DeepSeek API,
not the retired model names or an endpoint inferred from older examples.

| Item | M6 decision |
| --- | --- |
| Base URL | `https://api.deepseek.com` |
| Endpoint | `POST /chat/completions` |
| Authentication | `Authorization: Bearer <API key>` |
| Model | `deepseek-v4-flash` |
| Thinking | Explicitly send `{ "type": "disabled" }` |
| Streaming | Explicitly send `false` |
| Timeout | 45 seconds, centralized in provider configuration |
| Output limit | 512 tokens, centralized and not exposed in Settings |

The request body is OpenAI-compatible and contains `model`, `messages`,
`thinking`, `stream`, and the centralized output limit. M6 uses complete
responses. The provider interface carries a cancellation signal so a future
streaming implementation can be added without making `ChatService` depend on
DeepSeek-specific transport details.

DeepSeek's current documentation lists `deepseek-v4-flash` and
`deepseek-v4-pro` as supported model identifiers and shows the base URL and
chat-completion endpoint. The selected Flash model is an engineering choice
for the product's frequent, short, cost-sensitive companion messages; it is
not exposed as a user setting. See the [official chat completion
documentation](https://api-docs.deepseek.com/api/create-chat-completion), the
[official model and pricing documentation](https://api-docs.deepseek.com/quick_start/pricing),
and the [official model list](https://api-docs.deepseek.com/api/list-models/).

The legacy identifiers `deepseek-chat` and `deepseek-reasoner` are forbidden in
M6 runtime source, configuration, tests, and release artifacts. They appear in
this design document only to make that prohibition explicit. The implementation
also maps DeepSeek's documented 400,
401, 402, 422, 429, 500, and 503 responses into typed provider categories
instead of exposing raw response bodies. See the [official error-code
documentation](https://api-docs.deepseek.com/quick_start/error_codes/).

## Architecture decision

### Recommended approach: Rust backend transport plus OS credential store

The production path is:

```text
React Settings / ChatPanel
        ↓ typed application callbacks / CHAT_SEND
PetRuntime / AIConfigurationService / ChatService
        ↓ typed Tauri commands; no raw-key read command
Rust AI command layer
        ↓
SecureCredentialStore → Windows Credential Manager
        ↓
Rust DeepSeek client → HTTPS → api.deepseek.com/chat/completions
```

The TypeScript `DeepSeekChatProvider` is only a typed Tauri adapter. It does
not use `fetch`, import a DeepSeek SDK, read an API key, or own HTTP headers.
The actual backend provider owns request serialization, authorization, timeout,
response validation, and error mapping.

The secure-store trait is platform-shaped so macOS can later provide a Keychain
adapter without changing the application layer:

```text
SecureCredentialStore
  saveApiKey(provider, secret)
  hasApiKey(provider)
  deleteApiKey(provider)
  getApiKeyForBackendUse(provider)  // internal backend use only
```

The raw-key method is not exposed as a Tauri command. The frontend can ask only
whether a provider is configured. The Rust backend obtains the secret for a
single test or chat request, keeps it in a scoped secret wrapper, avoids
serialization/debug output for that value, and drops it after the request. It
never returns the secret to React.

### Rejected alternatives

1. **Frontend `fetch` with a returned key** — rejected because it requires the
   raw API key to remain in browser/React memory and makes request logging and
   accidental persistence easier.
2. **A separate local AI sidecar/service** — rejected for M6 because it adds
   process lifecycle, packaging, IPC, and another secret boundary without
   helping the single-provider MVP.
3. **Provider-specific logic in `ChatService` or `ChatPanel`** — rejected
   because it would make provider replacement and mock testing cross-cut the
   application/UI layers.

## Provider configuration

All DeepSeek transport choices live in one provider configuration module on
the Rust/backend side. The frontend may receive safe display metadata such as
`provider: "deepseek"` and `configured: true`, but never transport secrets or
request headers.

The configuration owns:

- provider identifier;
- base URL;
- chat path;
- model identifier;
- explicit thinking payload;
- explicit `stream: false` for M6;
- request timeout;
- output-token limit;
- the short system-instruction and recent-context limits used by the request
  builder.

There is exactly one default configuration in M6. No model selector is added.
Future Pro, streaming, thinking, or another provider can add a configuration
and provider implementation behind the same abstraction.

## Secure credential boundary

### Storage

Use a maintained OS credential/keyring abstraction with a Windows Credential
Manager backend. The application-level namespace is stable and provider-scoped
so it does not depend on the current executable path or installer location.
The logical entry is the DeepSeek API key for application id
`com.momdaughter.desktop`.

The key is never stored in:

- `pet.db` or any SQLite table;
- `localStorage`, `sessionStorage`, React state after save, or ordinary JSON;
- `.ts`, `.env`, source fixtures, logs, crash reports, URLs, analytics, or
  release artifacts;
- updater signing configuration or updater private-key material.

The Rust command accepts the key only for the save operation. On successful
save, the Settings input is cleared immediately. A temporary show/hide toggle
is permitted before save; after save the UI displays only `已配置`.

### Tauri commands

The command DTOs are typed and provider-scoped. The planned command surface is:

- `ai_get_configuration_status` → safe configured/status snapshot;
- `ai_save_api_key` → accepts a transient secret and returns only success or a
  sanitized error;
- `ai_delete_api_key` → deletes the provider key;
- `ai_test_connection` → Rust retrieves the key internally and performs the
  minimal explicit validation request;
- `ai_chat_completion` → Rust retrieves the key internally and sends a typed
  chat request.

There is no `get_api_key` command. Error conversion removes authorization
headers, secret values, raw request bodies, and provider response bodies from
all user-facing errors and default logs.

### Test connection

The Settings `测试连接` action is explicit only; it is never run at startup.
It uses the same configured endpoint/model/authentication path as chat, with a
minimal non-streaming completion request and a very small output limit. The
result is normalized to:

- `success`;
- `authentication failure`;
- `network failure`;
- `timeout`;
- `rate limit`;
- `provider error`;
- `invalid response`.

The frontend receives a safe status and friendly message, not raw DeepSeek
JSON or stack traces.

## Provider and application abstractions

### `ChatProvider`

The existing `ChatProvider` seam remains the application-facing abstraction.
It evolves from a string-only method to a typed request/response boundary that
can carry recent session context and an abort signal:

```text
ChatProvider.respond(request, { signal }) → Promise<ChatProviderResponse>
```

`LocalPlaceholderChatProvider` remains available for unit tests and explicit
no-key/dev fallback behavior. Its no-key result is typed as `NOT_CONFIGURED` so
the UI explains how to configure AI instead of pretending that a remote reply
was received. Tests can still inject a deterministic mock provider for success,
delay, timeout, rate-limit, and malformed-response cases.

`TauriDeepSeekChatProvider` calls only the typed `ai_chat_completion` command.
The Rust `DeepSeekClient` is responsible for the actual provider protocol.

### `AIConfigurationService`

This lightweight application service owns configured-provider status and the
save/delete/test-connection operations. Settings receives callbacks and
snapshots from this service; it does not import secure storage, Tauri command
details, or a provider implementation.

`ConfiguredChatProvider` resolves the active provider at request time from the
safe configuration status:

- configured DeepSeek key → `TauriDeepSeekChatProvider`;
- no DeepSeek key → `LocalPlaceholderChatProvider` with typed
  `NOT_CONFIGURED` behavior.

After save or delete, the service refreshes the safe status. No raw key is
read back to confirm configuration.

## Conversation context

Add a pure `ConversationContextBuilder` module. It creates the provider
request from:

1. one fixed, short system instruction;
2. the current user message;
3. at most the most recent eight current-session messages, bounded by a
   centralized character budget of 4,000 characters.

The system instruction establishes only the M6 conversational frame:

- speak as a desktop companion;
- call the user `妈妈` when natural;
- use warm, concise Chinese or English matching the user;
- prefer one to three natural sentences for ordinary chat;
- do not act like a generic assistant that always produces lists;
- do not claim long-term memories that do not exist.

The builder never includes SQLite data, Windows username or paths, window
coordinates, updater keys, API keys, tray state, full pet stats, or hidden
`intimacy` values. It never persists a transcript. Closing the app or ChatPanel
discards the current session as in the existing M5 behavior.

The context builder is the only place that decides how much session history is
sent. It preserves the provider abstraction and prevents an unbounded
transcript from being sent on every message.

## ChatService lifecycle

`ChatService` remains the owner of the current chat snapshot and is still
reached through `PetRuntime`. `ChatPanel` continues to emit only
`CHAT_SEND`; it does not import a provider, call Tauri, read a key, or modify
pet stats/state.

The snapshot keeps `pending` and `error` compatibility and adds a small typed
request status:

```text
idle | sending | response-received | cancelled | error
```

Behavior:

- empty messages are ignored;
- one request at a time is allowed;
- Send is disabled while `sending`;
- `CHAT_SEND` is the only normal action that starts a remote request;
- no startup, idle, PET, POKE, FEED, WALKING, or reminder path calls DeepSeek;
- `AbortController` is used when the backend adapter supports cancellation;
- `close()` and `dispose()` cancel/retire the request and clear the current
  session as appropriate;
- a monotonically increasing generation id ignores a late response from a
  closed/replaced session;
- no automatic retry loop is added; the user can retry after a transient
  error;
- a successful response is appended exactly once to the current transcript;
- failures do not append fabricated assistant text.

The `PetRuntime` flow remains:

```text
CHAT_SEND
  → PetRuntime.handleInteraction()
  → ChatService.send()
  → ConfiguredChatProvider
  → DeepSeek or LocalPlaceholder
  → ChatService snapshot
  → ChatPanel transcript
```

AI output never invokes `InteractionRules`, never changes `PetStats`, and
never directly changes `PetState`. `PetRuntime` may pass a successful response
to the existing `SpeechBubbleController`, but it does not create a second AI
bubble system.

## DeepSeek request and response handling

The Rust client builds a request with:

- `Content-Type: application/json`;
- `Authorization: Bearer …` created only in the Rust request boundary;
- centralized model, thinking, stream, timeout, and output limit;
- system, recent session, and current user messages from the typed request.

The client validates:

- HTTP success status;
- JSON object shape;
- a non-empty `choices` array;
- `choices[0].message.content` is a string;
- trimmed content is non-empty.

Anything else becomes `INVALID_RESPONSE` or `EMPTY_RESPONSE`. The raw body
is not shown to the user and is not logged in production.

The client maps at least these categories:

| Category | Examples | User-facing meaning |
| --- | --- | --- |
| `NOT_CONFIGURED` | no stored key | 还没有配置 AI 服务哦～ |
| `AUTHENTICATION` | HTTP 401 | API Key 好像不对 |
| `NETWORK` | DNS/connectivity failure | 现在网络连不上 |
| `TIMEOUT` | 45-second deadline | 回复等太久了，再试一次吧 |
| `RATE_LIMIT` | HTTP 429 | 请求太频繁了，稍后再试 |
| `PROVIDER_ERROR` | HTTP 400/402/422/500/503 | AI 服务暂时不可用 |
| `INVALID_RESPONSE` | malformed/missing response fields | AI 回复格式异常，请再试一次 |
| `EMPTY_RESPONSE` | empty content | 没有收到有效回复，请再试一次 |
| `CANCELLED` | close/dispose/abort | request is silently retired |

Development diagnostics may record provider name, latency, HTTP status, and
error category. They must never record the Authorization header, raw key,
complete prompt, complete response, or raw provider error body. Production
logs contain no AI secret material and avoid persistent private conversation
transcripts.

## Speech bubble presentation

The complete assistant text remains in the ChatPanel transcript. A shared pure
formatter produces a desktop-sized bubble string:

- trim whitespace;
- prefer the first sentence or natural punctuation boundary;
- enforce a centralized maximum display length of 72 Unicode code points;
- append an ellipsis only when truncation is necessary.

The formatter is presentation-only. It does not change the transcript or send
another provider request. `PetRuntime` sends the formatted text to the
existing `SpeechBubbleController`, so local reactions and AI replies share one
bubble lifecycle.

## Settings presentation

The existing compact M5.5 Settings panel gains a small AI section using the
current M4.5 design system. It shows only:

- `AI 服务：DeepSeek`;
- `已配置` or `未配置`;
- password input for a new key;
- temporary show/hide control before save;
- `保存`, `删除`, and `测试连接` actions;
- a friendly status such as `验证中…`, `可用`, `连接失败`, or `API Key 好像不对`.

It does not show or allow editing of model, Flash/Pro, thinking,
`reasoning_effort`, stream mode, endpoint, timeout, raw HTTP status, or updater
signing settings.

On successful save:

1. the input's React value is set to an empty string;
2. only `已配置` is displayed;
3. the full key is not fetched back or echoed;
4. no console or error-report logging includes the key.

The first unconfigured ChatPanel state remains usable as a panel. On send it
shows `还没有配置 AI 服务哦～` and a `去设置` action. The navigation callback
only changes the current major-panel presentation through the existing panel
coordinator; it does not bypass `PetRuntime` or mutate business state.

## Security and release boundary

M6 must preserve the M5.5 updater boundary:

- DeepSeek API keys and updater signing keys use separate namespaces and
  separate code paths;
- no updater private key is displayed in Settings;
- release checks scan tracked files and production artifacts for obvious key
  material without printing secret contents;
- no API key is placed in Vite environment variables for production;
- `pnpm release:check` runs after the AI changes and before a bundled release;
- the final frontend bundle contains only safe provider metadata, never a
  key, Authorization header, or secret fixture.

No schema migration is planned for `pet.db`. A regression test will assert
that the persisted schema and serialized pet state contain no API-key or
secret field.

## Test design

### TypeScript unit coverage

- provider configuration contains the approved base URL, endpoint, model,
  explicit disabled thinking, `stream: false`, timeout, and no legacy model
  names;
- `ConversationContextBuilder` includes system/current/recent messages,
  trims old messages at the limit, and excludes SQLite/stat/secret data;
- `LocalPlaceholderChatProvider` produces typed `NOT_CONFIGURED` behavior;
- configured provider resolution chooses DeepSeek only when the safe status is
  configured and otherwise chooses local fallback;
- ChatService appends a successful response and preserves full transcript;
- duplicate Send is blocked while pending;
- missing-key guidance is surfaced without a network call;
- response, authentication, network, timeout, rate-limit, provider, invalid,
  empty, cancelled, and stale-response cases are normalized;
- close/dispose cancels or retires pending work and late responses cannot
  overwrite a new session;
- AI responses do not change `hunger`, `mood`, `energy`, `intimacy`, or pet
  state;
- bubble text formatting keeps short replies and truncates long replies in a
  centralized rule;
- Settings save clears the input, delete returns to unconfigured, status never
  exposes raw key, and test connection has explicit-only behavior.

### Rust unit coverage

- mock secure store save/has/delete behavior;
- no raw-key Tauri read command exists;
- DeepSeek request serialization includes the required explicit fields;
- response parsing rejects malformed, missing, non-string, and empty content;
- HTTP status mapping covers official error categories;
- timeout/cancellation returns typed errors without secret content;
- a persisted pet-state/schema regression confirms no API-key column or value;
- M5.5 updater and persistence tests remain green.

No test invokes the real DeepSeek API by default. An opt-in integration command
may run only when the user explicitly supplies a development test key through
the environment or another non-repository mechanism; it must never be part of
`pnpm test` and must not print the key.

## Manual verification plan

After implementation, Windows verification will cover:

1. no key: the pet still supports IDLE, WALKING, SLEEPING, PET, POKE, FEED,
   drag, SQLite persistence, hide/tray, and updater Settings;
2. Chat opens and shows the unconfigured guidance with `去设置`;
3. Settings accepts a password input, saves it, clears the input, and shows
   only `已配置`;
4. restarting the app still reports configured from Windows Credential
   Manager;
5. the key is absent from `pet.db`, frontend storage, logs, source, `dist`,
   `target`, and release artifacts;
6. explicit `测试连接` reports success or a friendly normalized failure;
7. an explicit chat sends one complete DeepSeek response using the approved
   model and displays it in ChatPanel plus the existing speech bubble;
8. pending state disables repeat Send;
9. offline, timeout, authentication, rate-limit, malformed-response, and
   recovery behavior is user-readable;
10. delete returns Chat to unconfigured guidance;
11. closing ChatPanel/app retires the request and a stale response cannot
    mutate a new session;
12. updater Settings, install/update data preservation, hide/tray, and
    walking behavior have no regression.

Required command checks remain:

```text
pnpm exec tsc --noEmit
pnpm test
pnpm exec vite build
cargo fmt --check
cargo check
cargo test
pnpm version:check
pnpm release:check
pnpm tauri build --no-bundle
```

If Tauri capabilities or production configuration change, also run the full
bundled `pnpm tauri build` and inspect the generated Windows installer and
updater artifacts.

## Planned implementation boundaries

The implementation should remain focused in these areas:

- `src/features/pet/chat/`: typed provider request/result/error contracts,
  provider resolver, context builder, ChatService lifecycle, and bubble text
  formatter;
- `src/platform/ai/`: typed frontend application adapter for AI configuration
  and Tauri commands;
- `src/ui/chat/` and `src/ui/pet/SettingsPanel.tsx`: presentation-only props,
  status, input clearing, and navigation callback;
- `src/features/pet/PetRuntime.ts`: configured service injection, ChatService
  response-to-bubble handoff, and no-stat-change guarantee;
- `src-tauri/src/ai/`: secure credential trait/backend, DeepSeek HTTP client,
  typed Tauri commands, sanitized error mapping, and Rust tests;
- `src-tauri/capabilities/default.json`: only the minimum command/plugin
  capability changes required by the implementation;
- `scripts/check-release-safety.mjs` and tests: secret/schema regression
  checks without secret output;
- `docs/` release/security notes as needed.

No unrelated refactor of the interaction, movement, window, persistence, or
updater systems is part of M6.

## Approval gate

This document deliberately stops before implementation. After review approval,
the next step is an implementation plan followed by M6 code changes. The
implementation must stop after M6 verification and must not begin Milestone 7.
