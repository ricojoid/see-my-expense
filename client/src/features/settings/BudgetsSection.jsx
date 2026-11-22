import { useState } from 'react';
import { budgetsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { categoryIcon } from '../../lib/categoryIcon';
import { formatGrouped, parseDigits } from '../../lib/format';
import Skeleton from '../../components/ui/Skeleton';
import { useMoney } from '../../context/PrivacyContext';

function BudgetRow({ row, onSave }) {
  const money = useMoney();
  const [value, setValue] = useState(row.budget || 0);
  const [saving, setSaving] = useState(false);
  const dirty = value !== (row.budget || 0);

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    await onSave(row.categoryId, value);
    setSaving(false);
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-lg">{categoryIcon(row.category, 'expense')}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{row.category}</span>
        <span className="tabular text-xs text-ink-3">Spent {money(row.spent)} this month</span>
      </span>
      <label className={`flex w-36 items-center gap-1 rounded-xl border bg-surface-2 px-3 transition-colors ${dirty ? 'border-accent/60' : 'border-line'}`}>
        <span className="text-xs text-ink-3">Rp</span>
        <input
          inputMode="numeric"
          className="tabular h-10 w-full bg-transparent text-right font-semibold outline-none placeholder:font-normal placeholder:text-ink-3"
          value={formatGrouped(value)}
          placeholder="No limit"
          onChange={(e) => setValue(parseDigits(e.target.value))}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label={`Monthly budget for ${row.category}`}
          disabled={saving}
        />
      </label>
    </li>
  );
}

export default function BudgetsSection() {
  const { month, version, refresh } = useData();
  const toast = useToast();
  const budgets = useFetch(() => budgetsApi.list(month), [month, version]);

  const save = async (categoryId, amount) => {
    try {
      await budgetsApi.set(categoryId, amount || null);
      refresh();
      toast(amount ? 'Budget saved' : 'Budget removed');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  return (
    <div>
      <p className="mb-3 text-sm text-ink-3">A monthly limit per expense category. Leave it empty for no limit. Saves when you leave the field.</p>
      {!budgets.data ? (
        <Skeleton className="h-64" />
      ) : (
        <ul className="divide-y divide-line">
          {budgets.data.map((row) => (
            <BudgetRow key={`${row.categoryId}-${row.budget}`} row={row} onSave={save} />
          ))}
        </ul>
      )}
    </div>
  );
}
