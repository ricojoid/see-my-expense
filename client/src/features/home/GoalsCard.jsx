import { goalsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useMoney } from '../../context/PrivacyContext';
import { useFetch } from '../../hooks/useFetch';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { GoalProgress, useGoalHint } from '../goals/GoalsPage';

/** The first few savings goals on Home (and the way to the Goals page on phones). */
export default function GoalsCard({ onNavigate }) {
  const { version } = useData();
  const money = useMoney();
  const hint = useGoalHint();
  const goals = useFetch(() => goalsApi.list(), [version]);
  const list = goals.data || [];

  return (
    <Card
      title="Goals"
      subtitle={list.length ? 'Savings in progress' : 'Saving up for something?'}
      delay={0.22}
      action={
        <Button size="sm" variant="ghost" onClick={() => onNavigate('goals')}>
          {list.length ? 'See all' : 'Set one'}
        </Button>
      }
    >
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">Set a target, like a laptop or a trip, and see how much to put aside each month.</p>
      ) : (
        <ul className="space-y-4">
          {list.slice(0, 3).map((g) => (
            <li key={g.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-semibold">{g.name}</span>
                <span className="tabular shrink-0 text-xs text-ink-3">
                  {money(g.saved)} / {money(g.target)}
                </span>
              </div>
              <GoalProgress goal={g} className="mt-2 h-2" />
              <div className="mt-1 truncate text-xs text-ink-3">{hint(g)}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
