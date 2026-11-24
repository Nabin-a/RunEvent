/**
 * Organizer navigation (redesign approved by the user on 24 Nov 2026).
 *
 * - Top bar = organization scope: org switcher, search (press "/"), role, org tabs.
 * - Left rail = the selected event: context card + menus in 4 groups.
 *   With no event selected the rail lists the events to pick from.
 * - Mobile (< 48rem): event context bar, bottom bar with 4 buttons, full menu sheet.
 *
 * Menus a role cannot use are hidden here, but every read and write is still
 * checked by the server; hiding a menu is not access control.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { EventStatus } from '../types';
import type { OrgSection } from './OrganizerDashboardView';
import { EventStatusBadge } from './StatusBadges';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../organizer-nav.css';

export interface OrgNavEvent {
  id: string;
  title: string;
  code: string;
  province: string;
  status: EventStatus;
}

export interface OrgNavProps {
  orgName: string;
  orgId: string;
  orgOptions: { id: string; name: string }[];
  onSelectOrg: (orgId: string) => void;
  roleLabel: string;
  isStaff: boolean;
  canViewFinance: boolean;
  canCheckIn: boolean;
  events: OrgNavEvent[];
  selectedEvent: OrgNavEvent | null;
  activeSection: OrgSection;
  /** go to a section; pass eventId to switch event, null to leave the event */
  onNavigate: (section: OrgSection, eventId?: string | null) => void;
  /** refund requests waiting for this event (finance roles only) */
  refundRequestCount: number;
  /** jump to the registrant list with this search text */
  onSearchRegistrants: (query: string) => void;
}

interface NavItem {
  section: OrgSection;
  label: string;
  desc: string;
  icon: string;
  badge?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  items: NavItem[];
}

const ORG_SECTIONS: OrgSection[] = [
  'org_overview',
  'org_events',
  'org_merch_production',
  'org_finance',
  'org_team_settings',
];

export const isOrgSection = (s: OrgSection) => ORG_SECTIONS.includes(s);

/** page name for breadcrumbs, in the same words as the menu */
export const ORG_SECTION_LABEL: Record<OrgSection, string> = {
  org_overview: 'งานทั้งหมด',
  org_events: 'งานทั้งหมด',
  org_merch_production: 'คำขอผลิตเสื้อ/เหรียญขององค์กร',
  org_finance: 'การเงินและรอบโอน',
  org_team_settings: 'ทีมและข้อมูลองค์กร',
  evt_overview: 'หน้าหลักของงาน',
  evt_page_editor: 'เนื้อหาหน้างาน',
  evt_form_editor: 'ฟอร์มสมัคร',
  evt_pricing_quota: 'ระยะ ราคา และการรับสมัคร',
  evt_kit: 'เสื้อและของที่ได้รับ',
  evt_participants: 'ผู้สมัคร',
  evt_storefront: 'ร้านค้าของงาน',
  evt_checkin_bib: 'เช็กอินหน้างาน',
  evt_finance: 'รายรับและคืนเงิน',
};

