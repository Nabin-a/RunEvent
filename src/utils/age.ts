/**
 * Age and age-group (division) rules shared by the browser and the API server.
 *
 * - Dates are plain ISO calendar dates (YYYY-MM-DD). The event date is already the
 *   local date in the event's timezone, so no clock or timezone maths is involved.
 * - Age = completed years on the basis date. A runner born on 29 Feb counts a new
 *   year on 1 Mar in non-leap years.
 * - The server repeats the same checks before saving; the browser check is only for
 *   early feedback.
 */
import type {
  AgeBasis,
  AgeGroupDef,
  AgeGroupGender,
  RaceCategory,
  RaceEvent,
  RegistrationAgeSnapshot,
} from '../types';
import { getLang, tx, txf } from '../i18n';

export const AGE_LIMIT_MAX = 120;
export const AGE_GROUPS_MAX = 40;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value?: string | null): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const match = ISO_DATE.exec(value.trim().slice(0, 10));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12) return null;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d < 1 || d > daysInMonth) return null;
  return { y, m, d };
}

/** Completed years between dateOfBirth and onDate, or null if either date is invalid or DOB is after onDate. */
export function ageOn(dateOfBirth?: string | null, onDate?: string | null): number | null {
  const dob = parseIsoDate(dateOfBirth);
  const on = parseIsoDate(onDate);
  if (!dob || !on) return null;
  let age = on.y - dob.y;
  if (on.m < dob.m || (on.m === dob.m && on.d < dob.d)) age -= 1;
  return age < 0 ? null : age;
}

/**
 * Exact age as years + months + days between dateOfBirth and onDate (calendar arithmetic:
 * days borrow from the month before onDate). Null when a date is invalid or DOB is later.
 */
