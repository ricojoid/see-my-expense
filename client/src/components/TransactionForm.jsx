import { useEffect, useState } from 'react';

const today = () => new Date().toISOString().slice(0, 10);

const initialState = {
  type: 'expense',
  categoryId: '',
  description: '',
  amount: '',
  occurredOn: today(),
};

export default function TransactionForm({ categories, onSubmit, submitting }) {
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState('');

  const categoriesForType = categories.filter((c) => c.type === form.type);

  useEffect(() => {
    if (!categoriesForType.some((c) => String(c.id) === String(form.categoryId))) {
      setForm((prev) => ({ ...prev, categoryId: categoriesForType[0]?.id ?? '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type, categories]);

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.categoryId) {
      setError('category required -- add one in the categories screen');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setError('amount must be > 0');
      return;
    }

    try {
      await onSubmit({ ...form, amount: Number(form.amount) });
      setForm((prev) => ({ ...initialState, type: prev.type }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-term-border bg-term-panel p-4 shadow-glowSm"
    >
      <div className="mb-3 text-xs text-term-dim">{'> new_transaction --interactive'}</div>

      <div className="mb-3 flex gap-2">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, type: t }))}
            className={`flex-1 rounded border px-3 py-2 text-sm uppercase tracking-wide transition ${
              form.type === t
                ? t === 'income'
                  ? 'border-term-green bg-term-green/10 text-term-green shadow-glowSm'
                  : 'border-term-red bg-term-red/10 text-term-red'
                : 'border-term-border text-term-dim hover:border-term-green/60'
            }`}
          >
            {t === 'income' ? '+ income' : '- expense'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-term-dim">category</label>
          {categoriesForType.length === 0 ? (
            <div className="rounded border border-term-amber/50 bg-term-amber/10 px-3 py-2 text-xs text-term-amber">
              no {form.type} categories -- add one in the categories screen
            </div>
          ) : (
            <select
              value={form.categoryId}
              onChange={update('categoryId')}
              className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
            >
              {categoriesForType.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-term-dim">amount (Rp)</label>
          <input
            type="number"
            step="1"
            min="1"
            value={form.amount}
            onChange={update('amount')}
            placeholder="0"
            className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-term-dim">date</label>
          <input
            type="date"
            value={form.occurredOn}
            onChange={update('occurredOn')}
            className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-term-dim">description (optional)</label>
          <input
            value={form.description}
            onChange={update('description')}
            placeholder="note..."
            className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
          />
        </div>
      </div>

      {error && <div className="mt-3 text-xs text-term-red">{`!! error: ${error}`}</div>}

      <button
        type="submit"
        disabled={submitting || categoriesForType.length === 0}
        className="mt-4 w-full rounded border border-term-green bg-term-green/10 px-3 py-2 text-sm uppercase tracking-widest text-term-green transition hover:bg-term-green/20 hover:shadow-glow disabled:opacity-50"
      >
        {submitting ? 'executing...' : '> execute'}
      </button>
    </form>
  );
}
