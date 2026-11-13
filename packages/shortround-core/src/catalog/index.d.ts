import type { CommandLine } from '../index.js';

/**
 * The app's functions, addressed by the catalog's dotted paths (`app.search.apply`). Plain objects: each path must end
 * at a function the objects own (not one inherited from a class). Other keys, such as a store's data, are ignored.
 */
export type CatalogBindings = { [name: string]: unknown };

/**
 * A row a lookup returns (or resolves to), and a list entry's shape. For typing the app's own lookup functions. The
 * picking rows list them; typed lines match them by `title`, `value` and `aliases`.
 */
export interface PickerRow {
  value: unknown;
  title: string;
  subtitle?: string;
  aliases?: string[];
  /** Names the row in its id when `value` is not a string. */
  key?: string;
  /** Already in effect (a value in the filter, the current sort): not offered again; typed in full, it still runs. */
  isApplied?: boolean;
}

/**
 * What a run returns: a `message` to show the user; `output` for a model, which a model's call to the command gets in
 * place of the message (JSON-serialisable, and `null` counts as none; the user doesn't see it); and `sideEffects` that
 * open or close the side
 * panel, winning over the ones the states' `panel` would set.
 */
export interface RunResult {
  message?: string;
  output?: unknown;
  sideEffects?: CatalogActionResult['sideEffects'];
}

/** What a `run` function may return, or resolve to. For typing the app's own functions. */
export type RunOutcome = RunResult | void | Promise<RunResult | void>;

/** Where a param's args come from (catalog format version 3). */
export interface ArgSource {
  /** The user may type any arg, read by `type` (default `text`). */
  freeform?: boolean;
  /**
   * How a freeform arg is read: `integer` and `number` read plain digits (a minus sign and a decimal point allowed) and
   * give a number on every path; a number type takes no `list` or `lookup`.
   */
  type?: 'text' | 'range' | 'url' | 'integer' | 'number';
  /** A number type only: the smallest and largest value allowed. */
  minimum?: number;
  maximum?: number;
  /** Text only: the most characters allowed. */
  maxLength?: number;
  /** A value's `path.id` overrides its row's id, for a `rows: 'each value'` param. */
  list?: Array<{
    value: string | number | boolean;
    title: string;
    subtitle?: string;
    aliases?: string[];
    path?: { id?: string };
  }>;
  /** A dotted path to the app's lookup, called with `{ command, filled, key }`, returning `PickerRow`s. */
  lookup?: string;
  /** Passed to the lookup, so one function can serve several params. */
  key?: string;
  /** A dotted path to the app's function returning the arg it holds now (such as the previewed result). */
  current?: string;
}

/** A command's param, as written. */
export interface CatalogParam {
  label: string;
  summary?: string;
  /**
   * The command can't run without it: a typed line needs it, and a model's call without it (left out, `null`, an empty
   * list, or blank text) is refused.
   */
  required?: boolean;
  list?: boolean;
  /** A list param only: a model's call that gives fewer items is refused (leaving the param out is still allowed). */
  minItems?: number;
  /**
   * A one-value param whose `run` takes `null` as a value ("no limit"), apart from leaving it out. With words
   * (`[all, every]`), typing one gives `null`; with `true`, only a model can send `null`.
   */
  nullable?: true | string[];
  default?: boolean;
  priority?: number;
  hints?: string[];
  aliases?: string[];
  argSource: ArgSource;
  /** Overrides for the picking rows only. */
  path?: {
    id?: string;
    title?: string;
    aliases?: string[];
    prompt?: string;
    required?: string;
    empty?: string;
    group?: string;
    icon?: string;
    rows?: 'each value';
  };
}

/** A command, as written. A planned one may leave out `run`. */
export interface CatalogCommand {
  label: string;
  summary?: string;
  /** For a model: rules or context its tool's description gives after the label ("Use only when the user asks"). */
  toolDescription?: string;
  aliases?: string[];
  group?: string;
  icon?: string;
  run?: string;
  when?: string;
  params: Record<string, CatalogParam>;
  planned?: boolean;
  tier?: 'common' | 'full';
  review?: string;
}

