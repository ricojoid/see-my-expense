import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { formatDay } from '../../lib/dates';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import PersonSheet from './PersonSheet';
import { TONE_CLASS, describeBalance } from './debtText';
import { useMoney } from '../../context/PrivacyContext';

function TotalTile({ label, value, hint, className, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="card p-4">
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className={`tabular mt-1 truncate text-xl font-extrabold sm:text-2xl ${className}`}>{value}</div>
      <div className="mt-0.5 truncate text-xs text-ink-3">{hint}</div>
    </motion.div>
  );
}

function PersonRow({ person, index, onOpen }) {
  const money = useMoney();
  const { tone } = describeBalance(person);
  const caption = person.balance > 0 ? 'owes you' : person.balance < 0 ? 'you owe' : 'settled';
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.03 }}
    >
      <button
        onClick={() => onOpen(person.id)}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent/25 to-cyan-brand/25 text-base font-extrabold">
          {person.name[0]?.toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{person.name}</span>
          <span className="block truncate text-xs text-ink-3">
            {person.lastOn ? `Last: ${formatDay(person.lastOn)}` : 'No transactions'}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`tabular block font-bold ${TONE_CLASS[tone]}`}>{money(Math.abs(person.balance))}</span>
          <span className="block text-xs text-ink-3">{caption}</span>
        </span>
      </button>
    </motion.li>
  );
}

function PeopleList({ people, onOpen }) {
  return (
    <ul>
      <AnimatePresence initial={false}>
        {people.map((p, i) => (
          <PersonRow key={p.id} person={p} index={i} onOpen={onOpen} />
        ))}
      </AnimatePresence>
    </ul>
  );
}

/** Who owes you, whom you owe, and one tap to settle up. */
export default function DebtsPage() {
  const money = useMoney();
  const { people, openEditor } = useData();
  const [openId, setOpenId] = useState(null);
  const [showSettled, setShowSettled] = useState(false);

  const open = people.filter((p) => p.balance !== 0).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  const settled = people.filter((p) => p.balance === 0);
  const owedToYou = open.filter((p) => p.balance > 0);
  const youOwe = open.filter((p) => p.balance < 0);
  const sum = (list) => list.reduce((total, p) => total + Math.abs(p.balance), 0);
  const plural = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

  const newDebt = () => openEditor(null, { type: 'expense', debt: true });

  return (
    <>
      <PageHeader
        eyebrow="Who owes who"
        title="Debts"
        action={
          <Button variant="primary" icon="plus" onClick={newDebt}>
            <span className="hidden sm:inline">New debt</span>
            <span className="sm:hidden">New</span>
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3">
        <TotalTile label="Owed to you" value={money(sum(owedToYou))} hint={plural(owedToYou.length)} className="text-income" delay={0} />
        <TotalTile label="You owe" value={money(sum(youOwe))} hint={plural(youOwe.length)} className="text-expense" delay={0.05} />
      </div>

      <Card title="Open" subtitle="Tap someone to settle up or add more" padded={false} className="pb-3" delay={0.1}>
        <div className="px-3">
          {open.length ? (
            <PeopleList people={open} onOpen={setOpenId} />
          ) : (
            <EmptyState
              title={people.length ? 'All settled up' : 'No debts yet'}
              message="Lent someone money or borrowed some? Record it here or switch on Debt when adding a transaction."
              action={
                <Button variant="primary" icon="plus" onClick={newDebt}>
                  New debt
                </Button>
              }
            />
          )}
        </div>
      </Card>

      {settled.length > 0 && (
        <div className="mt-5">
          <button
            onClick={() => setShowSettled((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold text-ink-3 hover:text-ink"
          >
            <span>Settled ({settled.length})</span>
            <Icon name="chevron-down" size={18} className={`transition-transform ${showSettled ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence initial={false}>
            {showSettled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="card mt-2 px-3 py-3">
                  <PeopleList people={settled} onOpen={setOpenId} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <PersonSheet person={people.find((p) => p.id === openId) ?? null} onClose={() => setOpenId(null)} />
    </>
  );
}
