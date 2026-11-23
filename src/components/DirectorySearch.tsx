import React, { useId, useMemo, useState } from 'react';
import type { RaceEvent } from '../types';
import { IconCalendar, IconCheckCircle, IconMapPin, IconSearch } from './Icons';
import { tx, txf } from '../i18n';

/* Home page search helpers: one text predicate for the list, live suggestions
 * under the hero field, and "did you mean" terms for the empty state. */

const norm = (s: string) => s.trim().toLowerCase();

export function matchesSearchText(ev: RaceEvent, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  return [ev.titleTh, ev.titleEn, ev.province, ev.venue].some((f) => f.toLowerCase().includes(q));
}

type Suggestion =
  | { kind: 'event'; key: string; event: RaceEvent }
  | { kind: 'place'; key: string; label: string };

const MAX_EVENTS = 4;
const MAX_PLACES = 3;

function buildSuggestions(events: RaceEvent[], query: string): Suggestion[] {
  const q = norm(query);
  if (!q) return [];
  const evs = events
    .filter((ev) => ev.titleTh.toLowerCase().includes(q) || ev.titleEn.toLowerCase().includes(q))
    .slice(0, MAX_EVENTS)
    .map((ev): Suggestion => ({ kind: 'event', key: `e-${ev.id}`, event: ev }));
  const places = new Set<string>();
  for (const ev of events) {
    for (const p of [ev.province, ev.venue]) {
      if (p && p.toLowerCase().includes(q)) places.add(p);
    }
  }
  const pl = [...places]
    .slice(0, MAX_PLACES)
    .map((label): Suggestion => ({ kind: 'place', key: `p-${label}`, label }));
  return [...evs, ...pl];
}

/* character-bigram Dice score: works for Thai and English without word splitting */
function bigrams(s: string): string[] {
  const t = s.replace(/\s+/g, '');
  if (t.length < 2) return t ? [t] : [];
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i += 1) out.push(t.slice(i, i + 2));
  return out;
}

function dice(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.length || !B.length) return 0;
  const pool = new Map<string, number>();
  for (const g of B) pool.set(g, (pool.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of A) {
    const n = pool.get(g) ?? 0;
    if (n > 0) {
      hit += 1;
      pool.set(g, n - 1);
    }
  }
  return (2 * hit) / (A.length + B.length);
}

/** Close spellings of names, provinces and venues that do exist, best first. */
export function similarSearchTerms(events: RaceEvent[], query: string, limit = 3): string[] {
  const q = norm(query);
  if (q.length < 2) return [];
  const terms = new Set<string>();
  for (const ev of events) [ev.titleTh, ev.province, ev.venue].forEach((t) => t && terms.add(t));
  return [...terms]
    .map((t) => {
      const lower = t.toLowerCase();
      // compare with the whole term and with each word, so a short query can still find a long name
      const best = Math.max(dice(q, lower), ...lower.split(/\s+/).map((w) => dice(q, w)));
      return { t, s: best };
    })
    .filter((x) => x.s >= 0.4 && !x.t.toLowerCase().includes(q))
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.t);
}

const Highlight: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  const q = norm(query);
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="kr-sg-mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
};

type HeroSearchFieldProps = {
  events: RaceEvent[];
  value: string;
  onChange: (v: string) => void;
  onPickEvent: (ev: RaceEvent) => void;
  onPickPlace: (place: string) => void;
  placeholder: string;
  srLabel: string;
};

/**
 * Hero keyword field (combobox). Typing shows suggestions only; the list below the
 * hero changes when the visitor presses search, presses Enter, or picks a suggestion.
 */
