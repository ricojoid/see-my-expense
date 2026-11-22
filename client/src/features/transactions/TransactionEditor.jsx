import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { recurringApi, transactionsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { defaultAccountId, rememberAccount } from '../../lib/accounts';
import { accountIcon, categoryIcon } from '../../lib/categoryIcon';
import { today } from '../../lib/dates';
import { formatCurrency } from '../../lib/format';
import { enqueue } from '../../lib/outbox';
import { parseQuick } from '../../lib/quickParse';
import Sheet from '../../components/ui/Sheet';
import Segmented from '../../components/ui/Segmented';
import Chip from '../../components/ui/Chip';
import Button from '../../components/ui/Button';
import ConfirmButton from '../../components/ui/ConfirmButton';
import ToggleRow from '../../components/ui/ToggleRow';
import PersonPicker from '../debts/PersonPicker';
import { DEBT_CATEGORY } from '../debts/debtText';
import AmountInput from './AmountInput';
import DatePicker from './DatePicker';
import QuickEntry from './QuickEntry';

const COLLAPSED_CATEGORIES = 11;

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Expense', activeBg: 'bg-expense', activeText: 'text-bg' },
  { value: 'income', label: 'Income', activeBg: 'bg-income', activeText: 'text-bg' },
  { value: 'transfer', label: 'Transfer', activeBg: 'bg-transfer', activeText: 'text-bg' },
];

function emptyForm(accounts) {
  const accountId = defaultAccountId(accounts);
  return {
    type: 'expense',
    amount: 0,
    categoryId: null,
    accountId,
    toAccountId: accounts.find((a) => a.id !== accountId)?.id ?? null,
    occurredOn: today(),
    description: '',
    repeat: false,
    debt: false,
    personId: null,
    personName: '',
  };
}

const fromTransaction = (t) => ({
  type: t.type,
  amount: t.amount,
  categoryId: t.categoryId,
  accountId: t.accountId,
  toAccountId: t.toAccountId,
  occurredOn: t.occurredOn,
  description: t.description || '',
  repeat: false,
  debt: t.personId != null,
  personId: t.personId ?? null,
  personName: '',
});

const isDebt = (f) => f.debt && f.type !== 'transfer';

function toPayload(f) {
  const base = {
    type: f.type,
    amount: f.amount,
    occurredOn: f.occurredOn,
    accountId: f.accountId,
    description: f.description.trim() || null,
  };
  if (f.type === 'transfer') return { ...base, toAccountId: f.toAccountId };
  // Debts are filed under the debt category by the server.
  if (isDebt(f)) return { ...base, ...(f.personId ? { personId: f.personId } : { personName: f.personName.trim() }) };
  return { ...base, categoryId: f.categoryId };
}

const DEBT_HINT = {
  expense: 'Lending money, or paying someone back',
  income: 'Borrowing money, or being paid back',
};

function Section({ label, children }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}

/** Most-used categories first; the long tail folds behind a "+N more" chip. */
function CategoryChips({ categories, type, value, onChange }) {
  const [showAll, setShowAll] = useState(false);
  if (categories.length === 0) {
    return <p className="text-sm text-ink-3">No {type} categories yet. Add one in Settings.</p>;
  }

  const collapsible = categories.length > COLLAPSED_CATEGORIES + 1;
  const visible = showAll || !collapsible ? categories : categories.slice(0, COLLAPSED_CATEGORIES);
  const selected = categories.find((c) => c.id === value);
  const selectedHidden = selected && !visible.includes(selected);

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((c) => (
        <Chip key={c.id} tone={type} selected={value === c.id} icon={categoryIcon(c.name, c.type)} onClick={() => onChange(c.id)}>
          {c.name}
        </Chip>
      ))}
      {selectedHidden && (
        <Chip tone={type} selected icon={categoryIcon(selected.name, type)}>
          {selected.name}
        </Chip>
      )}
      {collapsible && (
        <Chip onClick={() => setShowAll((v) => !v)}>{showAll ? 'Less' : `+${categories.length - COLLAPSED_CATEGORIES} more`}</Chip>
      )}
    </div>
  );
}

function AccountChips({ accounts, value, onChange, exclude, tone }) {
  return (
    <div className="flex flex-wrap gap-2">
      {accounts
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <Chip key={a.id} tone={tone} selected={value === a.id} icon={accountIcon(a.name)} onClick={() => onChange(a.id)}>
            {a.name}
          </Chip>
        ))}
    </div>
  );
}

