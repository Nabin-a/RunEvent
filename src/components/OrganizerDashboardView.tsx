import { EventStudioCard, type PublishCall } from './EventStudio';
import React, { useMemo, useState } from 'react';
import {
  AuditLogEntry,
  FeeBearerPolicy,
  MerchOrderRecord,
  Organization,
  OrgRole,
  PayoutBatch,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStatus,
  SellerServiceModel,
  SimulatedUiState,
  TeamInvitation,
  TimeWindowFilter,
  UserAccount,
} from '../types';
import { DEFAULT_PLATFORM_PROFILE_CONFIG } from '../data/runnerProfileDefaults';
import { computeMetrics, formatThb } from '../utils/pricing';
import type { EventMediaPatch } from './EventMediaManager';
import { CategoryAgeRulesPanel } from './CategoryAgeRulesPanel';
import { type AgeConfigValid } from '../utils/age';
import {
  IconAlert,
  IconCheckCircle,
  IconClock,
  IconLock,
  IconPlus,
} from './Icons';
import { isTotalQuotaEnabled, validateQuotaUpdate } from '../utils/eventConfig';

import { tx, txf } from '../i18n';
import { SelectMenu } from './SelectMenu';
import { EventHomeView } from './EventHomeView';
import { EventCheckInView } from './EventCheckInView';
import { EventRegistrantsView } from './EventRegistrantsView';
import { EventShopView } from './EventShopView';
import { EventFinanceView } from './EventFinanceView';
import { OrgEventsView } from './OrgEventsView';
import { OrgFinanceView } from './OrgFinanceView';
import { OrgTeamView, type OrgTeamMember } from './OrgTeamView';
import { FeeBearerPicker } from './FeeBearerPicker';
import { EventPricingView } from './EventPricingView';
import { EventKitView } from './EventKitView';
import {
  OrganizerMobileContext,
  OrganizerMobileNav,
  OrganizerRail,
  OrganizerTopBar,
  OrgNavProps,
  ORG_SECTION_LABEL,
  isOrgSection,
} from './OrganizerNav';
export type OrgSection =
  | 'org_overview'
  | 'org_events'
  | 'org_merch_production'
  | 'org_finance'
  | 'org_team_settings'
  | 'evt_overview'
  | 'evt_pricing_quota'
  | 'evt_participants'
  | 'evt_storefront'
  | 'evt_finance'
  | 'evt_checkin_bib'
  | 'evt_page_editor'
  /** shirts, kit shipping fee and production quote (split from evt_pricing_quota, 24 Nov 2026) */
  | 'evt_kit'
  /** registration form editor (mounted by the form editor work, 24 Nov 2026) */
  | 'evt_form_editor'
  /** the event page and the registration form in one editor, with publishing states (27 Nov 2026) */
  | 'evt_studio';

interface OrganizerDashboardViewProps {
  currentUser: UserAccount;
  organizations: Organization[];
  invitations: TeamInvitation[];
  /** members of the active organization (team page, 24 Nov 2026) */
  teamMembers?: OrgTeamMember[];
  activeOrgId: string;
  activeEventId: string | null;
  activeSection: OrgSection;
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  productionInquiries: ProductionInquiry[];
  payouts: PayoutBatch[];
  auditLogs: AuditLogEntry[];
  simulatedState: SimulatedUiState;
  onClearSimulatedState: () => void;
  onSelectOrg: (orgId: string) => void;
  onSelectEvent: (eventId: string | null, targetSection?: OrgSection) => void;
  onSelectSection: (section: OrgSection) => void;
  onCreateDraftEvent: (payload: {
    orgId: string;
    titleTh: string;
    province: string;
    eventDate: string;
    requestProductionHelp: boolean;
  }) => void;
  onDuplicateEventWithoutPii: (eventId: string) => void;
  onCompleteDraftReadinessAndSubmit: (eventId: string) => void;
  onUpdateFeeBearerPolicy: (eventId: string, policy: FeeBearerPolicy) => void;
  onAddEventProduct: (payload: {
    eventId: string;
    nameTh: string;
    categoryLabel: 'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม';
    saleMode: 'ready_stock' | 'preorder';
    serviceModel: SellerServiceModel;
    priceBaht: number;
    stockOrCeiling: number;
  }) => void;
  onCreateEventProductionQuote: (payload: {
    orgId: string;
    eventId?: string;
    itemType: ProductionInquiry['itemType'];
    packageQty: number;
    addonQty: number;
    bufferQty: number;
    existingStockQty: number;
    targetDeliveryDate: string;
  }) => void;
  onAssignBibNumber: (
    regId: string,
    bibNumber: string
  ) => { ok: boolean; error?: string };
  onConfirmKitPickup: (regId: string) => { ok: boolean; error?: string };
  onConfirmMerchHandover: (
    merchOrderId: string,
    handoverMode: 'partial_one' | 'complete_all'
  ) => { ok: boolean; message: string };
  onResolveRefundRequest: (
    regId: string,
    decision: 'approve_succeed' | 'reject',
    note: string
  ) => void;
  onCreateSingleUseInvite: (orgId: string, role: OrgRole) => TeamInvitation;
  onOpenPublicPreview: (eventId?: string) => void;
  onUpdateEventTotalQuota: (eventId: string, newTotalQuota: number) => void;
  /** whole-event cap on/off; turning on may also set a new cap in the same request */
  onToggleEventTotalQuota: (
    eventId: string,
    enabled: boolean,
    newTotalQuota?: number
  ) => Promise<{ ok: boolean; error?: string }>;
  /** race kit postal fee in satang; applies to new registrations only */
  onUpdateEventKitShipping: (eventId: string, feeSatang: number) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCategoryQuota: (eventId: string, categoryId: string, newCategoryQuota: number) => void;
  onUpdateCategoryAgeRules: (
    eventId: string,
    categoryId: string,
    config: AgeConfigValid
  ) => Promise<{ ok: boolean; error?: string }>;
  /** the combined page and form editor's publishing actions (27 Nov 2026; it replaced the page
   *  content and form editor saves) */
  onStudioCall?: (eventId: string, ...args: Parameters<PublishCall>) => ReturnType<PublishCall>;
  /** opens the full-window editor page of the event page / registration form (27 Nov 2026) */
  onOpenEditor?: (eventId: string, part: 'page' | 'form') => void;
  onUpdateEventMedia?: (eventId: string, patch: EventMediaPatch) => void;
  platformProfileConfig?: PlatformProfileConfig;
  onUpdateEventShirtConfig?: (
    eventId: string,
    patch: {
      shirtStocks?: RaceEvent['shirtStocks'];
      customSizeChart?: RaceEvent['customSizeChart'];
    }
  ) => void;
}

