import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { budgetsApi, transactionsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useFetch } from '../../hooks/useFetch';
import { daysElapsed } from '../../lib/dates';
import PageHeader from '../../components/layout/PageHeader';
import MonthSwitcher from '../../components/layout/MonthSwitcher';
import Card from '../../components/ui/Card';
import Segmented from '../../components/ui/Segmented';
import Skeleton from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import CategoryBars from '../../components/charts/CategoryBars';
import TrendChart, { Legend, TrendTable } from '../../components/charts/TrendChart';
import BudgetList from './BudgetList';

function Tile({ label, value, hint, valueClass = '', delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-4"
    >
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div className={`tabular mt-1 truncate text-lg font-extrabold sm:text-xl ${valueClass}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-3">{hint}</div>}
    </motion.div>
  );
}

export default function InsightsPage({ onNavigate }) {
  const { month, version } = useData();
  const money = useMoney();
  const [breakdown, setBreakdown] = useState('expense');
  const [trendView, setTrendView] = useState('chart');
  const stats = useFetch(() => transactionsApi.stats(month), [month, version]);
  const summary = useFetch(() => transactionsApi.summary(month), [month, version]);
  const budgets = useFetch(() => budgetsApi.list(month), [month, version]);

  const rows = stats.data ? (breakdown === 'expense' ? stats.data.expenseByCategory : stats.data.incomeByCategory) : null;
  const s = summary.data;
  const days = daysElapsed(month);
  const topExpense = stats.data?.expenseByCategory[0];

  return (
    <>
      <PageHeader eyebrow="Where the money goes" title="Insights" action={<MonthSwitcher className="hidden sm:flex" />} />
      <MonthSwitcher className="mb-4 w-full justify-between sm:hidden" />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Income" value={s ? money(s.income) : '…'} valueClass="text-income" delay={0} />
        <Tile label="Outcome" value={s ? money(s.expense) : '…'} valueClass="text-expense" delay={0.05} />
        <Tile label="Avg outcome / day" value={s ? money(days ? s.expense / days : 0) : '…'} hint={`over ${days} days`} delay={0.1} />
        <Tile label="Top category" value={topExpense?.category || '–'} hint={topExpense && money(topExpense.total)} delay={0.15} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Card
          title="By category"
          subtitle="Tap a category to see its transactions"
          action={
            <Segmented
              size="sm"
              className="w-44"
              value={breakdown}
              onChange={setBreakdown}
              options={[
                { value: 'expense', label: 'Spent' },
                { value: 'income', label: 'Earned' },
              ]}
            />
          }
        >
          {rows === null ? (
            <Skeleton className="h-64" />
          ) : rows.length === 0 ? (
            <EmptyState title="No data for this month" message={`No ${breakdown === 'expense' ? 'spending' : 'income'} recorded yet.`} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={breakdown} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CategoryBars rows={rows} type={breakdown} onSelect={(row) => onNavigate('activity', row)} />
              </motion.div>
            </AnimatePresence>
          )}
        </Card>

        <div className="min-w-0 space-y-5">
          <Card
            title="6-month trend"
            subtitle={<Legend />}
            action={
              <Button
                size="sm"
                variant="ghost"
                icon={trendView === 'chart' ? 'table' : 'chart'}
                onClick={() => setTrendView((v) => (v === 'chart' ? 'table' : 'chart'))}
              >
                {trendView === 'chart' ? 'Table' : 'Chart'}
              </Button>
            }
          >
            {!stats.data ? (
              <Skeleton className="h-[200px]" />
            ) : trendView === 'chart' ? (
              <TrendChart data={stats.data.trend} />
            ) : (
              <TrendTable data={stats.data.trend} />
            )}
          </Card>

          <Card
            title="Budgets"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('settings', 'budgets')}>
                Edit
              </Button>
            }
          >
            {budgets.data?.some((b) => b.budget) ? (
              <BudgetList budgets={budgets.data} />
            ) : (
              <p className="text-sm text-ink-3">No budgets yet. Set them in Settings → Budgets.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
