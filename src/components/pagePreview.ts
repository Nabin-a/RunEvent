import { useEffect, useState } from 'react';
import type { EventDetailPage } from '../types';

/**
 * Live preview channel between the organizer page editor and the event page shown
 * inside its iframe (`/events/<id>?preview=page`). Same-origin postMessage only.
 *
 * editor -> page : { type: 'kr-page-preview', page, selected, readOnly? }  (readOnly: a look-only preview, no text editing)
 *                  { type: 'kr-page-scroll', dy }            (auto-scroll while dragging)
 *                  { type: 'kr-page-edit-at', x, y }         (double-click: edit the text there)
 *                  { type: 'kr-page-edit-key', key }         (F2: edit the first text of a block / piece)
 *                  { type: 'kr-page-drag-start', target, x, y, dx, dy }  (show a copy of the held item)
 *                  { type: 'kr-page-drag-move', x, y }        (move that copy with the pointer)
 *                  { type: 'kr-page-drag-end' }
 * page -> editor : { type: 'kr-page-ready' }
 *                  { type: 'kr-page-hover', block, item }   (block / piece under the mouse)
 *                  { type: 'kr-page-pick', key, shift, toggle } (a block or piece was clicked, with Shift / Ctrl)
 *                  { type: 'kr-page-layout', layout }         (where blocks / columns / pieces are)
 *                  { type: 'kr-page-editing', on }            (an in-place text edit started / ended)
 *                  { type: 'kr-page-text', target, value }    (the edited text, to save)
 *                  { type: 'kr-page-edit-none' }              (nothing editable at that spot)
 *                  { type: 'kr-page-context', key, x, y }     (right-click: the editor opens its menu)
 */
export const PREVIEW_PARAM = 'page';

export const isPagePreviewUrl = (): boolean =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === PREVIEW_PARAM;

/** a box in the iframe's viewport, in CSS pixels of the page */
export interface PreviewBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface PreviewLayout {
  blocks: { key: string; box: PreviewBox }[];
  cols: { blockId: string; col: number; box: PreviewBox }[];
  items: { blockId: string; itemId: string; box: PreviewBox }[];
  /** items of the built-in lists the organizer can reorder (race pack, schedule) */
  coreItems: { list: string; index: number; box: PreviewBox }[];
  /** card icons that can be changed in place: `item:<blockId>:<itemId>:cards.<n>` */
  icons: { target: string; box: PreviewBox }[];
  viewportHeight: number;
}

export interface PagePreviewState {
  /** true inside the editor iframe */
  active: boolean;
  /** the unsaved page the editor sent, if any */
  page: EventDetailPage | null;
  /** key selected in the editor: a layout key or `item:<blockId>:<itemId>` */
  selected: string | null;
  /** tell the editor the visitor clicked a block or piece */
  pick: (key: string) => void;
  /** a look-only preview (the "page content" menu): no in-place editing marks or boxes */
  readOnly: boolean;
}

