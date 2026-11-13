// @shortround/core's types: headless, no React. The UI's types are @shortround/react's.

// The catalog engine (was @shortround/catalog).
export * from './catalog/index.js';
import type { CatalogIntention, CatalogRuntime } from './catalog/index.js';

export const RevertIntentionIds: {
  readonly BACK: string;
  readonly RESET: string;
};

export const AnchorPositions: {
  readonly CENTER: string;
  readonly TOP_LEFT: string;
  readonly TOP_RIGHT: string;
  readonly BOTTOM_RIGHT: string;
  readonly BOTTOM_LEFT: string;
  readonly TOP: string;
  readonly RIGHT: string;
  readonly BOTTOM: string;
  readonly LEFT: string;
};

export const Sizes: {
  readonly COMPACT: string;
  readonly MEDIUM: string;
  readonly FULL: string;
};

/** The control bar's accessible names; the palette passes them to a theme's ControlBar as `labels`. */
export const ControlLabels: {
  readonly close: string;
  readonly anchor: string;
  readonly size: string;
  readonly sizes: { readonly compact: string; readonly medium: string; readonly full: string };
};

/** Back and Cancel's group name, kept apart from any app group. */
export const NAVIGATE_GROUP: string;

export type RevertIntentionId = (typeof RevertIntentionIds)[keyof typeof RevertIntentionIds];
export type AnchorPosition = (typeof AnchorPositions)[keyof typeof AnchorPositions];
export type Size = (typeof Sizes)[keyof typeof Sizes];

/** The next corner after `current` (with the center first, unless `includeCenter` is false). */
export function cycleCorners(current: AnchorPosition, includeCenter?: boolean): AnchorPosition;

/** The next edge middle after `current` (with the center first, unless `includeCenter` is false). */
export function cycleMiddlePositions(
  current: AnchorPosition,
  includeCenter?: boolean
): AnchorPosition;

/**
 * What a UI draws in the side panel. Core stores it and hands it back; it never calls it, so its result is the UI's
 * business (a React node, for `@shortround/react`).
 */
export type SidecarRenderer = () => unknown;

export interface SidekickStoreState {
  internalSidecarRenderer: SidecarRenderer | null;
  isOpen: boolean;
  isSidecarOpen: boolean;
  /** Where the sidekick opens; its position follows from it. */
  anchorOrigin: AnchorPosition;
  maxTotalWidth: string;
  commandWidth: string;
  totalWidth: string;
  size: Size;
}

export interface SidekickStore {
  get: () => SidekickStoreState;
  subscribe: (callback: () => void) => () => void;
  set: (
    updater:
      | Partial<SidekickStoreState>
      | ((state: SidekickStoreState) => Partial<SidekickStoreState>)
  ) => void;
  /**
   * Shows `renderer` in the side panel, through the sidekick's `sidecarReducer` (reason `app`). Works outside React.
   * Call it while the palette is open: opening replaces a panel set while closed, unless the reducer keeps it for `open`.
   */
  openSidecar: (renderer: SidecarRenderer) => void;
  /** Closes the side panel, through the sidekick's `sidecarReducer` (reason `app`). Works outside React. */
  closeSidecar: () => void;
  /**
   * Proposes a side panel change for `reason`; the sidekick's `sidecarReducer` decides what applies. The palette
   * store's `select` calls it with what a chosen row asks for.
   */
  changeSidecar: (proposed: SidecarChange, reason: SidecarReason) => void;
  /** Closes the side panel whatever the reducer would keep: the side panel never outlives the palette. */
  clearSidecar: () => void;
  /** Sets the reducer that decides every side panel change but a clear; none applies what is proposed. */
  setSidecarReducer: (reducer?: SidecarReducer) => void;
}

/** The side panel's state as the reducer sees it, and the change it returns: a renderer, or none. */
export type SidecarChange = { renderer: SidecarRenderer | null };

