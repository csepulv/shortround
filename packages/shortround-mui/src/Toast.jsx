import { Alert, Snackbar } from '@mui/material';

export function Toast({ toastData, closeToast }) {
  const { isOpen, message, anchorOrigin, severity } = toastData;

  return (
    <Snackbar anchorOrigin={anchorOrigin} onClose={closeToast} open={isOpen}>
      <Alert severity={severity}>{message}</Alert>
    </Snackbar>
  );
}
