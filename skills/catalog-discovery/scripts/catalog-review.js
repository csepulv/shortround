// Generated from scripts/src and @shortround/catalog's checks. Don't edit this file; edit the source.

// ../skills/catalog-discovery/scripts/src/generate.js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ../packages/shortround-catalog/src/examples.js
import { parse } from "./vendor/yaml.js";
import { z } from "./vendor/zod.js";
var examplesSchema = z.strictObject({
  examples: z.array(
    z.strictObject({ say: z.string(), means: z.union([z.string(), z.array(z.string()).min(2)]) })
  )
});
function loadExamples(text) {
  const result = examplesSchema.safeParse(parse(text));
  if (!result.success) {
    throw new Error(`Examples are malformed:
${z.prettifyError(result.error)}`);
  }
  return result.data.examples;
}

// ../packages/shortround-catalog/src/load-catalog.js
import { parse as parse2 } from "./vendor/yaml.js";
import { z as z3 } from "./vendor/zod.js";

// ../packages/shortround-catalog/src/call-args.js
var REFERENCE = /^\$(?:(key)|(value)((?:\.[A-Za-z_$][\w$]*)*))$/;
var LOOKS_LIKE_REFERENCE = /^\$(key|value)/;
function parseReference(item) {
  const match = typeof item === "string" ? REFERENCE.exec(item) : null;
  return match && { name: match[1] ?? match[2], fields: (match[3] ?? "").split(".").slice(1) };
}
function collectStrings(item) {
  if (typeof item === "string") {
    return [item];
  }
  if (item && typeof item === "object") {
    return Object.values(item).flatMap(collectStrings);
  }
  return [];
}
var findMalformedReferences = (args) => collectStrings(args).filter((text) => LOOKS_LIKE_REFERENCE.test(text) && !REFERENCE.test(text));
function mapReferences(item, visit) {
  const reference = parseReference(item);
  if (reference) {
    return visit(reference);
  }
  if (Array.isArray(item)) {
    return item.map((element) => mapReferences(element, visit));
  }
  if (item && typeof item === "object") {
    return Object.fromEntries(
      Object.entries(item).map(([field, element]) => [field, mapReferences(element, visit)])
    );
  }
  return item;
}
function findReferencedInputs(args) {
  const names = /* @__PURE__ */ new Set();
  mapReferences(args, ({ name }) => names.add(name));
  return names;
}

// ../packages/shortround-catalog/src/catalog-schema.js
import { z as z2 } from "./vendor/zod.js";
var askSchema = z2.union([
  z2.strictObject({ text: z2.string(), required: z2.string().optional() }),
  z2.strictObject({ choose: z2.string() })
]);
var tierSchema = z2.enum(["common", "full"]);
var commandSchema = z2.strictObject({
  title: z2.string().optional(),
  summary: z2.string().optional(),
  group: z2.string().optional(),
  icon: z2.string().optional(),
  aliases: z2.array(z2.string()).optional(),
  forEach: z2.literal("facets").optional(),
  ask: askSchema.optional(),
  run: z2.string().optional(),
  args: z2.array(z2.unknown()).optional(),
  when: z2.string().optional(),
  then: z2.string().optional(),
  planned: z2.boolean().optional(),
  tier: tierSchema.optional(),
  review: z2.string().optional()
}).refine((command) => command.forEach || command.title, {
  message: "a command needs a title (a forEach command takes its titles from the facets)",
  path: ["title"]
});
var stepSchema = z2.union([
  z2.strictObject({ ask: askSchema }),
  z2.strictObject({ run: z2.string().optional(), then: z2.string().optional() })
]);
var stateSchema = z2.strictObject({
  summary: z2.string().optional(),
  start: z2.boolean().optional(),
  panel: z2.literal("sidecar").optional(),
  commands: z2.record(z2.string(), commandSchema).default({}),
  steps: z2.array(stepSchema).optional(),
  planned: z2.boolean().optional(),
  tier: tierSchema.optional(),
  review: z2.string().optional()
}).superRefine((state, context) => {
  if (state.steps && !state.planned) {
    context.addIssue({
      code: "custom",
      message: "steps (a guided flow) belong to a planned state; the engine cannot run them yet",
      path: ["steps"]
    });
  }
  if (!state.steps && Object.keys(state.commands).length === 0) {
    context.addIssue({ code: "custom", message: "a state needs commands", path: ["commands"] });
  }
  if (state.planned) {
    return;
  }
  for (const [name, command] of Object.entries(state.commands)) {
    if (!command.planned && !command.run) {
      context.addIssue({
        code: "custom",
        message: "a built command needs run (a planned one may leave it out)",
        path: ["commands", name, "run"]
      });
    }
  }
});
var pickerSchema = z2.strictObject({
  from: z2.string().optional(),
  empty: z2.string(),
  planned: z2.boolean().optional()
}).refine((picker) => picker.planned || picker.from, {
  message: "a built picker needs from (a planned one may leave it out)",
  path: ["from"]
});
var workflowStepSchema = z2.strictObject({
  question: z2.string(),
  state: z2.string().optional(),
  do: z2.string(),
  then: z2.union([z2.string(), z2.array(z2.string())]).optional()
});
var workflowSchema = z2.strictObject({
  title: z2.string().optional(),
  steps: z2.array(workflowStepSchema).optional(),
  options: z2.array(workflowStepSchema).optional()
}).refine((workflow) => Boolean(workflow.steps) !== Boolean(workflow.options), {
  message: "a workflow has steps (in order) or options (places to start), not both"
});
var catalogSchema = z2.strictObject({
  version: z2.literal(2),
  app: z2.string(),
  pickers: z2.record(z2.string(), pickerSchema).default({}),
  facets: z2.record(
    z2.string(),
    z2.strictObject({ title: z2.string(), aliases: z2.array(z2.string()).optional() })
  ).default({}),
  states: z2.record(z2.string(), stateSchema),
  workflows: z2.record(z2.string(), workflowSchema).optional()
});

