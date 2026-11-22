import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { transactionsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useFetch } from '../../hooks/useFetch';
import { addDays, formatDay } from '../../lib/dates';
import Icon from '../../components/ui/Icon';

const DISMISSED_KEY = 'sme_weekly_dismissed';

/** Last week's spending, shown from Monday until dismissed. */
export default function WeeklyRecap() {
  const { version } = useData();
  const money = useMoney();
  const recap = useFetch(() => transactionsApi.weekly(), [version]);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY));
  const r = recap.data;
  const visible = r && (r.total > 0 || r.previousTotal > 0) && dismissed !== r.start;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, r.start);
    setDismissed(r.start);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, height: 0, marginTop: 0 }}
          className="card relative overflow-hidden p-5"
        >
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-cyan-brand/15 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-3">
                <Icon name="chart" size={14} className="text-cyan-brand" />
                Last week · {formatDay(r.start)} – {formatDay(addDays(r.end, -1))}
              </div>
              <div className="tabular mt-2 text-2xl font-extrabold">{money(r.total)}</div>
              <div className="mt-1 text-sm text-ink-2">
                {r.count} expense{r.count === 1 ? '' : 's'}
                {r.changePct !== null && (
                  <span className={r.changePct <= 0 ? 'text-income' : 'text-expense'}>
                    {' · '}
                    {r.changePct <= 0 ? `${-r.changePct}% less` : `${r.changePct}% more`} than the week before
                  </span>
                )}
              </div>
              {r.topCategory && (
                <div className="mt-1 text-sm text-ink-3">
                  Top: {r.topCategory.name} {money(r.topCategory.total)}
                </div>
              )}
            </div>
            <button onClick={dismiss} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-white/5 hover:text-ink" aria-label="Dismiss weekly summary">
              <Icon name="x" size={16} />
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}
