import React, { useEffect, useState } from 'react';
import {
  DEMO_ORGANIZATIONS,
  DEMO_USERS,
  INITIAL_AUDIT_LOGS,
  INITIAL_EVENTS,
  INITIAL_PAYOUTS,
  INITIAL_REGISTRATIONS,
} from './data/mockData';
import {
  AuditLogEntry,
  DemoUser,
  FeeBearerPolicy,
  RaceEvent,
  RegistrationRecord,
  SimulatedUiState,
} from './types';
import { calculateFeeQuote, getCurrentTier } from './utils/pricing';
import {
  IconBib,
  IconBuilding,
  IconFlag,
  IconLock,
  IconSwitch,
} from './components/Icons';
import { LoginView } from './components/LoginView';
import {
  OrganizerDashboardView,
  OrgSection,
} from './components/OrganizerDashboardView';
import { PublicEventsView } from './components/PublicEventsView';

type AppSurface = 'dashboard' | 'public_events' | 'login';

const STORAGE_KEY = 'runevent_demo_mockup_v1';

interface PersistedMockState {
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  auditLogs: AuditLogEntry[];
}

function loadInitialMockState(): PersistedMockState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedMockState;
      if (
        Array.isArray(parsed.events) &&
        Array.isArray(parsed.registrations) &&
        Array.isArray(parsed.auditLogs)
      ) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage read issues in restricted browsers
  }
  return {
    events: INITIAL_EVENTS,
    registrations: INITIAL_REGISTRATIONS,
    auditLogs: INITIAL_AUDIT_LOGS,
  };
}

