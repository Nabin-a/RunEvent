import { useEffect, useState } from 'react';
import type { RaceEvent } from '../types';
import { tx, txf } from '../i18n';
import { formatBasisDate } from '../utils/age';

/* Countdown to the first start on the event page (28 Nov 2026, user request; the idea taken from
   race-registration sites, not their look). Every event runs in Asia/Bangkok (UTC+7, no daylight
   saving), so the start is fixed with +07:00 and does not depend on the viewer's clock zone. */

/** the earliest start of all distances, or the start of the event day when none is set */
export function eventStartAt(ev: RaceEvent): { at: number; time: string | null } {
  const times = ev.categories.map((c) => c.startTimeLocal).filter(Boolean).sort();
  const time = times[0] ?? null;
  return { at: Date.parse(`${ev.eventDate}T${time ?? '00:00'}:00+07:00`), time };
}

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

const two = (n: number) => String(n).padStart(2, '0');

/** runners see the countdown only this close to the start (user decision 28 Nov 2026) */
export const COUNTDOWN_WINDOW_DAYS = 30;
const WINDOW_MS = COUNTDOWN_WINDOW_DAYS * 86400 * 1000;

export function EventCountdown({ event, anyTime = false }: { event: RaceEvent; anyTime?: boolean }) {
  const { at, time } = eventStartAt(event);
  const [now, setNow] = useState(() => Date.now());
  const shown = anyTime || at - now <= WINDOW_MS;

  useEffect(() => {
    if (!Number.isFinite(at) || Date.now() >= at) return;
    // tick every second while shown; otherwise check once a minute for the window to open
    const id = window.setInterval(() => setNow(Date.now()), shown ? 1000 : 60000);
    return () => window.clearInterval(id);
  }, [at, shown]);

  if (!Number.isFinite(at) || now >= at) return null;
  if (!shown) return null;
  const p = parts(at - now);
  const when = time
    ? txf('ปล่อยตัวรอบแรก {0} เวลา {1} น.', formatBasisDate(event.eventDate), time)
    : txf('วันงาน {0}', formatBasisDate(event.eventDate));
  const units: [number, string][] = [
    [p.days, 'วัน'],
    [p.hours, 'ชั่วโมง'],
    [p.minutes, 'นาที'],
    [p.seconds, 'วินาที'],
  ];

  return (
    <section className="event-countdown" aria-labelledby="event-countdown-title">
      <header className="event-countdown-head">
        <h2 id="event-countdown-title">{tx('นับถอยหลังสู่วันแข่ง')}</h2>
        <p>{when}</p>
      </header>
      {/* the ticking numbers are not read aloud every second; the label says when it starts */}
      <div className="event-countdown-units" role="timer" aria-label={when}>
        {units.map(([value, label], i) => (
          <div key={label} className="event-countdown-unit" aria-hidden="true">
            <span className="event-countdown-num mono-num">{i === 0 ? value : two(value)}</span>
            <span className="event-countdown-label">{tx(label)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
