import { ComponentType, JSX, ReactNode } from 'react';
import { ShortRoundTheme, SidekickComponents } from '@shortround/react';

/** MUI's theme for `ShortRoundProvider`: its slots (the palette's, and `Chat` for `@shortround/chat`) and its Toast. */
export const muiTheme: ShortRoundTheme & { components: typeof MuiSidekickComponents };

/**
 * MUI's slots. `Chat` draws `@shortround/chat`'s `<IntentionChat>` (its props are `ChatComponents` there); this
 * package doesn't depend on `@shortround/chat`.
 */
export const MuiSidekickComponents: SidekickComponents & {
  Chat: Record<
    | 'Frame'
    | 'Transcript'
    | 'Message'
    | 'Text'
    | 'IntentionRun'
    | 'ToolRun'
    | 'Error'
    | 'Composer'
    | 'Row'
    | 'Input',
    ComponentType<any>
  >;
};

export function MuiToastProvider(props: { children: ReactNode }): JSX.Element;

// Call inside a MuiToastProvider.
export function useMuiToast(): {
  showToast: (args: { message: ReactNode }) => void;
  closeToast: () => void;
};
