import { motion } from 'framer-motion';
import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';

import { useDialogFocus } from '../hooks/useDialogFocus.js';
import { useShortRoundTheme } from '../hooks/useShortRoundTheme.js';
import {
  SidekickStoreProvider,
  useShortRoundKeyboardShortcuts,
  useSidekick,
  useSidekickStore
} from '../hooks/useSidekick.js';
import { ANIMATION_DURATION, DEFAULT_SIDEKICK_NAME } from '../utils.js';
import { ShortRoundPaletteFrame } from './ShortRoundPaletteFrame.jsx';
import { SidecarDrawer } from './SidecarDrawer.jsx';

// Fires on every close, however it happened: control bar, Escape, shouldReset or the app's own store call.
function useCloseNotification(isOpen, notifyClose) {
  const wasOpen = useRef(isOpen);
  const latestNotifyClose = useRef(notifyClose);
  latestNotifyClose.current = notifyClose;

  useEffect(() => {
    if (wasOpen.current && !isOpen) {
      latestNotifyClose.current?.();
    }
    wasOpen.current = isOpen;
  }, [isOpen]);
}

// The side panel's lifetime: the app's reducer decides every change but a close. A close, however it happened,
// clears it (the panel never outlives the palette); an open proposes the start list's panel, or none. With a
// palette, that is the panel of the states that hold when it opens.
function useSidecarLifecycle(store, isOpen, { sidecarReducer, defaultSidecarRenderer, palette }) {
  const latestReducer = useRef(sidecarReducer);
  latestReducer.current = sidecarReducer;
  const wasOpen = useRef(false);
  const startRenderer = () =>
    palette ? palette.current().sidecarRenderer : defaultSidecarRenderer;
  const latestStartRenderer = useRef(startRenderer);
  latestStartRenderer.current = startRenderer;

  useLayoutEffect(() => {
    store.setSidecarReducer((...args) =>
      (latestReducer.current ?? ((_, proposed) => proposed))(...args)
    );
    return () => store.setSidecarReducer(undefined);
  }, [store]);

  useLayoutEffect(() => {
    if (isOpen && !wasOpen.current) {
      store.changeSidecar({ renderer: latestStartRenderer.current() ?? null }, 'open');
    } else if (!isOpen && wasOpen.current) {
      store.clearSidecar();
    }
    wasOpen.current = isOpen;
  }, [store, isOpen]);
}

// A size change can unmount what had focus (compact size removes the input), dropping focus to the page's
// body, where Escape no longer reaches the dialog; bring it back inside.
function useFocusKeptOnResize(size, focusInside) {
  useLayoutEffect(() => {
    if (document.activeElement === document.body) {
      focusInside();
    }
  }, [size, focusInside]);
}

// The non-modal dialog around the palette and side panel. It sits between the theme's Popover and their two
// boxes, so it takes on the Popover's flex layout (`inherit`) rather than imposing its own. tabIndex -1:
// clicking a blank part of the sidekick keeps focus inside, so Escape still closes it. Escape is handled
// here, as it bubbles: content inside (a widget in the side panel) sees it first and can keep it by calling
// preventDefault, and Escape in the page never reaches it.
const DIALOG_STYLE = {
  display: 'flex',
  flexDirection: 'inherit',
  alignItems: 'inherit',
  width: '100%',
  height: '100%'
};

const SidekickDialog = forwardRef(function SidekickDialog({ name, onClose, children }, ref) {
  const closeOnEscape = (event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      onClose();
    }
  };
  return (
    <div
      aria-label={name}
      aria-modal="false"
      onKeyDown={closeOnEscape}
      ref={ref}
      role="dialog"
      style={DIALOG_STYLE}
      tabIndex={-1}
    >
      {children}
    </div>
  );
});

