import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  DEMO_CUSTOM_FIELDS,
  DEMO_ORGANIZATIONS,
  EXTRA_SOUVENIRS,
  INITIAL_AUDIT_LOGS,
  INITIAL_EVENTS,
  INITIAL_INVITATIONS,
  INITIAL_MERCH_ORDERS,
  INITIAL_PAYOUTS,
  INITIAL_PRODUCTION_INQUIRIES,
  INITIAL_REGISTRATIONS,
  INITIAL_USERS,
} from '../src/data/mockData';
import {
  INITIAL_CONDITIONAL_RULES,
  INITIAL_FIELD_REQUESTS,
  INITIAL_FORM_TEMPLATES,
  INITIAL_GLOBAL_FIELDS,
  INITIAL_REGISTRATION_STEPS,
} from '../src/data/formBuilderData';
import {
  DEFAULT_PLATFORM_PROFILE_CONFIG,
  SEEDED_OLDMOAT_RACE_RESULT,
  SEEDED_RUNNER_901_ACHIEVEMENTS,
  SEEDED_RUNNER_901_LOGIN_HISTORY,
  SEEDED_RUNNER_901_PROFILE,
} from '../src/data/runnerProfileDefaults';
import { SEEDED_SAVED_BOOKS } from '../src/data/seededSavedBooks';
import { coreTextFromFreeBlocks } from '../src/data/eventPageConvert';
import { BLOOD_GROUP_OPTIONS } from '../src/data/registrationForm';
import type {
  AuditLogEntry,
  ConditionalRule,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizationMembership,
  OrganizerFieldRequest,
  PayoutBatch,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  TeamInvitation,
  UserAccount,
} from '../src/types';
import { hashPassword } from './auth';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const DB_FILE_PATH = path.resolve(
  dataDir,
  process.env.KRATAI_DB_FILENAME || 'kratai.sqlite'
);

