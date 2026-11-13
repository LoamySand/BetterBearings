import { useEffect, useId, useRef } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const FIELDS =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])';

// Modal keyboard behaviour: focus moves in on open (first form field, else first control),
// Tab and Shift+Tab stay inside, Escape closes, and focus returns to the opener on close.
// Spread `dialogProps` on the modal box and put `id={titleId}` on its heading.
export default function useDialog(onClose, { closeOnEscape = true } = {}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const opener = document.activeElement;
    const focusables = () =>
      [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

    (dialog.querySelector(FIELDS) || focusables()[0] || dialog).focus();

    const onKeyDown = (e) => {
      // A component can swap its dialog for another one (Create hands off to Save);
      // the detached box must stop handling keys.
      if (!dialog.isConnected) return;
      if (e.key === 'Escape' && closeOnEscape && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const outside = !dialog.contains(document.activeElement);
      if (e.shiftKey && (outside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // The opener may be gone (Sign In is replaced by the profile menu after login).
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, [closeOnEscape]);

  return {
    titleId,
    dialogProps: {
      ref: dialogRef,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      tabIndex: -1,
    },
  };
}
