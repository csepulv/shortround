import { JSX, ReactNode } from 'react';
import { SidekickComponents } from '@shortround/core';

export const MuiSidekickComponents: SidekickComponents;

export function MuiToastProvider(props: { children: ReactNode }): JSX.Element;

// Call inside a MuiToastProvider.
export function useMuiToast(): {
  showToast: (args: { message: ReactNode }) => void;
  closeToast: () => void;
};