/**
 * Why core proposes a side panel change: an action's result asks for one (`result`); Back to an earlier step replays
 * its result (`back`); Back to the start list (`start`); Cancel (`reset`); the palette opens (`open`); the app called
 * `openSidecar` or `closeSidecar` (`app`). A close has no reason: it always clears the panel.
 */
export type SidecarReason = 'result' | 'back' | 'start' | 'reset' | 'open' | 'app';

/** Decides each side panel change but a close. Return `proposed` for the default, or `current` to keep the panel. */
export type SidecarReducer = (
  current: SidecarChange,
  proposed: SidecarChange,
  context: { reason: SidecarReason }
) => SidecarChange;

export type IntentionActionResult = {
  intentions?: Intention[];
  /** With `intentions`: that list shows whatever is typed (a typed-text step). A result without a list leaves it. */
  disableInputMatching?: boolean;
  shouldReset?: boolean;
  includeRevertIntentions?: readonly RevertIntentionId[];
  message?: string;
  /**
   * The sidecar stays as it is unless a result sets a renderer or asks to close it; either is proposed to the
   * sidekick's `sidecarReducer` (reason `result`, or `back` when Back replays this result).
   */
  sideEffects?: { sidecarRenderer?: SidecarRenderer; closeSidecar?: boolean };
  /** Set by dispatch when the intention is disabled or invalid for the current input; nothing ran. */
  isRejected?: boolean;
  /** Turns typed text into extra rows for this result's list (shown above the fuzzy matches). */
  resolveInput?: ResolveInput;
  /** Adds rows after this result's list's matches (see `ResolveFallbackInput`); a list without one has none. */
  resolveFallbackInput?: ResolveFallbackInput;
  /**
   * What kind of list the result brings: the app's state (it follows the app on a palette store's re-read), a picker,
   * or a typed-text step.
   */
  listKind?: 'state' | 'picker' | 'text';
  /** A picker or text step: the command it belongs to, so a re-read can tell when the app has left it behind. */
  command?: { name: string; label: string };
};

/**
 * Returns rows for the typed text, or none. Called on every render while text is typed (except during typed-text
 * steps), so keep it quick and synchronous; an error is logged and shows no rows. A resolver whose rows can change
 * without new input (an async lookup landed) may carry `subscribe`. While the palette store's `watchResolver()` runs
 * (`@shortround/react`'s palette runs it while mounted), the store calls it with a listener, tells its own listeners
 * when that listener is called, and calls the returned function when the resolver is replaced or watching stops.
 */
export type ResolveInput = ((text: string) => Intention[]) & {
  subscribe?: (listener: () => void) => () => void;
};

/**
 * Returns rows to add after the list's matches, such as "Send as chat: <text>". Called on every render while text is
 * typed (not on a blank input, not during typed-text steps) with `matches`, what the list shows before it (typed-line
 * rows, then fuzzy matches); return rows only when `matches` is empty for an "unmatched" row. Its rows come last when
 * their `group` is one no match uses; a row in a match's group (or with none, beside ungrouped matches) is drawn at
 * the end of that group. Keep it quick and synchronous; an error is logged and adds no rows; a row whose id is
 * already listed is left out. A new function resets the list, so read changing app state when it runs rather than
 * closing over it.
 */
export type ResolveFallbackInput = (text: string, context: { matches: Intention[] }) => Intention[];

export interface Intention {
  id: string;
  title: string;
  /** A second line under the title; themes show it. */
  subtitle?: string;
  group?: string;
  aliases?: string[];
  icon?: string;
  disabled?: boolean;
  shortcut?: string;
  /**
   * Extra words core hands to cmdk's item. No effect today: core filters rows itself (by title and `aliases`), with
   * cmdk's filtering off. Use `aliases` for words that should match.
   */
  keywords?: string[];
  validate?: (input: string) => { valid: boolean; message?: string } | void;
  /**
   * A completion row: selecting it sets the input to this text and keeps the palette open, instead of running
   * `action` (which isn't called). Tab applies the first enabled completion row.
   */
  completion?: string;
  action: (input: string) => Promise<IntentionActionResult> | IntentionActionResult;
}