function SidekickContent({
  title,
  palette,
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput,
  SidekickComponents,
  showToast,
  installKeyboardShortcuts,
  notifyClose,
  sidecarReducer,
  defaultSidecarRenderer,
  disableLineHints
}) {
  const {
    isSidecarOpen,
    anchorOrigin,
    renderSidecar,
    height,
    sidecarWidth,
    isOpen,
    anchorPosition,
    totalWidth,
    size,
    onOpen,
    onClose
  } = useSidekick();

  const { Sidekick, SidecarContent } = SidekickComponents;

  const { attachDialog, focusInside } = useDialogFocus();

  // TODO: might allow for custom shortcuts

  // Cmd/Ctrl+K opens the sidekick, or brings focus back to it when it is already open.
  useShortRoundKeyboardShortcuts({
    onOpen: isOpen ? focusInside : onOpen,
    installKeyboardShortcuts
  });
  useFocusKeptOnResize(size, focusInside);
  useCloseNotification(isOpen, notifyClose);
  useSidecarLifecycle(useSidekickStore(), isOpen, {
    sidecarReducer,
    defaultSidecarRenderer,
    palette
  });

  if (!isOpen) {
    return null;
  }

  return (
    <motion.div
      animate={{
        width: totalWidth
      }}
      layout
      transition={{ duration: ANIMATION_DURATION, ease: 'easeInOut' }}
    >
      <Sidekick.Popover
        anchorOrigin={anchorOrigin}
        anchorPosition={anchorPosition}
        height={height}
        totalWidth={totalWidth}
      >
        <SidekickDialog name={title ?? DEFAULT_SIDEKICK_NAME} onClose={onClose} ref={attachDialog}>
          <ShortRoundPaletteFrame
            SidekickComponents={SidekickComponents}
            defaultIntentions={defaultIntentions}
            defaultSidecarRenderer={defaultSidecarRenderer}
            disableLineHints={disableLineHints}
            palette={palette}
            resolveDefaultFallbackInput={resolveDefaultFallbackInput}
            resolveDefaultInput={resolveDefaultInput}
            showToast={showToast}
            title={title}
          />
          <SidecarDrawer
            Content={SidecarContent}
            height={height}
            isOpen={isSidecarOpen}
            renderSidecar={renderSidecar}
            width={sidecarWidth}
          />
        </SidekickDialog>
      </Sidekick.Popover>
    </motion.div>
  );
}

// Props, as in 0.2.x, override the nearest ShortRoundProvider.
function useResolvedTheme(SidekickComponents, showToast) {
  const provided = useShortRoundTheme();
  const components = SidekickComponents ?? provided?.components;
  if (!components) {
    throw new Error(
      'ShortRoundSidekick has no theme: wrap the app in <ShortRoundProvider theme={…}>, or pass SidekickComponents'
    );
  }
  requireSidekickGroups(components);
  return { components, showToast: showToast ?? provided?.showToast };
}

const SIDEKICK_GROUPS = ['IntentionPalette', 'Sidekick', 'SidecarContent'];

function requireSidekickGroups(components) {
  const missing = SIDEKICK_GROUPS.filter((group) => !components[group]);
  if (missing.length > 0) {
    throw new Error(
      `ShortRoundSidekick: the theme has no ${missing.map((group) => `components.${group}`).join(' or ')}`
    );
  }
}

export function ShortRoundSidekick({
  title,
  palette,
  defaultIntentions,
  resolveDefaultInput,
  resolveDefaultFallbackInput,
  SidekickComponents,
  showToast,
  installKeyboardShortcuts,
  sidekickStore,
  initialSidekickState,
  onClose,
  sidecarReducer,
  defaultSidecarRenderer,
  disableLineHints
}) {
  const theme = useResolvedTheme(SidekickComponents, showToast);

  return (
    <SidekickStoreProvider initial={initialSidekickState} store={sidekickStore}>
      <SidekickContent
        SidekickComponents={theme.components}
        defaultIntentions={defaultIntentions}
        defaultSidecarRenderer={defaultSidecarRenderer}
        disableLineHints={disableLineHints}
        installKeyboardShortcuts={installKeyboardShortcuts}
        notifyClose={onClose}
        palette={palette}
        resolveDefaultFallbackInput={resolveDefaultFallbackInput}
        resolveDefaultInput={resolveDefaultInput}
        showToast={theme.showToast}
        sidecarReducer={sidecarReducer}
        title={title}
      />
    </SidekickStoreProvider>
  );
}
