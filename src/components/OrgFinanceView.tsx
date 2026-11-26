/**
 * Organization "การเงินและรอบโอน" — approved mockup, 24 Nov 2026.
 * Owner and finance roles only (the server checks this too).
 * Bank account status → payout per round → where each event's entry fees went →
 * payout rounds table → reconciliation CSV of exactly what is on screen.
 * Shop money stays on each event's shop page. The old fee-payer calculator moved
 * to "ระยะ ราคา และการรับสมัคร" as the fee-payer choice with a live preview.
 */
import React, { useMemo } from 'react';
import type { MerchOrderRecord, PayoutBatch, RaceEvent, RegistrationRecord, TimeWindowFilter } from '../types';
import { computeMetrics, formatThb } from '../utils/pricing';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../event-finance.css';
import '../org-finance.css';

interface Props {
  orgCode: string;
  orgName: string;
  bankSummary: string;
  bankReady: boolean;
  canManageBank: boolean;
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  payouts: PayoutBatch[];
  timeWindow: TimeWindowFilter;
  onOpenTeamSettings: () => void;
  onOpenEventFinance: (eventId: string) => void;
}

const WINDOW_LABEL: Record<TimeWindowFilter, string> = {
  all_time: 'ตลอดอายุงาน',
  last_30d: '30 วันล่าสุด',
  last_7d: '7 วันล่าสุด',
};

const PAYOUT_META: Record<PayoutBatch['status'], { label: string; icon: string; tone: string }> = {
  paid: { label: 'โอนแล้ว', icon: 'check', tone: 'is-ok' },
  scheduled: { label: 'นัดโอน', icon: 'calendar', tone: 'is-navy' },
  processing: { label: 'กำลังโอน', icon: 'arrow-right-arrow-left', tone: 'is-navy' },
  held: { label: 'พักยอด', icon: 'hand', tone: 'is-danger' },
};

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const baht = (satang: number) => (satang / 100).toFixed(2);

