import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { accountsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { accountIcon } from '../../lib/categoryIcon';
import ConfirmButton from '../../components/ui/ConfirmButton';
import Icon from '../../components/ui/Icon';
import InlineEdit from '../../components/ui/InlineEdit';
import { useMoney } from '../../context/PrivacyContext';
import BalanceSheet from '../accounts/BalanceSheet';

export default function AccountsSection() {
  const { accounts, refresh } = useData();
  const toast = useToast();
  const [editingId, setEditingId] = useState(null);
  const [balanceOf, setBalanceOf] = useState(null);
  const money = useMoney();

  const run = async (action, message) => {
    try {
      await action();
      refresh();
      toast(message);
      return true;
    } catch (err) {
      toast(err.message, { tone: 'error' });
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-3">
        Wallets, bank accounts and e-wallets. Move money between them with a Transfer (or type <code>isi gopay 1jt</code>). Tap a balance to set
        what the account really holds.
      </p>
      <InlineEdit placeholder="e.g. GoPay, BCA, Savings" onSubmit={(name) => run(() => accountsApi.create(name), `Added "${name}"`)} />
      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {accounts.map((a) => (
            <motion.li key={a.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="py-2">
              {editingId === a.id ? (
                <InlineEdit
                  initial={a.name}
                  submitLabel="Save"
                  autoFocus
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (name) => {
                    if (await run(() => accountsApi.rename(a.id, name), 'Account renamed')) setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-lg">{accountIcon(a.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{a.name}</span>
                    <button type="button" onClick={() => setBalanceOf(a)} className="text-xs text-ink-3 hover:text-ink" aria-label={`Set ${a.name} balance`}>
                      <span className={`tabular font-semibold ${a.balance < 0 ? 'text-expense' : 'text-ink-2'}`}>{money(a.balance)}</span>
                      {` · ${a.usageCount} transaction${a.usageCount === 1 ? '' : 's'}`}
                    </button>
                  </span>
                  <button onClick={() => setEditingId(a.id)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-white/5 hover:text-ink" aria-label={`Rename ${a.name}`}>
                    <Icon name="edit" size={16} />
                  </button>
                  {accounts.length > 1 && <ConfirmButton onConfirm={() => run(() => accountsApi.remove(a.id), `Deleted "${a.name}"`)} />}
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <BalanceSheet account={balanceOf} onClose={() => setBalanceOf(null)} />
    </div>
  );
}
