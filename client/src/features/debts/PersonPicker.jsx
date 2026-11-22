import { useEffect, useRef } from 'react';
import Chip from '../../components/ui/Chip';
import Icon from '../../components/ui/Icon';
import { useMoney } from '../../context/PrivacyContext';
import { TONE_CLASS, describeBalance } from './debtText';

/**
 * Pick someone you already have a debt with, or type a new name.
 * `value` is { personId, personName }: one of them is set (personName '' when picking).
 */
export default function PersonPicker({ people, value, onChange, tone }) {
  const money = useMoney();
  const adding = value.personId == null;
  const inputRef = useRef(null);
  const selected = people.find((p) => p.id === value.personId);

  // Open debts first, then the most recent.
  const sorted = [...people].sort((a, b) => Number(b.balance !== 0) - Number(a.balance !== 0));

  useEffect(() => {
    if (adding && people.length > 0) inputRef.current?.focus();
  }, [adding, people.length]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {sorted.map((p) => (
          <Chip key={p.id} tone={tone} selected={value.personId === p.id} onClick={() => onChange({ personId: p.id, personName: '' })}>
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[11px] font-bold">{p.name[0]?.toUpperCase()}</span>
            {p.name}
          </Chip>
        ))}
        <Chip tone={tone} selected={adding} onClick={() => onChange({ personId: null, personName: value.personName })}>
          <Icon name="plus" size={15} />
          New person
        </Chip>
      </div>

      {adding ? (
        <input
          ref={inputRef}
          className="field"
          value={value.personName}
          onChange={(e) => onChange({ personId: null, personName: e.target.value })}
          placeholder="Their name, e.g. Budi"
          maxLength={50}
          enterKeyHint="done"
        />
      ) : (
        selected && <p className={`text-sm font-medium ${TONE_CLASS[describeBalance(selected).tone]}`}>{describeBalance(selected, money).text}</p>
      )}
    </div>
  );
}
