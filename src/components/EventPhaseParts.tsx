import { tx, txf } from '../i18n';
import { formatBasisDate } from '../utils/age';
import type { RunnerEventPhase, RunnerEventPhaseId } from '../utils/eventPhase';
import { FaIcon } from './FaIcon';

/* How the runner-facing event state reads on every page (27 Nov 2026, user request): the same
   words, icons and colours on the event list, the event page and the registration history.
   Icon + words in every pill, so colour is never the only signal. */

const PHASE_LABEL: Record<RunnerEventPhaseId, string> = {
  announced: 'เร็ว ๆ นี้',
  open: 'เปิดรับสมัคร',
  closing_soon: 'ใกล้ปิดรับ',
  almost_full: 'ใกล้เต็ม',
  partly_full: 'บางระยะเต็ม',
  full: 'เต็มแล้ว',
  paused: 'หยุดรับสมัครทางเว็บชั่วคราว',
  closed: 'ปิดรับสมัคร',
  kit_pickup: 'ช่วงรับอุปกรณ์',
  raceday: 'วันแข่ง',
  results_pending: 'รอประกาศผล',
  results: 'ประกาศผลแล้ว',
  suspended: 'ระงับชั่วคราว',
  cancelled: 'ยกเลิกงาน',
};

export const phaseLabel = (p: RunnerEventPhase) => tx(PHASE_LABEL[p.id]);

/** Font Awesome icons from the mock-up (output/event-status-mockup), per the user's request */
const PHASE_ICON: Record<RunnerEventPhaseId, string> = {
  announced: 'bullhorn',
  open: 'circle-check',
  closing_soon: 'clock',
  almost_full: 'fire',
  partly_full: 'user-minus',
  full: 'user-slash',
  paused: 'circle-pause',
  closed: 'lock',
  kit_pickup: 'box-open',
  raceday: 'flag-checkered',
  results_pending: 'hourglass-half',
  results: 'trophy',
  suspended: 'circle-pause',
  cancelled: 'ban',
};

export function PhaseIcon({ id }: { id: RunnerEventPhaseId }) {
  return <FaIcon name={PHASE_ICON[id]} />;
}

const d = (iso?: string) => (iso ? formatBasisDate(iso) : '');

/** one line under the pill; `short` keeps it to the single most useful fact (event list) */
export function phaseDetail(p: RunnerEventPhase, short = false): string {
  const kitWords = p.note ? txf('รับอุปกรณ์ {0}', tx(p.note)) : '';
  const kitDays =
    p.kitFrom && p.kitTo
      ? p.kitFrom === p.kitTo
        ? txf('รับอุปกรณ์ {0}', d(p.kitFrom))
        : txf('รับอุปกรณ์ {0} – {1}', d(p.kitFrom), d(p.kitTo))
      : '';
  const kit = short ? kitDays : kitWords || kitDays;
  const closes = p.closesOn ? txf('ปิดรับ {0}', d(p.closesOn)) : '';
  const join = (...parts: string[]) => (short ? parts.filter(Boolean)[0] ?? '' : parts.filter(Boolean).join(' · '));
  switch (p.id) {
    case 'announced':
      return p.opensOn ? txf('เปิดรับสมัคร {0}', d(p.opensOn)) : '';
    case 'open':
    case 'closing_soon':
      return join(closes, kit);
    case 'almost_full':
      return join(tx('ที่ว่างเหลือน้อย'), closes);
    case 'partly_full':
      return join(txf('{0} เต็มแล้ว · ระยะอื่นยังสมัครได้', (p.fullCodes ?? []).map((c) => tx(c)).join(', ')), closes);
    case 'full':
      return tx('ทุกระยะเต็มแล้ว');
    case 'paused':
      return tx('ใบสมัครที่ชำระแล้วยังมีผลตามเดิม');
    case 'closed':
      return kit;
    case 'kit_pickup':
      return short ? kitDays : kitWords || kitDays;
    case 'raceday':
      return p.firstStart ? txf('ปล่อยตัวรอบแรก {0} น.', p.firstStart) : '';
    case 'results_pending':
      return tx('ผลอย่างเป็นทางการจะแสดงเมื่อผู้จัดประกาศ');
    case 'results':
      return p.resultsOn ? txf('ประกาศเมื่อ {0}', d(p.resultsOn)) : '';
    case 'suspended':
      return p.note ? tx(p.note) : tx('ผู้จัดระงับงานนี้ชั่วคราว');
    case 'cancelled':
      return p.note ? tx(p.note) : tx('ผู้จัดยกเลิกงานนี้');
    default:
      return '';
  }
}

/** the pill: icon + words */
export function EventPhasePill({ phase, className = '' }: { phase: RunnerEventPhase; className?: string }) {
  return (
    <span className={`event-phase-pill is-${phase.tone} ${className}`.trim()}>
      <PhaseIcon id={phase.id} />
      {phaseLabel(phase)}
    </span>
  );
}

/** cancelled / suspended / postponed: the one thing a runner must not miss, above everything */
export function EventPhaseBanner({ phase, eventDate }: { phase: RunnerEventPhase; eventDate: string }) {
  if (phase.loud) {
    const detail = phaseDetail(phase);
    return (
      <div className={`event-phase-banner is-${phase.tone}`} role="status">
        <PhaseIcon id={phase.id} />
        <div>
          <strong>{phaseLabel(phase)}</strong>
          {detail && <p>{detail}</p>}
        </div>
      </div>
    );
  }
  const pp = phase.postponed;
  if (!pp) return null;
  return (
    <div className="event-phase-banner is-warn" role="status">
      <FaIcon name="calendar-xmark" />
      <div>
        <strong>{txf('เลื่อนงานเป็น {0}', d(eventDate))}</strong>
        <p>
          {[
            txf('จากเดิม {0}', d(pp.fromDate)),
            tx(pp.reason),
            pp.refundUntil ? txf('ขอคืนเงินได้ถึง {0}', d(pp.refundUntil)) : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </div>
  );
}
