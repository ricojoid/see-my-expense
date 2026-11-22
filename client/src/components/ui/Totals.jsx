import { useMoney } from '../../context/PrivacyContext';

/** "−Rp 50.000 · +Rp 20.000": spending and income side by side, zeros left out. */
export default function Totals({ expense, income, className = '' }) {
  const money = useMoney();
  return (
    <span className={`tabular inline-flex gap-2 ${className}`}>
      {expense > 0 && <span className="text-expense">−{money(expense)}</span>}
      {income > 0 && <span className="text-income">+{money(income)}</span>}
    </span>
  );
}
