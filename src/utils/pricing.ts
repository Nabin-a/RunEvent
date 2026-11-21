import {
  FeeBearerPolicy,
  MerchOrderRecord,
  PriceTier,
  RaceCategory,
  RaceEvent,
  RegistrationRecord,
  TimeWindowFilter,
} from '../types';
import { tx } from '../i18n';

/**
 * Simulated platform fee schedule for mockup demonstration only.
 * Formula: 5% of base registration fee + 15.00 THB (1,500 satang) per paid registration.
 */
export const DEMO_FEE_PERCENT_BPS = 500;
export const DEMO_FEE_FIXED_SATANG = 1500;
export const DEMO_REFERENCE_NOW = new Date('2026-11-17T09:30:00+07:00');

export interface FeeQuote {
  baseSatang: number;
  platformFeeSatang: number;
  runnerFeeSatang: number;
  organizerFeeSatang: number;
  runnerNetPaySatang: number;
  organizerNetReceiveSatang: number;
}

export function calculateFeeQuote(
  baseSatang: number,
  policy: FeeBearerPolicy
): FeeQuote {
  const variableFee = Math.round((baseSatang * DEMO_FEE_PERCENT_BPS) / 10000);
  const platformFeeSatang =
    baseSatang > 0 ? variableFee + DEMO_FEE_FIXED_SATANG : 0;

  let runnerFeeSatang = 0;
  let organizerFeeSatang = 0;

  if (policy === 'runner_pays') {
    runnerFeeSatang = platformFeeSatang;
  } else if (policy === 'organizer_absorbs') {
    organizerFeeSatang = platformFeeSatang;
  } else {
    runnerFeeSatang = Math.round(platformFeeSatang / 2);
    organizerFeeSatang = platformFeeSatang - runnerFeeSatang;
  }

  return {
    baseSatang,
    platformFeeSatang,
    runnerFeeSatang,
    organizerFeeSatang,
    runnerNetPaySatang: baseSatang + runnerFeeSatang,
    organizerNetReceiveSatang: baseSatang - organizerFeeSatang,
  };
}

export function formatThb(satang: number, showDecimals = false): string {
  const baht = satang / 100;
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(baht);
}

export function getCurrentTier(category: RaceCategory): PriceTier {
  return (
    category.priceTiers.find((t) => t.isCurrent) ?? category.priceTiers[0]
  );
}

export function isWithinTimeWindow(
  isoDate: string | null,
  window: TimeWindowFilter
): boolean {
  if (!isoDate) return false;
  if (window === 'all_time') return true;
  const target = new Date(isoDate).getTime();
  const now = DEMO_REFERENCE_NOW.getTime();
  const days = window === 'last_7d' ? 7 : 30;
  return now - target <= days * 24 * 60 * 60 * 1000 && target <= now + 86400000;
}

export interface ScopedLedgerMetrics {
  confirmedParticipants: number;
  pendingPaymentReservations: number;
  openEventQuota: number;
  totalEventQuota: number;
  grossPaidSatang: number;
  succeededRefundSatang: number;
  pendingRefundCount: number;
  pendingRefundSatang: number;
  platformRevenueSatang: number;
  netOrganizerPayoutSatang: number;
  merchGrossSalesSatang: number;
  merchShippingSatang: number;
  merchOrderCount: number;
  kitPickedUpCount: number;
  unassignedBibCount: number;
}

