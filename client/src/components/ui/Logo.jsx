import { useId } from 'react';

/** Brand mark: a coin stamped with an "S", with a little sparkle. Same art as public/favicon.svg. */
export default function Logo({ size = 36, className = '' }) {
  const gradient = `${useId()}g`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d9ff4a" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill={`url(#${gradient})`} />
      <circle cx="256" cy="262" r="152" fill="#0b0d12" />
      <path
        d="M300 208c-11-15-28-24-48-24-28 0-48 15-48 37 0 50 100 26 100 76 0 22-22 37-52 37-22 0-39-9-52-24"
        fill="none"
        stroke={`url(#${gradient})`}
        strokeWidth="36"
        strokeLinecap="round"
      />
      <path d="M402 84l11 27 27 11-27 11-11 27-11-27-27-11 27-11z" fill="#0b0d12" />
    </svg>
  );
}

export function Wordmark({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={34} />
      <div className="leading-none">
        <div className="text-[15px] font-extrabold tracking-tight">
          See My <span className="text-gradient">EX</span>-pense
        </div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-3">money, clearly</div>
      </div>
    </div>
  );
}
