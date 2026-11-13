import { beforeEach, describe, test, vi } from 'vitest';

import { CONTRACT_CHECKS } from './contract-checks.js';

const PALETTE_GROUPS = ['IntentionPalette', 'Sidekick', 'SidecarContent'];

const HAS_GROUP = {
  palette: (components) => PALETTE_GROUPS.some((group) => components[group]),
  chat: (components) => Boolean(components.Chat),
  toast: () => true
};

/** The checks for the groups a theme has: the palette's when it has any palette group, the chat's when it has Chat. */
export const checksFor = (theme) =>
  CONTRACT_CHECKS.filter(({ group }) => HAS_GROUP[group](theme.components));

// Registers one test per obligation for a theme (the object an app hands to ShortRoundProvider:
// `{ components, Toast }`), named after the slot and what it must do, so a failing test says which part
// of the theme falls short.
export function describeThemeContract(name, theme) {
  if (!theme?.components) {
    throw new Error(
      'describeThemeContract takes the theme object { components, Toast } (since 0.3.0), not the bare slots'
    );
  }
  describe(`${name} meets the ShortRound theme contract`, () => {
    // The checks wait on real time (ShortRound runs intentions asynchronously), whatever timers the
    // theme's own tests use.
    beforeEach(() => {
      vi.useRealTimers();
    });

    for (const { slots, obligation, run } of checksFor(theme)) {
      test(`${slots.join(', ')}: ${obligation}`, () => run(theme));
    }
  });
}
