import { formatCurrency } from '../currency.js';

function Card({ label, value, colorClass, prefix }) {
  return (
    <div className="flex-1 rounded border border-term-border bg-term-panel p-4 shadow-glowSm">
      <div className="text-xs text-term-dim">{`> ${label}`}</div>
      <div className={`mt-2 text-xl sm:text-2xl font-semibold ${colorClass}`}>
        {prefix}
        {formatCurrency(Math.abs(value))}
      </div>
    </div>
  );
}

export default function SummaryCards({ summary, loading }) {
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;
  const balance = summary?.balance ?? 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <Card label="income" value={income} prefix="+" colorClass="text-term-green" />
      <Card label="expense" value={expense} prefix="-" colorClass="text-term-red" />
      <Card
        label="balance"
        value={balance}
        prefix={balance < 0 ? '-' : ''}
        colorClass={balance < 0 ? 'text-term-red' : 'text-term-amber'}
      />
      {loading && (
        <div className="col-span-full text-xs text-term-dim animate-pulse">
          syncing with DESKTOP-8IN7U4N\SQLEXPRESS ...
        </div>
      )}
    </div>
  );
}
