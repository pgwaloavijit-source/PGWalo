import React, { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessibility plumbing for modal dialogs:
 * - `role="dialog"` + `aria-modal="true"` so screen readers announce them as modal
 * - labelled by the title element via aria-labelledby
 * - Tab / Shift+Tab cycling trapped inside the dialog
 * - Escape closes
 * - focus moves into the dialog on open and returns to the previously focused
 *   element on close, so keyboard users never lose their place
 */
export const ModalFocusScope: React.FC<{
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ labelledBy, onClose, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the setup effect on every
  // parent render (a new closure per render would otherwise steal focus
  // back to the first element while the user is typing inside the dialog).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    restoreRef.current = document.activeElement as HTMLElement | null;

    // Move focus in. Prefer the first focusable element; fall back to the
    // dialog itself so Tab doesn't jump to browser chrome.
    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables[0] ?? dialog).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = dialog.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      restoreRef.current?.focus();
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="outline-none"
      tabIndex={-1}
    >
      {children}
    </div>
  );
};
