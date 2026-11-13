// Checks the hand-written declaration files against each other: core's catalog types must fit react's components, as
// the catalog's docs (core's CATALOG.md) use them. Moved here from @shortround/catalog when the catalog folded into
// core. `pnpm verify` runs it (`types:check`).
import {
  type ArgSource,
  type BuilderState,
  buildCatalogRuntime,
  buildPalette,
  type CatalogRuntime,
  type ChatLine,
  type ChatLineRow,
  drawnLineState,
  firstEnabledIndex,
  type IntentionTool,
  type IntentionToolAnswer,
  type IntentionToolProperty,
  makeChatLine,
  moveHighlight,
  SEND_AS_CHAT_ROW_ID,
  type CatalogExample,
  type CatalogIntention,
  type CatalogParam,
  type CatalogResolveFallbackInput,
  type CatalogResolveInput,
  checkCatalog,
  type CommandLine,
  type CommandLineState,
  type WordRole,
  ControlLabels,
  createPaletteStore,
  createSidekickStore,
  findExampleFailures,
  findInvalidToolNames,
  findUntypedCommands,
  type Intention,
  type IntentionActionResult,
  loadCatalog,
  loadExamples,
  makeCommandBuilder,
  makeCommandLine,
  type PaletteNow,
  type PickerRow,
  type ResolveFallbackInput,
  type ResolveInput,
  type RunOutcome,
  type RunResult
} from '@shortround/core';
import {
  LineInput,
  type ShortRoundTheme,
  ShortRoundProvider,
  ShortRoundSidekick,
  type SidekickComponents,
  useShortRoundComponents,
  useShortRoundToast
} from '@shortround/react';
import type { ComponentProps } from 'react';

declare const catalogText: string;

// Bindings may hold data next to their functions, such as a store's state.
const bindings = {
  app: {
    search: { query: 'react', setSort: (sortId: string) => {}, setMatch: (mode: string) => {} },
    sortOptions: {
      rows: (): PickerRow[] => [
        { value: 'relevance', title: 'Relevance' },
        { value: 'created-newest', title: 'Created (newest)', isApplied: true }
      ]
    }
  }
};

const palette = buildPalette(loadCatalog(catalogText, bindings), {
  panels: { sidecar: () => null },
  backIntentionId: 'back',
  fallback: (text, { matches, stateName }) =>
    matches.length ? [] : [{ id: `chat::${stateName}`, title: `Send: ${text}`, action: () => ({}) }]
});

// The catalog's own resolver types stay reachable beside core's, which share their old names.
export const catalogResolveInput: CatalogResolveInput = palette.resolveInput;
export const catalogResolveFallbackInput: CatalogResolveFallbackInput | undefined =
  palette.resolveFallbackInput;

// What the README passes to ShortRoundSidekick.
export const defaultIntentions: Intention[] = palette.intentions;
export const resolveDefaultInput: ResolveInput = palette.resolveInput;
export const resolveDefaultFallbackInput: ResolveFallbackInput | undefined =
  palette.resolveFallbackInput;

// Themes pass an intention's keywords to cmdk.
export const withKeywords: Intention = {
  id: 'x',
  title: 'X',
  keywords: ['ex'],
  action: () => ({})
};

// Themes show an intention's subtitle (the contract's Item obligation).
export const withSubtitle: Intention = { id: 'y', title: 'Y', subtitle: 'Why', action: () => ({}) };

// The theme an app hands to ShortRoundProvider at its root; below it, the sidekick
// needs no slots and app code shows toasts through `@shortround/react`.
declare const components: SidekickComponents;
export const theme: ShortRoundTheme = {
  components,
  Toast: ({ isOpen, message }) => (isOpen ? message : null)
};
export const root = ShortRoundProvider({ theme, children: null });
export const sidekickUnderRoot = ShortRoundSidekick({ defaultIntentions });
export const showSaved = () => useShortRoundToast().showToast({ message: 'Saved' });
// A package's own slot group, read from the same theme.
export const chatSlots = () => useShortRoundComponents()?.Chat;
// A theme for an app that draws only another package's group: no palette groups.
export const chatOnlyTheme: ShortRoundTheme = {
  components: { Chat: {} },
  Toast: () => null
};
export const misshapenTheme: ShortRoundTheme = {
  // @ts-expect-error a palette group, when given, is still checked against the contract
  components: { SidecarContent: 'not a component' },
  Toast: () => null
};