/**
 * The palette's matching: fuzzy over each intention's title, group and aliases (threshold 0.5), in list order. A blank
 * input matches everything. A host can use it to know what the palette would show.
 */
export function matchIntentions(inputValue: string, intentions?: Intention[]): Intention[];

/** A step in the dispatched stack brought a list (Back moves between these). */
export function bringsList(step: { intention: Intention; result: IntentionActionResult }): boolean;

export function createSidekickStore(init?: Partial<SidekickStoreState>): SidekickStore;

/** The palette's state: what it shows, typed and did. Rows are worked out when read (`PaletteStore.rows`). */
export interface PaletteStoreState {
  inputValue: string;
  inputMessage?: { type: string; text: string };
  dispatchedStack: { intention: Intention; result: IntentionActionResult }[];
  currentIntentions: Intention[];
  disableInputMatching?: boolean;
  resolveInput?: ResolveInput;
  resolveFallback?: ResolveFallbackInput;
  /** The Back and Cancel rows the current list asked for. */
  revertIntentions: Intention[];
  /** Counts the notices that the rows changed (the resolver's, or the store's line's) while watched; a UI can ignore it. */
  resolverVersion: number;
  /**
   * The highlighted row's id: the first enabled row as drawn (by group, in order of first appearance) after every
   * change of the rows, a lookup landing included, so Enter runs what an instant lookup would have; `highlight(id)`
   * moves it. Back and Cancel aren't candidates.
   */
  highlightedId?: string;
}

/**
 * A palette that follows the app (what `buildPalette` returns): the store reads `current()` when it is made, on Back
 * to the start and on a re-read, and re-reads when `subscribe`'s listener is called while watched.
 */
export interface PaletteSource {
  current: () => {
    intentions: Intention[];
    resolveInput?: ResolveInput;
    resolveFallbackInput?: ResolveFallbackInput;
    sidecarRenderer?: SidecarRenderer;
  };
  subscribe: (listener: () => void) => () => void;
  isAvailable: (commandName: string) => boolean;
  /**
   * A command line for the commands available now (`buildPalette`'s has one); without it, an input shows no hints. A
   * store watching the source owns one; with `rows()`, the store's typed-line rows come from it too (one reading).
   */
  commandLine?: () => CommandLine & { rows?: () => Intention[] };
}

export interface PaletteDefaults {
  defaultIntentions?: Intention[];
  /** Turns typed text into extra rows for the default list. */
  resolveDefaultInput?: ResolveInput;
  /** Adds rows after the default list's matches. */
  resolveDefaultFallbackInput?: ResolveFallbackInput;
  /** A palette that follows the app, instead of the three above. */
  palette?: PaletteSource;
}

/**
 * The command palette without a UI: one per palette. Draw `rows()` and `getState()`, call `changeInput` as the user
 * types and `select` when they choose a row, and re-read when a listener is told.
 */