export const db = new DatabaseSync(DB_FILE_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export interface SystemStatePayload {
  users: UserAccount[];
  organizations: Organization[];
  invitations: TeamInvitation[];
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  productionInquiries: ProductionInquiry[];
  payouts: PayoutBatch[];
  auditLogs: AuditLogEntry[];
  formTemplates: FormTemplate[];
  registrationSteps: RegistrationStepDef[];
  globalFields: GlobalFormFieldDef[];
  conditionalRules: ConditionalRule[];
  fieldRequests: OrganizerFieldRequest[];
  platformProfileConfig: PlatformProfileConfig;
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      code TEXT NOT NULL,
      full_name_th TEXT NOT NULL,
      full_name_en TEXT NOT NULL,
      contact_email TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      has_password INTEGER NOT NULL DEFAULT 0,
      password_hash TEXT,
      demo_password_hint TEXT,
      is_platform_admin INTEGER NOT NULL DEFAULT 0,
      demo_role_summary TEXT NOT NULL DEFAULT '',
      is_demo_preset INTEGER NOT NULL DEFAULT 0,
      runner_profile_json TEXT,
      identities_json TEXT NOT NULL DEFAULT '[]',
      device_sessions_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
      ON users(LOWER(contact_email))
      WHERE contact_email IS NOT NULL;

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      code TEXT NOT NULL,
      name_th TEXT NOT NULL,
      name_en TEXT NOT NULL,
      province TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      workflow_status TEXT,
      payout_ready INTEGER NOT NULL DEFAULT 0,
      payout_bank_summary TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_memberships (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      assigned_event_ids_json TEXT,
      PRIMARY KEY (user_id, organization_id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      invite_code TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_email TEXT,
      role TEXT NOT NULL,
      assigned_event_ids_json TEXT,
      expires_at TEXT NOT NULL,
      used_by_user_id TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      code TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      title_th TEXT NOT NULL,
      title_en TEXT NOT NULL,
      province TEXT NOT NULL,
      region TEXT NOT NULL,
      venue TEXT NOT NULL,
      event_date TEXT NOT NULL,
      status TEXT NOT NULL,
      total_event_quota INTEGER NOT NULL,
      fee_bearer_policy TEXT NOT NULL,
      cover_image_url TEXT,
      cover_image_alt TEXT,
      gallery_image_urls_json TEXT NOT NULL DEFAULT '[]',
      active_template_id TEXT,
      published_form_version TEXT,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      reg_code TEXT NOT NULL UNIQUE,
      order_code TEXT NOT NULL,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL,
      runner_user_id TEXT,
      buyer_name TEXT NOT NULL,
      participant_name_th TEXT NOT NULL,
      participant_name_en TEXT NOT NULL,
      email TEXT NOT NULL,
      shirt_size TEXT NOT NULL,
      bib_number TEXT,
      qr_check_in_token TEXT NOT NULL,
      registration_status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      refund_status TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL,
      snapshot_base_satang INTEGER NOT NULL,
      snapshot_platform_fee_satang INTEGER NOT NULL,
      snapshot_runner_fee_satang INTEGER NOT NULL,
      snapshot_organizer_fee_satang INTEGER NOT NULL,
      snapshot_total_charged_satang INTEGER NOT NULL,
      snapshot_refunded_satang INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      refunded_at TEXT,
      detail_json TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_unique_bib
      ON registrations(event_id, UPPER(bib_number))
      WHERE bib_number IS NOT NULL;

    CREATE TABLE IF NOT EXISTS merch_orders (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      merch_order_code TEXT NOT NULL UNIQUE,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      buyer_user_id TEXT,
      buyer_name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      delivered_qty INTEGER NOT NULL DEFAULT 0,
      delivery_method TEXT NOT NULL,
      unit_price_satang INTEGER NOT NULL,
      shipping_satang INTEGER NOT NULL,
      total_paid_satang INTEGER NOT NULL,
      payment_status TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL,
      pickup_token TEXT NOT NULL,
      linked_registration_code TEXT,
      created_at TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS production_inquiries (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      inquiry_code TEXT NOT NULL UNIQUE,
      organization_id TEXT,
      event_id TEXT,
      context_type TEXT NOT NULL,
      quote_status TEXT NOT NULL,
      production_status TEXT NOT NULL,
      net_qty_to_produce INTEGER NOT NULL,
      quoted_total_satang INTEGER,
      created_at TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      payout_code TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL,
      scheduled_date TEXT NOT NULL,
      net_payout_satang INTEGER NOT NULL,
      status TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL,
      event_id TEXT,
      timestamp TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action_summary TEXT NOT NULL,
      detail_change TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS form_templates (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      code TEXT NOT NULL,
      status TEXT NOT NULL,
      version_label TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS registration_steps (
      id TEXT PRIMARY KEY,
      step_key TEXT NOT NULL UNIQUE,
      step_order INTEGER NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_system_locked INTEGER NOT NULL DEFAULT 0,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS global_fields (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      field_key TEXT NOT NULL UNIQUE,
      policy TEXT NOT NULL,
      input_type TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conditional_rules (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      source_field_key TEXT NOT NULL,
      target_key TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_requests (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 1000,
      request_code TEXT NOT NULL UNIQUE,
      organization_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      detail_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_config (
      key TEXT PRIMARY KEY,
      detail_json TEXT NOT NULL
    );
  `);

  // Safe column migration on existing SQLite files
  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userCols.some((c) => c.name === 'user_meta_json')) {
    db.exec("ALTER TABLE users ADD COLUMN user_meta_json TEXT NOT NULL DEFAULT '{}';");
  }
}

function normalizeCategoryDistanceCode(code: string, distanceKm: number): string {
  if (/km/i.test(code)) return code;
  const replaced = code
    .replace(/(\d+(?:\.\d+)?)K\b/i, '$1 km')
    .replace(/\s+Trail$/i, '')
    .trim();
  if (/km/i.test(replaced)) return replaced;
  return `${distanceKm} km`;
}

export function upsertOrganizationRow(org: Organization, sortOrder = 500): void {
  db.prepare(`
    INSERT INTO organizations (
      id, sort_order, code, name_th, name_en, province,
      verification_status, workflow_status, payout_ready,
      payout_bank_summary, contact_email, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name_th = excluded.name_th,
      name_en = excluded.name_en,
      province = excluded.province,
      verification_status = excluded.verification_status,
      workflow_status = excluded.workflow_status,
      payout_ready = excluded.payout_ready,
      payout_bank_summary = excluded.payout_bank_summary,
      contact_email = excluded.contact_email,
      detail_json = excluded.detail_json
  `).run(
    org.id,
    sortOrder,
    org.code,
    org.nameTh,
    org.nameEn,
    org.province,
    org.verificationStatus,
    org.workflowStatus ?? null,
    org.payoutReady ? 1 : 0,
    org.payoutBankSummary,
    org.contactEmail,
    JSON.stringify(org)
  );
}

export function upsertUserRow(
  user: UserAccount,
  options?: { passwordPlain?: string; preservePasswordHash?: boolean; sortOrder?: number }
): void {
  const existing = db
    .prepare('SELECT password_hash, sort_order, user_meta_json FROM users WHERE id = ?')
    .get(user.id) as
    | { password_hash: string | null; sort_order: number; user_meta_json: string | null }
    | undefined;
  const existingMeta = existing?.user_meta_json
    ? (JSON.parse(existing.user_meta_json) as { createdAt?: string })
    : {};

  let pwHash: string | null = existing?.password_hash ?? null;
  if (options?.passwordPlain) {
    pwHash = hashPassword(options.passwordPlain);
  } else if (!options?.preservePasswordHash && user.hasPassword && !pwHash) {
    pwHash = hashPassword(user.demoPasswordHint || 'demo1234');
  } else if (!user.hasPassword) {
    pwHash = null;
  }

  const sortOrder = options?.sortOrder ?? existing?.sort_order ?? 500;
  const userMeta = {
    accountStatus: user.accountStatus ?? 'active',
    deletionRequestReason: user.deletionRequestReason,
    deletionRequestedAt: user.deletionRequestedAt,
    loginHistory: user.loginHistory ?? [],
    achievements: user.achievements ?? [],
    // Keep the first-seen creation time; brand-new rows get "now". Rows that predate
    // this field keep it unset rather than inventing a date.
    createdAt: user.createdAt ?? existingMeta.createdAt ?? (existing ? undefined : new Date().toISOString()),
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    consents: user.consents ?? [],
  };

  db.prepare(`
    INSERT INTO users (
      id, sort_order, code, full_name_th, full_name_en, contact_email,
      email_verified, has_password, password_hash, demo_password_hint,
      is_platform_admin, demo_role_summary, is_demo_preset,
      runner_profile_json, identities_json, device_sessions_json, user_meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      full_name_th = excluded.full_name_th,
      full_name_en = excluded.full_name_en,
      contact_email = excluded.contact_email,
      email_verified = excluded.email_verified,
      has_password = excluded.has_password,
      password_hash = excluded.password_hash,
      demo_password_hint = excluded.demo_password_hint,
      is_platform_admin = excluded.is_platform_admin,
      demo_role_summary = excluded.demo_role_summary,
      is_demo_preset = excluded.is_demo_preset,
      runner_profile_json = excluded.runner_profile_json,
      identities_json = excluded.identities_json,
      device_sessions_json = excluded.device_sessions_json,
      user_meta_json = excluded.user_meta_json
  `).run(
    user.id,
    sortOrder,
    user.code,
    user.fullNameTh,
    user.fullNameEn,
    user.contactEmail,
    user.emailVerified ? 1 : 0,
    user.hasPassword ? 1 : 0,
    pwHash,
    user.demoPasswordHint ?? null,
    user.isPlatformAdmin ? 1 : 0,
    user.demoRoleSummary,
    user.isDemoPreset ? 1 : 0,
    user.runnerProfile ? JSON.stringify(user.runnerProfile) : null,
    JSON.stringify(user.identities ?? []),
    JSON.stringify(user.sessions ?? []),
    JSON.stringify(userMeta)
  );

  db.prepare('DELETE FROM organization_memberships WHERE user_id = ?').run(user.id);
  const insertMem = db.prepare(`
    INSERT INTO organization_memberships (user_id, organization_id, role, assigned_event_ids_json)
    VALUES (?, ?, ?, ?)
  `);
  for (const m of user.memberships ?? []) {
    insertMem.run(
      user.id,
      m.organizationId,
      m.role,
      m.assignedEventIds ? JSON.stringify(m.assignedEventIds) : null
    );
  }
}

export function upsertEventRow(ev: RaceEvent, sortOrder = 500): void {
  const existing = db
    .prepare('SELECT sort_order FROM events WHERE id = ?')
    .get(ev.id) as { sort_order: number } | undefined;

  db.prepare(`
    INSERT INTO events (
      id, sort_order, code, organization_id, title_th, title_en,
      province, region, venue, event_date, status, total_event_quota,
      fee_bearer_policy, cover_image_url, cover_image_alt,
      gallery_image_urls_json, active_template_id, published_form_version, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      organization_id = excluded.organization_id,
      title_th = excluded.title_th,
      title_en = excluded.title_en,
      province = excluded.province,
      region = excluded.region,
      venue = excluded.venue,
      event_date = excluded.event_date,
      status = excluded.status,
      total_event_quota = excluded.total_event_quota,
      fee_bearer_policy = excluded.fee_bearer_policy,
      cover_image_url = excluded.cover_image_url,
      cover_image_alt = excluded.cover_image_alt,
      gallery_image_urls_json = excluded.gallery_image_urls_json,
      active_template_id = excluded.active_template_id,
      published_form_version = excluded.published_form_version,
      detail_json = excluded.detail_json
  `).run(
    ev.id,
    existing?.sort_order ?? sortOrder,
    ev.code,
    ev.organizationId,
    ev.titleTh,
    ev.titleEn,
    ev.province,
    ev.region,
    ev.venue,
    ev.eventDate,
    ev.status,
    ev.totalEventQuota,
    ev.feeBearerPolicy,
    ev.coverImageUrl ?? null,
    ev.coverImageAlt ?? null,
    JSON.stringify(ev.galleryImageUrls ?? []),
    ev.activeTemplateId ?? null,
    ev.publishedFormVersion ?? null,
    JSON.stringify(ev)
  );
}

export function upsertRegistrationRow(reg: RegistrationRecord, sortOrder = 500): void {
  const existing = db
    .prepare('SELECT sort_order FROM registrations WHERE id = ?')
    .get(reg.id) as { sort_order: number } | undefined;

  db.prepare(`
    INSERT INTO registrations (
      id, sort_order, reg_code, order_code, event_id, organization_id,
      category_id, runner_user_id, buyer_name, participant_name_th,
      participant_name_en, email, shirt_size, bib_number, qr_check_in_token,
      registration_status, payment_status, refund_status, fulfillment_status,
      snapshot_base_satang, snapshot_platform_fee_satang, snapshot_runner_fee_satang,
      snapshot_organizer_fee_satang, snapshot_total_charged_satang, snapshot_refunded_satang,
      created_at, paid_at, refunded_at, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      shirt_size = excluded.shirt_size,
      bib_number = excluded.bib_number,
      registration_status = excluded.registration_status,
      payment_status = excluded.payment_status,
      refund_status = excluded.refund_status,
      fulfillment_status = excluded.fulfillment_status,
      snapshot_refunded_satang = excluded.snapshot_refunded_satang,
      paid_at = excluded.paid_at,
      refunded_at = excluded.refunded_at,
      detail_json = excluded.detail_json
  `).run(
    reg.id,
    existing?.sort_order ?? sortOrder,
    reg.regCode,
    reg.orderCode,
    reg.eventId,
    reg.organizationId,
    reg.categoryId,
    reg.runnerUserId ?? null,
    reg.buyerName,
    reg.participantNameTh,
    reg.participantNameEn,
    reg.email,
    reg.shirtSize,
    reg.bibNumber ?? null,
    reg.qrCheckInToken,
    reg.registrationStatus,
    reg.paymentStatus,
    reg.refundStatus,
    reg.fulfillmentStatus,
    reg.snapshotBaseSatang,
    reg.snapshotPlatformFeeSatang,
    reg.snapshotRunnerFeeSatang,
    reg.snapshotOrganizerFeeSatang,
    reg.snapshotTotalChargedSatang,
    reg.snapshotRefundedSatang,
    reg.createdAt,
    reg.paidAt ?? null,
    reg.refundedAt ?? null,
    JSON.stringify(reg)
  );
}

export function upsertMerchOrderRow(m: MerchOrderRecord, sortOrder = 500): void {
  const existing = db
    .prepare('SELECT sort_order FROM merch_orders WHERE id = ?')
    .get(m.id) as { sort_order: number } | undefined;

  db.prepare(`
    INSERT INTO merch_orders (
      id, sort_order, merch_order_code, event_id, organization_id, buyer_user_id,
      buyer_name, product_id, variant_size, quantity, delivered_qty, delivery_method,
      unit_price_satang, shipping_satang, total_paid_satang, payment_status,
      fulfillment_status, pickup_token, linked_registration_code, created_at, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      delivered_qty = excluded.delivered_qty,
      payment_status = excluded.payment_status,
      fulfillment_status = excluded.fulfillment_status,
      detail_json = excluded.detail_json
  `).run(
    m.id,
    existing?.sort_order ?? sortOrder,
    m.merchOrderCode,
    m.eventId,
    m.organizationId,
    m.buyerUserId ?? null,
    m.buyerName,
    m.productId,
    m.variantSize,
    m.quantity,
    m.deliveredQty,
    m.deliveryMethod,
    m.unitPriceSatang,
    m.shippingSatang,
    m.totalPaidSatang,
    m.paymentStatus,
    m.fulfillmentStatus,
    m.pickupToken,
    m.linkedRegistrationCode ?? null,
    m.createdAt,
    JSON.stringify(m)
  );
}

export function upsertProductionInquiryRow(q: ProductionInquiry, sortOrder = 500): void {
  const existing = db
    .prepare('SELECT sort_order FROM production_inquiries WHERE id = ?')
    .get(q.id) as { sort_order: number } | undefined;

  db.prepare(`
    INSERT INTO production_inquiries (
      id, sort_order, inquiry_code, organization_id, event_id, context_type,
      quote_status, production_status, net_qty_to_produce, quoted_total_satang, created_at, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      quote_status = excluded.quote_status,
      production_status = excluded.production_status,
      quoted_total_satang = excluded.quoted_total_satang,
      detail_json = excluded.detail_json
  `).run(
    q.id,
    existing?.sort_order ?? sortOrder,
    q.inquiryCode,
    q.organizationId ?? null,
    q.eventId ?? null,
    q.contextType,
    q.quoteStatus,
    q.productionStatus,
    q.netQtyToProduce,
    q.quotedTotalSatang ?? null,
    q.createdAt,
    JSON.stringify(q)
  );
}

export function upsertPayoutRow(p: PayoutBatch, sortOrder = 500): void {
  const existing = db
    .prepare('SELECT sort_order FROM payouts WHERE id = ?')
    .get(p.id) as { sort_order: number } | undefined;

  db.prepare(`
    INSERT INTO payouts (
      id, sort_order, payout_code, organization_id, event_id,
      scheduled_date, net_payout_satang, status, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      detail_json = excluded.detail_json
  `).run(
    p.id,
    existing?.sort_order ?? sortOrder,
    p.payoutCode,
    p.organizationId,
    p.eventId,
    p.scheduledDate,
    p.netPayoutSatang,
    p.status,
    JSON.stringify(p)
  );
}

export function insertAuditLog(entry: AuditLogEntry): void {
  db.prepare(`
    INSERT OR IGNORE INTO audit_logs (
      id, organization_id, event_id, timestamp, actor_name, actor_role, action_summary, detail_change
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.organizationId,
    entry.eventId ?? null,
    entry.timestamp,
    entry.actorName,
    entry.actorRole,
    entry.actionSummary,
    entry.detailChange
  );
}

export function upsertPlatformProfileConfig(cfg: PlatformProfileConfig): void {
  db.prepare(`
    INSERT INTO platform_config (key, detail_json) VALUES ('runner_profile', ?)
    ON CONFLICT(key) DO UPDATE SET detail_json = excluded.detail_json
  `).run(JSON.stringify(cfg));
}

export function readPlatformProfileConfig(): PlatformProfileConfig {
  const row = db
    .prepare("SELECT detail_json FROM platform_config WHERE key = 'runner_profile'")
    .get() as { detail_json: string } | undefined;
  if (!row) {
    upsertPlatformProfileConfig(DEFAULT_PLATFORM_PROFILE_CONFIG);
    return DEFAULT_PLATFORM_PROFILE_CONFIG;
  }
  return JSON.parse(row.detail_json) as PlatformProfileConfig;
}

const DOI_RACEPACK_PARAGRAPH =
  'ทุกระยะการแข่งขันได้รับเสื้อวิ่งเนื้อผ้าไมโครโพลีเอสเตอร์ระบายอากาศ ป้ายหมายเลขแข่งขัน (BIB) พร้อม QR Token สำหรับรับอุปกรณ์ และเหรียญรางวัล Finisher สำหรับผู้ที่เข้าเส้นชัยภายในเวลา Cut-off ที่กำหนด';

/** Sample banner covers for the demo events (files in public/event-covers). */
const SAMPLE_EVENT_COVERS: Record<string, string> = {
  'evt-doisuthep-2026': '/event-covers/evt-doisuthep-2026.webp',
  'evt-promthep-2026': '/event-covers/evt-promthep-2026.webp',
  'evt-oldmoat-2026': '/event-covers/evt-oldmoat-2026.webp',
  'evt-maerim-suspended': '/event-covers/evt-maerim-suspended.webp',
};
const SAMPLE_COVER_ALT = 'ภาพแบนเนอร์ตัวอย่างประกอบงานวิ่ง';

export function seedDatabase(forceReset = false): void {
  initSchema();

  const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (countRow.cnt > 0 && !forceReset) {
    // Ensure platform profile config exists
    readPlatformProfileConfig();
    // Idempotent migration: ensure seeded runner USR-901 has Facebook + full Runner Profile + Race Result
    const runner = getUserById('usr-runner');
    if (runner) {
      const hasFb = runner.identities.some((i) => i.provider === 'facebook');
      const hasLatestSeededParticipants = Boolean(
        runner.runnerProfile?.savedParticipants?.some(
          (p) => p.id === 'sp-901-2' && Boolean(p.emergencyContactRelation)
        )
      );
      const needsProfileUpgrade =
        !runner.runnerProfile?.savedAddresses ||
        !runner.runnerProfile?.firstNameEn ||
        !hasLatestSeededParticipants;
      if (!hasFb || needsProfileUpgrade) {
        const existingCustomParticipants = (
          runner.runnerProfile?.savedParticipants ?? []
        ).filter((p) => p.id !== 'sp-901-1' && p.id !== 'sp-901-2');
        upsertUserRow(
          {
            ...runner,
            runnerProfile: needsProfileUpgrade
              ? {
                  ...SEEDED_RUNNER_901_PROFILE,
                  ...runner.runnerProfile,
                  firstNameEn:
                    runner.runnerProfile?.firstNameEn ??
                    SEEDED_RUNNER_901_PROFILE.firstNameEn,
                  lastNameEn:
                    runner.runnerProfile?.lastNameEn ??
                    SEEDED_RUNNER_901_PROFILE.lastNameEn,
                  nicknameEn:
                    runner.runnerProfile?.nicknameEn ??
                    SEEDED_RUNNER_901_PROFILE.nicknameEn,
                  savedParticipants: hasLatestSeededParticipants
                    ? runner.runnerProfile!.savedParticipants
                    : [
                        ...(SEEDED_RUNNER_901_PROFILE.savedParticipants ?? []),
                        ...existingCustomParticipants,
                      ],
                }
              : runner.runnerProfile,
            achievements:
              runner.achievements && runner.achievements.length > 0
                ? runner.achievements
                : SEEDED_RUNNER_901_ACHIEVEMENTS,
            loginHistory:
              runner.loginHistory && runner.loginHistory.length > 0
                ? runner.loginHistory
                : SEEDED_RUNNER_901_LOGIN_HISTORY,
            identities: hasFb
              ? runner.identities
              : [
                  ...runner.identities,
                  {
                    id: 'id-901-fb',
                    provider: 'facebook',
                    providerSubject: 'fb-uid-9014402',
                    providerEmail: 'kanpitcha.runner@demo.kratai.local',
                    linkedAt: '2026-10-14 19:20',
                  },
                ],
          },
          { preservePasswordHash: true }
        );
      }
    }
    // Idempotent migration: the Doi Suthep overview no longer repeats the race pack
    // (it has its own section on the event page).
    const doiRow = db
      .prepare("SELECT detail_json FROM events WHERE id = 'evt-doisuthep-2026'")
      .get() as { detail_json: string } | undefined;
    if (doiRow) {
      const doi = JSON.parse(doiRow.detail_json) as RaceEvent;
      const kept = (doi.overviewParagraphs ?? []).filter((p) => p !== DOI_RACEPACK_PARAGRAPH);
      if (kept.length !== (doi.overviewParagraphs ?? []).length) {
        db.prepare("UPDATE events SET detail_json = ? WHERE id = 'evt-doisuthep-2026'").run(
          JSON.stringify({ ...doi, overviewParagraphs: kept })
        );
      }
    }
    // Idempotent migration: sample banner covers for the public demo events,
    // set only where the event has no cover yet so organizer uploads are kept.
    for (const [eventId, url] of Object.entries(SAMPLE_EVENT_COVERS)) {
      const row = db
        .prepare('SELECT detail_json FROM events WHERE id = ?')
        .get(eventId) as { detail_json: string } | undefined;
      if (!row) continue;
      const ev = JSON.parse(row.detail_json) as RaceEvent;
      if (ev.coverImageUrl) continue;
      db.prepare('UPDATE events SET detail_json = ?, cover_image_url = ?, cover_image_alt = ? WHERE id = ?').run(
        JSON.stringify({ ...ev, coverImageUrl: url, coverImageAlt: SAMPLE_COVER_ALT }),
        url,
        SAMPLE_COVER_ALT,
        eventId
      );
    }
    // Idempotent migration: souvenirs added to the seed on 23 Nov 2026 reach databases
    // seeded earlier. Products already present (same id) are left untouched.
    for (const eventId of new Set(EXTRA_SOUVENIRS.map((p) => p.eventId))) {
      const row = db
        .prepare('SELECT detail_json FROM events WHERE id = ?')
        .get(eventId) as { detail_json: string } | undefined;
      if (!row) continue;
      const ev = JSON.parse(row.detail_json) as RaceEvent;
      const have = new Set((ev.products ?? []).map((p) => p.id));
      const missing = EXTRA_SOUVENIRS.filter((p) => p.eventId === eventId && !have.has(p.id));
      if (missing.length === 0) continue;
      db.prepare('UPDATE events SET detail_json = ? WHERE id = ?').run(
        JSON.stringify({ ...ev, products: [...(ev.products ?? []), ...missing] }),
        eventId
      );
    }
    // Idempotent migration: address books and saved registrants for the other demo
    // accounts (23 Nov 2026). Only fills an account that has never had either list,
    // so a user's own edits or deletions are never overwritten.
    for (const [userId, book] of Object.entries(SEEDED_SAVED_BOOKS)) {
      const user = getUserById(userId);
      if (!user) continue;
      const profile = user.runnerProfile;
      if (profile?.savedAddresses !== undefined || profile?.savedParticipants !== undefined) continue;
      upsertUserRow({ ...user, runnerProfile: { ...(profile ?? {}), ...book } });
    }
    // Idempotent migration (23 Nov 2026): the whole-event quota switch. Events stored before
    // the switch existed get it set to "on", so their total cap keeps working as before.
    const eventRows = db.prepare('SELECT id, detail_json FROM events').all() as {
      id: string;
      detail_json: string;
    }[];
    for (const row of eventRows) {
      const ev = JSON.parse(row.detail_json) as RaceEvent;
      if (typeof ev.totalEventQuotaEnabled === 'boolean') continue;
      db.prepare('UPDATE events SET detail_json = ? WHERE id = ?').run(
        JSON.stringify({ ...ev, totalEventQuotaEnabled: true }),
        row.id
      );
    }
    // Idempotent migration (24 Nov 2026): the event page is one template again. Text the
    // organizer kept in a published free-block page (v 2) is copied back to the event's own
    // fields once; the page data itself stays in detail_json, unused (decision: keep, not delete).
    for (const row of db.prepare('SELECT id, detail_json FROM events').all() as { id: string; detail_json: string }[]) {
      const ev = JSON.parse(row.detail_json) as RaceEvent;
      if (ev.detailPageV !== 2 || ev.detailTextFromPageAt) continue;
      const text = coreTextFromFreeBlocks({ customBlocks: ev.detailCustomBlocks ?? [] });
      const next: RaceEvent = { ...ev, detailTextFromPageAt: new Date().toISOString() };
      if (text.about) {
        if (text.about.paragraphs.length > 0) next.overviewParagraphs = text.about.paragraphs;
        next.highlights = text.about.highlights;
      }
      if (text.racepack && text.racepack.items.length > 0) next.racePackItems = text.racepack.items;
      if (text.schedule && text.schedule.items.length > 0) next.scheduleItems = text.schedule.items;
      db.prepare('UPDATE events SET detail_json = ? WHERE id = ?').run(JSON.stringify(next), row.id);
    }
    // Idempotent migration (25 Nov 2026, user request): the blood group question offers
    // A+ … O- and "unknown". Only lists still equal to an old seeded list (A, B, AB, O with or
    // without ไม่ทราบ) are replaced, in the global field library and in each event's published
    // form; organizer edits, drafts and answers already given stay as they are.
    const isOldBloodList = (opts: unknown) =>
      Array.isArray(opts) &&
      ['A|B|AB|O', 'A|B|AB|O|ไม่ทราบ'].includes((opts as string[]).join('|'));
    const gfBlood = db.prepare("SELECT detail_json FROM global_fields WHERE id = 'cf_blood'").get() as
      | { detail_json: string }
      | undefined;
    if (gfBlood) {
      const gf = JSON.parse(gfBlood.detail_json) as { options?: string[] };
      if (isOldBloodList(gf.options)) {
        db.prepare("UPDATE global_fields SET detail_json = ? WHERE id = 'cf_blood'").run(
          JSON.stringify({ ...gf, options: [...BLOOD_GROUP_OPTIONS] })
        );
      }
    }
    for (const row of db.prepare('SELECT id, detail_json FROM events').all() as { id: string; detail_json: string }[]) {
      const ev = JSON.parse(row.detail_json) as RaceEvent;
      if (!(ev.customFields ?? []).some((cf) => cf.id === 'cf_blood' && isOldBloodList(cf.options))) continue;
      const next: RaceEvent = {
        ...ev,
        customFields: (ev.customFields ?? []).map((cf) =>
          cf.id === 'cf_blood' && isOldBloodList(cf.options) ? { ...cf, options: [...BLOOD_GROUP_OPTIONS] } : cf
        ),
      };
      db.prepare('UPDATE events SET detail_json = ? WHERE id = ?').run(JSON.stringify(next), row.id);
    }
    const reg07Row = db
      .prepare("SELECT detail_json FROM registrations WHERE id = 'reg-07'")
      .get() as { detail_json: string } | undefined;
    if (reg07Row) {
      const reg07 = JSON.parse(reg07Row.detail_json) as RegistrationRecord;
      if (!reg07.raceResult) {
        upsertRegistrationRow({ ...reg07, raceResult: SEEDED_OLDMOAT_RACE_RESULT });
      }
    }
    return;
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    if (forceReset) {
      db.exec(`
        DELETE FROM auth_sessions;
        DELETE FROM organization_memberships;
        DELETE FROM invitations;
        DELETE FROM merch_orders;
        DELETE FROM registrations;
        DELETE FROM payouts;
        DELETE FROM production_inquiries;
        DELETE FROM events;
        DELETE FROM organizations;
        DELETE FROM users;
        DELETE FROM audit_logs;
        DELETE FROM form_templates;
        DELETE FROM registration_steps;
        DELETE FROM global_fields;
        DELETE FROM conditional_rules;
        DELETE FROM field_requests;
        DELETE FROM platform_config;
      `);
    }

    upsertPlatformProfileConfig(DEFAULT_PLATFORM_PROFILE_CONFIG);

    DEMO_ORGANIZATIONS.forEach((org, idx) => upsertOrganizationRow(org, idx + 1));

    INITIAL_USERS.forEach((u, idx) =>
      upsertUserRow(u, {
        passwordPlain: u.hasPassword ? u.demoPasswordHint || 'demo1234' : undefined,
        sortOrder: idx + 1,
      })
    );

    const invStmt = db.prepare(`
      INSERT INTO invitations (
        id, sort_order, invite_code, organization_id, target_email,
        role, assigned_event_ids_json, expires_at, used_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    INITIAL_INVITATIONS.forEach((inv, idx) => {
      invStmt.run(
        inv.id,
        idx + 1,
        inv.inviteCode,
        inv.organizationId,
        inv.targetEmail ?? null,
        inv.role,
        inv.assignedEventIds ? JSON.stringify(inv.assignedEventIds) : null,
        inv.expiresAt,
        inv.usedByUserId ?? null
      );
    });

    INITIAL_EVENTS.forEach((rawEv, idx) => {
      const normalizedEv: RaceEvent = {
        ...rawEv,
        activeTemplateId: rawEv.activeTemplateId ?? 'tpl-halfmarathon',
        totalEventQuotaEnabled: rawEv.totalEventQuotaEnabled ?? true,
        publishedFormVersion: rawEv.publishedFormVersion ?? 'v1.2-published',
        customFields:
          rawEv.customFields === undefined &&
          (rawEv.id === 'evt-doisuthep-2026' ||
            rawEv.id === 'evt-promthep-2026' ||
            rawEv.id === 'evt-oldmoat-2026')
            ? DEMO_CUSTOM_FIELDS
            : rawEv.customFields,
        categories: rawEv.categories.map((cat) => ({
          ...cat,
          code: normalizeCategoryDistanceCode(cat.code, cat.distanceKm),
        })),
      };
      upsertEventRow(normalizedEv, idx + 1);
    });

    INITIAL_REGISTRATIONS.forEach((rawReg, idx) => {
      let reg = rawReg;
      if (reg.customAnswers === undefined && reg.id === 'reg-01') {
        reg = {
          ...reg,
          customAnswers: {
            cf_medical: 'แพ้ยาแอสไพริน',
            cf_club: 'Chiang Mai Morning Miles',
            cf_blood: 'O+',
          },
        };
      } else if (reg.customAnswers === undefined && reg.id === 'reg-02') {
        reg = {
          ...reg,
          customAnswers: {
            cf_medical: 'ไม่มี',
            cf_club: 'Lanna Road Runners',
            cf_blood: 'B+',
          },
        };
      }
      upsertRegistrationRow(reg, idx + 1);
    });

    INITIAL_MERCH_ORDERS.forEach((m, idx) => upsertMerchOrderRow(m, idx + 1));
    INITIAL_PRODUCTION_INQUIRIES.forEach((q, idx) => upsertProductionInquiryRow(q, idx + 1));
    INITIAL_PAYOUTS.forEach((p, idx) => upsertPayoutRow(p, idx + 1));
    // Insert initial audit logs in reverse so newest has highest seq
    [...INITIAL_AUDIT_LOGS].reverse().forEach((a) => insertAuditLog(a));

    const tplStmt = db.prepare(`
      INSERT INTO form_templates (id, sort_order, code, status, version_label, updated_at, detail_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    INITIAL_FORM_TEMPLATES.forEach((t, idx) =>
      tplStmt.run(t.id, idx + 1, t.code, t.status, t.versionLabel, t.updatedAt, JSON.stringify(t))
    );

    const stepStmt = db.prepare(`
      INSERT INTO registration_steps (id, step_key, step_order, enabled, is_system_locked, detail_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    INITIAL_REGISTRATION_STEPS.forEach((s) =>
      stepStmt.run(
        s.id,
        s.key,
        s.order,
        s.enabled ? 1 : 0,
        s.isSystemLocked ? 1 : 0,
        JSON.stringify(s)
      )
    );

    const gfStmt = db.prepare(`
      INSERT INTO global_fields (id, sort_order, field_key, policy, input_type, detail_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    INITIAL_GLOBAL_FIELDS.forEach((gf, idx) =>
      gfStmt.run(gf.id, idx + 1, gf.fieldKey, gf.policy, gf.type, JSON.stringify(gf))
    );

    const ruleStmt = db.prepare(`
      INSERT INTO conditional_rules (id, sort_order, source_field_key, target_key, detail_json)
      VALUES (?, ?, ?, ?, ?)
    `);
    INITIAL_CONDITIONAL_RULES.forEach((r, idx) =>
      ruleStmt.run(r.id, idx + 1, r.sourceFieldKey, r.targetKey, JSON.stringify(r))
    );

    const freqStmt = db.prepare(`
      INSERT INTO field_requests (id, sort_order, request_code, organization_id, event_id, status, created_at, detail_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    INITIAL_FIELD_REQUESTS.forEach((fr, idx) =>
      freqStmt.run(
        fr.id,
        idx + 1,
        fr.requestCode,
        fr.organizationId,
        fr.eventId,
        fr.status,
        fr.createdAt,
        JSON.stringify(fr)
      )
    );

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function getUserById(userId: string | null | undefined): UserAccount | null {
  if (!userId) return null;
  const uRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as
    | Record<string, unknown>
    | undefined;
  if (!uRow) return null;
  return mapUserRow(uRow);
}

function mapUserRow(uRow: Record<string, unknown>): UserAccount {
  const memRows = db
    .prepare(
      'SELECT organization_id, role, assigned_event_ids_json FROM organization_memberships WHERE user_id = ?'
    )
    .all(String(uRow.id)) as {
    organization_id: string;
    role: OrganizationMembership['role'];
    assigned_event_ids_json: string | null;
  }[];

  const memberships: OrganizationMembership[] = memRows.map((m) => ({
    organizationId: m.organization_id,
    role: m.role,
    assignedEventIds: m.assigned_event_ids_json
      ? (JSON.parse(m.assigned_event_ids_json) as string[])
      : undefined,
  }));

  const meta = uRow.user_meta_json
    ? (JSON.parse(String(uRow.user_meta_json)) as {
        accountStatus?: UserAccount['accountStatus'];
        deletionRequestReason?: string;
        deletionRequestedAt?: string;
        loginHistory?: UserAccount['loginHistory'];
        achievements?: UserAccount['achievements'];
        createdAt?: string;
        passwordChangedAt?: string;
        lastLoginAt?: string;
        consents?: UserAccount['consents'];
      })
    : {};

  return {
    id: String(uRow.id),
    code: String(uRow.code),
    fullNameTh: String(uRow.full_name_th),
    fullNameEn: String(uRow.full_name_en),
    contactEmail: uRow.contact_email !== null ? String(uRow.contact_email) : null,
    emailVerified: Boolean(uRow.email_verified),
    hasPassword: Boolean(uRow.has_password),
    demoPasswordHint:
      uRow.demo_password_hint !== null ? String(uRow.demo_password_hint) : undefined,
    identities: JSON.parse(String(uRow.identities_json || '[]')),
    sessions: JSON.parse(String(uRow.device_sessions_json || '[]')),
    memberships,
    runnerProfile: uRow.runner_profile_json
      ? JSON.parse(String(uRow.runner_profile_json))
      : undefined,
    accountStatus: meta.accountStatus ?? 'active',
    deletionRequestReason: meta.deletionRequestReason,
    deletionRequestedAt: meta.deletionRequestedAt,
    loginHistory: meta.loginHistory ?? [],
    achievements: meta.achievements ?? [],
    createdAt: meta.createdAt,
    passwordChangedAt: meta.passwordChangedAt,
    lastLoginAt: meta.lastLoginAt,
    consents: meta.consents ?? [],
    isPlatformAdmin: Boolean(uRow.is_platform_admin),
    demoRoleSummary: String(uRow.demo_role_summary || ''),
    isDemoPreset: Boolean(uRow.is_demo_preset),
  };
}

export function readSystemState(): SystemStatePayload {
  const userRows = db
    .prepare('SELECT * FROM users ORDER BY sort_order ASC, rowid ASC')
    .all() as Record<string, unknown>[];
  const users = userRows.map(mapUserRow);

  const organizations = (
    db
      .prepare('SELECT detail_json FROM organizations ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as Organization);

  const invitations: TeamInvitation[] = (
    db.prepare('SELECT * FROM invitations ORDER BY sort_order ASC, rowid ASC').all() as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: String(r.id),
    inviteCode: String(r.invite_code),
    organizationId: String(r.organization_id),
    targetEmail: r.target_email !== null ? String(r.target_email) : undefined,
    role: r.role as TeamInvitation['role'],
    assignedEventIds: r.assigned_event_ids_json
      ? (JSON.parse(String(r.assigned_event_ids_json)) as string[])
      : undefined,
    expiresAt: String(r.expires_at),
    usedByUserId: r.used_by_user_id !== null ? String(r.used_by_user_id) : undefined,
  }));

  const events = (
    db.prepare('SELECT detail_json FROM events ORDER BY sort_order ASC, rowid ASC').all() as {
      detail_json: string;
    }[]
  ).map((r) => JSON.parse(r.detail_json) as RaceEvent);

  const registrations = (
    db
      .prepare('SELECT detail_json FROM registrations ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as RegistrationRecord);

  const merchOrders = (
    db
      .prepare('SELECT detail_json FROM merch_orders ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as MerchOrderRecord);

  const productionInquiries = (
    db
      .prepare('SELECT detail_json FROM production_inquiries ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as ProductionInquiry);

  const payouts = (
    db.prepare('SELECT detail_json FROM payouts ORDER BY sort_order ASC, rowid ASC').all() as {
      detail_json: string;
    }[]
  ).map((r) => JSON.parse(r.detail_json) as PayoutBatch);

  const auditLogs: AuditLogEntry[] = (
    db.prepare('SELECT * FROM audit_logs ORDER BY seq DESC LIMIT 250').all() as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    id: String(r.id),
    organizationId: String(r.organization_id),
    eventId: r.event_id !== null ? String(r.event_id) : undefined,
    timestamp: String(r.timestamp),
    actorName: String(r.actor_name),
    actorRole: String(r.actor_role),
    actionSummary: String(r.action_summary),
    detailChange: String(r.detail_change),
  }));

  const formTemplates = (
    db
      .prepare('SELECT detail_json FROM form_templates ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as FormTemplate);

  const registrationSteps = (
    db
      .prepare('SELECT detail_json FROM registration_steps ORDER BY step_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as RegistrationStepDef);

  const globalFields = (
    db
      .prepare('SELECT detail_json FROM global_fields ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as GlobalFormFieldDef);

  const conditionalRules = (
    db
      .prepare('SELECT detail_json FROM conditional_rules ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as ConditionalRule);

  const fieldRequests = (
    db
      .prepare('SELECT detail_json FROM field_requests ORDER BY sort_order ASC, rowid ASC')
      .all() as { detail_json: string }[]
  ).map((r) => JSON.parse(r.detail_json) as OrganizerFieldRequest);

  return {
    users,
    organizations,
    invitations,
    events,
    registrations,
    merchOrders,
    productionInquiries,
    payouts,
    auditLogs,
    formTemplates,
    registrationSteps,
    globalFields,
    conditionalRules,
    fieldRequests,
    platformProfileConfig: readPlatformProfileConfig(),
  };
}
