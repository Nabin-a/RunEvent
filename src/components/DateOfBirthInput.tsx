import React, { useMemo } from 'react';
import { getLang, tx } from '../i18n';
import { WheelColumn, WheelSheet, WheelTrigger, useDraft, type WheelItem } from './WheelPicker';

interface DateOfBirthInputProps {
  /** id of the trigger button so an outer <label htmlFor> still points at the field. */
  id: string;
  /** Stored value: ISO yyyy-mm-dd in the Gregorian calendar (ค.ศ.), or '' when not set. */
  valueIso: string;
  onChangeIso: (nextIso: string) => void;
  required?: boolean;
  /** id of a hint element read with the trigger (for example the computed age). */
  ariaDescribedBy?: string;
}

const BE_OFFSET = 543;
const MAX_AGE_YEARS = 100;
const DEFAULT_AGE = 25;

const pad2 = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

const parseIso = (iso: string): { d: number; m: number; y: number } | null => {
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

/**
 * Date of birth as an iOS-style wheel picker (day / month / year in one sheet).
 * The year wheel shows Buddhist and Gregorian years side by side under a sticky
 * "พ.ศ. | ค.ศ." header. The emitted value stays ISO (Gregorian); BE = CE + 543.
 */
export const DateOfBirthInput: React.FC<DateOfBirthInputProps> = ({
  id,
  valueIso,
  onChangeIso,
  ariaDescribedBy,
}) => {
  const lang = getLang();
  const thisYear = currentYearBangkok();
  const current = parseIso(valueIso);
  const sheet = useDraft<{ d: number; m: number; y: number }>(
    current ?? { d: 1, m: 1, y: thisYear - DEFAULT_AGE }
  );

  const monthNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'th-TH', {
      month: 'long',
      timeZone: 'UTC',
    });
    return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2000, i, 1))));
  }, [lang]);

  const years = useMemo(
    () => Array.from({ length: MAX_AGE_YEARS + 1 }, (_, i) => thisYear - i),
    [thisYear]
  );

  const draft = sheet.draft;
  const maxDay = daysInMonth(draft.y, draft.m);
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

  // Changing month/year can make the day impossible (31 Apr, 29 Feb): clamp to the last day.
  const setDraft = (next: Partial<{ d: number; m: number; y: number }>) => {
    // Functional update: several wheels can settle in the same tick.
    sheet.setDraft((prev) => {
      const merged = { ...prev, ...next };
      const limit = daysInMonth(merged.y, merged.m);
      if (merged.d > limit) merged.d = limit;
      return merged;
    });
  };

  const open = () => sheet.openWith(current ?? { d: 1, m: 1, y: thisYear - DEFAULT_AGE });
  const done = () => {
    onChangeIso(`${draft.y}-${pad2(draft.m)}-${pad2(draft.d)}`);
    sheet.setOpen(false);
  };

  const display = current
    ? `${current.d} ${monthNames[current.m - 1]} ${current.y + BE_OFFSET}/${current.y}`
    : '';

  return (
    <div className="wheel-field">
      <WheelTrigger
        id={id}
        label={display}
        placeholder={tx('เลือกวันเกิด')}
        hasValue={Boolean(current)}
        expanded={sheet.open}
        onOpen={open}
        describedBy={ariaDescribedBy}
      />
      <WheelSheet
        open={sheet.open}
        title={tx('วันเกิด')}
        header={
          <div className="wheel-header-grid wheel-grid-dob">
            <span>{tx('วัน')}</span>
            <span>{tx('เดือน')}</span>
            <span className="wheel-year-pair">
              <span>{tx('พ.ศ.')}</span>
              <span>{tx('ค.ศ.')}</span>
            </span>
          </div>
        }
        onCancel={() => sheet.setOpen(false)}
        onDone={done}
        onClear={
          current
            ? () => {
              onChangeIso('');
              sheet.setOpen(false);
            }
            : undefined
        }
      >
        <div className="wheel-grid-dob">
          <WheelColumn
            items={dayItems}
            selectedIndex={draft.d - 1}
            onChange={(i) => setDraft({ d: i + 1 })}
            ariaLabel={tx('วัน')}
            autoFocus
          />
          <WheelColumn
            items={monthItems}
            selectedIndex={draft.m - 1}
            onChange={(i) => setDraft({ m: i + 1 })}
            ariaLabel={tx('เดือน')}
          />
          <WheelColumn
            items={yearItems}
            selectedIndex={Math.max(0, years.indexOf(draft.y))}
            onChange={(i) => setDraft({ y: years[i] })}
            ariaLabel={tx('ปี (พ.ศ./ค.ศ.)')}
            className="wheel-col-year"
          />
        </div>
      </WheelSheet>
    </div>
  );
};
