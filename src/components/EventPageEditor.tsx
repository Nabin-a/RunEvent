import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { EventCustomBlock, EventDetailLayoutKey, EventDetailPage, EventPageItem, EventPageItemKind, RaceEvent } from '../types';
import {
  PAGE_LIMITS,
  coreBlockDef,
  customIdOf,
  customKey,
  isCoreBlock,
  layoutEntries,
  nestedPlaces,
  newPageId,
  placementProblem,
  normalizeDetailPage,
  pageOf,
  resolveBlockKey,
  type DragSubject,
} from '../data/eventDetailLayout';
import { lineBetween, nearestInsertIndex } from './dropTarget';
import { CORE_TEXT_LIMITS, dataPieceHasContent, mergedCoreText } from '../data/eventDataPieces';
import { convertToFreeBlocks, missingRequiredData } from '../data/eventPageConvert';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { PREVIEW_PARAM, type PreviewBox, type PreviewLayout } from './pagePreview';
import { PageOutline, type DropPos, type OutlineDropHint } from './PageOutline';
import { PreviewContextMenu, type MenuEntry } from './PreviewContextMenu';
import {
  BLOCK_ICON,
  BlockInspector,
  CardIconPicker,
  CardInspector,
  CoreInspector,
  isCoreTextKey,
  ItemInspector,
  PALETTE,
  PALETTE_GROUPS,
  kindEntry,
  newItem,
  type PaletteEntry,
  withCardIcon,
} from './PageItemEditors';

/**
 * Organizer page editor for the public event page (scope confirmed 23 Nov 2026).
 *
 * Left: one palette (free block + 10 piece kinds picked from WordPress core blocks),
 * searchable, and a collapsed page outline. Centre: the real event page in an iframe;
 * palette items are dragged straight onto it — between blocks (new block there) or into
 * a column of a free block (piece at that spot). A floating toolbar acts on the selected
 * block. Right: settings of the selected block or piece only.
 *
 * The iframe reports where its blocks / columns / pieces are (pagePreview.ts); this
 * component lays transparent drop zones over it, because a drag cannot cross into an
 * iframe. Every drag has a keyboard / click alternative (click a palette item to add it
 * next to the selection; outline + Alt+arrows + toolbar buttons to move).
 *
 * Edits go to a draft (saved automatically); "เผยแพร่" makes it live and keeps a version.
 */

type SaveResult = { ok: boolean; error?: string };

const HISTORY_MAX = 60;
const AUTOSAVE_MS = 1500;
const DESKTOP_WIDTH = 1280;
const PHONE_WIDTH = 390;
const EDGE_SCROLL = 56;
/** frame px at the top / bottom of a block where a drop means "before / after it", not "into it" */
const ESCAPE_BAND = 22;

type PreviewDrop =
  | { kind: 'gap'; index: number; line?: PreviewBox; box?: PreviewBox }
  /** reorder inside a built-in list (race pack / schedule): `index` among the other items */
  | { kind: 'core'; list: string; from: number; index: number; line?: PreviewBox; box?: PreviewBox }
  | { kind: 'col'; blockId: string; col: number; index: number; line?: PreviewBox; box?: PreviewBox };

const blockIcon = (key: string) => (isCoreBlock(key) ? BLOCK_ICON[key] : 'table-columns');

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

/** what a right-click in the preview was on */
type CtxTarget =
  | { kind: 'block'; key: string }
  | { kind: 'item'; blockId: string; itemId: string }
  | { kind: 'core'; list: string; index: number }
  | { kind: 'card' }
  | { kind: 'multi' };
const ALT = IS_MAC ? '⌥' : 'Alt';

/** shown in the shortcut list and in button tooltips */
const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: `${MOD}+Z`, label: 'ย้อนกลับ' },
  { keys: `${MOD}+Shift+Z · ${MOD}+Y`, label: 'ทำซ้ำ' },
  { keys: `${MOD}+S`, label: 'บันทึกร่างทันที' },
  { keys: `${MOD}+Enter`, label: 'เผยแพร่ (มีกล่องยืนยันก่อน)' },
  { keys: `${ALT}+↑ · ${ALT}+↓`, label: 'ย้ายบล็อกหรือชิ้นส่วนที่เลือกขึ้น/ลง' },
  { keys: `${MOD}+D`, label: 'ทำสำเนาบล็อกหรือชิ้นส่วนที่เลือก' },
  { keys: 'Delete', label: 'ลบบล็อกอิสระหรือชิ้นส่วนที่เลือก' },
  { keys: `Ctrl+${ALT}+D · Ctrl+${ALT}+M`, label: 'ตัวอย่างแบบเดสก์ท็อป · มือถือ' },
  { keys: 'Esc', label: 'ปิดกล่องที่เปิดอยู่ หรือยกเลิกการเลือก' },
  { keys: 'F2', label: 'แก้ข้อความของสิ่งที่เลือกในตัวอย่างหน้า (หรือดับเบิลคลิกที่ข้อความ)' },
  { keys: '?', label: 'เปิด/ปิดรายการคีย์ลัด' },
];

const newBlock = (columns: 1 | 2 | 3, first?: EventPageItem): EventCustomBlock => ({
  id: newPageId('blk'),
  title: 'หัวข้อใหม่',
  columns,
  cells: Array.from({ length: columns }, (_, i) => (i === 0 && first ? [first] : ([] as EventPageItem[]))),
});

/** the page to start from: the saved draft, else the published page (built-in blocks filled in) */
function startPage(ev: RaceEvent): EventDetailPage {
  // built-in blocks are free blocks now (24 Nov 2026): an older page is converted here
  const base = convertToFreeBlocks(ev.detailPageDraft ?? pageOf(ev), ev);
  return { ...base, layout: layoutEntries(base).map((e) => e.item) };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** piece kinds whose text can be edited in place in the preview */
const INLINE_TEXT_KINDS = new Set<string>(['heading', 'text', 'list', 'table', 'faq', 'image', 'file', 'link', 'cards', 'timeline']);

/**
 * Put text edited in the preview into one field of a piece. `path` comes from the
 * `data-page-edit` mark: text | label | imageAlt | items.N | rows.R.C | faqs.N.q | faqs.N.a.
 * Lengths are cut to the page limits; clearing a list line removes it.
 */
function applyItemText(it: EventPageItem, path: string, value: string): EventPageItem {
  const [field, a, b] = path.split('.');
  const L = PAGE_LIMITS;
  if (field === 'text') return { ...it, text: value.slice(0, it.kind === 'heading' ? L.heading : L.text) };
  if (field === 'label') return { ...it, label: value.slice(0, L.label) };
  if (field === 'imageAlt') return { ...it, imageAlt: value.slice(0, L.alt) };
  if (field === 'items') {
    const items = [...(it.items ?? [])];
    const at = Number(a);
    if (!value.trim()) items.splice(at, 1);
    else items[Math.min(at, items.length)] = value.slice(0, L.listItem);
    return { ...it, items: items.slice(0, L.listItems) };
  }
  if (field === 'rows') {
    const rows = (it.rows ?? []).map((r) => [...r]);
    const r = Number(a);
    const c = Number(b);
    if (!rows[r] || c >= rows[r].length) return it;
    rows[r][c] = value.slice(0, L.tableCell);
    return { ...it, rows };
  }
  if (field === 'cards' || field === 'timeline') {
    const L2 = { title: field === 'cards' ? 120 : 160, detail: 400, scope: 80, timeLabel: 80 } as Record<string, number>;
    const rows = [...((field === 'cards' ? it.cards : it.timeline) ?? [])] as Record<string, string>[];
    const n = Number(a);
    if (!rows[n] || !b) return it;
    rows[n] = { ...rows[n], [b]: value.slice(0, L2[b] ?? 200) };
    return field === 'cards'
      ? { ...it, cards: rows as unknown as EventPageItem['cards'] }
      : { ...it, timeline: rows as unknown as EventPageItem['timeline'] };
  }
  if (field === 'faqs') {
    const faqs = (it.faqs ?? []).map((f) => ({ ...f }));
    const n = Number(a);
    if (!faqs[n]) return it;
    if (b === 'q') faqs[n].q = value.slice(0, L.faqQuestion);
    else faqs[n].a = value.slice(0, L.faqAnswer);
    return { ...it, faqs };
  }
  return it;
}

/** `item:<blockId>:<itemId>` -> parts */
const itemKeyParts = (key: string | null) => {
  if (!key?.startsWith('item:')) return null;
  const [, blockId, itemId] = key.split(':');
  return { blockId, itemId };
};

/** outline drags look at the row under the pointer; preview drags need no drop targets */
const collision: CollisionDetection = (args) => {
  const id = String(args.active.id);
  // palette / preview drags: the editor works out the spot from the pointer (computePreviewDrop)
  if (id.startsWith('pal:') || id.startsWith('mv-')) return [];
  // outline rows: the row under the pointer
  if (id.startsWith('tr-')) {
    return pointerWithin({ ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith('row:')) });
  }
  return [];
};

