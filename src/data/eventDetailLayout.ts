import type { EventDetailBlockId, EventDetailLayoutItem, RaceEvent } from '../types';

/**
 * The sections ("blocks") of the public event page, in their default order.
 * The page renders whatever `resolveDetailLayout` returns, so an organizer
 * drag-and-drop editor only has to save `RaceEvent.detailLayout`.
 */
export interface EventDetailBlockDef {
  id: EventDetailBlockId;
  /** DOM id of the section, used by the in-page shortcuts */
  sectionId: string;
  /** short name for the shortcuts on the register card and for the future editor */
  label: string;
  /** shown in the shortcut list on the register card */
  inShortcuts: boolean;
}

export const EVENT_DETAIL_BLOCKS: EventDetailBlockDef[] = [
  { id: 'about', sectionId: 'sec-about', label: 'เกี่ยวกับงาน', inShortcuts: false },
  { id: 'categories', sectionId: 'sec-categories', label: 'ระยะและค่าสมัคร', inShortcuts: true },
  { id: 'racepack', sectionId: 'sec-racepack', label: 'สิ่งที่ได้รับและไซส์เสื้อ', inShortcuts: true },
  { id: 'schedule', sectionId: 'sec-schedule', label: 'กำหนดการ', inShortcuts: true },
  { id: 'venue', sectionId: 'sec-venue', label: 'สถานที่และติดต่อ', inShortcuts: true },
  { id: 'merch', sectionId: 'sec-merch', label: 'ของที่ระลึก', inShortcuts: false },
];

export const DEFAULT_EVENT_DETAIL_LAYOUT: EventDetailLayoutItem[] = EVENT_DETAIL_BLOCKS.map((b) => ({
  block: b.id,
  visible: true,
}));

const BLOCK_BY_ID = new Map(EVENT_DETAIL_BLOCKS.map((b) => [b.id, b]));

/**
 * Visible blocks in display order. A saved layout wins; blocks it does not mention
 * (added to the platform after the organizer saved) are appended in default order,
 * so a new section never silently disappears. Unknown or repeated ids are dropped.
 */
export function resolveDetailLayout(ev: Pick<RaceEvent, 'detailLayout'>): EventDetailBlockDef[] {
  const saved = ev.detailLayout ?? [];
  const seen = new Set<EventDetailBlockId>();
  const out: EventDetailBlockDef[] = [];
  for (const item of saved) {
    const def = BLOCK_BY_ID.get(item.block);
    if (!def || seen.has(def.id)) continue;
    seen.add(def.id);
    if (item.visible) out.push(def);
  }
  for (const def of EVENT_DETAIL_BLOCKS) {
    if (!seen.has(def.id)) out.push(def);
  }
  return out;
}
