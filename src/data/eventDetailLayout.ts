import { CORE_TEXT_LIMITS, DATA_SOURCE_IDS } from './eventDataPieces';
import type {
  EventCoreText,
  EventCustomBlock,
  EventDetailBlockId,
  EventDetailLayoutItem,
  EventDetailLayoutKey,
  EventDetailPage,
  EventPageItem,
  EventRegisterCardConfig,
  RaceEvent,
} from '../types';

/**
 * The sections ("blocks") of the public event page. Built-in blocks get their content
 * from the event settings; the organizer page editor may reorder them, hide the ones
 * that are not locked, and add free blocks (`custom:<id>`) between them.
 * A block may also sit inside a column of a top-level free block (piece kind `nested`,
 * one level deep): it then leaves the page layout and is drawn inside that column.
 * Shared by the page, the organizer editor and the server (validation).
 */
export interface EventDetailBlockDef {
  id: EventDetailBlockId;
  /** DOM id of the section, used by the in-page shortcuts */
  sectionId: string;
  /** short name for the shortcuts on the register card and for the editor */
  label: string;
  /** shown in the shortcut list on the register card */
  inShortcuts: boolean;
  /** core facts every event page must show: can be moved, never hidden or renamed (decision 23 Nov 2026) */
  locked: boolean;
  /** where the organizer edits the content of this block */
  source: string;
}

export const EVENT_DETAIL_BLOCKS: EventDetailBlockDef[] = [
  { id: 'about', sectionId: 'sec-about', label: 'เกี่ยวกับงาน', inShortcuts: false, locked: false, source: 'ข้อความแก้ในหน้านี้' },
  { id: 'categories', sectionId: 'sec-categories', label: 'ระยะและค่าสมัคร', inShortcuts: true, locked: true, source: 'ระยะ โควตา & คำถามสมัคร' },
  { id: 'racepack', sectionId: 'sec-racepack', label: 'สิ่งที่ได้รับและไซส์เสื้อ', inShortcuts: true, locked: true, source: 'รายการสิ่งที่ได้รับแก้ในหน้านี้ · ตารางไซส์/สต็อกเสื้อจากเมนูระยะ โควตา & คำถามสมัคร' },
  { id: 'schedule', sectionId: 'sec-schedule', label: 'กำหนดการ', inShortcuts: true, locked: true, source: 'ข้อความแก้ในหน้านี้' },
  { id: 'venue', sectionId: 'sec-venue', label: 'สถานที่และติดต่อ', inShortcuts: true, locked: true, source: 'สถานที่ตั้งไว้ตอนสร้างงาน · ผู้จัดจากเมนูทีมและตั้งค่าองค์กร' },
  { id: 'merch', sectionId: 'sec-merch', label: 'ของที่ระลึก', inShortcuts: false, locked: false, source: 'ร้านค้า & สินค้าของงานนี้' },
];

export const DEFAULT_EVENT_DETAIL_LAYOUT: EventDetailLayoutItem[] = EVENT_DETAIL_BLOCKS.map((b) => ({
  block: b.id,
  visible: true,
}));

const BLOCK_BY_ID = new Map(EVENT_DETAIL_BLOCKS.map((b) => [b.id, b]));

export const isCoreBlock = (key: string): key is EventDetailBlockId => BLOCK_BY_ID.has(key as EventDetailBlockId);
export const customKey = (id: string): EventDetailLayoutKey => `custom:${id}`;
export const customIdOf = (key: string): string | null => (key.startsWith('custom:') ? key.slice(7) : null);
export const coreBlockDef = (id: EventDetailBlockId): EventDetailBlockDef => BLOCK_BY_ID.get(id) as EventDetailBlockDef;

/** A block as the page draws it. */
export interface ResolvedDetailBlock {
  /** built-in id, or `custom:<id>` */
  id: string;
  sectionId: string;
  label: string;
  inShortcuts: boolean;
  locked: boolean;
  core?: EventDetailBlockId;
  custom?: EventCustomBlock;
}

/** where each nested block sits: block key -> its container free block and the piece holding it */
export function nestedPlaces(page: EventDetailPage): Map<string, { containerId: string; itemId: string; col: number }> {
  const out = new Map<string, { containerId: string; itemId: string; col: number }>();
  for (const b of page.customBlocks) {
    b.cells.forEach((cell, col) => {
      for (const it of cell) if (it.kind === 'nested' && it.ref && !out.has(it.ref)) out.set(it.ref, { containerId: b.id, itemId: it.id, col });
    });
  }
  return out;
}

