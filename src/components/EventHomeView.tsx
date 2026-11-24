/**
 * Event home ("หน้าหลักของงาน") — chart version approved by the user on 24 Nov 2026.
 *
 * Order: header with event stage → to-do strips → cumulative sign-ups vs places →
 * seats by distance → entry-fee money (waterfall) → shirts by size.
 * Every chart has a text label on its marks, an aria-label, and a table view.
 * Numbers come from the same records and metrics as the rest of the dashboard.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RaceEvent, RegistrationRecord, TimeWindowFilter } from '../types';
import type { ScopedLedgerMetrics } from '../utils/pricing';
import { formatThb } from '../utils/pricing';
import { isTotalQuotaEnabled } from '../utils/eventConfig';
import type { OrgSection } from './OrganizerDashboardView';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';

type DrillTarget = 'confirmed' | 'pending_payment' | 'payments' | 'refunds' | 'payouts';

interface Props {
  event: RaceEvent;
  /** registrations of this event only */
  registrations: RegistrationRecord[];
  metrics: ScopedLedgerMetrics;
  timeWindow: TimeWindowFilter;
  canViewFinance: boolean;
  canManageEventConfig: boolean;
  onNavigate: (section: OrgSection) => void;
  onDrillDown: (target: DrillTarget) => void;
  onSubmitDraft: () => void;
}

const DAY = 86400000;
const toDay = (iso: string) => {
  const d = new Date(iso);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
const fmtDate = (ms: number, withYear = false) =>
  new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(ms));
const fmtNum = (n: number) => n.toLocaleString('th-TH');

/** width of a chart box in CSS px, so SVG text stays at its real size */
function useBoxWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const WINDOW_LABEL: Record<TimeWindowFilter, string> = {
  all_time: 'ตลอดอายุงาน',
  last_30d: '30 วันล่าสุด',
  last_7d: '7 วันล่าสุด',
};

/* ------------------------------------------------------------------ */
/* Stage                                                               */
/* ------------------------------------------------------------------ */

function useStage(event: RaceEvent) {
  return useMemo(() => {
    const tiers = event.categories.flatMap((c) => c.priceTiers);
    const closeMs = tiers.length ? Math.max(...tiers.map((t) => toDay(t.endsAt))) : null;
    const openMs = tiers.length ? Math.min(...tiers.map((t) => toDay(t.startsAt))) : null;
    const today = toDay(new Date().toISOString());
    const raceMs = toDay(event.eventDate);
    let current = 0;
    if (event.status === 'published') current = 1;
    if (event.status === 'closed') current = 2;
    if (event.status === 'completed') current = 3;
    const daysToClose = closeMs !== null ? Math.ceil((closeMs - today) / DAY) : null;
    const daysToRace = Math.ceil((raceMs - today) / DAY);
    return { current, closeMs, openMs, today, raceMs, daysToClose, daysToRace };
  }, [event]);
}

/* ------------------------------------------------------------------ */
/* Table view helper                                                   */
/* ------------------------------------------------------------------ */

