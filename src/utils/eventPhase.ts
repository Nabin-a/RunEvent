import type { RaceEvent } from '../types';

/*
 * The event's state as a runner follows it (27 Nov 2026, user request; mock-up in
 * output/event-status-mockup). One function for every runner-facing page (event list, event
 * page, registration history), worked out from the organizer's status, the event's dates, the
 * price-tier dates and, where the page has them, the open seats, so it never goes stale.
 *
 * A postponement is not a phase of its own: it rides along with whatever phase the new dates
 * give (`postponed`), and pages show it as a banner above everything else.
 */

export type RunnerEventPhaseId =
  | 'announced'
  | 'open'
  | 'closing_soon'
  | 'almost_full'
  | 'partly_full'
  | 'full'
  | 'paused'
  | 'closed'
  | 'kit_pickup'
  | 'raceday'
  | 'results_pending'
  | 'results'
  | 'suspended'
  | 'cancelled';

export type RunnerEventPhaseTone = 'open' | 'info' | 'mute' | 'live' | 'warn' | 'stop';

export interface RunnerEventPhase {
  id: RunnerEventPhaseId;
  tone: RunnerEventPhaseTone;
  /** cancelled / suspended: shown as a banner above everything else, not as a small line */
  loud: boolean;
  /** a runner can start a new registration right now */
  canRegister: boolean;
  postponed?: NonNullable<RaceEvent['postponement']>;
  /** the dates the detail line needs (ISO YYYY-MM-DD), formatted by the caller */
  opensOn?: string;
  closesOn?: string;
  kitFrom?: string;
  kitTo?: string;
  resultsOn?: string;
  /** the organizer's own words (status note / kit pickup text), shown as is */
  note?: string;
  /** earliest start time of the event's distances, "05:30" */
  firstStart?: string;
  /** distance codes that are full (partly_full) */
  fullCodes?: string[];
}

/** open seats, when the page knows them (the event page and the event list do) */
export interface PhaseSeats {
  /** seats still open for the whole event */
  eventOpen: number;
  /** seats the whole event can take */
  eventCapacity: number;
  /** open seats per distance */
  categories: { id: string; code: string; open: number }[];
}

/** a nearly full event: no more than this share of its seats left (proposal, not confirmed) */
export const ALMOST_FULL_SHARE = 0.1;
/** sign-up closing soon: this many days or fewer before the last day (proposal, not confirmed) */
export const CLOSING_SOON_DAYS = 3;

/** first and last day of sale over every distance's price tiers */
export function registrationWindow(ev: RaceEvent): { opensOn?: string; closesOn?: string } {
  let opensOn: string | undefined;
  let closesOn: string | undefined;
  for (const cat of ev.categories) {
    for (const tier of cat.priceTiers) {
      if (tier.startsAt && (!opensOn || tier.startsAt < opensOn)) opensOn = tier.startsAt.slice(0, 10);
      if (tier.endsAt && (!closesOn || tier.endsAt > closesOn)) closesOn = tier.endsAt.slice(0, 10);
    }
  }
  return { opensOn, closesOn };
}

function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * @param today the date in the event's time zone (YYYY-MM-DD)
 * @param opts.hasResult the runner's own registration already carries an official result
 * @param opts.seats open seats, when the page knows them
 * @returns null while the event is not public (draft, in review)
 */
export function runnerEventPhase(
  ev: RaceEvent,
  today: string,
  opts: { hasResult?: boolean; seats?: PhaseSeats } = {}
): RunnerEventPhase | null {
  if (ev.status === 'draft' || ev.status === 'in_review') return null;
  const base = { loud: false, canRegister: false };
  if (ev.status === 'cancelled') return { ...base, id: 'cancelled', tone: 'stop', loud: true, note: ev.statusNote };
  if (ev.status === 'suspended') return { ...base, id: 'suspended', tone: 'warn', loud: true, note: ev.statusNote };

  const postponed = ev.postponement && ev.eventDate >= today ? ev.postponement : undefined;
  const kit = ev.kitPickupWindow?.trim() || undefined;
  const withPostponed = <T extends RunnerEventPhase>(p: T): T => (postponed ? { ...p, postponed } : p);

  if (ev.eventDate === today) {
    const starts = ev.categories.map((c) => c.startTimeLocal).filter(Boolean).sort();
    return withPostponed({ ...base, id: 'raceday', tone: 'live', firstStart: starts[0] });
  }
  if (ev.status === 'completed' || ev.eventDate < today) {
    return ev.resultsAnnouncedAt || opts.hasResult
      ? { ...base, id: 'results', tone: 'open', resultsOn: ev.resultsAnnouncedAt?.slice(0, 10) }
      : { ...base, id: 'results_pending', tone: 'info' };
  }
  if (ev.kitPickupFrom && ev.kitPickupTo && today >= ev.kitPickupFrom && today <= ev.kitPickupTo) {
    return withPostponed({ ...base, id: 'kit_pickup', tone: 'live', kitFrom: ev.kitPickupFrom, kitTo: ev.kitPickupTo, note: kit });
  }

  const { opensOn, closesOn } = registrationWindow(ev);
  const kitDates = { kitFrom: ev.kitPickupFrom, kitTo: ev.kitPickupTo };
  if (ev.status === 'closed' || (closesOn && today > closesOn)) {
    return withPostponed({ ...base, id: 'closed', tone: 'mute', note: kit, ...kitDates });
  }
  if (opensOn && today < opensOn) return withPostponed({ ...base, id: 'announced', tone: 'info', opensOn });
  if (ev.formHidden) return withPostponed({ ...base, id: 'paused', tone: 'warn', closesOn });

  const open = { ...base, canRegister: true, closesOn, note: kit, ...kitDates };
  const seats = opts.seats;
  if (seats) {
    if (seats.eventOpen <= 0 || seats.categories.every((c) => c.open <= 0)) {
      return withPostponed({ ...base, id: 'full', tone: 'mute', closesOn });
    }
    const fullCodes = seats.categories.filter((c) => c.open <= 0).map((c) => c.code);
    if (fullCodes.length > 0) return withPostponed({ ...open, id: 'partly_full', tone: 'warn', fullCodes });
    if (seats.eventCapacity > 0 && seats.eventOpen / seats.eventCapacity <= ALMOST_FULL_SHARE) {
      return withPostponed({ ...open, id: 'almost_full', tone: 'warn' });
    }
  }
  if (closesOn && daysBetween(today, closesOn) <= CLOSING_SOON_DAYS) {
    return withPostponed({ ...open, id: 'closing_soon', tone: 'warn' });
  }
  return withPostponed({ ...open, id: 'open', tone: 'open' });
}
