import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EditorLock,
  EventCoreText,
  EventCustomBlock,
  EventDetailBlockId,
  EventDetailLayoutItem,
  EventDetailPage,
  EventPageItem,
  RaceEvent,
} from '../../types';
import {
  DEFAULT_EVENT_DETAIL_LAYOUT,
  EVENT_DETAIL_BLOCKS,
  PAGE_LIMITS,
  coreBlockDef,
  customIdOf,
  customKey,
  isCoreBlock,
  layoutEntries,
  newPageId,
  pageOf,
} from '../../data/eventDetailLayout';
import { coreTextOf, mergedCoreText } from '../../data/eventDataPieces';
import { isTotalQuotaEnabled } from '../../utils/eventConfig';
import { tx, txf } from '../../i18n';
import { FaIcon } from '../FaIcon';
import { PREVIEW_PARAM } from '../pagePreview';
import {
  BLOCK_ICON,
  BlockInspector,
  CardInspector,
  CoreInspector,
  ItemInspector,
  PALETTE,
  PALETTE_GROUPS,
  isCoreTextKey,
  kindEntry,
  newItem,
  type CoreTextKey,
  type PaletteEntry,
} from '../PageItemEditors';

/**
 * The event page part of the combined editor "หน้างานและฟอร์มสมัคร" (27 Nov 2026, phase 4c):
 * the organizer arranges the page freely (user decision), with Canva-like locks on blocks.
 * Centre: the real public page in an iframe, fed the unsaved page (click to select, double-click
 * to edit text in place). Right: settings of what is selected, and what can be added.
 *
 * Controlled by the shell (EventStudio), which keeps the page as a draft on the server.
 * The page is always a freely arranged page (v 3): built-in blocks may be moved, hidden or removed.
 */

/** the page runners see now, as a freely arranged page (the template's order when never arranged) */
export function livePage(ev: RaceEvent): EventDetailPage {
  const base: EventDetailPage =
    ev.detailPageV === 3
      ? pageOf(ev)
      : { layout: DEFAULT_EVENT_DETAIL_LAYOUT.map((l) => ({ ...l })), customBlocks: [], ...(ev.detailRegisterCard ? { card: ev.detailRegisterCard } : {}) };
  return { ...base, coreText: coreTextOf(ev), v: 3 };
}
/** the page the editor starts from: the saved draft, else the live page */
export function pageStart(ev: RaceEvent): EventDetailPage {
  if (ev.detailPageDraft && ev.detailPageDraft.v === 3) {
    const { updatedAt: _a, updatedBy: _b, ...page } = ev.detailPageDraft;
    return { ...page, coreText: mergedCoreText(ev, page.coreText), v: 3 };
  }
  return livePage(ev);
}

/** what is selected: a layout key (built-in id or custom:<id>), `item:<blockId>:<itemId>`, or 'card' */
export type PageSel = string | null;
const itemParts = (key: PageSel) => {
  if (!key?.startsWith('item:')) return null;
  const [, blockId, itemId] = key.split(':');
  return { blockId, itemId };
};
/** the layout key a selection belongs to */
export const blockKeyOf = (key: PageSel): string | null => {
  const it = itemParts(key);
  return it ? customKey(it.blockId) : key && key !== 'card' ? key : null;
};

const PREVIEW_WIDTH = { desktop: 1280, phone: 390 } as const;

/** put text edited in the preview into a piece (same paths as the earlier page editor) */
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
    const rows = [...((field === 'cards' ? it.cards : it.timeline) ?? [])] as Record<string, string>[];
    const n = Number(a);
    if (!rows[n] || !b) return it;
    rows[n] = { ...rows[n], [b]: value.slice(0, b === 'detail' ? 400 : 160) };
    return field === 'cards' ? { ...it, cards: rows as unknown as EventPageItem['cards'] } : { ...it, timeline: rows as unknown as EventPageItem['timeline'] };
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