const roleNameMap: Record<OrgRole, string> = {
  owner: 'เจ้าขององค์กร (ดูแลครบทุกส่วน)',
  event_manager: 'ผู้จัดการงาน (ดูแลเฉพาะงานที่มอบหมาย)',
  finance: 'ฝ่ายการเงิน (ตรวจยอดและอนุมัติคืนเงิน)',
  staff: 'เจ้าหน้าที่หน้างาน (เช็กอิน BIB และจ่ายสินค้า)',
};

export function QuotaEditorRow({
  categoryName,
  maxQuota,
  registeredCount,
  reservedCount,
  canEdit,
  compact = false,
  onSaveQuota,
}: {
  categoryName: string;
  maxQuota: number;
  registeredCount: number;
  reservedCount: number;
  canEdit: boolean;
  compact?: boolean;
  onSaveQuota: (nextQuota: number) => void;
}) {
  const [draftQuota, setDraftQuota] = useState<number>(maxQuota);
  const [savedNotice, setSavedNotice] = useState(false);

  React.useEffect(() => {
    setDraftQuota(maxQuota);
    setSavedNotice(false);
  }, [maxQuota]);

  const check = validateQuotaUpdate(draftQuota, registeredCount, reservedCount);

  return (
    <div className={`quota-editor-row ${compact ? 'quota-editor-compact' : ''}`}>
      {!compact && (
        <div>
          <strong>{tx(categoryName)}</strong>{' '}
          <span className="muted-inline mono-num">
            {tx("(ใช้โควตาแล้ว ")} {registeredCount + reservedCount} / {tx(maxQuota)} {tx(" คน)")}
          </span>
        </div>
      )}
      {canEdit ? (
        <div className="quota-editor-controls">
          <div className="cta-inline-row">
            <input
              type="number"
              className="mono-num quota-number-input"
              aria-label={txf("จำนวนรับสมัครของ {0}", categoryName)}
              min={check.minAllowed}
              value={draftQuota}
              onChange={(e) => {
                setSavedNotice(false);
                setDraftQuota(Number(e.target.value));
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!check.valid || draftQuota === maxQuota}
              onClick={() => {
                onSaveQuota(draftQuota);
                setSavedNotice(true);
              }}
            >
              {tx("บันทึกโควตา")}
            </button>
          </div>
          <div className="muted-inline mono-num">
            {tx("ใช้แล้ว ")} {registeredCount + reservedCount} / {tx(maxQuota)} {tx(" คน")}
            {savedNotice && (
              <span className="text-forest"> {tx(" · บันทึกแล้ว")}</span>
            )}
          </div>
          {!check.valid && <p className="field-error">{tx(check.message)}</p>}
        </div>
      ) : (
        <span className="mono-num">
          {registeredCount + reservedCount} / <strong>{tx(maxQuota)}</strong> {tx(" คน")}
        </span>
      )}
    </div>
  );
}

// สวิตช์เปิด/ปิดโควตารวมทั้งงาน: ปิด = ไม่จำกัดยอดรวม ใช้เฉพาะโควตารายระยะ และไม่แสดงยอดรวมบนหน้าสาธารณะ
// เปิดกลับ = ใช้เพดานเดิม ถ้าเพดานเดิมต่ำกว่ายอดที่ใช้ไปแล้ว ให้ตั้งเพดานใหม่ก่อนเปิด
export function TotalQuotaSwitch({
  enabled,
  currentCap,
  usedSeats,
  canEdit,
  onToggle,
}: {
  enabled: boolean;
  currentCap: number;
  usedSeats: number;
  canEdit: boolean;
  onToggle: (enabled: boolean, newCap?: number) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [needsCap, setNeedsCap] = useState(false);
  const [draftCap, setDraftCap] = useState<number>(Math.max(usedSeats, currentCap));
  const capCheck = validateQuotaUpdate(draftCap, usedSeats, 0);

  const submit = async (next: boolean, cap?: number) => {
    setBusy(true);
    setMessage(null);
    const r = await onToggle(next, cap);
    setBusy(false);
    if (r.ok) {
      setNeedsCap(false);
      setMessage({
        ok: true,
        text: next
          ? tx('เปิดโควตารวมแล้ว ระบบจำกัดยอดรวมตามเพดานด้านล่าง')
          : tx('ปิดโควตารวมแล้ว รับสมัครตามโควตารายระยะเท่านั้น'),
      });
    } else {
      setMessage({ ok: false, text: tx(r.error ?? 'บันทึกไม่สำเร็จ ลองอีกครั้ง') });
    }
  };

  return (
    <div className="total-quota-switch">
      <div className="total-quota-switch-row">
        <div className="total-quota-switch-text">
          <label htmlFor="total-quota-switch" className="total-quota-switch-label">
            {tx('ใช้โควตารวมทั้งงาน')}
          </label>
          <span id="total-quota-switch-desc" className="muted-inline">
            {enabled
              ? txf('เปิดอยู่ — รับผู้สมัครรวมไม่เกิน {0} คน ร่วมกับโควตารายระยะ', currentCap)
              : tx('ปิดอยู่ — ไม่จำกัดยอดรวม ใช้เฉพาะโควตารายระยะ และไม่แสดงยอดรวมบนหน้างานสาธารณะ')}
          </span>
        </div>
        <span className="total-quota-switch-state" aria-hidden="true">
          {enabled ? tx('เปิดใช้') : tx('ปิดใช้')}
        </span>
        <input
          id="total-quota-switch"
          type="checkbox"
          role="switch"
          className="acct-switch"
          aria-describedby="total-quota-switch-desc"
          checked={enabled}
          disabled={!canEdit || busy}
          onChange={(e) => {
            const next = e.target.checked;
            if (next && currentCap < usedSeats) {
              setDraftCap(usedSeats);
              setNeedsCap(true);
              setMessage(null);
              return;
            }
            void submit(next);
          }}
        />
      </div>

      {!canEdit && (
        <p className="muted-inline">
          {tx('เฉพาะเจ้าขององค์กรหรือผู้จัดการงานจึงเปิด/ปิดโควตารวมได้')}
        </p>
      )}

      {needsCap && !enabled && (
        <div className="total-quota-switch-cap" role="group" aria-labelledby="total-quota-cap-title">
          <p id="total-quota-cap-title">
            {txf(
              'เพดานเดิม {0} คน ต่ำกว่ายอดที่สมัครและกันที่ไว้แล้ว {1} คน — ตั้งเพดานใหม่ก่อนเปิดโควตารวม',
              currentCap,
              usedSeats
            )}
          </p>
          <div className="cta-inline-row">
            <input
              type="number"
              className="mono-num quota-number-input"
              aria-label={tx('เพดานรับผู้สมัครรวมทั้งงานใหม่')}
              min={usedSeats}
              value={draftCap}
              onChange={(e) => setDraftCap(Number(e.target.value))}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || !capCheck.valid}
              onClick={() => void submit(true, draftCap)}
            >
              {tx('ตั้งเพดานและเปิดโควตารวม')}
            </button>
            <button
              type="button"
              className="btn-ghost-sm"
              disabled={busy}
              onClick={() => setNeedsCap(false)}
            >
              {tx('ยกเลิก')}
            </button>
          </div>
          {!capCheck.valid && <p className="field-error">{tx(capCheck.message)}</p>}
        </div>
      )}

      {message && (
        <p
          className={message.ok ? 'text-forest' : 'field-error'}
          role={message.ok ? 'status' : 'alert'}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}

export const OrganizerDashboardView: React.FC<OrganizerDashboardViewProps> = ({
  currentUser,
  organizations,
  invitations,
  teamMembers = [],
  activeOrgId,
  activeEventId,
  activeSection,
  events,
  registrations,
  merchOrders,
  productionInquiries,
  payouts,
  auditLogs,
  simulatedState,
  onClearSimulatedState,
  onSelectOrg,
  onSelectEvent,
  onSelectSection,
  onCreateDraftEvent,
  onDuplicateEventWithoutPii,
  onCompleteDraftReadinessAndSubmit,
  onUpdateFeeBearerPolicy,
  onAddEventProduct,
  onCreateEventProductionQuote,
  onAssignBibNumber,
  onConfirmKitPickup,
  onConfirmMerchHandover,
  onResolveRefundRequest,
  onCreateSingleUseInvite,
  onOpenPublicPreview,
  onUpdateEventTotalQuota,
  onToggleEventTotalQuota,
  onUpdateEventKitShipping,
  onUpdateCategoryQuota,
  onUpdateCategoryAgeRules,
  onOpenEditor,
  platformProfileConfig = DEFAULT_PLATFORM_PROFILE_CONFIG,
  onUpdateEventShirtConfig,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('all_time');

  const [participantSearch, setParticipantSearch] = useState('');
  const [participantRegFilter, setParticipantRegFilter] = useState<
    'all' | RegistrationStatus
  >('all');
  const [participantCatFilter, setParticipantCatFilter] =
    useState<string>('all');

  // Create new draft event form
  const [showNewDraftForm, setShowNewDraftForm] = useState(false);

  // Production Quote calculator (non-duplicated sizing formula per section 15.5)

  const [exportBannerText, setExportBannerText] = useState<string | null>(null);
  const [financeSubFilter, setFinanceSubFilter] = useState<
    'all' | 'payments' | 'refunds' | 'payouts'
  >('all');

  const activeMembership = useMemo(
    () =>
      currentUser.memberships.find((m) => m.organizationId === activeOrgId) ??
      currentUser.memberships[0],
    [currentUser, activeOrgId]
  );

  const activeOrg = useMemo(
    () =>
      (currentUser.isPlatformAdmin
        ? organizations.find((o) => o.id === activeOrgId)
        : organizations.find(
            (o) => o.id === activeMembership?.organizationId
          )) ?? organizations[0],
    [organizations, activeMembership, activeOrgId, currentUser.isPlatformAdmin]
  );

  const role: OrgRole = currentUser.isPlatformAdmin
    ? 'owner'
    : activeMembership?.role ?? 'staff';
  const canViewFinance = role === 'owner' || role === 'finance';
  const canManageEventConfig = role === 'owner' || role === 'event_manager';
  const canCheckIn =
    role === 'owner' || role === 'event_manager' || role === 'staff';
  const canManageOrgBank = role === 'owner';

  const accessibleOrgEvents = useMemo(() => {
    const orgEvs = events.filter((e) => e.organizationId === activeOrg.id);
    if (!activeMembership?.assignedEventIds) return orgEvs;
    const allowed = new Set(activeMembership.assignedEventIds);
    return orgEvs.filter((e) => allowed.has(e.id));
  }, [events, activeOrg.id, activeMembership]);

  const selectedEvent = useMemo(
    () => accessibleOrgEvents.find((e) => e.id === activeEventId) ?? null,
    [accessibleOrgEvents, activeEventId]
  );

  const orgRegistrations = useMemo(() => {
    const allowedIds = new Set(accessibleOrgEvents.map((e) => e.id));
    return registrations.filter(
      (r) => r.organizationId === activeOrg.id && allowedIds.has(r.eventId)
    );
  }, [registrations, activeOrg.id, accessibleOrgEvents]);

  const orgMerchOrders = useMemo(() => {
    const allowedIds = new Set(accessibleOrgEvents.map((e) => e.id));
    return merchOrders.filter(
      (m) => m.organizationId === activeOrg.id && allowedIds.has(m.eventId)
    );
  }, [merchOrders, activeOrg.id, accessibleOrgEvents]);

  const eventMetrics = useMemo(
    () =>
      selectedEvent
        ? computeMetrics(
          [selectedEvent],
          orgRegistrations.filter((r) => r.eventId === selectedEvent.id),
          orgMerchOrders.filter((m) => m.eventId === selectedEvent.id),
          timeWindow
        )
        : null,
    [selectedEvent, orgRegistrations, orgMerchOrders, timeWindow]
  );


  const handleDrillDown = (
    target:
      | 'confirmed'
      | 'pending_payment'
      | 'payments'
      | 'refunds'
      | 'payouts'
      | 'merch'
  ) => {
    if (target === 'merch') {
      if (selectedEvent) {
        onSelectSection('evt_storefront');
      } else {
        onSelectSection('org_merch_production');
      }
      return;
    }

    if (target === 'confirmed' || target === 'pending_payment') {
      if (selectedEvent) {
        setParticipantSearch('');
        setParticipantCatFilter('all');
        setParticipantRegFilter(target);
        onSelectSection('evt_participants');
      } else {
        onSelectSection('org_events');
      }
      return;
    }

    setFinanceSubFilter(target);
    if (!canViewFinance) {
      onSelectSection('org_finance');
      return;
    }
    if (selectedEvent) {
      onSelectSection('evt_finance');
    } else {
      onSelectSection('org_finance');
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById('finance-source-ledger')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };


  const isSectionForbiddenByRole =
    ((activeSection === 'org_finance' || activeSection === 'evt_finance') &&
      !canViewFinance) ||
    (activeSection === 'evt_checkin_bib' && !canCheckIn);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRefundRequests =
    selectedEvent && canViewFinance
      ? orgRegistrations.filter(
          (r) => r.eventId === selectedEvent.id && r.refundStatus === 'requested'
        ).length
      : 0;
  const toNavEvent = (ev: (typeof accessibleOrgEvents)[number]) => ({
    id: ev.id,
    title: ev.titleTh,
    code: ev.code,
    province: ev.province,
    status: ev.status,
  });
  const navProps: OrgNavProps = {
    orgName: activeOrg.nameTh,
    orgId: activeOrg.id,
    orgOptions: currentUser.isPlatformAdmin
      ? organizations.map((o) => ({ id: o.id, name: o.nameTh }))
      : currentUser.memberships.map((m) => ({
          id: m.organizationId,
          name:
            organizations.find((o) => o.id === m.organizationId)?.nameTh ??
            m.organizationId,
        })),
    onSelectOrg,
    roleLabel: currentUser.isPlatformAdmin
      ? 'Platform Owner (ดูและจัดการแทนผู้จัด)'
      : roleNameMap[role],
    isStaff: role === 'staff',
    canViewFinance,
    canCheckIn,
    events: accessibleOrgEvents.map(toNavEvent),
    selectedEvent: selectedEvent ? toNavEvent(selectedEvent) : null,
    activeSection,
    refundRequestCount: navRefundRequests,
    onNavigate: (section, eventId) => {
      if (eventId === null || (eventId === undefined && isOrgSection(section))) {
        onSelectEvent(null, section);
      } else if (eventId !== undefined) {
        onSelectEvent(eventId, section);
      } else if (!selectedEvent) {
        const first = accessibleOrgEvents[0]?.id;
        if (first) onSelectEvent(first, section);
      } else {
        onSelectSection(section);
      }
      window.scrollTo({ top: 0 });
    },
    onSearchRegistrants: (query) => {
      setParticipantSearch(query);
      onSelectSection('evt_participants');
      window.scrollTo({ top: 0 });
    },
  };

  return (
    <div className="org-shell">
      {/* Organizer navigation, redesign approved 24 Nov 2026 (OrganizerNav.tsx) */}
      <OrganizerTopBar {...navProps} />
      <OrganizerMobileContext
        {...navProps}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />
      <div className={`dashboard-workspace${selectedEvent ? '' : ' is-org-scope'}`}>
      <OrganizerRail {...navProps} />

      {/* MAIN WORKSPACE CANVAS */}
      <main className="dashboard-canvas">
        {/* Top Context & Quick Action Bar */}
        <header className="context-breadcrumb-bar">
          <nav className="breadcrumb-trail" aria-label={tx("ตำแหน่งปัจจุบัน")}>
            <ol className="orgnav-crumbs">
              <li>
                <button type="button" onClick={() => onSelectEvent(null, 'org_events')}>
                  {tx(activeOrg.nameTh)}
                </button>
              </li>
              {selectedEvent && activeSection !== 'evt_overview' && (
                <li>
                  <button type="button" onClick={() => onSelectSection('evt_overview')}>
                    {tx(selectedEvent.titleTh)}
                  </button>
                </li>
              )}
              {selectedEvent && activeSection === 'evt_overview' && (
                <li>{tx(selectedEvent.titleTh)}</li>
              )}
              <li>
                <span aria-current="page">{tx(ORG_SECTION_LABEL[activeSection])}</span>
              </li>
            </ol>
          </nav>

          {/* money period / customer page / new event: only on the all-events page (user request 24 Nov 2026) */}
          {(activeSection === 'org_events' || activeSection === 'org_overview') && (
          <div className="context-toolbar">
            <label htmlFor="tw-sel" className="sr-only">
              {tx("ช่วงเวลาคำนวณยอดเงิน")}
            </label>
            <SelectMenu
              id="tw-sel"
              value={timeWindow}
              onChange={(v) => setTimeWindow(v as TimeWindowFilter)}
              ariaLabel={tx("ช่วงเวลาคำนวณยอดเงิน")}
              options={[
                { value: "all_time", label: tx("ยอดเงิน: ตลอดอายุงาน") },
                { value: "last_30d", label: tx("ยอดเงิน: 30 วันล่าสุด") },
                { value: "last_7d", label: tx("ยอดเงิน: 7 วันล่าสุด") },
              ]}
            />

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenPublicPreview(selectedEvent?.id)}
            >
              {tx("ดูหน้าเว็บฝั่งลูกค้า")}
            </button>

            {canManageEventConfig && activeSection !== 'org_events' && activeSection !== 'org_overview' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onSelectEvent(null);
                  onSelectSection('org_events');
                  setShowNewDraftForm(true);
                }}
              >
                <IconPlus size={15} />
                <span>{tx("สร้างงานวิ่งใหม่")}</span>
              </button>
            )}
          </div>
          )}
        </header>

        {/* Special States (Loading / Error / Permission Denied) */}
        {simulatedState === 'loading' ? (
          <section
            className="skeleton-stage"
            aria-busy="true"
            aria-label={tx("กำลังโหลดข้อมูล")}
          >
            <div className="skeleton-banner-note">
              {tx("กำลังโหลดข้อมูล")}
            </div>
            <div className="skeleton-block skel-lg" />
            <div className="skeleton-block skel-md" />
            <div className="skeleton-block skel-table" />
          </section>
        ) : simulatedState === 'permission_denied' ||
          isSectionForbiddenByRole ? (
          <section className="permission-denied-panel" role="alert">
            <IconLock size={28} />
            <h1>{tx("บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้")}</h1>
            <p>
              {tx("คุณเข้าใช้งานในบทบาท ")} <strong>{tx(roleNameMap[role])}</strong> {tx(" ของ")}{' '}
              <strong>{tx(activeOrg.nameTh)}</strong> {tx(" หากต้องการสิทธิ์เพิ่มเติม กรุณาติดต่อเจ้าขององค์กร (")}{tx(activeOrg.contactEmail)})
            </p>
            <div className="cta-inline-row">
              {simulatedState === 'permission_denied' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onClearSimulatedState}
                >
                  {tx("กลับสู่สถานะปกติ")}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  onSelectSection(
                    role === 'staff' && selectedEvent
                      ? 'evt_checkin_bib'
                      : 'org_overview'
                  )
                }
              >
                {tx("ไปหน้าที่ได้รับอนุญาต")}
              </button>
            </div>
          </section>
        ) : (
          <>
            {simulatedState === 'partial_error' && (
              <div className="error-callout" role="alert">
                <IconAlert size={18} />
                <div className="callout-flex">
                  <span>
                    <strong>{tx("ดึงสถานะคิวส่งอีเมลแจ้งเตือนไม่สำเร็จชั่วคราว:")}</strong>{' '}
                    {tx("คุณยังจัดการผู้สมัครและดูยอดเงินในส่วนอื่นของหน้านี้ได้ตามปกติ")}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClearSimulatedState}
                  >
                    {tx("ลองโหลดใหม่")}
                  </button>
                </div>
              </div>
            )}

            {exportBannerText && (
              <div className="success-callout" role="status">
                <IconCheckCircle size={18} />
                <div className="callout-flex">
                  <span>{tx(exportBannerText)}</span>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => setExportBannerText(null)}
                  >
                    {tx("ปิดข้อความ")}
                  </button>
                </div>
              </div>
            )}

            {/* ================= 1. ORG: ALL EVENTS (overview + list merged, 24 Nov 2026) ================= */}
            {(activeSection === 'org_overview' || activeSection === 'org_events') && (
              <OrgEventsView
                orgName={activeOrg.nameTh}
                events={accessibleOrgEvents}
                registrations={orgRegistrations}
                isStaff={role === 'staff'}
                canManageEventConfig={canManageEventConfig}
                canViewFinance={canViewFinance}
                canCheckIn={canCheckIn}
                bankReady={activeOrg.payoutReady}
                canManageOrgBank={canManageOrgBank}
                createOpen={showNewDraftForm}
                onCreateOpenChange={setShowNewDraftForm}
                onOpenEvent={(eventId, section) => {
                  if (section === 'evt_finance') setFinanceSubFilter('refunds');
                  onSelectEvent(eventId, section);
                  window.scrollTo({ top: 0 });
                }}
                onOpenOrgSection={(section) => onSelectEvent(null, section)}
                onCreateDraft={(payload) => onCreateDraftEvent({ orgId: activeOrg.id, ...payload })}
                onDuplicate={onDuplicateEventWithoutPii}
                auditLogs={auditLogs.filter((l) => l.organizationId === activeOrg.id)}
              />
            )}

            {/* ================= 3. ORG MERCHANDISE & PRODUCTION QUOTES ================= */}
            {activeSection === 'org_merch_production' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("ร้านค้าและคำขอใบเสนอราคาผลิตเสื้อ/เหรียญขององค์กร")}</h1>
                  <p className="page-purpose-desc">
                    {tx("ใช้ติดตามคำสั่งซื้อของที่ระลึกจากลูกค้าทั่วไปข้ามทุกงานวิ่ง และตรวจสถานะคำขอราคา/งานสั่งผลิตเสื้อและเหรียญขององค์กร")}
                  </p>
                </div>

                <section className="clean-panel">
                  <h2>{tx("คำขอใบเสนอราคาและงานสั่งผลิตเสื้อ/เหรียญ (Production Inquiries)")}</h2>
                  <p className="muted-block">
                    {tx("แยกสถานะใบเสนอราคา การอนุมัติแบบ และสถานะการผลิตออกจากกัน (คำขอราคายังไม่ใช่คำสั่งเริ่มผลิตจนกว่าจะยืนยันแบบ จำนวน และเงื่อนไขชำระ)")}
                  </p>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("รหัสคำขอ")}</th>
                          <th>{tx("รายการสั่งทำ / เวอร์ชันแบบ")}</th>
                          <th className="num-col">{tx("สูตรคำนวณยอดผลิตสุทธิ")}</th>
                          <th>{tx("กำหนดรับของ")}</th>
                          <th>{tx("สถานะราคา & การผลิต")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionInquiries
                          .filter((q) => q.organizationId === activeOrg.id)
                          .map((rfq) => (
                            <tr key={rfq.id}>
                              <td className="mono-code">{tx(rfq.inquiryCode)}</td>
                              <td>
                                <strong>{tx(rfq.itemType)}</strong>
                                <div className="muted-inline">
                                  {tx(rfq.artworkVersion)}
                                </div>
                              </td>
                              <td className="num-col mono-num">
                                {tx("สิทธิ์สมัคร ")} {tx(rfq.packageEntitlementQty)} {tx(" + ร้านค้า")}{' '}
                                {tx(rfq.addonStoreQty)} {tx(" + สำรอง")} {tx(rfq.organizerBufferQty)}{' '}
                                {tx("− มีอยู่ ")} {tx(rfq.existingStockDeductedQty)} ={' '}
                                <strong>{tx(rfq.netQtyToProduce)} {tx(" ชิ้น")}</strong>
                              </td>
                              <td className="mono-num">
                                {tx(rfq.targetDeliveryDate)}
                              </td>
                              <td>
                                <span className="status-pill badge-navy">
                                  <IconClock size={13} />
                                  <span>
                                    {rfq.quoteStatus === 'quoted_demo'
                                      ? tx("ส่งใบเสนอราคาแล้ว")
                                      : rfq.quoteStatus === 'accepted'
                                        ? tx("อนุมัติราคาแล้ว")
                                        : rfq.quoteStatus === 'submitted'
                                          ? tx("ส่งคำขอราคาแล้ว")
                                          : tx("ร่างคำขอราคา")}
                                  </span>
                                </span>{' '}
                                <span className="status-pill badge-amber">
                                  <IconClock size={13} />
                                  <span>
                                    {rfq.productionStatus === 'awaiting_approval'
                                      ? tx("รออนุมัติแบบก่อนผลิต")
                                      : rfq.productionStatus === 'ready_to_produce'
                                        ? tx("พร้อมเริ่มผลิต")
                                        : rfq.productionStatus === 'in_production'
                                          ? tx("กำลังผลิต")
                                          : tx("ตรวจ QC ผ่านแล้ว")}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="clean-panel">
                  <h2>
                    {tx("คำสั่งซื้อสินค้าที่ระลึกข้ามทุกงานในองค์กร (")}
                    <span className="mono-num">{tx(orgMerchOrders.length)}</span>{' '}
                    {tx("รายการ)")}
                  </h2>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("รหัสออเดอร์")}</th>
                          <th>{tx("ผู้ซื้อ")}</th>
                          <th>{tx("สินค้า / ขนาด")}</th>
                          <th className="num-col">{tx("จำนวน (ส่งมอบแล้ว)")}</th>
                          <th className="num-col">{tx("ยอดชำระรวม")}</th>
                          <th>{tx("วิธีรับของ")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgMerchOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="mono-code">{tx(ord.merchOrderCode)}</td>
                            <td>{tx(ord.buyerName)}</td>
                            <td>
                              <strong>{tx(ord.productNameTh)}</strong> (
                              {tx(ord.variantSize)})
                            </td>
                            <td className="num-col mono-num">
                              {tx(ord.deliveredQty)} / {tx(ord.quantity)} {tx(" ชิ้น")}
                            </td>
                            <td className="num-col mono-num">
                              {formatThb(ord.totalPaidSatang, true)}
                            </td>
                            <td>
                              {ord.deliveryMethod === 'pickup_at_expo'
                                ? txf("รับหน้างาน ({0})", ord.pickupToken)
                                : tx("จัดส่งไปรษณีย์")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 4. ORG MONEY AND PAYOUTS (24 Nov 2026) ================= */}
            {activeSection === 'org_finance' && (
              <OrgFinanceView
                orgCode={activeOrg.code}
                orgName={activeOrg.nameTh}
                bankSummary={activeOrg.payoutBankSummary}
                bankReady={activeOrg.payoutReady}
                canManageBank={canManageOrgBank}
                events={accessibleOrgEvents}
                registrations={orgRegistrations}
                merchOrders={orgMerchOrders}
                payouts={payouts.filter((p) => p.organizationId === activeOrg.id)}
                timeWindow={timeWindow}
                onOpenTeamSettings={() => onSelectEvent(null, 'org_team_settings')}
                onOpenEventFinance={(eventId) => {
                  onSelectEvent(eventId, 'evt_finance');
                  window.scrollTo({ top: 0 });
                }}
              />
            )}

            {/* ================= 5. ORG TEAM AND INFO (24 Nov 2026) ================= */}
            {activeSection === 'org_team_settings' && (
              <OrgTeamView
                org={{
                  id: activeOrg.id,
                  code: activeOrg.code,
                  nameTh: activeOrg.nameTh,
                  province: activeOrg.province,
                  verificationStatus: activeOrg.verificationStatus,
                  contactEmail: activeOrg.contactEmail,
                  mainContactName: activeOrg.mainContact?.name,
                  documentCount: activeOrg.documents?.length ?? 0,
                  payoutBankSummary: activeOrg.payoutBankSummary,
                  payoutReady: activeOrg.payoutReady,
                }}
                currentUserId={currentUser.id}
                currentRole={role}
                isPlatformAdmin={Boolean(currentUser.isPlatformAdmin)}
                members={teamMembers}
                invitations={invitations.filter((inv) => inv.organizationId === activeOrg.id)}
                events={accessibleOrgEvents}
                onCreateInvite={(r) => onCreateSingleUseInvite(activeOrg.id, r)}
              />
            )}

            {/* ================= 6. EVENT OVERVIEW & LIFECYCLE ================= */}

            {selectedEvent && activeSection === 'evt_overview' && eventMetrics && (
              <EventHomeView
                key={selectedEvent.id}
                event={selectedEvent}
                registrations={orgRegistrations.filter((r) => r.eventId === selectedEvent.id)}
                metrics={eventMetrics}
                timeWindow={timeWindow}
                canViewFinance={canViewFinance}
                canManageEventConfig={canManageEventConfig}
                onNavigate={(section) => {
                  onSelectSection(section);
                  window.scrollTo({ top: 0 });
                }}
                onDrillDown={handleDrillDown}
                onSubmitDraft={() => onCompleteDraftReadinessAndSubmit(selectedEvent.id)}
              />
            )}

            {/* ================= 7. EVENT PAGE AND REGISTRATION FORM ================= */}
            {/* one editor for both (27 Nov 2026, user request); the older menus "เนื้อหาหน้างาน" and
                "ฟอร์มสมัคร" open it too (links and saved places from before) */}
            {selectedEvent && (activeSection === 'evt_studio' || activeSection === 'evt_page_editor' || activeSection === 'evt_form_editor') && (
              <EventStudioCard
                key={selectedEvent.id}
                event={selectedEvent}
                canEdit={canManageEventConfig}
                onOpen={(part) => onOpenEditor?.(selectedEvent.id, part)}
              />
            )}

            {/* setup pages rebuilt from the approved mockups (24 Nov 2026) */}
            {selectedEvent && activeSection === 'evt_pricing_quota' && (
              <EventPricingView
                key={selectedEvent.id}
                event={selectedEvent}
                registrations={orgRegistrations.filter((r) => r.eventId === selectedEvent.id)}
                canEdit={canManageEventConfig}
                onSaveCategoryQuota={(categoryId, next) => onUpdateCategoryQuota(selectedEvent.id, categoryId, next)}
                onOpenFormEditor={() => onSelectSection('evt_studio')}
                totalQuotaControl={
                  <div className="total-quota-banner">
                    <TotalQuotaSwitch
                      key={selectedEvent.id}
                      enabled={isTotalQuotaEnabled(selectedEvent)}
                      currentCap={selectedEvent.totalEventQuota}
                      usedSeats={(eventMetrics?.confirmedParticipants ?? 0) + (eventMetrics?.pendingPaymentReservations ?? 0)}
                      canEdit={canManageEventConfig}
                      onToggle={(enabled, cap) => onToggleEventTotalQuota(selectedEvent.id, enabled, cap)}
                    />
                    {isTotalQuotaEnabled(selectedEvent) && (
                      <QuotaEditorRow
                        categoryName="เพดานรับผู้สมัครรวมทั้งงาน"
                        maxQuota={selectedEvent.totalEventQuota}
                        registeredCount={eventMetrics?.confirmedParticipants ?? 0}
                        reservedCount={eventMetrics?.pendingPaymentReservations ?? 0}
                        canEdit={canManageEventConfig}
                        onSaveQuota={(nextTotal) => onUpdateEventTotalQuota(selectedEvent.id, nextTotal)}
                      />
                    )}
                  </div>
                }
                feeBearer={
                  <FeeBearerPicker
                    event={selectedEvent}
                    canEdit={canManageEventConfig}
                    onChange={(policy) => onUpdateFeeBearerPolicy(selectedEvent.id, policy)}
                  />
                }
                ageRulesEditor={
                  <CategoryAgeRulesPanel
                    event={selectedEvent}
                    registrations={orgRegistrations}
                    canEdit={canManageEventConfig}
                    onSave={(categoryId, config) => onUpdateCategoryAgeRules(selectedEvent.id, categoryId, config)}
                  />
                }
              />
            )}

            {selectedEvent && activeSection === 'evt_kit' && (
              <EventKitView
                key={selectedEvent.id}
                event={selectedEvent}
                registrations={orgRegistrations.filter((r) => r.eventId === selectedEvent.id)}
                productionInquiries={productionInquiries.filter((q) => q.eventId === selectedEvent.id)}
                platformSizes={platformProfileConfig.shirtSizes}
                canEdit={canManageEventConfig}
                onUpdateShirtConfig={
                  onUpdateEventShirtConfig ? (patch) => onUpdateEventShirtConfig(selectedEvent.id, patch) : undefined
                }
                onSaveShippingFee={(fee) => onUpdateEventKitShipping(selectedEvent.id, fee)}
                onRequestQuote={(q) =>
                  onCreateEventProductionQuote({
                    orgId: activeOrg.id,
                    eventId: selectedEvent.id,
                    itemType: 'เสื้อแข่งขันและเสื้อที่ระลึก',
                    ...q,
                  })
                }
                onOpenPageContent={() => onSelectSection('evt_studio')}
                onOpenAllRequests={() => onSelectEvent(null, 'org_merch_production')}
              />
            )}

            {/* ================= 8. EVENT PARTICIPANTS ================= */}
            {selectedEvent && activeSection === 'evt_participants' && (
              <EventRegistrantsView
                key={selectedEvent.id}
                event={selectedEvent}
                registrations={orgRegistrations.filter((r) => r.eventId === selectedEvent.id)}
                isStaff={role === 'staff'}
                canManageEventConfig={canManageEventConfig}
                canViewFinance={canViewFinance}
                search={participantSearch}
                onSearch={setParticipantSearch}
                statusFilter={participantRegFilter}
                onStatusFilter={setParticipantRegFilter}
                categoryFilter={participantCatFilter}
                onCategoryFilter={setParticipantCatFilter}
                onAssignBib={onAssignBibNumber}
                onNavigate={(section) => {
                  onSelectSection(section);
                  window.scrollTo({ top: 0 });
                }}
              />
            )}

            {/* ================= 9. EVENT STOREFRONT & MERCH MANAGEMENT ================= */}
            {selectedEvent && activeSection === 'evt_storefront' && (
              <EventShopView
                key={selectedEvent.id}
                event={selectedEvent}
                orders={orgMerchOrders.filter((m) => m.eventId === selectedEvent.id)}
                canEdit={canManageEventConfig}
                canViewFinance={canViewFinance}
                onAddProduct={onAddEventProduct}
              />
            )}

            {/* ================= 10. EVENT CHECK-IN BIB & MERCH HANDOVER ================= */}
            {selectedEvent && activeSection === 'evt_checkin_bib' && (
              <EventCheckInView
                key={selectedEvent.id}
                event={selectedEvent}
                registrations={orgRegistrations.filter((r) => r.eventId === selectedEvent.id)}
                merchOrders={orgMerchOrders.filter((m) => m.eventId === selectedEvent.id)}
                staffName={currentUser.fullNameTh}
                onAssignBib={onAssignBibNumber}
                onConfirmKit={onConfirmKitPickup}
                onMerchHandover={onConfirmMerchHandover}
              />
            )}

            {/* ================= 11. EVENT FINANCE & REFUNDS ================= */}
            {selectedEvent && activeSection === 'evt_finance' && eventMetrics && (
              <EventFinanceView
                key={selectedEvent.id}
                event={selectedEvent}
                registrations={orgRegistrations.filter((r) => r.eventId === selectedEvent.id)}
                payouts={payouts.filter((p) => p.eventId === selectedEvent.id)}
                metrics={eventMetrics}
                timeWindow={timeWindow}
                initialFilter={financeSubFilter}
                onResolveRefund={onResolveRefundRequest}
              />
            )}
          </>
        )}
      </main>
      </div>
      <OrganizerMobileNav
        {...navProps}
        menuOpen={mobileMenuOpen}
        onMenuOpenChange={setMobileMenuOpen}
      />
    </div>
  );
};

