import { useCallback, useRef } from 'react';

// Moves focus into the dialog: its cmdk input, else the dialog itself (compact size has no input).
function focusInto(dialog) {
  (dialog.querySelector('[cmdk-input]') ?? dialog).focus();
}

// Focus for a non-modal dialog. When the dialog attaches, focus moves into it; when it detaches, focus
// returns to where it was, unless the user has since moved it elsewhere in the page. A callback ref, not an
// effect: a theme's Popover may portal its children a render later, and the ref runs whenever the dialog
// actually attaches. `focusInside` brings focus back while the dialog is open.
export function useDialogFocus() {
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  const attachDialog = useCallback((node) => {
    if (node) {
      previousFocus.current = document.activeElement;
      dialogRef.current = node;
      focusInto(node);
      return;
    }
    const dialog = dialogRef.current;
    const previous = previousFocus.current;
    dialogRef.current = null;
    previousFocus.current = null;
    const current = document.activeElement;
    const isFocusInDialog = !current || current === document.body || dialog?.contains(current);
    if (isFocusInDialog && previous && previous !== document.body && previous.isConnected) {
      previous.focus();
    }
  }, []);

  const focusInside = useCallback(() => {
    if (dialogRef.current) {
      focusInto(dialogRef.current);
    }
  }, []);

  return { attachDialog, focusInside };
}
