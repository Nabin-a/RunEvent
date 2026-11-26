import { parsePhone } from './phone';

/**
 * A friend you register or save must have their own email and phone (26 Nov 2026,
 * user request): both are required and neither may be the account owner's.
 * Used by the browser forms and by the server, which repeats the check.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(v: string | null | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

/** country + national digits, so "+66 81-442-9910" and "081-442-9910" compare equal */
export function phoneKey(v: string | null | undefined): string {
  const { iso, national } = parsePhone(v);
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `${iso}:${digits}` : '';
}

export interface FriendContactProblems {
  email?: string;
  phone?: string;
}

export function friendContactProblems(
  friend: { email?: string | null; phone?: string | null },
  owner: { email?: string | null; phone?: string | null },
  opts: { requireBoth?: boolean } = {}
): FriendContactProblems {
  const out: FriendContactProblems = {};
  const email = normalizeEmail(friend.email);
  const phone = phoneKey(friend.phone);
  if (!email) {
    if (opts.requireBoth) out.email = 'กรอกอีเมลของเพื่อน';
  } else if (!EMAIL_RE.test(email)) {
    out.email = 'อีเมลของเพื่อนไม่ถูกต้อง เช่น name@example.com';
  } else if (email === normalizeEmail(owner.email)) {
    out.email = 'อีเมลของเพื่อนต้องไม่ซ้ำกับอีเมลของคุณ';
  }
  if (!phone) {
    if (opts.requireBoth) out.phone = 'กรอกเบอร์โทรของเพื่อน';
  } else if (phone === phoneKey(owner.phone)) {
    out.phone = 'เบอร์โทรของเพื่อนต้องไม่ซ้ำกับเบอร์ของคุณ';
  }
  return out;
}

export function firstFriendContactProblem(p: FriendContactProblems): string | undefined {
  return p.email ?? p.phone;
}
