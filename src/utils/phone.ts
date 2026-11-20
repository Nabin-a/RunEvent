/**
 * Phone numbers with a country calling code.
 *
 * Stored value: "+<dial> <national number without the trunk 0>", e.g. "+66 81-234-5678".
 * Older values without "+" (e.g. "081-442-9910") are read as Thai numbers.
 * In the input, Thai numbers are shown the way Thais write them (with the leading 0).
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

const MAX_DIGITS_TH = 10; // with the trunk 0
const MAX_DIGITS_OTHER = 12;

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

/** Formats national digits as typed (Thai with or without the leading 0). */
export function formatNational(iso: string, digits: string): string {
  if (!digits) return '';
  if (iso === 'TH') {
    const hasTrunk = digits.startsWith('0');
    const d = hasTrunk ? digits.slice(1) : digits;
    let body: string;
    if (d.startsWith('2')) body = group(d, [1, 3, 4], '-'); // Bangkok landline
    else if (/^[689]/.test(d)) body = group(d, [2, 3, 4], '-'); // mobile
    else body = group(d, [2, 3, 3], '-'); // provincial landline
    if (!hasTrunk) return body;
    // re-attach the 0 to the first group: 0 + "81" -> "081"
    return `0${body}`;
  }
  if (iso === 'US') return group(digits, [3, 3, 4], ' ');
  // other countries: keep a typed trunk 0 in front, then 2-4-4 (e.g. JP 090 1234 5678)
  const hasTrunk = digits.startsWith('0');
  const body = group(hasTrunk ? digits.slice(1) : digits, [2, 4, 4], ' ');
  return hasTrunk ? `0${body}` : body;
}

export function maxDigitsFor(iso: string): number {
  return iso === 'TH' ? MAX_DIGITS_TH : MAX_DIGITS_OTHER;
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
