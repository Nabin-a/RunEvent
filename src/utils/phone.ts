/**
 * Phone numbers with a country calling code.
 *
 * Stored value: "+<dial> <national number without the trunk 0>", e.g. "+66 81-234-5678".
 * Older values without "+" (e.g. "081-442-9910") are read as Thai numbers.
 * In the input, each country's numbers are grouped the way that country writes them,
 * with the trunk 0 where locals use one (TH 081-234-5678, JP 090-1234-5678, SG 8123 4567).
 */

export interface DialCountry {
  iso: string;
  dial: string;
}

/** Thailand first, then ASEAN, then common origins of foreign runners. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { iso: 'TH', dial: '+66' },
  { iso: 'MY', dial: '+60' },
  { iso: 'SG', dial: '+65' },
  { iso: 'LA', dial: '+856' },
  { iso: 'KH', dial: '+855' },
  { iso: 'MM', dial: '+95' },
  { iso: 'VN', dial: '+84' },
  { iso: 'ID', dial: '+62' },
  { iso: 'PH', dial: '+63' },
  { iso: 'BN', dial: '+673' },
  { iso: 'JP', dial: '+81' },
  { iso: 'CN', dial: '+86' },
  { iso: 'KR', dial: '+82' },
  { iso: 'HK', dial: '+852' },
  { iso: 'TW', dial: '+886' },
  { iso: 'IN', dial: '+91' },
  { iso: 'AU', dial: '+61' },
  { iso: 'NZ', dial: '+64' },
  { iso: 'GB', dial: '+44' },
  { iso: 'DE', dial: '+49' },
  { iso: 'FR', dial: '+33' },
  { iso: 'US', dial: '+1' },
];

export const onlyDigits = (s: string) => s.replace(/\D/g, '');

export function countryOf(iso: string): DialCountry {
  return DIAL_COUNTRIES.find((c) => c.iso === iso) ?? DIAL_COUNTRIES[0];
}

/** Splits a stored value into country + national digits (Thai: with trunk 0 for display). */
export function parsePhone(value: string | null | undefined): { iso: string; national: string } {
  const v = (value ?? '').trim();
  if (!v) return { iso: 'TH', national: '' };
  if (v.startsWith('+')) {
    const digits = onlyDigits(v);
    // longest dial code first so +855 is not read as +85
    const match = [...DIAL_COUNTRIES]
      .sort((a, b) => b.dial.length - a.dial.length)
      .find((c) => digits.startsWith(c.dial.slice(1)));
    if (match) {
      const rest = digits.slice(match.dial.length - 1);
      return { iso: match.iso, national: match.iso === 'TH' && rest ? `0${rest}` : rest };
    }
    return { iso: 'TH', national: digits };
  }
  return { iso: 'TH', national: onlyDigits(v) };
}

/**
 * How each country writes its own numbers. `groups` and `max` work on the national
 * number WITHOUT the trunk 0. `trunk: true` means people at home write a leading 0
 * (081…, 090…, 07…); it is kept in the field as typed and dropped when stored.
 * Groups follow common local writing; where a country mixes lengths, the first
 * digits pick the shape (e.g. Thai mobile vs. Bangkok landline).
 */
interface PhonePattern {
  trunk: boolean;
  sep: string;
  /** group sizes for these national digits */
  groups: (d: string) => number[];
  /** longest national number (without the trunk 0) for these digits */
  max: (d: string) => number;
  /** placeholder, written the local way */
  example: string;
  /** leading digits no local number starts with (e.g. a typed US "1"); dropped */
  drop?: RegExp;
}

const fixed = (sizes: number[]) => () => sizes;
const len = (n: number) => () => n;

