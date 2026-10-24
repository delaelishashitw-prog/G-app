import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useModalFocus } from "../../hooks/useModalFocus";

export function PledgeDialog({
  title,
  onClose,
  busy = false,
  error,
  printable = false,
  children,
}: React.PropsWithChildren<{
  title: string;
  onClose: () => void;
  busy?: boolean;
  error?: string;
  printable?: boolean;
}>) {
  const close = () => {
      if (!busy) onClose();
    },
    panel = useModalFocus(true, close);
  useEffect(() => {
    if (!printable) return;
    document.body.classList.add("pledge-print-open");
    return () => document.body.classList.remove("pledge-print-open");
  }, [printable]);
  const content = (
    <div
      data-pledge-print-root={printable ? "" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3"
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        className="w-full max-w-xl max-h-[94dvh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="no-print flex items-center justify-between gap-4 bg-purple-950 px-5 py-4 text-white">
          <h2 className="font-bold">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <div
          data-pledge-print-content={printable ? "" : undefined}
          className="p-5 text-sm"
        >
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-rose-50 p-3 text-rose-800"
            >
              {error}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
  return printable ? createPortal(content, document.body) : content;
}
export const pledgeFieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
export const pledgeButtonClass =
  "rounded-lg bg-purple-800 px-4 py-2 font-semibold text-white disabled:opacity-50";
