import React from 'react';
import { TimeWindowFilter } from '../types';
import { formatThb, ScopedLedgerMetrics } from '../utils/pricing';
import { IconArrowRight, IconBag } from './Icons';

import { tx, txf } from '../i18n';
interface BibLedgerStripProps {
  scopeTitle: string;
  scopeCode: string;
  metrics: ScopedLedgerMetrics;
  timeWindow: TimeWindowFilter;
  canViewFinance: boolean;
  onDrillDown: (
    target:
      | 'confirmed'
      | 'pending_payment'
      | 'payments'
      | 'refunds'
      | 'payouts'
      | 'merch'
  ) => void;
}

const windowLabel: Record<TimeWindowFilter, string> = {
  all_time: 'ตลอดอายุงาน',
  last_30d: '30 วันล่าสุด',
  last_7d: '7 วันล่าสุด',
};

export const BibLedgerStrip: React.FC<BibLedgerStripProps> = ({
  scopeTitle,
  scopeCode,
  metrics,
  timeWindow,
  canViewFinance,
  onDrillDown,
}) => {
  const total = Math.max(1, metrics.totalEventQuota);
  const confirmedPct = Math.min(
    100,
    Math.round((metrics.confirmedParticipants / total) * 100)
  );
  const reservedPct = Math.min(
    100 - confirmedPct,
    Math.round((metrics.pendingPaymentReservations / total) * 100)
  );

  return (
    <section
      className="summary-ledger-strip"
      aria-label={tx("สรุปที่นั่งผู้สมัครและสมการยอดเงินที่ตรวจสอบที่มาได้")}
    >
      <div className="summary-strip-head">
        <div className="summary-strip-title">
          <span className="mono-code">{tx(scopeCode)}</span>
          <strong>{tx(scopeTitle)}</strong>
        </div>
        <span className="time-basis-pill">
          {tx("ช่วงเวลาคำนวณเงิน: ")} {tx(windowLabel[timeWindow])} {tx(" (คลิกตัวเลขเพื่อดูรายการต้นทาง)")}
        </span>
      </div>

      <div className="summary-strip-grid">
        {/* LEFT: QUOTA EXPLAINED CLEARLY */}
        <div className="summary-quota-col">
          <div className="summary-col-header">
            <h3>{tx("สัดส่วนที่นั่งผู้เข้าแข่งขัน (โควตา)")}</h3>
            <span className="mono-num muted-inline">
              {metrics.totalQuotaEnabled ? (
                <>
                  {tx("เพดานรับรวม ")} {metrics.totalEventQuota.toLocaleString('th-TH')} {tx(" คน")}
                </>
              ) : (
                tx("ปิดโควตารวม — ไม่จำกัดยอดรวม ใช้โควตารายระยะ")
              )}
            </span>
          </div>

          {metrics.totalQuotaEnabled && (
          <div
            className="quota-track-bar"
            role="img"
            aria-label={txf("ยืนยันสิทธิ์แล้ว {0} คน, กันที่นั่งรอชำระ {1} คน, ว่าง {2} ที่นั่ง", metrics.confirmedParticipants, metrics.pendingPaymentReservations, metrics.openEventQuota)}
          >
            <div
              className="quota-seg-confirmed"
              style={{
                width: `${Math.max(
                  confirmedPct,
                  metrics.confirmedParticipants > 0 ? 6 : 0
                )}%`,
              }}
            />
            <div
              className="quota-seg-reserved"
              style={{
                width: `${Math.max(
                  reservedPct,
                  metrics.pendingPaymentReservations > 0 ? 4 : 0
                )}%`,
              }}
            />
          </div>
          )}

          <div className="quota-cards-row">
            <button
              type="button"
              className="metric-drill-btn"
              onClick={() => onDrillDown('confirmed')}
            >
              <span className="metric-num mono-num text-forest">
                {metrics.confirmedParticipants.toLocaleString('th-TH')}
              </span>
              <span className="metric-label">
                {tx("ยืนยันสิทธิ์แล้ว ")} <IconArrowRight size={12} />
              </span>
            </button>

            <button
              type="button"
              className="metric-drill-btn"
              onClick={() => onDrillDown('pending_payment')}
            >
              <span className="metric-num mono-num text-amber">
                {metrics.pendingPaymentReservations.toLocaleString('th-TH')}
              </span>
              <span className="metric-label">
                {tx("กันที่นั่งรอจ่าย ")} <IconArrowRight size={12} />
              </span>
            </button>

            {metrics.totalQuotaEnabled && (
              <div className="metric-static-cell">
                <span className="metric-num mono-num">
                  {metrics.openEventQuota.toLocaleString('th-TH')}
                </span>
                <span className="metric-label">{tx("ที่นั่งว่างคงเหลือ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: FINANCIAL EQUATION EXPLAINED CLEARLY */}
        <div className="summary-finance-col">
          <div className="summary-col-header">
            <h3>{tx("สมการยอดเงินค่าสมัครและยอดโอนให้ผู้จัด")}</h3>
            <span className="muted-inline">{tx("สกุลเงิน THB (แยกจากยอดขายสินค้าหน้าร้าน)")}</span>
          </div>

          {canViewFinance ? (
            <>
              <div className="ledger-equation-row">
                <button
                  type="button"
                  className="ledger-term-btn"
                  onClick={() => onDrillDown('payments')}
                >
                  <span className="ledger-term-val mono-num">
                    {formatThb(metrics.grossPaidSatang, true)}
                  </span>
                  <span className="ledger-term-lbl">
                    {tx("รับชำระค่าสมัคร ")} <IconArrowRight size={12} />
                  </span>
                </button>

                <span className="ledger-operator" aria-hidden="true">
                  −
                </span>

                <button
                  type="button"
                  className="ledger-term-btn"
                  onClick={() => onDrillDown('refunds')}
                >
                  <span className="ledger-term-val mono-num text-danger">
                    {formatThb(metrics.succeededRefundSatang, true)}
                  </span>
                  <span className="ledger-term-lbl">
                    {tx("คืนเงินสำเร็จ ")} <IconArrowRight size={12} />
                  </span>
                </button>

                <span className="ledger-operator" aria-hidden="true">
                  −
                </span>

                <button
                  type="button"
                  className="ledger-term-btn"
                  onClick={() => onDrillDown('payouts')}
                >
                  <span className="ledger-term-val mono-num text-navy">
                    {formatThb(metrics.platformRevenueSatang, true)}
                  </span>
                  <span className="ledger-term-lbl">
                    {tx("ค่าบริการระบบ ")} <IconArrowRight size={12} />
                  </span>
                </button>

                <span className="ledger-operator" aria-hidden="true">
                  =
                </span>

                <button
                  type="button"
                  className="ledger-term-btn ledger-term-payout"
                  onClick={() => onDrillDown('payouts')}
                >
                  <span className="ledger-term-val mono-num text-vermilion">
                    {formatThb(metrics.netOrganizerPayoutSatang, true)}
                  </span>
                  <span className="ledger-term-lbl">
                    {tx("ยอดโอนให้ผู้จัดสุทธิ ")} <IconArrowRight size={12} />
                  </span>
                </button>
              </div>

              <div className="merch-separate-bar">
                <span className="muted-inline">
                  <IconBag size={14} /> {tx(" ยอดขายสินค้าหน้าร้านแยกบัญชี (")}
                  <span className="mono-num">{tx(metrics.merchOrderCount)}</span>{' '}
                  {tx("ออเดอร์): ค่าสินค้า")}{' '}
                  <strong className="mono-num">
                    {formatThb(metrics.merchGrossSalesSatang, true)}
                  </strong>{' '}
                  {tx("+ ค่าจัดส่ง")}{' '}
                  <strong className="mono-num">
                    {formatThb(metrics.merchShippingSatang, true)}
                  </strong>
                </span>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => onDrillDown('merch')}
                >
                  {tx("ดูออเดอร์สินค้า")}
                </button>
              </div>
            </>
          ) : (
            <div className="finance-restricted-note">
              {tx("บทบาทปัจจุบันไม่มีสิทธิ์ดูตัวเลขการเงินและยอดโอนขององค์กร (เปิดให้เฉพาะเจ้าขององค์กรและฝ่ายการเงิน)")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
