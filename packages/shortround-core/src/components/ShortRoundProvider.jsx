import { useCallback, useMemo, useState } from 'react';

import { ShortRoundThemeContext } from '../hooks/useShortRoundTheme.js';

const CLOSED_TOAST = { isOpen: false, message: null };

const SLOT_GROUPS = ['IntentionPalette', 'Sidekick', 'SidecarContent'];

function requireTheme(theme) {
  const missing = ['components', 'Toast'].filter((key) => !theme?.[key]);
  if (missing.length > 0) {
    throw new Error(`ShortRoundProvider: the theme has no ${missing.join(' or ')}`);
  }
  const missingGroups = SLOT_GROUPS.filter((group) => !theme.components[group]);
  if (missingGroups.length > 0) {
    throw new Error(
      `ShortRoundProvider: the theme has no ${missingGroups.map((group) => `components.${group}`).join(' or ')}`
    );
  }
}

// The composition root: the one place an app chooses its theme and, optionally, its own icons. Below it,
// ShortRoundSidekick takes its slots and icons from here, and app code shows toasts through useShortRoundToast
// without naming the theme.
export function ShortRoundProvider({ theme, icons, children }) {
  requireTheme(theme);
  const [toast, setToast] = useState(CLOSED_TOAST);

  const showToast = useCallback(({ message }) => setToast({ isOpen: true, message }), []);
  // Keeps the message while the theme's view animates out.
  const closeToast = useCallback(() => setToast((current) => ({ ...current, isOpen: false })), []);

  const value = useMemo(
    () => ({ components: theme.components, showToast, icons }),
    [theme.components, showToast, icons]
  );
  const { Toast } = theme;

  return (
    <ShortRoundThemeContext.Provider value={value}>
      {children}
      <Toast isOpen={toast.isOpen} message={toast.message} onClose={closeToast} />
    </ShortRoundThemeContext.Provider>
  );
}