// Slots that only draw: core hands Input its cmdk input element, tells Item whether its
// row is selected, and gives ControlBar the controls' names.
type PaletteSlots = SidekickComponents['IntentionPalette'];
type ControlBarProps = ComponentProps<SidekickComponents['Sidekick']['ControlBar']>;
export const drawOnlyInput: PaletteSlots['Input'] = ({ input, inputMessage }) =>
  inputMessage ? inputMessage.text : input;
export const drawOnlyItem: PaletteSlots['Item'] = ({ intention, isSelected }) =>
  isSelected ? `> ${intention.title}` : intention.title;
export const closeName: string = ({} as ControlBarProps).labels.close;
export const fullSizeName: string = ControlLabels.sizes.full;

// A catalog can be checked without the app, e.g. by a review tool; it keeps its commands as written.
export const commandsAsWritten: Record<string, { label: string; run?: string }> =
  checkCatalog(catalogText).commands;

// Catalog version 3: the palette follows the app's state, and the sidekick takes it whole.
export const listForStatesNow: Intention[] = palette.current().intentions;
palette.notify();
export const stopListening: () => void = palette.subscribe(() => {});
export const canOpen: boolean = palette.isAvailable('open');
export const listNow: Intention[] = palette.listNow();
export const sidekickWithPalette = ShortRoundSidekick({ palette });
const followingStore = createPaletteStore({ palette });
export const stopWatching: () => void = followingStore.watchPalette();
followingStore.refresh();
// One reading and the highlight: the store's line, typing with a caret, and the highlighted row.
export const storeLine: CommandLine | null = followingStore.commandLine();
followingStore.changeInput('open', 2);
followingStore.highlight('app.open');
export const highlighted: string | undefined = followingStore.getState().highlightedId;

// A step result says which kind of list it brings, and which command it belongs to.
export const pickerStep: IntentionActionResult = {
  intentions: [],
  listKind: 'picker',
  command: { name: 'open', label: 'Open' }
};

// The command builder on its own, for a host that isn't the palette.
const engine = makeCommandBuilder({
  commands: [
    {
      name: 'find',
      label: 'Find',
      aliases: [],
      run: 'app.find',
      params: {
        term: { label: 'Term', default: true, argSource: { freeform: true, type: 'text' } }
      }
    }
  ],
  lookups: {}
});
const read = engine.read('find grid');
export const firstArgs: Record<string, unknown> | undefined = read.readings[0]?.call.args;
export const nextLabels: string[] = read.nextSteps.map((step) => step.label);
export const stillTyping: string[] = read.incomplete;
export const stopEngine: () => void = engine.subscribe(() => {});
engine.invalidate();

// Examples name the call a line runs.
export const failures = findExampleFailures(palette, loadExamples('examples: []'));
export const meant: Record<string, Record<string, unknown>> | undefined = failures[0]?.means;
export const ran: Record<string, Record<string, unknown>> | undefined = failures[0]?.got;
// Commands a typed line can't reach, from a checked or a loaded catalog.
export const untyped: Array<{ command: string; label: string }> = findUntypedCommands(
  checkCatalog(catalogText)
);
export const untypedLoaded = findUntypedCommands(loadCatalog(catalogText, bindings));
export const invalidToolNames: Array<{ command: string; reason: string }> = findInvalidToolNames(
  checkCatalog(catalogText)
);

// A custom UI: the palette store proposes side panels to the sidekick store it is given, and the app's reducer decides
// (core's README).
const sidekickStore = createSidekickStore();
sidekickStore.setSidecarReducer((current, proposed, { reason }) =>
  reason === 'back' ? current : proposed
);
sidekickStore.changeSidecar({ renderer: null }, 'app');
sidekickStore.clearSidecar();
export const chosen = createPaletteStore({ defaultIntentions }).select('x', { sidekickStore });

// A run function may be async.
export const asyncOutcome: RunOutcome = Promise.resolve({ message: 'Sorted' });

// A run may answer a model apart from the user: `output` for the model, `message` for the user.
export const readOutcome: RunOutcome = { message: 'Found 2 notes', output: { total: 2 } };

