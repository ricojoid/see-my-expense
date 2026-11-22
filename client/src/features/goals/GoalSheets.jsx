import { useEffect, useRef, useState } from 'react';
import { goalsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import { formatDay } from '../../lib/dates';
import Button from '../../components/ui/Button';
import ConfirmButton from '../../components/ui/ConfirmButton';
import Segmented from '../../components/ui/Segmented';
import Sheet from '../../components/ui/Sheet';
import AmountInput from '../transactions/AmountInput';

/** Create or edit a goal: name, target, optional deadline. */
export function GoalFormSheet({ open, goal, onClose }) {
  const { refresh } = useData();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', target: 0, deadline: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(goal ? { name: goal.name, target: goal.target, deadline: goal.deadline || '' } : { name: '', target: 0, deadline: '' });
    setError('');
  }, [open, goal]);

  const save = async () => {
    if (!form.name.trim()) return setError('Give it a name');
    if (!form.target) return setError('Set a target amount');
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), target: form.target, deadline: form.deadline || null };
      if (goal) await goalsApi.update(goal.id, payload);
      else await goalsApi.create(payload);
      toast(goal ? 'Goal updated' : `Goal "${payload.name}" created`);
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await goalsApi.remove(goal.id);
    toast(`Deleted "${goal.name}"`, { tone: 'info' });
    refresh();
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={goal ? 'Edit goal' : 'New goal'}
      footer={
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            {goal && <ConfirmButton onConfirm={remove} size="lg" />}
            <Button variant="primary" size="lg" className="flex-1" loading={busy} onClick={save}>
              {goal ? 'Save changes' : 'Create goal'}
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="label" htmlFor="goal-name">
            What for
          </label>
          <input
            id="goal-name"
            className="field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Laptop, Emergency fund, Bali trip"
            maxLength={50}
          />
        </div>
        <div>
          <div className="label">Target</div>
          <AmountInput value={form.target} onChange={(target) => setForm((f) => ({ ...f, target }))} type="income" />
        </div>
        <div>
          <label className="label" htmlFor="goal-deadline">
            By (optional)
          </label>
          <input
            id="goal-deadline"
            type="date"
            className="field"
            value={form.deadline}
            onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          />
          <p className="mt-1.5 text-xs text-ink-3">With a date, you'll see how much to set aside each month.</p>
        </div>
      </div>
    </Sheet>
  );
}

/** Put money in (or take some out), with the history below. */
export function ContributeSheet({ goal: current, onClose }) {
  // Keep showing the goal while the sheet animates closed.
  const last = useRef(current);
  if (current) last.current = current;
  const goal = current || last.current;
  const { refresh, version } = useData();
  const money = useMoney();
  const toast = useToast();
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState(0);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const history = useFetch(() => (goal ? goalsApi.history(goal.id) : Promise.resolve([])), [goal?.id, version]);

  useEffect(() => {
    setMode('add');
    setAmount(0);
    setNote('');
    setError('');
  }, [goal?.id]);

  const save = async () => {
    if (!amount) return setError('Enter an amount');
    setBusy(true);
    try {
      const updated = await goalsApi.contribute(goal.id, { amount, withdraw: mode === 'withdraw', note });
      toast(updated.done ? `🎉 ${updated.name} reached!` : `${updated.name}: ${updated.percent}% saved`);
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={Boolean(current)}
      onClose={onClose}
      title={goal?.name || 'Goal'}
      footer={
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense" role="alert">
              {error}
            </p>
          )}
          <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={save}>
            {mode === 'add' ? 'Add to savings' : 'Take out'}
          </Button>
        </>
      }
    >
      {goal && (
        <div className="space-y-5">
          <p className="text-sm text-ink-2">
            <b className="tabular text-ink">{money(goal.saved)}</b> of {money(goal.target)} saved
          </p>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'add', label: 'Add money', activeBg: 'bg-income', activeText: 'text-bg' },
              { value: 'withdraw', label: 'Take out', activeBg: 'bg-expense', activeText: 'text-bg' },
            ]}
          />
          <AmountInput value={amount} onChange={setAmount} type={mode === 'add' ? 'income' : 'expense'} />
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" maxLength={100} />

          {history.data?.length > 0 && (
            <div>
              <div className="label">History</div>
              <ul className="space-y-1.5 text-sm">
                {history.data.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink-2">
                      {formatDay(c.occurredOn)}
                      {c.note && <span className="text-ink-3"> · {c.note}</span>}
                    </span>
                    <span className={`tabular shrink-0 font-semibold ${c.amount > 0 ? 'text-income' : 'text-expense'}`}>
                      {c.amount > 0 ? '+' : '−'}
                      {money(Math.abs(c.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
