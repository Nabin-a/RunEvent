/**
 * Income and refunds ("รายรับและคืนเงิน") — approved mockup, 24 Nov 2026.
 *
 * Refund requests come first (a decision is needed). Approving refunds the entry fee
 * and cancels the entry in one server call, so it asks for a second, explicit confirm.
 * Rejecting needs a reason. Below: money in per week with refund markers, payout
 * rounds, and an entry-level ledger. Money entries are never edited; a refund is a
 * new entry. Entry fees only — the shop has its own page.
 */
import React, { useMemo, useState } from 'react';
import type { PayoutBatch, RaceEvent, RegistrationRecord, TimeWindowFilter } from '../types';
import { formatThb, isWithinTimeWindow } from '../utils/pricing';
import type { ScopedLedgerMetrics } from '../utils/pricing';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../event-finance.css';

type Ledger = 'all' | 'paid' | 'refunds' | 'requested' | 'failed' | 'pending';

interface Props {
  event: RaceEvent;
  registrations: RegistrationRecord[];
  payouts: PayoutBatch[];
  metrics: ScopedLedgerMetrics;
  timeWindow: TimeWindowFilter;
  initialFilter: 'all' | 'payments' | 'refunds' | 'payouts';
  onResolveRefund: (regId: string, decision: 'approve_succeed' | 'reject', note: string) => void;
}

const WINDOW_LABEL: Record<TimeWindowFilter, string> = {
  all_time: 'ตลอดอายุงาน',
  last_30d: '30 วันล่าสุด',
  last_7d: '7 วันล่าสุด',
};

const organizerShare = (r: RegistrationRecord) =>
  Math.max(0, r.snapshotBaseSatang - r.snapshotOrganizerFeeSatang + (r.snapshotKitShippingSatang ?? 0) - r.snapshotRefundedSatang);

const weekStart = (iso: string) => {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() - day);
};
const fmtDay = (ms: number) =>
  new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(ms));
const stamp = (iso: string | null | undefined) => (iso ? iso.replace('T', ' ').slice(0, 16) : '—');

function ledgerKind(r: RegistrationRecord): Exclude<Ledger, 'all'> {
  if (r.refundStatus === 'requested' || r.refundStatus === 'approved' || r.refundStatus === 'processing') return 'requested';
  if (r.refundStatus === 'succeeded') return 'refunds';
  if (r.paymentStatus === 'succeeded') return 'paid';
  if (r.paymentStatus === 'failed' || r.paymentStatus === 'expired') return 'failed';
  return 'pending';
}

const KIND_META: Record<Exclude<Ledger, 'all'>, { label: string; icon: string; tone: string }> = {
  paid: { label: 'เงินเข้าแล้ว', icon: 'check', tone: 'is-ok' },
  requested: { label: 'ขอคืน รอตรวจ', icon: 'clock', tone: 'is-warn' },
  refunds: { label: 'คืนเงินแล้ว', icon: 'rotate-left', tone: 'is-danger' },
  failed: { label: 'จ่ายไม่สำเร็จ', icon: 'xmark', tone: 'is-muted' },
  pending: { label: 'รอชำระ', icon: 'hourglass-half', tone: 'is-muted' },
};

const PAYOUT_META: Record<PayoutBatch['status'], { label: string; icon: string; tone: string }> = {
  paid: { label: 'โอนแล้ว', icon: 'check', tone: 'is-ok' },
  scheduled: { label: 'นัดโอน', icon: 'calendar', tone: 'is-navy' },
  processing: { label: 'กำลังโอน', icon: 'arrow-right-arrow-left', tone: 'is-navy' },
  held: { label: 'พักยอด', icon: 'hand', tone: 'is-danger' },
};

/* ------------------------------------------------------------------ */