export const App: React.FC = () => {
  const [mockState, setMockState] = useState<PersistedMockState>(
    loadInitialMockState
  );
  const [surface, setSurface] = useState<AppSurface>('dashboard');
  const [currentUser, setCurrentUser] = useState<DemoUser | null>(
    DEMO_USERS[0]
  );
  const [activeOrgId, setActiveOrgId] = useState<string>('org-lanna');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeOrgSection, setActiveOrgSection] =
    useState<OrgSection>('org_overview');
  const [simulatedState, setSimulatedState] =
    useState<SimulatedUiState>('normal');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mockState));
    } catch {
      // Ignore quota errors
    }
  }, [mockState]);

  const appendAudit = (
    orgId: string,
    actionSummary: string,
    detailChange: string,
    eventId?: string
  ) => {
    const actorName = currentUser?.fullNameTh ?? 'ผู้ใช้งานสาธิต';
    const actorRole =
      currentUser?.kind === 'organizer' ? 'ทีมผู้จัดงาน' : 'นักวิ่ง';
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}`,
      organizationId: orgId,
      eventId,
      timestamp: '2026-11-17 08:35',
      actorName,
      actorRole,
      actionSummary,
      detailChange,
    };
    setMockState((prev) => ({
      ...prev,
      auditLogs: [entry, ...prev.auditLogs],
    }));
  };

  const handleSelectDemoUser = (user: DemoUser, defaultOrgId?: string) => {
    setCurrentUser(user);
    setSimulatedState('normal');
    if (user.kind === 'organizer') {
      const targetOrg =
        defaultOrgId ?? user.memberships[0]?.organizationId ?? 'org-lanna';
      const membership = user.memberships.find(
        (m) => m.organizationId === targetOrg
      );
      setActiveOrgId(targetOrg);
      if (membership?.role === 'staff') {
        const firstAssigned = membership.assignedEventIds?.[0] ?? null;
        setActiveEventId(firstAssigned);
        setActiveOrgSection(
          firstAssigned ? 'evt_checkin_bib' : 'org_overview'
        );
      } else {
        setActiveEventId(null);
        setActiveOrgSection('org_overview');
      }
      setSurface('dashboard');
    } else {
      setSurface('public_events');
    }
  };

  const handleResetDemoData = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setMockState({
      events: INITIAL_EVENTS,
      registrations: INITIAL_REGISTRATIONS,
      auditLogs: INITIAL_AUDIT_LOGS,
    });
    setSimulatedState('normal');
  };

  const handleCreateDemoRegistration = (payload: {
    eventId: string;
    categoryId: string;
    buyerName: string;
    participantNameTh: string;
    participantNameEn: string;
    shirtSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL';
    marketingConsent: boolean;
    simulateImmediateWebhook: boolean;
  }): RegistrationRecord => {
    const ev = mockState.events.find((e) => e.id === payload.eventId)!;
    const cat = ev.categories.find((c) => c.id === payload.categoryId)!;
    const tier = getCurrentTier(cat);
    const quote = calculateFeeQuote(tier.priceSatang, ev.feeBearerPolicy);

    const seq = mockState.registrations.length + 101;
    const regCode = `REG-2611-${seq}`;
    const orderCode = `ORD-89${seq}`;
    const tokenSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();

    const newRecord: RegistrationRecord = {
      id: `reg-dyn-${Date.now()}`,
      regCode,
      orderCode,
      eventId: ev.id,
      organizationId: ev.organizationId,
      categoryId: cat.id,
      runnerUserId:
        currentUser?.kind === 'runner' ? currentUser.id : 'usr-runner',
      buyerName: payload.buyerName,
      participantNameTh: payload.participantNameTh,
      participantNameEn: payload.participantNameEn,
      email: currentUser?.email ?? 'runner.demo@runevent.local',
      phoneMasked: '081-•••-9900',
      emergencyContact: 'ผู้ติดต่อฉุกเฉินสาธิต 089-•••-0011',
      shirtSize: payload.shirtSize,
      bibNumber: null,
      qrCheckInToken: `TKN-${cat.bibPrefix}${seq}-${tokenSuffix}`,
      acceptedRulesVersion: ev.rulesVersion,
      marketingConsent: payload.marketingConsent,
      createdAt: '2026-11-17T08:35:00+07:00',
      paidAt: payload.simulateImmediateWebhook
        ? '2026-11-17T08:35:05+07:00'
        : null,
      refundedAt: null,
      reservationExpiresAt: payload.simulateImmediateWebhook
        ? null
        : '2026-11-17T08:50:00+07:00',
      registrationStatus: payload.simulateImmediateWebhook
        ? 'confirmed'
        : 'pending_payment',
      paymentStatus: payload.simulateImmediateWebhook ? 'succeeded' : 'pending',
      refundStatus: 'none',
      fulfillmentStatus: payload.simulateImmediateWebhook
        ? 'ready'
        : 'not_ready',
      snapshotBaseSatang: quote.baseSatang,
      snapshotPlatformFeeSatang: quote.platformFeeSatang,
      snapshotRunnerFeeSatang: quote.runnerFeeSatang,
      snapshotOrganizerFeeSatang: quote.organizerFeeSatang,
      snapshotTotalChargedSatang: quote.runnerNetPaySatang,
      snapshotRefundedSatang: 0,
    };

    setMockState((prev) => ({
      events: prev.events.map((item) =>
        item.id === ev.id
          ? {
              ...item,
              shirtStocks: item.shirtStocks.map((st) =>
                st.size === payload.shirtSize
                  ? { ...st, reservedOrConfirmed: st.reservedOrConfirmed + 1 }
                  : st
              ),
            }
          : item
      ),
      registrations: [newRecord, ...prev.registrations],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          organizationId: ev.organizationId,
          eventId: ev.id,
          timestamp: '2026-11-17 08:35',
          actorName: payload.buyerName,
          actorRole: 'นักวิ่ง (หน้ารับสมัครสาธารณะ)',
          actionSummary: payload.simulateImmediateWebhook
            ? `สมัครและรับผล Webhook ชำระเงินสำเร็จ (${regCode})`
            : `สร้างรายการกันโควตารอชำระเงิน (${regCode})`,
          detailChange: `${cat.code} · เสื้อ ${payload.shirtSize} · สุทธิ ฿${(
            quote.runnerNetPaySatang / 100
          ).toFixed(2)}`,
        },
        ...prev.auditLogs,
      ],
    }));

    return newRecord;
  };

  const handleUpdateRunnerShirtSize = (
    regId: string,
    newSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL'
  ) => {
    const target = mockState.registrations.find((r) => r.id === regId);
    if (!target || target.shirtSize === newSize) return;
    const oldSize = target.shirtSize;

    setMockState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId ? { ...r, shirtSize: newSize } : r
      ),
      events: prev.events.map((ev) =>
        ev.id === target.eventId
          ? {
              ...ev,
              shirtStocks: ev.shirtStocks.map((st) => {
                if (st.size === oldSize) {
                  return {
                    ...st,
                    reservedOrConfirmed: Math.max(
                      0,
                      st.reservedOrConfirmed - 1
                    ),
                  };
                }
                if (st.size === newSize) {
                  return {
                    ...st,
                    reservedOrConfirmed: st.reservedOrConfirmed + 1,
                  };
                }
                return st;
              }),
            }
          : ev
      ),
    }));

    appendAudit(
      target.organizationId,
      `ผู้สมัครแก้ไขขนาดเสื้อก่อนเส้นตาย (${target.regCode})`,
      `ไซส์เสื้อ: ${oldSize} -> ${newSize}`,
      target.eventId
    );
  };

  const handleCreateDraftEvent = (
    orgId: string,
    titleTh: string,
    province: string
  ) => {
    const num = mockState.events.length + 10;
    const newEv: RaceEvent = {
      id: `evt-draft-${Date.now()}`,
      code: `EVT-DRF-27${num}`,
      organizationId: orgId,
      titleTh,
      titleEn: 'New Draft Running Event',
      province,
      region: 'เหนือ',
      venue: 'สถานที่จัดงานตัวอย่าง (รอกรอกรายละเอียด)',
      eventDate: '2027-03-21',
      timezone: 'Asia/Bangkok',
      raceType: 'Road Race',
      status: 'draft',
      statusNote: 'เพิ่งสร้างแบบร่างใหม่ — กรุณาตรวจ Checklist ความพร้อมก่อนส่งตรวจเผยแพร่',
      totalEventQuota: 100,
      feeBearerPolicy: 'runner_pays',
      editDeadlineDate: '2027-03-05',
      rulesVersion: 'v0.1-draft',
      kitPickupWindow: '20 มี.ค. 2027 เวลา 10:00–18:00 น.',
      highlights: ['งานวิ่งแบบร่างที่สร้างจากเครื่องมือผู้จัดงานในต้นแบบ'],
      categories: [
        {
          id: `cat-drf-${Date.now()}`,
          code: '10K',
          name: 'Standard 10.0 กม.',
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
              startsAt: '2027-01-01',
              endsAt: '2027-03-10',
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
      readinessChecks: [
        {
          id: 'chk-new-1',
          label: 'กำหนดชื่อและจังหวัดเบื้องต้นแล้ว',
          passed: true,
          fixTargetHint: 'ข้อมูลงาน',
        },
        {
          id: 'chk-new-2',
          label: 'ยืนยันกติกาการแข่งขันและโควตาเสื้อ 2XL ก่อนเผยแพร่',
          passed: false,
          fixTargetHint: 'กดปุ่มจำลองการเติมข้อมูลในหน้าภาพรวมงานเพื่อส่งตรวจ',
        },
      ],
    };

    setMockState((prev) => ({
      ...prev,
      events: [newEv, ...prev.events],
    }));
    appendAudit(
      orgId,
      `สร้างงานวิ่งแบบร่างใหม่ (${newEv.code})`,
      `ชื่องาน: ${titleTh}`,
      newEv.id
    );
    setActiveEventId(newEv.id);
    setActiveOrgSection('evt_overview');
  };

  const handleDuplicateEventWithoutPii = (sourceEventId: string) => {
    const src = mockState.events.find((e) => e.id === sourceEventId);
    if (!src) return;
    const copyCode = `${src.code}-COPY`;
    const duplicated: RaceEvent = {
      ...src,
      id: `evt-copy-${Date.now()}`,
      code: copyCode,
      titleTh: `${src.titleTh} (สำเนาตั้งต้นรอบปีถัดไป)`,
      status: 'draft',
      statusNote:
        'คัดลอกเฉพาะโครงสร้างระยะ ราคา และสต็อกเสื้อตั้งต้น — ไม่คัดลอกรายชื่อหรือข้อมูลส่วนบุคคล (PII) ของผู้สมัครเดิม',
      shirtStocks: src.shirtStocks.map((s) => ({
        ...s,
        reservedOrConfirmed: 0,
      })),
      verifiedPhotoAlbums: undefined,
      officialResultsUrl: undefined,
    };
    setMockState((prev) => ({
      ...prev,
      events: [duplicated, ...prev.events],
    }));
    appendAudit(
      src.organizationId,
      `ทำสำเนางานวิ่งโดยไม่คัดลอกข้อมูลผู้สมัครเดิม`,
      `${src.code} -> ${copyCode} (0 ผู้สมัคร)`,
      duplicated.id
    );
    setActiveEventId(duplicated.id);
    setActiveOrgSection('evt_overview');
  };

  const handleCompleteDraftReadinessAndSubmit = (eventId: string) => {
    const target = mockState.events.find((e) => e.id === eventId);
    if (!target) return;
    setMockState((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId
          ? {
              ...ev,
              status: 'in_review',
              rulesVersion: 'v1.0-submitted',
              statusNote:
                'ผ่าน Checklist เบื้องต้นและส่งให้ผู้ดูแลแพลตฟอร์มตรวจอนุมัติเผยแพร่แล้ว',
              shirtStocks: ev.shirtStocks.map((st) =>
                st.size === '2XL' && st.total === 0
                  ? { ...st, total: 10 }
                  : st
              ),
              readinessChecks: ev.readinessChecks.map((c) => ({
                ...c,
                passed: true,
              })),
            }
          : ev
      ),
    }));
    appendAudit(
      target.organizationId,
      `ส่งงาน ${target.code} เข้าสู่คิวตรวจอนุมัติเผยแพร่`,
      'status: draft -> in_review',
      target.id
    );
  };

  const handleUpdateFeeBearerPolicy = (
    eventId: string,
    policy: FeeBearerPolicy
  ) => {
    const target = mockState.events.find((e) => e.id === eventId);
    if (!target) return;
    const prevPolicy = target.feeBearerPolicy;
    setMockState((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId ? { ...ev, feeBearerPolicy: policy } : ev
      ),
    }));
    appendAudit(
      target.organizationId,
      `เปลี่ยนนโยบายผู้รับภาระค่าบริการของงาน ${target.code}`,
      `${prevPolicy} -> ${policy} (มีผลเฉพาะคำสั่งซื้อใหม่)`,
      target.id
    );
  };

  const handleAssignBibNumber = (
    regId: string,
    bibNumber: string
  ): { ok: boolean; error?: string } => {
    const trimmed = bibNumber.trim().toUpperCase();
    if (!trimmed) {
      return { ok: false, error: 'กรุณาระบุเลข BIB ก่อนบันทึก' };
    }
    const target = mockState.registrations.find((r) => r.id === regId);
    if (!target) return { ok: false, error: 'ไม่พบใบสมัครที่ระบุ' };

    const duplicate = mockState.registrations.find(
      (r) =>
        r.eventId === target.eventId &&
        r.id !== regId &&
        (r.bibNumber ?? '').toUpperCase() === trimmed
    );
    if (duplicate) {
      return {
        ok: false,
        error: `เลข BIB "${trimmed}" ซ้ำกับใบสมัคร ${duplicate.regCode} (${duplicate.participantNameTh}) ในงานเดียวกัน! ระบบไม่อนุญาตให้กำหนดเลขซ้ำ`,
      };
    }

    const oldBib = target.bibNumber ?? 'ไม่มี';
    setMockState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId ? { ...r, bibNumber: trimmed } : r
      ),
    }));
    appendAudit(
      target.organizationId,
      `กำหนดเลข BIB ให้ใบสมัคร ${target.regCode}`,
      `BIB: ${oldBib} -> ${trimmed}`,
      target.eventId
    );
    return { ok: true };
  };

  const handleConfirmKitPickup = (
    regId: string
  ): { ok: boolean; error?: string } => {
    const target = mockState.registrations.find((r) => r.id === regId);
    if (!target) return { ok: false, error: 'ไม่พบข้อมูลใบสมัคร' };
    if (target.fulfillmentStatus === 'kit_picked_up') {
      return {
        ok: false,
        error: `ป้องกันการรับอุปกรณ์ซ้ำ: ${target.participantNameTh} (BIB ${target.bibNumber}) รับอุปกรณ์ไปแล้วโดย ${target.fulfillmentUpdatedBy} เมื่อ ${target.fulfillmentUpdatedAt}`,
      };
    }
    if (!target.bibNumber) {
      return { ok: false, error: 'ต้องกำหนดเลข BIB ก่อนยืนยันส่งมอบอุปกรณ์' };
    }

    const actor = currentUser?.fullNameTh ?? 'เจ้าหน้าที่จุดรับอุปกรณ์';
    const stamp = '2026-11-17 08:40';
    setMockState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? {
              ...r,
              fulfillmentStatus: 'kit_picked_up',
              fulfillmentUpdatedBy: actor,
              fulfillmentUpdatedAt: stamp,
            }
          : r
      ),
    }));
    appendAudit(
      target.organizationId,
      `ยืนยันส่งมอบเสื้อ ${target.shirtSize} และ BIB ${target.bibNumber}`,
      `${target.regCode}: ready -> kit_picked_up`,
      target.eventId
    );
    return { ok: true };
  };

  const handleSimulateWebhookConfirm = (regId: string) => {
    const target = mockState.registrations.find((r) => r.id === regId);
    if (!target) return;
    setMockState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? {
              ...r,
              registrationStatus: 'confirmed',
              paymentStatus: 'succeeded',
              fulfillmentStatus: 'ready',
              paidAt: '2026-11-17T08:42:00+07:00',
              reservationExpiresAt: null,
            }
          : r
      ),
    }));
    appendAudit(
      target.organizationId,
      `รับผล Webhook ยืนยันการชำระเงินสำเร็จ (${target.orderCode})`,
      `${target.regCode}: pending_payment -> confirmed`,
      target.eventId
    );
  };

  const handleResolveRefundRequest = (
    regId: string,
    decision: 'approve_succeed' | 'reject',
    note: string
  ) => {
    const target = mockState.registrations.find((r) => r.id === regId);
    if (!target) return;
    setMockState((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? decision === 'approve_succeed'
            ? {
                ...r,
                registrationStatus: 'cancelled',
                refundStatus: 'succeeded',
                refundedAt: '2026-11-17T08:45:00+07:00',
                snapshotRefundedSatang: r.snapshotBaseSatang,
                refundReason: `${r.refundReason ?? ''} (${note})`,
              }
            : {
                ...r,
                refundStatus: 'rejected',
                refundReason: `${r.refundReason ?? ''} (ปฏิเสธ: ${note})`,
              }
          : r
      ),
    }));
    appendAudit(
      target.organizationId,
      decision === 'approve_succeed'
        ? `อนุมัติและคืนเงินคำสั่งซื้อ ${target.orderCode} สำเร็จ`
        : `ปฏิเสธคำขอคืนเงินคำสั่งซื้อ ${target.orderCode}`,
      note,
      target.eventId
    );
  };

  return (
    <div className="app-root">
      {/* Global Top Navigation & Synthetic Provenance Strip */}
      <header className="global-topbar">
        <div className="brand-lockup">
          <span className="brand-bib-mark" aria-hidden="true">
            <IconBib size={18} />
          </span>
          <strong className="brand-name">RunEvent</strong>
          <span className="synthetic-badge">
            ต้นแบบจำลองฝั่งหน้าบ้าน · ข้อมูลสาธิตในเบราว์เซอร์ (ไม่ตัดเงินจริง)
          </span>
        </div>

        <nav className="global-surface-nav" aria-label="สลับส่วนหลักของระบบต้นแบบ">
          <button
            type="button"
            className={`surface-switch-btn ${
              surface === 'public_events' ? 'active' : ''
            }`}
            onClick={() => setSurface('public_events')}
          >
            <IconFlag size={15} />
            <span>หน้ารายการงานวิ่งสาธารณะ</span>
          </button>

          <button
            type="button"
            className={`surface-switch-btn ${
              surface === 'dashboard' ? 'active' : ''
            }`}
            onClick={() => {
              if (!currentUser || currentUser.kind !== 'organizer') {
                handleSelectDemoUser(DEMO_USERS[0], 'org-lanna');
              } else {
                setSurface('dashboard');
              }
            }}
          >
            <IconBuilding size={15} />
            <span>Organizer Dashboard</span>
          </button>

          <button
            type="button"
            className={`surface-switch-btn ${
              surface === 'login' ? 'active' : ''
            }`}
            onClick={() => setSurface('login')}
          >
            <IconLock size={15} />
            <span>
              {currentUser
                ? `สลับบัญชี (${currentUser.fullNameTh.split(' ')[0]})`
                : 'เข้าสู่ระบบ / สลับบทบาท'}
            </span>
          </button>
        </nav>

        <div className="prototype-inspector-controls">
          {surface === 'dashboard' && (
            <>
              <label htmlFor="sim-state-select" className="sr-only">
                จำลองสถานะหน้าจอ UX
              </label>
              <select
                id="sim-state-select"
                className="inspector-select"
                value={simulatedState}
                onChange={(e) =>
                  setSimulatedState(e.target.value as SimulatedUiState)
                }
                aria-label="ทดสอบสถานะหน้าจอพิเศษ"
              >
                <option value="normal">สถานะหน้าจอ: ปกติ</option>
                <option value="loading">ทดสอบ: กำลังโหลด (Skeleton)</option>
                <option value="partial_error">
                  ทดสอบ: โหลดผิดพลาดบางส่วน
                </option>
                <option value="permission_denied">
                  ทดสอบ: ไม่มีสิทธิ์เข้าถึง
                </option>
              </select>
            </>
          )}
          <button
            type="button"
            className="btn-reset-demo"
            onClick={handleResetDemoData}
            title="รีเซ็ตข้อมูลสาธิตใน localStorage กลับเป็นค่าเริ่มต้น"
          >
            <IconSwitch size={14} />
            <span>รีเซ็ตข้อมูลสาธิต</span>
          </button>
        </div>
      </header>

      {/* Surface Router */}
      {surface === 'public_events' && (
        <PublicEventsView
          events={mockState.events}
          organizations={DEMO_ORGANIZATIONS}
          registrations={mockState.registrations}
          currentUser={currentUser}
          onRequireRunnerLogin={() => setSurface('login')}
          onOpenOrganizerDashboard={(orgId, evId) => {
            setActiveOrgId(orgId);
            setActiveEventId(evId ?? null);
            setActiveOrgSection(evId ? 'evt_overview' : 'org_overview');
            setSurface('dashboard');
          }}
          onCreateDemoRegistration={handleCreateDemoRegistration}
          onUpdateRunnerShirtSize={handleUpdateRunnerShirtSize}
        />
      )}

      {surface === 'login' && (
        <LoginView
          users={DEMO_USERS}
          organizations={DEMO_ORGANIZATIONS}
          currentUser={currentUser}
          onSelectDemoUser={handleSelectDemoUser}
          onLogout={() => setCurrentUser(null)}
        />
      )}

      {surface === 'dashboard' && currentUser?.kind === 'organizer' && (
        <OrganizerDashboardView
          currentUser={currentUser}
          organizations={DEMO_ORGANIZATIONS}
          activeOrgId={activeOrgId}
          activeEventId={activeEventId}
          activeSection={activeOrgSection}
          events={mockState.events}
          registrations={mockState.registrations}
          payouts={INITIAL_PAYOUTS}
          auditLogs={mockState.auditLogs}
          simulatedState={simulatedState}
          onClearSimulatedState={() => setSimulatedState('normal')}
          onSelectOrg={(orgId) => {
            setActiveOrgId(orgId);
            setActiveEventId(null);
            setActiveOrgSection('org_overview');
          }}
          onSelectEvent={(evId, targetSec) => {
            setActiveEventId(evId);
            if (targetSec) {
              setActiveOrgSection(targetSec);
            } else if (!evId) {
              setActiveOrgSection('org_overview');
            }
          }}
          onSelectSection={setActiveOrgSection}
          onCreateDraftEvent={handleCreateDraftEvent}
          onDuplicateEventWithoutPii={handleDuplicateEventWithoutPii}
          onCompleteDraftReadinessAndSubmit={
            handleCompleteDraftReadinessAndSubmit
          }
          onUpdateFeeBearerPolicy={handleUpdateFeeBearerPolicy}
          onAssignBibNumber={handleAssignBibNumber}
          onConfirmKitPickup={handleConfirmKitPickup}
          onSimulateWebhookConfirm={handleSimulateWebhookConfirm}
          onResolveRefundRequest={handleResolveRefundRequest}
          onOpenPublicPreview={() => setSurface('public_events')}
        />
      )}
    </div>
  );
};
