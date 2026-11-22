import Icon from '../../components/ui/Icon';

/** One line instead of the whole form: "kopi 25k gopay kemarin". The fields below fill in as you type. */
export default function QuickEntry({ value, onChange }) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl border border-accent/35 bg-surface-2 px-3.5 transition-colors focus-within:border-accent">
      <Icon name="sparkle" size={18} className="shrink-0 text-accent" />
      <input
        className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type it: kopi 25k gopay kemarin"
        autoComplete="off"
        autoCapitalize="none"
        enterKeyHint="done"
        aria-label="Quick entry"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="grid h-7 w-7 place-items-center rounded-full text-ink-3 hover:text-ink" aria-label="Clear quick entry">
          <Icon name="x" size={14} />
        </button>
      )}
    </label>
  );
}
