import { useLayoutEffect, useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { formatThaiId, sanitizeThaiIdOrPassport } from '../utils/dateFormat';

type IdType = 'none' | 'thai_id' | 'passport';

/**
 * ID number field. For a Thai citizen ID it shows X-XXXX-XXXXX-XX-X while the
 * person types, but `value` / `onValueChange` always carry the bare 13 digits,
 * so saving, validation (length 13) and masking stay unchanged.
 *
 * The caret stays next to the same digit after the hyphens are re-inserted, and
 * Backspace / Delete step over a hyphen instead of getting stuck on it.
 */
export function IdNumberInput({
  idType,
  value,
  onValueChange,
  ...rest
}: {
  idType: IdType;
  /** bare value: digits only for thai_id */
  value: string;
  onValueChange: (next: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>) {
  const ref = useRef<HTMLInputElement>(null);
  // digits that should sit left of the caret after the next render
  const pendingCaret = useRef<number | null>(null);
  const isThai = idType === 'thai_id';
  const shown = isThai ? formatThaiId(value) : value;

  useLayoutEffect(() => {
    const el = ref.current;
    const want = pendingCaret.current;
    pendingCaret.current = null;
    if (!el || want === null || document.activeElement !== el) return;
    let pos = 0;
    let seen = 0;
    while (pos < shown.length && seen < want) {
      if (/\d/.test(shown[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    rest.onKeyDown?.(e);
    if (!isThai || e.defaultPrevented) return;
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    if (start !== el.selectionEnd) return;
    // move past the hyphen so the browser deletes the digit next to it
    if (e.key === 'Backspace' && start > 0 && el.value[start - 1] === '-') {
      el.setSelectionRange(start - 1, start - 1);
    } else if (e.key === 'Delete' && el.value[start] === '-') {
      el.setSelectionRange(start + 1, start + 1);
    }
  };

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode={isThai ? 'numeric' : rest.inputMode ?? 'text'}
      autoComplete="off"
      maxLength={isThai ? 17 : 20}
      value={shown}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const el = e.target;
        if (isThai) {
          const caret = el.selectionStart ?? el.value.length;
          pendingCaret.current = el.value.slice(0, caret).replace(/\D/g, '').length;
        }
        onValueChange(sanitizeThaiIdOrPassport(el.value, idType === 'none' ? 'thai_id' : idType));
      }}
    />
  );
}
