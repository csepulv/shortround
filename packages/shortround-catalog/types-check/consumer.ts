// Checks the hand-written declaration files against each other: this package's types must fit
// @shortround/core's, as the README uses them. `pnpm verify` runs it (`types:check`).
import type { ComponentProps } from 'react';

import {
  ControlLabels,
  type Intention,
  type ResolveInput,
  type ShortRoundTheme,
  ShortRoundProvider,
  ShortRoundSidekick,
  type SidekickComponents,
  useShortRoundToast
} from '@shortround/core';
import {
  buildPalette,
  checkCatalog,
  loadCatalog,
  type PickerRow,
  type RunOutcome
} from '@shortround/catalog';

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
  backIntentionId: 'back'
});

// What the README passes to ShortRoundSidekick.
export const defaultIntentions: Intention[] = palette.intentions;
export const resolveDefaultInput: ResolveInput = palette.resolveInput;

// Themes pass an intention's keywords to cmdk (theme-provider M1).
export const withKeywords: Intention = {
  id: 'x',
  title: 'X',
  keywords: ['ex'],
  action: () => ({})
};

// Themes show an intention's subtitle (the contract's Item obligation).
export const withSubtitle: Intention = { id: 'y', title: 'Y', subtitle: 'Why', action: () => ({}) };

// The theme an app hands to ShortRoundProvider at its root (theme-provider M2); below it, the sidekick
// needs no slots and app code shows toasts through core.
declare const components: SidekickComponents;
export const theme: ShortRoundTheme = {
  components,
  Toast: ({ isOpen, message }) => (isOpen ? message : null)
};
export const root = ShortRoundProvider({ theme, children: null });
export const sidekickUnderRoot = ShortRoundSidekick({ defaultIntentions });
export const showSaved = () => useShortRoundToast().showToast({ message: 'Saved' });

// Slots that only draw (theme-provider M3): core hands Input its cmdk input element, tells Item whether its
// row is selected, and gives ControlBar the controls' names.
type PaletteSlots = SidekickComponents['IntentionPalette'];
type ControlBarProps = ComponentProps<SidekickComponents['Sidekick']['ControlBar']>;
export const drawOnlyInput: PaletteSlots['Input'] = ({ input, inputMessage }) =>
  inputMessage ? inputMessage.text : input;
export const drawOnlyItem: PaletteSlots['Item'] = ({ intention, isSelected }) =>
  isSelected ? `> ${intention.title}` : intention.title;
export const closeName: string = ({} as ControlBarProps).labels.close;
export const fullSizeName: string = ControlLabels.sizes.full;

// A catalog can be checked without the app, e.g. by a review tool; it names its start state.
export const startState: string = checkCatalog(catalogText).startState;

// A run function may be async.
export const asyncOutcome: RunOutcome = Promise.resolve({ message: 'Sorted' });