/** A state, as written: it holds while its `when` holds. */
export interface CatalogState {
  summary?: string;
  start?: boolean;
  when?: string;
  panel?: string;
  commands: string[];
  steps?: unknown[];
  planned?: boolean;
  tier?: 'common' | 'full';
  review?: string;
}

/** A checked catalog, as written: planned items included, code paths still dotted strings. */
export interface CheckedCatalog {
  version: 3;
  app: string;
  groups: Record<string, { label: string; icon?: string }>;
  states: Record<string, CatalogState>;
  commands: Record<string, CatalogCommand>;
  /** Named paths through the states, as design notes; the engine doesn't act on them. */
  workflows?: Record<string, unknown>;
}

/**
 * A loaded catalog: its shape checked, planned states and commands left out, and every code path replaced by the
 * app's function (`call` for `run`; a state's `holds()` and a command's `isAvailable()` for `when`).
 */
export interface Catalog extends Omit<CheckedCatalog, 'states' | 'commands'> {
  states: Record<string, CatalogState & { name: string; holds: () => boolean }>;
  commands: Record<
    string,
    CatalogCommand & { name: string; call: (args: Record<string, unknown>) => RunOutcome; isAvailable: () => boolean }
  >;
}

/**
 * Parses catalog YAML (format version 3), checks it and resolves every `run`, `lookup`, `current` and condition against
 * the app's bindings. Throws, naming the command (and param) and the reason, when something is wrong; a version 2
 * catalog throws with a pointer to MIGRATING.md.
 */
export function loadCatalog(text: string, bindings: CatalogBindings): Catalog;

/**
 * Every check `loadCatalog` makes except resolving code paths, for checking a catalog without the app (while it is
 * written or reviewed). Each `when` clause's shape is checked too.
 */
export function checkCatalog(text: string): CheckedCatalog;

/** An intention as ShortRound's palette takes it (the parts of `@shortround/core`'s `Intention` the engine sets). */
export interface CatalogIntention {
  id: string;
  title: string;
  subtitle?: string;
  aliases?: string[];
  group?: string;
  icon?: string;
  disabled?: boolean;
  /** A next step: choosing it sets the input to this text. */
  completion?: string;
  /** A chat line's row for what a command is missing: the params' labels. A theme draws the row as a hint (italics). */
  missing?: string[];
  /** A typed line's command row: the call it would run. */
  call?: { command: string; run: string; args: Record<string, unknown> };
  action: (input: string) => CatalogActionResult | Promise<CatalogActionResult>;
}

/**
 * What an intention's action returns, in the shape ShortRound takes (`@shortround/core`'s `IntentionActionResult`).
 */
export interface CatalogActionResult {
  intentions?: CatalogIntention[];
  resolveInput?: CatalogResolveInput;
  /** A state's list only: the app's `fallback`, told the state. */
  resolveFallbackInput?: CatalogResolveFallbackInput;
  /** What kind of list the result brings: the app's state, a picker, or a typed-text step. */
  listKind?: 'state' | 'picker' | 'text';
  /** A picker or text step: the command it belongs to. */
  command?: { name: string; label: string };
  disableInputMatching?: boolean;
  includeRevertIntentions?: string[];
  message?: string;
  /** `sidecarRenderer` is the app's panel renderer; it returns whatever the app renders (a React node). */
  sideEffects?: { sidecarRenderer?: () => any; closeSidecar?: boolean };
}

/**
 * Turns typed text into rows for the current list; it fits core's `ResolveInput`. Named `ResolveInput` in
 * `@shortround/catalog` before 0.5.0, renamed so it doesn't share core's name.
 */
export type CatalogResolveInput = ((text: string) => CatalogIntention[]) & {
  subscribe?: (listener: () => void) => () => void;
};

/**
 * A row the list already shows, as a fallback sees it. Only the fields core's rows and the engine's share, so a
 * fallback fits `@shortround/core`'s `ResolveFallbackInput`.
 */
export interface MatchedRow {
  id: string;
  title: string;
  group?: string;
}

/**
 * Rows after a list's matches; it fits core's `ResolveFallbackInput`. Named `ResolveFallbackInput` in
 * `@shortround/catalog` before 0.5.0, renamed so it doesn't share core's name.
 */
export type CatalogResolveFallbackInput = (
  text: string,
  context: { matches: MatchedRow[] }
) => CatalogIntention[];

