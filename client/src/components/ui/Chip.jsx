import { motion } from 'framer-motion';

/** A tappable pill used instead of dropdowns: one tap to choose. */
export default function Chip({ selected = false, onClick, icon, children, tone = 'accent', className = '', ...props }) {
  const selectedTone = {
    accent: 'border-accent/60 bg-accent-soft text-ink',
    income: 'border-income/50 bg-income-soft text-ink',
    expense: 'border-expense/50 bg-expense-soft text-ink',
    transfer: 'border-transfer/50 bg-transfer-soft text-ink',
  }[tone];

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        selected ? selectedTone : 'border-line bg-surface-2 text-ink-2 hover:border-white/20 hover:text-ink'
      } ${className}`}
      {...props}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {children}
    </motion.button>
  );
}
