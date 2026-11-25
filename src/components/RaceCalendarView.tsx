import React, { useMemo, useState } from 'react';
import type { RaceEvent } from '../types';
import { getLang, tx, txf } from '../i18n';
import { todayIsoInTimeZone } from '../utils/age';
import { EventStatusBadge } from './StatusBadges';
import { MascotAnim } from './MascotAnim';
import { EventCoverMedia, IconArrowLeft, IconArrowRight, IconCalendar, IconMapPin } from './Icons';

/**
 * Race calendar (public): browse events by month, by province or by race type.
 * Dates are the event's local calendar date (Asia/Bangkok); "today" is taken in
 * the same timezone, not the device's.
 */

type CalendarView = 'month' | 'week' | 'province' | 'type';
type DistanceBucket = 'all' | 'fun' | 'mini' | 'half' | 'full' | 'trail';

const DISTANCE_BUCKETS: Array<[DistanceBucket, string]> = [
  ['all', 'ทุกระยะ'],
  ['fun', 'Fun Run ≤ 5 km'],
  ['mini', 'Mini 10 km'],
  ['half', 'Half 21.1 km'],
  ['full', 'Marathon 42.2 km+'],
  ['trail', 'Trail'],
];

function inBucket(ev: RaceEvent, bucket: DistanceBucket): boolean {
  if (bucket === 'all') return true;
  if (bucket === 'trail') return ev.raceType === 'Trail';
  return ev.categories.some((c) => {
    const km = c.distanceKm;
    if (bucket === 'fun') return km <= 5.5;
    if (bucket === 'mini') return km > 5.5 && km <= 12;
    if (bucket === 'half') return km > 12 && km <= 22;
    return km >= 42;
  });
}

const monthKeyOf = (iso: string) => iso.slice(0, 7);

const isoToUtc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const utcToIso = (d: Date) => d.toISOString().slice(0, 10);

function addDays(iso: string, n: number): string {
  const d = isoToUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return utcToIso(d);
}

/** Sunday that starts the week containing iso (same Sunday-first layout as the month grid). */
function weekStartOf(iso: string): string {
  return addDays(iso, -isoToUtc(iso).getUTCDay());
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function locale(): string {
  return getLang() === 'en' ? 'en-GB' : 'th-TH';
}

function formatMonth(key: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), { month: style, year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

function formatDayHeading(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function formatWeekRange(start: string): string {
  const fmt = new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return fmt.formatRange(isoToUtc(start), isoToUtc(addDays(start, 6)));
}

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Sunday-first week, the common layout of Thai wall calendars. Long + narrow names (narrow on phones). */
function weekdayLabels(): Array<{ long: string; narrow: string }> {
  const longFmt = new Intl.DateTimeFormat(locale(), { weekday: 'long', timeZone: 'UTC' });
  // Thai "short" names are full words in some browsers; "narrow" gives อา, จ, อ … English keeps Sun, Mon …
  const shortFmt = new Intl.DateTimeFormat(locale(), {
    weekday: getLang() === 'en' ? 'short' : 'narrow',
    timeZone: 'UTC',
  });
  // 2026-11-01 is a Sunday
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 1 + i));
    return { long: longFmt.format(d), narrow: shortFmt.format(d) };
  });
}