const boxOf = (el: Element): PreviewBox => {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

function readLayout(): PreviewLayout {
  return {
    blocks: Array.from(document.querySelectorAll<HTMLElement>('[data-page-key]')).map((el) => ({
      key: el.dataset.pageKey as string,
      box: boxOf(el),
    })),
    cols: Array.from(document.querySelectorAll<HTMLElement>('[data-page-col]')).map((el) => {
      const [blockId, col] = (el.dataset.pageCol as string).split(':');
      return { blockId, col: Number(col), box: boxOf(el) };
    }),
    items: Array.from(document.querySelectorAll<HTMLElement>('[data-page-item]')).map((el) => {
      const [blockId, itemId] = (el.dataset.pageItem as string).split(':');
      return { blockId, itemId, box: boxOf(el) };
    }),
    coreItems: Array.from(document.querySelectorAll<HTMLElement>('[data-core-item]')).map((el) => {
      const [list, index] = (el.dataset.coreItem as string).split(':');
      return { list, index: Number(index), box: boxOf(el) };
    }),
    icons: Array.from(document.querySelectorAll<HTMLElement>('[data-page-icon]')).map((el) => ({
      target: el.dataset.pageIcon as string,
      box: boxOf(el),
    })),
    viewportHeight: window.innerHeight,
  };
}

/* ---------------- in-place text editing ---------------- */

const post = (msg: unknown) => window.parent?.postMessage(msg, window.location.origin);

/** keys held on the last click in the page (Shift = range, Ctrl/⌘ = add / remove one) */
let lastClickMods = { shift: false, toggle: false };

/** first non-transparent background behind an element, so the edit box hides the text under it */
function backgroundOf(el: Element): string {
  for (let n: Element | null = el; n; n = n.parentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return '#fff';
}

let editingNow: (() => void) | null = null;

/**
 * Edit the text of a `[data-page-edit]` element in place. The element itself belongs to React,
 * so it is left untouched (only hidden): a plain-text box with the same font and size is laid
 * over it, and on Enter / leaving the box its text goes to the editor, which saves it and sends
 * the page back. Esc cancels. Multi-line text keeps Enter for new lines; Ctrl/⌘+Enter finishes.
 */
function startInlineEdit(el: HTMLElement, at?: { x: number; y: number }) {
  editingNow?.();
  const target = el.dataset.pageEdit;
  if (!target) return;
  const multi = el.dataset.editMode === 'multi';
  const original = el.dataset.editValue ?? '';
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);

  const box = document.createElement('div');
  box.className = 'page-inline-edit';
  box.setAttribute('role', 'textbox');
  box.setAttribute('aria-multiline', String(multi));
  box.setAttribute('aria-label', el.textContent?.trim() || target);
  box.spellcheck = true;
  try {
    box.contentEditable = 'plaintext-only';
  } catch {
    box.contentEditable = 'true';
  }
  Object.assign(box.style, {
    left: `${r.left + window.scrollX}px`,
    top: `${r.top + window.scrollY}px`,
    width: `${Math.max(r.width, 40)}px`,
    minHeight: `${r.height}px`,
    font: cs.font,
    letterSpacing: cs.letterSpacing,
    lineHeight: cs.lineHeight,
    color: cs.color,
    textAlign: cs.textAlign,
    padding: cs.padding,
    background: backgroundOf(el),
  } as Partial<CSSStyleDeclaration>);
  box.textContent = original;
  const prevVisibility = el.style.visibility;
  el.style.visibility = 'hidden';
  document.body.appendChild(box);
  box.focus();

  // caret where the double-click was, else at the end
  const sel = window.getSelection();
  let placed = false;
  if (at && sel) {
    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    const pos = doc.caretPositionFromPoint?.(at.x, at.y);
    const range = pos ? document.createRange() : document.caretRangeFromPoint?.(at.x, at.y);
    if (pos && range) range.setStart(pos.offsetNode, pos.offset);
    if (range && box.contains(range.startContainer)) {
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      placed = true;
    }
  }
  if (!placed && sel) {
    const range = document.createRange();
    range.selectNodeContents(box);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
  post({ type: 'kr-page-editing', on: true });

  let done = false;
  const finish = (save: boolean) => {
    if (done) return;
    done = true;
    editingNow = null;
    let value = (box.innerText ?? box.textContent ?? '').replace(/\r/g, '');
    value = multi ? value.replace(/\n+$/, '') : value.replace(/\s*\n\s*/g, ' ').trim();
    box.remove();
    el.style.visibility = prevVisibility;
    if (save && value !== original) post({ type: 'kr-page-text', target, value });
    post({ type: 'kr-page-editing', on: false });
  };
  editingNow = () => finish(true);
  box.addEventListener('blur', () => finish(true));
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    } else if (e.key === 'Enter' && (!multi || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      finish(true);
    }
  });
  // clicks inside the box must not reach the page (they would pick a block)
  box.addEventListener('click', (e) => e.stopPropagation(), true);
}

/* ---------------- the held item follows the pointer ---------------- */

const DRAG_CLONE_MAX = 220;
let dragCopy: { box: HTMLElement; source: HTMLElement; opacity: string; dx: number; dy: number } | null = null;

/** `block:<key>` | `item:<blockId>:<itemId>` | `core:<list>:<n>` -> the element on the page */
function dragSourceOf(target: string): HTMLElement | null {
  const [kind, ...rest] = target.split(':');
  const id = rest.join(':');
  if (kind === 'block') return document.querySelector(`[data-page-key="${CSS.escape(id)}"]`);
  if (kind === 'item') return document.querySelector(`[data-page-item="${CSS.escape(id)}"]`);
  if (kind === 'core') return document.querySelector(`[data-core-item="${CSS.escape(id)}"]`);
  return null;
}

/**
 * A copy of the held item, drawn in the page itself so it keeps the page's own look. It sits next
 * to the original (same styles apply), is fixed to the viewport and follows the pointer; the
 * original stays in place, faded. Tall blocks are cut to DRAG_CLONE_MAX px and fade out.
 */
