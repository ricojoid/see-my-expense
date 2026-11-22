import { useRef } from 'react';
import { daysAgo, formatDay, today } from '../../lib/dates';
import Chip from '../../components/ui/Chip';
import Icon from '../../components/ui/Icon';

/** Opens the browser's native calendar, falling back to focus/click on older browsers. */
function openNativePicker(input) {
  if (!input) return;
  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch {
    // showPicker throws if not allowed (e.g. cross-origin iframe): fall through.
  }
  input.focus();
  input.click();
}

/** Today / Yesterday chips, plus a chip that opens the native date picker. */
export default function DatePicker({ value, onChange }) {
  const inputRef = useRef(null);
  const t = today();
  const y = daysAgo(1);
  const custom = value !== t && value !== y;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip selected={value === t} onClick={() => onChange(t)}>
        Today
      </Chip>
      <Chip selected={value === y} onClick={() => onChange(y)}>
        Yesterday
      </Chip>
      <div className="relative">
        <Chip selected={custom} onClick={() => openNativePicker(inputRef.current)}>
          <Icon name="calendar" size={16} />
          {custom ? formatDay(value) : 'Pick date'}
        </Chip>
        {/* Visually hidden but rendered, so showPicker() can anchor the calendar under the chip. */}
        <input
          ref={inputRef}
          type="date"
          value={value}
          max={t}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
        />
      </div>
    </div>
  );
}