function monthCells(key: string): Array<string | null> {
  const [y, m] = key.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d += 1) cells.push(`${key}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupBy<T>(items: T[], keyOf: (x: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    const list = map.get(k);
    if (list) list.push(it);
    else map.set(k, [it]);
  }
  return [...map.entries()];
}

interface Props {
  events: RaceEvent[];
  onOpenEvent: (ev: RaceEvent) => void;
}

export const RaceCalendarView: React.FC<Props> = ({ events, onOpenEvent }) => {
  const today = todayIsoInTimeZone();
  const [view, setView] = useState<CalendarView>('month');
  const [monthKey, setMonthKey] = useState(monthKeyOf(today));
  const [weekStart, setWeekStart] = useState(weekStartOf(today));
  const weekEnd = addDays(weekStart, 6);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [bucket, setBucket] = useState<DistanceBucket>('all');

  const sorted = useMemo(
    () => [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
    [events]
  );

  // Scope before the distance filter: the month / week on screen, or upcoming events
  // for the province and type views.
  const scoped =
    view === 'month'
      ? sorted.filter((ev) => monthKeyOf(ev.eventDate) === monthKey)
      : view === 'week'
        ? sorted.filter((ev) => ev.eventDate >= weekStart && ev.eventDate <= weekEnd)
        : sorted.filter((ev) => ev.eventDate >= today);
  const filtered = scoped.filter((ev) => inBucket(ev, bucket));
  const isDated = view === 'month' || view === 'week';
  const dayFiltered = isDated && selectedDay
    ? filtered.filter((ev) => ev.eventDate === selectedDay)
    : filtered;

  // Months that have events (any distance), plus the current one, for the month strip.
  const monthStrip = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ev of sorted) {
      if (!inBucket(ev, bucket)) continue;
      const k = monthKeyOf(ev.eventDate);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (!counts.has(monthKeyOf(today))) counts.set(monthKeyOf(today), 0);
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sorted, bucket, today]);

  const countsByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of filtered) map.set(ev.eventDate, (map.get(ev.eventDate) ?? 0) + 1);
    return map;
  }, [filtered]);

  const nextMonthWithEvents = monthStrip.find(([k, n]) => k > monthKey && n > 0)?.[0] ?? null;

  const nextWeekEvent = sorted.find((ev) => ev.eventDate > weekEnd && inBucket(ev, bucket));
  const nextWeekWithEvents = nextWeekEvent ? weekStartOf(nextWeekEvent.eventDate) : null;

  const goMonth = (key: string) => {
    setMonthKey(key);
    setSelectedDay(null);
  };
  const goWeek = (start: string) => {
    setWeekStart(start);
    setSelectedDay(null);
  };

  const switchView = (next: CalendarView) => {
    if (next === 'week' && view !== 'week') {
      const firstInMonth = sorted.find((ev) => monthKeyOf(ev.eventDate) === monthKey)?.eventDate;
      const base =
        selectedDay ??
        (view === 'month' && monthKey !== monthKeyOf(today)
          ? firstInMonth ?? `${monthKey}-01`
          : today);
      setWeekStart(weekStartOf(base));
    }
    if (next === 'month' && view === 'week') {
      // the Wednesday decides which month a week spanning two months belongs to
      setMonthKey(monthKeyOf(selectedDay ?? addDays(weekStart, 3)));
    }
    const keepDay = (next === 'month' || next === 'week') && (view === 'month' || view === 'week');
    if (!keepDay) setSelectedDay(null);
    setView(next);
  };

  const groups: Array<[string, RaceEvent[]]> =
    isDated
      ? groupBy(dayFiltered, (ev) => ev.eventDate)
      : view === 'province'
        ? groupBy(dayFiltered, (ev) => ev.province).sort(
            (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'th')
          )
        : groupBy(dayFiltered, (ev) => ev.raceType).sort((a, b) => b[1].length - a[1].length);

  const groupHeading = (key: string) => (isDated ? formatDayHeading(key) : tx(key));

  return (
    <div className="race-calendar">
      <header className="race-calendar-head kr-cal-head">
        <div className="kr-cal-title">
          <IconCalendar size={44} className="kr-cal-icon" />
          <div>
            <h1>{tx('ปฏิทินงานวิ่ง')}</h1>
            <p className="muted-block">
              {tx('ดูตารางงานวิ่ง เลือกวันที่สนใจ แล้วสมัครได้เลย')}
            </p>
          </div>
        </div>
        {/* same running pose as the home page hero (25 Nov 2026, user request) */}
        <MascotAnim pose="run" className="kr-cal-mascot" />
        <div className="race-calendar-views" role="group" aria-label={tx('มุมมองปฏิทิน')}>
          {(
            [
              ['month', 'รายเดือน'],
              ['week', 'รายสัปดาห์'],
              ['province', 'ตามจังหวัด'],
              ['type', 'ตามประเภทงาน'],
            ] as const
          ).map(([v, lbl]) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              className={`detail-tab-btn ${view === v ? 'active' : ''}`}
              onClick={() => switchView(v)}
            >
              {tx(lbl)}
            </button>
          ))}
        </div>
      </header>

      <div className="quick-pill-bar race-calendar-buckets kr-chip-row" role="group" aria-label={tx('กรองตามระยะ')}>
        <span className="kr-chip-label">{tx('ระยะวิ่ง')}</span>
        {DISTANCE_BUCKETS.map(([b, lbl]) => (
          <button
            key={b}
            type="button"
            className={`kr-chip ${bucket === b ? 'is-on' : ''}`}
            aria-pressed={bucket === b}
            onClick={() => {
              setBucket(b);
              setSelectedDay(null);
            }}
          >
            {tx(lbl)}{' '}
            <span className="filter-count mono-num">{scoped.filter((ev) => inBucket(ev, b)).length}</span>
          </button>
        ))}
      </div>

      <div className={`kr-cal-body ${isDated ? 'is-dated' : ''}`}>
      {view === 'month' && (
        <section className="race-calendar-month" aria-label={formatMonth(monthKey)}>
          <div className="race-calendar-monthbar">
            <button
              type="button"
              className="race-calendar-nav"
              onClick={() => goMonth(shiftMonth(monthKey, -1))}
              aria-label={tx('เดือนก่อนหน้า')}
            >
              <IconArrowLeft size={16} />
            </button>
            <h2 aria-live="polite">{formatMonth(monthKey)}</h2>
            <button
              type="button"
              className="race-calendar-nav"
              onClick={() => goMonth(shiftMonth(monthKey, 1))}
              aria-label={tx('เดือนถัดไป')}
            >
              <IconArrowRight size={16} />
            </button>
          </div>

          <nav className="race-calendar-strip" aria-label={tx('เดือนที่มีงานวิ่ง')}>
            {monthStrip.map(([k, n]) => (
              <button
                key={k}
                type="button"
                className={`filter-pill ${k === monthKey ? 'active' : ''}`}
                aria-current={k === monthKey ? 'true' : undefined}
                onClick={() => goMonth(k)}
              >
                {formatMonth(k, 'short')} <span className="filter-count mono-num">{n}</span>
              </button>
            ))}
          </nav>

          <table className="race-calendar-grid">
            <thead>
              <tr>
                {weekdayLabels().map((w) => (
                  <th key={w.long} scope="col" abbr={w.long}>
                    <span className="race-calendar-wd-long">{w.long}</span>
                    <span className="race-calendar-wd-short" aria-hidden="true">
                      {w.narrow}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: monthCells(monthKey).length / 7 }, (_, row) => (
                <tr key={row}>
                  {monthCells(monthKey)
                    .slice(row * 7, row * 7 + 7)
                    .map((iso, i) => {
                      if (!iso) return <td key={`e${i}`} className="is-blank" />;
                      const n = countsByDay.get(iso) ?? 0;
                      const day = Number(iso.slice(8));
                      const isToday = iso === today;
                      const isSelected = iso === selectedDay;
                      const cls = `${isToday ? 'is-today' : ''} ${n > 0 ? 'has-events' : ''} ${isSelected ? 'is-selected' : ''}`;
                      return (
                        <td key={iso} className={cls}>
                          {n > 0 ? (
                            <button
                              type="button"
                              className="race-calendar-day"
                              aria-pressed={isSelected}
                              aria-label={txf('{0} · {1} งาน', formatDayHeading(iso), n)}
                              onClick={() => setSelectedDay(isSelected ? null : iso)}
                            >
                              <span className="race-calendar-daynum mono-num">{day}</span>
                              <span className="race-calendar-count">{txf('{0} งาน', n)}</span>
                              <span className="kr-cal-dot" aria-hidden="true" />
                            </button>
                          ) : (
                            <span className="race-calendar-day is-empty">
                              <span className="race-calendar-daynum mono-num">{day}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="kr-cal-legend" aria-hidden="true">
            <li><span className="kr-cal-dot" /> {tx('มีงานวิ่ง')}</li>
            <li><span className="kr-cal-dot is-selected" /> {tx('วันที่เลือก')}</li>
            <li><span className="kr-cal-dot is-none" /> {tx('ไม่มีงานวิ่ง')}</li>
          </ul>
        </section>
      )}

      {view === 'week' && (
        <section className="race-calendar-month race-calendar-week" aria-label={formatWeekRange(weekStart)}>
          <div className="race-calendar-monthbar">
            <button
              type="button"
              className="race-calendar-nav"
              onClick={() => goWeek(addDays(weekStart, -7))}
              aria-label={tx('สัปดาห์ก่อนหน้า')}
            >
              <IconArrowLeft size={16} />
            </button>
            <div className="race-calendar-weektitle">
              <h2 aria-live="polite">{formatWeekRange(weekStart)}</h2>
              {weekStart !== weekStartOf(today) && (
                <button type="button" className="btn-ghost-sm" onClick={() => goWeek(weekStartOf(today))}>
                  {tx('สัปดาห์นี้')}
                </button>
              )}
            </div>
            <button
              type="button"
              className="race-calendar-nav"
              onClick={() => goWeek(addDays(weekStart, 7))}
              aria-label={tx('สัปดาห์ถัดไป')}
            >
              <IconArrowRight size={16} />
            </button>
          </div>

          <ol className="race-calendar-weekdays">
            {Array.from({ length: 7 }, (_, i) => {
              const iso = addDays(weekStart, i);
              const n = countsByDay.get(iso) ?? 0;
              const isToday = iso === today;
              const isSelected = iso === selectedDay;
              const wd = weekdayLabels()[i];
              const showMonth = i === 0 || iso.slice(8) === '01';
              const inner = (
                <>
                  <span className="race-calendar-wd-long">{wd.long}</span>
                  <span className="race-calendar-wd-short" aria-hidden="true">
                    {wd.narrow}
                  </span>
                  <span className="race-calendar-daynum mono-num">
                    {Number(iso.slice(8))}
                    {showMonth && (
                      <span className="race-calendar-weekmonth">
                        {' '}
                        {new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' }).format(isoToUtc(iso))}
                      </span>
                    )}
                  </span>
                  {n > 0 && <span className="race-calendar-count">{txf('{0} งาน', n)}</span>}
                </>
              );
              return (
                <li
                  key={iso}
                  className={`${isToday ? 'is-today' : ''} ${n > 0 ? 'has-events' : ''} ${isSelected ? 'is-selected' : ''}`}
                >
                  {n > 0 ? (
                    <button
                      type="button"
                      className="race-calendar-day"
                      aria-pressed={isSelected}
                      aria-label={txf('{0} · {1} งาน', formatDayHeading(iso), n)}
                      onClick={() => setSelectedDay(isSelected ? null : iso)}
                    >
                      {inner}
                    </button>
                  ) : (
                    <span className="race-calendar-day is-empty">{inner}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="race-calendar-list" aria-label={tx('รายการงานวิ่ง')}>
        <div className="race-calendar-list-head">
          <p className="muted-inline">
            {isDated && selectedDay
              ? txf('{0} งานในวันที่เลือก', dayFiltered.length)
              : view === 'month'
                ? txf('{0} งานใน{1}', dayFiltered.length, formatMonth(monthKey))
                : view === 'week'
                  ? txf('{0} งานในสัปดาห์ {1}', dayFiltered.length, formatWeekRange(weekStart))
                  : txf('{0} งานที่ยังไม่ถึงวันแข่ง', dayFiltered.length)}
          </p>
          {isDated && selectedDay && (
            <button type="button" className="btn-ghost-sm" onClick={() => setSelectedDay(null)}>
              {view === 'week' ? tx('แสดงทั้งสัปดาห์') : tx('แสดงทั้งเดือน')}
            </button>
          )}
        </div>

        {dayFiltered.length === 0 ? (
          <div className="race-calendar-empty">
            <p>
              {view === 'month'
                ? tx('ไม่มีงานวิ่งในเดือนนี้ตามตัวกรองที่เลือก')
                : view === 'week'
                  ? tx('ไม่มีงานวิ่งในสัปดาห์นี้ตามตัวกรองที่เลือก')
                  : tx('ยังไม่มีงานวิ่งที่กำลังจะมาถึงตามตัวกรองที่เลือก')}
            </p>
            {view === 'week' && nextWeekWithEvents && (
              <button type="button" className="btn-secondary" onClick={() => goWeek(nextWeekWithEvents)}>
                {txf('ไปสัปดาห์ที่มีงานถัดไป ({0})', formatWeekRange(nextWeekWithEvents))}
              </button>
            )}
            {view === 'month' && nextMonthWithEvents && (
              <button type="button" className="btn-secondary" onClick={() => goMonth(nextMonthWithEvents)}>
                {txf('ไปเดือนที่มีงานถัดไป ({0})', formatMonth(nextMonthWithEvents, 'short'))}
              </button>
            )}
            {bucket !== 'all' && (
              <button type="button" className="btn-ghost-sm" onClick={() => setBucket('all')}>
                {tx('ดูทุกระยะ')}
              </button>
            )}
          </div>
        ) : (
          groups.map(([key, list]) => (
            <div key={key} className="race-calendar-group">
              <h3>
                {groupHeading(key)} <span className="filter-count mono-num">{list.length}</span>
              </h3>
              <ul>
                {list.map((ev) => (
                  <li key={ev.id} className="race-calendar-row">
                    {/* Preview only; the title button is the accessible way in */}
                    <div className="race-calendar-thumb" aria-hidden="true" onClick={() => onOpenEvent(ev)}>
                      <EventCoverMedia event={ev} illustrated className="race-calendar-thumb-media" />
                    </div>
                    <div className="race-calendar-row-main">
                      <button type="button" className="race-calendar-title" onClick={() => onOpenEvent(ev)}>
                        {tx(ev.titleTh)}
                      </button>
                      <p className="muted-inline">
                        {!isDated && (
                          <>
                            <IconCalendar size={13} />{' '}
                            <span className="mono-num">{formatShortDate(ev.eventDate)}</span>
                            {' · '}
                          </>
                        )}
                        {view !== 'province' && (
                          <>
                            <IconMapPin size={13} /> {tx(ev.province)}
                          </>
                        )}
                        {isDated && ' · '}
                        {view !== 'type' && tx(ev.raceType)}
                      </p>
                      <div className="kr-card-chips">
                        {ev.categories.map((c) => (
                          <span key={c.id} className="kr-dist">
                            {tx(c.code)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="race-calendar-row-side">
                      <EventStatusBadge status={ev.status} />
                      <button
                        type="button"
                        className="kr-card-go"
                        aria-label={txf('ดูรายละเอียด {0}', ev.titleTh)}
                        onClick={() => onOpenEvent(ev)}
                      >
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      </div>
    </div>
  );
};