function startDragCopy(target: string, x: number, y: number, dx: number, dy: number) {
  endDragCopy();
  const source = dragSourceOf(target);
  if (!source?.parentElement) return;
  const r = source.getBoundingClientRect();
  const copy = source.cloneNode(true) as HTMLElement;
  // the copy must not count as a block / piece / editable text anywhere
  for (const el of [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('*'))]) {
    for (const a of Array.from(el.attributes)) if (a.name.startsWith('data-page') || a.name.startsWith('data-core') || a.name.startsWith('data-edit')) el.removeAttribute(a.name);
    el.removeAttribute('id');
  }
  const box = document.createElement('div');
  box.className = 'page-drag-copy';
  box.setAttribute('aria-hidden', 'true');
  Object.assign(box.style, { width: `${r.width}px`, left: `${x - dx}px`, top: `${y - dy}px` });
  if (r.height > DRAG_CLONE_MAX) box.classList.add('is-cut');
  box.appendChild(copy);
  source.parentElement.appendChild(box);
  const opacity = source.style.opacity;
  source.style.opacity = '0.3';
  dragCopy = { box, source, opacity, dx, dy };
  moveDragCopy(x, y);
}

/**
 * `position: fixed` is relative to the nearest ancestor with a transform / filter / contain
 * (the event page has one from its enter animation), not to the viewport: offset by that box.
 */
function fixedOrigin(el: HTMLElement): { left: number; top: number } {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none' || /paint|layout|strict|content/.test(cs.contain) || /transform|filter/.test(cs.willChange)) {
      const r = n.getBoundingClientRect();
      return { left: r.left, top: r.top };
    }
  }
  return { left: 0, top: 0 };
}

function moveDragCopy(x: number, y: number) {
  if (!dragCopy) return;
  const o = fixedOrigin(dragCopy.box);
  dragCopy.box.style.left = `${x - dragCopy.dx - o.left}px`;
  dragCopy.box.style.top = `${y - dragCopy.dy - o.top}px`;
}

function endDragCopy() {
  if (!dragCopy) return;
  dragCopy.box.remove();
  dragCopy.source.style.opacity = dragCopy.opacity;
  dragCopy = null;
}

function editAtPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-page-edit]');
  if (el) startInlineEdit(el, { x, y });
  else post({ type: 'kr-page-edit-none' });
}

function editKey(key: string) {
  const scope =
    key === 'card'
      ? document.querySelector('[data-page-card]')
      : key.startsWith('item:')
        ? document.querySelector(`[data-page-item="${CSS.escape(key.slice(5))}"]`)
        : document.querySelector(`[data-page-key="${CSS.escape(key)}"]`);
  const el = scope?.querySelector<HTMLElement>('[data-page-edit]');
  if (el) {
    el.scrollIntoView({ block: 'nearest' });
    startInlineEdit(el);
  } else post({ type: 'kr-page-edit-none' });
}

