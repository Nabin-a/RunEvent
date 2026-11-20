import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import {
  clearSessionCookie,
  generateSessionToken,
  hashSessionToken,
  parseCookies,
  SESSION_COOKIE_NAME,
  setSessionCookie,
  verifyPassword,
} from './auth';
import {
  db,
  DB_FILE_PATH,
  getUserById,
  insertAuditLog,
  readSystemState,
  seedDatabase,
  upsertEventRow,
  upsertMerchOrderRow,
  upsertOrganizationRow,
  upsertPayoutRow,
  upsertPlatformProfileConfig,
  upsertProductionInquiryRow,
  upsertRegistrationRow,
  upsertUserRow,
} from './db';
import { calculateFeeQuote, getCurrentTier } from '../src/utils/pricing';
import { PRIVACY_NOTICE_VERSION } from '../src/data/privacyNotice';
import { MAX_EMERGENCY_CONTACTS } from '../src/data/runnerProfileDefaults';
import { cloneCustomFieldsSchema, validateQuotaUpdate } from '../src/utils/eventConfig';
import {
  ageCheckMessage,
  buildAgeSnapshot,
  evaluateCategoryAge,
  validateAgeConfig,
  type AgeConfigInput,
} from '../src/utils/age';
import type {
  AuditLogEntry,
  AuthProviderType,
  ConditionalRule,
  CustomRegistrationField,
  EventProduct,
  EventStatus,
  FeeBearerPolicy,
  FormFieldPolicy,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizerFieldRequest,
  OrganizerVerificationWorkflowStatus,
  OrgRole,
  PayoutBatch,
  PayoutStatus,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  RunnerProfileData,
  SellerServiceModel,
  ShirtSizeMeasurement,
  ShirtStock,
  TeamInvitation,
  UserAccount,
} from '../src/types';

seedDatabase(false);

const app = express();
// Behind a reverse proxy (Caddy / nginx) set TRUST_PROXY=1 so req.ip and req.secure are the client's.
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

// Allow same-host cross-port requests (e.g. Nginx :8090 calling API :3001 on the same VM IP)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const reqHost = (req.headers.host ?? '').split(':')[0];
      if (
        originUrl.hostname === reqHost ||
        originUrl.hostname === 'localhost' ||
        originUrl.hostname === '127.0.0.1'
      ) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
          'Access-Control-Allow-Methods',
          'GET, POST, PATCH, DELETE, OPTIONS'
        );
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      }
    } catch {
      // ignore malformed origin
    }
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '12mb' }));

function nowThaiStamp(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return fmt.format(now).replace(',', '');
}

function nowIsoBangkok(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}T${pad(Number(parts.hour))}:${parts.minute}:${parts.second}+07:00`;
}

function resolveSessionUser(req: Request): {
  user: UserAccount | null;
  tokenHash: string | null;
} {
  const cookies = parseCookies(req.headers.cookie);
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return { user: null, tokenHash: null };
  const tokenHash = hashSessionToken(rawToken);
  const row = db
    .prepare('SELECT user_id, expires_at FROM auth_sessions WHERE token_hash = ?')
    .get(tokenHash) as { user_id: string; expires_at: string } | undefined;
  if (!row) return { user: null, tokenHash: null };
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
    return { user: null, tokenHash: null };
  }
  return { user: getUserById(row.user_id), tokenHash };
}

function issueSession(req: Request, res: Response, userId: string): void {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO auth_sessions (token_hash, user_id, user_agent, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, userId, String(req.headers['user-agent'] || '').slice(0, 200), createdAt, expiresAt);
  setSessionCookie(res, token);
}

function hasOrgRole(
  user: UserAccount | null,
  orgId: string,
  allowedRoles?: OrgRole[],
  eventId?: string
): boolean {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  const mem = user.memberships.find((m) => m.organizationId === orgId);
  if (!mem) return false;
  if (allowedRoles && !allowedRoles.includes(mem.role)) return false;
  if (
    eventId &&
    (mem.role === 'event_manager' || mem.role === 'staff') &&
    Array.isArray(mem.assignedEventIds) &&
    mem.assignedEventIds.length > 0 &&
    !mem.assignedEventIds.includes(eventId)
  ) {
    return false;
  }
  return true;
}

function recordAudit(
  user: UserAccount | null,
  orgId: string,
  actionSummary: string,
  detailChange: string,
  eventId?: string
): void {
  const entry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    organizationId: orgId,
    eventId,
    timestamp: nowThaiStamp(),
    actorName: user?.fullNameTh ?? 'ผู้ใช้งานระบบ',
    actorRole: user?.isPlatformAdmin
      ? 'Platform Owner'
      : user && user.memberships.length > 0
      ? 'ทีมผู้จัดงาน'
      : 'ลูกค้า / นักวิ่ง',
    actionSummary,
    detailChange,
  };
  insertAuditLog(entry);
}

/**
 * Sandbox tools = the Dev / Demo account switcher, the database reset and the
 * simulated Google / Facebook / LINE sign-in. They let anyone act as any account,
 * so they are OFF in production unless ENABLE_SANDBOX_TOOLS=1 is set on purpose.
 */
const SANDBOX_TOOLS = process.env.ENABLE_SANDBOX_TOOLS
  ? process.env.ENABLE_SANDBOX_TOOLS === '1'
  : process.env.NODE_ENV !== 'production';

function requireSandboxTools(_req: Request, res: Response, next: () => void) {
  if (!SANDBOX_TOOLS) {
    return res.status(404).json({ ok: false, error: 'ฟังก์ชันนี้ปิดใช้งานในระบบที่เปิดให้ผู้ใช้จริง' });
  }
  next();
}

function okSnapshot(res: Response, currentUserId: string | null, extra: Record<string, unknown> = {}) {
  return res.json({
    ok: true,
    currentUserId,
    state: readSystemState(),
    config: { sandboxTools: SANDBOX_TOOLS },
    ...extra,
  });
}

/* ==================== ACCOUNT ACTIVITY HELPERS ==================== */

// Version label of the terms/privacy text shown at sign-up in this local sandbox build.
// Placeholder until legal-approved documents exist; never treat it as a published policy.
const TERMS_VERSION = 'sandbox-2026-11';
const LOGIN_HISTORY_LIMIT = 50;

function describeDevice(req: Request): string {
  const ua = String(req.headers['user-agent'] || '');
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'เบราว์เซอร์';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'ไม่ทราบระบบ';
  return `${browser} บน ${os}`;
}

function withLoginEvent(
  user: UserAccount,
  req: Request,
  method: string,
  status: 'success' | 'failed'
): UserAccount {
  const entry = {
    id: `lh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: nowThaiStamp(),
    method,
    deviceLabel: describeDevice(req),
    // Local sandbox: no IP geolocation. Show a coarse label only, never a raw IP.
    ipOrLocation: 'เครือข่ายในเครื่อง (Local)',
    status,
  };
  return {
    ...user,
    loginHistory: [entry, ...(user.loginHistory ?? [])].slice(0, LOGIN_HISTORY_LIMIT),
    lastLoginAt: status === 'success' ? new Date().toISOString() : user.lastLoginAt,
  };
}

/*
 * Password change re-verification (sandbox).
 * Step 1: request a 6-digit code "sent" to the contact email (no real email in the local build;
 *         the sandbox code is SANDBOX_EMAIL_OTP, same as the existing email OTP page).
 * Step 2: verify the code -> server issues a one-time grant (10 min).
 * Step 3: POST /api/account/password must present that grant.
 * Stored in memory only: restarting the API clears pending codes and grants.
 */
const SANDBOX_EMAIL_OTP = '123456';
const PW_CODE_TTL_MS = 10 * 60 * 1000;
const PW_CODE_MAX_ATTEMPTS = 5;
const PW_CODE_RESEND_MS = 30 * 1000;
const pendingPasswordCodes = new Map<
  string,
  { issuedAt: number; expiresAt: number; attempts: number }
>();
const passwordChangeGrants = new Map<string, { grant: string; expiresAt: number }>();

function maskEmailForNotice(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  return `${local.slice(0, 2)}${'•'.repeat(Math.max(3, local.length - 2))}@${domain}`;
}

function signupConsents(marketingConsent: boolean) {
  const at = new Date().toISOString();
  const base = Date.now();
  return [
    { id: `cs-${base}-t`, type: 'terms' as const, granted: true, version: TERMS_VERSION, recordedAt: at, source: 'signup' as const },
    // Privacy notice acknowledged in the sign-up popup (PrivacyNoticeModal).
    { id: `cs-${base}-p`, type: 'privacy' as const, granted: true, version: PRIVACY_NOTICE_VERSION, recordedAt: at, source: 'signup' as const },
    { id: `cs-${base}-m`, type: 'marketing' as const, granted: marketingConsent, recordedAt: at, source: 'signup' as const },
  ];
}

/* ==================== HEALTH & BOOTSTRAP ==================== */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    engine: 'node:sqlite',
    dbFile: DB_FILE_PATH,
    timestamp: nowIsoBangkok(),
  });
});

app.get('/api/bootstrap', (req, res) => {
  const { user } = resolveSessionUser(req);
  return okSnapshot(res, user?.id ?? null);
});

/* ==================== AUTH & ACCOUNT SECURITY ==================== */

app.post('/api/auth/login', (req, res) => {
  const identifier = String(req.body?.email ?? req.body?.username ?? '')
    .trim()
    .toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!identifier || !password) {
    return res
      .status(400)
      .json({ ok: false, error: 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่านให้ครบถ้วน' });
  }
  const rows = db
    .prepare(
      'SELECT id, code, contact_email, has_password, password_hash FROM users'
    )
    .all() as {
    id: string;
    code: string;
    contact_email: string | null;
    has_password: number;
    password_hash: string | null;
  }[];

  const row = rows.find((r) => {
    const emailLower = (r.contact_email ?? '').toLowerCase();
    const localPart = emailLower.includes('@') ? emailLower.split('@')[0] : '';
    const codeLower = (r.code ?? '').toLowerCase();
    return (
      emailLower === identifier ||
      codeLower === identifier ||
      (localPart !== '' && localPart === identifier)
    );
  });

  if (!row || !row.has_password || !verifyPassword(password, row.password_hash)) {
    // Record the failed attempt on the matched account so its owner can spot it.
    if (row) {
      const target = getUserById(row.id);
      if (target) {
        upsertUserRow(withLoginEvent(target, req, 'อีเมล + รหัสผ่าน', 'failed'), {
          preservePasswordHash: true,
        });
      }
    }
    return res.status(401).json({
      ok: false,
      error:
        'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง (หากสมัครไว้ด้วย LINE, Facebook หรือ Google อย่างเดียว กรุณาเข้าสู่ระบบด้วยปุ่มช่องทางนั้น)',
    });
  }

  const user = withLoginEvent(getUserById(row.id)!, req, 'อีเมล + รหัสผ่าน', 'success');
  upsertUserRow(user, { preservePasswordHash: true });
  issueSession(req, res, user.id);
  return okSnapshot(res, user.id, { user });
});

app.post('/api/auth/verify-collision-password', (req, res) => {
  const userId = String(req.body?.userId ?? '');
  const password = String(req.body?.password ?? '');
  const row = db
    .prepare('SELECT id, has_password, password_hash FROM users WHERE id = ?')
    .get(userId) as { id: string; has_password: number; password_hash: string | null } | undefined;

  if (!row || !row.has_password || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({
      ok: false,
      error: 'รหัสผ่านของบัญชีเดิมไม่ถูกต้อง ไม่สามารถผูกบัญชีอัตโนมัติได้',
    });
  }
  const user = getUserById(row.id)!;
  const rawProv = String(req.body?.provider ?? 'google');
  const provider = (
    rawProv === 'line' ? 'line' : rawProv === 'facebook' ? 'facebook' : 'google'
  ) as 'google' | 'line' | 'facebook';
  const alreadyLinked = user.identities.some((i) => i.provider === provider);
  const updatedUser: UserAccount = alreadyLinked
    ? user
    : {
        ...user,
        identities: [
          ...user.identities,
          {
            id: `id-${provider}-${Date.now()}`,
            provider,
            providerSubject: `${provider}-verified-${Date.now()}`,
            providerEmail: user.contactEmail ?? undefined,
            linkedAt: nowThaiStamp(),
          },
        ],
      };
  upsertUserRow(updatedUser, { preservePasswordHash: true });
  issueSession(req, res, updatedUser.id);
  return okSnapshot(res, updatedUser.id, { user: updatedUser });
});

app.post('/api/auth/social-login', requireSandboxTools, (req, res) => {
  const userId = String(req.body?.userId ?? '');
  const found = getUserById(userId);
  if (!found) {
    return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีผู้ใช้' });
  }
  const provider = String(req.body?.provider ?? '').trim();
  const user = withLoginEvent(
    found,
    req,
    provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'บัญชีโซเชียล',
    'success'
  );
  upsertUserRow(user, { preservePasswordHash: true });
  issueSession(req, res, user.id);
  return okSnapshot(res, user.id, { user });
});

app.post('/api/auth/dev-switch', requireSandboxTools, (req, res) => {
  const { tokenHash } = resolveSessionUser(req);
  if (tokenHash) {
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }
  const userId = req.body?.userId ? String(req.body.userId) : null;
  if (!userId) {
    clearSessionCookie(res);
    return okSnapshot(res, null);
  }
  const found = getUserById(userId);
  if (!found) {
    return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีทดสอบที่เลือก' });
  }
  // Simulated Google/LINE/Facebook sign-in and the Dev / Demo switcher both land here.
  const user = withLoginEvent(found, req, 'เข้าสู่ระบบแบบจำลอง (Sandbox)', 'success');
  upsertUserRow(user, { preservePasswordHash: true });
  issueSession(req, res, user.id);
  return okSnapshot(res, user.id, { user });
});

app.post('/api/auth/logout', (req, res) => {
  const { tokenHash } = resolveSessionUser(req);
  if (tokenHash) {
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }
  clearSessionCookie(res);
  return okSnapshot(res, null);
});

app.post('/api/auth/register-runner', (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const fullNameTh = String(req.body?.fullNameTh ?? '').trim();
  const fullNameEn = String(req.body?.fullNameEn ?? fullNameTh).trim();
  const password = String(req.body?.password ?? '');

  if (!email || !fullNameTh) {
    return res.status(400).json({ ok: false, error: 'กรุณากรอกชื่อและอีเมลให้ครบถ้วน' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' });
  }

  const dup = db
    .prepare('SELECT id FROM users WHERE LOWER(contact_email) = ?')
    .get(email) as { id: string } | undefined;
  if (dup) {
    return res.status(409).json({
      ok: false,
      error: 'ไม่สามารถใช้ช่องทางนี้สร้างบัญชีซ้ำได้ กรุณาเข้าสู่ระบบด้วยบัญชีเดิมหรือกดลืมรหัสผ่าน',
    });
  }

  const totalUsers = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number }).cnt;
  const newUser: UserAccount = {
    id: `usr-${Date.now()}`,
    code: `USR-${totalUsers + 910}`,
    fullNameTh,
    fullNameEn,
    contactEmail: email,
    emailVerified: true,
    hasPassword: true,
    runnerProfile: req.body?.runnerProfile,
    identities: [
      {
        id: `id-pw-${Date.now()}`,
        provider: 'password',
        providerSubject: email,
        providerEmail: email,
        linkedAt: nowThaiStamp(),
      },
    ],
    sessions: [
      {
        id: `ses-${Date.now()}`,
        deviceLabel: 'เบราว์เซอร์ปัจจุบัน (เพิ่งสมัครใหม่)',
        locationHint: 'ไทย',
        lastActiveAt: 'เมื่อสักครู่',
        isCurrentDevice: true,
      },
    ],
    memberships: [],
    demoRoleSummary: 'สมาชิกใหม่สมัครด้วยอีเมล (Runner 2-Step Wizard)',
    isDemoPreset: false,
    createdAt: new Date().toISOString(),
    passwordChangedAt: new Date().toISOString(),
    consents: signupConsents(Boolean(req.body?.marketingConsent)),
  };

  upsertUserRow(withLoginEvent(newUser, req, 'สมัครสมาชิกด้วยอีเมล', 'success'), {
    passwordPlain: password,
    sortOrder: totalUsers + 10,
  });
  issueSession(req, res, newUser.id);
  return okSnapshot(res, newUser.id, { user: newUser });
});

app.post('/api/auth/register-social', requireSandboxTools, (req, res) => {
  const rawProv = String(req.body?.provider ?? 'google');
  const provider = (
    rawProv === 'line' ? 'line' : rawProv === 'facebook' ? 'facebook' : 'google'
  ) as 'google' | 'line' | 'facebook';
  const fullNameTh = String(req.body?.fullNameTh ?? 'สมาชิกใหม่').trim();
  const incomingProf = req.body?.runnerProfile as RunnerProfileData | undefined;
  const derivedEn =
    incomingProf?.firstNameEn || incomingProf?.lastNameEn
      ? `${incomingProf?.firstNameEn ?? ''} ${incomingProf?.lastNameEn ?? ''}`.trim()
      : '';
  const fullNameEn = String(req.body?.fullNameEn || derivedEn || fullNameTh).trim();
  const rawEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;

  if (rawEmail) {
    const dup = db
      .prepare('SELECT id FROM users WHERE LOWER(contact_email) = ?')
      .get(rawEmail) as { id: string } | undefined;
    if (dup) {
      return res.status(409).json({
        ok: false,
        error: 'พบอีเมลตรงกับบัญชีเดิม — ต้องยืนยันเจ้าของก่อนเชื่อม',
      });
    }
  }

  const totalUsers = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number }).cnt;
  const newUser: UserAccount = {
    id: `usr-soc-${Date.now()}`,
    code: `USR-${totalUsers + 920}`,
    fullNameTh,
    fullNameEn,
    contactEmail: rawEmail,
    emailVerified: Boolean(rawEmail),
    hasPassword: false,
    runnerProfile: req.body?.runnerProfile,
    identities: [
      {
        id: `id-soc-${Date.now()}`,
        provider,
        providerSubject: `${provider}-uid-${Date.now()}`,
        providerEmail: rawEmail ?? undefined,
        linkedAt: nowThaiStamp(),
      },
    ],
    sessions: [
      {
        id: `ses-soc-${Date.now()}`,
        deviceLabel: `เข้าผ่าน ${provider.toUpperCase()} (เครื่องปัจจุบัน)`,
        locationHint: 'ไทย',
        lastActiveAt: 'เมื่อสักครู่',
        isCurrentDevice: true,
      },
    ],
    memberships: [],
    demoRoleSummary: `สมาชิกใหม่ผ่าน ${provider.toUpperCase()}`,
    isDemoPreset: false,
    createdAt: new Date().toISOString(),
    consents: signupConsents(Boolean(req.body?.marketingConsent)),
  };

  upsertUserRow(
    withLoginEvent(newUser, req, `สมัครสมาชิกผ่าน ${provider.toUpperCase()} (จำลอง)`, 'success'),
    { sortOrder: totalUsers + 10 }
  );
  issueSession(req, res, newUser.id);
  return okSnapshot(res, newUser.id, { user: newUser });
});

