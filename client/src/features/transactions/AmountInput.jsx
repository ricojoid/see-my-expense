import { motion } from 'framer-motion';
import { formatGrouped, parseDigits } from '../../lib/format';

const QUICK = [10000, 50000, 100000];
const TONE = { income: 'text-income', expense: 'text-expense', transfer: 'text-transfer' };

/** Big, thumb-friendly amount entry with quick-add chips. */
export default function AmountInput({ value, onChange, type, autoFocus }) {
  return (
    <div className="rounded-3xl border border-line bg-surface-2/70 p-4">
      <label className="flex items-baseline justify-center gap-2">
        <span className="text-lg font-bold text-ink-3">Rp</span>
        <input
          inputMode="numeric"
          autoFocus={autoFocus}
          value={formatGrouped(value)}
          onChange={(e) => onChange(parseDigits(e.target.value))}
          placeholder="0"
          aria-label="Amount"
          className={`tabular w-full min-w-0 bg-transparent text-center text-4xl font-extrabold tracking-tight outline-none placeholder:text-ink-3/50 sm:text-5xl ${TONE[type]}`}
        />
      </label>
      <div className="mt-3 flex justify-center gap-2">
        {QUICK.map((q) => (
          <motion.button
            key={q}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onChange(value + q)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 hover:text-ink"
          >
            +{q / 1000}k
          </motion.button>
        ))}
        {value > 0 && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onChange(0)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-3 hover:text-expense"
          >
            Clear
          </motion.button>
        )}
      </div>
    </div>
  );
}
