import { Alert, Snackbar } from '@mui/material';

const AUTO_HIDE_MS = 4000;

// `autoHideDuration` is for MuiToast only; MuiToastProvider's toast waits for a click, as in 0.2.x.
export function Toast({ toastData, closeToast, autoHideDuration }) {
  const { isOpen, message, anchorOrigin, severity } = toastData;

  return (
    <Snackbar
      anchorOrigin={anchorOrigin}
      autoHideDuration={autoHideDuration}
      onClose={closeToast}
      open={isOpen}
    >
      <Alert data-testid="shortround-toast" severity={severity}>
        {message}
      </Alert>
    </Snackbar>
  );
}

// The theme's Toast slot: ShortRoundProvider owns the state; this only draws it, placed and styled as
// MuiToastProvider's toast is. It hides itself (through onClose), because it lives at the app's root and
// would otherwise follow the user from page to page.
export function MuiToast({ isOpen, message, onClose }) {
  return (
    <Toast
      autoHideDuration={AUTO_HIDE_MS}
      closeToast={onClose}
      toastData={{
        isOpen,
        message,
        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
        severity: 'info'
      }}
    />
  );
}