app.post('/api/auth/register-organizer', (req, res) => {
  const { user: sessionUser } = resolveSessionUser(req);
  const p = req.body ?? {};
  const email = String(p.email ?? '').trim().toLowerCase();
  const password = String(p.password ?? 'demo1234');

  const orgCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM organizations').get() as { cnt: number }
  ).cnt;
  const userCount = (db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number }).cnt;

  const newOrgId = String(p.clientOrgId || `org-onb-${Date.now()}`);
  const refNo = `ORG-REF-2026-${8840 + orgCount + 1}`;
  const newOrg: Organization = {
    id: newOrgId,
    code: `ORG-NEW-${orgCount + 10}`,
    nameTh: String(p.orgNameTh ?? '').trim(),
    nameEn: String(p.orgNameEn ?? '').trim(),
    province: String(p.province ?? 'เชียงใหม่'),
    verificationStatus: 'pending_review',
    workflowStatus: 'SUBMITTED',
    referenceNumber: refNo,
    orgType: p.orgType,
    businessRegNumber: p.businessRegNumber,
    website: p.website,
    orgPhone: p.orgPhone,
    officeAddress: {
      address: String(p.address ?? ''),
      province: String(p.province ?? ''),
      district: String(p.district ?? ''),
      subdistrict: String(p.subdistrict ?? ''),
      postalCode: String(p.postalCode ?? ''),
      country: 'Thailand',
    },
    descriptionTh: p.descriptionTh,
    previousEvents: p.previousEvents,
    facebookPage: p.facebookPage,
    mainContact: {
      name: String(p.mainContactName ?? ''),
      position: String(p.mainContactPosition ?? ''),
      phone: String(p.mainContactPhone ?? ''),
      email: String(p.mainContactEmail ?? ''),
    },
    documents: Array.isArray(p.documents) ? p.documents : [],
    verificationHistory: [
      {
        id: `vh-${Date.now()}`,
        status: 'SUBMITTED',
        actorName: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
        note: `ยื่นคำขอขึ้นทะเบียนผู้จัดงาน (${p.orgType}) พร้อมเอกสาร ${(p.documents ?? []).length} รายการ`,
        timestamp: nowThaiStamp(),
      },
    ],
    submittedAt: nowThaiStamp(),
    payoutBankSummary: 'รอ Platform Owner ตรวจสอบเอกสารนิติบุคคลและบัญชีรับเงิน',
    payoutReady: false,
    contactEmail: String(p.orgEmail || email),
  };

  const existingByEmailRow = email
    ? (db
        .prepare('SELECT id FROM users WHERE LOWER(contact_email) = ?')
        .get(email) as { id: string } | undefined)
    : undefined;
  const existingUser =
    sessionUser ?? (existingByEmailRow ? getUserById(existingByEmailRow.id) : null);

  let targetUser: UserAccount;
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertOrganizationRow(newOrg, orgCount + 10);
    if (existingUser) {
      targetUser = {
        ...existingUser,
        memberships: [
          ...existingUser.memberships.filter((m) => m.organizationId !== newOrgId),
          { organizationId: newOrgId, role: 'owner' },
        ],
      };
      upsertUserRow(targetUser, { preservePasswordHash: true });
    } else {
      const fullName = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || 'ผู้จัดงานใหม่';
      targetUser = {
        id: `usr-org-${Date.now()}`,
        code: `USR-${userCount + 930}`,
        fullNameTh: fullName,
        fullNameEn: fullName,
        contactEmail: email || null,
        emailVerified: true,
        hasPassword: true,
        identities: [
          {
            id: `id-org-pw-${Date.now()}`,
            provider: 'password',
            providerSubject: email,
            providerEmail: email,
            linkedAt: nowThaiStamp(),
          },
        ],
        sessions: [
          {
            id: `ses-org-${Date.now()}`,
            deviceLabel: 'เบราว์เซอร์ปัจจุบัน (ขึ้นทะเบียนผู้จัด)',
            locationHint: `${newOrg.province}, ไทย`,
            lastActiveAt: 'เมื่อสักครู่',
            isCurrentDevice: true,
          },
        ],
        memberships: [{ organizationId: newOrgId, role: 'owner' }],
        demoRoleSummary: `ผู้จัดงานใหม่ (${newOrg.nameTh})`,
        isDemoPreset: false,
      };
      upsertUserRow(targetUser, {
        passwordPlain: password.length >= 8 ? password : 'demo1234',
        sortOrder: userCount + 10,
      });
    }

    recordAudit(
      targetUser,
      newOrgId,
      `ยื่นคำขอขึ้นทะเบียนผู้จัดงานใหม่ (${refNo})`,
      `${newOrg.nameTh} · สถานะเริ่มต้น SUBMITTED (PENDING_REVIEW)`
    );
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  issueSession(req, res, targetUser.id);
  return okSnapshot(res, targetUser.id, { user: targetUser, organization: newOrg });
});

app.patch('/api/account/profile', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const incoming = (req.body?.profile ?? {}) as RunnerProfileData;
  if ((incoming.emergencyContacts?.length ?? 0) > MAX_EMERGENCY_CONTACTS) {
    return res.status(400).json({
      ok: false,
      error: `บันทึกผู้ติดต่อฉุกเฉินได้สูงสุด ${MAX_EMERGENCY_CONTACTS} คน`,
    });
  }
  const fullNameTh = String(
    req.body?.fullNameTh ||
      (incoming.firstName && incoming.lastName
        ? `${incoming.firstName.trim()} ${incoming.lastName.trim()}`.trim()
        : user.fullNameTh)
  );
  const fullNameEn = String(
    req.body?.fullNameEn ||
      (incoming.firstNameEn || incoming.lastNameEn
        ? `${incoming.firstNameEn ?? ''} ${incoming.lastNameEn ?? ''}`.trim()
        : user.fullNameEn)
  );

  // Sync legacy primary emergency contact fields for backward compatibility
  const primaryEc =
    incoming.emergencyContacts?.find((c) => c.isPrimary) ??
    incoming.emergencyContacts?.[0];
  const mergedProfile: RunnerProfileData = {
    ...user.runnerProfile,
    ...incoming,
    phoneVerified: Boolean(
      (incoming.phone ?? user.runnerProfile?.phone ?? '').trim()
    ),
    emergencyContactName: primaryEc?.contactName ?? incoming.emergencyContactName,
    emergencyContactRelation: primaryEc?.relationship ?? incoming.emergencyContactRelation,
    emergencyContactPhone: primaryEc?.phone ?? incoming.emergencyContactPhone,
  };

  // Achievements remain strictly server/system controlled (Runner cannot overwrite)
  const updated: UserAccount = {
    ...user,
    fullNameTh,
    fullNameEn,
    runnerProfile: mergedProfile,
  };
  upsertUserRow(updated, { preservePasswordHash: true });

  recordAudit(
    updated,
    'PLATFORM-HQ',
    `อัปเดตข้อมูล Runner Profile (${updated.code})`,
    `Preferred Shirt: ${mergedProfile.preferredShirtSize ?? '-'} · Addresses: ${
      mergedProfile.savedAddresses?.length ?? 0
    } · Emergency Contacts: ${mergedProfile.emergencyContacts?.length ?? 0}`
  );
  return okSnapshot(res, updated.id, { user: updated });
});

app.post('/api/account/verify-phone', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const phone = String(req.body?.phone ?? '').trim();
  const otp = String(req.body?.otp ?? '').trim();
  if (phone.replace(/\D/g, '').length < 9) {
    return res.status(400).json({ ok: false, error: 'กรุณาระบุเบอร์โทรศัพท์ให้ครบ 9–10 หลัก' });
  }
  if (otp && otp !== '123456') {
    return res.status(400).json({ ok: false, error: 'รหัสยืนยัน OTP ไม่ถูกต้อง (ทดสอบใช้ 123456)' });
  }
  const updatedProfile: RunnerProfileData = {
    ...user.runnerProfile,
    phone,
    phoneVerified: true,
  };
  const updated: UserAccount = { ...user, runnerProfile: updatedProfile };
  upsertUserRow(updated, { preservePasswordHash: true });
  recordAudit(updated, 'PLATFORM-HQ', `ยืนยันเบอร์โทรศัพท์ใหม่ (${updated.code})`, phone);
  return okSnapshot(res, updated.id, { user: updated });
});

app.post('/api/account/status', (req, res) => {
  const { user, tokenHash } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const action = String(req.body?.action ?? '');
  const reason = String(req.body?.reason ?? '').trim();

  if (action === 'deactivate') {
    const updated: UserAccount = { ...user, accountStatus: 'deactivated' };
    upsertUserRow(updated, { preservePasswordHash: true });
    recordAudit(
      updated,
      'PLATFORM-HQ',
      `ผู้ใช้สั่งปิดพักบัญชีชั่วคราว (${updated.code})`,
      reason || 'Account Deactivated by User'
    );
    if (tokenHash) {
      db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
    }
    clearSessionCookie(res);
    return okSnapshot(res, null);
  }

  if (action === 'request_deletion') {
    const confirmCode = String(req.body?.confirmCode ?? '').trim().toUpperCase();
    if (confirmCode !== user.code.toUpperCase()) {
      return res.status(400).json({
        ok: false,
        error: `กรุณาพิมพ์รหัสบัญชี ${user.code} ให้ถูกต้องเพื่อยืนยันคำขอลบบัญชี`,
      });
    }
    const updated: UserAccount = {
      ...user,
      accountStatus: 'deletion_requested',
      deletionRequestReason: reason || 'ขอลบบัญชีตามนโยบายความเป็นส่วนตัว',
      deletionRequestedAt: nowThaiStamp(),
    };
    upsertUserRow(updated, { preservePasswordHash: true });
    recordAudit(
      updated,
      'PLATFORM-HQ',
      `ส่งคำขอลบบัญชีผู้ใช้งาน (${updated.code})`,
      updated.deletionRequestReason!
    );
    return okSnapshot(res, updated.id, { user: updated });
  }

  if (action === 'cancel_deletion') {
    const updated: UserAccount = {
      ...user,
      accountStatus: 'active',
      deletionRequestReason: undefined,
      deletionRequestedAt: undefined,
    };
    upsertUserRow(updated, { preservePasswordHash: true });
    recordAudit(updated, 'PLATFORM-HQ', `ยกเลิกคำขอลบบัญชี (${updated.code})`, 'active');
    return okSnapshot(res, updated.id, { user: updated });
  }

  return res.status(400).json({ ok: false, error: 'ไม่รู้จักคำสั่งจัดการสถานะบัญชี' });
});

