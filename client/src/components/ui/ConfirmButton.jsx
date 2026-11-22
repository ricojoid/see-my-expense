import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Icon from './Icon';

const SIZES = {
  md: { base: 'h-9 rounded-xl', idle: 'w-9', armed: 'px-3' },
  lg: { base: 'h-14 rounded-2xl', idle: 'w-14 bg-surface-2', armed: 'px-4' },
};

/** First tap arms it ("Sure?"), second tap confirms. Disarms itself after 4s. */
export default function ConfirmButton({ onConfirm, label = 'Delete', icon = 'trash', size = 'md', className = '' }) {
  const s = SIZES[size];
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  const handleClick = async (e) => {
    e.stopPropagation();
    if (!armed) return setArmed(true);
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  };

  return (
    <motion.button
      type="button"
      layout
      whileTap={{ scale: 0.92 }}
      onClick={handleClick}
      disabled={busy}
      aria-label={armed ? `Confirm ${label.toLowerCase()}` : label}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden text-sm font-semibold transition-colors ${s.base} ${
        armed ? `bg-expense text-bg ${s.armed}` : `text-ink-3 hover:bg-expense-soft hover:text-expense ${s.idle}`
      } ${className}`}
    >
      <Icon name={icon} size={16} />
      <AnimatePresence>
        {armed && (
          <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: 'auto' }} exit={{ opacity: 0, width: 0 }}>
            Sure?
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
