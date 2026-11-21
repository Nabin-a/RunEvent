/**
 * Utilities for strict dd/mm/yyyy Date of Birth formatting and PII masking.
 * Internal persistence uses ISO YYYY-MM-DD while all UI inputs/displays use dd/mm/yyyy.
 */

export function isoToDdMmYyyy(value?: string | null): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';

  // Already dd/mm/yyyy
  const dmyMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (dmyMatch) return trimmed;

  // ISO YYYY-MM-DD (or YYYY-MM-DDTHH:mm...)
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}/${mm}/${yyyy}`;
  }

  return trimmed;
}

export function ddMmYyyyToIso(display: string): string | null {
  const trimmed = display.trim();
  if (!trimmed) return '';

  // Accept dd/mm/yyyy or d/m/yyyy
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);

  // Support Thai Buddhist Era (e.g., 2537 -> 1994) transparently if typed
  if (year >= 2440 && year <= 2600) {
    year -= 543;
  }

  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function autoMaskDdMmYyyy(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function sanitizeThaiIdOrPassport(
  raw: string,
  idType: 'none' | 'thai_id' | 'passport'
): string {
  if (idType === 'thai_id') {
    return raw.replace(/\D/g, '').slice(0, 13);
  }
  return raw.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase().slice(0, 20);
}

/** Groups of a Thai citizen ID as printed on the card: 1-2345-67890-12-3 */
const THAI_ID_GROUPS = [1, 4, 5, 2, 1];

/**
 * Formats up to 13 digits as X-XXXX-XXXXX-XX-X. Works on partial input, so the
 * hyphens appear as the person types. Non-digits are ignored.
 */
export function formatThaiId(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '').slice(0, 13);
  const parts: string[] = [];
  let at = 0;
  for (const size of THAI_ID_GROUPS) {
    if (at >= digits.length) break;
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join('-');
}

export function maskIdNumber(raw?: string | null): string {
  if (!raw) return '';
  const clean = raw.trim();
  if (!clean) return '';
  if (clean.length <= 4) return clean;
  return `${'•'.repeat(clean.length - 4)}${clean.slice(-4)}`;
}

/**
 * Allows only Thai consonants, vowels, tone marks, spaces, hyphens, and periods.
 * Blocks all digits (0-9, ๐-๙) and non-Thai scripts (A-Z, a-z, etc.).
 */
export function sanitizeThaiNameInput(raw: string): string {
  return raw.replace(/[^\u0E01-\u0E3A\u0E40-\u0E4E\s.-]/g, '');
}

/**
 * Allows only English letters (A-Z, a-z), spaces, hyphens, apostrophes, and periods.
 * Blocks all digits (0-9, ๐-๙) and Thai/other scripts.
 */
export function sanitizeEnglishNameInput(raw: string): string {
  return raw.replace(/[^A-Za-z\s.'-]/g, '');
}

export function detectNameScript(raw: string): 'th' | 'en' | 'empty' {
  const firstLetter = raw.match(/[\u0E01-\u0E3A\u0E40-\u0E4EA-Za-z]/)?.[0];
  if (!firstLetter) return 'empty';
  return /[A-Za-z]/.test(firstLetter) ? 'en' : 'th';
}

/**
 * Allows typing EITHER Thai OR English (based on the first letter typed),
 * while blocking all digits (0-9, ๐-๙) and preventing mixed scripts in the same field.
 */
export function sanitizeSingleLanguageNameInput(raw: string): string {
  const script = detectNameScript(raw);
  if (script === 'en') return sanitizeEnglishNameInput(raw);
  if (script === 'th') return sanitizeThaiNameInput(raw);
  return '';
}
