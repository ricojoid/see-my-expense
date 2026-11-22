import { budgetsApi, transactionsApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useFetch } from '../../hooks/useFetch';
import { greeting } from '../../lib/dates';
import PageHeader from '../../components/layout/PageHeader';
import MonthSwitcher from '../../components/layout/MonthSwitcher';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import Skeleton from '../../components/ui/Skeleton';
import TrendChart, { Legend } from '../../components/charts/TrendChart';
import TransactionGroups from '../transactions/TransactionGroups';
import BudgetList from '../insights/BudgetList';
import SpendingCard from './SpendingCard';
import WeeklyRecap from './WeeklyRecap';
import BalancesCard from './BalancesCard';
import UpcomingBills from './UpcomingBills';
import GoalsCard from './GoalsCard';

export default function HomePage({ onNavigate }) {
  const { user } = useAuth();
  const { month, version, openEditor } = useData();

  const summary = useFetch(() => transactionsApi.summary(month), [month, version]);
  const recent = useFetch(() => transactionsApi.list({ month, pageSize: 6 }), [month, version]);
  const stats = useFetch(() => transactionsApi.stats(month), [month, version]);
  const budgets = useFetch(() => budgetsApi.list(month), [month, version]);

  const hasBudgets = budgets.data?.some((b) => b.budget);

  return (
    <>
      <PageHeader eyebrow={`${greeting()},`} title={user?.username} action={<MonthSwitcher className="hidden sm:flex" />} />
      <MonthSwitcher className="mb-4 w-full justify-between sm:hidden" />

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 space-y-5 lg:col-span-3">
          <SpendingCard summary={summary.data} month={month} />
          <WeeklyRecap />

          <Card
            title="Recent activity"
            delay={0.1}
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('activity')}>
                See all
              </Button>
            }
          >
            {recent.data === undefined ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : recent.data.items.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                message="Add your first income or expense for this month."
                action={
                  <Button variant="primary" icon="plus" onClick={() => openEditor()}>
                    Add transaction
                  </Button>
                }
              />
            ) : (
              <div className="-mx-2">
                <TransactionGroups items={recent.data.items} />
              </div>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-5 lg:col-span-2">
          <BalancesCard />
          <UpcomingBills onNavigate={onNavigate} />
          <Card title="Last 6 months" subtitle="Income vs expense" delay={0.15} action={<Legend />}>
            {stats.data ? <TrendChart data={stats.data.trend} /> : <Skeleton className="h-[200px]" />}
          </Card>

          <Card
            title="Budgets"
            subtitle="This month's spending limits"
            delay={0.2}
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('settings', 'budgets')}>
                {hasBudgets ? 'Edit' : 'Set up'}
              </Button>
            }
          >
            {hasBudgets ? (
              <BudgetList budgets={budgets.data} limit={4} />
            ) : (
              <p className="text-sm text-ink-3">Set a monthly limit for categories like food or shopping and see how you are doing at a glance.</p>
            )}
          </Card>

          <GoalsCard onNavigate={onNavigate} />
        </div>
      </div>
    </>
  );
}
