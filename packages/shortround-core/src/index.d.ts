import { JSX, ReactNode } from 'react';

export const RevertIntentionIds: {
  readonly BACK: string;
  readonly RESET: string;
};

export const AnchorPositions: {
  readonly CENTER: string;
  readonly TOP_LEFT: string;
  readonly TOP_RIGHT: string;
  readonly BOTTOM_RIGHT: string;
  readonly BOTTOM_LEFT: string;
  readonly TOP: string;
  readonly RIGHT: string;
  readonly BOTTOM: string;
  readonly LEFT: string;
};

export const Sizes: {
  readonly COMPACT: string;
  readonly MEDIUM: string;
  readonly FULL: string;
};

export type RevertIntentionId = (typeof RevertIntentionIds)[keyof typeof RevertIntentionIds];
export type AnchorPosition = (typeof AnchorPositions)[keyof typeof AnchorPositions];
export type Size = (typeof Sizes)[keyof typeof Sizes];

export interface SidekickStoreState {
  internalSidecarRenderer: (() => ReactNode) | null;
  isOpen: boolean;
  isSidecarOpen: boolean;
  anchorOrigin: AnchorPosition;
  anchorPosition: {
    top?: number | string;
    left?: number | string;
    right?: number | string;
    bottom?: number | string;
    transform?: string;
  };
  maxTotalWidth: string;
  commandWidth: string;
  totalWidth: string;
  size: Size;
}

export interface SidekickStore {
  get: () => SidekickStoreState;
  subscribe: (callback: () => void) => () => void;
  set: (
    updater:
      | Partial<SidekickStoreState>
      | ((state: SidekickStoreState) => Partial<SidekickStoreState>)
  ) => void;
}

export interface UseSidekickResult extends SidekickStoreState {
  onOpen: () => void;
  setIsOpen: (val: boolean) => void;
  onClose: () => void;
  height: string;
  setSize: (val: string) => void;
  cycleAnchorOrigin: () => void;
  setSidecarRenderer: (renderer: () => ReactNode) => void;
  commandWidth: string;
  sidecarWidth: string;
  closeSidecar: () => void;
  renderSidecar: () => ReactNode | undefined;
}

// SidekickComponents interface for custom implementations
export interface SidekickComponents {
  IntentionPalette: {
    Frame: React.ComponentType<{ height: string; children: ReactNode }>;
    Input: React.ComponentType<{
      inputValue: string;
      inputMessage?: { type: string; text: string };
      onInputChange: (value: string) => void;
    }>;
    Item: React.ComponentType<{
      intention: Intention;
      onSelect: (id: string) => void;
    }>;
    Group: React.ComponentType<{ name: string }>;
    NoMatches: React.ComponentType<{ inputValue: string }>;
  };
  Sidekick: {
    Frame: React.ComponentType<{ 
      height: string; 
      commandWidth: string; 
      children: ReactNode;
    }>;
    ControlBar: React.ComponentType<{
      title?: string;
      anchorOrigin: string;
      size: string;
      onClose: () => void;
      setSize: (size: string) => void;
      cycleAnchorOrigin: () => void;
    }>;
    Popover: React.ComponentType<{
      anchorPosition: object;
      height: string;
      totalWidth: string;
      anchorOrigin: string;
      children: ReactNode;
    }>;
  };
  SidecarContent: React.ComponentType<{
    isOpen: boolean;
    renderSidecar: () => ReactNode | undefined;
    height: string;
  }>;
  ThemeProvider: React.ComponentType<{ children: ReactNode }>;
}

export type IntentionActionResult = {
  intentions?: Intention[];
  disableInputMatching?: boolean;
  shouldReset?: boolean;
  includeRevertIntentions?: readonly RevertIntentionId[];
  message?: string;
  sideEffects?: { sidecarRenderer?: () => ReactNode };
};

export interface Intention {
  id: string;
  title: string;
  group?: string;
  aliases?: string[];
  icon?: string;
  disabled?: boolean;
  shortcut?: string;
  validate?: (input: string) => { valid: boolean; message?: string } | void;
  action: (input: string) => Promise<IntentionActionResult> | IntentionActionResult;
}

export interface UseShortRoundResult {
  inputValue: string;
  inputMessage?: { type: string; text: string };
  onInputChange: (val: string) => void;
  intentions: Intention[];
  dispatch: (id: string) => Promise<IntentionActionResult>;
  reset: () => Promise<IntentionActionResult>;
  back: () => Promise<IntentionActionResult>;
  dispatchedStack: Intention[];
}

export function useShortRound(opts: { defaultIntentions: Intention[] }): UseShortRoundResult;

export function useSidekick(opts?: {
  store?: SidekickStore;
  initial?: Partial<SidekickStoreState>;
}): UseSidekickResult;

export function createSidekickStore(init?: Partial<SidekickStoreState>): SidekickStore;

export function SidekickStoreProvider(props: {
  store?: SidekickStore;
  initial?: Partial<SidekickStoreState>;
  children: ReactNode;
}): JSX.Element;

export function useSidekickStore(): SidekickStore | null;

export function makeRevertIntentionsFor(ids?: readonly RevertIntentionId[]): Intention[];

export function ShortRoundSidekick(props: {
  title?: string;
  defaultIntentions: Intention[];
  SidekickComponents: SidekickComponents;
  showToast?: (args: { message: string }) => void;
  installKeyboardShortcuts?: boolean;
  sidekickStore?: SidekickStore;
  initialSidekickState?: Partial<SidekickStoreState>;
}): JSX.Element;
