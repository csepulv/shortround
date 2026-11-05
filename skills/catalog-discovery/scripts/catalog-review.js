// Generated from scripts/src and @shortround/core's catalog checks. Don't edit this file; edit the source.
/* eslint-disable simple-import-sort/imports */

// ../skills/catalog-discovery/scripts/src/generate.js
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// ../packages/shortround-core/src/catalog/examples.js
import { parse } from "./vendor/yaml.js";
import { z } from "./vendor/zod.js";
var callSchema = z.record(z.string(), z.record(z.string(), z.unknown())).refine((call) => Object.keys(call).length === 1, {
  message: "means names one command, with its args"
});
var examplesSchema = z.strictObject({
  examples: z.array(z.strictObject({ say: z.string(), means: callSchema }))
});
function loadExamples(text) {
  const result = examplesSchema.safeParse(parse(text));
  if (!result.success) {
    throw new Error(`Examples are malformed:
${z.prettifyError(result.error)}`);
  }
  return result.data.examples;
}

// ../packages/shortround-core/src/catalog/load-catalog.js
import { parse as parse2 } from "./vendor/yaml.js";
import { z as z3 } from "./vendor/zod.js";

// ../packages/shortround-core/src/catalog/catalog-schema.js
import { z as z2 } from "./vendor/zod.js";
var tierSchema = z2.enum(["common", "full"]);
var askSchema = z2.union([
  z2.strictObject({ text: z2.string(), required: z2.string().optional() }),
  z2.strictObject({ choose: z2.string() })
]);
var stepSchema = z2.union([
  z2.strictObject({ ask: askSchema }),
  z2.strictObject({ run: z2.string().optional(), then: z2.string().optional() })
]);
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
var stringList = z2.array(z2.string());
var groupSchema = z2.strictObject({ label: z2.string(), icon: z2.string().optional() });
var pathSchema = z2.strictObject({
  id: z2.string().optional(),
  title: z2.string().optional(),
  aliases: stringList.optional(),
  prompt: z2.string().optional(),
  required: z2.string().optional(),
  empty: z2.string().optional(),
  group: z2.string().optional(),
  icon: z2.string().optional(),
  rows: z2.literal("each value").optional()
});
var listEntrySchema = z2.strictObject({
  value: z2.union([z2.string(), z2.number(), z2.boolean()]),
  title: z2.string(),
  subtitle: z2.string().optional(),
  aliases: stringList.optional(),
  path: z2.strictObject({ id: z2.string().optional() }).optional()
});
var argSourceSchema = z2.strictObject({
  freeform: z2.boolean().optional(),
  type: z2.enum(["text", "range", "url"]).optional(),
  list: z2.array(listEntrySchema).optional(),
  lookup: z2.string().optional(),
  key: z2.string().optional(),
  current: z2.string().optional()
}).refine((source) => source.freeform || source.list || source.lookup || source.current, {
  message: "an argSource needs freeform, list, lookup or current"
}).refine((source) => !source.current || source.freeform || source.list || source.lookup, {
  message: "current needs a way to ask too: freeform, list or lookup"
});
var paramSchema = z2.strictObject({
  label: z2.string(),
  summary: z2.string().optional(),
  required: z2.boolean().optional(),
  list: z2.boolean().optional(),
  default: z2.boolean().optional(),
  priority: z2.number().optional(),
  hints: stringList.optional(),
  aliases: stringList.optional(),
  argSource: argSourceSchema,
  path: pathSchema.optional()
});
var commandSchema = z2.strictObject({
  label: z2.string(),
  summary: z2.string().optional(),
  aliases: stringList.optional(),
  group: z2.string().optional(),
  icon: z2.string().optional(),
  run: z2.string().optional(),
  when: z2.string().optional(),
  params: z2.record(z2.string(), paramSchema).default({}),
  planned: z2.boolean().optional(),
  tier: tierSchema.optional(),
  review: z2.string().optional()
}).refine((command) => command.planned || command.run, {
  message: "a built command needs run (a planned one may leave it out)",
  path: ["run"]
});
var stateSchema = z2.strictObject({
  summary: z2.string().optional(),
  start: z2.boolean().optional(),
  when: z2.string().optional(),
  panel: z2.string().optional(),
  commands: stringList.default([]),
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
  if (!state.steps && state.commands.length === 0) {
    context.addIssue({ code: "custom", message: "a state needs commands", path: ["commands"] });
  }
});
var catalogSchema = z2.strictObject({
  version: z2.literal(3),
  app: z2.string(),
  groups: z2.record(z2.string(), groupSchema).default({}),
  states: z2.record(z2.string(), stateSchema),
  commands: z2.record(z2.string(), commandSchema),
  workflows: z2.record(z2.string(), workflowSchema).optional()
});

