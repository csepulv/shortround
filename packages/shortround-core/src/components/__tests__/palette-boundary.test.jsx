// Core owns cmdk (theme-provider M3): a theme whose Item and Input only draw, importing nothing from cmdk,
// still gets keyboard and click selection, disabled rows, ids as values and a controlled input (TP-15).
import { act, fireEvent, render, screen } from '@testing-library/react';

import { SidekickStoreProvider } from '../../hooks/useSidekick.js';
import { ShortRoundPalette } from '../ShortRoundPalette.jsx';

const drawOnlyPalette = {
  Frame: ({ children }) => <div>{children}</div>,
  Input: ({ input, inputMessage }) => (
    <div>
      {input}
      {inputMessage && <p>{inputMessage.text}</p>}
    </div>
  ),
  NoMatches: () => null,
  Group: () => null,
  Item: ({ intention, isSelected }) => (
    <span data-selected-view={String(isSelected)}>{intention.title}</span>
  )
};

const makeIntentions = (ran) => [
  { id: 'open', title: 'Open file', group: 'Files', action: () => ran.push('open') },
  { id: 'save', title: 'Save file', group: 'Files', action: () => ran.push('save') },
  {
    id: 'locked',
    title: 'Locked',
    group: 'Files',
    disabled: true,
    action: () => ran.push('locked')
  },
  {
    id: 'strict',
    title: 'Strict',
    group: 'Files',
    validate: () => ({ valid: false, message: 'Not allowed here' }),
    action: () => ran.push('strict')
  }
];

const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 0)));

async function renderPalette() {
  const ran = [];
  render(
    <SidekickStoreProvider>
      <ShortRoundPalette
        IntentionPalette={drawOnlyPalette}
        defaultIntentions={makeIntentions(ran)}
      />
    </SidekickStoreProvider>
  );
  await settle();
  return ran;
}

const row = (id) => screen.getByTestId(`shortround-item-${id}`);
const input = () => screen.getByTestId('shortround-input');
const pressKey = async (key) => {
  await act(async () => fireEvent.keyDown(document.querySelector('[cmdk-root]'), { key }));
  await settle();
};
const type = async (text) => {
  await act(async () => fireEvent.change(input(), { target: { value: text } }));
  await settle();
};

test("the input is core's cmdk input, placed by the theme, with today's placeholder", async () => {
  await renderPalette();

  expect(input().hasAttribute('cmdk-input')).toBe(true);
  expect(input().getAttribute('placeholder')).toBe('Type a intention or search...');
});

test('typing narrows the rows', async () => {
  await renderPalette();

  await type('save');

  expect(screen.queryByTestId('shortround-item-save')).not.toBeNull();
  expect(screen.queryByTestId('shortround-item-open')).toBeNull();
});

test('the input is controlled: it clears after an intention runs', async () => {
  const ran = await renderPalette();
  await type('save');

  await act(async () => row('save').click());
  await settle();

  expect(ran).toEqual(['save']);
  expect(input().value).toBe('');
});

test("the theme shows the input's message", async () => {
  await renderPalette();

  await type('zzz');

  expect(screen.getByText('Not allowed here')).toBeTruthy();
});

test('rows are cmdk items known by their ids', async () => {
  await renderPalette();

  expect(row('open').hasAttribute('cmdk-item')).toBe(true);
  expect(row('open').getAttribute('data-value')).toBe('open');
});

test('Enter runs the highlighted row; ArrowDown moves the highlight', async () => {
  const ran = await renderPalette();
  expect(row('open').getAttribute('data-selected')).toBe('true');

  await pressKey('ArrowDown');
  await pressKey('Enter');

  expect(ran).toEqual(['save']);
});

test('the theme is told which row is selected', async () => {
  await renderPalette();

  expect(row('open').querySelector('[data-selected-view]').getAttribute('data-selected-view')).toBe(
    'true'
  );
  expect(row('save').querySelector('[data-selected-view]').getAttribute('data-selected-view')).toBe(
    'false'
  );
});

test('a click runs the row', async () => {
  const ran = await renderPalette();

  await act(async () => row('open').click());
  await settle();

  expect(ran).toEqual(['open']);
});

test('a disabled row is marked and does not run', async () => {
  const ran = await renderPalette();

  expect(row('locked').getAttribute('aria-disabled')).toBe('true');
  await act(async () => row('locked').click());
  await settle();

  expect(ran).toEqual([]);
});
