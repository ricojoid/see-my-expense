import { AnimatePresence } from 'framer-motion';
import { formatDay } from '../../lib/dates';
import { totalsByType } from '../../lib/totals';
import Totals from '../../components/ui/Totals';
import TransactionRow from './TransactionRow';

/** Transactions grouped by day, each day headed by what was spent and earned. */
export default function TransactionGroups({ items }) {
  const groups = [];
  for (const tx of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === tx.occurredOn) last.items.push(tx);
    else groups.push({ date: tx.occurredOn, items: [tx] });
  }

  let index = 0;
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const totals = totalsByType(group.items);
        return (
          <section key={group.date}>
            <div className="flex items-center justify-between px-2 pb-1 text-xs font-semibold text-ink-3">
              <span>{formatDay(group.date)}</span>
              <Totals {...totals} />
            </div>
            <ul>
              <AnimatePresence initial={false}>
                {group.items.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} index={index++} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