const PATTERNS: Record<string, PhonePattern> = {
  // 081-234-5678 · 02-123-4567 · 053-123-456
  TH: {
    trunk: true,
    sep: '-',
    groups: (d) => (d.startsWith('2') ? [1, 3, 4] : /^[689]/.test(d) ? [2, 3, 4] : [2, 3, 3]),
    max: (d) => (/^[689]/.test(d) ? 9 : 8),
    example: '081-234-5678',
  },
  // 012-345 6789 · 011-1234 5678 · 03-1234 5678 · 04-123 4567
  MY: {
    trunk: true,
    sep: ' ',
    groups: (d) =>
      d.startsWith('11') || d.startsWith('15')
        ? [2, 4, 4]
        : d.startsWith('1')
          ? [2, 3, 4]
          : d.startsWith('3')
            ? [1, 4, 4]
            : [1, 3, 4],
    max: (d) =>
      d.startsWith('11') || d.startsWith('15') ? 10 : d.startsWith('1') || d.startsWith('3') ? 9 : 8,
    example: '012-345 6789',
  },
  // 8123 4567
  SG: { trunk: false, sep: ' ', groups: fixed([4, 4]), max: len(8), example: '8123 4567' },
  // 020 1234 5678 · 021 123 456
  LA: {
    trunk: true,
    sep: ' ',
    groups: (d) => (d.startsWith('20') ? [2, 4, 4] : [2, 3, 3]),
    max: (d) => (d.startsWith('20') ? 10 : 8),
    example: '020 1234 5678',
  },
  // 012 345 678
  KH: { trunk: true, sep: ' ', groups: fixed([2, 3, 4]), max: len(9), example: '012 345 678' },
  // 09 123 456 789
  MM: { trunk: true, sep: ' ', groups: fixed([1, 3, 3, 3]), max: len(10), example: '09 123 456 789' },
  // 091 234 5678
  VN: { trunk: true, sep: ' ', groups: fixed([2, 3, 4]), max: len(9), example: '091 234 5678' },
  // 0812-3456-7890
  ID: { trunk: true, sep: '-', groups: fixed([3, 4, 4]), max: len(12), example: '0812-3456-7890' },
  // 0917 123 4567
  PH: { trunk: true, sep: ' ', groups: fixed([3, 3, 4]), max: len(10), example: '0917 123 4567' },
  // 712 3456
  BN: { trunk: false, sep: ' ', groups: fixed([3, 4]), max: len(7), example: '712 3456' },
  // 090-1234-5678 · 03-1234-5678
  JP: { trunk: true, sep: '-', groups: fixed([2, 4, 4]), max: len(10), example: '090-1234-5678' },
  // 138 1234 5678
  CN: { trunk: false, sep: ' ', groups: fixed([3, 4, 4]), max: len(11), example: '138 1234 5678' },
  // 010-1234-5678 · 02-123-4567 · 02-1234-5678
  KR: {
    trunk: true,
    sep: '-',
    groups: (d) => (d.startsWith('2') ? (d.length <= 8 ? [1, 3, 4] : [1, 4, 4]) : [2, 4, 4]),
    max: (d) => (d.startsWith('2') ? 9 : 10),
    example: '010-1234-5678',
  },
  // 9123 4567
  HK: { trunk: false, sep: ' ', groups: fixed([4, 4]), max: len(8), example: '9123 4567' },
  // 0912 345 678
  TW: { trunk: true, sep: ' ', groups: fixed([3, 3, 3]), max: len(9), example: '0912 345 678' },
  // 98765 43210
  IN: { trunk: false, sep: ' ', groups: fixed([5, 5]), max: len(10), example: '98765 43210' },
  // 0412 345 678 · 02 1234 5678
  AU: {
    trunk: true,
    sep: ' ',
    groups: (d) => (d.startsWith('4') ? [3, 3, 3] : [1, 4, 4]),
    max: len(9),
    example: '0412 345 678',
  },
  // 021 234 5678 · 09 123 4567
  NZ: {
    trunk: true,
    sep: ' ',
    groups: (d) => (d.startsWith('2') ? [2, 3, 4] : [1, 3, 4]),
    max: (d) => (d.startsWith('2') ? 10 : 8),
    example: '021 234 5678',
  },
  // 07123 456789 · 020 1234 5678
  GB: {
    trunk: true,
    sep: ' ',
    groups: (d) => (d.startsWith('7') ? [4, 6] : d.startsWith('2') ? [2, 4, 4] : [3, 3, 4]),
    max: len(10),
    example: '07123 456789',
  },
  // 0151 23456789 (area codes vary in length; the first block is the usual mobile prefix)
  DE: { trunk: true, sep: ' ', groups: fixed([3, 8]), max: len(11), example: '0151 23456789' },
  // 06 12 34 56 78
  FR: { trunk: true, sep: ' ', groups: fixed([1, 2, 2, 2, 2]), max: len(9), example: '06 12 34 56 78' },
  // 212-555-0123
  // area codes never start with 0 or 1, so a typed "1" (the country code) is dropped
  US: {
    trunk: false,
    sep: '-',
    groups: fixed([3, 3, 4]),
    max: len(10),
    example: '212-555-0123',
    drop: /^[01]+/,
  },
};