function useEventGroups(p: OrgNavProps): { home: NavItem | null; groups: NavGroup[] } {
  return useMemo(() => {
    const finance: NavItem = {
      section: 'evt_finance',
      label: 'รายรับและคืนเงิน',
      desc: 'ยอดชำระ คำขอคืนเงิน',
      icon: 'receipt',
      badge:
        p.refundRequestCount > 0
          ? txf('{0} รอตรวจ', p.refundRequestCount)
          : undefined,
    };
    const checkin: NavItem = {
      section: 'evt_checkin_bib',
      label: 'เช็กอินหน้างาน',
      desc: 'มอบ BIB และจ่ายของที่ซื้อ',
      icon: 'qrcode',
    };
    if (p.isStaff) {
      // kit staff only work on race day
      return {
        home: null,
        groups: [{ id: 'raceday', label: 'วันงาน', icon: 'flag-checkered', items: [checkin] }],
      };
    }
    const groups: NavGroup[] = [
      {
        id: 'setup',
        label: 'เตรียมงาน',
        icon: 'screwdriver-wrench',
        items: [
          {
            section: 'evt_page_editor',
            label: 'เนื้อหาหน้างาน',
            desc: 'ข้อความที่นักวิ่งเห็นก่อนสมัคร',
            icon: 'file-lines',
          },
          {
            section: 'evt_form_editor',
            label: 'ฟอร์มสมัคร',
            desc: 'คำถามที่นักวิ่งต้องตอบตอนสมัคร',
            icon: 'clipboard-list',
          },
          {
            section: 'evt_pricing_quota',
            label: 'ระยะ ราคา และการรับสมัคร',
            desc: 'ราคา จำนวนรับ อายุ คำถาม',
            icon: 'route',
          },
          {
            section: 'evt_kit',
            label: 'เสื้อและของที่ได้รับ',
            desc: 'ไซซ์ สต็อก ค่าส่ง ขอผลิต',
            icon: 'shirt',
          },
        ],
      },
      {
        id: 'sales',
        label: 'รับสมัครและขาย',
        icon: 'users',
        items: [
          {
            section: 'evt_participants',
            label: 'ผู้สมัคร',
            desc: 'ค้นหา ตรวจสถานะ แก้ข้อมูล',
            icon: 'list-check',
          },
          {
            section: 'evt_storefront',
            label: 'ร้านค้าของงาน',
            desc: 'สินค้า คำสั่งซื้อ พรีออเดอร์',
            icon: 'store',
          },
        ],
      },
    ];
    if (p.canCheckIn) {
      groups.push({ id: 'raceday', label: 'วันงาน', icon: 'flag-checkered', items: [checkin] });
    }
    if (p.canViewFinance) {
      groups.push({ id: 'money', label: 'การเงิน', icon: 'coins', items: [finance] });
    }
    return {
      home: {
        section: 'evt_overview',
        label: 'หน้าหลักของงาน',
        desc: 'สิ่งที่ต้องทำ และภาพรวม',
        icon: 'house',
      },
      groups,
    };
  }, [p.isStaff, p.canCheckIn, p.canViewFinance, p.refundRequestCount]);
}