app.post('/api/account/verify-email', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const otp = req.body?.otp !== undefined ? String(req.body.otp).trim() : undefined;
  if (!email) return res.status(400).json({ ok: false, error: 'กรุณาระบุอีเมล' });
  if (otp !== undefined && otp !== '123456') {
    return res.status(400).json({ ok: false, error: 'รหัสยืนยัน OTP อีเมลไม่ถูกต้อง (ทดสอบใช้ 123456)' });
  }
  const dup = db
    .prepare('SELECT id FROM users WHERE LOWER(contact_email) = ? AND id != ?')
    .get(email, user.id) as { id: string } | undefined;
  if (dup) {
    return res.status(409).json({ ok: false, error: 'อีเมลนี้ถูกผูกกับบัญชีอื่นในระบบแล้ว' });
  }
  const updated: UserAccount = { ...user, contactEmail: email, emailVerified: true };
  upsertUserRow(updated, { preservePasswordHash: true });
  recordAudit(updated, 'PLATFORM-HQ', `ยืนยันอีเมลติดต่อ (${updated.code})`, email);
  return okSnapshot(res, updated.id, { user: updated });
});

app.post('/api/account/password/request-code', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  if (!user.contactEmail) {
    return res.status(400).json({
      ok: false,
      error: 'บัญชีนี้ยังไม่มีอีเมลติดต่อ กรุณาเพิ่มอีเมลก่อนเปลี่ยนรหัสผ่าน',
    });
  }
  const prev = pendingPasswordCodes.get(user.id);
  const now = Date.now();
  if (prev && now - prev.issuedAt < PW_CODE_RESEND_MS) {
    const wait = Math.ceil((PW_CODE_RESEND_MS - (now - prev.issuedAt)) / 1000);
    return res.status(429).json({ ok: false, error: `กรุณารอ ${wait} วินาทีก่อนขอรหัสใหม่` });
  }
  pendingPasswordCodes.set(user.id, { issuedAt: now, expiresAt: now + PW_CODE_TTL_MS, attempts: 0 });
  passwordChangeGrants.delete(user.id);
  recordAudit(user, 'PLATFORM-HQ', `ขอรหัสยืนยันเพื่อเปลี่ยนรหัสผ่าน (${user.code})`, 'sandbox-email');
  return res.json({
    ok: true,
    data: { sentTo: maskEmailForNotice(user.contactEmail), expiresInSec: PW_CODE_TTL_MS / 1000 },
  });
});

app.post('/api/account/password/verify-code', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const pending = pendingPasswordCodes.get(user.id);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingPasswordCodes.delete(user.id);
    return res.status(400).json({ ok: false, error: 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่' });
  }
  if (pending.attempts >= PW_CODE_MAX_ATTEMPTS) {
    pendingPasswordCodes.delete(user.id);
    return res.status(429).json({ ok: false, error: 'กรอกรหัสผิดเกินกำหนด กรุณาขอรหัสใหม่' });
  }
  const otp = String(req.body?.otp ?? '').trim();
  if (otp !== SANDBOX_EMAIL_OTP) {
    pending.attempts += 1;
    const left = PW_CODE_MAX_ATTEMPTS - pending.attempts;
    return res.status(400).json({
      ok: false,
      error: `รหัสยืนยันไม่ถูกต้อง (เหลืออีก ${left} ครั้ง)`,
    });
  }
  pendingPasswordCodes.delete(user.id);
  const grant = generateSessionToken();
  passwordChangeGrants.set(user.id, { grant, expiresAt: Date.now() + PW_CODE_TTL_MS });
  return res.json({ ok: true, data: { grant } });
});

app.post('/api/account/password', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const newPassword = String(req.body?.newPassword ?? 'demo1234');
  const hasPwIdentity = user.identities.some((i) => i.provider === 'password');
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร' });
  }
  const grant = String(req.body?.grant ?? '');
  const stored = passwordChangeGrants.get(user.id);
  if (!stored || stored.grant !== grant || stored.expiresAt < Date.now()) {
    return res.status(403).json({
      ok: false,
      error: 'กรุณายืนยันตัวตนด้วยรหัสทางอีเมลก่อนเปลี่ยนรหัสผ่าน (สิทธิ์หมดอายุหรือไม่ถูกต้อง)',
    });
  }
  passwordChangeGrants.delete(user.id);
  const updated: UserAccount = {
    ...user,
    hasPassword: true,
    passwordChangedAt: new Date().toISOString(),
    identities: hasPwIdentity
      ? user.identities
      : [
          ...user.identities,
          {
            id: `id-pw-${Date.now()}`,
            provider: 'password',
            providerSubject: user.contactEmail ?? user.code,
            linkedAt: nowThaiStamp(),
          },
        ],
  };
  upsertUserRow(updated, { passwordPlain: newPassword });
  return okSnapshot(res, updated.id, { user: updated });
});

app.post('/api/account/providers', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const rawProv = String(req.body?.provider ?? 'google');
  const provider = (
    rawProv === 'line' ? 'line' : rawProv === 'facebook' ? 'facebook' : 'google'
  ) as 'google' | 'line' | 'facebook';
  if (user.identities.some((i) => i.provider === provider)) {
    return okSnapshot(res, user.id);
  }
  const updated: UserAccount = {
    ...user,
    identities: [
      ...user.identities,
      {
        id: `id-${provider}-${Date.now()}`,
        provider,
        providerSubject: `${provider}-linked-${Date.now()}`,
        linkedAt: nowThaiStamp(),
      },
    ],
  };
  upsertUserRow(updated, { preservePasswordHash: true });
  return okSnapshot(res, updated.id);
});

app.delete('/api/account/providers/:provider', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const provider = req.params.provider as AuthProviderType;
  if (user.identities.length <= 1) {
    return res.status(400).json({
      ok: false,
      error:
        'ไม่อนุญาตให้ถอดช่องทางเข้าสู่ระบบช่องทางสุดท้าย กรุณาเพิ่มรหัสผ่านหรือเชื่อมช่องทางอื่นทดแทนก่อน',
    });
  }
  const updated: UserAccount = {
    ...user,
    hasPassword: provider === 'password' ? false : user.hasPassword,
    identities: user.identities.filter((i) => i.provider !== provider),
  };
  upsertUserRow(updated, { preservePasswordHash: provider !== 'password' });
  return okSnapshot(res, updated.id);
});

app.delete('/api/account/sessions/:id', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const target = user.sessions.find((s) => s.id === req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'ไม่พบอุปกรณ์นี้ในบัญชี' });
  if (target.isCurrentDevice) {
    return res.status(400).json({
      ok: false,
      error: 'ออกจากระบบเครื่องที่กำลังใช้งานอยู่ได้จากเมนูบัญชี (ออกจากระบบ)',
    });
  }
  const updated: UserAccount = {
    ...user,
    sessions: user.sessions.filter((s) => s.id !== target.id),
  };
  upsertUserRow(updated, { preservePasswordHash: true });
  recordAudit(updated, 'PLATFORM-HQ', `ออกจากระบบอุปกรณ์ (${updated.code})`, target.deviceLabel);
  return okSnapshot(res, updated.id);
});

app.post('/api/account/consents', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const type = String(req.body?.type ?? '');
  // Privacy notice acknowledgement after sign-in (new version or no record yet).
  // Only the current version can be acknowledged, and it cannot be "withdrawn" here.
  if (type === 'privacy') {
    const version = String(req.body?.version ?? '');
    if (version !== PRIVACY_NOTICE_VERSION) {
      return res.status(400).json({ ok: false, error: 'เวอร์ชันประกาศความเป็นส่วนตัวไม่ตรงกับฉบับปัจจุบัน' });
    }
    const acknowledged: UserAccount = {
      ...user,
      consents: [
        ...(user.consents ?? []),
        {
          id: `cs-${Date.now()}-p`,
          type: 'privacy',
          granted: true,
          version: PRIVACY_NOTICE_VERSION,
          recordedAt: new Date().toISOString(),
          source: 'login_prompt',
        },
      ],
    };
    upsertUserRow(acknowledged, { preservePasswordHash: true });
    recordAudit(acknowledged, 'PLATFORM-HQ', `รับทราบประกาศความเป็นส่วนตัว (${acknowledged.code})`, PRIVACY_NOTICE_VERSION);
    return okSnapshot(res, acknowledged.id);
  }
  if (type !== 'marketing') {
    // Terms acceptance is captured at sign-up only; it cannot be toggled here.
    return res.status(400).json({ ok: false, error: 'ปรับได้เฉพาะการยินยอมรับข่าวสารการตลาด' });
  }
  const granted = Boolean(req.body?.granted);
  const updated: UserAccount = {
    ...user,
    consents: [
      ...(user.consents ?? []),
      {
        id: `cs-${Date.now()}-m`,
        type: 'marketing',
        granted,
        recordedAt: new Date().toISOString(),
        source: 'account_settings',
      },
    ],
  };
  upsertUserRow(updated, { preservePasswordHash: true });
  recordAudit(
    updated,
    'PLATFORM-HQ',
    `${granted ? 'ยินยอม' : 'ยกเลิกการยินยอม'}รับข่าวสารการตลาด (${updated.code})`,
    'marketing'
  );
  return okSnapshot(res, updated.id);
});

// Personal data copy (PDPA right of access). Returns only the signed-in user's own records.
app.get('/api/account/export', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const state = readSystemState();
  const email = (user.contactEmail ?? '').toLowerCase();
  const registrations = state.registrations.filter(
    (r) => r.runnerUserId === user.id || (email !== '' && r.email.toLowerCase() === email)
  );
  const { demoPasswordHint: _hint, ...safeUser } = user;
  recordAudit(user, 'PLATFORM-HQ', `ดาวน์โหลดสำเนาข้อมูลส่วนบุคคล (${user.code})`, 'export');
  return res.json({
    ok: true,
    data: {
      exportedAt: new Date().toISOString(),
      note: 'สำเนาข้อมูลจากระบบ กระต่าย บนเครื่อง (Local sandbox) — ไม่รวมรหัสผ่านหรือข้อมูลลับ',
      account: safeUser,
      registrations,
    },
  });
});

app.post('/api/account/revoke-sessions', (req, res) => {
  const { user, tokenHash } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  if (tokenHash) {
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ? AND token_hash != ?').run(
      user.id,
      tokenHash
    );
  }
  const updated: UserAccount = {
    ...user,
    sessions: user.sessions.filter((s) => s.isCurrentDevice),
  };
  upsertUserRow(updated, { preservePasswordHash: true });
  return okSnapshot(res, updated.id);
});

/* ==================== INVITATIONS & QUICK ORG APPLY ==================== */

app.post('/api/invitations/accept', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  const invRow = db
    .prepare('SELECT * FROM invitations WHERE UPPER(invite_code) = ?')
    .get(code) as Record<string, unknown> | undefined;
  if (!invRow) {
    return res.status(404).json({ ok: false, error: 'ไม่พบรหัสคำเชิญนี้ในระบบ' });
  }
  if (invRow.used_by_user_id) {
    return res.status(409).json({
      ok: false,
      error: 'รหัสคำเชิญนี้ถูกใช้งานไปแล้ว (คำเชิญทีมจำกัดการใช้เพียงครั้งเดียว)',
    });
  }
  const orgId = String(invRow.organization_id);
  if (user.memberships.some((m) => m.organizationId === orgId)) {
    return res.status(409).json({ ok: false, error: 'บัญชีของคุณเป็นสมาชิกขององค์กรนี้อยู่แล้ว' });
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE invitations SET used_by_user_id = ? WHERE id = ?').run(
      user.code,
      String(invRow.id)
    );
    const updatedUser: UserAccount = {
      ...user,
      memberships: [
        ...user.memberships,
        {
          organizationId: orgId,
          role: invRow.role as OrgRole,
          assignedEventIds: invRow.assigned_event_ids_json
            ? (JSON.parse(String(invRow.assigned_event_ids_json)) as string[])
            : undefined,
        },
      ],
    };
    upsertUserRow(updatedUser, { preservePasswordHash: true });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  return okSnapshot(res, user.id);
});

app.post('/api/invitations', (req, res) => {
  const { user } = resolveSessionUser(req);
  const orgId = String(req.body?.orgId ?? '');
  const role = (req.body?.role ?? 'staff') as OrgRole;
  if (!hasOrgRole(user, orgId, ['owner'])) {
    return res.status(403).json({ ok: false, error: 'เฉพาะเจ้าขององค์กรจึงออกรหัสคำเชิญได้' });
  }
  const inv: TeamInvitation = {
    id: String(req.body?.id || `inv-${Date.now()}`),
    inviteCode: String(
      req.body?.inviteCode ||
        `INV-${role.toUpperCase().slice(0, 4)}-${Math.floor(100 + Math.random() * 899)}`
    ),
    organizationId: orgId,
    role,
    expiresAt: '2026-12-15',
  };
  db.prepare(`
    INSERT INTO invitations (id, sort_order, invite_code, organization_id, role, expires_at)
    VALUES (?, 1, ?, ?, ?, ?)
  `).run(inv.id, inv.inviteCode, inv.organizationId, inv.role, inv.expiresAt);
  return okSnapshot(res, user!.id, { invitation: inv });
});

app.post('/api/organizations', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'กรุณาเข้าสู่ระบบก่อน' });
  const orgNameTh = String(req.body?.orgNameTh ?? '').trim();
  const province = String(req.body?.province ?? 'เชียงใหม่').trim();
  const orgCount = (
    db.prepare('SELECT COUNT(*) AS cnt FROM organizations').get() as { cnt: number }
  ).cnt;
  const newOrg: Organization = {
    id: String(req.body?.id || `org-custom-${Date.now()}`),
    code: `ORG-NEW-0${orgCount + 1}`,
    nameTh: orgNameTh.includes('(รอตรวจสอบผู้จัด)')
      ? orgNameTh
      : `${orgNameTh} (รอตรวจสอบผู้จัด)`,
    nameEn: orgNameTh,
    province,
    verificationStatus: 'pending_review',
    payoutBankSummary: 'รอยืนยันเอกสารผู้จัดและบัญชีธนาคารรับยอดนำส่ง',
    payoutReady: false,
    contactEmail: user.contactEmail ?? 'pending@demo.local',
  };
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertOrganizationRow(newOrg, orgCount + 10);
    const updatedUser: UserAccount = {
      ...user,
      memberships: [
        ...user.memberships.filter((m) => m.organizationId !== newOrg.id),
        { organizationId: newOrg.id, role: 'owner' },
      ],
    };
    upsertUserRow(updatedUser, { preservePasswordHash: true });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return okSnapshot(res, user.id, { organization: newOrg });
});

