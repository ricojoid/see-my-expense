import { motion } from 'framer-motion';
import AnimatedNumber from '../../components/ui/AnimatedNumber';
import Icon from '../../components/ui/Icon';
import { useMoney } from '../../context/PrivacyContext';
import { currentMonth, daysElapsed, formatMonth } from '../../lib/dates';
import Projection from './Projection';

function Stat({ label, value, icon, tone, large = false }) {
  const money = useMoney();
  return (
    <div className="min-w-0 rounded-2xl bg-black/20 p-3 backdrop-blur sm:p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <span className={`grid h-5 w-5 place-items-center rounded-full ${tone}`}>
          <Icon name={icon} size={12} strokeWidth={2.4} />
        </span>
        {label}
      </div>
      <AnimatedNumber
        value={value}
        format={money}
        className={`tabular mt-1 block truncate font-extrabold tracking-tight ${large ? 'text-lg min-[400px]:text-xl sm:text-3xl' : 'text-lg sm:text-xl'}`}
      />
    </div>
  );
}

/**
 * This month at a glance: income, outcome and average outcome per day,
 * side by side and never netted (not every income source is tracked here).
 */
export default function SpendingCard({ summary, month }) {
  const money = useMoney();
  const expense = summary?.expense ?? 0;
  const days = daysElapsed(month);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-4xl border border-white/10 p-4 shadow-card sm:p-6"
    >
      {/* gradient + glow layers */}
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#1b2410_0%,#0f1a1f_55%,#121426_100%)]" />
      <div className="absolute -right-16 -top-20 h-56 w-56 animate-drift rounded-full bg-accent/25 blur-3xl" />
      <div className="absolute -bottom-24 -left-10 h-56 w-56 animate-drift-slow rounded-full bg-cyan-brand/20 blur-3xl" />
      <svg className="absolute right-0 top-0 h-full w-1/2 opacity-[0.07]" viewBox="0 0 200 200" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx="200" cy="0" r={30 + i * 22} fill="none" stroke="#fff" strokeWidth="1" />
        ))}
      </svg>

      <div className="relative">
        <div className="text-sm font-medium text-ink-2">{formatMonth(month)}</div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat large label="Income" value={summary?.income ?? 0} icon="arrow-down" tone="bg-income/20 text-income" />
          <Stat large label="Outcome" value={expense} icon="arrow-up" tone="bg-expense/20 text-expense" />
          <div className="col-span-2">
            <Stat label="Avg outcome / day" value={days ? expense / days : 0} icon="calendar" tone="bg-white/10 text-ink-2" />
          </div>
        </div>
        {month === currentMonth() && <Projection />}
      </div>
    </motion.section>
  );
}
