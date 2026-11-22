import { insightsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useFetch } from '../../hooks/useFetch';
import Icon from '../../components/ui/Icon';

/** "Heading for ~Rp 4.200.000 this month", and how that compares with the budgets. */
export default function Projection() {
  const { version } = useData();
  const money = useMoney();
  const { data: p } = useFetch(() => insightsApi.projection(), [version]);
  if (!p || p.daysLeft === 0 || (!p.spent && !p.upcoming)) return null;

  const over = p.overBudgetBy > 0;
  return (
    <div className="mt-2.5 flex items-start gap-2.5 rounded-2xl bg-black/20 p-3 text-sm backdrop-blur">
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${over ? 'bg-expense/20 text-expense' : 'bg-white/10 text-ink-2'}`}>
        <Icon name="chart" size={12} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 text-ink-2">
        Heading for about <b className="tabular text-ink">{money(p.projected)}</b> by month end
        {p.early && <span className="text-ink-3"> (early guess)</span>}
        {p.budget != null && (
          <span className={`block text-xs ${over ? 'text-expense' : 'text-ink-3'}`}>
            {over ? `${money(p.overBudgetBy)} over your budgets` : `Within your budgets of ${money(p.budget)}`}
            {p.upcoming > 0 && ` · includes ${money(p.upcoming)} of bills still to come`}
          </span>
        )}
        {p.budget == null && p.upcoming > 0 && <span className="block text-xs text-ink-3">Includes {money(p.upcoming)} of bills still to come</span>}
      </div>
    </div>
  );
}