export interface PaletteStore {
  getState: () => PaletteStoreState;
  subscribe: (listener: () => void) => () => void;
  /** The rows to show now: resolved rows, then matches, then fallback rows; the list itself while matching is off. */
  rows: () => Intention[];
  /**
   * Sets the input, running each intention's `validate` (which sets `disabled` and the input message). `caret`: where
   * the UI's caret is (the end when left out); the store's line reads its next steps there.
   */
  changeInput: (text: string, caret?: number) => void;
  /** Moves the highlight (`PaletteStoreState.highlightedId`), as a UI's arrow keys do. */
  highlight: (intentionId: string) => void;
  /** Runs an intention (or Back, or Cancel) with the current input. Throws on an id the palette doesn't show. */
  dispatch: (intentionId: string) => Promise<IntentionActionResult>;
  back: () => Promise<IntentionActionResult>;
  reset: () => Promise<IntentionActionResult>;
  /** New defaults: the start list shows, and the input clears. */
  setDefaults: (defaults: PaletteDefaults) => void;
  /**
   * Choosing a row: a completion row sets the input and returns `{ isCompletion: true }`; otherwise it dispatches,
   * proposes the side panel's change to `sidekickStore` (when given), and keeps the Back and Cancel rows the result
   * asks for. The result is returned for what a UI does itself (a toast for `message`, closing on `shouldReset`).
   */
  select: (
    intentionId: string,
    options?: { sidekickStore?: SidekickStore; defaultSidecarRenderer?: SidecarRenderer }
  ) => Promise<IntentionActionResult & { isCompletion?: boolean }>;
  /**
   * Tab: applies the first enabled completion row. Says whether there was one. With the store's line, its first next
   * step at the caret, and the caret goes after the inserted word (`commandLine().getState().caret`).
   */
  completeFirst: () => boolean;
  /** Re-reads when the current resolver says its rows changed (an async lookup landed). Returns a function that stops. */
  watchResolver: () => () => void;
  /**
   * With a `palette`: re-reads when the app calls the palette's `notify()`. On the start list, or a list a run
   * brought, the list follows the states that hold now and the input stays; a step whose command is no longer
   * available returns to that list with "<label> isn't available now"; any other step stays. Returns a function that
   * stops. Without a palette, it does nothing. A palette with `commandLine()` gives the store its one line while
   * watched: its typed-line rows, words, ghost and Tab are one reading. The returned function also disposes that
   * line.
   */
  watchPalette: () => () => void;
  /**
   * The store's line while it reads typed lines through it (watching a palette with one, at a list from the app's
   * state); `null` otherwise, such as in a picker or a typed-text step. A UI draws the line's words and ghost from it.
   */
  commandLine: () => CommandLine | null;
  /** The same re-read, on demand (a host that keeps one store across opens). */
  refresh: () => void;
}

export function createPaletteStore(defaults?: PaletteDefaults): PaletteStore;

/** A command as the command builder reads it (what a catalog's command becomes, with its name). */
export interface BuilderCommand {
  name: string;
  label: string;
  aliases: string[];
  run: string;
  params: Record<
    string,
    {
      label: string;
      aliases?: string[];
      hints?: string[];
      default?: boolean;
      list?: boolean;
      required?: boolean;
      priority?: number;
      /** What the line says when this param's values are offered with nothing typed and there are none. */
      emptyText?: string;
      argSource: {
        freeform?: boolean;
        type?: 'text' | 'range' | 'url';
        list?: Array<{ value: unknown; title: string; aliases?: string[] }>;
        /** The name of one of the builder's `lookups`. */
        lookup?: string;
        key?: string;
      };
    }
  >;
}

/** What the command builder makes of a line. */
export interface BuilderState {
  /** The candidate commands, best first: each reads back (`title`), says what it still needs, and the call it runs. */
  readings: Array<{
    title: string;
    needs: string[];
    /** On a catalog runtime's own line: the params in `needs` only the app can supply (it holds no value for them now). */
    appNeeds?: string[];
    call: { command: string; run: string; args: Record<string, unknown> };
  }>;
  /** What may come next at the caret: `insertText` is the whole line with it. */
  nextSteps: Array<{ label: string; insertText: string; kind: string }>;
  /** Why the line can't be read, when it can't. */
  problem?: string;
  /**
   * When nothing can run yet and nothing is wrong: what is still being typed, and a param's `emptyText` when the values
   * offered at the caret have none to choose from and nothing is typed for it.
   */
  incomplete: string[];
  /** The rules a typed value breaks ("Limit is a whole number from 1"); each is also an `incomplete` message. */
  brokenRules: string[];
  /** The params a hint word waits for ("with" → Sort), each with the `incomplete` message that says so. */
  awaiting: Array<{ message: string; labels: string[] }>;
  /** Params whose lookups are still loading, or failed. */
  pending: Array<{ param: string; label: string }>;
  failed: Array<{ param: string; label: string }>;
  /** Each word with its role in the line's best reading (kept while the line is unfinished); `reason` on a broken word. */
  annotations: WordRole[];
  partial?: string;
  work: { steps: number; lookups: number };
}