// ../packages/shortround-core/src/catalog/conditions.js
import jsep from "./vendor/jsep.js";
var LOGICAL = /* @__PURE__ */ new Set(["&&", "||"]);
function compileWhen(clause, { resolve, owner }) {
  const fail = (why) => {
    throw new Error(`${owner}: when "${clause}" ${why}`);
  };
  let tree;
  try {
    tree = jsep(clause);
  } catch (error) {
    fail(`isn't a valid clause (${error.message})`);
  }
  const pathOf = (node) => {
    if (node.type === "Identifier") {
      return node.name;
    }
    if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
      return `${pathOf(node.object)}.${node.property.name}`;
    }
    return fail("may use only condition names, !, &&, || and parentheses");
  };
  function compile(node) {
    if (node.type === "UnaryExpression" && node.operator === "!") {
      const inner = compile(node.argument);
      return (reading) => !inner(reading);
    }
    if (node.type === "BinaryExpression" && LOGICAL.has(node.operator)) {
      const left = compile(node.left);
      const right = compile(node.right);
      return node.operator === "&&" ? (reading) => left(reading) && right(reading) : (reading) => left(reading) || right(reading);
    }
    const path2 = pathOf(node);
    const condition = resolve(path2, owner);
    return (reading) => {
      const value = condition(reading);
      if (typeof value !== "boolean") {
        throw new Error(
          `Condition "${path2}" returned ${typeof value}; conditions return a boolean`
        );
      }
      return value;
    };
  }
  return compile(tree);
}

