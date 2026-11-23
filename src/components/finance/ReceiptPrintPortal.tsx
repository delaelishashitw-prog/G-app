import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Keep the receipt outside the application layout so printing omits the ledger. */
export function ReceiptPrintPortal({ children }: React.PropsWithChildren) {
  useEffect(() => {
    document.body.classList.add('receipt-print-open');
    return () => {
      if (!document.querySelector('[data-receipt-print-root]')) {
        document.body.classList.remove('receipt-print-open');
      }
    };
  }, []);

  return createPortal(
    <div data-receipt-print-root className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      {children}
    </div>,
    document.body,
  );
}