/* ==================== REGISTRATIONS & MERCH ORDERS (ATOMIC) ==================== */

app.post('/api/registrations', (req, res) => {
  const { user } = resolveSessionUser(req);
  const payload = req.body ?? {};
  const eventId = String(payload.eventId ?? '');
  const categoryId = String(payload.categoryId ?? '');

  db.exec('BEGIN IMMEDIATE');
  try {
    const evRow = db
      .prepare('SELECT detail_json FROM events WHERE id = ?')
      .get(eventId) as { detail_json: string } | undefined;
    if (!evRow) {
      db.exec('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'ไม่พบงานวิ่งที่เลือก' });
    }
    const ev = JSON.parse(evRow.detail_json) as RaceEvent;
    if (ev.status !== 'published') {
      db.exec('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'งานวิ่งนี้ไม่ได้เปิดรับสมัครในขณะนี้' });
    }
    const cat = ev.categories.find((c) => c.id === categoryId);
    if (!cat) {
      db.exec('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'ไม่พบระยะการแข่งขันที่เลือก' });
    }

    // Age eligibility is checked on the server too; the browser check is only a hint.
    const participantDob = String(payload.participantSnapshot?.dateOfBirth ?? '').trim();
    const participantGender = payload.participantSnapshot?.gender
      ? String(payload.participantSnapshot.gender)
      : null;
    const ageCheck = evaluateCategoryAge(ev, cat, participantDob, participantGender);
    if (!ageCheck.eligible) {
      db.exec('ROLLBACK');
      return res.status(400).json({
        ok: false,
        error: ageCheckMessage(ageCheck, cat) ?? 'ผู้เข้าแข่งขันไม่ผ่านเกณฑ์อายุของระยะนี้',
      });
    }

    // Atomic quota checks inside SQLite transaction
    const activeEventSeats = (
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM registrations
           WHERE event_id = ? AND registration_status IN ('confirmed', 'pending_payment')`
        )
        .get(ev.id) as { cnt: number }
    ).cnt;
    const activeCategorySeats = (
      db
        .prepare(
          `SELECT COUNT(*) AS cnt FROM registrations
           WHERE event_id = ? AND category_id = ? AND registration_status IN ('confirmed', 'pending_payment')`
        )
        .get(ev.id, cat.id) as { cnt: number }
    ).cnt;

    if (activeEventSeats >= ev.totalEventQuota || activeCategorySeats >= cat.categoryQuota) {
      db.exec('ROLLBACK');
      return res.status(409).json({
        ok: false,
        error: 'ขออภัย โควตาเต็มแล้ว ระบบป้องกันการขายเกินอัตโนมัติ',
      });
    }

    const shirtSize = payload.shirtSize as RegistrationRecord['shirtSize'];
    const shirtSlot = ev.shirtStocks.find((s) => s.size === shirtSize);
    if (shirtSlot && shirtSlot.reservedOrConfirmed >= shirtSlot.total) {
      db.exec('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'สต็อกไซส์นี้เต็มแล้ว' });
    }

    // Server-side fee calculation (authoritative integer satang)
    const tier = getCurrentTier(cat);
    const quote = calculateFeeQuote(tier.priceSatang, ev.feeBearerPolicy);
    const regCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM registrations').get() as { cnt: number }
    ).cnt;
    const seq = regCount + 101;
    const regCode = String(payload.regCode || `REG-2611-${seq}`);
    const orderCode = String(payload.orderCode || `ORD-89${seq}`);
    const tokenSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const immediate = Boolean(payload.simulateImmediateWebhook);
    const createdIso = nowIsoBangkok();

    const newReg: RegistrationRecord = {
      id: String(payload.id || `reg-dyn-${Date.now()}`),
      regCode,
      orderCode,
      eventId: ev.id,
      organizationId: ev.organizationId,
      categoryId: cat.id,
      runnerUserId: user?.id,
      buyerName: String(payload.buyerName ?? ''),
      participantNameTh: String(payload.participantNameTh ?? ''),
      participantNameEn: String(payload.participantNameEn ?? ''),
      email: user?.contactEmail ?? 'verified.runner@demo.local',
      phoneMasked: String(
        payload.phone || user?.runnerProfile?.phone || '081-•••-9900'
      ),
      emergencyContact: String(
        payload.emergencyContact ||
          (user?.runnerProfile?.emergencyContactName &&
          user?.runnerProfile?.emergencyContactPhone
            ? `${user.runnerProfile.emergencyContactName} (${
                user.runnerProfile.emergencyContactRelation ?? 'ฉุกเฉิน'
              }) ${user.runnerProfile.emergencyContactPhone}`
            : 'ผู้ติดต่อฉุกเฉินจำลอง 089-•••-0011')
      ),
      shirtSize,
      kitDeliveryMethod:
        payload.kitDeliveryMethod === 'postal_shipping'
          ? 'postal_shipping'
          : 'pickup_at_expo',
      shippingAddressSnapshot: payload.shippingAddressSnapshot
        ? String(payload.shippingAddressSnapshot)
        : undefined,
      participantSnapshot: payload.participantSnapshot,
      customAnswers: payload.customAnswers,
      bibNumber: null,
      qrCheckInToken: String(payload.qrCheckInToken || `TKN-${cat.bibPrefix}${seq}-${tokenSuffix}`),
      acceptedRulesVersion: ev.rulesVersion,
      marketingConsent: Boolean(payload.marketingConsent),
      createdAt: createdIso,
      paidAt: immediate ? createdIso : null,
      refundedAt: null,
      reservationExpiresAt: immediate
        ? null
        : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      registrationStatus: immediate ? 'confirmed' : 'pending_payment',
      paymentStatus: immediate ? 'succeeded' : 'pending',
      refundStatus: 'none',
      fulfillmentStatus: immediate ? 'ready' : 'not_ready',
      snapshotBaseSatang: quote.baseSatang,
      snapshotPlatformFeeSatang: quote.platformFeeSatang,
      snapshotRunnerFeeSatang: quote.runnerFeeSatang,
      snapshotOrganizerFeeSatang: quote.organizerFeeSatang,
      snapshotTotalChargedSatang: quote.runnerNetPaySatang,
      snapshotRefundedSatang: 0,
    };
    const ageSnapshot = participantDob
      ? buildAgeSnapshot(ageCheck, participantDob, createdIso)
      : undefined;
    if (ageSnapshot) {
      newReg.ageSnapshot = ageSnapshot;
      newReg.age = ageSnapshot.ageYears;
    }
    if (participantGender === 'ชาย' || participantGender === 'หญิง' || participantGender === 'ไม่ระบุ') {
      newReg.gender = participantGender;
    }

    let addonOrder: MerchOrderRecord | undefined;
    if (payload.addonProductId || payload.addonProduct) {
      const prdId = String(payload.addonProductId ?? payload.addonProduct?.id ?? '');
      const prd = ev.products.find((p) => p.id === prdId);
      if (prd) {
        const mCount = (
          db.prepare('SELECT COUNT(*) AS cnt FROM merch_orders').get() as { cnt: number }
        ).cnt;
        const mSeq = mCount + 510;
        addonOrder = {
          id: String(payload.addonOrderId || `mord-dyn-${Date.now()}`),
          merchOrderCode: String(payload.addonOrderCode || `SHP-2611-${mSeq}`),
          eventId: ev.id,
          organizationId: ev.organizationId,
          buyerUserId: user?.id,
          buyerName: newReg.buyerName,
          buyerEmail: user?.contactEmail ?? 'ติดต่อผ่านบัญชีผู้ใช้',
          productId: prd.id,
          productNameTh: prd.nameTh,
          sellerLabel: prd.sellerLabel,
          variantSize: String(payload.addonSize ?? 'M'),
          quantity: 1,
          deliveredQty: 0,
          deliveryMethod: 'pickup_at_expo',
          unitPriceSatang: prd.priceSatang,
          shippingSatang: 0,
          totalPaidSatang: prd.priceSatang,
          paymentStatus: immediate ? 'succeeded' : 'pending',
          fulfillmentStatus: 'ready_or_shipped',
          pickupToken: String(payload.addonPickupToken || `PICK-SHP-${mSeq}`),
          linkedRegistrationCode: regCode,
          createdAt: createdIso,
        };
      }
    }

    const updatedEv: RaceEvent = {
      ...ev,
      shirtStocks: ev.shirtStocks.map((st) =>
        st.size === shirtSize
          ? { ...st, reservedOrConfirmed: st.reservedOrConfirmed + 1 }
          : st
      ),
      products: addonOrder
        ? ev.products.map((p) =>
            p.id === addonOrder!.productId ? { ...p, soldCount: p.soldCount + 1 } : p
          )
        : ev.products,
    };

    upsertEventRow(updatedEv);
    upsertRegistrationRow(newReg, 1);
    if (addonOrder) upsertMerchOrderRow(addonOrder, 1);

    recordAudit(
      user,
      ev.organizationId,
      `สมัครวิ่งรายการใหม่ (${regCode})${
        addonOrder ? ` พร้อมซื้อสินค้าเพิ่ม (${addonOrder.merchOrderCode})` : ''
      }`,
      `${cat.code} · เสื้อ ${shirtSize}`,
      ev.id
    );
    db.exec('COMMIT');
    return okSnapshot(res, user?.id ?? null, { reg: newReg, addonOrder });
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

app.patch('/api/registrations/:id/shirt-size', (req, res) => {
  const { user } = resolveSessionUser(req);
  const regId = req.params.id;
  const newSize = req.body?.newSize as RegistrationRecord['shirtSize'];

  db.exec('BEGIN IMMEDIATE');
  try {
    const rRow = db
      .prepare('SELECT detail_json FROM registrations WHERE id = ?')
      .get(regId) as { detail_json: string } | undefined;
    if (!rRow) {
      db.exec('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'ไม่พบใบสมัคร' });
    }
    const reg = JSON.parse(rRow.detail_json) as RegistrationRecord;
    const evRow = db
      .prepare('SELECT detail_json FROM events WHERE id = ?')
      .get(reg.eventId) as { detail_json: string };
    const ev = JSON.parse(evRow.detail_json) as RaceEvent;
    const oldSize = reg.shirtSize;
    if (oldSize !== newSize) {
      const updatedReg: RegistrationRecord = { ...reg, shirtSize: newSize };
      const updatedEv: RaceEvent = {
        ...ev,
        shirtStocks: ev.shirtStocks.map((st) => {
          if (st.size === oldSize) {
            return { ...st, reservedOrConfirmed: Math.max(0, st.reservedOrConfirmed - 1) };
          }
          if (st.size === newSize) {
            return { ...st, reservedOrConfirmed: st.reservedOrConfirmed + 1 };
          }
          return st;
        }),
      };
      upsertEventRow(updatedEv);
      upsertRegistrationRow(updatedReg);
      recordAudit(
        user,
        reg.organizationId,
        `แก้ไขขนาดเสื้อตามสิทธิ์สมัคร (${reg.regCode})`,
        `${oldSize} -> ${newSize}`,
        reg.eventId
      );
    }
    db.exec('COMMIT');
    return okSnapshot(res, user?.id ?? null);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

app.post('/api/registrations/:id/confirm-payment', (req, res) => {
  const { user } = resolveSessionUser(req);
  const regId = req.params.id;
  const rRow = db
    .prepare('SELECT detail_json FROM registrations WHERE id = ?')
    .get(regId) as { detail_json: string } | undefined;
  if (!rRow) return res.status(404).json({ ok: false, error: 'ไม่พบใบสมัคร' });
  const reg = JSON.parse(rRow.detail_json) as RegistrationRecord;
  if (reg.paymentStatus === 'succeeded') {
    // Idempotent webhook behavior
    return okSnapshot(res, user?.id ?? null);
  }
  const updated: RegistrationRecord = {
    ...reg,
    registrationStatus: 'confirmed',
    paymentStatus: 'succeeded',
    fulfillmentStatus: 'ready',
    paidAt: nowIsoBangkok(),
    reservationExpiresAt: null,
  };
  upsertRegistrationRow(updated);
  recordAudit(
    user,
    reg.organizationId,
    `ยืนยันผล Webhook รับเงินสำเร็จ (${reg.orderCode})`,
    `${reg.regCode}: confirmed`,
    reg.eventId
  );
  return okSnapshot(res, user?.id ?? null);
});

app.post('/api/registrations/:id/bib', (req, res) => {
  const { user } = resolveSessionUser(req);
  const regId = req.params.id;
  const bibNumber = String(req.body?.bibNumber ?? '').trim().toUpperCase();
  if (!bibNumber) return res.status(400).json({ ok: false, error: 'กรุณาระบุเลข BIB' });

  db.exec('BEGIN IMMEDIATE');
  try {
    const rRow = db
      .prepare('SELECT detail_json FROM registrations WHERE id = ?')
      .get(regId) as { detail_json: string } | undefined;
    if (!rRow) {
      db.exec('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'ไม่พบใบสมัคร' });
    }
    const target = JSON.parse(rRow.detail_json) as RegistrationRecord;
    if (!hasOrgRole(user, target.organizationId, ['owner', 'event_manager', 'staff'], target.eventId)) {
      db.exec('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์กำหนดเลข BIB ของงานนี้' });
    }
    const dupRow = db
      .prepare(
        `SELECT detail_json FROM registrations
         WHERE event_id = ? AND id != ? AND UPPER(bib_number) = ?`
      )
      .get(target.eventId, regId, bibNumber) as { detail_json: string } | undefined;
    if (dupRow) {
      const dup = JSON.parse(dupRow.detail_json) as RegistrationRecord;
      db.exec('ROLLBACK');
      return res.status(409).json({
        ok: false,
        error: `เลข BIB "${bibNumber}" ซ้ำกับผู้สมัคร ${dup.participantNameTh} (${dup.regCode}) ในงานเดียวกัน!`,
      });
    }
    const updated: RegistrationRecord = { ...target, bibNumber };
    upsertRegistrationRow(updated);
    recordAudit(
      user,
      target.organizationId,
      `กำหนดเลข BIB ให้ ${target.regCode}`,
      `BIB -> ${bibNumber}`,
      target.eventId
    );
    db.exec('COMMIT');
    return okSnapshot(res, user?.id ?? null);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

app.post('/api/registrations/:id/pickup', (req, res) => {
  const { user } = resolveSessionUser(req);
  const regId = req.params.id;

  db.exec('BEGIN IMMEDIATE');
  try {
    const rRow = db
      .prepare('SELECT detail_json FROM registrations WHERE id = ?')
      .get(regId) as { detail_json: string } | undefined;
    if (!rRow) {
      db.exec('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'ไม่พบใบสมัคร' });
    }
    const target = JSON.parse(rRow.detail_json) as RegistrationRecord;
    if (!hasOrgRole(user, target.organizationId, ['owner', 'event_manager', 'staff'], target.eventId)) {
      db.exec('ROLLBACK');
      return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์เช็กอินส่งมอบอุปกรณ์' });
    }
    if (target.fulfillmentStatus === 'kit_picked_up') {
      db.exec('ROLLBACK');
      return res.status(409).json({
        ok: false,
        error: `ป้องกันการรับซ้ำ: ${target.participantNameTh} รับเสื้อและ BIB ไปแล้วโดย ${target.fulfillmentUpdatedBy} เมื่อ ${target.fulfillmentUpdatedAt}`,
      });
    }
    if (!target.bibNumber) {
      db.exec('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'กรุณากำหนดเลข BIB ก่อนส่งมอบอุปกรณ์' });
    }
    const actor = user?.fullNameTh ?? 'เจ้าหน้าที่จุดรับอุปกรณ์';
    const updated: RegistrationRecord = {
      ...target,
      fulfillmentStatus: 'kit_picked_up',
      fulfillmentUpdatedBy: actor,
      fulfillmentUpdatedAt: nowThaiStamp(),
    };
    upsertRegistrationRow(updated);
    recordAudit(
      user,
      target.organizationId,
      `ส่งมอบเสื้อ ${target.shirtSize} และ BIB ${target.bibNumber}`,
      `${target.regCode}: kit_picked_up`,
      target.eventId
    );
    db.exec('COMMIT');
    return okSnapshot(res, user?.id ?? null);
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

app.post('/api/registrations/:id/refund', (req, res) => {
  const { user } = resolveSessionUser(req);
  const regId = req.params.id;
  const decision = req.body?.decision as 'approve_succeed' | 'reject';
  const note = String(req.body?.note ?? '').trim();

  const rRow = db
    .prepare('SELECT detail_json FROM registrations WHERE id = ?')
    .get(regId) as { detail_json: string } | undefined;
  if (!rRow) return res.status(404).json({ ok: false, error: 'ไม่พบใบสมัคร' });
  const target = JSON.parse(rRow.detail_json) as RegistrationRecord;

  if (!hasOrgRole(user, target.organizationId, ['owner', 'finance'])) {
    return res.status(403).json({
      ok: false,
      error: 'เฉพาะเจ้าขององค์กร ฝ่ายการเงิน หรือ Platform Owner จึงอนุมัติ/ปฏิเสธเงินคืนได้',
    });
  }

  const updated: RegistrationRecord =
    decision === 'approve_succeed'
      ? {
          ...target,
          registrationStatus: 'cancelled',
          refundStatus: 'succeeded',
          refundedAt: nowIsoBangkok(),
          snapshotRefundedSatang: target.snapshotBaseSatang,
          refundReason: `${target.refundReason ?? ''} (${note})`.trim(),
        }
      : {
          ...target,
          refundStatus: 'rejected',
          refundReason: `${target.refundReason ?? ''} (ปฏิเสธ: ${note})`.trim(),
        };

  upsertRegistrationRow(updated);
  recordAudit(
    user,
    target.organizationId,
    decision === 'approve_succeed'
      ? `อนุมัติคืนเงินคำสั่งซื้อ ${target.orderCode}`
      : `ปฏิเสธคำขอคืนเงิน ${target.orderCode}`,
    note,
    target.eventId
  );
  return okSnapshot(res, user?.id ?? null);
});

app.post('/api/merch-orders', (req, res) => {
  const { user } = resolveSessionUser(req);
  const payload = req.body ?? {};
  const eventId = String(payload.eventId ?? '');

  db.exec('BEGIN IMMEDIATE');
  try {
    const evRow = db
      .prepare('SELECT detail_json FROM events WHERE id = ?')
      .get(eventId) as { detail_json: string } | undefined;
    if (!evRow) {
      db.exec('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'ไม่พบงานวิ่ง' });
    }
    const ev = JSON.parse(evRow.detail_json) as RaceEvent;
    const prdId = String(payload.productId ?? payload.product?.id ?? '');
    const prd = ev.products.find((p) => p.id === prdId);
    if (!prd) {
      db.exec('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'ไม่พบสินค้า' });
    }
    const qty = Math.max(1, Number(payload.quantity ?? 1));
    if (prd.soldCount + qty > prd.stockOrCeiling) {
      db.exec('ROLLBACK');
      return res.status(409).json({ ok: false, error: 'สต็อกสินค้าไม่เพียงพอ' });
    }
    const mCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM merch_orders').get() as { cnt: number }
    ).cnt;
    const mSeq = mCount + 520;
    const deliveryMethod =
      payload.deliveryMethod === 'postal_shipping' ? 'postal_shipping' : 'pickup_at_expo';
    const shipFee = deliveryMethod === 'postal_shipping' ? prd.shippingFeeSatang : 0;

    const newOrder: MerchOrderRecord = {
      id: String(payload.id || `mord-${Date.now()}`),
      merchOrderCode: String(payload.merchOrderCode || `SHP-2611-${mSeq}`),
      eventId: ev.id,
      organizationId: ev.organizationId,
      buyerUserId: user?.id,
      buyerName: String(payload.buyerName ?? ''),
      buyerEmail: user?.contactEmail ?? 'บัญชี LINE (ไม่มีอีเมล)',
      productId: prd.id,
      productNameTh: prd.nameTh,
      sellerLabel: prd.sellerLabel,
      variantSize: String(payload.variantSize ?? 'M'),
      quantity: qty,
      deliveredQty: 0,
      deliveryMethod,
      shippingAddress: payload.shippingAddress,
      unitPriceSatang: prd.priceSatang,
      shippingSatang: shipFee,
      totalPaidSatang: prd.priceSatang * qty + shipFee,
      paymentStatus: 'succeeded',
      fulfillmentStatus: deliveryMethod === 'pickup_at_expo' ? 'ready_or_shipped' : 'preparing',
      pickupToken: String(payload.pickupToken || `PICK-SHP-${mSeq}`),
      linkedRegistrationCode: payload.linkedRegistrationCode,
      createdAt: nowIsoBangkok(),
    };

    const updatedEv: RaceEvent = {
      ...ev,
      products: ev.products.map((p) =>
        p.id === prd.id ? { ...p, soldCount: p.soldCount + qty } : p
      ),
    };
    upsertEventRow(updatedEv);
    upsertMerchOrderRow(newOrder, 1);
    recordAudit(
      user,
      ev.organizationId,
      `คำสั่งซื้อสินค้าหน้าร้าน (${newOrder.merchOrderCode})`,
      `${prd.nameTh} × ${qty} (ไม่เกิดใบสมัครวิ่ง)`,
      ev.id
    );
    db.exec('COMMIT');
    return okSnapshot(res, user?.id ?? null, { order: newOrder });
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
});

app.post('/api/merch-orders/:id/handover', (req, res) => {
  const { user } = resolveSessionUser(req);
  const mRow = db
    .prepare('SELECT detail_json FROM merch_orders WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!mRow) return res.status(404).json({ ok: false, error: 'ไม่พบคำสั่งซื้อสินค้า' });
  const ord = JSON.parse(mRow.detail_json) as MerchOrderRecord;

  if (!hasOrgRole(user, ord.organizationId, ['owner', 'event_manager', 'staff'], ord.eventId)) {
    return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์บันทึกส่งมอบสินค้า' });
  }
  if (ord.deliveredQty >= ord.quantity) {
    return res.status(409).json({
      ok: false,
      error: `ป้องกันการส่งมอบสินค้าซ้ำ: คำสั่งซื้อ ${ord.merchOrderCode} รับครบ ${ord.quantity} ชิ้นไปแล้ว`,
    });
  }
  const mode = req.body?.mode === 'partial_one' ? 'partial_one' : 'complete_all';
  const nextDelivered =
    mode === 'partial_one' ? Math.min(ord.quantity, ord.deliveredQty + 1) : ord.quantity;
  const nextStatus = nextDelivered >= ord.quantity ? 'completed' : 'partial_received';
  const updated: MerchOrderRecord = {
    ...ord,
    deliveredQty: nextDelivered,
    fulfillmentStatus: nextStatus,
  };
  upsertMerchOrderRow(updated);
  recordAudit(
    user,
    ord.organizationId,
    `ส่งมอบสินค้าหน้าร้าน (${ord.merchOrderCode})`,
    `รับแล้ว ${nextDelivered}/${ord.quantity} ชิ้น`,
    ord.eventId
  );
  return okSnapshot(res, user?.id ?? null);
});

/* ==================== PRODUCTION INQUIRIES ==================== */

app.post('/api/production-inquiries', (req, res) => {
  const { user } = resolveSessionUser(req);
  const p = req.body ?? {};
  const count = (
    db.prepare('SELECT COUNT(*) AS cnt FROM production_inquiries').get() as { cnt: number }
  ).cnt;

  if (p.contextType === 'event_organizer') {
    if (!hasOrgRole(user, String(p.orgId ?? ''), ['owner', 'event_manager'])) {
      return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ส่งคำขอใบเสนอราคาขององค์กรนี้' });
    }
    const net = Math.max(
      0,
      Number(p.packageQty ?? 0) +
        Number(p.addonQty ?? 0) +
        Number(p.bufferQty ?? 0) -
        Number(p.existingStockQty ?? 0)
    );
    const rfq: ProductionInquiry = {
      id: String(p.id || `rfq-${Date.now()}`),
      inquiryCode: String(p.inquiryCode || `RFQ-2611-0${count + 3}`),
      organizationId: p.orgId,
      requesterName: user?.fullNameTh ?? 'ผู้จัดงาน',
      requesterContact: 'ผ่านระบบผู้จัดงาน',
      eventId: p.eventId,
      contextType: 'event_organizer',
      itemType: p.itemType,
      serviceModel: 'produce_bulk',
      packageEntitlementQty: Number(p.packageQty ?? 0),
      addonStoreQty: Number(p.addonQty ?? 0),
      organizerBufferQty: Number(p.bufferQty ?? 0),
      existingStockDeductedQty: Number(p.existingStockQty ?? 0),
      netQtyToProduce: net,
      artworkVersion: 'Artwork-v1.0 (รอสรุปใบเสนอราคา)',
      targetDeliveryDate: String(p.targetDeliveryDate ?? ''),
      quoteStatus: 'submitted',
      productionStatus: 'awaiting_approval',
      createdAt: nowThaiStamp(),
    };
    upsertProductionInquiryRow(rfq, 1);
    recordAudit(
      user,
      String(p.orgId),
      `ส่งคำขอใบเสนอราคาผลิต (${rfq.inquiryCode})`,
      `ยอดสุทธิ ${net} ชิ้น`,
      p.eventId
    );
    return okSnapshot(res, user?.id ?? null, { inquiry: rfq });
  }

  const qty = Math.max(1, Number(p.estimatedQty ?? 50));
  const rfq: ProductionInquiry = {
    id: String(p.id || `rfq-club-${Date.now()}`),
    inquiryCode: String(p.inquiryCode || `RFQ-CLB-${count + 11}`),
    requesterName: String(p.requesterName ?? ''),
    requesterContact: String(p.requesterContact ?? ''),
    contextType: 'club_or_company',
    itemType: p.itemType,
    serviceModel: 'produce_bulk',
    packageEntitlementQty: 0,
    addonStoreQty: 0,
    organizerBufferQty: qty,
    existingStockDeductedQty: 0,
    netQtyToProduce: qty,
    artworkVersion: 'รอส่งไฟล์แบบให้ทีมงานตรวจ',
    targetDeliveryDate: String(p.targetDeliveryDate ?? ''),
    quoteStatus: 'submitted',
    productionStatus: 'awaiting_approval',
    createdAt: nowThaiStamp(),
  };
  upsertProductionInquiryRow(rfq, 1);
  return okSnapshot(res, user?.id ?? null, { inquiry: rfq });
});

app.patch('/api/production-inquiries/:id', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const qRow = db
    .prepare('SELECT detail_json FROM production_inquiries WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!qRow) return res.status(404).json({ ok: false, error: 'ไม่พบใบขอราคา' });
  const target = JSON.parse(qRow.detail_json) as ProductionInquiry;
  const patch = req.body ?? {};
  const updated: ProductionInquiry = {
    ...target,
    quoteStatus: patch.quoteStatus ?? target.quoteStatus,
    productionStatus: patch.productionStatus ?? target.productionStatus,
    quotedTotalSatang:
      patch.quotedTotalSatang !== undefined ? patch.quotedTotalSatang : target.quotedTotalSatang,
    adminNote: patch.adminNote !== undefined ? patch.adminNote : target.adminNote,
  };
  upsertProductionInquiryRow(updated);
  recordAudit(
    user,
    target.organizationId ?? 'PLATFORM-HQ',
    `อัปเดตใบเสนอราคา/การผลิต ${target.inquiryCode}`,
    `quote=${updated.quoteStatus}, prod=${updated.productionStatus}`,
    target.eventId
  );
  return okSnapshot(res, user.id);
});

/* ==================== ORGANIZER EVENT MANAGEMENT ==================== */

app.post('/api/events', (req, res) => {
  const { user } = resolveSessionUser(req);
  const p = req.body ?? {};
  const orgId = String(p.orgId ?? '');
  if (!hasOrgRole(user, orgId, ['owner', 'event_manager'])) {
    return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์สร้างงานวิ่งในองค์กรนี้' });
  }
  const evCount = (db.prepare('SELECT COUNT(*) AS cnt FROM events').get() as { cnt: number }).cnt;
  const num = evCount + 10;
  const newEv: RaceEvent = {
    id: String(p.id || `evt-drf-${Date.now()}`),
    code: String(p.code || `EVT-DRF-27${num}`),
    organizationId: orgId,
    titleTh: String(p.titleTh ?? ''),
    titleEn: String(p.titleTh ?? ''),
    tagline: 'งานวิ่งแบบร่างที่สร้างใหม่ รอกำหนดรายละเอียดและส่งตรวจเปิดขาย',
    coverMotif: 'mountain',
    province: String(p.province ?? 'เชียงใหม่'),
    region: 'เหนือ',
    venue: 'สถานที่จัดงาน (รอกำหนดรายละเอียด)',
    eventDate: String(p.eventDate ?? '2027-02-14'),
    timezone: 'Asia/Bangkok',
    raceType: 'Road Race',
    status: 'draft',
    statusNote:
      'งานแบบร่างเพิ่งสร้างใหม่ — ตรวจ Checklist ความพร้อมด้านล่างก่อนส่งอนุมัติเปิดขาย',
    totalEventQuota: 100,
    feeBearerPolicy: 'runner_pays',
    editDeadlineDate: String(p.eventDate ?? '2027-02-14'),
    rulesVersion: 'v0.1-draft',
    kitPickupWindow: 'วันก่อนแข่งขัน เวลา 10:00–18:00 น.',
    highlights: ['งานวิ่งที่สร้างใหม่ผ่านหน้าผู้จัดงาน'],
    categories: [
      {
        id: `cat-drf-${Date.now()}`,
        code: '10 km',
        name: 'Mini Marathon 10.0 กม.',
        distanceKm: 10,
        startTimeLocal: '05:30',
        cutoffHours: 2.5,
        categoryQuota: 100,
        bibPrefix: 'D',
        colorTag: 'vermilion',
        priceTiers: [
          {
            id: `tier-drf-${Date.now()}`,
            label: 'Regular',
            priceSatang: 70000,
            startsAt: '2026-12-01',
            endsAt: String(p.eventDate ?? '2027-02-14'),
            isCurrent: true,
          },
        ],
      },
    ],
    shirtStocks: [
      { size: 'XS', total: 10, reservedOrConfirmed: 0 },
      { size: 'S', total: 20, reservedOrConfirmed: 0 },
      { size: 'M', total: 35, reservedOrConfirmed: 0 },
      { size: 'L', total: 25, reservedOrConfirmed: 0 },
      { size: 'XL', total: 10, reservedOrConfirmed: 0 },
      { size: '2XL', total: 0, reservedOrConfirmed: 0 },
    ],
    products: [],
    readinessChecks: [
      {
        id: 'chk-n1',
        label: 'ระบุชื่อจังหวัดและวันจัดงานเบื้องต้นแล้ว',
        passed: true,
        fixTargetHint: 'ข้อมูลพื้นฐานครบแล้ว',
      },
      {
        id: 'chk-n2',
        label: 'ยืนยันโควตาเสื้อ 2XL และนโยบายการคืนเงินก่อนส่งตรวจ',
        passed: false,
        fixTargetHint: 'กดปุ่มเติมข้อมูลจำลองด้านล่างเพื่อส่งตรวจเปิดขาย',
      },
    ],
  };

  upsertEventRow(newEv, 1);

  if (p.requestProductionHelp) {
    const qCount = (
      db.prepare('SELECT COUNT(*) AS cnt FROM production_inquiries').get() as { cnt: number }
    ).cnt;
    const rfq: ProductionInquiry = {
      id: `rfq-ev-${Date.now()}`,
      inquiryCode: `RFQ-2611-0${qCount + 2}`,
      organizationId: orgId,
      requesterName: user?.fullNameTh ?? 'ผู้จัดงาน',
      requesterContact: 'ผ่านระบบผู้จัดงาน',
      eventId: newEv.id,
      contextType: 'event_organizer',
      itemType: 'ชุดเสื้อพร้อมเหรียญครบวงจร',
      serviceModel: 'produce_bulk',
      packageEntitlementQty: 100,
      addonStoreQty: 0,
      organizerBufferQty: 10,
      existingStockDeductedQty: 0,
      netQtyToProduce: 110,
      artworkVersion: 'ขอคำปรึกษาออกแบบจากทีม กระต่าย',
      targetDeliveryDate: newEv.eventDate,
      quoteStatus: 'submitted',
      productionStatus: 'awaiting_approval',
      createdAt: nowThaiStamp(),
    };
    upsertProductionInquiryRow(rfq, 1);
  }

  recordAudit(
    user,
    orgId,
    `สร้างงานแบบร่างใหม่ (${newEv.code})`,
    p.requestProductionHelp
      ? `${newEv.titleTh} + ส่งคำขอช่วยผลิตเสื้อ/เหรียญ`
      : newEv.titleTh,
    newEv.id
  );
  return okSnapshot(res, user!.id, { event: newEv });
});

app.post('/api/events/:id/duplicate', (req, res) => {
  const { user } = resolveSessionUser(req);
  const evRow = db
    .prepare('SELECT detail_json FROM events WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!evRow) return res.status(404).json({ ok: false, error: 'ไม่พบงานต้นทาง' });
  const src = JSON.parse(evRow.detail_json) as RaceEvent;
  if (!hasOrgRole(user, src.organizationId, ['owner', 'event_manager'])) {
    return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์คัดลอกงานวิ่งนี้' });
  }
  const copyCode = `${src.code}-NEXT-${String(Date.now()).slice(-3)}`;
  const copyEv: RaceEvent = {
    ...src,
    id: String(req.body?.newEventId || `evt-copy-${Date.now()}`),
    code: String(req.body?.copyCode || copyCode),
    titleTh: `${src.titleTh} (สำเนาจัดครั้งถัดไป)`,
    status: 'draft',
    statusNote:
      'ทำสำเนาเฉพาะโครงสร้างระยะ ราคา และตารางไซส์เสื้อตั้งต้น — ไม่คัดลอกข้อมูลส่วนบุคคลของผู้สมัครเดิม',
    shirtStocks: src.shirtStocks.map((s) => ({ ...s, reservedOrConfirmed: 0 })),
    products: src.products.map((p) => ({
      ...p,
      id: `prd-copy-${p.id}-${Date.now()}`,
      soldCount: 0,
    })),
    verifiedPhotoAlbums: undefined,
    officialResultsUrl: undefined,
    customFields: cloneCustomFieldsSchema(src.customFields ?? []),
  };
  upsertEventRow(copyEv, 1);
  recordAudit(
    user,
    src.organizationId,
    'คัดลอกโครงสร้างงานโดยไม่คัดลอกข้อมูลผู้สมัครเดิม',
    `${src.code} -> ${copyEv.code}`,
    copyEv.id
  );
  return okSnapshot(res, user!.id, { event: copyEv });
});

app.post('/api/events/:id/submit-review', (req, res) => {
  const { user } = resolveSessionUser(req);
  const evRow = db
    .prepare('SELECT detail_json FROM events WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!evRow) return res.status(404).json({ ok: false, error: 'ไม่พบงานวิ่ง' });
  const target = JSON.parse(evRow.detail_json) as RaceEvent;
  if (!hasOrgRole(user, target.organizationId, ['owner', 'event_manager'], target.id)) {
    return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ส่งตรวจงานวิ่งนี้' });
  }
  const updated: RaceEvent = {
    ...target,
    status: 'in_review',
    rulesVersion: 'v1.0-submitted',
    statusNote: 'ส่งตรวจความพร้อมเรียบร้อยแล้ว รอผู้ดูแลแพลตฟอร์มอนุมัติเปิดรับสมัคร',
    shirtStocks: target.shirtStocks.map((s) =>
      s.size === '2XL' && s.total === 0 ? { ...s, total: 10 } : s
    ),
    readinessChecks: target.readinessChecks.map((c) => ({ ...c, passed: true })),
  };
  upsertEventRow(updated);
  recordAudit(
    user,
    target.organizationId,
    `ส่งงาน ${target.code} เข้าคิวตรวจอนุมัติเผยแพร่`,
    'draft -> in_review',
    target.id
  );
  return okSnapshot(res, user!.id);
});

app.patch('/api/events/:id', (req, res) => {
  const { user } = resolveSessionUser(req);
  const evRow = db
    .prepare('SELECT detail_json FROM events WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!evRow) return res.status(404).json({ ok: false, error: 'ไม่พบงานวิ่ง' });
  const target = JSON.parse(evRow.detail_json) as RaceEvent;

  if (!hasOrgRole(user, target.organizationId, ['owner', 'event_manager', 'finance'], target.id)) {
    return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์แก้ไขตั้งค่างานวิ่งนี้' });
  }

  const patch = req.body ?? {};
  let nextEv: RaceEvent = { ...target };

  if (typeof patch.totalEventQuota === 'number') {
    const confirmed = (
      db
        .prepare(`SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ? AND registration_status = 'confirmed'`)
        .get(target.id) as { cnt: number }
    ).cnt;
    const reserved = (
      db
        .prepare(`SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ? AND registration_status = 'pending_payment'`)
        .get(target.id) as { cnt: number }
    ).cnt;
    const check = validateQuotaUpdate(patch.totalEventQuota, confirmed, reserved);
    if (!check.valid) return res.status(400).json({ ok: false, error: check.message });
    nextEv.totalEventQuota = patch.totalEventQuota;
    recordAudit(
      user,
      target.organizationId,
      `ปรับเพดานโควตารวมงาน ${target.code}`,
      `${target.totalEventQuota} -> ${patch.totalEventQuota} คน`,
      target.id
    );
  }

  if (patch.categoryQuotaUpdate) {
    const { categoryId, newCategoryQuota } = patch.categoryQuotaUpdate as {
      categoryId: string;
      newCategoryQuota: number;
    };
    const cat = target.categories.find((c) => c.id === categoryId);
    if (cat) {
      const nextCategories = target.categories.map((c) =>
        c.id === categoryId ? { ...c, categoryQuota: newCategoryQuota } : c
      );
      const nextTotal = Math.max(
        nextEv.totalEventQuota,
        nextCategories.reduce((s, c) => s + c.categoryQuota, 0)
      );
      nextEv = { ...nextEv, categories: nextCategories, totalEventQuota: nextTotal };
      recordAudit(
        user,
        target.organizationId,
        `ปรับโควตาระยะ ${cat.code} งาน ${target.code}`,
        `${cat.categoryQuota} -> ${newCategoryQuota} คน`,
        target.id
      );
    }
  }

  if (patch.categoryAgeUpdate) {
    if (!hasOrgRole(user, target.organizationId, ['owner', 'event_manager'], target.id)) {
      return res.status(403).json({
        ok: false,
        error: 'เฉพาะเจ้าขององค์กรหรือผู้จัดการงานจึงตั้งเกณฑ์อายุและรุ่นอายุได้',
      });
    }
    const upd = patch.categoryAgeUpdate as AgeConfigInput & { categoryId?: string };
    const cat = nextEv.categories.find((c) => c.id === upd.categoryId);
    if (!cat) return res.status(400).json({ ok: false, error: 'ไม่พบระยะการแข่งขันที่เลือก' });
    const checked = validateAgeConfig(upd);
    if (!checked.ok) return res.status(400).json({ ok: false, error: checked.message });
    const v = checked.value;
    nextEv = {
      ...nextEv,
      categories: nextEv.categories.map((c) =>
        c.id === cat.id
          ? { ...c, ageBasis: v.ageBasis, minAge: v.minAge, maxAge: v.maxAge, ageGroups: v.ageGroups }
          : c
      ),
    };
    const limitText =
      v.minAge === null && v.maxAge === null
        ? 'ไม่จำกัดอายุ'
        : `อายุ ${v.minAge ?? 0}–${v.maxAge ?? 'ไม่จำกัด'} ปี`;
    recordAudit(
      user,
      target.organizationId,
      `ตั้งเกณฑ์อายุระยะ ${cat.code} งาน ${target.code}`,
      `${v.ageBasis === 'year_end' ? 'นับ ณ 31 ธ.ค.' : 'นับ ณ วันแข่ง'} · ${limitText} · ${v.ageGroups.length} รุ่น (ใบสมัครเดิมคงรุ่นเดิม)`,
      target.id
    );
  }

  if (Array.isArray(patch.customFields)) {
    nextEv.customFields = patch.customFields as CustomRegistrationField[];
    recordAudit(
      user,
      target.organizationId,
      `อัปเดตคำถามเพิ่มเติมในใบสมัครงาน ${target.code}`,
      `จำนวนคำถามทั้งหมด ${nextEv.customFields.length} ข้อ`,
      target.id
    );
  }

  if (patch.feeBearerPolicy) {
    if (!hasOrgRole(user, target.organizationId, ['owner', 'finance'])) {
      return res.status(403).json({
        ok: false,
        error: 'เฉพาะเจ้าขององค์กรหรือฝ่ายการเงินจึงเปลี่ยนนโยบายผู้รับภาระค่าบริการได้',
      });
    }
    nextEv.feeBearerPolicy = patch.feeBearerPolicy as FeeBearerPolicy;
    recordAudit(
      user,
      target.organizationId,
      `เปลี่ยนนโยบายผู้รับภาระค่าบริการงาน ${target.code}`,
      `เป็น ${nextEv.feeBearerPolicy} (เฉพาะใบสมัครใหม่)`,
      target.id
    );
  }

  if (patch.media) {
    const m = patch.media as {
      coverImageUrl?: string;
      coverImageAlt?: string;
      galleryImageUrls?: string[];
    };
    nextEv.coverImageUrl = m.coverImageUrl;
    nextEv.coverImageAlt = m.coverImageAlt;
    nextEv.galleryImageUrls = m.galleryImageUrls ?? [];
    recordAudit(
      user,
      target.organizationId,
      `อัปเดตรูปปกงาน ${target.code}`,
      m.coverImageUrl
        ? `ตั้งรูปปก + ภาพประกอบ ${nextEv.galleryImageUrls.length} รูป`
        : 'ลบรูปปก (ใช้ภาพปกลายเส้นแทน)',
      target.id
    );
  }

  if (patch.templateId) {
    const tplRow = db
      .prepare('SELECT detail_json FROM form_templates WHERE id = ?')
      .get(String(patch.templateId)) as { detail_json: string } | undefined;
    if (tplRow) {
      const tpl = JSON.parse(tplRow.detail_json) as FormTemplate;
      const allGlobals = (
        db.prepare('SELECT detail_json FROM global_fields').all() as { detail_json: string }[]
      ).map((g) => JSON.parse(g.detail_json) as GlobalFormFieldDef);
      const mappedFields: CustomRegistrationField[] = tpl.fieldIds
        .map((fid) => allGlobals.find((gf) => gf.id === fid))
        .filter((gf): gf is GlobalFormFieldDef => Boolean(gf))
        .map((gf) => ({
          id: gf.id,
          fieldKey: gf.fieldKey,
          label: gf.label,
          descriptionTh: gf.descriptionTh,
          placeholderTh: gf.placeholderTh,
          type: gf.type,
          stepKey: gf.stepKey,
          required: gf.required,
          options: gf.options ? [...gf.options] : undefined,
          isSensitive: gf.isSensitive,
          policy: gf.policy,
          defaultValue: gf.defaultValue,
          visibilityCondition: gf.visibilityCondition,
        }));
      const nextVer = `${tpl.versionLabel}-published`;
      nextEv = {
        ...nextEv,
        activeTemplateId: tpl.id,
        publishedFormVersion: nextVer,
        customFields: mappedFields,
      };
      recordAudit(
        user,
        target.organizationId,
        `เลือกใช้แม่แบบฟอร์ม ${tpl.code} กับงาน ${target.code}`,
        `เผยแพร่ฟอร์มงานเวอร์ชัน ${nextVer} (${mappedFields.length} ฟิลด์)`,
        target.id
      );
    }
  }

  if (patch.addProduct) {
    const ap = patch.addProduct as {
      id?: string;
      sku?: string;
      nameTh: string;
      categoryLabel: 'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม';
      saleMode: 'ready_stock' | 'preorder';
      serviceModel: SellerServiceModel;
      priceBaht: number;
      stockOrCeiling: number;
    };
    const newPrd: EventProduct = {
      id: ap.id || `prd-${Date.now()}`,
      sku: ap.sku || `SKU-${Date.now().toString().slice(-4)}`,
      eventId: target.id,
      nameTh: ap.nameTh,
      categoryLabel: ap.categoryLabel,
      saleMode: ap.saleMode,
      serviceModel: ap.serviceModel,
      sellerLabel:
        ap.serviceModel === 'kratai_full_service'
          ? 'ดูแลพรีออเดอร์และจัดส่งโดย กระต่าย (จำลอง)'
          : 'ผู้ขาย: องค์กรผู้จัดงาน (จำลอง)',
      fulfillmentOwnerLabel:
        ap.serviceModel === 'kratai_full_service'
          ? 'กระต่าย ผลิตและจัดส่ง'
          : 'ผู้จัดงานส่งมอบ',
      priceSatang: ap.priceBaht * 100,
      shippingFeeSatang: 5000,
      stockOrCeiling: ap.stockOrCeiling,
      soldCount: 0,
      preorderMinQty: ap.saleMode === 'preorder' ? 20 : undefined,
      preorderCloseDate: ap.saleMode === 'preorder' ? target.editDeadlineDate : undefined,
      estimatedDeliveryNote: 'ตามกำหนดนัดรับหน้างานหรือจัดส่งไปรษณีย์',
      refundAndMinPolicyNote:
        ap.saleMode === 'preorder'
          ? 'หากยอดไม่ถึงขั้นต่ำจะยกเลิกและคืนเงินเต็มจำนวน'
          : 'เปลี่ยนได้กรณีชำรุดจากการผลิต',
      availableSizes:
        ap.categoryLabel === 'เสื้อที่ระลึก' ? ['S', 'M', 'L', 'XL'] : ['มาตรฐาน'],
      description: 'รายการสินค้าที่ระลึกเฉพาะงาน ลูกค้าทั่วไปซื้อได้โดยไม่ต้องสมัครวิ่ง',
    };
    nextEv = { ...nextEv, products: [...nextEv.products, newPrd] };
    recordAudit(
      user,
      target.organizationId,
      `เพิ่มสินค้าหน้าร้าน ${newPrd.nameTh}`,
      `${newPrd.sku} · ฿${ap.priceBaht}`,
      target.id
    );
  }

  if (patch.customSizeChart) {
    nextEv.customSizeChart = patch.customSizeChart as Record<string, ShirtSizeMeasurement>;
    recordAudit(
      user,
      target.organizationId,
      `อัปเดตตารางไซส์เสื้อเฉพาะงาน ${target.code}`,
      `จำนวน ${Object.keys(nextEv.customSizeChart).length} ไซส์`,
      target.id
    );
  }

  if (Array.isArray(patch.shirtStocks)) {
    nextEv.shirtStocks = patch.shirtStocks as ShirtStock[];
    recordAudit(
      user,
      target.organizationId,
      `อัปเดตโควตาและรายการไซส์เสื้อของงาน ${target.code}`,
      nextEv.shirtStocks.map((s) => `${s.size}:${s.total}`).join(', '),
      target.id
    );
  }

  upsertEventRow(nextEv);
  return okSnapshot(res, user!.id);
});

app.patch('/api/admin/profile-config', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const nextConfig = req.body?.config as PlatformProfileConfig | undefined;
  if (!nextConfig || !Array.isArray(nextConfig.shirtSizes)) {
    return res.status(400).json({ ok: false, error: 'โครงสร้างข้อมูลตั้งค่าไม่ถูกต้อง' });
  }
  upsertPlatformProfileConfig(nextConfig);
  recordAudit(
    user,
    'PLATFORM-HQ',
    'อัปเดตตัวเลือกไซส์เสื้อกลางและเกณฑ์ความสมบูรณ์ Runner Profile',
    `ไซส์เปิดใช้ ${nextConfig.shirtSizes.filter((s) => s.enabled).length}/${
      nextConfig.shirtSizes.length
    } · หมวดบังคับ ${nextConfig.requiredProfileSections.length} หมวด`
  );
  return okSnapshot(res, user.id);
});

/* ==================== PLATFORM OWNER GOVERNANCE & FORM BUILDER ==================== */

app.post('/api/admin/organizations/:id/review', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const oRow = db
    .prepare('SELECT detail_json FROM organizations WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!oRow) return res.status(404).json({ ok: false, error: 'ไม่พบองค์กรผู้จัด' });
  const o = JSON.parse(oRow.detail_json) as Organization;
  const action = String(req.body?.action ?? 'approve_kyc_bank') as
    | 'approve_kyc_bank'
    | 'hold_bank'
    | 'suspend_org'
    | 'reinstate_org'
    | 'under_review'
    | 'request_more_info'
    | 'reject_org';
  const bankSummary = req.body?.bankSummary ? String(req.body.bankSummary) : undefined;

  const workflowMap: Record<typeof action, OrganizerVerificationWorkflowStatus> = {
    approve_kyc_bank: 'APPROVED',
    reinstate_org: 'APPROVED',
    hold_bank: 'MORE_INFORMATION_REQUIRED',
    suspend_org: 'SUSPENDED',
    under_review: 'UNDER_REVIEW',
    request_more_info: 'MORE_INFORMATION_REQUIRED',
    reject_org: 'REJECTED',
  };
  const nextWf = workflowMap[action];
  const historyEntry = {
    id: `vh-${Date.now()}`,
    status: nextWf,
    actorName: user.fullNameTh,
    note: bankSummary || `เปลี่ยนสถานะเป็น ${nextWf}`,
    timestamp: nowThaiStamp(),
  };
  const nextHistory = [historyEntry, ...(o.verificationHistory ?? [])];

  let updated: Organization;
  if (action === 'approve_kyc_bank' || action === 'reinstate_org') {
    updated = {
      ...o,
      nameTh: o.nameTh.replace(/\s*\(องค์กรใหม่รอตรวจ\)|\s*\(รอตรวจสอบผู้จัด\)/g, ''),
      verificationStatus: 'verified',
      workflowStatus: 'APPROVED',
      payoutReady: true,
      payoutBankSummary: bankSummary || o.payoutBankSummary,
      verificationHistory: nextHistory,
    };
  } else if (
    action === 'under_review' ||
    action === 'request_more_info' ||
    action === 'hold_bank'
  ) {
    updated = {
      ...o,
      verificationStatus: 'pending_review',
      workflowStatus: nextWf,
      payoutReady: false,
      payoutBankSummary:
        bankSummary ||
        (action === 'under_review'
          ? 'อยู่ระหว่าง Platform Owner ตรวจสอบเอกสาร (UNDER_REVIEW)'
          : 'ขอเอกสารยืนยันตัวตน/บัญชีธนาคารเพิ่มเติม (MORE_INFORMATION_REQUIRED)'),
      verificationHistory: nextHistory,
    };
  } else {
    updated = {
      ...o,
      verificationStatus: 'suspended',
      workflowStatus: nextWf,
      payoutReady: false,
      verificationHistory: nextHistory,
    };
  }

  upsertOrganizationRow(updated);
  recordAudit(
    user,
    o.id,
    `Platform Owner อัปเดตสถานะผู้จัด (${o.code} -> ${nextWf})`,
    bankSummary ?? o.nameTh
  );
  return okSnapshot(res, user.id);
});

app.post('/api/admin/events/:id/govern', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const evRow = db
    .prepare('SELECT detail_json FROM events WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!evRow) return res.status(404).json({ ok: false, error: 'ไม่พบงานวิ่ง' });
  const ev = JSON.parse(evRow.detail_json) as RaceEvent;
  const nextStatus = req.body?.nextStatus as EventStatus;
  const adminNote = req.body?.adminNote ? String(req.body.adminNote) : undefined;
  const postRaceLinks = req.body?.postRaceLinks as
    | { resultsUrl?: string; albumTitle?: string; albumUrl?: string }
    | undefined;

  const nextAlbums =
    nextStatus === 'completed' && postRaceLinks?.albumTitle
      ? [
          ...(ev.verifiedPhotoAlbums ?? []),
          {
            id: `alb-adm-${Date.now()}`,
            title: postRaceLinks.albumTitle,
            photographerCredit: 'ตรวจสอบและประกาศผ่านระบบแพลตฟอร์ม',
            photoCount: 850,
            externalUrl: postRaceLinks.albumUrl || `#verified-album-${ev.code.toLowerCase()}`,
          },
        ]
      : ev.verifiedPhotoAlbums;

  const updated: RaceEvent = {
    ...ev,
    status: nextStatus,
    statusNote: adminNote || undefined,
    officialResultsUrl:
      nextStatus === 'completed' && postRaceLinks?.resultsUrl
        ? postRaceLinks.resultsUrl
        : ev.officialResultsUrl,
    verifiedPhotoAlbums: nextAlbums,
  };
  upsertEventRow(updated);
  recordAudit(
    user,
    ev.organizationId,
    `ผู้ดูแลแพลตฟอร์มเปลี่ยนสถานะงาน ${ev.code} (${ev.status} -> ${nextStatus})`,
    adminNote || nextStatus,
    ev.id
  );
  return okSnapshot(res, user.id);
});

app.post('/api/admin/payouts', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const p = req.body ?? {};
  const code = String(p.payoutCode || `PO-2026-${Math.floor(1200 + Math.random() * 800)}`);
  const newBatch: PayoutBatch = {
    id: String(p.id || `po-dyn-${Date.now()}`),
    payoutCode: code,
    organizationId: String(p.organizationId ?? ''),
    eventId: String(p.eventId ?? ''),
    periodLabel: String(p.periodLabel ?? ''),
    scheduledDate: String(p.scheduledDate ?? ''),
    grossSucceededSatang: Number(p.netPayoutSatang ?? 0),
    deductedRefundSatang: 0,
    deductedOrganizerFeeSatang: 0,
    netPayoutSatang: Number(p.netPayoutSatang ?? 0),
    status: 'scheduled',
  };
  upsertPayoutRow(newBatch, 1);
  recordAudit(
    user,
    newBatch.organizationId,
    `สร้างรอบโอนยอดนำส่งใหม่ (${code})`,
    newBatch.periodLabel,
    newBatch.eventId
  );
  return okSnapshot(res, user.id);
});

app.patch('/api/admin/payouts/:id', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const pRow = db
    .prepare('SELECT detail_json FROM payouts WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!pRow) return res.status(404).json({ ok: false, error: 'ไม่พบรอบโอน' });
  const target = JSON.parse(pRow.detail_json) as PayoutBatch;
  const nextStatus = req.body?.nextStatus as PayoutStatus;
  const updated: PayoutBatch = { ...target, status: nextStatus };
  upsertPayoutRow(updated);
  recordAudit(
    user,
    target.organizationId,
    `อัปเดตสถานะรอบโอนยอดนำส่ง ${target.payoutCode}`,
    `${target.status} -> ${nextStatus}`,
    target.eventId
  );
  return okSnapshot(res, user.id);
});

app.post('/api/admin/registrations/:id/force-refund', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const rRow = db
    .prepare('SELECT detail_json FROM registrations WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!rRow) return res.status(404).json({ ok: false, error: 'ไม่พบใบสมัคร' });
  const target = JSON.parse(rRow.detail_json) as RegistrationRecord;
  const decision = String(req.body?.decision ?? 'admin_force_refund');
  const reason = String(req.body?.reason ?? '').trim();

  let updated: RegistrationRecord;
  if (decision === 'reject') {
    updated = {
      ...target,
      refundStatus: 'rejected',
      refundReason: `${target.refundReason ?? ''} (ปฏิเสธ: [Platform Owner] ${reason})`.trim(),
    };
  } else {
    updated = {
      ...target,
      registrationStatus: 'cancelled',
      refundStatus: 'succeeded',
      refundedAt: nowIsoBangkok(),
      snapshotRefundedSatang: target.snapshotBaseSatang,
      refundReason:
        decision === 'admin_force_refund'
          ? `[Platform Exception] ${reason}`
          : `${target.refundReason ?? ''} ([Platform Owner] ${reason})`.trim(),
    };
  }
  upsertRegistrationRow(updated);
  recordAudit(
    user,
    target.organizationId,
    `ผู้ดูแลแพลตฟอร์มสั่งคืนเงินกรณีพิเศษ (${target.regCode})`,
    reason,
    target.eventId
  );
  return okSnapshot(res, user.id);
});

app.patch('/api/admin/users/:id/access', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const targetUser = getUserById(req.params.id);
  if (!targetUser) return res.status(404).json({ ok: false, error: 'ไม่พบบัญชีผู้ใช้' });

  const action = req.body?.action as
    | { kind: 'verify_email' }
    | { kind: 'toggle_platform_admin' }
    | { kind: 'grant_org_role'; organizationId: string; role: OrgRole }
    | { kind: 'revoke_org_role'; organizationId: string };

  let updated: UserAccount = { ...targetUser };
  if (action.kind === 'verify_email') {
    updated = {
      ...targetUser,
      contactEmail: targetUser.contactEmail ?? `${targetUser.code.toLowerCase()}@verified.local`,
      emailVerified: true,
    };
  } else if (action.kind === 'toggle_platform_admin') {
    updated = { ...targetUser, isPlatformAdmin: !targetUser.isPlatformAdmin };
  } else if (action.kind === 'grant_org_role') {
    updated = {
      ...targetUser,
      memberships: [
        ...targetUser.memberships.filter((m) => m.organizationId !== action.organizationId),
        { organizationId: action.organizationId, role: action.role },
      ],
    };
  } else if (action.kind === 'revoke_org_role') {
    updated = {
      ...targetUser,
      memberships: targetUser.memberships.filter(
        (m) => m.organizationId !== action.organizationId
      ),
    };
  }

  upsertUserRow(updated, { preservePasswordHash: true });
  recordAudit(
    user,
    action.kind === 'grant_org_role' || action.kind === 'revoke_org_role'
      ? action.organizationId
      : 'PLATFORM-HQ',
    `ปรับสิทธิ์บัญชีผู้ใช้ ${targetUser.fullNameTh} (${targetUser.code})`,
    action.kind
  );
  return okSnapshot(res, user.id);
});

/* ---- Form Builder Routes ---- */

app.post('/api/form-builder/steps', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const step = req.body?.step as RegistrationStepDef;
  db.prepare(`
    INSERT INTO registration_steps (id, step_key, step_order, enabled, is_system_locked, detail_json)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      step_key = excluded.step_key,
      step_order = excluded.step_order,
      enabled = excluded.enabled,
      is_system_locked = excluded.is_system_locked,
      detail_json = excluded.detail_json
  `).run(
    step.id,
    step.key,
    step.order,
    step.enabled ? 1 : 0,
    step.isSystemLocked ? 1 : 0,
    JSON.stringify(step)
  );
  recordAudit(
    user,
    'PLATFORM-HQ',
    `อัปเดตขั้นตอนการสมัคร (${step.key})`,
    `${step.titleTh} · enabled=${step.enabled}`
  );
  return okSnapshot(res, user.id);
});

