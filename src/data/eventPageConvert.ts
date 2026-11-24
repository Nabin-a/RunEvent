import type { EventCoreText, EventCustomBlock, EventDetailBlockId, EventDetailLayoutKey, EventDetailPage, EventPageItem, RaceEvent } from '../types';
import { customKey, isCoreBlock, layoutEntries } from './eventDetailLayout';
import { mergedCoreText } from './eventDataPieces';

/**
 * Built-in blocks become free blocks (confirmed 24 Nov 2026: every block of every event, done
 * automatically). A page saved before that (no `v: 2`) is converted whenever it is read — by the
 * public page and by the editor — so no stored data has to be migrated; the editor saves and
 * publishes the converted page. Business data stays live through data pieces; the texts become
 * ordinary pieces (text, list, cards, time line) the organizer edits freely.
 *
 * Converted blocks get fixed ids (`core-<id>`), so a draft and the live page convert alike.
 */

type ConvertEvent = Parameters<typeof mergedCoreText>[0];

const TITLES: Record<EventDetailBlockId, string> = {
  about: 'เกี่ยวกับงาน',
  categories: 'ระยะและค่าสมัคร',
  racepack: 'สิ่งที่ได้รับและตารางไซส์เสื้อ',
  schedule: 'กำหนดการ',
  venue: 'สถานที่และติดต่อผู้จัด',
  merch: 'ของที่ระลึกประจำงาน',
};

export const convertedId = (id: EventDetailBlockId) => `core-${id}`;

function blockFor(id: EventDetailBlockId, ev: ConvertEvent, page: EventDetailPage): EventCustomBlock {
  const text = mergedCoreText(ev, page.coreText);
  const pid = (suffix: string) => `core-${id}-${suffix}`;
  let items: EventPageItem[] = [];
  switch (id) {
    case 'about':
      items = [{ id: pid('text'), kind: 'text', text: text.about.paragraphs.join('\n\n') }];
      if (text.about.highlights.length > 0) {
        items.push({ id: pid('hl-title'), kind: 'heading', text: 'จุดเด่น' });
        items.push({ id: pid('hl'), kind: 'list', items: text.about.highlights, ordered: false });
      }
      break;
    case 'categories':
      items = [{ id: pid('data'), kind: 'data', source: 'categories', options: { layout: 'cards', showAllTiers: true, showAge: true } }];
      break;
    case 'racepack':
      items = [
        { id: pid('cards'), kind: 'cards', cards: text.racepack.items },
        { id: pid('size-title'), kind: 'heading', text: 'ตารางไซส์เสื้อแข่งขัน' },
        { id: pid('sizes'), kind: 'data', source: 'sizechart', options: { showStock: true } },
      ];
      break;
    case 'schedule':
      items = [{ id: pid('timeline'), kind: 'timeline', timeline: text.schedule.items }];
      break;
    case 'venue':
      items = [
        { id: pid('venue'), kind: 'data', source: 'venue', options: { showDate: false } },
        { id: pid('contact'), kind: 'data', source: 'contact', options: { showRules: true } },
      ];
      break;
    case 'merch':
      items = [{ id: pid('products'), kind: 'data', source: 'products', options: { productCount: 4 } }];
      break;
  }
  return { id: convertedId(id), title: TITLES[id], columns: 1, cells: [items] };
}

/** the page with every built-in block replaced by its free block (unchanged when already v 2) */
export function convertToFreeBlocks(page: EventDetailPage, ev: ConvertEvent): EventDetailPage {
  if (page.v === 2) return page;
  const extra: EventCustomBlock[] = [];
  const have = new Set(page.customBlocks.map((b) => b.id));
  const take = (id: EventDetailBlockId): EventDetailLayoutKey => {
    if (!have.has(convertedId(id))) {
      extra.push(blockFor(id, ev, page));
      have.add(convertedId(id));
    }
    return customKey(convertedId(id));
  };
  // nested built-in blocks first (they stay nested, now as free blocks)
  const customBlocks = page.customBlocks.map((b) => ({
    ...b,
    cells: b.cells.map((c) => c.map((it) => (it.kind === 'nested' && it.ref && isCoreBlock(it.ref) ? { ...it, ref: take(it.ref) } : it))),
  }));
  // the layout with the built-in blocks it lists or misses (older pages showed them all)
  // (read from the original page, where nested built-in blocks are still known as nested)
  const layout = layoutEntries(page).map((e) =>
    isCoreBlock(e.item.block) ? { block: take(e.item.block), visible: e.item.visible } : e.item
  );
  const { coreText: _drop, ...rest } = page;
  void _drop;
  return { ...rest, layout, customBlocks: [...customBlocks, ...extra], v: 2 };
}