const TableView: React.FC<{ caption: string; head: string[]; rows: (string | number)[][] }> = ({
  caption,
  head,
  rows,
}) => (
  <details className="eh-table">
    <summary>{tx('ดูเป็นตาราง')}</summary>
    <table>
      <caption className="eh-sr">{tx(caption)}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {tx(h)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{typeof c === 'number' ? fmtNum(c) : tx(c)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </details>
);

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

const SignupTrend: React.FC<{
  registrations: RegistrationRecord[];
  places: number;
  openMs: number | null;
  closeMs: number | null;
  today: number;
}> = ({ registrations, places, openMs, closeMs, today }) => {
  const [hover, setHover] = useState<number | null>(null);
  const confirmed = registrations.filter((r) => r.registrationStatus === 'confirmed');
  const pending = registrations.filter((r) => r.registrationStatus === 'pending_payment').length;

  const days = confirmed.map((r) => toDay(r.paidAt ?? r.createdAt));
  const first = Math.min(openMs ?? Infinity, ...(days.length ? days : [today]));
  const endData = Math.min(today, closeMs ?? today);
  const last = Math.max(closeMs ?? today, endData, first + 7 * DAY);

  // cumulative count for each day from the first day to the last day with data
  const series: { ms: number; total: number; added: number }[] = [];
  let running = 0;
  for (let ms = first; ms <= Math.max(endData, first); ms += DAY) {
    const added = days.filter((d) => d === ms).length;
    running += added;
    series.push({ ms, total: running, added });
  }
  const weekAgo = today - 7 * DAY;
  const lastWeek = days.filter((d) => d > weekAgo && d <= today).length;

  const [boxRef, W] = useBoxWidth(640);
  const H = 196;
  const x0 = 44;
  const x1 = W - 16;
  const y0 = 166;
  const y1 = 22;
  const yMax = Math.max(places, running, 1);
  const x = (ms: number) => x0 + ((ms - first) / Math.max(last - first, DAY)) * (x1 - x0);
  const y = (v: number) => y0 - (v / yMax) * (y0 - y1);
  const path = series.map((p, i) => `${i ? 'L' : 'M'}${x(p.ms).toFixed(1)} ${y(p.total).toFixed(1)}`).join(' ');
  const area = series.length
    ? `${path} L${x(series[series.length - 1].ms).toFixed(1)} ${y0} L${x(series[0].ms).toFixed(1)} ${y0} Z`
    : '';
  const ticks = [0, Math.round(yMax / 2), yMax];
  const end = series[series.length - 1];
  const hoverPt = hover !== null ? series[hover] : null;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || !series.length) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    series.forEach((p, i) => {
      if (Math.abs(x(p.ms) - px) < Math.abs(x(series[best].ms) - px)) best = i;
    });
    setHover(best);
  };

  return (
    <section className="eh-panel" aria-labelledby="eh-trend-h">
      <div className="eh-panel-head">
        <h2 id="eh-trend-h">{tx('ยอดผู้สมัครยืนยันสะสม')}</h2>
        <span className="eh-sub">{tx('เทียบกับที่รับทั้งหมด · ชี้เส้นเพื่อดูแต่ละวัน')}</span>
      </div>
      <div className="eh-headline">
        <strong>{fmtNum(running)}</strong>
        <span>{txf('/ {0} คน', fmtNum(places))}</span>
        <span className="eh-sub">
          {txf('+{0} คนใน 7 วันล่าสุด', lastWeek)}
          {pending > 0 && ` · ${txf('รอชำระอีก {0} คน (ยังไม่นับ)', pending)}`}
        </span>
      </div>
      <div ref={boxRef}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        className="eh-svg"
        role="img"
        aria-label={txf(
          'ยอดผู้สมัครยืนยันสะสม {0} คน จากที่รับ {1} คน ตั้งแต่ {2} ถึง {3}',
          running,
          places,
          fmtDate(first),
          fmtDate(endData)
        )}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} className="eh-grid" />
            <text x={x0 - 6} y={y(t) + 4} textAnchor="end" className="eh-t">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        <line x1={x0} x2={x1} y1={y(places)} y2={y(places)} className="eh-ref" />
        <text x={x0 + 4} y={y(places) - 5} className="eh-t">
          {txf('รับทั้งหมด {0}', fmtNum(places))}
        </text>
        {closeMs !== null && (
          <g>
            <line x1={x(closeMs)} x2={x(closeMs)} y1={y1} y2={y0} className="eh-ref" />
            <text x={x(closeMs) - 4} y={y1 + 12} textAnchor="end" className="eh-t">
              {txf('ปิดรับ {0}', fmtDate(closeMs))}
            </text>
          </g>
        )}
        {area && <path d={area} className="eh-area" />}
        {path && <path d={path} className="eh-line" />}
        {end && (
          <g>
            <circle cx={x(end.ms)} cy={y(end.total)} r={5} className="eh-dot" />
            <text
              x={x(end.ms) + (x(end.ms) > W - 120 ? -8 : 8)}
              y={y(end.total) - 8}
              textAnchor={x(end.ms) > W - 120 ? 'end' : 'start'}
              className="eh-tb"
            >
              {txf('วันนี้ {0}', fmtNum(end.total))}
            </text>
          </g>
        )}
        <text x={x0} y={H - 6} className="eh-t">
          {fmtDate(first)}
        </text>
        <text x={x1} y={H - 6} textAnchor="end" className="eh-t">
          {fmtDate(last)}
        </text>
        {hoverPt && (
          <g pointerEvents="none">
            <line x1={x(hoverPt.ms)} x2={x(hoverPt.ms)} y1={y1} y2={y0} className="eh-cross" />
            <circle cx={x(hoverPt.ms)} cy={y(hoverPt.total)} r={5} className="eh-dot" />
            <g transform={`translate(${x(hoverPt.ms) > W - 150 ? x(hoverPt.ms) - 132 : x(hoverPt.ms) + 10}, ${y0 - 44})`}>
              <rect width="122" height="38" rx="6" className="eh-tip" />
              <text x="8" y="16" className="eh-tb">
                {txf('{0} คน', fmtNum(hoverPt.total))}
              </text>
              <text x="8" y="31" className="eh-t">
                {fmtDate(hoverPt.ms)} · +{hoverPt.added}
              </text>
            </g>
          </g>
        )}
        <rect
          x={x0}
          y={y1}
          width={x1 - x0}
          height={y0 - y1}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      </div>
      <TableView
        caption="ยอดผู้สมัครยืนยันสะสมรายวัน"
        head={['วันที่', 'ยืนยันเพิ่ม', 'สะสม']}
        rows={series.filter((p) => p.added > 0).map((p) => [fmtDate(p.ms, true), p.added, p.total])}
      />
    </section>
  );
};

