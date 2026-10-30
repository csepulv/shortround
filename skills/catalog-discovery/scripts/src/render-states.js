// Review page for a catalog: states first, each with its commands; planned states and commands marked.
// A state or command is planned when it says `planned: true`, or (for a command) when its state does.
import {
  asList,
  esc,
  renderCollisions,
  renderExamples,
  renderMap,
  renderShell,
  spaced
} from './page-kit.js';

const ANYWHERE_MIN = 3; // the same command on this many states → one "From anywhere" arrow on the map

const spokenName = (id, cmd) => cmd.title ?? spaced(id);

// The part of a state's summary before its first semicolon, for the map and the section links.
const shortLabel = (state, id) => state?.summary?.split(';')[0] ?? id;
const stateSummary = (catalog, id) => catalog.states?.[id]?.summary ?? id;

function commandsFor(catalog, stateId) {
  const state = catalog.states?.[stateId] ?? {};
  return Object.entries(state.commands ?? {}).map(([id, cmd]) => ({
    id,
    cmd,
    planned: Boolean(state.planned || cmd.planned)
  }));
}

const allCommands = (catalog) =>
  Object.keys(catalog.states ?? {}).flatMap((stateId) =>
    commandsFor(catalog, stateId).map((entry) => ({ ...entry, stateId }))
  );

// A `forEach: facets` command stands for one palette row per facet.
const facetEntries = (catalog, cmd) =>
  cmd.forEach === 'facets' ? Object.entries(catalog.facets ?? {}) : [];

const paletteRowCount = (catalog, stateId) =>
  commandsFor(catalog, stateId)
    .filter((entry) => !entry.planned)
    .reduce((count, { cmd }) => count + (facetEntries(catalog, cmd).length || 1), 0);

function describeAsk(catalog, ask) {
  if (ask?.text) {
    return `asks for text: “${ask.text}”${ask.required ? ` (required: “${ask.required}”)` : ''}`;
  }
  if (ask?.choose) {
    const isPlannedList = catalog.pickers?.[ask.choose]?.planned;
    return `picks from: ${spaced(ask.choose)}${isPlannedList ? ' (planned list)' : ''}`;
  }
  return null;
}

