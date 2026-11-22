import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { accountIcon } from '../../lib/categoryIcon';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import BalanceSheet from '../accounts/BalanceSheet';

/**
 * What each account holds: cash, bank, e-wallets. Spending with GoPay lowers
 * GoPay; "isi gopay 1jt" moves money from the bank to GoPay. Tap one to set
 * its real balance.
 */
export default function BalancesCard() {
  const { accounts, openEditor } = useData();
  const money = useMoney();
  const [editing, setEditing] = useState(null);
  if (!accounts.length) return null;
  const total = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <Card
      title="Balances"
      subtitle={`${money(total)} in total`}
      delay={0.05}
      action={
        accounts.length > 1 && (
          <Button size="sm" variant="ghost" icon="swap" onClick={() => openEditor(null, { type: 'transfer' })}>
            Transfer
          </Button>
        )
      }
    >
      <ul className="-mx-2">
        {accounts.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => setEditing(a)}
              className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-white/[0.04]"
              aria-label={`${a.name}: ${money(a.balance)}. Set balance`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-base">{accountIcon(a.name)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
              <span className={`tabular shrink-0 font-semibold ${a.balance < 0 ? 'text-expense' : 'text-ink'}`}>{money(a.balance)}</span>
            </button>
          </li>
        ))}
      </ul>
      {accounts.some((a) => a.balance < 0) && <p className="mt-2 text-xs text-ink-3">Below zero? Tap the account and type what it really holds.</p>}
      <BalanceSheet account={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}
