import { useState } from 'react';
import Button from './Button';

/** A one-field form: text input + save, used for add / rename rows. */
export default function InlineEdit({ initial = '', placeholder, submitLabel = 'Add', onSubmit, onCancel, autoFocus, maxLength = 50 }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onSubmit(value.trim());
      if (!initial) setValue('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        className="field h-11 py-0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
      />
      <Button type="submit" variant="primary" loading={busy} disabled={!value.trim()}>
        {submitLabel}
      </Button>
      {onCancel && (
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </form>
  );
}
