import { useState } from 'react';
import { transactionsApi } from '../../api';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import Sheet from '../../components/ui/Sheet';
import Button from '../../components/ui/Button';
import Icon from '../../components/ui/Icon';

const SAMPLE = `date,type,category,amount,description,account
2026-11-01,income,Salary,8.500.000,November salary,Bank
2026-11-02,expense,Food & Drinks,35.000,Lunch,Cash
2026-11-03,transfer,,500.000,Top up,Bank`;

export default function ImportSheet({ open, onClose }) {
  const { refresh } = useData();
  const toast = useToast();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText('');
    setFileName('');
    setErrors([]);
    setMessage('');
  };

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) return setMessage('That file is over 1.5 MB. Split it into smaller files.');
    setFileName(file.name);
    setText(await file.text());
    setErrors([]);
    setMessage('');
  };

  const submit = async () => {
    setBusy(true);
    setErrors([]);
    setMessage('');
    try {
      const result = await transactionsApi.import(text);
      const extras = [
        result.createdCategories && `${result.createdCategories} new categor${result.createdCategories > 1 ? 'ies' : 'y'}`,
        result.createdAccounts && `${result.createdAccounts} new account${result.createdAccounts > 1 ? 's' : ''}`,
      ].filter(Boolean);
      toast(`Imported ${result.imported} transactions${extras.length ? ` (+ ${extras.join(', ')})` : ''}`);
      refresh();
      reset();
      onClose();
    } catch (err) {
      setMessage(err.message);
      setErrors(err.details || []);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Import from CSV"
      footer={
        <Button variant="primary" size="lg" className="w-full" icon="upload" loading={busy} disabled={!text.trim()} onClick={submit}>
          Import
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          Columns: <code className="text-ink">date, type, category, amount</code>, plus optional{' '}
          <code className="text-ink">description, account, to_account</code>. Excel files saved as CSV work, including
          Indonesian formats like <code className="text-ink">25.000</code> and <code className="text-ink">31/12/2026</code>.
          Missing categories and accounts are created for you. If any row has a problem, nothing is imported.
        </p>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-line bg-surface-2/50 px-4 py-8 text-center transition-colors hover:border-accent/50">
          <Icon name="upload" size={28} className="text-accent" />
          <span className="font-semibold">{fileName || 'Choose a .csv file'}</span>
          <span className="text-xs text-ink-3">or paste the CSV text below</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => readFile(e.target.files?.[0])} />
        </label>

        <textarea
          className="field h-36 resize-none font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={SAMPLE}
          spellCheck={false}
        />

        {message && (
          <div className="rounded-2xl bg-expense-soft p-3 text-sm text-expense" role="alert">
            <div className="font-semibold">{message}</div>
            {errors.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-0.5 overflow-y-auto text-xs">
                {errors.map((e) => (
                  <li key={`${e.line}-${e.error}`}>
                    Line {e.line}: {e.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
