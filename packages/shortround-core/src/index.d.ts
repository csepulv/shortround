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

/** Where the sidekick sits for an anchor origin, as CSS position properties. */
export interface AnchorPositionStyle {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  transform?: string;
}

export interface SidekickStoreState {
  internalSidecarRenderer: (() => ReactNode) | null;
  isOpen: boolean;
  isSidecarOpen: boolean;
  /** Where the sidekick opens; its position follows from it. */
  anchorOrigin: AnchorPosition;
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
  /**
   * Shows `renderer` in the side panel, through the sidekick's `sidecarReducer` (reason `app`). Works outside React.
   * Call it while the palette is open: opening replaces a panel set while closed, unless the reducer keeps it for `open`.
   */
  openSidecar: (renderer: () => ReactNode) => void;
  /** Closes the side panel, through the sidekick's `sidecarReducer` (reason `app`). Works outside React. */
  closeSidecar: () => void;
}

/** The side panel's state as the reducer sees it, and the change it returns: a renderer, or none. */
export type SidecarChange = { renderer: (() => ReactNode) | null };

/**
 * Why core proposes a side panel change: an action's result asks for one (`result`); Back to an earlier step replays
 * its result (`back`); Back to the start list (`start`); Cancel (`reset`); the palette opens (`open`); the app called
 * `openSidecar` or `closeSidecar` (`app`). A close has no reason: it always clears the panel.
 */
export type SidecarReason = 'result' | 'back' | 'start' | 'reset' | 'open' | 'app';

/** Decides each side panel change but a close. Return `proposed` for the default, or `current` to keep the panel. */
export type SidecarReducer = (
  current: SidecarChange,
  proposed: SidecarChange,
  context: { reason: SidecarReason }
) => SidecarChange;

export interface UseSidekickResult extends SidekickStoreState {
  /** The position for the current `anchorOrigin`. */
  anchorPosition: AnchorPositionStyle;
  onOpen: () => void;
  setIsOpen: (val: boolean) => void;
  onClose: () => void;
  height: string;
  setSize: (val: string) => void;
  setAnchorOrigin: (origin: AnchorPosition) => void;
  cycleAnchorOrigin: () => void;
  /** The store's `openSidecar`: through the sidekick's `sidecarReducer` (reason `app`). */
  setSidecarRenderer: (renderer: () => ReactNode) => void;
  commandWidth: string;
  sidecarWidth: string;
  /** The store's `closeSidecar`: through the sidekick's `sidecarReducer` (reason `app`). */
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
     * Draws one row inside core's cmdk item (`data-testid="shortround-item-<id>"`): shows the title and subtitle,
     * and shows `icon` when given (core chooses it; see `IconRegistry`). A row without an icon should keep the icon's
     * space, so titles line up. `isSelected` says whether the row is highlighted, for a theme that doesn't style
     * through `[data-selected]`.
     */
    Item: React.ComponentType<{
      intention: Intention;
      icon?: ReactNode;
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
  /**
   * The theme's icons by name; `unknown` is the placeholder for a name the theme doesn't know. They travel with the
   * slots, so an app passing `SidekickComponents` without a provider keeps them. Back and Cancel use `back` and
   * `cancel` from here unless the app overrides them by id.
   */
  icons?: Record<string, React.ComponentType>;
}

/**
 * The app's own icons, given once to `ShortRoundProvider`. Core looks up each row's icon in this order: the
 * intention's override in `intentions`; none when the intention has no `icon`; for Back and Cancel, the theme's; the
 * name mapped by `names`, drawn by `Icon`; the theme's icon for the name; the theme's placeholder.
 */
export interface IconRegistry {
  /** Draws any name, as an icon font or a by-name icon component does. When given, it draws every named row. */
  Icon?: React.ComponentType<{ name: string }>;
  /** An intention's icon name → the name `Icon` (or the theme) knows: `{ chat: 'forum' }`. */
  names?: Record<string, string>;
  /** An icon for one intention, by its id, whatever its name. */
  intentions?: Record<string, React.ComponentType>;
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
  /** The app's own icons. Define it at module scope (or memoize it), like the theme. */
  icons?: IconRegistry;
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
  /**
   * The sidecar stays as it is unless a result sets a renderer or asks to close it; either is proposed to the
   * sidekick's `sidecarReducer` (reason `result`, or `back` when Back replays this result).
   */
  sideEffects?: { sidecarRenderer?: () => ReactNode; closeSidecar?: boolean };
  /** Set by dispatch when the intention is disabled or invalid for the current input; nothing ran. */
  isRejected?: boolean;
  /** Turns typed text into extra rows for this result's list (shown above the fuzzy matches). */
  resolveInput?: ResolveInput;
  /** Adds rows after this result's list's matches (see `ResolveFallbackInput`); a list without one has none. */
  resolveFallbackInput?: ResolveFallbackInput;
};

/**
 * Returns rows for the typed text, or none. Called on every render while text is typed (except during typed-text
 * steps), so keep it quick and synchronous; an error is logged and shows no rows.
 */
export type ResolveInput = (text: string) => Intention[];

/**
 * Returns rows to add after the list's matches, such as "Send as chat: <text>". Called on every render while text is
 * typed (not on a blank input, not during typed-text steps) with `matches`, what the list shows before it (typed-line
 * rows, then fuzzy matches); return rows only when `matches` is empty for an "unmatched" row. Its rows come last when
 * their `group` is one no match uses; a row in a match's group (or with none, beside ungrouped matches) is drawn at
 * the end of that group. Keep it quick and synchronous; an error is logged and adds no rows; a row whose id is
 * already listed is left out. A new function resets the list, so read changing app state when it runs rather than
 * closing over it.
 */
export type ResolveFallbackInput = (text: string, context: { matches: Intention[] }) => Intention[];

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
  /** Fallback for the default list; start and Cancel restore it. Memoize it too. */
  resolveDefaultFallbackInput?: ResolveFallbackInput;
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
  /** Fallback for the default list (see `ResolveFallbackInput`); start and Cancel restore it. Memoize it too. */
  resolveDefaultFallbackInput?: ResolveFallbackInput;
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
  /**
   * Decides every side panel change but a close (see `SidecarReducer`); without one, core's proposals apply. A close
   * always clears the panel, whatever closed it.
   */
  sidecarReducer?: SidecarReducer;
  /** The start list's panel: proposed when the palette opens, on Back to the start and on Cancel. */
  defaultSidecarRenderer?: () => ReactNode;
}): JSX.Element;
