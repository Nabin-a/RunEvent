import React, { useMemo, useState } from 'react';
import {
  MerchOrderRecord,
  RaceEvent,
  RegistrationRecord,
  TimeWindowFilter,
} from '../types';
import { formatThb, ScopedLedgerMetrics } from '../utils/pricing';
import {
  IconAlert,
  IconArrowRight,
  IconBib,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconFlag,
  IconLedger,
  IconQr,
  IconUsers,
} from './Icons';
import { EventStatusBadge } from './StatusBadges';

import { tx, txf } from '../i18n';
interface OrganizerAnalyticsChartsProps {
  scopeMode: 'organization' | 'event';
  scopeTitle: string;
  events: RaceEvent[];
  selectedEvent: RaceEvent | null;
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  metrics: ScopedLedgerMetrics;
  timeWindow: TimeWindowFilter;
  canViewFinance: boolean;
  canManageEventConfig: boolean;
  canCheckIn: boolean;
  onDrillDownStatus: (status: 'confirmed' | 'pending_payment') => void;
  onDrillDownFinance: (target: 'payments' | 'refunds' | 'payouts' | 'merch') => void;
  onSelectEventAction: (
    eventId: string,
    targetSection:
      | 'evt_overview'
      | 'evt_pricing_quota'
      | 'evt_participants'
      | 'evt_checkin_bib'
      | 'evt_finance'
  ) => void;
}

type PriorityTier = 'all' | 'P1' | 'P2' | 'P3';

// ฟังก์ชันช่วยคำนวณข้อมูลสาธิตด้านประชากรศาสตร์และช่องทางชำระเงินจาก RegistrationRecord
function inferDemographicsAndPayment(reg: RegistrationRecord, index: number) {
  const gender: 'ชาย' | 'หญิง' | 'ไม่ระบุ' =
    reg.gender ??
    (index % 5 === 0 ? 'ไม่ระบุ' : index % 2 === 0 ? 'หญิง' : 'ชาย');

  const age =
    reg.age ??
    [26, 33, 29, 42, 23, 38, 47, 31, 35, 52][index % 10];

  const ageBracket =
    age < 30
      ? '18–29 ปี'
      : age < 40
      ? '30–39 ปี'
      : age < 50
      ? '40–49 ปี'
      : '50 ปีขึ้นไป';

  const paymentMethod: 'qr_promptpay' | 'credit_card' | 'mobile_banking' =
    reg.paymentMethod ??
    (index % 4 === 0
      ? 'credit_card'
      : index % 4 === 3
      ? 'mobile_banking'
      : 'qr_promptpay');

  return { gender, age, ageBracket, paymentMethod };
}

export const OrganizerAnalyticsCharts: React.FC<
  OrganizerAnalyticsChartsProps
