import { useEffect, useState, useCallback } from 'react';
import Header from './components/Header.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import TransactionForm from './components/TransactionForm.jsx';
import TransactionList from './components/TransactionList.jsx';
import CategoryManager from './components/CategoryManager.jsx';
import LoginPage from './components/LoginPage.jsx';
import MatrixRain from './components/MatrixRain.jsx';
import {
  fetchTransactions,
  fetchSummary,
  fetchCategories,
  createTransaction,
  deleteTransaction,
  getToken,
  clearToken,
} from './api.js';

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getToken()));
  const [view, setView] = useState('dashboard');

  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAuthFailure = useCallback(() => {
    clearToken();
    setAuthed(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [txs, sum, cats] = await Promise.all([
        fetchTransactions(filter === 'all' ? {} : { type: filter }),
        fetchSummary(),
        fetchCategories(),
      ]);
      setTransactions(txs);
      setSummary(sum);
      setCategories(cats);
    } catch (err) {
      if (err.name === 'AuthError' || /session expired/i.test(err.message)) {
        handleAuthFailure();
        return;
      }
      setError(err.message || 'connection to backend failed');
    } finally {
      setLoading(false);
    }
  }, [filter, handleAuthFailure]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const handleCreate = async (payload) => {
    setSubmitting(true);
    try {
      await createTransaction(payload);
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteTransaction(id);
    await load();
  };

  const handleLogout = () => {
    clearToken();
    setAuthed(false);
  };

  if (!authed) {
    return (
      <div className="relative min-h-screen">
        <MatrixRain />
        <LoginPage onSuccess={() => setAuthed(true)} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <MatrixRain />
      <div className="relative z-10">
        <Header view={view} onNavigate={setView} onLogout={handleLogout} />
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
          {error && (
            <div className="rounded border border-term-red bg-term-red/10 px-3 py-2 text-sm text-term-red">
              {`!! ${error} -- is the server running on :4000?`}
            </div>
          )}

          {view === 'dashboard' ? (
            <>
              <SummaryCards summary={summary} loading={loading} />

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
                <TransactionForm
                  categories={categories}
                  onSubmit={handleCreate}
                  submitting={submitting}
                />
                <TransactionList
                  transactions={transactions}
                  onDelete={handleDelete}
                  filter={filter}
                  onFilterChange={setFilter}
                />
              </div>
            </>
          ) : (
            <CategoryManager />
          )}

          <footer className="pt-4 text-center text-xs text-term-dim">
            See My EX-pense v1.0.0 :: connected to SQL Server (Windows Auth)
          </footer>
        </main>
      </div>
    </div>
  );
}
