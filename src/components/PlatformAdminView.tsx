import React, { useMemo, useState } from 'react';
import {
  AuditLogEntry,
  ConditionalRule,
  EventStatus,
  FormFieldPolicy,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizerFieldRequest,
  OrgRole,
  PayoutBatch,
  PayoutStatus,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  TimeWindowFilter,
  UserAccount,
} from '../types';
import { computeMetrics, feePolicyLabel, formatThb } from '../utils/pricing';
import { BibLedgerStrip } from './BibLedgerStrip';
import { RegistrationFormBuilderAdmin } from './RegistrationFormBuilderAdmin';
import {
  IconAlert,
  IconArrowRight,
  IconBuilding,
  IconCamera,
  IconCheckCircle,
  IconClock,
  IconFlag,
  IconLedger,
  IconLock,
  IconPlus,
  IconSearch,
  IconShield,
  IconShirt,
  IconUsers,
} from './Icons';
import {
  EventStatusBadge,
  PaymentStatusBadge,
  PayoutStatusBadge,
  RefundStatusBadge,
  RegStatusBadge,
} from './StatusBadges';

import { tx, txf } from '../i18n';
export type PlatformSection =
  | 'plat_overview'
  | 'plat_orgs'
  | 'plat_events'
  | 'plat_form_builder'
  | 'plat_merch_rfq'
  | 'plat_finance'
  | 'plat_users_audit';

interface PlatformAdminViewProps {
  currentUser: UserAccount;
  activeSection: PlatformSection;
  onSelectSection: (sec: PlatformSection) => void;
  organizations: Organization[];
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  productionInquiries: ProductionInquiry[];
  payouts: PayoutBatch[];
  users: UserAccount[];
  auditLogs: AuditLogEntry[];
  formTemplates: FormTemplate[];
  registrationSteps: RegistrationStepDef[];
  globalFields: GlobalFormFieldDef[];
  conditionalRules: ConditionalRule[];
  fieldRequests: OrganizerFieldRequest[];
  platformProfileConfig?: PlatformProfileConfig;
  onUpdatePlatformProfileConfig?: (next: PlatformProfileConfig) => void;
  onUpsertStep: (step: RegistrationStepDef) => void;
  onReorderStep: (stepId: string, direction: 'up' | 'down') => void;
  onDeleteStep: (stepId: string) => void;
  onUpsertGlobalField: (field: GlobalFormFieldDef) => void;
  onAddConditionalRule: (rule: ConditionalRule) => void;
  onDeleteConditionalRule: (ruleId: string) => void;
  onPublishTemplateVersion: (templateId: string, summary: string) => void;
  onCreateTemplate: (nameTh: string, code: string, descriptionTh: string) => void;
  onResolveFieldRequest: (
    requestId: string,
    decision: 'approved' | 'rejected',
    policy: FormFieldPolicy,
    adminNote: string
  ) => void;
  onReviewOrganization: (
    orgId: string,
    action:
      | 'approve_kyc_bank'
      | 'hold_bank'
      | 'suspend_org'
      | 'reinstate_org'
      | 'under_review'
      | 'request_more_info'
      | 'reject_org',
    bankSummary?: string
  ) => void;
  onGovernEventStatus: (
    eventId: string,
    nextStatus: EventStatus,
    adminNote?: string,
    postRaceLinks?: { resultsUrl?: string; albumTitle?: string; albumUrl?: string }
  ) => void;
  onUpdateProductionInquiry: (
    inquiryId: string,
    patch: {
      quoteStatus?: ProductionInquiry['quoteStatus'];
      productionStatus?: ProductionInquiry['productionStatus'];
      quotedTotalSatang?: number;
      adminNote?: string;
    }
  ) => void;
  onUpdatePayoutBatchStatus: (payoutId: string, nextStatus: PayoutStatus) => void;
  onCreatePayoutBatch: (payload: {
    organizationId: string;
    eventId: string;
    periodLabel: string;
    scheduledDate: string;
    netPayoutSatang: number;
  }) => void;
  onAdminResolveOrForceRefund: (
    regId: string,
    decision: 'approve_succeed' | 'reject' | 'admin_force_refund',
    reason: string
  ) => void;
  onAdminUpdateUserAccess: (
    targetUserId: string,
    action:
      | { kind: 'verify_email' }
      | { kind: 'toggle_platform_admin' }
      | { kind: 'grant_org_role'; organizationId: string; role: OrgRole }
      | { kind: 'revoke_org_role'; organizationId: string }
  ) => void;
  onOpenPublicEvent: (eventId: string) => void;
  onInspectOrganizerWorkspace: (orgId: string, eventId?: string | null) => void;
}

const orgRoleTh: Record<OrgRole, string> = {
  owner: 'เจ้าขององค์กร',
  event_manager: 'ผู้จัดการงาน',
  finance: 'ฝ่ายการเงิน',
  staff: 'เจ้าหน้าที่หน้างาน',
};

