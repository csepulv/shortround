import { createElement } from 'react';

import { RevertIntentionIds } from './utils.js';

const CORE_ROW_IDS = new Set(Object.values(RevertIntentionIds));

const themeIconFor = (name, themeIcons) => themeIcons[name] ?? themeIcons.unknown;

const drawn = (Component, props) => (Component ? createElement(Component, props) : undefined);

// The icon a row shows: the app's choice for this intention, else its name drawn by the app's Icon, else the
// theme's icon for the name or its placeholder. Back and Cancel are core's own rows, so they keep the theme's icons
// unless the app overrides them by id: an app's icon set may have no name for them.
export function resolveIcon(intention, { registry = {}, themeIcons = {} }) {
  const override = registry.intentions?.[intention.id];
  if (override) {
    return drawn(override);
  }
  if (!intention.icon) {
    return undefined;
  }
  if (CORE_ROW_IDS.has(intention.id)) {
    return drawn(themeIconFor(intention.icon, themeIcons));
  }
  const name = registry.names?.[intention.icon] ?? intention.icon;
  if (registry.Icon) {
    return drawn(registry.Icon, { name });
  }
  return drawn(themeIconFor(name, themeIcons));
}
