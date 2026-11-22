import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { transactionsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useDebounced } from '../../hooks/useDebounced';
import { accountIcon } from '../../lib/categoryIcon';
import { totalsByType } from '../../lib/totals';
import Totals from '../../components/ui/Totals';
import PageHeader from '../../components/layout/PageHeader';
import MonthSwitcher from '../../components/layout/MonthSwitcher';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';
import Skeleton from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import TransactionGroups from '../transactions/TransactionGroups';
import ImportSheet from '../transactions/ImportSheet';

const PAGE_SIZE = 25;
const TYPES = [
  { value: '', label: 'All' },
  { value: 'expense', label: 'Expenses', tone: 'expense' },
  { value: 'income', label: 'Income', tone: 'income' },
  { value: 'transfer', label: 'Transfers', tone: 'transfer' },
];

export default function ActivityPage({ initialCategory }) {
  const { month, version, accounts, openEditor } = useData();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState(initialCategory || null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const q = useDebounced(search.trim());

  const filters = { month, type, accountId, categoryId: category?.categoryId, q };
  const filterKey = JSON.stringify(filters);

  // First page whenever filters or data change.
  useEffect(() => {
    let alive = true;
    setPage(1);
    transactionsApi
      .list({ ...filters, page: 1, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => alive && toast(err.message, { tone: 'error' }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, version]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await transactionsApi.list({ ...filters, page: page + 1, pageSize: PAGE_SIZE });
      setItems((prev) => [...prev, ...res.items.filter((t) => !prev.some((p) => p.id === t.id))]);
      setPage((p) => p + 1);
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setLoadingMore(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      await transactionsApi.exportCsv({ month, type, accountId, categoryId: category?.categoryId, q });
      toast('CSV downloaded');
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const shownTotals = totalsByType(items || []);
  const filtered = Boolean(q || type || accountId || category);

  return (
    <>
      <PageHeader
        eyebrow="Every rupiah, in one place"
        title="Activity"
        action={
          <div className="flex gap-2">
            <Button size="icon" variant="secondary" icon="upload" onClick={() => setImportOpen(true)} aria-label="Import CSV" title="Import CSV" />
            <Button size="icon" variant="secondary" icon="download" loading={exporting} onClick={exportCsv} aria-label="Export CSV" title="Export CSV" />
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <MonthSwitcher className="justify-between sm:justify-start" />
        <label className="relative flex-1">
          <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            className="field h-11 !rounded-2xl pl-11"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, categories, accounts"
            enterKeyHint="search"
          />
        </label>
      </div>

      <div className="-mx-4 mb-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <Chip key={t.value} tone={t.tone} selected={type === t.value} onClick={() => setType(t.value)}>
              {t.label}
            </Chip>
          ))}
          {accounts.length > 1 && <span className="mx-1 w-px shrink-0 bg-line" />}
          {accounts.length > 1 &&
            accounts.map((a) => (
              <Chip key={a.id} icon={accountIcon(a.name)} selected={accountId === a.id} onClick={() => setAccountId(accountId === a.id ? '' : a.id)}>
                {a.name}
              </Chip>
            ))}
          {category && (
            <Chip selected onClick={() => setCategory(null)}>
              {category.category} <Icon name="x" size={14} />
            </Chip>
          )}
        </div>
      </div>

      <Card padded={false} className="p-3 sm:p-4">
        {items === null ? (
          <div className="space-y-3 p-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={filtered ? 'No matches' : 'No transactions this month'}
            message={filtered ? 'Try a different search or filter.' : 'Tap the + button to add one.'}
            action={
              !filtered && (
                <Button variant="primary" icon="plus" onClick={() => openEditor()}>
                  Add transaction
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-2 pb-3 text-xs text-ink-3">
              <span>
                {total} transaction{total === 1 ? '' : 's'}
              </span>
              {filtered && items.length === total && (
                <Totals {...shownTotals} />
              )}
            </div>
            <TransactionGroups items={items} />
            {items.length < total && (
              <motion.div layout className="pt-3 text-center">
                <Button variant="ghost" loading={loadingMore} onClick={loadMore}>
                  Load more ({total - items.length} left)
                </Button>
              </motion.div>
            )}
          </>
        )}
      </Card>

      <ImportSheet open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
