import { recurringApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { categoryIcon } from '../../lib/categoryIcon';
import { formatDateLong } from '../../lib/dates';
import { ordinal, signFor } from '../../lib/format';
import ConfirmButton from '../../components/ui/ConfirmButton';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import { useMoney } from '../../context/PrivacyContext';

export default function RecurringSection() {
  const money = useMoney();
  const { version, refresh } = useData();
  const toast = useToast();
  const rules = useFetch(() => recurringApi.list(), [version]);

  const run = async (action, message) => {
    try {
      await action();
      refresh();
      toast(message);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  if (!rules.data) return <Skeleton className="h-40" />;
  if (!rules.data.length) {
    return (
      <EmptyState
        title="No recurring transactions"
        message='When adding a transaction, switch on "Repeat every month" and it will be booked for you automatically.'
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {rules.data.map((r) => (
        <li key={r.id} className={`flex items-center gap-3 py-3 ${r.active ? '' : 'opacity-50'}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{categoryIcon(r.category, r.type)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{r.description || r.category}</span>
            <span className="block truncate text-xs text-ink-3">
              Every {ordinal(r.dayOfMonth)} · {r.account} · {r.active ? `next ${formatDateLong(r.nextRunOn)}` : 'paused'}
            </span>
          </span>
          <span className={`tabular shrink-0 text-sm font-bold ${r.type === 'income' ? 'text-income' : ''}`}>
            {signFor(r.type)}
            {money(r.amount)}
          </span>
          <button
            onClick={() => run(() => recurringApi.setActive(r.id, !r.active), r.active ? 'Paused' : 'Resumed')}
            className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-white/5 hover:text-ink"
          >
            {r.active ? 'Pause' : 'Resume'}
          </button>
          <ConfirmButton onConfirm={() => run(() => recurringApi.remove(r.id), 'Stopped. Past transactions were kept.')} />
        </li>
      ))}
    </ul>
  );
}
