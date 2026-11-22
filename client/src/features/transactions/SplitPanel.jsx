import { splitShares } from '@shared/quickParse.js';
import { useMoney } from '../../context/PrivacyContext';
import Icon from '../../components/ui/Icon';

/**
 * Shows how a split bill will be saved: your share as the expense, and each
 * person's share as money they owe you (in Debts).
 */
export default function SplitPanel({ split, amount, people, onRemove }) {
  const money = useMoney();
  const { share, yours } = splitShares(amount || 0, split.count);
  const nameOf = (p) => (p.personId ? people.find((x) => x.id === p.personId)?.name : p.personName) || '?';

  return (
    <div className="rounded-2xl border border-transfer/40 bg-transfer-soft/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">🍕 Split {split.count} ways</div>
        <button type="button" onClick={onRemove} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:text-ink" aria-label="Don't split">
          <Icon name="x" size={14} />
        </button>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-ink-2">You (this expense)</span>
          <span className="tabular font-semibold">{money(yours)}</span>
        </li>
        {split.people.map((p) => (
          <li key={p.personId || p.personName} className="flex justify-between">
            <span className="text-ink-2">{nameOf(p)} owes you</span>
            <span className="tabular font-semibold">{money(share)}</span>
          </li>
        ))}
      </ul>
      {split.count > split.people.length + 1 && (
        <p className="mt-2 text-xs text-ink-3">Shares of people not named are counted as yours.</p>
      )}
    </div>
  );
}
