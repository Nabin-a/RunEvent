import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { EventCustomBlock } from '../types';
import { customIdOf, customKey, isCoreBlock } from '../data/eventDetailLayout';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { BLOCK_ICON, itemSummary, kindEntry } from './PageItemEditors';

/**
 * Page outline as a nested tree, like the block editor's list view:
 *   block
 *     column (only when a free block has 2-3 columns)
 *       piece, or a block nested in that column (one level deep) with its own columns / pieces
 * Rows are dragged with the editor's DndContext (ids `tr-block:` / `tr-item:`) and every row
 * is a drop target (`row:block:` / `row:col:` / `row:item:`); the editor works out where the
 * drop lands from the pointer. Keyboard: WAI-ARIA tree (arrows, Home/End, Enter), and the
 * editor's own Alt+arrows move the selection.
 */

export interface OutlineBlock {
  key: string;
  label: string;
  visible: boolean;
  locked: boolean;
  custom?: EventCustomBlock;
}

export type DropPos = 'before' | 'after' | 'inside';
export interface OutlineDropHint {
  overId: string;
  pos: DropPos;
}

interface Row {
  id: string;
  type: 'block' | 'col' | 'item';
  level: number;
  parentId: string | null;
  /** what a click selects (columns select nothing) */
  selectKey: string | null;
  dragId: string | null;
  label: string;
  sub?: string;
  icon: string;
  hasChildren: boolean;
  expanded: boolean;
  visible: boolean;
  locked: boolean;
  hideable: boolean;
  /** custom block or piece: can be duplicated and deleted */
  editable: boolean;
  emptyCol?: boolean;
  /** expanded-state key (block key) for rows that fold */
  toggleKey?: string;
  /** a built-in block nested in a column: "delete" moves it back out instead */
  nestedCore?: boolean;
}

export interface OutlineRef {
  label: string;
  icon: string;
  locked: boolean;
  custom?: EventCustomBlock;
}

const blockIcon = (key: string) => (isCoreBlock(key) ? BLOCK_ICON[key] : 'table-columns');

