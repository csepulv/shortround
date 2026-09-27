import { createContext, useContext, useState } from 'react';
import { Toast } from './components/Toast.jsx';

const NO_PROVIDER = Symbol('NO_PROVIDER_YET');

const ShortRoundContext = createContext(NO_PROVIDER);

export const useMuiToast = () => useContext(ShortRoundContext);

function DialogContextProvider({ children }) {
  const [toastData, setToastData] = useState({
    isOpen: false,
    message: null,
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
    severity: 'info',
    autoHideDuration: 4000
  });

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
    closeToast,
    showToast
  };
  return (
    <ShortRoundContext.Provider value={value}>
      {children}
      <Toast toastData={toastData} closeToast={closeToast} />
    </ShortRoundContext.Provider>
  );
}

export function MuiToastProvider(props) {
  const { children, ...rest } = props;
  const existing = useMuiToast();
  if (existing !== NO_PROVIDER) {
    return children;
  }
  return <DialogContextProvider value={rest}>{children}</DialogContextProvider>;
}