const SeatsByDistance: React.FC<{
  event: RaceEvent;
  registrations: RegistrationRecord[];
  onDrillDown: (t: DrillTarget) => void;
}> = ({ event, registrations, onDrillDown }) => {
  const rows = event.categories.map((c) => {
    const regs = registrations.filter((r) => r.categoryId === c.id);
    const confirmed = regs.filter((r) => r.registrationStatus === 'confirmed').length;
    const pending = regs.filter((r) => r.registrationStatus === 'pending_payment').length;
    return { id: c.id, name: c.name, quota: c.categoryQuota, confirmed, pending };
  });
  return (
    <section className="eh-panel" aria-labelledby="eh-seats-h">
      <div className="eh-panel-head">
        <h2 id="eh-seats-h">{tx('ที่นั่งตามระยะ')}</h2>
        <span className="eh-sub">{tx('เต็มแล้วกี่ส่วน · กดแถบเพื่อดูรายชื่อ')}</span>
      </div>
      <div className="eh-legend">
        <span>
          <i className="eh-sw eh-sw-d1" aria-hidden="true" />
          {tx('ยืนยันแล้ว')}
        </span>
        <span>
          <i className="eh-sw eh-sw-hatch" aria-hidden="true" />
          {tx('รอชำระ')}
        </span>
        <span>
          <i className="eh-sw eh-sw-trk" aria-hidden="true" />
          {tx('ว่าง')}
        </span>
      </div>
      <div className="eh-bars">
        {rows.map((r) => {
          const q = Math.max(r.quota, r.confirmed + r.pending, 1);
          return (
            <button
              key={r.id}
              type="button"
              className="eh-bar-row"
              onClick={() => onDrillDown('confirmed')}
              aria-label={txf(
                '{0}: ยืนยัน {1} รอชำระ {2} จากที่รับ {3}',
                tx(r.name),
                r.confirmed,
                r.pending,
                r.quota
              )}
            >
              <span className="eh-bar-name">{tx(r.name)}</span>
              <span className="eh-track" aria-hidden="true">
                <span className="eh-fill" style={{ width: `${(r.confirmed / q) * 100}%` }} />
                {r.pending > 0 && (
                  <span
                    className="eh-fill eh-fill-hatch"
                    style={{
                      left: `calc(${(r.confirmed / q) * 100}% + 2px)`,
                      width: `${(r.pending / q) * 100}%`,
                    }}
                  />
                )}
              </span>
              <span className="eh-bar-val">
                {fmtNum(r.confirmed)}/{fmtNum(r.quota)}
              </span>
            </button>
          );
        })}
      </div>
      <TableView
        caption="ที่นั่งตามระยะ"
        head={['ระยะ', 'ยืนยันแล้ว', 'รอชำระ', 'ว่าง', 'ที่รับ']}
        rows={rows.map((r) => [
          r.name,
          r.confirmed,
          r.pending,
          Math.max(0, r.quota - r.confirmed - r.pending),
          r.quota,
        ])}
      />
    </section>
  );
};

