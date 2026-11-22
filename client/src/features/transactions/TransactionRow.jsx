import { motion } from 'framer-motion';
import { useData } from '../../context/DataContext';
import { categoryIcon } from '../../lib/categoryIcon';
import { signFor } from '../../lib/format';
import Icon from '../../components/ui/Icon';
import { debtVerb } from '../debts/debtText';
import { useMoney } from '../../context/PrivacyContext';

const TONE = {
  income: { amount: 'text-income', badge: 'bg-income-soft' },
  expense: { amount: 'text-ink', badge: 'bg-expense-soft' },
  transfer: { amount: 'text-ink-2', badge: 'bg-transfer-soft' },
};

export default function TransactionRow({ tx, index = 0 }) {
  const money = useMoney();
  const { openEditor } = useData();
  const tone = TONE[tx.type];
  const title = tx.type === 'transfer' ? 'Transfer' : tx.personId ? debtVerb(tx.type, tx.person) : tx.category;
  const subtitle =
    tx.type === 'transfer' ? `${tx.account} → ${tx.toAccount}` : [tx.description, tx.account].filter(Boolean).join(' · ');

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, delay: Math.min(index, 10) * 0.025 }}
    >
      <button
        onClick={() => openEditor(tx)}
        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04] active:bg-white/[0.06]"
      >
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-xl ${tone.badge}`}>
          {categoryIcon(tx.category, tx.type)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{title}</span>
            {tx.recurringId && <Icon name="repeat" size={13} className="text-ink-3" />}
          </span>
          <span className="block truncate text-xs text-ink-3">{subtitle || ' '}</span>
        </span>
        <span className={`tabular shrink-0 text-right font-bold ${tone.amount}`}>
          {signFor(tx.type)}
          {money(tx.amount)}
        </span>
      </button>
    </motion.li>
  );
}
