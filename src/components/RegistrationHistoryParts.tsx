import type { RaceCategory, RaceEvent, RegistrationRecord } from '../types';
import { getLang, tx, txf } from '../i18n';
import { formatAgeGroupLabel, formatBasisDate } from '../utils/age';
import { isoToDdMmYyyy } from '../utils/dateFormat';
import { runnerEventPhase } from '../utils/eventPhase';
import { EventPhaseBanner, EventPhasePill, phaseDetail } from './EventPhaseParts';

/* Parts of the old profile tab "ประวัติงานที่สมัคร", now shown on the single
   "ประวัติการสมัคร & การสั่งซื้อ" page (27 Nov 2026, user request: one place). */

export type HistoryFilter = 'all' | 'upcoming' | 'past';

/** the event is over: marked completed, or its date is before today (Bangkok) */
export function regIsPast(ev: RaceEvent | undefined, todayIso: string): boolean {
  return ev?.status === 'completed' || (ev?.eventDate ? ev.eventDate < todayIso : false);
}

/** "อายุ 31 ปี ณ 31 ธ.ค. 2026 · 30–39 ปี" from the age fixed at sign-up */
export function regAgeText(reg: RegistrationRecord, cat: RaceCategory | undefined): string | null {
  const snap = reg.ageSnapshot;
  if (!snap) return null;
  const age = txf('อายุ {0} ปี ณ {1}', snap.ageYears, formatBasisDate(snap.basisDate));
  let group: string;
  if (!snap.groupId) {
    group = cat?.ageGroups?.length ? tx('ไม่เข้ารุ่นใด') : tx('งานนี้ไม่แบ่งรุ่นอายุ');
  } else {
    const g = cat?.ageGroups?.find((x) => x.id === snap.groupId);
    group = g ? formatAgeGroupLabel(g) : tx(snap.groupLabelTh ?? '');
  }
  return `${age} · ${group}`;
}

/** short form for the card: "32 ปี · หญิง 30–39 ปี", or just "32 ปี" without age groups */
export function regAgeShort(reg: RegistrationRecord, cat: RaceCategory | undefined): string | null {
  const snap = reg.ageSnapshot;
  if (!snap) return null;
  const age = txf('{0} ปี', snap.ageYears);
  if (!snap.groupId) return age;
  const g = cat?.ageGroups?.find((x) => x.id === snap.groupId);
  const group = g ? formatAgeGroupLabel(g) : tx(snap.groupLabelTh ?? '');
  return group ? `${age} · ${group}` : age;
}

/* ---- Race result, easy to read (27 Nov 2026, user request) ----
   distance, finish time, pace and rank side by side, plus a coloured badge for how the runner
   placed. The badge is measured against the runner's age group; an event without age groups
   (or a result without a group rank) falls back to the overall rank of the distance. A result
   without any rank, or a DNF / DNS, gets the neutral colour. */

type ResultTier = 'top10' | 'top25' | 'top50' | 'finisher' | 'none';

/** "12 / 118 (หญิง 30–39)" → { rank: 12, total: 118 } */
function parseRank(text: string | undefined): { rank: number; total: number } | null {
  const m = text?.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const rank = Number(m[1]);
  const total = Number(m[2]);
  return rank > 0 && total > 0 && rank <= total ? { rank, total } : null;
}

/** "00:54:18" → "54:18" under an hour, "1:05:30" from an hour up */
function formatFinishTime(time: string): { value: string; unit: string } {
  const parts = time.split(':').map((x) => Number(x));
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    const [h, m, sec] = parts;
    const ss = String(sec).padStart(2, '0');
    if (h === 0) return { value: `${m}:${ss}`, unit: tx('นาที') };
    return { value: `${h}:${String(m).padStart(2, '0')}:${ss}`, unit: tx('ชม.') };
  }
  return { value: time, unit: '' };
}

function resultTier(share: number): ResultTier {
  if (share <= 0.1) return 'top10';
  if (share <= 0.25) return 'top25';
  if (share <= 0.5) return 'top50';
  return 'finisher';
}

