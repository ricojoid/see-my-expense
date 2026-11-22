import { motion } from 'framer-motion';

/**
 * Segmented control with a sliding highlight. options: [{ value, label, activeBg?, activeText? }]
 *
 * The highlight is one element that moves, not a shared layoutId: a layoutId
 * swap inside the page transition (AnimatePresence mode="wait") kept the
 * page's exit from finishing, so the next page never appeared.
 */
export default function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  const height = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-sm';
  const index = Math.max(0, options.findIndex((opt) => opt.value === value));
  const active = options[index];

  return (
    <div className={`relative flex rounded-2xl border border-line bg-surface-2 p-1 ${className}`} role="tablist">
      <motion.span
        aria-hidden="true"
        className={`absolute bottom-1 left-1 top-1 rounded-xl ${active?.activeBg || 'bg-accent'}`}
        style={{ width: `calc((100% - 0.5rem) / ${options.length})` }}
        initial={false}
        animate={{ x: `${index * 100}%` }}
        transition={{ type: 'spring', stiffness: 500, damping: 38 }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 flex-1 basis-0 rounded-xl px-3 font-semibold transition-colors ${height} ${
              isActive ? opt.activeText || 'text-accent-ink' : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
