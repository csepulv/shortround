import CatalogPaletteExample from './mui/CatalogPaletteExample';

// A palette from a catalog, with the input's line hints, and the same palette with them off.
export default {
  title: 'Example/Catalog palette',
  component: CatalogPaletteExample,
  parameters: { layout: 'centered' }
};

export const LineHints = {
  args: { isOpen: true, title: 'Notes', disableLineHints: false }
};

export const PlainInput = {
  args: { isOpen: true, title: 'Notes', disableLineHints: true }
};