/** A word of a typed line, where it sits, and its role: what an input colours. */
export interface WordRole {
  text: string;
  start: number;
  end: number;
  role: 'verb' | 'text' | 'hint' | 'param' | 'value' | 'unread' | 'broken';
  reason?: string;
}

/** What a command line says about its line. The same object until something changes. */
export interface CommandLineState {
  text: string;
  caret: number;
  roles: WordRole[];
  nextSteps: BuilderState['nextSteps'];
  /** The rest of the first next step, after the caret, when the caret is at the end of a non-empty line. */
  ghost?: string;
  /** The best reading: what Enter would run. */
  top?: BuilderState['readings'][number];
  /** Every candidate reading, best first (`top` is the first). */
  readings: BuilderState['readings'];
  canRun: boolean;
  /** As `BuilderState.incomplete`: what is still being typed, or that there is nothing to choose from. */
  incomplete: string[];
  /**
   * As `BuilderState.brokenRules`: the rules a typed value breaks; a chat line's Enter does nothing while there are
   * any.
   */
  brokenRules: string[];
  /** As `BuilderState.awaiting`: the params a hint word waits for. */
  awaiting: BuilderState['awaiting'];
  problem?: string;
  /** Params whose lookups have been loading for longer than a short delay. */
  loading: Array<{ param: string; label: string }>;
  failed: Array<{ param: string; label: string }>;
}

/**
 * A line of text read against the commands: what to show for it, and what Tab and Enter do. Hosts: a palette input,
 * an editor's slash command, anything that produces a line.
 */
export interface CommandLine {
  getState: () => CommandLineState;
  /** The text changed, or the caret moved (the caret defaults to the end). */
  change: (text: string, caret?: number) => void;
  /** Tab: the step (the first next step by default) replaces the line; false when there is none. */
  acceptCompletion: (step?: BuilderState['nextSteps'][number]) => boolean;
  /**
   * Enter: runs a line that can run, once, and clears it (unless the text changed while it ran); otherwise completes
   * like Tab. While a run is in progress, it returns that run.
   */
  submit: () => Promise<unknown>;
  cancel: () => void;
  subscribe: (listener: () => void) => () => void;
  /** The host is done with the line: it stops hearing lookups (and, from a palette, the app) and tells no one more. */
  dispose: () => void;
}

/** The id of a chat line's "Send as chat" row. */
export const SEND_AS_CHAT_ROW_ID: 'chat:send';

/** A chat line's row: a typed line's row from the runtime, or "Send as chat" (which has no action). */
export type ChatLineRow =
  | CatalogIntention
  | { id: typeof SEND_AS_CHAT_ROW_ID; title: string; group: string; icon: string };

/** A key the chat line's input received; `highlightedRow` is the row the arrows moved to, if they did. */
export interface ChatLineKey {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  highlightedRow?: ChatLineRow;
}

/**
 * A chat's input line over a catalog runtime. Enter acts on the highlighted row (by default `defaultHighlightIndex`):
 * it runs a command, completes a next step, or sends as chat. Enter does nothing on an empty line, while the top
 * command misses a value only the app can supply, or while a typed value breaks its param's rule. Cmd+Enter
 * (Ctrl+Enter) always sends as chat; Shift+Enter is left to the input, for a new line; Tab completes. On an empty line,
 * Tab opens the command list, and on the open list it acts like Enter; Shift+Tab there is left to the host, so the
 * focus can leave. No DOM and no React.
 */
