// Review page for a catalog (format version 3): states first, each with the commands it offers; planned states and
// commands marked. A command is planned when it says `planned: true`, or when the state listing it does.
import { compileWhen } from '../../../../packages/shortround-core/src/catalog/conditions.js';
import {
  esc,
  renderCollisions,
  renderExamples,
  renderMap,
  renderShell,
  spaced
} from './page-kit.js';

const spokenName = (name, cmd) => cmd?.label ?? spaced(name);

// The engine types a command by its name and its aliases (not its label), so a name is typed only if it is a word.
const isTypedWord = (name) => /^[a-z]+$/.test(name);
const commandWords = (name, cmd) => [...(isTypedWord(name) ? [name] : []), ...(cmd.aliases ?? [])];

// The part of a state's summary before its first semicolon, for the map and the section links.
const shortLabel = (state, id) => state?.summary?.split(';')[0] ?? id;

// A condition in words, for people: each path by its last part ("previewed has service link"), and the operators
// spelled out. The clause has passed the engine's check, so it holds only paths, !, &&, || and parentheses.
const describeWhen = (clause) =>
  clause
    .replace(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g, (path) => spaced(path.split('.').pop()))
    .replace(/!\s*/g, 'not ')
    .replace(/&&/g, 'and')
    .replace(/\|\|/g, 'or');

// The condition functions a clause names, read with the engine's own parser.
function conditionPaths(clause) {
  const paths = [];
  compileWhen(clause, {
    owner: 'review',
    resolve: (path) => {
      paths.push(path);
      return () => true;
    }
  });
  return paths;
}

function commandsFor(catalog, stateId) {
  const state = catalog.states[stateId];
  return state.commands.map((name) => {
    const cmd = catalog.commands[name];
    return { name, cmd, planned: Boolean(state.planned || cmd.planned) };
  });
}

const allCommands = (catalog) =>
  Object.keys(catalog.states).flatMap((stateId) =>
    commandsFor(catalog, stateId).map((entry) => ({ ...entry, stateId }))
  );

const paramsOf = (cmd) => Object.entries(cmd.params ?? {});

// How many picking rows a command makes: one, unless it has several params (a row each, or a row per value).
function rowCountOf(cmd) {
  const params = paramsOf(cmd);
  if (params.length <= 1) {
    return 1;
  }
  return params.reduce(
    (count, [, param]) =>
      count + (param.path?.rows === 'each value' ? (param.argSource.list?.length ?? 1) : 1),
    0
  );
}

const paletteRowCount = (catalog, stateId) =>
  commandsFor(catalog, stateId)
    .filter((entry) => !entry.planned)
    .reduce((count, { cmd }) => count + rowCountOf(cmd), 0);

const isFreeformText = (param) =>
  Boolean(param.argSource.freeform) && (param.argSource.type ?? 'text') === 'text';

function describeSource(argSource) {
  if (argSource.freeform) {
    return `typed ${argSource.type ?? 'text'}`;
  }
  if (argSource.list) {
    return `one of: ${argSource.list.map((entry) => entry.title).join(', ')}`;
  }
  const parts = [
    argSource.lookup &&
      `rows from ${argSource.lookup}${argSource.key ? ` (key ${argSource.key})` : ''}`,
    argSource.current && `the app's current one from ${argSource.current}`
  ];
  return parts.filter(Boolean).join('; or ');
}

// Planned states' guided steps may name the state they lead to: the only moves the catalog states.
function buildMermaid(catalog) {
  const lines = ['flowchart LR', '  paletteOpens(("Palette opens"))'];
  const states = Object.entries(catalog.states);
  for (const [id, state] of states) {
    const condition = state.when ? `<br/>while ${describeWhen(state.when)}` : '';
    lines.push(
      `  ${stateNode(id)}(["${mermaidLabel(shortLabel(state, id))}${mermaidLabel(condition)}"])`
    );
  }
  const startState = states.find(([, state]) => state.start)?.[0];
  if (startState) {
    lines.push(`  paletteOpens --> ${stateNode(startState)}`);
  }
  for (const [id, state] of states) {
    for (const step of state.steps ?? []) {
      if (step.then) {
        lines.push(`  ${stateNode(id)} -.->|"finish"| ${stateNode(step.then)}`);
      }
    }
  }
  const plannedStates = states.filter(([, state]) => state.planned).map(([id]) => stateNode(id));
  if (plannedStates.length) {
    lines.push('  classDef planned stroke-dasharray: 5 4');
    lines.push(`  class ${plannedStates.join(',')} planned`);
  }
  return lines.join('\n');
}