export function RegResult({ reg, cat }: { reg: RegistrationRecord; cat: RaceCategory | undefined }) {
  const res = reg.raceResult;
  if (!res) return null;

  const finished = res.status === 'Finisher';
  // age-group rank only when the distance has age groups and the runner was placed in one
  const hasAgeGroup = Boolean(cat?.ageGroups?.length) && Boolean(reg.ageSnapshot?.groupId);
  const groupRank = hasAgeGroup ? parseRank(res.categoryRank) : null;
  const overallRank = parseRank(res.overallRank);
  const basis = groupRank ? 'group' : overallRank ? 'overall' : null;
  const rank = groupRank ?? overallRank;

  let tier: ResultTier = 'none';
  let badge: string;
  if (!finished) {
    badge = res.status === 'DNF' ? tx('ไม่ถึงเส้นชัย (DNF)') : tx('ไม่ได้ออกสตาร์ต (DNS)');
  } else if (rank) {
    const share = rank.rank / rank.total;
    tier = resultTier(share);
    const pct = Math.max(1, Math.ceil(share * 100));
    badge =
      tier === 'finisher'
        ? tx('เข้าเส้นชัย')
        : basis === 'group'
          ? txf('Top {0}% ในรุ่น', pct)
          : txf('Top {0}% รวม', pct);
  } else {
    badge = tx('เข้าเส้นชัย');
  }

  const time = formatFinishTime(res.chipTime);
  const pace = res.paceMinPerKm.replace(/\s*\/\s*km$/i, '');
  const distance = cat?.distanceKm;

  return (
    <section className={`reg-result is-${tier}`} aria-label={tx('ผลการแข่งขัน')}>
      <header className="reg-result-head">
        <strong>{tx('ผลการแข่งขัน')}</strong>
        <span className="reg-result-badge">{badge}</span>
      </header>
      {finished && (
        <dl className="reg-result-stats">
          {distance ? (
            <div>
              <dt>{tx('ระยะ')}</dt>
              <dd>
                <span className="mono-num">{distance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
                <small>{tx('กม.')}</small>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{tx('เวลาสุทธิ')}</dt>
            <dd>
              <span className="mono-num">{time.value}</span>
              {time.unit && <small>{time.unit}</small>}
            </dd>
          </div>
          <div>
            <dt>{tx('เพซเฉลี่ย')}</dt>
            <dd>
              <span className="mono-num">{pace}</span>
              <small>{tx('/กม.')}</small>
            </dd>
          </div>
          {rank && (
            <div>
              <dt>{basis === 'group' ? tx('อันดับในรุ่น') : tx('อันดับรวม')}</dt>
              <dd>
                <span className="mono-num">{rank.rank}</span>
                <small>/{rank.total}</small>
              </dd>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}

/** what the entry recorded at sign-up (kept apart from the current profile) */
export function RegSnapshotDetails({ reg }: { reg: RegistrationRecord }) {
  const isEn = getLang() === 'en';
  return (
    <div className="price-breakdown-box reg-history-details">
      <strong>{tx('ข้อมูลใบสมัครที่บันทึกไว้ ณ เวลาสมัคร (แยกจากโปรไฟล์ปัจจุบัน)')}</strong>
      <div className="breakdown-line">
        <span>{tx('ชื่อผู้เข้าแข่งขัน:')}</span>
        <strong>{isEn ? reg.participantNameEn || reg.participantNameTh : reg.participantNameTh}</strong>
      </div>
      {reg.participantSnapshot?.dateOfBirth && (
        <div className="breakdown-line">
          <span>{tx('วันเกิด ณ วันสมัคร:')}</span>
          <span className="mono-num">{isoToDdMmYyyy(reg.participantSnapshot.dateOfBirth)}</span>
        </div>
      )}
      {reg.participantSnapshot?.idNumberMasked && (
        <div className="breakdown-line">
          <span>{tx('เลขเอกสารยืนยันตัวตน:')}</span>
          <span className="mono-code">{reg.participantSnapshot.idNumberMasked}</span>
        </div>
      )}
      <div className="breakdown-line">
        <span>{tx('ผู้ติดต่อฉุกเฉินของใบสมัครนี้:')}</span>
        <span>{tx(reg.emergencyContact)}</span>
      </div>
      <div className="breakdown-line">
        <span>{tx('วิธีรับชุดแข่งขัน:')}</span>
        <span>
          {reg.kitDeliveryMethod === 'postal_shipping'
            ? txf('จัดส่งไปรษณีย์ ({0})', reg.shippingAddressSnapshot ?? '-')
            : tx('รับที่หน้างานด้วยคิวอาร์โค้ดเช็กอิน')}
        </span>
      </div>
    </div>
  );
}

/* ---- The event's state on the card (27 Nov 2026, user request) ----
   apart from the runner's own track below it: the same for everyone in the event. Cancelled,
   suspended and postponed events get a banner above the card's headline instead. Words, icons
   and colours are shared with the event list and the event page (EventPhaseParts). */

/** `place="top"` draws only the banner (cancelled / suspended / postponed), above the card's
    headline; `place="line"` draws only the quiet line, under the date and place */
export function RegEventStatus({
  ev,
  reg,
  today,
  place,
}: {
  ev: RaceEvent | undefined;
  reg: RegistrationRecord;
  today: string;
  place: 'top' | 'line';
}) {
  if (!ev) return null;
  const phase = runnerEventPhase(ev, today, { hasResult: Boolean(reg.raceResult) });
  if (!phase) return null;
  if (place === 'top') return <EventPhaseBanner phase={phase} eventDate={ev.eventDate} />;
  if (phase.loud) return null;
  const detail = phaseDetail(phase);
  return (
    <p className="reg-event-status">
      <span className="reg-event-status-label">{tx('สถานะงาน')}</span>
      <EventPhasePill phase={phase} />
      {detail && <span className="reg-event-status-detail">{detail}</span>}
    </p>
  );
}

/* ---- Card status, made easy to read (27 Nov 2026, user request) ----
   One headline says what the runner should know or do next; a three-step track below
   keeps entry, payment and kit pickup as separate states (they are separate in the data). */

type Tone = 'ok' | 'wait' | 'stop' | 'muted';

export function regHeadline(reg: RegistrationRecord, isPast: boolean): { label: string; tone: Tone } {
  if (reg.refundStatus === 'succeeded') return { label: 'คืนเงินแล้ว', tone: 'muted' };
  if (reg.refundStatus !== 'none' && reg.refundStatus !== 'rejected') return { label: 'กำลังคืนเงิน', tone: 'wait' };
  switch (reg.registrationStatus) {
    case 'pending_payment':
      return { label: 'รอชำระเงิน', tone: 'wait' };
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', tone: 'stop' };
    case 'expired':
      return { label: 'หมดเวลาชำระเงิน', tone: 'stop' };
    default:
      if (isPast) return { label: 'จบการแข่งขันแล้ว', tone: 'muted' };
      if (reg.fulfillmentStatus === 'kit_picked_up') return { label: 'รับอุปกรณ์แล้ว', tone: 'ok' };
      return { label: 'ยืนยันสิทธิ์แล้ว', tone: 'ok' };
  }
}

export function RegHeadline({ reg, isPast }: { reg: RegistrationRecord; isPast: boolean }) {
  const h = regHeadline(reg, isPast);
  return <span className={`reg-headline is-${h.tone}`}>{tx(h.label)}</span>;
}

type StepState = 'done' | 'now' | 'todo' | 'stop';

/** entry → payment → kit pickup, each with its own state */
export function RegProgress({ reg }: { reg: RegistrationRecord }) {
  const stopped = reg.registrationStatus === 'cancelled' || reg.registrationStatus === 'expired';
  const entry: [StepState, string] =
    reg.registrationStatus === 'confirmed'
      ? ['done', 'ยืนยันแล้ว']
      : reg.registrationStatus === 'pending_payment'
        ? ['done', 'จองที่แล้ว']
        : ['stop', reg.registrationStatus === 'expired' ? 'หมดเวลา' : 'ยกเลิก'];
  const pay: [StepState, string] =
    reg.paymentStatus === 'succeeded'
      ? ['done', 'ชำระแล้ว']
      : reg.paymentStatus === 'pending'
        ? ['now', 'รอชำระ']
        : reg.paymentStatus === 'failed'
          ? ['stop', 'ไม่สำเร็จ']
          : ['stop', 'หมดอายุ'];
  const kit: [StepState, string] = stopped
    ? ['stop', '—']
    : reg.fulfillmentStatus === 'kit_picked_up'
      ? ['done', 'รับแล้ว']
      : reg.fulfillmentStatus === 'checked_in'
        ? ['done', 'เช็กอินแล้ว']
        : reg.fulfillmentStatus === 'ready'
          ? ['now', 'พร้อมรับ']
          : ['todo', 'หลังชำระเงิน'];
  const steps: { name: string; s: [StepState, string] }[] = [
    { name: 'ใบสมัคร', s: entry },
    { name: 'ชำระเงิน', s: pay },
    { name: 'รับอุปกรณ์', s: kit },
  ];
  return (
    <ol className="reg-progress" aria-label={tx('สถานะใบสมัคร')}>
      {steps.map(({ name, s: [state, note] }) => (
        <li key={name} className={`is-${state}`}>
          <span className="reg-progress-dot" aria-hidden="true" />
          <span className="reg-progress-name">{tx(name)}</span>
          <span className="reg-progress-note">{tx(note)}</span>
        </li>
      ))}
    </ol>
  );
}
