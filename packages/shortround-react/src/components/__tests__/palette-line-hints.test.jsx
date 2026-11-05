// The palette's input shows how the line is being read: each word with its role and the ghost, from the palette's
// command line, with Tab completing through it. On by default for a palette given a `palette`; `disableLineHints`
// turns it off; plain rows and a step's own input never show it.
import {
  buildPalette,
  createSidekickStore,
  loadCatalog,
  RevertIntentionIds
} from '@shortround/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';

import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

// A theme that only draws: the input slot shows core's input as given; rows show their titles.
const stubComponents = {
  IntentionPalette: {
    Frame: Pass,
    Input: ({ input }) => input,
    Item: ({ intention }) => <span>{intention.title}</span>,
    Group: () => null,
    NoMatches: () => null
  },
  Sidekick: { Frame: Pass, Popover: Pass, ControlBar: () => null },
  SidecarContent: () => null
};

const CATALOG = `
version: 3
app: app
states:
  browsing: { commands: [search, preview] }
commands:
  search:
    label: Search
    run: app.search
    params:
      term: { label: Search, default: true, argSource: { freeform: true, type: text } }
      sort:
        label: Sort
        hints: [with]
        argSource:
          list:
            - { value: created-newest, title: Created (newest) }
            - { value: relevance, title: Relevance }
  preview:
    label: Preview
    run: app.preview
    params: { result: { label: Result, default: true, argSource: { lookup: app.rows } } }
`;

const SLOW_TAGS_CATALOG = `
version: 3
app: app
states:
  browsing: { commands: [search] }
commands:
  search:
    label: Search
    run: app.search
    params:
      term: { label: Search, default: true, argSource: { freeform: true, type: text } }
      tags: { label: Tag, aliases: [tagged], list: true, argSource: { lookup: app.tags } }
`;

function renderSidekick(props) {
  const sidekickStore = createSidekickStore({ isOpen: true });
  render(
    <ShortRoundSidekick
      SidekickComponents={stubComponents}
      sidekickStore={sidekickStore}
      {...props}
    />
  );
}

function makePalette() {
  const bindings = {
    app: {
      search: vi.fn(),
      preview: vi.fn(),
      rows: () => [{ value: 'w1', title: '1. Grid notes' }]
    }
  };
  return buildPalette(loadCatalog(CATALOG, bindings), {
    backIntentionId: RevertIntentionIds.BACK
  });
}

const input = () => screen.getByTestId('shortround-input');
const type = (text) => fireEvent.change(input(), { target: { value: text } });
const rolesShown = () =>
  [...document.querySelectorAll('[data-role]')]
    .filter((node) => node.dataset.role !== 'ghost')
    .map((node) => `${node.textContent}:${node.dataset.role}`);
const ghostShown = () => document.querySelector('[data-role="ghost"]')?.textContent ?? null;

