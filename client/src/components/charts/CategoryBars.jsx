import { motion } from 'framer-motion';
import { categoryIcon } from '../../lib/categoryIcon';
import { useMoney } from '../../context/PrivacyContext';

const MAX_ROWS = 6;

/** Keeps the top rows and folds the rest into "Other". */
function foldTail(rows) {
  if (rows.length <= MAX_ROWS) return rows;
  const head = rows.slice(0, MAX_ROWS - 1);
  const rest = rows.slice(MAX_ROWS - 1).reduce((sum, r) => sum + r.total, 0);
  return [...head, { categoryId: 'other', category: `Other (${rows.length - head.length})`, total: rest, folded: true }];
}

/** Ranked horizontal bars: one series, one colour, value and share beside each bar. */
export default function CategoryBars({ rows, type = 'expense', onSelect }) {
  const money = useMoney();
  const color = type === 'income' ? '#3987e5' : '#d95926';
  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const data = foldTail(rows);
  const max = Math.max(...data.map((r) => r.total), 1);

  return (
    <ul className="space-y-3.5">
      {data.map((row, i) => {
        const share = total ? Math.round((row.total / total) * 100) : 0;
        return (
          <li key={row.categoryId}>
            <button
              type="button"
              disabled={row.folded || !onSelect}
              onClick={() => onSelect?.(row)}
              className="group w-full text-left disabled:cursor-default"
            >
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="text-base">{row.folded ? '⋯' : categoryIcon(row.category, type)}</span>
                  <span className="truncate font-medium text-ink group-enabled:group-hover:underline">{row.category}</span>
                </span>
                <span className="tabular shrink-0 text-ink-2">
                  <span className="font-semibold text-ink">{money(row.total)}</span>
                  <span className="ml-2 inline-block w-9 text-right text-xs text-ink-3">{share}%</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.total / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
