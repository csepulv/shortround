import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const NO_PROVIDER = Symbol('NO_PROVIDER_YET');

const IntentionalContext = createContext(NO_PROVIDER);

export const useIntentionalDialogController = () => useContext(IntentionalContext);

const useIntentionalKeyboardShortcuts = (setIsOpen, installKeyboardShortcuts = true) => {
  return useEffect(() => {
    if (installKeyboardShortcuts) {
      const handleKeyDown = (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          setIsOpen(true);
        }

        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown, { capture: true });
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [installKeyboardShortcuts, setIsOpen]);
};

function DialogContextProvider({
  children,
  initialIsOpen = false,
  maxTotalWidth = '90vw',
  commandWidth = '40vw',
  installKeyboardShortcuts = true
}) {
  const [internalSidecarRenderer, setInternalSidecarRenderer] = useState();
  const [showSidecar, setShowSidecar] = useState(false);
  const [totalWidth, setTotalWidth] = useState(commandWidth);
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  useIntentionalKeyboardShortcuts(setIsOpen, installKeyboardShortcuts);

  const sidecarWidth = `calc(${maxTotalWidth} - ${commandWidth})`;

  const setSidecarRenderer = (renderer) => {
    setInternalSidecarRenderer(() => renderer);
    setShowSidecar(true);
    setTotalWidth(maxTotalWidth);
  };

  const renderSidecar = useCallback(() => {
    if (internalSidecarRenderer) return internalSidecarRenderer();
  }, [internalSidecarRenderer]);

  const closeSidecar = () => {
    setShowSidecar(false);
    setInternalSidecarRenderer(null);
    setTotalWidth(commandWidth);
  };

  const onClose = () => {
    closeSidecar();
    setIsOpen(false);
  };

  const value = {
    isOpen,
    setIsOpen,
    onClose,
    showSidecar,
    setSidecarRenderer,
    totalWidth,
    commandWidth,
    sidecarWidth,
    closeSidecar,
    renderSidecar,
  };
  return (
    <IntentionalContext.Provider value={value}>
      {children}
    </IntentionalContext.Provider>
  );
}

export function IntentionalProvider(props) {
  const { children, ...rest } = props;
  const existing = useIntentionalDialogController();
  if (existing !== NO_PROVIDER) {
    return children;
  }
  return <DialogContextProvider {...rest}>{children}</DialogContextProvider>;
} 