export default function TransactionEditor() {
  const { editor, closeEditor, categories, accounts, people, refresh } = useData();
  const { user } = useAuth();
  const toast = useToast();
  const editing = editor.transaction;
  const [form, setForm] = useState(() => emptyForm(accounts));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [quick, setQuick] = useState('');
  const quickBase = useRef(null);

  useEffect(() => {
    if (!editor.open) return;
    setForm(editing ? fromTransaction(editing) : { ...emptyForm(accounts), ...editor.preset });
    setError('');
    setQuick('');
    quickBase.current = null;
    // Only reset when the sheet opens, not when lists refresh behind it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor.open, editing]);

  /**
   * Quick entry owns the fields it understands: each keystroke re-parses the
   * whole line on top of the form as it was before typing started.
   */
  const applyQuick = (text) => {
    setQuick(text);
    setError('');
    if (!text.trim()) {
      quickBase.current = null;
      return;
    }
    if (!quickBase.current) quickBase.current = form;
    const parsed = parseQuick(text, {
      categories: categories.filter((c) => c.name !== DEBT_CATEGORY),
      accounts,
      today: today(),
    });
    setForm({ ...quickBase.current, debt: false, repeat: false, ...parsed });
  };

  const set = (patch) => {
    // A manual change sticks even if the quick line is edited again afterwards.
    if (quickBase.current) quickBase.current = { ...quickBase.current, ...patch };
    setForm((f) => ({ ...f, ...patch }));
    setError('');
  };
  // The debt category is picked by the Debt switch, never by hand.
  const typeCategories = useMemo(
    () => categories.filter((c) => c.type === form.type && c.name !== DEBT_CATEGORY),
    [categories, form.type]
  );

  // Default to the most-used category whenever none (or a stale one) is selected:
  // on open, after a type switch, or when the category list refreshes.
  useEffect(() => {
    if (form.type === 'transfer') return;
    if (!typeCategories.some((c) => c.id === form.categoryId)) {
      setForm((f) => ({ ...f, categoryId: typeCategories[0]?.id ?? null }));
    }
  }, [form.type, form.categoryId, typeCategories]);

  // Same for accounts: they may arrive after the sheet opened, or be deleted meanwhile.
  useEffect(() => {
    if (accounts.length === 0) return;
    setForm((f) => {
      const exists = (id) => accounts.some((a) => a.id === id);
      const accountId = exists(f.accountId) ? f.accountId : defaultAccountId(accounts);
      const toAccountId =
        exists(f.toAccountId) && f.toAccountId !== accountId
          ? f.toAccountId
          : accounts.find((a) => a.id !== accountId)?.id ?? null;
      return accountId === f.accountId && toAccountId === f.toAccountId ? f : { ...f, accountId, toAccountId };
    });
  }, [accounts, form.accountId, form.toAccountId]);

  const validate = () => {
    if (!form.amount) return 'Enter an amount';
    if (!form.accountId) return 'Pick an account';
    if (form.type === 'transfer') {
      if (!form.toAccountId || form.toAccountId === form.accountId) return 'Pick a different destination account';
    } else if (isDebt(form)) {
      if (!form.personId && !form.personName.trim()) return 'Pick a person or type a new name';
    } else if (!form.categoryId) return 'Pick a category';
    return '';
  };

  const save = async () => {
    const problem = validate();
    if (problem) return setError(problem);
    setSaving(true);
    setError('');
    try {
      const payload = toPayload(form);
      if (editing) {
        await transactionsApi.update(editing.id, payload);
        toast('Transaction updated');
      } else if (form.repeat && form.type !== 'transfer' && !isDebt(form)) {
        await recurringApi.create(payload);
        toast(`Saved, and it will repeat every month`);
      } else {
        const created = await createOrQueue(payload);
        if (!created) return;
        toast(
          isDebt(form)
            ? `${formatCurrency(form.amount)} ${form.type === 'expense' ? 'to' : 'from'} ${created.person} saved in Debts`
            : `${form.type === 'income' ? 'Income' : form.type === 'expense' ? 'Expense' : 'Transfer'} of ${formatCurrency(form.amount)} saved`
        );
        if (created.budgetAlert) {
          toast(created.budgetAlert.message, { tone: created.budgetAlert.level === 'over' ? 'error' : 'info', duration: 6000 });
        }
      }
      rememberAccount(form.accountId);
      refresh();
      closeEditor();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  /** Creates the transaction, or keeps it on the device when offline. Returns null when queued. */
  const createOrQueue = async (payload) => {
    try {
      return await transactionsApi.create(payload);
    } catch (err) {
      if (err.status !== 0) throw err;
      enqueue(user.id, payload);
      rememberAccount(form.accountId);
      closeEditor();
      toast("You're offline. Saved on this device, it will sync when you're back online.", { tone: 'info', duration: 5000 });
      return null;
    }
  };

  const remove = async () => {
    const snapshot = toPayload(fromTransaction(editing));
    await transactionsApi.remove(editing.id);
    refresh();
    closeEditor();
    toast('Transaction deleted', {
      tone: 'info',
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => transactionsApi.create(snapshot).then(refresh),
      },
    });
  };

  const noAccounts = accounts.length === 0;
  const isTransfer = form.type === 'transfer';
  const debt = isDebt(form);

  return (
    <Sheet
      open={editor.open}
      onClose={closeEditor}
      title={editing ? 'Edit transaction' : 'New transaction'}
      footer={
        <>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense"
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2">
            {editing && <ConfirmButton onConfirm={remove} size="lg" />}
            <Button variant="primary" size="lg" className="flex-1" loading={saving} onClick={save} disabled={noAccounts}>
              {editing ? 'Save changes' : 'Save'}
            </Button>
          </div>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!editing && <QuickEntry value={quick} onChange={applyQuick} />}

        <Segmented
          options={TYPE_OPTIONS.filter((o) => o.value !== 'transfer' || accounts.length > 1)}
          value={form.type}
          onChange={(type) => set({ type })}
        />

        <AmountInput value={form.amount} onChange={(amount) => set({ amount })} type={form.type} autoFocus={!editing && window.innerWidth >= 1024} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isTransfer ? 'transfer' : 'category'}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="space-y-5"
          >
            {isTransfer ? (
              <>
                <Section label="From">
                  <AccountChips accounts={accounts} value={form.accountId} tone="transfer" onChange={(accountId) =>
                    set({ accountId, toAccountId: form.toAccountId === accountId ? accounts.find((a) => a.id !== accountId)?.id : form.toAccountId })
                  } />
                </Section>
                <Section label="To">
                  <AccountChips accounts={accounts} value={form.toAccountId} exclude={form.accountId} tone="transfer" onChange={(toAccountId) => set({ toAccountId })} />
                </Section>
              </>
            ) : (
              <>
                <ToggleRow
                  icon="🤝"
                  title="Debt"
                  hint={DEBT_HINT[form.type]}
                  checked={form.debt}
                  onChange={(on) => set({ debt: on, repeat: false })}
                />
                {debt ? (
                  <Section label={form.type === 'expense' ? 'To' : 'From'}>
                    <PersonPicker
                      people={people}
                      tone={form.type}
                      value={{ personId: form.personId, personName: form.personName }}
                      onChange={set}
                    />
                  </Section>
                ) : (
                  <Section label="Category">
                    <CategoryChips
                      categories={typeCategories}
                      type={form.type}
                      value={form.categoryId}
                      onChange={(categoryId) => set({ categoryId })}
                    />
                  </Section>
                )}
                {accounts.length > 1 && (
                  <Section label={form.type === 'income' ? 'Into account' : 'From account'}>
                    <AccountChips accounts={accounts} value={form.accountId} tone={form.type} onChange={(accountId) => set({ accountId })} />
                  </Section>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <Section label="Date">
          <DatePicker value={form.occurredOn} onChange={(occurredOn) => set({ occurredOn })} />
        </Section>

        <Section label="Note">
          <input
            className="field"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="What was it for? (optional)"
            maxLength={255}
            enterKeyHint="done"
          />
        </Section>

        {!editing && !isTransfer && !debt && (
          <ToggleRow
            title="Repeat every month"
            hint="For salary, rent, subscriptions. Booked automatically."
            checked={form.repeat}
            onChange={(repeat) => set({ repeat })}
          />
        )}

        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