describe('line hints in the palette input', () => {
  test('typing a line shows each word with its role, and the ghost', () => {
    renderSidekick({ palette: makePalette() });

    type('search grid with sort cre');

    expect(rolesShown()).toEqual([
      'search:verb',
      'grid:text',
      'with:hint',
      'sort:param',
      'cre:value'
    ]);
    expect(ghostShown()).toBe('ated-newest ');
  });

  // Tab rewrites the input through the store, so this also guards the line following the store's input. (A completion
  // row can't guard that in jsdom: a delayed `selectionchange` re-reads the line by the caret path first.)
  test('Tab completes through the line, and the caret lands after the word', () => {
    renderSidekick({ palette: makePalette() });
    type('search grid with sort cre');

    fireEvent.keyDown(input(), { key: 'Tab' });

    expect(input().value).toBe('search grid with sort created-newest ');
    expect(input().selectionStart).toBe(37);
    expect(rolesShown().at(-1)).toBe('created-newest:value');
  });

  // At the end of a line, the line and the list's first completion row complete alike; with the caret mid-line only
  // the line knows where it is.
  test('Tab with the caret mid-line completes that word and keeps the words after it', () => {
    renderSidekick({ palette: makePalette() });
    type('sea grid');
    input().setSelectionRange(3, 3);
    fireEvent.select(input());

    fireEvent.keyDown(input(), { key: 'Tab' });

    expect(input().value).toBe('search grid');
    expect(input().selectionStart).toBe(7);
  });

  // Right after a command's name, a default param with values offers them; after "preview " the
  // ghost is the first result, Tab takes it and Enter previews it.
  test('after "preview ", the ghost is the first result; Tab then Enter previews it once', async () => {
    const preview = vi.fn();
    const palette = buildPalette(
      loadCatalog(CATALOG, {
        app: { search: vi.fn(), preview, rows: () => [{ value: 'w1', title: '1. Grid notes' }] }
      }),
      { backIntentionId: RevertIntentionIds.BACK }
    );
    renderSidekick({ palette });

    type('preview ');
    expect(ghostShown()).toBe('w1 ');

    fireEvent.keyDown(input(), { key: 'Tab' });
    expect(input().value).toBe('preview w1 ');
    await act(async () => fireEvent.keyDown(input(), { key: 'Enter' }));

    expect(preview).toHaveBeenCalledTimes(1);
    expect(preview).toHaveBeenCalledWith({ result: 'w1' });
  });

  test('disableLineHints gives the plain input', () => {
    renderSidekick({ palette: makePalette(), disableLineHints: true });

    type('search grid with sort cre');

    expect(document.querySelector('[data-role]')).toBeNull();
    expect(input().value).toBe('search grid with sort cre');
  });

  // `palette` takes any PaletteSource; only buildPalette's result has commandLine().
  test('a palette source without a command line gives the plain input', () => {
    const save = { id: 'save', title: 'Save file', action: () => ({}) };
    const source = {
      current: () => ({ intentions: [save] }),
      subscribe: () => () => {},
      isAvailable: () => true
    };
    renderSidekick({ palette: source });

    type('save');

    expect(screen.getByText('Save file')).toBeInTheDocument();
    expect(document.querySelector('[data-role]')).toBeNull();
  });

  test('a palette of plain rows gives the plain input', () => {
    renderSidekick({
      defaultIntentions: [{ id: 'save', title: 'Save file', action: () => ({}) }]
    });

    type('save');

    expect(document.querySelector('[data-role]')).toBeNull();
  });

  // React's StrictMode (an app's dev build) mounts, unmounts and mounts again: the line must survive it, and a slow
  // lookup's values must still reach the rows and the line. The rows and the hints are one reading (the store's line);
  // `land` answers every call, as an API would, so StrictMode's discarded line can't swallow the answer.
  test('under StrictMode, a slow lookup lands in the rows and the line', async () => {
    const waiting = [];
    const land = () =>
      waiting.splice(0).forEach((resolve) => resolve([{ value: 'react', title: 'react' }]));
    const palette = buildPalette(
      loadCatalog(SLOW_TAGS_CATALOG, {
        app: {
          search: vi.fn(),
          tags: () => new Promise((resolve) => waiting.push(resolve))
        }
      }),
      { backIntentionId: RevertIntentionIds.BACK }
    );
    render(
      <StrictMode>
        <ShortRoundSidekick
          SidekickComponents={stubComponents}
          palette={palette}
          sidekickStore={createSidekickStore({ isOpen: true })}
        />
      </StrictMode>
    );

    type('tagged ');
    await act(async () => land());

    // Testing Library trims the attribute's value before matching ("next:tagged react ").
    expect(await screen.findByTestId('shortround-item-next:tagged react')).toBeInTheDocument();
    expect(ghostShown()).toBe('react ');
  });

  // StrictMode builds hooks' values twice; a command line React drops must still be disposed, or it keeps following
  // the palette (re-reading on every notify()) for as long as the palette lives.
  test('under StrictMode, every command line but the one in use is disposed', () => {
    const palette = makePalette();
    const lines = [];
    const makeLine = palette.commandLine;
    palette.commandLine = () => {
      const line = makeLine();
      const entry = { isDisposed: false };
      lines.push(entry);
      return {
        ...line,
        dispose: () => {
          entry.isDisposed = true;
          line.dispose();
        }
      };
    };
    render(
      <StrictMode>
        <ShortRoundSidekick
          SidekickComponents={stubComponents}
          palette={palette}
          sidekickStore={createSidekickStore({ isOpen: true })}
        />
      </StrictMode>
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.filter(({ isDisposed }) => !isDisposed)).toHaveLength(1);
  });

  // The input must be in its final place in the tree on the first render: the dialog focuses it then, and an input
  // React replaces afterwards takes focus with it.
  test('the input has focus when the sidekick opens', () => {
    renderSidekick({ palette: makePalette() });

    expect(document.activeElement).toBe(input());
  });

  test('the input has focus when a closed sidekick opens later', () => {
    const sidekickStore = createSidekickStore({ isOpen: false });
    render(
      <ShortRoundSidekick
        SidekickComponents={stubComponents}
        palette={makePalette()}
        sidekickStore={sidekickStore}
      />
    );

    act(() => sidekickStore.set({ isOpen: true }));

    expect(document.activeElement).toBe(input());
  });

  // The store clears the input after a run; the words drawn under it must go too.
  test('after Enter runs the line, no words are left under the empty input', async () => {
    renderSidekick({ palette: makePalette() });
    type('search grid with sort relevance ');

    await act(async () => fireEvent.keyDown(input(), { key: 'Enter' }));

    expect(input().value).toBe('');
    expect(document.querySelector('[data-role]')).toBeNull();
  });

  // A picker's input filters its rows; read as a command line, it would call lookups for nothing.
  test("typing in a picker doesn't call the command line's lookups", async () => {
    const tags = vi.fn(() => [{ value: 'react', title: 'react' }]);
    const palette = buildPalette(
      loadCatalog(
        `${SLOW_TAGS_CATALOG.replace('commands: [search]', 'commands: [search, preview]')}
  preview:
    label: Preview
    run: app.preview
    params: { result: { label: Result, default: true, argSource: { lookup: app.rows } } }
`,
        {
          app: {
            search: vi.fn(),
            preview: vi.fn(),
            tags,
            rows: () => [{ value: 'w1', title: '1. Grid notes' }]
          }
        }
      ),
      { backIntentionId: RevertIntentionIds.BACK }
    );
    renderSidekick({ palette });
    await act(async () => fireEvent.click(screen.getByText('Preview')));
    expect(screen.getByText('1. Grid notes')).toBeInTheDocument();
    tags.mockClear();

    type('tagged re');

    expect(tags).not.toHaveBeenCalled();
  });

  test("a picker's own input shows no hints", async () => {
    renderSidekick({ palette: makePalette() });

    await act(async () => fireEvent.click(screen.getByText('Preview')));
    type('gr');

    expect(screen.getByText('1. Grid notes')).toBeInTheDocument();
    expect(document.querySelector('[data-role]')).toBeNull();
  });
});

