import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { insightsApi, recurringApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { categoryIcon } from '../../lib/categoryIcon';
import { formatDateLong } from '../../lib/dates';
import { ordinal } from '../../lib/format';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const DISMISSED_KEY = 'sme_subscription_dismissed';
const keyOf = (s) => `${s.description.toLowerCase()}|${s.amount}`;
const readDismissed = () => {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY)) || [];
  } catch {
    return [];
  }
};

/** Expenses that repeat every month, offered as recurring rules. */
export default function SubscriptionSuggestions() {
  const { version, refresh } = useData();
  const money = useMoney();
  const toast = useToast();
  const { data } = useFetch(() => insightsApi.subscriptions(), [version]);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [busy, setBusy] = useState(null);
  const items = (data || []).filter((s) => !dismissed.includes(keyOf(s)));
  if (!items.length) return null;

  const dismiss = (s) => {
    const next = [...dismissed, keyOf(s)];
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    setDismissed(next);
  };

  const makeRecurring = async (s) => {
    setBusy(keyOf(s));
    try {
      await recurringApi.create({
        type: 'expense',
        amount: s.amount,
        occurredOn: s.nextOn,
        accountId: s.accountId,
        categoryId: s.categoryId,
        description: s.description,
      });
      toast(`${s.description} will be booked every month, next on ${formatDateLong(s.nextOn)}`);
      refresh();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Looks like subscriptions" subtitle="Paid every month: book them automatically?">
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {items.map((s) => (
            <motion.li key={keyOf(s)} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{categoryIcon(s.category, 'expense')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{s.description}</span>
                <span className="block truncate text-xs text-ink-3">
                  <span className="tabular">{money(s.amount)}</span> · around the {ordinal(s.dayOfMonth)} · {s.months} months
                </span>
              </span>
              <Button size="sm" variant="secondary" icon="repeat" loading={busy === keyOf(s)} onClick={() => makeRecurring(s)}>
                Recurring
              </Button>
              <button onClick={() => dismiss(s)} className="text-xs font-semibold text-ink-3 hover:text-ink" aria-label={`${s.description} is not a subscription`}>
                No
              </button>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </Card>
  );
}
