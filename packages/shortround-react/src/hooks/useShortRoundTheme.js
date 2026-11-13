import { createContext, useContext } from 'react';

// Filled by ShortRoundProvider: the theme's slots and the provider's showToast.
export const ShortRoundThemeContext = createContext(null);

// For core's own components: the nearest provider's theme, or null when there is none.
export const useShortRoundTheme = () => useContext(ShortRoundThemeContext);

/**
 * The nearest provider's theme slots (`theme.components`), or null when there is no provider: for packages that draw
 * through slot groups of their own, such as `@shortround/chat`'s `Chat`.
 */
export const useShortRoundComponents = () => useShortRoundTheme()?.components ?? null;

export function useShortRoundToast() {
  const provided = useShortRoundTheme();
  if (!provided) {
    throw new Error('useShortRoundToast needs a <ShortRoundProvider theme={…}> above it');
  }
  return { showToast: provided.showToast };
}
