// Shared pieces for the catalog review pages: escaping, naming, styles and the page shell.

export const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
export const spaced = (id) => id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
export const asList = (value) =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

// An example means one intention id, or a list of them (a line of several commands, in order).
const renderChips = (means) =>
  asList(means)
    .map(
      (intentionId) => `<span class="chip"><span class="chip-k">${esc(intentionId)}</span></span>`
    )
    .join('');

export const renderExamples = (examples) =>
  (examples ?? [])
    .map(
      (example) => `
      <li class="example">
        <code class="say"><span class="prompt" aria-hidden="true">⌘K</span>${esc(example.say)}</code>
        <div class="means"><span class="arrow" aria-hidden="true">→</span>${renderChips(example.means)}</div>
      </li>`
    )
    .join('');

export const renderStats = (stats) =>
  stats.map(([count, label]) => `<span><b>${esc(count)}</b> ${esc(label)}</span>`).join('');

export const renderMap = (mermaidSource) => `<div class="map"><pre class="mermaid">
${esc(mermaidSource)}
    </pre></div>`;

// Each collision: { word, detail }.
export const renderCollisions = (collisions) =>
  `<ul class="collisions">${collisions.map((c) => `<li><code>${esc(c.word)}</code> ${esc(c.detail)}</li>`).join('') || '<li>None found.</li>'}</ul>`;

export function renderShell({ app, version, sourceName, lede, stats, nav, body }) {
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
    <span class="eyebrow">Catalog review · format v${esc(version)}</span>
    <h1>What you can say to ${esc(app)}</h1>
    <p class="lede">Generated from <code>${esc(sourceName)}</code>. ${lede}</p>
    <div class="stats">${renderStats(stats)}</div>
    <nav class="jump" aria-label="Sections">${nav.map(([id, label]) => `<a href="#${id}">${esc(label)}</a>`).join('')}</nav>
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

const STYLE = `
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
