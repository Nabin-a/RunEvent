import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
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
 * Phone field: calling-code picker (+66 by default) + digits-only number that is
 * formatted while typing in the chosen country's own pattern (see utils/phone.ts).
 * `value` / `onChange` use the stored form "+66 81-234-5678" (see utils/phone.ts).
 *
 * The picker shows a flag and the country's short code (TH +66) instead of its full name
 * (user request 24 Nov 2026). A native <select> cannot draw flags in its list, so it is a
 * button + listbox: arrow keys, Home/End, a letter jumps to that code, Enter picks, Esc closes.
 * Flags are emoji drawn with the "Noto Color Emoji" subset loaded in index.html (Windows has
 * no flag glyphs of its own); the screen-reader name is the full country name.
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

/** 'TH' -> 🇹🇭 (two regional-indicator letters) */
export const flagOf = (iso: string) =>
  String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));

function DialPicker({
  iso,
  names,
  disabled,
  onPick,
}: {
  iso: string;
  names: (code: string) => string;
  disabled?: boolean;
  onPick: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const listId = useId();
  const cur = countryOf(iso);
  const count = DIAL_COUNTRIES.length;

  const openList = () => {
    setActive(Math.max(0, DIAL_COUNTRIES.findIndex((c) => c.iso === iso)));
    setOpen(true);
  };
  const closeList = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };
  const choose = (i: number) => {
    onPick(DIAL_COUNTRIES[i].iso);
    closeList(true);
  };

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // a click anywhere else closes the list
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const onListKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => Math.min(a + 1, count - 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        return;
      case 'Home':
        e.preventDefault();
        setActive(0);
        return;
      case 'End':
        e.preventDefault();
        setActive(count - 1);
        return;
      case 'Enter':
      case ' ':
        e.preventDefault();
        choose(active);
        return;
      case 'Escape':
        e.preventDefault();
        closeList(true);
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        if (/^[a-z]$/i.test(e.key)) {
          const k = e.key.toUpperCase();
          const next = DIAL_COUNTRIES.findIndex((c, j) => j > active && c.iso.startsWith(k));
          const first = DIAL_COUNTRIES.findIndex((c) => c.iso.startsWith(k));
          if (next >= 0 || first >= 0) setActive(next >= 0 ? next : first);
        }
    }
  };

  return (
    <span className="phone-input-code-wrap" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className="phone-input-code"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${tx('รหัสประเทศของเบอร์โทร')}: ${names(cur.iso)} ${cur.dial}`}
        title={`${names(cur.iso)} ${cur.dial}`}
        disabled={disabled}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
      >
        <span className="phone-flag" aria-hidden="true">
          {flagOf(cur.iso)}
        </span>
        <span className="phone-code-iso">{cur.iso}</span>
        <span className="mono-num">{cur.dial}</span>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="phone-code-list"
          aria-label={tx('รหัสประเทศของเบอร์โทร')}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
        >
          {DIAL_COUNTRIES.map((c, i) => (
            <li
              key={c.iso}
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={c.iso === iso}
              aria-label={`${names(c.iso)} ${c.dial}`}
              title={names(c.iso)}
              className={`${i === active ? 'is-active' : ''} ${c.iso === iso ? 'is-picked' : ''}`}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span className="phone-flag" aria-hidden="true">
                {flagOf(c.iso)}
              </span>
              <span className="phone-code-iso">{c.iso}</span>
              <span className="phone-code-dial mono-num">{c.dial}</span>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
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
      <DialPicker iso={iso} names={names} disabled={disabled} onPick={onCountry} />
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
