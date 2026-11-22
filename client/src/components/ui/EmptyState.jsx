import { motion } from 'framer-motion';

/** Floating wallet + coins illustration. */
function Illustration() {
  return (
    <svg viewBox="0 0 160 120" className="h-28 w-36" aria-hidden="true">
      <defs>
        <linearGradient id="es-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c6f432" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="110" rx="44" ry="6" fill="rgba(255,255,255,0.05)" />
      <g className="animate-[drift_6s_ease-in-out_infinite]">
        <rect x="34" y="40" width="92" height="60" rx="14" fill="#1a1d26" stroke="rgba(255,255,255,0.1)" />
        <rect x="34" y="40" width="92" height="18" rx="9" fill="#232734" />
        <rect x="96" y="62" width="30" height="20" rx="8" fill="url(#es-g)" opacity="0.9" />
        <circle cx="106" cy="72" r="3" fill="#07080c" />
      </g>
      <g className="animate-[drift_5s_ease-in-out_infinite_reverse]">
        <circle cx="52" cy="24" r="11" fill="url(#es-g)" />
        <text x="52" y="28" textAnchor="middle" fontSize="11" fontWeight="800" fill="#07080c">Rp</text>
      </g>
      <circle cx="122" cy="20" r="5" fill="#22d3ee" opacity="0.7" />
      <circle cx="136" cy="36" r="3" fill="#c6f432" opacity="0.6" />
    </svg>
  );
}

export default function EmptyState({ title, message, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center px-6 py-10 text-center"
    >
      <Illustration />
      <div className="mt-4 font-bold">{title}</div>
      {message && <p className="mt-1 max-w-xs text-sm text-ink-3">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}