export function ageBreakdownOn(
  dateOfBirth?: string | null,
  onDate?: string | null
): { years: number; months: number; days: number } | null {
  const dob = parseIsoDate(dateOfBirth);
  const on = parseIsoDate(onDate);
  if (!dob || !on) return null;
  let years = on.y - dob.y;
  let months = on.m - dob.m;
  let days = on.d - dob.d;
  if (days < 0) {
    months -= 1;
    // borrow the month before onDate; a birthday past that month's end (31 Jan -> Feb)
    // counts from the month's last day
    const prevLen = new Date(Date.UTC(on.y, on.m - 1, 0)).getUTCDate();
    days = prevLen - Math.min(dob.d, prevLen) + on.d;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return years < 0 ? null : { years, months, days };
}

export function resolveAgeBasis(category: Pick<RaceCategory, 'ageBasis'>): AgeBasis {
  return category.ageBasis === 'year_end' ? 'year_end' : 'race_day';
}

/** The calendar date the age is counted on for this event and basis. */
export function ageBasisDate(eventDate: string, basis: AgeBasis): string {
  const parsed = parseIsoDate(eventDate);
  if (!parsed) return eventDate;
  return basis === 'year_end' ? `${parsed.y}-12-31` : eventDate.slice(0, 10);
}

/** True when the category asks for a date of birth (limits or groups configured). */
export function categoryUsesAge(category: RaceCategory): boolean {
  return (
    typeof category.minAge === 'number' ||
    typeof category.maxAge === 'number' ||
    (category.ageGroups?.length ?? 0) > 0
  );
}

function genderMatches(groupGender: AgeGroupGender, runnerGender?: string | null): boolean {
  if (groupGender === 'all') return true;
  return groupGender === runnerGender;
}

export function resolveAgeGroup(
  groups: AgeGroupDef[] | undefined,
  age: number,
  runnerGender?: string | null
): AgeGroupDef | null {
  if (!groups?.length) return null;
  return (
    groups.find(
      (g) =>
        genderMatches(g.gender, runnerGender) &&
        age >= g.minAge &&
        (g.maxAge === null || age <= g.maxAge)
    ) ?? null
  );
}

/* ---------------------------------------------------------------- labels -- */

function rangeTh(min: number, max: number | null): string {
  if (max === null) return `${min} ปีขึ้นไป`;
  if (min <= 0) return `ไม่เกิน ${max} ปี`;
  if (min === max) return `${min} ปี`;
  return `${min}–${max} ปี`;
}

/** Thai label stored on the registration snapshot (server-safe, not translated). */
export function ageGroupLabelTh(g: AgeGroupDef): string {
  const genderTh = g.gender === 'all' ? 'ทุกเพศ' : g.gender;
  return `${genderTh} ${rangeTh(g.minAge, g.maxAge)}`;
}

/** Display label in the current UI language. */
export function formatAgeGroupLabel(g: AgeGroupDef): string {
  const gender = g.gender === 'all' ? tx('ทุกเพศ') : tx(g.gender);
  return `${gender} ${formatAgeRange(g.minAge, g.maxAge)}`;
}

export function formatAgeRange(min: number, max: number | null): string {
  if (max === null) return txf('{0} ปีขึ้นไป', min);
  if (min <= 0) return txf('ไม่เกิน {0} ปี', max);
  if (min === max) return txf('{0} ปี', min);
  return txf('{0}–{1} ปี', min, max);
}

/** Short eligibility text such as "อายุ 18 ปีขึ้นไป", or null when there is no limit. */
export function formatAgeLimit(category: RaceCategory): string | null {
  const min = typeof category.minAge === 'number' ? category.minAge : null;
  const max = typeof category.maxAge === 'number' ? category.maxAge : null;
  if (min === null && max === null) return null;
  if (min !== null && max !== null) return txf('อายุ {0}–{1} ปี', min, max);
  if (min !== null) return txf('อายุ {0} ปีขึ้นไป', min);
  return txf('อายุไม่เกิน {0} ปี', max);
}

export function formatAgeBasis(basis: AgeBasis): string {
  return basis === 'year_end' ? tx('นับอายุ ณ 31 ธ.ค. ของปีที่แข่ง') : tx('นับอายุ ณ วันแข่ง');
}

/** Today's calendar date (YYYY-MM-DD) in the given timezone — Thailand by default, not the device clock's zone. */
export function todayIsoInTimeZone(timeZone = 'Asia/Bangkok', now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "13 ธ.ค. 2569" in Thai, "13 Dec 2026" in English. */
export function formatBasisDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  const locale = getLang() === 'en' ? 'en-GB' : 'th-TH';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/* ------------------------------------------------------------ evaluation -- */

export type AgeCheckStatus =
  | 'not_required'
  | 'missing_dob'
  | 'invalid_dob'
  | 'too_young'
  | 'too_old'
  | 'ok';

export interface AgeCheckResult {
  status: AgeCheckStatus;
  eligible: boolean;
  basis: AgeBasis;
  basisDate: string;
  ageYears: number | null;
  group: AgeGroupDef | null;
  /** True when the category has groups but none matches (for example gender not stated). */
  unassigned: boolean;
}

export function evaluateCategoryAge(
  event: Pick<RaceEvent, 'eventDate'>,
  category: RaceCategory,
  dateOfBirth?: string | null,
  gender?: string | null
): AgeCheckResult {
  const basis = resolveAgeBasis(category);
  const basisDate = ageBasisDate(event.eventDate, basis);
  const base = { basis, basisDate, ageYears: null, group: null, unassigned: false };

  const hasDob = Boolean(dateOfBirth && dateOfBirth.trim());
  if (!categoryUsesAge(category)) {
    const ageYears = hasDob ? ageOn(dateOfBirth, basisDate) : null;
    return { ...base, status: 'not_required', eligible: true, ageYears };
  }
  if (!hasDob) return { ...base, status: 'missing_dob', eligible: false };

  const ageYears = ageOn(dateOfBirth, basisDate);
  if (ageYears === null || ageYears > AGE_LIMIT_MAX) {
    return { ...base, status: 'invalid_dob', eligible: false };
  }
  if (typeof category.minAge === 'number' && ageYears < category.minAge) {
    return { ...base, ageYears, status: 'too_young', eligible: false };
  }
  if (typeof category.maxAge === 'number' && ageYears > category.maxAge) {
    return { ...base, ageYears, status: 'too_old', eligible: false };
  }
  const group = resolveAgeGroup(category.ageGroups, ageYears, gender);
  return {
    ...base,
    ageYears,
    group,
    unassigned: (category.ageGroups?.length ?? 0) > 0 && !group,
    status: 'ok',
    eligible: true,
  };
}

/** Error message for a failed check (current UI language; Thai on the server). */
export function ageCheckMessage(result: AgeCheckResult, category: RaceCategory): string | null {
  switch (result.status) {
    case 'missing_dob':
      return txf('ระยะ {0} มีเกณฑ์อายุ กรุณาระบุวันเกิดของผู้เข้าแข่งขัน', category.code);
    case 'invalid_dob':
      return tx('วันเกิดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
    case 'too_young':
      return txf(
        'ผู้เข้าแข่งขันอายุ {0} ปี ณ วันที่นับอายุ แต่ระยะ {1} รับอายุ {2} ปีขึ้นไป',
        result.ageYears,
        category.code,
        category.minAge
      );
    case 'too_old':
      return txf(
        'ผู้เข้าแข่งขันอายุ {0} ปี ณ วันที่นับอายุ แต่ระยะ {1} รับอายุไม่เกิน {2} ปี',
        result.ageYears,
        category.code,
        category.maxAge
      );
    default:
      return null;
  }
}

export function buildAgeSnapshot(
  result: AgeCheckResult,
  dateOfBirth: string,
  computedAt: string
): RegistrationAgeSnapshot | undefined {
  if (result.ageYears === null) return undefined;
  return {
    ageYears: result.ageYears,
    basis: result.basis,
    basisDate: result.basisDate,
    dateOfBirth: dateOfBirth.slice(0, 10),
    groupId: result.group?.id ?? null,
    groupLabelTh: result.group ? ageGroupLabelTh(result.group) : null,
    computedAt,
  };
}

/* ---------------------------------------------------------- organizer UI -- */

export function ageGroupId(gender: AgeGroupGender, min: number, max: number | null): string {
  const g = gender === 'ชาย' ? 'M' : gender === 'หญิง' ? 'F' : 'X';
  return `${g}${min}-${max === null ? 'up' : max}`;
}

/**
 * Starter set the organizer can edit: men and women in 10-year bands
 * (under 20, 20–29 … 50–59, 60+), clipped to the category's age limits.
 * This is a starting point only — organizers confirm the real divisions per event.
 */
export function buildStandardAgeGroups(minAge?: number | null, maxAge?: number | null): AgeGroupDef[] {
  const lo = typeof minAge === 'number' ? minAge : 0;
  const hi = typeof maxAge === 'number' ? maxAge : null;
  const edges: Array<[number, number | null]> = [
    [0, 19],
    [20, 29],
    [30, 39],
    [40, 49],
    [50, 59],
    [60, null],
  ];
  const bands: Array<[number, number | null]> = [];
  for (const [a, b] of edges) {
    const start = Math.max(a, lo);
    const end = hi === null ? b : b === null ? hi : Math.min(b, hi);
    if (end !== null && start > end) continue;
    bands.push([start, end]);
  }
  const out: AgeGroupDef[] = [];
  for (const gender of ['ชาย', 'หญิง'] as const) {
    for (const [a, b] of bands) out.push({ id: ageGroupId(gender, a, b), gender, minAge: a, maxAge: b });
  }
  return out;
}

export interface AgeConfigInput {
  ageBasis?: unknown;
  minAge?: unknown;
  maxAge?: unknown;
  ageGroups?: unknown;
}

export interface AgeConfigValid {
  ageBasis: AgeBasis;
  minAge: number | null;
  maxAge: number | null;
  ageGroups: AgeGroupDef[];
}

function toAgeInt(v: unknown): number | null | 'bad' {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isInteger(n) || n < 0 || n > AGE_LIMIT_MAX) return 'bad';
  return n;
}

function rangesOverlap(a: AgeGroupDef, b: AgeGroupDef): boolean {
  const aMax = a.maxAge ?? Infinity;
  const bMax = b.maxAge ?? Infinity;
  return a.minAge <= bMax && b.minAge <= aMax;
}

function gendersIntersect(a: AgeGroupGender, b: AgeGroupGender): boolean {
  return a === 'all' || b === 'all' || a === b;
}

/** Validates and normalises an organizer's age settings. Messages follow the current UI language. */
export function validateAgeConfig(
  input: AgeConfigInput
): { ok: true; value: AgeConfigValid } | { ok: false; message: string } {
  const ageBasis: AgeBasis = input.ageBasis === 'year_end' ? 'year_end' : 'race_day';
  const minAge = toAgeInt(input.minAge);
  const maxAge = toAgeInt(input.maxAge);
  if (minAge === 'bad' || maxAge === 'bad') {
    return { ok: false, message: txf('อายุต้องเป็นจำนวนเต็ม 0–{0} ปี', AGE_LIMIT_MAX) };
  }
  if (minAge !== null && maxAge !== null && minAge > maxAge) {
    return { ok: false, message: tx('อายุต่ำสุดต้องไม่มากกว่าอายุสูงสุด') };
  }

  const rawGroups = Array.isArray(input.ageGroups) ? input.ageGroups : [];
  if (rawGroups.length > AGE_GROUPS_MAX) {
    return { ok: false, message: txf('กำหนดรุ่นอายุได้ไม่เกิน {0} รุ่น', AGE_GROUPS_MAX) };
  }
  const groups: AgeGroupDef[] = [];
  for (const raw of rawGroups as Array<Record<string, unknown>>) {
    const gender: AgeGroupGender =
      raw?.gender === 'ชาย' || raw?.gender === 'หญิง' ? raw.gender : 'all';
    const gMin = toAgeInt(raw?.minAge);
    const gMax = toAgeInt(raw?.maxAge);
    if (gMin === 'bad' || gMax === 'bad' || gMin === null) {
      return { ok: false, message: txf('อายุของรุ่นต้องเป็นจำนวนเต็ม 0–{0} ปี', AGE_LIMIT_MAX) };
    }
    if (gMax !== null && gMin > gMax) {
      return { ok: false, message: tx('ในแต่ละรุ่น อายุเริ่มต้องไม่มากกว่าอายุสิ้นสุด') };
    }
    groups.push({ id: ageGroupId(gender, gMin, gMax), gender, minAge: gMin, maxAge: gMax });
  }
  for (let i = 0; i < groups.length; i += 1) {
    for (let j = i + 1; j < groups.length; j += 1) {
      const a = groups[i];
      const b = groups[j];
      if (gendersIntersect(a.gender, b.gender) && rangesOverlap(a, b)) {
        return {
          ok: false,
          message: txf(
            'รุ่น "{0}" และ "{1}" มีช่วงอายุทับกัน นักวิ่งหนึ่งคนต้องอยู่ได้รุ่นเดียว',
            formatAgeGroupLabel(a),
            formatAgeGroupLabel(b)
          ),
        };
      }
    }
  }
  groups.sort((a, b) =>
    a.gender === b.gender ? a.minAge - b.minAge : a.gender.localeCompare(b.gender, 'th')
  );
  return { ok: true, value: { ageBasis, minAge, maxAge, ageGroups: groups } };
}

/**
 * Ages inside the category limits that no group covers, per gender.
 * Used as a warning only — runners in a gap register fine but get no division.
 */
export function findAgeGroupGaps(config: Pick<AgeConfigValid, 'minAge' | 'maxAge' | 'ageGroups'>): string[] {
  if (!config.ageGroups.length) return [];
  const lo = config.minAge ?? 0;
  const hi = config.maxAge ?? 99;
  const out: string[] = [];
  const genders: Array<'ชาย' | 'หญิง'> = ['ชาย', 'หญิง'];
  for (const gender of genders) {
    const covered = config.ageGroups.filter((g) => gendersIntersect(g.gender, gender));
    let gapStart: number | null = null;
    for (let age = lo; age <= hi + 1; age += 1) {
      const inGap =
        age <= hi && !covered.some((g) => age >= g.minAge && (g.maxAge === null || age <= g.maxAge));
      if (inGap && gapStart === null) gapStart = age;
      if (!inGap && gapStart !== null) {
        const end = age - 1;
        const range =
          config.maxAge === null && end === hi ? formatAgeRange(gapStart, null) : formatAgeRange(gapStart, end);
        out.push(`${tx(gender)} ${range}`);
        gapStart = null;
      }
    }
  }
  return out;
}