export function computeMetrics(
  events: RaceEvent[],
  registrations: RegistrationRecord[],
  merchOrders: MerchOrderRecord[],
  window: TimeWindowFilter
): ScopedLedgerMetrics {
  const eventIds = new Set(events.map((e) => e.id));
  const scopedRegs = registrations.filter((r) => eventIds.has(r.eventId));
  const scopedMerch = merchOrders.filter(
    (m) =>
      eventIds.has(m.eventId) &&
      m.paymentStatus === 'succeeded' &&
      isWithinTimeWindow(m.createdAt, window)
  );

  const totalEventQuota = events.reduce((acc, e) => acc + e.totalEventQuota, 0);

  const lifetimeConfirmed = scopedRegs.filter(
    (r) => r.registrationStatus === 'confirmed'
  ).length;
  const lifetimeReserved = scopedRegs.filter(
    (r) => r.registrationStatus === 'pending_payment'
  ).length;
  const openEventQuota = Math.max(
    0,
    totalEventQuota - lifetimeConfirmed - lifetimeReserved
  );

  const confirmedInWindow = scopedRegs.filter(
    (r) =>
      r.registrationStatus === 'confirmed' &&
      isWithinTimeWindow(r.createdAt, window)
  );

  const paidInWindow = scopedRegs.filter(
    (r) =>
      r.paymentStatus === 'succeeded' && isWithinTimeWindow(r.paidAt, window)
  );

  const grossPaidSatang = paidInWindow.reduce(
    (sum, r) => sum + r.snapshotTotalChargedSatang,
    0
  );

  const refundedInWindow = scopedRegs.filter(
    (r) =>
      r.refundStatus === 'succeeded' &&
      isWithinTimeWindow(r.refundedAt ?? r.paidAt, window)
  );

  const succeededRefundSatang = refundedInWindow.reduce(
    (sum, r) => sum + r.snapshotRefundedSatang,
    0
  );

  const pendingRefundRegs = scopedRegs.filter(
    (r) =>
      r.refundStatus === 'requested' ||
      r.refundStatus === 'approved' ||
      r.refundStatus === 'processing'
  );

  const pendingRefundSatang = pendingRefundRegs.reduce(
    (sum, r) => sum + r.snapshotBaseSatang,
    0
  );

  let platformRevenueSatang = 0;
  let netOrganizerPayoutSatang = 0;

  for (const r of paidInWindow) {
    const refundDeduction =
      r.refundStatus === 'succeeded' ? r.snapshotRefundedSatang : 0;
    const organizerShareBeforeRefund =
      r.snapshotBaseSatang - r.snapshotOrganizerFeeSatang;
    const organizerNetForOrder = Math.max(
      0,
      organizerShareBeforeRefund - refundDeduction
    );
    const platformRetainedForOrder = Math.max(
      0,
      r.snapshotTotalChargedSatang - refundDeduction - organizerNetForOrder
    );

    netOrganizerPayoutSatang += organizerNetForOrder;
    platformRevenueSatang += platformRetainedForOrder;
  }

  const merchShippingSatang = scopedMerch.reduce(
    (sum, m) => sum + m.shippingSatang,
    0
  );
  const merchGrossSalesSatang = scopedMerch.reduce(
    (sum, m) => sum + m.unitPriceSatang * m.quantity,
    0
  );

  const kitPickedUpCount = scopedRegs.filter(
    (r) => r.fulfillmentStatus === 'kit_picked_up'
  ).length;

  const unassignedBibCount = scopedRegs.filter(
    (r) => r.registrationStatus === 'confirmed' && !r.bibNumber
  ).length;

  return {
    confirmedParticipants:
      window === 'all_time' ? lifetimeConfirmed : confirmedInWindow.length,
    pendingPaymentReservations: lifetimeReserved,
    openEventQuota,
    totalEventQuota,
    grossPaidSatang,
    succeededRefundSatang,
    pendingRefundCount: pendingRefundRegs.length,
    pendingRefundSatang,
    platformRevenueSatang,
    netOrganizerPayoutSatang,
    merchGrossSalesSatang,
    merchShippingSatang,
    merchOrderCount: scopedMerch.length,
    kitPickedUpCount,
    unassignedBibCount,
  };
}

export function feePolicyLabel(policy: FeeBearerPolicy): string {
  switch (policy) {
    case 'runner_pays':
      return tx('นักวิ่งรับภาระค่าบริการ (แสดงราคาสุทธิก่อนจ่าย)');
    case 'organizer_absorbs':
      return tx('ผู้จัดรับภาระค่าบริการ (นักวิ่งจ่ายตามราคาป้าย)');
    case 'split_50_50':
      return tx('แบ่งรับภาระค่าบริการ 50 / 50');
  }
}

export function sellerModelLabel(
  model: 'organizer_self_sell' | 'kratai_produce_bulk' | 'kratai_full_service'
): string {
  switch (model) {
    case 'organizer_self_sell':
      return tx('ผู้จัดนำสินค้ามาขายและจัดส่งเอง (กระต่าย ให้หน้าร้านและรายงาน)');
    case 'kratai_produce_bulk':
      return tx('ให้ กระต่าย ผลิตตามยอดอนุมัติ ส่งล็อตใหญ่ให้ผู้จัดแจกจ่าย');
    case 'kratai_full_service':
      return tx('กระต่าย ดูแลครบวงจร (รับพรีออเดอร์ ผลิต แพ็ก และจัดส่งถึงผู้ซื้อ)');
  }
}
