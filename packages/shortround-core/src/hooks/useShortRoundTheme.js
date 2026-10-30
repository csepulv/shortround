import { createContext, useContext } from 'react';

// Filled by ShortRoundProvider: the theme's slots and the provider's showToast.
export const ShortRoundThemeContext = createContext(null);

// For core's own components: the nearest provider's theme, or null when there is none.
export const useShortRoundTheme = () => useContext(ShortRoundThemeContext);

export function useShortRoundToast() {
  const provided = useShortRoundTheme();
  if (!provided) {
    throw new Error('useShortRoundToast needs a <ShortRoundProvider theme={…}> above it');
  }
  return { showToast: provided.showToast };
}
