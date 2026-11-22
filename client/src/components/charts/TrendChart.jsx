import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatMonth, formatMonthShort } from '../../lib/dates';
import { useCompactMoney, useMoney } from '../../context/PrivacyContext';

const SERIES = [
  { key: 'income', label: 'Income', color: '#3987e5' },
  { key: 'expense', label: 'Expense', color: '#d95926' },
];
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 28, left: 52 };
const BAR_GAP = 2;

/** Rounds up to a "nice" axis maximum (1, 2, 2.5, 5 x 10^n). */
function niceMax(value) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value);
  return step * exp;
}

/** Path for a bar with 4px rounded top corners and a square base on the baseline. */
function barPath(x, y, w, h) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-ink-2">
      {SERIES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export default function TrendChart({ data }) {
  const money = useMoney();
  const compact = useCompactMoney();
  const [ref, width] = useElementWidth();
  const [hover, setHover] = useState(null);

  const max = niceMax(Math.max(...data.flatMap((d) => [d.income, d.expense]), 0));
  const plotW = Math.max(width - PAD.left - PAD.right, 10);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(18, (band * 0.6 - BAR_GAP) / 2);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];

  const active = hover != null ? data[hover] : null;
  const tooltipLeft = hover != null ? Math.min(Math.max(PAD.left + band * hover + band / 2, 80), width - 80) : 0;

  return (
    <div ref={ref} className="relative select-none">
      <svg width={width} height={HEIGHT} role="img" aria-label="Income and expense over the last six months">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#383835' : '#2c2c2a'} strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tabular fill-ink-3 text-[11px]">
              {compact(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = PAD.left + band * i + band / 2;
          const dimmed = hover != null && hover !== i;
          return (
            <g key={d.month} opacity={dimmed ? 0.4 : 1} style={{ transition: 'opacity 150ms' }}>
              {SERIES.map((s, j) => {
                const x = cx - barW - BAR_GAP / 2 + j * (barW + BAR_GAP);
                const h = y(0) - y(d[s.key]);
                return (
                  <motion.path
                    key={s.key}
                    d={barPath(x, y(d[s.key]), barW, h)}
                    fill={s.color}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.6, delay: i * 0.05 + j * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    style={{ originY: 1, transformBox: 'fill-box' }}
                  />
                );
              })}
              <text x={cx} y={HEIGHT - 8} textAnchor="middle" className={`text-[11px] ${hover === i ? 'fill-ink' : 'fill-ink-3'}`}>
                {formatMonthShort(d.month)}
              </text>
              {/* Hit target: the whole column, bigger than the bars. */}
              <rect
                x={PAD.left + band * i}
                y={PAD.top}
                width={band}
                height={plotH + PAD.bottom}
                fill="transparent"
                tabIndex={0}
                aria-label={`${formatMonth(d.month)}: income ${money(d.income)}, expense ${money(d.expense)}`}
                onPointerEnter={() => setHover(i)}
                onPointerDown={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="cursor-pointer outline-none"
              />
            </g>
          );
        })}
      </svg>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-xl border border-line bg-surface-3/95 p-3 text-xs shadow-xl backdrop-blur"
            style={{ left: tooltipLeft }}
          >
            <div className="mb-1.5 font-bold text-ink">{formatMonth(active.month)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-2 text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular font-semibold text-ink">{money(active[s.key])}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TrendTable({ data }) {
  const money = useMoney();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-ink-3">
          <th className="py-2 font-semibold">Month</th>
          <th className="py-2 text-right font-semibold">Income</th>
          <th className="py-2 text-right font-semibold">Expense</th>
        </tr>
      </thead>
      <tbody className="tabular">
        {data.map((d) => (
          <tr key={d.month} className="border-t border-line">
            <td className="py-2">{formatMonth(d.month, 'short')}</td>
            <td className="py-2 text-right">{money(d.income)}</td>
            <td className="py-2 text-right">{money(d.expense)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
