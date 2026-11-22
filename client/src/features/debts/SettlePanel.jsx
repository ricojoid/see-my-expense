import { useState } from 'react';
import { motion } from 'framer-motion';
import { transactionsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { defaultAccountId, rememberAccount } from '../../lib/accounts';
import { accountIcon } from '../../lib/categoryIcon';
import { today } from '../../lib/dates';
import { formatCurrency } from '../../lib/format';
import Button from '../../components/ui/Button';
import Chip from '../../components/ui/Chip';
import { useMoney } from '../../context/PrivacyContext';

/**
 * "Mark as settled": books the whole remaining balance as money back,
 * income if they owed you, expense if you owed them. The balance becomes 0.
 */
export default function SettlePanel({ person, onDone, onCancel }) {
  const money = useMoney();
  const { accounts, refresh } = useData();
  const toast = useToast();
  const [accountId, setAccountId] = useState(() => defaultAccountId(accounts));
  const [busy, setBusy] = useState(false);

  const theyOwe = person.balance > 0;
  const amount = Math.abs(person.balance);
  const type = theyOwe ? 'income' : 'expense';

  const settle = async () => {
    setBusy(true);
    try {
      await transactionsApi.create({
        type,
        amount,
        occurredOn: today(),
        accountId,
        personId: person.id,
        description: 'Settled',
      });
      rememberAccount(accountId);
      toast(theyOwe ? `${person.name} paid you back ${formatCurrency(amount)}` : `You paid ${person.name} back ${formatCurrency(amount)}`);
      refresh();
      onDone();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="space-y-4 rounded-2xl border border-line bg-surface-2/60 p-4">
        <p className="text-sm text-ink-2">
          {theyOwe ? (
            <>
              Records <b className="text-ink">{money(amount)}</b> coming back from {person.name} as income.
            </>
          ) : (
            <>
              Records <b className="text-ink">{money(amount)}</b> paid to {person.name} as an expense.
            </>
          )}
        </p>
        {accounts.length > 1 && (
          <div>
            <div className="label">{theyOwe ? 'Into account' : 'From account'}</div>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <Chip key={a.id} tone={type} selected={accountId === a.id} icon={accountIcon(a.name)} onClick={() => setAccountId(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" icon="check" className="flex-1" loading={busy} onClick={settle}>
            Settle {money(amount)}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
