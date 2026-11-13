# @shortround/chat

## 0.6.0

### Major Changes

- First release. A chat over an app's catalog: its line runs a typed intention at once, and sends anything else to a
  model, which can run the app's intentions as tools. Built on the AI SDK (`ai` 7 and `@ai-sdk/react` 4, peers),
  with `@shortround/core` and `@shortround/react` `^0.6.0` as peers; the packages are released at one version.
- `<IntentionChat runtime transport />`: the chat, drawn through the theme's `Chat` slots (`CHAT_SLOT_NAMES`;
  `@shortround/mui`'s `muiTheme` has them). `useIntentionChat(options)` gives the same state for your own UI, and
  `makeIntentionChat(wiring)` builds a conversation your app holds itself, passed as `chat`.
- `@shortround/chat/server`, for your route, with no DOM and no React: `parseIntentionChatRequest`,
  `intentionModelMessages`, `intentionToolSet`, `intentionErrorText`, `intentionToolsSchema` and
  `INTENTION_CHAT_SYSTEM_PROMPT`. The tools come from the browser's runtime each turn, so they follow the app's state.
- Types: `ChatComponents`, `IntentionChatOptions`, `IntentionChatWiring`, `IntentionChatBody`,
  `SendAutomaticallyWhen`, `ToolRunState`, `IntentionChatRequest`.
- The theme needs a `Toast` for `ShortRoundProvider`, as before; a theme for a chat-only app passes
  `Toast: () => null`.