/** a free block or built-in block by its key, as the page draws it (null when it does not exist) */
export function resolveBlockKey(page: EventDetailPage, key: string): ResolvedDetailBlock | null {
  if (isCoreBlock(key)) {
    const def = coreBlockDef(key);
    return { id: key, sectionId: def.sectionId, label: def.label, inShortcuts: def.inShortcuts, locked: def.locked, core: key };
  }
  const cid = customIdOf(key);
  const block = cid ? page.customBlocks.find((c) => c.id === cid) : undefined;
  if (!block) return null;
  return { id: key, sectionId: `sec-custom-${block.id}`, label: block.title, inShortcuts: true, locked: false, custom: block };
}

/** does this free block hold a locked built-in block (then it can never be hidden) */
const holdsLocked = (block: EventCustomBlock) =>
  block.cells.some((c) => c.some((it) => it.kind === 'nested' && !!it.ref && isCoreBlock(it.ref) && coreBlockDef(it.ref).locked));

/** The published page, or the given draft (editor preview). */
export function pageOf(ev: Pick<RaceEvent, 'detailLayout' | 'detailCustomBlocks' | 'detailRegisterCard' | 'detailPageV'>): EventDetailPage {
  return {
    layout: ev.detailLayout ?? [],
    customBlocks: ev.detailCustomBlocks ?? [],
    ...(ev.detailRegisterCard ? { card: ev.detailRegisterCard } : {}),
    // without it, blocks the organizer deleted would come back (built-in blocks are re-added to old pages)
    ...(ev.detailPageV === 2 ? { v: 2 as const } : {}),
  };
}

/**
 * Every entry of the saved layout in order (hidden ones included), with built-in blocks
 * it does not mention appended in default order so a new section never disappears.
 * Unknown or repeated keys and free blocks without content are dropped.
 */
export function layoutEntries(page: EventDetailPage): { item: EventDetailLayoutItem; resolved: ResolvedDetailBlock }[] {
  const customs = new Map(page.customBlocks.map((c) => [c.id, c]));
  // nested blocks are drawn inside their container, not in the layout
  const seen = new Set<string>(nestedPlaces(page).keys());
  const out: { item: EventDetailLayoutItem; resolved: ResolvedDetailBlock }[] = [];
  const push = (item: EventDetailLayoutItem) => {
    const key = item.block;
    if (seen.has(key)) return;
    if (isCoreBlock(key)) {
      const def = coreBlockDef(key);
      seen.add(key);
      out.push({
        // locked blocks are always shown, whatever was saved
        item: { block: key, visible: def.locked ? true : item.visible },
        resolved: {
          id: key,
          sectionId: def.sectionId,
          label: def.label,
          inShortcuts: def.inShortcuts,
          locked: def.locked,
          core: key,
        },
      });
      return;
    }
    const cid = customIdOf(key);
    const block = cid ? customs.get(cid) : undefined;
    if (!block) return;
    seen.add(key);
    out.push({
      // a free block holding a locked built-in block is always shown too
      item: { block: key, visible: holdsLocked(block) ? true : item.visible },
      resolved: {
        id: key,
        sectionId: `sec-custom-${block.id}`,
        label: block.title,
        inShortcuts: true,
        locked: false,
        custom: block,
      },
    });
  };
  page.layout.forEach(push);
  // older pages: built-in blocks they do not mention come back (they are converted to free blocks on
  // read, see eventPageConvert.ts); a converted page (v 2) only has what the organizer kept
  if (page.v !== 2) for (const def of EVENT_DETAIL_BLOCKS) if (!seen.has(def.id)) push({ block: def.id, visible: true });
  return out;
}

/** Visible blocks in display order. */
export function resolveDetailLayout(page: EventDetailPage): ResolvedDetailBlock[] {
  return layoutEntries(page)
    .filter((e) => e.item.visible)
    .map((e) => e.resolved);
}

