import { formatCurrency } from '../currency.js';

function formatDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function TransactionList({ transactions, onDelete, filter, onFilterChange }) {
  return (
    <div className="rounded border border-term-border bg-term-panel p-4 shadow-glowSm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-term-dim">{'> ls transactions/ --sort=-date'}</div>
        <div className="flex gap-1 text-xs">
          {['all', 'income', 'expense'].map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`rounded border px-2 py-1 uppercase ${
                filter === f
                  ? 'border-term-green text-term-green'
                  : 'border-term-border text-term-dim hover:border-term-green/60'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="py-8 text-center text-sm text-term-dim">
          no records found. add your first transaction above.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-term-border text-xs text-term-dim">
                <th className="py-2 pr-3">date</th>
                <th className="py-2 pr-3">type</th>
                <th className="py-2 pr-3">category</th>
                <th className="py-2 pr-3">note</th>
                <th className="py-2 pr-3 text-right">amount</th>
                <th className="py-2 pl-3"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-term-border/50 hover:bg-term-green/5"
                >
                  <td className="py-2 pr-3 text-term-dim">{formatDate(tx.occurredOn)}</td>
                  <td className="py-2 pr-3">
                    <span
                      className={
                        tx.type === 'income' ? 'text-term-green' : 'text-term-red'
                      }
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-2 pr-3">{tx.category}</td>
                  <td className="py-2 pr-3 text-term-dim">{tx.description || '-'}</td>
                  <td
                    className={`py-2 pr-3 text-right ${
                      tx.type === 'income' ? 'text-term-green' : 'text-term-red'
                    }`}
                  >
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    <button
                      onClick={() => onDelete(tx.id)}
                      className="text-term-dim hover:text-term-red"
                      title="delete"
                    >
                      [x]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