// Mermaid ends a label at a double quote and reserves some words (`end`), so labels use its entity for `"` and
// state ids get a prefix.
const mermaidLabel = (text) => String(text).replaceAll('"', '#quot;');
const stateNode = (id) => `s_${id}`;

// The words a user types in one state: each command's name (if a word) and aliases, and each param's label and
// aliases, which imply their command. A param's hints introduce whichever param follows, so they belong to the
// command. Collisions only matter within one state: the palette reads one state's commands at a time.
// → { word: Map(command name → Set(param label, or null for the command itself)) }
function wordsOfState(catalog, stateId) {
  const owners = {};
  const claim = (word, commandName, paramLabel) => {
    const byCommand = (owners[word.toLowerCase()] ??= new Map());
    byCommand.set(commandName, (byCommand.get(commandName) ?? new Set()).add(paramLabel));
  };
  for (const { name, cmd } of commandsFor(catalog, stateId)) {
    const commandName = spokenName(name, cmd);
    commandWords(name, cmd).forEach((word) => claim(word, commandName, null));
    for (const [, param] of paramsOf(cmd)) {
      [param.label, ...(param.aliases ?? [])].forEach((word) =>
        claim(word, commandName, param.label)
      );
      (param.hints ?? []).forEach((word) => claim(word, commandName, null));
    }
  }
  return owners;
}

// Who a word names, for people: "Search: Sort", or the command alone. A command's own word and one of its params'
// read the same command, so the param names it.
function ownersOf(byCommand) {
  return [...byCommand].flatMap(([commandName, paramLabels]) => {
    const params = [...paramLabels].filter(Boolean);
    return params.length ? params.map((label) => `${commandName}: ${label}`) : [commandName];
  });
}

// A word means two things when two commands claim it, or two params of one command do.
const isAmbiguous = (byCommand) => ownersOf(byCommand).length > 1;

function findCollisions(catalog) {
  return Object.entries(catalog.states).flatMap(([stateId, state]) => {
    const words = wordsOfState(catalog, stateId);
    const owners = Object.fromEntries(
      Object.entries(words).map(([word, byCommand]) => [word, new Set(ownersOf(byCommand))])
    );
    const where = shortLabel(state, stateId);
    const sameWord = Object.keys(words)
      .filter((word) => isAmbiguous(words[word]))
      .map((word) => ({
        word,
        detail: `(${where}) can mean “${[...owners[word]].join('” or “')}”`
      }));
    const allWords = Object.keys(words);
    // A short word inside a longer phrase of the same command (Label, label selected) reads that command either way.
    const startOfLonger = allWords.flatMap((short) =>
      allWords
        .filter(
          (long) =>
            long.startsWith(`${short} `) &&
            [...words[short].keys()].some((command) => !words[long].has(command))
        )
        .map((long) => ({
          word: short,
          detail: `(${where}) “${[...owners[short]].join('” / “')}” is also the start of “${long}” (“${[...owners[long]].join('” / “')}”)`
        }))
    );
    return [...sameWord, ...startOfLonger];
  });
}

// A command no typed line can name, and a param that can't follow the typed text.
function findUntypeable(catalog) {
  return Object.entries(catalog.commands).flatMap(([name, cmd]) => {
    const commandName = spokenName(name, cmd);
    const unnamed = commandWords(name, cmd).length
      ? []
      : [
          {
            word: name,
            detail: `${commandName}: its name isn't a word people type, and it has no aliases. Add the phrase people use, such as “${cmd.label.toLowerCase()}”.`
          }
        ];
    const term = paramsOf(cmd).find(([, param]) => param.default && isFreeformText(param));
    const unhinted = term
      ? paramsOf(cmd)
          .filter(([key, param]) => key !== term[0] && !param.hints?.length)
          .map(([, param]) => ({
            word: param.label.toLowerCase(),
            detail: `${commandName}: ${param.label} can't follow the ${term[1].label.toLowerCase()} words, which read up to a hint or a closing quote. Add hints that introduce it, such as “with”.`
          }))
      : [];
    return [...unnamed, ...unhinted];
  });
}

