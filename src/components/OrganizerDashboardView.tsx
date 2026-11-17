import React, { useMemo, useState } from 'react';
import {
  AuditLogEntry,
  CustomFieldType,
  CustomRegistrationField,
  EventStatus,
  FeeBearerPolicy,
  MerchOrderRecord,
  Organization,
  OrgRole,
  PayoutBatch,
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
import {
  calculateFeeQuote,
  computeMetrics,
  feePolicyLabel,
  formatThb,
  getCurrentTier,
  isWithinTimeWindow,
  sellerModelLabel,
} from '../utils/pricing';
import { BibLedgerStrip } from './BibLedgerStrip';
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconBag,
  IconBib,
  IconBuilding,
  IconCheckCircle,
  IconClock,
  IconCopy,
  IconDownload,
  IconFlag,
  IconLedger,
  IconLock,
  IconPlus,
  IconQr,
  IconSearch,
  IconShield,
  IconShirt,
  IconUsers,
} from './Icons';
import {
  EventStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  PayoutStatusBadge,
  RefundStatusBadge,
  RegStatusBadge,
} from './StatusBadges';
import { validateQuotaUpdate } from '../utils/eventConfig';

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
  | 'evt_checkin_bib';

interface OrganizerDashboardViewProps {
  currentUser: UserAccount;
  organizations: Organization[];
  invitations: TeamInvitation[];
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
  onSaveQuota,
}: {
  categoryName: string;
  maxQuota: number;
  registeredCount: number;
  reservedCount: number;
  canEdit: boolean; // true สำหรับ owner และ event_manager
  onSaveQuota: (nextQuota: number) => void;
}) {
  const [draftQuota, setDraftQuota] = useState<number>(maxQuota);
  const check = validateQuotaUpdate(draftQuota, registeredCount, reservedCount);

  return (
    <div className="quota-editor-row">
      <div>
        <strong>{categoryName}</strong>
        <span> (ใช้โควตาแล้ว {registeredCount + reservedCount} / {maxQuota})</span>
      </div>
      {canEdit && (
        <div>
          <input
            type="number"
            min={check.minAllowed}
            value={draftQuota}
            onChange={(e) => setDraftQuota(Number(e.target.value))}
          />
          <button
            type="button"
            disabled={!check.valid || draftQuota === maxQuota}
            onClick={() => onSaveQuota(draftQuota)}
          >
            บันทึกโควตา
          </button>
          {!check.valid && <p className="field-error">{check.message}</p>}
        </div>
      )}
    </div>
  );
}

