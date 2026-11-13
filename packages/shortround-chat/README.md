# @shortround/chat

A chat for an app with a ShortRound catalog. The user types into one line: a line that reads as one of the app's
intentions runs at once, with no model call, and anything else goes to a model through the
[AI SDK](https://ai-sdk.dev). The model can run the app's intentions too, as tools. Every request offers every
intention; one that isn't available at that moment says so in its description, and the app refuses it if the model
calls it anyway. (A list that changes between a call and the reply made some models doubt the app's answer.)

It is built on `@shortround/core`'s catalog runtime and chat line, and `@shortround/react`'s provider and
`LineInput`. The transport, the route, the model and the provider are yours.

## Installation

```bash
npm install @shortround/chat @shortround/core @shortround/react ai @ai-sdk/react
```

Peers: `react` and `react-dom` 18 or 19, `@shortround/core` and `@shortround/react` at the same version, `ai` 7 and
`@ai-sdk/react` 4. The chat renders assistant text as Markdown with `react-markdown` and `remark-gfm`, which come with
it. It draws through your theme's `Chat` slots: `@shortround/mui`'s `muiTheme` has them (see [The `Chat`
slots](#the-chat-slots)).

## In the browser

Build one runtime from your catalog, and give it and your transport to `IntentionChat`, under a `ShortRoundProvider`
whose theme has the `Chat` slots:

```jsx
import { buildCatalogRuntime, loadCatalog } from '@shortround/core';
import { IntentionChat } from '@shortround/chat';
import { muiTheme } from '@shortround/mui';
import { ShortRoundProvider } from '@shortround/react';
import { DefaultChatTransport } from 'ai';

const runtime = buildCatalogRuntime(loadCatalog(CATALOG_TEXT, bindings)); // once
const transport = new DefaultChatTransport({ api: '/api/chat' });

<ShortRoundProvider theme={muiTheme}>
  <IntentionChat runtime={runtime} transport={transport} body={() => ({ model: chosenModel })} />
</ShortRoundProvider>;
```

- **`body`** is sent with every request besides the messages and the tools: an object, or a function called for each
  request (here, the model the user chose).
- **Call `runtime.notify()`** when your app's state changes outside the chat. The chat's line and the tools follow it.
  If the app also has a palette, build it over the same runtime (`buildPalette(runtime, …)`) and call `notify()` once.
- **The chat can have its own catalog.** To offer the chat fewer intentions than the palette (or different ones),
  build a second runtime from a catalog written for the chat, over the same bindings, and give that one to
  `IntentionChat`. Each runtime needs its own `notify()` when your app's state changes.
- **`showHintForMissing`** (default `true`): a row says what a command is missing, such as a value your app holds none
  of right now ("Missing result") or the word a hint waits for ("Missing sort"). Turned off, those rows are hidden.
- **`placeholder`**: what the empty input says. By default, "Type a command (↓ or help lists them), or Cmd/Ctrl+Enter
  to chat".
- **`sendAutomaticallyWhen`**: when the chat sends again by itself after the model's tool calls. By default, once every
  call has its answer (the AI SDK's `lastAssistantMessageIsCompleteWithToolCalls`). Give your own to cap a turn, for
  example after so many tool calls since the user's last message.
- The chat draws inside the box you give it: a drawer, a rail, a modal. With `muiTheme` it fills that box; a theme of
  your own gets that from its `Frame` slot.
- A new `runtime`, `transport` or `body` is followed by the next request. A new `runtime` or `showHintForMissing`
  starts a new, empty line, dropping what was being typed.
- An app call that fails while the model runs it goes back to the model as an error (and is logged), so the
  conversation goes on.

### Holding the conversation yourself: `makeIntentionChat`

`IntentionChat` given a `runtime` and a `transport` makes the conversation itself and drops it when it unmounts. To
keep it yourself (start from saved messages, send messages from code outside React, empty it, keep one per
workspace), make it with `makeIntentionChat` and give the chat to `IntentionChat`.

Make each workspace's chat as soon as the workspace opens, with the messages you have (perhaps none), and fill in the
saved ones when they arrive. `chat` is then never missing, so `IntentionChat` mounts once and stays mounted, with no
loading flicker; switching workspace passes another chat, which it draws at once without remounting.

```js
import { IntentionChat, makeIntentionChat } from '@shortround/chat';

// In your store, outside React: one chat per workspace, made when the workspace opens.
function openWorkspace(workspaceId) {
  const chat = makeIntentionChat({ runtime, transport, body, id: workspaceId });
  loadSavedMessages(workspaceId).then((saved) => {
    chat.messages = [...saved, ...chat.messages]; // keep what the user ran while it loaded
  });
  return chat;
}

<IntentionChat chat={store.chat} />;
```

Merge when you fill it: assigning `chat.messages = saved` alone would drop an intention the user typed while the saved
messages loaded. If you'd rather not show the chat until it is filled, render it only once it exists
(`{store.chat && <IntentionChat chat={store.chat} />}`); `chat={undefined}` throws, naming what to pass.

`makeIntentionChat` returns the AI SDK's `Chat`, already wired to your runtime: the model's tool calls run in your app,
each request carries every intention as a tool (the ones not available at that moment marked so), plus `body`, and
it continues after tool calls while `sendAutomaticallyWhen` says so. It needs `runtime` and `transport`, and throws
without them. Its other options (`id`, `messages`, `onFinish`, `onError`, `generateId`, `messageMetadataSchema`, …)
are the AI SDK's `Chat` options; a typed intention's message takes its id from `generateId` too. `onToolCall` is the
package's, and passing one throws. Use the AI SDK's own API on it:
`chat.sendMessage({ text, metadata: { source: 'app' } })`, `chat.status`, `chat.messages`, and `chat.messages = []` to
empty it. Hold it in your own store; `IntentionChat` and `useIntentionChat` don't stop it when
they unmount.

Give `chat` alone: it already has its runtime, transport and body, so passing any of those (or
`sendAutomaticallyWhen`) beside it throws, and so does a chat `makeIntentionChat` didn't make.

**If your server keeps the conversation** and your transport sends only what is new
(`prepareSendMessagesRequest`), send every message from the last assistant message on, not only the newest: a typed
intention is a message of its own that no request carried, and the last assistant message carries the answers to the
model's tool calls when the chat continues after them. For example,
`messages.slice(Math.max(0, messages.findLastIndex((message) => message.role === 'assistant')))`, with `body.tools`
beside them. Store messages by `id`, so the assistant message you already have is replaced by its answered version.

### What the model is told

A command's `run` answers the user with its `message`. A run may also return `output`, data for the model that the user
doesn't see: `return { message: 'Found 3 notes', output: { total: 3, notes } }`. A tool call the model made gets
`output` when there is one (`null` counts as none), else the message, else "Ran <label>". Keep `output` to plain JSON.

A typed intention joins the conversation as a `data-intention` part, `{ line, message }`, with `output` when the run
returned one, and the server helpers tell the model about it: its line and its `output`, or its message. So after a
typed read, the model can answer questions about what it returned.

A command's `toolDescription` in the catalog goes into its tool's description after the label, for rules or context
the model needs ("Use only when the user asks to archive"); see core's `CATALOG.md`. A command whose name a model
provider won't take as a tool name (anything but letters, digits, `_` and `-`, or longer than 64 characters) is left
out of the tools, with one console warning; it can still be typed. `findInvalidToolNames(catalog)` from core lists
them, for a test.

### The keys

- **Enter** acts on the highlighted row. That row is the first one that can be chosen, unless the arrows moved the
  highlight: Enter runs a command, completes the next word, or sends the line as chat. A highlight the arrows moved
  goes back to where it starts when the row it was on can no longer be chosen.
- **Up and Down** move the highlight over the rows that can be chosen, while the message is one line; in a message
  with a line break they move the caret.
- **Cmd+Enter** (Ctrl+Enter off a Mac) always sends the line as chat. **Shift+Enter** starts a new line, and a message
  with a line break is always chat. **Tab** completes.
- **An empty line shows no rows.** Down, Up or Tab there lists the commands available now, one row each by its label;
  choosing one (Enter or Tab) puts it in the line, ready for its words. Typing or **Escape** closes the list.
  Shift+Tab on an empty line is left to the browser, so the focus can leave the chat. A line of just `help` or
  `?` lists the same commands, then "Send as chat" (unless one of your commands answers to that word).
- Enter does nothing on an empty line with no list open, while the top command misses a value only your app can
  supply, or while a typed value breaks its param's rule ("Limit is a whole number from 1", shown as a row); then no
  row is highlighted. Cmd+Enter still sends the line as chat.
- A command is typed by its name (a plain lowercase word), its label ("close preview" for "Close preview") or an alias,
  as `@shortround/core`'s `CATALOG.md` describes.

A typed intention joins the conversation, so the model knows what the user did (see [What the model is
told](#what-the-model-is-told)).

### Your own UI: `useIntentionChat`

`IntentionChat` is this hook and the `Chat` slots. To draw the chat yourself, use the hook, with the same options
(`chat`, or `runtime` and `transport` with `body` and `sendAutomaticallyWhen`; and `showHintForMissing`):

```js
const { messages, status, error, line, lineState, rows, runtime, sendText, stop } = useIntentionChat({
  runtime,
  transport,
  body,
  showHintForMissing
});
```

`line` is core's chat line (`null` on the first render): send it the input's text with `line.change(text, caret)`, and
its keys with `line.pressKey({ key, metaKey, ctrlKey, shiftKey, highlightedRow })`, which answers whether it handled
the key: `true`, `false`, or, when it runs or completes a row, a promise of `true` (catch it to log a typed intention
that fails). `line.defaultHighlightIndex(rows)` is the row to highlight before the arrows move (`-1` for none).
`lineState` is the line as an input draws it, for `@shortround/react`'s `LineInput`. `sendText(text)` sends text to
the model as "Send as chat" does, but leaves the line as it is. `runtime` is the one the chat runs intentions in (yours,
or the one a held chat was made with), for looking up a command's label.

## The `Chat` slots

`IntentionChat` draws through the `Chat` group of the theme given to `ShortRoundProvider` (`theme.components.Chat`).
The provider doesn't require the group; mounting the chat without it throws, naming what is missing. Slots only draw:
the chat owns the keys, the highlight, scrolling and Markdown.

| Slot | Props | Draws |
| --- | --- | --- |
| `Frame` | `children` | The chat's box: the transcript, then the composer |
| `Transcript` | `children` | The messages, then an end marker the chat scrolls into view |
| `Message` | `role`, `message`, `children` | One message; `message` is the whole AI SDK message, for its `id` and `metadata` (the model a reply came from, a message your app sent) |
| `Text` | `role`, `children` | Text: the user's as typed, the assistant's already rendered as Markdown |
| `IntentionRun` | `line`, `message` | An intention the user ran by typing it |
| `ToolRun` | `label`, `name`, `input`, `state`, `output`, `errorText` | An intention the model ran, shown by its command's `label` (its `name` for a tool the catalog doesn't have); `state` is `running`, `done` or `refused`; `output` is the app's message or the run's `output`, which may be any JSON |
| `Error` | `message` | A request that failed |
| `Composer` | `rows`, `input` | Places the rows (`null` when there are none) and the input |
| `Row` | `row`, `isHighlighted`, `onChoose` | One row: its title and subtitle; mark the highlighted one, and set `aria-selected` from `isHighlighted`; a row with `missing` is a hint (draw it in italics); a `disabled` row can't be chosen |
| `Input` | `input` | Places the textarea (`data-testid="shortround-chat-input"`), already inside `LineInput` |

`CHAT_SLOT_NAMES` lists them. Colour the line's words through `[data-role]`, as `LineInput` describes. `LineInput`
makes the textarea's own text transparent, so give its placeholder a colour of its own (`::placeholder`).

A theme of your own for an app that draws only the chat still needs a `Toast` beside `components`, since
`ShortRoundProvider` requires one. A `Toast` that draws nothing will do:
`{ components: { Chat: myChatSlots }, Toast: () => null }`.

`@shortround/mui`'s `muiTheme` has a `Chat` group. For a theme of your own, `@shortround/conformance`'s
`describeThemeContract(name, theme)` checks the `Chat` slots too when the theme has them (it then needs this package
and `ai` and `@ai-sdk/react` installed).

## On the server: `@shortround/chat/server`

The route is yours, with the model and provider you choose. The helpers do what every route needs:

```js
import { streamText } from 'ai';
import {
  INTENTION_CHAT_SYSTEM_PROMPT,
  intentionErrorText,
  intentionModelMessages,
  intentionToolSet,
  parseIntentionChatRequest
} from '@shortround/chat/server';

export async function POST(request) {
  const parsed = parseIntentionChatRequest(await request.json());
  if (!parsed.success) {
    return new Response(parsed.error.message, { status: 400 });
  }
  const result = streamText({
    model: yourModel, // from the provider you chose, perhaps from parsed.data.model
    system: INTENTION_CHAT_SYSTEM_PROMPT,
    messages: await intentionModelMessages(parsed.data.messages),
    tools: intentionToolSet(parsed.data.tools)
  });
  return result.toUIMessageStreamResponse({ onError: intentionErrorText });
}
```

- `parseIntentionChatRequest` checks the messages (at least one) and the tools, and passes your own fields (such as
  `model`) through. Check those yourself. A route whose request has another shape (only the new messages, with the
  conversation kept on the server; see [Holding the conversation
  yourself](#holding-the-conversation-yourself-makeintentionchat)) checks the tools with
  `intentionToolsSchema.safeParse(body.tools)`, a zod schema; your transport must send `body.tools` on.
- `intentionModelMessages` tells the model about each intention the user ran by typing it: the line, and the run's
  `output` (as JSON, unless it is text) or its message.
- `intentionToolSet` gives the model the browser's tools without `execute`, so each call goes back to the browser,
  which runs it in the app and answers the model.
- `INTENTION_CHAT_SYSTEM_PROMPT` tells the model what its tools are, and that a tool's result is the message the app
  showed the user or data for the model; use it, extend it or write your own.
- `intentionErrorText`, as `onError`, tells the model and the user by name when the model calls a tool it wasn't
  offered; any other error keeps the AI SDK's masked "An error occurred.".

## Examples

- The storybook's "Intention chat" story: the MUI chat over a small notes catalog, with a scripted model in the page,
  so no key and no server are needed.
- The todo app's `/chat` page: a fixed todo list beside the MUI chat, with a real model through a dev-server route
  (`examples/todo-app/server/`). It needs an Anthropic key in `examples/todo-app/.env.local`; typed intentions work
  without one.

## License

MIT
