import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const NO_PROVIDER = Symbol('NO_PROVIDER_YET');

const ShortRoundContext = createContext(NO_PROVIDER);

export const useShortRoundShadcnSidekick = () => useContext(ShortRoundContext);

const useShortRoundKeyboardShortcuts = (setIsOpen, installKeyboardShortcuts = true) => {
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

export const positionAnchors = ['center', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

function DialogContextProvider({
  children,
  initialIsOpen = false,
  initialAnchor = 'center',
  maxTotalWidth = '90vw',
  commandWidth = '40vw',
  installKeyboardShortcuts = true
}) {
  const [internalSidecarRenderer, setInternalSidecarRenderer] = useState();
  const [isSidecarOpen, setIsSidecarOpen] = useState(false);
  const [size, setSize] = useState('compact');
  const [anchor, setAnchor] = useState(initialAnchor);
  const [totalWidth, setTotalWidth] = useState(commandWidth);
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  useShortRoundKeyboardShortcuts(setIsOpen, installKeyboardShortcuts);

  const sidecarWidth = `calc(${maxTotalWidth} - ${commandWidth})`;

  const cycleAnchor = () => {
    const currentIndex = positionAnchors.indexOf(anchor);
    const nextIndex = (currentIndex + 1) % positionAnchors.length;
    setAnchor(positionAnchors[nextIndex]);
  };

  const setSidecarRenderer = (renderer) => {
    setInternalSidecarRenderer(() => renderer);
    setIsSidecarOpen(true);
    setTotalWidth(maxTotalWidth);
  };

  const renderSidecar = useCallback(() => {
    if (internalSidecarRenderer) return internalSidecarRenderer();
  }, [internalSidecarRenderer]);

  const closeSidecar = () => {
    setIsSidecarOpen(false);
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
    size,
    setSize,
    anchor,
    cycleAnchor,
    isSidecarOpen,
    setSidecarRenderer,
    totalWidth,
    commandWidth,
    sidecarWidth,
    closeSidecar,
    renderSidecar
  };
  return <ShortRoundContext.Provider value={value}>{children}</ShortRoundContext.Provider>;
}

export function ShortRoundProvider(props) {
  const { children, ...rest } = props;
  const existing = useShortRoundShadcnSidekick();
  if (existing !== NO_PROVIDER) {
    return children;
  }
  return <DialogContextProvider {...rest}>{children}</DialogContextProvider>;
}