// ../packages/shortround-catalog/src/load-catalog.js
function checkCatalog(text) {
  const catalog = parseCatalog(text);
  const startState = findStartState(catalog.states);
  checkReferences(catalog);
  return { ...catalog, startState };
}
function parseCatalog(text) {
  const result = catalogSchema.safeParse(parse2(text));
  if (!result.success) {
    throw new Error(`Catalog is malformed:
${z3.prettifyError(result.error)}`);
  }
  return result.data;
}
function findStartState(states) {
  const startStates = Object.keys(states).filter((name) => states[name].start);
  if (startStates.length === 0) {
    throw new Error("Catalog has no start state");
  }
  if (startStates.length > 1) {
    throw new Error(`Catalog has more than one start state: ${startStates.join(", ")}`);
  }
  if (states[startStates[0]].planned) {
    throw new Error(`Catalog start state "${startStates[0]}" is planned, not built`);
  }
  return startStates[0];
}
function checkReferences(catalog) {
  for (const [stateName, state] of Object.entries(catalog.states)) {
    for (const [commandName, command] of Object.entries(state.commands)) {
      const owner = `Catalog command "${stateName}.${commandName}"`;
      const isBuilt = !state.planned && !command.planned;
      checkPicker(catalog, command.ask?.choose, { owner, isBuilt });
      checkNextState(catalog, command.then, { owner, isBuilt });
      checkArgs(command, owner);
    }
  }
}
function checkArgs(command, owner) {
  const [malformed] = findMalformedReferences(command.args ?? []);
  if (malformed) {
    throw new Error(
      `${owner}: "${malformed}" looks like a reference but isn't one ($key, $value or $value.<field>)`
    );
  }
  const inputs = findReferencedInputs(command.args ?? []);
  if (inputs.has("value") && !command.ask) {
    throw new Error(`${owner}: args use $value, but the command asks for nothing`);
  }
  if (inputs.has("key") && !command.forEach) {
    throw new Error(`${owner}: args use $key, but the command is not forEach`);
  }
}
function checkPicker(catalog, pickerName, { owner, isBuilt }) {
  if (!pickerName) {
    return;
  }
  const picker = catalog.pickers[pickerName];
  if (!picker) {
    throw new Error(`${owner}: no picker named "${pickerName}"`);
  }
  if (isBuilt && picker.planned) {
    throw new Error(`${owner}: picker "${pickerName}" is planned, not built`);
  }
}
function checkNextState(catalog, stateName, { owner, isBuilt }) {
  if (!stateName) {
    return;
  }
  const state = catalog.states[stateName];
  if (!state) {
    throw new Error(`${owner}: no state named "${stateName}"`);
  }
  if (isBuilt && state.planned) {
    throw new Error(`${owner}: state "${stateName}" is planned, not built`);
  }
}