export function usePagePreview(): PagePreviewState {
  const active = isPagePreviewUrl();
  const [page, setPage] = useState<EventDetailPage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    if (!active) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as {
        type?: string;
        page?: EventDetailPage;
        selected?: string | null;
        dy?: number;
        x?: number;
        y?: number;
        key?: string;
        target?: string;
        dx?: number;
        readOnly?: boolean;
      };
      if (data?.type === 'kr-page-drag-start' && data.target) {
        startDragCopy(data.target, data.x ?? 0, data.y ?? 0, data.dx ?? 0, data.dy ?? 0);
        return;
      }
      if (data?.type === 'kr-page-drag-move' && typeof data.x === 'number' && typeof data.y === 'number') {
        moveDragCopy(data.x, data.y);
        return;
      }
      if (data?.type === 'kr-page-drag-end') {
        endDragCopy();
        return;
      }
      if (data?.type === 'kr-page-scroll' && typeof data.dy === 'number') {
        window.scrollBy(0, data.dy);
        return;
      }
      if (data?.type === 'kr-page-edit-at' && typeof data.x === 'number' && typeof data.y === 'number') {
        editAtPoint(data.x, data.y);
        return;
      }
      if (data?.type === 'kr-page-edit-key' && data.key) {
        editKey(data.key);
        return;
      }
      if (data?.type !== 'kr-page-preview') return;
      if (data.page) setPage(data.page);
      setSelected(data.selected ?? null);
      lookOnly = data.readOnly === true;
      setReadOnly(lookOnly);
    };
    let lookOnly = false;
    // a double-click that reaches the page itself (no drag layer over it) edits too
    const onDbl = (e: MouseEvent) => {
      if (lookOnly) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-page-edit]');
      if (!el) return;
      e.preventDefault();
      startInlineEdit(el, { x: e.clientX, y: e.clientY });
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('dblclick', onDbl);
    window.parent?.postMessage({ type: 'kr-page-ready' }, window.location.origin);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('dblclick', onDbl);
    };
  }, [active]);

  // report where everything is, after each render and whenever the page moves
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const send = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        window.parent?.postMessage({ type: 'kr-page-layout', layout: readLayout() }, window.location.origin)
      );
    };
    send();
    window.addEventListener('scroll', send, { passive: true });
    window.addEventListener('resize', send);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(send) : null;
    ro?.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', send);
      window.removeEventListener('resize', send);
      ro?.disconnect();
    };
  }, [active, page, selected]);

  // the preview shows this one event page and nothing else: no click, key press or form in it
  // may act (links, tabs, "back to list", the dashboard button, the dev dock...). Blocks, pieces
  // and the register card still get their click, only to be picked in the editor.
  useEffect(() => {
    if (!active) return;
    const guard = (e: Event) => {
      if (e instanceof MouseEvent) lastClickMods = { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey };
      const t = e.target as Element | null;
      if (!t || t.closest('.page-inline-edit')) return;
      e.preventDefault();
      if (e.type === 'click' && t.closest('[data-page-key], [data-page-card]')) return;
      e.stopPropagation();
    };
    const types = ['click', 'auxclick', 'submit'] as const;
    types.forEach((type) => document.addEventListener(type, guard, true));
    // right-click: no browser menu (it offers "back", "open link"...); the editor shows its own
    // for the card / piece / block under the pointer (most of the page is covered by its layers)
    const onMenu = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest('.page-inline-edit')) return; // the text box keeps copy / paste
      e.preventDefault();
      const card = t?.closest('[data-page-card]');
      const item = t?.closest<HTMLElement>('[data-page-item]');
      const block = t?.closest<HTMLElement>('[data-page-key]');
      const key = card ? 'card' : item ? `item:${item.dataset.pageItem}` : (block?.dataset.pageKey ?? null);
      post({ type: 'kr-page-context', key, x: e.clientX, y: e.clientY });
    };
    document.addEventListener('contextmenu', onMenu, true);
    return () => {
      types.forEach((type) => document.removeEventListener(type, guard, true));
      document.removeEventListener('contextmenu', onMenu, true);
    };
  }, [active]);

  // tell the editor which block / piece is under the mouse (it shows drag grips there)
  useEffect(() => {
    if (!active) return;
    let last = '';
    const onOver = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const blockEl = target?.closest<HTMLElement>('[data-page-key]');
      const itemEl = target?.closest<HTMLElement>('[data-page-item]');
      const block = blockEl?.dataset.pageKey ?? null;
      const item = itemEl ? `item:${itemEl.dataset.pageItem}` : null;
      const sig = `${block}|${item}`;
      if (sig === last) return;
      last = sig;
      window.parent?.postMessage({ type: 'kr-page-hover', block, item }, window.location.origin);
    };
    document.addEventListener('mouseover', onOver);
    return () => document.removeEventListener('mouseover', onOver);
  }, [active]);

  // follow the block picked in the editor
  useEffect(() => {
    if (!active || !selected) return;
    const target =
      selected === 'card'
        ? document.querySelector('[data-page-card]')
        : selected.startsWith('item:')
          ? document.querySelector(`[data-page-item="${CSS.escape(selected.slice(5))}"]`)
          : document.querySelector(`[data-page-key="${CSS.escape(selected)}"]`);
    // already (partly) on screen, e.g. just clicked in the preview: keep the page still, or the
    // next click (Shift / Ctrl+click to add) would land on something else
    const r = target?.getBoundingClientRect();
    if (r && r.bottom > 0 && r.top < window.innerHeight) return;
    target?.scrollIntoView({ block: 'nearest' });
  }, [active, selected]);

  return {
    active,
    page,
    selected,
    pick: (key: string) => window.parent?.postMessage({ type: 'kr-page-pick', key, ...lastClickMods }, window.location.origin),
    readOnly,
  };
}
