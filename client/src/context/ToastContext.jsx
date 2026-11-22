import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: '✓', ring: 'ring-income/30', dot: 'bg-income text-bg' },
  error: { icon: '!', ring: 'ring-expense/40', dot: 'bg-expense text-bg' },
  info: { icon: 'i', ring: 'ring-white/10', dot: 'bg-surface-3 text-ink' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  /** toast(message, { tone, action: { label, onClick }, duration }) */
  const toast = useCallback(
    (message, { tone = 'success', action, duration = 3500 } = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const tone = TONES[t.tone] || TONES.info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -24, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-line bg-surface-2/95 px-4 py-3 text-sm shadow-2xl ring-1 backdrop-blur-xl ${tone.ring}`}
              >
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${tone.dot}`}>
                  {tone.icon}
                </span>
                <span className="flex-1 text-ink">{t.message}</span>
                {t.action && (
                  <button
                    onClick={() => {
                      t.action.onClick();
                      dismiss(t.id);
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-bold uppercase tracking-wide text-accent hover:bg-accent-soft"
                  >
                    {t.action.label}
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext).toast;
