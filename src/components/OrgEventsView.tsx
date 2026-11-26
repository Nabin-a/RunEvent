/**
 * Organization "งานทั้งหมด" — approved mockup, 24 Nov 2026.
 * Merges the old organization overview and event list:
 * to-dos across every event (each prefixed with the event) → event calendar
 * (signup windows and race days) → event list with status filters, search and
 * the next step for each event → create a draft / copy last year's event.
 * Detailed numbers live on each event's home page, not here.
 */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { AuditLogEntry, RaceEvent, RegistrationRecord, EventStatus } from '../types';
import type { OrgSection } from './OrganizerDashboardView';
import { isTotalQuotaEnabled } from '../utils/eventConfig';
import { EventStatusBadge } from './StatusBadges';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../org-events.css';

type Group = 'all' | 'open' | 'review' | 'draft' | 'done' | 'stopped';

interface Props {
  orgName: string;
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  isStaff: boolean;
  canManageEventConfig: boolean;
  canViewFinance: boolean;
  canCheckIn: boolean;
  bankReady: boolean;
  canManageOrgBank: boolean;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onOpenEvent: (eventId: string, section: OrgSection) => void;
  onOpenOrgSection: (section: OrgSection) => void;
  onCreateDraft: (payload: { titleTh: string; province: string; eventDate: string; requestProductionHelp: boolean }) => void;
  onDuplicate: (eventId: string) => void;
  /** this organization's audit log, newest last */
  auditLogs: AuditLogEntry[];
}

const GROUP_OF: Record<EventStatus, Exclude<Group, 'all'>> = {
  published: 'open',
  in_review: 'review',
  draft: 'draft',
  closed: 'done',
  completed: 'done',
  suspended: 'stopped',
  cancelled: 'stopped',
};
const GROUP_LABEL: Record<Group, string> = {
  all: 'ทั้งหมด',
  open: 'เปิดรับสมัคร',
  review: 'รอตรวจ',
  draft: 'แบบร่าง',
  done: 'ปิดรับหรือจบแล้ว',
  stopped: 'ระงับหรือยกเลิก',
};

const DAY = 86400000;
const toDay = (iso: string) => {
  const d = new Date(iso);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
};
const fmtDate = (ms: number, year = false) =>
  new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }).format(
    new Date(ms)
  );
const fmtMonth = (ms: number) =>
  new Intl.DateTimeFormat('th-TH', { month: 'short', timeZone: 'UTC' }).format(new Date(ms));

interface Task {
  id: string;
  tone: 'urgent' | 'todo' | 'wait';
  eventName: string;
  text: string;
  run?: () => void;
}