export interface ChatLine {
  /** The line's state, and whether the command list is open on an empty line. */
  getState: () => CommandLineState & { isCommandListOpen: boolean };
  subscribe: (listener: () => void) => () => void;
  /** Changes the text (closing the command list). */
  change: (text: string, caret?: number) => void;
  dispose: () => void;
  /**
   * The rows for the line now. An empty line has none, unless ArrowDown, ArrowUp or Tab opened the command list: one row
   * per command available now, by its label, which puts the command in the line when chosen. A line of just `help` or
   * `?` lists the same rows (unless a command answers to that word), then "Send as chat". "Send as chat" is last
   * whenever the line has text, and the only row when the line reads as chat: its first word starts no command, or it
   * has a line break. A next step's row has no subtitle when it would repeat its title.
   */
  rows: () => ChatLineRow[];
  /**
   * The row to highlight before the arrows move: the first that can be chosen, or -1 (none) while the top command
   * misses a value only the app can supply or a typed value breaks its rule, since Enter then does nothing.
   */
  defaultHighlightIndex: (rows: ReadonlyArray<{ id: string; disabled?: boolean }>) => number;
  /**
   * Whether the line handled the key; the input does its default otherwise (Shift+Enter, a letter). On an empty line,
   * an arrow opens the command list and Escape closes it.
   */
  pressKey: (event: ChatLineKey) => boolean | Promise<boolean>;
  /** Chooses a row as Enter would (a click); a disabled row does nothing. */
  chooseRow: (row: ChatLineRow) => unknown;
}

/**
 * A chat line: `onIntentionRun` hears each typed run, its message (or "Ran <label>") and, when the run returned one,
 * its `output` for a model; `onSendAsChat` the text.
 */
export function makeChatLine(options: {
  runtime: CatalogRuntime;
  onIntentionRun: (run: { line: string; message: string; output?: unknown }) => void;
  onSendAsChat: (text: string) => void;
  /**
   * Whether rows say what a command is missing (default `true`): a value the app holds none for, or a param a hint
   * word waits for, reads "Missing <label>" on a disabled row carrying `missing`. Off, those rows are hidden.
   */
  showHintForMissing?: boolean;
}): ChatLine;

/** The line as the input draws it: a line that reads as chat has no word roles, so it isn't drawn as broken. */
export function drawnLineState(state: CommandLineState): CommandLineState;

/** The row Enter acts on before the arrows move: the first that isn't disabled, or -1. */
export function firstEnabledIndex(rows: ReadonlyArray<{ id: string; disabled?: boolean }>): number;

/** The next row that isn't disabled in the arrow's direction; the highlight stops at the ends. */
export function moveHighlight(rows: ReadonlyArray<{ id: string; disabled?: boolean }>, index: number, step: 1 | -1): number;

/** A command line over a command builder; `run` receives the call Enter runs. */
export function makeCommandLine(options: {
  builder: { read: (text: string, caret?: number) => BuilderState; subscribe: (listener: () => void) => () => void };
  run: (call: BuilderState['readings'][number]['call']) => unknown;
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => unknown;
}): CommandLine;

/**
 * The command builder: reads a typed line into whole commands, keeping only what changed between calls. `lookups`
 * are the app's functions by name (each may return a promise). `subscribe` is told when a lookup lands; `invalidate`
 * drops cached lookups.
 */
export function makeCommandBuilder(options: {
  commands: BuilderCommand[];
  lookups: Record<string, (context: { command: string; filled: Record<string, unknown>; key?: string }) => unknown>;
  now?: () => Date;
}): {
  read: (text: string, caret?: number) => BuilderState;
  subscribe: (listener: () => void) => () => void;
  invalidate: () => void;
};

export function makeRevertIntentionsFor(ids?: readonly RevertIntentionId[]): Intention[];
