import { makeCallArgs } from './call-args.js';
import { makeInputResolver } from './resolve-input.js';

// Builds ShortRound intentions from a loaded catalog: the start state's list, and from there every
// list a user can reach. Lists are built when they are shown, so `when` conditions and picker rows
// reflect the app as it is at that moment.
//
// Returns the start list and its input resolver (typed text → rows); every state result carries the
// resolver for the state it shows.
//
// The app supplies what the engine cannot know: renderers for panels (`panels.sidecar`) and the id
// of ShortRound's built-in Back row (`backIntentionId`), so the engine needs no UI package. It may
// name the state the list starts in (`startState`, such as the page the user is on); otherwise it is
// the catalog's start state. Its `fallback` (optional) adds rows after a state's matches, such as
// "Send as chat"; pickers and text steps don't get it.
export function buildPalette(
  catalog,
  { panels = {}, backIntentionId, startState = catalog.startState, fallback }
) {
  checkAppSupplies(catalog, { panels, backIntentionId, startState });
  const { listState, resolverFor, fallbackFor } = makeStateLists(catalog, {
    panels,
    backIntentionId,
    fallback
  });
  // A start state with a panel opens with it: the app passes it as ShortRoundSidekick's defaultSidecarRenderer.
  const startPanel = catalog.states[startState].panel;
  return {
    intentions: listState(startState),
    resolveInput: resolverFor(startState),
    ...(fallback && { resolveFallbackInput: fallbackFor(startState) }),
    ...(startPanel && { sidecarRenderer: panels[startPanel] })
  };
}

// Fail when the list is built, not when a user reaches a panel state or a picker. A loaded catalog
// has no planned states, so a planned start state is caught as a missing one.
function checkAppSupplies(catalog, { panels, backIntentionId, startState }) {
  if (!backIntentionId) {
    throw new Error('buildPalette needs backIntentionId');
  }
  if (!catalog.states[startState]) {
    throw new Error(
      `buildPalette: start state "${startState}" is not a built state of the catalog`
    );
  }
  for (const [name, state] of Object.entries(catalog.states)) {
    if (state.panel && !panels[state.panel]) {
      throw new Error(
        `Catalog state "${name}" shows panel "${state.panel}", but the app supplies no renderer for it`
      );
    }
  }
}

