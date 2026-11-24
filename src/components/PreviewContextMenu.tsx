import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FaIcon } from './FaIcon';

export type MenuEntry =
  | {
      kind?: 'item';
      label: string;
      icon: string;
      shortcut?: string;
      disabled?: boolean;
      danger?: boolean;
      run: () => void;
    }
  | { kind: 'sep' };

/**
 * Right-click menu of the page editor preview: the actions of the block / piece / card under
 * the pointer, in one place. Opens at the pointer (kept inside `bounds`), focuses its first
 * action; ↑ ↓ Home End move, Enter / Space run, Esc / Tab / a click elsewhere close it.
 */
export function PreviewContextMenu({
  x,
  y,
  bounds,
  title,
  items,
  onClose,
}: {
  x: number;
  y: number;
  bounds: { width: number; height: number };
  title: string;
  items: MenuEntry[];
  onClose: (refocus: boolean) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // keep the whole menu inside the preview: flip left / up when it would run off
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = x + w > bounds.width - 4 ? Math.max(4, x - w) : x;
    const top = y + h > bounds.height - 4 ? Math.max(4, Math.min(y - h, bounds.height - h - 4)) : y;
    setPos({ left, top });
  }, [x, y, bounds.width, bounds.height]);

  const buttons = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([aria-disabled="true"])') ?? []);

  useEffect(() => {
    buttons()[0]?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose(false);
    };
    const onBlur = () => onClose(false);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onBlur);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onBlur);
    };
    // open once per menu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const list = buttons();
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const go = (i: number) => list[(i + list.length) % list.length]?.focus();
    if (e.key === 'ArrowDown') go(at + 1);
    else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(list.length - 1);
    else if (e.key === 'Escape') onClose(true);
    else if (e.key === 'Tab') onClose(true);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      className="pe-ctx-menu"
      role="menu"
      aria-label={title}
      style={{ left: pos.left, top: pos.top }}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pe-ctx-title" aria-hidden="true">
        {title}
      </div>
      {items.map((it, i) =>
        it.kind === 'sep' ? (
          <div key={`sep-${i}`} className="pe-ctx-sep" role="separator" />
        ) : (
          <button
            key={`${it.label}-${i}`}
            type="button"
            role="menuitem"
            className={`pe-ctx-item${it.danger ? ' is-danger' : ''}`}
            aria-disabled={it.disabled || undefined}
            onClick={() => {
              if (it.disabled) return;
              onClose(false);
              it.run();
            }}
          >
            <FaIcon name={it.icon} />
            <span className="pe-ctx-label">{it.label}</span>
            {it.shortcut && <kbd className="pe-ctx-key">{it.shortcut}</kbd>}
          </button>
        )
      )}
    </div>
  );
}