// The rows and the input are one reading, the palette store's line.
describe('one reading for the rows and the input', () => {
  test('a typed line calls its lookup once, and the rows, the ghost and Tab agree', () => {
    const rows = vi.fn(() => [{ value: 'w1', title: '1. Grid notes' }]);
    const palette = buildPalette(
      loadCatalog(CATALOG, { app: { search: vi.fn(), preview: vi.fn(), rows } }),
      { backIntentionId: RevertIntentionIds.BACK }
    );
    renderSidekick({ palette });

    type('preview ');

    expect(rows).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1. Grid notes')).toBeInTheDocument();
    expect(ghostShown()).toBe('w1 ');
    fireEvent.keyDown(input(), { key: 'Tab' });
    expect(input().value).toBe('preview w1 ');
  });

  // `disableLineHints` turns off drawing only; Tab still completes at the caret and places it.
  test('with line hints off, Tab mid-line still puts the caret after the completed word', () => {
    renderSidekick({ palette: makePalette(), disableLineHints: true });
    type('sea grid');
    input().setSelectionRange(3, 3);
    fireEvent.select(input());

    fireEvent.keyDown(input(), { key: 'Tab' });

    expect(input().value).toBe('search grid');
    expect(input().selectionStart).toBe(7);
  });

  test('with the caret mid-line, the completion rows are the next steps there', () => {
    renderSidekick({ palette: makePalette() });
    type('sea grid');
    expect(screen.queryByText('search')).toBeNull();

    input().setSelectionRange(3, 3);
    fireEvent.select(input());

    expect(screen.getByText('search')).toBeInTheDocument();
  });
});
