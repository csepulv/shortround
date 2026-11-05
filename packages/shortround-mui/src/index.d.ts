import { JSX, ReactNode } from 'react';
import { ShortRoundTheme, SidekickComponents } from '@shortround/react';

/** MUI's theme for `ShortRoundProvider`: its slots and its Toast view. */
export const muiTheme: ShortRoundTheme;

export const MuiSidekickComponents: SidekickComponents;

export function MuiToastProvider(props: { children: ReactNode }): JSX.Element;

// Call inside a MuiToastProvider.
export function useMuiToast(): {
  showToast: (args: { message: ReactNode }) => void;
  closeToast: () => void;
};