// Every function the catalog names, with where it's used: the service layer's interface. A function is planned
// when every use of it is planned.
function collectFunctions(catalog) {
  const functions = new Map();
  const addUse = (name, use, planned) => {
    if (!name) {
      return;
    }
    const entry = functions.get(name) ?? { uses: [], planned: true };
    functions.set(name, { uses: [...entry.uses, use], planned: entry.planned && planned });
  };
  for (const [stateId, state] of Object.entries(catalog.states)) {
    const planned = Boolean(state.planned);
    if (state.when) {
      conditionPaths(state.when).forEach((path) =>
        addUse(path, `${stateId}: holds while`, planned)
      );
    }
    (state.steps ?? []).forEach((step) => addUse(step.run, `${stateId}: guided-flow step`, true));
  }
  const plannedCommands = new Set(
    allCommands(catalog)
      .filter((entry) => entry.planned)
      .map((entry) => entry.name)
  );
  for (const [name, cmd] of Object.entries(catalog.commands)) {
    const commandName = spokenName(name, cmd);
    const planned = Boolean(cmd.planned) || plannedCommands.has(name);
    addUse(cmd.run, `${commandName}: runs`, planned);
    if (cmd.when) {
      conditionPaths(cmd.when).forEach((path) =>
        addUse(path, `${commandName}: offered while`, planned)
      );
    }
    for (const [, param] of paramsOf(cmd)) {
      addUse(param.argSource.lookup, `${commandName}: ${param.label} rows`, planned);
      addUse(param.argSource.current, `${commandName}: ${param.label} now`, planned);
    }
  }
  return [...functions].sort(([a], [b]) => a.localeCompare(b));
}

function renderFunctions(functions) {
  const items = functions
    .map(
      ([name, { uses, planned }]) =>
        `<li><code>${esc(name)}</code>${planned ? '<span class="badge planned">Planned</span>' : ''}<span class="runtime">${uses.map(esc).join(' · ')}</span></li>`
    )
    .join('');
  return `<ul class="functions">${items || '<li>None.</li>'}</ul>`;
}

// An example's `means` is one call: `{ <command>: { <param>: arg } }`. Examples are read in the start state.
function groupExamplesByCommand(catalog, examples) {
  const startState = Object.entries(catalog.states).find(([, state]) => state.start)?.[0];
  const names = new Set(startState ? catalog.states[startState].commands : []);
  const byCommand = {};
  let unmatchedCount = 0;
  for (const example of examples) {
    const [command] = Object.keys(example.means);
    if (!names.has(command)) {
      unmatchedCount += 1;
      continue;
    }
    (byCommand[command] ??= []).push(example);
  }
  return { byCommand, unmatchedCount };
}

// `tier` (common | full) marks the everyday view; a command without one inherits its state's tier.
const TIER_LABELS = { common: 'Everyday', full: 'Full catalog' };

const usesTiers = (catalog) =>
  Object.values(catalog.states).some((state) => state.tier) ||
  Object.values(catalog.commands).some((cmd) => cmd.tier);

const tierBadge = (tier) =>
  tier ? `<span class="badge tier-${esc(tier)}">${esc(TIER_LABELS[tier] ?? tier)}</span>` : '';

function renderParam([key, param]) {
  const traits = [
    param.default && 'takes the bare words',
    param.list && 'several',
    param.required && 'required'
  ].filter(Boolean);
  const words = [
    `${[param.label, ...(param.aliases ?? [])].map(esc).join(', ')}`,
    param.hints?.length && `after: ${param.hints.map(esc).join(', ')}`
  ].filter(Boolean);
  return `<li><b>${esc(param.label)}</b> <span class="aka">(${esc(key)})</span> ${esc(describeSource(param.argSource))}${traits.length ? ` · ${traits.map(esc).join(', ')}` : ''}<span class="runtime">words: ${words.join(' · ')}</span>${param.summary ? `<span class="runtime">${esc(param.summary)}</span>` : ''}</li>`;
}

function renderCommand(catalog, { name, cmd, planned }, { stateTier, examples }) {
  const tier = cmd.tier ?? stateTier;
  const flags = [planned && 'planned', cmd.when && `only while ${describeWhen(cmd.when)}`].filter(
    Boolean
  );
  const params = paramsOf(cmd);
  const exampleItems = renderExamples(examples);
  const typed = commandWords(name, cmd);
  const language = `<details class="language">
        <summary>How you say it</summary>
        <dl>
          <div><dt>command words</dt><dd>${typed.length ? typed.map(esc).join(', ') : 'none: no typed line names it'}</dd></div>
          <div><dt>runs</dt><dd>${cmd.run ? `<code>${esc(cmd.run)}</code>` : 'not named yet'}</dd></div>${cmd.group ? `<div><dt>group</dt><dd>${esc(catalog.groups[cmd.group]?.label ?? cmd.group)}</dd></div>` : ''}
        </dl>
      </details>`;
  return `
    <article class="command${planned ? ' is-planned' : ''}" id="cmd-${esc(name)}"${tier ? ` data-tier="${esc(tier)}"` : ''}>
      <header class="command-head">
        <h3>${esc(cmd.summary ?? spokenName(name, cmd))}</h3>${tier === 'full' ? tierBadge(tier) : ''}
        ${flags.length ? `<span class="flags">${flags.map(esc).join(' · ')}</span>` : ''}
      </header>
      ${params.length ? `<ul class="params" aria-label="What it takes">${params.map(renderParam).join('')}</ul>` : ''}
      ${cmd.review ? `<p class="review-note">To revisit: ${esc(cmd.review)}</p>` : ''}
      ${exampleItems ? `<ul class="examples">${exampleItems}</ul>` : ''}
      ${language}
    </article>`;
}