/**
 * The palette for the states that hold at one moment. On `buildPalette`'s result, these fields are from when it was
 * built; `current()` gives them for now.
 */
export interface PaletteNow {
  intentions: CatalogIntention[];
  resolveInput: CatalogResolveInput;
  /** The states' fallback, when `buildPalette` was given one. */
  resolveFallbackInput?: CatalogResolveFallbackInput;
  /** The panel renderer of a state that holds and has a `panel`. */
  sidecarRenderer?: () => any;
}

/**
 * A palette from a catalog. Hand it whole to `@shortround/react`'s `ShortRoundSidekick` (`palette`) or to
 * `createPaletteStore({ palette })`: it opens on `current()` and follows `notify()`. Build it once.
 */
export interface Palette extends PaletteNow {
  /** The palette for the states that hold now. */
  current: () => PaletteNow;
  /** Tell the palette something it depends on changed outside it: it drops cached lookups and tells subscribers. */
  notify: () => void;
  subscribe: (listener: () => void) => () => void;
  /** Whether a command is offered now: one of its states holds, and its own `when` does. */
  isAvailable: (commandName: string) => boolean;
  /** The list for the states that hold now. */
  listNow: () => CatalogIntention[];
  /**
   * A command line for the commands available now (a custom UI's typed line, an editor's slash command): it follows
   * the app (`notify()`, and its own runs), runs as a typed-line row does, and reads with engines of its own.
   * `dispose()` stops it following; call it when the host goes away. `rows()`: the typed-line rows for the line as it
   * reads now, at its caret (what `resolveInput` gives for the text), which a palette store shows.
   */
  commandLine: () => CommandLine & { rows: () => CatalogIntention[] };
}

/**
 * One param of a tool, as JSON Schema: `string` (free text, a fixed list's `enum`, or a lookup), `integer` or `number`
 * (a number type, with its `minimum` and `maximum`), or an `array` of these for a list param. A nullable param's
 * `type` is a pair with `'null'`.
 */
export interface IntentionToolProperty {
  type: IntentionToolValueType | [IntentionToolValueType, 'null'] | 'array';
  enum?: string[];
  items?: IntentionToolItem;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  minItems?: number;
  description: string;
}

/** One item of a list param's array. */
export interface IntentionToolItem {
  type: IntentionToolValueType;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
}

export type IntentionToolValueType = 'string' | 'integer' | 'number';

/** A tool a model can call: an intention, its args as a JSON Schema. */
export interface IntentionTool {
  /** The command's name. */
  name: string;
  /**
   * The command's label, then its `toolDescription` when it has one; from `runtime.tools()`, the label is followed by
   * " (not available now)" when it isn't.
   */
  description: string;
  /**
   * One property per param: free text a string; a fixed list an enum of its values, as strings (a call's string is
   * matched back to the value); a lookup a string, checked when the call runs. A list param is an array of these, with
   * `minItems` when the catalog sets it (1 for a required list that sets none). `required` lists the catalog's required
   * params the app holds no value for when the tools are built; one the app holds is filled when it runs.
   */
  inputSchema: {
    type: 'object';
    properties: Record<string, IntentionToolProperty>;
    required?: string[];
    additionalProperties: false;
  };
}

/** A model's call of an intention tool. */
export interface IntentionToolCall {
  toolName: string;
  input?: Record<string, unknown>;
}

/**
 * What a tool call answers the model: the run's message (or "Ran <label>"), or why it didn't run (not available now,
 * an unknown param, several values for a one-value param, a value outside its choices with the choices named, or
 * "needs <label>").
 */
export type IntentionToolAnswer = { output: unknown } | { errorText: string };

/**
 * A loaded catalog at run time: which commands are available, the app's one signal (`notify()`), running a command,
 * a command line, and every intention as a tool. A palette (`buildPalette(runtime, …)`) and a chat line
 * (`makeChatLine({ runtime, … })`) are views over it, so an app with both calls `notify()` once. Build it once.
 */