export function StudioPageEditor({
  event,
  canEdit,
  layoutLocked,
  value,
  onChange,
  selected,
  onSelect,
  onStatus,
  onOpenSection,
  panelTab,
  onPanelTab,
}: {
  event: RaceEvent;
  canEdit: boolean;
  /** "lock the layout": nothing may be moved, added or removed (text still editable) */
  layoutLocked: boolean;
  value: EventDetailPage;
  onChange: (next: EventDetailPage) => void;
  selected: PageSel;
  onSelect: (key: PageSel) => void;
  onStatus: (s: { tone: 'idle' | 'err' | 'warn' | 'ok'; text: string }) => void;
  onOpenSection: (section: string) => void;
  panelTab: 'set' | 'add';
  onPanelTab: (t: 'set' | 'add') => void;
}) {
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const page = value;
  const entryOf = (key: string) => page.layout.find((l) => l.block === key);
  const lockOf = (key: string | null): EditorLock | undefined => (key ? entryOf(key)?.lock : undefined);
  const editable = (key: string | null) => canEdit && lockOf(key) !== 'all';
  const coreText = mergedCoreText(event, page.coreText);

  /* ---------------- changes ---------------- */
  const setLayout = (fn: (l: EventDetailLayoutItem[]) => EventDetailLayoutItem[]) => onChange({ ...page, layout: fn(page.layout) });
  const setBlock = (id: string, fn: (b: EventCustomBlock) => EventCustomBlock) =>
    onChange({ ...page, customBlocks: page.customBlocks.map((b) => (b.id === id ? fn(b) : b)) });
  const patchEntry = (key: string, patch: Partial<EventDetailLayoutItem>) => setLayout((l) => l.map((x) => (x.block === key ? { ...x, ...patch } : x)));
  const setCoreText = (key: CoreTextKey, next: Required<EventCoreText>[CoreTextKey]) =>
    onChange({ ...page, coreText: { ...coreText, ...page.coreText, [key]: next } });
  const guardMove = (key: string) => {
    if (!canEdit) return false;
    if (layoutLocked) {
      onStatus({ tone: 'err', text: tx('ล็อกโครงหน้าอยู่ ปลดล็อกก่อนจึงย้าย เพิ่ม หรือลบได้') });
      return false;
    }
    if (lockOf(key)) {
      onStatus({ tone: 'err', text: tx('บล็อกนี้ล็อกอยู่ ปลดล็อกก่อนจึงย้ายหรือลบได้') });
      return false;
    }
    return true;
  };
  const removeBlock = (key: string) => {
    if (!guardMove(key)) return;
    const cid = customIdOf(key);
    onChange({
      ...page,
      layout: page.layout.filter((l) => l.block !== key),
      customBlocks: cid ? page.customBlocks.filter((b) => b.id !== cid) : page.customBlocks,
    });
    onSelect(null);
    onStatus({ tone: 'idle', text: tx('ลบบล็อกแล้ว ย้อนกลับได้ด้วยปุ่มย้อนกลับ') });
  };
  const duplicateBlock = (key: string) => {
    const cid = customIdOf(key);
    const b = cid && page.customBlocks.find((x) => x.id === cid);
    if (!b || !canEdit || layoutLocked) return;
    if (page.customBlocks.length >= PAGE_LIMITS.customBlocks) {
      onStatus({ tone: 'err', text: txf('เพิ่มบล็อกอิสระได้ไม่เกิน {0} บล็อก', PAGE_LIMITS.customBlocks) });
      return;
    }
    const copy: EventCustomBlock = { ...b, id: newPageId('blk'), cells: b.cells.map((c) => c.map((it) => ({ ...it, id: newPageId('it') }))) };
    const at = page.layout.findIndex((l) => l.block === key) + 1;
    onChange({ ...page, customBlocks: [...page.customBlocks, copy], layout: [...page.layout.slice(0, at), { block: customKey(copy.id), visible: true }, ...page.layout.slice(at)] });
    onSelect(customKey(copy.id));
  };
  /** a new free block after the selected block (or at the end) */
  const addBlock = (columns: 1 | 2 | 3, first?: EventPageItem) => {
    if (!canEdit) return;
    if (layoutLocked) return onStatus({ tone: 'err', text: tx('ล็อกโครงหน้าอยู่ ปลดล็อกก่อนจึงเพิ่มได้') });
    if (page.customBlocks.length >= PAGE_LIMITS.customBlocks) {
      return onStatus({ tone: 'err', text: txf('เพิ่มบล็อกอิสระได้ไม่เกิน {0} บล็อก', PAGE_LIMITS.customBlocks) });
    }
    const b: EventCustomBlock = { id: newPageId('blk'), title: tx('หัวข้อใหม่'), columns, cells: Array.from({ length: columns }, (_, i) => (i === 0 && first ? [first] : [])) };
    const sel = blockKeyOf(selected);
    const at = sel ? page.layout.findIndex((l) => l.block === sel) + 1 : page.layout.length;
    onChange({ ...page, customBlocks: [...page.customBlocks, b], layout: [...page.layout.slice(0, at), { block: customKey(b.id), visible: true }, ...page.layout.slice(at)] });
    onSelect(first ? `item:${b.id}:${first.id}` : customKey(b.id));
    onPanelTab('set');
  };
  /** a piece into the selected free block (first column, at the end), else in a new block */
  const addPiece = (entry: PaletteEntry) => {
    if (entry.id === 'block') return addBlock(1);
    const it = newItem(entry.id as Exclude<PaletteEntry['id'], 'block'>);
    const key = blockKeyOf(selected);
    const cid = key ? customIdOf(key) : null;
    const target = cid ? page.customBlocks.find((b) => b.id === cid) : undefined;
    if (!target || !editable(key)) return addBlock(1, it);
    if (target.cells[0].length >= PAGE_LIMITS.itemsPerColumn) {
      return onStatus({ tone: 'err', text: txf('แต่ละคอลัมน์ใส่ได้ไม่เกิน {0} ชิ้น', PAGE_LIMITS.itemsPerColumn) });
    }
    setBlock(target.id, (b) => ({ ...b, cells: b.cells.map((c, i) => (i === 0 ? [...c, it] : c)) }));
    onSelect(`item:${target.id}:${it.id}`);
    onPanelTab('set');
  };
  /** a built-in block that was removed, back after the selected block */
  const addCore = (id: EventDetailBlockId) => {
    if (!canEdit || layoutLocked) return;
    const sel = blockKeyOf(selected);
    const at = sel ? page.layout.findIndex((l) => l.block === sel) + 1 : page.layout.length;
    onChange({ ...page, layout: [...page.layout.slice(0, at), { block: id, visible: true }, ...page.layout.slice(at)] });
    onSelect(id);
    onPanelTab('set');
  };
  const missingCore = EVENT_DETAIL_BLOCKS.filter((d) => !page.layout.some((l) => l.block === d.id));

  /* ---------------- the preview ---------------- */
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'kr-page-preview', page, selected, readOnly: !canEdit }, window.location.origin);
  }, [page, selected, canEdit]);
  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

  /** text edited in place in the preview */
  const textRef = useRef<(target: string, value: string) => void>(() => undefined);
  textRef.current = (target, val) => {
    if (!canEdit) return;
    if (target === 'card:kicker' || target === 'card:promo') {
      const field = target.slice(5) as 'kicker' | 'promo';
      onChange({ ...page, card: { ...page.card, [field]: val.trim() || undefined } });
      onSelect('card');
      return;
    }
    if (target.startsWith('core:')) {
      const [, block, path] = target.split(':');
      if (!isCoreTextKey(block) || !path) return;
      if (!editable(block)) return onStatus({ tone: 'err', text: tx('บล็อกนี้ล็อกทั้งหมดอยู่ ปลดล็อกก่อนจึงแก้ได้') });
      const [list, nStr, field] = path.split('.');
      const n = Number(nStr);
      if (block === 'about' && (list === 'paragraphs' || list === 'highlights')) {
        const rows = [...coreText.about[list]];
        if (!val.trim()) rows.splice(n, 1);
        else rows[n] = val;
        setCoreText('about', { ...coreText.about, [list]: rows });
      } else if ((block === 'racepack' || block === 'schedule') && list === 'items' && field) {
        const items = coreText[block].items.map((it, i) => (i === n ? { ...it, [field]: val } : it));
        setCoreText(block, { items } as Required<EventCoreText>[typeof block]);
      }
      onSelect(block);
      return;
    }
    if (target.startsWith('title:')) {
      const id = target.slice(6);
      if (!editable(customKey(id))) return onStatus({ tone: 'err', text: tx('บล็อกนี้ล็อกทั้งหมดอยู่ ปลดล็อกก่อนจึงแก้ได้') });
      const title = val.trim().slice(0, PAGE_LIMITS.title);
      if (!title) return onStatus({ tone: 'err', text: tx('ชื่อหัวข้อของบล็อกต้องไม่ว่าง') });
      setBlock(id, (b) => ({ ...b, title }));
      onSelect(customKey(id));
      return;
    }
    const [kind, blockId, itemId, path] = target.split(':');
    if (kind !== 'item' || !path) return;
    if (!editable(customKey(blockId))) return onStatus({ tone: 'err', text: tx('บล็อกนี้ล็อกทั้งหมดอยู่ ปลดล็อกก่อนจึงแก้ได้') });
    setBlock(blockId, (b) => ({ ...b, cells: b.cells.map((c) => c.map((it) => (it.id === itemId ? applyItemText(it, path, val) : it))) }));
    onSelect(`item:${blockId}:${itemId}`);
  };
  const pickRef = useRef(onSelect);
  pickRef.current = onSelect;
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; key?: string; target?: string; value?: string };
      if (data?.type === 'kr-page-ready') {
        setReady(true);
        send();
      }
      if (data?.type === 'kr-page-pick' && data.key) {
        pickRef.current(data.key);
        onPanelTab('set');
      }
      if (data?.type === 'kr-page-text' && data.target && typeof data.value === 'string') textRef.current(data.target, data.value);
      if (data?.type === 'kr-page-edit-none') onStatus({ tone: 'idle', text: tx('ส่วนนี้แก้ข้อความในตัวอย่างไม่ได้ ใช้แผงตั้งค่าด้านขวา') });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [send, onPanelTab, onStatus]);
  const width = PREVIEW_WIDTH[device];
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / width) : 1;

  /* ---------------- the right panel ---------------- */
  const key = selected;
  const item = itemParts(key);
  const selBlock = item ? page.customBlocks.find((b) => b.id === item.blockId) : key && customIdOf(key) ? page.customBlocks.find((b) => b.id === customIdOf(key)) : undefined;
  const bKey = blockKeyOf(key);
  const entry = bKey ? entryOf(bKey) : undefined;
  const lockSeg = bKey && entry && (
    <div className="st-panel-sec">
      <div className="st-field">
        <span>{tx('ล็อกบล็อกนี้')}</span>
        <span className="st-seg" role="group" aria-label={tx('ล็อก')}>
          {(
            [
              ['none', 'lock-open', 'ไม่ล็อก'],
              ['position', 'thumbtack', 'ล็อกตำแหน่ง'],
              ['all', 'lock', 'ล็อกทั้งหมด'],
            ] as const
          ).map(([v, icon, label]) => (
            <button key={v} type="button" aria-pressed={(entry.lock ?? 'none') === v} disabled={!canEdit} onClick={() => patchEntry(bKey, { lock: v === 'none' ? undefined : v })}>
              <FaIcon name={icon} />
              <span>{tx(label)}</span>
            </button>
          ))}
        </span>
        <small className="fe-hint">
          {tx(entry.lock === 'position' ? 'แก้ข้อความได้ แต่ย้ายหรือลบไม่ได้' : entry.lock === 'all' ? 'ย้าย แก้ หรือลบไม่ได้ จนกว่าจะปลดล็อก' : 'ย้าย แก้ และลบได้')}
        </small>
      </div>
      <div className="st-panel-actions">
        <button type="button" className="btn-secondary" disabled={!editable(bKey)} onClick={() => patchEntry(bKey, { visible: !entry.visible })}>
          <FaIcon name={entry.visible ? 'eye-slash' : 'eye'} />
          <span>{tx(entry.visible ? 'ซ่อนบล็อกนี้' : 'แสดงบล็อกนี้')}</span>
        </button>
        <button type="button" className="btn-secondary is-danger" disabled={!canEdit || layoutLocked || !!entry.lock} onClick={() => removeBlock(bKey)}>
          <FaIcon name="trash-can" />
          <span>{tx('ลบบล็อก')}</span>
        </button>
      </div>
    </div>
  );

  let inspector: React.ReactNode = (
    <div className="st-panel-sec">
      <h3>
        <FaIcon name="hand-pointer" /> {tx('เลือกส่วนที่จะแก้')}
      </h3>
      <p className="fe-hint">{tx('คลิกบล็อกในตัวอย่างหรือในเมนูซ้าย ดับเบิลคลิกข้อความในตัวอย่างเพื่อแก้ในที่')}</p>
    </div>
  );
  if (key === 'card') {
    inspector = (
      <CardInspector card={page.card ?? {}} totalQuotaOn={isTotalQuotaEnabled(event)} onChange={(card) => canEdit && onChange({ ...page, card })} onOpenSection={onOpenSection} />
    );
  } else if (key && isCoreBlock(key)) {
    const id = key as EventDetailBlockId;
    inspector = (
      <fieldset className="st-plain" disabled={!editable(key)}>
        <CoreInspector
          blockId={id}
          visible={entry?.visible ?? true}
          onToggle={() => patchEntry(key, { visible: !(entry?.visible ?? true) })}
          text={isCoreTextKey(id) ? coreText[id] : undefined}
          onText={isCoreTextKey(id) ? (next) => setCoreText(id, next) : undefined}
          onOpenSection={onOpenSection}
          hiddenOnPublic={id === 'merch' && event.products.length === 0}
        />
      </fieldset>
    );
  } else if (item && selBlock) {
    const col = selBlock.cells.findIndex((c) => c.some((x) => x.id === item.itemId));
    const it = selBlock.cells[col]?.find((x) => x.id === item.itemId);
    if (it) {
      inspector = (
        <fieldset className="st-plain" disabled={!editable(customKey(selBlock.id))}>
          <ItemInspector
            item={it}
            block={selBlock}
            col={col}
            index={selBlock.cells[col].indexOf(it)}
            onChange={(patch) => setBlock(selBlock.id, (b) => ({ ...b, cells: b.cells.map((c) => c.map((x) => (x.id === it.id ? { ...x, ...patch } : x))) }))}
            onMove={(dCol, dIdx) =>
              setBlock(selBlock.id, (b) => {
                const cells = b.cells.map((c) => [...c]);
                const i = cells[col].findIndex((x) => x.id === it.id);
                const [moved] = cells[col].splice(i, 1);
                const toCol = Math.max(0, Math.min(cells.length - 1, col + dCol));
                const toIdx = dCol ? cells[toCol].length : Math.max(0, Math.min(cells[col].length, i + dIdx));
                cells[toCol].splice(toIdx, 0, moved);
                return { ...b, cells };
              })
            }
            onDuplicate={() => setBlock(selBlock.id, (b) => ({ ...b, cells: b.cells.map((c) => c.flatMap((x) => (x.id === it.id ? [x, { ...x, id: newPageId('it') }] : [x]))) }))}
            onRemove={() => {
              setBlock(selBlock.id, (b) => ({ ...b, cells: b.cells.map((c) => c.filter((x) => x.id !== it.id)) }));
              onSelect(customKey(selBlock.id));
            }}
            onBack={() => onSelect(customKey(selBlock.id))}
            onError={(text) => onStatus({ tone: 'err', text })}
            event={event}
            onOpenSection={onOpenSection}
          />
        </fieldset>
      );
    }
  } else if (selBlock && bKey) {
    inspector = (
      <fieldset className="st-plain" disabled={!editable(bKey)}>
        <BlockInspector
          block={selBlock}
          visible={entry?.visible ?? true}
          onTitle={(t) => setBlock(selBlock.id, (b) => ({ ...b, title: t.slice(0, PAGE_LIMITS.title) }))}
          onColumns={(n) =>
            setBlock(selBlock.id, (b) => {
              const cells = Array.from({ length: n }, (_, i) => b.cells[i] ?? []);
              // pieces of removed columns go to the last kept column
              for (let i = n; i < b.cells.length; i++) cells[n - 1] = [...cells[n - 1], ...b.cells[i]];
              return { ...b, columns: n, cells };
            })
          }
          onSelectItem={(itemId) => onSelect(`item:${selBlock.id}:${itemId}`)}
          onToggle={() => patchEntry(bKey, { visible: !(entry?.visible ?? true) })}
          onDuplicate={() => duplicateBlock(bKey)}
          onRemove={() => removeBlock(bKey)}
          modLabel="Ctrl"
        />
      </fieldset>
    );
  }

  return (
    <div className="st-form">
      <div className="st-center">
        <div className="st-center-bar">
          <span className="fe-seg" role="group" aria-label={tx('ขนาดจอของตัวอย่าง')}>
            {(['desktop', 'phone'] as const).map((d) => (
              <button key={d} type="button" aria-pressed={device === d} className={device === d ? 'is-on' : ''} onClick={() => setDevice(d)}>
                <FaIcon name={d === 'phone' ? 'mobile-screen' : 'desktop'} />
                <span>{tx(d === 'phone' ? 'มือถือ' : 'เดสก์ท็อป')}</span>
              </button>
            ))}
          </span>
          <span className="fe-hint">{tx('คลิกเพื่อเลือก ดับเบิลคลิกข้อความเพื่อแก้ในที่')}</span>
          <span className="fe-count">{txf('บล็อกอิสระ {0}/{1}', page.customBlocks.length, PAGE_LIMITS.customBlocks)}</span>
        </div>
        <div ref={boxRef} className={`fe-preview-frame st-page-frame is-${device}`}>
          {!ready && <p className="fe-preview-loading">{tx('กำลังโหลดตัวอย่าง…')}</p>}
          <iframe
            ref={frameRef}
            key={device}
            title={tx('ตัวอย่างหน้ารายละเอียดงาน (หน้าจริงพร้อมการแก้ไขที่ยังไม่เผยแพร่)')}
            src={`/events/${encodeURIComponent(event.id)}?preview=${PREVIEW_PARAM}`}
            style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})` }}
            onLoad={() => send()}
          />
        </div>
      </div>

      <aside className="st-panel" aria-label={tx('ตั้งค่าและเพิ่มส่วนของหน้า')}>
        <div className="st-ptabs" role="tablist">
          <button type="button" role="tab" aria-selected={panelTab === 'set'} onClick={() => onPanelTab('set')}>
            {tx('ตั้งค่า')}
          </button>
          <button type="button" role="tab" aria-selected={panelTab === 'add'} onClick={() => onPanelTab('add')}>
            {tx('เพิ่ม')}
          </button>
        </div>
        {panelTab === 'set' ? (
          <>
            {inspector}
            {lockSeg}
          </>
        ) : (
          <div className="st-panel-sec">
            <h3>
              <FaIcon name="plus" /> {tx('เพิ่มในหน้า')}
            </h3>
            <p className="fe-hint">
              {selBlock
                ? txf('ชิ้นส่วนจะเข้าไปในบล็อก "{0}" (คอลัมน์แรก)', selBlock.title)
                : tx('บล็อกใหม่จะต่อจากบล็อกที่เลือก หรือท้ายหน้า')}
            </p>
            {layoutLocked && <p className="fe-hint">{tx('ล็อกโครงหน้าอยู่ ปลดล็อกก่อนจึงเพิ่มได้')}</p>}
            <div className="st-addrow">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} type="button" className="fe-pal-item" disabled={!canEdit || layoutLocked} onClick={() => addBlock(n)}>
                  <FaIcon name="table-columns" />
                  <span>{txf('บล็อก {0} คอลัมน์', n)}</span>
                </button>
              ))}
            </div>
            {PALETTE_GROUPS.filter((g) => g.id !== 'layout').map((g) => (
              <div key={g.id} className="fe-pal-group">
                <span className="fe-pal-title">{tx(g.label)}</span>
                {PALETTE.filter((p) => p.group === g.id).map((p) => (
                  <button key={p.id} type="button" className="fe-pal-item" disabled={!canEdit || (layoutLocked && !selBlock)} onClick={() => addPiece(p)}>
                    <FaIcon name={p.icon} />
                    <span>{tx(p.label)}</span>
                  </button>
                ))}
              </div>
            ))}
            {missingCore.length > 0 && (
              <div className="fe-pal-group">
                <span className="fe-pal-title">{tx('บล็อกของระบบที่เอาออกไปแล้ว')}</span>
                {missingCore.map((d) => (
                  <button key={d.id} type="button" className="fe-pal-item" disabled={!canEdit || layoutLocked} onClick={() => addCore(d.id)}>
                    <FaIcon name={BLOCK_ICON[d.id]} />
                    <span>{tx(d.label)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

/** the menu rows of the page: every block in order (hidden ones too), and their pieces */
export function pageRows(page: EventDetailPage) {
  return layoutEntries(page).map((e) => {
    const custom = e.resolved.custom;
    return {
      key: e.item.block,
      label: custom ? custom.title : coreBlockDef(e.item.block as EventDetailBlockId).label,
      icon: custom ? 'table-columns' : BLOCK_ICON[e.item.block as EventDetailBlockId],
      core: !custom,
      visible: e.item.visible,
      lock: e.item.lock,
      pieces: custom ? custom.cells.flat().map((it) => ({ key: `item:${custom.id}:${it.id}`, label: kindEntry(it)?.label ?? it.kind, icon: kindEntry(it)?.icon ?? 'square' })) : [],
    };
  });
}
