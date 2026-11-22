/** A full-width row with a title, a hint and an on/off switch. */
export default function ToggleRow({ title, hint, icon, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-line bg-surface-2/60 px-4 py-3">
      <span className="flex min-w-0 items-center gap-3">
        {icon && <span className="text-xl leading-none">{icon}</span>}
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{title}</span>
          {hint && <span className="block text-xs text-ink-3">{hint}</span>}
        </span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-surface-3 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/70" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-ink shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-accent-ink" />
      </span>
    </label>
  );
}