/** Visible blocks in reading order, nested ones right after their container (for the in-page shortcuts). */
export function resolveDetailBlocksDeep(page: EventDetailPage): ResolvedDetailBlock[] {
  const out: ResolvedDetailBlock[] = [];
  for (const b of resolveDetailLayout(page)) {
    out.push(b);
    if (!b.custom) continue;
    for (const cell of b.custom.cells) {
      for (const it of cell) {
        const inner = it.kind === 'nested' && it.ref ? resolveBlockKey(page, it.ref) : null;
        if (inner) out.push(inner);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Validation (client before saving, server always)                    */
/* ------------------------------------------------------------------ */

export const PAGE_LIMITS = {
  customBlocks: 12,
  itemsPerColumn: 8,
  title: 80,
  heading: 120,
  text: 3000,
  label: 80,
  alt: 200,
  href: 500,
  listItems: 20,
  listItem: 200,
  tableRows: 12,
  tableCols: 5,
  tableCell: 120,
  faqs: 10,
  faqQuestion: 200,
  faqAnswer: 1000,
  galleryImages: 12,
  fileName: 120,
  /** a downscaled JPEG data URL; about 1.1 MB of image */
  imageChars: 1_500_000,
  /** one gallery picture (downscaled smaller than a single image) */
  galleryImageChars: 600_000,
  /** an uploaded card icon (PNG, 128 px at most) */
  cardIconChars: 80_000,
  /** a PDF data URL; about 2 MB of file */
  fileChars: 2_800_000,
  /** the whole page (all pieces) as JSON text */
  pageChars: 9_000_000,
};

/** icons a card can use (Font Awesome Free names; first = default) */
export const CARD_ICONS: { name: string; label: string }[] = [
  { name: 'gift', label: 'ของที่ได้รับ' },
  { name: 'shirt', label: 'เสื้อ' },
  { name: 'id-badge', label: 'ป้าย BIB' },
  { name: 'medal', label: 'เหรียญ' },
  { name: 'trophy', label: 'ถ้วยรางวัล' },
  { name: 'award', label: 'รางวัล' },
  { name: 'certificate', label: 'ใบประกาศ' },
  { name: 'ticket', label: 'บัตร' },
  { name: 'bottle-water', label: 'น้ำดื่ม' },
  { name: 'utensils', label: 'อาหาร' },
  { name: 'kit-medical', label: 'ปฐมพยาบาล' },
  { name: 'shield-heart', label: 'ประกัน' },
  { name: 'truck', label: 'จัดส่ง' },
  { name: 'bag-shopping', label: 'ถุง/สินค้า' },
  { name: 'camera', label: 'ภาพถ่าย' },
  { name: 'music', label: 'ดนตรี' },
  { name: 'bus', label: 'รถรับส่ง' },
  { name: 'square-parking', label: 'ที่จอดรถ' },
  { name: 'shower', label: 'ห้องอาบน้ำ' },
  { name: 'map-location-dot', label: 'แผนที่' },
  { name: 'clock', label: 'เวลา' },
  { name: 'person-running', label: 'นักวิ่ง' },
  { name: 'flag-checkered', label: 'เส้นชัย' },
  { name: 'star', label: 'ดาว' },
];

export function isCardIconImage(url: string): boolean {
  return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= PAGE_LIMITS.cardIconChars;
}

export const ITEM_KINDS_ALL = ['heading', 'text', 'list', 'table', 'faq', 'image', 'gallery', 'file', 'link', 'divider', 'nested', 'data', 'cards', 'timeline'] as const;

const ID_RE = /^[a-z0-9-]{1,40}$/;

function cleanText(v: unknown, max: number): string {
  return String(v ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, max);
}

export function isSafeLink(href: string): boolean {
  try {
    const u = new URL(href);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSafePageImage(url: string): boolean {
  if (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(url)) return url.length <= PAGE_LIMITS.imageChars;
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

/** an uploaded PDF (data URL) or an https address */
export function isSafePageFile(url: string): boolean {
  if (/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(url)) return url.length <= PAGE_LIMITS.fileChars;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export type PageCheck = { ok: true; value: EventDetailPage } | { ok: false; error: string };

/**
 * Normalises and checks a page sent by the editor. Locked blocks are forced visible,
 * missing built-in blocks are appended, layout keys must point at existing free blocks.
 */
export function normalizeDetailPage(input: unknown): PageCheck {
  const raw = (input ?? {}) as { layout?: unknown; customBlocks?: unknown };
  if (!Array.isArray(raw.layout) || !Array.isArray(raw.customBlocks)) {
    return { ok: false, error: 'ข้อมูลหน้าไม่ถูกต้อง' };
  }
  if (raw.customBlocks.length > PAGE_LIMITS.customBlocks) {
    return { ok: false, error: `เพิ่มบล็อกอิสระได้ไม่เกิน ${PAGE_LIMITS.customBlocks} บล็อก` };
  }
  const blocks: EventCustomBlock[] = [];
  const ids = new Set<string>();
  for (const b of raw.customBlocks as Record<string, unknown>[]) {
    const id = String(b?.id ?? '');
    if (!ID_RE.test(id) || ids.has(id)) return { ok: false, error: 'รหัสบล็อกไม่ถูกต้อง' };
    ids.add(id);
    const title = cleanText(b.title, PAGE_LIMITS.title).trim();
    if (!title) return { ok: false, error: 'ตั้งชื่อหัวข้อของบล็อกอิสระทุกบล็อก' };
    const columns = Number(b.columns);
    if (columns !== 1 && columns !== 2 && columns !== 3) return { ok: false, error: 'บล็อกแบ่งได้ 1–3 คอลัมน์' };
    const rawCells = Array.isArray(b.cells) ? (b.cells as unknown[]) : [];
    const cells: EventPageItem[][] = [];
    for (let c = 0; c < columns; c++) {
      const list = Array.isArray(rawCells[c]) ? (rawCells[c] as Record<string, unknown>[]) : [];
      if (list.length > PAGE_LIMITS.itemsPerColumn) {
        return { ok: false, error: `แต่ละคอลัมน์ใส่ได้ไม่เกิน ${PAGE_LIMITS.itemsPerColumn} ชิ้น` };
      }
      const items: EventPageItem[] = [];
      for (const it of list) {
        const iid = String(it?.id ?? '');
        if (!ID_RE.test(iid) || ids.has(iid)) return { ok: false, error: 'รหัสชิ้นส่วนไม่ถูกต้อง' };
        ids.add(iid);
        if (it.kind === 'heading') {
          items.push({ id: iid, kind: 'heading', text: cleanText(it.text, PAGE_LIMITS.heading).replace(/\n/g, ' ') });
        } else if (it.kind === 'text') {
          items.push({ id: iid, kind: 'text', text: cleanText(it.text, PAGE_LIMITS.text) });
        } else if (it.kind === 'list') {
          const raw = Array.isArray(it.items) ? (it.items as unknown[]) : [];
          if (raw.length > PAGE_LIMITS.listItems) return { ok: false, error: `รายการใส่ได้ไม่เกิน ${PAGE_LIMITS.listItems} ข้อ` };
          items.push({
            id: iid,
            kind: 'list',
            items: raw.map((x) => cleanText(x, PAGE_LIMITS.listItem).replace(/\n/g, ' ')),
            ordered: it.ordered === true,
          });
        } else if (it.kind === 'table') {
          const raw = Array.isArray(it.rows) ? (it.rows as unknown[]) : [];
          if (raw.length > PAGE_LIMITS.tableRows) return { ok: false, error: `ตารางมีได้ไม่เกิน ${PAGE_LIMITS.tableRows} แถว` };
          const width = Math.max(1, ...raw.map((r) => (Array.isArray(r) ? r.length : 0)));
          if (width > PAGE_LIMITS.tableCols) return { ok: false, error: `ตารางมีได้ไม่เกิน ${PAGE_LIMITS.tableCols} คอลัมน์` };
          const rows = raw.map((r) => {
            const cells = Array.isArray(r) ? (r as unknown[]) : [];
            return Array.from({ length: width }, (_, i) => cleanText(cells[i], PAGE_LIMITS.tableCell).replace(/\n/g, ' '));
          });
          items.push({ id: iid, kind: 'table', rows });
        } else if (it.kind === 'faq') {
          const raw = Array.isArray(it.faqs) ? (it.faqs as Record<string, unknown>[]) : [];
          if (raw.length > PAGE_LIMITS.faqs) return { ok: false, error: `คำถามที่พบบ่อยใส่ได้ไม่เกิน ${PAGE_LIMITS.faqs} ข้อ` };
          items.push({
            id: iid,
            kind: 'faq',
            faqs: raw.map((f) => ({
              q: cleanText(f?.q, PAGE_LIMITS.faqQuestion).replace(/\n/g, ' '),
              a: cleanText(f?.a, PAGE_LIMITS.faqAnswer),
            })),
          });
        } else if (it.kind === 'gallery') {
          const raw = Array.isArray(it.images) ? (it.images as Record<string, unknown>[]) : [];
          if (raw.length > PAGE_LIMITS.galleryImages) {
            return { ok: false, error: `แกลเลอรีใส่ภาพได้ไม่เกิน ${PAGE_LIMITS.galleryImages} ภาพ` };
          }
          const images: { url: string; alt: string }[] = [];
          for (const g of raw) {
            const url = String(g?.url ?? '').trim();
            const okSize = !url.startsWith('data:') || url.length <= PAGE_LIMITS.galleryImageChars;
            if (!url || !isSafePageImage(url) || !okSize) {
              return { ok: false, error: 'ภาพในแกลเลอรีต้องเป็นไฟล์ JPG/PNG/WebP ที่อัปโหลด (ไม่เกินประมาณ 400 KB ต่อภาพหลังย่อ) หรือลิงก์ https' };
            }
            images.push({ url, alt: cleanText(g?.alt, PAGE_LIMITS.alt) });
          }
          items.push({ id: iid, kind: 'gallery', images });
        } else if (it.kind === 'file') {
          const fileUrl = String(it.fileUrl ?? '').trim();
          if (fileUrl && !isSafePageFile(fileUrl)) {
            return { ok: false, error: 'ไฟล์ดาวน์โหลดต้องเป็น PDF ที่อัปโหลด (ไม่เกิน 2 MB) หรือลิงก์ https' };
          }
          items.push({
            id: iid,
            kind: 'file',
            fileUrl,
            fileName: cleanText(it.fileName, PAGE_LIMITS.fileName).replace(/[\\/:*?"<>|]/g, '_'),
            label: cleanText(it.label, PAGE_LIMITS.label),
          });
        } else if (it.kind === 'divider') {
          items.push({ id: iid, kind: 'divider' });
        } else if (it.kind === 'cards') {
          const raw = Array.isArray(it.cards) ? (it.cards as Record<string, unknown>[]) : [];
          if (raw.length > CORE_TEXT_LIMITS.racepackItems) return { ok: false, error: `การ์ดใส่ได้ไม่เกิน ${CORE_TEXT_LIMITS.racepackItems} ใบ` };
          items.push({
            id: iid,
            kind: 'cards',
            cards: raw.map((c) => ({
              title: cleanText(c?.title, CORE_TEXT_LIMITS.racepackTitle).replace(/\n/g, ' '),
              detail: cleanText(c?.detail, CORE_TEXT_LIMITS.racepackDetail),
              scope: cleanText(c?.scope, CORE_TEXT_LIMITS.racepackScope).replace(/\n/g, ' '),
              ...(typeof c?.icon === 'string' && c.icon !== 'gift' && CARD_ICONS.some((i) => i.name === c.icon) ? { icon: c.icon } : {}),
              ...(typeof c?.iconImage === 'string' && isCardIconImage(c.iconImage) ? { iconImage: c.iconImage } : {}),
            })),
          });
        } else if (it.kind === 'timeline') {
          const raw = Array.isArray(it.timeline) ? (it.timeline as Record<string, unknown>[]) : [];
          if (raw.length > CORE_TEXT_LIMITS.scheduleItems) return { ok: false, error: `ไทม์ไลน์ใส่ได้ไม่เกิน ${CORE_TEXT_LIMITS.scheduleItems} รายการ` };
          items.push({
            id: iid,
            kind: 'timeline',
            timeline: raw.map((t) => ({
              timeLabel: cleanText(t?.timeLabel, CORE_TEXT_LIMITS.scheduleTime).replace(/\n/g, ' '),
              title: cleanText(t?.title, CORE_TEXT_LIMITS.scheduleTitle).replace(/\n/g, ' '),
              detail: cleanText(t?.detail, CORE_TEXT_LIMITS.scheduleDetail),
            })),
          });
        } else if (it.kind === 'data') {
          const source = String(it.source ?? '');
          if (!(DATA_SOURCE_IDS as string[]).includes(source)) return { ok: false, error: 'ชิ้นข้อมูลงานไม่ถูกต้อง' };
          items.push({ id: iid, kind: 'data', source: source as EventPageItem['source'], options: cleanDataOptions(it.options) });
        } else if (it.kind === 'nested') {
          // checked against the other blocks below, once all of them are read
          const ref = String(it.ref ?? '');
          if (!isCoreBlock(ref) && !/^custom:[a-z0-9-]{1,40}$/.test(ref)) return { ok: false, error: 'บล็อกที่ซ้อนอยู่ไม่ถูกต้อง' };
          items.push({ id: iid, kind: 'nested', ref: ref as EventDetailLayoutKey });
        } else if (it.kind === 'image') {
          const imageUrl = String(it.imageUrl ?? '').trim();
          if (imageUrl && !isSafePageImage(imageUrl)) {
            return { ok: false, error: 'ภาพต้องเป็นไฟล์ที่อัปโหลด (JPG/PNG/WebP ไม่เกินประมาณ 1 MB) หรือลิงก์ https' };
          }
          items.push({ id: iid, kind: 'image', imageUrl, imageAlt: cleanText(it.imageAlt, PAGE_LIMITS.alt) });
        } else if (it.kind === 'link') {
          const href = cleanText(it.href, PAGE_LIMITS.href).trim();
          if (href && !isSafeLink(href)) return { ok: false, error: 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือ http://' };
          items.push({ id: iid, kind: 'link', label: cleanText(it.label, PAGE_LIMITS.label), href });
        } else {
          return { ok: false, error: 'ชนิดชิ้นส่วนไม่รองรับ' };
        }
      }
      cells.push(items);
    }
    blocks.push({ id, title, columns: columns as 1 | 2 | 3, cells });
  }
  // nested blocks: each placed once, the block exists, not inside itself, one level deep
  const nested = new Map<string, string>(); // block key -> container id
  for (const b of blocks) {
    for (const cell of b.cells) {
      for (const it of cell) {
        if (it.kind !== 'nested' || !it.ref) continue;
        const ref = it.ref;
        if (nested.has(ref)) return { ok: false, error: 'บล็อกหนึ่งซ้อนได้ที่เดียว' };
        if (ref === customKey(b.id)) return { ok: false, error: 'ซ้อนบล็อกไว้ในตัวเองไม่ได้' };
        const cid = customIdOf(ref);
        if (cid && !blocks.some((x) => x.id === cid)) return { ok: false, error: 'บล็อกที่ซ้อนอยู่ไม่มีแล้ว' };
        nested.set(ref, b.id);
      }
    }
  }
  for (const [ref, containerId] of nested) {
    const cid = customIdOf(ref);
    const inner = cid ? blocks.find((x) => x.id === cid) : undefined;
    if (nested.has(customKey(containerId)) || inner?.cells.some((c) => c.some((it) => it.kind === 'nested'))) {
      return { ok: false, error: 'ซ้อนบล็อกได้ชั้นเดียว' };
    }
  }
  const layout: EventDetailLayoutItem[] = [];
  for (const it of raw.layout as Record<string, unknown>[]) {
    const key = String(it?.block ?? '');
    const cid = customIdOf(key);
    if (!isCoreBlock(key) && !(cid && blocks.some((b) => b.id === cid))) continue;
    if (nested.has(key)) continue;
    if (layout.some((l) => l.block === key)) continue;
    layout.push({ block: key as EventDetailLayoutKey, visible: it.visible !== false });
  }
  // every free block must be placed; every built-in block present; locked ones visible
  for (const b of blocks) {
    const key = customKey(b.id);
    if (!nested.has(key) && !layout.some((l) => l.block === key)) layout.push({ block: key, visible: true });
  }
  const version = (raw as { v?: unknown }).v === 2 ? (2 as const) : undefined;
  const fixed = layoutEntries({ layout, customBlocks: blocks, ...(version ? { v: version } : {}) }).map((e) => e.item);
  if (JSON.stringify(blocks).length > PAGE_LIMITS.pageChars) {
    return { ok: false, error: 'หน้านี้มีภาพและไฟล์รวมกันใหญ่เกินไป (ประมาณ 6 MB) ลดจำนวนภาพหรือไฟล์ลง' };
  }
  const core = cleanCoreText((raw as { coreText?: unknown }).coreText);
  if (typeof core === 'string') return { ok: false, error: core };
  const card = cleanCard((raw as { card?: unknown }).card);
  return {
    ok: true,
    value: {
      layout: fixed,
      customBlocks: blocks,
      ...(core ? { coreText: core } : {}),
      ...(card ? { card } : {}),
      ...(version ? { v: version } : {}),
    },
  };
}

export const CARD_LIMITS = { kicker: 40, promo: 80 };

/** settings of the sticky register card: two short lines and three switches */
function cleanCard(v: unknown): EventRegisterCardConfig | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const out: EventRegisterCardConfig = {};
  const line = (x: unknown, max: number) => cleanText(x, max).replace(/\n/g, ' ').trim();
  if (typeof o.kicker === 'string' && line(o.kicker, CARD_LIMITS.kicker)) out.kicker = line(o.kicker, CARD_LIMITS.kicker);
  if (typeof o.promo === 'string' && line(o.promo, CARD_LIMITS.promo)) out.promo = line(o.promo, CARD_LIMITS.promo);
  for (const k of ['showMascot', 'showQuota', 'showShortcuts'] as const) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  return Object.keys(out).length ? out : undefined;
}

/** display options of a data piece: known keys only, sane values */
function cleanDataOptions(v: unknown): EventPageItem['options'] {
  const o = (v ?? {}) as Record<string, unknown>;
  const out: NonNullable<EventPageItem['options']> = {};
  if (Array.isArray(o.categoryIds)) out.categoryIds = o.categoryIds.map(String).filter((x) => ID_RE.test(x)).slice(0, 20);
  for (const k of ['showAllTiers', 'showAge', 'showStock', 'showDate', 'showRules'] as const) {
    if (typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  }
  if (o.layout === 'cards' || o.layout === 'table') out.layout = o.layout;
  if (o.quotaMode === 'per-category' || o.quotaMode === 'total') out.quotaMode = o.quotaMode;
  if (o.quotaStyle === 'number' || o.quotaStyle === 'label') out.quotaStyle = o.quotaStyle;
  if (typeof o.productCount === 'number') out.productCount = Math.max(1, Math.min(8, Math.round(o.productCount)));
  if (typeof o.productCategory === 'string') out.productCategory = cleanText(o.productCategory, 40);
  return out;
}

/** text of the built-in blocks: lists within limits (a string = the error) */
function cleanCoreText(v: unknown): EventCoreText | undefined | string {
  if (v === undefined || v === null) return undefined;
  const L = CORE_TEXT_LIMITS;
  const raw = v as Record<string, Record<string, unknown> | undefined>;
  const out: EventCoreText = {};
  const line = (x: unknown, max: number) => cleanText(x, max).replace(/\n/g, ' ');
  if (raw.about) {
    const paragraphs = Array.isArray(raw.about.paragraphs) ? raw.about.paragraphs : [];
    const highlights = Array.isArray(raw.about.highlights) ? raw.about.highlights : [];
    if (paragraphs.length > L.paragraphs) return `เกี่ยวกับงานใส่ได้ไม่เกิน ${L.paragraphs} ย่อหน้า`;
    if (highlights.length > L.highlights) return `จุดเด่นใส่ได้ไม่เกิน ${L.highlights} ข้อ`;
    out.about = {
      paragraphs: paragraphs.map((p) => cleanText(p, L.paragraph)),
      highlights: highlights.map((h) => line(h, L.highlight)),
    };
  }
  if (raw.racepack) {
    const items = Array.isArray(raw.racepack.items) ? (raw.racepack.items as Record<string, unknown>[]) : [];
    if (items.length > L.racepackItems) return `สิ่งที่ได้รับใส่ได้ไม่เกิน ${L.racepackItems} รายการ`;
    out.racepack = {
      items: items.map((i) => ({
        title: line(i?.title, L.racepackTitle),
        detail: cleanText(i?.detail, L.racepackDetail),
        scope: line(i?.scope, L.racepackScope),
      })),
    };
  }
  if (raw.schedule) {
    const items = Array.isArray(raw.schedule.items) ? (raw.schedule.items as Record<string, unknown>[]) : [];
    if (items.length > L.scheduleItems) return `กำหนดการใส่ได้ไม่เกิน ${L.scheduleItems} รายการ`;
    out.schedule = {
      items: items.map((i) => ({
        timeLabel: line(i?.timeLabel, L.scheduleTime),
        title: line(i?.title, L.scheduleTitle),
        detail: cleanText(i?.detail, L.scheduleDetail),
      })),
    };
  }
  return out.about || out.racepack || out.schedule ? out : undefined;
}

/* ------------------------------------------------------------------ */
/* Placement rules: one table for every drag, drop and button move      */
/* ------------------------------------------------------------------ */

/** what is being placed */
export type DragSubject =
  | { kind: 'new-piece' }
  | { kind: 'new-block' }
  | { kind: 'piece'; blockId: string; itemId: string }
  | { kind: 'block'; key: string };

/** where it would go: between top-level blocks, or into a column of a free block */
export type DropPlace = { kind: 'top' } | { kind: 'column'; blockId: string; col: number };

/** why block `key` cannot sit in a column of free block `toBlockId` (null = it can); one level deep */
export function nestingProblem(page: EventDetailPage, key: string, toBlockId: string): string | null {
  if (key === customKey(toBlockId)) return 'ซ้อนบล็อกไว้ในตัวเองไม่ได้';
  if (nestedPlaces(page).has(customKey(toBlockId))) return 'ซ้อนบล็อกได้ชั้นเดียว';
  const cid = customIdOf(key);
  const inner = cid ? page.customBlocks.find((b) => b.id === cid) : undefined;
  if (inner?.cells.some((c) => c.some((it) => it.kind === 'nested'))) {
    return 'บล็อกนี้มีบล็อกอื่นซ้อนอยู่แล้ว จึงซ้อนต่อไม่ได้ (ได้ชั้นเดียว)';
  }
  return null;
}

/**
 * The placement rules of the page editor in one place (null = allowed, else the reason, Thai):
 * - between top-level blocks: anything; a loose piece or a new block makes a new free block (limit 12)
 * - into a column: pieces always (8 per column); a block (moved, new, or a piece holding one)
 *   only into a top-level free block, never into itself, one level deep
 * The server's `normalizeDetailPage` checks the saved result again.
 */
export function placementProblem(page: EventDetailPage, subject: DragSubject, place: DropPlace): string | null {
  const findPiece = (blockId: string, itemId: string) => {
    const b = page.customBlocks.find((x) => x.id === blockId);
    for (let col = 0; b && col < b.cells.length; col++) {
      const it = b.cells[col].find((x) => x.id === itemId);
      if (it) return { col, item: it };
    }
    return null;
  };
  const piece = subject.kind === 'piece' ? findPiece(subject.blockId, subject.itemId) : null;
  if (subject.kind === 'piece' && !piece) return 'ไม่พบชิ้นส่วนนี้';
  /** the block this subject carries into its new place, if any */
  const carried =
    subject.kind === 'block' ? subject.key : piece?.item.kind === 'nested' ? (piece.item.ref ?? null) : null;
  const makesNewBlock = subject.kind === 'new-block' || subject.kind === 'new-piece' || (piece !== null && !carried);
  const blockLimit = `เพิ่มบล็อกอิสระได้ไม่เกิน ${PAGE_LIMITS.customBlocks} บล็อก`;

  if (place.kind === 'top') {
    if (makesNewBlock && page.customBlocks.length >= PAGE_LIMITS.customBlocks) return blockLimit;
    return null;
  }
  const target = page.customBlocks.find((b) => b.id === place.blockId);
  if (!target || !target.cells[place.col]) return 'ไม่พบคอลัมน์นี้';
  const sameColumn = subject.kind === 'piece' && subject.blockId === place.blockId && piece?.col === place.col;
  if (!sameColumn && target.cells[place.col].length >= PAGE_LIMITS.itemsPerColumn) {
    return `แต่ละคอลัมน์ใส่ได้ไม่เกิน ${PAGE_LIMITS.itemsPerColumn} ชิ้น`;
  }
  if (subject.kind === 'new-block') {
    if (nestedPlaces(page).has(customKey(place.blockId))) return 'ซ้อนบล็อกได้ชั้นเดียว';
    if (page.customBlocks.length >= PAGE_LIMITS.customBlocks) return blockLimit;
    return null;
  }
  return carried ? nestingProblem(page, carried, place.blockId) : null;
}

/** Short random id for new blocks and pieces. */
export function newPageId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