// The catalog's own shapes, as an app that builds or reads one in TypeScript names them. A list value may keep an id
// with `path.id` (MIGRATING.md, "From a v2 catalog").
export const matchSource: ArgSource = {
  list: [{ value: 'any', title: 'any', aliases: ['either'], path: { id: 'app.matchAny' } }]
};
export const limitParam: CatalogParam = {
  label: 'Limit',
  nullable: ['all', 'every'],
  argSource: { freeform: true, type: 'integer', minimum: 1, maximum: 50 }
};
export const nameParam: CatalogParam = { label: 'Name', argSource: { freeform: true, maxLength: 40 } };
export const tagsParam: CatalogParam = {
  label: 'Tag',
  list: true,
  minItems: 1,
  required: true,
  argSource: { freeform: true }
};
export const nowList: PaletteNow = palette.current();
export const example: CatalogExample = { say: 'sort relevance', means: { search: { sort: 'relevance' } } };
export const loading: BuilderState['pending'] = read.pending;
export const couldNotLoad: BuilderState['failed'] = read.failed;

// The command line: each word's role, the ghost, Tab and Enter; from a builder, or from a palette for the commands
// available now (core's README).
export const firstWord: WordRole | undefined = read.annotations[0];
const line: CommandLine = makeCommandLine({ builder: engine, run: (call) => call.args });
line.change('find gr', 7);
export const lineState: CommandLineState = line.getState();
export const ghost: string | undefined = lineState.ghost;
export const canRun: boolean = lineState.canRun;
export const runs: string | undefined = lineState.top?.call.command;
export const completed: boolean = line.acceptCompletion();
export const submitted: Promise<unknown> = line.submit();
line.cancel();
export const stopLine: () => void = line.subscribe(() => {});
line.dispose();
const paletteLine = palette.commandLine();
paletteLine.change('open');
export const typedRows: Intention[] = paletteLine.rows();
export const candidates: CommandLineState['readings'] = lineState.readings;
paletteLine.dispose();
export const sidekickWithoutHints = ShortRoundSidekick({ palette, disableLineHints: true });

// One runtime for a palette and a chat: the app calls notify() once; the model gets the intentions as tools (core's
// CatalogRuntime).
const runtime: CatalogRuntime = buildCatalogRuntime(loadCatalog(catalogText, bindings));
export const paletteOverRuntime = buildPalette(runtime, { panels: { sidecar: () => null }, backIntentionId: 'back' });
runtime.notify();
export const stopRuntime: () => void = runtime.subscribe(() => {});
export const canShare: boolean = runtime.isAvailable('share');
export const ranShare: Promise<{ message?: string }> = runtime.run('share', { result: 'w1' });
export const ranResult: Promise<RunResult> = runtime.run('share');
const runtimeLine = runtime.commandLine();
export const runtimeRows: Intention[] = runtimeLine.rows();
runtimeLine.dispose();
export const tools: Promise<IntentionTool[]> = runtime.tools();
export const toolSchema: Promise<Record<string, IntentionToolProperty>> = tools.then(
  (built) => built[0].inputSchema.properties
);
export const answer: Promise<IntentionToolAnswer> = runtime.runTool({ toolName: 'share', input: { result: '1' } });
export const requiredFromModel: Promise<string[] | undefined> = tools.then((built) => built[0].inputSchema.required);
export const fewestItems: Promise<number | undefined> = tools.then(
  (built) => built[0].inputSchema.properties.tags?.minItems
);

// The chat line: the keyboard rules and the highlight, for a chat UI of any kind.
const chatLine: ChatLine = makeChatLine({
  runtime,
  showHintForMissing: true,
  onIntentionRun: ({ line, message, output }) => `${line}: ${message} ${JSON.stringify(output)}`,
  onSendAsChat: (text) => text
});
chatLine.change('share hello', 11);
const chatRows: ChatLineRow[] = chatLine.rows();
const highlight: number = moveHighlight(chatRows, chatLine.defaultHighlightIndex(chatRows), 1);
export const firstEnabled: number = firstEnabledIndex(chatRows);
export const sendsAsChat: boolean = chatRows.some((row) => row.id === SEND_AS_CHAT_ROW_ID);
export const handled: boolean | Promise<boolean> = chatLine.pressKey({
  key: 'Enter',
  metaKey: true,
  highlightedRow: chatRows[highlight]
});
chatLine.chooseRow(chatRows[0]);
export const drawn: CommandLineState = drawnLineState(chatLine.getState());
export const awaited: string[] | undefined = drawn.awaiting[0]?.labels;
export const missingLabels: string[] | undefined = (chatRows[0] as CatalogIntention).missing;
export const appOnly: string[] | undefined = drawn.readings[0]?.appNeeds;
chatLine.dispose();

// A host's own input with the line drawn under it.
declare const chatInputRef: { current: HTMLTextAreaElement | null };
export const chatInput = LineInput({ inputRef: chatInputRef, lineState: drawn, children: null });