export const OrgFinanceView: React.FC<Props> = ({
  orgCode,
  orgName,
  bankSummary,
  bankReady,
  canManageBank,
  events,
  registrations,
  merchOrders,
  payouts,
  timeWindow,
  onOpenTeamSettings,
  onOpenEventFinance,
}) => {
  const rounds = useMemo(() => payouts.slice().sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)), [payouts]);
  const maxRound = Math.max(...rounds.map((p) => p.netPayoutSatang), 1);

  const perEvent = useMemo(
    () =>
      events
        .map((ev) => {
          const m = computeMetrics([ev], registrations, merchOrders, timeWindow);
          return {
            ev,
            gross: m.grossPaidSatang,
            refund: m.succeededRefundSatang,
            fee: m.platformRevenueSatang,
            net: m.netOrganizerPayoutSatang,
          };
        })
        .filter((x) => x.gross > 0)
        .sort((a, b) => b.gross - a.gross),
    [events, registrations, merchOrders, timeWindow]
  );
  const maxGross = Math.max(...perEvent.map((x) => x.gross), 1);
  const totals = perEvent.reduce(
    (t, x) => ({ gross: t.gross + x.gross, refund: t.refund + x.refund, fee: t.fee + x.fee, net: t.net + x.net }),
    { gross: 0, refund: 0, fee: 0, net: 0 }
  );
  const paidOut = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.netPayoutSatang, 0);
  const waiting = payouts.filter((p) => p.status === 'scheduled' || p.status === 'processing').reduce((s, p) => s + p.netPayoutSatang, 0);
  const held = payouts.filter((p) => p.status === 'held').reduce((s, p) => s + p.netPayoutSatang, 0);
  const eventName = (id: string) => events.find((e) => e.id === id)?.titleTh ?? id;

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push(['รายงานกระทบยอด', orgName, orgCode, `ช่วงเวลา: ${WINDOW_LABEL[timeWindow]}`].map(csvCell).join(','));
    lines.push('');
    lines.push(['งาน', 'รหัสงาน', 'รับชำระ (บาท)', 'คืนเงิน (บาท)', 'ค่าบริการระบบ (บาท)', 'ผู้จัดได้ (บาท)'].map(csvCell).join(','));
    perEvent.forEach((x) =>
      lines.push([x.ev.titleTh, x.ev.code, baht(x.gross), baht(x.refund), baht(x.fee), baht(x.net)].map(csvCell).join(','))
    );
    lines.push('');
    lines.push(['รหัสรอบโอน', 'งาน', 'งวด', 'วันที่', 'รับชำระ (บาท)', 'หักคืน (บาท)', 'หักค่าบริการ (บาท)', 'โอนสุทธิ (บาท)', 'สถานะ'].map(csvCell).join(','));
    rounds.forEach((p) =>
      lines.push(
        [
          p.payoutCode,
          eventName(p.eventId),
          p.periodLabel,
          p.scheduledDate,
          baht(p.grossSucceededSatang),
          baht(p.deductedRefundSatang),
          baht(p.deductedOrganizerFeeSatang),
          baht(p.netPayoutSatang),
          PAYOUT_META[p.status].label,
        ]
          .map(csvCell)
          .join(',')
      )
    );
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${orgCode}-reconciliation.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="of-page">
      <header className="of-head">
        <div>
          <h1>{tx('การเงินและรอบโอน')}</h1>
          <p className="fin-sub">
            {txf('เงินค่าสมัครทุกงานที่โอนเข้าบัญชีองค์กร · ช่วงเวลา: {0} (เปลี่ยนได้ที่มุมขวาบน)', tx(WINDOW_LABEL[timeWindow]))}
          </p>
          <p className="fin-sub">
            <FaIcon name="lock" /> {tx('เห็นเฉพาะเจ้าขององค์กรและฝ่ายการเงิน')}
          </p>
        </div>
        <button type="button" className="fin-btn" onClick={exportCsv}>
          <FaIcon name="file-csv" />
          {tx('ส่งออกรายงานกระทบยอด')}
        </button>
      </header>

      <div className={`of-bank${bankReady ? '' : ' is-warn'}`}>
        <FaIcon name="building-columns" />
        <span className="of-bank-text">
          <strong>{tx('บัญชีรับเงิน')}</strong> {tx(bankSummary)}
        </span>
        <span className={`fin-tag ${bankReady ? 'is-ok' : 'is-warn'}`}>
          <FaIcon name={bankReady ? 'shield-halved' : 'triangle-exclamation'} />
          {tx(bankReady ? 'ยืนยันแล้ว' : 'รอยืนยันเอกสาร')}
        </span>
        <button type="button" className="fin-link" onClick={onOpenTeamSettings}>
          {tx(canManageBank ? 'ดูหรือเปลี่ยนบัญชี' : 'ดูข้อมูลบัญชี (เปลี่ยนได้เฉพาะเจ้าขององค์กร)')} ›
        </button>
      </div>

      <div className="fin-grid2">
        <section className="fin-panel" aria-labelledby="of-rounds-h">
          <div className="fin-panel-head">
            <h2 id="of-rounds-h">{tx('ยอดโอนแต่ละรอบ')}</h2>
            <span className="fin-sub">
              {txf('โอนแล้ว {0} · รอโอน {1}', formatThb(paidOut), formatThb(waiting))}
              {held > 0 && ` · ${txf('พักยอด {0}', formatThb(held))}`}
            </span>
          </div>
          {rounds.length === 0 ? (
            <p className="fin-sub">{tx('ยังไม่มีรอบโอน')}</p>
          ) : (
            <>
              <div
                className="of-rounds"
                role="img"
                aria-label={rounds
                  .map((p) => txf('{0} {1} {2} {3}', p.payoutCode, p.scheduledDate, PAYOUT_META[p.status].label, formatThb(p.netPayoutSatang)))
                  .join(', ')}
              >
                {rounds.map((p) => (
                  <div key={p.id} className="of-round">
                    <span className="of-round-val">{formatThb(p.netPayoutSatang).replace('฿', '')}</span>
                    <span className={`of-round-bar is-${p.status}`} style={{ height: `${(p.netPayoutSatang / maxRound) * 100}%` }} />
                    <span className="of-round-date">{p.scheduledDate.slice(5)}</span>
                  </div>
                ))}
              </div>
              <p className="fin-sub">
                <i className="of-sw is-paid" aria-hidden="true" /> {tx('โอนแล้ว')} <i className="of-sw is-scheduled" aria-hidden="true" />{' '}
                {tx('นัดโอนหรือกำลังโอน')} <i className="of-sw is-held" aria-hidden="true" /> {tx('พักยอด')}
              </p>
            </>
          )}
        </section>

        <section className="fin-panel" aria-labelledby="of-events-h">
          <div className="fin-panel-head">
            <h2 id="of-events-h">{tx('เงินแต่ละงานไปไหน')}</h2>
            <span className="fin-sub">{tx('รับชำระทั้งหมด แบ่งเป็นผู้จัดได้ ค่าบริการ และเงินคืน')}</span>
          </div>
          <p className="fin-sub">
            <i className="of-sw is-paid" aria-hidden="true" /> {tx('ผู้จัดได้')} <i className="of-sw is-fee" aria-hidden="true" /> {tx('ค่าบริการระบบ')}{' '}
            <i className="of-sw is-refund" aria-hidden="true" /> {tx('คืนเงิน')}
          </p>
          {perEvent.length === 0 ? (
            <p className="fin-sub">{tx('ยังไม่มีเงินเข้าในช่วงเวลานี้')}</p>
          ) : (
            <ul className="of-events">
              {perEvent.map((x) => (
                <li key={x.ev.id}>
                  <button type="button" className="of-event" onClick={() => onOpenEventFinance(x.ev.id)}>
                    <span className="of-event-name">
                      <strong>{tx(x.ev.titleTh)}</strong>
                      <span className="fin-sub">{txf('ผู้จัดได้ {0}', formatThb(x.net))}</span>
                    </span>
                    <span
                      className="of-event-bar"
                      style={{ width: `${(x.gross / maxGross) * 100}%` }}
                      role="img"
                      aria-label={txf('รับชำระ {0} ผู้จัดได้ {1} ค่าบริการ {2} คืนเงิน {3}', formatThb(x.gross), formatThb(x.net), formatThb(x.fee), formatThb(x.refund))}
                    >
                      <span className="is-paid" style={{ width: `${(x.net / x.gross) * 100}%` }} />
                      <span className="is-fee" style={{ width: `${(x.fee / x.gross) * 100}%` }} />
                      {x.refund > 0 && <span className="is-refund" style={{ width: `${(x.refund / x.gross) * 100}%` }} />}
                    </span>
                    <span className="of-event-gross">{formatThb(x.gross)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {perEvent.length > 1 && (
            <p className="fin-sub">
              {txf('รวมทุกงาน: รับชำระ {0} − คืน {1} − ค่าบริการ {2} = ผู้จัดได้ {3}', formatThb(totals.gross), formatThb(totals.refund), formatThb(totals.fee), formatThb(totals.net))}
            </p>
          )}
        </section>
      </div>

      <section className="fin-panel" aria-labelledby="of-table-h">
        <div className="fin-panel-head">
          <h2 id="of-table-h">{tx('รอบโอน')}</h2>
          <span className="fin-sub">{tx('รอบที่พักยอดต้องติดต่อทีมแพลตฟอร์ม เหตุผลอยู่ในรายละเอียดงวด')}</span>
        </div>
        {rounds.length === 0 ? (
          <p className="fin-sub">{tx('ยังไม่มีรอบโอน')}</p>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th scope="col">{tx('รหัสรอบ')}</th>
                <th scope="col">{tx('งาน · งวด')}</th>
                <th scope="col" className="num">{tx('รับชำระ')}</th>
                <th scope="col" className="num">{tx('หักคืน')}</th>
                <th scope="col" className="num">{tx('หักค่าบริการ')}</th>
                <th scope="col" className="num">{tx('โอนสุทธิ')}</th>
                <th scope="col">{tx('สถานะ')}</th>
              </tr>
            </thead>
            <tbody>
              {rounds
                .slice()
                .reverse()
                .map((p) => (
                  <tr key={p.id}>
                    <td className="fin-date">{p.payoutCode}</td>
                    <td>
                      <strong>{tx(eventName(p.eventId))}</strong>
                      <span className="fin-sub fin-block">
                        {tx(p.periodLabel)} · {p.scheduledDate}
                      </span>
                    </td>
                    <td className="num">{formatThb(p.grossSucceededSatang, true)}</td>
                    <td className="num">{formatThb(p.deductedRefundSatang, true)}</td>
                    <td className="num">{formatThb(p.deductedOrganizerFeeSatang, true)}</td>
                    <td className="num">
                      <strong>{formatThb(p.netPayoutSatang, true)}</strong>
                    </td>
                    <td>
                      <span className={`fin-tag ${PAYOUT_META[p.status].tone}`}>
                        <FaIcon name={PAYOUT_META[p.status].icon} />
                        {tx(PAYOUT_META[p.status].label)}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="fin-sub">{tx('ระบบนี้ยังไม่มีการโอนเงินจริง')}</p>
    </div>
  );
};
