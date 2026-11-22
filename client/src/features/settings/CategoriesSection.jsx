import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { categoriesApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { categoryIcon } from '../../lib/categoryIcon';
import Segmented from '../../components/ui/Segmented';
import ConfirmButton from '../../components/ui/ConfirmButton';
import Icon from '../../components/ui/Icon';
import InlineEdit from '../../components/ui/InlineEdit';

export default function CategoriesSection() {
  const { categories, refresh } = useData();
  const toast = useToast();
  const [type, setType] = useState('expense');
  const [editingId, setEditingId] = useState(null);

  const run = async (action, message) => {
    try {
      await action();
      refresh();
      if (message) toast(message);
      return true;
    } catch (err) {
      toast(err.message, { tone: 'error' });
      return false;
    }
  };

  const list = categories.filter((c) => c.type === type).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <Segmented
        value={type}
        onChange={(t) => {
          setType(t);
          setEditingId(null);
        }}
        options={[
          { value: 'expense', label: 'Expense', activeBg: 'bg-expense', activeText: 'text-bg' },
          { value: 'income', label: 'Income', activeBg: 'bg-income', activeText: 'text-bg' },
        ]}
      />
      <InlineEdit placeholder={`New ${type} category`} onSubmit={(name) => run(() => categoriesApi.create({ name, type }), `Added "${name}"`)} />

      <ul className="divide-y divide-line">
        <AnimatePresence initial={false}>
          {list.map((c) => (
            <motion.li key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="py-2">
              {editingId === c.id ? (
                <InlineEdit
                  initial={c.name}
                  submitLabel="Save"
                  autoFocus
                  onCancel={() => setEditingId(null)}
                  onSubmit={async (name) => {
                    if (await run(() => categoriesApi.update(c.id, { name, type: c.type }), 'Category renamed')) setEditingId(null);
                  }}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-2 text-lg">{categoryIcon(c.name, c.type)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.name}</span>
                    <span className="text-xs text-ink-3">
                      {c.usageCount ? `${c.usageCount} transaction${c.usageCount > 1 ? 's' : ''}` : 'Not used yet'}
                    </span>
                  </span>
                  <button onClick={() => setEditingId(c.id)} className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 hover:bg-white/5 hover:text-ink" aria-label={`Rename ${c.name}`}>
                    <Icon name="edit" size={16} />
                  </button>
                  <ConfirmButton onConfirm={() => run(() => categoriesApi.remove(c.id), `Deleted "${c.name}"`)} />
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
