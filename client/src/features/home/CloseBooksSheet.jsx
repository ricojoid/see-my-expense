import { useState } from 'react';
import { periodsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { formatMonth, formatPeriodRange } from '../../lib/dates';
import { formatGrouped, parseDigits } from '../../lib/format';
import { accountIcon } from '../../lib/categoryIcon';
import { useMoney } from '../../context/PrivacyContext';
import ToggleRow from '../../components/ui/ToggleRow';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

const CHOICES = [
  { value: 'today', title: 'Today', text: "Today still counts in this period. The new one starts tomorrow." },
  { value: 'yesterday', title: 'Yesterday', text: 'Today already counts in the new period.' },
];

/**
 * "Tutup buku" on payday: the current period ends and a new one starts, from
 * tomorrow or from today. Optionally the account balances start afresh with
 * what's really left (empty means 0). Undo (of the close) is offered right after.
 */
export default function CloseBooksSheet({ open, onClose }) {
  const { period, accounts, goToCurrent } = useData();
  const toast = useToast();
  const money = useMoney();
  const [when, setWhen] = useState('today');
  const [resetBalances, setResetBalances] = useState(false);
  const [balances, setBalances] = useState({}); // accountId -> what's left; missing = 0
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const undo = async () => {
    try {
      await periodsApi.undoClose();
      await goToCurrent();
      toast('Close undone');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      const fresh = resetBalances ? Object.fromEntries(accounts.map((a) => [a.id, balances[a.id] || 0])) : undefined;
      const { opened } = await periodsApi.close(when, fresh);
      setResetBalances(false);
      setBalances({});
      await goToCurrent();
      onClose();
      const starts = opened.current ? 'starts today' : 'starts tomorrow';
      toast(`Books closed. ${formatMonth(opened.key)} ${starts}.`, { action: { label: 'Undo', onClick: undo }, duration: 6000 });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Close the books"
      footer={
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" className="w-full" icon="book" loading={busy} onClick={confirm}>
            Close {period ? formatMonth(period.key) : 'the books'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-2">
        Payday? Close this period{period && <> ({formatPeriodRange(period)})</>} and start counting a new one. When did you close the books?
      </p>
      <div className="space-y-2.5" role="radiogroup" aria-label="Close the books">
        {CHOICES.map((c) => {
          const selected = when === c.value;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setWhen(c.value)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                selected ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface-2 hover:bg-surface-3'
              }`}
            >
              <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${selected ? 'border-accent bg-accent text-accent-ink' : 'border-line'}`}>
                {selected && <Icon name="check" size={12} strokeWidth={3} />}
              </span>
              <span>
                <span className="block font-semibold text-ink">{c.title}</span>
                <span className="block text-sm text-ink-3">{c.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        <ToggleRow
          icon="💳"
          title="Start balances afresh"
          hint="Set each account to what's really left. Empty means 0."
          checked={resetBalances}
          onChange={setResetBalances}
        />
        {resetBalances && (
          <ul className="space-y-2">
            {accounts.map((a) => (
              <li key={a.id}>
                <label className="field-box flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5">
                  <span className="text-lg">{accountIcon(a.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.name}</span>
                    <span className="block text-xs text-ink-3">Now {money(a.balance)}</span>
                  </span>
                  <span className="text-sm font-bold text-ink-3">Rp</span>
                  <input
                    inputMode="numeric"
                    value={formatGrouped(balances[a.id] || 0)}
                    onChange={(e) => setBalances((b) => ({ ...b, [a.id]: parseDigits(e.target.value) }))}
                    placeholder="0"
                    aria-label={`${a.name} balance`}
                    className="tabular h-12 w-32 bg-transparent text-right text-base font-bold outline-none placeholder:text-ink-3/60"
                  />
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
