import { recurringApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useFetch } from '../../hooks/useFetch';
import { categoryIcon } from '../../lib/categoryIcon';
import { signFor } from '../../lib/format';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const weekdayShort = (date) => new Date(`${date}T00:00`).toLocaleDateString('en-GB', { weekday: 'short' });

/** Recurring bills (and income) still to come this month, as a little agenda. */
export default function UpcomingBills({ onNavigate }) {
  const { version } = useData();
  const money = useMoney();
  const upcoming = useFetch(() => recurringApi.upcoming(), [version]);
  const items = upcoming.data || [];
  if (!items.length) return null;

  const outgoing = items.filter((r) => r.type === 'expense').reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card
      title="Coming up"
      subtitle={outgoing ? `${money(outgoing)} still to go out this period` : 'Still to come this period'}
      delay={0.18}
      action={
        <Button size="sm" variant="ghost" onClick={() => onNavigate('settings', 'recurring')}>
          Manage
        </Button>
      }
    >
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <span className="grid h-12 w-11 shrink-0 place-items-center rounded-xl border border-line bg-surface-2 leading-none">
              <span className="text-[10px] font-semibold uppercase text-ink-3">{weekdayShort(r.nextRunOn)}</span>
              <span className="text-base font-extrabold">{Number(r.nextRunOn.slice(8))}</span>
            </span>
            <span className="text-lg">{categoryIcon(r.category, r.type)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{r.description || r.category}</span>
              <span className="block truncate text-xs text-ink-3">{r.account}</span>
            </span>
            <span className={`tabular shrink-0 text-sm font-bold ${r.type === 'income' ? 'text-income' : ''}`}>
              {signFor(r.type)}
              {money(r.amount)}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
