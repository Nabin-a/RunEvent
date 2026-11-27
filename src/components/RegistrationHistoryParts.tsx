import type { RaceCategory, RaceEvent, RegistrationRecord } from '../types';
import { getLang, tx, txf } from '../i18n';
import { formatAgeGroupLabel, formatBasisDate } from '../utils/age';
import { isoToDdMmYyyy } from '../utils/dateFormat';
import { downloadFinisherCertificateSvg } from '../utils/finisherCertificate';
import { IconAward, IconDownload } from './Icons';

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

/** official result with the certificate buttons (only once a result is in) */
export function RegResultActions({
  reg,
  ev,
  cat,
  onPreview,
}: {
  reg: RegistrationRecord;
  ev: RaceEvent | undefined;
  cat: RaceCategory | undefined;
  onPreview: (reg: RegistrationRecord) => void;
}) {
  const res = reg.raceResult;
  if (!res) return null;
  return (
    <div className="reg-history-result">
      <span className="muted-inline">
        {tx('ผลการแข่งขัน')}{' '}
        <strong className="mono-num text-forest">
          {res.chipTime} ({res.paceMinPerKm})
        </strong>
      </span>
      <div className="cta-inline-row">
        <button type="button" className="btn-secondary" onClick={() => onPreview(reg)}>
          <IconAward size={15} />
          <span>{tx('ดูผลการแข่งขันและใบประกาศนียบัตร')}</span>
        </button>
        <button
          type="button"
          className="btn-ghost-sm"
          onClick={() =>
            downloadFinisherCertificateSvg({
              runnerName: reg.participantNameTh,
              eventTitle: ev?.titleTh ?? reg.eventId,
              eventDate: ev?.eventDate ?? '-',
              distanceLabel: `${cat?.distanceKm ?? 10} KM`,
              bibNumber: reg.bibNumber ?? '-',
              chipTime: res.chipTime,
              gunTime: res.gunTime,
              pace: res.paceMinPerKm,
              rank: res.overallRank,
              certCode: res.certificateCode,
            })
          }
        >
          <IconDownload size={15} />
          <span>{tx('ดาวน์โหลดใบประกาศนียบัตร')}</span>
        </button>
      </div>
    </div>
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

/** the finisher certificate card, opened from a result */
export function CertificatePreviewCard({ reg, onClose }: { reg: RegistrationRecord; onClose: () => void }) {
  const res = reg.raceResult;
  if (!res) return null;
  return (
    <div className="custom-field-creator certificate-preview-card">
      <div className="section-title-bar">
        <div>
          <strong>
            OFFICIAL FINISHER E-CERTIFICATE · <span className="mono-code">{res.certificateCode}</span>
          </strong>
          <div className="muted-inline">
            {tx('ยืนยันผลจากระบบจับเวลากลางเมื่อ')} <span className="mono-num">{res.verifiedAt}</span>
          </div>
        </div>
        <button type="button" className="btn-ghost-sm" onClick={onClose}>
          {tx('ปิดหน้าต่างใบเซอร์')}
        </button>
      </div>
      <div className="receipt-summary-box">
        <div>
          <span className="muted-inline">{tx('นักวิ่ง')}</span>
          <strong>{reg.participantNameTh}</strong>
        </div>
        <div>
          <span className="muted-inline">Chip Time / Gun Time</span>
          <strong className="mono-num text-forest">
            {res.chipTime} / {res.gunTime}
          </strong>
        </div>
        <div>
          <span className="muted-inline">Overall Rank</span>
          <strong className="mono-num">{res.overallRank}</strong>
        </div>
        <div>
          <span className="muted-inline">Age Group Rank</span>
          <strong className="mono-num">{res.categoryRank}</strong>
        </div>
      </div>
    </div>
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
