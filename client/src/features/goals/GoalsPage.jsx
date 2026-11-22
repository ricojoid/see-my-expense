import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { goalsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDateLong } from '../../lib/dates';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import Skeleton from '../../components/ui/Skeleton';
import { ContributeSheet, GoalFormSheet } from './GoalSheets';

export function GoalProgress({ goal, className = '' }) {
  return (
    <div className={`h-2.5 overflow-hidden rounded-full bg-white/[0.06] ${className}`}>
      <motion.div
        className={`h-full rounded-full ${goal.done ? 'bg-income' : 'bg-gradient-to-r from-accent to-cyan-brand'}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.max(goal.percent, goal.saved > 0 ? 3 : 0)}%` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/** "Rp 1.200.000 a month to reach it by 30 June 2027" / "Reached" / "Rp 3.000.000 to go". */
export function useGoalHint() {
  const money = useMoney();
  return (g) => {
    if (g.done) return '🎉 Reached';
    if (g.overdue) return `Past the date · ${money(g.remaining)} to go`;
    if (g.perMonth) return `${money(g.perMonth)} a month to reach it by ${formatDateLong(g.deadline)}`;
    return `${money(g.remaining)} to go`;
  };
}

function GoalCard({ goal, index, onAdd, onEdit }) {
  const money = useMoney();
  const hint = useGoalHint();
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => onEdit(goal)} className="min-w-0 text-left">
          <div className="truncate text-lg font-bold">{goal.name}</div>
          <div className="mt-0.5 text-sm text-ink-3">{hint(goal)}</div>
        </button>
        <span className={`tabular shrink-0 text-2xl font-extrabold ${goal.done ? 'text-income' : ''}`}>{goal.percent}%</span>
      </div>
      <GoalProgress goal={goal} className="mt-4" />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="tabular text-sm text-ink-2">
          <b className="text-ink">{money(goal.saved)}</b> / {money(goal.target)}
        </span>
        <Button size="sm" variant={goal.done ? 'secondary' : 'primary'} icon="plus" onClick={() => onAdd(goal)}>
          {goal.done ? 'Manage' : 'Add money'}
        </Button>
      </div>
    </motion.li>
  );
}

/** Savings goals: a target, an optional date, and what to put aside each month. */
export default function GoalsPage() {
  const { version } = useData();
  const goals = useFetch(() => goalsApi.list(), [version]);
  const [form, setForm] = useState({ open: false, goal: null });
  const [adding, setAdding] = useState(null);

  return (
    <>
      <PageHeader
        eyebrow="Saving up for something"
        title="Goals"
        action={
          <Button variant="primary" icon="plus" onClick={() => setForm({ open: true, goal: null })}>
            <span className="hidden sm:inline">New goal</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      {!goals.data ? (
        <Skeleton className="h-40" />
      ) : goals.data.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No goals yet"
            message="A laptop, a trip, an emergency fund: set a target and see how much to save each month."
            action={
              <Button variant="primary" icon="plus" onClick={() => setForm({ open: true, goal: null })}>
                New goal
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          <AnimatePresence initial={false}>
            {goals.data.map((g, i) => (
              <GoalCard key={g.id} goal={g} index={i} onAdd={setAdding} onEdit={(goal) => setForm({ open: true, goal })} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-ink-3">
        <Icon name="send" size={14} />
        On Telegram, save with <code className="text-ink-2">nabung laptop 500k</code>.
      </p>

      <GoalFormSheet open={form.open} goal={form.goal} onClose={() => setForm((f) => ({ ...f, open: false }))} />
      <ContributeSheet goal={adding} onClose={() => setAdding(null)} />
    </>
  );
}
