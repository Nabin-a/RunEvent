import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLang, tx } from '../i18n';
import { WheelColumn, WheelSheet, useDraft, type WheelItem } from './WheelPicker';

interface DateOfBirthInputProps {
  /** id of the day trigger so an outer <label htmlFor> still points at the field. */
  id: string;
  /** Stored value: ISO yyyy-mm-dd in the Gregorian calendar (ค.ศ.), or '' when not set. */
  valueIso: string;
  onChangeIso: (nextIso: string) => void;
  required?: boolean;
  /** id of a hint element read with the triggers (for example the computed age). */
  ariaDescribedBy?: string;
}

const BE_OFFSET = 543;
const MAX_AGE_YEARS = 100;
const DEFAULT_AGE = 25;

const pad2 = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

type Parts = { d: number | null; m: number | null; y: number | null };
const EMPTY: Parts = { d: null, m: null, y: null };

const parseIso = (iso: string): Parts | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
};

const currentYearBangkok = (): number =>
  Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric' }).format(
      new Date()
    )
  );

const isPhone = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 40rem)').matches;

/**
 * One select-style field you can type into or pick from a wheel.
 * - typing: the value follows what you type once it is valid (the wheel follows too)
 * - click / ↓ / Alt+↓ opens the wheel; ↑ / ↓ step the value while the wheel is open
 * - a tap on a wheel row picks it and closes; Enter or a tap outside closes;
 *   Escape puts back the value the field had when the wheel opened.
 * No Cancel / Done buttons.
 */
const PartPicker: React.FC<{
  id: string;
  name: string;
  placeholder: string;
  display: string;
  items: WheelItem[];
  selected: number | null;
  /** index the wheel starts on when nothing is chosen yet */
  fallbackIndex: number;
  onPick: (index: number | null) => void;
  /** typed text to an item index; null = cleared, undefined = not a value (yet) */
  parse: (text: string) => number | null | undefined;
  /** typed text that is already complete, so focus can move to the next field */
  isComplete?: (text: string) => boolean;
  nextId?: string;
  inputMode: 'numeric' | 'text';
  maxLength: number;
  header?: React.ReactNode;
  describedBy?: string;
  alignEnd?: boolean;
  wheelClass?: string;
}> = ({
  id,
  name,
  placeholder,
  display,
  items,
  selected,
  fallbackIndex,
  onPick,
  parse,
  isComplete,
  nextId,
  inputMode,
  maxLength,
  header,
  describedBy,
  alignEnd,
  wheelClass,
}) => {
  const sheet = useDraft<number>(selected ?? fallbackIndex);
  // text while the user is typing; null = show the committed value
  const [typed, setTyped] = useState<string | null>(null);
  // value when the wheel opened, for Escape
  const atOpen = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const close = () => sheet.setOpen(false);
  const closeToField = () => {
    close();
    setTyped(null);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };
  const open = () => {
    if (sheet.open) return;
    atOpen.current = selected;
    sheet.openWith(selected ?? fallbackIndex);
  };
  const pick = (i: number) => {
    sheet.setDraft(i);
    onPick(i);
  };

  const onType = (text: string) => {
    setTyped(text);
    const idx = parse(text.trim());
    if (idx === undefined) return;
    if (idx === null) {
      onPick(null);
      return;
    }
    pick(idx);
    if (nextId && isComplete?.(text.trim())) {
      setTyped(null);
      close();
      document.getElementById(nextId)?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!sheet.open || e.altKey) {
        open();
        return;
      }
      const base = selected ?? sheet.draft;
      const next = Math.max(0, Math.min(items.length - 1, base + (e.key === 'ArrowDown' ? 1 : -1)));
      setTyped(null);
      pick(next);
    }
  };

  return (
    <div className="wheel-field">
      <div
        ref={fieldRef}
        className={`wheel-trigger dob-part ${selected === null && !typed ? 'is-empty' : ''}`}
        onClick={(e) => {
          const onChevron = (e.target as HTMLElement).closest('.dob-part-chevron');
          // phones: a tap on the text brings up the keyboard only; the chevron opens the wheel
          if (isPhone() && !onChevron) return;
          if (isPhone()) inputRef.current?.blur();
          else inputRef.current?.focus();
          open();
        }}
      >
        <input
          ref={inputRef}
          id={id}
          className="dob-part-input"
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={name}
          aria-haspopup="dialog"
          aria-expanded={sheet.open}
          aria-describedby={describedBy}
          value={typed ?? display}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={(e) => e.target.select()}
          onBlur={() => setTyped(null)}
        />
        <span className="dob-part-chevron" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 9 5-5 5 5" />
            <path d="m7 15 5 5 5-5" />
          </svg>
        </span>
      </div>
      <WheelSheet
        open={sheet.open}
        title={name}
        header={header}
        className={`wheel-sheet-single ${alignEnd ? 'is-end' : ''}`}
        actions={false}
        onCancel={close}
        onDone={() => {
          // Enter: take the row under the highlight even if the wheel never moved
          onPick(sheet.draft);
          closeToField();
        }}
        onEscape={() => {
          onPick(atOpen.current);
          closeToField();
        }}
        ignoreRef={fieldRef}
      >
        <div className="wheel-grid-one">
          <WheelColumn
            items={items}
            selectedIndex={Math.min(Math.max(0, sheet.draft), items.length - 1)}
            onChange={(i) => {
              setTyped(null);
              pick(i);
            }}
            onPick={closeToField}
            ariaLabel={name}
            className={wheelClass}
          />
        </div>
      </WheelSheet>
    </div>
  );
};