function renderStateMeta(state) {
  const parts = [
    state.start && ['Starts here', 'when the palette opens'],
    state.when && ['Holds while', describeWhen(state.when)],
    state.panel && ['Shows', state.panel === 'sidecar' ? 'the side panel' : state.panel]
  ].filter(Boolean);
  return `<div class="state-meta">${parts.map(([label, value]) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`).join('')}</div>`;
}

function describeStep(step) {
  if (step.ask?.text) {
    return `asks for text: “${step.ask.text}”`;
  }
  if (step.ask?.choose) {
    return `picks from: ${spaced(step.ask.choose)}`;
  }
  return `runs ${step.run ?? '(not named yet)'}${step.then ? `, then ${step.then}` : ''}`;
}

function renderSteps(steps) {
  const items = steps.map((step) => `<li class="step">${esc(describeStep(step))}</li>`).join('');
  return `<article class="command is-planned"><header class="command-head"><h3>Steps, in order</h3><span class="flags">guided flow</span></header><ol class="steps">${items}</ol></article>`;
}

function renderState(catalog, stateId, state, examplesByCommand) {
  const isPlanned = Boolean(state.planned);
  const rows = isPlanned ? null : paletteRowCount(catalog, stateId);
  const commands = commandsFor(catalog, stateId)
    .map((entry) =>
      renderCommand(catalog, entry, {
        stateTier: state.tier,
        examples: state.start ? (examplesByCommand[entry.name] ?? []) : []
      })
    )
    .join('');
  return `
  <section class="group" id="state-${esc(stateId)}"${state.tier ? ` data-tier="${esc(state.tier)}"` : ''}>
    <div class="state-head">
      <h2>${esc(state.summary ?? stateId)} <span class="badge ${isPlanned ? 'planned' : 'built'}">${isPlanned ? 'Planned' : 'Built'}</span>${tierBadge(state.tier)}</h2>
      ${renderStateMeta(state)}
      ${rows !== null ? `<div class="state-meta"><span>Palette rows today: <b>${rows}</b></span></div>` : ''}
      ${state.review ? `<p class="review-note">To revisit: ${esc(state.review)}</p>` : ''}
    </div>
    ${commands}
    ${state.steps ? renderSteps(state.steps) : ''}
  </section>`;
}

// Workflows name the state each step happens in, so a path through the states is visible.
function renderWorkflow(catalog, [id, workflow]) {
  const steps = workflow.steps ?? workflow.options ?? [];
  const items = steps
    .map((step) => {
      const where = step.state
        ? `<span class="where">${esc(shortLabel(catalog.states[step.state], step.state))}</span>`
        : '';
      const then = step.then
        ? `<span class="then">then: ${[step.then].flat().map(esc).join(' · ')}</span>`
        : '';
      return `
      <li class="step">
        <div class="available">${where}<span class="question">${esc(step.question)}</span></div>
        <code class="say"><span class="prompt" aria-hidden="true">⌘K</span>${esc(step.do)}</code>
        ${then}
      </li>`;
    })
    .join('');
  const list = workflow.steps
    ? `<ol class="steps">${items}</ol>`
    : `<ul class="steps options">${items}</ul>`;
  const kind = workflow.steps ? 'Steps, in order' : 'Places to start';
  return `
    <article class="command workflow" id="wf-${esc(id)}">
      <header class="command-head"><h3>${esc(workflow.title ?? spaced(id))}</h3><span class="flags">${kind}</span></header>
      ${list}
    </article>`;
}

const TIER_TOGGLE = `<div class="tier-toggle">
    <label for="common-only"><input id="common-only" type="checkbox"> Show the everyday view only (hide commands and states tagged “Full catalog”)</label>
  </div>
  <script>
    document.getElementById('common-only').addEventListener('change', (event) => {
      document.body.classList.toggle('common-only', event.target.checked);
    });
  </script>`;

function countCatalog(catalog, examples) {
  const states = Object.entries(catalog.states);
  return {
    builtStates: states.filter(([, state]) => !state.planned).length,
    plannedStates: states.filter(([, state]) => state.planned).length,
    builtRows: states.reduce((count, [id]) => count + paletteRowCount(catalog, id), 0),
    plannedCommands: allCommands(catalog).filter((entry) => entry.planned).length,
    examples: examples.length
  };
}

function renderWorkflows(catalog) {
  if (!catalog.workflows) {
    return '';
  }
  return `<section id="workflows" class="group">
    <h2>Workflows</h2>
    <p class="section-note">Named paths through the states. Each step shows the state it happens in and what you'd type.</p>
    ${Object.entries(catalog.workflows)
      .map((entry) => renderWorkflow(catalog, entry))
      .join('')}
  </section>`;
}

export function renderStatesPage(catalog, examples = []) {
  const states = Object.entries(catalog.states);
  const counts = countCatalog(catalog, examples);
  const { byCommand, unmatchedCount } = groupExamplesByCommand(catalog, examples);
  const collisions = findCollisions(catalog);
  const untypeable = findUntypeable(catalog);
  const functions = collectFunctions(catalog);

  const body = `
  ${usesTiers(catalog) ? TIER_TOGGLE : ''}
  <section id="map">
    <h2>The states</h2>
    <p class="section-note">Each box is a state: a context the user is in, with its own list of commands. A state holds while its condition does, so the app's own state decides the list; the catalog doesn't say which command changes a condition. Dashed boxes are planned, not built.</p>
    ${renderMap(buildMermaid(catalog))}
  </section>

  <div id="states" class="groups">
    ${states.map(([id, state]) => renderState(catalog, id, state, byCommand)).join('')}
  </div>

  ${renderWorkflows(catalog)}

  <section id="collisions">
    <h2>Words that mean two things</h2>
    <p class="section-note">Checked within each state, since the palette reads one state's commands at a time. Includes command names and aliases, and each param's label, aliases and hints.</p>
    ${renderCollisions(collisions)}
  </section>

  <section id="untypeable">
    <h2>Words nobody can type</h2>
    <p class="section-note">A typed line names a command by its name or an alias, not its label. A param after unquoted typed text needs a hint (such as “with”) to start it; after a closing quote, the param's own word (such as “kind”) starts it too.</p>
    ${renderCollisions(untypeable)}
  </section>

  <section id="functions">
    <h2>Functions the catalog names</h2>
    <p class="section-note">Every <code>run</code>, <code>lookup</code> and <code>current</code>, and each condition in a <code>when</code>: the interface of the app's service layer. Each must exist in the app, or be written, before the catalog runs. Check the spelling here; nothing else does until the app loads the catalog.</p>
    ${renderFunctions(functions)}
  </section>`;

  return {
    summary: `${counts.builtStates} states, ${counts.plannedStates} planned states, ${counts.builtRows} palette rows, ${counts.examples} examples (${unmatchedCount} unmatched), ${collisions.length} words that mean two things, ${untypeable.length} words nobody can type, ${functions.length} functions named`,
    html: renderShell({
      app: catalog.app,
      version: catalog.version,
      sourceName: catalog.sourceName,
      lede: 'Organized by state: the context you are in decides which commands the palette offers. Check each state against how you expect to move through the app: what should be available here, and what should not?',
      stats: [
        [counts.builtStates, 'states built'],
        [counts.plannedStates, 'states planned'],
        [counts.builtRows, 'palette rows built'],
        [counts.plannedCommands, 'commands planned'],
        [counts.examples, 'examples'],
        unmatchedCount && [unmatchedCount, 'examples matching no start-state command'],
        [collisions.length, 'words that mean two things'],
        [untypeable.length, 'words nobody can type'],
        [functions.length, 'functions named']
      ].filter(Boolean),
      nav: [
        ['map', 'States'],
        ...states.map(([id, state]) => [
          `state-${id}`,
          `${shortLabel(state, id)}${state.planned ? ' (planned)' : ''}`
        ]),
        catalog.workflows && ['workflows', 'Workflows'],
        ['collisions', 'Words that mean two things'],
        ['untypeable', 'Words nobody can type'],
        ['functions', 'Functions']
      ].filter(Boolean),
      body
    })
  };
}