> = ({
  scopeMode,
  scopeTitle,
  events,
  selectedEvent,
  registrations,
  merchOrders,
  metrics,
  canViewFinance,
  canManageEventConfig,
  canCheckIn,
  onDrillDownStatus,
  onDrillDownFinance,
  onSelectEventAction,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<PriorityTier>('all');

  const scopedEvents = useMemo(
    () => (selectedEvent ? [selectedEvent] : events),
    [selectedEvent, events]
  );

  const scopedRegistrations = useMemo(() => {
    if (selectedEvent) {
      return registrations.filter((r) => r.eventId === selectedEvent.id);
    }
    return registrations;
  }, [registrations, selectedEvent]);

  const scopedMerchOrders = useMemo(() => {
    if (selectedEvent) {
      return merchOrders.filter((m) => m.eventId === selectedEvent.id);
    }
    return merchOrders;
  }, [merchOrders, selectedEvent]);

  // 1. คำนวณแนวโน้มการสมัครรายช่วงเวลา (Registration Trend & Velocity)
  const registrationTrendBuckets = useMemo(() => {
    const buckets = [
      {
        id: 'w1',
        label: 'ก.ย.–ต.ค. 26',
        shortLabel: 'ต.ค.',
        matchFn: (iso: string) =>
          iso.startsWith('2026-09') || iso.startsWith('2026-10'),
      },
      {
        id: 'w2',
        label: '1–11 พ.ย. 26',
        shortLabel: '1–11 พ.ย.',
        matchFn: (iso: string) =>
          iso >= '2026-11-01' && iso < '2026-11-12',
      },
      {
        id: 'w3',
        label: '12–14 พ.ย. 26',
        shortLabel: '12–14 พ.ย.',
        matchFn: (iso: string) =>
          iso >= '2026-11-12' && iso < '2026-11-15',
      },
      {
        id: 'w4',
        label: '15–16 พ.ย. 26',
        shortLabel: '15–16 พ.ย.',
        matchFn: (iso: string) =>
          iso >= '2026-11-15' && iso < '2026-11-17',
      },
      {
        id: 'w5',
        label: '17–18 พ.ย. 26 (ล่าสุด)',
        shortLabel: '17–18 พ.ย.',
        matchFn: (iso: string) => iso >= '2026-11-17',
      },
    ];

    return buckets.map((b) => {
      const matched = scopedRegistrations.filter((r) => b.matchFn(r.createdAt));
      const confirmed = matched.filter(
        (r) => r.registrationStatus === 'confirmed'
      ).length;
      const pending = matched.filter(
        (r) => r.registrationStatus === 'pending_payment'
      ).length;
      const grossSatang = matched
        .filter((r) => r.paymentStatus === 'succeeded')
        .reduce((s, r) => s + r.snapshotTotalChargedSatang, 0);
      const netSatang = matched
        .filter((r) => r.paymentStatus === 'succeeded')
        .reduce(
          (s, r) =>
            s +
            Math.max(
              0,
              r.snapshotBaseSatang -
                r.snapshotRefundedSatang -
                r.snapshotOrganizerFeeSatang
            ),
          0
        );
      const merchSatang = scopedMerchOrders
        .filter((m) => b.matchFn(m.createdAt) && m.paymentStatus === 'succeeded')
        .reduce((s, m) => s + m.totalPaidSatang, 0);

      return {
        ...b,
        total: matched.length,
        confirmed,
        pending,
        grossSatang,
        netSatang,
        merchSatang,
      };
    });
  }, [scopedRegistrations, scopedMerchOrders]);

  // คำนวณอัตราการเปลี่ยนแปลง 7 วันล่าสุด เทียบกับช่วงก่อนหน้า
  const trendComparison = useMemo(() => {
    const recent7d = scopedRegistrations.filter(
      (r) => r.createdAt >= '2026-11-12'
    ).length;
    const prevWindow = scopedRegistrations.filter(
      (r) => r.createdAt < '2026-11-12'
    ).length;
    const base = Math.max(1, prevWindow);
    const deltaPct = Math.round(((recent7d - prevWindow) / base) * 100);
    return {
      recent7d,
      prevWindow,
      deltaPct,
      direction: deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat',
    };
  }, [scopedRegistrations]);

  // 2. คำนวณสถานะการสมัคร & ความครบถ้วนของข้อมูลนักวิ่ง (Registration Status & Completeness)
  const statusAndCompleteness = useMemo(() => {
    const total = scopedRegistrations.length;
    const confirmed = scopedRegistrations.filter(
      (r) => r.registrationStatus === 'confirmed'
    ).length;
    const pending = scopedRegistrations.filter(
      (r) => r.registrationStatus === 'pending_payment'
    ).length;
    const cancelledOrRefunded = scopedRegistrations.filter(
      (r) =>
        r.registrationStatus === 'cancelled' ||
        r.registrationStatus === 'expired' ||
        r.refundStatus === 'requested' ||
        r.refundStatus === 'succeeded'
    ).length;

    // ตรวจสอบความครบถ้วนของข้อมูล + เลข BIB + คำถามบังคับ
    let completeReadyCount = 0;
    let missingBibCount = 0;
    let missingCustomFieldCount = 0;
    let pickedUpCount = 0;

    scopedRegistrations.forEach((reg) => {
      if (reg.fulfillmentStatus === 'kit_picked_up') {
        pickedUpCount += 1;
      }
      if (reg.registrationStatus !== 'confirmed') return;
      const ev = scopedEvents.find((e) => e.id === reg.eventId);
      const reqFields = (ev?.customFields ?? []).filter((f) => f.required);
      const hasAllCustom = reqFields.every((f) => {
        const val = reg.customAnswers?.[f.id];
        return val !== undefined && String(val).trim() !== '' && val !== false;
      });
      if (!hasAllCustom) {
        missingCustomFieldCount += 1;
      }
      if (!reg.bibNumber) {
        missingBibCount += 1;
      }
      if (reg.bibNumber && hasAllCustom) {
        completeReadyCount += 1;
      }
    });

    const completenessPct =
      confirmed > 0 ? Math.round((completeReadyCount / confirmed) * 100) : 100;

    return {
      total,
      confirmed,
      pending,
      cancelledOrRefunded,
      completeReadyCount,
      missingBibCount,
      missingCustomFieldCount,
      pickedUpCount,
      completenessPct,
    };
  }, [scopedRegistrations, scopedEvents]);

  // 3. คำนวณสัดส่วนตามระยะทาง (P2 Distance Breakdown)
  const distanceBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        code: string;
        label: string;
        distanceKm: number;
        colorTag: string;
        quota: number;
        confirmed: number;
        pending: number;
        revenueSatang: number;
      }
    >();

    scopedEvents.forEach((ev) => {
      ev.categories.forEach((cat) => {
        const key = selectedEvent ? cat.id : `${cat.code}`;
        const existing = map.get(key) ?? {
          code: cat.code,
          label: selectedEvent ? `${cat.name} (${cat.code})` : `ระยะ ${cat.code}`,
          distanceKm: cat.distanceKm,
          colorTag: cat.colorTag,
          quota: 0,
          confirmed: 0,
          pending: 0,
          revenueSatang: 0,
        };
        existing.quota += cat.categoryQuota;

        const catRegs = scopedRegistrations.filter(
          (r) => r.eventId === ev.id && r.categoryId === cat.id
        );
        existing.confirmed += catRegs.filter(
          (r) => r.registrationStatus === 'confirmed'
        ).length;
        existing.pending += catRegs.filter(
          (r) => r.registrationStatus === 'pending_payment'
        ).length;
        existing.revenueSatang += catRegs
          .filter((r) => r.paymentStatus === 'succeeded')
          .reduce((s, r) => s + r.snapshotTotalChargedSatang, 0);

        map.set(key, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.distanceKm - a.distanceKm);
  }, [scopedEvents, scopedRegistrations, selectedEvent]);

  // 4. คำนวณเปรียบเทียบผลงานแต่ละงาน (P2 Event Performance)
  const eventPerformanceRows = useMemo(() => {
    return events.map((ev) => {
      const evRegs = registrations.filter((r) => r.eventId === ev.id);
      const confirmed = evRegs.filter(
        (r) => r.registrationStatus === 'confirmed'
      ).length;
      const pending = evRegs.filter(
        (r) => r.registrationStatus === 'pending_payment'
      ).length;
      const fillPct = Math.min(
        100,
        Math.round(((confirmed + pending) / Math.max(1, ev.totalEventQuota)) * 100)
      );
      const grossSatang = evRegs
        .filter((r) => r.paymentStatus === 'succeeded')
        .reduce((s, r) => s + r.snapshotTotalChargedSatang, 0);
      const netPayoutSatang = evRegs
        .filter((r) => r.paymentStatus === 'succeeded')
        .reduce(
          (s, r) =>
            s +
            Math.max(
              0,
              r.snapshotBaseSatang -
                r.snapshotRefundedSatang -
                r.snapshotOrganizerFeeSatang
            ),
          0
        );
      const merchSatang = merchOrders
        .filter((m) => m.eventId === ev.id && m.paymentStatus === 'succeeded')
        .reduce((s, m) => s + m.totalPaidSatang, 0);
      const missingBib = evRegs.filter(
        (r) => r.registrationStatus === 'confirmed' && !r.bibNumber
      ).length;

      return {
        event: ev,
        confirmed,
        pending,
        fillPct,
        grossSatang,
        netPayoutSatang,
        merchSatang,
        missingBib,
      };
    });
  }, [events, registrations, merchOrders]);

  // 5. คำนวณข้อมูลกลุ่มเป้าหมายและช่องทางชำระเงิน (P3 Demographics & Payment Method)
  const demographicsAndPayments = useMemo(() => {
    const enriched = scopedRegistrations.map((r, idx) => ({
      reg: r,
      ...inferDemographicsAndPayment(r, idx),
    }));

    const total = Math.max(1, enriched.length);

    const ageGroups = ['18–29 ปี', '30–39 ปี', '40–49 ปี', '50 ปีขึ้นไป'].map(
      (bracket) => {
        const count = enriched.filter((x) => x.ageBracket === bracket).length;
        return {
          bracket,
          count,
          pct: Math.round((count / total) * 100),
        };
      }
    );

    const genders = (['ชาย', 'หญิง', 'ไม่ระบุ'] as const).map((g) => {
      const count = enriched.filter((x) => x.gender === g).length;
      return {
        gender: g,
        count,
        pct: Math.round((count / total) * 100),
      };
    });

    const paymentChannels = [
      {
        key: 'qr_promptpay' as const,
        label: 'QR PromptPay (สแกนจ่ายทันที)',
        tone: 'forest',
      },
      {
        key: 'credit_card' as const,
        label: 'บัตรเครดิต / เดบิต (Visa / Mastercard)',
        tone: 'navy',
      },
      {
        key: 'mobile_banking' as const,
        label: 'Mobile Banking / LINE Pay',
        tone: 'vermilion',
      },
    ].map((ch) => {
      const matched = enriched.filter((x) => x.paymentMethod === ch.key);
      const succeeded = matched.filter(
        (x) => x.reg.paymentStatus === 'succeeded'
      );
      const amountSatang = succeeded.reduce(
        (s, x) => s + x.reg.snapshotTotalChargedSatang,
        0
      );
      return {
        ...ch,
        count: matched.length,
        succeededCount: succeeded.length,
        pct: Math.round((matched.length / total) * 100),
        amountSatang,
      };
    });

    return { ageGroups, genders, paymentChannels, totalCount: enriched.length };
  }, [scopedRegistrations]);

  const maxTrendCount = Math.max(
    1,
    ...registrationTrendBuckets.map((b) => b.total)
  );
  const maxRevenueSatang = Math.max(
    1,
    ...registrationTrendBuckets.map((b) => b.grossSatang + b.merchSatang)
  );

  const fillRatePct = Math.min(
    100,
    Math.round(
      ((metrics.confirmedParticipants + metrics.pendingPaymentReservations) /
        Math.max(1, metrics.totalEventQuota)) *
        100
    )
  );

  const showP1 = priorityFilter === 'all' || priorityFilter === 'P1';
  const showP2 = priorityFilter === 'all' || priorityFilter === 'P2';
  const showP3 = priorityFilter === 'all' || priorityFilter === 'P3';

  return (
    <section
      className="analytics-suite-section"
      aria-label={tx("แผงควบคุมและกราฟวิเคราะห์การดำเนินงาน")}
    >
      {/* Header & Priority Filter Bar */}
      <div className="analytics-suite-header">
        <div>
          <h2>
            {scopeMode === 'organization'
              ? txf("Organization Overview — ภาพรวมทุกงานขององค์กร ({0})", scopeTitle)
              : txf("Event Dashboard — เจาะลึกงานวิ่ง: {0}", scopeTitle)}
          </h2>
          <p className="muted-block">
            {scopeMode === 'organization'
              ? tx("เปรียบเทียบภาพรวมทุกงานวิ่งในองค์กร ติดตามแนวโน้มยอดสมัคร รายได้รวม และเลือกงานที่ต้องการเจาะลึก")
              : tx("เจาะลึกข้อมูลเฉพาะงานวิ่งนี้: ยอดสมัคร รายได้ โควตารายระยะ ความครบถ้วนข้อมูลนักวิ่ง การชำระเงิน และสถานะ Check-in หน้างาน")}
          </p>
        </div>

        <div
          className="priority-pill-bar"
          role="group"
          aria-label={tx("กรองตามระดับความสำคัญของกราฟ")}
        >
          {(
            [
              ['all', 'แสดงครบ (P1–P3)'],
              ['P1', 'P1 · ภาพรวม & แนวโน้มหลัก'],
              ['P2', 'P2 · ระยะทาง & โควตา'],
              ['P3', 'P3 · กลุ่มเป้าหมาย & ช่องทางจ่าย'],
            ] as const
          ).map(([tier, label]) => (
            <button
              key={tier}
              type="button"
              className={`filter-pill ${priorityFilter === tier ? 'active' : ''}`}
              onClick={() => setPriorityFilter(tier)}
            >
              {tx(label)}
            </button>
          ))}
        </div>
      </div>

      {/* EVENT DASHBOARD EXCLUSIVE: 6-PILLAR DEEP-DIVE CONTROL STRIP */}
      {scopeMode === 'event' && selectedEvent && (
        <section
          className="clean-panel chart-card"
          aria-label={tx("เจาะลึกสถานะปฏิบัติการและการเช็กอินของงานนี้")}
        >
          <div className="chart-card-head">
            <div>
              <div className="chart-title-inline">
                <span className="priority-chip chip-p1">Event Deep-Dive</span>
                <h3>
                  {tx("เจาะลึกปฏิบัติการงานวิ่ง: นักวิ่ง · การชำระเงิน · เลข BIB · Check-in รับอุปกรณ์")}
                </h3>
              </div>
              <p className="muted-inline">
                {tx("สรุปสถานะตั้งแต่ชำระเงิน กำหนดเลข BIB จนถึงการสแกน QR รับเสื้อและ BIB หน้างานของ ")} {tx(selectedEvent.titleTh)}
              </p>
            </div>
          </div>

          <div className="analytics-two-col-grid">
            {/* Left: Check-in & BIB Readiness Funnel */}
            <div className="hbar-item">
              <div className="hbar-item-head">
                <strong>
                  {tx("1. สถานะ Check-in & การรับอุปกรณ์หน้างาน (Expo / Race Kit)")}
                </strong>
                <span className="mono-num">
                  {tx("รับของแล้ว")}{' '}
                  <strong>{tx(statusAndCompleteness.pickedUpCount)}</strong> /{' '}
                  {tx(statusAndCompleteness.confirmed)} {tx(" คนที่ยืนยันสิทธิ์")}
                </span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill fill-forest"
                  style={{
                    width: `${Math.max(
                      4,
                      Math.round(
                        (statusAndCompleteness.pickedUpCount /
                          Math.max(1, statusAndCompleteness.confirmed)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="cta-inline-row" style={{ justifyContent: 'space-between' }}>
                <span className="muted-inline mono-num">
                  {tx("มีเลข BIB พร้อมเช็กอิน ")} {tx(statusAndCompleteness.completeReadyCount)} {tx(" คน · ยังไม่มีเลข BIB ")} {tx(statusAndCompleteness.missingBibCount)} {tx(" คน")}
                </span>
                {canCheckIn && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      onSelectEventAction(selectedEvent.id, 'evt_checkin_bib')
                    }
                  >
                    <IconQr size={14} />
                    <span>{tx("ไปหน้า Check-in & กำหนด BIB")}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: Payment & Settlement Funnel */}
            <div className="hbar-item">
              <div className="hbar-item-head">
                <strong>{tx("2. สถานะการชำระเงิน & คำขอคืนเงินของงานนี้")}</strong>
                <span className="mono-num">
                  {tx("ชำระสำเร็จ")}{' '}
                  <strong>{tx(statusAndCompleteness.confirmed)}</strong> {tx(" รายการ · รอชำระ ")} {tx(statusAndCompleteness.pending)} {tx(" รายการ")}
                </span>
              </div>
              <div className="hbar-track">
                <div
                  className="hbar-fill fill-vermilion"
                  style={{
                    width: `${Math.max(
                      4,
                      Math.round(
                        (statusAndCompleteness.confirmed /
                          Math.max(1, statusAndCompleteness.total)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="cta-inline-row" style={{ justifyContent: 'space-between' }}>
                <span className="muted-inline mono-num">
                  {canViewFinance
                    ? txf("รับชำระรวม {0} · สุทธิผู้จัด {1}", formatThb(metrics.grossPaidSatang, true), formatThb(metrics.netOrganizerPayoutSatang, true))
                    : tx("ดูรายละเอียดการชำระเงินตามสิทธิ์บทบาท")}
                </span>
                <div className="cta-inline-row">
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() =>
                      onSelectEventAction(selectedEvent.id, 'evt_participants')
                    }
                  >
                    {tx("ดูรายชื่อนักวิ่ง")}
                  </button>
                  {canViewFinance && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        onSelectEventAction(selectedEvent.id, 'evt_finance')
                      }
                    >
                      <IconLedger size={14} />
                      <span>{tx("เปิดการเงินงานนี้")}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          PRIORITY 1 (P1): KPI CARDS, REGISTRATION TREND, STATUS, REVENUE, UPCOMING
         ===================================================================== */}
      {showP1 && (
        <div className="analytics-priority-block">
          {/* P1.1: KPI CARDS (เห็นภาพรวมทันที) */}
          <div className="analytics-kpi-grid" role="region" aria-label="P1 KPI Cards">
            {/* KPI 1: ยอดผู้สมัครและโควตา */}
            <article className="analytics-kpi-card">
              <div className="kpi-card-top">
                <span className="priority-chip chip-p1">P1 · KPI Card</span>
                <span
                  className={`status-pill ${
                    fillRatePct >= 80 ? 'badge-amber' : 'badge-forest'
                  }`}
                >
                  <IconUsers size={13} />
                  <span>
                    {fillRatePct >= 80
                      ? txf("ใกล้เต็ม ({0}%)", fillRatePct)
                      : txf("ใช้โควตา {0}%", fillRatePct)}
                  </span>
                </span>
              </div>
              <h3>{tx("ผู้สมัครยืนยันสิทธิ์ / โควตารวม")}</h3>
              <div className="kpi-big-figure mono-num">
                <strong>{metrics.confirmedParticipants.toLocaleString('th-TH')}</strong>
                <span className="kpi-denom">
                  / {metrics.totalEventQuota.toLocaleString('th-TH')} {tx(" คน")}
                </span>
              </div>
              <div className="kpi-mini-meter" aria-hidden="true">
                <div
                  className="kpi-mini-fill fill-forest"
                  style={{ width: `${Math.max(4, fillRatePct)}%` }}
                />
              </div>
              <div className="kpi-card-foot">
                <span className="muted-inline mono-num">
                  {tx("รอชำระ ")} {tx(metrics.pendingPaymentReservations)} {tx(" · ว่าง")}{' '}
                  {tx(metrics.openEventQuota)} {tx(" ที่นั่ง")}
                </span>
                <button
                  type="button"
                  className="footer-text-link"
                  onClick={() => onDrillDownStatus('confirmed')}
                >
                  {tx("ดูรายชื่อ ")} <IconArrowRight size={12} />
                </button>
              </div>
            </article>

            {/* KPI 2: แนวโน้มการสมัคร เพิ่มขึ้น/ลดลง */}
            <article className="analytics-kpi-card">
              <div className="kpi-card-top">
                <span className="priority-chip chip-p1">P1 · KPI Card</span>
                <span
                  className={`status-pill ${
                    trendComparison.direction === 'up'
                      ? 'badge-forest'
                      : trendComparison.direction === 'down'
                      ? 'badge-amber'
                      : 'badge-neutral'
                  }`}
                >
                  <IconClock size={13} />
                  <span className="mono-num">
                    {trendComparison.deltaPct >= 0
                      ? txf("+{0}% เพิ่มขึ้น", trendComparison.deltaPct)
                      : txf("{0}% ลดลง", trendComparison.deltaPct)}
                  </span>
                </span>
              </div>
              <h3>{tx("อัตราการสมัครช่วง 7 วันล่าสุด")}</h3>
              <div className="kpi-big-figure mono-num">
                <strong>+{tx(trendComparison.recent7d)}</strong>
                <span className="kpi-denom">{tx("ใบสมัครใหม่")}</span>
              </div>
              <p className="muted-inline">
                {tx("เทียบกับช่วงก่อนหน้า (")}{tx(trendComparison.prevWindow)} {tx(" ใบสมัคร) · ยอดสมัครพุ่งขึ้นช่วงเปิดรับ Early Bird")}
              </p>
              <div className="kpi-card-foot">
                <span className="muted-inline">
                  {tx("รวมใบสมัครทั้งหมด ")} {tx(scopedRegistrations.length)} {tx(" รายการ")}
                </span>
                <button
                  type="button"
                  className="footer-text-link"
                  onClick={() => onDrillDownStatus('pending_payment')}
                >
                  {tx("ตรวจรายการรอจ่าย ")} <IconArrowRight size={12} />
                </button>
              </div>
            </article>

            {/* KPI 3: รายได้และยอดชำระเงิน */}
            <article className="analytics-kpi-card">
              <div className="kpi-card-top">
                <span className="priority-chip chip-p1">P1 · KPI Card</span>
                <span className="status-pill badge-navy">
                  <IconLedger size={13} />
                  <span>{tx("ยอดโอนสุทธิผู้จัด")}</span>
                </span>
              </div>
              <h3>{tx("รายได้สุทธิผู้จัด (หลังหักค่าบริการ/คืนเงิน)")}</h3>
              {canViewFinance ? (
                <>
                  <div className="kpi-big-figure mono-num text-vermilion">
                    <strong>
                      {formatThb(metrics.netOrganizerPayoutSatang, true)}
                    </strong>
                  </div>
                  <p className="muted-inline mono-num">
                    {tx("รับชำระค่าสมัคร ")} {formatThb(metrics.grossPaidSatang, true)} {tx(" · ร้านค้า ")} {formatThb(metrics.merchGrossSalesSatang, true)}
                  </p>
                  <div className="kpi-card-foot">
                    <span className="muted-inline mono-num">
                      {tx("คืนเงินแล้ว ")} {formatThb(metrics.succeededRefundSatang, true)}
                    </span>
                    <button
                      type="button"
                      className="footer-text-link"
                      onClick={() => onDrillDownFinance('payments')}
                    >
                      {tx("ดูสมุดบัญชี ")} <IconArrowRight size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="finance-restricted-note">
                  {tx("สงวนสิทธิ์ดูตัวเลขการเงินเฉพาะเจ้าขององค์กรและฝ่ายการเงิน")}
                </div>
              )}
            </article>

            {/* KPI 4: ความครบถ้วนของข้อมูลและเลข BIB */}
            <article className="analytics-kpi-card">
              <div className="kpi-card-top">
                <span className="priority-chip chip-p1">P1 · KPI Card</span>
                <span
                  className={`status-pill ${
                    statusAndCompleteness.missingBibCount > 0
                      ? 'badge-amber'
                      : 'badge-forest'
                  }`}
                >
                  {statusAndCompleteness.missingBibCount > 0 ? (
                    <IconAlert size={13} />
                  ) : (
                    <IconCheckCircle size={13} />
                  )}
                  <span>
                    {statusAndCompleteness.missingBibCount > 0
                      ? txf("รอเลข BIB {0} คน", statusAndCompleteness.missingBibCount)
                      : tx("ข้อมูลและ BIB ครบ")}
                  </span>
                </span>
              </div>
              <h3>{tx("ความครบถ้วนข้อมูลนักวิ่ง & เลข BIB")}</h3>
              <div className="kpi-big-figure mono-num">
                <strong>{tx(statusAndCompleteness.completenessPct)}%</strong>
                <span className="kpi-denom">
                  ({tx(statusAndCompleteness.completeReadyCount)}/
                  {tx(statusAndCompleteness.confirmed)} {tx(" คนพร้อมเช็กอิน)")}
                </span>
              </div>
              <div className="kpi-mini-meter" aria-hidden="true">
                <div
                  className="kpi-mini-fill fill-navy"
                  style={{
                    width: `${Math.max(4, statusAndCompleteness.completenessPct)}%`,
                  }}
                />
              </div>
              <div className="kpi-card-foot">
                <span className="muted-inline mono-num">
                  {tx("รับอุปกรณ์แล้ว ")} {tx(statusAndCompleteness.pickedUpCount)} {tx(" คน")}
                </span>
                {canCheckIn && scopedEvents[0] && (
                  <button
                    type="button"
                    className="footer-text-link"
                    onClick={() =>
                      onSelectEventAction(scopedEvents[0].id, 'evt_checkin_bib')
                    }
                  >
                    {tx("จัดการ BIB ")} <IconArrowRight size={12} />
                  </button>
                )}
              </div>
            </article>
          </div>

          {/* P1.2 & P1.4: REGISTRATION TREND & REVENUE TREND (2-Column Chart Grid) */}
          <div className="analytics-two-col-grid">
            {/* P1: Registration Trend */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p1">P1 · Chart</span>
                    <h3>{tx("Registration Trend (แนวโน้มยอดสมัครรายช่วงเวลา)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("ติดตามจังหวะการสมัครเพิ่มขึ้นหรือลดลง แยกผู้สมัครที่ชำระเงินยืนยันแล้วและคนที่กำลังถือโควตารอจ่าย")}
                  </p>
                </div>
                <span
                  className={`status-pill ${
                    trendComparison.deltaPct >= 0 ? 'badge-forest' : 'badge-amber'
                  }`}
                >
                  <span className="mono-num">
                    {trendComparison.deltaPct >= 0
                      ? txf("แนวโน้มขาขึ้น +{0}%", trendComparison.deltaPct)
                      : txf("ชะลอตัว {0}%", trendComparison.deltaPct)}
                  </span>
                </span>
              </div>

              <div
                className="vertical-bar-chart"
                role="img"
                aria-label={tx("กราฟแท่งแสดงแนวโน้มยอดสมัครแยกตามช่วงเวลา")}
              >
                {registrationTrendBuckets.map((b) => {
                  const confirmedHeightPct = Math.round(
                    (b.confirmed / maxTrendCount) * 100
                  );
                  const pendingHeightPct = Math.round(
                    (b.pending / maxTrendCount) * 100
                  );
                  return (
                    <div key={b.id} className="vbar-column">
                      <div className="vbar-value mono-num">
                        <strong>{tx(b.total)}</strong> {tx(" คน")}
                      </div>
                      <div className="vbar-track">
                        {b.pending > 0 && (
                          <div
                            className="vbar-seg seg-amber"
                            style={{ height: `${Math.max(10, pendingHeightPct)}%` }}
                            title={txf("รอชำระเงิน: {0} คน", b.pending)}
                          />
                        )}
                        {b.confirmed > 0 && (
                          <div
                            className="vbar-seg seg-forest"
                            style={{
                              height: `${Math.max(12, confirmedHeightPct)}%`,
                            }}
                            title={txf("ยืนยันสิทธิ์แล้ว: {0} คน", b.confirmed)}
                          />
                        )}
                      </div>
                      <div className="vbar-label">{tx(b.shortLabel)}</div>
                      <div className="vbar-sub mono-num">
                        {tx("ยืนยัน ")} {tx(b.confirmed)}
                        {b.pending > 0 ? txf(" · รอ {0}", b.pending) : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="chart-legend-row">
                <span className="legend-item">
                  <span className="legend-swatch swatch-forest" /> {tx(" ยืนยันสิทธิ์แล้ว (ชำระสำเร็จ)")}
                </span>
                <span className="legend-item">
                  <span className="legend-swatch swatch-amber" /> {tx(" กันที่นั่งรอชำระเงิน")}
                </span>
              </div>
            </section>

            {/* P1: Revenue Trend */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p1">P1 · Chart</span>
                    <h3>{tx("Revenue Trend (แนวโน้มรายได้และยอดโอนผู้จัด)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("เปรียบเทียบรายรับค่าสมัคร ยอดโอนสุทธิให้ผู้จัด และยอดขายสินค้าที่ระลึกหน้าร้านในแต่ละช่วงเวลา")}
                  </p>
                </div>
                {canViewFinance && (
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => onDrillDownFinance('payouts')}
                  >
                    {tx("ดูตารางรอบโอนเงิน")}
                  </button>
                )}
              </div>

              {canViewFinance ? (
                <>
                  <div
                    className="vertical-bar-chart"
                    role="img"
                    aria-label={tx("กราฟแท่งแสดงแนวโน้มรายได้แยกตามช่วงเวลา")}
                  >
                    {registrationTrendBuckets.map((b) => {
                      const netPct = Math.round(
                        (b.netSatang / maxRevenueSatang) * 100
                      );
                      const merchPct = Math.round(
                        (b.merchSatang / maxRevenueSatang) * 100
                      );
                      const totalBucketSatang = b.grossSatang + b.merchSatang;

                      return (
                        <div key={b.id} className="vbar-column">
                          <div className="vbar-value mono-num">
                            <strong>{formatThb(totalBucketSatang)}</strong>
                          </div>
                          <div className="vbar-track">
                            {b.merchSatang > 0 && (
                              <div
                                className="vbar-seg seg-navy"
                                style={{ height: `${Math.max(10, merchPct)}%` }}
                                title={txf("ยอดขายสินค้าหน้าร้าน: {0}", formatThb(b.merchSatang, true))}
                              />
                            )}
                            {b.netSatang > 0 && (
                              <div
                                className="vbar-seg seg-vermilion"
                                style={{ height: `${Math.max(12, netPct)}%` }}
                                title={txf("ยอดสุทธิผู้จัด: {0}", formatThb(b.netSatang, true))}
                              />
                            )}
                          </div>
                          <div className="vbar-label">{tx(b.shortLabel)}</div>
                          <div className="vbar-sub mono-num">
                            {tx("สุทธิ ")} {formatThb(b.netSatang)}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="chart-legend-row">
                    <span className="legend-item">
                      <span className="legend-swatch swatch-vermilion" /> {tx(" รายได้ค่าสมัครสุทธิผู้จัด")}
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch swatch-navy" /> {tx(" ยอดขายเสื้อ/เหรียญหน้าร้าน")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="finance-restricted-note">
                  {tx("บทบาทปัจจุบันไม่มีสิทธิ์ดูกราฟแนวโน้มรายได้ (เปิดเฉพาะเจ้าขององค์กรและฝ่ายการเงิน)")}
                </div>
              )}
            </section>
          </div>

          {/* P1.3 & P1.5: REGISTRATION STATUS + UPCOMING EVENTS */}
          <div className="analytics-two-col-grid">
            {/* P1: Registration Status & Data Completeness */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p1">P1 · Chart</span>
                    <h3>{tx("Registration Status & ความครบถ้วนของข้อมูล")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("แยกสถานะใบสมัครออกจากสถานะการเงินและสถานะความพร้อมของข้อมูล/เลข BIB เพื่อกดเข้าไปจัดการได้ทันที")}
                  </p>
                </div>
              </div>

              {/* Stacked Proportional Bar */}
              <div
                className="stacked-status-bar"
                role="img"
                aria-label={tx("สัดส่วนสถานะใบสมัครทั้งหมด")}
              >
                {statusAndCompleteness.confirmed > 0 && (
                  <div
                    className="stacked-seg seg-forest"
                    style={{
                      width: `${Math.max(
                        12,
                        Math.round(
                          (statusAndCompleteness.confirmed /
                            Math.max(1, statusAndCompleteness.total)) *
                            100
                        )
                      )}%`,
                    }}
                  >
                    {tx("ยืนยัน ")} {tx(statusAndCompleteness.confirmed)}
                  </div>
                )}
                {statusAndCompleteness.pending > 0 && (
                  <div
                    className="stacked-seg seg-amber"
                    style={{
                      width: `${Math.max(
                        12,
                        Math.round(
                          (statusAndCompleteness.pending /
                            Math.max(1, statusAndCompleteness.total)) *
                            100
                        )
                      )}%`,
                    }}
                  >
                    {tx("รอจ่าย ")} {tx(statusAndCompleteness.pending)}
                  </div>
                )}
                {statusAndCompleteness.cancelledOrRefunded > 0 && (
                  <div
                    className="stacked-seg seg-danger"
                    style={{
                      width: `${Math.max(
                        12,
                        Math.round(
                          (statusAndCompleteness.cancelledOrRefunded /
                            Math.max(1, statusAndCompleteness.total)) *
                            100
                        )
                      )}%`,
                    }}
                  >
                    {tx("คืนเงิน/ยกเลิก ")} {tx(statusAndCompleteness.cancelledOrRefunded)}
                  </div>
                )}
              </div>

              <div className="status-breakdown-list">
                <div className="status-breakdown-item">
                  <div>
                    <span className="legend-swatch swatch-forest" />
                    <strong>{tx("ยืนยันสิทธิ์และข้อมูลครบถ้วน (มีเลข BIB พร้อมเช็กอิน)")}</strong>
                  </div>
                  <div className="cta-inline-row">
                    <strong className="mono-num">
                      {tx(statusAndCompleteness.completeReadyCount)} {tx(" คน")}
                    </strong>
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => onDrillDownStatus('confirmed')}
                    >
                      {tx("ดูรายชื่อ")}
                    </button>
                  </div>
                </div>

                <div className="status-breakdown-item">
                  <div>
                    <span className="legend-swatch swatch-amber" />
                    <strong>{tx("ชำระเงินสำเร็จแต่ยังไม่ได้กำหนดเลข BIB")}</strong>
                  </div>
                  <div className="cta-inline-row">
                    <strong className="mono-num text-amber">
                      {tx(statusAndCompleteness.missingBibCount)} {tx(" คน")}
                    </strong>
                    {canCheckIn && scopedEvents[0] && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() =>
                          onSelectEventAction(
                            scopedEvents[0].id,
                            'evt_checkin_bib'
                          )
                        }
                      >
                        {tx("ไปกำหนด BIB")}
                      </button>
                    )}
                  </div>
                </div>

                <div className="status-breakdown-item">
                  <div>
                    <span className="legend-swatch swatch-navy" />
                    <strong>{tx("กำลังถือโควตารอชำระเงิน (Pending Payment)")}</strong>
                  </div>
                  <div className="cta-inline-row">
                    <strong className="mono-num">
                      {tx(statusAndCompleteness.pending)} {tx(" คน")}
                    </strong>
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => onDrillDownStatus('pending_payment')}
                    >
                      {tx("ตรวจสถานะ")}
                    </button>
                  </div>
                </div>

                <div className="status-breakdown-item">
                  <div>
                    <span className="legend-swatch swatch-danger" />
                    <strong>{tx("ขอคืนเงิน / คืนเงินแล้ว / ยกเลิกสิทธิ์")}</strong>
                  </div>
                  <div className="cta-inline-row">
                    <strong className="mono-num">
                      {tx(statusAndCompleteness.cancelledOrRefunded)} {tx(" รายการ")}
                    </strong>
                    {canViewFinance && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => onDrillDownFinance('refunds')}
                      >
                        {tx("จัดการคืนเงิน")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* P1: Upcoming Events Readiness */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p1">P1 · Chart</span>
                    <h3>{tx("Upcoming Events (ไทม์ไลน์และความพร้อมงานที่กำลังจะถึง)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("เรียงตามกำหนดวันแข่งขัน พร้อมหลอดโควตา สถานะความพร้อมก่อนวันงาน และปุ่มควบคุมด่วน")}
                  </p>
                </div>
              </div>

              <div className="upcoming-events-chart-list">
                {scopedEvents
                  .slice()
                  .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
                  .map((ev) => {
                    const evRegs = registrations.filter(
                      (r) => r.eventId === ev.id
                    );
                    const confirmed = evRegs.filter(
                      (r) => r.registrationStatus === 'confirmed'
                    ).length;
                    const pending = evRegs.filter(
                      (r) => r.registrationStatus === 'pending_payment'
                    ).length;
                    const usedPct = Math.min(
                      100,
                      Math.round(
                        ((confirmed + pending) /
                          Math.max(1, ev.totalEventQuota)) *
                          100
                      )
                    );
                    const passedChecks = ev.readinessChecks.filter(
                      (c) => c.passed
                    ).length;
                    const totalChecks = Math.max(1, ev.readinessChecks.length);

                    return (
                      <div key={ev.id} className="upcoming-event-bar-card">
                        <div className="upcoming-event-top">
                          <div>
                            <strong>{tx(ev.titleTh)}</strong>
                            <div className="muted-inline">
                              <IconCalendar size={13} />{' '}
                              <span className="mono-num">{tx(ev.eventDate)}</span> ·{' '}
                              {tx(ev.province)} {tx(" · Checklist ผ่าน")}{' '}
                              <span className="mono-num">
                                {tx(passedChecks)}/{tx(totalChecks)}
                              </span>{' '}
                              {tx("ข้อ")}
                            </div>
                          </div>
                          <EventStatusBadge status={ev.status} />
                        </div>

                        <div className="hbar-meter-row">
                          <div className="hbar-track">
                            <div
                              className="hbar-fill fill-forest"
                              style={{ width: `${Math.max(4, usedPct)}%` }}
                            />
                          </div>
                          <span className="mono-num hbar-pct-label">
                            {confirmed + pending}/{tx(ev.totalEventQuota)} {tx(" คน (")}{tx(usedPct)}%)
                          </span>
                        </div>

                        <div className="cta-inline-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              onSelectEventAction(ev.id, 'evt_overview')
                            }
                          >
                            <IconFlag size={14} />
                            <span>{tx("ควบคุมงานนี้")}</span>
                          </button>
                          {canManageEventConfig && (
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() =>
                                onSelectEventAction(ev.id, 'evt_pricing_quota')
                              }
                            >
                              {tx("ปรับโควตา / คำถามสมัคร")}
                            </button>
                          )}
                          {canCheckIn && ev.status === 'published' && (
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() =>
                                onSelectEventAction(ev.id, 'evt_checkin_bib')
                              }
                            >
                              <IconQr size={14} />
                              <span>{tx("เช็กอิน BIB")}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          PRIORITY 2 (P2): DISTANCE BREAKDOWN, EVENT PERFORMANCE, CAPACITY
         ===================================================================== */}
      {showP2 && (
        <div className="analytics-priority-block">
          <div className="analytics-two-col-grid">
            {/* P2.1: Distance Breakdown */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p2">P2 · Chart</span>
                    <h3>{tx("Distance Breakdown (สัดส่วนผู้สมัครแยกตามระยะทาง)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("ใช้เทียบรุ่นระยะทางที่ได้รับความนิยมเพื่อวางแผนจุดให้น้ำ เหรียญ Finisher และทีมดูแลเส้นทาง")}
                  </p>
                </div>
              </div>

              <div className="hbar-chart-stack">
                {distanceBreakdown.map((d) => {
                  const used = d.confirmed + d.pending;
                  const pct = Math.min(
                    100,
                    Math.round((used / Math.max(1, d.quota)) * 100)
                  );
                  return (
                    <div key={d.label} className="hbar-item">
                      <div className="hbar-item-head">
                        <div>
                          <span
                            className={`category-bib-chip tone-${d.colorTag}`}
                          >
                            <strong>{tx(d.code)}</strong>
                          </span>{' '}
                          <strong>{tx(d.label)}</strong>
                        </div>
                        <span className="mono-num">
                          {tx("ยืนยัน ")} <strong>{tx(d.confirmed)}</strong>
                          {d.pending > 0 ? txf(" (+รอจ่าย {0})", d.pending) : ''} {tx(" / โควตา")}{' '}
                          {tx(d.quota)} {tx(" คน (")}{tx(pct)}%)
                        </span>
                      </div>
                      <div className="hbar-track">
                        <div
                          className={`hbar-fill fill-${d.colorTag}`}
                          style={{ width: `${Math.max(5, pct)}%` }}
                        />
                      </div>
                      {canViewFinance && (
                        <div className="muted-inline mono-num">
                          {tx("ยอดรับชำระระยะนี้: ")} {formatThb(d.revenueSatang, true)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* P2.3: Capacity & Shirt Stock Utilization */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p2">P2 · Chart</span>
                    <h3>{tx("Capacity & Shirt Stock (ควบคุมเพดานโควตาและสต็อกเสื้อ)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("ติดตามอัตราการใช้โควตาที่นั่งและสต็อกเสื้อรายไซส์เพื่อป้องกันการขายเกินจำนวนที่มีจริง")}
                  </p>
                </div>
                {canManageEventConfig && scopedEvents[0] && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      onSelectEventAction(
                        scopedEvents[0].id,
                        'evt_pricing_quota'
                      )
                    }
                  >
                    <IconBib size={14} />
                    <span>{tx("ปรับเพิ่ม/ลดโควตา")}</span>
                  </button>
                )}
              </div>

              <div className="capacity-gauge-banner">
                <div>
                  <strong>{tx("อัตราการครองโควตารวม (Confirmed + Reserved)")}</strong>
                  <div className="muted-inline mono-num">
                    {tx("ใช้แล้ว")}{' '}
                    {metrics.confirmedParticipants +
                      metrics.pendingPaymentReservations}{' '}
                    {tx("คน · เหลือที่นั่งว่าง ")} {tx(metrics.openEventQuota)} {tx(" คน จากเพดาน")}{' '}
                    {tx(metrics.totalEventQuota)} {tx(" คน")}
                  </div>
                </div>
                <strong className="mono-num capacity-big-pct">
                  {tx(fillRatePct)}%
                </strong>
              </div>

              {/* Shirt Size Stock Bars */}
              <div className="shirt-capacity-grid">
                {(['XS', 'S', 'M', 'L', 'XL', '2XL'] as const).map((sz) => {
                  const totalSz = scopedEvents.reduce((acc, ev) => {
                    const row = ev.shirtStocks.find((s) => s.size === sz);
                    return acc + (row?.total ?? 0);
                  }, 0);
                  const usedSz = scopedEvents.reduce((acc, ev) => {
                    const row = ev.shirtStocks.find((s) => s.size === sz);
                    return acc + (row?.reservedOrConfirmed ?? 0);
                  }, 0);
                  const szPct =
                    totalSz > 0
                      ? Math.min(100, Math.round((usedSz / totalSz) * 100))
                      : 0;

                  return (
                    <div key={sz} className="shirt-cap-box">
                      <div className="shirt-cap-top">
                        <strong>{tx("ไซส์")} {tx(sz)}</strong>
                        <span className="mono-num">{tx(szPct)}%</span>
                      </div>
                      <div className="hbar-track">
                        <div
                          className={`hbar-fill ${
                            szPct >= 85 ? 'fill-amber' : 'fill-navy'
                          }`}
                          style={{ width: `${Math.max(4, szPct)}%` }}
                        />
                      </div>
                      <span className="muted-inline mono-num">
                        {tx("ใช้ ")} {tx(usedSz)} / {tx(totalSz)} {tx(" ตัว")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* P2.2: Event Performance Comparison (แสดงเมื่อมีงานในองค์กร) */}
          <section className="clean-panel chart-card">
            <div className="chart-card-head">
              <div>
                <div className="chart-title-inline">
                  <span className="priority-chip chip-p2">P2 · Chart</span>
                  <h3>{tx("Event Performance (เปรียบเทียบผลงานแต่ละงานวิ่งในองค์กร)")}</h3>
                </div>
                <p className="muted-inline">
                  {tx("เปรียบเทียบอัตราการเติมเต็มโควตา ยอดผู้สมัคร รายได้สุทธิผู้จัด และยอดขายสินค้าที่ระลึกของแต่ละงานวิ่ง")}
                </p>
              </div>
            </div>

            <div className="hbar-chart-stack">
              {eventPerformanceRows.map((row) => (
                <div key={row.event.id} className="perf-comparison-row">
                  <div className="perf-event-info">
                    <div className="cta-inline-row">
                      <strong>{tx(row.event.titleTh)}</strong>
                      <EventStatusBadge status={row.event.status} />
                    </div>
                    <div className="muted-inline mono-num">
                      {tx(row.event.code)} {tx(" · วันงาน")} {tx(row.event.eventDate)} {tx(" · ยืนยัน")}{' '}
                      {tx(row.confirmed)}/{tx(row.event.totalEventQuota)} {tx(" คน")}
                    </div>
                  </div>

                  <div className="perf-bars-col">
                    <div className="hbar-meter-row">
                      <span className="muted-inline">{tx("อัตราเติมเต็มโควตา")}</span>
                      <div className="hbar-track">
                        <div
                          className="hbar-fill fill-forest"
                          style={{ width: `${Math.max(4, row.fillPct)}%` }}
                        />
                      </div>
                      <strong className="mono-num">{tx(row.fillPct)}%</strong>
                    </div>
                    {canViewFinance && (
                      <div className="perf-finance-metrics mono-num">
                        <span>
                          {tx("รับชำระรวม:")}{' '}
                          <strong>{formatThb(row.grossSatang, true)}</strong>
                        </span>
                        <span>
                          {tx("ยอดโอนสุทธิผู้จัด:")}{' '}
                          <strong className="text-vermilion">
                            {formatThb(row.netPayoutSatang, true)}
                          </strong>
                        </span>
                        <span>
                          {tx("ร้านค้าของที่ระลึก:")}{' '}
                          <strong>{formatThb(row.merchSatang, true)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="perf-action-col">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        onSelectEventAction(
                          row.event.id,
                          scopeMode === 'event'
                            ? 'evt_participants'
                            : 'evt_overview'
                        )
                      }
                    >
                      <span>
                        {scopeMode === 'event'
                          ? tx("ดูผู้สมัครงานนี้")
                          : tx("เปิดดูงานนี้")}
                      </span>
                      <IconArrowRight size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          PRIORITY 3 (P3): DEMOGRAPHICS & PAYMENT METHOD
         ===================================================================== */}
      {showP3 && (
        <div className="analytics-priority-block">
          <div className="analytics-two-col-grid">
            {/* P3.1: Demographics */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p3">P3 · Chart</span>
                    <h3>{tx("Demographics (วิเคราะห์ช่วงอายุและเพศของนักวิ่ง · ข้อมูลสาธิต)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("วิเคราะห์โครงสร้างกลุ่มเป้าหมายจากฐานผู้สมัคร (")}{tx(demographicsAndPayments.totalCount)} {tx(" คน) เพื่อวางแผนประชาสัมพันธ์และไซส์เสื้อ")}
                  </p>
                </div>
              </div>

              <div className="demo-subgrid">
                <div>
                  <h4>{tx("สัดส่วนตามช่วงอายุ")}</h4>
                  <div className="hbar-chart-stack">
                    {demographicsAndPayments.ageGroups.map((ag) => (
                      <div key={ag.bracket} className="hbar-item">
                        <div className="hbar-item-head">
                          <span>{tx(ag.bracket)}</span>
                          <span className="mono-num">
                            <strong>{tx(ag.count)}</strong> {tx(" คน (")}{tx(ag.pct)}%)
                          </span>
                        </div>
                        <div className="hbar-track">
                          <div
                            className="hbar-fill fill-navy"
                            style={{ width: `${Math.max(4, ag.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4>{tx("สัดส่วนตามเพศ")}</h4>
                  <div className="hbar-chart-stack">
                    {demographicsAndPayments.genders.map((g) => (
                      <div key={g.gender} className="hbar-item">
                        <div className="hbar-item-head">
                          <span>{tx(g.gender)}</span>
                          <span className="mono-num">
                            <strong>{tx(g.count)}</strong> {tx(" คน (")}{tx(g.pct)}%)
                          </span>
                        </div>
                        <div className="hbar-track">
                          <div
                            className="hbar-fill fill-forest"
                            style={{ width: `${Math.max(4, g.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* P3.2: Payment Method */}
            <section className="clean-panel chart-card">
              <div className="chart-card-head">
                <div>
                  <div className="chart-title-inline">
                    <span className="priority-chip chip-p3">P3 · Chart</span>
                    <h3>{tx("Payment Method (วิเคราะห์ช่องทางชำระเงิน · ข้อมูลสาธิต)")}</h3>
                  </div>
                  <p className="muted-inline">
                    {tx("เปรียบเทียบช่องทางชำระเงินที่นักวิ่งเลือกใช้และอัตราการชำระสำเร็จของแต่ละช่องทาง")}
                  </p>
                </div>
              </div>

              <div className="hbar-chart-stack">
                {demographicsAndPayments.paymentChannels.map((ch) => (
                  <div key={ch.key} className="hbar-item">
                    <div className="hbar-item-head">
                      <strong>{tx(ch.label)}</strong>
                      <span className="mono-num">
                        <strong>{tx(ch.count)}</strong> {tx(" รายการ (")}{tx(ch.pct)}%)
                      </span>
                    </div>
                    <div className="hbar-track">
                      <div
                        className={`hbar-fill fill-${ch.tone}`}
                        style={{ width: `${Math.max(5, ch.pct)}%` }}
                      />
                    </div>
                    <div className="muted-inline mono-num">
                      {tx("ชำระสำเร็จ ")} {tx(ch.succeededCount)}/{tx(ch.count)} {tx(" รายการ")}
                      {canViewFinance
                        ? txf(" · ยอดรับชำระ {0}", formatThb(ch.amountSatang, true))
                        : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </section>
  );
};