/** the event's page as the public page and the editor show it (draft first when asked) */
export function eventPage(
  ev: ConvertEvent & Pick<RaceEvent, 'detailLayout' | 'detailCustomBlocks' | 'detailRegisterCard' | 'detailPageDraft' | 'detailPageV'>,
  draft: boolean
): EventDetailPage {
  const base: EventDetailPage =
    draft && ev.detailPageDraft
      ? ev.detailPageDraft
      : {
          layout: ev.detailLayout ?? [],
          customBlocks: ev.detailCustomBlocks ?? [],
          ...(ev.detailRegisterCard ? { card: ev.detailRegisterCard } : {}),
          ...(ev.detailPageV === 2 ? { v: 2 as const } : {}),
        };
  return convertToFreeBlocks(base, ev);
}

/**
 * The other way (24 Nov 2026, the page went back to one template): the text the organizer kept
 * in the converted free blocks of a published page, as event text. Only blocks still shaped as
 * the conversion made them count; anything else is left out (the event keeps its own text).
 */
export function coreTextFromFreeBlocks(page: Pick<EventDetailPage, 'customBlocks'>): EventCoreText {
  const out: EventCoreText = {};
  const block = (id: EventDetailBlockId) => page.customBlocks.find((b) => b.id === convertedId(id));
  const pieces = (id: EventDetailBlockId) => block(id)?.cells.flat() ?? [];
  const about = pieces('about');
  if (about.length > 0) {
    const texts = about.filter((it) => it.kind === 'text').map((it) => it.text ?? '');
    const list = about.find((it) => it.kind === 'list');
    if (texts.length > 0 || list) {
      out.about = {
        paragraphs: texts.flatMap((t) => t.split(/\n\s*\n/)).map((p) => p.trim()).filter(Boolean),
        highlights: (list?.items ?? []).map((h) => h.trim()).filter(Boolean),
      };
    }
  }
  const cards = pieces('racepack').find((it) => it.kind === 'cards');
  if (cards) out.racepack = { items: (cards.cards ?? []).filter((c) => c.title.trim()) };
  const timeline = pieces('schedule').find((it) => it.kind === 'timeline');
  if (timeline) out.schedule = { items: (timeline.timeline ?? []).filter((t) => t.title.trim() || t.timeLabel.trim()) };
  return out;
}

/* ------------------------------------------------------------------ */
/* Data every event page must show                                     */
/* ------------------------------------------------------------------ */

export const REQUIRED_DATA = [
  { source: 'categories', label: 'ระยะและค่าสมัคร' },
  { source: 'venue', label: 'สถานที่และวันงาน' },
] as const;

/**
 * Runners must see prices and the place before they sign up (confirmed 24 Nov 2026): a page can
 * be published only with a shown "categories and fees" piece and a shown "venue" piece (in a
 * visible block, or a block nested in one). Returns the missing ones' names (empty = fine).
 */
export function missingRequiredData(page: EventDetailPage): string[] {
  const blocks = new Map(page.customBlocks.map((b) => [b.id, b]));
  const shown: EventCustomBlock[] = [];
  const legacyCore = new Set<string>();
  for (const l of page.layout) {
    if (!l.visible) continue;
    if (isCoreBlock(l.block)) {
      legacyCore.add(l.block);
      continue;
    }
    const b = blocks.get(l.block.slice(7));
    if (!b) continue;
    shown.push(b);
    for (const c of b.cells) {
      for (const it of c) {
        if (it.kind !== 'nested' || !it.ref) continue;
        if (isCoreBlock(it.ref)) legacyCore.add(it.ref);
        else {
          const inner = blocks.get(it.ref.slice(7));
          if (inner) shown.push(inner);
        }
      }
    }
  }
  const sources = new Set(shown.flatMap((b) => b.cells.flat().filter((it) => it.kind === 'data').map((it) => it.source)));
  // a page still holding built-in blocks shows these facts through them
  if (legacyCore.has('categories')) sources.add('categories');
  if (legacyCore.has('venue')) sources.add('venue');
  return REQUIRED_DATA.filter((r) => !sources.has(r.source)).map((r) => r.label);
}
