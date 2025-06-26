import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const FULL_HEIGHT_POPOVER = '100vh';

export const positionAnchors = {
  center: { top: window.innerHeight / 2, left: window.innerWidth / 2 },
  'top-left': { top: 0, left: 0 },
  'top-right': { top: 0, left: window.innerWidth },
  'bottom-right': { top: window.innerHeight, left: window.innerWidth },
  'bottom-left': { top: window.innerHeight, left: 0 }
};

export const originTransforms = {
  center: { vertical: 'center', horizontal: 'center' }
};

export const cycleOrigin = (current) => {
  const items = Object.keys(positionAnchors);
  const idx = items.indexOf(current);
  return items[(idx + 1) % items.length || 0];
};

export const heightMap = {
  minimized: 'auto',
  compact: '50vh',
  full: FULL_HEIGHT_POPOVER
};

const IntentionalDialogContext = createContext(null);

export function IntentionalDialogProvider({
  children,
  initialIsOpen = false,
  initialAnchorOrigin = 'center',
  maxTotalWidth = '90vw',
  commandWidth = '40vw'
}) {
  const [internalSidecarRenderer, setInternalSidecarRenderer] = useState();
  const [showSidecar, setShowSidecar] = useState(false);
  const [size, setSize] = useState('compact');
  const [anchorOrigin, setAnchorOrigin] = useState(initialAnchorOrigin);
  const [anchorPosition, setAnchorPosition] = useState(positionAnchors[initialAnchorOrigin]);
  const [transformOrigin, setTransformOrigin] = useState(originTransforms[initialAnchorOrigin]);
  const [totalWidth, setTotalWidth] = useState(commandWidth);
  const [isOpen, setIsOpen] = useState(initialIsOpen);

  const height = size === 'minimized' ? 'auto' : heightMap[size];
  const sidecarWidth = `calc(${maxTotalWidth} - ${commandWidth})`;

  const cycleAnchorOrigin = () => {
    const newOrigin = cycleOrigin(anchorOrigin);
    setAnchorOrigin(newOrigin);
    setAnchorPosition(positionAnchors[newOrigin]);
    setTransformOrigin(originTransforms[newOrigin]);
  };

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
  };

  const value = {
    isOpen,
    setIsOpen,
    onClose,
    height,
    size,
    setSize,
    anchorPosition,
    cycleAnchorOrigin,
    transformOrigin,
    anchorOrigin,
    setAnchorOrigin,
    showSidecar,
    setSidecarRenderer,
    totalWidth,
    commandWidth,
    sidecarWidth,
    closeSidecar,
    renderSidecar
  };
  return (
    <IntentionalDialogContext.Provider value={value}>{children}</IntentionalDialogContext.Provider>
  );
}

export const useIntentionalDialogController = () => useContext(IntentionalDialogContext);

export const useIntentionalKeyboardShortcuts = (installKeyboardShortcuts = true) => {
  const { setIsOpen } = useIntentionalDialogController();
  console.log('USE CONTROLLER', useIntentionalDialogController());
  return useEffect(() => {
    if (installKeyboardShortcuts) {
      console.log('REGISTERING');
      const handleKeyDown = (event) => {
        console.log('handleKeyDown', event);
        if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
          // event.preventDefault();
          setIsOpen(true);
        }

        if (event.key === 'Escape') {
          console.log('ESCAPING');
          setIsOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown, { capture: true });
      document.addEventListener('keypress', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keypress', handleKeyDown);
      };
    }
  }, []);
};