// ../packages/shortround-core/src/catalog/load-catalog.js
var VERSION_2 = 'This is a version 2 catalog; ShortRound 0.5.0 reads version 3. See "From a v2 catalog" in MIGRATING.md: https://github.com/csepulv/shortround/blob/main/MIGRATING.md#from-a-v2-catalog';
function checkCatalog(text) {
  const raw = readYaml(text);
  if (raw?.version === 2) {
    throw new Error(VERSION_2);
  }
  const catalog = parseCatalog(withoutExtensionKeys(raw));
  checkReferences(catalog);
  checkStartState(catalog.states);
  const anyCondition = () => () => true;
  forEachWhen(catalog, (clause, owner) => compileWhen(clause, { resolve: anyCondition, owner }));
  return catalog;
}
var readYaml = (text) => parse2(text, { merge: true });
var withoutExtensionKeys = (raw) => raw && typeof raw === "object" ? Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith("x-"))) : raw;
function parseCatalog(raw) {
  const result = catalogSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Catalog is malformed:
${z3.prettifyError(result.error)}`);
  }
  return result.data;
}
function checkReferences(catalog) {
  const checkGroup = (key, owner) => {
    if (key !== void 0 && !catalog.groups[key]) {
      throw new Error(`${owner}: no group "${key}" in the catalog`);
    }
  };
  for (const [name, command] of Object.entries(catalog.commands)) {
    checkGroup(command.group, commandOwner(name));
    for (const [paramKey, param] of Object.entries(command.params)) {
      checkGroup(param.path?.group, paramOwner(name, paramKey));
    }
  }
  for (const [name, state] of Object.entries(catalog.states)) {
    const missing = state.commands.find((command) => !catalog.commands[command]);
    if (missing) {
      throw new Error(`${stateOwner(name)}: no command "${missing}" in the catalog`);
    }
  }
}
function checkStartState(states) {
  const startStates = Object.keys(states).filter((name) => states[name].start);
  if (startStates.length > 1) {
    throw new Error(`Catalog has more than one start state: ${startStates.join(", ")}`);
  }
}
function forEachWhen(catalog, visit) {
  for (const [name, state] of Object.entries(catalog.states)) {
    if (state.when) {
      visit(state.when, stateOwner(name));
    }
  }
  for (const [name, command] of Object.entries(catalog.commands)) {
    if (command.when) {
      visit(command.when, commandOwner(name));
    }
  }
}
var commandOwner = (name) => `Catalog command "${name}"`;
var paramOwner = (name, paramKey) => `${commandOwner(name)} param "${paramKey}"`;
var stateOwner = (name) => `Catalog state "${name}"`;

// ../skills/catalog-discovery/scripts/src/page-kit.js
var esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var spaced = (id) => id.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
var describeArg = (arg) => Array.isArray(arg) ? arg.join(", ") : String(arg);
var renderChips = (means) => Object.entries(means).map(([command, args]) => {
  const argText = Object.entries(args ?? {}).map(([param, arg]) => `${param} ${describeArg(arg)}`).join(" \xB7 ");
  return `<span class="chip"><span class="chip-k">${esc(command)}</span>${argText ? ` ${esc(argText)}` : ""}</span>`;
}).join("");
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
.params { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; }
.params li { border-left: 2px solid var(--rule); padding: 2px 0 2px 10px; display: grid; gap: 2px; }
.params .runtime { display: block; }
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
.val { font-family: var(--mono); font-size: 12.5px; }
.aka { color: var(--muted); margin-left: 6px; font-size: 12px; }
.runtime { color: var(--muted); font-size: 12.5px; }
.runtime code { font-family: var(--mono); }
@media (max-width: 520px) { details.language dl > div { grid-template-columns: 1fr; gap: 0; } h1 { font-size: 24px; } }
`;

// ../skills/catalog-discovery/scripts/src/render-states.js
var spokenName = (name, cmd) => cmd?.label ?? spaced(name);
var isTypedWord = (name) => /^[a-z]+$/.test(name);
var commandWords = (name, cmd) => [...isTypedWord(name) ? [name] : [], ...cmd.aliases ?? []];
var shortLabel = (state, id) => state?.summary?.split(";")[0] ?? id;
var describeWhen = (clause) => clause.replace(/[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/g, (path2) => spaced(path2.split(".").pop())).replace(/!\s*/g, "not ").replace(/&&/g, "and").replace(/\|\|/g, "or");
function conditionPaths(clause) {
  const paths = [];
  compileWhen(clause, {
    owner: "review",
    resolve: (path2) => {
      paths.push(path2);
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
var allCommands = (catalog) => Object.keys(catalog.states).flatMap(
  (stateId) => commandsFor(catalog, stateId).map((entry) => ({ ...entry, stateId }))
);
var paramsOf = (cmd) => Object.entries(cmd.params ?? {});
function rowCountOf(cmd) {
  const params = paramsOf(cmd);
  if (params.length <= 1) {
    return 1;
  }
  return params.reduce(
    (count, [, param]) => count + (param.path?.rows === "each value" ? param.argSource.list?.length ?? 1 : 1),
    0
  );
}
var paletteRowCount = (catalog, stateId) => commandsFor(catalog, stateId).filter((entry) => !entry.planned).reduce((count, { cmd }) => count + rowCountOf(cmd), 0);
var isFreeformText = (param) => Boolean(param.argSource.freeform) && (param.argSource.type ?? "text") === "text";
function describeSource(argSource) {
  if (argSource.freeform) {
    return `typed ${argSource.type ?? "text"}`;
  }
  if (argSource.list) {
    return `one of: ${argSource.list.map((entry) => entry.title).join(", ")}`;
  }
  const parts = [
    argSource.lookup && `rows from ${argSource.lookup}${argSource.key ? ` (key ${argSource.key})` : ""}`,
    argSource.current && `the app's current one from ${argSource.current}`
  ];
  return parts.filter(Boolean).join("; or ");
}
function buildMermaid(catalog) {
  const lines = ["flowchart LR", '  paletteOpens(("Palette opens"))'];
  const states = Object.entries(catalog.states);
  for (const [id, state] of states) {
    const condition = state.when ? `<br/>while ${describeWhen(state.when)}` : "";
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
    lines.push("  classDef planned stroke-dasharray: 5 4");
    lines.push(`  class ${plannedStates.join(",")} planned`);
  }
  return lines.join("\n");
}
var mermaidLabel = (text) => String(text).replaceAll('"', "#quot;");
var stateNode = (id) => `s_${id}`;
function wordsOfState(catalog, stateId) {
  const owners = {};
  const claim = (word, commandName, paramLabel) => {
    const byCommand = owners[word.toLowerCase()] ??= /* @__PURE__ */ new Map();
    byCommand.set(commandName, (byCommand.get(commandName) ?? /* @__PURE__ */ new Set()).add(paramLabel));
  };
  for (const { name, cmd } of commandsFor(catalog, stateId)) {
    const commandName = spokenName(name, cmd);
    commandWords(name, cmd).forEach((word) => claim(word, commandName, null));
    for (const [, param] of paramsOf(cmd)) {
      [param.label, ...param.aliases ?? []].forEach(
        (word) => claim(word, commandName, param.label)
      );
      (param.hints ?? []).forEach((word) => claim(word, commandName, null));
    }
  }
  return owners;
}
function ownersOf(byCommand) {
  return [...byCommand].flatMap(([commandName, paramLabels]) => {
    const params = [...paramLabels].filter(Boolean);
    return params.length ? params.map((label) => `${commandName}: ${label}`) : [commandName];
  });
}
var isAmbiguous = (byCommand) => ownersOf(byCommand).length > 1;
function findCollisions(catalog) {
  return Object.entries(catalog.states).flatMap(([stateId, state]) => {
    const words = wordsOfState(catalog, stateId);
    const owners = Object.fromEntries(
      Object.entries(words).map(([word, byCommand]) => [word, new Set(ownersOf(byCommand))])
    );
    const where = shortLabel(state, stateId);
    const sameWord = Object.keys(words).filter((word) => isAmbiguous(words[word])).map((word) => ({
      word,
      detail: `(${where}) can mean \u201C${[...owners[word]].join("\u201D or \u201C")}\u201D`
    }));
    const allWords = Object.keys(words);
    const startOfLonger = allWords.flatMap(
      (short) => allWords.filter(
        (long) => long.startsWith(`${short} `) && [...words[short].keys()].some((command) => !words[long].has(command))
      ).map((long) => ({
        word: short,
        detail: `(${where}) \u201C${[...owners[short]].join("\u201D / \u201C")}\u201D is also the start of \u201C${long}\u201D (\u201C${[...owners[long]].join("\u201D / \u201C")}\u201D)`
      }))
    );
    return [...sameWord, ...startOfLonger];
  });
}
function findUntypeable(catalog) {
  return Object.entries(catalog.commands).flatMap(([name, cmd]) => {
    const commandName = spokenName(name, cmd);
    const unnamed = commandWords(name, cmd).length ? [] : [
      {
        word: name,
        detail: `${commandName}: its name isn't a word people type, and it has no aliases. Add the phrase people use, such as \u201C${cmd.label.toLowerCase()}\u201D.`
      }
    ];
    const term = paramsOf(cmd).find(([, param]) => param.default && isFreeformText(param));
    const unhinted = term ? paramsOf(cmd).filter(([key, param]) => key !== term[0] && !param.hints?.length).map(([, param]) => ({
      word: param.label.toLowerCase(),
      detail: `${commandName}: ${param.label} can't follow the ${term[1].label.toLowerCase()} words, which read up to a hint or a closing quote. Add hints that introduce it, such as \u201Cwith\u201D.`
    })) : [];
    return [...unnamed, ...unhinted];
  });
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
  for (const [stateId, state] of Object.entries(catalog.states)) {
    const planned = Boolean(state.planned);
    if (state.when) {
      conditionPaths(state.when).forEach(
        (path2) => addUse(path2, `${stateId}: holds while`, planned)
      );
    }
    (state.steps ?? []).forEach((step) => addUse(step.run, `${stateId}: guided-flow step`, true));
  }
  const plannedCommands = new Set(
    allCommands(catalog).filter((entry) => entry.planned).map((entry) => entry.name)
  );
  for (const [name, cmd] of Object.entries(catalog.commands)) {
    const commandName = spokenName(name, cmd);
    const planned = Boolean(cmd.planned) || plannedCommands.has(name);
    addUse(cmd.run, `${commandName}: runs`, planned);
    if (cmd.when) {
      conditionPaths(cmd.when).forEach(
        (path2) => addUse(path2, `${commandName}: offered while`, planned)
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
  const items = functions.map(
    ([name, { uses, planned }]) => `<li><code>${esc(name)}</code>${planned ? '<span class="badge planned">Planned</span>' : ""}<span class="runtime">${uses.map(esc).join(" \xB7 ")}</span></li>`
  ).join("");
  return `<ul class="functions">${items || "<li>None.</li>"}</ul>`;
}
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
var TIER_LABELS = { common: "Everyday", full: "Full catalog" };
var usesTiers = (catalog) => Object.values(catalog.states).some((state) => state.tier) || Object.values(catalog.commands).some((cmd) => cmd.tier);
var tierBadge = (tier) => tier ? `<span class="badge tier-${esc(tier)}">${esc(TIER_LABELS[tier] ?? tier)}</span>` : "";
function renderParam([key, param]) {
  const traits = [
    param.default && "takes the bare words",
    param.list && "several",
    param.required && "required"
  ].filter(Boolean);
  const words = [
    `${[param.label, ...param.aliases ?? []].map(esc).join(", ")}`,
    param.hints?.length && `after: ${param.hints.map(esc).join(", ")}`
  ].filter(Boolean);
  return `<li><b>${esc(param.label)}</b> <span class="aka">(${esc(key)})</span> ${esc(describeSource(param.argSource))}${traits.length ? ` \xB7 ${traits.map(esc).join(", ")}` : ""}<span class="runtime">words: ${words.join(" \xB7 ")}</span>${param.summary ? `<span class="runtime">${esc(param.summary)}</span>` : ""}</li>`;
}
function renderCommand(catalog, { name, cmd, planned }, { stateTier, examples }) {
  const tier = cmd.tier ?? stateTier;
  const flags = [planned && "planned", cmd.when && `only while ${describeWhen(cmd.when)}`].filter(
    Boolean
  );
  const params = paramsOf(cmd);
  const exampleItems = renderExamples(examples);
  const typed = commandWords(name, cmd);
  const language = `<details class="language">
        <summary>How you say it</summary>
        <dl>
          <div><dt>command words</dt><dd>${typed.length ? typed.map(esc).join(", ") : "none: no typed line names it"}</dd></div>
          <div><dt>runs</dt><dd>${cmd.run ? `<code>${esc(cmd.run)}</code>` : "not named yet"}</dd></div>${cmd.group ? `<div><dt>group</dt><dd>${esc(catalog.groups[cmd.group]?.label ?? cmd.group)}</dd></div>` : ""}
        </dl>
      </details>`;
  return `
    <article class="command${planned ? " is-planned" : ""}" id="cmd-${esc(name)}"${tier ? ` data-tier="${esc(tier)}"` : ""}>
      <header class="command-head">
        <h3>${esc(cmd.summary ?? spokenName(name, cmd))}</h3>${tier === "full" ? tierBadge(tier) : ""}
        ${flags.length ? `<span class="flags">${flags.map(esc).join(" \xB7 ")}</span>` : ""}
      </header>
      ${params.length ? `<ul class="params" aria-label="What it takes">${params.map(renderParam).join("")}</ul>` : ""}
      ${cmd.review ? `<p class="review-note">To revisit: ${esc(cmd.review)}</p>` : ""}
      ${exampleItems ? `<ul class="examples">${exampleItems}</ul>` : ""}
      ${language}
    </article>`;
}
function renderStateMeta(state) {
  const parts = [
    state.start && ["Starts here", "when the palette opens"],
    state.when && ["Holds while", describeWhen(state.when)],
    state.panel && ["Shows", state.panel === "sidecar" ? "the side panel" : state.panel]
  ].filter(Boolean);
  return `<div class="state-meta">${parts.map(([label, value]) => `<span>${esc(label)}: <b>${esc(value)}</b></span>`).join("")}</div>`;
}
function describeStep(step) {
  if (step.ask?.text) {
    return `asks for text: \u201C${step.ask.text}\u201D`;
  }
  if (step.ask?.choose) {
    return `picks from: ${spaced(step.ask.choose)}`;
  }
  return `runs ${step.run ?? "(not named yet)"}${step.then ? `, then ${step.then}` : ""}`;
}
function renderSteps(steps) {
  const items = steps.map((step) => `<li class="step">${esc(describeStep(step))}</li>`).join("");
  return `<article class="command is-planned"><header class="command-head"><h3>Steps, in order</h3><span class="flags">guided flow</span></header><ol class="steps">${items}</ol></article>`;
}
function renderState(catalog, stateId, state, examplesByCommand) {
  const isPlanned = Boolean(state.planned);
  const rows = isPlanned ? null : paletteRowCount(catalog, stateId);
  const commands = commandsFor(catalog, stateId).map(
    (entry) => renderCommand(catalog, entry, {
      stateTier: state.tier,
      examples: state.start ? examplesByCommand[entry.name] ?? [] : []
    })
  ).join("");
  return `
  <section class="group" id="state-${esc(stateId)}"${state.tier ? ` data-tier="${esc(state.tier)}"` : ""}>
    <div class="state-head">
      <h2>${esc(state.summary ?? stateId)} <span class="badge ${isPlanned ? "planned" : "built"}">${isPlanned ? "Planned" : "Built"}</span>${tierBadge(state.tier)}</h2>
      ${renderStateMeta(state)}
      ${rows !== null ? `<div class="state-meta"><span>Palette rows today: <b>${rows}</b></span></div>` : ""}
      ${state.review ? `<p class="review-note">To revisit: ${esc(state.review)}</p>` : ""}
    </div>
    ${commands}
    ${state.steps ? renderSteps(state.steps) : ""}
  </section>`;
}
function renderWorkflow(catalog, [id, workflow]) {
  const steps = workflow.steps ?? workflow.options ?? [];
  const items = steps.map((step) => {
    const where = step.state ? `<span class="where">${esc(shortLabel(catalog.states[step.state], step.state))}</span>` : "";
    const then = step.then ? `<span class="then">then: ${[step.then].flat().map(esc).join(" \xB7 ")}</span>` : "";
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
var TIER_TOGGLE = `<div class="tier-toggle">
    <label for="common-only"><input id="common-only" type="checkbox"> Show the everyday view only (hide commands and states tagged \u201CFull catalog\u201D)</label>
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
    return "";
  }
  return `<section id="workflows" class="group">
    <h2>Workflows</h2>
    <p class="section-note">Named paths through the states. Each step shows the state it happens in and what you'd type.</p>
    ${Object.entries(catalog.workflows).map((entry) => renderWorkflow(catalog, entry)).join("")}
  </section>`;
}
function renderStatesPage(catalog, examples = []) {
  const states = Object.entries(catalog.states);
  const counts = countCatalog(catalog, examples);
  const { byCommand, unmatchedCount } = groupExamplesByCommand(catalog, examples);
  const collisions = findCollisions(catalog);
  const untypeable = findUntypeable(catalog);
  const functions = collectFunctions(catalog);
  const body = `
  ${usesTiers(catalog) ? TIER_TOGGLE : ""}
  <section id="map">
    <h2>The states</h2>
    <p class="section-note">Each box is a state: a context the user is in, with its own list of commands. A state holds while its condition does, so the app's own state decides the list; the catalog doesn't say which command changes a condition. Dashed boxes are planned, not built.</p>
    ${renderMap(buildMermaid(catalog))}
  </section>

  <div id="states" class="groups">
    ${states.map(([id, state]) => renderState(catalog, id, state, byCommand)).join("")}
  </div>

  ${renderWorkflows(catalog)}

  <section id="collisions">
    <h2>Words that mean two things</h2>
    <p class="section-note">Checked within each state, since the palette reads one state's commands at a time. Includes command names and aliases, and each param's label, aliases and hints.</p>
    ${renderCollisions(collisions)}
  </section>

  <section id="untypeable">
    <h2>Words nobody can type</h2>
    <p class="section-note">A typed line names a command by its name or an alias, not its label. A param after unquoted typed text needs a hint (such as \u201Cwith\u201D) to start it; after a closing quote, the param's own word (such as \u201Ckind\u201D) starts it too.</p>
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
      lede: "Organized by state: the context you are in decides which commands the palette offers. Check each state against how you expect to move through the app: what should be available here, and what should not?",
      stats: [
        [counts.builtStates, "states built"],
        [counts.plannedStates, "states planned"],
        [counts.builtRows, "palette rows built"],
        [counts.plannedCommands, "commands planned"],
        [counts.examples, "examples"],
        unmatchedCount && [unmatchedCount, "examples matching no start-state command"],
        [collisions.length, "words that mean two things"],
        [untypeable.length, "words nobody can type"],
        [functions.length, "functions named"]
      ].filter(Boolean),
      nav: [
        ["map", "States"],
        ...states.map(([id, state]) => [
          `state-${id}`,
          `${shortLabel(state, id)}${state.planned ? " (planned)" : ""}`
        ]),
        catalog.workflows && ["workflows", "Workflows"],
        ["collisions", "Words that mean two things"],
        ["untypeable", "Words nobody can type"],
        ["functions", "Functions"]
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