app.post('/api/form-builder/steps/reorder', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const stepId = String(req.body?.stepId ?? '');
  const direction = req.body?.direction === 'up' ? 'up' : 'down';
  const rows = (
    db
      .prepare('SELECT detail_json FROM registration_steps ORDER BY step_order ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as RegistrationStepDef);

  const idx = rows.findIndex((s) => s.id === stepId);
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (idx !== -1 && swapIdx >= 0 && swapIdx < rows.length - 1) {
    const tmp = rows[idx];
    rows[idx] = rows[swapIdx];
    rows[swapIdx] = tmp;
    const upd = db.prepare(
      'UPDATE registration_steps SET step_order = ?, detail_json = ? WHERE id = ?'
    );
    rows.forEach((s, i) => {
      const next = { ...s, order: i + 1 };
      upd.run(next.order, JSON.stringify(next), next.id);
    });
  }
  return okSnapshot(res, user.id);
});

app.delete('/api/form-builder/steps/:id', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const sRow = db
    .prepare('SELECT detail_json FROM registration_steps WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!sRow) return okSnapshot(res, user.id);
  const target = JSON.parse(sRow.detail_json) as RegistrationStepDef;
  if (target.isSystemLocked) {
    return res.status(400).json({ ok: false, error: 'ห้ามลบขั้นตอนที่ล็อกโดยระบบ' });
  }
  db.prepare('DELETE FROM registration_steps WHERE id = ?').run(target.id);
  const remaining = (
    db
      .prepare('SELECT detail_json FROM registration_steps ORDER BY step_order ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as RegistrationStepDef);
  const upd = db.prepare(
    'UPDATE registration_steps SET step_order = ?, detail_json = ? WHERE id = ?'
  );
  remaining.forEach((s, i) => {
    const next = { ...s, order: i + 1 };
    upd.run(next.order, JSON.stringify(next), next.id);
  });
  recordAudit(user, 'PLATFORM-HQ', `ลบขั้นตอนการสมัคร ${target.key}`, target.titleTh);
  return okSnapshot(res, user.id);
});

app.post('/api/form-builder/fields', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const field = req.body?.field as GlobalFormFieldDef;
  db.prepare(`
    INSERT INTO global_fields (id, sort_order, field_key, policy, input_type, detail_json)
    VALUES (?, 500, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      field_key = excluded.field_key,
      policy = excluded.policy,
      input_type = excluded.input_type,
      detail_json = excluded.detail_json
  `).run(field.id, field.fieldKey, field.policy, field.type, JSON.stringify(field));

  // Sync matching customFields across events
  const evRows = db.prepare('SELECT detail_json FROM events').all() as { detail_json: string }[];
  for (const r of evRows) {
    const ev = JSON.parse(r.detail_json) as RaceEvent;
    if ((ev.customFields ?? []).some((cf) => cf.id === field.id)) {
      const updatedEv: RaceEvent = {
        ...ev,
        customFields: (ev.customFields ?? []).map((cf) =>
          cf.id === field.id
            ? {
                ...cf,
                label: field.label,
                policy: field.policy,
                descriptionTh: field.descriptionTh,
                placeholderTh: field.placeholderTh,
                options: field.options ?? cf.options,
                visibilityCondition: field.visibilityCondition,
              }
            : cf
        ),
      };
      upsertEventRow(updatedEv);
    }
  }
  recordAudit(
    user,
    'PLATFORM-HQ',
    `อัปเดตคลังฟิลด์กลาง (${field.fieldKey})`,
    `Policy: ${field.policy} · Type: ${field.type}`
  );
  return okSnapshot(res, user.id);
});

app.post('/api/form-builder/rules', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const rule = req.body?.rule as ConditionalRule;
  db.prepare(`
    INSERT INTO conditional_rules (id, sort_order, source_field_key, target_key, detail_json)
    VALUES (?, 500, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      source_field_key = excluded.source_field_key,
      target_key = excluded.target_key,
      detail_json = excluded.detail_json
  `).run(rule.id, rule.sourceFieldKey, rule.targetKey, JSON.stringify(rule));

  if (rule.targetType === 'field') {
    const gfRow = db
      .prepare('SELECT detail_json FROM global_fields WHERE id = ?')
      .get(rule.targetKey) as { detail_json: string } | undefined;
    if (gfRow) {
      const gf = JSON.parse(gfRow.detail_json) as GlobalFormFieldDef;
      db.prepare('UPDATE global_fields SET detail_json = ? WHERE id = ?').run(
        JSON.stringify({ ...gf, visibilityCondition: rule }),
        gf.id
      );
    }
    const evRows = db.prepare('SELECT detail_json FROM events').all() as { detail_json: string }[];
    for (const r of evRows) {
      const ev = JSON.parse(r.detail_json) as RaceEvent;
      if ((ev.customFields ?? []).some((cf) => cf.id === rule.targetKey)) {
        upsertEventRow({
          ...ev,
          customFields: (ev.customFields ?? []).map((cf) =>
            cf.id === rule.targetKey ? { ...cf, visibilityCondition: rule } : cf
          ),
        });
      }
    }
  }
  recordAudit(
    user,
    'PLATFORM-HQ',
    `เพิ่มกฎ Conditional Logic (${rule.id})`,
    `IF ${rule.sourceFieldKey} ${rule.operator} "${rule.value}" -> SHOW ${rule.targetKey}`
  );
  return okSnapshot(res, user.id);
});

app.delete('/api/form-builder/rules/:id', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  db.prepare('DELETE FROM conditional_rules WHERE id = ?').run(req.params.id);
  return okSnapshot(res, user.id);
});