export const OrgEventsView: React.FC<Props> = ({
  orgName,
  events,
  registrations,
  isStaff,
  canManageEventConfig,
  canViewFinance,
  canCheckIn,
  bankReady,
  canManageOrgBank,
  createOpen,
  onCreateOpenChange,
  onOpenEvent,
  onOpenOrgSection,
  onCreateDraft,
  onDuplicate,
  auditLogs,
}) => {
  const [group, setGroup] = useState<Group>('all');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({ titleTh: '', province: '', eventDate: '', requestProductionHelp: false });
  const [formError, setFormError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const today = toDay(new Date().toISOString());
  const landing: OrgSection = isStaff ? 'evt_checkin_bib' : 'evt_overview';

  const shortName = (ev: RaceEvent) => ev.titleTh.length > 28 ? `${ev.titleTh.slice(0, 26)}…` : ev.titleTh;

  /* ---------- to-dos across events ---------- */
  const tasks: Task[] = useMemo(() => {
    const out: Task[] = [];
    if (!bankReady && canManageOrgBank) {
      out.push({
        id: 'bank',
        tone: 'urgent',
        eventName: tx('องค์กร'),
        text: tx('ยังไม่ได้ยืนยันบัญชีรับเงิน ต้องมีก่อนเปิดรับสมัคร'),
        run: () => onOpenOrgSection('org_team_settings'),
      });
    }
    events.forEach((ev) => {
      const regs = registrations.filter((r) => r.eventId === ev.id);
      const refunds = regs.filter((r) => r.refundStatus === 'requested').length;
      if (canViewFinance && refunds > 0) {
        out.push({
          id: `refund-${ev.id}`,
          tone: 'urgent',
          eventName: shortName(ev),
          text: txf('คืนเงิน {0} รายการรอตรวจ', refunds),
          run: () => onOpenEvent(ev.id, 'evt_finance'),
        });
      }
      if (ev.status === 'draft' && canManageEventConfig) {
        const missing = ev.readinessChecks.filter((c) => !c.passed).length;
        out.push({
          id: `draft-${ev.id}`,
          tone: 'todo',
          eventName: shortName(ev),
          text: missing ? txf('แบบร่างยังขาด {0} ส่วน', missing) : tx('แบบร่างพร้อมส่งตรวจ'),
          run: () => onOpenEvent(ev.id, 'evt_overview'),
        });
      }
      if (ev.status === 'in_review') {
        out.push({ id: `review-${ev.id}`, tone: 'wait', eventName: shortName(ev), text: tx('รอแพลตฟอร์มตรวจก่อนเผยแพร่') });
      }
      if (ev.status === 'published' && canCheckIn) {
        const noBib = regs.filter((r) => r.registrationStatus === 'confirmed' && !r.bibNumber).length;
        if (noBib > 0) {
          out.push({
            id: `bib-${ev.id}`,
            tone: 'todo',
            eventName: shortName(ev),
            text: txf('{0} คนยังไม่มีเลข BIB', noBib),
            run: () => onOpenEvent(ev.id, isStaff ? 'evt_checkin_bib' : 'evt_participants'),
          });
        }
      }
    });
    const rank = { urgent: 0, todo: 1, wait: 2 };
    return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, registrations, bankReady, canManageOrgBank, canViewFinance, canManageEventConfig, canCheckIn, isStaff]);

  /* ---------- calendar ---------- */
  const cal = useMemo(() => {
    const rows = events
      .map((ev) => {
        const tiers = ev.categories.flatMap((c) => c.priceTiers);
        const open = tiers.length ? Math.min(...tiers.map((t) => toDay(t.startsAt))) : null;
        const close = tiers.length ? Math.max(...tiers.map((t) => toDay(t.endsAt))) : null;
        return { ev, open, close, race: toDay(ev.eventDate) };
      })
      .sort((a, b) => a.race - b.race);
    const all = rows.flatMap((r) => [r.open, r.close, r.race]).filter((x): x is number => x !== null);
    if (all.length === 0) return null;
    const start = Math.min(...all, today) - 7 * DAY;
    const end = Math.max(...all, today) + 14 * DAY;
    const months: number[] = [];
    const d = new Date(start);
    let m = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    while (m < end) {
      months.push(m);
      const md = new Date(m);
      m = Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, 1);
    }
    // one cell per day; dates 1, 8, 15, 22 and 29 are labelled (26 Nov 2026, user request)
    const dayCount = Math.round((end - start) / DAY);
    const dayLabels: number[] = [];
    for (let t = start; t < end; t += DAY) {
      if ([1, 8, 15, 22, 29].includes(new Date(t).getUTCDate())) dayLabels.push(t);
    }
    return { rows, start, end, months, dayCount, dayLabels };
  }, [events, today]);
  // start the scrolled timeline with today in view
  const calScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = calScrollRef.current;
    if (!el || !cal) return;
    const inner = el.firstElementChild as HTMLElement | null;
    if (!inner) return;
    const nameCol = el.clientWidth < 600 ? 104 : 152;
    const x = nameCol + ((inner.scrollWidth - nameCol) * pct(today)) / 100;
    el.scrollLeft = Math.max(0, x - el.clientWidth / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cal?.start, cal?.end]);
  const pct = (ms: number) => (cal ? ((ms - cal.start) / (cal.end - cal.start)) * 100 : 0);

  /* ---------- list ---------- */
  const counts = useMemo(() => {
    const c: Record<Group, number> = { all: events.length, open: 0, review: 0, draft: 0, done: 0, stopped: 0 };
    events.forEach((e) => (c[GROUP_OF[e.status]] += 1));
    return c;
  }, [events]);
  const list = events
    .filter((e) => group === 'all' || GROUP_OF[e.status] === group)
    .filter((e) => {
      const q = query.trim().toLowerCase();
      return !q || `${e.titleTh} ${e.titleEn} ${e.code} ${e.province}`.toLowerCase().includes(q);
    })
    .sort((a, b) => toDay(a.eventDate) - toDay(b.eventDate));

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titleTh.trim() || !form.province.trim() || !form.eventDate) {
      setFormError(tx('ใส่ชื่องาน จังหวัด และวันจัดงานให้ครบ'));
      return;
    }
    if (toDay(form.eventDate) <= today) {
      setFormError(tx('วันจัดงานต้องเป็นวันในอนาคต'));
      return;
    }
    onCreateDraft({ ...form, titleTh: form.titleTh.trim(), province: form.province.trim() });
    setForm({ titleTh: '', province: '', eventDate: '', requestProductionHelp: false });
    setFormError('');
    onCreateOpenChange(false);
  };

  return (
    <div className="oe-page">
      <header className="oe-head">
        <div>
          <h1>{tx('งานทั้งหมด')}</h1>
          <p className="oe-sub">
            {tx(orgName)} · {txf('{0} งาน', events.length)}
          </p>
        </div>
        {canManageEventConfig && (
          <button type="button" className="oe-btn is-primary" aria-expanded={createOpen} onClick={() => onCreateOpenChange(!createOpen)}>
            <FaIcon name={createOpen ? 'xmark' : 'plus'} />
            {tx(createOpen ? 'ปิดฟอร์มสร้างงาน' : 'สร้างงานใหม่')}
          </button>
        )}
      </header>

      {createOpen && canManageEventConfig && (
        <form className="oe-panel oe-form" onSubmit={submitCreate} aria-labelledby="oe-create-h">
          <h2 id="oe-create-h">{tx('สร้างงานแบบร่าง')}</h2>
          <p className="oe-sub">{tx('บันทึกเป็นแบบร่างก่อน แล้วค่อยตั้งระยะ ราคา และหน้างาน ยังไม่เปิดขายจนกว่าแพลตฟอร์มตรวจผ่าน')}</p>
          <div className="oe-form-grid">
            <label>
              <span>{tx('ชื่องาน')}</span>
              <input
                value={form.titleTh}
                placeholder={tx('เช่น ขอนแก่น ซิตี้ รัน 2027')}
                onChange={(e) => {
                  setForm({ ...form, titleTh: e.target.value });
                  setFormError('');
                }}
              />
            </label>
            <label>
              <span>{tx('จังหวัด')}</span>
              <input
                value={form.province}
                placeholder={tx('เช่น ขอนแก่น')}
                onChange={(e) => {
                  setForm({ ...form, province: e.target.value });
                  setFormError('');
                }}
              />
            </label>
            <label>
              <span>{tx('วันจัดงาน')}</span>
              <input
                type="date"
                value={form.eventDate}
                onChange={(e) => {
                  setForm({ ...form, eventDate: e.target.value });
                  setFormError('');
                }}
              />
            </label>
          </div>
          <label className="oe-check">
            <input
              type="checkbox"
              checked={form.requestProductionHelp}
              onChange={(e) => setForm({ ...form, requestProductionHelp: e.target.checked })}
            />
            <span>{tx('อยากให้ทีมกระต่ายช่วยเสนอราคาผลิตเสื้อและเหรียญของงานนี้')}</span>
          </label>
          {formError && (
            <p className="oe-error" role="alert">
              <FaIcon name="triangle-exclamation" />
              {formError}
            </p>
          )}
          <div className="oe-form-actions">
            <button type="submit" className="oe-btn is-primary">
              {tx('บันทึกแบบร่าง')}
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="oe-todo-h">
        <h2 id="oe-todo-h" className="oe-h2">
          {tx('เรื่องที่ต้องทำ')} <span className="oe-sub">{tx(tasks.length ? 'รวมทุกงาน เรียงตามความด่วน' : '')}</span>
        </h2>
        {tasks.length === 0 ? (
          <p className="eh-strip eh-strip-ok">
            <FaIcon name="circle-check" />
            {tx('ไม่มีเรื่องค้างในทุกงานตอนนี้')}
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
                    <strong>{tx(tag)}</strong> · {tx(t.eventName)}: {t.text}
                  </span>
                  {t.run && <FaIcon name="arrow-right" />}
                </>
              );
              return (
                <li key={t.id}>
                  {t.run ? (
                    <button type="button" className={`eh-strip eh-strip-${t.tone}`} onClick={t.run}>
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

      {cal && (
        <section className="oe-panel" aria-labelledby="oe-cal-h">
          <div className="oe-panel-head">
            <h2 id="oe-cal-h">{tx('ปฏิทินงาน')}</h2>
            <span className="oe-sub">{tx('แถบ = ช่วงรับสมัคร · ธง = วันงาน')}</span>
          </div>
          <div className="oe-cal-scroll" ref={calScrollRef}>
          <div
            className="oe-cal"
            style={{ ['--oe-days' as string]: cal.dayCount }}
            role="img"
            aria-label={cal.rows
            .map((r) =>
              r.open !== null && r.close !== null
                ? txf('{0} รับสมัคร {1} ถึง {2} วันงาน {3}', r.ev.titleTh, fmtDate(r.open), fmtDate(r.close), fmtDate(r.race))
                : txf('{0} ยังไม่ตั้งช่วงรับสมัคร วันงาน {1}', r.ev.titleTh, fmtDate(r.race))
            )
            .join('; ')}>
            {/* covers the dates scrolled under the name column */}
            <div className="oe-cal-corner" aria-hidden="true" />
            <div className="oe-cal-months" aria-hidden="true">
              {cal.months.map((m) => (
                <span key={m} style={{ left: `${pct(m)}%` }}>
                  {fmtMonth(m)}
                </span>
              ))}
            </div>
            <div className="oe-cal-days" aria-hidden="true">
              {cal.dayLabels.map((t) => (
                <span
                  key={t}
                  className={t === today ? 'is-today' : undefined}
                  style={{ left: `${pct(t)}%`, width: `${pct(cal.start + DAY)}%` }}
                >
                  {new Date(t).getUTCDate()}
                </span>
              ))}
            </div>
            <div className="oe-cal-body">
              <div className="oe-cal-overlay" aria-hidden="true">
                {cal.months.map((m) => (
                  <i key={m} className="oe-cal-grid" style={{ left: `${pct(m)}%` }} />
                ))}
                <i className="oe-cal-today" style={{ left: `${pct(today)}%` }}>
                  <span>{tx('วันนี้')}</span>
                </i>
              </div>
              {cal.rows.map((r) => {
                const planned = r.ev.status === 'draft' || r.ev.status === 'in_review';
                const past = ['closed', 'completed', 'suspended', 'cancelled'].includes(r.ev.status);
                return (
                  <div key={r.ev.id} className="oe-cal-row">
                    <span className="oe-cal-name">{tx(shortName(r.ev))}</span>
                    <span className="oe-cal-lane">
                      {r.open !== null && r.close !== null ? (
                        <span
                          className={`oe-cal-bar${planned ? ' is-planned' : ''}${past ? ' is-past' : ''}`}
                          style={{ left: `${pct(r.open)}%`, width: `${Math.max(0.8, pct(r.close) - pct(r.open))}%` }}
                        />
                      ) : (
                        <span className="oe-cal-none">{tx('ยังไม่ตั้งช่วงรับสมัคร')}</span>
                      )}
                      <span className={`oe-cal-flag${pct(r.race) > 80 ? ' is-end' : ''}`} style={{ left: `${pct(r.race)}%` }}>
                        <FaIcon name="flag" />
                        <span>{fmtDate(r.race)}</span>
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
          <p className="oe-sub">
            <i className="oe-sw" aria-hidden="true" /> {tx('เปิดรับอยู่')}{' '}
            <i className="oe-sw is-planned" aria-hidden="true" /> {tx('วางแผนไว้ ยังไม่เปิด')}{' '}
            <i className="oe-sw is-past" aria-hidden="true" /> {tx('ปิดรับ จบ หรือระงับ')}
          </p>
        </section>
      )}

      <section className="oe-panel" aria-labelledby="oe-list-h">
        <div className="oe-list-head">
          <h2 id="oe-list-h">{tx('รายการงาน')}</h2>
          <div className="oe-chips" role="group" aria-label={tx('กรองตามสถานะ')}>
            {(['all', 'open', 'review', 'draft', 'done', 'stopped'] as Group[])
              .filter((g) => g === 'all' || counts[g] > 0)
              .map((g) => (
                <button
                  key={g}
                  type="button"
                  aria-pressed={group === g}
                  className={`oe-chip${group === g ? ' is-on' : ''}`}
                  onClick={() => setGroup(g)}
                >
                  {tx(GROUP_LABEL[g])} {counts[g]}
                </button>
              ))}
          </div>
          <div className="oe-search" role="search">
            <FaIcon name="magnifying-glass" />
            <label htmlFor="oe-q" className="eh-sr">
              {tx('ค้นหาชื่องาน รหัส หรือจังหวัด')}
            </label>
            <input id="oe-q" type="search" value={query} placeholder={tx('ค้นหาชื่องาน รหัส หรือจังหวัด')} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {events.length === 0 ? (
          <div className="oe-empty">
            <FaIcon name="flag" />
            <strong>{tx('องค์กรนี้ยังไม่มีงานวิ่ง')}</strong>
            {canManageEventConfig && (
              <button type="button" className="oe-btn is-primary" onClick={() => onCreateOpenChange(true)}>
                <FaIcon name="plus" />
                {tx('สร้างงานแรก')}
              </button>
            )}
          </div>
        ) : list.length === 0 ? (
          <p className="oe-sub">{tx('ไม่พบงานตามตัวกรอง')}</p>
        ) : (
          <ul className="oe-list">
            {list.map((ev) => {
              const regs = registrations.filter((r) => r.eventId === ev.id);
              const confirmed = regs.filter((r) => r.registrationStatus === 'confirmed').length;
              const places = isTotalQuotaEnabled(ev) ? ev.totalEventQuota : ev.categories.reduce((s, c) => s + c.categoryQuota, 0);
              const checks = ev.readinessChecks;
              const passed = checks.filter((c) => c.passed).length;
              return (
                <li key={ev.id} className="oe-row">
                  <div className="oe-row-main">
                    <strong>{tx(ev.titleTh)}</strong>
                    <span className="oe-sub">
                      {fmtDate(toDay(ev.eventDate), true)} · {tx(ev.province)} · {ev.code}
                    </span>
                  </div>
                  <div className="oe-row-status">
                    <EventStatusBadge status={ev.status} />
                  </div>
                  <div className="oe-row-progress">
                    {ev.status === 'draft' ? (
                      <>
                        <span className="oe-sub">{txf('ตั้งค่าแล้ว {0} จาก {1} ส่วน', passed, checks.length)}</span>
                        <span className="eh-segbar oe-seg" aria-hidden="true">
                          {checks.map((c) => (
                            <span key={c.id} className={c.passed ? 'is-done' : ''} />
                          ))}
                        </span>
                      </>
                    ) : ev.status === 'in_review' ? (
                      <span className="oe-sub">{tx('เปิดรับหลังผ่านการตรวจ')}</span>
                    ) : (
                      <>
                        <span className="oe-num">{txf('{0} / {1} คน', confirmed, places)}</span>
                        <span className="oe-bar" role="img" aria-label={txf('ยืนยันแล้ว {0} จาก {1} คน', confirmed, places)}>
                          <span style={{ width: `${places ? Math.min(100, (confirmed / places) * 100) : 0}%` }} />
                        </span>
                      </>
                    )}
                  </div>
                  <div className="oe-row-actions">
                    {ev.status !== 'draft' && canManageEventConfig && (
                      <button
                        type="button"
                        className="oe-btn"
                        onClick={() => {
                          onDuplicate(ev.id);
                          setCopied(ev.id);
                        }}
                      >
                        <FaIcon name="copy" />
                        {tx(
                          copied === ev.id
                            ? 'คัดลอกแล้ว'
                            : ev.status === 'closed' || ev.status === 'completed'
                              ? 'ใช้ทำปีหน้า'
                              : 'คัดลอกงาน'
                        )}
                      </button>
                    )}
                    <button type="button" className="oe-btn is-primary" onClick={() => onOpenEvent(ev.id, landing)}>
                      {tx(ev.status === 'draft' ? 'ทำต่อ' : 'จัดการ')}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {canManageEventConfig && events.some((e) => e.status !== 'draft') && (
          <p className="oe-sub">{tx('การคัดลอกงานคัดลอกระยะ ราคา หน้างาน และเสื้อเป็นแบบร่างใหม่ ไม่คัดลอกรายชื่อหรือข้อมูลส่วนตัวของผู้สมัคร')}</p>
        )}
      </section>

      {!isStaff && auditLogs.length > 0 && (
        <section className="oe-panel" aria-labelledby="oe-log-h">
          <div className="oe-panel-head">
            <h2 id="oe-log-h">{tx('กิจกรรมล่าสุด')}</h2>
            <span className="oe-sub">{tx('ใครทำอะไร เมื่อไร ในทุกงานขององค์กร')}</span>
          </div>
          <ul className="oe-log">
            {auditLogs
              .slice()
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              .slice(0, 6)
              .map((l) => {
                const ev = events.find((e) => e.id === l.eventId);
                return (
                  <li key={l.id}>
                    <span className="oe-log-time">{l.timestamp}</span>
                    <span>
                      <strong>{tx(l.actorName)}</strong> <span className="oe-sub">({tx(l.actorRole)})</span> · {tx(l.actionSummary)}
                      {ev && <span className="oe-sub"> · {tx(shortName(ev))}</span>}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </div>
  );
};
