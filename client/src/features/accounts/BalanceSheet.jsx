import { useEffect, useState } from 'react';
import { accountsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useMoney } from '../../context/PrivacyContext';
import { formatGrouped, parseDigits } from '../../lib/format';
import { accountIcon } from '../../lib/categoryIcon';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';

/**
 * Sets what an account really holds now (from the bank or e-wallet app).
 * Only the starting point moves: no transaction is added, so nothing counts
 * as income or spending.
 */
export default function BalanceSheet({ account, onClose }) {
  const { refresh } = useData();
  const toast = useToast();
  const money = useMoney();
  const [value, setValue] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (account) {
      setValue(Math.max(0, account.balance));
      setError('');
    }
  }, [account]);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await accountsApi.setBalance(account.id, value);
      refresh();
      toast(`${account.name} balance set to ${money(value)}`);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(account)}
      onClose={onClose}
      title={account ? `${account.name} balance` : 'Balance'}
      footer={
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={save}>
            Set balance
          </Button>
        </>
      }
    >
      {account && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm text-ink-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-lg">{accountIcon(account.name)}</span>
            <span>
              Now in the app: <b className="tabular text-ink">{money(account.balance)}</b>
            </span>
          </div>
          <label className="field-box flex items-baseline gap-2 rounded-3xl bg-surface-2/70 p-4">
            <span className="text-lg font-bold text-ink-3">Rp</span>
            <input
              inputMode="numeric"
              autoFocus
              value={formatGrouped(value)}
              onChange={(e) => setValue(parseDigits(e.target.value))}
              placeholder="0"
              aria-label="Balance"
              className="tabular w-full min-w-0 bg-transparent text-3xl font-extrabold tracking-tight outline-none placeholder:text-ink-3/50"
            />
          </label>
          <p className="text-sm text-ink-3">
            Type what your {account.name} app shows. Only the starting point changes: no transaction is added, so it never counts as income or
            spending.
          </p>
        </div>
      )}
    </Sheet>
  );
}
