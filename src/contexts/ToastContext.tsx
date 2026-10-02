import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (options: { title: string; message?: string; type?: ToastType; duration?: number }) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      message,
      type = 'success',
      duration = 3500,
    }: {
      title: string;
      message?: string;
      type?: ToastType;
      duration?: number;
    }) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, duration };

      setToasts((prev) => [...prev.slice(-3), newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => toast({ title, message, type: 'success' }),
    [toast]
  );

  const error = useCallback(
    (title: string, message?: string) => toast({ title, message, type: 'error' }),
    [toast]
  );

  const info = useCallback(
    (title: string, message?: string) => toast({ title, message, type: 'info' }),
    [toast]
  );

  const warning = useCallback(
    (title: string, message?: string) => toast({ title, message, type: 'warning' }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}

      {/* Floating Animated Toast Container */}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
        role="region"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{
                duration: 0.24,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 text-white shadow-xl border border-slate-800 backdrop-blur-md"
            >
              <div className="shrink-0 mt-0.5">
                {t.type === 'success' && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
                {t.type === 'error' && (
                  <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                )}
                {t.type === 'info' && (
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Info className="w-4 h-4" />
                  </div>
                )}
                {t.type === 'warning' && (
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <p className="text-xs font-bold text-white tracking-tight">{t.title}</p>
                {t.message && (
                  <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
                    {t.message}
                  </p>
                )}
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-slate-400 hover:text-white transition p-1 rounded-md hover:bg-slate-800"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
