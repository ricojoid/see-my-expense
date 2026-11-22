import { AnimatePresence, motion } from 'framer-motion';
import { useRef } from 'react';
import { useData } from '../../context/DataContext';
import { formatMonth, formatPeriodRange, shiftMonth } from '../../lib/dates';
import Icon from '../ui/Icon';

/**
 * ‹ November 2026 › with swipe-style animation. Moves between book periods
 * (payday to payday once the books have been closed), never into the future.
 */
export default function MonthSwitcher({ className = '' }) {
  const { month, setMonth, period, currentKey } = useData();
  const direction = useRef(0);
  const isCurrent = month === currentKey;
  const prevKey = period?.prevKey ?? shiftMonth(month, -1);
  const nextKey = period ? period.nextKey : null;

  const go = (delta) => {
    direction.current = delta;
    setMonth(delta < 0 ? prevKey : nextKey);
  };

  return (
    <div className={`flex items-center gap-1 rounded-2xl border border-line bg-surface/70 p-1 backdrop-blur-xl ${className}`}>
      <button onClick={() => go(-1)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-2 hover:bg-white/5 hover:text-ink" aria-label="Previous month">
        <Icon name="chevron-left" size={18} />
      </button>
      <button
        onClick={() => {
          if (!currentKey) return;
          direction.current = month < currentKey ? 1 : -1;
          setMonth(currentKey);
        }}
        className="relative h-9 min-w-[132px] overflow-hidden rounded-xl px-2 text-sm font-bold"
        title={period?.booked ? `${formatPeriodRange(period)} · jump to the current period` : 'Jump to the current period'}
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
        disabled={isCurrent || !nextKey}
        className="grid h-9 w-9 place-items-center rounded-xl text-ink-2 hover:bg-white/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
        aria-label="Next month"
      >
        <Icon name="chevron-right" size={18} />
      </button>
    </div>
  );
}