export interface CatalogRuntime {
  /** Whether a command is offered now: one of its states holds, and its own `when` does. */
  isAvailable: (commandName: string) => boolean;
  /** Tell the runtime something it depends on changed: every view drops cached lookups and re-reads. */
  notify: () => void;
  subscribe: (listener: () => void) => () => void;
  /** Runs a command with these args (`{}` if none), as given; resolves to what the app's function returned, or `{}`. */
  run: (commandName: string, args?: Record<string, unknown>) => Promise<RunResult>;
  /**
   * A command line for the commands available now: it follows `notify()` and its own runs, and reads with engines of
   * its own. Enter fills each param the app holds from it. A command whose param the app holds no value for needs it,
   * as one missing a typed word does: `canRun` is false, its row in `rows()` is disabled with "Needs <label>", and
   * `submit()` runs nothing and keeps the text. `dispose()` stops it following.
   */
  commandLine: () => CommandLine & { rows: () => CatalogIntention[] };
  /**
   * Every intention, as tools a model can call. A tool's description is the command's label, then its
   * `toolDescription` when it has one. A command whose name can't be a tool name (`findInvalidToolNames`) is left out,
   * with one `console.warn`. One not available now has "(not available now)" after its label, and `runTool` refuses
   * it: offering the same list on every request keeps some models from doubting the app's answer when the state
   * changes between a call and the reply. For an intention available now, a lookup param's description
   * lists the values the app has now (up to twenty, then how many more), waiting briefly for its lookup; a lookup that
   * fails or is slow lists none. For one not available now, the lookup isn't asked.
   */
  tools: () => Promise<IntentionTool[]>;
  /**
   * Runs a model's call: refuses what isn't available now or can't run; matches a lookup value by its value, title or
   * an alias; fills a param the app holds.
   */
  runTool: (call: IntentionToolCall) => Promise<IntentionToolAnswer>;
}

/** The run-time object for a loaded catalog. It needs no panels and no Back row: those are the palette's. */
export function buildCatalogRuntime(catalog: Catalog): CatalogRuntime;

/**
 * Builds the palette for a loaded catalog, or over a runtime the app built (and shares with a chat). Over a runtime,
 * build one palette for the runtime's life: the palette follows the runtime's `notify()` for as long as the runtime
 * lives.
 */
export function buildPalette(
  catalog: Catalog | CatalogRuntime,
  options: {
    /** A renderer for each panel the catalog's states use (`panel: sidecar`). */
    panels?: Record<string, () => unknown>;
    /** ShortRound's built-in Back row id: `RevertIntentionIds.BACK` from `@shortround/core`. */
    backIntentionId: string;
    /** Rows after a state's matches, such as "Send as chat"; told `matches` and the state's name. */
    fallback?: (
      text: string,
      context: { matches: MatchedRow[]; stateName: string }
    ) => CatalogIntention[];
  }
): Palette;

/**
 * The commands a typed line can't reach: a name that isn't a plain lowercase word, and no aliases. They are still rows.
 * Planned commands are left out. Assert `[]` in a test, unless a command is meant to be a row only.
 */
export function findUntypedCommands(
  catalog: Pick<CheckedCatalog, 'commands'>
): Array<{ command: string; label: string }>;

/**
 * The commands whose names a model provider won't take as tool names (letters, digits, `_` and `-`, up to 64
 * characters), with why. The runtime's `tools()` leaves them out and warns once; a typed line still runs them. Planned
 * commands are left out. Assert `[]` in a test.
 */
export function findInvalidToolNames(
  catalog: Pick<CheckedCatalog, 'commands'>
): Array<{ command: string; reason: string }>;

/** A call an example names: one command and the args it runs with (`{ search: { term: 'grid' } }`). */
export type ExampleCall = Record<string, Record<string, unknown>>;

/** An example: a typed line and the call it must run. */
export interface CatalogExample {
  say: string;
  means: ExampleCall;
}

/** Parses and checks an examples file (`examples: [{ say, means }]`). */
export function loadExamples(text: string): CatalogExample[];

/**
 * The examples whose line (read against the start list) doesn't run what they mean, with what it ran instead
 * (`undefined`: nothing). The args' order doesn't matter.
 */
export function findExampleFailures(
  palette: Pick<PaletteNow, 'resolveInput'>,
  examples: CatalogExample[]
): Array<CatalogExample & { got: ExampleCall | undefined }>;
