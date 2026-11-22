import { useId } from 'react';
import { motion } from 'framer-motion';

/** Segmented control with a sliding highlight. options: [{ value, label, className? }] */
export default function Segmented({ options, value, onChange, className = '', size = 'md' }) {
  const id = useId();
  const height = size === 'sm' ? 'h-9 text-xs' : 'h-11 text-sm';
  return (
    <div className={`flex rounded-2xl border border-line bg-surface-2 p-1 ${className}`} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`relative flex-1 rounded-xl px-3 font-semibold transition-colors ${height} ${
              active ? opt.activeText || 'text-accent-ink' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className={`absolute inset-0 rounded-xl ${opt.activeBg || 'bg-accent'}`}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center justify-center gap-1.5">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