const RefundCard: React.FC<{
  r: RegistrationRecord;
  categoryName: string;
  onResolve: Props['onResolveRefund'];
}> = ({ r, categoryName, onResolve }) => {
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState('');
  const amount = r.snapshotBaseSatang;
  const noteId = `fin-note-${r.id}`;

  return (
    <article className="fin-refund" aria-labelledby={`fin-ref-${r.id}`}>
      <div className="fin-refund-main">
        <h3 id={`fin-ref-${r.id}`}>
          {tx(r.participantNameTh)} · {tx(categoryName)}
        </h3>
        <p className="fin-sub">
          {r.regCode} · {txf('จ่ายเมื่อ {0}', stamp(r.paidAt))}
          {(r.orderEntryCount ?? 1) > 1 &&
            ` · ${txf('คำสั่งซื้อ {0} คนที่ {1}/{2}', r.orderCode, r.orderEntryNo ?? 1, r.orderEntryCount ?? 1)}`}
        </p>
        <p className="fin-reason">
          <span className="fin-sub">{tx('เหตุผลที่แจ้ง')}</span>
          {r.refundReason ? tx(r.refundReason) : tx('ไม่ได้ระบุเหตุผล')}
        </p>
      </div>
      <div className="fin-refund-side">
        <dl className="fin-amounts">
          <dt>{tx('นักวิ่งจ่ายไป')}</dt>
          <dd>{formatThb(r.snapshotTotalChargedSatang, true)}</dd>
          <dt>{tx('คืนได้')}</dt>
          <dd>
            <strong>{formatThb(amount, true)}</strong>
          </dd>
        </dl>
        <p className="fin-sub">{tx('คืนเฉพาะค่าสมัคร ไม่คืนค่าบริการระบบ อนุมัติแล้วสิทธิ์วิ่งจะถูกยกเลิกและที่นั่งกลับเข้าโควตา')}</p>
        {(r.orderEntryCount ?? 1) > 1 && (
          <p className="fin-sub">
            {tx('สมัครมาเป็นกลุ่ม: คืนเฉพาะคนนี้ คนอื่นในคำสั่งซื้อไม่เปลี่ยน ค่าจัดส่งของคำสั่งซื้อไม่คืน')}
          </p>
        )}
        <label htmlFor={noteId} className="fin-label">
          {tx('บันทึกเหตุผลการตัดสินใจ (ต้องใส่เมื่อปฏิเสธ)')}
        </label>
        <textarea
          id={noteId}
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setError('');
          }}
          placeholder={tx('เช่น มีใบรับรองแพทย์ตามกติกาข้อ 7')}
        />
        {error && (
          <p className="fin-error" role="alert">
            <FaIcon name="triangle-exclamation" />
            {error}
          </p>
        )}
        {confirming ? (
          <div className="fin-confirm" role="alertdialog" aria-labelledby={`fin-conf-${r.id}`}>
            <p id={`fin-conf-${r.id}`}>
              <FaIcon name="circle-exclamation" />
              {confirming === 'approve'
                ? txf('ยืนยันคืนเงิน {0} ให้ {1} และยกเลิกสิทธิ์วิ่ง? ย้อนกลับไม่ได้', formatThb(amount, true), tx(r.participantNameTh))
                : txf('ยืนยันปฏิเสธคำขอของ {0}?', tx(r.participantNameTh))}
            </p>
            <div className="fin-row">
              <button type="button" className="fin-btn" onClick={() => setConfirming(null)}>
                {tx('กลับไปแก้')}
              </button>
              <button
                type="button"
                className={`fin-btn ${confirming === 'approve' ? 'is-primary' : 'is-danger'}`}
                onClick={() => {
                  onResolve(
                    r.id,
                    confirming === 'approve' ? 'approve_succeed' : 'reject',
                    note.trim() || 'อนุมัติคืนค่าสมัครตามคำขอ'
                  );
                  setConfirming(null);
                }}
              >
                {tx(confirming === 'approve' ? 'ยืนยันคืนเงิน' : 'ยืนยันปฏิเสธ')}
              </button>
            </div>
          </div>
        ) : (
          <div className="fin-row">
            <button
              type="button"
              className="fin-btn"
              onClick={() => {
                if (!note.trim()) {
                  setError(tx('ใส่เหตุผลก่อนปฏิเสธ นักวิ่งจะเห็นเหตุผลนี้'));
                  return;
                }
                setConfirming('reject');
              }}
            >
              {tx('ปฏิเสธ')}
            </button>
            <button type="button" className="fin-btn is-primary" onClick={() => setConfirming('approve')}>
              {txf('อนุมัติคืน {0}', formatThb(amount))}
            </button>
          </div>
        )}
        <p className="fin-sub">{tx('ยอดคืนนับว่าสำเร็จเมื่อผู้ให้บริการรับชำระยืนยันแล้ว')}</p>
      </div>
    </article>
  );
};