export function PageOutline({
  blocks,
  resolveRef,
  containerOf,
  hiddenOnPublic,
  selected,
  multi,
  dropHint,
  dragging,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onRemove,
}: {
  blocks: OutlineBlock[];
  /** a nested block's name, icon and (for a free block) content */
  resolveRef: (ref: string) => OutlineRef | null;
  /** id of the free block a nested block sits in */
  containerOf: (key: string) => string | null;
  /** rows the live page leaves out because there is no data to show */
  hiddenOnPublic?: (selectKey: string) => boolean;
  /** a layout key or `item:<blockId>:<itemId>` */
  selected: string | null;
  /** more rows selected together (Shift / Ctrl+click) */
  multi?: string[];
  dropHint: OutlineDropHint | null;
  dragging: string | null;
  onSelect: (key: string, mods?: { shift: boolean; toggle: boolean }) => void;
  onToggleVisible: (layoutKey: string) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const selectedBlockKey = selected?.startsWith('item:') ? customKey(selected.split(':')[1]) : selected;
  // open the selected block when the outline first shows; everything else starts folded
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(selectedBlockKey ? [selectedBlockKey] : []));
  const [foldedCols, setFoldedCols] = useState<Set<string>>(() => new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);

  // a block or piece picked elsewhere (preview, toolbar) opens its parents in the outline
  useEffect(() => {
    if (!selected) return;
    if (selectedBlockKey) {
      const outer = containerOf(selectedBlockKey);
      setExpanded((s) => {
        const need = [selectedBlockKey, ...(outer ? [customKey(outer)] : [])].filter((k) => !s.has(k));
        return need.length ? new Set([...s, ...need]) : s;
      });
    }
    if (selected.startsWith('item:')) {
      const [, blockId, itemId] = selected.split(':');
      const b = blocks.find((x) => x.custom?.id === blockId)?.custom;
      const col = b?.cells.findIndex((c) => c.some((it) => it.id === itemId)) ?? -1;
      const colId = `row:col:${blockId}:${col}`;
      if (col >= 0) setFoldedCols((s) => (s.has(colId) ? new Set([...s].filter((x) => x !== colId)) : s));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    /** columns and pieces of a free block, starting at `level` */
    const pushChildren = (cb: EventCustomBlock, level: number, parentId: string, visible: boolean) => {
      const pushItems = (col: number, lvl: number, pid: string) => {
        for (const it of cb.cells[col] ?? []) {
          const rowId = `row:item:${cb.id}:${it.id}`;
          if (it.kind === 'nested' && it.ref) {
            const r = resolveRef(it.ref);
            const open = expanded.has(it.ref);
            out.push({
              id: rowId,
              type: 'item',
              level: lvl,
              parentId: pid,
              selectKey: `item:${cb.id}:${it.id}`,
              dragId: `tr-item:${cb.id}:${it.id}`,
              label: r?.label ?? tx('บล็อกที่ซ้อนอยู่ไม่มีแล้ว'),
              sub: tx('บล็อกซ้อน'),
              icon: r?.icon ?? 'square',
              hasChildren: !!r?.custom,
              expanded: open && !!r?.custom,
              visible,
              locked: !!r?.locked,
              hideable: false,
              editable: true,
              toggleKey: it.ref,
              nestedCore: !r?.custom,
            });
            if (r?.custom && open) pushChildren(r.custom, lvl + 1, rowId, visible);
            continue;
          }
          const entry = kindEntry(it);
          out.push({
            id: rowId,
            type: 'item',
            level: lvl,
            parentId: pid,
            selectKey: `item:${cb.id}:${it.id}`,
            dragId: `tr-item:${cb.id}:${it.id}`,
            label: tx(entry?.label ?? it.kind),
            sub: it.kind === 'divider' ? undefined : itemSummary(it),
            icon: entry?.icon ?? 'square',
            hasChildren: false,
            expanded: false,
            visible,
            locked: false,
            hideable: false,
            editable: true,
          });
        }
      };
      if (cb.columns === 1) {
        if ((cb.cells[0] ?? []).length === 0) out.push(emptyColRow(cb.id, 0, level, parentId, visible));
        else pushItems(0, level, parentId);
        return;
      }
      for (let col = 0; col < cb.columns; col++) {
        const colId = `row:col:${cb.id}:${col}`;
        const count = cb.cells[col]?.length ?? 0;
        const colOpen = !foldedCols.has(colId);
        out.push({
          id: colId,
          type: 'col',
          level,
          parentId,
          selectKey: null,
          dragId: null,
          label: txf('คอลัมน์ {0}', col + 1),
          sub: count === 0 ? tx('ว่าง ลากชิ้นส่วนมาวางที่นี่') : txf('{0} ชิ้น', count),
          icon: 'table-columns',
          hasChildren: count > 0,
          expanded: colOpen && count > 0,
          visible,
          locked: false,
          hideable: false,
          editable: false,
          emptyCol: count === 0,
        });
        if (colOpen) pushItems(col, level + 1, colId);
      }
    };
    for (const b of blocks) {
      const blockId = `row:block:${b.key}`;
      const cb = b.custom;
      const open = expanded.has(b.key);
      out.push({
        id: blockId,
        type: 'block',
        level: 1,
        parentId: null,
        selectKey: b.key,
        dragId: `tr-block:${b.key}`,
        label: b.label,
        sub: cb && cb.columns > 1 ? txf('{0} คอลัมน์', cb.columns) : undefined,
        icon: blockIcon(b.key),
        hasChildren: !!cb,
        expanded: open,
        visible: b.visible,
        locked: b.locked,
        hideable: !b.locked,
        editable: !!cb,
        toggleKey: b.key,
      });
      if (cb && open) pushChildren(cb, 2, blockId, b.visible);
    }
    return out;
  }, [blocks, expanded, foldedCols, resolveRef]);

  const nestedHolder = (key: string) => {
    const outer = containerOf(key);
    if (!outer) return null;
    const holder = blocks.find((b) => b.custom?.id === outer)?.custom?.cells.flat().find((it) => it.kind === 'nested' && it.ref === key);
    return holder ? `row:item:${outer}:${holder.id}` : null;
  };
  // a folded row the dragged row rests on opens after a short wait (cancelled when it moves on)
  useEffect(() => {
    if (!dropHint) return;
    const r = rows.find((x) => x.id === dropHint.overId);
    if (!r || !r.hasChildren || r.expanded) return;
    const t = window.setTimeout(() => toggle(r), 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropHint?.overId]);

  /** position among siblings, for screen readers (aria-posinset / aria-setsize) */
  const siblingInfo = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const r of rows) {
      const k = r.parentId ?? '';
      groups.set(k, [...(groups.get(k) ?? []), r.id]);
    }
    const out = new Map<string, { pos: number; size: number }>();
    for (const ids of groups.values()) ids.forEach((id, i) => out.set(id, { pos: i + 1, size: ids.length }));
    return out;
  }, [rows]);

  const selectedRowId = selected
    ? selected.startsWith('item:')
      ? `row:item:${selected.slice(5)}`
      : (nestedHolder(selected) ?? `row:block:${selected}`)
    : null;
  const tabStop = rows.some((r) => r.id === focusId) ? focusId : (rows.find((r) => r.id === selectedRowId)?.id ?? rows[0]?.id);

  // keep the selected row in sight
  useEffect(() => {
    if (!selectedRowId) return;
    treeRef.current?.querySelector(`[data-row="${CSS.escape(selectedRowId)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selectedRowId, rows.length]);

  // close the row menu on an outside click
  useEffect(() => {
    if (!menuFor) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest('.pe-tree-menu-wrap')) setMenuFor(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuFor]);

  const focusRow = (id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    // the target row is already on screen (only visible rows are reachable)
    treeRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)?.focus();
  };

  const toggle = (r: Row) => {
    if (r.type !== 'col' && r.toggleKey) {
      const key = r.toggleKey;
      setExpanded((s) => {
        const n = new Set(s);
        if (n.has(key)) n.delete(key);
        else n.add(key);
        return n;
      });
    } else if (r.type === 'col') {
      setFoldedCols((s) => {
        const n = new Set(s);
        if (n.has(r.id)) n.delete(r.id);
        else n.add(r.id);
        return n;
      });
    }
  };

  const activate = (r: Row, e?: React.MouseEvent) => {
    if (r.selectKey) onSelect(r.selectKey, e ? { shift: e.shiftKey, toggle: e.ctrlKey || e.metaKey } : undefined);
    else toggle(r);
  };

  const onKeyDown = (e: React.KeyboardEvent, r: Row) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return; // Alt+arrows etc. are the editor's
    const i = rows.findIndex((x) => x.id === r.id);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusRow(rows[i + 1]?.id);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusRow(rows[i - 1]?.id);
        break;
      case 'Home':
        e.preventDefault();
        focusRow(rows[0]?.id);
        break;
      case 'End':
        e.preventDefault();
        focusRow(rows[rows.length - 1]?.id);
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (r.hasChildren && !r.expanded) toggle(r);
        else if (r.expanded) focusRow(rows[i + 1]?.id);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (r.hasChildren && r.expanded) toggle(r);
        else if (r.parentId) focusRow(r.parentId);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        activate(r);
        break;
      default:
    }
  };

  return (
    <ul ref={treeRef} className="pe-tree" role="tree" aria-label={tx('โครงหน้า')} aria-multiselectable="true">
      {rows.map((r) => (
        <TreeRow
          key={r.id}
          row={r}
          selected={r.id === selectedRowId || (!!r.selectKey && !!multi?.includes(r.selectKey))}
          tabStop={r.id === tabStop}
          publicHidden={!!r.selectKey && !!hiddenOnPublic?.(r.selectKey)}
          posInSet={siblingInfo.get(r.id)?.pos ?? 1}
          setSize={siblingInfo.get(r.id)?.size ?? 1}
          drop={dropHint?.overId === r.id ? dropHint.pos : null}
          dimmed={!!dragging && (dragging === r.dragId || (dragging.startsWith('tr-block:') && rowInBlock(r, dragging.slice(9))))}
          menuOpen={menuFor === r.id}
          onFocus={() => setFocusId(r.id)}
          onClick={(e) => activate(r, e)}
          onToggle={() => toggle(r)}
          onKeyDown={(e) => onKeyDown(e, r)}
          onMenu={() => setMenuFor((m) => (m === r.id ? null : r.id))}
          onToggleVisible={() => r.selectKey && onToggleVisible(r.selectKey)}
          onDuplicate={() => {
            setMenuFor(null);
            if (r.selectKey) onDuplicate(r.selectKey);
          }}
          onRemove={() => {
            setMenuFor(null);
            if (r.selectKey) onRemove(r.selectKey);
          }}
        />
      ))}
    </ul>
  );
}

function emptyColRow(blockId: string, col: number, level: number, parentId: string, visible: boolean): Row {
  return {
    id: `row:col:${blockId}:${col}`,
    type: 'col',
    level,
    parentId,
    selectKey: null,
    dragId: null,
    label: tx('ว่าง ลากชิ้นส่วนมาวางที่นี่'),
    icon: 'arrow-turn-down',
    hasChildren: false,
    expanded: false,
    visible,
    locked: false,
    hideable: false,
    editable: false,
    emptyCol: true,
  };
}

/** a row that belongs to the block with this layout key (so it moves with it) */
function rowInBlock(r: Row, layoutKey: string) {
  if (r.id === `row:block:${layoutKey}`) return true;
  const blockId = customIdOf(layoutKey);
  return !!blockId && (r.id.startsWith(`row:col:${blockId}:`) || r.id.startsWith(`row:item:${blockId}:`));
}

function TreeRow({
  row: r,
  selected,
  tabStop,
  publicHidden,
  posInSet,
  setSize,
  drop,
  dimmed,
  menuOpen,
  onFocus,
  onClick,
  onToggle,
  onKeyDown,
  onMenu,
  onToggleVisible,
  onDuplicate,
  onRemove,
}: {
  row: Row;
  selected: boolean;
  tabStop: boolean;
  publicHidden: boolean;
  posInSet: number;
  setSize: number;
  drop: DropPos | null;
  dimmed: boolean;
  menuOpen: boolean;
  onFocus: () => void;
  onClick: (e: React.MouseEvent) => void;
  onToggle: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMenu: () => void;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const drag = useDraggable({ id: r.dragId ?? `none:${r.id}`, disabled: !r.dragId });
  const dropZone = useDroppable({ id: r.id });
  const setRef = (el: HTMLLIElement | null) => {
    drag.setNodeRef(el);
    dropZone.setNodeRef(el);
  };
  const { onKeyDown: _dndKey, ...pointerListeners } = (drag.listeners ?? {}) as Record<string, (e: unknown) => void>;
  void _dndKey;

  return (
    <li
      ref={setRef}
      data-row={r.id}
      role="treeitem"
      aria-level={r.level}
      aria-posinset={posInSet}
      aria-setsize={setSize}
      aria-selected={selected}
      aria-expanded={r.hasChildren ? r.expanded : undefined}
      tabIndex={tabStop ? 0 : -1}
      className={[
        'pe-tree-row',
        `is-${r.type}`,
        selected ? 'is-selected' : '',
        r.visible ? '' : 'is-hidden',
        r.emptyCol ? 'is-empty' : '',
        dimmed ? 'is-dragging' : '',
        drop ? `drop-${drop}` : '',
        r.dragId ? 'is-draggable' : '',
      ].join(' ')}
      style={{ '--tree-level': r.level } as React.CSSProperties}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onFocus();
      }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...pointerListeners}
    >
      <span className="pe-tree-indent" aria-hidden="true" />
      {r.hasChildren ? (
        <button
          type="button"
          tabIndex={-1}
          className="pe-tree-chevron"
          aria-hidden="true"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <FaIcon name={r.expanded ? 'chevron-down' : 'chevron-right'} />
        </button>
      ) : (
        <span className="pe-tree-chevron is-blank" aria-hidden="true" />
      )}
      <FaIcon name={r.icon} className="pe-tree-icon" />
      <span className="pe-tree-text">
        <span className="pe-tree-label">{r.label}</span>
        {r.sub && <span className="pe-tree-sub">{r.sub}</span>}
      </span>
      <span className="pe-tree-state">
        {r.locked && (
          <span title={tx('บล็อกหลัก ย้ายได้อย่างเดียว')}>
            <FaIcon name="lock" />
            <span className="sr-only">{tx('บล็อกหลัก')}</span>
          </span>
        )}
        {publicHidden && (
          <span title={tx('ไม่แสดงบนหน้าจริง (ยังไม่มีข้อมูล)')}>
            <FaIcon name="circle-minus" />
            <span className="sr-only">{tx('ไม่แสดงบนหน้าจริง (ยังไม่มีข้อมูล)')}</span>
          </span>
        )}
        {!r.visible && r.type === 'block' && (
          <span title={tx('ซ่อนอยู่')}>
            <FaIcon name="eye-slash" />
            <span className="sr-only">{tx('ซ่อนอยู่')}</span>
          </span>
        )}
      </span>
      {(r.hideable || r.editable) && (
        <span className="pe-tree-actions" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          {r.hideable && (
            <button
              type="button"
              tabIndex={-1}
              className="pe-tree-act"
              onClick={onToggleVisible}
              aria-label={r.visible ? tx('ซ่อนบล็อกนี้') : tx('แสดงบล็อกนี้')}
              title={r.visible ? tx('ซ่อนบล็อกนี้') : tx('แสดงบล็อกนี้')}
            >
              <FaIcon name={r.visible ? 'eye' : 'eye-slash'} />
            </button>
          )}
          {r.editable && (
            <span className="pe-tree-menu-wrap">
              <button
                type="button"
                tabIndex={-1}
                className="pe-tree-act"
                onClick={onMenu}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={txf('ตัวเลือกของ {0}', r.label)}
                title={tx('ตัวเลือก')}
              >
                <FaIcon name="ellipsis-vertical" />
              </button>
              {menuOpen && (
                <span className="pe-tree-menu" role="menu">
                  {!r.nestedCore && (
                    <button type="button" role="menuitem" onClick={onDuplicate}>
                      <FaIcon name="clone" />
                      <span>{tx('ทำสำเนา')}</span>
                    </button>
                  )}
                  {r.nestedCore ? (
                    <button type="button" role="menuitem" onClick={onRemove}>
                      <FaIcon name="arrow-turn-up" />
                      <span>{tx('ย้ายออกมาชั้นบน')}</span>
                    </button>
                  ) : (
                    <button type="button" role="menuitem" className="is-danger" onClick={onRemove}>
                      <FaIcon name="trash-can" />
                      <span>{r.type === 'block' || r.toggleKey ? tx('ลบบล็อก') : tx('ลบชิ้นส่วนนี้')}</span>
                    </button>
                  )}
                </span>
              )}
            </span>
          )}
        </span>
      )}
    </li>
  );
}
