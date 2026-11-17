import React, { useMemo, useState } from 'react';
import {
  AuditLogEntry,
  EventStatus,
  MerchOrderRecord,
  Organization,
  OrgRole,
  PayoutBatch,
  PayoutStatus,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  TimeWindowFilter,
  UserAccount,
} from '../types';
import { computeMetrics, feePolicyLabel, formatThb } from '../utils/pricing';
import { BibLedgerStrip } from './BibLedgerStrip';
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

export type PlatformSection =
  | 'plat_overview'
  | 'plat_orgs'
  | 'plat_events'
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
  onReviewOrganization: (
    orgId: string,
    action: 'approve_kyc_bank' | 'hold_bank' | 'suspend_org' | 'reinstate_org',
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
      <aside className="dashboard-rail" aria-label="เมนูผู้ดูแลแพลตฟอร์มส่วนกลาง">
        <div className="rail-org-switcher">
          <div className="rail-field-label">โหมดการกำกับดูแลสูงสุด</div>
          <div className="rail-role-badge">
            <IconShield size={14} />
            <span>Platform Owner · {currentUser.fullNameTh}</span>
          </div>
        </div>

        <nav className="rail-nav-group" aria-label="เมนูบริหารแพลตฟอร์ม RunEvent">
          <div className="rail-group-heading">ระบบส่วนกลาง (Platform HQ)</div>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_overview' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_overview')}
          >
            <IconShield size={16} />
            <span>ภาพรวม & คิวรออนุมัติ</span>
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
              องค์กรผู้จัด & บัญชีรับเงิน ({pendingOrgs.length} รอตรวจ)
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
              อนุมัติ & กำกับงานวิ่ง ({inReviewEvents.length} รออนุมัติ)
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
            <span>ใบเสนอราคาผลิต & ร้านค้า ({productionInquiries.length})</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_finance' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_finance')}
          >
            <IconLedger size={16} />
            <span>รายได้ รอบโอน & ข้อพิพาทเงินคืน</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${
              activeSection === 'plat_users_audit' ? 'active' : ''
            }`}
            onClick={() => onSelectSection('plat_users_audit')}
          >
            <IconUsers size={16} />
            <span>ผู้ใช้งาน สิทธิ์ & Audit ทั้งระบบ</span>
          </button>
        </nav>
      </aside>

      {/* MAIN PLATFORM GOVERNANCE CANVAS */}
      <main className="dashboard-canvas">
        <header className="context-breadcrumb-bar">
          <div className="breadcrumb-trail">
            <span className="mono-code">PLT-HQ-01</span>
            <strong>
              ศูนย์ควบคุมแพลตฟอร์มกลาง RunEvent (ครอบคลุม {organizations.length}{' '}
              องค์กรผู้จัด · {events.length} งานวิ่ง)
            </strong>
          </div>

          <div className="context-toolbar">
            <label htmlFor="plat-tw-sel" className="sr-only">
              ช่วงเวลาคำนวณยอดเงินทั้งแพลตฟอร์ม
            </label>
            <select
              id="plat-tw-sel"
              value={timeWindow}
              onChange={(e) =>
                setTimeWindow(e.target.value as TimeWindowFilter)
              }
            >
              <option value="all_time">ยอดเงิน: ตลอดอายุแพลตฟอร์ม</option>
              <option value="last_30d">ยอดเงิน: 30 วันล่าสุด</option>
              <option value="last_7d">ยอดเงิน: 7 วันล่าสุด</option>
            </select>
          </div>
        </header>

        {feedbackBanner && (
          <div className="success-callout" role="status">
            <IconCheckCircle size={17} />
            <div className="callout-flex">
              <span>{feedbackBanner}</span>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setFeedbackBanner(null)}
              >
                ปิดแจ้งเตือน
              </button>
            </div>
          </div>
        )}

        {/* ================= 1. PLATFORM OVERVIEW & APPROVAL QUEUE ================= */}
        {activeSection === 'plat_overview' && (
          <div className="canvas-stack">
            <div className="page-guide-header">
              <h1>ศูนย์ควบคุมและอนุมัติระดับแพลตฟอร์ม (Platform Owner Console)</h1>
              <p className="page-purpose-desc">
                หน้านี้ใช้ตรวจและอนุมัติองค์กรผู้จัดใหม่ อนุมัติเผยแพร่งานวิ่ง ควบคุมรอบโอนยอดนำส่ง
                ประสานใบเสนอราคาสั่งผลิตเสื้อ/เหรียญ และจัดการข้อยกเว้นข้ามทุกองค์กรในที่เดียว
              </p>
            </div>

            <section
              className="action-queue-panel"
              aria-label="คิวรออนุมัติและข้อยกเว้นระดับแพลตฟอร์ม"
            >
              <div className="section-title-bar">
                <div>
                  <h2>
                    คิวงานรออนุมัติและรายการต้องตรวจสอบของแพลตฟอร์ม (
                    <span className="mono-num">
                      {pendingOrgs.length +
                        inReviewEvents.length +
                        suspendedEvents.length +
                        pendingRefundRegs.length +
                        actionableRfqs.length}
                    </span>{' '}
                    รายการ)
                  </h2>
                  <span className="muted-inline">
                    เรียงลำดับตามผลกระทบต่อการเปิดรับสมัครและความถูกต้องทางการเงิน
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
                          องค์กรผู้จัดรอตรวจอนุมัติ / บัญชีรับเงิน: {org.nameTh} (
                          <span className="mono-code">{org.code}</span>)
                        </strong>
                        <p>
                          สถานะปัจจุบัน: {org.payoutBankSummary} — ต้องอนุมัติก่อนจึงจะเปิดขายงานวิ่งขององค์กรนี้ได้
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
                      <span>ตรวจและอนุมัติองค์กร</span>
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
                          งานวิ่งส่งตรวจขออนุมัติเผยแพร่: {ev.titleTh} (
                          <span className="mono-code">{ev.code}</span>)
                        </strong>
                        <p>
                          วันจัดงาน {ev.eventDate} · จ.{ev.province} · โควตา{' '}
                          {ev.totalEventQuota} คน — รอ Platform Owner กดอนุมัติขึ้นหน้ารวมงานวิ่งสาธารณะ
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
                      <span>ตรวจและอนุมัติงานนี้</span>
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
                          งานวิ่งที่ถูกระงับชั่วคราว: {ev.titleTh} (
                          <span className="mono-code">{ev.code}</span>)
                        </strong>
                        <p>{ev.statusNote ?? 'รอตรวจเอกสารเพิ่มเติมก่อนปลดระงับ'}</p>
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
                      <span>จัดการสถานะระงับ</span>
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
                          มีคำขอคืนเงินค้างพิจารณาในระบบ {pendingRefundRegs.length}{' '}
                          รายการ
                        </strong>
                        <p>
                          ตรวจสอบเหตุผลและอนุมัติคืนเงินหรือปฏิเสธพร้อมบันทึกผู้ดำเนินการได้จากศูนย์การเงินกลาง
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
                      <span>ไปหน้าพิจารณาเงินคืน</span>
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
                          คำขอใบเสนอราคาผลิตเสื้อ/เหรียญรอดำเนินการ{' '}
                          {actionableRfqs.length} รายการ
                        </strong>
                        <p>
                          ประเมินราคาต้นทุน ส่งใบเสนอราคาให้ผู้จัด/ชมรม และอัปเดตสถานะการผลิตของโรงงาน
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => onSelectSection('plat_merch_rfq')}
                    >
                      <span>จัดการใบเสนอราคาผลิต</span>
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
                <h2>สรุปสุขภาพระบบและรายได้แพลตฟอร์ม</h2>
                <div className="ops-quick-stats">
                  <div>
                    <span className="muted-inline">
                      รายได้ค่าบริการแพลตฟอร์มสุทธิ (จากค่าสมัครวิ่ง)
                    </span>
                    <strong className="mono-num text-vermilion">
                      {formatThb(platformMetrics.platformRevenueSatang, true)}
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">
                      มูลค่าขายสินค้าร้านค้าเฉพาะงานรวม (แยกจากค่าสมัคร)
                    </span>
                    <strong className="mono-num">
                      {formatThb(platformMetrics.merchGrossSalesSatang, true)} (
                      {platformMetrics.merchOrderCount} ออเดอร์)
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">
                      องค์กรผู้จัดที่พร้อมรับเงินแล้ว / ทั้งหมด
                    </span>
                    <strong className="mono-num text-forest">
                      {
                        organizations.filter(
                          (o) =>
                            o.verificationStatus === 'verified' && o.payoutReady
                        ).length
                      }{' '}
                      / {organizations.length} องค์กร
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">
                      รอบโอนยอดนำส่งที่รอดำเนินการหรือพักยอดไว้
                    </span>
                    <strong className="mono-num text-amber">
                      {actionablePayouts.length} รอบโอน
                    </strong>
                  </div>
                </div>
              </section>

              <section className="clean-panel">
                <div className="section-title-bar">
                  <h2>ประวัติการดำเนินการล่าสุดทั้งแพลตฟอร์ม</h2>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => onSelectSection('plat_users_audit')}
                  >
                    ดูทั้งหมด
                  </button>
                </div>
                <div className="audit-list">
                  {auditLogs.slice(0, 5).map((log) => (
                    <div key={log.id} className="audit-row">
                      <span className="mono-code">{log.timestamp}</span>
                      <strong>{log.actorName}</strong>
                      <span className="muted-inline">({log.actorRole})</span>
                      <span>{log.actionSummary}</span>
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
              <h1>อนุมัติองค์กรผู้จัดงานและตรวจสอบบัญชีรับยอดนำส่ง</h1>
              <p className="page-purpose-desc">
                ตรวจสอบความน่าเชื่อถือของผู้จัดและผูกบัญชีธนาคารรับโอนก่อนอนุญาตให้เปิดขายงานวิ่ง
                รวมถึงระงับองค์กรที่มีข้อร้องเรียนโดยไม่ลบข้อมูลธุรกรรมย้อนหลัง
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
                  {label}
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
                        <span className="mono-code">{org.code}</span>
                        <h2>{org.nameTh}</h2>
                        {org.verificationStatus === 'verified' &&
                        org.payoutReady ? (
                          <span className="status-pill badge-forest">
                            <IconCheckCircle size={13} />
                            <span>อนุมัติแล้ว · พร้อมรับยอดนำส่ง</span>
                          </span>
                        ) : org.verificationStatus === 'suspended' ? (
                          <span className="status-pill badge-danger">
                            <IconLock size={13} />
                            <span>ระงับองค์กรชั่วคราว</span>
                          </span>
                        ) : (
                          <span className="status-pill badge-amber">
                            <IconClock size={13} />
                            <span>รอตรวจอนุมัติผู้จัด / บัญชีธนาคาร</span>
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
                        เปิดดูหน้าผู้จัดขององค์กรนี้
                      </button>
                    </div>

                    <p className="muted-block">
                      จังหวัด: <strong>{org.province}</strong> · อีเมลประสานงาน:{' '}
                      <code>{org.contactEmail}</code> · งานวิ่งในสังกัด:{' '}
                      <strong className="mono-num">{orgEvCount}</strong> งาน ·
                      บัญชีปัจจุบัน: <strong>{org.payoutBankSummary}</strong>
                    </p>

                    <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
                      <div className="form-row">
                        <label htmlFor={`org-bank-${org.id}`}>
                          บันทึกข้อมูลบัญชีธนาคารที่ตรวจสอบแล้วสำหรับโอนยอดนำส่ง
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

                      <div className="cta-inline-row" style={{ alignItems: 'flex-end' }}>
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
                              `อนุมัติองค์กร ${org.nameTh} และเปิดสถานะบัญชีรับเงินเรียบร้อยแล้ว`
                            );
                          }}
                        >
                          <IconCheckCircle size={15} />
                          <span>อนุมัติผู้จัด & ยืนยันบัญชีรับเงิน</span>
                        </button>

                        {org.payoutReady && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onReviewOrganization(org.id, 'hold_bank');
                              notifyAction(
                                `พักความพร้อมบัญชีรับเงินของ ${org.nameTh} ชั่วคราวแล้ว`
                              );
                            }}
                          >
                            พักบัญชีรับเงิน
                          </button>
                        )}

                        {org.verificationStatus !== 'suspended' ? (
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => {
                              onReviewOrganization(org.id, 'suspend_org');
                              notifyAction(
                                `ระงับองค์กร ${org.nameTh} ชั่วคราวแล้ว (คงประวัติธุรกรรมและใบสมัครเดิมครบถ้วน)`
                              );
                            }}
                          >
                            ระงับองค์กรชั่วคราว
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
                              notifyAction(`ปลดระงับองค์กร ${org.nameTh} แล้ว`);
                            }}
                          >
                            ปลดระงับองค์กร
                          </button>
                        )}
                      </div>
                    </div>
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
              <h1>อนุมัติเผยแพร่งานวิ่งและกำกับดูแลทุกอีเวนต์บนแพลตฟอร์ม</h1>
              <p className="page-purpose-desc">
                ตรวจสอบความพร้อมก่อนอนุมัติขึ้นหน้ารวมงานวิ่งสาธารณะ ตีกลับงานที่ข้อมูลไม่ครบ
                ระงับ/ปลดระงับงานชั่วคราว หรือปิดงานพร้อมประกาศลิงก์ผลการแข่งขันและอัลบั้มภาพหลังงาน
              </p>
            </div>

            <div className="filter-bar-panel">
              <div className="filter-field filter-search">
                <label htmlFor="plat-ev-q">
                  ค้นหาชื่องาน รหัสงาน จังหวัด หรือชื่อองค์กรผู้จัด
                </label>
                <div className="input-with-icon">
                  <IconSearch size={16} />
                  <input
                    id="plat-ev-q"
                    type="search"
                    value={eventQuery}
                    onChange={(e) => setEventQuery(e.target.value)}
                    placeholder="เช่น ดอยสุเทพ, ภูเก็ต, EVT-PKT..."
                  />
                </div>
              </div>

              <div className="filter-field">
                <label htmlFor="plat-ev-st">กรองตามสถานะงาน</label>
                <select
                  id="plat-ev-st"
                  value={eventStatusFilter}
                  onChange={(e) =>
                    setEventStatusFilter(e.target.value as 'all' | EventStatus)
                  }
                >
                  <option value="all">ทุกสถานะ ({events.length})</option>
                  <option value="in_review">
                    รอตรวจอนุมัติเผยแพร่ ({inReviewEvents.length})
                  </option>
                  <option value="published">เปิดรับสมัคร (Published)</option>
                  <option value="suspended">ระงับชั่วคราว (Suspended)</option>
                  <option value="draft">แบบร่าง (Draft)</option>
                  <option value="closed">ปิดรับสมัคร (Closed)</option>
                  <option value="completed">จบงานแล้ว (Completed)</option>
                  <option value="cancelled">ยกเลิกงาน (Cancelled)</option>
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
                        <span className="mono-code">{ev.code}</span>
                        <h2>{ev.titleTh}</h2>
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
                          เข้าตั้งค่างานนี้ในมุมมองผู้จัด
                        </button>
                        {ev.status !== 'draft' &&
                          ev.status !== 'in_review' && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => onOpenPublicEvent(ev.id)}
                            >
                              ดูหน้าลูกค้าสาธารณะ
                            </button>
                          )}
                      </div>
                    </div>

                    <p className="muted-block">
                      องค์กรผู้จัด: <strong>{org?.nameTh ?? ev.organizationId}</strong>{' '}
                      · วันแข่ง: <span className="mono-num">{ev.eventDate}</span>{' '}
                      · จ.{ev.province} · นโยบายค่าบริการ:{' '}
                      <strong>{feePolicyLabel(ev.feeBearerPolicy)}</strong> ·
                      ผู้สมัครยืนยันแล้ว:{' '}
                      <strong className="mono-num">
                        {confirmedCount} / {ev.totalEventQuota}
                      </strong>{' '}
                      คน · คำถามเพิ่มเติม:{' '}
                      <strong className="mono-num">
                        {(ev.customFields ?? []).length}
                      </strong>{' '}
                      ข้อ
                    </p>

                    {!orgReadyForPublish && (
                      <div className="error-callout" role="status">
                        <IconAlert size={16} />
                        <div className="callout-flex">
                          <span>
                            องค์กรผู้จัด ({org?.nameTh}) ยังไม่ผ่านการอนุมัติบัญชีรับเงินหรือถูกระงับอยู่
                            ต้องอนุมัติองค์กรก่อนเปิดรับสมัครจริง
                          </span>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onSelectSection('plat_orgs')}
                          >
                            ไปหน้าอนุมัติองค์กร
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="form-grid-3" style={{ marginTop: '0.7rem' }}>
                      <div className="form-row">
                        <label htmlFor={`ev-adm-note-${ev.id}`}>
                          หมายเหตุผู้ดูแลแพลตฟอร์ม (แสดงให้ผู้จัด/ลูกค้าทราบเมื่อตีกลับหรือระงับ)
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
                          placeholder="ระบุผลการตรวจเอกสาร หรือเหตุผลการระงับ/ตีกลับ..."
                        />
                      </div>

                      <div className="form-row">
                        <label htmlFor={`ev-res-url-${ev.id}`}>
                          ลิงก์ผลการแข่งขันทางการ (เมื่อปิดงาน Completed)
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
                          ชื่ออัลบั้มภาพหลังงานที่ตรวจสอบแล้ว
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
                              `อนุมัติเผยแพร่งาน "${ev.titleTh}" ขึ้นหน้ารวมงานวิ่งสาธารณะเรียบร้อยแล้ว`
                            );
                          }}
                        >
                          <IconCheckCircle size={15} />
                          <span>
                            {ev.status === 'suspended'
                              ? 'ปลดระงับ & เปิดรับสมัครต่อ'
                              : 'อนุมัติเผยแพร่เปิดรับสมัคร'}
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
                              `ตีกลับงาน "${ev.titleTh}" เป็นแบบร่างพร้อมแจ้งหมายเหตุให้ผู้จัดแล้ว`
                            );
                          }}
                        >
                          ตีกลับให้ผู้จัดแก้ไข (Draft)
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
                                `ระงับการรับสมัครงาน "${ev.titleTh}" ชั่วคราวแล้ว`
                              );
                            }}
                          >
                            <IconAlert size={14} />
                            <span>ระงับงานชั่วคราว</span>
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
                            notifyAction(`ปิดรับสมัครงาน "${ev.titleTh}" แล้ว`);
                          }}
                        >
                          ปิดรับสมัคร (Closed)
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
                              `ปิดงาน "${ev.titleTh}" เป็นจบการแข่งขัน พร้อมเผยแพร่ลิงก์ผลแข่งและอัลบั้มภาพแล้ว`
                            );
                          }}
                        >
                          <IconCamera size={14} />
                          <span>จบงาน & ประกาศลิงก์ผล/อัลบั้มภาพ</span>
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
                            notifyAction(`เปลี่ยนสถานะงาน "${ev.titleTh}" เป็นยกเลิกงานแล้ว`);
                          }}
                        >
                          ยกเลิกงาน (Cancelled)
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
              <h1>บริหารคำขอใบเสนอราคาผลิตเสื้อ/เหรียญ และกำกับร้านค้าทั้งแพลตฟอร์ม</h1>
              <p className="page-purpose-desc">
                ทีมหลังบ้าน RunEvent ใช้ประเมินราคา ส่งใบเสนอราคาให้ผู้จัดงานหรือชมรมทั่วไป
                และอัปเดตสถานะการผลิตของโรงงานแยกจากสถานะใบเสนอราคาอย่างชัดเจน
              </p>
            </div>

            <section className="clean-panel">
              <h2>
                คำขอราคาและงานสั่งผลิตเสื้อ/เหรียญทั้งหมด (
                <span className="mono-num">{productionInquiries.length}</span>{' '}
                รายการ)
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
                            <span className="mono-code">{rfq.inquiryCode}</span>
                            <strong>{rfq.itemType}</strong>
                            <span className="status-pill badge-navy">
                              <IconClock size={13} />
                              <span>
                                ใบเสนอราคา:{' '}
                                {rfq.quoteStatus === 'accepted'
                                  ? 'ลูกค้าอนุมัติราคาแล้ว'
                                  : rfq.quoteStatus === 'quoted_demo'
                                  ? 'ส่งใบเสนอราคาแล้ว'
                                  : rfq.quoteStatus === 'submitted'
                                  ? 'รอทีมแพลตฟอร์มเสนอราคา'
                                  : 'ร่างคำขอ'}
                              </span>
                            </span>
                            <span className="status-pill badge-amber">
                              <IconShirt size={13} />
                              <span>
                                การผลิต:{' '}
                                {rfq.productionStatus === 'qc_passed'
                                  ? 'ตรวจ QC ผ่านพร้อมส่ง'
                                  : rfq.productionStatus === 'in_production'
                                  ? 'กำลังเดินสายการผลิต'
                                  : rfq.productionStatus === 'ready_to_produce'
                                  ? 'ยืนยันแบบแล้ว · พร้อมผลิต'
                                  : 'รออนุมัติแบบและเงื่อนไข'}
                              </span>
                            </span>
                          </div>
                          <span className="mono-num">
                            ยอดผลิตสุทธิ: <strong>{rfq.netQtyToProduce}</strong>{' '}
                            ชิ้น · กำหนดส่ง {rfq.targetDeliveryDate}
                          </span>
                        </div>

                        <p className="muted-inline" style={{ marginTop: '0.3rem' }}>
                          ผู้ขอราคา: <strong>{rfq.requesterName}</strong> (
                          {rfq.contextType === 'event_organizer'
                            ? 'ผู้จัดงานวิ่งบนแพลตฟอร์ม'
                            : 'ชมรม / บริษัททั่วไปไม่มีอีเวนต์'}
                          ) · ติดต่อ: {rfq.requesterContact} · แบบ:{' '}
                          {rfq.artworkVersion}
                          {rfq.quotedTotalSatang !== undefined && (
                            <>
                              {' '}
                              · ยอดเสนอราคาล่าสุด:{' '}
                              <strong className="mono-num text-vermilion">
                                {formatThb(rfq.quotedTotalSatang, true)}
                              </strong>
                            </>
                          )}
                        </p>

                        <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                          <div className="form-row">
                            <label htmlFor={`rfq-thb-${rfq.id}`}>
                              ยอดใบเสนอราคารวม (บาท THB)
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
                              เงื่อนไขการผลิต / หมายเหตุใบเสนอราคา
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
                                `ส่งใบเสนอราคา ${rfq.inquiryCode} ยอด ${formatThb(
                                  satang,
                                  true
                                )} เรียบร้อยแล้ว`
                              );
                            }}
                          >
                            ส่ง/อัปเดตใบเสนอราคา
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
                                `บันทึกการอนุมัติแบบและราคาของ ${rfq.inquiryCode} -> พร้อมเริ่มผลิต`
                              );
                            }}
                          >
                            ยืนยันอนุมัติแบบ & พร้อมเริ่มผลิต
                          </button>

                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              onUpdateProductionInquiry(rfq.id, {
                                productionStatus: 'in_production',
                              });
                              notifyAction(
                                `อัปเดตสถานะ ${rfq.inquiryCode} เป็น "กำลังเดินสายการผลิต"`
                              );
                            }}
                          >
                            เริ่มผลิตในโรงงาน
                          </button>

                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => {
                              onUpdateProductionInquiry(rfq.id, {
                                productionStatus: 'qc_passed',
                              });
                              notifyAction(
                                `อัปเดตสถานะ ${rfq.inquiryCode} เป็น "ตรวจ QC ผ่านพร้อมส่งมอบ"`
                              );
                            }}
                          >
                            ตรวจ QC ผ่านพร้อมส่ง
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
                รายการสินค้าในหน้าร้านเฉพาะงานทั้งแพลตฟอร์ม (
                <span className="mono-num">
                  {events.reduce((s, e) => s + e.products.length, 0)}
                </span>{' '}
                SKU · คำสั่งซื้อรวม{' '}
                <span className="mono-num">{merchOrders.length}</span> รายการ)
              </h2>
              <div className="table-scroll">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>SKU / สินค้า</th>
                      <th>งานวิ่ง</th>
                      <th>รูปแบบบริการ / ผู้ขาย</th>
                      <th className="num-col">ราคา</th>
                      <th className="num-col">ขายแล้ว / เพดาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.flatMap((ev) =>
                      ev.products.map((prd) => (
                        <tr key={prd.id}>
                          <td>
                            <span className="mono-code">{prd.sku}</span>{' '}
                            <strong>{prd.nameTh}</strong>
                          </td>
                          <td>{ev.titleTh}</td>
                          <td>{prd.sellerLabel}</td>
                          <td className="num-col mono-num">
                            {formatThb(prd.priceSatang, true)}
                          </td>
                          <td className="num-col mono-num">
                            <strong>{prd.soldCount}</strong> /{' '}
                            {prd.stockOrCeiling}
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
              <h1>ควบคุมรอบโอนยอดนำส่งผู้จัด (Payouts) และพิจารณาข้อยกเว้นการคืนเงิน</h1>
              <p className="page-purpose-desc">
                อนุมัติโอนรายได้สุทธิให้ผู้จัด พักยอดกรณีงานมีข้อร้องเรียน
                และพิจารณาคำขอคืนเงินหรือสั่งคืนเงินกรณีพิเศษพร้อมบันทึกเหตุผลตรวจสอบย้อนหลัง
              </p>
            </div>

            <section className="clean-panel">
              <h2>
                ตารางรอบโอนยอดนำส่งให้ผู้จัดงาน (Payout Batches ·{' '}
                <span className="mono-num">{payouts.length}</span> งวด)
              </h2>

              <div className="table-scroll" style={{ marginBottom: '1rem' }}>
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>รหัสรอบโอน</th>
                      <th>องค์กร / งวดงาน</th>
                      <th>กำหนดโอน</th>
                      <th className="num-col">ยอดนำส่งสุทธิ</th>
                      <th>สถานะปัจจุบัน</th>
                      <th>การจัดการโดย Platform Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payouts.map((po) => {
                      const org = organizations.find(
                        (o) => o.id === po.organizationId
                      );
                      return (
                        <tr key={po.id}>
                          <td className="mono-code">{po.payoutCode}</td>
                          <td>
                            <strong>{org?.nameTh ?? po.organizationId}</strong>
                            <div className="muted-inline">{po.periodLabel}</div>
                          </td>
                          <td className="mono-num">{po.scheduledDate}</td>
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
                                      `ยืนยันการโอนเงินงวด ${po.payoutCode} ให้ผู้จัดเรียบร้อยแล้ว`
                                    );
                                  }}
                                >
                                  ยืนยันโอนแล้ว (Paid)
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
                                      `เปลี่ยนสถานะงวด ${po.payoutCode} เป็นกำลังโอน`
                                    );
                                  }}
                                >
                                  เริ่มโอน
                                </button>
                              )}
                              {po.status !== 'held' && po.status !== 'paid' && (
                                <button
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() => {
                                    onUpdatePayoutBatchStatus(po.id, 'held');
                                    notifyAction(
                                      `สั่งพักยอดโอน ${po.payoutCode} เพื่อตรวจสอบแล้ว`
                                    );
                                  }}
                                >
                                  พักยอด (Hold)
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
                                      `ปลดพักยอดโอน ${po.payoutCode} กลับสู่คิวกำหนดโอนแล้ว`
                                    );
                                  }}
                                >
                                  ปลดพักยอด
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
                <h3>สร้างรอบโอนยอดนำส่งใหม่ (Create Payout Batch)</h3>
                <div className="form-grid-3">
                  <div className="form-row">
                    <label htmlFor="po-org">เลือกองค์กรผู้จัด</label>
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
                          {o.nameTh}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <label htmlFor="po-ev">เลือกงานวิ่งอ้างอิง</label>
                    <select
                      id="po-ev"
                      value={newPoEventId}
                      onChange={(e) => setNewPoEventId(e.target.value)}
                    >
                      {events
                        .filter((ev) => ev.organizationId === newPoOrgId)
                        .map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.titleTh}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <label htmlFor="po-amt">ยอดโอนสุทธิ (บาท THB)</label>
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
                    <label htmlFor="po-lbl">ชื่อรอบนำส่งเงิน</label>
                    <input
                      id="po-lbl"
                      type="text"
                      value={newPoLabel}
                      onChange={(e) => setNewPoLabel(e.target.value)}
                      placeholder="เช่น งวดปิดยอดขายรอบพิเศษ #2"
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="po-dt">วันที่กำหนดโอน (YYYY-MM-DD)</label>
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
                      notifyAction('เพิ่มรอบโอนยอดนำส่งใหม่เข้าตารางเรียบร้อยแล้ว');
                    }}
                  >
                    <IconPlus size={15} />
                    <span>สร้างรอบโอนยอดนำส่ง</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="clean-panel">
              <div className="section-title-bar">
                <h2>พิจารณาคำขอคืนเงินและจัดการข้อร้องเรียนผู้สมัครข้ามทุกงาน</h2>
                <div className="pill-tabs-bar">
                  <button
                    type="button"
                    className={`pill-tab ${
                      refundFilter === 'requested' ? 'active' : ''
                    }`}
                    onClick={() => setRefundFilter('requested')}
                  >
                    คำขอคืนเงินรออนุมัติ ({pendingRefundRegs.length})
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${
                      refundFilter === 'paid_all' ? 'active' : ''
                    }`}
                    onClick={() => setRefundFilter('paid_all')}
                  >
                    รายการชำระสำเร็จทั้งหมด (สั่งคืนกรณีพิเศษได้)
                  </button>
                  <button
                    type="button"
                    className={`pill-tab ${
                      refundFilter === 'refunded' ? 'active' : ''
                    }`}
                    onClick={() => setRefundFilter('refunded')}
                  >
                    ประวัติคืนเงิน/ปฏิเสธแล้ว
                  </button>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '0.8rem' }}>
                <label htmlFor="adm-ref-reason">
                  บันทึกเหตุผลการอนุมัติ / ปฏิเสธ / คืนเงินกรณีข้อร้องเรียน (บันทึกลง Audit Log)
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
                      <th>ใบสมัคร / คำสั่งซื้อ</th>
                      <th>ผู้สมัคร / งานวิ่ง</th>
                      <th className="num-col">ค่าสมัครฐาน (คืนได้ไม่เกินนี้)</th>
                      <th>สถานะเงิน & คืนเงิน</th>
                      <th>การดำเนินการของ Platform Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRefundRegs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted-inline">
                          ไม่มีรายการในตัวกรองนี้
                        </td>
                      </tr>
                    ) : (
                      filteredRefundRegs.map((reg) => {
                        const ev = events.find((e) => e.id === reg.eventId);
                        return (
                          <tr key={reg.id}>
                            <td>
                              <span className="mono-code">{reg.regCode}</span>
                              <div className="muted-inline">{reg.orderCode}</div>
                            </td>
                            <td>
                              <strong>{reg.participantNameTh}</strong>
                              <div className="muted-inline">{ev?.titleTh}</div>
                              {reg.refundReason && (
                                <div className="muted-inline">
                                  เหตุผล: {reg.refundReason}
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
                                        `อนุมัติคืนเงินใบสมัคร ${reg.regCode} เรียบร้อยแล้ว`
                                      );
                                    }}
                                  >
                                    อนุมัติคืนเงิน
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
                                        `ปฏิเสธคำขอคืนเงิน ${reg.regCode} แล้ว`
                                      );
                                    }}
                                  >
                                    ปฏิเสธคำขอ
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
                                        `ดำเนินการคืนเงินกรณีข้อยกเว้นให้ ${reg.regCode} เรียบร้อยแล้ว`
                                      );
                                    }}
                                  >
                                    สั่งคืนเงินกรณีพิเศษ (Dispute)
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
              <h1>บริหารบัญชีผู้ใช้งาน สิทธิ์สมาชิกองค์กร และตรวจสอบ Audit Log ทั้งแพลตฟอร์ม</h1>
              <p className="page-purpose-desc">
                ตรวจสอบบัญชีผู้ใช้ทั้งหมด ช่วยยืนยันอีเมลกรณีติดปัญหา กำหนดหรือเพิกถอนสิทธิ์ในองค์กรผู้จัด
                และตรวจสอบประวัติการทำงานย้อนหลังของทุกบทบาท
              </p>
            </div>

            <section className="clean-panel">
              <div className="section-title-bar">
                <h2>บัญชีผู้ใช้งานทั้งหมดในระบบ ({users.length} บัญชี)</h2>
                <div className="input-with-icon" style={{ minWidth: '260px' }}>
                  <IconSearch size={16} />
                  <input
                    type="search"
                    aria-label="ค้นหาชื่อ รหัสผู้ใช้ หรืออีเมล"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ รหัส หรืออีเมล..."
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
                            <span className="mono-code">{u.code}</span>
                            <strong>{u.fullNameTh}</strong>
                            {u.isPlatformAdmin && (
                              <span className="status-pill badge-navy">
                                <IconShield size={13} />
                                <span>Platform Owner</span>
                              </span>
                            )}
                            {u.emailVerified ? (
                              <span className="status-pill badge-forest">
                                <IconCheckCircle size={13} />
                                <span>อีเมลยืนยันแล้ว</span>
                              </span>
                            ) : (
                              <span className="status-pill badge-amber">
                                <IconAlert size={13} />
                                <span>ยังไม่ยืนยันอีเมล</span>
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
                                    `ยืนยันสถานะอีเมลให้บัญชี ${u.fullNameTh} แล้ว`
                                  );
                                }}
                              >
                                ยืนยันอีเมลให้ผู้ใช้นี้
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
                                    `อัปเดตสิทธิ์ผู้ดูแลแพลตฟอร์มของ ${u.fullNameTh} แล้ว`
                                  );
                                }}
                              >
                                {u.isPlatformAdmin
                                  ? 'ถอนสิทธิ์ Platform Admin'
                                  : 'แต่งตั้งเป็น Platform Admin'}
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="muted-inline" style={{ marginTop: '0.25rem' }}>
                          อีเมล: {u.contactEmail ?? 'ไม่มี (เข้าผ่าน LINE)'} · วิธีเข้าสู่ระบบ:{' '}
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
                                    {orgRoleTh[m.role]}
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
                                        `ถอนสิทธิ์องค์กรออกจาก ${u.fullNameTh} แล้ว`
                                      );
                                    }}
                                  >
                                    ถอนสิทธิ์
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="cta-inline-row" style={{ marginTop: '0.6rem' }}>
                          <select
                            aria-label={`เลือกองค์กรให้ ${u.fullNameTh}`}
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
                                {o.nameTh}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label={`เลือกบทบาทให้ ${u.fullNameTh}`}
                            value={selectedGrantRole}
                            onChange={(e) =>
                              setGrantRoleMap((prev) => ({
                                ...prev,
                                [u.id]: e.target.value as OrgRole,
                              }))
                            }
                          >
                            <option value="owner">เจ้าขององค์กร</option>
                            <option value="event_manager">ผู้จัดการงานวิ่ง</option>
                            <option value="finance">ฝ่ายการเงิน</option>
                            <option value="staff">เจ้าหน้าที่หน้างาน</option>
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
                                `มอบหมายสิทธิ์ ${orgRoleTh[selectedGrantRole]} ให้ ${u.fullNameTh} เรียบร้อยแล้ว`
                              );
                            }}
                          >
                            บันทึกสิทธิ์เข้าองค์กร
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
                <h2>Global Platform Audit Log ({filteredAuditLogs.length} รายการ)</h2>
                <select
                  aria-label="กรองประวัติตามองค์กร"
                  value={auditOrgFilter}
                  onChange={(e) => setAuditOrgFilter(e.target.value)}
                >
                  <option value="all">ทุกองค์กรและส่วนกลางแพลตฟอร์ม</option>
                  <option value="PLATFORM-HQ">เฉพาะการกระทำของ Platform Owner</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nameTh}
                    </option>
                  ))}
                </select>
              </div>

              <div className="audit-list">
                {filteredAuditLogs.map((log) => (
                  <div key={log.id} className="audit-row">
                    <span className="mono-code">{log.timestamp}</span>
                    <strong>{log.actorName}</strong>
                    <span className="muted-inline">({log.actorRole})</span>
                    <span>{log.actionSummary}</span>
                    <code className="audit-diff">{log.detailChange}</code>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
