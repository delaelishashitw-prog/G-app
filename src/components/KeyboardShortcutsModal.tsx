import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Keyboard,
  X,
  Search,
  Compass,
  Zap,
  Sparkles,
  Command,
  ArrowRight,
} from 'lucide-react';
import { ShortcutDefinition } from '../hooks/useKeyboardShortcuts';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutDefinition[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  shortcuts,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

  const formatKeyName = (key: string): string => {
    if (key === 'Ctrl') return isMac ? '⌘' : 'Ctrl';
    if (key === 'Shift') return isMac ? '⇧' : 'Shift';
    if (key === 'Alt') return isMac ? '⌥' : 'Alt';
    return key;
  };

  const filteredShortcuts = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return shortcuts;
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.keys.some((k) => k.toLowerCase().includes(q)) ||
        s.category.toLowerCase().includes(q)
    );
  }, [shortcuts, filterQuery]);

  const categories = useMemo(() => {
    const cats: Record<string, ShortcutDefinition[]> = {
      Navigation: [],
      'Quick Actions': [],
      'Search & Tools': [],
      General: [],
    };

    filteredShortcuts.forEach((s) => {
      if (!cats[s.category]) {
        cats[s.category] = [];
      }
      cats[s.category].push(s);
    });

    return cats;
  }, [filteredShortcuts]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <h3 id="shortcuts-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Keyboard Shortcuts</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
                    Press ? anytime
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Quick navigation & productivity hotkeys for church staff
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Close modal (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search bar inside cheatsheet */}
          <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter shortcuts (e.g., members, finance, attendance)..."
                autoFocus
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {filterQuery && (
                <button
                  onClick={() => setFilterQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Shortcut categories scroll list */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
            {Object.entries(categories).map(([catName, list], idx) => {
              if (list.length === 0) return null;

              const getCategoryIcon = () => {
                switch (catName) {
                  case 'Navigation':
                    return <Compass className="w-3.5 h-3.5 text-blue-500" />;
                  case 'Quick Actions':
                    return <Zap className="w-3.5 h-3.5 text-amber-500" />;
                  case 'Search & Tools':
                    return <Sparkles className="w-3.5 h-3.5 text-emerald-500" />;
                  default:
                    return <Command className="w-3.5 h-3.5 text-slate-400" />;
                }
              };

              return (
                <div key={catName} className={idx > 0 ? 'pt-5' : ''}>
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                    {getCategoryIcon()}
                    <span>{catName}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {list.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          onClose();
                          item.action();
                        }}
                        className="p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30 hover:border-emerald-300 dark:hover:border-emerald-800/60 flex items-center justify-between gap-3 group transition cursor-pointer"
                        title="Click to run action"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 flex items-center gap-1.5">
                            <span>{item.label}</span>
                            <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-600" />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.description}
                          </div>
                        </div>

                        {/* Keys Badge */}
                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, i) => (
                            <React.Fragment key={i}>
                              <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 shadow-2xs group-hover:border-emerald-400 dark:group-hover:border-emerald-600 transition">
                                {formatKeyName(k)}
                              </kbd>
                              {i < item.keys.length - 1 && (
                                <span className="text-[10px] text-slate-400 font-mono">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredShortcuts.length === 0 && (
              <div className="py-8 text-center text-slate-500 text-xs">
                No shortcuts matching "{filterQuery}" found.
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-3 sm:px-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>
              Tip: Press <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px]">Ctrl+M</kbd> for Members, <kbd className="font-mono bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-[10px]">Ctrl+F</kbd> for Finance
            </span>
            <span className="font-medium text-slate-600 dark:text-slate-300">
              Esc to dismiss
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