function useOrgTabs(p: OrgNavProps) {
  return useMemo(() => {
    const tabs: { section: OrgSection; label: string; match: OrgSection[] }[] = [
      {
        section: 'org_events',
        label: 'งานทั้งหมด',
        match: ['org_events', 'org_overview', 'org_merch_production'],
      },
    ];
    if (p.canViewFinance) {
      tabs.push({ section: 'org_finance', label: 'การเงินและรอบโอน', match: ['org_finance'] });
    }
    if (!p.isStaff) {
      tabs.push({
        section: 'org_team_settings',
        label: 'ทีมและข้อมูลองค์กร',
        match: ['org_team_settings'],
      });
    }
    return tabs;
  }, [p.canViewFinance, p.isStaff]);
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

interface SearchHit {
  key: string;
  label: string;
  hint: string;
  icon: string;
  run: () => void;
}

export const OrganizerTopBar: React.FC<OrgNavProps> = (p) => {
  const tabs = useOrgTabs(p);
  const { home, groups } = useEventGroups(p);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const orgSelId = useId();
  const eventSelId = useId();

  // "/" focuses search unless the user is typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const hits: SearchHit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];
    if (p.selectedEvent && !p.isStaff) {
      out.push({
        key: 'reg',
        label: txf('ค้นหาผู้สมัคร “{0}”', query.trim()),
        hint: tx(p.selectedEvent.title),
        icon: 'magnifying-glass',
        run: () => p.onSearchRegistrants(query.trim()),
      });
    }
    if (p.selectedEvent) {
      const items = [...(home ? [home] : []), ...groups.flatMap((g) => g.items)];
      items
        .filter((it) => `${tx(it.label)} ${tx(it.desc)} ${it.label} ${it.desc}`.toLowerCase().includes(q))
        .forEach((it) =>
          out.push({
            key: `m-${it.section}`,
            label: tx(it.label),
            hint: tx('เมนูของงานนี้'),
            icon: it.icon,
            run: () => p.onNavigate(it.section),
          })
        );
    }
    tabs
      .filter((t) => `${tx(t.label)} ${t.label}`.toLowerCase().includes(q))
      .forEach((t) =>
        out.push({
          key: `t-${t.section}`,
          label: tx(t.label),
          hint: tx('เรื่องขององค์กร'),
          icon: 'building',
          run: () => p.onNavigate(t.section, null),
        })
      );
    p.events
      .filter((ev) => `${tx(ev.title)} ${ev.title} ${ev.code}`.toLowerCase().includes(q))
      .forEach((ev) =>
        out.push({
          key: `e-${ev.id}`,
          label: tx(ev.title),
          hint: txf('เปิดงาน · {0}', ev.code),
          icon: 'flag',
          run: () => p.onNavigate(p.isStaff ? 'evt_checkin_bib' : 'evt_overview', ev.id),
        })
      );
    return out.slice(0, 8);
  }, [query, p, home, groups, tabs]);

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    hit.run();
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  const showList = open && query.trim().length > 0;

  // the bar sticks under the site header; publish its height so the event rail sticks below it
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty('--orgnav-top-h', `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty('--orgnav-top-h');
    };
  }, []);

  return (
    <div className="orgnav-top" ref={topRef}>
      <div className="orgnav-top-row">
        <div className="orgnav-org">
          <FaIcon name="building" />
          <label htmlFor={orgSelId} className="orgnav-org-label">
            {tx('องค์กร')}
          </label>
          {p.orgOptions.length > 1 ? (
            <select
              id={orgSelId}
              value={p.orgId}
              onChange={(e) => p.onSelectOrg(e.target.value)}
            >
              {p.orgOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {tx(o.name)}
                </option>
              ))}
            </select>
          ) : (
            <strong id={orgSelId}>{tx(p.orgName)}</strong>
          )}
        </div>

        {p.events.length > 0 && (
          <div className="orgnav-org orgnav-event-pick">
            <FaIcon name="flag" />
            <label htmlFor={eventSelId} className="orgnav-org-label">
              {tx('งาน')}
            </label>
            <select
              id={eventSelId}
              value={p.selectedEvent?.id ?? ''}
              onChange={(e) => {
                if (e.target.value) {
                  p.onNavigate(p.selectedEvent ? p.activeSection : p.isStaff ? 'evt_checkin_bib' : 'evt_overview', e.target.value);
                }
              }}
            >
              {!p.selectedEvent && <option value="">{tx('เลือกงานที่จะจัดการ')}</option>}
              {p.events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {tx(ev.title)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="orgnav-search" role="search">
          <FaIcon name="magnifying-glass" />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && hits[activeIdx] ? `${listId}-${activeIdx}` : undefined}
            aria-label={tx(
              p.selectedEvent && !p.isStaff ? 'ค้นหาผู้สมัคร งาน หรือเมนู' : 'ค้นหางานหรือเมนู'
            )}
            placeholder={tx(
              p.selectedEvent && !p.isStaff ? 'ค้นหาผู้สมัคร งาน หรือเมนู' : 'ค้นหางานหรือเมนู'
            )}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                choose(hits[activeIdx]);
              } else if (e.key === 'Escape') {
                setQuery('');
                setOpen(false);
              }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
          {showList && (
            <ul id={listId} role="listbox" className="orgnav-search-list">
              {hits.length === 0 ? (
                <li className="orgnav-search-empty" role="option" aria-selected="false" aria-disabled="true">
                  {tx('ไม่พบเมนูหรืองานที่ตรงกับคำค้น')}
                </li>
              ) : (
                hits.map((h, i) => (
                  <li
                    key={h.key}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    className={i === activeIdx ? 'is-active' : ''}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(h);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <FaIcon name={h.icon} />
                    <span className="orgnav-hit-label">{h.label}</span>
                    <span className="orgnav-hit-hint">{h.hint}</span>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <span className="orgnav-role">
          <FaIcon name="shield-halved" />
          {tx(p.roleLabel)}
        </span>
      </div>

      <nav className="orgnav-tabs" aria-label={tx('เรื่องขององค์กร')}>
        <span className="orgnav-tabs-caption" aria-hidden="true">
          {tx('เรื่องขององค์กร')}
        </span>
        {tabs.map((t) => {
          const active = !p.selectedEvent && t.match.includes(p.activeSection);
          return (
            <button
              key={t.section}
              type="button"
              className={`orgnav-tab${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => p.onNavigate(t.section, null)}
            >
              {tx(t.label)}
              {t.section === 'org_events' && (
                <span className="orgnav-tab-count">{p.events.length}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Left rail                                                           */
/* ------------------------------------------------------------------ */

const NavButton: React.FC<{
  item: NavItem;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}> = ({ item, active, onClick, compact }) => (
  <button
    type="button"
    className={`orgnav-item${active ? ' is-active' : ''}`}
    aria-current={active ? 'page' : undefined}
    onClick={onClick}
  >
    <FaIcon name={item.icon} />
    <span className="orgnav-item-text">
      <span className="orgnav-item-label">{tx(item.label)}</span>
      {!compact && <span className="orgnav-item-desc">{tx(item.desc)}</span>}
    </span>
    {item.badge && (
      <span className="orgnav-badge">
        <FaIcon name="triangle-exclamation" />
        {item.badge}
      </span>
    )}
  </button>
);

const COLLAPSE_KEY = 'kratai_orgnav_collapsed_groups';

function readCollapsed(groupIds: string[], openId: string | undefined): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    // fall through to the default
  }
  // first visit: fold every group except the one holding the open page, so the rail fits the screen
  return Object.fromEntries(groupIds.map((id) => [id, id !== openId]));
}

export const OrganizerRail: React.FC<OrgNavProps> = (p) => {
  const { home, groups } = useEventGroups(p);
  const pickId = useId();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    readCollapsed(
      groups.map((g) => g.id),
      groups.find((g) => g.items.some((it) => it.section === p.activeSection))?.id
    )
  );

  // opening a page inside a folded group unfolds that group, so the current page is always visible
  useEffect(() => {
    const owner = groups.find((g) => g.items.some((it) => it.section === p.activeSection));
    if (owner && collapsed[owner.id]) {
      setCollapsed((c) => ({ ...c, [owner.id]: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.activeSection]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    } catch {
      // private mode or blocked storage: folding still works for this visit
    }
  }, [collapsed]);

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  // organization pages have no left bar (layout A, chosen by the user 24 Nov 2026);
  // events are picked from the top bar or the all-events page
  if (!p.selectedEvent) return null;

  return (
    <aside className="orgnav-rail" aria-label={tx('เมนูของงานที่เลือก')}>
      {p.selectedEvent ? (
        <>
          <div className="orgnav-event-card">
            <span className="orgnav-event-caption">{tx('งานที่กำลังจัดการ')}</span>
            <strong className="orgnav-event-title">{tx(p.selectedEvent.title)}</strong>
            <span className="orgnav-event-meta">
              {tx(p.selectedEvent.province)} · {p.selectedEvent.code}
            </span>
            <div className="orgnav-event-status">
              <EventStatusBadge status={p.selectedEvent.status} />
            </div>
          </div>

          <nav className="orgnav-groups" aria-label={tx('เมนูของงานที่เลือก')}>
            {home && (
              <NavButton
                item={home}
                active={p.activeSection === home.section}
                onClick={() => p.onNavigate(home.section)}
              />
            )}
            {groups.map((g) => {
              const open = !collapsed[g.id];
              const listId = `${pickId}-${g.id}-list`;
              const badges = g.items.filter((it) => it.badge).length;
              return (
                <div key={g.id} className={`orgnav-group${open ? '' : ' is-collapsed'}`}>
                  <button
                    type="button"
                    className="orgnav-group-toggle"
                    id={`${pickId}-${g.id}`}
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => toggle(g.id)}
                  >
                    <FaIcon name={g.icon} />
                    <span className="orgnav-group-label">{tx(g.label)}</span>
                    {!open && (
                      <span className="orgnav-group-count">
                        {txf('{0} เมนู', g.items.length)}
                        {badges > 0 && (
                          <span className="orgnav-group-alert">
                            <FaIcon name="triangle-exclamation" />
                            {txf('{0} เรื่อง', badges)}
                          </span>
                        )}
                      </span>
                    )}
                    <FaIcon name="chevron-down" className="orgnav-group-chevron" />
                  </button>
                  <div id={listId} role="group" aria-labelledby={`${pickId}-${g.id}`} hidden={!open} className="orgnav-group-items">
                    {g.items.map((it) => (
                      <NavButton
                        key={it.section}
                        item={it}
                        active={p.activeSection === it.section}
                        onClick={() => p.onNavigate(it.section)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </>
      ) : null}
    </aside>
  );
};

/* ------------------------------------------------------------------ */
/* Mobile: context bar, bottom bar, menu sheet                          */
/* ------------------------------------------------------------------ */

export const OrganizerMobileContext: React.FC<OrgNavProps & { onOpenMenu: () => void }> = (p) => (
  <div className="orgnav-mobile-context">
    <span className="orgnav-mobile-org">
      <FaIcon name="building" />
      {tx(p.orgName)}
    </span>
    {p.selectedEvent ? (
      <button type="button" className="orgnav-mobile-event" onClick={p.onOpenMenu}>
        <strong>{tx(p.selectedEvent.title)}</strong>
        <FaIcon name="chevron-down" />
      </button>
    ) : (
      <strong className="orgnav-mobile-event-none">{tx('เรื่องขององค์กร')}</strong>
    )}
    {p.selectedEvent && <EventStatusBadge status={p.selectedEvent.status} />}
  </div>
);

export const OrganizerMobileNav: React.FC<
  OrgNavProps & { menuOpen: boolean; onMenuOpenChange: (open: boolean) => void }
> = (p) => {
  const { home, groups } = useEventGroups(p);
  const tabs = useOrgTabs(p);
  const sheetRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const pickId = useId();
  const { menuOpen, onMenuOpenChange } = p;
  const landing: OrgSection = p.isStaff ? 'evt_checkin_bib' : 'evt_overview';

  useEffect(() => {
    if (!menuOpen) return;
    const sheet = sheetRef.current;
    sheet?.querySelector<HTMLElement>('button, select')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMenuOpenChange(false);
      if (e.key === 'Tab' && sheet) {
        const els = Array.from(sheet.querySelectorAll<HTMLElement>('button, select'));
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, [menuOpen, onMenuOpenChange]);

  const go = (section: OrgSection, eventId?: string | null) => {
    p.onNavigate(section, eventId);
    onMenuOpenChange(false);
  };

  const bar: { key: string; label: string; icon: string; section?: OrgSection; active: boolean }[] =
    p.selectedEvent
      ? [
          ...(p.isStaff
            ? []
            : [
                {
                  key: 'home',
                  label: 'หน้าหลัก',
                  icon: 'house',
                  section: 'evt_overview' as OrgSection,
                  active: p.activeSection === 'evt_overview',
                },
                {
                  key: 'regs',
                  label: 'ผู้สมัคร',
                  icon: 'list-check',
                  section: 'evt_participants' as OrgSection,
                  active: p.activeSection === 'evt_participants',
                },
              ]),
          ...(p.canCheckIn
            ? [
                {
                  key: 'checkin',
                  label: 'เช็กอิน',
                  icon: 'qrcode',
                  section: 'evt_checkin_bib' as OrgSection,
                  active: p.activeSection === 'evt_checkin_bib',
                },
              ]
            : []),
        ]
      : [
          {
            key: 'events',
            label: 'งานทั้งหมด',
            icon: 'flag',
            section: 'org_events' as OrgSection,
            active: isOrgSection(p.activeSection),
          },
        ];

  return (
    <>
      <nav className="orgnav-bottom" aria-label={tx('เมนูหลักบนมือถือ')}>
        {bar.map((b) => (
          <button
            key={b.key}
            type="button"
            className={b.active ? 'is-active' : ''}
            aria-current={b.active ? 'page' : undefined}
            onClick={() => b.section && go(b.section)}
          >
            <span className="orgnav-bottom-icon">
              <FaIcon name={b.icon} />
            </span>
            {tx(b.label)}
          </button>
        ))}
        <button
          ref={openerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => onMenuOpenChange(true)}
        >
          <span className="orgnav-bottom-icon">
            <FaIcon name="bars" />
            {p.refundRequestCount > 0 && p.canViewFinance && (
              <span className="orgnav-bottom-dot">{p.refundRequestCount}</span>
            )}
          </span>
          {tx('เมนูทั้งหมด')}
        </button>
      </nav>

      {menuOpen && (
        <div className="orgnav-sheet-backdrop" onClick={() => onMenuOpenChange(false)}>
          <div
            ref={sheetRef}
            className="orgnav-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="orgnav-sheet-head">
              <h2 id={titleId}>{tx('เมนูทั้งหมด')}</h2>
              <button
                type="button"
                className="orgnav-sheet-close"
                aria-label={tx('ปิดเมนู')}
                onClick={() => onMenuOpenChange(false)}
              >
                <FaIcon name="xmark" />
              </button>
            </div>

            {p.events.length > 0 && (
              <div className="orgnav-sheet-picker">
                <label htmlFor={pickId}>{tx('งานที่กำลังจัดการ')}</label>
                <select
                  id={pickId}
                  value={p.selectedEvent?.id ?? ''}
                  onChange={(e) => go(p.selectedEvent ? p.activeSection : landing, e.target.value)}
                >
                  {!p.selectedEvent && <option value="">{tx('เลือกงาน')}</option>}
                  {p.events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {tx(ev.title)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {p.selectedEvent && (
              <>
                {home && (
                  <NavButton
                    item={home}
                    compact
                    active={p.activeSection === home.section}
                    onClick={() => go(home.section)}
                  />
                )}
                {groups.map((g) => (
                  <div key={g.id} className="orgnav-sheet-group">
                    <div className="orgnav-sheet-heading">{tx(g.label)}</div>
                    {g.items.map((it) => (
                      <NavButton
                        key={it.section}
                        item={it}
                        compact
                        active={p.activeSection === it.section}
                        onClick={() => go(it.section)}
                      />
                    ))}
                  </div>
                ))}
              </>
            )}

            <div className="orgnav-sheet-group">
              <div className="orgnav-sheet-heading">{tx('เรื่องขององค์กร')}</div>
              {tabs.map((t) => (
                <NavButton
                  key={t.section}
                  compact
                  item={{ section: t.section, label: t.label, desc: '', icon: 'building' }}
                  active={!p.selectedEvent && t.match.includes(p.activeSection)}
                  onClick={() => go(t.section, null)}
                />
              ))}
              {p.orgOptions.length > 1 && (
                <div className="orgnav-sheet-picker">
                  <label htmlFor={`${pickId}-org`}>{tx('เปลี่ยนองค์กร')}</label>
                  <select
                    id={`${pickId}-org`}
                    value={p.orgId}
                    onChange={(e) => {
                      p.onSelectOrg(e.target.value);
                      onMenuOpenChange(false);
                    }}
                  >
                    {p.orgOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {tx(o.name)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