function patternOf(iso: string): PhonePattern {
  return PATTERNS[iso] ?? PATTERNS.TH;
}

function group(d: string, sizes: number[], sep: string): string {
  const out: string[] = [];
  let i = 0;
  for (const n of sizes) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + n));
    i += n;
  }
  if (i < d.length) out.push(d.slice(i));
  return out.join(sep);
}

/** Splits typed digits into the trunk 0 (if this country uses one) and the national part. */
function splitTrunk(iso: string, digits: string): { trunk: string; national: string } {
  const p = patternOf(iso);
  if (p.drop) digits = digits.replace(p.drop, '');
  if (digits.startsWith('0')) {
    // countries without a trunk prefix never start with 0; drop it
    return { trunk: p.trunk ? '0' : '', national: digits.replace(/^0+/, '') };
  }
  return { trunk: '', national: digits };
}

/**
 * Keeps only as many digits as the country's numbers have, so a Thai number typed
 * without the 0 stops at 9 digits (mobile) or 8 (landline) instead of spilling over.
 */
export function clampDigits(iso: string, digits: string): string {
  const { trunk, national } = splitTrunk(iso, digits);
  return trunk + national.slice(0, patternOf(iso).max(national));
}

/** Formats national digits as typed, the way that country writes them (trunk 0 kept). */
export function formatNational(iso: string, digits: string): string {
  if (!digits) return '';
  const p = patternOf(iso);
  const { trunk, national } = splitTrunk(iso, digits);
  if (!national) return trunk;
  // the 0 joins the first group: 0 + "81" -> "081"
  return trunk + group(national, p.groups(national), p.sep);
}

/** Example number for the placeholder, written the local way. */
export function phoneExample(iso: string): string {
  return patternOf(iso).example;
}

/** Builds the stored value from what the user typed. Empty input -> ''. */
export function composePhone(iso: string, typedDigits: string): string {
  const c = countryOf(iso);
  // the trunk 0 (081…, 090… in JP, 07… in GB) is dropped in the international form
  const national = typedDigits.replace(/^0/, '');
  if (!national) return '';
  return `${c.dial} ${formatNational(iso, national)}`;
}

/** Readable form for summaries and lists: "+66 81-234-5678". Legacy values are converted. */
export function displayPhone(value: string | null | undefined): string {
  const { iso, national } = parsePhone(value);
  return composePhone(iso, national);
}

/** "081-•••-5678" for Thai numbers, "+81 •••-5678" for others. */
export function maskPhone(value: string | null | undefined, fallback = ''): string {
  const { iso, national } = parsePhone(value);
  if (national.length < 7) return fallback;
  const last4 = national.slice(-4);
  if (iso === 'TH') return `${national.slice(0, 3)}-•••-${last4}`;
  return `${countryOf(iso).dial} •••-${last4}`;
}
