import { useEffect, useState } from 'react';
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../api.js';

const emptyForm = { name: '', type: 'expense' };

export default function CategoryManager() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchCategories();
      setCategories(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, type: cat.type });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('name required');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (editingId) {
        await updateCategory(editingId, form);
      } else {
        await createCategory(form);
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await deleteCategory(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const income = categories.filter((c) => c.type === 'income');
  const expense = categories.filter((c) => c.type === 'expense');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded border border-term-border bg-term-panel p-4 shadow-glowSm"
      >
        <div className="mb-3 text-xs text-term-dim">
          {editingId ? `> update_category --id=${editingId}` : '> new_category --master'}
        </div>

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
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-term-dim">name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="e.g. Gopay, Salary"
            className="rounded border border-term-border bg-term-bg px-3 py-2 text-sm text-term-green outline-none focus:border-term-green focus:shadow-glowSm"
          />
        </div>

        {error && <div className="mt-3 text-xs text-term-red">{`!! ${error}`}</div>}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded border border-term-green bg-term-green/10 px-3 py-2 text-sm uppercase tracking-widest text-term-green transition hover:bg-term-green/20 hover:shadow-glow disabled:opacity-50"
          >
            {editingId ? '> save' : '> add'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded border border-term-border px-3 py-2 text-sm uppercase tracking-widest text-term-dim hover:border-term-red/60 hover:text-term-red"
            >
              cancel
            </button>
          )}
        </div>
      </form>

      <div className="rounded border border-term-border bg-term-panel p-4 shadow-glowSm">
        <div className="mb-3 text-xs text-term-dim">{'> ls categories/ --master-data'}</div>

        {loading ? (
          <div className="py-8 text-center text-sm text-term-dim animate-pulse">loading...</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CategoryColumn
              title="income"
              colorClass="text-term-green"
              items={income}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
            <CategoryColumn
              title="expense"
              colorClass="text-term-red"
              items={expense}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryColumn({ title, colorClass, items, onEdit, onDelete }) {
  return (
    <div>
      <div className={`mb-2 text-xs uppercase tracking-wide ${colorClass}`}>{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-term-dim">no categories yet.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((cat) => (
            <li
              key={cat.id}
              className="flex items-center justify-between rounded border border-term-border/60 px-2 py-1.5 text-sm hover:bg-term-green/5"
            >
              <span>{cat.name}</span>
              <span className="flex gap-2 text-xs">
                <button onClick={() => onEdit(cat)} className="text-term-dim hover:text-term-amber">
                  [edit]
                </button>
                <button onClick={() => onDelete(cat.id)} className="text-term-dim hover:text-term-red">
                  [x]
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
