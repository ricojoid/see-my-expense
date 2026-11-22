import { motion } from 'framer-motion';
import { categoryIcon } from '../../lib/categoryIcon';
import { useMoney } from '../../context/PrivacyContext';

/** Status colour + a word, never colour alone. */
function status(ratio) {
  if (ratio > 1) return { label: 'Over', bar: 'bg-status-critical', text: 'text-expense', icon: '⛔' };
  if (ratio >= 0.8) return { label: 'Close', bar: 'bg-status-warning', text: 'text-status-warning', icon: '⚠️' };
  return { label: 'On track', bar: 'bg-status-good', text: 'text-income', icon: '✓' };
}

export default function BudgetList({ budgets, limit }) {
  const money = useMoney();
  const rows = budgets
    .filter((b) => b.budget)
    .map((b) => ({ ...b, ratio: b.spent / b.budget }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, limit);

  return (
    <ul className="space-y-4">
      {rows.map((b, i) => {
        const s = status(b.ratio);
        const left = b.budget - b.spent;
        return (
          <li key={b.categoryId}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-base">{categoryIcon(b.category, 'expense')}</span>
                <span className="truncate font-medium">{b.category}</span>
                <span className={`shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold ${s.text}`}>
                  {s.icon} {s.label}
                </span>
              </span>
              <span className="tabular shrink-0 text-xs text-ink-3">
                <span className="font-semibold text-ink">{money(b.spent)}</span> / {money(b.budget)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                className={`h-full rounded-full ${s.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(b.ratio, 1) * 100}%` }}
                transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-ink-3">
              {left >= 0 ? `${money(left)} left` : `${money(-left)} over budget`}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