app.post('/api/form-builder/templates', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const steps = (
    db
      .prepare('SELECT detail_json FROM registration_steps ORDER BY step_order ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as RegistrationStepDef);
  const rules = (
    db.prepare('SELECT detail_json FROM conditional_rules').all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as ConditionalRule);

  const newTpl: FormTemplate = {
    id: String(req.body?.id || `tpl-${Date.now()}`),
    code: String(req.body?.code ?? ''),
    nameTh: String(req.body?.nameTh ?? ''),
    descriptionTh: String(req.body?.descriptionTh ?? ''),
    status: 'published',
    versionLabel: 'v1.0',
    updatedAt: nowThaiStamp(),
    steps,
    fieldIds: ['cf_blood', 'cf_has_medical', 'cf_medical', 'cf_club'],
    conditionalRules: rules,
  };
  db.prepare(`
    INSERT INTO form_templates (id, sort_order, code, status, version_label, updated_at, detail_json)
    VALUES (?, 500, ?, ?, ?, ?, ?)
  `).run(
    newTpl.id,
    newTpl.code,
    newTpl.status,
    newTpl.versionLabel,
    newTpl.updatedAt,
    JSON.stringify(newTpl)
  );
  recordAudit(user, 'PLATFORM-HQ', `สร้างแม่แบบฟอร์มใหม่ (${newTpl.code})`, newTpl.nameTh);
  return okSnapshot(res, user.id);
});

app.post('/api/form-builder/templates/:id/publish', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const tRow = db
    .prepare('SELECT detail_json FROM form_templates WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!tRow) return res.status(404).json({ ok: false, error: 'ไม่พบแม่แบบ' });
  const tpl = JSON.parse(tRow.detail_json) as FormTemplate;
  const nextVerNum = Number(tpl.versionLabel.replace(/[^0-9.]/g, '')) + 0.1;
  const updated: FormTemplate = {
    ...tpl,
    status: 'published',
    versionLabel: `v${nextVerNum.toFixed(1)}`,
    updatedAt: nowThaiStamp(),
  };
  db.prepare(`
    UPDATE form_templates SET status = ?, version_label = ?, updated_at = ?, detail_json = ? WHERE id = ?
  `).run(updated.status, updated.versionLabel, updated.updatedAt, JSON.stringify(updated), tpl.id);
  recordAudit(user, 'PLATFORM-HQ', `Publish แม่แบบฟอร์ม ${tpl.id}`, String(req.body?.summary ?? ''));
  return okSnapshot(res, user.id);
});

app.post('/api/form-builder/field-requests', (req, res) => {
  const { user } = resolveSessionUser(req);
  const payload = req.body ?? {};
  const orgId = String(payload.organizationId ?? '');
  if (!hasOrgRole(user, orgId, ['owner', 'event_manager'])) {
    return res.status(403).json({ ok: false, error: 'ไม่มีสิทธิ์ส่งคำขอเพิ่มฟิลด์' });
  }
  const cnt = (
    db.prepare('SELECT COUNT(*) AS cnt FROM field_requests').get() as { cnt: number }
  ).cnt;
  const newReq: OrganizerFieldRequest = {
    ...payload,
    id: String(payload.id || `freq-${Date.now()}`),
    requestCode: String(payload.requestCode || `REQ-FRM-260${cnt + 1}`),
    status: 'pending',
    createdAt: nowThaiStamp(),
  };
  db.prepare(`
    INSERT INTO field_requests (id, sort_order, request_code, organization_id, event_id, status, created_at, detail_json)
    VALUES (?, 1, ?, ?, ?, ?, ?, ?)
  `).run(
    newReq.id,
    newReq.requestCode,
    newReq.organizationId,
    newReq.eventId,
    newReq.status,
    newReq.createdAt,
    JSON.stringify(newReq)
  );
  recordAudit(
    user,
    newReq.organizationId,
    `ผู้จัดส่งคำขอเพิ่มฟิลด์ใบสมัคร (${newReq.requestCode})`,
    `${newReq.requestedLabelTh} [${newReq.inputType}] -> รอ Platform Owner อนุมัติ`,
    newReq.eventId
  );
  return okSnapshot(res, user!.id);
});

app.post('/api/form-builder/field-requests/:id/resolve', (req, res) => {
  const { user } = resolveSessionUser(req);
  if (!user?.isPlatformAdmin) {
    return res.status(403).json({ ok: false, error: 'สงวนสิทธิ์เฉพาะ Platform Owner' });
  }
  const fRow = db
    .prepare('SELECT detail_json FROM field_requests WHERE id = ?')
    .get(req.params.id) as { detail_json: string } | undefined;
  if (!fRow) return res.status(404).json({ ok: false, error: 'ไม่พบคำขอฟิลด์' });
  const freq = JSON.parse(fRow.detail_json) as OrganizerFieldRequest;
  const decision = req.body?.decision === 'approved' ? 'approved' : 'rejected';
  const policy = (req.body?.policy ?? 'CONFIGURABLE') as FormFieldPolicy;
  const adminNote = String(req.body?.adminNote ?? '');

  const updatedFreq: OrganizerFieldRequest = {
    ...freq,
    status: decision,
    adminNote,
    resolvedAt: nowThaiStamp(),
  };
  db.prepare('UPDATE field_requests SET status = ?, detail_json = ? WHERE id = ?').run(
    decision,
    JSON.stringify(updatedFreq),
    freq.id
  );

  if (decision === 'approved') {
    const newFieldId = `cf_${freq.requestedFieldKey}`;
    const newGlobalField: GlobalFormFieldDef = {
      id: newFieldId,
      fieldKey: freq.requestedFieldKey,
      label: freq.requestedLabelTh,
      type: freq.inputType,
      stepKey: freq.targetStepKey,
      required: freq.required,
      isSensitive: freq.isSensitive,
      policy,
      options: freq.options,
      categoryTag: 'custom_library',
    };
    db.prepare(`
      INSERT OR IGNORE INTO global_fields (id, sort_order, field_key, policy, input_type, detail_json)
      VALUES (?, 500, ?, ?, ?, ?)
    `).run(
      newGlobalField.id,
      newGlobalField.fieldKey,
      newGlobalField.policy,
      newGlobalField.type,
      JSON.stringify(newGlobalField)
    );

    const evRow = db
      .prepare('SELECT detail_json FROM events WHERE id = ?')
      .get(freq.eventId) as { detail_json: string } | undefined;
    if (evRow) {
      const ev = JSON.parse(evRow.detail_json) as RaceEvent;
      const curFields = ev.customFields ?? [];
      if (!curFields.some((f) => f.id === newFieldId)) {
        upsertEventRow({
          ...ev,
          publishedFormVersion: 'v1.3-published',
          customFields: [...curFields, newGlobalField],
        });
      }
    }
  }

  recordAudit(
    user,
    freq.organizationId,
    `Platform Owner ${decision === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}คำขอฟิลด์ ${freq.requestCode}`,
    `${freq.requestedLabelTh} · สิทธิ์: ${policy} · ${adminNote}`,
    freq.eventId
  );
  return okSnapshot(res, user.id);
});

/* ==================== DEV RESET TO INITIAL TEST SEED ==================== */

app.post('/api/dev/reset', requireSandboxTools, (_req, res) => {
  seedDatabase(true);
  clearSessionCookie(res);
  return okSnapshot(res, null);
});

/* ==================== STATIC SPA HOSTING (PRODUCTION / DOCKER) ==================== */

const __serverDir = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__serverDir, '..', 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

if (process.env.SERVE_STATIC === '1' || process.env.NODE_ENV === 'production') {
  if (fs.existsSync(INDEX_HTML_PATH)) {
    app.use(express.static(DIST_DIR));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        res.sendFile(INDEX_HTML_PATH);
        return;
      }
      next();
    });
  }
}

const PORT = Number(process.env.API_PORT || 3001);
const HOST = process.env.API_HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`[Kratai API] SQLite server listening on http://${HOST}:${PORT} (DB: ${DB_FILE_PATH})`);
  console.log(`[Kratai API] sandbox tools: ${SANDBOX_TOOLS ? 'ON (dev switcher, reset, simulated social sign-in)' : 'OFF'}`);
});
