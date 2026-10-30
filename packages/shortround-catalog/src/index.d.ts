/**
 * The app's functions, addressed by the catalog's dotted paths (`app.search.setSort`). Plain objects: each path must end
 * at a function the objects own (not one inherited from a class). Other keys, such as a store's data, are ignored.
 */
export type CatalogBindings = { [name: string]: unknown };

/** A picker row, as an app's `from` function returns it (or resolves to). For typing the app's own functions. */
export interface PickerRow {
  value: unknown;
  title: string;
  subtitle?: string;
  aliases?: string[];
  /** Names the row in its intention id when `value` is not a string. */
  key?: string;
  /**
   * Already in effect (a value in the filter, the current sort). Pickers and single commands leave it out; a line that
   * names it reads "(already set)" and still runs it, so the command must change nothing for a value already in effect.
   */
  isApplied?: boolean;
}

/**
 * What a `run` function may return, or resolve to. A cancelled run stays in the current state instead of following
 * `then`. For typing the app's own functions.
 */
export type RunOutcome =
  | { message?: string; isCancelled?: boolean }
  | void
  | Promise<{ message?: string; isCancelled?: boolean } | void>;

/**
 * A loaded catalog: its shape checked, planned states, commands and pickers left out, and every code path replaced by
 * the app's function.
 */
export interface Catalog {
  version: 2;
  app: string;
  startState: string;
  states: Record<string, unknown>;
  pickers: Record<string, unknown>;
  facets: Record<string, { title: string; aliases?: string[] }>;
  /** Named paths through the states, as design notes; the engine doesn't act on them. */
  workflows?: Record<string, unknown>;
}

/**
 * Parses catalog YAML, checks its shape and resolves every `run`, `when` and `from` path against the app's bindings.
 * Throws, naming the command or picker and the path, when something is wrong.
 */
export function loadCatalog(text: string, bindings: CatalogBindings): Catalog;

/**
 * Every check `loadCatalog` makes except resolving code paths, for checking a catalog without the app (while it is
 * written or reviewed). Planned states, commands and pickers stay in, and `run`, `when` and `from` stay as written.
 */
export function checkCatalog(text: string): CheckedCatalog;

/** A checked catalog, as written: planned items included, code paths still dotted strings. */
export interface CheckedCatalog {
  version: 2;
  app: string;
  startState: string;
  states: Record<string, unknown>;
  pickers: Record<string, unknown>;
  facets: Record<string, { title: string; aliases?: string[] }>;
  workflows?: Record<string, unknown>;
}

/** An intention as ShortRound's palette takes it (the parts of `@shortround/core`'s `Intention` the engine sets). */
export interface CatalogIntention {
  id: string;
  title: string;
  subtitle?: string;
  aliases?: string[];
  group?: string;
  icon?: string;
  action: (input: string) => CatalogActionResult | Promise<CatalogActionResult>;
}

/**
 * What an intention's action returns, in the shape ShortRound takes (`@shortround/core`'s `IntentionActionResult`),
 * written out here so the engine depends on neither core nor React.
 */
export interface CatalogActionResult {
  intentions?: CatalogIntention[];
  resolveInput?: ResolveInput;
  disableInputMatching?: boolean;
  includeRevertIntentions?: string[];
  message?: string;
  /** `sidecarRenderer` is the app's panel renderer; it returns whatever the app renders (a React node). */
  sideEffects?: { sidecarRenderer?: () => any; closeSidecar?: boolean };
}

/** Turns typed text into rows for the current list (`@shortround/core`'s `ResolveInput`). */
export type ResolveInput = (text: string) => CatalogIntention[];

export interface Palette {
  intentions: CatalogIntention[];
  resolveInput: ResolveInput;
}

/**
 * Builds the start state's intentions and its input resolver. Pass `palette.intentions` as `defaultIntentions` and
 * `palette.resolveInput` as `resolveDefaultInput`; memoize the palette, since new ones reset ShortRound's list.
 */
export function buildPalette(
  catalog: Catalog,
  options: {
    /** A renderer for each panel the catalog's states use (`panel: sidecar`). */
    panels?: Record<string, () => unknown>;
    /** ShortRound's built-in Back row id: `RevertIntentionIds.BACK` from `@shortround/core`. */
    backIntentionId: string;
  }
): Palette;

/**
 * An example: a typed line and the id of the row it must resolve to first; for a line of several commands, the ids of
 * each command's row, in order.
 */
export interface CatalogExample {
  say: string;
  means: string | string[];
}

/** Parses and checks an examples file (`examples: [{ say, means }]`). */
export function loadExamples(text: string): CatalogExample[];

/** The examples whose first resolved row (in the start state) is not `means`, with what they got instead. */
export function findExampleFailures(
  palette: Palette,
  examples: CatalogExample[]
): Array<CatalogExample & { got: string | undefined }>;