/* ------------------------------------------------------------------ */

export const EventFinanceView: React.FC<Props> = ({
  event,
  registrations,
  payouts,
  metrics,
  timeWindow,
  initialFilter,
  onResolveRefund,
}) => {
  const [filter, setFilter] = useState<Ledger>(
    initialFilter === 'payments' ? 'paid' : initialFilter === 'refunds' ? 'refunds' : 'all'
  );
  const [showAll, setShowAll] = useState(false);
  const catName = (id: string) => event.categories.find((c) => c.id === id)?.name ?? '';
  const requests = registrations.filter((r) => r.refundStatus === 'requested');

  const inWindow = registrations.filter(
    (r) => timeWindow === 'all_time' || isWithinTimeWindow(r.paidAt ?? r.createdAt, timeWindow)
  );

  /* weekly money in, with refunds as markers */
  const weeks = useMemo(() => {
    const map = new Map<number, { in: number; refund: number }>();
    inWindow.forEach((r) => {
      if (r.paymentStatus === 'succeeded' && r.paidAt) {
        const k = weekStart(r.paidAt);
        const v = map.get(k) ?? { in: 0, refund: 0 };
        v.in += r.snapshotTotalChargedSatang;
        map.set(k, v);
      }
      if (r.refundStatus === 'succeeded' && r.refundedAt) {
        const k = weekStart(r.refundedAt);
        const v = map.get(k) ?? { in: 0, refund: 0 };
        v.refund += r.snapshotRefundedSatang;
        map.set(k, v);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ms, v]) => ({ ms, ...v }));
  }, [inWindow]);
  const maxWeek = Math.max(...weeks.map((w) => w.in), 1);

  /* payouts */
  const paidOut = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.netPayoutSatang, 0);
  const upcoming = payouts.filter((p) => p.status !== 'paid' && p.status !== 'held').reduce((s, p) => s + p.netPayoutSatang, 0);
  const held = payouts.filter((p) => p.status === 'held').reduce((s, p) => s + p.netPayoutSatang, 0);
  const notInRound = Math.max(0, metrics.netOrganizerPayoutSatang - paidOut - upcoming - held);
  const payoutTotal = Math.max(paidOut + upcoming + held + notInRound, 1);

  /* ledger */
  const counts = useMemo(() => {
    const c: Record<Ledger, number> = { all: inWindow.length, paid: 0, refunds: 0, requested: 0, failed: 0, pending: 0 };
    inWindow.forEach((r) => (c[ledgerKind(r)] += 1));
    return c;
  }, [inWindow]);
  const rows = inWindow
    .filter((r) => filter === 'all' || ledgerKind(r) === filter)
    .slice()
    .sort((a, b) => (b.paidAt ?? b.createdAt).localeCompare(a.paidAt ?? a.createdAt));
  const shown = showAll ? rows : rows.slice(0, 12);

  return (
    <div className="fin-page">
      <header className="fin-head">
        <div>
          <h1>{tx('รายรับและคืนเงิน')}</h1>
          <p className="fin-sub">
            {txf('ค่าสมัครของงานนี้ · ไม่รวมร้านค้า · ช่วงเวลา: {0} (เปลี่ยนได้ที่มุมขวาบน)', tx(WINDOW_LABEL[timeWindow]))}
          </p>
          <p className="fin-sub">{tx('นับตามวันที่เงินเข้า ซึ่งผู้ให้บริการรับชำระยืนยันแล้ว')}</p>
        </div>
      </header>

      <section className={`fin-panel${requests.length ? ' is-urgent' : ''}`} aria-labelledby="fin-req-h">
        <div className="fin-panel-head">
          <h2 id="fin-req-h">
            {requests.length > 0 && <FaIcon name="triangle-exclamation" />}
            {tx('คำขอคืนเงินรอตรวจ')}
          </h2>
          <span className="fin-sub">{txf('{0} รายการ', requests.length)}</span>
        </div>
        {requests.length === 0 ? (
          <p className="fin-ok">
            <FaIcon name="circle-check" />
            {tx('ไม่มีคำขอคืนเงินค้างอยู่')}
          </p>
        ) : (
          requests.map((r) => <RefundCard key={r.id} r={r} categoryName={catName(r.categoryId)} onResolve={onResolveRefund} />)
        )}
      </section>

      <div className="fin-grid2">
        <section className="fin-panel" aria-labelledby="fin-week-h">
          <div className="fin-panel-head">
            <h2 id="fin-week-h">{tx('เงินค่าสมัครเข้ารายสัปดาห์')}</h2>
            <span className="fin-sub">{txf('รวม {0}', formatThb(metrics.grossPaidSatang))}</span>
          </div>
          {weeks.length === 0 ? (
            <p className="fin-sub">{tx('ยังไม่มีเงินเข้าในช่วงเวลานี้')}</p>
          ) : (
            <>
              <div
                className="fin-weeks"
                role="img"
                aria-label={weeks
                  .map((w) =>
                    w.refund
                      ? txf('สัปดาห์ {0} เงินเข้า {1} คืนเงิน {2}', fmtDay(w.ms), formatThb(w.in), formatThb(w.refund))
                      : txf('สัปดาห์ {0} เงินเข้า {1}', fmtDay(w.ms), formatThb(w.in))
                  )
                  .join(', ')}
              >
                {weeks.map((w) => (
                  <div key={w.ms} className="fin-week">
                    <span className="fin-week-val">{formatThb(w.in).replace('฿', '')}</span>
                    <span className="fin-week-bar" style={{ height: `${(w.in / maxWeek) * 100}%` }} />
                    {w.refund > 0 && (
                      <span className="fin-week-refund">
                        <FaIcon name="rotate-left" />−{formatThb(w.refund).replace('฿', '')}
                      </span>
                    )}
                    <span className="fin-week-day">{fmtDay(w.ms)}</span>
                  </div>
                ))}
              </div>
              <p className="fin-sub">
                <i className="fin-sw is-blue" aria-hidden="true" /> {tx('เงินเข้า (บาท)')}{' '}
                <FaIcon name="rotate-left" /> {tx('คืนเงินสำเร็จในสัปดาห์นั้น')}
              </p>
            </>
          )}
        </section>

        <section className="fin-panel" aria-labelledby="fin-pay-h">
          <div className="fin-panel-head">
            <h2 id="fin-pay-h">{tx('ยอดโอนให้ผู้จัด')}</h2>
            <span className="fin-sub">{txf('สุทธิ {0}', formatThb(metrics.netOrganizerPayoutSatang))}</span>
          </div>
          <div className="fin-stack" aria-hidden="true">
            {paidOut > 0 && <span className="is-paid" style={{ width: `${(paidOut / payoutTotal) * 100}%` }} />}
            {upcoming > 0 && <span className="is-next" style={{ width: `${(upcoming / payoutTotal) * 100}%` }} />}
            {held > 0 && <span className="is-held" style={{ width: `${(held / payoutTotal) * 100}%` }} />}
          </div>
          <ul className="fin-payouts">
            {payouts.length === 0 && <li className="fin-sub">{tx('ยังไม่มีรอบโอนของงานนี้')}</li>}
            {payouts.map((p) => (
              <li key={p.id}>
                <span className={`fin-tag ${PAYOUT_META[p.status].tone}`}>
                  <FaIcon name={PAYOUT_META[p.status].icon} />
                  {tx(PAYOUT_META[p.status].label)}
                </span>
                <span className="fin-payout-main">
                  {p.payoutCode} · {p.scheduledDate}
                  <span className="fin-sub fin-block">
                    {txf('รับชำระ {0} − คืน {1} − ค่าบริการ {2}', formatThb(p.grossSucceededSatang), formatThb(p.deductedRefundSatang), formatThb(p.deductedOrganizerFeeSatang))}
                  </span>
                </span>
                <strong>{formatThb(p.netPayoutSatang)}</strong>
              </li>
            ))}
            {notInRound > 0 && (
              <li>
                <span className="fin-tag is-muted">
                  <FaIcon name="hourglass-half" />
                  {tx('ยังไม่เข้ารอบ')}
                </span>
                <span className="fin-payout-main">{tx('จะเข้ารอบโอนถัดไป ยอดยังเปลี่ยนได้จนปิดรอบ')}</span>
                <strong>{formatThb(notInRound)}</strong>
              </li>
            )}
          </ul>
          <p className="fin-sub">{tx('รอบที่พักยอดจะแสดงเหตุผลและสิ่งที่ต้องทำในหน้าการเงินและรอบโอนขององค์กร')}</p>
        </section>
      </div>

      <section className="fin-panel" aria-labelledby="fin-ledger-h">
        <div className="fin-panel-head">
          <h2 id="fin-ledger-h">{tx('รายการเงิน')}</h2>
          <span className="fin-sub">{tx('แก้หรือลบไม่ได้ การคืนเงินเป็นรายการใหม่')}</span>
        </div>
        <div className="fin-chips" role="group" aria-label={tx('กรองรายการเงิน')}>
          {(['all', 'paid', 'requested', 'refunds', 'failed', 'pending'] as Ledger[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              className={`fin-chip${filter === k ? ' is-on' : ''}`}
              onClick={() => setFilter(k)}
            >
              {tx(k === 'all' ? 'ทั้งหมด' : KIND_META[k].label)} {counts[k]}
            </button>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="fin-sub">{tx('ไม่มีรายการตามตัวกรองนี้')}</p>
        ) : (
          <table className="fin-table">
            <thead>
              <tr>
                <th scope="col">{tx('วันที่')}</th>
                <th scope="col">{tx('ผู้สมัคร · ใบสมัคร')}</th>
                <th scope="col" className="num">{tx('จ่าย')}</th>
                <th scope="col" className="num">{tx('ค่าบริการ')}</th>
                <th scope="col" className="num">{tx('ผู้จัดได้')}</th>
                <th scope="col">{tx('สถานะ')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const k = ledgerKind(r);
                const paid = r.paymentStatus === 'succeeded';
                return (
                  <tr key={r.id}>
                    <td className="fin-date">{stamp(r.paidAt ?? r.createdAt).slice(0, 10)}</td>
                    <td>
                      <strong>{tx(r.participantNameTh)}</strong>
                      <span className="fin-sub fin-block">
                        {r.regCode} · {tx(catName(r.categoryId))}
                        {r.buyerName !== r.participantNameTh && ` · ${txf('จ่ายโดย {0}', tx(r.buyerName))}`}
                        {(r.orderEntryCount ?? 1) > 1 && ` · ${txf('คำสั่งซื้อ {0}', r.orderCode)}`}
                      </span>
                    </td>
                    <td className="num">{paid ? formatThb(r.snapshotTotalChargedSatang, true) : '—'}</td>
                    <td className="num fin-sub">{paid ? formatThb(r.snapshotPlatformFeeSatang, true) : '—'}</td>
                    <td className="num">{paid ? formatThb(organizerShare(r), true) : '—'}</td>
                    <td>
                      <span className={`fin-tag ${KIND_META[k].tone}`}>
                        <FaIcon name={KIND_META[k].icon} />
                        {tx(KIND_META[k].label)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {rows.length > 12 && (
          <button type="button" className="fin-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? tx('ย่อรายการ') : txf('ดูทั้งหมด {0} รายการ', rows.length)}
          </button>
        )}
      </section>
      <p className="fin-sub">{tx('ระบบนี้ยังไม่มีการตัดเงินหรือคืนเงินจริง')}</p>
    </div>
  );
};
