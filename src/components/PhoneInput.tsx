import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLang, tx } from '../i18n';
import {
  DIAL_COUNTRIES,
  composePhone,
  formatNational,
  maxDigitsFor,
  onlyDigits,
  parsePhone,
} from '../utils/phone';

/**
 * Phone field: calling-code dropdown (+66 by default) + digits-only number that is
 * formatted while typing (Thai: 081-234-5678 / 02-123-4567, others: 123 456 7890).
 * `value` / `onChange` use the stored form "+66 81-234-5678" (see utils/phone.ts).
 */
interface Props {
  id: string;
  value: string | null | undefined;
  onChange: (next: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaDescribedBy?: string;
}

export const PhoneInput: React.FC<Props> = ({
  id,
  value,
  onChange,
  required,
  disabled,
  placeholder,
  ariaDescribedBy,
}) => {
  const lang = getLang();
  const parsed = parsePhone(value);
  const [iso, setIso] = useState(parsed.iso);
  const [text, setText] = useState(formatNational(parsed.iso, parsed.national));
  // what we last sent up; a different incoming value means it was changed from outside
  const lastEmitted = useRef<string | null | undefined>(value);

  useEffect(() => {
    if ((value ?? '') === (lastEmitted.current ?? '')) return;
    const p = parsePhone(value);
    setIso(p.iso);
    setText(formatNational(p.iso, p.national));
    lastEmitted.current = value;
  }, [value]);

  const names = useMemo(() => {
    let dn: Intl.DisplayNames | null = null;
    try {
      dn = new Intl.DisplayNames([lang === 'en' ? 'en' : 'th'], { type: 'region' });
    } catch {
      dn = null;
    }
    return (code: string) => dn?.of(code) ?? code;
  }, [lang]);

  const emit = (nextIso: string, digits: string) => {
    const next = composePhone(nextIso, digits);
    lastEmitted.current = next;
    onChange(next);
  };

  const onType = (raw: string) => {
    const digits = onlyDigits(raw).slice(0, maxDigitsFor(iso));
    setText(formatNational(iso, digits));
    emit(iso, digits);
  };

  const onCountry = (nextIso: string) => {
    const digits = onlyDigits(text).slice(0, maxDigitsFor(nextIso));
    setIso(nextIso);
    setText(formatNational(nextIso, digits));
    emit(nextIso, digits);
  };

  return (
    <div className="phone-input">
      <select
        className="phone-input-code"
        aria-label={tx('รหัสประเทศของเบอร์โทร')}
        value={iso}
        disabled={disabled}
        onChange={(e) => onCountry(e.target.value)}
      >
        {DIAL_COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {`${c.dial} ${names(c.iso)}`}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={text}
        required={required}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder ?? (iso === 'TH' ? '081-234-5678' : '123 456 7890')}
        onChange={(e) => onType(e.target.value)}
      />
    </div>
  );
};