export const PlatformAdminView: React.FC<PlatformAdminViewProps> = ({
  currentUser,
  activeSection,
  onSelectSection,
  organizations,
  events,
  registrations,
  merchOrders,
  productionInquiries,
  payouts,
  users,
  auditLogs,
  formTemplates,
  registrationSteps,
  globalFields,
  conditionalRules,
  fieldRequests,
  platformProfileConfig,
  onUpdatePlatformProfileConfig,
  onUpsertStep,
  onReorderStep,
  onDeleteStep,
  onUpsertGlobalField,
  onAddConditionalRule,
  onDeleteConditionalRule,
  onPublishTemplateVersion,
  onCreateTemplate,
  onResolveFieldRequest,
  onReviewOrganization,
  onGovernEventStatus,
  onUpdateProductionInquiry,
  onUpdatePayoutBatchStatus,
  onCreatePayoutBatch,
  onAdminResolveOrForceRefund,
  onAdminUpdateUserAccess,
  onOpenPublicEvent,
  onInspectOrganizerWorkspace,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('all_time');

  // Organization review state
  const [orgFilter, setOrgFilter] = useState<
    'all' | 'pending_review' | 'verified' | 'suspended'
  >('all');
  const [bankDraftMap, setBankDraftMap] = useState<Record<string, string>>({});

  // Event governance state
  const [eventQuery, setEventQuery] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<
    'all' | EventStatus
  >('all');
  const [eventAdminNoteMap, setEventAdminNoteMap] = useState<
    Record<string, string>
  >({});
  const [resultsUrlMap, setResultsUrlMap] = useState<Record<string, string>>(
    {}
  );
  const [albumTitleMap, setAlbumTitleMap] = useState<Record<string, string>>(
    {}
  );

  // RFQ management state
  const [rfqPriceThbMap, setRfqPriceThbMap] = useState<Record<string, string>>(
    {}
  );
  const [rfqNoteMap, setRfqNoteMap] = useState<Record<string, string>>({});

  // Payout & Refund state
  const [newPoOrgId, setNewPoOrgId] = useState(organizations[0]?.id ?? '');
  const [newPoEventId, setNewPoEventId] = useState(events[0]?.id ?? '');
  const [newPoLabel, setNewPoLabel] = useState('');
  const [newPoDate, setNewPoDate] = useState('2026-12-05');
  const [newPoAmountThb, setNewPoAmountThb] = useState('2500');
  const [refundFilter, setRefundFilter] = useState<
    'requested' | 'paid_all' | 'refunded'
  >('requested');
  const [adminRefundNote, setAdminRefundNote] = useState(
    'ตรวจสอบหลักฐานโดยผู้ดูแลแพลตฟอร์มเรียบร้อยแล้ว'
  );

  // Users & Global Audit state
  const [userSearch, setUserSearch] = useState('');
  const [grantOrgMap, setGrantOrgMap] = useState<Record<string, string>>({});
  const [grantRoleMap, setGrantRoleMap] = useState<Record<string, OrgRole>>({});
  const [auditOrgFilter, setAuditOrgFilter] = useState<string>('all');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const platformMetrics = useMemo(
    () => computeMetrics(events, registrations, merchOrders, timeWindow),
    [events, registrations, merchOrders, timeWindow]
  );

  const pendingOrgs = useMemo(
    () =>
      organizations.filter(
        (o) => o.verificationStatus === 'pending_review' || !o.payoutReady
      ),
    [organizations]
  );
  const inReviewEvents = useMemo(
    () => events.filter((e) => e.status === 'in_review'),
    [events]
  );
  const suspendedEvents = useMemo(
    () => events.filter((e) => e.status === 'suspended'),
    [events]
  );
  const pendingRefundRegs = useMemo(
    () => registrations.filter((r) => r.refundStatus === 'requested'),
    [registrations]
  );
  const actionablePayouts = useMemo(
    () => payouts.filter((p) => p.status === 'held' || p.status === 'scheduled'),
    [payouts]
  );
  const actionableRfqs = useMemo(
    () =>
      productionInquiries.filter(
        (q) =>
          q.quoteStatus === 'submitted' ||
          q.productionStatus === 'awaiting_approval'
      ),
    [productionInquiries]
  );

  const filteredOrgs = useMemo(
    () =>
      organizations.filter(
        (o) => orgFilter === 'all' || o.verificationStatus === orgFilter
      ),
    [organizations, orgFilter]
  );

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase();
    return events.filter((ev) => {
      const org = organizations.find((o) => o.id === ev.organizationId);
      const matchText =
        !q ||
        ev.titleTh.toLowerCase().includes(q) ||
        ev.code.toLowerCase().includes(q) ||
        ev.province.toLowerCase().includes(q) ||
        (org?.nameTh.toLowerCase().includes(q) ?? false);
      const matchStatus =
        eventStatusFilter === 'all' || ev.status === eventStatusFilter;
      return matchText && matchStatus;
    });
  }, [events, organizations, eventQuery, eventStatusFilter]);

  const filteredRefundRegs = useMemo(() => {
    if (refundFilter === 'requested') {
      return registrations.filter((r) => r.refundStatus === 'requested');
    }
    if (refundFilter === 'refunded') {
      return registrations.filter(
        (r) => r.refundStatus === 'succeeded' || r.refundStatus === 'rejected'
      );
    }
    return registrations.filter((r) => r.paymentStatus === 'succeeded');
  }, [registrations, refundFilter]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullNameTh.toLowerCase().includes(q) ||
        u.code.toLowerCase().includes(q) ||
        (u.contactEmail ?? '').toLowerCase().includes(q)
    );
  }, [users, userSearch]);

  const filteredAuditLogs = useMemo(
    () =>
      auditLogs.filter(
        (l) => auditOrgFilter === 'all' || l.organizationId === auditOrgFilter
      ),
    [auditLogs, auditOrgFilter]
  );

  const notifyAction = (msg: string) => {
    setFeedbackBanner(msg);
  };

  return (
    <div className="dashboard-workspace">
      {/* LEFT PLATFORM OWNER NAVIGATION RAIL */}
      <aside className="dashboard-rail" aria-label={tx("เมนูผู้ดูแลแพลตฟอร์มส่วนกลาง")}>
        <div className="rail-org-switcher">
          <div className="rail-field-label">{tx("โหมดการกำกับดูแลสูงสุด")}</div>
          <div className="rail-role-badge">
            <IconShield size={14} />
            <span>Platform Owner · {tx(currentUser.fullNameTh)}</span>
          </div>
        </div>

        <nav className="rail-nav-group" aria-label={tx("เมนูบริหารแพลตฟอร์ม RunEvent")}>
          <div className="rail-group-heading">{tx("ระบบส่วนกลาง (Platform HQ)")}</div>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_overview' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_overview')}
          >
            <IconShield size={16} />
            <span>{tx("ภาพรวม & คิวรออนุมัติ")}</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_orgs' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_orgs')}
          >
            <IconBuilding size={16} />
            <span>
              {tx("องค์กรผู้จัด & บัญชีรับเงิน (")}{tx(pendingOrgs.length)} {tx(" รอตรวจ)")}
            </span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_events' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_events')}
          >
            <IconFlag size={16} />
            <span>
              {tx("อนุมัติ & กำกับงานวิ่ง (")}{tx(inReviewEvents.length)} {tx(" รออนุมัติ)")}
            </span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_form_builder' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_form_builder')}
          >
            <IconCheckCircle size={16} />
            <span>
              Registration Form Builder (
              {tx(fieldRequests.filter((r) => r.status === 'pending').length)}{' '}
              {tx("คำขอฟิลด์)")}
            </span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_merch_rfq' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_merch_rfq')}
          >
            <IconShirt size={16} />
            <span>{tx("ใบเสนอราคาผลิต & ร้านค้า (")}{tx(productionInquiries.length)})</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_finance' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_finance')}
          >
            <IconLedger size={16} />
            <span>{tx("รายได้ รอบโอน & ข้อพิพาทเงินคืน")}</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_users_audit' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_users_audit')}
          >
            <IconUsers size={16} />
            <span>{tx("ผู้ใช้งาน สิทธิ์ & Audit ทั้งระบบ")}</span>
          </button>
        </nav>
      </aside>

      {/* MAIN PLATFORM GOVERNANCE CANVAS */}
      <main className="dashboard-canvas">
        <header className="context-breadcrumb-bar">
          <div className="breadcrumb-trail">
            <span className="mono-code">PLT-HQ-01</span>
            <strong>
              {tx("ศูนย์ควบคุมแพลตฟอร์มกลาง RunEvent (ครอบคลุม ")} {tx(organizations.length)}{' '}
              {tx("องค์กรผู้จัด · ")} {tx(events.length)} {tx(" งานวิ่ง)")}
            </strong>
          </div>

          <div className="context-toolbar">
            <label htmlFor="plat-tw-sel" className="sr-only">
              {tx("ช่วงเวลาคำนวณยอดเงินทั้งแพลตฟอร์ม")}
            </label>
            <select
              id="plat-tw-sel"
              value={timeWindow}
              onChange={(e) =>
                setTimeWindow(e.target.value as TimeWindowFilter)
              }
            >
              <option value="all_time">{tx("ยอดเงิน: ตลอดอายุแพลตฟอร์ม")}</option>
              <option value="last_30d">{tx("ยอดเงิน: 30 วันล่าสุด")}</option>
              <option value="last_7d">{tx("ยอดเงิน: 7 วันล่าสุด")}</option>
            </select>
          </div>
        </header>

        {feedbackBanner && (
          <div className="success-callout" role="status">
            <IconCheckCircle size={17} />
            <div className="callout-flex">
              <span>{tx(feedbackBanner)}</span>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setFeedbackBanner(null)}
              >
                {tx("ปิดแจ้งเตือน")}
              </button>
            </div>
          </div>
        )}

        {/* ================= 1. PLATFORM OVERVIEW & APPROVAL QUEUE ================= */}
        {activeSection === 'plat_overview' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>{tx("ศูนย์ควบคุมและอนุมัติระดับแพลตฟอร์ม (Platform Owner Console)")}</h1>
              <p className="page-purpose-desc">
                {tx("หน้านี้ใช้ตรวจและอนุมัติองค์กรผู้จัดใหม่ อนุมัติเผยแพร่งานวิ่ง ควบคุมรอบโอนยอดนำส่ง ประสานใบเสนอราคาสั่งผลิตเสื้อ/เหรียญ และจัดการข้อยกเว้นข้ามทุกองค์กรในที่เดียว")}
              </p>
            </div>

            <section
              className="action-queue-panel"
              aria-label={tx("คิวรออนุมัติและข้อยกเว้นระดับแพลตฟอร์ม")}
            >
              <div className="section-title-bar">
                <div>
                  <h2>
                    {tx("คิวงานรออนุมัติและรายการต้องตรวจสอบของแพลตฟอร์ม (")}
                    <span className="mono-num">
                      {pendingOrgs.length +
                        inReviewEvents.length +
                        suspendedEvents.length +
                        pendingRefundRegs.length +
                        actionableRfqs.length}
                    </span>{' '}
                    {tx("รายการ)")}
                  </h2>
                  <span className="muted-inline">
                    {tx("เรียงลำดับตามผลกระทบต่อการเปิดรับสมัครและความถูกต้องทางการเงิน")}
                  </span>
                </div>
              </div>

              <div className="action-queue-rows">
                {pendingOrgs.map((org) => (
                  <div key={org.id} className="action-queue-item">
                    <div className="action-queue-text">
                      <IconBuilding size={17} />
                      <div>
                        <strong>
                          {tx("องค์กรผู้จัดรอตรวจอนุมัติ / บัญชีรับเงิน: ")} {tx(org.nameTh)} (
                          <span className="mono-code">{tx(org.code)}</span>)
                        </strong>
                        <p>
                          {tx("สถานะปัจจุบัน: ")} {tx(org.payoutBankSummary)} {tx(" — ต้องอนุมัติก่อนจึงจะเปิดขายงานวิ่งขององค์กรนี้ได้")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setOrgFilter('pending_review');
                        onSelectSection('plat_orgs');
                      }}
                    >
                      <span>{tx("ตรวจและอนุมัติองค์กร")}</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>
                ))}

                {inReviewEvents.map((ev) => (
                  <div key={ev.id} className="action-queue-item">
                    <div className="action-queue-text">
                      <IconFlag size={17} />
                      <div>
                        <strong>
                          {tx("งานวิ่งส่งตรวจขออนุมัติเผยแพร่: ")} {tx(ev.titleTh)} (
                          <span className="mono-code">{tx(ev.code)}</span>)
                        </strong>
                        <p>
                          {tx("วันจัดงาน ")} {tx(ev.eventDate)} {tx(" · จ.")}{tx(ev.province)} {tx(" · โควตา")}{' '}
                          {tx(ev.totalEventQuota)} {tx(" คน — รอ Platform Owner กดอนุมัติขึ้นหน้ารวมงานวิ่งสาธารณะ")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        setEventStatusFilter('in_review');
                        onSelectSection('plat_events');
                      }}
                    >
                      <span>{tx("ตรวจและอนุมัติงานนี้")}</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>
                ))}

                {suspendedEvents.map((ev) => (
                  <div key={ev.id} className="action-queue-item">
                    <div className="action-queue-text">
                      <IconAlert size={17} />
                      <div>
                        <strong>
                          {tx("งานวิ่งที่ถูกระงับชั่วคราว: ")} {tx(ev.titleTh)} (
                          <span className="mono-code">{tx(ev.code)}</span>)
                        </strong>
                        <p>{ev.statusNote ?? tx("รอตรวจเอกสารเพิ่มเติมก่อนปลดระงับ")}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEventStatusFilter('suspended');
                        onSelectSection('plat_events');
                      }}
                    >
                      <span>{tx("จัดการสถานะระงับ")}</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>
                ))}

                {pendingRefundRegs.length > 0 && (
                  <div className="action-queue-item">
                    <div className="action-queue-text">
                      <IconLedger size={17} />
                      <div>
                        <strong>
                          {tx("มีคำขอคืนเงินค้างพิจารณาในระบบ ")} {tx(pendingRefundRegs.length)}{' '}
                          {tx("รายการ")}
                        </strong>
                        <p>
                          {tx("ตรวจสอบเหตุผลและอนุมัติคืนเงินหรือปฏิเสธพร้อมบันทึกผู้ดำเนินการได้จากศูนย์การเงินกลาง")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setRefundFilter('requested');
                        onSelectSection('plat_finance');
                      }}
                    >
                      <span>{tx("ไปหน้าพิจารณาเงินคืน")}</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>
                )}

                {actionableRfqs.length > 0 && (
                  <div className="action-queue-item">
                    <div className="action-queue-text">
                      <IconShirt size={17} />
                      <div>
                        <strong>
                          {tx("คำขอใบเสนอราคาผลิตเสื้อ/เหรียญรอดำเนินการ")}{' '}
                          {tx(actionableRfqs.length)} {tx(" รายการ")}
                        </strong>
                        <p>
                          {tx("ประเมินราคาต้นทุน ส่งใบเสนอราคาให้ผู้จัด/ชมรม และอัปเดตสถานะการผลิตของโรงงาน")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onSelectSection('plat_merch_rfq')}
                    >
                      <span>{tx("จัดการใบเสนอราคาผลิต")}</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>
                )}

                {fieldRequests.filter((r) => r.status === 'pending').length >
                  0 && (
                  <div className="action-queue-item">
                    <div className="action-queue-text">
                      <IconCheckCircle size={17} />
                      <div>
                        <strong>
                          {tx("มีคำขอเพิ่มฟิลด์คำถามในใบสมัครจากผู้จัดงานรออนุมัติ")}{' '}
                          {
                            tx(fieldRequests.filter((r) => r.status === 'pending')
                              .length)
                          }{' '}
                          {tx("รายการ")}
                        </strong>
                        <p>
                          {tx("ตรวจอนุมัติคำขอข้อมูลผู้สมัคร กำหนดสิทธิ์ (LOCKED / CONFIGURABLE / CUSTOMIZABLE) และจัดการ Step การสมัคร")}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onSelectSection('plat_form_builder')}
                    >
                      <span>{tx("เปิด Registration Form Builder")}</span>
                      <IconArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </section>

            <BibLedgerStrip
              scopeTitle="สมการโควตาและยอดเงินรวมทั้งแพลตฟอร์ม (ทุกองค์กรผู้จัด)"
              scopeCode="PLT-ALL"
              metrics={platformMetrics}
              timeWindow={timeWindow}
              canViewFinance
              onDrillDown={(target) => {
                if (target === 'merch') {
                  onSelectSection('plat_merch_rfq');
                } else if (
                  target === 'confirmed' ||
                  target === 'pending_payment'
                ) {
                  setEventStatusFilter('all');
                  onSelectSection('plat_events');
                } else {
                  onSelectSection('plat_finance');
                }
              }}
            />

            <div className="two-col-ops-grid">
              <section className="clean-panel">
                <h2>{tx("สรุปสุขภาพระบบและรายได้แพลตฟอร์ม")}</h2>
                <div className="ops-quick-stats">
                  <div>
                    <span className="muted-inline">
                      {tx("รายได้ค่าบริการแพลตฟอร์มสุทธิ (จากค่าสมัครวิ่ง)")}
                    </span>
                    <strong className="mono-num text-vermilion">
                      {formatThb(platformMetrics.platformRevenueSatang, true)}
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">
                      {tx("มูลค่าขายสินค้าร้านค้าเฉพาะงานรวม (แยกจากค่าสมัคร)")}
                    </span>
                    <strong className="mono-num">
                      {formatThb(platformMetrics.merchGrossSalesSatang, true)} (
                      {tx(platformMetrics.merchOrderCount)} {tx(" ออเดอร์)")}
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">
                      {tx("องค์กรผู้จัดที่พร้อมรับเงินแล้ว / ทั้งหมด")}
                    </span>
                    <strong className="mono-num text-forest">
                      {
                        tx(organizations.filter(
                          (o) =>
                            o.verificationStatus === 'verified' && o.payoutReady
                        ).length)
                      }{' '}
                      / {tx(organizations.length)} {tx(" องค์กร")}
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">
                      {tx("รอบโอนยอดนำส่งที่รอดำเนินการหรือพักยอดไว้")}
                    </span>
                    <strong className="mono-num text-amber">
                      {tx(actionablePayouts.length)} {tx(" รอบโอน")}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="clean-panel">
                <div className="section-title-bar">
                  <h2>{tx("ประวัติการดำเนินการล่าสุดทั้งแพลตฟอร์ม")}</h2>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => onSelectSection('plat_users_audit')}
                  >
                    {tx("ดูทั้งหมด")}
                  </button>
                </div>
                <div className="audit-list">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="audit-row">
                      <span className="mono-code">{tx(log.timestamp)}</span>
                      <strong>{tx(log.actorName)}</strong>
                      <span className="muted-inline">({tx(log.actorRole)})</span>
                      <span>{tx(log.actionSummary)}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================= 2. ORGANIZATIONS & PAYOUT KYC APPROVAL ================= */}
        {activeSection === 'plat_orgs' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>{tx("อนุมัติองค์กรผู้จัดงานและตรวจสอบบัญชีรับยอดนำส่ง")}</h1>
              <p className="page-purpose-desc">
                {tx("ตรวจสอบความน่าเชื่อถือของผู้จัดและผูกบัญชีธนาคารรับโอนก่อนอนุญาตให้เปิดขายงานวิ่ง รวมถึงระงับองค์กรที่มีข้อร้องเรียนโดยไม่ลบข้อมูลธุรกรรมย้อนหลัง")}
              </p>
            </div>

            <div className="pill-tabs-bar" role="tablist">
              {(
                [
                  ['all', `ทุกองค์กร (${organizations.length})`],
                  ['pending_review', `รอตรวจอนุมัติ (${pendingOrgs.length})`],
                  [
                    'verified',
                    `อนุมัติแล้ว (${
                      organizations.filter(
                        (o) => o.verificationStatus === 'verified'
                      ).length
                    })`,
                  ],
                  [
                    'suspended',
                    `ระงับชั่วคราว (${
                      organizations.filter(
                        (o) => o.verificationStatus === 'suspended'
                      ).length
                    })`,
                  ],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={orgFilter === key}
                  className={`pill-tab ${orgFilter === key ? 'active' : ''}`}
                  onClick={() => setOrgFilter(key)}
                >
                  {tx(label)}
                </button>
              ))}
            </div>

            <div className="checkin-mobile-list">
              {filteredOrgs.map((org) => {
                const orgEvCount = events.filter(
                  (e) => e.organizationId === org.id
                ).length;
                const bankVal =
                  bankDraftMap[org.id] ??
                  (org.payoutReady
                    ? org.payoutBankSummary
                    : 'ธ.กรุงไทย ••••-5520 (ตรวจสอบเอกสารนิติบุคคลแล้ว)');

                return (
                  <article key={org.id} className="clean-panel">
                    <div className="section-title-bar">
                      <div className="cta-inline-row">
                        <span className="mono-code">{tx(org.code)}</span>
                        <h2>{tx(org.nameTh)}</h2>
                        {org.verificationStatus === 'verified' &&
                        org.payoutReady ? (
                          <span className="status-pill badge-forest">
                            <IconCheckCircle size={13} />
                            <span>{tx("อนุมัติแล้ว · พร้อมรับยอดนำส่ง")}</span>
                          </span>
                        ) : org.verificationStatus === 'suspended' ? (
                          <span className="status-pill badge-danger">
                            <IconLock size={13} />
                            <span>{tx("ระงับองค์กรชั่วคราว")}</span>
                          </span>
                        ) : (
                          <span className="status-pill badge-amber">
                            <IconClock size={13} />
                            <span>{tx("รอตรวจอนุมัติผู้จัด / บัญชีธนาคาร")}</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() =>
                          onInspectOrganizerWorkspace(org.id, null)
                        }
                      >
                        {tx("เปิดดูหน้าผู้จัดขององค์กรนี้")}
                      </button>
                    </div>

                    <p className="muted-block">
                      {tx("รหัสอ้างอิง: ")} <span className="mono-code">{org.referenceNumber ?? org.code}</span> {tx(" · สถานะ Workflow:")}{' '}
                      <span className="mono-code">
                        {org.workflowStatus ??
                          (org.verificationStatus === 'verified'
                            ? 'APPROVED'
                            : org.verificationStatus === 'suspended'
                            ? 'SUSPENDED'
                            : 'SUBMITTED')}
                      </span>{' '}
                      {tx("· ประเภท: ")} <strong>{org.orgType ?? 'Private Company'}</strong> {tx(" · จังหวัด: ")} <strong>{tx(org.province)}</strong> {tx(" · อีเมลประสานงาน:")}{' '}
                      <code>{tx(org.contactEmail)}</code> {tx(" · งานวิ่งในสังกัด:")}{' '}
                      <strong className="mono-num">{tx(orgEvCount)}</strong> {tx(" งาน · บัญชีปัจจุบัน: ")} <strong>{tx(org.payoutBankSummary)}</strong>
                    </p>

                    {org.documents && org.documents.length > 0 && (
                      <div className="custom-fields-list" style={{ marginTop: '0.5rem' }}>
                        {org.documents.map((doc) => (
                          <div key={doc.id} className="custom-field-item">
                            <div className="custom-field-meta">
                              <IconLock size={13} />
                              <strong>{tx(doc.docTypeLabel)}</strong>
                              <span className="mono-code">{tx(doc.fileName)}</span>
                              <span className="muted-inline mono-num">
                                ({tx(doc.fileSizeKb)} KB · Private Storage: {tx(doc.privateStorageKey)})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
                      <div className="form-row">
                        <label htmlFor={`org-bank-${org.id}`}>
                          {tx("บันทึกข้อมูลบัญชีธนาคาร / หมายเหตุผู้ตรวจ (Reviewer Note)")}
                        </label>
                        <input
                          id={`org-bank-${org.id}`}
                          type="text"
                          value={bankVal}
                          onChange={(e) =>
                            setBankDraftMap((prev) => ({
                              ...prev,
                              [org.id]: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="cta-inline-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            onReviewOrganization(
                              org.id,
                              'approve_kyc_bank',
                              bankVal.trim()
                            );
                            notifyAction(
                              txf("อนุมัติองค์กร {0} (สถานะ APPROVED) และเปิดสถานะบัญชีรับเงินเรียบร้อยแล้ว", org.nameTh)
                            );
                          }}
                        >
                          <IconCheckCircle size={15} />
                          <span>Approve (APPROVED)</span>
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onReviewOrganization(
                              org.id,
                              'under_review',
                              bankVal.trim()
                            );
                            notifyAction(
                              txf("เปลี่ยนสถานะของ {0} เป็น UNDER_REVIEW (กำลังตรวจเอกสาร) แล้ว", org.nameTh)
                            );
                          }}
                        >
                          {tx("รับเรื่องตรวจ (UNDER_REVIEW)")}
                        </button>

                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onReviewOrganization(
                              org.id,
                              'request_more_info',
                              bankVal.trim()
                            );
                            notifyAction(
                              txf("ส่งแจ้งขอเอกสารเพิ่มเติม (MORE_INFORMATION_REQUIRED) ไปยัง {0} แล้ว", org.nameTh)
                            );
                          }}
                        >
                          {tx("ขอเอกสารเพิ่ม (MORE_INFO)")}
                        </button>

                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            onReviewOrganization(
                              org.id,
                              'reject_org',
                              bankVal.trim()
                            );
                            notifyAction(
                              txf("ปฏิเสธคำขอขึ้นทะเบียนของ {0} (สถานะ REJECTED) เรียบร้อยแล้ว", org.nameTh)
                            );
                          }}
                        >
                          {tx("Reject (ปฏิเสธ)")}
                        </button>

                        {org.payoutReady && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onReviewOrganization(org.id, 'hold_bank');
                              notifyAction(
                                txf("พักความพร้อมบัญชีรับเงินของ {0} ชั่วคราวแล้ว", org.nameTh)
                              );
                            }}
                          >
                            {tx("พักบัญชีรับเงิน")}
                          </button>
                        )}

                        {org.verificationStatus !== 'suspended' ? (
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => {
                              onReviewOrganization(org.id, 'suspend_org');
                              notifyAction(
                                txf("ระงับองค์กร {0} ชั่วคราวแล้ว (สถานะ SUSPENDED)", org.nameTh)
                              );
                            }}
                          >
                            {tx("ระงับองค์กร (SUSPENDED)")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onReviewOrganization(
                                org.id,
                                'reinstate_org',
                                bankVal.trim()
                              );
                              notifyAction(txf("ปลดระงับองค์กร {0} แล้ว", org.nameTh));
                            }}
                          >
                            {tx("ปลดระงับองค์กร")}
                          </button>
                        )}
                      </div>
                    </div>

                    {org.verificationHistory &&
                      org.verificationHistory.length > 0 && (
                        <div className="audit-list" style={{ marginTop: '0.65rem' }}>
                          {org.verificationHistory.map((vh) => (
                            <div key={vh.id} className="audit-row">
                              <span className="mono-code">{tx(vh.timestamp)}</span>
                              <span className="mono-code">[{tx(vh.status)}]</span>
                              <strong>{tx(vh.actorName)}</strong>
                              <span>{tx(vh.note)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 3. ALL EVENTS APPROVAL & LIFECYCLE GOVERNANCE ================= */}
        {activeSection === 'plat_events' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>{tx("อนุมัติเผยแพร่งานวิ่งและกำกับดูแลทุกอีเวนต์บนแพลตฟอร์ม")}</h1>
              <p className="page-purpose-desc">
                {tx("ตรวจสอบความพร้อมก่อนอนุมัติขึ้นหน้ารวมงานวิ่งสาธารณะ ตีกลับงานที่ข้อมูลไม่ครบ ระงับ/ปลดระงับงานชั่วคราว หรือปิดงานพร้อมประกาศลิงก์ผลการแข่งขันและอัลบั้มภาพหลังงาน")}
              </p>
            </div>

            <div className="filter-bar-panel">
              <div className="filter-field filter-search">
                <label htmlFor="plat-ev-q">
                  {tx("ค้นหาชื่องาน รหัสงาน จังหวัด หรือชื่อองค์กรผู้จัด")}
                </label>
                <div className="input-with-icon">
                  <IconSearch size={16} />
                  <input
                    id="plat-ev-q"
                    type="search"
                    value={eventQuery}
                    onChange={(e) => setEventQuery(e.target.value)}
                    placeholder={tx("เช่น ดอยสุเทพ, ภูเก็ต, EVT-PKT...")}
                  />
                </div>
              </div>

              <div className="filter-field">
                <label htmlFor="plat-ev-st">{tx("กรองตามสถานะงาน")}</label>
                <select
                  id="plat-ev-st"
                  value={eventStatusFilter}
                  onChange={(e) =>
                    setEventStatusFilter(e.target.value as 'all' | EventStatus)
                  }
                >
                  <option value="all">{tx("ทุกสถานะ (")}{tx(events.length)})</option>
                  <option value="in_review">
                    {tx("รอตรวจอนุมัติเผยแพร่ (")}{tx(inReviewEvents.length)})
                  </option>
                  <option value="published">{tx("เปิดรับสมัคร (Published)")}</option>
                  <option value="suspended">{tx("ระงับชั่วคราว (Suspended)")}</option>
                  <option value="draft">{tx("แบบร่าง (Draft)")}</option>
                  <option value="closed">{tx("ปิดรับสมัคร (Closed)")}</option>
                  <option value="completed">{tx("จบงานแล้ว (Completed)")}</option>
                  <option value="cancelled">{tx("ยกเลิกงาน (Cancelled)")}</option>
                </select>
              </div>
            </div>

            <div className="checkin-mobile-list">
              {filteredEvents.map((ev) => {
                const org = organizations.find(
                  (o) => o.id === ev.organizationId
                );
                const orgReadyForPublish = Boolean(
                  org &&
                    org.verificationStatus === 'verified' &&
                    org.payoutReady
                );
                const confirmedCount = registrations.filter(
                  (r) =>
                    r.eventId === ev.id && r.registrationStatus === 'confirmed'
                ).length;
                const noteVal =
                  eventAdminNoteMap[ev.id] ?? ev.statusNote ?? '';
                const resUrlVal =
                  resultsUrlMap[ev.id] ??
                  ev.officialResultsUrl ??
                  `#official-results-${ev.code.toLowerCase()}`;
                const albumTitleVal =
                  albumTitleMap[ev.id] ??
                  `อัลบั้มภาพทางการ ${ev.titleTh}`;

                return (
                  <article key={ev.id} className="clean-panel">
                    <div className="section-title-bar">
                      <div className="cta-inline-row">
                        <span className="mono-code">{tx(ev.code)}</span>
                        <h2>{tx(ev.titleTh)}</h2>
                        <EventStatusBadge status={ev.status} />
                      </div>

                      <div className="cta-inline-row">
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() =>
                            onInspectOrganizerWorkspace(
                              ev.organizationId,
                              ev.id
                            )
                          }
                        >
                          {tx("เข้าตั้งค่างานนี้ในมุมมองผู้จัด")}
                        </button>
                        {ev.status !== 'draft' &&
                          ev.status !== 'in_review' && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => onOpenPublicEvent(ev.id)}
                            >
                              {tx("ดูหน้าลูกค้าสาธารณะ")}
                            </button>
                          )}
                      </div>
                    </div>

                    <p className="muted-block">
                      {tx("องค์กรผู้จัด: ")} <strong>{org?.nameTh ?? ev.organizationId}</strong>{' '}
                      {tx("· วันแข่ง: ")} <span className="mono-num">{tx(ev.eventDate)}</span>{' '}
                      {tx("· จ.")}{tx(ev.province)} {tx(" · นโยบายค่าบริการ:")}{' '}
                      <strong>{feePolicyLabel(ev.feeBearerPolicy)}</strong> {tx(" · ผู้สมัครยืนยันแล้ว:")}{' '}
                      <strong className="mono-num">
                        {tx(confirmedCount)} / {tx(ev.totalEventQuota)}
                      </strong>{' '}
                      {tx("คน · คำถามเพิ่มเติม:")}{' '}
                      <strong className="mono-num">
                        {tx((ev.customFields ?? []).length)}
                      </strong>{' '}
                      {tx("ข้อ")}
                    </p>

                    {!orgReadyForPublish && (
                      <div className="error-callout" role="status">
                        <IconAlert size={16} />
                        <div className="callout-flex">
                          <span>
                            {tx("องค์กรผู้จัด (")}{tx(org?.nameTh)}{tx(") ยังไม่ผ่านการอนุมัติบัญชีรับเงินหรือถูกระงับอยู่ ต้องอนุมัติองค์กรก่อนเปิดรับสมัครจริง")}
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onSelectSection('plat_orgs')}
                          >
                            {tx("ไปหน้าอนุมัติองค์กร")}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="form-grid-3" style={{ marginTop: '0.7rem' }}>
                      <div className="form-row">
                        <label htmlFor={`ev-adm-note-${ev.id}`}>
                          {tx("หมายเหตุผู้ดูแลแพลตฟอร์ม (แสดงให้ผู้จัด/ลูกค้าทราบเมื่อตีกลับหรือระงับ)")}
                        </label>
                        <input
                          id={`ev-adm-note-${ev.id}`}
                          type="text"
                          value={noteVal}
                          onChange={(e) =>
                            setEventAdminNoteMap((prev) => ({
                              ...prev,
                              [ev.id]: e.target.value,
                            }))
                          }
                          placeholder={tx("ระบุผลการตรวจเอกสาร หรือเหตุผลการระงับ/ตีกลับ...")}
                        />
                      </div>

                      <div className="form-row">
                        <label htmlFor={`ev-res-url-${ev.id}`}>
                          {tx("ลิงก์ผลการแข่งขันทางการ (เมื่อปิดงาน Completed)")}
                        </label>
                        <input
                          id={`ev-res-url-${ev.id}`}
                          type="text"
                          value={resUrlVal}
                          onChange={(e) =>
                            setResultsUrlMap((prev) => ({
                              ...prev,
                              [ev.id]: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="form-row">
                        <label htmlFor={`ev-alb-title-${ev.id}`}>
                          {tx("ชื่ออัลบั้มภาพหลังงานที่ตรวจสอบแล้ว")}
                        </label>
                        <input
                          id={`ev-alb-title-${ev.id}`}
                          type="text"
                          value={albumTitleVal}
                          onChange={(e) =>
                            setAlbumTitleMap((prev) => ({
                              ...prev,
                              [ev.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="cta-inline-row" style={{ marginTop: '0.8rem' }}>
                      {ev.status !== 'published' && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!orgReadyForPublish}
                          onClick={() => {
                            onGovernEventStatus(
                              ev.id,
                              'published',
                              noteVal.trim() ||
                                'ผ่านการอนุมัติจากผู้ดูแลแพลตฟอร์มและเปิดรับสมัครแล้ว'
                            );
                            notifyAction(
                              txf("อนุมัติเผยแพร่งาน \"{0}\" ขึ้นหน้ารวมงานวิ่งสาธารณะเรียบร้อยแล้ว", ev.titleTh)
                            );
                          }}
                        >
                          <IconCheckCircle size={15} />
                          <span>
                            {ev.status === 'suspended'
                              ? tx("ปลดระงับ & เปิดรับสมัครต่อ")
                              : tx("อนุมัติเผยแพร่เปิดรับสมัคร")}
                          </span>
                        </button>
                      )}

                      {(ev.status === 'in_review' ||
                        ev.status === 'published') && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onGovernEventStatus(
                              ev.id,
                              'draft',
                              noteVal.trim() ||
                                'ผู้ดูแลแพลตฟอร์มส่งกลับให้ผู้จัดตรวจสอบรายละเอียดเพิ่มเติมก่อนเปิดขาย'
                            );
                            notifyAction(
                              txf("ตีกลับงาน \"{0}\" เป็นแบบร่างพร้อมแจ้งหมายเหตุให้ผู้จัดแล้ว", ev.titleTh)
                            );
                          }}
                        >
                          {tx("ตีกลับให้ผู้จัดแก้ไข (Draft)")}
                        </button>
                      )}

                      {ev.status !== 'suspended' &&
                        ev.status !== 'completed' &&
                        ev.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onGovernEventStatus(
                                ev.id,
                                'suspended',
                                noteVal.trim() ||
                                  'ระงับการรับสมัครชั่วคราวโดยผู้ดูแลแพลตฟอร์ม (ข้อมูลผู้สมัครและหลักฐานการชำระเงินเดิมยังอยู่ครบถ้วน)'
                              );
                              notifyAction(
                                txf("ระงับการรับสมัครงาน \"{0}\" ชั่วคราวแล้ว", ev.titleTh)
                              );
                            }}
                          >
                            <IconAlert size={14} />
                            <span>{tx("ระงับงานชั่วคราว")}</span>
                          </button>
                        )}

                      {ev.status === 'published' && (
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            onGovernEventStatus(
                              ev.id,
                              'closed',
                              noteVal.trim() || 'ปิดรับสมัครตามกำหนดเวลา'
                            );
                            notifyAction(txf("ปิดรับสมัครงาน \"{0}\" แล้ว", ev.titleTh));
                          }}
                        >
                          {tx("ปิดรับสมัคร (Closed)")}
                        </button>
                      )}

                      {ev.status !== 'completed' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onGovernEventStatus(ev.id, 'completed', noteVal.trim(), {
                              resultsUrl: resUrlVal.trim(),
                              albumTitle: albumTitleVal.trim(),
                              albumUrl: `#verified-album-${ev.code.toLowerCase()}`,
                            });
                            notifyAction(
                              txf("ปิดงาน \"{0}\" เป็นจบการแข่งขัน พร้อมเผยแพร่ลิงก์ผลแข่งและอัลบั้มภาพแล้ว", ev.titleTh)
                            );
                          }}
                        >
                          <IconCamera size={14} />
                          <span>{tx("จบงาน & ประกาศลิงก์ผล/อัลบั้มภาพ")}</span>
                        </button>
                      )}

                      {ev.status !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            onGovernEventStatus(
                              ev.id,
                              'cancelled',
                              noteVal.trim() ||
                                'ยกเลิกการจัดงานตามมติผู้ดูแลแพลตฟอร์มและเข้าสู่ขั้นตอนคืนเงินตามนโยบาย'
                            );
                            notifyAction(txf("เปลี่ยนสถานะงาน \"{0}\" เป็นยกเลิกงานแล้ว", ev.titleTh));
                          }}
                        >
                          {tx("ยกเลิกงาน (Cancelled)")}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 4. PRODUCTION RFQs & MERCHANDISE GOVERNANCE ================= */}
        {activeSection === 'plat_merch_rfq' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>{tx("บริหารคำขอใบเสนอราคาผลิตเสื้อ/เหรียญ และกำกับร้านค้าทั้งแพลตฟอร์ม")}</h1>
              <p className="page-purpose-desc">
                {tx("ทีมหลังบ้าน RunEvent ใช้ประเมินราคา ส่งใบเสนอราคาให้ผู้จัดงานหรือชมรมทั่วไป และอัปเดตสถานะการผลิตของโรงงานแยกจากสถานะใบเสนอราคาอย่างชัดเจน")}
              </p>
            </div>

            <section className="clean-panel">
              <h2>
                {tx("คำขอราคาและงานสั่งผลิตเสื้อ/เหรียญทั้งหมด (")}
                <span className="mono-num">{tx(productionInquiries.length)}</span>{' '}
                {tx("รายการ)")}
              </h2>

              <div className="checkin-mobile-list" style={{ marginTop: '0.75rem' }}>
                {productionInquiries.map((rfq) => {
                  const defaultThb = rfq.quotedTotalSatang
                    ? String(Math.round(rfq.quotedTotalSatang / 100))
                    : String(rfq.netQtyToProduce * 290);
                  const priceInput = rfqPriceThbMap[rfq.id] ?? defaultThb;
                  const noteInput =
                    rfqNoteMap[rfq.id] ??
                    rfq.adminNote ??
                    'รวมค่าบล็อกสกรีนและจัดส่งถึงจุดจัดงานแล้ว';

                  return (
                    <div key={rfq.id} className="custom-field-item">
                      <div style={{ width: '100%' }}>
                        <div className="section-title-bar">
                          <div className="cta-inline-row">
                            <span className="mono-code">{tx(rfq.inquiryCode)}</span>
                            <strong>{tx(rfq.itemType)}</strong>
                            <span className="status-pill badge-navy">
                              <IconClock size={13} />
                              <span>
                                {tx("ใบเสนอราคา:")}{' '}
                                {rfq.quoteStatus === 'accepted'
                                  ? tx("ลูกค้าอนุมัติราคาแล้ว")
                                  : rfq.quoteStatus === 'quoted_demo'
                                  ? tx("ส่งใบเสนอราคาแล้ว")
                                  : rfq.quoteStatus === 'submitted'
                                  ? tx("รอทีมแพลตฟอร์มเสนอราคา")
                                  : tx("ร่างคำขอ")}
                              </span>
                            </span>
                            <span className="status-pill badge-amber">
                              <IconShirt size={13} />
                              <span>
                                {tx("การผลิต:")}{' '}
                                {rfq.productionStatus === 'qc_passed'
                                  ? tx("ตรวจ QC ผ่านพร้อมส่ง")
                                  : rfq.productionStatus === 'in_production'
                                  ? tx("กำลังเดินสายการผลิต")
                                  : rfq.productionStatus === 'ready_to_produce'
                                  ? tx("ยืนยันแบบแล้ว · พร้อมผลิต")
                                  : tx("รออนุมัติแบบและเงื่อนไข")}
                              </span>
                            </span>
                          </div>
                          <span className="mono-num">
                            {tx("ยอดผลิตสุทธิ: ")} <strong>{tx(rfq.netQtyToProduce)}</strong>{' '}
                            {tx("ชิ้น · กำหนดส่ง ")} {tx(rfq.targetDeliveryDate)}
                          </span>
                        </div>

                        <p className="muted-inline" style={{ marginTop: '0.3rem' }}>
                          {tx("ผู้ขอราคา: ")} <strong>{tx(rfq.requesterName)}</strong> (
                          {rfq.contextType === 'event_organizer'
                            ? tx("ผู้จัดงานวิ่งบนแพลตฟอร์ม")
                            : tx("ชมรม / บริษัททั่วไปไม่มีอีเวนต์")}
                          {tx(") · ติดต่อ: ")} {tx(rfq.requesterContact)} {tx(" · แบบ:")}{' '}
                          {tx(rfq.artworkVersion)}
                          {rfq.quotedTotalSatang !== undefined && (
                            <>
                              {' '}
                              {tx("· ยอดเสนอราคาล่าสุด:")}{' '}
                              <strong className="mono-num text-vermilion">
                                {formatThb(rfq.quotedTotalSatang, true)}
                              </strong>
                            </>
                          )}
                        </p>

                        <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                          <div className="form-row">
                            <label htmlFor={`rfq-thb-${rfq.id}`}>
                              {tx("ยอดใบเสนอราคารวม (บาท THB)")}
                            </label>
                            <input
                              id={`rfq-thb-${rfq.id}`}
                              type="number"
                              className="mono-num"
                              value={priceInput}
                              onChange={(e) =>
                                setRfqPriceThbMap((prev) => ({
                                  ...prev,
                                  [rfq.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor={`rfq-note-${rfq.id}`}>
                              {tx("เงื่อนไขการผลิต / หมายเหตุใบเสนอราคา")}
                            </label>
                            <input
                              id={`rfq-note-${rfq.id}`}
                              type="text"
                              value={noteInput}
                              onChange={(e) =>
                                setRfqNoteMap((prev) => ({
                                  ...prev,
                                  [rfq.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="cta-inline-row" style={{ marginTop: '0.65rem' }}>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                              const satang =
                                Math.max(0, Number(priceInput) || 0) * 100;
                              onUpdateProductionInquiry(rfq.id, {
                                quoteStatus: 'quoted_demo',
                                quotedTotalSatang: satang,
                                adminNote: noteInput.trim(),
                              });
                              notifyAction(
                                txf("ส่งใบเสนอราคา {0} ยอด {1} เรียบร้อยแล้ว", rfq.inquiryCode, formatThb(
                                  satang,
                                  true
                                ))
                              );
                            }}
                          >
                            {tx("ส่ง/อัปเดตใบเสนอราคา")}
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              const satang =
                                Math.max(0, Number(priceInput) || 0) * 100;
                              onUpdateProductionInquiry(rfq.id, {
                                quoteStatus: 'accepted',
                                productionStatus: 'ready_to_produce',
                                quotedTotalSatang: satang,
                                adminNote: noteInput.trim(),
                              });
                              notifyAction(
                                txf("บันทึกการอนุมัติแบบและราคาของ {0} -> พร้อมเริ่มผลิต", rfq.inquiryCode)
                              );
                            }}
                          >
                            {tx("ยืนยันอนุมัติแบบ & พร้อมเริ่มผลิต")}
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onUpdateProductionInquiry(rfq.id, {
                                productionStatus: 'in_production',
                              });
                              notifyAction(
                                txf("อัปเดตสถานะ {0} เป็น \"กำลังเดินสายการผลิต\"", rfq.inquiryCode)
                              );
                            }}
                          >
                            {tx("เริ่มผลิตในโรงงาน")}
                          </button>

                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => {
                              onUpdateProductionInquiry(rfq.id, {
                                productionStatus: 'qc_passed',
                              });
                              notifyAction(
                                txf("อัปเดตสถานะ {0} เป็น \"ตรวจ QC ผ่านพร้อมส่งมอบ\"", rfq.inquiryCode)
                              );
                            }}
                          >
                            {tx("ตรวจ QC ผ่านพร้อมส่ง")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="clean-panel">
              <h2>
                {tx("รายการสินค้าในหน้าร้านเฉพาะงานทั้งแพลตฟอร์ม (")}
                <span className="mono-num">
                  {events.reduce((s, e) => s + e.products.length, 0)}
                </span>{' '}
                {tx("SKU · คำสั่งซื้อรวม")}{' '}
                <span className="mono-num">{tx(merchOrders.length)}</span> {tx(" รายการ)")}
              </h2>
              <div className="table-scroll">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{tx("SKU / สินค้า")}</th>
                      <th>{tx("งานวิ่ง")}</th>
                      <th>{tx("รูปแบบบริการ / ผู้ขาย")}</th>
                      <th className="num-col">{tx("ราคา")}</th>
                      <th className="num-col">{tx("ขายแล้ว / เพดาน")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.flatMap((ev) =>
                      ev.products.map((prd) => (
                        <tr key={prd.id}>
                          <td>
                            <span className="mono-code">{tx(prd.sku)}</span>{' '}
                            <strong>{tx(prd.nameTh)}</strong>
                          </td>
                          <td>{tx(ev.titleTh)}</td>
                          <td>{tx(prd.sellerLabel)}</td>
                          <td className="num-col mono-num">
                            {formatThb(prd.priceSatang, true)}
                          </td>
                          <td className="num-col mono-num">
                            <strong>{tx(prd.soldCount)}</strong> /{' '}
                            {tx(prd.stockOrCeiling)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ================= 5. PLATFORM FINANCE, PAYOUTS & REFUND DISPUTES ================= */}
        {activeSection === 'plat_finance' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>{tx("ควบคุมรอบโอนยอดนำส่งผู้จัด (Payouts) และพิจารณาข้อยกเว้นการคืนเงิน")}</h1>
              <p className="page-purpose-desc">
                {tx("อนุมัติโอนรายได้สุทธิให้ผู้จัด พักยอดกรณีงานมีข้อร้องเรียน และพิจารณาคำขอคืนเงินหรือสั่งคืนเงินกรณีพิเศษพร้อมบันทึกเหตุผลตรวจสอบย้อนหลัง")}
              </p>
            </div>

            <section className="clean-panel">
              <h2>
                {tx("ตารางรอบโอนยอดนำส่งให้ผู้จัดงาน (Payout Batches ·")}{' '}
                <span className="mono-num">{tx(payouts.length)}</span> {tx(" งวด)")}
              </h2>

              <div className="table-scroll" style={{ marginBottom: '1rem' }}>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{tx("รหัสรอบโอน")}</th>
                      <th>{tx("องค์กร / งวดงาน")}</th>
                      <th>{tx("กำหนดโอน")}</th>
                      <th className="num-col">{tx("ยอดนำส่งสุทธิ")}</th>
                      <th>{tx("สถานะปัจจุบัน")}</th>
                      <th>{tx("การจัดการโดย Platform Owner")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((po) => {
                      const org = organizations.find(
                        (o) => o.id === po.organizationId
                      );
                      return (
                        <tr key={po.id}>
                          <td className="mono-code">{tx(po.payoutCode)}</td>
                          <td>
                            <strong>{org?.nameTh ?? po.organizationId}</strong>
                            <div className="muted-inline">{tx(po.periodLabel)}</div>
                          </td>
                          <td className="mono-num">{tx(po.scheduledDate)}</td>
                          <td className="num-col mono-num">
                            <strong>
                              {formatThb(po.netPayoutSatang, true)}
                            </strong>
                          </td>
                          <td>
                            <PayoutStatusBadge status={po.status} />
                          </td>
                          <td>
                            <div className="cta-inline-row">
                              {po.status !== 'paid' && (
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={!org?.payoutReady}
                                  onClick={() => {
                                    onUpdatePayoutBatchStatus(po.id, 'paid');
                                    notifyAction(
                                      txf("ยืนยันการโอนเงินงวด {0} ให้ผู้จัดเรียบร้อยแล้ว", po.payoutCode)
                                    );
                                  }}
                                >
                                  {tx("ยืนยันโอนแล้ว (Paid)")}
                                </button>
                              )}
                              {po.status === 'scheduled' && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    onUpdatePayoutBatchStatus(
                                      po.id,
                                      'processing'
                                    );
                                    notifyAction(
                                      txf("เปลี่ยนสถานะงวด {0} เป็นกำลังโอน", po.payoutCode)
                                    );
                                  }}
                                >
                                  {tx("เริ่มโอน")}
                                </button>
                              )}
                              {po.status !== 'held' && po.status !== 'paid' && (
                                <button
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() => {
                                    onUpdatePayoutBatchStatus(po.id, 'held');
                                    notifyAction(
                                      txf("สั่งพักยอดโอน {0} เพื่อตรวจสอบแล้ว", po.payoutCode)
                                    );
                                  }}
                                >
                                  {tx("พักยอด (Hold)")}
                                </button>
                              )}
                              {po.status === 'held' && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    onUpdatePayoutBatchStatus(
                                      po.id,
                                      'scheduled'
                                    );
                                    notifyAction(
                                      txf("ปลดพักยอดโอน {0} กลับสู่คิวกำหนดโอนแล้ว", po.payoutCode)
                                    );
                                  }}
                                >
                                  {tx("ปลดพักยอด")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="custom-field-creator">
                <h3>{tx("สร้างรอบโอนยอดนำส่งใหม่ (Create Payout Batch)")}</h3>
                <div className="form-grid-3">
                  <div className="form-row">
                    <label htmlFor="po-org">{tx("เลือกองค์กรผู้จัด")}</label>
                    <select
                      id="po-org"
                      value={newPoOrgId}
                      onChange={(e) => {
                        const oid = e.target.value;
                        setNewPoOrgId(oid);
                        const firstEv = events.find(
                          (ev) => ev.organizationId === oid
                        );
                        if (firstEv) setNewPoEventId(firstEv.id);
                      }}
                    >
                      {organizations.map((o) => (
                        <option key={o.id} value={o.id}>
                          {tx(o.nameTh)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <label htmlFor="po-ev">{tx("เลือกงานวิ่งอ้างอิง")}</label>
                    <select
                      id="po-ev"
                      value={newPoEventId}
                      onChange={(e) => setNewPoEventId(e.target.value)}
                    >
                      {events
                        .filter((ev) => ev.organizationId === newPoOrgId)
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {tx(ev.titleTh)}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <label htmlFor="po-amt">{tx("ยอดโอนสุทธิ (บาท THB)")}</label>
                    <input
                      id="po-amt"
                      type="number"
                      className="mono-num"
                      value={newPoAmountThb}
                      onChange={(e) => setNewPoAmountThb(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                  <div className="form-row">
                    <label htmlFor="po-lbl">{tx("ชื่อรอบนำส่งเงิน")}</label>
                    <input
                      id="po-lbl"
                      type="text"
                      value={newPoLabel}
                      onChange={(e) => setNewPoLabel(e.target.value)}
                      placeholder={tx("เช่น งวดปิดยอดขายรอบพิเศษ #2")}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="po-dt">{tx("วันที่กำหนดโอน (YYYY-MM-DD)")}</label>
                    <input
                      id="po-dt"
                      type="text"
                      className="mono-num"
                      value={newPoDate}
                      onChange={(e) => setNewPoDate(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.7rem' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      const satang =
                        Math.max(100, Number(newPoAmountThb) || 0) * 100;
                      onCreatePayoutBatch({
                        organizationId: newPoOrgId,
                        eventId: newPoEventId,
                        periodLabel:
                          newPoLabel.trim() || 'งวดนำส่งเงินโดยผู้ดูแลแพลตฟอร์ม',
                        scheduledDate: newPoDate.trim() || '2026-12-05',
                        netPayoutSatang: satang,
                      });
                      setNewPoLabel('');
                      notifyAction(tx("เพิ่มรอบโอนยอดนำส่งใหม่เข้าตารางเรียบร้อยแล้ว"));
                    }}
                  >
                    <IconPlus size={15} />
                    <span>{tx("สร้างรอบโอนยอดนำส่ง")}</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="clean-panel">
              <div className="section-title-bar">
                <h2>{tx("พิจารณาคำขอคืนเงินและจัดการข้อร้องเรียนผู้สมัครข้ามทุกงาน")}</h2>
                <div className="pill-tabs-bar">
                  <button
                    type="button"
                    className={`pill-tab ${
                      refundFilter === 'requested' ? 'active' : ''
                    }`}
                    onClick={() => setRefundFilter('requested')}
                  >
                    {tx("คำขอคืนเงินรออนุมัติ (")}{tx(pendingRefundRegs.length)})
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${
                      refundFilter === 'paid_all' ? 'active' : ''
                    }`}
                    onClick={() => setRefundFilter('paid_all')}
                  >
                    {tx("รายการชำระสำเร็จทั้งหมด (สั่งคืนกรณีพิเศษได้)")}
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${
                      refundFilter === 'refunded' ? 'active' : ''
                    }`}
                    onClick={() => setRefundFilter('refunded')}
                  >
                    {tx("ประวัติคืนเงิน/ปฏิเสธแล้ว")}
                  </button>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '0.8rem' }}>
                <label htmlFor="adm-ref-reason">
                  {tx("บันทึกเหตุผลการอนุมัติ / ปฏิเสธ / คืนเงินกรณีข้อร้องเรียน (บันทึกลง Audit Log)")}
                </label>
                <input
                  id="adm-ref-reason"
                  type="text"
                  value={adminRefundNote}
                  onChange={(e) => setAdminRefundNote(e.target.value)}
                />
              </div>

              <div className="table-scroll">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{tx("ใบสมัคร / คำสั่งซื้อ")}</th>
                      <th>{tx("ผู้สมัคร / งานวิ่ง")}</th>
                      <th className="num-col">{tx("ค่าสมัครฐาน (คืนได้ไม่เกินนี้)")}</th>
                      <th>{tx("สถานะเงิน & คืนเงิน")}</th>
                      <th>{tx("การดำเนินการของ Platform Owner")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRefundRegs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted-inline">
                          {tx("ไม่มีรายการในตัวกรองนี้")}
                        </td>
                      </tr>
                    ) : (
                      filteredRefundRegs.map((reg) => {
                        const ev = events.find((e) => e.id === reg.eventId);
                        return (
                          <tr key={reg.id}>
                            <td>
                              <span className="mono-code">{tx(reg.regCode)}</span>
                              <div className="muted-inline">{tx(reg.orderCode)}</div>
                            </td>
                            <td>
                              <strong>{tx(reg.participantNameTh)}</strong>
                              <div className="muted-inline">{tx(ev?.titleTh)}</div>
                              {reg.refundReason && (
                                <div className="muted-inline">
                                  {tx("เหตุผล: ")} {tx(reg.refundReason)}
                                </div>
                              )}
                            </td>
                            <td className="num-col mono-num">
                              {formatThb(reg.snapshotBaseSatang, true)}
                            </td>
                            <td>
                              <RegStatusBadge status={reg.registrationStatus} />{' '}
                              <PaymentStatusBadge status={reg.paymentStatus} />{' '}
                              <RefundStatusBadge status={reg.refundStatus} />
                            </td>
                            <td>
                              {reg.refundStatus === 'requested' && (
                                <div className="cta-inline-row">
                                  <button
                                    type="button"
                                    className="btn-primary"
                                    onClick={() => {
                                      onAdminResolveOrForceRefund(
                                        reg.id,
                                        'approve_succeed',
                                        adminRefundNote.trim()
                                      );
                                      notifyAction(
                                        txf("อนุมัติคืนเงินใบสมัคร {0} เรียบร้อยแล้ว", reg.regCode)
                                      );
                                    }}
                                  >
                                    {tx("อนุมัติคืนเงิน")}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                      onAdminResolveOrForceRefund(
                                        reg.id,
                                        'reject',
                                        adminRefundNote.trim()
                                      );
                                      notifyAction(
                                        txf("ปฏิเสธคำขอคืนเงิน {0} แล้ว", reg.regCode)
                                      );
                                    }}
                                  >
                                    {tx("ปฏิเสธคำขอ")}
                                  </button>
                                </div>
                              )}
                              {reg.refundStatus === 'none' &&
                                reg.paymentStatus === 'succeeded' && (
                                  <button
                                    type="button"
                                    className="btn-ghost-sm"
                                    onClick={() => {
                                      onAdminResolveOrForceRefund(
                                        reg.id,
                                        'admin_force_refund',
                                        adminRefundNote.trim() ||
                                          'คืนเงินกรณีข้อยกเว้นโดยผู้ดูแลแพลตฟอร์ม'
                                      );
                                      notifyAction(
                                        txf("ดำเนินการคืนเงินกรณีข้อยกเว้นให้ {0} เรียบร้อยแล้ว", reg.regCode)
                                      );
                                    }}
                                  >
                                    {tx("สั่งคืนเงินกรณีพิเศษ (Dispute)")}
                                  </button>
                                )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ================= 6. USERS, ACCESS GOVERNANCE & GLOBAL AUDIT LOG ================= */}
        {activeSection === 'plat_users_audit' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>{tx("บริหารบัญชีผู้ใช้งาน สิทธิ์สมาชิกองค์กร และตรวจสอบ Audit Log ทั้งแพลตฟอร์ม")}</h1>
              <p className="page-purpose-desc">
                {tx("ตรวจสอบบัญชีผู้ใช้ทั้งหมด ช่วยยืนยันอีเมลกรณีติดปัญหา กำหนดหรือเพิกถอนสิทธิ์ในองค์กรผู้จัด และตรวจสอบประวัติการทำงานย้อนหลังของทุกบทบาท")}
              </p>
            </div>

            <section className="clean-panel">
              <div className="section-title-bar">
                <h2>{tx("บัญชีผู้ใช้งานทั้งหมดในระบบ (")}{tx(users.length)} {tx(" บัญชี)")}</h2>
                <div className="input-with-icon" style={{ minWidth: '260px' }}>
                  <IconSearch size={16} />
                  <input
                    type="search"
                    aria-label={tx("ค้นหาชื่อ รหัสผู้ใช้ หรืออีเมล")}
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder={tx("ค้นหาชื่อ รหัส หรืออีเมล...")}
                  />
                </div>
              </div>

              <div className="checkin-mobile-list" style={{ marginTop: '0.75rem' }}>
                {filteredUsers.map((u) => {
                  const selectedGrantOrg =
                    grantOrgMap[u.id] ?? organizations[0]?.id ?? '';
                  const selectedGrantRole = grantRoleMap[u.id] ?? 'event_manager';

                  return (
                    <div key={u.id} className="custom-field-item">
                      <div style={{ width: '100%' }}>
                        <div className="section-title-bar">
                          <div className="cta-inline-row">
                            <span className="mono-code">{tx(u.code)}</span>
                            <strong>{tx(u.fullNameTh)}</strong>
                            {u.isPlatformAdmin && (
                              <span className="status-pill badge-navy">
                                <IconShield size={13} />
                                <span>Platform Owner</span>
                              </span>
                            )}
                            {u.emailVerified ? (
                              <span className="status-pill badge-forest">
                                <IconCheckCircle size={13} />
                                <span>{tx("อีเมลยืนยันแล้ว")}</span>
                              </span>
                            ) : (
                              <span className="status-pill badge-amber">
                                <IconAlert size={13} />
                                <span>{tx("ยังไม่ยืนยันอีเมล")}</span>
                              </span>
                            )}
                          </div>

                          <div className="cta-inline-row">
                            {!u.emailVerified && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  onAdminUpdateUserAccess(u.id, {
                                    kind: 'verify_email',
                                  });
                                  notifyAction(
                                    txf("ยืนยันสถานะอีเมลให้บัญชี {0} แล้ว", u.fullNameTh)
                                  );
                                }}
                              >
                                {tx("ยืนยันอีเมลให้ผู้ใช้นี้")}
                              </button>
                            )}

                            {u.id !== currentUser.id && (
                              <button
                                type="button"
                                className="btn-ghost-sm"
                                onClick={() => {
                                  onAdminUpdateUserAccess(u.id, {
                                    kind: 'toggle_platform_admin',
                                  });
                                  notifyAction(
                                    txf("อัปเดตสิทธิ์ผู้ดูแลแพลตฟอร์มของ {0} แล้ว", u.fullNameTh)
                                  );
                                }}
                              >
                                {u.isPlatformAdmin
                                  ? tx("ถอนสิทธิ์ Platform Admin")
                                  : tx("แต่งตั้งเป็น Platform Admin")}
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="muted-inline" style={{ marginTop: '0.25rem' }}>
                          {tx("อีเมล: ")} {u.contactEmail ?? tx("ไม่มี (เข้าผ่าน LINE)")} {tx(" · วิธีเข้าสู่ระบบ:")}{' '}
                          {u.identities.map((i) => i.provider).join(', ')}
                        </p>

                        {u.memberships.length > 0 && (
                          <div className="cta-inline-row" style={{ marginTop: '0.45rem' }}>
                            {u.memberships.map((m) => {
                              const org = organizations.find(
                                (o) => o.id === m.organizationId
                              );
                              return (
                                <span
                                  key={m.organizationId}
                                  className="status-pill badge-neutral"
                                >
                                  <IconBuilding size={13} />
                                  <span>
                                    {org?.nameTh ?? m.organizationId}:{' '}
                                    {tx(orgRoleTh[m.role])}
                                  </span>
                                  <button
                                    type="button"
                                    className="footer-text-link"
                                    style={{ marginLeft: '0.35rem' }}
                                    onClick={() => {
                                      onAdminUpdateUserAccess(u.id, {
                                        kind: 'revoke_org_role',
                                        organizationId: m.organizationId,
                                      });
                                      notifyAction(
                                        txf("ถอนสิทธิ์องค์กรออกจาก {0} แล้ว", u.fullNameTh)
                                      );
                                    }}
                                  >
                                    {tx("ถอนสิทธิ์")}
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="cta-inline-row" style={{ marginTop: '0.6rem' }}>
                          <select
                            aria-label={txf("เลือกองค์กรให้ {0}", u.fullNameTh)}
                            value={selectedGrantOrg}
                            onChange={(e) =>
                              setGrantOrgMap((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                          >
                            {organizations.map((o) => (
                              <option key={o.id} value={o.id}>
                                {tx(o.nameTh)}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label={txf("เลือกบทบาทให้ {0}", u.fullNameTh)}
                            value={selectedGrantRole}
                            onChange={(e) =>
                              setGrantRoleMap((prev) => ({
                                ...prev,
                                [u.id]: e.target.value as OrgRole,
                              }))
                            }
                          >
                            <option value="owner">{tx("เจ้าขององค์กร")}</option>
                            <option value="event_manager">{tx("ผู้จัดการงานวิ่ง")}</option>
                            <option value="finance">{tx("ฝ่ายการเงิน")}</option>
                            <option value="staff">{tx("เจ้าหน้าที่หน้างาน")}</option>
                          </select>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onAdminUpdateUserAccess(u.id, {
                                kind: 'grant_org_role',
                                organizationId: selectedGrantOrg,
                                role: selectedGrantRole,
                              });
                              notifyAction(
                                txf("มอบหมายสิทธิ์ {0} ให้ {1} เรียบร้อยแล้ว", orgRoleTh[selectedGrantRole], u.fullNameTh)
                              );
                            }}
                          >
                            {tx("บันทึกสิทธิ์เข้าองค์กร")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="clean-panel">
              <div className="section-title-bar">
                <h2>Global Platform Audit Log ({tx(filteredAuditLogs.length)} {tx(" รายการ)")}</h2>
                <select
                  aria-label={tx("กรองประวัติตามองค์กร")}
                  value={auditOrgFilter}
                  onChange={(e) => setAuditOrgFilter(e.target.value)}
                >
                  <option value="all">{tx("ทุกองค์กรและส่วนกลางแพลตฟอร์ม")}</option>
                  <option value="PLATFORM-HQ">{tx("เฉพาะการกระทำของ Platform Owner")}</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {tx(o.nameTh)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="audit-list">
                {filteredAuditLogs.map((log) => (
                  <div key={log.id} className="audit-row">
                    <span className="mono-code">{tx(log.timestamp)}</span>
                    <strong>{tx(log.actorName)}</strong>
                    <span className="muted-inline">({tx(log.actorRole)})</span>
                    <span>{tx(log.actionSummary)}</span>
                    <code className="audit-diff">{tx(log.detailChange)}</code>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ================= 7. REGISTRATION FORM BUILDER ================= */}
        {activeSection === 'plat_form_builder' && (
          <RegistrationFormBuilderAdmin
            templates={formTemplates}
            steps={registrationSteps}
            globalFields={globalFields}
            conditionalRules={conditionalRules}
            fieldRequests={fieldRequests}
            events={events}
            organizations={organizations}
            registrations={registrations}
            platformProfileConfig={platformProfileConfig}
            onUpdatePlatformProfileConfig={onUpdatePlatformProfileConfig}
            onUpsertStep={onUpsertStep}
            onReorderStep={onReorderStep}
            onDeleteStep={onDeleteStep}
            onUpsertGlobalField={onUpsertGlobalField}
            onAddConditionalRule={onAddConditionalRule}
            onDeleteConditionalRule={onDeleteConditionalRule}
            onPublishTemplateVersion={onPublishTemplateVersion}
            onCreateTemplate={onCreateTemplate}
            onResolveFieldRequest={onResolveFieldRequest}
          />
        )}
      </main>
    </div>
  );
};