function makeStateLists(catalog, { panels, backIntentionId, fallback }) {
  // The app's fallback, told which state's list it is adding to.
  const fallbackFor = (stateName) =>
    fallback && ((text, { matches }) => fallback(text, { matches, stateName }));

  const listEntries = (stateName) =>
    Object.entries(catalog.states[stateName].commands)
      .flatMap(([name, command]) => expandCommand(name, command))
      .filter(isListed);

  const listState = (stateName) =>
    listEntries(stateName).map((entry) => toIntention(entry, stateName));

  const resolverFor = (stateName) =>
    makeInputResolver({
      catalog,
      stateName,
      listEntries: () => listEntries(stateName),
      runEntry: (entry, value) => runCommand(entry, stateName, value),
      runLine: (steps) => runLine(steps, stateName)
    });

  // A forEach command becomes one entry per facet; `key` is that facet.
  function expandCommand(name, command) {
    const id = `${catalog.app}.${name}`;
    if (!command.forEach) {
      return [
        { id, title: command.title, aliases: command.aliases ?? [], key: undefined, command }
      ];
    }
    return Object.entries(catalog.facets).map(([key, facet]) => ({
      id: `${id}.${key}`,
      title: facet.title,
      aliases: facet.aliases ?? [],
      key,
      command
    }));
  }

  const isListed = ({ command }) => !command.when || command.when();

  const toIntention = (entry, stateName) => ({
    id: entry.id,
    title: entry.title,
    aliases: entry.aliases,
    group: entry.command.group,
    icon: entry.command.icon,
    action: () => startCommand(entry, stateName)
  });

  function startCommand(entry, stateName) {
    const { ask } = entry.command;
    if (ask?.choose) {
      return offerPicker(entry, stateName);
    }
    if (ask?.text) {
      return askForText(entry, stateName);
    }
    return runCommand(entry, stateName);
  }

  async function offerPicker(entry, stateName) {
    const picker = catalog.pickers[entry.command.ask.choose];
    // Applied values are already in effect, like items in a cart, so they aren't offered again.
    const rows = (await picker.from({ key: entry.key, facets: catalog.facets })).filter(
      (row) => !row.isApplied
    );
    if (!rows.length) {
      return stateResult(stateName, stateName, fillMessage(picker.empty, entry));
    }
    return {
      intentions: rows.map((row) => toRowIntention(row, entry, stateName)),
      includeRevertIntentions: [backIntentionId],
      listKind: 'picker'
    };
  }

  // A row whose value is not a string names itself with `key`.
  const toRowIntention = (row, entry, stateName) => ({
    id: `${entry.id}::${row.key ?? row.value}`,
    title: row.title,
    subtitle: row.subtitle,
    aliases: row.aliases,
    group: entry.command.group,
    icon: entry.command.icon,
    action: () => runCommand(entry, stateName, row.value)
  });

  // `required` re-asks with its message on a blank entry. The step is never disabled: cmdk never
  // highlights a disabled row, so Enter would land on Back.
  function askForText(entry, stateName, message) {
    const { text, required } = entry.command.ask;
    const step = {
      id: `${entry.id}::text`,
      title: text,
      group: entry.command.group,
      icon: entry.command.icon,
      action: (typed) => {
        const trimmed = typed.trim();
        if (!trimmed && required) {
          return askForText(entry, stateName, required);
        }
        return runCommand(entry, stateName, trimmed);
      }
    };
    return {
      intentions: [step],
      disableInputMatching: true,
      includeRevertIntentions: [backIntentionId],
      message,
      listKind: 'text'
    };
  }

  // Called with the command's `args`, or else the forEach key and the asked value (call-args.js). A
  // run may return { message, isCancelled, sideEffects }: a cancelled run stays in the state it was
  // listed in; its side effects apply either way.
  async function runCommand(entry, stateName, askedValue) {
    const outcome = await runOutcome(entry, askedValue);
    const nextState = outcome.isCancelled ? stateName : (entry.command.then ?? stateName);
    return stateResult(nextState, stateName, outcome.message, outcome.sideEffects);
  }

  // A line's commands all stay in this state; they run in order, and a cancelled one stops the rest.
  // The last command that returns side effects decides them.
  async function runLine(steps, stateName) {
    const messages = [];
    let sideEffects;
    for (const { entry, value } of steps) {
      const outcome = await runOutcome(entry, value);
      if (outcome.message) {
        messages.push(outcome.message);
      }
      sideEffects = outcome.sideEffects ?? sideEffects;
      if (outcome.isCancelled) {
        break;
      }
    }
    return stateResult(stateName, stateName, messages.join('; ') || undefined, sideEffects);
  }

  async function runOutcome({ command, key }, askedValue) {
    const args = makeCallArgs(command.args, { key, value: askedValue });
    return (await command.run(...args)) ?? {};
  }

  // A run's own side effects win over the ones its state's panel would set.
  const stateResult = (nextState, fromState, message, runSideEffects) => ({
    intentions: listState(nextState),
    resolveInput: resolverFor(nextState),
    resolveFallbackInput: fallbackFor(nextState),
    listKind: 'state',
    message,
    sideEffects: runSideEffects ?? panelEffects(nextState, fromState)
  });

  function panelEffects(nextState, fromState) {
    const panel = catalog.states[nextState].panel;
    if (panel) {
      return { sidecarRenderer: panels[panel] };
    }
    if (catalog.states[fromState].panel) {
      return { closeSidecar: true };
    }
    return undefined;
  }

  return { listState, resolverFor, fallbackFor };
}

// "No {title} values" reads mid-sentence, so the title is lower case there.
const fillMessage = (template, entry) => template.replaceAll('{title}', entry.title.toLowerCase());