// Commands with the same name and destination on many states are navigation, not a path.
function findAnywhereCommands(catalog) {
  const counts = new Map();
  for (const { id, cmd } of allCommands(catalog)) {
    if (cmd.then) {
      const key = `${spokenName(id, cmd)}->${cmd.then}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, count]) => count >= ANYWHERE_MIN).map(([key]) => key));
}

// Mermaid ends a label at a double quote and reserves some words (`end`), so labels use its entity for `"` and
// state ids get a prefix.
const mermaidLabel = (text) => String(text).replaceAll('"', '#quot;');
const stateNode = (id) => `s_${id}`;

function buildMermaid(catalog) {
  const lines = ['flowchart LR', '  paletteOpens(("Palette opens"))'];
  const states = Object.entries(catalog.states ?? {});
  for (const [id, state] of states) {
    lines.push(`  ${stateNode(id)}(["${mermaidLabel(shortLabel(state, id))}"])`);
  }
  const startState = states.find(([, state]) => state.start)?.[0];
  if (startState) {
    lines.push(`  paletteOpens --> ${stateNode(startState)}`);
  }

  const edges = new Map();
  const addEdge = (from, to, label, planned) => {
    // A command whose `then` names its own state (e.g. drilling from one item to a related one) draws a loop.
    if (!to) {
      return;
    }
    const key = `${from}->${to}->${planned ? 'p' : 'b'}`;
    edges.set(key, [...(edges.get(key) ?? []), label]);
  };
  const anywhere = findAnywhereCommands(catalog);
  for (const { id, cmd, planned, stateId } of allCommands(catalog)) {
    const name = spokenName(id, cmd);
    const from = anywhere.has(`${name}->${cmd.then}`) ? 'anywhere' : stateNode(stateId);
    addEdge(from, cmd.then && stateNode(cmd.then), name, planned);
  }
  for (const [stateId, state] of states) {
    for (const step of state.steps ?? []) {
      addEdge(stateNode(stateId), step.then && stateNode(step.then), 'finish', true);
    }
  }
  if (anywhere.size) {
    lines.push('  anywhere(("From anywhere"))');
  }
  for (const [key, labels] of edges) {
    const [from, to, kind] = key.split('->');
    const arrow = kind === 'p' ? '-.->' : '-->';
    lines.push(`  ${from} ${arrow}|"${mermaidLabel([...new Set(labels)].join(' · '))}"| ${to}`);
  }
  const plannedStates = states.filter(([, state]) => state.planned).map(([id]) => stateNode(id));
  if (plannedStates.length) {
    lines.push('  classDef planned stroke-dasharray: 5 4');
    lines.push(`  class ${plannedStates.join(',')} planned`);
  }
  return lines.join('\n');
}

// Collisions only matter within one state: the palette shows one state's list at a time.
function findCollisions(catalog) {
  const collisions = [];
  for (const [stateId, state] of Object.entries(catalog.states ?? {})) {
    const owners = {};
    const claim = (word, owner) => (owners[word.toLowerCase()] ??= new Set()).add(owner);
    for (const { id, cmd } of commandsFor(catalog, stateId)) {
      const facets = facetEntries(catalog, cmd);
      if (facets.length) {
        for (const [, facet] of facets) {
          claim(facet.title, facet.title);
          for (const alias of facet.aliases ?? []) {
            claim(alias, facet.title);
          }
        }
        continue;
      }
      const name = spokenName(id, cmd);
      claim(name, name);
      for (const alias of cmd.aliases ?? []) {
        claim(alias, name);
      }
    }
    const where = shortLabel(state, stateId);
    for (const [word, names] of Object.entries(owners)) {
      if (names.size > 1) {
        collisions.push({ word, detail: `(${where}) can mean “${[...names].join('” or “')}”` });
      }
    }
    const words = Object.keys(owners);
    for (const short of words) {
      for (const long of words) {
        if (
          long.startsWith(`${short} `) &&
          [...owners[short]].some((name) => !owners[long].has(name))
        ) {
          collisions.push({
            word: short,
            detail: `(${where}) “${[...owners[short]].join('” / “')}” is also the start of “${long}” (“${[...owners[long]].join('” / “')}”)`
          });
        }
      }
    }
  }
  return collisions;
}

// Every function the catalog names, with where it's used: the service layer's interface. A function is
// planned when every use of it is planned.
function collectFunctions(catalog) {
  const functions = new Map();
  const addUse = (name, use, planned) => {
    if (!name) {
      return;
    }
    const entry = functions.get(name) ?? { uses: [], planned: true };
    functions.set(name, { uses: [...entry.uses, use], planned: entry.planned && planned });
  };
  for (const [pickerName, picker] of Object.entries(catalog.pickers ?? {})) {
    addUse(picker.from, `rows for ${spaced(pickerName)}`, Boolean(picker.planned));
  }
  for (const { id, cmd, planned, stateId } of allCommands(catalog)) {
    addUse(cmd.run, `${stateId}: ${spokenName(id, cmd)}`, planned);
    addUse(cmd.when, `${stateId}: offered when (${spokenName(id, cmd)})`, planned);
  }
  for (const [stateId, state] of Object.entries(catalog.states ?? {})) {
    for (const step of state.steps ?? []) {
      addUse(step.run, `${stateId}: guided-flow step`, true);
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

// An example's `means` is one intention id or a list (a line of several commands): `<app>.<command>[.<facet>][::<row>]`.
// Examples are checked in the start state, so they are matched to its commands; the longest command name wins.
function groupExamplesByCommand(catalog, examples) {
  const startState = Object.entries(catalog.states ?? {}).find(([, state]) => state.start)?.[0];
  const names = startState ? Object.keys(catalog.states[startState].commands ?? {}) : [];
  const commandOf = (intentionId) => {
    const rest = intentionId.replace(`${catalog.app}.`, '').split('::')[0];
    return names
      .filter((name) => rest === name || rest.startsWith(`${name}.`))
      .sort((a, b) => b.length - a.length)[0];
  };
  const byCommand = {};
  let unmatchedCount = 0;
  for (const example of examples) {
    const commands = new Set(asList(example.means).map(commandOf));
    if (commands.has(undefined)) {
      unmatchedCount += 1;
    }
    for (const name of commands) {
      if (name) {
        (byCommand[name] ??= []).push(example);
      }
    }
  }
  return { startState, byCommand, unmatchedCount };
}

function renderFacetList(catalog, cmd) {
  const items = facetEntries(catalog, cmd)
    .map(
      ([, facet]) =>
        `<li>${esc(facet.title)}${facet.aliases?.length ? `<span class="aka">also: ${facet.aliases.map(esc).join(', ')}</span>` : ''}</li>`
    )
    .join('');
  return items
    ? `<ul class="facet-list" aria-label="One palette row per filter">${items}</ul>`
    : '';
}

// `tier` (common | full) marks the everyday view; a command without one inherits its state's tier.
const TIER_LABELS = { common: 'Everyday', full: 'Full catalog' };

const usesTiers = (catalog) =>
  Object.values(catalog.states ?? {}).some(
    (state) => state.tier || Object.values(state.commands ?? {}).some((cmd) => cmd.tier)
  );

const tierBadge = (tier) =>
  tier ? `<span class="badge tier-${esc(tier)}">${esc(TIER_LABELS[tier] ?? tier)}</span>` : '';

function renderCommand(catalog, { id, cmd, planned }, { stateTier, examples }) {
  const tier = cmd.tier ?? stateTier;
  const flags = [
    planned && 'planned',
    describeAsk(catalog, cmd.ask),
    cmd.then && `then: ${stateSummary(catalog, cmd.then)}`,
    cmd.when && `only when ${cmd.when}`
  ].filter(Boolean);
  const exampleItems = renderExamples(examples);
  const language = `<details class="language">
        <summary>How you say it</summary>
        <dl>
          <div><dt>command words</dt><dd>${[spokenName(id, cmd), ...(cmd.aliases ?? [])].map(esc).join(', ')}</dd></div>
          <div><dt>runs</dt><dd>${cmd.run ? `<code>${esc(cmd.run)}</code>` : 'not named yet'}${cmd.args ? `, called with <code>${esc(JSON.stringify(cmd.args))}</code>` : ''}</dd></div>${cmd.group ? `<div><dt>group</dt><dd>${esc(cmd.group)}</dd></div>` : ''}
        </dl>
      </details>`;
  return `
    <article class="command${planned ? ' is-planned' : ''}" id="cmd-${esc(id)}"${tier ? ` data-tier="${esc(tier)}"` : ''}>
      <header class="command-head">
        <h3>${esc(cmd.summary ?? spokenName(id, cmd))}</h3>${tier === 'full' ? tierBadge(tier) : ''}
        ${flags.length ? `<span class="flags">${flags.map(esc).join(' · ')}</span>` : ''}
      </header>
      ${renderFacetList(catalog, cmd)}
      ${cmd.review ? `<p class="review-note">To revisit: ${esc(cmd.review)}</p>` : ''}
      ${exampleItems ? `<ul class="examples">${exampleItems}</ul>` : ''}
      ${language}
    </article>`;
}

// Ways in and out of a state, read from the commands' `then`.
function describeMoves(catalog, stateId) {
  const leaveBy = commandsFor(catalog, stateId)
    .filter(({ cmd }) => cmd.then && cmd.then !== stateId)
    .map(({ id, cmd }) => spokenName(id, cmd));
  const reachedFrom = allCommands(catalog)
    .filter(({ cmd, stateId: from }) => cmd.then === stateId && from !== stateId)
    .map(({ id, cmd }) => spokenName(id, cmd));
  return { leaveBy: [...new Set(leaveBy)], reachedFrom: [...new Set(reachedFrom)] };
}

function renderStateMeta(catalog, stateId, state) {
  const { leaveBy, reachedFrom } = describeMoves(catalog, stateId);
  const parts = [
    state.start && ['Starts here', 'when the palette opens'],
    reachedFrom.length && ['Reached from', reachedFrom.join(', ')],
    leaveBy.length && ['Leave by', leaveBy.join(', ')],
    state.panel && ['Shows', state.panel === 'sidecar' ? 'the side panel' : state.panel]
  ].filter(Boolean);
  return `<div class="state-meta">${parts.map(([label, value]) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`).join('')}</div>`;
}

function describeStep(catalog, step) {
  if (step.ask) {
    return describeAsk(catalog, step.ask);
  }
  return `runs ${step.run ?? '(not named yet)'}${step.then ? `, then ${stateSummary(catalog, step.then)}` : ''}`;
}

function renderSteps(catalog, steps) {
  const items = steps
    .map((step) => `<li class="step">${esc(describeStep(catalog, step))}</li>`)
    .join('');
  return `<article class="command is-planned"><header class="command-head"><h3>Steps, in order</h3><span class="flags">guided flow</span></header><ol class="steps">${items}</ol></article>`;
}

function renderState(catalog, stateId, state, examplesByCommand) {
  const isPlanned = Boolean(state.planned);
  const rows = isPlanned ? null : paletteRowCount(catalog, stateId);
  const commands = commandsFor(catalog, stateId)
    .map((entry) =>
      renderCommand(catalog, entry, {
        stateTier: state.tier,
        examples: examplesByCommand[entry.id] ?? []
      })
    )
    .join('');
  return `
  <section class="group" id="state-${esc(stateId)}"${state.tier ? ` data-tier="${esc(state.tier)}"` : ''}>
    <div class="state-head">
      <h2>${esc(state.summary ?? stateId)} <span class="badge ${isPlanned ? 'planned' : 'built'}">${isPlanned ? 'Planned' : 'Built'}</span>${tierBadge(state.tier)}</h2>
      ${renderStateMeta(catalog, stateId, state)}
      ${rows !== null ? `<div class="state-meta"><span>Palette rows today: <b>${rows}</b></span></div>` : ''}
      ${state.review ? `<p class="review-note">To revisit: ${esc(state.review)}</p>` : ''}
    </div>
    ${commands}
    ${state.steps ? renderSteps(catalog, state.steps) : ''}
  </section>`;
}

// Workflows name the state each step happens in, so the path through the graph is visible.
function renderWorkflow(catalog, [id, workflow]) {
  const steps = workflow.steps ?? workflow.options ?? [];
  const items = steps
    .map((step) => {
      const where = step.state
        ? `<span class="where">${esc(shortLabel(catalog.states?.[step.state], step.state))}</span>`
        : '';
      const then = step.then
        ? `<span class="then">then: ${asList(step.then).map(esc).join(' · ')}</span>`
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

function renderPicker([name, picker]) {
  const lines = [
    picker.planned && '<p class="depends">Planned: the rows function doesn’t exist yet</p>',
    picker.from && `<p>Rows from <code>${esc(picker.from)}</code></p>`,
    picker.empty && `<p>When there are no rows: “${esc(picker.empty)}”</p>`
  ].filter(Boolean);
  return `<section class="vocab"><h3>${esc(spaced(name))}</h3>${lines.join('')}</section>`;
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
  const states = Object.entries(catalog.states ?? {});
  const commands = allCommands(catalog);
  return {
    builtStates: states.filter(([, state]) => !state.planned).length,
    plannedStates: states.filter(([, state]) => state.planned).length,
    builtRows: states.reduce((count, [id]) => count + paletteRowCount(catalog, id), 0),
    plannedCommands: commands.filter((entry) => entry.planned).length,
    examples: examples.length
  };
}

export function renderStatesPage(catalog, examples = []) {
  const states = Object.entries(catalog.states ?? {});
  const counts = countCatalog(catalog, examples);
  const { byCommand, unmatchedCount } = groupExamplesByCommand(catalog, examples);
  const collisions = findCollisions(catalog);
  const functions = collectFunctions(catalog);

  const body = `
  ${usesTiers(catalog) ? TIER_TOGGLE : ''}
  <section id="map">
    <h2>Paths through the palette</h2>
    <p class="section-note">Each box is a state: a context the user is in, with its own list of commands. Arrows are commands that move you to another state. Dashed boxes and arrows are planned, not built.</p>
    ${renderMap(buildMermaid(catalog))}
  </section>

  <div id="states" class="groups">
    ${states.map(([id, state]) => renderState(catalog, id, state, byCommand)).join('')}
  </div>

  ${
    catalog.workflows
      ? `<section id="workflows" class="group">
    <h2>Workflows</h2>
    <p class="section-note">Named paths through the states. Each step shows the state it happens in and what you'd type.</p>
    ${Object.entries(catalog.workflows)
      .map((entry) => renderWorkflow(catalog, entry))
      .join('')}
  </section>`
      : ''
  }

  <section id="collisions">
    <h2>Words that mean two things</h2>
    <p class="section-note">Checked within each state, since the palette shows one state's list at a time. Includes command names and their other words.</p>
    ${renderCollisions(collisions)}
  </section>

  <section id="functions">
    <h2>Functions the catalog names</h2>
    <p class="section-note">Every <code>run</code>, <code>when</code> and <code>from</code>: the interface of the app's service layer. Each must exist in the app, or be written, before the catalog runs. Check the spelling here; nothing else does until the app loads the catalog.</p>
    ${renderFunctions(functions)}
  </section>

  ${
    catalog.pickers
      ? `<section id="pickers">
    <h2>Pickers</h2>
    <p class="section-note">Lists a command opens so you can choose what it acts on.</p>
    <div class="vocabs">${Object.entries(catalog.pickers).map(renderPicker).join('')}</div>
  </section>`
      : ''
  }`;

  return {
    summary: `${counts.builtStates} states, ${counts.plannedStates} planned states, ${counts.builtRows} palette rows, ${counts.examples} examples (${unmatchedCount} unmatched), ${functions.length} functions named`,
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
        unmatchedCount && [unmatchedCount, 'examples matching no command'],
        [collisions.length, 'words that mean two things'],
        [functions.length, 'functions named']
      ].filter(Boolean),
      nav: [
        ['map', 'Map'],
        ...states.map(([id, state]) => [
          `state-${id}`,
          `${shortLabel(state, id)}${state.planned ? ' (planned)' : ''}`
        ]),
        catalog.workflows && ['workflows', 'Workflows'],
        ['collisions', 'Words that mean two things'],
        ['functions', 'Functions'],
        catalog.pickers && ['pickers', 'Pickers']
      ].filter(Boolean),
      body
    })
  };
}
