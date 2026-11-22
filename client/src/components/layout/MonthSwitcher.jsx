import { AnimatePresence, motion } from 'framer-motion';
import { useRef } from 'react';
import { useData } from '../../context/DataContext';
import { currentMonth, formatMonth, shiftMonth } from '../../lib/dates';
import Icon from '../ui/Icon';

/** ‹ November 2026 › with swipe-style animation. Arrows instead of a dropdown. */
export default function MonthSwitcher({ className = '' }) {
  const { month, setMonth } = useData();
  const direction = useRef(0);
  const isCurrent = month === currentMonth();

  const go = (delta) => {
    direction.current = delta;
    setMonth(shiftMonth(month, delta));
  };

  return (
    <div className={`flex items-center gap-1 rounded-2xl border border-line bg-surface/70 p-1 backdrop-blur-xl ${className}`}>
      <button onClick={() => go(-1)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-2 hover:bg-white/5 hover:text-ink" aria-label="Previous month">
        <Icon name="chevron-left" size={18} />
      </button>
      <button
        onClick={() => {
          direction.current = month < currentMonth() ? 1 : -1;
          setMonth(currentMonth());
        }}
        className="relative h-9 min-w-[132px] overflow-hidden rounded-xl px-2 text-sm font-bold"
        title="Jump to this month"
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction.current}>
          <motion.span
            key={month}
            custom={direction.current}
            initial={{ x: direction.current * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: direction.current * -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="block"
          >
            {formatMonth(month)}
          </motion.span>
        </AnimatePresence>
      </button>
      <button
        onClick={() => go(1)}
        disabled={isCurrent}
        className="grid h-9 w-9 place-items-center rounded-xl text-ink-2 hover:bg-white/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next month"
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
  );
}
