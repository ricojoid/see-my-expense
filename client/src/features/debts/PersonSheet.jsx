import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { peopleApi, transactionsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useFetch } from '../../hooks/useFetch';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import ConfirmButton from '../../components/ui/ConfirmButton';
import InlineEdit from '../../components/ui/InlineEdit';
import Skeleton from '../../components/ui/Skeleton';
import TransactionGroups from '../transactions/TransactionGroups';
import SettlePanel from './SettlePanel';
import { TONE_CLASS, describeBalance } from './debtText';
import { useMoney } from '../../context/PrivacyContext';

/** What the two "add money" buttons mean depends on who owes whom. */
function actionLabels(balance) {
  if (balance > 0) return { give: 'Lend more', get: 'Got part back' };
  if (balance < 0) return { give: 'Paid part back', get: 'Borrow more' };
  return { give: 'Lend', get: 'Borrow' };
}

function History({ personId }) {
  const { version } = useData();
  const { data, loading } = useFetch(() => transactionsApi.list({ personId, pageSize: 100 }), [personId, version]);
  if (!data && loading) return <Skeleton className="h-24" />;
  if (!data?.items.length) return <p className="py-4 text-center text-sm text-ink-3">No transactions yet.</p>;
  return <TransactionGroups items={data.items} />;
}

/** One person's debt: balance, settle, add more, history, rename / remove. */
export default function PersonSheet({ person: current, onClose }) {
  // Keep showing the last person while the sheet animates closed.
  const last = useRef(current);
  if (current) last.current = current;
  const person = current || last.current;
  const money = useMoney();
  const { openEditor, refresh } = useData();
  const toast = useToast();
  const [settling, setSettling] = useState(false);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    setSettling(false);
    setRenaming(false);
  }, [person?.id]);

  if (!person) return null;

  const { tone, text } = describeBalance(person, money);
  const labels = actionLabels(person.balance);
  const add = (type) => {
    onClose();
    openEditor(null, { type, debt: true, personId: person.id });
  };

  const rename = async (name) => {
    try {
      await peopleApi.rename(person.id, name);
      refresh();
      setRenaming(false);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    }
  };

  const remove = async () => {
    await peopleApi.remove(person.id);
    refresh();
    onClose();
    toast(`Removed ${person.name}. Their transactions are kept.`, { tone: 'info' });
  };

  return (
    <Sheet open={Boolean(current)} onClose={onClose} title={person.name}>
      <div className="space-y-5">
        <div className="rounded-3xl border border-line bg-surface-2/60 p-5 text-center">
          <div className={`tabular text-3xl font-extrabold ${TONE_CLASS[tone]}`}>{money(Math.abs(person.balance))}</div>
          <div className="mt-1 text-sm text-ink-2">{text}</div>
          <div className="mt-3 flex justify-center gap-4 text-xs text-ink-3">
            <span>Given {money(person.given)}</span>
            <span>Received {money(person.received)}</span>
          </div>
        </div>

        <AnimatePresence initial={false} mode="wait">
          {settling ? (
            <SettlePanel key="settle" person={person} onDone={() => setSettling(false)} onCancel={() => setSettling(false)} />
          ) : (
            <div key="actions" className="space-y-2">
              {person.balance !== 0 && (
                <Button variant="primary" icon="check" className="w-full" onClick={() => setSettling(true)}>
                  Mark as settled
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button icon="arrow-up" onClick={() => add('expense')}>
                  {labels.give}
                </Button>
                <Button icon="arrow-down" onClick={() => add('income')}>
                  {labels.get}
                </Button>
              </div>
            </div>
          )}
        </AnimatePresence>

        <section>
          <div className="label">History</div>
          <History personId={person.id} />
        </section>

        <section className="border-t border-line pt-4">
          {renaming ? (
            <InlineEdit initial={person.name} submitLabel="Save" autoFocus onSubmit={rename} onCancel={() => setRenaming(false)} />
          ) : (
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" icon="edit" onClick={() => setRenaming(true)}>
                Rename
              </Button>
              <div className="flex items-center gap-2 text-xs text-ink-3">
                Remove person
                <ConfirmButton onConfirm={remove} label="Remove" />
              </div>
            </div>
          )}
        </section>
      </div>
    </Sheet>
  );
}
