// @shortround/react's types: the UI. The headless types (intentions, results, resolvers, the sidekick store, the
// constants) are @shortround/core's; this file imports them and doesn't re-export them.
import type {
  AnchorPosition,
  CommandLineState,
  ControlLabels,
  Intention,
  IntentionActionResult,
  PaletteSource,
  ResolveFallbackInput,
  ResolveInput,
  SidecarReducer,
  SidekickStore,
  SidekickStoreState
} from '@shortround/core';
import { JSX, ReactNode, RefObject } from 'react';

/** Where the sidekick sits for an anchor origin, as CSS position properties. */
export interface AnchorPositionStyle {
  top?: number | string;
  left?: number | string;
  right?: number | string;
  bottom?: number | string;
  transform?: string;
}

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
 * A theme's slots (`ShortRoundTheme.components`): views only. The palette renders cmdk (the input, each row, keyboard
 * and selection), focus and the dialog; a theme imports no cmdk. Each slot's obligations are checked by
 * `@shortround/conformance` (`describeThemeContract`), which finds a theme's controls by the `data-testid`s named below.
 */
export interface SidekickComponents {
  IntentionPalette: {
    /** Renders its children. Row styling goes here, through cmdk's attributes (`[cmdk-item]`, `[data-selected]`). */
    Frame: React.ComponentType<{ height: string; children: ReactNode }>;
    /** Places `input` (the palette's cmdk input, `data-testid="shortround-input"`) and shows `inputMessage.text`. */
    Input: React.ComponentType<{
      input: ReactNode;
      inputMessage?: { type: string; text: string };
    }>;
    /**
     * Draws one row inside the palette's cmdk item (`data-testid="shortround-item-<id>"`): shows the title and
     * subtitle, and shows `icon` when given (the palette chooses it; see `IconRegistry`). A row without an icon should
     * keep the icon's space, so titles line up. `isSelected` says whether the row is highlighted, for a theme that
     * doesn't style through `[data-selected]`.
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
 * The app's own icons, given once to `ShortRoundProvider`. The palette looks up each row's icon in this order: the
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
 * the Toast view. Each slot group is needed only by what draws it: `ShortRoundSidekick` throws, naming the groups it
 * misses, when it mounts; another package's group (such as `@shortround/chat`'s `Chat`) is checked by its own
 * component. Toast's obligation: while `isOpen`, show `message` (`data-testid="shortround-toast"`); otherwise render
 * nothing.
 */
export interface ShortRoundTheme {
  components: Partial<SidekickComponents> & { [group: string]: any };
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

/**
 * The nearest `ShortRoundProvider`'s theme slots (`theme.components`), or `null` with no provider. For a package that
 * draws through a slot group of its own, such as `@shortround/chat`'s `Chat`, which the provider doesn't require.
 */
export function useShortRoundComponents(): ShortRoundTheme['components'] | null;

export interface UseShortRoundResult {
  inputValue: string;
  inputMessage?: { type: string; text: string };
  onInputChange: (val: string) => void;
  intentions: Intention[];
  /** The Back and Cancel rows the current list asked for (`includeRevertIntentions`); draw them under Navigate. */
  revertIntentions: Intention[];
  /**
   * Chooses a row, as ShortRoundSidekick does: a completion row sets the input; any other runs, and keeps the Back
   * and Cancel its result asks for.
   */
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

export function SidekickStoreProvider(props: {
  store?: SidekickStore;
  initial?: Partial<SidekickStoreState>;
  children: ReactNode;
}): JSX.Element;

export function useSidekickStore(): SidekickStore | null;

export function ShortRoundSidekick(props: {
  title?: string;
  /**
   * A palette that follows the app (`buildPalette`'s result, or any `PaletteSource`): the sidekick opens on its
   * `current()`, with that side panel, and follows its `notify()` while open. Instead of `defaultIntentions` and the
   * two resolvers. Build it once.
   */
  palette?: PaletteSource;
  /** The start list, when there is no `palette`. */
  defaultIntentions?: Intention[];
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
   * Decides every side panel change but a close (see `SidecarReducer`); without one, the palette's proposals apply. A
   * close always clears the panel, whatever closed it.
   */
  sidecarReducer?: SidecarReducer;
  /** The start list's panel: proposed when the palette opens, on Back to the start and on Cancel. */
  defaultSidecarRenderer?: () => ReactNode;
  /**
   * Turns off the input's line hints (default `false`): with a `palette` that has `commandLine()`, the input shows
   * each word coloured by its role (`data-role` on the word, for the theme) and the rest of the next word as ghost
   * text, and Tab completes through the line. Pickers and typed-text steps never show them.
   */
  disableLineHints?: boolean;
}): JSX.Element;

/**
 * An input with its typed line drawn under it, for a host's own input (a chat, an editor's command field): each word
 * with its role (`data-role` on the word's span, for a stylesheet to colour) and the ghost text after the last word
 * (`data-role="ghost"`). The input itself (`children`, an `<input>` or `<textarea>` whose element is `inputRef`) stays
 * on top with its text made transparent, so typing, the caret and selection stay native. Without `lineState` the input
 * shows as it is. The line is drawn on one line: pass no `lineState` while the text has a line break.
 */
export function LineInput(props: {
  children: ReactNode;
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /** A command line's state (`CommandLine.getState()`, or a chat line's `drawnLineState`), or `null`. */
  lineState?: CommandLineState | null;
}): JSX.Element;
