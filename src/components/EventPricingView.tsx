/**
 * "ระยะ ราคา และการรับสมัคร" — approved mockup (24 Nov 2026).
 * One page, five parts in the order an organizer sets up an event:
 * price periods on a timeline, seats per distance (never below what is already taken),
 * who pays the platform fee, age rules on an age axis, and a summary of the registration questions.
 * Editing that has its own tool (fee, total cap, age rules, questions) reuses that tool;
 * nothing here pretends to save something the server does not handle.
 */
import React, { useId, useMemo, useState } from 'react';
import type { RaceEvent, RegistrationRecord } from '../types';
import { calculateFeeQuote, formatThb } from '../utils/pricing';
import { validateQuotaUpdate } from '../utils/eventConfig';
import { ageBasisDate, resolveAgeBasis } from '../utils/age';
import { isContentField } from '../data/registrationForm';
import { getLang, tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import '../event-home.css';
import '../event-setup.css';

const DAY = 86_400_000;
const AGE_AXIS_MAX = 80;

const parseDay = (s: string | undefined): number | null => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

const todayBangkok = (): number => {
  const d = new Date(Date.now() + 7 * 3_600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

const shortDate = (ms: number) =>
  new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'th-TH', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(ms));

type Jump = { id: string; label: string };

export interface EventPricingViewProps {
  event: RaceEvent;
  /** registrations of this event only */
  registrations: RegistrationRecord[];
  canEdit: boolean;
  onSaveCategoryQuota: (categoryId: string, next: number) => void;
  onOpenFormEditor: () => void;
  /** existing tools, reused as they are */
  totalQuotaControl: React.ReactNode;
  feeBearer: React.ReactNode;
  ageRulesEditor: React.ReactNode;
}

export const EventPricingView: React.FC<EventPricingViewProps> = (p) => {
  const uid = useId();
  const ids = {
    price: `${uid}-price`,
    seats: `${uid}-seats`,
    fee: `${uid}-fee`,
    age: `${uid}-age`,
    form: `${uid}-form`,
  };
  const jumps: Jump[] = [
    { id: ids.price, label: 'ระยะและราคา' },
    { id: ids.seats, label: 'จำนวนรับ' },
    { id: ids.fee, label: 'ค่าบริการ' },
    { id: ids.age, label: 'เกณฑ์อายุ' },
    { id: ids.form, label: 'คำถามในใบสมัคร' },
  ];

  return (
    <div className="es-page">
      <header className="es-head">
        <div>
          <h1>{tx('ระยะ ราคา และการรับสมัคร')}</h1>
          <p className="es-sub">{tx('ตั้งว่ามีระยะอะไร ราคาเท่าไร รับกี่คน ใครสมัครได้ และถามอะไรเพิ่ม')}</p>
        </div>
      </header>

      <nav className="es-jumps" aria-label={tx('ไปยังส่วนของหน้านี้')}>
        {jumps.map((j) => (
          <a key={j.id} href={`#${j.id}`} className="es-jump">
            {tx(j.label)}
          </a>
        ))}
      </nav>

      <PriceTimeline id={ids.price} event={p.event} />
      <SeatsPanel id={ids.seats} {...p} />
      <div id={ids.fee} className="es-anchor">
        {p.feeBearer}
      </div>
      <AgePanel id={ids.age} event={p.event} editor={p.ageRulesEditor} canEdit={p.canEdit} />
      <QuestionsPanel id={ids.form} {...p} />
    </div>
  );
};

/* ---------------- 1. price periods ---------------- */

const PriceTimeline: React.FC<{ id: string; event: RaceEvent }> = ({ id, event }) => {
  const range = useMemo(() => {
    let start = Infinity;
    let end = -Infinity;
    for (const c of event.categories)
      for (const t of c.priceTiers) {
        const a = parseDay(t.startsAt);
        const b = parseDay(t.endsAt);
        if (a !== null) start = Math.min(start, a);
        if (b !== null) end = Math.max(end, b + DAY);
      }
    return Number.isFinite(start) && end > start ? { start, end } : null;
  }, [event.categories]);

  const today = todayBangkok();
  const ticks = useMemo(() => {
    if (!range) return [];
    const set = new Set<number>([range.start]);
    for (const c of event.categories)
      for (const t of c.priceTiers) {
        const a = parseDay(t.startsAt);
        if (a !== null) set.add(a);
      }
    return [...set].sort((a, b) => a - b);
  }, [range, event.categories]);

  const pct = (ms: number) => (range ? ((ms - range.start) / (range.end - range.start)) * 100 : 0);
  const todayIn = range && today >= range.start && today <= range.end;

  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('ระยะและช่วงราคา')}</h2>
        {range && (
          <span className="es-sub">
            {txf('เปิดรับ {0} – {1} · ราคาเปลี่ยนเองตามวัน', shortDate(range.start), shortDate(range.end - DAY))}
          </span>
        )}
      </div>

      {event.categories.length === 0 ? (
        <p className="es-empty">{tx('งานนี้ยังไม่มีระยะ')}</p>
      ) : (
        <div className="es-tl">
          {range && (
            <div className="es-tl-axis" aria-hidden="true">
              <span className="es-tl-label-col" />
              <div className="es-tl-scale">
                {ticks.map((t) => (
                  <span key={t} className="es-tl-tick" style={{ left: `${pct(t)}%` }}>
                    {shortDate(t)}
                  </span>
                ))}
                <span className="es-tl-tick is-end" style={{ left: '100%' }}>
                  {txf('ปิด {0}', shortDate(range.end - DAY))}
                </span>
              </div>
            </div>
          )}
          <ul className="es-tl-rows">
            {event.categories.map((cat) => (
              <li key={cat.id} className="es-tl-row">
                <div className="es-tl-label-col">
                  <strong>{tx(cat.name)}</strong>
                  <span className="es-sub">
                    {txf('{0} น. · BIB {1}', tx(cat.startTimeLocal), cat.bibPrefix)}
                  </span>
                </div>
                <div className="es-tl-track">
                  {todayIn && (
                    <span className="es-tl-today" style={{ left: `${pct(today)}%` }} aria-hidden="true">
                      <span>{tx('วันนี้')}</span>
                    </span>
                  )}
                  {cat.priceTiers.map((t) => {
                    const a = parseDay(t.startsAt);
                    const b = parseDay(t.endsAt);
                    const ended = !t.isCurrent && b !== null && b + DAY <= today;
                    const state = t.isCurrent ? 'is-current' : ended ? 'is-ended' : 'is-upcoming';
                    const stateText = t.isCurrent ? 'ใช้อยู่' : ended ? 'จบแล้ว' : 'ยังไม่เริ่ม';
                    const pays = calculateFeeQuote(t.priceSatang, event.feeBearerPolicy).runnerNetPaySatang;
                    const text =
                      `${tx(t.label)} ${formatThb(t.priceSatang)} · ${tx(stateText)}` +
                      (t.isCurrent ? ` · ${txf('นักวิ่งจ่าย {0}', formatThb(pays))}` : '');
                    const style =
                      range && a !== null && b !== null
                        ? { left: `${pct(a)}%`, width: `${Math.max(pct(b + DAY) - pct(a), 4)}%` }
                        : undefined;
                    return (
                      <span key={t.id} className={`es-tl-seg ${state}`} style={style} title={text}>
                        {t.isCurrent && <FaIcon name="circle-check" />}
                        <span className="es-tl-seg-text">{text}</span>
                      </span>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
          <p className="es-legend" aria-hidden="true">
            <span><i className="es-sw is-ended" />{tx('จบแล้ว')}</span>
            <span><i className="es-sw is-current" />{tx('ใช้อยู่')}</span>
            <span><i className="es-sw is-upcoming" />{tx('ยังไม่เริ่ม')}</span>
          </p>
        </div>
      )}
      <p className="es-note">
        {tx('การเพิ่มระยะหรือแก้ช่วงราคา ยังทำผ่านทีมแพลตฟอร์ม เพราะกระทบใบสมัครและยอดเงินที่มีอยู่')}
      </p>
    </section>
  );
};

/* ---------------- 2. seats ---------------- */

const SeatsPanel: React.FC<EventPricingViewProps & { id: string }> = ({
  id,
  event,
  registrations,
  canEdit,
  onSaveCategoryQuota,
  totalQuotaControl,
}) => {
  const counts = useMemo(() => {
    const m: Record<string, { confirmed: number; pending: number }> = {};
    for (const r of registrations) {
      const c = (m[r.categoryId] ??= { confirmed: 0, pending: 0 });
      if (r.registrationStatus === 'confirmed') c.confirmed += 1;
      else if (r.registrationStatus === 'pending_payment') c.pending += 1;
    }
    return m;
  }, [registrations]);

  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('จำนวนรับ')}</h2>
        <span className="es-sub">{tx('ลดต่ำกว่าคนที่สมัครแล้วไม่ได้')}</span>
      </div>
      <div className="es-total">{totalQuotaControl}</div>
      <p className="es-legend" aria-hidden="true">
        <span><i className="es-sw is-confirmed" />{tx('ยืนยันแล้ว')}</span>
        <span><i className="es-sw is-pending" />{tx('รอชำระ')}</span>
        <span><i className="es-sw is-min" />{tx('ลดได้ต่ำสุด')}</span>
      </p>
      <ul className="es-seats">
        {event.categories.map((cat) => (
          <SeatRow
            key={cat.id}
            name={cat.name}
            quota={cat.categoryQuota}
            confirmed={counts[cat.id]?.confirmed ?? 0}
            pending={counts[cat.id]?.pending ?? 0}
            canEdit={canEdit}
            onSave={(n) => onSaveCategoryQuota(cat.id, n)}
          />
        ))}
      </ul>
    </section>
  );
};

const SeatRow: React.FC<{
  name: string;
  quota: number;
  confirmed: number;
  pending: number;
  canEdit: boolean;
  onSave: (n: number) => void;
}> = ({ name, quota, confirmed, pending, canEdit, onSave }) => {
  const inputId = useId();
  const [draft, setDraft] = useState(quota);
  const [saved, setSaved] = useState(false);
  React.useEffect(() => {
    setDraft(quota);
  }, [quota]);

  const check = validateQuotaUpdate(draft, confirmed, pending);
  const scale = Math.max(quota, draft || 0, confirmed + pending, 1);
  const w = (n: number) => `${(n / scale) * 100}%`;
  const dirty = draft !== quota;

  return (
    <li className="es-seat">
      <div className="es-seat-name">
        <strong>{tx(name)}</strong>
        <span className="es-sub">{txf('ต่ำสุด {0}', check.minAllowed)}</span>
      </div>
      <div className="es-seat-bar" role="img" aria-label={txf('{0}: ยืนยันแล้ว {1} รอชำระ {2} จากที่รับ {3} คน', tx(name), confirmed, pending, quota)}>
        <span className="es-seat-fill is-confirmed" style={{ width: w(confirmed) }} />
        <span className="es-seat-fill is-pending" style={{ left: w(confirmed), width: w(pending) }} />
        <span className="es-seat-min" style={{ left: w(check.minAllowed) }} />
        <span className="es-seat-cap" style={{ left: `calc(${w(quota)} - 1px)` }} />
      </div>
      {canEdit ? (
        <div className="es-seat-edit">
          <div className="es-stepper">
            <button
              type="button"
              aria-label={txf('ลด {0} ลง 10 ที่', tx(name))}
              disabled={draft - 10 < check.minAllowed}
              onClick={() => {
                setSaved(false);
                setDraft((d) => Math.max(check.minAllowed, d - 10));
              }}
            >
              −
            </button>
            <label htmlFor={inputId} className="es-sr">
              {txf('จำนวนรับของ {0}', tx(name))}
            </label>
            <input
              id={inputId}
              type="number"
              inputMode="numeric"
              className="mono-num"
              min={check.minAllowed}
              value={Number.isFinite(draft) ? draft : ''}
              onChange={(e) => {
                setSaved(false);
                setDraft(Number(e.target.value));
              }}
            />
            <button
              type="button"
              aria-label={txf('เพิ่ม {0} อีก 10 ที่', tx(name))}
              onClick={() => {
                setSaved(false);
                setDraft((d) => (Number.isFinite(d) ? d : 0) + 10);
              }}
            >
              +
            </button>
          </div>
          {dirty && (
            <button
              type="button"
              className="es-btn is-primary es-btn-sm"
              disabled={!check.valid}
              onClick={() => {
                onSave(draft);
                setSaved(true);
              }}
            >
              {tx('บันทึก')}
            </button>
          )}
          {saved && !dirty && <span className="es-ok" role="status">{tx('บันทึกแล้ว')}</span>}
          {!check.valid && (
            <p className="es-error" role="alert">
              {check.message}
            </p>
          )}
        </div>
      ) : (
        <span className="mono-num es-seat-static">
          {txf('{0} / {1} คน', confirmed + pending, quota)}
        </span>
      )}
    </li>
  );
};

/* ---------------- 4. age rules ---------------- */

const AgePanel: React.FC<{ id: string; event: RaceEvent; editor: React.ReactNode; canEdit: boolean }> = ({
  id,
  event,
  editor,
  canEdit,
}) => {
  const [open, setOpen] = useState(false);
  const bases = new Set(event.categories.map((c) => resolveAgeBasis(c)));
  const basisText =
    bases.size === 1 && bases.has('race_day')
      ? txf('นับอายุ ณ วันงาน {0}', shortDate(parseDay(event.eventDate) ?? 0))
      : bases.size === 1
        ? txf('นับอายุ ณ {0}', shortDate(parseDay(ageBasisDate(event.eventDate, 'year_end')) ?? 0))
        : tx('แต่ละระยะนับอายุต่างวันกัน');
  const pos = (age: number) => `${(Math.min(age, AGE_AXIS_MAX) / AGE_AXIS_MAX) * 100}%`;

  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('เกณฑ์อายุ')}</h2>
        <span className="es-sub">{txf('{0} · แก้แล้วใบสมัครเดิมคงรุ่นเดิม', basisText)}</span>
        <button
          type="button"
          className="es-link"
          aria-expanded={open}
          aria-controls={`${id}-editor`}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? tx('ปิดตัวแก้') : canEdit ? tx('แก้เกณฑ์อายุ') : tx('ดูรายละเอียด')}
          <FaIcon name={open ? 'chevron-up' : 'chevron-right'} />
        </button>
      </div>

      <div className="es-age">
        <div className="es-age-axis" aria-hidden="true">
          <span className="es-tl-label-col" />
          <div className="es-age-scale">
            {[0, 20, 40, 60, 80].map((a) => (
              <span key={a} style={{ left: pos(a) }}>
                {a === AGE_AXIS_MAX ? tx('80+ ปี') : a}
              </span>
            ))}
          </div>
        </div>
        <ul className="es-age-rows">
          {event.categories.map((cat) => {
            const min = cat.minAge ?? null;
            const max = cat.maxAge ?? null;
            const groups = cat.ageGroups ?? [];
            const open = min === null && max === null;
            const cuts = [...new Set(groups.map((g) => g.minAge).filter((a) => a > (min ?? 0)))];
            const rangeText = open
              ? tx('ไม่จำกัดอายุ')
              : max === null
                ? `${min}+`
                : `${min ?? 0}–${max}`;
            const groupText = groups.length
              ? txf('{0} รุ่น', groups.length)
              : tx('ไม่แบ่งรุ่น');
            return (
              <li key={cat.id} className="es-age-row">
                <strong className="es-tl-label-col">{tx(cat.name)}</strong>
                <div className="es-age-track">
                  <span
                    className={`es-age-band${open ? ' is-open' : ''}`}
                    style={{ left: pos(min ?? 0), width: `calc(${pos(max ?? AGE_AXIS_MAX)} - ${pos(min ?? 0)})` }}
                  >
                    {cuts.map((c) => (
                      <i
                        key={c}
                        className="es-age-cut"
                        style={{
                          left: `${((c - (min ?? 0)) / ((max ?? AGE_AXIS_MAX) - (min ?? 0) || 1)) * 100}%`,
                        }}
                      />
                    ))}
                  </span>
                </div>
                <span className="es-age-text">
                  <strong className="mono-num">{rangeText}</strong> · {groupText}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="es-sub">{tx('ช่องที่คั่นในแถบ = จุดเริ่มของแต่ละรุ่นอายุ')}</p>
      </div>

      <div id={`${id}-editor`} hidden={!open} className="es-age-editor">
        {editor}
      </div>
    </section>
  );
};

/* ---------------- 5. registration questions ---------------- */

const QuestionsPanel: React.FC<EventPricingViewProps & { id: string }> = ({
  id,
  event,
  onOpenFormEditor,
}) => {
  const fields = (event.customFields ?? []).filter((f) => !f.hidden && !isContentField(f));
  const locked = fields.filter((f) => f.policy === 'LOCKED');
  const rest = fields.filter((f) => f.policy !== 'LOCKED');

  return (
    <section id={id} className="es-panel es-anchor form-moved-note" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('คำถามในใบสมัคร')}</h2>
        {event.publishedFormVersion && (
          <span className="es-sub">{txf('ฟอร์มที่เผยแพร่ {0}', tx(event.publishedFormVersion))}</span>
        )}
        <button type="button" className="es-btn es-btn-sm es-push" onClick={onOpenFormEditor}>
          <FaIcon name="pen-to-square" />
          {tx('ไปที่ฟอร์มสมัคร')}
        </button>
      </div>

      <p className="es-note">
        {tx('คำถามและขั้นตอนของคุณย้ายไปแก้ที่เมนู "ฟอร์มสมัคร" แล้ว ลากวางได้ ลองกรอกได้ และเผยแพร่เป็นเวอร์ชันใหม่')}
      </p>
      {fields.length === 0 ? (
        <p className="es-empty">{tx('ยังไม่มีคำถามเพิ่มเติม ใบสมัครถามเฉพาะข้อมูลพื้นฐาน')}</p>
      ) : (
        <ul className="es-questions">
          {locked.length > 0 && (
            <li className="es-q">
              <FaIcon name="lock" />
              <span className="es-q-main">
                <span className="es-q-label">{locked.map((f) => tx(f.label)).join(' · ')}</span>
                <span className="es-sub">{txf('ระบบล็อก · {0} ข้อ', locked.length)}</span>
              </span>
            </li>
          )}
          {rest.map((f) => (
            <li key={f.id} className="es-q">
              <FaIcon name={f.policy === 'CONFIGURABLE' ? 'sliders' : 'circle-question'} />
              <span className="es-q-main">
                <span className="es-q-label">{tx(f.label)}</span>
                {f.isSensitive && (
                  <span className="es-tag is-wait">
                    <FaIcon name="eye-slash" />
                    {tx('ซ่อนจากเจ้าหน้าที่หน้างาน')}
                  </span>
                )}
              </span>
              <span className="es-sub es-q-meta">
                {tx(f.policy === 'CONFIGURABLE' ? 'ปรับได้' : 'เพิ่มเอง')} ·{' '}
                {tx(f.required ? 'บังคับกรอก' : 'ไม่บังคับ')}
              </span>
            </li>
          ))}
        </ul>
      )}

    </section>
  );
};
