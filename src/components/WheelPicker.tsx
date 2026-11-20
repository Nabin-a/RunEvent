import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../i18n';

/*
 * iOS-style wheel picker.
 * - WheelColumn: one scroll-snapping wheel (role="listbox"), keyboard: ↑/↓/Home/End/PageUp/PageDown.
 * - WheelSheet: the popover (desktop) / bottom sheet (phones) that hosts columns with
 *   Cancel / Done, plus an optional sticky header row above the wheels.
 * Native <select> is not used here because its picker cannot be styled consistently.
 */

// Row height comes from CSS (--wheel-item-h: 36px desktop, 40px phones); measured at runtime.
const FALLBACK_ITEM_HEIGHT = 36;
const VISIBLE_ROWS = 5;

export interface WheelItem {
  value: string;
  label: React.ReactNode;
  /** Plain text for screen readers / type-ahead when label is not a string. */
  text?: string;
}

interface WheelColumnProps {
  items: WheelItem[];
  selectedIndex: number;
  onChange: (index: number) => void;
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
  /** a row was clicked / tapped (after onChange); lets a picker close on pick */
  onPick?: (index: number) => void;
}

export const WheelColumn: React.FC<WheelColumnProps> = ({
  items,
  selectedIndex,
  onChange,
  ariaLabel,
  className,
  autoFocus = false,
  onPick,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  const programmatic = useRef(false);
  const baseId = useId();
  const itemH = () =>
    (ref.current?.querySelector('.wheel-item') as HTMLElement | null)?.offsetHeight ||
    FALLBACK_ITEM_HEIGHT;

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTo({ top: index * itemH(), behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => {
      programmatic.current = false;
    }, smooth ? 260 : 30);
  }, []);

  // Keep the wheel aligned with the selected value (initial open and external changes).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = Math.round(el.scrollTop / itemH());
    if (current !== selectedIndex) scrollToIndex(selectedIndex, false);
  }, [selectedIndex, items.length, scrollToIndex]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const handleScroll = () => {
    if (programmatic.current) return;
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / itemH())));
      if (idx !== selectedIndex) onChange(idx);
      // Snap exactly onto the row in browsers without scroll-snap support.
      if (Math.abs(el.scrollTop - idx * itemH()) > 1) scrollToIndex(idx, true);
    }, 110);
  };

  const move = (next: number) => {
    const idx = Math.max(0, Math.min(items.length - 1, next));
    onChange(idx);
    scrollToIndex(idx, true);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowUp: selectedIndex - 1,
      ArrowDown: selectedIndex + 1,
      PageUp: selectedIndex - VISIBLE_ROWS,
      PageDown: selectedIndex + VISIBLE_ROWS,
      Home: 0,
      End: items.length - 1,
    };
    if (e.key in keys) {
      e.preventDefault();
      move(keys[e.key]);
    }
  };

  return (
    <div className={`wheel-column ${className ?? ''}`}>
      <div
        ref={ref}
        className="wheel-scroll"
        role="listbox"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-activedescendant={items[selectedIndex] ? `${baseId}-${selectedIndex}` : undefined}
        onScroll={handleScroll}
        onKeyDown={onKeyDown}
      >
        <div className="wheel-pad" aria-hidden="true" />
        {items.map((item, i) => (
          <div
            key={item.value}
            id={`${baseId}-${i}`}
            role="option"
            aria-selected={i === selectedIndex}
            className={`wheel-item ${i === selectedIndex ? 'is-selected' : ''}`}
            onClick={() => {
              move(i);
              onPick?.(i);
            }}
          >
            {item.label}
          </div>
        ))}
        <div className="wheel-pad" aria-hidden="true" />
      </div>
    </div>
  );
};

interface WheelSheetProps {
  open: boolean;
  title: string;
  /** Sticky labels shown above the wheels (e.g. วัน | เดือน | พ.ศ. ค.ศ.). */
  header?: React.ReactNode;
  children: React.ReactNode;
  onCancel: () => void;
  onDone: () => void;
  onClear?: () => void;
  /** extra class on the sheet (e.g. a narrow single-wheel popover) */
  className?: string;
  /** false: no Cancel / Done buttons (the picker commits as the wheel moves) */
  actions?: boolean;
  /** Escape key; defaults to onCancel */
  onEscape?: () => void;
  /** a press on this element is not "outside" (e.g. the field's own text input) */
  ignoreRef?: React.RefObject<HTMLElement | null>;
}