export const HeroSearchField: React.FC<HeroSearchFieldProps> = ({
  events,
  value,
  onChange,
  onPickEvent,
  onPickPlace,
  placeholder,
  srLabel,
}) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const items = useMemo(() => buildSuggestions(events, value), [events, value]);
  const showList = open && items.length > 0;

  const pick = (it: Suggestion) => {
    setOpen(false);
    setActive(-1);
    if (it.kind === 'event') onPickEvent(it.event);
    else onPickPlace(it.label);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && showList && active >= 0) {
      // Enter on a highlighted suggestion picks it; otherwise the form submits as usual
      e.preventDefault();
      pick(items[active]);
    } else if (e.key === 'Escape' && showList) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  const optId = (i: number) => `${listId}-o${i}`;
  const firstPlace = items.findIndex((it) => it.kind === 'place');

  return (
    <>
      <label className="kr-search-field kr-search-q">
        <IconSearch size={18} />
        <span className="sr-only">{srLabel}</span>
        <input
          id="dir-q"
          type="search"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optId(active) : undefined}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
      </label>
      <ul
        id={listId}
        role="listbox"
        aria-label={tx('คำแนะนำการค้นหา')}
        className="kr-suggest"
        hidden={!showList}
      >
        {items.map((it, i) => (
          <li
            key={it.key}
            id={optId(i)}
            role="option"
            aria-selected={i === active}
            className={`kr-sg-item ${i === active ? 'is-active' : ''} ${
              i === firstPlace && i > 0 ? 'has-divider' : ''
            }`}
            // keep focus in the input so blur does not close the list before the click lands
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => pick(it)}
          >
            {it.kind === 'event' ? (
              <>
                <span className="kr-sg-icon" aria-hidden="true">
                  <IconCalendar size={16} />
                </span>
                <span className="kr-sg-text">
                  <span className="kr-sg-title">
                    <Highlight text={tx(it.event.titleTh)} query={value} />
                  </span>
                  <span className="kr-sg-meta">
                    {tx('จ.')}
                    {tx(it.event.province)} · <span className="mono-num">{tx(it.event.eventDate)}</span>
                  </span>
                </span>
                <span className="kr-sg-hint">{tx('ดูงาน')}</span>
              </>
            ) : (
              <>
                <span className="kr-sg-icon" aria-hidden="true">
                  <IconMapPin size={16} />
                </span>
                <span className="kr-sg-text">
                  <span className="kr-sg-title">
                    <Highlight text={tx(it.label)} query={value} />
                  </span>
                  <span className="kr-sg-meta">{tx('ค้นหางานวิ่งในพื้นที่นี้')}</span>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
};

type DirectoryEmptyStateProps = {
  query: string;
  /** events matching the text alone, ignoring the chips and region */
  textOnlyCount: number;
  otherFiltersOn: boolean;
  similar: string[];
  onUseTerm: (term: string) => void;
  onClearSearch: () => void;
  onClearOthers: () => void;
  onClearAll: () => void;
};

/** No results: say why, and offer the shortest way back to some events. */
export const DirectoryEmptyState: React.FC<DirectoryEmptyStateProps> = ({
  query,
  textOnlyCount,
  otherFiltersOn,
  similar,
  onUseTerm,
  onClearSearch,
  onClearOthers,
  onClearAll,
}) => {
  const q = query.trim();
  if (!q) {
    return (
      <div className="empty-state-box">
        <h2>{tx('ไม่พบงานวิ่งตามตัวกรองที่เลือก')}</h2>
        <p>{tx('สามารถล้างตัวกรองเพื่อดูงานวิ่งทั้งหมดที่เปิดแสดงผลได้ทันที')}</p>
        <button type="button" className="btn-secondary" onClick={onClearAll}>
          {tx('ล้างตัวกรองทั้งหมด')}
        </button>
      </div>
    );
  }
  const blockedByFilters = otherFiltersOn && textOnlyCount > 0;
  return (
    <div className="empty-state-box kr-empty" role="status">
      <h2>{txf('ไม่พบงานวิ่งที่ตรงกับ “{0}”', q)}</h2>
      {blockedByFilters ? (
        <p>{txf('มี {0} งานที่ตรงกับคำค้นนี้ แต่ถูกตัวกรองระยะ หมวด หรือภูมิภาคซ่อนไว้', textOnlyCount)}</p>
      ) : (
        <p>{tx('ลองตรวจตัวสะกด หรือค้นด้วยชื่อจังหวัดหรือสถานที่ปล่อยตัว')}</p>
      )}
      {similar.length > 0 && (
        <div className="kr-empty-similar">
          <span>{tx('หรือคุณหมายถึง')}</span>
          {similar.map((t) => (
            <button key={t} type="button" className="kr-chip kr-empty-term" onClick={() => onUseTerm(t)}>
              {tx(t)}
            </button>
          ))}
        </div>
      )}
      <div className="kr-empty-actions">
        {blockedByFilters && (
          <button type="button" className="btn-primary" onClick={onClearOthers}>
            {txf('ดู {0} งานที่ตรงกับคำค้น', textOnlyCount)}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClearSearch}>
          {tx('ล้างคำค้น')}
        </button>
      </div>
    </div>
  );
};

type RegionOption = { value: string; label: string; count: number };

type HeroRegionSelectProps = {
  value: string;
  options: RegionOption[];
  onChange: (v: string) => void;
  label: string;
};

/**
 * Hero region picker. A custom listbox so its open list matches the keyword
 * suggestions (a native <select> list is drawn by the browser and can't be styled).
 */
export const HeroRegionSelect: React.FC<HeroRegionSelectProps> = ({ value, options, onChange, label }) => {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const current = options[selectedIndex];

  const openList = (at = selectedIndex) => {
    setActive(at);
    setOpen(true);
  };
  const choose = (i: number) => {
    onChange(options[i].value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
    }
  };

  const optId = (i: number) => `${listId}-o${i}`;

  return (
    <div className="kr-search-field kr-search-region">
      <IconMapPin size={18} />
      <button
        id="flt-reg"
        type="button"
        className="kr-region-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      >
        <span className="kr-region-value">
          {current.label} <span className="mono-num">({current.count})</span>
        </span>
      </button>
      <ul id={listId} role="listbox" aria-label={label} className="kr-suggest kr-region-list" hidden={!open}>
        {options.map((o, i) => (
          <li
            key={o.value}
            id={optId(i)}
            role="option"
            aria-selected={i === selectedIndex}
            className={`kr-sg-item ${i === active ? 'is-active' : ''} ${o.count === 0 ? 'is-empty' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(i)}
          >
            <span className="kr-sg-icon" aria-hidden="true">
              <IconMapPin size={16} />
            </span>
            <span className="kr-sg-text">
              <span className="kr-sg-title">{o.label}</span>
              <span className="kr-sg-meta">
                {o.count > 0 ? txf('{0} งานวิ่ง', o.count) : tx('ยังไม่มีงานวิ่ง')}
              </span>
            </span>
            {i === selectedIndex && (
              <span className="kr-sg-check" aria-hidden="true">
                <IconCheckCircle size={18} />
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