// ../skills/catalog-discovery/scripts/src/page-kit.js
var esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var spaced = (id) => id.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
var asList = (value) => value === void 0 ? [] : Array.isArray(value) ? value : [value];
var renderChips = (means) => asList(means).map(
  (intentionId) => `<span class="chip"><span class="chip-k">${esc(intentionId)}</span></span>`
).join("");
var renderExamples = (examples) => (examples ?? []).map(
  (example) => `
      <li class="example">
        <code class="say"><span class="prompt" aria-hidden="true">\u2318K</span>${esc(example.say)}</code>
        <div class="means"><span class="arrow" aria-hidden="true">\u2192</span>${renderChips(example.means)}</div>
      </li>`
).join("");
var renderStats = (stats) => stats.map(([count, label]) => `<span><b>${esc(count)}</b> ${esc(label)}</span>`).join("");
var renderMap = (mermaidSource) => `<div class="map"><pre class="mermaid">
${esc(mermaidSource)}
    </pre></div>`;
var renderCollisions = (collisions) => `<ul class="collisions">${collisions.map((c) => `<li><code>${esc(c.word)}</code> ${esc(c.detail)}</li>`).join("") || "<li>None found.</li>"}</ul>`;
function renderShell({ app, version, sourceName, lede, stats, nav, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(app)} Command Catalog</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${STYLE}</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <span class="eyebrow">Catalog review \xB7 format v${esc(version)}</span>
    <h1>What you can say to ${esc(app)}</h1>
    <p class="lede">Generated from <code>${esc(sourceName)}</code>. ${lede}</p>
    <div class="stats">${renderStats(stats)}</div>
    <nav class="jump" aria-label="Sections">${nav.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join("")}</nav>
  </header>
${body}
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js" integrity="sha384-rbtjAdnIQE/aQJGEgXrVUlMibdfTSa4PQju4HDhN3sR2PmaKFzhEafuePsl9H/9I" crossorigin="anonymous"></script>
<script>
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  mermaid.initialize({ startOnLoad: true, theme: isDark ? 'dark' : 'neutral' });
</script>
</body>
</html>
`;
}
var STYLE = `
:root {
  --ground: #f4f6f8; --surface: #ffffff; --ink: #1b2330; --muted: #5b6576; --rule: #dde2ea;
  --brass: #8a5e14; --brass-soft: #f3e7cf; --code-bg: #eef1f5; --slate-soft: #e8edf3;
  --sans: "IBM Plex Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --ground: #12161d; --surface: #1a1f28; --ink: #e4e8ee; --muted: #98a2b3; --rule: #2a313c;
    --brass: #d9a652; --brass-soft: #3a2f1b; --code-bg: #222935; --slate-soft: #232b37;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --ground: #12161d; --surface: #1a1f28; --ink: #e4e8ee; --muted: #98a2b3; --rule: #2a313c;
  --brass: #d9a652; --brass-soft: #3a2f1b; --code-bg: #222935; --slate-soft: #232b37;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--ink); font-family: var(--sans); font-size: 15px; line-height: 1.55; padding-inline: 16px; padding-block: 0 48px; }
.wrap { max-width: 880px; margin-inline: auto; display: grid; gap: 40px; }
.masthead { padding-block: 32px 20px; display: grid; gap: 8px; border-bottom: 1px solid var(--rule); }
.eyebrow { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--brass); font-weight: 600; }
h1 { font-size: 30px; line-height: 1.2; margin: 0; font-weight: 600; text-wrap: balance; }
.lede { margin: 0; color: var(--muted); max-width: 65ch; }
.stats { display: flex; flex-wrap: wrap; gap: 20px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.stats b { color: var(--ink); font-weight: 600; }
nav.jump { display: flex; flex-wrap: wrap; gap: 16px; font-size: 14px; }
nav.jump a { color: var(--brass); text-decoration: none; border-bottom: 1px solid transparent; }
nav.jump a:hover, nav.jump a:focus-visible { border-bottom-color: var(--brass); outline: none; }
h2 { font-size: 20px; margin: 0 0 4px; font-weight: 600; }
.section-note { margin: 0 0 16px; color: var(--muted); max-width: 65ch; }
.map { background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 16px; overflow-x: auto; }
.groups { display: grid; gap: 32px; }
.group { display: grid; gap: 12px; }
.group > h2 { font-size: 16px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--rule); padding-bottom: 6px; }
.state-head { display: grid; gap: 6px; }
.state-head h2 { font-size: 22px; text-transform: none; letter-spacing: 0; color: var(--ink); border: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; }
.state-meta { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); }
.state-meta b { color: var(--ink); font-weight: 500; }
.review-note { font-size: 13px; background: var(--brass-soft); border-radius: 4px; padding: 6px 10px; margin: 0; }
.badge { font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; border-radius: 4px; padding: 1px 7px; }
.badge.built { background: var(--slate-soft); color: var(--muted); }
.badge.planned { border: 1px dashed var(--brass); color: var(--brass); }
.badge.tier-common { background: var(--brass-soft); color: var(--ink); }
.badge.tier-full { border: 1px solid var(--rule); color: var(--muted); }
.tier-toggle { font-size: 14px; background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 10px 14px; }
.tier-toggle input { margin-right: 6px; accent-color: var(--brass); }
body.common-only [data-tier="full"] { display: none; }
.command { background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 14px 16px; display: grid; gap: 10px; }
.command.is-planned { border-style: dashed; background: transparent; }
.command-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.command h3 { font-size: 16px; margin: 0; font-weight: 600; }
.flags { font-size: 12px; color: var(--brass); }
.available { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 12px; }
.label { color: var(--muted); margin-right: 2px; }
.where { border: 1px solid var(--rule); border-radius: 999px; padding: 1px 8px; color: var(--muted); }
.examples, .steps { margin: 0; padding: 0; display: grid; gap: 8px; }
.examples, .options { list-style: none; }
.steps:not(.options) { padding-left: 1.4em; }
.example, .step { display: grid; gap: 4px; }
.question { font-weight: 500; }
.then { font-size: 12.5px; color: var(--muted); padding-left: 10px; }
.say { font-family: var(--mono); font-size: 13.5px; background: var(--code-bg); border-radius: 4px; padding: 6px 10px; display: block; overflow-x: auto; white-space: pre; }
.prompt { color: var(--brass); margin-right: 10px; font-size: 12px; }
.means { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding-left: 10px; }
.arrow { color: var(--muted); }
.chip { font-size: 12.5px; background: var(--brass-soft); border-radius: 4px; padding: 1px 7px; }
.chip-k { color: var(--muted); font-family: var(--mono); font-size: 11.5px; }
.no-examples { margin: 0; font-size: 13px; color: var(--muted); font-style: italic; }
.facet-list { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; font-size: 13px; }
.facet-list li { border: 1px solid var(--rule); border-radius: 4px; padding: 2px 8px; }
.facet-list .aka { margin-left: 4px; }
details.language summary { cursor: pointer; font-size: 13px; color: var(--muted); }
details.language summary:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
details.language dl { margin: 8px 0 0; display: grid; gap: 4px; font-size: 13px; }
details.language dl > div { display: grid; grid-template-columns: 9em 1fr; gap: 8px; }
details.language dt { color: var(--muted); }
details.language dd { margin: 0; font-family: var(--mono); font-size: 12.5px; }
.collisions { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.collisions li { background: var(--surface); border: 1px solid var(--rule); border-left: 3px solid var(--brass); border-radius: 4px; padding: 8px 12px; }
.collisions code { font-family: var(--mono); font-weight: 500; }
.functions { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 13px; }
.functions li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; border-bottom: 1px solid var(--rule); padding: 4px 0; }
.functions code { font-family: var(--mono); font-weight: 500; }
.vocabs { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.vocab { background: var(--surface); border: 1px solid var(--rule); border-radius: 6px; padding: 12px 14px; }
.vocab h3 { margin: 0 0 6px; font-size: 14px; font-family: var(--mono); font-weight: 500; }
.vocab ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 3px; font-size: 13px; }
.vocab p { margin: 0 0 4px; font-size: 13px; }
.depends { margin: 0 0 6px; font-size: 12px; color: var(--brass); }
.val { font-family: var(--mono); font-size: 12.5px; }
.aka { color: var(--muted); margin-left: 6px; font-size: 12px; }
.runtime { color: var(--muted); font-size: 12.5px; }
.runtime code { font-family: var(--mono); }
@media (max-width: 520px) { details.language dl > div { grid-template-columns: 1fr; gap: 0; } h1 { font-size: 24px; } }
`;

// ../skills/catalog-discovery/scripts/src/render-states.js
var ANYWHERE_MIN = 3;
var spokenName = (id, cmd) => cmd.title ?? spaced(id);
var shortLabel = (state, id) => state?.summary?.split(";")[0] ?? id;
var stateSummary = (catalog, id) => catalog.states?.[id]?.summary ?? id;
function commandsFor(catalog, stateId) {
  const state = catalog.states?.[stateId] ?? {};
  return Object.entries(state.commands ?? {}).map(([id, cmd]) => ({
    id,
    cmd,
    planned: Boolean(state.planned || cmd.planned)
  }));
}
var allCommands = (catalog) => Object.keys(catalog.states ?? {}).flatMap(
  (stateId) => commandsFor(catalog, stateId).map((entry) => ({ ...entry, stateId }))
);
var facetEntries = (catalog, cmd) => cmd.forEach === "facets" ? Object.entries(catalog.facets ?? {}) : [];
var paletteRowCount = (catalog, stateId) => commandsFor(catalog, stateId).filter((entry) => !entry.planned).reduce((count, { cmd }) => count + (facetEntries(catalog, cmd).length || 1), 0);
function describeAsk(catalog, ask) {
  if (ask?.text) {
    return `asks for text: \u201C${ask.text}\u201D${ask.required ? ` (required: \u201C${ask.required}\u201D)` : ""}`;
  }
  if (ask?.choose) {
    const isPlannedList = catalog.pickers?.[ask.choose]?.planned;
    return `picks from: ${spaced(ask.choose)}${isPlannedList ? " (planned list)" : ""}`;
  }
  return null;
}
function findAnywhereCommands(catalog) {
  const counts = /* @__PURE__ */ new Map();
  for (const { id, cmd } of allCommands(catalog)) {
    if (cmd.then) {
      const key = `${spokenName(id, cmd)}->${cmd.then}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return new Set([...counts].filter(([, count]) => count >= ANYWHERE_MIN).map(([key]) => key));
}
var mermaidLabel = (text) => String(text).replaceAll('"', "#quot;");
var stateNode = (id) => `s_${id}`;
function buildMermaid(catalog) {
  const lines = ["flowchart LR", '  paletteOpens(("Palette opens"))'];
  const states = Object.entries(catalog.states ?? {});
  for (const [id, state] of states) {
    lines.push(`  ${stateNode(id)}(["${mermaidLabel(shortLabel(state, id))}"])`);
  }
  const startState = states.find(([, state]) => state.start)?.[0];
  if (startState) {
    lines.push(`  paletteOpens --> ${stateNode(startState)}`);
  }
  const edges = /* @__PURE__ */ new Map();
  const addEdge = (from, to, label, planned) => {
    if (!to) {
      return;
    }
    const key = `${from}->${to}->${planned ? "p" : "b"}`;
    edges.set(key, [...edges.get(key) ?? [], label]);
  };
  const anywhere = findAnywhereCommands(catalog);
  for (const { id, cmd, planned, stateId } of allCommands(catalog)) {
    const name = spokenName(id, cmd);
    const from = anywhere.has(`${name}->${cmd.then}`) ? "anywhere" : stateNode(stateId);
    addEdge(from, cmd.then && stateNode(cmd.then), name, planned);
  }
  for (const [stateId, state] of states) {
    for (const step of state.steps ?? []) {
      addEdge(stateNode(stateId), step.then && stateNode(step.then), "finish", true);
    }
  }
  if (anywhere.size) {
    lines.push('  anywhere(("From anywhere"))');
  }
  for (const [key, labels] of edges) {
    const [from, to, kind] = key.split("->");
    const arrow = kind === "p" ? "-.->" : "-->";
    lines.push(`  ${from} ${arrow}|"${mermaidLabel([...new Set(labels)].join(" \xB7 "))}"| ${to}`);
  }
  const plannedStates = states.filter(([, state]) => state.planned).map(([id]) => stateNode(id));
  if (plannedStates.length) {
    lines.push("  classDef planned stroke-dasharray: 5 4");
    lines.push(`  class ${plannedStates.join(",")} planned`);
  }
  return lines.join("\n");
}
function findCollisions(catalog) {
  const collisions = [];
  for (const [stateId, state] of Object.entries(catalog.states ?? {})) {
    const owners = {};
    const claim = (word, owner) => (owners[word.toLowerCase()] ??= /* @__PURE__ */ new Set()).add(owner);
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
        collisions.push({ word, detail: `(${where}) can mean \u201C${[...names].join("\u201D or \u201C")}\u201D` });
      }
    }
    const words = Object.keys(owners);
    for (const short of words) {
      for (const long of words) {
        if (long.startsWith(`${short} `) && [...owners[short]].some((name) => !owners[long].has(name))) {
          collisions.push({
            word: short,
            detail: `(${where}) \u201C${[...owners[short]].join("\u201D / \u201C")}\u201D is also the start of \u201C${long}\u201D (\u201C${[...owners[long]].join("\u201D / \u201C")}\u201D)`
          });
        }
      }
    }
  }
  return collisions;
}
function collectFunctions(catalog) {
  const functions = /* @__PURE__ */ new Map();
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
  const items = functions.map(
    ([name, { uses, planned }]) => `<li><code>${esc(name)}</code>${planned ? '<span class="badge planned">Planned</span>' : ""}<span class="runtime">${uses.map(esc).join(" \xB7 ")}</span></li>`
  ).join("");
  return `<ul class="functions">${items || "<li>None.</li>"}</ul>`;
}
function groupExamplesByCommand(catalog, examples) {
  const startState = Object.entries(catalog.states ?? {}).find(([, state]) => state.start)?.[0];
  const names = startState ? Object.keys(catalog.states[startState].commands ?? {}) : [];
  const commandOf = (intentionId) => {
    const rest = intentionId.replace(`${catalog.app}.`, "").split("::")[0];
    return names.filter((name) => rest === name || rest.startsWith(`${name}.`)).sort((a, b) => b.length - a.length)[0];
  };
  const byCommand = {};
  let unmatchedCount = 0;
  for (const example of examples) {
    const commands = new Set(asList(example.means).map(commandOf));
    if (commands.has(void 0)) {
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
  const items = facetEntries(catalog, cmd).map(
    ([, facet]) => `<li>${esc(facet.title)}${facet.aliases?.length ? `<span class="aka">also: ${facet.aliases.map(esc).join(", ")}</span>` : ""}</li>`
  ).join("");
  return items ? `<ul class="facet-list" aria-label="One palette row per filter">${items}</ul>` : "";
}
var TIER_LABELS = { common: "Everyday", full: "Full catalog" };
var usesTiers = (catalog) => Object.values(catalog.states ?? {}).some(
  (state) => state.tier || Object.values(state.commands ?? {}).some((cmd) => cmd.tier)
);
var tierBadge = (tier) => tier ? `<span class="badge tier-${esc(tier)}">${esc(TIER_LABELS[tier] ?? tier)}</span>` : "";
function renderCommand(catalog, { id, cmd, planned }, { stateTier, examples }) {
  const tier = cmd.tier ?? stateTier;
  const flags = [
    planned && "planned",
    describeAsk(catalog, cmd.ask),
    cmd.then && `then: ${stateSummary(catalog, cmd.then)}`,
    cmd.when && `only when ${cmd.when}`
  ].filter(Boolean);
  const exampleItems = renderExamples(examples);
  const language = `<details class="language">
        <summary>How you say it</summary>
        <dl>
          <div><dt>command words</dt><dd>${[spokenName(id, cmd), ...cmd.aliases ?? []].map(esc).join(", ")}</dd></div>
          <div><dt>runs</dt><dd>${cmd.run ? `<code>${esc(cmd.run)}</code>` : "not named yet"}${cmd.args ? `, called with <code>${esc(JSON.stringify(cmd.args))}</code>` : ""}</dd></div>${cmd.group ? `<div><dt>group</dt><dd>${esc(cmd.group)}</dd></div>` : ""}
        </dl>
      </details>`;
  return `
    <article class="command${planned ? " is-planned" : ""}" id="cmd-${esc(id)}"${tier ? ` data-tier="${esc(tier)}"` : ""}>
      <header class="command-head">
        <h3>${esc(cmd.summary ?? spokenName(id, cmd))}</h3>${tier === "full" ? tierBadge(tier) : ""}
        ${flags.length ? `<span class="flags">${flags.map(esc).join(" \xB7 ")}</span>` : ""}
      </header>
      ${renderFacetList(catalog, cmd)}
      ${cmd.review ? `<p class="review-note">To revisit: ${esc(cmd.review)}</p>` : ""}
      ${exampleItems ? `<ul class="examples">${exampleItems}</ul>` : ""}
      ${language}
    </article>`;
}
function describeMoves(catalog, stateId) {
  const leaveBy = commandsFor(catalog, stateId).filter(({ cmd }) => cmd.then && cmd.then !== stateId).map(({ id, cmd }) => spokenName(id, cmd));
  const reachedFrom = allCommands(catalog).filter(({ cmd, stateId: from }) => cmd.then === stateId && from !== stateId).map(({ id, cmd }) => spokenName(id, cmd));
  return { leaveBy: [...new Set(leaveBy)], reachedFrom: [...new Set(reachedFrom)] };
}
function renderStateMeta(catalog, stateId, state) {
  const { leaveBy, reachedFrom } = describeMoves(catalog, stateId);
  const parts = [
    state.start && ["Starts here", "when the palette opens"],
    reachedFrom.length && ["Reached from", reachedFrom.join(", ")],
    leaveBy.length && ["Leave by", leaveBy.join(", ")],
    state.panel && ["Shows", state.panel === "sidecar" ? "the side panel" : state.panel]
  ].filter(Boolean);
  return `<div class="state-meta">${parts.map(([label, value]) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`).join("")}</div>`;
}
function describeStep(catalog, step) {
  if (step.ask) {
    return describeAsk(catalog, step.ask);
  }
  return `runs ${step.run ?? "(not named yet)"}${step.then ? `, then ${stateSummary(catalog, step.then)}` : ""}`;
}
function renderSteps(catalog, steps) {
  const items = steps.map((step) => `<li class="step">${esc(describeStep(catalog, step))}</li>`).join("");
  return `<article class="command is-planned"><header class="command-head"><h3>Steps, in order</h3><span class="flags">guided flow</span></header><ol class="steps">${items}</ol></article>`;
}
function renderState(catalog, stateId, state, examplesByCommand) {
  const isPlanned = Boolean(state.planned);
  const rows = isPlanned ? null : paletteRowCount(catalog, stateId);
  const commands = commandsFor(catalog, stateId).map(
    (entry) => renderCommand(catalog, entry, {
      stateTier: state.tier,
      examples: examplesByCommand[entry.id] ?? []
    })
  ).join("");
  return `
  <section class="group" id="state-${esc(stateId)}"${state.tier ? ` data-tier="${esc(state.tier)}"` : ""}>
    <div class="state-head">
      <h2>${esc(state.summary ?? stateId)} <span class="badge ${isPlanned ? "planned" : "built"}">${isPlanned ? "Planned" : "Built"}</span>${tierBadge(state.tier)}</h2>
      ${renderStateMeta(catalog, stateId, state)}
      ${rows !== null ? `<div class="state-meta"><span>Palette rows today: <b>${rows}</b></span></div>` : ""}
      ${state.review ? `<p class="review-note">To revisit: ${esc(state.review)}</p>` : ""}
    </div>
    ${commands}
    ${state.steps ? renderSteps(catalog, state.steps) : ""}
  </section>`;
}
function renderWorkflow(catalog, [id, workflow]) {
  const steps = workflow.steps ?? workflow.options ?? [];
  const items = steps.map((step) => {
    const where = step.state ? `<span class="where">${esc(shortLabel(catalog.states?.[step.state], step.state))}</span>` : "";
    const then = step.then ? `<span class="then">then: ${asList(step.then).map(esc).join(" \xB7 ")}</span>` : "";
    return `
      <li class="step">
        <div class="available">${where}<span class="question">${esc(step.question)}</span></div>
        <code class="say"><span class="prompt" aria-hidden="true">\u2318K</span>${esc(step.do)}</code>
        ${then}
      </li>`;
  }).join("");
  const list = workflow.steps ? `<ol class="steps">${items}</ol>` : `<ul class="steps options">${items}</ul>`;
  const kind = workflow.steps ? "Steps, in order" : "Places to start";
  return `
    <article class="command workflow" id="wf-${esc(id)}">
      <header class="command-head"><h3>${esc(workflow.title ?? spaced(id))}</h3><span class="flags">${kind}</span></header>
      ${list}
    </article>`;
}
function renderPicker([name, picker]) {
  const lines = [
    picker.planned && '<p class="depends">Planned: the rows function doesn\u2019t exist yet</p>',
    picker.from && `<p>Rows from <code>${esc(picker.from)}</code></p>`,
    picker.empty && `<p>When there are no rows: \u201C${esc(picker.empty)}\u201D</p>`
  ].filter(Boolean);
  return `<section class="vocab"><h3>${esc(spaced(name))}</h3>${lines.join("")}</section>`;
}
var TIER_TOGGLE = `<div class="tier-toggle">
    <label for="common-only"><input id="common-only" type="checkbox"> Show the everyday view only (hide commands and states tagged \u201CFull catalog\u201D)</label>
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
function renderStatesPage(catalog, examples = []) {
  const states = Object.entries(catalog.states ?? {});
  const counts = countCatalog(catalog, examples);
  const { byCommand, unmatchedCount } = groupExamplesByCommand(catalog, examples);
  const collisions = findCollisions(catalog);
  const functions = collectFunctions(catalog);
  const body = `
  ${usesTiers(catalog) ? TIER_TOGGLE : ""}
  <section id="map">
    <h2>Paths through the palette</h2>
    <p class="section-note">Each box is a state: a context the user is in, with its own list of commands. Arrows are commands that move you to another state. Dashed boxes and arrows are planned, not built.</p>
    ${renderMap(buildMermaid(catalog))}
  </section>

  <div id="states" class="groups">
    ${states.map(([id, state]) => renderState(catalog, id, state, byCommand)).join("")}
  </div>

  ${catalog.workflows ? `<section id="workflows" class="group">
    <h2>Workflows</h2>
    <p class="section-note">Named paths through the states. Each step shows the state it happens in and what you'd type.</p>
    ${Object.entries(catalog.workflows).map((entry) => renderWorkflow(catalog, entry)).join("")}
  </section>` : ""}

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

  ${catalog.pickers ? `<section id="pickers">
    <h2>Pickers</h2>
    <p class="section-note">Lists a command opens so you can choose what it acts on.</p>
    <div class="vocabs">${Object.entries(catalog.pickers).map(renderPicker).join("")}</div>
  </section>` : ""}`;
  return {
    summary: `${counts.builtStates} states, ${counts.plannedStates} planned states, ${counts.builtRows} palette rows, ${counts.examples} examples (${unmatchedCount} unmatched), ${functions.length} functions named`,
    html: renderShell({
      app: catalog.app,
      version: catalog.version,
      sourceName: catalog.sourceName,
      lede: "Organized by state: the context you are in decides which commands the palette offers. Check each state against how you expect to move through the app: what should be available here, and what should not?",
      stats: [
        [counts.builtStates, "states built"],
        [counts.plannedStates, "states planned"],
        [counts.builtRows, "palette rows built"],
        [counts.plannedCommands, "commands planned"],
        [counts.examples, "examples"],
        unmatchedCount && [unmatchedCount, "examples matching no command"],
        [collisions.length, "words that mean two things"],
        [functions.length, "functions named"]
      ].filter(Boolean),
      nav: [
        ["map", "Map"],
        ...states.map(([id, state]) => [
          `state-${id}`,
          `${shortLabel(state, id)}${state.planned ? " (planned)" : ""}`
        ]),
        catalog.workflows && ["workflows", "Workflows"],
        ["collisions", "Words that mean two things"],
        ["functions", "Functions"],
        catalog.pickers && ["pickers", "Pickers"]
      ].filter(Boolean),
      body
    })
  };
}

// ../skills/catalog-discovery/scripts/src/generate.js
function readText(filePath) {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") {
      return null;
    }
    throw err;
  }
}
function loadCatalog(catalogPath2) {
  const text = readText(catalogPath2);
  if (text === null) {
    throw new Error(`No catalog at ${catalogPath2}`);
  }
  return { ...checkCatalog(text), sourceName: path.basename(catalogPath2) };
}
function pathBeside(catalogPath2, suffix) {
  const { dir, name } = path.parse(catalogPath2);
  return path.join(dir, `${name}${suffix}`);
}
function loadExamplesBeside(catalogPath2) {
  const text = readText(pathBeside(catalogPath2, ".examples.yaml"));
  return text === null ? [] : loadExamples(text);
}
var [, , catalogPath, outArg] = process.argv;
if (!catalogPath) {
  console.error("Usage: node scripts/catalog-review.js <catalog.yaml> [out.html]");
  process.exit(1);
}
var outPath = outArg ?? pathBeside(catalogPath, "-review.html");
try {
  const page = renderStatesPage(loadCatalog(catalogPath), loadExamplesBeside(catalogPath));
  writeFileSync(outPath, page.html);
  console.log(`wrote ${outPath}: ${page.summary}`);
} catch (err) {
  if (err.code) {
    throw err;
  }
  console.error(err.message);
  process.exit(1);
}
