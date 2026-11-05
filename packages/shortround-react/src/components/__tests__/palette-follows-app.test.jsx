// The sidekick given a palette: it opens on the app's state now, with that state's side panel, and follows the app's
// notify() while open.
import {
  buildPalette,
  createSidekickStore,
  loadCatalog,
  RevertIntentionIds
} from '@shortround/core';
import { act, render, screen } from '@testing-library/react';

import { ShortRoundSidekick } from '../ShortRoundSidekick.jsx';

const Pass = ({ children }) => <div>{children}</div>;

// A theme that only draws: rows show their titles, and the side panel shows what core renders there.
const stubComponents = {
  IntentionPalette: {
    Frame: Pass,
    Input: () => null,
    Item: ({ intention }) => <span>{intention.title}</span>,
    Group: () => null,
    NoMatches: () => null
  },
  Sidekick: { Frame: Pass, Popover: Pass, ControlBar: () => null },
  SidecarContent: ({ isOpen, renderSidecar }) =>
    isOpen ? <div data-testid="sidecar">{renderSidecar()}</div> : null
};

const CATALOG = `
version: 3
app: app
groups:
  results: { label: Results }
  preview: { label: Preview }
states:
  browsing: { when: '!app.previewed', commands: [preview] }
  previewing: { when: app.previewed, panel: sidecar, commands: [next, closePreview] }
commands:
  preview:
    label: Preview
    group: results
    run: app.preview
    params: { result: { label: Result, default: true, argSource: { lookup: app.rows } } }
  next: { label: Next, group: preview, run: app.next }
  closePreview: { label: Close preview, group: preview, run: app.close }
`;

function setup({ isPreviewed = false } = {}) {
  const app = { isPreviewed };
  const bindings = {
    app: {
      previewed: () => app.isPreviewed,
      rows: () => [{ value: 'w2', title: '3. CSS grid guide' }],
      preview: () => {
        app.isPreviewed = true;
      },
      next: vi.fn(),
      close: () => {
        app.isPreviewed = false;
      }
    }
  };
  const palette = buildPalette(loadCatalog(CATALOG, bindings), {
    panels: { sidecar: () => 'preview panel' },
    backIntentionId: RevertIntentionIds.BACK
  });
  const sidekickStore = createSidekickStore({ isOpen: true });
  render(
    <ShortRoundSidekick
      SidekickComponents={stubComponents}
      palette={palette}
      sidekickStore={sidekickStore}
    />
  );
  return { app, palette, sidekickStore };
}

const sidecarText = () => screen.queryByTestId('sidecar')?.textContent ?? null;

describe('a sidekick given a palette', () => {
  test("opens on the app's state now, with that state's side panel", () => {
    setup({ isPreviewed: true });

    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.getByText('Close preview')).toBeInTheDocument();
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    expect(sidecarText()).toBe('preview panel');
  });

  test("follows the app's notify() while open", () => {
    const { app, palette } = setup({ isPreviewed: true });

    act(() => {
      app.isPreviewed = false;
      palette.notify();
    });

    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
  });

  test('reopens on the state the app reached while it was closed', () => {
    const { app, sidekickStore } = setup();
    expect(screen.getByText('Preview')).toBeInTheDocument();

    act(() => sidekickStore.set({ isOpen: false }));
    app.isPreviewed = true;
    act(() => sidekickStore.set({ isOpen: true }));

    expect(screen.getByText('Next')).toBeInTheDocument();
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    expect(sidecarText()).toBe('preview panel');
  });
});