const MoneyWaterfall: React.FC<{
  metrics: ScopedLedgerMetrics;
  timeWindow: TimeWindowFilter;
  onDrillDown: (t: DrillTarget) => void;
}> = ({ metrics, timeWindow, onDrillDown }) => {
  const gross = metrics.grossPaidSatang;
  const refund = metrics.succeededRefundSatang;
  const fee = metrics.platformRevenueSatang;
  const net = metrics.netOrganizerPayoutSatang;
  const max = Math.max(gross, 1);
  const H = 120;
  const top = 26;
  const base = top + H;
  const h = (v: number) => Math.max(v > 0 ? 2 : 0, (v / max) * H);
  const steps = [
    { key: 'payments' as const, label: 'รับชำระ', value: gross, from: 0, sign: '', cls: 'eh-col-d1' },
    { key: 'refunds' as const, label: 'คืนเงิน', value: refund, from: gross - refund, sign: '−', cls: 'eh-col-neutral' },
    { key: 'payments' as const, label: 'ค่าบริการ', value: fee, from: gross - refund - fee, sign: '−', cls: 'eh-col-neutral' },
    { key: 'payouts' as const, label: 'โอนให้ผู้จัด', value: net, from: 0, sign: '', cls: 'eh-col-d2' },
  ];
  const [boxRef, W] = useBoxWidth(310);
  const colX = (i: number) => 20 + i * ((W - 68) / 3);
  return (
    <section className="eh-panel" aria-labelledby="eh-money-h">
      <div className="eh-panel-head">
        <h2 id="eh-money-h">{tx('เงินค่าสมัครที่จะโอนให้ผู้จัด')}</h2>
        <span className="eh-sub">
          {txf('{0} · ไม่รวมร้านค้า · กดแท่งเพื่อดูรายการ', tx(WINDOW_LABEL[timeWindow]))}
        </span>
      </div>
      <div ref={boxRef}>
      <svg
        viewBox={`0 0 ${W} 182`}
        width={W}
        height={182}
        className="eh-svg"
        role="img"
        aria-label={txf(
          'รับชำระ {0} หักคืนเงิน {1} หักค่าบริการระบบ {2} เหลือโอนให้ผู้จัด {3}',
          formatThb(gross),
          formatThb(refund),
          formatThb(fee),
          formatThb(net)
        )}
      >
        <line x1="8" x2={W - 8} y1={base} y2={base} className="eh-grid" />
        {steps.map((s, i) => {
          const yTop = base - h(s.from + s.value);
          return (
            <g
              key={s.label}
              className="eh-col"
              role="button"
              tabIndex={0}
              aria-label={`${tx(s.label)} ${formatThb(s.value)}`}
              onClick={() => onDrillDown(s.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDrillDown(s.key);
                }
              }}
            >
              <rect x={colX(i) - 6} y={top - 18} width={56} height={H + 40} fill="transparent" />
              <rect x={colX(i)} y={yTop} width={28} height={h(s.value)} rx={s.from === 0 ? 4 : 0} className={s.cls} />
              <text x={colX(i) + 14} y={yTop - 6} textAnchor="middle" className="eh-tb">
                {s.sign}
                {formatThb(s.value).replace('฿', '')}
              </text>
              <text x={colX(i) + 14} y={base + 16} textAnchor="middle" className="eh-t">
                {tx(s.label)}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
      <p className="eh-note">{tx('หน่วยเป็นบาท · ยอดคืนเงินนับเมื่อผู้ให้บริการยืนยันแล้ว')}</p>
      <TableView
        caption="ยอดเงินค่าสมัคร"
        head={['รายการ', 'บาท']}
        rows={[
          ['รับชำระ', formatThb(gross, true)],
          ['หักคืนเงิน', formatThb(refund, true)],
          ['หักค่าบริการระบบ', formatThb(fee, true)],
          ['โอนให้ผู้จัด', formatThb(net, true)],
        ]}
      />
    </section>
  );
};

const ShirtsBySize: React.FC<{ event: RaceEvent; onOpen: () => void }> = ({ event, onOpen }) => {
  const stocks = event.shirtStocks;
  const max = Math.max(...stocks.map((s) => s.total), 1);
  const isLow = (left: number, total: number) => total > 0 && left <= Math.max(5, Math.round(total * 0.1));
  return (
    <section className="eh-panel" aria-labelledby="eh-shirt-h">
      <div className="eh-panel-head">
        <h2 id="eh-shirt-h">{tx('เสื้อตามไซซ์')}</h2>
        <span className="eh-sub">{tx('จองแล้วเทียบกับจำนวนที่เปิดจอง')}</span>
        <button type="button" className="eh-link" onClick={onOpen}>
          {tx('ดูสต็อกเสื้อ')} ›
        </button>
      </div>
      <div className="eh-legend">
        <span>
          <i className="eh-sw eh-sw-d1" aria-hidden="true" />
          {tx('จองแล้ว')}
        </span>
        <span>
          <i className="eh-sw eh-sw-trk" aria-hidden="true" />
          {tx('ยังว่าง')}
        </span>
      </div>
      {stocks.length === 0 ? (
        <p className="eh-note">{tx('ยังไม่ได้ตั้งจำนวนเสื้อแต่ละไซซ์')}</p>
      ) : (
        <div className="eh-cols" role="list" aria-label={tx('เสื้อตามไซซ์')}>
          {stocks.map((s) => {
            const left = Math.max(0, s.total - s.reservedOrConfirmed);
            const low = isLow(left, s.total);
            return (
              <div
                key={s.size}
                className={`eh-colbox${low ? ' is-low' : ''}`}
                role="listitem"
                aria-label={txf('ไซซ์ {0}: จองแล้ว {1} จาก {2} เหลือ {3}', s.size, s.reservedOrConfirmed, s.total, left)}
              >
                <span className="eh-col-label">
                  {low && <FaIcon name="triangle-exclamation" />}
                  {low ? txf('ใกล้หมด เหลือ {0}', left) : txf('เหลือ {0}', left)}
                </span>
                <span className="eh-col-track" style={{ height: `${(s.total / max) * 100}%` }} aria-hidden="true">
                  <span
                    className="eh-col-fill"
                    style={{ height: `${s.total ? (s.reservedOrConfirmed / s.total) * 100 : 0}%` }}
                  />
                </span>
                <span className="eh-col-size">{s.size}</span>
              </div>
            );
          })}
        </div>
      )}
      <TableView
        caption="เสื้อตามไซซ์"
        head={['ไซซ์', 'จองแล้ว', 'เปิดจอง', 'เหลือ']}
        rows={stocks.map((s) => [s.size, s.reservedOrConfirmed, s.total, Math.max(0, s.total - s.reservedOrConfirmed)])}
      />
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface Task {
  id: string;
  tone: 'urgent' | 'todo' | 'wait';
  text: string;
  action?: () => void;
  actionLabel?: string;
}

export const EventHomeView: React.FC<Props> = ({
  event,
  registrations,
  metrics,
  timeWindow,
  canViewFinance,
  canManageEventConfig,
  onNavigate,
  onDrillDown,
  onSubmitDraft,
}) => {
  const stage = useStage(event);
  const places = isTotalQuotaEnabled(event)
    ? event.totalEventQuota
    : event.categories.reduce((s, c) => s + c.categoryQuota, 0);

  const tasks: Task[] = useMemo(() => {
    const out: Task[] = [];
    const refunds = registrations.filter((r) => r.refundStatus === 'requested').length;
    if (canViewFinance && refunds > 0) {
      out.push({
        id: 'refund',
        tone: 'urgent',
        text: txf('คืนเงิน {0} รายการรอตรวจ', refunds),
        action: () => onDrillDown('refunds'),
        actionLabel: 'ไปตรวจคำขอคืนเงิน',
      });
    }
    if (event.status === 'draft') {
      const missing = event.readinessChecks.filter((c) => !c.passed).length;
      if (missing > 0) {
        out.push({ id: 'draft', tone: 'todo', text: txf('แบบร่างยังขาด {0} ส่วนก่อนส่งตรวจ', missing) });
      }
    }
    if (event.status === 'in_review') {
      out.push({ id: 'review', tone: 'wait', text: tx('รอแพลตฟอร์มตรวจก่อนเผยแพร่ ไม่ต้องทำอะไรเพิ่ม') });
    }
    if (canManageEventConfig && metrics.unassignedBibCount > 0) {
      out.push({
        id: 'bib',
        tone: 'todo',
        text: txf('{0} คนยืนยันแล้ว แต่ยังไม่มีเลข BIB', metrics.unassignedBibCount),
        action: () => onNavigate('evt_participants'),
        actionLabel: 'ไปกำหนดเลข BIB',
      });
    }
    event.shirtStocks
      .filter((s) => {
        const left = s.total - s.reservedOrConfirmed;
        return s.total > 0 && left <= Math.max(5, Math.round(s.total * 0.1));
      })
      .slice(0, 2)
      .forEach((s) =>
        out.push({
          id: `shirt-${s.size}`,
          tone: 'todo',
          text: txf('เสื้อไซซ์ {0} เหลือ {1} ตัว', s.size, Math.max(0, s.total - s.reservedOrConfirmed)),
          action: () => onNavigate('evt_kit'),
          actionLabel: 'ไปดูสต็อกเสื้อ',
        })
      );
    return out;
  }, [registrations, event, metrics.unassignedBibCount, canViewFinance, canManageEventConfig, onDrillDown, onNavigate]);

  const stageLabels = ['เตรียมงาน', 'เปิดรับสมัคร', 'รับอุปกรณ์และวันงาน', 'หลังงาน'];
  const stopped = event.status === 'suspended' || event.status === 'cancelled';

  return (
    <div className="eh-page">
      <header className="eh-header">
        <div>
          <h1>{tx('หน้าหลักของงาน')}</h1>
          <p className="eh-sub">
            <FaIcon name="calendar" /> {fmtDate(stage.raceMs, true)} · {tx(event.venue)} {tx(event.province)}
            {stage.daysToRace > 0 && ` · ${txf('อีก {0} วันถึงวันงาน', stage.daysToRace)}`}
          </p>
        </div>
        {!stopped && (
          <ol className="eh-stage" aria-label={tx('ช่วงของงาน')}>
            {stageLabels.map((l, i) => {
              const state = i < stage.current ? 'done' : i === stage.current ? 'now' : 'next';
              return (
                <li key={l} className={`eh-stage-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                  {state === 'done' && <FaIcon name="check" />}
                  {state === 'now' && <FaIcon name="location-dot" />}
                  <span>{tx(l)}</span>
                  {state === 'now' && i === 1 && stage.daysToClose !== null && stage.daysToClose >= 0 && (
                    <span className="eh-stage-extra">{txf('อีก {0} วันปิดรับ', stage.daysToClose)}</span>
                  )}
                  {state === 'now' && i === 0 && event.status === 'in_review' && (
                    <span className="eh-stage-extra">{tx('รอตรวจ')}</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </header>

      {(stopped || event.statusNote) && (
        <div className={`eh-banner${stopped ? ' is-stopped' : ''}`} role="status">
          <FaIcon name={stopped ? 'ban' : 'circle-info'} />
          <span>
            {stopped && <strong>{tx(event.status === 'cancelled' ? 'งานนี้ถูกยกเลิก' : 'งานนี้ถูกระงับชั่วคราว')} </strong>}
            {event.statusNote ? tx(event.statusNote) : ''}
          </span>
        </div>
      )}

      <section aria-labelledby="eh-todo-h" className="eh-todo">
        <h2 id="eh-todo-h" className="eh-todo-h">
          {tx('เรื่องที่ต้องทำ')}
          <span className="eh-sub">{tasks.length ? tx('เรียงตามความด่วน') : ''}</span>
        </h2>
        {tasks.length === 0 ? (
          <p className="eh-strip eh-strip-ok">
            <FaIcon name="circle-check" />
            {tx('ไม่มีเรื่องค้างในตอนนี้')}
          </p>
        ) : (
          <ul className="eh-strips">
            {tasks.map((t) => {
              const icon = t.tone === 'urgent' ? 'triangle-exclamation' : t.tone === 'wait' ? 'hourglass-half' : 'clock';
              const tag = t.tone === 'urgent' ? 'ด่วน' : t.tone === 'wait' ? 'รอแพลตฟอร์ม' : 'ควรทำ';
              const body = (
                <>
                  <FaIcon name={icon} />
                  <span className="eh-strip-text">
                    <strong>{tx(tag)}</strong> · {t.text}
                  </span>
                  {t.action && <FaIcon name="arrow-right" />}
                </>
              );
              return (
                <li key={t.id}>
                  {t.action ? (
                    <button
                      type="button"
                      className={`eh-strip eh-strip-${t.tone}`}
                      onClick={t.action}
                      aria-label={`${tx(tag)} · ${t.text} · ${tx(t.actionLabel ?? '')}`}
                    >
                      {body}
                    </button>
                  ) : (
                    <p className={`eh-strip eh-strip-${t.tone}`}>{body}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {event.status === 'draft' && (
        <section className="eh-panel" aria-labelledby="eh-ready-h">
          <div className="eh-panel-head">
            <h2 id="eh-ready-h">{tx('ความพร้อมก่อนส่งตรวจ')}</h2>
            <span className="eh-sub">
              {txf(
                'พร้อมแล้ว {0} จาก {1} ส่วน',
                event.readinessChecks.filter((c) => c.passed).length,
                event.readinessChecks.length
              )}
            </span>
          </div>
          <div className="eh-segbar" aria-hidden="true">
            {event.readinessChecks.map((c) => (
              <span key={c.id} className={c.passed ? 'is-done' : ''} />
            ))}
          </div>
          <ul className="eh-checks">
            {event.readinessChecks.map((c) => (
              <li key={c.id}>
                <FaIcon name={c.passed ? 'circle-check' : 'circle'} variant={c.passed ? 'solid' : 'regular'} />
                <span>
                  <strong>{tx(c.label)}</strong>
                  <span className="eh-sub"> · {tx(c.passed ? 'พร้อมแล้ว' : c.fixTargetHint)}</span>
                </span>
              </li>
            ))}
          </ul>
          {canManageEventConfig && (
            <button type="button" className="btn-primary" onClick={onSubmitDraft}>
              {tx('บันทึกข้อมูลที่ขาดและส่งตรวจอนุมัติเผยแพร่')}
            </button>
          )}
        </section>
      )}

      <SignupTrend
        registrations={registrations}
        places={places}
        openMs={stage.openMs}
        closeMs={stage.closeMs}
        today={stage.today}
      />

      <div className="eh-grid2">
        <SeatsByDistance event={event} registrations={registrations} onDrillDown={onDrillDown} />
        {canViewFinance ? (
          <MoneyWaterfall metrics={metrics} timeWindow={timeWindow} onDrillDown={onDrillDown} />
        ) : (
          <section className="eh-panel eh-locked" aria-labelledby="eh-money-lock-h">
            <h2 id="eh-money-lock-h">{tx('เงินค่าสมัครที่จะโอนให้ผู้จัด')}</h2>
            <p className="eh-note">
              <FaIcon name="lock" /> {tx('ตัวเลขเงินเห็นเฉพาะเจ้าขององค์กรและฝ่ายการเงิน')}
            </p>
          </section>
        )}
      </div>

      <ShirtsBySize event={event} onOpen={() => onNavigate('evt_kit')} />

      <p className="eh-note">
        {tx('ข้อมูลในระบบนี้เป็นข้อมูลจำลอง')} · {txf('ยอดเงินคิดตาม: {0}', tx(WINDOW_LABEL[timeWindow]))}
      </p>
    </div>
  );
};
