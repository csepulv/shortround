import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Toast } from './Toast.jsx';

export const FULL_HEIGHT_POPOVER = '100vh';

export const positionAnchors = {
  center: {
    top: window.innerHeight / 2,
    left: window.innerWidth / 2,
    transform: 'translate(-50%, -50%)'
  },
  'top-left': { top: 0, left: 0 },
  'top-right': { top: 0, right: 0 },
  'bottom-right': { bottom: 0, right: 0 },
  'bottom-left': { bottom: 0, left: 0 }
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

const NO_PROVIDER = Symbol('NO_PROVIDER_YET');

const IntentionalContext = createContext(NO_PROVIDER);

export const useIntentionalDialogController = () => useContext(IntentionalContext);

const useIntentionalKeyboardShortcuts = (setIsOpen, installKeyboardShortcuts = true) => {
  return useEffect(() => {
    if (installKeyboardShortcuts) {
      const handleKeyDown = (event) => {
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

function DialogContextProvider({
  children,
  initialIsOpen = false,
  initialAnchorOrigin = 'center',
  maxTotalWidth = '90vw',
  commandWidth = '40vw',
  installKeyboardShortcuts = true
}) {
  const [toastData, setToastData] = useState({
    isOpen: false,
    message: null,
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    severity: 'info',
    autoHideDuration: 4000
  });
  const [internalSidecarRenderer, setInternalSidecarRenderer] = useState();
  const [showSidecar, setShowSidecar] = useState(false);
  const [size, setSize] = useState('compact');
  const [anchorOrigin, setAnchorOrigin] = useState(initialAnchorOrigin);
  const [anchorPosition, setAnchorPosition] = useState(positionAnchors[initialAnchorOrigin]);
  const [transformOrigin, setTransformOrigin] = useState(originTransforms[initialAnchorOrigin]);
  const [totalWidth, setTotalWidth] = useState(commandWidth);
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  useIntentionalKeyboardShortcuts(setIsOpen, installKeyboardShortcuts);

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
    setIsOpen(false);
  };

  const showToast = ({ message }) => setToastData({ ...toastData, isOpen: true, message });

  const closeToast = () =>
    setToastData({
      isOpen: false,
      message: null,
      anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
      severity: 'info',
      autoHideDuration: 4000
    });

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
    renderSidecar,
    showToast
  };
  return (
    <IntentionalContext.Provider value={value}>
      {children}
      <Toast toastData={toastData} closeToast={closeToast} />
    </IntentionalContext.Provider>
  );
}

export function IntentionalProvider(props) {
  const { children, ...rest } = props;
  const existing = useIntentionalDialogController();
  if (existing !== NO_PROVIDER) {
    return children;
  }
  return <DialogContextProvider value={rest}>{children}</DialogContextProvider>;
}