/**
 * Date of birth as three select-style fields: day, month, year. Each opens its own
 * iOS-style wheel; the year wheel shows Buddhist and Gregorian years side by side.
 * The emitted value is ISO (Gregorian) once all three are chosen, '' until then.
 */
export const DateOfBirthInput: React.FC<DateOfBirthInputProps> = ({
  id,
  valueIso,
  onChangeIso,
  ariaDescribedBy,
}) => {
  const lang = getLang();
  const thisYear = currentYearBangkok();
  const [parts, setParts] = useState<Parts>(() => parseIso(valueIso) ?? EMPTY);
  // the last value this field emitted; an outside change (profile autofill) differs from it
  const lastEmitted = useRef(valueIso);

  useEffect(() => {
    if (valueIso === lastEmitted.current) return;
    lastEmitted.current = valueIso;
    setParts(parseIso(valueIso) ?? EMPTY);
  }, [valueIso]);

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'th-TH', {
      month: 'long',
      timeZone: 'UTC',
    });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))));
  }, [lang]);

  const monthAliases = useMemo(() => {
    const names = (locale: string, month: 'long' | 'short') => {
      const fmt = new Intl.DateTimeFormat(locale, { month, timeZone: 'UTC' });
      return Array.from({ length: 12 }, (_, i) =>
        fmt.format(new Date(Date.UTC(2000, i, 1))).toLowerCase().replace(/\s+/g, '')
      );
    };
    const lists = [names('th-TH', 'long'), names('th-TH', 'short'), names('en-GB', 'long'), names('en-GB', 'short')];
    return Array.from({ length: 12 }, (_, i) => lists.map((l) => l[i]));
  }, []);

  const years = useMemo(
    () => Array.from({ length: MAX_AGE_YEARS + 1 }, (_, i) => thisYear - i),
    [thisYear]
  );

  const update = (next: Partial<Parts>) => {
    const merged = { ...parts, ...next };
    // 31 Apr or 29 Feb in a non-leap year: move the day to the month's last day
    if (merged.d !== null && merged.m !== null) {
      const limit = daysInMonth(merged.y ?? 2000, merged.m);
      if (merged.d > limit) merged.d = limit;
    }
    setParts(merged);
    const iso =
      merged.d !== null && merged.m !== null && merged.y !== null
        ? `${merged.y}-${pad2(merged.m)}-${pad2(merged.d)}`
        : '';
    if (iso !== lastEmitted.current) {
      lastEmitted.current = iso;
      onChangeIso(iso);
    }
  };

  // days offered follow the chosen month / year (leap-year safe); 31 until a month is set
  const maxDay = parts.m !== null ? daysInMonth(parts.y ?? 2000, parts.m) : 31;
  const dayItems: WheelItem[] = Array.from({ length: maxDay }, (_, i) => ({
    value: String(i + 1),
    label: i + 1,
  }));
  const monthItems: WheelItem[] = monthNames.map((name, i) => ({ value: String(i + 1), label: name }));
  const yearItems: WheelItem[] = years.map((y) => ({
    value: String(y),
    text: `${y + BE_OFFSET}/${y}`,
    label: (
      <span className="wheel-year-pair">
        <span>{y + BE_OFFSET}</span>
        <span>{y}</span>
      </span>
    ),
  }));

  const yearText = (y: number) => String(lang === 'en' ? y : y + BE_OFFSET);

  // ---- typing ----
  const digits = (t: string) => (/^\d+$/.test(t) ? Number(t) : NaN);
  const parseDay = (t: string) => {
    if (t === '') return null;
    const n = digits(t);
    return n >= 1 && n <= maxDay ? n - 1 : undefined;
  };
  // month by number (1–12) or by name, Thai or English, full or short (ม.ค., jan)
  const parseMonth = (t: string) => {
    if (t === '') return null;
    const n = digits(t);
    if (!Number.isNaN(n)) return n >= 1 && n <= 12 ? n - 1 : undefined;
    const q = t.toLowerCase().replace(/\s+/g, '');
    const hits = monthAliases
      .map((names, i) => (names.some((name) => name.startsWith(q)) ? i : -1))
      .filter((i) => i >= 0);
    return hits.length === 1 ? hits[0] : undefined;
  };
  // year in พ.ศ. (2400+) or ค.ศ., 4 digits
  const parseYear = (t: string) => {
    if (t === '') return null;
    if (!/^\d{4}$/.test(t)) return undefined;
    const n = Number(t);
    const idx = years.indexOf(n > 2400 ? n - BE_OFFSET : n);
    return idx >= 0 ? idx : undefined;
  };

  return (
    // data-flash-group: the profile checklist highlights day, month and year together
    <div className="dob-split" role="group" aria-label={tx('วันเกิด')} data-flash-group="">
      <PartPicker
        id={id}
        name={tx('วัน')}
        placeholder={tx('วัน')}
        display={parts.d !== null ? String(parts.d) : ''}
        items={dayItems}
        selected={parts.d !== null ? parts.d - 1 : null}
        fallbackIndex={0}
        onPick={(i) => update({ d: i === null ? null : i + 1 })}
        parse={parseDay}
        isComplete={(t) => t.length === 2 || Number(t) > 3}
        nextId={`${id}-month`}
        inputMode="numeric"
        maxLength={2}
        describedBy={ariaDescribedBy}
      />
      <PartPicker
        id={`${id}-month`}
        name={tx('เดือน')}
        placeholder={tx('เดือน')}
        display={parts.m !== null ? monthNames[parts.m - 1] : ''}
        items={monthItems}
        selected={parts.m !== null ? parts.m - 1 : null}
        fallbackIndex={0}
        onPick={(i) => update({ m: i === null ? null : i + 1 })}
        parse={parseMonth}
        isComplete={(t) => /^\d+$/.test(t) && (t.length === 2 || Number(t) > 1)}
        nextId={`${id}-year`}
        inputMode="text"
        maxLength={12}
        describedBy={ariaDescribedBy}
      />
      <PartPicker
        id={`${id}-year`}
        name={tx('ปีเกิด')}
        placeholder={lang === 'en' ? tx('ปี') : tx('ปี พ.ศ.')}
        display={parts.y !== null ? yearText(parts.y) : ''}
        items={yearItems}
        selected={parts.y !== null ? Math.max(0, years.indexOf(parts.y)) : null}
        fallbackIndex={DEFAULT_AGE}
        onPick={(i) => update({ y: i === null ? null : years[i] })}
        parse={parseYear}
        inputMode="numeric"
        maxLength={4}
        header={
          <span className="wheel-year-pair">
            <span>{tx('พ.ศ.')}</span>
            <span>{tx('ค.ศ.')}</span>
          </span>
        }
        describedBy={ariaDescribedBy}
        alignEnd
        wheelClass="wheel-col-year"
      />
    </div>
  );
};
