import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLang, tx } from '../i18n';
import {
  DIAL_COUNTRIES,
  clampDigits,
  composePhone,
  countryOf,
  formatNational,
  onlyDigits,
  parsePhone,
  phoneExample,
} from '../utils/phone';

/**
 * Phone field: calling-code dropdown (+66 by default) + digits-only number that is
 * formatted while typing in the chosen country's own pattern (see utils/phone.ts).
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
    const digits = clampDigits(iso, onlyDigits(raw));
    setText(formatNational(iso, digits));
    emit(iso, digits);
  };

  const onCountry = (nextIso: string) => {
    const digits = clampDigits(nextIso, onlyDigits(text));
    setIso(nextIso);
    setText(formatNational(nextIso, digits));
    emit(nextIso, digits);
  };

  return (
    <div className="phone-input">
      {/* closed: just "+66"; the list still names each country. The select keeps
          its own box, arrow, focus ring and keyboard use; only its text is hidden
          and the dial code is drawn on top of it. */}
      <span className="phone-input-code-wrap">
        <select
          className="phone-input-code"
          aria-label={tx('รหัสประเทศของเบอร์โทร')}
          title={`${countryOf(iso).dial} ${names(iso)}`}
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
        <span className="phone-input-code-face mono-num" aria-hidden="true">
          {countryOf(iso).dial}
        </span>
      </span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        value={text}
        required={required}
        disabled={disabled}
        aria-describedby={ariaDescribedBy}
        placeholder={placeholder ?? phoneExample(iso)}
        onChange={(e) => onType(e.target.value)}
      />
    </div>
  );
};