export function EventPageEditor({
  event,
  canEdit,
  onSave,
  onClose,
  onOpenSection,
}: {
  event: RaceEvent;
  /** owner / event manager; others see the preview only */
  canEdit: boolean;
  onSave: (page: EventDetailPage, publish: boolean) => Promise<SaveResult>;
  onClose: () => void;
  /** leave the editor for the dashboard menu that owns some data (draft is saved first) */
  onOpenSection?: (section: string) => void;
}) {
  // page plus undo/redo stacks in one state so every change is a single pure update
  const [hist, setHist] = useState<{ page: EventDetailPage; past: EventDetailPage[]; future: EventDetailPage[] }>(
    () => ({ page: startPage(event), past: [], future: [] })
  );
  const { page, past, future } = hist;
  const [selected, setSelected] = useState<string | null>(null);
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [saved, setSaved] = useState<EventDetailPage>(() => startPage(event));
  const [status, setStatus] = useState<{ tone: 'idle' | 'saving' | 'ok' | 'err'; text: string }>({
    tone: 'idle',
    text: event.detailPageDraft ? tx('มีฉบับร่างที่ยังไม่เผยแพร่') : tx('ตรงกับหน้าที่เผยแพร่อยู่'),
  });
  const [showVersions, setShowVersions] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [query, setQuery] = useState('');
  const [announce, setAnnounce] = useState('');
  const [frameLayout, setFrameLayout] = useState<PreviewLayout | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [leftTab, setLeftTab] = useState<'add' | 'outline'>('add');
  /** where an outline row would land (drawn as a line / highlight in the tree) */
  const [treeDrop, setTreeDrop] = useState<OutlineDropHint | null>(null);
  /** where a palette / preview drag would land (drawn as a line or a lit column) */
  const [previewDrop, setPreviewDrop] = useState<PreviewDrop | null>(null);
  /** block / piece under the mouse in the preview: they get drag grips */
  const [hover, setHover] = useState<{ block: string | null; item: string | null }>({ block: null, item: null });
  /** a text is being edited in place in the preview: drag layers step aside so the caret works */
  const [inlineEditing, setInlineEditing] = useState(false);
  /** blocks or pieces selected together with `selected` (Shift / Ctrl+click); empty = one thing */
  const [multi, setMulti] = useState<string[]>([]);
  /** a right-click that reached the page itself (set each render, called from the message handler) */
  const ctxFromFrameRef = useRef<(key: string | null, x: number, y: number) => void>(() => {});
  /** a click that reached the page itself (set each render, called from the message handler) */
  const pickFromFrameRef = useRef<(key: string, mods: { shift: boolean; toggle: boolean }) => void>(() => {});
  /** the card whose icon is being changed from the preview: `item:<blockId>:<itemId>:cards.<n>` */
  const [iconPick, setIconPick] = useState<string | null>(null);
  const iconPopRef = useRef<HTMLDivElement>(null);
  /** the right-click menu over the preview: what it is for, where (px in the preview box), and the
   * point in the page (page px) that "edit text" starts from (null when opened from the keyboard) */
  const [ctxMenu, setCtxMenu] = useState<{ target: CtxTarget; x: number; y: number; at: { x: number; y: number } | null } | null>(null);
  /** the icon spot that opened the pop-up (focus goes back to it) */
  const iconOpenerTarget = useRef<string | null>(null);
  // the icon pop-up closes on a click elsewhere; focus goes back to the spot that opened it
  useEffect(() => {
    if (!iconPick) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t && (iconPopRef.current?.contains(t) || t.closest('.pe-icon-spot'))) return;
      setIconPick(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      const target = iconOpenerTarget.current;
      // after React has drawn the closed state
      requestAnimationFrame(() => {
        // only when focus was lost with the pop-up (not when the click went to another control)
        const now = document.activeElement;
        if (!target || (now && now !== document.body)) return;
        document.querySelector<HTMLElement>(`.pe-icon-spot[data-target="${CSS.escape(target)}"]`)?.focus({ preventScroll: true });
      });
    };
  }, [iconPick]);

  // a different event, or a fresh publish from elsewhere, restarts the editor
  const eventKey = `${event.id}|${event.detailPageVersions?.length ?? 0}`;
  const lastEventKey = useRef(eventKey);
  useEffect(() => {
    if (lastEventKey.current === eventKey) return;
    lastEventKey.current = eventKey;
    const fresh = startPage(event);
    setHist({ page: fresh, past: [], future: [] });
    setSaved(fresh);
    setSelected(null);
  }, [eventKey, event]);

  /** while on, the changes made together count as one undo step (several selected things at once) */
  const batchRef = useRef({ on: false, pushed: false });
  const update = useCallback((fn: (p: EventDetailPage) => EventDetailPage) => {
    const merge = batchRef.current.on && batchRef.current.pushed;
    if (batchRef.current.on) batchRef.current.pushed = true;
    setHist((h) => {
      const next = fn(h.page);
      if (sameJson(next, h.page)) return h;
      if (merge) return { ...h, page: next, future: [] };
      return { page: next, past: [...h.past.slice(-(HISTORY_MAX - 1)), h.page], future: [] };
    });
  }, []);
  const inBatch = (fn: () => void) => {
    batchRef.current = { on: true, pushed: false };
    try {
      fn();
    } finally {
      batchRef.current = { on: false, pushed: false };
    }
  };
  const undo = useCallback(() => {
    setHist((h) =>
      h.past.length === 0 ? h : { page: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.page, ...h.future] }
    );
  }, []);
  const redo = useCallback(() => {
    setHist((h) => (h.future.length === 0 ? h : { page: h.future[0], past: [...h.past, h.page], future: h.future.slice(1) }));
  }, []);

  // keep the page behind the editor from scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /* ---------------- saving ---------------- */
  const dirty = !sameJson(page, saved);
  const check = useMemo(() => normalizeDetailPage(page), [page]);

  const saveDraft = useCallback(
    async (p: EventDetailPage) => {
      const c = normalizeDetailPage(p);
      if (!c.ok) {
        setStatus({ tone: 'err', text: c.error });
        return false;
      }
      setStatus({ tone: 'saving', text: tx('กำลังบันทึกร่าง…') });
      const res = await onSave(c.value, false);
      if (!res.ok) {
        setStatus({ tone: 'err', text: res.error ?? tx('บันทึกร่างไม่สำเร็จ') });
        return false;
      }
      setSaved(p);
      setStatus({
        tone: 'ok',
        text: txf('บันทึกร่างแล้ว {0}', new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })),
      });
      return true;
    },
    [onSave]
  );

  useEffect(() => {
    if (!canEdit || !dirty) return;
    const t = window.setTimeout(() => void saveDraft(page), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [canEdit, dirty, page, saveDraft]);

  /** same look as the other SweetAlert dialogs of the app (styles.css: kratai-swal-*) */
  const swalLook = {
    buttonsStyling: false,
    heightAuto: false,
    scrollbarPadding: false,
    customClass: {
      container: 'kratai-swal-top',
      popup: 'kratai-swal-popup',
      actions: 'kratai-swal-actions',
      confirmButton: 'btn-primary',
      cancelButton: 'btn-secondary',
    },
  } as const;

  const publish = async () => {
    const c = normalizeDetailPage(page);
    if (!c.ok) {
      setStatus({ tone: 'err', text: c.error });
      void Swal.fire({ ...swalLook, icon: 'error', title: tx('เผยแพร่ไม่ได้'), text: c.error, confirmButtonText: tx('ตกลง') });
      return;
    }
    setStatus({ tone: 'saving', text: tx('กำลังเผยแพร่…') });
    const res = await onSave(c.value, true);
    if (!res.ok) {
      const text = res.error ?? tx('เผยแพร่ไม่สำเร็จ');
      setStatus({ tone: 'err', text });
      void Swal.fire({ ...swalLook, icon: 'error', title: tx('เผยแพร่ไม่สำเร็จ'), text, confirmButtonText: tx('ตกลง') });
      return;
    }
    setSaved(page);
    setStatus({ tone: 'ok', text: tx('เผยแพร่แล้ว หน้างานเปลี่ยนตามนี้') });
    void Swal.fire({
      ...swalLook,
      icon: 'success',
      title: tx('เผยแพร่แล้ว'),
      text: tx('เผยแพร่แล้ว หน้างานเปลี่ยนตามนี้'),
      confirmButtonText: tx('ตกลง'),
      timer: 2200,
      timerProgressBar: true,
    });
  };

  /** ask first (SweetAlert), then publish */
  const confirmPublish = async () => {
    if (!canEdit || !check.ok || status.tone === 'saving' || Swal.isVisible()) return;
    const missing = missingRequiredData(page);
    if (missing.length > 0) {
      void Swal.fire({
        ...swalLook,
        icon: 'warning',
        title: tx('ยังเผยแพร่ไม่ได้'),
        text: txf('หน้านี้ต้องแสดงชิ้นข้อมูล {0} อย่างน้อยหนึ่งที่ (ผู้สมัครต้องเห็นราคาและสถานที่ก่อนสมัคร)', missing.map((m) => `"${tx(m)}"`).join(', ')),
        confirmButtonText: tx('ตกลง'),
      });
      return;
    }
    const answer = await Swal.fire({
      ...swalLook,
      icon: 'question',
      title: tx('เผยแพร่หน้านี้?'),
      text:
        event.status === 'published'
          ? tx('หน้านี้จะแสดงต่อผู้เข้าชมทุกคนทันที เผยแพร่เลยไหม?')
          : tx('งานยังไม่เปิดให้ผู้เข้าชม หน้านี้จะใช้เมื่องานเผยแพร่ เผยแพร่ฉบับนี้ไหม?'),
      showCancelButton: true,
      confirmButtonText: tx('เผยแพร่'),
      cancelButtonText: tx('ยกเลิก'),
      reverseButtons: true,
      focusConfirm: true,
    });
    if (answer.isConfirmed) await publish();
  };

  /* ---------------- selection helpers ---------------- */
  const entries = layoutEntries(page);
  const itemSel = itemKeyParts(selected);
  /** layout key of the selected block (or of the block holding the selected piece) */
  const selectedBlockKey = itemSel ? customKey(itemSel.blockId) : selected;
  const selectedCustomId = selectedBlockKey ? customIdOf(selectedBlockKey) : null;
  const selectedBlock = selectedCustomId ? page.customBlocks.find((b) => b.id === selectedCustomId) : undefined;
  const findItem = (blockId: string, itemId: string) => {
    const b = page.customBlocks.find((x) => x.id === blockId);
    if (!b) return null;
    for (let col = 0; col < b.cells.length; col++) {
      const index = b.cells[col].findIndex((it) => it.id === itemId);
      if (index >= 0) return { block: b, col, index, item: b.cells[col][index] };
    }
    return null;
  };
  const selectedItem = itemSel ? findItem(itemSel.blockId, itemSel.itemId) : null;
  /** blocks placed inside a column of a free block: key -> container and the piece holding it */
  const places = nestedPlaces(page);
  const blockLabel = (key: string) => resolveBlockKey(page, key)?.label ?? key;
  /** a nested block selected as a piece (`item:` key) or, for a free one, by its own key */
  const selectedNested =
    selectedItem?.item.kind === 'nested' && selectedItem.item.ref
      ? { ref: selectedItem.item.ref as string, containerId: selectedItem.block.id, itemId: selectedItem.item.id, col: selectedItem.col }
      : !itemSel && selected && places.has(selected)
        ? { ref: selected, ...(places.get(selected) as { containerId: string; itemId: string; col: number }) }
        : null;

  // drop the selection when its block or piece is gone (undo, delete)
  useEffect(() => {
    if (itemSel && !selectedItem) setSelected(selectedBlock ? customKey(selectedBlock.id) : null);
    else if (
      selectedBlockKey &&
      selectedBlockKey !== 'card' &&
      !entries.some((e) => e.item.block === selectedBlockKey) &&
      !places.has(selectedBlockKey)
    ) {
      setSelected(null);
    }
  });

  /* ---------------- page edits ---------------- */
  const layoutOf = (p: EventDetailPage) => layoutEntries(p).map((e) => e.item);

  const insertBlockAt = (block: EventCustomBlock, layoutIndex: number) => {
    if (page.customBlocks.length >= PAGE_LIMITS.customBlocks) {
      setStatus({ tone: 'err', text: txf('เพิ่มบล็อกอิสระได้ไม่เกิน {0} บล็อก', PAGE_LIMITS.customBlocks) });
      return false;
    }
    update((p) => {
      const layout = layoutOf(p);
      layout.splice(Math.max(0, Math.min(layoutIndex, layout.length)), 0, { block: customKey(block.id), visible: true });
      return { ...p, layout, customBlocks: [...p.customBlocks, block] };
    });
    return true;
  };

  /** layout index right after the selected block (end when nothing is selected) */
  const indexAfterSelection = () => {
    const layout = layoutOf(page);
    const at = selectedBlockKey ? layout.findIndex((l) => l.block === selectedBlockKey) : -1;
    return at >= 0 ? at + 1 : layout.length;
  };

  const setBlock = (id: string, fn: (b: EventCustomBlock) => EventCustomBlock) =>
    update((p) => ({ ...p, customBlocks: p.customBlocks.map((b) => (b.id === id ? fn(b) : b)) }));

  const insertItem = (blockId: string, col: number, item: EventPageItem, index?: number) => {
    const b = page.customBlocks.find((x) => x.id === blockId);
    if (!b) return false;
    if (b.cells[col].length >= PAGE_LIMITS.itemsPerColumn) {
      setStatus({ tone: 'err', text: txf('แต่ละคอลัมน์ใส่ได้ไม่เกิน {0} ชิ้น', PAGE_LIMITS.itemsPerColumn) });
      return false;
    }
    setBlock(blockId, (cur) => ({
      ...cur,
      cells: cur.cells.map((c, i) => {
        if (i !== col) return c;
        const next = [...c];
        next.splice(index ?? next.length, 0, item);
        return next;
      }),
    }));
    return true;
  };

  /** click on a palette item: add next to the current selection */
  const addFromPalette = (kind: PaletteEntry['id']) => {
    if (!canEdit) return;
    if (kind === 'block') {
      const block = newBlock(1);
      if (insertBlockAt(block, indexAfterSelection())) setSelected(customKey(block.id));
      return;
    }
    const item = newItem(kind);
    if (selectedItem) {
      if (insertItem(selectedItem.block.id, selectedItem.col, item, selectedItem.index + 1)) {
        setSelected(`item:${selectedItem.block.id}:${item.id}`);
      }
      return;
    }
    if (selectedBlock) {
      if (insertItem(selectedBlock.id, 0, item)) setSelected(`item:${selectedBlock.id}:${item.id}`);
      return;
    }
    const block = newBlock(1, item);
    if (insertBlockAt(block, indexAfterSelection())) setSelected(`item:${block.id}:${item.id}`);
  };

  /**
   * Delete a free block. Free blocks nested in it go too; built-in blocks nested in it come
   * back to the page where it was (they can never be deleted). A nested block leaves its column.
   */
  const removeBlock = (id: string) => {
    const b = page.customBlocks.find((x) => x.id === id);
    const innerRefs = (b?.cells.flat() ?? []).filter((it) => it.kind === 'nested' && it.ref).map((it) => it.ref as string);
    const place = places.get(customKey(id));
    update((p) => {
      const layout = layoutOf(p);
      const at = layout.findIndex((l) => l.block === customKey(id));
      const kept = layout.filter((l) => l.block !== customKey(id));
      const cores = innerRefs.filter(isCoreBlock).map((k) => ({ block: k as EventDetailLayoutKey, visible: true }));
      kept.splice(at >= 0 ? at : kept.length, 0, ...cores);
      const drop = new Set([id, ...innerRefs.map(customIdOf).filter((x): x is string => !!x)]);
      const customBlocks = p.customBlocks
        .filter((x) => !drop.has(x.id))
        .map((x) => (place && x.id === place.containerId ? { ...x, cells: x.cells.map((c) => c.filter((it) => it.id !== place.itemId)) } : x));
      return { ...p, layout: kept, customBlocks };
    });
    setSelected(place ? customKey(place.containerId) : null);
  };

  const toggleVisible = (key: string) => {
    const cid = customIdOf(key);
    const b = cid ? page.customBlocks.find((x) => x.id === cid) : undefined;
    const holdsLocked = b?.cells.some((c) => c.some((it) => it.kind === 'nested' && it.ref && isCoreBlock(it.ref) && coreBlockDef(it.ref).locked));
    if (holdsLocked) {
      setStatus({ tone: 'err', text: tx('บล็อกนี้มีบล็อกหลักซ้อนอยู่ข้างใน จึงซ่อนไม่ได้') });
      return;
    }
    if (places.has(key)) {
      setStatus({ tone: 'err', text: tx('บล็อกที่ซ้อนอยู่ซ่อนไม่ได้ ย้ายออกมาชั้นบนก่อน') });
      return;
    }
    update((p) => ({
      ...p,
      layout: layoutOf(p).map((l) => (l.block === key ? { ...l, visible: !l.visible } : l)),
    }));
  };

  /** the shared placement rules (data/eventDetailLayout.ts), translated */
  const placeProblem = (...args: Parameters<typeof placementProblem> extends [unknown, ...infer R] ? R : never) => {
    const why = placementProblem(page, ...args);
    return why ? tx(why) : null;
  };

  /** put a top-level block into a column of a free block (it leaves the page order) */
  function nestBlock(key: string, toBlockId: string, col: number, index?: number) {
    const problem = placeProblem({ kind: 'block', key }, { kind: 'column', blockId: toBlockId, col });
    const target = page.customBlocks.find((b) => b.id === toBlockId);
    if (problem || !target) {
      if (problem) setStatus({ tone: 'err', text: problem });
      return;
    }
    const item: EventPageItem = { id: newPageId('it'), kind: 'nested', ref: key as EventDetailLayoutKey };
    update((p) => ({
      ...p,
      layout: layoutOf(p).filter((l) => l.block !== key),
      customBlocks: p.customBlocks.map((b) =>
        b.id !== toBlockId
          ? b
          : {
              ...b,
              cells: b.cells.map((c, i) => {
                if (i !== col) return c;
                const next = [...c];
                next.splice(Math.min(index ?? next.length, next.length), 0, item);
                return next;
              }),
            }
      ),
    }));
    setSelected(`item:${toBlockId}:${item.id}`);
    setAnnounce(txf('ซ้อน {0} ไว้ใน {1} แล้ว', blockLabel(key), target.title));
  }

  /** take a nested block out of its column and put it back in the page order */
  function unNest(containerId: string, itemId: string, gapIndex: number) {
    const found = findItem(containerId, itemId);
    const ref = found?.item.kind === 'nested' ? found.item.ref : undefined;
    if (!ref) return;
    update((p) => {
      const layout = layoutOf(p);
      layout.splice(Math.max(0, Math.min(gapIndex, layout.length)), 0, { block: ref, visible: true });
      return {
        ...p,
        layout,
        customBlocks: p.customBlocks.map((b) =>
          b.id === containerId ? { ...b, cells: b.cells.map((c) => c.filter((it) => it.id !== itemId)) } : b
        ),
      };
    });
    setSelected(ref);
    setAnnounce(txf('ย้าย {0} ออกมาชั้นบนแล้ว', blockLabel(ref)));
  }

  /** layout index right after a container block */
  const afterContainer = (containerId: string) => layoutOf(page).findIndex((l) => l.block === customKey(containerId)) + 1;

  const setColumns = (b: EventCustomBlock, columns: 1 | 2 | 3) =>
    setBlock(b.id, (cur) => {
      const cells = cur.cells.map((c) => [...c]);
      while (cells.length < columns) cells.push([]);
      // fewer columns: pieces of the removed columns move into the last kept one
      while (cells.length > columns) {
        const extra = cells.pop() as EventPageItem[];
        cells[cells.length - 1].push(...extra);
      }
      return { ...cur, columns, cells };
    });

  const setItem = (blockId: string, itemId: string, patch: Partial<EventPageItem>) =>
    setBlock(blockId, (cur) => ({
      ...cur,
      cells: cur.cells.map((c) => c.map((it) => (it.id === itemId ? { ...it, ...patch } : it))),
    }));

  const removeItem = (blockId: string, itemId: string) => {
    const found = findItem(blockId, itemId);
    if (found?.item.kind === 'nested' && found.item.ref) {
      const ref = found.item.ref;
      if (isCoreBlock(ref)) {
        // built-in blocks are never deleted: it comes back right under its container
        unNest(blockId, itemId, afterContainer(blockId));
        setStatus({ tone: 'idle', text: tx('บล็อกหลักลบไม่ได้ ย้ายออกมาไว้ใต้บล็อกนี้แทน') });
        return;
      }
      removeBlock(customIdOf(ref) as string);
      return;
    }
    setBlock(blockId, (cur) => ({ ...cur, cells: cur.cells.map((c) => c.filter((it) => it.id !== itemId)) }));
    setSelected(customKey(blockId));
  };

  const nameOfKey = (key: string) => entries.find((e) => e.item.block === key)?.resolved.label ?? blockLabel(key);
  /** name of a piece; a nested block is called by its block name */
  const pieceName = (blockId: string, itemId: string) => {
    const it = findItem(blockId, itemId)?.item;
    if (!it) return '';
    return it.kind === 'nested' && it.ref ? blockLabel(it.ref) : tx(kindEntry(it)?.label ?? '');
  };

  const moveLayer = (key: string, delta: -1 | 1) => {
    const layout = layoutOf(page);
    const from = layout.findIndex((l) => l.block === key);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= layout.length) return;
    update((p) => ({ ...p, layout: arrayMove(layoutOf(p), from, to) }));
    setAnnounce(txf('ย้าย {0} ไปลำดับที่ {1} จาก {2}', nameOfKey(key), to + 1, layout.length));
  };

  const moveItem = (blockId: string, itemId: string, dCol: number, dIdx: number) => {
    const found = findItem(blockId, itemId);
    if (!found) return;
    const { block: b, col, index } = found;
    const toCol = col + dCol;
    if (toCol < 0 || toCol >= b.columns) return;
    if (dCol === 0) {
      const toIdx = index + dIdx;
      if (toIdx < 0 || toIdx >= b.cells[col].length) return;
      setBlock(blockId, (cur) => ({ ...cur, cells: cur.cells.map((c, i) => (i === col ? arrayMove(c, index, toIdx) : c)) }));
      setAnnounce(txf('ย้ายไปตำแหน่งที่ {0} ในคอลัมน์ {1}', toIdx + 1, col + 1));
      return;
    }
    if (b.cells[toCol].length >= PAGE_LIMITS.itemsPerColumn) return;
    setBlock(blockId, (cur) => {
      const cells = cur.cells.map((c) => [...c]);
      const [moved] = cells[col].splice(index, 1);
      cells[toCol].push(moved);
      return { ...cur, cells };
    });
    setAnnounce(txf('ย้ายไปคอลัมน์ {0}', toCol + 1));
  };

  /**
   * Copy a free block next to itself (inside the same column when it is nested). Free blocks
   * nested in it are copied too; nested built-in blocks are left out (each exists once).
   */
  const duplicateBlock = (id: string) => {
    const src = page.customBlocks.find((b) => b.id === id);
    if (!src) return;
    const extra: EventCustomBlock[] = [];
    const cells = src.cells.map((c) =>
      c.flatMap((it): EventPageItem[] => {
        if (it.kind !== 'nested') return [{ ...it, id: newPageId('it') }];
        const cid = it.ref ? customIdOf(it.ref) : null;
        const inner = cid ? page.customBlocks.find((b) => b.id === cid) : undefined;
        if (!inner) return [];
        const innerCopy = { ...inner, id: newPageId('blk'), cells: inner.cells.map((cc) => cc.map((x) => ({ ...x, id: newPageId('it') }))) };
        extra.push(innerCopy);
        return [{ ...it, id: newPageId('it'), ref: customKey(innerCopy.id) }];
      })
    );
    const copy: EventCustomBlock = { ...src, id: newPageId('blk'), title: `${src.title} ${tx('(สำเนา)')}`.slice(0, PAGE_LIMITS.title), cells };
    if (page.customBlocks.length + 1 + extra.length > PAGE_LIMITS.customBlocks) {
      setStatus({ tone: 'err', text: txf('เพิ่มบล็อกอิสระได้ไม่เกิน {0} บล็อก', PAGE_LIMITS.customBlocks) });
      return;
    }
    const place = places.get(customKey(id));
    if (place) {
      const container = page.customBlocks.find((b) => b.id === place.containerId);
      if (!container || container.cells[place.col].length >= PAGE_LIMITS.itemsPerColumn) {
        setStatus({ tone: 'err', text: txf('แต่ละคอลัมน์ใส่ได้ไม่เกิน {0} ชิ้น', PAGE_LIMITS.itemsPerColumn) });
        return;
      }
      const holder: EventPageItem = { id: newPageId('it'), kind: 'nested', ref: customKey(copy.id) };
      update((p) => ({
        ...p,
        customBlocks: [
          ...p.customBlocks.map((b) => {
            if (b.id !== place.containerId) return b;
            return {
              ...b,
              cells: b.cells.map((c, i) => {
                if (i !== place.col) return c;
                const next = [...c];
                next.splice(next.findIndex((x) => x.id === place.itemId) + 1, 0, holder);
                return next;
              }),
            };
          }),
          copy,
        ],
      }));
      setSelected(`item:${place.containerId}:${holder.id}`);
    } else {
      const at = layoutOf(page).findIndex((l) => l.block === customKey(id));
      update((p) => {
        const layout = layoutOf(p);
        layout.splice(at + 1, 0, { block: customKey(copy.id), visible: true });
        return { ...p, layout, customBlocks: [...p.customBlocks, copy, ...extra] };
      });
      setSelected(customKey(copy.id));
    }
    setAnnounce(txf('ทำสำเนา {0} แล้ว', src.title));
  };

  const duplicateItem = (blockId: string, itemId: string) => {
    const found = findItem(blockId, itemId);
    if (!found) return;
    if (found.item.kind === 'nested' && found.item.ref) {
      const cid = customIdOf(found.item.ref);
      if (cid) duplicateBlock(cid);
      else setStatus({ tone: 'err', text: tx('บล็อกหลักมีได้ที่เดียว ทำสำเนาไม่ได้') });
      return;
    }
    const copy = { ...found.item, id: newPageId('it') };
    if (insertItem(blockId, found.col, copy, found.index + 1)) setSelected(`item:${blockId}:${copy.id}`);
  };

  /** text editors for the built-in blocks about / race pack / schedule */
  const coreTextProps = (blockId: string) => {
    if (!isCoreTextKey(blockId)) return {};
    const text = mergedCoreText(event, page.coreText)[blockId];
    return {
      text,
      onText: canEdit
        ? (next: typeof text) => update((p) => ({ ...p, coreText: { ...p.coreText, [blockId]: next } }))
        : undefined,
    };
  };

  /** go to the dashboard menu that owns some data; the draft is saved first */
  const openSection = onOpenSection
    ? async (section: string) => {
        if (canEdit && dirty) await saveDraft(page);
        onOpenSection(section);
      }
    : undefined;

  /** rows of the outline the live page leaves out (no data to show) */
  const hiddenOnPublic = (key: string) => {
    if (key === 'merch') return event.products.length === 0;
    const parts = itemKeyParts(key);
    const it = parts ? findItem(parts.blockId, parts.itemId)?.item : undefined;
    return it?.kind === 'data' ? !dataPieceHasContent(event, it) : false;
  };

  /* ---------------- keyboard shortcuts ---------------- */
  const hotkeyRef = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => hotkeyRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // physical key first (works with the Thai layout), then the character as a fallback
  const isKey = (e: KeyboardEvent, letter: string) => e.code === `Key${letter.toUpperCase()}` || e.key.toLowerCase() === letter;
  const isHelpKey = (e: KeyboardEvent) => e.key === '?' || ((e.code === 'Slash' || e.key === '/') && e.shiftKey);

  hotkeyRef.current = (e: KeyboardEvent) => {
    if (e.defaultPrevented) return; // a focused outline grip already moved with the arrows
    if (Swal.isVisible()) return; // the dialog handles its own keys (Esc, Enter)
    const el = e.target as HTMLElement | null;
    const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    const mod = IS_MAC ? e.metaKey : e.ctrlKey;
    if (e.key === 'Escape') {
      if (showShortcuts || showVersions) {
        setShowShortcuts(false);
        setShowVersions(false);
      } else if (!typing && multi.length > 0) setMulti([]);
      else if (!typing) setSelected(itemSel ? customKey(itemSel.blockId) : null);
      return;
    }
    if (e.ctrlKey && e.altKey && (isKey(e, 'd') || isKey(e, 'm'))) {
      e.preventDefault();
      setDevice(isKey(e, 'd') ? 'desktop' : 'phone');
      return;
    }
    if (!canEdit) {
      if (!typing && isHelpKey(e)) setShowShortcuts((v) => !v);
      return;
    }
    if (mod && isKey(e, 's')) {
      e.preventDefault();
      void saveDraft(page);
      return;
    }
    if (mod && e.key === 'Enter') {
      e.preventDefault();
      void confirmPublish();
      return;
    }
    if (typing) return;
    if (mod && isKey(e, 'z')) {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && isKey(e, 'y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && isKey(e, 'd') && multiOn) {
      e.preventDefault();
      duplicateMany();
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && multiOn) {
      e.preventDefault();
      if (multiKind === 'block') moveMany(e.key === 'ArrowUp' ? -1 : 1);
      else setStatus({ tone: 'idle', text: tx('ย้ายทีละหลายชิ้นส่วนยังทำไม่ได้ ย้ายทีละชิ้นหรือลากในโครงหน้า') });
      return;
    }
    if (e.key === 'Delete' && multiOn) {
      e.preventDefault();
      removeMany();
      return;
    }
    if (mod && isKey(e, 'd')) {
      e.preventDefault();
      if (itemSel) duplicateItem(itemSel.blockId, itemSel.itemId);
      else if (selectedCustomId) duplicateBlock(selectedCustomId);
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const d = e.key === 'ArrowUp' ? -1 : 1;
      if (itemSel) moveItem(itemSel.blockId, itemSel.itemId, 0, d);
      else if (selected && places.has(selected)) {
        const pl = places.get(selected) as { containerId: string; itemId: string };
        moveItem(pl.containerId, pl.itemId, 0, d);
      } else if (selected) moveLayer(selected, d);
      return;
    }
    if (e.key === 'Delete') {
      e.preventDefault();
      if (itemSel) removeItem(itemSel.blockId, itemSel.itemId);
      else if (selectedCustomId) removeBlock(selectedCustomId);
      else return;
      setAnnounce(txf('ลบแล้ว กด {0} เพื่อย้อนกลับ', `${MOD}+Z`));
      return;
    }
    if ((e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) && selected) {
      e.preventDefault();
      openCtxForSelected();
      return;
    }
    if (e.key === 'F2' && selected) {
      e.preventDefault();
      frameRef.current?.focus();
      post({ type: 'kr-page-edit-key', key: selected });
      return;
    }
    if (isHelpKey(e)) {
      e.preventDefault();
      setShowShortcuts((v) => !v);
    }
  };

  /* ---------------- preview iframe ---------------- */
  const frameRef = useRef<HTMLIFrameElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(800);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setStageWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const post = useCallback((msg: unknown) => {
    frameRef.current?.contentWindow?.postMessage(msg, window.location.origin);
  }, []);
  const sendPreview = useCallback(() => post({ type: 'kr-page-preview', page, selected }), [post, page, selected]);
  useEffect(() => {
    sendPreview();
  }, [sendPreview]);

  /** text edited in place in the preview: `title:<blockId>` or `item:<blockId>:<itemId>:<path>` */
  const textRef = useRef<(target: string, value: string) => void>(() => undefined);
  textRef.current = (target, value) => {
    if (!canEdit) return;
    if (target === 'card:kicker' || target === 'card:promo') {
      const field = target.slice(5) as 'kicker' | 'promo';
      update((p) => ({ ...p, card: { ...p.card, [field]: value.trim() || undefined } }));
      setSelected('card');
      return;
    }
    if (target.startsWith('core:')) {
      // core:<about|racepack|schedule>:<paragraphs.N | highlights.N | items.N.field>
      const [, block, path] = target.split(':');
      if (!isCoreTextKey(block) || !path) return;
      update((p) => {
        const text = mergedCoreText(event, p.coreText);
        const [list, nStr, field] = path.split('.');
        const n = Number(nStr);
        if (block === 'about' && (list === 'paragraphs' || list === 'highlights')) {
          const rows = [...text.about[list]];
          if (!value.trim()) rows.splice(n, 1);
          else rows[n] = value;
          return { ...p, coreText: { ...p.coreText, about: { ...text.about, [list]: rows } } };
        }
        if ((block === 'racepack' || block === 'schedule') && list === 'items' && field) {
          const items = text[block].items.map((it, i) => (i === n ? { ...it, [field]: value } : it));
          return { ...p, coreText: { ...p.coreText, [block]: { items } } };
        }
        return p;
      });
      setSelected(block);
      return;
    }
    if (target.startsWith('title:')) {
      const id = target.slice(6);
      const title = value.trim().slice(0, PAGE_LIMITS.title);
      if (!title) {
        setStatus({ tone: 'err', text: tx('ชื่อหัวข้อของบล็อกต้องไม่ว่าง') });
        return;
      }
      setBlock(id, (b) => ({ ...b, title }));
      setSelected(customKey(id));
      return;
    }
    const [kind, blockId, itemId, path] = target.split(':');
    if (kind !== 'item' || !path) return;
    setBlock(blockId, (b) => ({
      ...b,
      cells: b.cells.map((c) => c.map((it) => (it.id === itemId ? applyItemText(it, path, value) : it))),
    }));
    setSelected(`item:${blockId}:${itemId}`);
  };

  /** start an in-place edit at a point of the preview (double-click on a drag layer) */
  const editAt = (e: React.MouseEvent) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || !canEdit) return;
    frameRef.current?.focus();
    post({ type: 'kr-page-edit-at', x: (e.clientX - box.left) / scale, y: (e.clientY - box.top) / scale });
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as {
        type?: string;
        key?: string;
        layout?: PreviewLayout;
        block?: string | null;
        item?: string | null;
        on?: boolean;
        target?: string;
        value?: string;
        x?: number;
        y?: number;
        shift?: boolean;
        toggle?: boolean;
      };
      if (data?.type === 'kr-page-ready') sendPreview();
      if (data?.type === 'kr-page-editing') setInlineEditing(!!data.on);
      if (data?.type === 'kr-page-text' && data.target && typeof data.value === 'string') textRef.current(data.target, data.value);
      if (data?.type === 'kr-page-edit-none') {
        setStatus({ tone: 'idle', text: tx('ส่วนนี้แก้ข้อความในตัวอย่างไม่ได้ ใช้แผงตั้งค่าด้านขวา') });
      }
      if (data?.type === 'kr-page-hover') setHover({ block: data.block ?? null, item: data.item ?? null });
      if (data?.type === 'kr-page-pick' && data.key) pickFromFrameRef.current(data.key, { shift: !!data.shift, toggle: !!data.toggle });
      if (data?.type === 'kr-page-context') ctxFromFrameRef.current(data.key ?? null, Number(data.x), Number(data.y));
      if (data?.type === 'kr-page-layout' && data.layout) setFrameLayout(data.layout);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendPreview]);

  const frameWidth = device === 'desktop' ? DESKTOP_WIDTH : PHONE_WIDTH;
  const scale = Math.min(1, (stageWidth - 32) / frameWidth);
  const previewSrc = `/events/${encodeURIComponent(event.id)}?preview=${PREVIEW_PARAM}`;

  /* ---------------- drag and drop ---------------- */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const lastScroll = useRef(0);

  const nameOf = (id: string | number): string => {
    const s = String(id);
    if (s.startsWith('tr-block:')) return nameOfKey(s.slice(9));
    if (s.startsWith('tr-item:')) return nameOf(`mv-item:${s.slice(8)}`);
    if (s.startsWith('row:block:')) return nameOfKey(s.slice(10));
    if (s.startsWith('row:col:')) return txf('คอลัมน์ {0}', Number(s.split(':')[3]) + 1);
    if (s.startsWith('row:item:')) return nameOf(`mv-item:${s.slice(9)}`);
    if (s.startsWith('pal:')) return tx(kindEntry(s.slice(4))?.label ?? '');
    if (s.startsWith('mv-block:')) return nameOfKey(s.slice(9));
    if (s.startsWith('mv-core:')) return coreItemLabel(s.split(':')[1], Number(s.split(':')[2]));
    if (s.startsWith('mv-item:')) {
      const [, blockId, itemId] = s.split(':');
      return pieceName(blockId, itemId);
    }
    if (s.startsWith('gap:')) return tx('ระหว่างบล็อก');
    if (s.startsWith('col:')) return txf('คอลัมน์ {0}', Number(s.split(':')[2]) + 1);
    return s;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => txf('หยิบ {0} แล้ว', nameOf(active.id)),
    onDragOver: ({ active, over }) =>
      /^(pal:|mv-)/.test(String(active.id)) ? undefined :
      over ? txf('{0} อยู่เหนือ {1}', nameOf(active.id), nameOf(over.id)) : txf('{0} ไม่ได้อยู่เหนือที่วาง', nameOf(active.id)),
    onDragEnd: ({ active, over }) =>
      /^(pal:|mv-)/.test(String(active.id)) ? undefined :
      over ? txf('วาง {0} ที่ {1} แล้ว', nameOf(active.id), nameOf(over.id)) : txf('ยกเลิกการวาง {0}', nameOf(active.id)),
    onDragCancel: ({ active }) => txf('ยกเลิกการย้าย {0}', nameOf(active.id)),
  };

  /** pointer (client coordinates) -> a point in the preview page */
  const toFrame = (cx: number, cy: number) => {
    const fb = boxRef.current?.getBoundingClientRect();
    return fb ? { x: (cx - fb.left) / scale, y: (cy - fb.top) / scale } : null;
  };

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const id = String(active.id);
    setDragging(id);
    // a held block / piece / list item: the preview draws a copy of it that follows the pointer
    const ev = activatorEvent as PointerEvent | null;
    const p = ev ? toFrame(ev.clientX, ev.clientY) : null;
    if (!p || !frameLayout) return;
    let target: string | null = null;
    let box: PreviewBox | undefined;
    if (id.startsWith('mv-block:')) {
      target = `block:${id.slice(9)}`;
      box = frameLayout.blocks.find((b) => b.key === id.slice(9))?.box;
    } else if (id.startsWith('mv-item:')) {
      const [, blockId, itemId] = id.split(':');
      target = `item:${blockId}:${itemId}`;
      box = frameLayout.items.find((it) => it.blockId === blockId && it.itemId === itemId)?.box;
    } else if (id.startsWith('mv-core:')) {
      const [, list, n] = id.split(':');
      target = `core:${list}:${n}`;
      box = frameLayout.coreItems.find((c) => c.list === list && c.index === Number(n))?.box;
    }
    if (target && box) post({ type: 'kr-page-drag-start', target, x: p.x, y: p.y, dx: p.x - box.left, dy: p.y - box.top });
  };

  // scroll the preview while dragging near its top or bottom edge
  const onDragMove = ({ active, activatorEvent, delta, over }: DragMoveEvent) => {
    if (String(active.id).startsWith('tr-')) {
      const hint = resolveTreeDrop(String(active.id), over, activatorEvent, delta);
      setTreeDrop((cur) => (cur?.overId === hint?.overId && cur?.pos === hint?.pos ? cur : hint));
      scrollOutline(activatorEvent, delta.y);
      return;
    }
    if (!/^(pal:|mv-)/.test(String(active.id))) return;
    const box = boxRef.current?.getBoundingClientRect();
    const startEv = activatorEvent as PointerEvent | null;
    const start = startEv?.clientY;
    if (!box || start === undefined) return;
    const y = start + delta.y;
    const next = computePreviewDrop(String(active.id), (startEv?.clientX ?? 0) + delta.x, y);
    if (String(active.id).startsWith('mv-')) {
      const p = toFrame((startEv?.clientX ?? 0) + delta.x, y);
      if (p) post({ type: 'kr-page-drag-move', x: p.x, y: p.y });
    }
    setPreviewDrop((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    const now = Date.now();
    if (now - lastScroll.current < 40) return;
    if (y > box.top && y < box.top + EDGE_SCROLL) {
      lastScroll.current = now;
      post({ type: 'kr-page-scroll', dy: -40 });
    } else if (y < box.bottom && y > box.bottom - EDGE_SCROLL) {
      lastScroll.current = now;
      post({ type: 'kr-page-scroll', dy: 40 });
    }
  };

  const onDragEnd = ({ active, over, activatorEvent, delta }: DragEndEvent) => {
    post({ type: 'kr-page-drag-end' });
    setDragging(null);
    setTreeDrop(null);
    setPreviewDrop(null);
    const a = String(active.id);
    if (a.startsWith('pal:') || a.startsWith('mv-')) {
      const startEv = activatorEvent as PointerEvent | null;
      if (!canEdit || !startEv) return;
      const target = computePreviewDrop(a, startEv.clientX + delta.x, startEv.clientY + delta.y);
      if (target) applyPreviewDrop(a, target);
      return;
    }
    if (!over || !canEdit) return;
    if (a.startsWith('tr-')) {
      const hint = resolveTreeDrop(a, over, activatorEvent, delta);
      if (hint) dropInTree(a, hint);
    }
  };

  /** scroll the outline panel while a row is dragged near its top or bottom edge */
  const scrollOutline = (activatorEvent: Event | null, deltaY: number) => {
    const panel = document.querySelector<HTMLElement>('.pe-shell .pe-left');
    const startY = (activatorEvent as PointerEvent | null)?.clientY;
    if (!panel || startY === undefined) return;
    const y = startY + deltaY;
    const r = panel.getBoundingClientRect();
    const now = Date.now();
    if (now - lastScroll.current < 30) return;
    if (y < r.top + EDGE_SCROLL) panel.scrollBy(0, -24);
    else if (y > r.bottom - EDGE_SCROLL) panel.scrollBy(0, 24);
    else return;
    lastScroll.current = now;
  };

  /* ---------------- where a preview drop lands ---------------- */
  const subjectOf = (activeId: string): DragSubject | null => {
    if (activeId === 'pal:block') return { kind: 'new-block' };
    if (activeId.startsWith('pal:')) return { kind: 'new-piece' };
    if (activeId.startsWith('mv-block:')) return { kind: 'block', key: activeId.slice(9) };
    if (activeId.startsWith('mv-item:')) {
      const [, blockId, itemId] = activeId.split(':');
      return { kind: 'piece', blockId, itemId };
    }
    return null;
  };

  /** a drop into a column at the nearest edge among its pieces (the dragged one left out) */
  function columnDrop(subject: DragSubject, blockId: string, col: number, p: { x: number; y: number }, forced?: number): PreviewDrop | null {
    const b = page.customBlocks.find((x) => x.id === blockId);
    const colBox = frameLayout?.cols.find((c) => c.blockId === blockId && c.col === col)?.box;
    if (!b || !colBox) return null;
    const skip = subject.kind === 'piece' ? subject.itemId : null;
    const boxes = b.cells[col]
      .filter((it) => it.id !== skip)
      .map((it) => frameLayout?.items.find((x) => x.blockId === blockId && x.itemId === it.id)?.box)
      .filter((x): x is PreviewBox => !!x);
    if (boxes.length === 0) return { kind: 'col', blockId, col, index: 0, box: colBox };
    const index = forced ?? nearestInsertIndex(boxes, p);
    const line = lineBetween(boxes[index - 1], boxes[index], colBox);
    return line ? { kind: 'col', blockId, col, index, line } : null;
  }

  /**
   * Where a palette / preview drag lands, from the pointer (client coordinates):
   * - near the top or bottom edge of a top-level block (escape band): between blocks
   * - over a column the dragged thing may go into (innermost first): at the nearest edge among
   *   its pieces; near the top / bottom of a nested block: before / after it in the outer column
   * - anywhere else: between the top-level blocks, at the nearest edge
   * Places the rules forbid are skipped, so no line is drawn there.
   */
  function computePreviewDrop(activeId: string, cx: number, cy: number): PreviewDrop | null {
    const fb = boxRef.current?.getBoundingClientRect();
    const fl = frameLayout;
    const subject = subjectOf(activeId);
    if (!fb || !fl) return null;
    const p = { x: (cx - fb.left) / scale, y: (cy - fb.top) / scale };
    if (activeId.startsWith('mv-core:')) return coreDrop(activeId, p);
    if (!subject) return null;
    const inside = (b: PreviewBox) => p.x >= b.left && p.x <= b.left + b.width && p.y >= b.top && p.y <= b.top + b.height;
    const inBand = (b: PreviewBox) => b.height > ESCAPE_BAND * 3 && (p.y - b.top < ESCAPE_BAND || b.top + b.height - p.y < ESCAPE_BAND);
    const keys: string[] = layoutOf(page).map((l) => l.block);
    const shown = fl.blocks.filter((b) => keys.includes(b.key));
    const host = shown.find((b) => inside(b.box));

    if (!(host && inBand(host.box))) {
      const cols = fl.cols.filter((c) => inside(c.box)).sort((a, b) => a.box.width * a.box.height - b.box.width * b.box.height);
      for (const c of cols) {
        const outer = places.get(customKey(c.blockId));
        const holder = outer ? fl.items.find((x) => x.blockId === outer.containerId && x.itemId === outer.itemId) : undefined;
        if (outer && holder && inBand(holder.box)) {
          // escape band of a nested block: before / after it in the column that holds it
          if (placementProblem(page, subject, { kind: 'column', blockId: outer.containerId, col: outer.col })) continue;
          const container = page.customBlocks.find((x) => x.id === outer.containerId);
          const skip = subject.kind === 'piece' ? subject.itemId : null;
          const order = (container?.cells[outer.col] ?? []).filter((it) => it.id !== skip).map((it) => it.id);
          const at = order.indexOf(outer.itemId);
          if (at < 0) continue;
          return columnDrop(subject, outer.containerId, outer.col, p, p.y - holder.box.top < ESCAPE_BAND ? at : at + 1);
        }
        if (placementProblem(page, subject, { kind: 'column', blockId: c.blockId, col: c.col })) continue;
        return columnDrop(subject, c.blockId, c.col, p);
      }
    }

    if (placementProblem(page, subject, { kind: 'top' })) return null;
    const list = shown.filter((b) => !(subject.kind === 'block' && b.key === subject.key));
    if (list.length === 0) return null;
    const at = nearestInsertIndex(list.map((b) => b.box), p);
    const line = lineBetween(list[at - 1]?.box, list[at]?.box, (list[at] ?? list[at - 1]).box);
    return line ? { kind: 'gap', index: at < list.length ? keys.indexOf(list[at].key) : keys.length, line } : null;
  }

  /**
   * Reorder inside a built-in list. A grid (race pack cards side by side) decides before / after
   * by the pointer's side of the nearest card; a single column (schedule) by its top / bottom half.
   */
  function coreDrop(activeId: string, p: { x: number; y: number }): PreviewDrop | null {
    const [, list, idx] = activeId.split(':');
    if (list !== 'racepack' && list !== 'schedule' && !list.startsWith('p~')) return null;
    const from = Number(idx);
    const items = (frameLayout?.coreItems ?? []).filter((c) => c.list === list).sort((a, b) => a.index - b.index);
    const others = items.filter((c) => c.index !== from);
    if (others.length === 0) return null;
    const grid = items.some((a, i) => items.some((b, j) => i !== j && Math.abs(a.box.top - b.box.top) < 4));
    let best = others[0];
    let bestDist = Infinity;
    for (const o of others) {
      const d = Math.hypot(p.x - (o.box.left + o.box.width / 2), p.y - (o.box.top + o.box.height / 2));
      if (d < bestDist) {
        bestDist = d;
        best = o;
      }
    }
    const b = best.box;
    const sideways = grid && p.y >= b.top && p.y <= b.top + b.height;
    const after = sideways ? p.x > b.left + b.width / 2 : p.y > b.top + b.height / 2;
    const index = others.indexOf(best) + (after ? 1 : 0);
    const line: PreviewBox = sideways
      ? { top: b.top, left: (after ? b.left + b.width + 6 : b.left - 6) - 1.5, width: 3, height: b.height }
      : { top: (after ? b.top + b.height + 4 : b.top - 4) - 1.5, left: b.left, width: b.width, height: 3 };
    return { kind: 'core', list, from, index, line };
  }

  function applyPreviewDrop(activeId: string, t: PreviewDrop) {
    if (t.kind === 'core') {
      if (t.index === t.from) return; // back where it was
      if (t.list.startsWith('p~')) {
        // cards / time line rows of a piece: `p~<blockId>~<itemId>`
        const [, blockId, itemId] = t.list.split('~');
        const reorder = <T,>(rows: T[] | undefined) => {
          const next = [...(rows ?? [])];
          const [moved] = next.splice(t.from, 1);
          next.splice(t.index, 0, moved);
          return next;
        };
        setBlock(blockId, (b) => ({
          ...b,
          cells: b.cells.map((c) =>
            c.map((it) =>
              it.id !== itemId ? it : it.kind === 'cards' ? { ...it, cards: reorder(it.cards) } : { ...it, timeline: reorder(it.timeline) }
            )
          ),
        }));
        setSelected(`item:${blockId}:${itemId}`);
        setAnnounce(txf('ย้ายไปลำดับที่ {0}', t.index + 1));
        return;
      }
      if (t.list !== 'racepack' && t.list !== 'schedule') return;
      const list = t.list;
      update((p) => {
        const items = [...mergedCoreText(event, p.coreText)[list].items];
        const [moved] = items.splice(t.from, 1);
        items.splice(t.index, 0, moved);
        return { ...p, coreText: { ...p.coreText, [list]: { items } } };
      });
      setSelected(list);
      setAnnounce(txf('ย้ายไปลำดับที่ {0}', t.index + 1));
      return;
    }
    if (activeId === 'pal:block') {
      const block = newBlock(1);
      if (t.kind === 'gap') {
        if (insertBlockAt(block, t.index)) setSelected(customKey(block.id));
      } else insertNestedNew(block, t.blockId, t.col, t.index);
      return;
    }
    if (activeId.startsWith('pal:')) {
      const item = newItem(activeId.slice(4) as EventPageItemKind);
      if (t.kind === 'gap') {
        const block = newBlock(1, item);
        if (insertBlockAt(block, t.index)) setSelected(`item:${block.id}:${item.id}`);
      } else if (insertItem(t.blockId, t.col, item, t.index)) setSelected(`item:${t.blockId}:${item.id}`);
      return;
    }
    if (activeId.startsWith('mv-block:')) {
      const key = activeId.slice(9);
      if (t.kind === 'gap') moveBlockTo(key, t.index);
      else nestBlock(key, t.blockId, t.col, t.index);
      return;
    }
    const [, blockId, itemId] = activeId.split(':');
    if (t.kind === 'gap') moveItemToNewBlock(blockId, itemId, t.index);
    else moveItemToColumn(blockId, itemId, t.blockId, t.col, t.index);
  }

  /**
   * Where an outline row lands: before / after the row under the pointer, or inside a column
   * (or into the middle of a free block's row, which means its first column). Places the shared
   * rules forbid give no target; a block over rows it can't nest in means "after that block".
   */
  function resolveTreeDrop(
    activeId: string,
    over: { id: string | number; rect: { top: number; height: number } } | null,
    activatorEvent: Event | null,
    delta: { x: number; y: number }
  ): OutlineDropHint | null {
    const start = activatorEvent as PointerEvent | null;
    const startY = start?.clientY;
    if (!over || startY === undefined) return null;
    const overId = String(over.id);
    const rel = (startY + delta.y - over.rect.top) / Math.max(1, over.rect.height);
    const pointerX = (start?.clientX ?? 0) + delta.x;
    const half: DropPos = rel < 0.5 ? 'before' : 'after';
    if (activeId.startsWith('tr-block:')) {
      const key = activeId.slice(9);
      if (overId.startsWith('row:block:')) return { overId, pos: half };
      const blockId = overId.split(':')[2];
      const col = overId.startsWith('row:col:') ? Number(overId.split(':')[3]) : (findItem(blockId, overId.split(':')[3])?.col ?? 0);
      // over a column or a piece of another free block: nest it there (one level deep)
      if (!placementProblem(page, { kind: 'block', key }, { kind: 'column', blockId, col })) {
        return { overId, pos: overId.startsWith('row:col:') ? 'inside' : half };
      }
      const outer = places.get(customKey(blockId))?.containerId ?? blockId;
      return { overId: `row:block:${customKey(outer)}`, pos: 'after' };
    }
    const [, fromBlock, itemId] = activeId.split(':');
    const subject: DragSubject = { kind: 'piece', blockId: fromBlock, itemId };
    const intoColumn = (blockId: string, col: number) => !placementProblem(page, subject, { kind: 'column', blockId, col });
    if (overId.startsWith('row:col:')) {
      const [, , blockId, col] = overId.split(':');
      const out = rel > 0.5 ? holderAfter(blockId) : null;
      if (out) return out;
      return intoColumn(blockId, Number(col)) ? { overId, pos: 'inside' } : null;
    }
    // the end of a nested block's content and the spot right after the nested block itself
    // look the same in the tree: the pointer's indent decides (left of the row's indent = out)
    function holderAfter(blockId: string): OutlineDropHint | null {
      const pl = places.get(customKey(blockId));
      if (!pl || !intoColumn(pl.containerId, pl.col)) return null;
      const el = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(overId)}"]`);
      if (!el) return null;
      const indent = el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft || '0');
      return pointerX < indent - 4 ? { overId: `row:item:${pl.containerId}:${pl.itemId}`, pos: 'after' } : null;
    }
    if (overId.startsWith('row:item:')) {
      const [, , blockId, overItem] = overId.split(':');
      const target = findItem(blockId, overItem);
      if (target && half === 'after' && target.index === target.block.cells[target.col].length - 1) {
        const out = holderAfter(blockId);
        if (out) return out;
      }
      return target && intoColumn(blockId, target.col) ? { overId, pos: half } : null;
    }
    if (overId.startsWith('row:block:custom:') && rel > 0.3 && rel < 0.7 && intoColumn(overId.slice(17), 0)) {
      return { overId, pos: 'inside' };
    }
    return placementProblem(page, subject, { kind: 'top' }) ? null : { overId, pos: half };
  }

  function dropInTree(activeId: string, { overId, pos }: OutlineDropHint) {
    const layout = layoutOf(page);
    if (activeId.startsWith('tr-block:')) {
      const key = activeId.slice(9);
      if (overId.startsWith('row:col:')) {
        const [, , toBlock, col] = overId.split(':');
        nestBlock(key, toBlock, Number(col));
        return;
      }
      if (overId.startsWith('row:item:')) {
        const [, , toBlock, overItem] = overId.split(':');
        const target = findItem(toBlock, overItem);
        if (!target) return;
        nestBlock(key, toBlock, target.col, target.index + (pos === 'after' ? 1 : 0));
        return;
      }
      const at = layout.findIndex((l) => l.block === overId.slice(10));
      if (at >= 0) moveBlockTo(key, at + (pos === 'after' ? 1 : 0));
      return;
    }
    const [, fromBlock, itemId] = activeId.split(':'); // tr-item:<blockId>:<itemId>
    if (overId.startsWith('row:item:')) {
      const [, , toBlock, overItem] = overId.split(':');
      const target = findItem(toBlock, overItem);
      if (!target || overItem === itemId) return;
      const others = target.block.cells[target.col].filter((it) => it.id !== itemId);
      const at = others.findIndex((it) => it.id === overItem);
      moveItemToColumn(fromBlock, itemId, toBlock, target.col, at + (pos === 'after' ? 1 : 0));
      return;
    }
    if (overId.startsWith('row:col:')) {
      const [, , toBlock, col] = overId.split(':');
      moveItemToColumn(fromBlock, itemId, toBlock, Number(col));
      return;
    }
    if (overId.startsWith('row:block:')) {
      const key = overId.slice(10);
      const blockId = customIdOf(key);
      if (pos === 'inside' && blockId) {
        moveItemToColumn(fromBlock, itemId, blockId, 0);
        return;
      }
      const at = layout.findIndex((l) => l.block === key);
      if (at >= 0) moveItemToNewBlock(fromBlock, itemId, at + (pos === 'after' ? 1 : 0));
    }
  }

  /** drag a block by its grip in the preview onto a gap (gap index = layout index it goes before) */
  function moveBlockTo(key: string, gapIndex: number) {
    const layout = layoutOf(page);
    const from = layout.findIndex((l) => l.block === key);
    if (from < 0) return;
    const to = gapIndex > from ? gapIndex - 1 : gapIndex;
    if (to === from) return;
    update((p) => ({ ...p, layout: arrayMove(layoutOf(p), from, to) }));
    setSelected(key);
    setAnnounce(txf('ย้าย {0} ไปลำดับที่ {1} จาก {2}', nameOfKey(key), to + 1, layout.length));
  }

  /** a new free block straight into a column (dropped from the palette) */
  function insertNestedNew(block: EventCustomBlock, toBlockId: string, col: number, index?: number) {
    const problem = placeProblem({ kind: 'new-block' }, { kind: 'column', blockId: toBlockId, col });
    if (problem) {
      setStatus({ tone: 'err', text: problem });
      return;
    }
    const holder: EventPageItem = { id: newPageId('it'), kind: 'nested', ref: customKey(block.id) };
    update((p) => ({
      ...p,
      customBlocks: [
        ...p.customBlocks.map((b) => {
          if (b.id !== toBlockId) return b;
          return {
            ...b,
            cells: b.cells.map((c, i) => {
              if (i !== col) return c;
              const next = [...c];
              next.splice(Math.min(index ?? next.length, next.length), 0, holder);
              return next;
            }),
          };
        }),
        block,
      ],
    }));
    setSelected(customKey(block.id));
  }

  /** drag a piece into a column (same or another free block) */
  function moveItemToColumn(fromBlock: string, itemId: string, toBlock: string, toCol: number, index?: number) {
    const found = findItem(fromBlock, itemId);
    const target = page.customBlocks.find((b) => b.id === toBlock);
    if (!found || !target || !target.cells[toCol]) return;
    const problem = placeProblem({ kind: 'piece', blockId: fromBlock, itemId }, { kind: 'column', blockId: toBlock, col: toCol });
    if (problem) {
      setStatus({ tone: 'err', text: problem });
      return;
    }
    // dropped back where it was: nothing to do (no undo step)
    if (fromBlock === toBlock && found.col === toCol && (index ?? Infinity) === found.index) return;
    update((p) => {
      const blocks = p.customBlocks.map((b) => ({ ...b, cells: b.cells.map((c) => [...c]) }));
      const src = blocks.find((b) => b.id === fromBlock);
      const dst = blocks.find((b) => b.id === toBlock);
      if (!src || !dst) return p;
      const fromIdx = src.cells[found.col].findIndex((it) => it.id === itemId);
      if (fromIdx < 0) return p;
      const [moved] = src.cells[found.col].splice(fromIdx, 1);
      const cell = dst.cells[toCol];
      cell.splice(Math.min(index ?? cell.length, cell.length), 0, moved);
      return { ...p, customBlocks: blocks };
    });
    setSelected(`item:${toBlock}:${itemId}`);
    setAnnounce(txf('ย้ายไปคอลัมน์ {0}', toCol + 1));
  }

  /** drag a piece between blocks: it becomes a new one-column free block there */
  function moveItemToNewBlock(fromBlock: string, itemId: string, gapIndex: number) {
    const found = findItem(fromBlock, itemId);
    if (!found) return;
    // a nested block dropped between blocks simply comes back to the page order
    if (found.item.kind === 'nested') {
      unNest(fromBlock, itemId, gapIndex);
      return;
    }
    if (page.customBlocks.length >= PAGE_LIMITS.customBlocks) {
      setStatus({ tone: 'err', text: txf('เพิ่มบล็อกอิสระได้ไม่เกิน {0} บล็อก', PAGE_LIMITS.customBlocks) });
      return;
    }
    const block = newBlock(1, found.item);
    update((p) => {
      const layout = layoutOf(p);
      layout.splice(Math.max(0, Math.min(gapIndex, layout.length)), 0, { block: customKey(block.id), visible: true });
      const customBlocks = p.customBlocks.map((b) =>
        b.id === fromBlock ? { ...b, cells: b.cells.map((c) => c.filter((it) => it.id !== itemId)) } : b
      );
      return { ...p, layout, customBlocks: [...customBlocks, block] };
    });
    setSelected(`item:${block.id}:${itemId}`);
    setAnnounce(tx('ย้ายชิ้นส่วนไปเป็นบล็อกใหม่แล้ว'));
  }

  /* ---------------- drop zones and toolbar over the preview ---------------- */
  const layoutKeys: string[] = layoutOf(page).map((l) => l.block);

  const paletteDrag = dragging?.startsWith('pal:') ?? false;
  const moveDrag = dragging?.startsWith('mv-') ?? false;
  const treeBlock = dragging?.startsWith('tr-block:') ? dragging.slice(9) : null;
  const draggedItem = /^(mv|tr)-item:/.test(dragging ?? '') ? itemKeyParts(`item:${(dragging as string).slice(8)}`) : null;
  const draggedPiece = draggedItem ? findItem(draggedItem.blockId, draggedItem.itemId) : null;

  // drag layers: the whole block under the mouse (and the selected one) can be held and dragged,
  // and so can every piece inside those blocks (a piece layer sits on top of its block layer)
  const gripBlocks = [...new Set([hover.block, selectedBlockKey].filter((k): k is string => !!k && layoutKeys.includes(k)))];
  const blockGrips = gripBlocks.flatMap((key) => {
    const box = frameLayout?.blocks.find((b) => b.key === key)?.box;
    return box ? [{ key, box }] : [];
  });
  const itemGrips = gripBlocks.flatMap((key) => {
    const blockId = customIdOf(key);
    if (!blockId) return [];
    // pieces of this block, then (on top) the pieces of free blocks nested in it
    const ids = new Set([blockId]);
    for (const [ref, pl] of places) if (pl.containerId === blockId && customIdOf(ref)) ids.add(customIdOf(ref) as string);
    return (frameLayout?.items ?? []).flatMap((it) => {
      if (!ids.has(it.blockId)) return [];
      const found = findItem(it.blockId, it.itemId);
      return found
        ? [{ key: `item:${it.blockId}:${it.itemId}`, parts: { blockId: it.blockId, itemId: it.itemId }, kind: found.item.kind, box: it.box }]
        : [];
    });
  });
  // items of the built-in race pack / schedule lists inside those blocks (also when nested)
  const coreText = mergedCoreText(event, page.coreText);
  const coreGrips = (frameLayout?.coreItems ?? []).filter((c) => {
    const key = c.list.startsWith('p~') ? customKey(c.list.split('~')[1]) : c.list;
    if (gripBlocks.includes(key)) return true;
    const pl = places.get(key);
    return !!pl && gripBlocks.includes(customKey(pl.containerId));
  });
  const coreItemLabel = (list: string, index: number) => {
    if (list.startsWith('p~')) {
      const [, blockId, itemId] = list.split('~');
      const it = findItem(blockId, itemId)?.item;
      return (it?.kind === 'cards' ? it.cards?.[index]?.title : it?.timeline?.[index]?.title) ?? '';
    }
    return list === 'racepack' ? (coreText.racepack.items[index]?.title ?? '') : (coreText.schedule.items[index]?.title ?? '');
  };

  // card icons inside those blocks: a click opens the icon picker there
  const iconSpots = (frameLayout?.icons ?? []).flatMap((ic) => {
    const [, blockId, itemId, path] = ic.target.split(':');
    const n = Number(path?.split('.')[1]);
    const key = customKey(blockId);
    const pl = places.get(key);
    if (!gripBlocks.includes(key) && !(pl && gripBlocks.includes(customKey(pl.containerId)))) return [];
    const card = findItem(blockId, itemId)?.item.cards?.[n];
    return card ? [{ ...ic, blockId, itemId, n, card }] : [];
  });
  const iconOpen = iconPick ? (frameLayout?.icons ?? []).find((ic) => ic.target === iconPick) : undefined;
  const iconOpenParts = iconPick ? iconPick.split(':') : [];
  const iconOpenN = Number(iconOpenParts[3]?.split('.')[1]);
  const iconOpenCard = iconPick ? findItem(iconOpenParts[1], iconOpenParts[2])?.item.cards?.[iconOpenN] : undefined;
  const pickCardIcon = (patch: { icon?: string; iconImage?: string }) => {
    if (!iconPick) return;
    const [, blockId, itemId] = iconPick.split(':');
    setBlock(blockId, (b) => ({
      ...b,
      cells: b.cells.map((c) =>
        c.map((it) =>
          it.id === itemId && it.kind === 'cards'
            ? { ...it, cards: (it.cards ?? []).map((x, j) => (j === iconOpenN ? withCardIcon(x, patch) : x)) }
            : it
        )
      ),
    }));
    setSelected(`item:${blockId}:${itemId}`);
    setIconPick(null);
    setAnnounce(tx('เปลี่ยนไอคอนแล้ว'));
  };

  /* ---------------- several selected at once (Shift / Ctrl+click) ---------------- */
  /** blocks of the page in order (top level only) */
  const topKeys = layoutOf(page).map((l) => l.block as string);
  /** every piece in reading order (nested free blocks' pieces right after the nested block) */
  const itemOrder = (() => {
    const out: string[] = [];
    const walk = (blockId: string, depth: number) => {
      const b = page.customBlocks.find((x) => x.id === blockId);
      if (!b || depth > 2) return;
      b.cells.forEach((c) =>
        c.forEach((it) => {
          out.push(`item:${blockId}:${it.id}`);
          const inner = it.kind === 'nested' && it.ref ? customIdOf(it.ref) : null;
          if (inner) walk(inner, depth + 1);
        })
      );
    };
    topKeys.forEach((k) => {
      const cid = customIdOf(k);
      if (cid) walk(cid, 0);
    });
    return out;
  })();
  /** a selection group: top-level blocks, or pieces (anything else is picked alone) */
  const groupOf = (key: string | null): 'block' | 'item' | null =>
    !key ? null : key.startsWith('item:') ? (itemOrder.includes(key) ? 'item' : null) : topKeys.includes(key) ? 'block' : null;
  const multiSel = multi.filter((k) => (k.startsWith('item:') ? itemOrder.includes(k) : topKeys.includes(k)));
  const multiOn = multiSel.length > 1;
  const multiKind = multiOn ? groupOf(multiSel[0]) : null;
  // a plain pick elsewhere ends the group
  useEffect(() => {
    if (multi.length > 0 && (!selected || !multi.includes(selected))) setMulti([]);
  }, [selected, multi]);

  /** click with Shift (range from the last pick) or Ctrl/⌘ (add / remove one) */
  const pickWith = (key: string, mods?: { shift: boolean; toggle: boolean }) => {
    const g = groupOf(key);
    if (g && mods?.toggle) {
      const base = multiOn ? multiSel : selected && groupOf(selected) === g ? [selected] : [];
      if (base.length > 0 && groupOf(base[0]) !== g) {
        setMulti([]);
        setSelected(key);
        return;
      }
      const has = base.includes(key);
      const next = has ? base.filter((k) => k !== key) : [...base, key];
      if (next.length <= 1) {
        setMulti([]);
        setSelected(next[0] ?? null);
      } else {
        setSelected(has ? next[next.length - 1] : key);
        setMulti(next);
      }
      setAnnounce(txf('เลือกไว้ {0} รายการ', Math.max(1, next.length)));
      return;
    }
    if (g && mods?.shift && selected && groupOf(selected) === g) {
      const order = g === 'block' ? topKeys : itemOrder;
      const a = order.indexOf(selected);
      const b = order.indexOf(key);
      if (a >= 0 && b >= 0) {
        const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        // the first pick stays the anchor, so the next Shift+click measures from it again
        setMulti(range.length > 1 ? range : []);
        setAnnounce(txf('เลือกไว้ {0} รายการ', range.length));
        return;
      }
    }
    setMulti([]);
    setSelected(key);
  };
  const clearMulti = () => setMulti([]);
  pickFromFrameRef.current = (key, mods) => pickWith(key, mods);

  const removeMany = () => {
    const keys = [...multiSel];
    inBatch(() => {
      if (multiKind === 'block') {
        keys.forEach((k) => {
          const cid = customIdOf(k);
          if (cid) removeBlock(cid);
        });
      } else {
        // last first, so the earlier ones keep their places
        [...keys].reverse().forEach((k) => {
          const p = itemKeyParts(k);
          if (p) removeItem(p.blockId, p.itemId);
        });
      }
    });
    setMulti([]);
    setSelected(null);
    setAnnounce(txf('ลบ {0} รายการแล้ว กด {1} เพื่อย้อนกลับ', keys.length, `${MOD}+Z`));
  };
  const duplicateMany = () => {
    const keys = [...multiSel];
    inBatch(() => {
      [...keys].reverse().forEach((k) => {
        if (multiKind === 'block') {
          const cid = customIdOf(k);
          if (cid) duplicateBlock(cid);
        } else {
          const p = itemKeyParts(k);
          if (p) duplicateItem(p.blockId, p.itemId);
        }
      });
    });
    setMulti([]);
    setAnnounce(txf('ทำสำเนา {0} รายการแล้ว', keys.length));
  };
  /** hide them all (or show them all when every one is hidden already) */
  const setManyVisible = (show: boolean) => {
    const keys = new Set(multiSel);
    update((p) => ({ ...p, layout: layoutOf(p).map((l) => (keys.has(l.block) ? { ...l, visible: show } : l)) }));
    setAnnounce(show ? txf('แสดง {0} บล็อก', keys.size) : txf('ซ่อน {0} บล็อก', keys.size));
  };
  const manyHidden = multiKind === 'block' && multiSel.every((k) => layoutOf(page).find((l) => l.block === k)?.visible === false);
  /** move the selected blocks one step together (they keep their order) */
  const moveMany = (d: -1 | 1) => {
    if (multiKind !== 'block') return;
    const keys = new Set(multiSel);
    update((p) => {
      const layout = [...layoutOf(p)];
      const order = d < 0 ? layout.map((_, i) => i) : layout.map((_, i) => layout.length - 1 - i);
      for (const i of order) {
        const j = i + d;
        if (!keys.has(layout[i].block) || j < 0 || j >= layout.length || keys.has(layout[j].block)) continue;
        [layout[i], layout[j]] = [layout[j], layout[i]];
      }
      return { ...p, layout };
    });
  };
  const manyAtTop = multiKind === 'block' && topKeys.slice(0, multiSel.length).every((k) => multiSel.includes(k));
  const manyAtBottom = multiKind === 'block' && topKeys.slice(-multiSel.length).every((k) => multiSel.includes(k));
  const multiEntries = (): MenuEntry[] => [
    ...(multiKind === 'block'
      ? ([
          { label: tx('ย้ายขึ้นทั้งหมด'), icon: 'arrow-up', shortcut: `${ALT}+↑`, disabled: manyAtTop, run: () => moveMany(-1) },
          { label: tx('ย้ายลงทั้งหมด'), icon: 'arrow-down', shortcut: `${ALT}+↓`, disabled: manyAtBottom, run: () => moveMany(1) },
          {
            label: manyHidden ? tx('แสดงบนหน้าจริงทั้งหมด') : tx('ซ่อนบนหน้าจริงทั้งหมด'),
            icon: manyHidden ? 'eye' : 'eye-slash',
            run: () => setManyVisible(manyHidden),
          },
        ] as MenuEntry[])
      : []),
    { label: tx('ทำสำเนาทั้งหมด'), icon: 'clone', shortcut: `${MOD}+D`, run: duplicateMany },
    { label: tx('เลิกเลือก'), icon: 'xmark', shortcut: 'Esc', run: clearMulti },
    { kind: 'sep' },
    { label: tx('ลบทั้งหมด'), icon: 'trash-can', shortcut: 'Delete', danger: true, run: removeMany },
  ];

  /* ---------------- right-click menu ---------------- */
  /** open the menu for a target at a point of the preview box (px), after selecting it */
  const openCtx = (target: CtxTarget, x: number, y: number, at: { x: number; y: number } | null) => {
    if (!canEdit || dragging || inlineEditing) return;
    setIconPick(null);
    const tKey = target.kind === 'block' ? target.key : target.kind === 'item' ? `item:${target.blockId}:${target.itemId}` : null;
    if (multiOn && tKey && multiSel.includes(tKey)) {
      setCtxMenu({ target: { kind: 'multi' }, x, y, at });
      return;
    }
    if (target.kind === 'block') setSelected(target.key);
    else if (target.kind === 'item') setSelected(`item:${target.blockId}:${target.itemId}`);
    else if (target.kind === 'card') setSelected('card');
    else if (target.kind === 'multi') return;
    else if (target.list.startsWith('p~')) {
      const [, blockId, itemId] = target.list.split('~');
      setSelected(`item:${blockId}:${itemId}`);
    } else setSelected(target.list);
    setCtxMenu({ target, x, y, at });
  };
  /** right-click on a layer drawn over the preview */
  const ctxAt = (target: CtxTarget) => (e: React.MouseEvent) => {
    e.preventDefault();
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = e.clientX - box.left;
    const y = e.clientY - box.top;
    openCtx(target, x, y, { x: x / scale, y: y / scale });
  };
  /** right-click that reached the page itself (where no layer is drawn) */
  ctxFromFrameRef.current = (key, x, y) => {
    if (!key || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const at = { x, y };
    if (key === 'card') openCtx({ kind: 'card' }, x * scale, y * scale, at);
    else if (key.startsWith('item:')) {
      const [, blockId, itemId] = key.split(':');
      openCtx({ kind: 'item', blockId, itemId }, x * scale, y * scale, at);
    } else openCtx({ kind: 'block', key }, x * scale, y * scale, at);
  };
  /** Shift+F10 / the menu key: the menu of the selected thing, at its top-left corner */
  const openCtxForSelected = () => {
    if (!selected || !frameLayout) return;
    const parts = itemKeyParts(selected);
    const box = parts
      ? frameLayout.items.find((i) => i.blockId === parts.blockId && i.itemId === parts.itemId)?.box
      : frameLayout.blocks.find((b) => b.key === selected)?.box;
    const x = box ? Math.max(4, (box.left + 12) * scale) : 16;
    const y = box ? Math.max(4, (box.top + 12) * scale) : 16;
    if (selected === 'card') openCtx({ kind: 'card' }, x, y, null);
    else if (parts) openCtx({ kind: 'item', blockId: parts.blockId, itemId: parts.itemId }, x, y, null);
    else if (box) openCtx({ kind: 'block', key: selected }, x, y, null);
  };

  /** "edit text": at the clicked point, or the first text of the target from the keyboard */
  const ctxEditText = (target: CtxTarget, at: { x: number; y: number } | null) => {
    frameRef.current?.focus();
    if (target.kind === 'multi') return;
    if (at) {
      post({ type: 'kr-page-edit-at', x: at.x, y: at.y });
      return;
    }
    if (target.kind === 'core') {
      const b = frameLayout?.coreItems.find((c) => c.list === target.list && c.index === target.index)?.box;
      if (b) post({ type: 'kr-page-edit-at', x: b.left + Math.min(40, b.width / 2), y: b.top + Math.min(24, b.height / 2) });
      return;
    }
    const key =
      target.kind === 'card' ? 'card' : target.kind === 'item' ? `item:${target.blockId}:${target.itemId}` : target.key;
    post({ type: 'kr-page-edit-key', key });
  };
  /** show the right pane's settings of what is selected (focus its first control) */
  const focusInspector = () =>
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('.pe-inspector input, .pe-inspector select, .pe-inspector textarea, .pe-inspector button')?.focus()
    );

  const ctxEntries = (target: CtxTarget, at: { x: number; y: number } | null): { title: string; items: MenuEntry[] } => {
    const sep: MenuEntry = { kind: 'sep' };
    if (target.kind === 'multi') {
      return {
        title: multiKind === 'block' ? txf('เลือกไว้ {0} บล็อก', multiSel.length) : txf('เลือกไว้ {0} ชิ้นส่วน', multiSel.length),
        items: multiOn ? multiEntries() : [],
      };
    }
    const edit = (disabled = false): MenuEntry => ({
      label: tx('แก้ข้อความ'),
      icon: 'i-cursor',
      shortcut: 'F2',
      disabled,
      run: () => ctxEditText(target, at),
    });
    if (target.kind === 'card') {
      return {
        title: tx('การ์ดสมัคร'),
        items: [edit(), { label: tx('ตั้งค่าการ์ดสมัคร'), icon: 'sliders', run: focusInspector }],
      };
    }
    if (target.kind === 'block') {
      const key = target.key;
      const cid = customIdOf(key);
      const pl = places.get(key);
      const layout = layoutOf(page);
      const at0 = layout.findIndex((l) => l.block === key);
      const holder = pl ? findItem(pl.containerId, pl.itemId) : null;
      const first = pl ? !holder || holder.index === 0 : at0 <= 0;
      const last = pl ? !holder || holder.index >= holder.block.cells[holder.col].length - 1 : at0 < 0 || at0 >= layout.length - 1;
      const step = (d: -1 | 1) => (pl ? moveItem(pl.containerId, pl.itemId, 0, d) : moveLayer(key, d));
      const visible = layout[at0]?.visible !== false;
      return {
        title: nameOfKey(key),
        items: [
          edit(!cid),
          { label: tx('ตั้งค่าบล็อก'), icon: 'sliders', run: focusInspector },
          sep,
          { label: tx('ย้ายขึ้น'), icon: 'arrow-up', shortcut: `${ALT}+↑`, disabled: first, run: () => step(-1) },
          { label: tx('ย้ายลง'), icon: 'arrow-down', shortcut: `${ALT}+↓`, disabled: last, run: () => step(1) },
          { label: tx('ทำสำเนา'), icon: 'clone', shortcut: `${MOD}+D`, disabled: !cid, run: () => cid && duplicateBlock(cid) },
          ...(pl
            ? [{ label: tx('เลือกบล็อกที่ครอบอยู่'), icon: 'turn-up', run: () => setSelected(customKey(pl.containerId)) } as MenuEntry]
            : [
                {
                  label: visible ? tx('ซ่อนบนหน้าจริง') : tx('แสดงบนหน้าจริง'),
                  icon: visible ? 'eye-slash' : 'eye',
                  run: () => toggleVisible(key),
                } as MenuEntry,
              ]),
          sep,
          { label: tx('ลบบล็อก'), icon: 'trash-can', shortcut: 'Delete', danger: true, disabled: !cid, run: () => cid && removeBlock(cid) },
        ],
      };
    }
    if (target.kind === 'item') {
      const found = findItem(target.blockId, target.itemId);
      if (!found) return { title: '', items: [] };
      const { block: b, col, index, item: it } = found;
      const len = b.cells[col].length;
      return {
        title: pieceName(target.blockId, target.itemId),
        items: [
          edit(!INLINE_TEXT_KINDS.has(it.kind)),
          { label: tx('ตั้งค่าชิ้นส่วน'), icon: 'sliders', run: focusInspector },
          sep,
          { label: tx('ย้ายขึ้น'), icon: 'arrow-up', shortcut: `${ALT}+↑`, disabled: index === 0, run: () => moveItem(target.blockId, target.itemId, 0, -1) },
          { label: tx('ย้ายลง'), icon: 'arrow-down', shortcut: `${ALT}+↓`, disabled: index >= len - 1, run: () => moveItem(target.blockId, target.itemId, 0, 1) },
          ...(b.columns > 1
            ? ([
                { label: tx('ย้ายไปคอลัมน์ซ้าย'), icon: 'arrow-left', disabled: col === 0, run: () => moveItem(target.blockId, target.itemId, -1, 0) },
                { label: tx('ย้ายไปคอลัมน์ขวา'), icon: 'arrow-right', disabled: col >= b.columns - 1, run: () => moveItem(target.blockId, target.itemId, 1, 0) },
              ] as MenuEntry[])
            : []),
          { label: tx('ทำสำเนา'), icon: 'clone', shortcut: `${MOD}+D`, run: () => duplicateItem(target.blockId, target.itemId) },
          { label: tx('เลือกบล็อกที่ครอบอยู่'), icon: 'turn-up', run: () => setSelected(customKey(target.blockId)) },
          sep,
          { label: tx('ลบชิ้นส่วน'), icon: 'trash-can', shortcut: 'Delete', danger: true, run: () => removeItem(target.blockId, target.itemId) },
        ],
      };
    }
    // a card / time line row of a piece, or a row of an old built-in list
    const { list, index } = target;
    const label = coreItemLabel(list, index);
    const reorder = (d: -1 | 1) => applyPreviewDrop(`mv-core:${list}:${index}`, { kind: 'core', list, from: index, index: index + d });
    if (!list.startsWith('p~')) {
      const n = (list === 'racepack' ? coreText.racepack.items : coreText.schedule.items).length;
      return {
        title: label,
        items: [
          edit(),
          sep,
          { label: tx('ย้ายไปก่อนหน้า'), icon: 'arrow-up', disabled: index === 0, run: () => reorder(-1) },
          { label: tx('ย้ายไปถัดไป'), icon: 'arrow-down', disabled: index >= n - 1, run: () => reorder(1) },
        ],
      };
    }
    const [, blockId, itemId] = list.split('~');
    const it = findItem(blockId, itemId)?.item;
    const isCards = it?.kind === 'cards';
    const rows = (isCards ? it?.cards : it?.timeline) ?? [];
    const max = isCards ? CORE_TEXT_LIMITS.racepackItems : CORE_TEXT_LIMITS.scheduleItems;
    const word = isCards ? tx('การ์ด') : tx('แถว');
    const setRows = (fn: <T>(r: T[]) => T[]) =>
      setBlock(blockId, (b) => ({
        ...b,
        cells: b.cells.map((c) =>
          c.map((x) =>
            x.id !== itemId ? x : x.kind === 'cards' ? { ...x, cards: fn(x.cards ?? []) } : { ...x, timeline: fn(x.timeline ?? []) }
          )
        ),
      }));
    return {
      title: label || word,
      items: [
        edit(),
        ...(isCards
          ? [
              {
                label: tx('เปลี่ยนไอคอน'),
                icon: 'icons',
                run: () => {
                  const t = `item:${blockId}:${itemId}:cards.${index}`;
                  iconOpenerTarget.current = t;
                  setIconPick(t);
                },
              } as MenuEntry,
            ]
          : []),
        { label: tx('ตั้งค่าชิ้นส่วน'), icon: 'sliders', run: focusInspector },
        sep,
        { label: tx('ย้ายไปก่อนหน้า'), icon: 'arrow-up', disabled: index === 0, run: () => reorder(-1) },
        { label: tx('ย้ายไปถัดไป'), icon: 'arrow-down', disabled: index >= rows.length - 1, run: () => reorder(1) },
        {
          label: txf('แทรก{0}ถัดไป', word),
          icon: 'plus',
          disabled: rows.length >= max,
          run: () =>
            setRows((r) => {
              const next = [...r];
              next.splice(index + 1, 0, (isCards ? { title: '', detail: '', scope: '' } : { timeLabel: '', title: '', detail: '' }) as never);
              return next;
            }),
        },
        {
          label: tx('ทำสำเนา'),
          icon: 'clone',
          disabled: rows.length >= max,
          run: () =>
            setRows((r) => {
              const next = [...r];
              next.splice(index + 1, 0, { ...(r[index] as object) } as never);
              return next;
            }),
        },
        sep,
        {
          label: txf('ลบ{0}นี้', word),
          icon: 'trash-can',
          danger: true,
          run: () => {
            setRows((r) => r.filter((_, j) => j !== index));
            setAnnounce(txf('ลบแล้ว กด {0} เพื่อย้อนกลับ', `${MOD}+Z`));
          },
        },
      ],
    };
  };
  const ctxOpen = ctxMenu ? ctxEntries(ctxMenu.target, ctxMenu.at) : null;

  /** the wheel over a drag layer still scrolls the preview underneath */
  const scrollPreview = (e: React.WheelEvent) => post({ type: 'kr-page-scroll', dy: e.deltaY });
  const toolbarBox = selectedBlockKey ? frameLayout?.blocks.find((b) => b.key === selectedBlockKey)?.box : undefined;
  const toolbarLocked = selectedBlockKey ? isCoreBlock(selectedBlockKey) && coreBlockDef(selectedBlockKey).locked : false;
  const scaled = (b: PreviewBox): React.CSSProperties => ({
    top: b.top * scale,
    left: b.left * scale,
    width: b.width * scale,
    height: b.height * scale,
  });

  const versions = event.detailPageVersions ?? [];
  const lastVersion = versions[versions.length - 1];
  const q = query.trim().toLowerCase();
  const palette = PALETTE.filter((p) => !q || tx(p.label).toLowerCase().includes(q) || p.label.includes(q) || p.keywords.includes(q));

  /* ---------------- render ---------------- */
  // rendered into <body>: the dashboard wrapper animates with a transform, which would
  // otherwise pin this full-screen layer to the wrapper instead of the screen
  return createPortal(
    <div className="pe-shell" role="dialog" aria-modal="true" aria-labelledby="pe-title">
      <header className="pe-bar">
        <button type="button" className="btn-ghost-sm" onClick={onClose}>
          <FaIcon name="arrow-left" />
          <span>{tx('กลับแดชบอร์ด')}</span>
        </button>
        <div className="pe-bar-title">
          <h1 id="pe-title">{tx('หน้ารายละเอียดงาน')}</h1>
          <span className="pe-bar-event">{event.titleTh}</span>
        </div>
        <span className={`pe-status is-${status.tone} ${dirty ? 'is-dirty' : ''}`} role="status" aria-live="polite">
          {status.tone === 'err' && <FaIcon name="triangle-exclamation" />}
          {status.tone === 'ok' && <FaIcon name="circle-check" />}
          {dirty && status.tone !== 'saving' && status.tone !== 'err' ? tx('มีการแก้ไขที่ยังไม่บันทึก') : status.text}
        </span>
        <div className="pe-bar-actions">
          {canEdit && (
            <>
              <button type="button" className="pe-icon-btn" onClick={undo} disabled={past.length === 0} aria-label={txf('ย้อนกลับ ({0})', `${MOD}+Z`)} title={txf('ย้อนกลับ ({0})', `${MOD}+Z`)}>
                <FaIcon name="arrow-rotate-left" />
              </button>
              <button type="button" className="pe-icon-btn" onClick={redo} disabled={future.length === 0} aria-label={txf('ทำซ้ำ ({0})', `${MOD}+Shift+Z`)} title={txf('ทำซ้ำ ({0})', `${MOD}+Shift+Z`)}>
                <FaIcon name="arrow-rotate-right" />
              </button>
            </>
          )}
          <div className="pe-pop-wrap">
            <button type="button" className="pe-icon-btn" onClick={() => setShowShortcuts((v) => !v)} aria-expanded={showShortcuts} aria-label={tx('คีย์ลัด (?)')} title={tx('คีย์ลัด (?)')}>
              <FaIcon name="keyboard" />
            </button>
            {showShortcuts && (
              <div className="pe-pop pe-keys" role="dialog" aria-label={tx('คีย์ลัด')}>
                <strong>{tx('คีย์ลัด')}</strong>
                <dl>
                  {SHORTCUTS.map((k) => (
                    <div key={k.keys}>
                      <dt>
                        <kbd>{k.keys}</kbd>
                      </dt>
                      <dd>{tx(k.label)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="muted-inline">{tx('คีย์ลัดไม่ทำงานระหว่างพิมพ์ในช่องกรอก ยกเว้นบันทึกและเผยแพร่')}</p>
              </div>
            )}
          </div>
          <div className="pe-seg" role="group" aria-label={tx('ขนาดตัวอย่าง')}>
            <button type="button" aria-pressed={device === 'desktop'} className={device === 'desktop' ? 'is-on' : ''} onClick={() => setDevice('desktop')} title={`Ctrl+${ALT}+D`}>
              <FaIcon name="desktop" />
              <span>{tx('เดสก์ท็อป')}</span>
            </button>
            <button type="button" aria-pressed={device === 'phone'} className={device === 'phone' ? 'is-on' : ''} onClick={() => setDevice('phone')} title={`Ctrl+${ALT}+M`}>
              <FaIcon name="mobile-screen" />
              <span>{tx('มือถือ')}</span>
            </button>
          </div>
          {canEdit && (
            <>
              <div className="pe-pop-wrap">
                <button type="button" className="btn-secondary" onClick={() => setShowVersions((v) => !v)} aria-expanded={showVersions} title={tx('ประวัติการเผยแพร่')}>
                  <FaIcon name="clock-rotate-left" />
                  <span>{lastVersion ? txf('ฉบับที่ {0}', lastVersion.version) : tx('ยังไม่เคยเผยแพร่')}</span>
                </button>
                {showVersions && (
                  <div className="pe-pop" role="dialog" aria-label={tx('ประวัติการเผยแพร่')}>
                    <strong>{tx('ประวัติการเผยแพร่')}</strong>
                    {versions.length === 0 && <p className="muted-inline">{tx('ยังไม่มีฉบับที่เผยแพร่')}</p>}
                    <ul>
                      {[...versions].reverse().map((v) => (
                        <li key={v.version}>
                          <span>
                            {txf('ฉบับที่ {0}', v.version)}
                            <span className="muted-inline">
                              {' · '}
                              {new Date(v.publishedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} · {v.publishedBy}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => {
                              update(() =>
                                convertToFreeBlocks(
                                  { layout: v.layout, customBlocks: v.customBlocks, ...(v.coreText ? { coreText: v.coreText } : {}), ...(v.card ? { card: v.card } : {}), ...(v.v ? { v: v.v } : {}) },
                                  event
                                )
                              );
                              setShowVersions(false);
                            }}
                          >
                            {tx('นำมาแก้ต่อ')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="pe-pop-wrap">
                <button type="button" className="btn-primary" onClick={() => void confirmPublish()} disabled={!check.ok || status.tone === 'saving'} title={`${MOD}+Enter`}>
                  <FaIcon name="cloud-arrow-up" />
                  <span>{tx('เผยแพร่')}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {!canEdit && (
        <p className="pe-readonly" role="note">
          <FaIcon name="lock" />
          <span>{tx('ดูได้อย่างเดียว เฉพาะเจ้าขององค์กรหรือผู้จัดการงานแก้หน้านี้ได้')}</span>
        </p>
      )}
      <p className="pe-narrow" role="note">
        <FaIcon name="triangle-exclamation" />
        <span>{tx('ตัวแก้ไขใช้บนจอกว้าง 1280px ขึ้นไป บนจอนี้ดูตัวอย่างได้อย่างเดียว')}</span>
      </p>

      <DndContext
        sensors={sensors}
        autoScroll={false}
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragOver={({ active, over, activatorEvent, delta }) => {
          // the row under the pointer changed: redraw the outline drop mark right away
          if (!String(active.id).startsWith('tr-')) return;
          setTreeDrop(resolveTreeDrop(String(active.id), over, activatorEvent, delta));
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          post({ type: 'kr-page-drag-end' });
          setDragging(null);
          setTreeDrop(null);
          setPreviewDrop(null);
        }}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: tx('ลากด้วยเมาส์ หรือกดลูกศรขึ้น/ลงเพื่อย้าย') },
        }}
      >
        <p className="sr-only" aria-live="polite">
          {announce}
        </p>
        <div className={`pe-body ${canEdit ? '' : 'is-readonly'}`}>
          {canEdit && (
            <aside className="pe-left" aria-label={tx('คลังชิ้นส่วนและโครงหน้า')}>
              <div className="pe-left-tabs" role="tablist" aria-label={tx('คลังชิ้นส่วนและโครงหน้า')}>
                <button
                  type="button"
                  role="tab"
                  id="pe-tab-add-btn"
                  aria-selected={leftTab === 'add'}
                  aria-controls="pe-tab-add"
                  tabIndex={leftTab === 'add' ? 0 : -1}
                  className={leftTab === 'add' ? 'is-on' : ''}
                  onClick={() => setLeftTab('add')}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      setLeftTab('outline');
                      document.getElementById('pe-tab-outline-btn')?.focus();
                    }
                  }}
                >
                  <FaIcon name="plus" />
                  <span>{tx('เพิ่ม')}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="pe-tab-outline-btn"
                  aria-selected={leftTab === 'outline'}
                  aria-controls="pe-tab-outline"
                  tabIndex={leftTab === 'outline' ? 0 : -1}
                  className={leftTab === 'outline' ? 'is-on' : ''}
                  onClick={() => setLeftTab('outline')}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      setLeftTab('add');
                      document.getElementById('pe-tab-add-btn')?.focus();
                    }
                  }}
                >
                  <FaIcon name="list-ul" />
                  <span>{tx('โครงหน้า')}</span>
                  <span className="pe-tab-count">{entries.length}</span>
                </button>
              </div>

              {leftTab === 'add' && (
                <section className="pe-panel" role="tabpanel" id="pe-tab-add" aria-labelledby="pe-tab-add-btn">
                  <p className="pe-hint">{tx('ลากไปวางบนตัวอย่างหน้า หรือกดเพื่อเพิ่มต่อจากสิ่งที่เลือก')}</p>
                  <div className="pe-search">
                    <FaIcon name="magnifying-glass" />
                    <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tx('ค้นหาชิ้นส่วน')} aria-label={tx('ค้นหาชิ้นส่วน')} />
                  </div>
                  {PALETTE_GROUPS.map((g) => {
                    const list = palette.filter((p) => p.group === g.id);
                    if (list.length === 0) return null;
                    return (
                      <div key={g.id} className="pe-pal-group">
                        <span className="pe-label">{tx(g.label)}</span>
                        <div className="pe-palette">
                          {list.map((p) => (
                            <PaletteChip
                              key={p.id}
                              entry={p}
                              onAdd={() => addFromPalette(p.id)}
                              note={
                                p.id.startsWith('data:') && !dataPieceHasContent(event, newItem(p.id as Exclude<PaletteEntry['id'], 'block'>))
                                  ? tx('ยังไม่มีข้อมูล')
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {palette.length === 0 && <p className="pe-hint">{tx('ไม่พบชิ้นส่วนที่ค้นหา')}</p>}
                </section>
              )}

              {leftTab === 'outline' && (
                <section className="pe-panel pe-outline" role="tabpanel" id="pe-tab-outline" aria-labelledby="pe-tab-outline-btn">
                  <p className="pe-hint">{tx('กดค้างแล้วลากเพื่อสลับตำแหน่ง ลูกศรซ้าย/ขวาเพื่อพับหรือขยาย')}</p>
                  <button
                    type="button"
                    className={`pe-tree-pinned ${selected === 'card' ? 'is-selected' : ''}`}
                    aria-pressed={selected === 'card'}
                    onClick={() => setSelected('card')}
                  >
                    <FaIcon name="id-card" />
                    <span>{tx('การ์ดสมัคร (ด้านขวาของหน้า)')}</span>
                    <FaIcon name="thumbtack" className="pe-tree-pin" />
                  </button>
                  <PageOutline
                    blocks={entries.map((e) => ({
                      key: e.item.block,
                      label: e.resolved.label,
                      visible: e.item.visible,
                      locked: e.resolved.locked,
                      custom: e.resolved.custom,
                    }))}
                    resolveRef={(ref) => {
                      const r = resolveBlockKey(page, ref);
                      return r ? { label: r.label, icon: blockIcon(ref), locked: r.locked, custom: r.custom } : null;
                    }}
                    containerOf={(key) => places.get(key)?.containerId ?? null}
                    hiddenOnPublic={hiddenOnPublic}
                    selected={selected}
                    dropHint={treeDrop}
                    dragging={dragging}
                    multi={multiOn ? multiSel : undefined}
                    onSelect={(key, mods) => pickWith(key, mods)}
                    onToggleVisible={toggleVisible}
                    onDuplicate={(key) => {
                      const parts = itemKeyParts(key);
                      if (parts) duplicateItem(parts.blockId, parts.itemId);
                      else if (customIdOf(key)) duplicateBlock(customIdOf(key) as string);
                    }}
                    onRemove={(key) => {
                      const parts = itemKeyParts(key);
                      if (parts) removeItem(parts.blockId, parts.itemId);
                      else if (customIdOf(key)) removeBlock(customIdOf(key) as string);
                      setAnnounce(txf('ลบแล้ว กด {0} เพื่อย้อนกลับ', `${MOD}+Z`));
                    }}
                  />
                </section>
              )}
            </aside>
          )}

          <main className="pe-stage" ref={stageRef} aria-label={tx('ตัวอย่างหน้า')}>
            <div ref={boxRef} className="pe-frame-box" style={{ width: frameWidth * scale, height: 'calc(100% - 1rem)' }}>
              <iframe
                ref={frameRef}
                title={tx('ตัวอย่างหน้ารายละเอียดงาน')}
                src={previewSrc}
                className="pe-frame"
                style={{ width: frameWidth, height: `${100 / scale}%`, transform: `scale(${scale})` }}
                onLoad={sendPreview}
              />

              {/* while a palette item is dragged: keep the pointer out of the iframe, show the drop spots */}
              {(paletteDrag || moveDrag) && <div className={`pe-shield ${moveDrag ? 'is-move' : ''}`} aria-hidden="true" />}
              <div className="pe-overlay">
                {/* columns the dragged thing may go into (outlined), and the exact landing spot */}
                {(paletteDrag || moveDrag) &&
                  (frameLayout?.cols ?? [])
                    .filter((c) => {
                      const subject = dragging ? subjectOf(dragging) : null;
                      return !!subject && !placementProblem(page, subject, { kind: 'column', blockId: c.blockId, col: c.col });
                    })
                    .map((c) => (
                      <div
                        key={`${c.blockId}:${c.col}`}
                        className={`pe-colzone ${previewDrop?.kind === 'col' && previewDrop.blockId === c.blockId && previewDrop.col === c.col ? 'is-over' : ''}`}
                        style={scaled(c.box)}
                        aria-hidden="true"
                      />
                    ))}
                {previewDrop?.line && <div className="pe-drop-line" style={scaled(previewDrop.line)} aria-hidden="true" />}
                {canEdit &&
                  blockGrips.map((g) => (
                    <DragLayer
                      key={`b:${g.key}`}
                      id={`mv-block:${g.key}`}
                      hidden={!!dragging || inlineEditing}
                      icon="grip-vertical"
                      label={
                        customIdOf(g.key)
                          ? `${txf('ลากเพื่อย้าย {0}', nameOfKey(g.key))} · ${tx('ดับเบิลคลิกที่ข้อความเพื่อแก้')}`
                          : txf('ลากเพื่อย้าย {0}', nameOfKey(g.key))
                      }
                      style={scaled(g.box)}
                      onClick={(e) => pickWith(g.key, { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey })}
                      onDoubleClick={editAt}
                      onContextMenu={ctxAt({ kind: 'block', key: g.key })}
                      onWheel={scrollPreview}
                    />
                  ))}
                {canEdit &&
                  coreGrips.map((g) => (
                    <DragLayer
                      key={`c:${g.list}:${g.index}`}
                      id={`mv-core:${g.list}:${g.index}`}
                      hidden={!!dragging || inlineEditing}
                      piece
                      icon="up-down-left-right"
                      label={`${txf('ลากเพื่อสลับลำดับ {0}', coreItemLabel(g.list, g.index))} · ${tx('ดับเบิลคลิกที่ข้อความเพื่อแก้')}`}
                      style={scaled(g.box)}
                      onClick={() => setSelected(g.list)}
                      onDoubleClick={editAt}
                      onContextMenu={ctxAt({ kind: 'core', list: g.list, index: g.index })}
                      onWheel={scrollPreview}
                    />
                  ))}
                {canEdit &&
                  itemGrips.map((g) => (
                    <DragLayer
                      key={`i:${g.key}`}
                      id={`mv-item:${g.parts.blockId}:${g.parts.itemId}`}
                      hidden={!!dragging || inlineEditing}
                      piece
                      icon="up-down-left-right"
                      label={
                        INLINE_TEXT_KINDS.has(g.kind)
                          ? `${txf('ลากเพื่อย้าย{0}', pieceName(g.parts.blockId, g.parts.itemId))} · ${tx('ดับเบิลคลิกที่ข้อความเพื่อแก้')}`
                          : txf('ลากเพื่อย้าย {0}', pieceName(g.parts.blockId, g.parts.itemId))
                      }
                      style={scaled(g.box)}
                      onClick={(e) => pickWith(g.key, { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey })}
                      onDoubleClick={editAt}
                      onContextMenu={ctxAt({ kind: 'item', blockId: g.parts.blockId, itemId: g.parts.itemId })}
                      onWheel={scrollPreview}
                    />
                  ))}
                {canEdit &&
                  !dragging &&
                  !inlineEditing &&
                  iconSpots.map((s) => (
                    <button
                      key={`ic:${s.target}`}
                      type="button"
                      className={`pe-icon-spot${iconPick === s.target ? ' is-open' : ''}`}
                      data-target={s.target}
                      // at least 28 px on screen, centred on the icon
                      style={(() => {
                        const size = Math.max(s.box.width + 8, s.box.height + 8, 28 / scale);
                        return scaled({
                          top: s.box.top + s.box.height / 2 - size / 2,
                          left: s.box.left + s.box.width / 2 - size / 2,
                          width: size,
                          height: size,
                        });
                      })()}
                      aria-label={txf('เปลี่ยนไอคอนของการ์ด {0}', s.card.title || s.n + 1)}
                      aria-haspopup="dialog"
                      aria-expanded={iconPick === s.target}
                      title={tx('คลิกเพื่อเปลี่ยนไอคอน')}
                      onContextMenu={ctxAt({ kind: 'core', list: `p~${s.blockId}~${s.itemId}`, index: s.n })}
                      onClick={() => {
                        iconOpenerTarget.current = s.target;
                        setIconPick(iconPick === s.target ? null : s.target);
                      }}
                      onWheel={scrollPreview}
                    />
                  ))}
                {canEdit && !dragging && iconPick && iconOpen && iconOpenCard && (
                  <div
                    ref={iconPopRef}
                    className="pe-icon-pop"
                    role="dialog"
                    aria-label={txf('เปลี่ยนไอคอนของการ์ด {0}', iconOpenCard.title || iconOpenN + 1)}
                    style={{
                      top: (iconOpen.box.top + iconOpen.box.height) * scale + 8,
                      left: Math.max(4, Math.min(iconOpen.box.left * scale - 8, frameWidth * scale - 300)),
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setIconPick(null);
                      }
                    }}
                  >
                    <div className="pe-icon-pop-head">
                      <strong>{tx('ไอคอนการ์ด')}</strong>
                      <button type="button" className="pe-icon-btn" aria-label={tx('ปิด')} onClick={() => setIconPick(null)}>
                        <FaIcon name="xmark" />
                      </button>
                    </div>
                    <CardIconPicker
                      index={iconOpenN}
                      icon={iconOpenCard.icon}
                      iconImage={iconOpenCard.iconImage}
                      autoFocus
                      onPick={pickCardIcon}
                      onError={(text) => setStatus({ tone: 'err', text })}
                    />
                  </div>
                )}
                {multiOn &&
                  !dragging &&
                  multiSel.map((k) => {
                    const p = itemKeyParts(k);
                    const box = p
                      ? frameLayout?.items.find((i) => i.blockId === p.blockId && i.itemId === p.itemId)?.box
                      : frameLayout?.blocks.find((b) => b.key === k)?.box;
                    return box ? <div key={`ms:${k}`} className="pe-multi-box" style={scaled(box)} aria-hidden="true" /> : null;
                  })}
                {ctxMenu && ctxOpen && ctxOpen.items.length > 0 && (
                  <PreviewContextMenu
                    key={`${ctxMenu.x}:${ctxMenu.y}`}
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    bounds={{ width: frameWidth * scale, height: boxRef.current?.clientHeight ?? 600 }}
                    title={ctxOpen.title}
                    items={ctxOpen.items}
                    onClose={(refocus) => {
                      setCtxMenu(null);
                      if (refocus) frameRef.current?.closest<HTMLElement>('.pe-stage')?.focus();
                    }}
                  />
                )}
                {canEdit && !dragging && toolbarBox && selectedBlockKey && (
                  <div
                    className="pe-float"
                    style={{ top: Math.max(4, toolbarBox.top * scale - 40), left: Math.max(4, (toolbarBox.left + toolbarBox.width) * scale) }}
                    role="toolbar"
                    aria-label={txf('เครื่องมือของ {0}', nameOfKey(selectedBlockKey))}
                  >
                    <span className="pe-float-name">
                      <FaIcon name={blockIcon(selectedBlockKey)} />
                      {nameOfKey(selectedBlockKey)}
                    </span>
                    <MoveButton
                      icon="arrow-up"
                      label={tx('ย้ายขึ้น')}
                      shortcut={`${ALT}+↑`}
                      at={layoutKeys.indexOf(selectedBlockKey)}
                      count={layoutKeys.length}
                      step={-1}
                      onMove={() => moveLayer(selectedBlockKey, -1)}
                    />
                    <MoveButton
                      icon="arrow-down"
                      label={tx('ย้ายลง')}
                      shortcut={`${ALT}+↓`}
                      at={layoutKeys.indexOf(selectedBlockKey)}
                      count={layoutKeys.length}
                      step={1}
                      onMove={() => moveLayer(selectedBlockKey, 1)}
                    />
                    {selectedCustomId && (
                      <button type="button" className="pe-icon-btn" onClick={() => duplicateBlock(selectedCustomId)} aria-label={tx('ทำสำเนา')} title={`${tx('ทำสำเนา')} (${MOD}+D)`}>
                        <FaIcon name="clone" />
                      </button>
                    )}
                    {!toolbarLocked && (
                      <button type="button" className="pe-icon-btn" onClick={() => toggleVisible(selectedBlockKey)} aria-label={tx('ซ่อนบล็อกนี้')} title={tx('ซ่อนบล็อกนี้')}>
                        <FaIcon name="eye-slash" />
                      </button>
                    )}
                    {selectedCustomId && (
                      <button type="button" className="pe-icon-btn is-danger" onClick={() => removeBlock(selectedCustomId)} aria-label={tx('ลบบล็อก')} title={`${tx('ลบบล็อก')} (Delete)`}>
                        <FaIcon name="trash-can" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>

          {canEdit && (
            <aside className="pe-right" aria-label={tx('ตั้งค่าสิ่งที่เลือก')}>
              {multiOn && (
                <div className="pe-panel pe-inspector pe-multi-panel">
                  <h2>
                    <FaIcon name="layer-group" />
                    {multiKind === 'block' ? txf('เลือกไว้ {0} บล็อก', multiSel.length) : txf('เลือกไว้ {0} ชิ้นส่วน', multiSel.length)}
                  </h2>
                  <ul className="pe-multi-list">
                    {multiSel.map((k) => {
                      const p = itemKeyParts(k);
                      return (
                        <li key={k}>
                          <FaIcon name={p ? (kindEntry(findItem(p.blockId, p.itemId)?.item ?? { kind: 'text' })?.icon ?? 'square') : blockIcon(k)} />
                          <span>{p ? pieceName(p.blockId, p.itemId) : nameOfKey(k)}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="pe-multi-actions">
                    {multiEntries()
                      .filter((m): m is Exclude<MenuEntry, { kind: 'sep' }> => m.kind !== 'sep')
                      .map((m) => (
                        <button
                          key={m.label}
                          type="button"
                          className={`btn-ghost-sm${m.danger ? ' is-danger' : ''}`}
                          aria-disabled={m.disabled || undefined}
                          onClick={() => !m.disabled && m.run()}
                        >
                          <FaIcon name={m.icon} />
                          <span>{m.label}</span>
                          {m.shortcut && <kbd className="pe-ctx-key">{m.shortcut}</kbd>}
                        </button>
                      ))}
                  </div>
                  <p className="pe-hint">{tx('Shift+คลิก = เลือกเป็นช่วง · Ctrl/⌘+คลิก = เพิ่มหรือถอดทีละรายการ')}</p>
                </div>
              )}
              {selected === 'card' && (
                <CardInspector
                  card={page.card ?? {}}
                  totalQuotaOn={event.totalEventQuotaEnabled !== false}
                  onChange={(card) => update((p) => ({ ...p, card }))}
                  onOpenSection={openSection}
                />
              )}
              {!selectedBlockKey && (
                <div className="pe-panel pe-empty">
                  <h2>{tx('ตั้งค่า')}</h2>
                  <p>{tx('คลิกบล็อกหรือชิ้นส่วนในตัวอย่างหน้าเพื่อแก้ไข')}</p>
                  <p>{tx('ดับเบิลคลิกที่ข้อความในบล็อกอิสระเพื่อพิมพ์แก้ในตัวอย่างหน้าได้เลย (Enter = เสร็จ, Esc = ยกเลิก)')}</p>
                  <p>{tx('ลากชิ้นส่วนจากคลังด้านซ้ายไปวางระหว่างบล็อก หรือในคอลัมน์ของบล็อกอิสระ')}</p>
                </div>
              )}
              {selectedNested && (
                <section className="pe-panel pe-nested-head" aria-label={tx('บล็อกที่ซ้อนอยู่')}>
                  <button type="button" className="btn-ghost-sm pe-back" onClick={() => setSelected(customKey(selectedNested.containerId))}>
                    <FaIcon name="arrow-left" />
                    <span>{txf('ซ้อนอยู่ใน: {0}', blockLabel(customKey(selectedNested.containerId)))}</span>
                  </button>
                  <p className="pe-hint">
                    {txf('{0} อยู่ในคอลัมน์ {1} ของบล็อกนี้ ลากในตัวอย่างหน้าหรือโครงหน้าเพื่อย้าย', blockLabel(selectedNested.ref), selectedNested.col + 1)}
                  </p>
                  <div className="pe-move-buttons">
                    <button type="button" className="btn-secondary" onClick={() => unNest(selectedNested.containerId, selectedNested.itemId, afterContainer(selectedNested.containerId))}>
                      <FaIcon name="arrow-turn-up" />
                      <span>{tx('ย้ายออกมาชั้นบน')}</span>
                    </button>
                  </div>
                </section>
              )}
              {selectedNested && isCoreBlock(selectedNested.ref) && (
                <CoreInspector
                  blockId={selectedNested.ref}
                  visible
                  onToggle={() => toggleVisible(selectedNested.ref)}
                  {...coreTextProps(selectedNested.ref)}
                  onOpenSection={openSection}
                  hiddenOnPublic={selectedNested.ref === 'merch' && event.products.length === 0}
                />
              )}
              {selectedNested && selectedItem?.item.kind === 'nested' && customIdOf(selectedNested.ref) && (() => {
                const inner = page.customBlocks.find((b) => b.id === customIdOf(selectedNested.ref));
                return inner ? (
                  <BlockInspector
                    block={inner}
                    visible
                    onTitle={(title) => setBlock(inner.id, (b) => ({ ...b, title }))}
                    onColumns={(n) => setColumns(inner, n)}
                    onSelectItem={(itemId) => setSelected(`item:${inner.id}:${itemId}`)}
                    onToggle={() => toggleVisible(customKey(inner.id))}
                    onDuplicate={() => duplicateBlock(inner.id)}
                    onRemove={() => removeBlock(inner.id)}
                    modLabel={MOD}
                  />
                ) : null;
              })()}
              {selectedItem && itemSel && selectedItem.item.kind !== 'nested' && (
                <ItemInspector
                  item={selectedItem.item}
                  block={selectedItem.block}
                  col={selectedItem.col}
                  index={selectedItem.index}
                  onChange={(patch) => setItem(itemSel.blockId, itemSel.itemId, patch)}
                  onMove={(dCol, dIdx) => moveItem(itemSel.blockId, itemSel.itemId, dCol, dIdx)}
                  onDuplicate={() => duplicateItem(itemSel.blockId, itemSel.itemId)}
                  onRemove={() => removeItem(itemSel.blockId, itemSel.itemId)}
                  onBack={() => setSelected(customKey(itemSel.blockId))}
                  onError={(text) => setStatus({ tone: 'err', text })}
                  event={event}
                  onOpenSection={openSection}
                />
              )}
              {!itemSel && selected && isCoreBlock(selected) && (
                <CoreInspector
                  blockId={selected}
                  visible={entries.find((e) => e.item.block === selected)?.item.visible ?? true}
                  onToggle={() => toggleVisible(selected)}
                  {...coreTextProps(selected)}
                  onOpenSection={openSection}
                  hiddenOnPublic={selected === 'merch' && event.products.length === 0}
                />
              )}
              {!itemSel && selectedBlock && (
                <BlockInspector
                  block={selectedBlock}
                  visible={entries.find((e) => e.item.block === customKey(selectedBlock.id))?.item.visible ?? true}
                  onTitle={(title) => setBlock(selectedBlock.id, (b) => ({ ...b, title }))}
                  onColumns={(n) => setColumns(selectedBlock, n)}
                  onSelectItem={(itemId) => setSelected(`item:${selectedBlock.id}:${itemId}`)}
                  onToggle={() => toggleVisible(customKey(selectedBlock.id))}
                  onDuplicate={() => duplicateBlock(selectedBlock.id)}
                  onRemove={() => removeBlock(selectedBlock.id)}
                  modLabel={MOD}
                />
              )}
            </aside>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {paletteDrag ? <PaletteGhost entry={PALETTE.find((p) => `pal:${p.id}` === dragging)} /> : null}
          {treeBlock ? (
            <div className="pe-chip is-ghost">
              <FaIcon name={blockIcon(treeBlock)} />
              <span>{nameOfKey(treeBlock)}</span>
            </div>
          ) : null}
          {draggedPiece && !dragging?.startsWith('mv-') && draggedPiece.item.kind !== 'nested' ? <PaletteGhost entry={kindEntry(draggedPiece.item)} /> : null}
          {draggedPiece?.item.kind === 'nested' && draggedPiece.item.ref && !dragging?.startsWith('mv-') ? (
            <div className="pe-chip is-ghost">
              <FaIcon name={blockIcon(draggedPiece.item.ref)} />
              <span>{blockLabel(draggedPiece.item.ref)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>,
    document.body
  );
}

/**
 * Move up / down button that stays focusable at the ends (aria-disabled, not disabled) and
 * tells screen readers where the block is now and where it would go.
 */
function MoveButton({
  icon,
  label,
  shortcut,
  at,
  count,
  step,
  onMove,
}: {
  icon: string;
  label: string;
  shortcut: string;
  at: number;
  count: number;
  step: -1 | 1;
  onMove: () => void;
}) {
  const id = React.useId();
  const blocked = at < 0 || at + step < 0 || at + step >= count;
  const describe = blocked
    ? txf(step < 0 ? 'ลำดับที่ {0} จาก {1} อยู่บนสุดแล้ว' : 'ลำดับที่ {0} จาก {1} อยู่ล่างสุดแล้ว', at + 1, count)
    : txf('ลำดับที่ {0} จาก {1} กดเพื่อย้ายไปลำดับที่ {2}', at + 1, count, at + 1 + step);
  return (
    <>
      <button
        type="button"
        className="pe-icon-btn"
        aria-disabled={blocked || undefined}
        aria-label={label}
        aria-describedby={id}
        title={`${label} (${shortcut})`}
        onClick={() => {
          if (!blocked) onMove();
        }}
      >
        <FaIcon name={icon} />
      </button>
      <span id={id} className="sr-only">
        {describe}
      </span>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Left pane                                                           */
/* ------------------------------------------------------------------ */

function PaletteChip({ entry, onAdd, note }: { entry: PaletteEntry; onAdd: () => void; note?: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal:${entry.id}` });
  // so screen readers are not told to "press Space to pick up": Enter / Space add it
  const { 'aria-describedby': _hint, 'aria-roledescription': _role, ...buttonAttrs } = attributes;
  void _hint;
  void _role;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`pe-chip ${isDragging ? 'is-source' : ''}`}
      onClick={onAdd}
      {...listeners}
      {...buttonAttrs}
      role={undefined}
      aria-label={txf('เพิ่ม{0} (หรือลากไปวางบนตัวอย่างหน้า)', tx(entry.label)) + (note ? ` · ${note}` : '')}
      title={note}
    >
      <FaIcon name={entry.icon} />
      <span>{tx(entry.label)}</span>
      {note && <em className="pe-chip-note">{note}</em>}
    </button>
  );
}

function PaletteGhost({ entry }: { entry?: PaletteEntry }) {
  if (!entry) return null;
  return (
    <div className="pe-chip is-ghost">
      <FaIcon name={entry.icon} />
      <span>{tx(entry.label)}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drop zones over the preview                                         */
/* ------------------------------------------------------------------ */


/**
 * Transparent layer over a block or piece in the preview: press anywhere on it and drag to
 * move it (a plain click selects it). The iframe cannot start a drag in this window, so the
 * layer sits on top of it. Mouse / touch only: keyboard users move things with Alt+arrows or
 * the toolbar, so the layer stays out of the tab order. It stays mounted (just invisible)
 * while its drag runs so dnd-kit keeps the drag alive.
 */
function DragLayer({
  id,
  icon,
  label,
  style,
  hidden,
  piece,
  onClick,
  onWheel,
  onDoubleClick,
  onContextMenu,
}: {
  id: string;
  icon: string;
  label: string;
  style: React.CSSProperties;
  hidden: boolean;
  piece?: boolean;
  onClick: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { listeners, setNodeRef } = useDraggable({ id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      tabIndex={-1}
      className={`pe-drag-layer ${piece ? 'is-piece' : ''} ${hidden ? 'is-hidden' : ''}`}
      style={style}
      title={label}
      aria-label={label}
      onClick={onClick}
      onWheel={onWheel}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...listeners}
    >
      <span className="pe-drag-hint" aria-hidden="true">
        <FaIcon name={icon} />
      </span>
    </button>
  );
}