export const WheelSheet: React.FC<WheelSheetProps> = ({
  open,
  title,
  header,
  children,
  onCancel,
  onDone,
  onClear,
  className,
  actions = true,
  onEscape,
  ignoreRef,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  // Desktop popover opens upward when there is no room below (like a native select).
  const [above, setAbove] = useState(false);

  useLayoutEffect(() => {
    if (!open) {
      setAbove(false);
      return;
    }
    if (isPhone()) return;
    const sheetEl = sheetRef.current;
    const field = sheetEl?.parentElement;
    if (!sheetEl || !field) return;
    const fieldBox = field.getBoundingClientRect();
    const sheetH = sheetEl.offsetHeight;
    const gap = 8;
    const spaceBelow = window.innerHeight - fieldBox.bottom - gap;
    const spaceAbove = fieldBox.top - gap;
    setAbove(sheetH > spaceBelow && spaceAbove > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        (onEscape ?? onCancel)();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onDone();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (ignoreRef?.current?.contains(target)) return;
      if (sheetRef.current && !sheetRef.current.contains(target)) onCancel();
    };
    window.addEventListener('keydown', onKey);
    // Defer so the click that opened the sheet does not immediately close it.
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onPointer), 0);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
      window.clearTimeout(t);
    };
  }, [open, onCancel, onDone, onEscape]);

  if (!open) return null;

  const sheet = (
    <>
      <div className="wheel-backdrop" aria-hidden="true" />
      <div
        ref={sheetRef}
        className={`wheel-sheet ${above ? 'is-above' : ''} ${className ?? ''}`}
        role="dialog"
        aria-label={title}
      >
        <div className={`wheel-toolbar ${actions ? '' : 'is-title-only'}`}>
          {actions && (
            <button type="button" className="wheel-tool-btn" onClick={onCancel}>
              {tx('ยกเลิก')}
            </button>
          )}
          <strong className="wheel-title">{title}</strong>
          {actions && (
            <button type="button" className="wheel-tool-btn is-done" onClick={onDone}>
              {tx('เสร็จ')}
            </button>
          )}
        </div>
        {header && <div className="wheel-header">{header}</div>}
        <div className="wheel-body">
          <div className="wheel-highlight" aria-hidden="true" />
          {children}
        </div>
        {onClear && (
          <div className="wheel-footer">
            <button type="button" className="wheel-clear-btn" onClick={onClear}>
              {tx('ล้างค่า')}
            </button>
          </div>
        )}
      </div>
    </>
  );

  // Phones: portal to <body> so position: fixed is not trapped by a transformed ancestor
  // (.customer-container keeps a transform from its entrance animation). Desktop keeps the
  // popover anchored under the field.
  return isPhone() ? createPortal(sheet, document.body) : sheet;
};

const isPhone = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 40rem)').matches;

/** Button that looks like a field and opens a WheelSheet. */
export const WheelTrigger: React.FC<{
  id: string;
  label: React.ReactNode;
  placeholder: string;
  hasValue: boolean;
  expanded: boolean;
  onOpen: () => void;
  describedBy?: string;
  /** accessible name when the visible value alone is not enough (e.g. "วัน 12") */
  ariaLabel?: string;
}> = ({ id, label, placeholder, hasValue, expanded, onOpen, describedBy, ariaLabel }) => (
  <button
    id={id}
    type="button"
    className={`wheel-trigger ${hasValue ? '' : 'is-empty'}`}
    aria-label={ariaLabel}
    aria-haspopup="dialog"
    aria-expanded={expanded}
    aria-describedby={describedBy}
    onClick={onOpen}
  >
    <span className="wheel-trigger-value">{hasValue ? label : placeholder}</span>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m7 9 5-5 5 5" />
      <path d="m7 15 5 5 5-5" />
    </svg>
  </button>
);

/** Small helper hook for "edit a draft, commit on Done" pickers. */
export function useDraft<T>(value: T) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T>(value);
  const openWith = (initial: T) => {
    setDraft(initial);
    setOpen(true);
  };
  return { open, setOpen, draft, setDraft, openWith };
}