// 2) ส่วนเพิ่ม/ลบ Field กรอกข้อมูลเพิ่มเติมสำหรับผู้จัด
export function CustomFieldsManager({
  fields = [],
  canEdit,
  onChange,
}: {
  fields?: CustomRegistrationField[];
  canEdit: boolean;
  onChange: (next: CustomRegistrationField[]) => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);
  const [isSensitive, setIsSensitive] = useState(false);

  const handleAddField = () => {
    if (!label.trim()) return;
    const newField: CustomRegistrationField = {
      id: `cf_${Date.now()}`,
      label: label.trim(),
      type,
      required,
      isSensitive,
      options:
        type === 'select'
          ? optionsText.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
    };
    onChange([...fields, newField]);
    setLabel('');
    setOptionsText('');
    setRequired(false);
    setIsSensitive(false);
  };

  return (
    <section className="custom-fields-panel">
      <h4>คำถามเพิ่มเติมในใบสมัคร</h4>
      <ul>
        {fields.map((f) => (
          <li key={f.id}>
            <span>
              {f.label} ({f.type}) {f.required ? '*จำเป็น' : ''}{' '}
              {f.isSensitive ? '[ข้อมูลอ่อนไหว/PII]' : ''}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={() => onChange(fields.filter((item) => item.id !== f.id))}
              >
                ลบ
              </button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="custom-field-creator">
          <input
            type="text"
            placeholder="ชื่อคำถาม เช่น โรคประจำตัว หรือ ชื่อชมรม"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            <option value="text">ข้อความสั้น</option>
            <option value="select">ตัวเลือก (Dropdown)</option>
            <option value="checkbox">ช่องติ๊กยืนยัน</option>
          </select>
          {type === 'select' && (
            <input
              type="text"
              placeholder="ตัวเลือกคั่นด้วยลูกน้ำ เช่น A, B, AB, O"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          )}
          <label>
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            บังคับกรอก
          </label>
          <label>
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
            />
            ซ่อนจากจุดรับอุปกรณ์หน้างาน (PII)
          </label>
          <button type="button" onClick={handleAddField}>
            + เพิ่มฟิลด์คำถาม
          </button>
        </div>
      )}
    </section>
  );
}

export const OrganizerDashboardView: React.FC<OrganizerDashboardViewProps> = ({
  currentUser,
  organizations,
  invitations,
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
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('all_time');
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<
    'all' | EventStatus
  >('all');

  const [participantSearch, setParticipantSearch] = useState('');
  const [participantRegFilter, setParticipantRegFilter] = useState<
    'all' | RegistrationStatus
  >('all');
  const [participantCatFilter, setParticipantCatFilter] =
    useState<string>('all');
  const [inspectedRegId, setInspectedRegId] = useState<string | null>(null);

  // Check-in & Merchandise Handover mode
  const [handoverTab, setHandoverTab] = useState<'race_bib' | 'merch_pickup'>(
    'race_bib'
  );
  const [checkinQuery, setCheckinQuery] = useState('');
  const [bibDraftMap, setBibDraftMap] = useState<Record<string, string>>({});
  const [checkinFeedback, setCheckinFeedback] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Create new draft event form
  const [showNewDraftForm, setShowNewDraftForm] = useState(false);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  const [newDraftProvince, setNewDraftProvince] = useState('เชียงใหม่');
  const [newDraftDate, setNewDraftDate] = useState('2027-03-21');
  const [requestProdHelp, setRequestProdHelp] = useState(true);

  // Add storefront product form
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCat, setNewProdCat] = useState<
    'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม'
  >('เสื้อที่ระลึก');
  const [newProdSaleMode, setNewProdSaleMode] = useState<
    'ready_stock' | 'preorder'
  >('preorder');
  const [newProdService, setNewProdService] = useState<SellerServiceModel>(
    'runevent_full_service'
  );
  const [newProdPrice, setNewProdPrice] = useState(420);
  const [newProdCap, setNewProdCap] = useState(50);

  // Production Quote calculator (non-duplicated sizing formula per section 15.5)
  const [bufferShirtQty, setBufferShirtQty] = useState(15);
  const [existingShirtStock, setExistingShirtStock] = useState(0);
  const [rfqTargetDate, setRfqTargetDate] = useState('2026-12-08');

  const [exportBannerText, setExportBannerText] = useState<string | null>(null);
  const [calcSamplePriceBaht, setCalcSamplePriceBaht] = useState<number>(900);
  const [financeSubFilter, setFinanceSubFilter] = useState<
    'all' | 'payments' | 'refunds' | 'payouts'
  >('all');
  const [orgDrilldownRegFilter, setOrgDrilldownRegFilter] = useState<
    null | 'confirmed' | 'pending_payment'
  >(null);
  const [inviteRolePick, setInviteRolePick] = useState<OrgRole>('staff');

  const activeMembership = useMemo(
    () =>
      currentUser.memberships.find((m) => m.organizationId === activeOrgId) ??
      currentUser.memberships[0],
    [currentUser, activeOrgId]
  );

  const activeOrg = useMemo(
    () =>
      organizations.find((o) => o.id === activeMembership?.organizationId) ??
      organizations[0],
    [organizations, activeMembership]
  );

  const role: OrgRole = activeMembership?.role ?? 'staff';
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

  const orgMetrics = useMemo(
    () =>
      computeMetrics(
        accessibleOrgEvents,
        orgRegistrations,
        orgMerchOrders,
        timeWindow
      ),
    [accessibleOrgEvents, orgRegistrations, orgMerchOrders, timeWindow]
  );

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

  const urgentActionItems = useMemo(() => {
    const items: {
      id: string;
      title: React.ReactNode;
      whyItMatters: React.ReactNode;
      ctaLabel: string;
      action: () => void;
    }[] = [];

    if (!activeOrg.payoutReady && canManageOrgBank) {
      items.push({
        id: 'act-bank',
        title: 'ยังไม่ได้ผูกบัญชีธนาคารสำหรับรับเงินโอนขององค์กร',
        whyItMatters:
          'ต้องยืนยันบัญชีรับเงินก่อนจึงจะเปิดรับสมัครงานวิ่งและรับยอดนำส่งได้',
        ctaLabel: 'ตั้งค่าบัญชีองค์กร',
        action: () => onSelectSection('org_team_settings'),
      });
    }

    if (canViewFinance) {
      const refundReqs = orgRegistrations.filter(
        (r) => r.refundStatus === 'requested'
      );
      if (refundReqs.length > 0) {
        items.push({
          id: 'act-refund',
          title: (
            <>
              มีคำขอคืนเงินจากผู้สมัครรอตรวจสอบ{' '}
              <span className="mono-num">{refundReqs.length}</span> รายการ
            </>
          ),
          whyItMatters: (
            <>
              ยอดขอคืนรวม{' '}
              <span className="mono-num">
                {formatThb(
                  refundReqs.reduce((s, r) => s + r.snapshotBaseSatang, 0),
                  true
                )}
              </span>{' '}
              รอฝ่ายการเงินพิจารณาอนุมัติหรือปฏิเสธ
            </>
          ),
          ctaLabel: 'ตรวจคำขอคืนเงิน',
          action: () => {
            setFinanceSubFilter('refunds');
            onSelectEvent(refundReqs[0].eventId, 'evt_finance');
          },
        });
      }
    }

    if (canManageEventConfig) {
      accessibleOrgEvents
        .filter((e) => e.status === 'draft')
        .forEach((draftEv) => {
          const failedCount = draftEv.readinessChecks.filter(
            (c) => !c.passed
          ).length;
          items.push({
            id: `act-draft-${draftEv.id}`,
            title: (
              <>
                งานแบบร่าง &ldquo;{draftEv.titleTh}&rdquo; เหลือตั้งค่าอีก{' '}
                <span className="mono-num">{failedCount}</span> หัวข้อ
              </>
            ),
            whyItMatters:
              draftEv.statusNote ??
              'เมื่อตั้งค่าครบทุกข้อแล้วจึงจะส่งให้แพลตฟอร์มตรวจเปิดขายได้',
            ctaLabel: 'ไปตั้งค่างานต่อ',
            action: () => onSelectEvent(draftEv.id, 'evt_overview'),
          });
        });
    }

    if (canCheckIn) {
      accessibleOrgEvents
        .filter((e) => e.status === 'published')
        .forEach((pubEv) => {
          const missingBib = orgRegistrations.filter(
            (r) =>
              r.eventId === pubEv.id &&
              r.registrationStatus === 'confirmed' &&
              !r.bibNumber
          ).length;
          if (missingBib > 0) {
            items.push({
              id: `act-bib-${pubEv.id}`,
              title: (
                <>
                  ผู้สมัครชำระเงินแล้วยังไม่มีเลข BIB{' '}
                  <span className="mono-num">{missingBib}</span> คน (
                  <span className="mono-code">{pubEv.code}</span>)
                </>
              ),
              whyItMatters: `ควรกำหนดเลข BIB ล่วงหน้าเพื่อให้จุดรับอุปกรณ์วันงาน ${pubEv.titleTh} ทำงานได้ทันที`,
              ctaLabel: 'กำหนดเลข BIB',
              action: () => {
                setHandoverTab('race_bib');
                onSelectEvent(pubEv.id, 'evt_checkin_bib');
              },
            });
          }
        });
    }

    return items;
  }, [
    activeOrg,
    canManageOrgBank,
    canViewFinance,
    canManageEventConfig,
    canCheckIn,
    orgRegistrations,
    accessibleOrgEvents,
    onSelectSection,
    onSelectEvent,
  ]);

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
        setOrgDrilldownRegFilter(target);
        onSelectSection('org_overview');
        window.requestAnimationFrame(() => {
          document
            .getElementById('org-drilldown-source-panel')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
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

  const filteredOrgEvents = useMemo(() => {
    return accessibleOrgEvents.filter((ev) => {
      const q = eventSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        ev.titleTh.toLowerCase().includes(q) ||
        ev.code.toLowerCase().includes(q) ||
        ev.province.toLowerCase().includes(q);
      const matchStatus =
        eventStatusFilter === 'all' || ev.status === eventStatusFilter;
      return matchQ && matchStatus;
    });
  }, [accessibleOrgEvents, eventSearch, eventStatusFilter]);

  const eventParticipants = useMemo(() => {
    if (!selectedEvent) return [];
    return orgRegistrations
      .filter((r) => r.eventId === selectedEvent.id)
      .filter((r) => {
        const q = participantSearch.trim().toLowerCase();
        const matchQ =
          !q ||
          r.participantNameTh.toLowerCase().includes(q) ||
          r.participantNameEn.toLowerCase().includes(q) ||
          r.regCode.toLowerCase().includes(q) ||
          (r.bibNumber ?? '').toLowerCase().includes(q) ||
          r.qrCheckInToken.toLowerCase().includes(q);
        const matchStatus =
          participantRegFilter === 'all' ||
          r.registrationStatus === participantRegFilter;
        const matchWindow =
          participantRegFilter !== 'confirmed' ||
          timeWindow === 'all_time' ||
          isWithinTimeWindow(r.createdAt, timeWindow);
        const matchCat =
          participantCatFilter === 'all' ||
          r.categoryId === participantCatFilter;
        return matchQ && matchStatus && matchWindow && matchCat;
      });
  }, [
    selectedEvent,
    orgRegistrations,
    participantSearch,
    participantRegFilter,
    participantCatFilter,
    timeWindow,
  ]);

  const orgScopedSourceRegistrations = useMemo(() => {
    if (!orgDrilldownRegFilter) return [];
    return orgRegistrations.filter((r) => {
      if (r.registrationStatus !== orgDrilldownRegFilter) return false;
      if (
        orgDrilldownRegFilter === 'confirmed' &&
        timeWindow !== 'all_time' &&
        !isWithinTimeWindow(r.createdAt, timeWindow)
      ) {
        return false;
      }
      return true;
    });
  }, [orgRegistrations, orgDrilldownRegFilter, timeWindow]);

  const inspectedReg = useMemo(
    () => eventParticipants.find((r) => r.id === inspectedRegId) ?? null,
    [eventParticipants, inspectedRegId]
  );

  const checkinCandidates = useMemo(() => {
    if (!selectedEvent) return [];
    const q = checkinQuery.trim().toLowerCase();
    return orgRegistrations
      .filter((r) => r.eventId === selectedEvent.id)
      .filter(
        (r) =>
          !q ||
          r.qrCheckInToken.toLowerCase().includes(q) ||
          (r.bibNumber ?? '').toLowerCase().includes(q) ||
          r.participantNameTh.toLowerCase().includes(q) ||
          r.regCode.toLowerCase().includes(q)
      );
  }, [selectedEvent, orgRegistrations, checkinQuery]);

  const eventMerchOrders = useMemo(() => {
    if (!selectedEvent) return [];
    const q = checkinQuery.trim().toLowerCase();
    return orgMerchOrders
      .filter((m) => m.eventId === selectedEvent.id)
      .filter(
        (m) =>
          !q ||
          m.pickupToken.toLowerCase().includes(q) ||
          m.merchOrderCode.toLowerCase().includes(q) ||
          m.buyerName.toLowerCase().includes(q)
      );
  }, [selectedEvent, orgMerchOrders, checkinQuery]);

  const isSectionForbiddenByRole =
    ((activeSection === 'org_finance' || activeSection === 'evt_finance') &&
      !canViewFinance) ||
    (activeSection === 'evt_checkin_bib' && !canCheckIn);

  return (
    <div className="dashboard-workspace">
      {/* SELF-EXPLANATORY SIDEBAR NAVIGATION */}
      <aside
        className="dashboard-rail"
        aria-label="เมนูจัดการสำหรับผู้จัดงานวิ่ง"
      >
        <div className="rail-org-switcher">
          <label htmlFor="org-ctx-sel" className="rail-field-label">
            องค์กรผู้จัดที่กำลังดูแล
          </label>
          <select
            id="org-ctx-sel"
            value={activeOrg.id}
            onChange={(e) => onSelectOrg(e.target.value)}
          >
            {currentUser.memberships.map((m) => {
              const o = organizations.find(
                (org) => org.id === m.organizationId
              );
              return (
                <option key={m.organizationId} value={m.organizationId}>
                  {o?.nameTh}
                </option>
              );
            })}
          </select>
          <div className="rail-role-chip">
            <IconShield size={14} />
            <span>{roleNameMap[role]}</span>
          </div>
        </div>

        <nav className="rail-nav-group" aria-label="เมนูระดับองค์กร">
          <div className="rail-group-heading">ระดับองค์กร (ดูรวมทุกงาน)</div>
          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_overview' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_overview');
            }}
          >
            <IconBuilding size={16} />
            <span>หน้าแรกผู้จัด (งานต้องทำ)</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_events' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_events');
            }}
          >
            <IconFlag size={16} />
            <span>งานวิ่งทั้งหมด ({accessibleOrgEvents.length})</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_merch_production' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_merch_production');
            }}
          >
            <IconShirt size={16} />
            <span>ร้านค้า & สั่งผลิตเสื้อ/เหรียญ</span>
          </button>

          {canViewFinance && (
            <button
              type="button"
              className={`rail-nav-btn ${activeSection === 'org_finance' ? 'active' : ''
                }`}
              onClick={() => {
                onSelectEvent(null);
                onSelectSection('org_finance');
              }}
            >
              <IconLedger size={16} />
              <span>การเงินรวม & รอบโอน</span>
            </button>
          )}

          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_team_settings' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_team_settings');
            }}
          >
            <IconUsers size={16} />
            <span>ทีมงาน & บัญชีรับเงิน</span>
          </button>
        </nav>

        <div className="rail-event-context">
          <label htmlFor="evt-ctx-sel" className="rail-field-label">
            เลือกงานวิ่งเพื่อจัดการรายอีเวนต์
          </label>
          <select
            id="evt-ctx-sel"
            value={selectedEvent?.id ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onSelectEvent(null, 'org_overview');
              } else {
                onSelectEvent(
                  val,
                  role === 'staff' ? 'evt_checkin_bib' : 'evt_overview'
                );
              }
            }}
          >
            <option value="">-- เลือกงานวิ่งที่ต้องการจัดการ --</option>
            {accessibleOrgEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.titleTh}
              </option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <nav
            className="rail-nav-group rail-event-subnav"
            aria-label="เมนูจัดการภายในงานวิ่งที่เลือก"
          >
            <div className="rail-group-heading">
              เมนูของงาน: {selectedEvent.code}
            </div>
            <button
              type="button"
              className={`rail-nav-btn ${activeSection === 'evt_overview' ? 'active' : ''
                }`}
              onClick={() => onSelectSection('evt_overview')}
            >
              <IconFlag size={16} />
              <span>ภาพรวม & ความพร้อมงาน</span>
            </button>
            <button
              type="button"
              className={`rail-nav-btn ${activeSection === 'evt_pricing_quota' ? 'active' : ''
                }`}
              onClick={() => onSelectSection('evt_pricing_quota')}
            >
              <IconBib size={16} />
              <span>ระยะ ราคา & ยอดไซส์เสื้อ</span>
            </button>
            <button
              type="button"
              className={`rail-nav-btn ${activeSection === 'evt_participants' ? 'active' : ''
                }`}
              onClick={() => onSelectSection('evt_participants')}
            >
              <IconUsers size={16} />
              <span>รายชื่อผู้สมัครวิ่ง</span>
            </button>
            <button
              type="button"
              className={`rail-nav-btn ${activeSection === 'evt_storefront' ? 'active' : ''
                }`}
              onClick={() => onSelectSection('evt_storefront')}
            >
              <IconBag size={16} />
              <span>ร้านค้า & สินค้าของงานนี้</span>
            </button>
            {canCheckIn && (
              <button
                type="button"
                className={`rail-nav-btn ${activeSection === 'evt_checkin_bib' ? 'active' : ''
                  }`}
                onClick={() => onSelectSection('evt_checkin_bib')}
              >
                <IconQr size={16} />
                <span>เช็กอิน BIB & จ่ายสินค้า</span>
              </button>
            )}
            {canViewFinance && (
              <button
                type="button"
                className={`rail-nav-btn ${activeSection === 'evt_finance' ? 'active' : ''
                  }`}
                onClick={() => onSelectSection('evt_finance')}
              >
                <IconLedger size={16} />
                <span>รายรับ & คืนเงินงานนี้</span>
              </button>
            )}
          </nav>
        )}
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <main className="dashboard-canvas">
        {/* Top Context & Quick Action Bar */}
        <header className="context-breadcrumb-bar">
          <div className="breadcrumb-trail">
            {selectedEvent ? (
              <>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => onSelectEvent(null, 'org_overview')}
                >
                  <IconArrowLeft size={14} />
                  <span>รวมทุกงาน</span>
                </button>
                <strong>{selectedEvent.titleTh}</strong>
                <EventStatusBadge status={selectedEvent.status} />
              </>
            ) : (
              <>
                <span className="mono-code">{activeOrg.code}</span>
                <strong>กำลังดูภาพรวมของ: {activeOrg.nameTh}</strong>
              </>
            )}
          </div>

          <div className="context-toolbar">
            <label htmlFor="tw-sel" className="sr-only">
              ช่วงเวลาคำนวณยอดเงิน
            </label>
            <select
              id="tw-sel"
              value={timeWindow}
              onChange={(e) =>
                setTimeWindow(e.target.value as TimeWindowFilter)
              }
              aria-label="ช่วงเวลาคำนวณยอดเงิน"
            >
              <option value="all_time">ยอดเงิน: ตลอดอายุงาน</option>
              <option value="last_30d">ยอดเงิน: 30 วันล่าสุด</option>
              <option value="last_7d">ยอดเงิน: 7 วันล่าสุด</option>
            </select>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenPublicPreview(selectedEvent?.id)}
            >
              ดูหน้าเว็บฝั่งลูกค้า
            </button>

            {canManageEventConfig && (
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
                <span>สร้างงานวิ่งใหม่</span>
              </button>
            )}
          </div>
        </header>

        {/* Special States (Loading / Error / Permission Denied) */}
        {simulatedState === 'loading' ? (
          <section
            className="skeleton-stage"
            aria-busy="true"
            aria-label="กำลังโหลดข้อมูล"
          >
            <div className="skeleton-banner-note">
              โหมดทดสอบสถานะกำลังโหลด (Skeleton): รักษาโครงสร้างหน้าจอโดยไม่แสดงตัวเลขศูนย์ปลอม
            </div>
            <div className="skeleton-block skel-lg" />
            <div className="skeleton-block skel-md" />
            <div className="skeleton-block skel-table" />
          </section>
        ) : simulatedState === 'permission_denied' ||
          isSectionForbiddenByRole ? (
          <section className="permission-denied-panel" role="alert">
            <IconLock size={28} />
            <h1>บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้</h1>
            <p>
              คุณเข้าใช้งานในบทบาท <strong>{roleNameMap[role]}</strong> ของ{' '}
              <strong>{activeOrg.nameTh}</strong> หากต้องการสิทธิ์เพิ่มเติม
              กรุณาติดต่อเจ้าขององค์กร ({activeOrg.contactEmail})
            </p>
            <div className="cta-inline-row">
              {simulatedState === 'permission_denied' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onClearSimulatedState}
                >
                  กลับสู่สถานะปกติ
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
                ไปหน้าที่ได้รับอนุญาต
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
                    <strong>ดึงสถานะคิวส่งอีเมลแจ้งเตือนไม่สำเร็จชั่วคราว:</strong>{' '}
                    คุณยังจัดการผู้สมัครและดูยอดเงินในส่วนอื่นของหน้านี้ได้ตามปกติ
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClearSimulatedState}
                  >
                    ลองโหลดใหม่
                  </button>
                </div>
              </div>
            )}

            {exportBannerText && (
              <div className="success-callout" role="status">
                <IconCheckCircle size={18} />
                <div className="callout-flex">
                  <span>{exportBannerText}</span>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => setExportBannerText(null)}
                  >
                    ปิดข้อความ
                  </button>
                </div>
              </div>
            )}

            {/* ================= 1. ORG OVERVIEW ================= */}
            {activeSection === 'org_overview' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>หน้าแรกผู้จัดงาน (ภาพรวมองค์กร)</h1>
                  <p className="page-purpose-desc">
                    หน้านี้ใช้ดูงานด่วนที่ต้องทำทันที ตรวจสรุปผู้สมัครและยอดโอนเงินรวมทุกงาน
                    และกดเข้าไปจัดการงานวิ่งแต่ละรายการ
                  </p>
                </div>

                {accessibleOrgEvents.length === 0 ? (
                  <div className="empty-state-box">
                    <h2>องค์กรนี้ยังไม่มีงานวิ่ง</h2>
                    <p>
                      เริ่มต้นผูกบัญชีรับเงินขององค์กรให้พร้อม แล้วสร้างงานวิ่งแบบร่างแรกเพื่อกำหนดระยะทางและราคา
                    </p>
                    <div className="cta-inline-row">
                      {canManageEventConfig && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            onSelectSection('org_events');
                            setShowNewDraftForm(true);
                          }}
                        >
                          <IconPlus size={15} />
                          <span>สร้างงานวิ่งแรกขององค์กร</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => onSelectSection('org_team_settings')}
                      >
                        ตรวจสถานะบัญชีรับเงิน
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Zone 1: Action Needed */}
                    <section
                      className="action-queue-panel"
                      aria-label="สิ่งที่ต้องจัดการด่วน"
                    >
                      <div className="section-title-bar">
                        <div>
                          <h2>
                            สิ่งที่ต้องจัดการก่อน (
                            <span className="mono-num">
                              {urgentActionItems.length}
                            </span>{' '}
                            รายการ)
                          </h2>
                          <span className="muted-inline">
                            แสดงเฉพาะงานค้างที่บทบาทของคุณมีสิทธิ์กดดำเนินการได้ทันที
                          </span>
                        </div>
                      </div>

                      {urgentActionItems.length === 0 ? (
                        <p className="muted-block">
                          ไม่มีงานค้างเร่งด่วนในขณะนี้ ทุกงานอยู่ในสถานะปกติ
                        </p>
                      ) : (
                        <div className="action-queue-rows">
                          {urgentActionItems.map((item) => (
                            <div key={item.id} className="action-queue-item">
                              <div className="action-queue-text">
                                <IconAlert size={17} />
                                <div>
                                  <strong>{item.title}</strong>
                                  <p>{item.whyItMatters}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={item.action}
                              >
                                <span>{item.ctaLabel}</span>
                                <IconArrowRight size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Zone 2: Quota & Money Summary */}
                    <BibLedgerStrip
                      scopeTitle={`สรุปรวมทุกงานของ ${activeOrg.nameTh}`}
                      scopeCode={activeOrg.code}
                      metrics={orgMetrics}
                      timeWindow={timeWindow}
                      canViewFinance={canViewFinance}
                      onDrillDown={handleDrillDown}
                    />

                    {orgDrilldownRegFilter && (
                      <section
                        id="org-drilldown-source-panel"
                        className="clean-panel"
                      >
                        <div className="section-title-bar">
                          <h2>
                            รายชื่อผู้สมัครต้นทาง:{' '}
                            {orgDrilldownRegFilter === 'confirmed'
                              ? 'ยืนยันสิทธิ์แล้ว'
                              : 'กันที่นั่งรอจ่าย'}{' '}
                            (<span className="mono-num">
                              {orgScopedSourceRegistrations.length}
                            </span>{' '}
                            คน)
                          </h2>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => setOrgDrilldownRegFilter(null)}
                          >
                            ซ่อนตารางนี้
                          </button>
                        </div>
                        <div className="table-scroll">
                          <table className="ops-table">
                            <thead>
                              <tr>
                                <th>รหัสใบสมัคร / งาน</th>
                                <th>ผู้เข้าแข่งขัน</th>
                                <th>สถานะสิทธิ์</th>
                                <th>สถานะเงิน</th>
                                <th>ทางลัด</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orgScopedSourceRegistrations.map((reg) => {
                                const ev = accessibleOrgEvents.find(
                                  (e) => e.id === reg.eventId
                                );
                                return (
                                  <tr key={reg.id}>
                                    <td>
                                      <span className="mono-code">
                                        {reg.regCode}
                                      </span>
                                      <div className="muted-inline">
                                        {ev?.titleTh}
                                      </div>
                                    </td>
                                    <td>{reg.participantNameTh}</td>
                                    <td>
                                      <RegStatusBadge
                                        status={reg.registrationStatus}
                                      />
                                    </td>
                                    <td>
                                      <PaymentStatusBadge
                                        status={reg.paymentStatus}
                                      />
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => {
                                          setParticipantRegFilter(
                                            orgDrilldownRegFilter
                                          );
                                          onSelectEvent(
                                            reg.eventId,
                                            'evt_participants'
                                          );
                                        }}
                                      >
                                        เปิดในงานนี้
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* Zone 3: Events in Organization */}
                    <section className="clean-panel">
                      <div className="section-title-bar">
                        <div>
                          <h2>งานวิ่งในความดูแลของคุณ</h2>
                          <span className="muted-inline">
                            กดปุ่ม &ldquo;จัดการงานนี้&rdquo; เพื่อเข้าดูระยะราคา รายชื่อผู้สมัคร ร้านค้า หรือจุดเช็กอิน BIB
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => onSelectSection('org_events')}
                        >
                          ค้นหา / คัดลอกงานปีถัดไป
                        </button>
                      </div>

                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>ชื่องานวิ่ง</th>
                              <th>วันจัดงาน</th>
                              <th>สถานะปัจจุบัน</th>
                              <th>ผู้รับภาระค่าบริการ</th>
                              <th className="num-col">ผู้สมัครยืนยัน / โควตา</th>
                              <th>เข้าไปจัดการ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accessibleOrgEvents.map((ev) => {
                              const confirmed = orgRegistrations.filter(
                                (r) =>
                                  r.eventId === ev.id &&
                                  r.registrationStatus === 'confirmed'
                              ).length;
                              return (
                                <tr key={ev.id}>
                                  <td>
                                    <strong>{ev.titleTh}</strong>
                                    <div className="muted-inline">
                                      <span className="mono-code">{ev.code}</span>{' '}
                                      · {ev.province} · ร้านค้า{' '}
                                      {ev.products.length} รายการ
                                    </div>
                                  </td>
                                  <td className="mono-num">{ev.eventDate}</td>
                                  <td>
                                    <EventStatusBadge status={ev.status} />
                                  </td>
                                  <td>{feePolicyLabel(ev.feeBearerPolicy)}</td>
                                  <td className="num-col mono-num">
                                    <strong>{confirmed}</strong> /{' '}
                                    {ev.totalEventQuota}
                                  </td>
                                  <td>
                                    <div className="cta-inline-row">
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() =>
                                          onSelectEvent(
                                            ev.id,
                                            role === 'staff'
                                              ? 'evt_checkin_bib'
                                              : 'evt_overview'
                                          )
                                        }
                                      >
                                        จัดการงานนี้
                                      </button>
                                      {canCheckIn &&
                                        ev.status === 'published' && (
                                          <button
                                            type="button"
                                            className="btn-ghost-sm"
                                            onClick={() =>
                                              onSelectEvent(
                                                ev.id,
                                                'evt_checkin_bib'
                                              )
                                            }
                                          >
                                            เช็กอิน BIB
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
                    </section>

                    {/* Zone 4: Audit Log */}
                    <section className="clean-panel">
                      <h2>ประวัติการทำรายการล่าสุดในองค์กร</h2>
                      <div className="audit-list">
                        {auditLogs
                          .filter((l) => l.organizationId === activeOrg.id)
                          .slice(0, 5)
                          .map((log) => (
                            <div key={log.id} className="audit-row">
                              <span className="mono-code">{log.timestamp}</span>
                              <strong>{log.actorName}</strong>
                              <span className="muted-inline">
                                ({log.actorRole})
                              </span>
                              <span>{log.actionSummary}</span>
                              <code className="audit-diff">
                                {log.detailChange}
                              </code>
                            </div>
                          ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}

            {/* ================= 2. ORG EVENTS & WIZARD ================= */}
            {activeSection === 'org_events' && (
              <div className="canvas-stack">
                <div className="page-heading-row">
                  <div className="page-guide-header">
                    <h1>รายการงานวิ่งและสร้างงานใหม่</h1>
                    <p className="page-purpose-desc">
                      ใช้สร้างงานวิ่งแบบร่างใหม่ (พร้อมแจ้งขอให้ทีมช่วยผลิตเสื้อ/เหรียญได้)
                      หรือทำสำเนาโครงสร้างงานเดิมไปจัดปีถัดไปโดยไม่คัดลอกข้อมูลส่วนบุคคลผู้สมัคร
                    </p>
                  </div>
                  {canManageEventConfig && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowNewDraftForm((v) => !v)}
                    >
                      <IconPlus size={15} />
                      <span>
                        {showNewDraftForm ? 'ปิดฟอร์มสร้างงาน' : 'สร้างงานแบบร่าง'}
                      </span>
                    </button>
                  )}
                </div>

                {showNewDraftForm && canManageEventConfig && (
                  <form
                    className="clean-panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newDraftTitle.trim()) return;
                      onCreateDraftEvent({
                        orgId: activeOrg.id,
                        titleTh: newDraftTitle.trim(),
                        province: newDraftProvince.trim(),
                        eventDate: newDraftDate,
                        requestProductionHelp: requestProdHelp,
                      });
                      setNewDraftTitle('');
                      setShowNewDraftForm(false);
                    }}
                  >
                    <h2>สร้างงานวิ่งแบบร่างใหม่ (บันทึกและแก้ไขต่อได้ก่อนเปิดขาย)</h2>
                    <div className="form-grid-3">
                      <div className="form-row">
                        <label htmlFor="nd-title">ชื่องานวิ่งภาษาไทย</label>
                        <input
                          id="nd-title"
                          type="text"
                          value={newDraftTitle}
                          onChange={(e) => setNewDraftTitle(e.target.value)}
                          placeholder="เช่น ขอนแก่น ซิตี้ รัน 2027"
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="nd-prov">จังหวัด</label>
                        <input
                          id="nd-prov"
                          type="text"
                          value={newDraftProvince}
                          onChange={(e) => setNewDraftProvince(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="nd-date">วันจัดงาน (YYYY-MM-DD)</label>
                        <input
                          id="nd-date"
                          type="text"
                          className="mono-num"
                          value={newDraftDate}
                          onChange={(e) => setNewDraftDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <label
                      className="checkbox-row"
                      style={{ margin: '0.85rem 0' }}
                    >
                      <input
                        type="checkbox"
                        checked={requestProdHelp}
                        onChange={(e) => setRequestProdHelp(e.target.checked)}
                      />
                      <span>
                        ต้องการขอใบเสนอราคาให้ทีม RunEvent ช่วยออกแบบ/ผลิตเสื้อแข่งขันและเหรียญรางวัลสำหรับงานนี้ด้วย
                      </span>
                    </label>

                    <button type="submit" className="btn-primary">
                      บันทึกแบบร่างและเปิดหน้าตั้งค่างาน
                    </button>
                  </form>
                )}

                <div className="filter-bar-panel">
                  <div className="filter-field filter-search">
                    <label htmlFor="ev-q">ค้นหาชื่องานหรือรหัสงาน</label>
                    <div className="input-with-icon">
                      <IconSearch size={16} />
                      <input
                        id="ev-q"
                        type="search"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="พิมพ์ชื่องาน จังหวัด หรือรหัส..."
                      />
                    </div>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="ev-st">กรองตามสถานะ</label>
                    <select
                      id="ev-st"
                      value={eventStatusFilter}
                      onChange={(e) =>
                        setEventStatusFilter(
                          e.target.value as 'all' | EventStatus
                        )
                      }
                    >
                      <option value="all">ทุกสถานะ</option>
                      <option value="published">กำลังเปิดรับสมัคร</option>
                      <option value="draft">แบบร่าง</option>
                      <option value="in_review">รอตรวจอนุมัติ</option>
                      <option value="completed">จบงานแล้ว</option>
                      <option value="suspended">ระงับชั่วคราว</option>
                    </select>
                  </div>
                </div>

                <section className="clean-panel">
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>รหัส / ชื่องานวิ่ง</th>
                          <th>วันจัด / จังหวัด</th>
                          <th>สถานะ</th>
                          <th className="num-col">โควตารวม</th>
                          <th>การจัดการ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrgEvents.map((ev) => (
                          <tr key={ev.id}>
                            <td>
                              <span className="mono-code">{ev.code}</span>
                              <div>
                                <strong>{ev.titleTh}</strong>
                              </div>
                            </td>
                            <td>
                              <span className="mono-num">{ev.eventDate}</span> ·{' '}
                              {ev.province}
                            </td>
                            <td>
                              <EventStatusBadge status={ev.status} />
                            </td>
                            <td className="num-col mono-num">
                              {ev.totalEventQuota} คน
                            </td>
                            <td>
                              <div className="cta-inline-row">
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() =>
                                    onSelectEvent(ev.id, 'evt_overview')
                                  }
                                >
                                  เปิดจัดการ
                                </button>
                                {canManageEventConfig && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() =>
                                      onDuplicateEventWithoutPii(ev.id)
                                    }
                                  >
                                    <IconCopy size={14} />
                                    <span>คัดลอกงานไปปีหน้า (ไม่คัดลอก PII)</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 3. ORG MERCHANDISE & PRODUCTION QUOTES ================= */}
            {activeSection === 'org_merch_production' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>ร้านค้าและคำขอใบเสนอราคาผลิตเสื้อ/เหรียญขององค์กร</h1>
                  <p className="page-purpose-desc">
                    ใช้ติดตามคำสั่งซื้อของที่ระลึกจากลูกค้าทั่วไปข้ามทุกงานวิ่ง
                    และตรวจสถานะคำขอราคา/งานสั่งผลิตเสื้อและเหรียญขององค์กร
                  </p>
                </div>

                <section className="clean-panel">
                  <h2>คำขอใบเสนอราคาและงานสั่งผลิตเสื้อ/เหรียญ (Production Inquiries)</h2>
                  <p className="muted-block">
                    แยกสถานะใบเสนอราคา การอนุมัติแบบ และสถานะการผลิตออกจากกัน
                    (คำขอราคายังไม่ใช่คำสั่งเริ่มผลิตจนกว่าจะยืนยันแบบ จำนวน และเงื่อนไขชำระ)
                  </p>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>รหัสคำขอ</th>
                          <th>รายการสั่งทำ / เวอร์ชันแบบ</th>
                          <th className="num-col">สูตรคำนวณยอดผลิตสุทธิ</th>
                          <th>กำหนดรับของ</th>
                          <th>สถานะราคา & การผลิต</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionInquiries
                          .filter((q) => q.organizationId === activeOrg.id)
                          .map((rfq) => (
                            <tr key={rfq.id}>
                              <td className="mono-code">{rfq.inquiryCode}</td>
                              <td>
                                <strong>{rfq.itemType}</strong>
                                <div className="muted-inline">
                                  {rfq.artworkVersion}
                                </div>
                              </td>
                              <td className="num-col mono-num">
                                สิทธิ์สมัคร {rfq.packageEntitlementQty} + ร้านค้า{' '}
                                {rfq.addonStoreQty} + สำรอง {rfq.organizerBufferQty}{' '}
                                − มีอยู่ {rfq.existingStockDeductedQty} ={' '}
                                <strong>{rfq.netQtyToProduce} ชิ้น</strong>
                              </td>
                              <td className="mono-num">
                                {rfq.targetDeliveryDate}
                              </td>
                              <td>
                                <span className="status-pill badge-navy">
                                  <IconClock size={13} />
                                  <span>
                                    {rfq.quoteStatus === 'quoted_demo'
                                      ? 'ส่งใบเสนอราคาแล้ว'
                                      : rfq.quoteStatus === 'accepted'
                                        ? 'อนุมัติราคาแล้ว'
                                        : rfq.quoteStatus === 'submitted'
                                          ? 'ส่งคำขอราคาแล้ว'
                                          : 'ร่างคำขอราคา'}
                                  </span>
                                </span>{' '}
                                <span className="status-pill badge-amber">
                                  <IconClock size={13} />
                                  <span>
                                    {rfq.productionStatus === 'awaiting_approval'
                                      ? 'รออนุมัติแบบก่อนผลิต'
                                      : rfq.productionStatus === 'ready_to_produce'
                                        ? 'พร้อมเริ่มผลิต'
                                        : rfq.productionStatus === 'in_production'
                                          ? 'กำลังผลิต'
                                          : 'ตรวจ QC ผ่านแล้ว'}
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
                    คำสั่งซื้อสินค้าที่ระลึกข้ามทุกงานในองค์กร (
                    <span className="mono-num">{orgMerchOrders.length}</span>{' '}
                    รายการ)
                  </h2>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>รหัสออเดอร์</th>
                          <th>ผู้ซื้อ</th>
                          <th>สินค้า / ขนาด</th>
                          <th className="num-col">จำนวน (ส่งมอบแล้ว)</th>
                          <th className="num-col">ยอดชำระรวม</th>
                          <th>วิธีรับของ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgMerchOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="mono-code">{ord.merchOrderCode}</td>
                            <td>{ord.buyerName}</td>
                            <td>
                              <strong>{ord.productNameTh}</strong> (
                              {ord.variantSize})
                            </td>
                            <td className="num-col mono-num">
                              {ord.deliveredQty} / {ord.quantity} ชิ้น
                            </td>
                            <td className="num-col mono-num">
                              {formatThb(ord.totalPaidSatang, true)}
                            </td>
                            <td>
                              {ord.deliveryMethod === 'pickup_at_expo'
                                ? `รับหน้างาน (${ord.pickupToken})`
                                : 'จัดส่งไปรษณีย์'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 4. ORG FINANCE ================= */}
            {activeSection === 'org_finance' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>การเงินรวมขององค์กรและตัวจำลองค่าบริการ</h1>
                  <p className="page-purpose-desc">
                    ใช้ตรวจยอดโอนเงินเข้าบัญชีองค์กร เปรียบเทียบนโยบายผู้รับภาระค่าบริการ
                    และส่งออกรายงานกระทบยอดทางบัญชี
                  </p>
                </div>

                <BibLedgerStrip
                  scopeTitle={`บัญชีรวมระดับองค์กร: ${activeOrg.nameTh}`}
                  scopeCode={activeOrg.code}
                  metrics={orgMetrics}
                  timeWindow={timeWindow}
                  canViewFinance={canViewFinance}
                  onDrillDown={handleDrillDown}
                />

                <section className="clean-panel">
                  <h2>เครื่องคำนวณเปรียบเทียบผู้รับภาระค่าบริการ (อัตราจำลอง 5% + ฿15)</h2>
                  <div className="sim-input-bar">
                    <label htmlFor="sim-baht-slider">
                      ทดลองเลื่อนราคาค่าสมัครหน้าป้ายต่อคน:{' '}
                      <strong className="mono-num">
                        {formatThb(calcSamplePriceBaht * 100)}
                      </strong>
                    </label>
                    <input
                      id="sim-baht-slider"
                      type="range"
                      min={300}
                      max={2500}
                      step={50}
                      value={calcSamplePriceBaht}
                      onChange={(e) =>
                        setCalcSamplePriceBaht(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>นโยบายที่ผู้จัดเลือก</th>
                          <th className="num-col">ราคาหน้าป้าย</th>
                          <th className="num-col">นักวิ่งจ่ายสุทธิ</th>
                          <th className="num-col">หักค่าบริการฝั่งผู้จัด</th>
                          <th className="num-col">ผู้จัดได้รับสุทธิ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            'runner_pays',
                            'organizer_absorbs',
                            'split_50_50',
                          ] as FeeBearerPolicy[]
                        ).map((pol) => {
                          const q = calculateFeeQuote(
                            calcSamplePriceBaht * 100,
                            pol
                          );
                          return (
                            <tr key={pol}>
                              <td>
                                <strong>{feePolicyLabel(pol)}</strong>
                              </td>
                              <td className="num-col mono-num">
                                {formatThb(q.baseSatang, true)}
                              </td>
                              <td className="num-col mono-num">
                                <strong>
                                  {formatThb(q.runnerNetPaySatang, true)}
                                </strong>
                              </td>
                              <td className="num-col mono-num text-danger">
                                −{formatThb(q.organizerFeeSatang, true)}
                              </td>
                              <td className="num-col mono-num text-forest">
                                <strong>
                                  {formatThb(q.organizerNetReceiveSatang, true)}
                                </strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="finance-source-ledger" className="clean-panel">
                  <div className="section-title-bar">
                    <h2>รายการธุรกรรมและรอบโอนเงินตามตัวกรอง</h2>
                    <div className="cta-inline-row">
                      {(
                        [
                          ['all', 'รอบโอนทั้งหมด'],
                          ['payments', 'รายการรับชำระ'],
                          ['refunds', 'รายการคืนเงิน'],
                          ['payouts', 'รอบโอนสุทธิ'],
                        ] as const
                      ).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          className={
                            financeSubFilter === k
                              ? 'btn-primary'
                              : 'btn-ghost-sm'
                          }
                          onClick={() => setFinanceSubFilter(k)}
                        >
                          {lbl}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setExportBannerText(
                            `สร้างไฟล์รายงานการเงิน CSV ของ ${activeOrg.code} เรียบร้อยแล้ว`
                          )
                        }
                      >
                        <IconDownload size={15} />
                        <span>ส่งออกรายงาน CSV</span>
                      </button>
                    </div>
                  </div>

                  {(financeSubFilter === 'payments' ||
                    financeSubFilter === 'refunds') && (
                      <div
                        className="table-scroll"
                        style={{ marginBottom: '1rem' }}
                      >
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>คำสั่งซื้อ</th>
                              <th>ผู้เข้าแข่งขัน</th>
                              <th>สถานะรับเงิน</th>
                              <th className="num-col">ยอดรับชำระ</th>
                              <th>สถานะคืนเงิน</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orgRegistrations
                              .filter((r) =>
                                financeSubFilter === 'payments'
                                  ? r.paymentStatus === 'succeeded' &&
                                  isWithinTimeWindow(r.paidAt, timeWindow)
                                  : r.refundStatus !== 'none'
                              )
                              .map((r) => (
                                <tr key={r.id}>
                                  <td className="mono-code">{r.orderCode}</td>
                                  <td>{r.participantNameTh}</td>
                                  <td>
                                    <PaymentStatusBadge
                                      status={r.paymentStatus}
                                    />
                                  </td>
                                  <td className="num-col mono-num">
                                    {formatThb(
                                      r.snapshotTotalChargedSatang,
                                      true
                                    )}
                                  </td>
                                  <td>
                                    <RefundStatusBadge status={r.refundStatus} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  {(financeSubFilter === 'all' ||
                    financeSubFilter === 'payouts') && (
                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>รหัสรอบโอน</th>
                              <th>รายละเอียดงวด</th>
                              <th>กำหนดโอน</th>
                              <th className="num-col">รับชำระรวม</th>
                              <th className="num-col">หักคืนเงิน</th>
                              <th className="num-col">ยอดโอนเข้าบัญชีสุทธิ</th>
                              <th>สถานะ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payouts
                              .filter((p) => p.organizationId === activeOrg.id)
                              .map((po) => (
                                <tr key={po.id}>
                                  <td className="mono-code">{po.payoutCode}</td>
                                  <td>{po.periodLabel}</td>
                                  <td className="mono-num">{po.scheduledDate}</td>
                                  <td className="num-col mono-num">
                                    {formatThb(po.grossSucceededSatang, true)}
                                  </td>
                                  <td className="num-col mono-num text-danger">
                                    −{formatThb(po.deductedRefundSatang, true)}
                                  </td>
                                  <td className="num-col mono-num text-vermilion">
                                    <strong>
                                      {formatThb(po.netPayoutSatang, true)}
                                    </strong>
                                  </td>
                                  <td>
                                    <PayoutStatusBadge status={po.status} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </section>
              </div>
            )}

            {/* ================= 5. ORG TEAM & BANK SETTINGS ================= */}
            {activeSection === 'org_team_settings' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>ทีมงานและบัญชีรับเงินขององค์กร</h1>
                  <p className="page-purpose-desc">
                    ใช้ตรวจสถานะบัญชีธนาคารรับยอดนำส่ง และสร้างรหัสคำเชิญแบบใช้ครั้งเดียวเพื่อเชิญทีมงานเข้าดูแลเฉพาะบทบาท
                  </p>
                </div>

                <section className="clean-panel">
                  <h2>ข้อมูลองค์กรผู้จัดและบัญชีรับเงิน</h2>
                  <div className="org-settings-summary">
                    <div>
                      <p>
                        <strong>องค์กร:</strong> {activeOrg.nameTh} (
                        <span className="mono-code">{activeOrg.code}</span>)
                      </p>
                      <p>
                        <strong>บัญชีรับโอนรายได้:</strong>{' '}
                        {activeOrg.payoutBankSummary}
                      </p>
                    </div>
                    <span
                      className={`status-pill ${activeOrg.payoutReady ? 'badge-forest' : 'badge-amber'
                        }`}
                    >
                      {activeOrg.payoutReady ? (
                        <IconCheckCircle size={14} />
                      ) : (
                        <IconAlert size={14} />
                      )}
                      <span>
                        {activeOrg.payoutReady
                          ? 'บัญชีรับเงินพร้อมใช้งานแล้ว'
                          : 'รอยืนยันเอกสารบัญชีรับเงิน'}
                      </span>
                    </span>
                  </div>
                  {!canManageOrgBank && (
                    <div className="finance-restricted-note">
                      บทบาทปัจจุบันไม่อนุญาตให้แก้ไขเลขบัญชีรับเงินขององค์กร (สงวนสิทธิ์เฉพาะเจ้าขององค์กร)
                    </div>
                  )}
                </section>

                <section className="clean-panel">
                  <div className="section-title-bar">
                    <h2>รหัสคำเชิญเข้าร่วมทีม (ใช้ได้ครั้งเดียวและมีวันหมดอายุ)</h2>
                    {canManageOrgBank && (
                      <div className="cta-inline-row">
                        <select
                          aria-label="เลือกบทบาทที่จะเชิญ"
                          value={inviteRolePick}
                          onChange={(e) =>
                            setInviteRolePick(e.target.value as OrgRole)
                          }
                        >
                          <option value="staff">เจ้าหน้าที่จุดรับอุปกรณ์</option>
                          <option value="event_manager">ผู้จัดการงาน</option>
                          <option value="finance">ฝ่ายการเงิน</option>
                        </select>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            onCreateSingleUseInvite(
                              activeOrg.id,
                              inviteRolePick
                            )
                          }
                        >
                          <IconPlus size={15} />
                          <span>ออกรหัสคำเชิญใหม่</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>รหัสคำเชิญ</th>
                          <th>บทบาทที่ได้รับ</th>
                          <th>หมดอายุ</th>
                          <th>สถานะการใช้งาน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations
                          .filter((i) => i.organizationId === activeOrg.id)
                          .map((inv) => (
                            <tr key={inv.id}>
                              <td className="mono-code">{inv.inviteCode}</td>
                              <td>{roleNameMap[inv.role]}</td>
                              <td className="mono-num">{inv.expiresAt}</td>
                              <td>
                                {inv.usedByUserId ? (
                                  <span className="status-pill badge-neutral">
                                    <IconLock size={13} />
                                    <span>ถูกใช้งานแล้ว ({inv.usedByUserId})</span>
                                  </span>
                                ) : (
                                  <span className="status-pill badge-forest">
                                    <IconCheckCircle size={13} />
                                    <span>พร้อมส่งให้สมาชิกกดรับสิทธิ์</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 6. EVENT OVERVIEW & LIFECYCLE ================= */}
            {selectedEvent &&
              activeSection === 'evt_overview' &&
              eventMetrics && (
                <div className="canvas-stack">
                  <div className="page-guide-header">
                    <h1>{selectedEvent.titleTh}</h1>
                    <p className="page-purpose-desc">
                      หน้านี้แสดงความคืบหน้าของงานตามลำดับช่วงชีวิตงาน ตรวจความพร้อมก่อนเปิดขาย
                      และตั้งค่าผู้รับภาระค่าบริการ
                    </p>
                  </div>

                  {/* Clear Lifecycle Progress Guide */}
                  <div
                    className="lifecycle-stepper"
                    aria-label="ช่วงชีวิตของงานวิ่งนี้"
                  >
                    {(
                      [
                        ['1. เตรียมข้อมูลร่าง', selectedEvent.status === 'draft'],
                        [
                          '2. รอตรวจอนุมัติ',
                          selectedEvent.status === 'in_review',
                        ],
                        [
                          '3. เปิดรับสมัคร & เตรียม BIB',
                          selectedEvent.status === 'published',
                        ],
                        [
                          '4. ปิดงาน & ประกาศผล/รูป',
                          selectedEvent.status === 'completed',
                        ],
                      ] as const
                    ).map(([label, isActive], idx) => (
                      <div
                        key={idx}
                        className={`lifecycle-step ${isActive ? 'active' : ''
                          }`}
                      >
                        <strong>{label}</strong>
                      </div>
                    ))}
                  </div>

                  {selectedEvent.statusNote && (
                    <div className="status-explanation-banner">
                      <IconAlert size={17} />
                      <span>{selectedEvent.statusNote}</span>
                    </div>
                  )}

                  <BibLedgerStrip
                    scopeTitle={`สรุปเฉพาะงาน: ${selectedEvent.titleTh}`}
                    scopeCode={selectedEvent.code}
                    metrics={eventMetrics}
                    timeWindow={timeWindow}
                    canViewFinance={canViewFinance}
                    onDrillDown={handleDrillDown}
                  />

                  <div className="two-col-ops-grid">
                    <section className="clean-panel">
                      <h2>Checklist ความพร้อมก่อนเผยแพร่งาน</h2>
                      <div className="checklist-rows">
                        {selectedEvent.readinessChecks.map((chk) => (
                          <div key={chk.id} className="checklist-row">
                            <span
                              className={`status-pill ${chk.passed ? 'badge-forest' : 'badge-amber'
                                }`}
                            >
                              {chk.passed ? (
                                <IconCheckCircle size={14} />
                              ) : (
                                <IconAlert size={14} />
                              )}
                              <span>
                                {chk.passed ? 'พร้อมแล้ว' : 'ต้องจัดการ'}
                              </span>
                            </span>
                            <div>
                              <strong>{chk.label}</strong>
                              <div className="muted-inline">
                                {chk.fixTargetHint}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedEvent.status === 'draft' &&
                        canManageEventConfig && (
                          <div className="panel-footer-cta">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() =>
                                onCompleteDraftReadinessAndSubmit(
                                  selectedEvent.id
                                )
                              }
                            >
                              บันทึกข้อมูลที่ขาดและส่งตรวจอนุมัติเผยแพร่
                            </button>
                          </div>
                        )}
                    </section>

                    <section className="clean-panel">
                      <h2>ผู้รับภาระค่าบริการและภาพรวมการรับของหน้างาน</h2>
                      <div className="form-row">
                        <label htmlFor="ev-pol-sel">
                          ผู้รับภาระค่าบริการ (มีผลกับใบสมัครใหม่ทันที)
                        </label>
                        <select
                          id="ev-pol-sel"
                          value={selectedEvent.feeBearerPolicy}
                          disabled={!canManageEventConfig}
                          onChange={(e) =>
                            onUpdateFeeBearerPolicy(
                              selectedEvent.id,
                              e.target.value as FeeBearerPolicy
                            )
                          }
                        >
                          <option value="runner_pays">
                            นักวิ่งรับภาระค่าบริการ (แสดงราคาสุทธิก่อนจ่าย)
                          </option>
                          <option value="organizer_absorbs">
                            ผู้จัดรับภาระค่าบริการ (นักวิ่งจ่ายตรงราคาป้าย)
                          </option>
                          <option value="split_50_50">
                            แบ่งรับภาระคนละครึ่ง 50 / 50
                          </option>
                        </select>
                      </div>

                      <div className="ops-quick-stats">
                        <div>
                          <span className="muted-inline">
                            นักวิ่งรับเสื้อและ BIB แล้ว
                          </span>
                          <strong className="mono-num">
                            {eventMetrics.kitPickedUpCount} /{' '}
                            {eventMetrics.confirmedParticipants} คน
                          </strong>
                        </div>
                        <div>
                          <span className="muted-inline">
                            ยืนยันสิทธิ์แต่ยังไม่มีเลข BIB
                          </span>
                          <strong className="mono-num text-amber">
                            {eventMetrics.unassignedBibCount} คน
                          </strong>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}

            {/* ================= 7. EVENT PRICING, SHIRT SIZES & PRODUCTION QUOTE ================= */}
            {selectedEvent && activeSection === 'evt_pricing_quota' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>ระยะแข่งขัน ราคาตามช่วงเวลา และสรุปยอดไซส์เสื้อสั่งผลิต</h1>
                  <p className="page-purpose-desc">
                    ใช้ตรวจช่วงราคาแต่ละระยะ สต็อกเสื้อคงเหลือ และคำนวณยอดเสื้อสุทธิเพื่อส่งขอใบเสนอราคาผลิตกับทีมงานโดยไม่รวมซ้ำ
                  </p>
                </div>

                <section className="clean-panel">
                  <h2>ระยะการแข่งขันและช่วงราคา</h2>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>ระยะแข่งขัน</th>
                          <th>ปล่อยตัว / Cut-off</th>
                          <th>รหัสหน้า BIB</th>
                          <th>ช่วงราคา</th>
                          <th className="num-col">ราคาสุทธินักวิ่ง</th>
                          <th className="num-col">โควตา</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEvent.categories.map((cat) => {
                          const curTier = getCurrentTier(cat);
                          const quote = calculateFeeQuote(
                            curTier.priceSatang,
                            selectedEvent.feeBearerPolicy
                          );
                          return (
                            <tr key={cat.id}>
                              <td>
                                <strong>{cat.name}</strong>{' '}
                                <span
                                  className={`category-bib-chip tone-${cat.colorTag}`}
                                >
                                  {cat.code}
                                </span>
                              </td>
                              <td className="mono-num">
                                {cat.startTimeLocal} น. ({cat.cutoffHours} ชม.)
                              </td>
                              <td className="mono-code">{cat.bibPrefix}-xxxx</td>
                              <td>
                                {cat.priceTiers.map((t) => (
                                  <div key={t.id} className="tier-line">
                                    <span
                                      className={
                                        t.isCurrent
                                          ? 'tier-active-dot'
                                          : 'muted-inline'
                                      }
                                    >
                                      {t.label}:{' '}
                                      <span className="mono-num">
                                        {formatThb(t.priceSatang)}
                                      </span>{' '}
                                      (<span className="mono-num">{t.startsAt}</span>{' '}
                                      ถึง{' '}
                                      <span className="mono-num">{t.endsAt}</span>)
                                      {t.isCurrent ? ' [ใช้อยู่]' : ''}
                                    </span>
                                  </div>
                                ))}
                              </td>
                              <td className="num-col mono-num">
                                <strong>
                                  {formatThb(quote.runnerNetPaySatang, true)}
                                </strong>
                              </td>
                              <td className="num-col mono-num">
                                {cat.categoryQuota} คน
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="clean-panel">
                  <h2>สต็อกเสื้อตามสิทธิ์สมัครและเครื่องมือขอราคาผลิตจากยอดจริง</h2>
                  <div className="shirt-stock-strip">
                    {selectedEvent.shirtStocks.map((st) => {
                      const left = Math.max(
                        0,
                        st.total - st.reservedOrConfirmed
                      );
                      return (
                        <div key={st.size} className="shirt-size-cell">
                          <span className="shirt-size-tag">ไซส์ {st.size}</span>
                          <strong className="mono-num">
                            ว่าง {left} / {st.total}
                          </strong>
                          <span className="muted-inline mono-num">
                            จอง/ยืนยันแล้ว {st.reservedOrConfirmed} ตัว
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {canManageEventConfig &&
                    (() => {
                      const packageShirtUsed = selectedEvent.shirtStocks.reduce(
                        (s, x) => s + x.reservedOrConfirmed,
                        0
                      );
                      const addonShirtSold = selectedEvent.products
                        .filter((p) => p.categoryLabel === 'เสื้อที่ระลึก')
                        .reduce((s, p) => s + p.soldCount, 0);
                      const netToProduce = Math.max(
                        0,
                        packageShirtUsed +
                        addonShirtSold +
                        bufferShirtQty -
                        existingShirtStock
                      );

                      return (
                        <div className="production-calc-box">
                          <h3>
                            สร้างคำขอใบเสนอราคาผลิตเสื้อจากยอดตรวจสอบแล้ว (ป้องกันการนับซ้ำ)
                          </h3>
                          <div className="form-grid-3">
                            <div className="form-row">
                              <label htmlFor="buf-qty">
                                จำนวนสำรองที่ผู้จัดกำหนดเอง (ตัว)
                              </label>
                              <input
                                id="buf-qty"
                                type="text"
                                className="mono-num"
                                value={bufferShirtQty}
                                onChange={(e) =>
                                  setBufferShirtQty(
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="ex-qty">
                                หักสต็อกเสื้อที่มีอยู่แล้ว (ตัว)
                              </label>
                              <input
                                id="ex-qty"
                                type="text"
                                className="mono-num"
                                value={existingShirtStock}
                                onChange={(e) =>
                                  setExistingShirtStock(
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="rfq-dt">วันที่ต้องการรับสินค้า</label>
                              <input
                                id="rfq-dt"
                                type="text"
                                className="mono-num"
                                value={rfqTargetDate}
                                onChange={(e) =>
                                  setRfqTargetDate(e.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
                            <span className="muted-inline">
                              สูตรยอดผลิตสุทธิ: สิทธิ์สมัคร{' '}
                              <strong className="mono-num">
                                {packageShirtUsed}
                              </strong>{' '}
                              + ซื้อเพิ่มหน้าร้าน{' '}
                              <strong className="mono-num">
                                {addonShirtSold}
                              </strong>{' '}
                              + สำรอง{' '}
                              <strong className="mono-num">
                                {bufferShirtQty}
                              </strong>{' '}
                              − สต็อกเดิม{' '}
                              <strong className="mono-num">
                                {existingShirtStock}
                              </strong>{' '}
                              ={' '}
                              <strong className="mono-num text-vermilion">
                                {netToProduce} ตัว
                              </strong>
                            </span>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                onCreateEventProductionQuote({
                                  orgId: activeOrg.id,
                                  eventId: selectedEvent.id,
                                  itemType: 'เสื้อแข่งขันและเสื้อที่ระลึก',
                                  packageQty: packageShirtUsed,
                                  addonQty: addonShirtSold,
                                  bufferQty: bufferShirtQty,
                                  existingStockQty: existingShirtStock,
                                  targetDeliveryDate: rfqTargetDate,
                                });
                                onSelectSection('org_merch_production');
                              }}
                            >
                              ส่งคำขอใบเสนอราคาผลิต ({netToProduce} ตัว)
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                </section>
              </div>
            )}

            {/* ================= 8. EVENT PARTICIPANTS ================= */}
            {selectedEvent && activeSection === 'evt_participants' && (
              <div className="canvas-stack">
                <div className="page-heading-row">
                  <div className="page-guide-header">
                    <h1>รายชื่อผู้สมัครวิ่ง ({selectedEvent.titleTh})</h1>
                    <p className="page-purpose-desc">
                      ค้นหาผู้สมัคร ตรวจแยกสถานะสิทธิ์/การชำระ/การรับของ ดูผู้สั่งซื้อแยกจากผู้วิ่ง
                      และส่งออกไฟล์รายชื่อตามตัวกรอง
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setExportBannerText(
                        `สร้างไฟล์รายชื่อผู้สมัคร CSV จำนวน ${eventParticipants.length} คน ตามตัวกรองเรียบร้อยแล้ว`
                      )
                    }
                  >
                    <IconDownload size={15} />
                    <span>
                      ส่งออกรายชื่อ ({eventParticipants.length} คน)
                    </span>
                  </button>
                </div>

                <div className="filter-bar-panel">
                  <div className="filter-field filter-search">
                    <label htmlFor="p-search">
                      ค้นหาชื่อ รหัสใบสมัคร หรือเลข BIB
                    </label>
                    <div className="input-with-icon">
                      <IconSearch size={16} />
                      <input
                        id="p-search"
                        type="search"
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        placeholder="เช่น กานต์พิชชา, REG-2611, A-0101..."
                      />
                    </div>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="p-cat">ระยะทาง</label>
                    <select
                      id="p-cat"
                      value={participantCatFilter}
                      onChange={(e) => setParticipantCatFilter(e.target.value)}
                    >
                      <option value="all">ทุกระยะทาง</option>
                      {selectedEvent.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="p-st">สถานะสิทธิ์</label>
                    <select
                      id="p-st"
                      value={participantRegFilter}
                      onChange={(e) =>
                        setParticipantRegFilter(
                          e.target.value as 'all' | RegistrationStatus
                        )
                      }
                    >
                      <option value="all">ทุกสถานะสิทธิ์</option>
                      <option value="confirmed">ยืนยันสิทธิ์แล้ว</option>
                      <option value="pending_payment">กันที่นั่งรอจ่าย</option>
                      <option value="cancelled">ยกเลิกสิทธิ์</option>
                    </select>
                  </div>
                </div>

                {eventParticipants.length === 0 ? (
                  <div className="empty-state-box">
                    <h2>ไม่พบผู้สมัครตามตัวกรอง</h2>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setParticipantSearch('');
                        setParticipantCatFilter('all');
                        setParticipantRegFilter('all');
                      }}
                    >
                      ล้างตัวกรองทั้งหมด
                    </button>
                  </div>
                ) : (
                  <div className="participants-master-detail">
                    <div className="clean-panel">
                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>รหัสใบสมัคร</th>
                              <th>ผู้เข้าแข่งขัน / เสื้อ</th>
                              <th>ระยะ</th>
                              <th>สถานะสิทธิ์</th>
                              <th>สถานะเงิน</th>
                              <th>BIB</th>
                              <th>รับอุปกรณ์</th>
                              <th>ข้อมูล</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventParticipants.map((reg) => {
                              const cat = selectedEvent.categories.find(
                                (c) => c.id === reg.categoryId
                              );
                              return (
                                <tr
                                  key={reg.id}
                                  className={
                                    inspectedReg?.id === reg.id
                                      ? 'row-highlighted'
                                      : ''
                                  }
                                >
                                  <td className="mono-code">{reg.regCode}</td>
                                  <td>
                                    <strong>{reg.participantNameTh}</strong>
                                    <div className="muted-inline">
                                      เสื้อไซส์ <strong>{reg.shirtSize}</strong>
                                    </div>
                                  </td>
                                  <td>{cat?.code}</td>
                                  <td>
                                    <RegStatusBadge
                                      status={reg.registrationStatus}
                                    />
                                  </td>
                                  <td>
                                    <PaymentStatusBadge
                                      status={reg.paymentStatus}
                                    />
                                  </td>
                                  <td className="mono-code">
                                    {reg.bibNumber ?? '—'}
                                  </td>
                                  <td>
                                    <FulfillmentStatusBadge
                                      status={reg.fulfillmentStatus}
                                    />
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="btn-ghost-sm"
                                      onClick={() => setInspectedRegId(reg.id)}
                                    >
                                      เปิดดู
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {inspectedReg && (
                      <aside className="participant-inspector">
                        <div className="section-title-bar">
                          <h2>รายละเอียด {inspectedReg.regCode}</h2>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => setInspectedRegId(null)}
                          >
                            ปิด
                          </button>
                        </div>
                        <dl className="inspector-dl">
                          <dt>ผู้เข้าแข่งขันจริง (Participant)</dt>
                          <dd>
                            {inspectedReg.participantNameTh} (
                            {inspectedReg.participantNameEn})
                          </dd>
                          <dt>ผู้สั่งซื้อ/จ่ายเงิน (Buyer)</dt>
                          <dd>{inspectedReg.buyerName}</dd>
                          <dt>ช่องทางติดต่อ</dt>
                          <dd>
                            {role === 'staff' ? (
                              <span className="muted-inline">
                                ซ่อนอีเมลและเบอร์ติดต่อฉุกเฉินตามสิทธิ์เจ้าหน้าที่หน้างาน
                              </span>
                            ) : (
                              <>
                                {inspectedReg.email} · {inspectedReg.phoneMasked}
                                <div>ฉุกเฉิน: {inspectedReg.emergencyContact}</div>
                              </>
                            )}
                          </dd>
                          <dt>กติกาที่ยอมรับ</dt>
                          <dd>
                            ฉบับ <code>{inspectedReg.acceptedRulesVersion}</code>{' '}
                            · การตลาด:{' '}
                            {inspectedReg.marketingConsent
                              ? 'ยินยอม'
                              : 'ไม่ยินยอม'}
                          </dd>
                        </dl>
                        {inspectedReg.registrationStatus ===
                          'pending_payment' && (
                            <div className="subtle-empty-note">
                              รายการอยู่ระหว่างกันโควตารอผู้สมัครชำระเงิน ระบบจะเปลี่ยนเป็นยืนยันสิทธิ์อัตโนมัติเมื่อผู้ให้บริการรับชำระยืนยันยอด
                            </div>
                          )}
                      </aside>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================= 9. EVENT STOREFRONT & MERCH MANAGEMENT ================= */}
            {selectedEvent && activeSection === 'evt_storefront' && (
              <div className="canvas-stack">
                <div className="page-heading-row">
                  <div className="page-guide-header">
                    <h1>ร้านค้าและสินค้าที่ระลึกของงาน ({selectedEvent.code})</h1>
                    <p className="page-purpose-desc">
                      จัดการเสื้อ/เหรียญที่ระลึกสำหรับขายให้นักวิ่งและลูกค้าทั่วไป
                      โดยระบุรูปแบบผู้ขายและผู้รับผิดชอบจัดส่งอย่างชัดเจน
                    </p>
                  </div>
                  {canManageEventConfig && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowAddProductForm((v) => !v)}
                    >
                      <IconPlus size={15} />
                      <span>
                        {showAddProductForm
                          ? 'ปิดฟอร์มเพิ่มสินค้า'
                          : 'เพิ่มสินค้าหน้าร้าน'}
                      </span>
                    </button>
                  )}
                </div>

                {showAddProductForm && canManageEventConfig && (
                  <form
                    className="clean-panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newProdName.trim()) return;
                      onAddEventProduct({
                        eventId: selectedEvent.id,
                        nameTh: newProdName.trim(),
                        categoryLabel: newProdCat,
                        saleMode: newProdSaleMode,
                        serviceModel: newProdService,
                        priceBaht: newProdPrice,
                        stockOrCeiling: newProdCap,
                      });
                      setNewProdName('');
                      setShowAddProductForm(false);
                    }}
                  >
                    <h2>เพิ่มรายการสินค้าลงหน้าร้านเฉพาะงาน</h2>
                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="np-name">ชื่อสินค้าภาษาไทย</label>
                        <input
                          id="np-name"
                          type="text"
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                          placeholder="เช่น หมวกวิ่งระบายอากาศรุ่นที่ระลึก"
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="np-svc">รูปแบบบริการและผู้รับผิดชอบ</label>
                        <select
                          id="np-svc"
                          value={newProdService}
                          onChange={(e) =>
                            setNewProdService(
                              e.target.value as SellerServiceModel
                            )
                          }
                        >
                          <option value="organizer_self_sell">
                            ผู้จัดมีสินค้าและจัดส่งเอง
                          </option>
                          <option value="runevent_produce_bulk">
                            ให้ RunEvent ผลิตส่งล็อตใหญ่ให้ผู้จัด
                          </option>
                          <option value="runevent_full_service">
                            ให้ RunEvent ดูแลครบ (พรีออเดอร์ + ผลิต + จัดส่ง)
                          </option>
                        </select>
                      </div>
                    </div>

                    <div
                      className="form-grid-3"
                      style={{ marginTop: '0.65rem' }}
                    >
                      <div className="form-row">
                        <label htmlFor="np-cat">หมวดสินค้า</label>
                        <select
                          id="np-cat"
                          value={newProdCat}
                          onChange={(e) =>
                            setNewProdCat(
                              e.target.value as
                              | 'เสื้อที่ระลึก'
                              | 'เหรียญที่ระลึก'
                              | 'อุปกรณ์เสริม'
                            )
                          }
                        >
                          <option value="เสื้อที่ระลึก">เสื้อที่ระลึก</option>
                          <option value="เหรียญที่ระลึก">เหรียญที่ระลึก</option>
                          <option value="อุปกรณ์เสริม">อุปกรณ์เสริม</option>
                        </select>
                      </div>
                      <div className="form-row">
                        <label htmlFor="np-mode">รูปแบบการขาย</label>
                        <select
                          id="np-mode"
                          value={newProdSaleMode}
                          onChange={(e) =>
                            setNewProdSaleMode(
                              e.target.value as 'ready_stock' | 'preorder'
                            )
                          }
                        >
                          <option value="preorder">เปิดรับพรีออเดอร์</option>
                          <option value="ready_stock">สินค้าพร้อมขาย</option>
                        </select>
                      </div>
                      <div className="form-row">
                        <label htmlFor="np-price">ราคาต่อชิ้น (บาท)</label>
                        <input
                          id="np-price"
                          type="text"
                          className="mono-num"
                          value={newProdPrice}
                          onChange={(e) =>
                            setNewProdPrice(Number(e.target.value) || 350)
                          }
                        />
                      </div>
                    </div>

                    <div
                      className="cta-inline-row"
                      style={{ marginTop: '0.85rem' }}
                    >
                      <label htmlFor="np-cap" className="muted-inline">
                        เพดานจำนวนขาย:
                      </label>
                      <input
                        id="np-cap"
                        type="text"
                        className="mono-num bib-input"
                        value={newProdCap}
                        onChange={(e) =>
                          setNewProdCap(Number(e.target.value) || 50)
                        }
                      />
                      <button type="submit" className="btn-primary">
                        บันทึกเปิดขายในหน้าร้านงานนี้
                      </button>
                    </div>
                  </form>
                )}

                <section className="clean-panel">
                  <h2>รายการสินค้าที่เปิดขายในหน้าร้านงานนี้</h2>
                  {selectedEvent.products.length === 0 ? (
                    <p className="muted-block">
                      ยังไม่มีสินค้าหน้าร้านสำหรับงานนี้ กดปุ่มเพิ่มสินค้าด้านบนเพื่อเปิดขายได้ทันที
                    </p>
                  ) : (
                    <div className="table-scroll">
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>SKU / ชื่อสินค้า</th>
                            <th>รูปแบบบริการ</th>
                            <th>สถานะขาย</th>
                            <th className="num-col">ราคา</th>
                            <th className="num-col">ขายแล้ว / เพดาน</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEvent.products.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <span className="mono-code">{p.sku}</span>
                                <div>
                                  <strong>{p.nameTh}</strong>
                                </div>
                              </td>
                              <td>{sellerModelLabel(p.serviceModel)}</td>
                              <td>
                                {p.saleMode === 'ready_stock'
                                  ? 'พร้อมขาย'
                                  : `พรีออเดอร์ (ขั้นต่ำ ${p.preorderMinQty ?? 20})`}
                              </td>
                              <td className="num-col mono-num">
                                {formatThb(p.priceSatang)}
                              </td>
                              <td className="num-col mono-num">
                                <strong>{p.soldCount}</strong> /{' '}
                                {p.stockOrCeiling}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ================= 10. EVENT CHECK-IN BIB & MERCH HANDOVER ================= */}
            {selectedEvent && activeSection === 'evt_checkin_bib' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>จุดเช็กอินรับ BIB และส่งมอบสินค้าหน้างาน (รองรับมือถือ)</h1>
                  <p className="page-purpose-desc">
                    แยกการเช็กอินรับเสื้อ+BIB ตามสิทธิ์ผู้สมัคร ออกจากจุดส่งมอบสินค้าซื้อเพิ่ม/ลูกค้าทั่วไป
                    พร้อมป้องกันการกดรับซ้ำ
                  </p>
                </div>

                <div
                  className="pill-tabs-bar"
                  role="tablist"
                  aria-label="เลือกประเภทการส่งมอบหน้างาน"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={handoverTab === 'race_bib'}
                    className={`pill-tab ${handoverTab === 'race_bib' ? 'active' : ''
                      }`}
                    onClick={() => {
                      setHandoverTab('race_bib');
                      setCheckinFeedback(null);
                    }}
                  >
                    1. จ่าย BIB & เสื้อตามสิทธิ์สมัคร ({checkinCandidates.length})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={handoverTab === 'merch_pickup'}
                    className={`pill-tab ${handoverTab === 'merch_pickup' ? 'active' : ''
                      }`}
                    onClick={() => {
                      setHandoverTab('merch_pickup');
                      setCheckinFeedback(null);
                    }}
                  >
                    2. จ่ายสินค้าหน้าร้าน / รับบางส่วน ({eventMerchOrders.length})
                  </button>
                </div>

                <div className="filter-bar-panel">
                  <div className="filter-field filter-search">
                    <label htmlFor="scan-box">
                      {handoverTab === 'race_bib'
                        ? 'สแกน/พิมพ์รหัส QR Token นักวิ่ง หรือเลข BIB / ชื่อ'
                        : 'สแกน/พิมพ์รหัสรับสินค้าหน้าร้าน (PICK-SHP-...) หรือชื่อผู้ซื้อ'}
                    </label>
                    <div className="input-with-icon">
                      <IconQr size={16} />
                      <input
                        id="scan-box"
                        type="search"
                        value={checkinQuery}
                        onChange={(e) => setCheckinQuery(e.target.value)}
                        placeholder={
                          handoverTab === 'race_bib'
                            ? 'เช่น TKN-DS26-9F3A1C หรือ A-0101...'
                            : 'เช่น PICK-SHP-501 หรือ ปรมินทร์...'
                        }
                      />
                    </div>
                  </div>
                </div>

                {checkinFeedback && (
                  <div
                    className={
                      checkinFeedback.tone === 'ok'
                        ? 'success-callout'
                        : 'error-callout'
                    }
                    role="status"
                  >
                    {checkinFeedback.tone === 'ok' ? (
                      <IconCheckCircle size={17} />
                    ) : (
                      <IconAlert size={17} />
                    )}
                    <span>{checkinFeedback.text}</span>
                  </div>
                )}

                {handoverTab === 'race_bib' ? (
                  <div className="checkin-mobile-list">
                    {checkinCandidates.map((reg) => {
                      const cat = selectedEvent.categories.find(
                        (c) => c.id === reg.categoryId
                      );
                      const draftBib =
                        bibDraftMap[reg.id] ??
                        reg.bibNumber ??
                        `${cat?.bibPrefix ?? 'A'}-0109`;
                      const alreadyPicked =
                        reg.fulfillmentStatus === 'kit_picked_up';
                      const eligible = reg.registrationStatus === 'confirmed';

                      return (
                        <article key={reg.id} className="checkin-card-row">
                          <div className="checkin-row-top">
                            <span className="mono-code">
                              {reg.qrCheckInToken}
                            </span>
                            <RegStatusBadge status={reg.registrationStatus} />
                            <FulfillmentStatusBadge
                              status={reg.fulfillmentStatus}
                            />
                          </div>

                          <div className="checkin-row-body">
                            <div>
                              <h2>{reg.participantNameTh}</h2>
                              <p className="muted-block">
                                ระยะ{' '}
                                <span
                                  className={`category-bib-chip tone-${cat?.colorTag ?? 'navy'
                                    }`}
                                >
                                  <strong>{cat?.code}</strong>
                                </span>{' '}
                                · เสื้อสิทธิ์สมัครไซส์{' '}
                                <strong className="shirt-highlight">
                                  {reg.shirtSize}
                                </strong>
                              </p>
                              {reg.fulfillmentUpdatedBy && (
                                <p className="muted-inline">
                                  ส่งมอบโดย {reg.fulfillmentUpdatedBy} เมื่อ{' '}
                                  {reg.fulfillmentUpdatedAt}
                                </p>
                              )}
                            </div>

                            <div className="checkin-controls">
                              <div className="bib-assign-inline">
                                <label htmlFor={`bib-${reg.id}`}>
                                  เลข BIB (ห้ามซ้ำในงานนี้):
                                </label>
                                <div className="cta-inline-row">
                                  <input
                                    id={`bib-${reg.id}`}
                                    type="text"
                                    className="mono-code bib-input"
                                    value={draftBib}
                                    disabled={!eligible || alreadyPicked}
                                    onChange={(e) =>
                                      setBibDraftMap((prev) => ({
                                        ...prev,
                                        [reg.id]: e.target.value.toUpperCase(),
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={!eligible || alreadyPicked}
                                    onClick={() => {
                                      const res = onAssignBibNumber(
                                        reg.id,
                                        draftBib
                                      );
                                      setCheckinFeedback({
                                        tone: res.ok ? 'ok' : 'err',
                                        text: res.ok
                                          ? `บันทึกเลข BIB ${draftBib} สำเร็จ`
                                          : res.error ?? 'กำหนด BIB ไม่สำเร็จ',
                                      });
                                    }}
                                  >
                                    บันทึก BIB
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="btn-primary"
                                disabled={!eligible || !reg.bibNumber}
                                onClick={() => {
                                  const res = onConfirmKitPickup(reg.id);
                                  setCheckinFeedback({
                                    tone: res.ok ? 'ok' : 'err',
                                    text: res.ok
                                      ? `ยืนยันจ่ายเสื้อ ${reg.shirtSize} + BIB ${reg.bibNumber} ให้ ${reg.participantNameTh} สำเร็จ`
                                      : res.error ?? 'ป้องกันการรับซ้ำ',
                                  });
                                }}
                              >
                                {alreadyPicked
                                  ? 'รับแล้ว (กดเพื่อทดสอบป้องกันรับซ้ำ)'
                                  : !reg.bibNumber
                                    ? 'กรุณาบันทึกเลข BIB ก่อนส่งมอบ'
                                    : `ยืนยันจ่ายเสื้อ ${reg.shirtSize} + BIB ${reg.bibNumber}`}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="checkin-mobile-list">
                    {eventMerchOrders.map((ord) => (
                      <article key={ord.id} className="checkin-card-row">
                        <div className="checkin-row-top">
                          <span className="mono-code">{ord.pickupToken}</span>
                          <span className="mono-code">
                            {ord.merchOrderCode}
                          </span>
                          <span className="status-pill badge-navy">
                            <IconBag size={13} />
                            <span>
                              ส่งมอบแล้ว{' '}
                              <span className="mono-num">
                                {ord.deliveredQty}/{ord.quantity}
                              </span>{' '}
                              ชิ้น
                            </span>
                          </span>
                        </div>
                        <div className="checkin-row-body">
                          <div>
                            <h2>{ord.buyerName}</h2>
                            <p className="muted-block">
                              {ord.productNameTh} · ขนาด{' '}
                              <strong>{ord.variantSize}</strong> (ไม่สร้างสถานะเช็กอินวิ่ง)
                            </p>
                          </div>
                          <div className="cta-inline-row">
                            {ord.quantity > 1 &&
                              ord.deliveredQty < ord.quantity && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    const res = onConfirmMerchHandover(
                                      ord.id,
                                      'partial_one'
                                    );
                                    setCheckinFeedback({
                                      tone: res.ok ? 'ok' : 'err',
                                      text: res.message,
                                    });
                                  }}
                                >
                                  บันทึกรับบางส่วน (+1 ชิ้น)
                                </button>
                              )}
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                const res = onConfirmMerchHandover(
                                  ord.id,
                                  'complete_all'
                                );
                                setCheckinFeedback({
                                  tone: res.ok ? 'ok' : 'err',
                                  text: res.message,
                                });
                              }}
                            >
                              {ord.deliveredQty >= ord.quantity
                                ? 'รับสินค้าครบแล้ว (ทดสอบป้องกันจ่ายซ้ำ)'
                                : 'ยืนยันส่งมอบสินค้าครบจำนวน'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= 11. EVENT FINANCE & REFUNDS ================= */}
            {selectedEvent &&
              activeSection === 'evt_finance' &&
              eventMetrics && (
                <div className="canvas-stack">
                  <div className="page-guide-header">
                    <h1>รายรับและคำขอคืนเงินของงาน ({selectedEvent.code})</h1>
                    <p className="page-purpose-desc">
                      ตรวจรายการชำระระดับคำสั่งซื้อ และอนุมัติหรือปฏิเสธคำขอคืนเงินโดยเก็บเหตุผลไว้ตรวจสอบย้อนหลังเสมอ
                    </p>
                  </div>

                  <BibLedgerStrip
                    scopeTitle={`บัญชีเฉพาะงาน: ${selectedEvent.titleTh}`}
                    scopeCode={selectedEvent.code}
                    metrics={eventMetrics}
                    timeWindow={timeWindow}
                    canViewFinance={canViewFinance}
                    onDrillDown={handleDrillDown}
                  />

                  <section id="finance-source-ledger" className="clean-panel">
                    <div className="section-title-bar">
                      <h2>รายการธุรกรรมค่าสมัครและคำขอคืนเงิน</h2>
                      <div className="cta-inline-row">
                        {(
                          [
                            ['all', 'ทั้งหมด'],
                            ['payments', 'ชำระสำเร็จ'],
                            ['refunds', 'ขอคืน/คืนแล้ว'],
                            ['payouts', 'รายการคิดยอดโอน'],
                          ] as const
                        ).map(([k, lbl]) => (
                          <button
                            key={k}
                            type="button"
                            className={
                              financeSubFilter === k
                                ? 'btn-primary'
                                : 'btn-ghost-sm'
                            }
                            onClick={() => setFinanceSubFilter(k)}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="table-scroll">
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>คำสั่งซื้อ / ใบสมัคร</th>
                            <th>ผู้เข้าแข่งขัน</th>
                            <th>สถานะเงิน</th>
                            <th className="num-col">ยอดชำระสุทธิ</th>
                            <th className="num-col">ค่าบริการระบบ</th>
                            <th>สถานะคืนเงิน & เหตุผล</th>
                            <th>การอนุมัติ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgRegistrations
                            .filter((r) => r.eventId === selectedEvent.id)
                            .filter((r) => {
                              if (financeSubFilter === 'payments') {
                                return (
                                  r.paymentStatus === 'succeeded' &&
                                  isWithinTimeWindow(r.paidAt, timeWindow)
                                );
                              }
                              if (financeSubFilter === 'refunds') {
                                return r.refundStatus !== 'none';
                              }
                              if (financeSubFilter === 'payouts') {
                                return (
                                  r.paymentStatus === 'succeeded' &&
                                  isWithinTimeWindow(r.paidAt, timeWindow)
                                );
                              }
                              return true;
                            })
                            .map((reg) => (
                              <tr key={reg.id}>
                                <td>
                                  <div className="mono-code">
                                    {reg.orderCode}
                                  </div>
                                  <small className="mono-code">
                                    {reg.regCode}
                                  </small>
                                </td>
                                <td>{reg.participantNameTh}</td>
                                <td>
                                  <PaymentStatusBadge
                                    status={reg.paymentStatus}
                                  />
                                </td>
                                <td className="num-col mono-num">
                                  {formatThb(
                                    reg.snapshotTotalChargedSatang,
                                    true
                                  )}
                                </td>
                                <td className="num-col mono-num">
                                  {formatThb(
                                    reg.snapshotPlatformFeeSatang,
                                    true
                                  )}
                                </td>
                                <td>
                                  <RefundStatusBadge
                                    status={reg.refundStatus}
                                  />
                                  {reg.refundReason && (
                                    <div className="muted-inline">
                                      {reg.refundReason}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {reg.refundStatus === 'requested' ? (
                                    <div className="cta-inline-row">
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() =>
                                          onResolveRefundRequest(
                                            reg.id,
                                            'approve_succeed',
                                            'อนุมัติคืนค่าสมัครตามเอกสารรับรอง'
                                          )
                                        }
                                      >
                                        อนุมัติคืน ({formatThb(reg.snapshotBaseSatang)})
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-ghost-sm"
                                        onClick={() =>
                                          onResolveRefundRequest(
                                            reg.id,
                                            'reject',
                                            'ไม่เข้าเงื่อนไขการคืนเงินของงาน'
                                          )
                                        }
                                      >
                                        ปฏิเสธ
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="muted-inline">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              )}
          </>
        )}
      </main>
    </div>
  );
};
