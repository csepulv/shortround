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

/** The control bar's accessible names; core passes them to ControlBar as `labels`. */
export const ControlLabels: {
  readonly close: string;
  readonly anchor: string;
  readonly size: string;
  readonly sizes: { readonly compact: string; readonly medium: string; readonly full: string };
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
  setAnchorOrigin: (origin: AnchorPosition) => void;
  cycleAnchorOrigin: () => void;
  setSidecarRenderer: (renderer: () => ReactNode) => void;
  commandWidth: string;
  sidecarWidth: string;
  closeSidecar: () => void;
  renderSidecar: () => ReactNode | undefined;
}

/**
 * A theme's slots (`ShortRoundTheme.components`): views only. Core renders cmdk (the input, each row, keyboard and
 * selection), focus and the dialog; a theme imports no cmdk. Each slot's obligations are checked by
 * `@shortround/conformance` (`describeThemeContract`), which finds a theme's controls by the `data-testid`s named below.
 */
export interface SidekickComponents {
  IntentionPalette: {
    /** Renders its children. Row styling goes here, through cmdk's attributes (`[cmdk-item]`, `[data-selected]`). */
    Frame: React.ComponentType<{ height: string; children: ReactNode }>;
    /** Places `input` (core's cmdk input, `data-testid="shortround-input"`) and shows `inputMessage.text`. */
    Input: React.ComponentType<{
      input: ReactNode;
      inputMessage?: { type: string; text: string };
    }>;
    /**
     * Draws one row inside core's cmdk item (`data-testid="shortround-item-<id>"`): shows the title and subtitle.
     * `isSelected` says whether the row is highlighted, for a theme that doesn't style through `[data-selected]`.
     */
    Item: React.ComponentType<{
      intention: Intention;
      isSelected: boolean;
    }>;
    /** Shows the group's name. */
    Group: React.ComponentType<{ name: string }>;
    /** Says nothing matched, naming `inputValue` (`data-testid="shortround-no-matches"`). */
    NoMatches: React.ComponentType<{ inputValue: string }>;
  };
  Sidekick: {
    /** Renders its children. */
    Frame: React.ComponentType<{
      height: string;
      commandWidth: string;
      children: ReactNode;
    }>;
    /**
     * Shows the title; a close control calls `onClose` (`shortround-close`); size controls call `setSize` with
     * compact, medium or full (`shortround-size-<size>`); a position control calls `cycleAnchorOrigin`
     * (`shortround-anchor`). Each control, and the group of size controls, takes its accessible name from `labels`.
     */
    ControlBar: React.ComponentType<{
      title?: string;
      labels: typeof ControlLabels;
      anchorOrigin: string;
      size: string;
      onClose: () => void;
      setSize: (size: string) => void;
      cycleAnchorOrigin: () => void;
    }>;
    /** Renders its children, in a portal or not. */
    Popover: React.ComponentType<{
      anchorPosition: object;
      height: string;
      totalWidth: string;
      anchorOrigin: string;
      children: ReactNode;
    }>;
  };
  /** Renders `renderSidecar()` when the side panel opens (`isOpen`). */
  SidecarContent: React.ComponentType<{
    isOpen: boolean;
    renderSidecar: () => ReactNode | undefined;
    height: string;
  }>;
}

/** The theme's Toast: a view. `ShortRoundProvider` holds the state; the theme calls `onClose` to dismiss it. */
export interface ToastProps {
  isOpen: boolean;
  message: string | null;
  onClose: () => void;
}

/**
 * What an app hands to `ShortRoundProvider`, once, at its root (defined at module scope, or memoized): the slots and
 * the Toast view. Toast's obligation: while `isOpen`, show `message` (`data-testid="shortround-toast"`); otherwise
 * render nothing.
 */
export interface ShortRoundTheme {
  components: SidekickComponents;
  Toast: React.ComponentType<ToastProps>;
}

/**
 * Chooses the theme for everything below it. `ShortRoundSidekick` takes its slots from the nearest provider
 * (a nested provider wins for its subtree); its own `SidekickComponents` and `showToast` props override it, each
 * for its own part.
 */
export function ShortRoundProvider(props: {
  theme: ShortRoundTheme;
  children: ReactNode;
}): JSX.Element;

/** Shows a toast in the nearest provider's theme. Throws outside a `ShortRoundProvider`. */
export function useShortRoundToast(): { showToast: (args: { message: string }) => void };

export type IntentionActionResult = {
  intentions?: Intention[];
  disableInputMatching?: boolean;
  shouldReset?: boolean;
  includeRevertIntentions?: readonly RevertIntentionId[];
  message?: string;
  /** The sidecar stays as it is unless a result sets a renderer or asks to close it. */
  sideEffects?: { sidecarRenderer?: () => ReactNode; closeSidecar?: boolean };
  /** Set by dispatch when the intention is disabled or invalid for the current input; nothing ran. */
  isRejected?: boolean;
  /** Turns typed text into extra rows for this result's list (shown above the fuzzy matches). */
  resolveInput?: ResolveInput;
};

/**
 * Returns rows for the typed text, or none. Called on every render while text is typed (except during typed-text
 * steps), so keep it quick and synchronous; an error is logged and shows no rows.
 */
export type ResolveInput = (text: string) => Intention[];

export interface Intention {
  id: string;
  title: string;
  /** A second line under the title; themes show it. */
  subtitle?: string;
  group?: string;
  aliases?: string[];
  icon?: string;
  disabled?: boolean;
  shortcut?: string;
  /**
   * Extra words core hands to cmdk's item. No effect today: core filters rows itself (by title and `aliases`), with
   * cmdk's filtering off. Use `aliases` for words that should match.
   */
  keywords?: string[];
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
  dispatchedStack: { intention: Intention; result: IntentionActionResult }[];
}

export function useShortRound(opts: {
  defaultIntentions: Intention[];
  /** Resolver for the default list. Memoize it, like `defaultIntentions`: a new one resets the list. */
  resolveDefaultInput?: ResolveInput;
}): UseShortRoundResult;

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
  /** Resolver for the default list. Memoize it, like `defaultIntentions`: a new one resets the list. */
  resolveDefaultInput?: ResolveInput;
  /** Overrides the nearest `ShortRoundProvider`'s slots; required without a provider. */
  SidekickComponents?: SidekickComponents;
  /** Overrides the nearest `ShortRoundProvider`'s toast. */
  showToast?: (args: { message: string }) => void;
  /**
   * The global Cmd/Ctrl+K shortcut (default `true`). Escape inside the sidekick closes it either way; content inside
   * can keep Escape with `event.preventDefault()`.
   */
  installKeyboardShortcuts?: boolean;
  sidekickStore?: SidekickStore;
  initialSidekickState?: Partial<SidekickStoreState>;
  /** Called after the sidekick closes, whatever closed it. */
  onClose?: () => void;
}): JSX.Element;
