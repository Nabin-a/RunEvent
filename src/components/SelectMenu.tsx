import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A drop-in for <select> whose open list looks like every other list in the forms (24 Nov 2026,
 * user request "dropdown style ให้เหมือนกันหมด"): the native list is drawn by the operating
 * system and cannot be styled.
 *
 * - The button takes the field's `id`, so `<label htmlFor>` still points at it.
 * - A hidden real <select> keeps `required` working with the form checks
 *   (reportInvalidFieldsWithin) and its red "invalid" mark shows on the button.
 * - Keyboard: ↑/↓ or Enter/Space open; ↑/↓, Home/End and typing move; Enter picks; Esc closes.
 * - The open list floats over the page (drawn at the page root, fixed to the button), so a
 *   scrolling panel, a table or the editor never cuts it off; with no room below it opens upward.
 *
 * Rule (28 Nov 2026, user request "dropdown select ให้เหมือนกันทั้งระบบ"): every dropdown in the
 * site, the organizer system and the console uses this component — no bare <select> in screens.
 */
export type SelectMenuOption = {
  value: string;
  label: string;
  disabled?: boolean;
  /** a second, smaller line under the label (e.g. a friend's age, or why a choice is off) */
  hint?: string;
  /** a heading drawn above the first option of each group (options of one group sit together) */
  group?: string;
};

export function SelectMenu({
  id: givenId,
  ariaLabel,
  compact,
  value,
  options,
  onChange,
  placeholder,
  required,
  disabled,
  ariaDescribedBy,
  ariaInvalid,
  className,
}: {
  /** the button's id, for <label htmlFor>; omit it when the dropdown has no visible label */
  id?: string;
  /** the name read out when there is no visible <label> */
  ariaLabel?: string;
  /** a shorter box for filter bars and toolbars (same list, same arrow) */
  compact?: boolean;
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  /** shown while nothing is picked (an option with value '' also works) */
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaDescribedBy?: string;
  ariaInvalid?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const nativeRef = useRef<HTMLSelectElement | null>(null);
  const typed = useRef({ text: '', at: 0 });
  const listId = useId();
  const id = givenId ?? `${listId}-btn`;
  /** where the floating list sits: under the button, or above it when the page has no room below */
  const [place, setPlace] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const picked = options.findIndex((o) => o.value === value);
  const current = picked >= 0 ? options[picked] : null;
  const showsPlaceholder = !current || current.value === '';

  const enabled = (i: number) => !!options[i] && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };

  const openList = () => {
    setActive(picked >= 0 ? picked : Math.max(0, options.findIndex((_, i) => enabled(i))));
    setOpen(true);
  };
  const closeList = (refocus: boolean) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  };
  const choose = (i: number) => {
    if (!enabled(i)) return;
    onChange(options[i].value);
    closeList(true);
    // let the form checks see the new value (clears the red mark once it is valid)
    window.setTimeout(() => nativeRef.current?.dispatchEvent(new Event('change', { bubbles: true })), 0);
  };

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!wrapRef.current?.contains(t) && !listRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // place the list against the button; it follows the button while the page or a panel scrolls
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const measure = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const listH = Math.min(listRef.current?.scrollHeight ?? 260, 260) + 8;
      const below = window.innerHeight - r.bottom;
      const up = below < listH && r.top > below;
      setPlace(
        up
          ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4 }
          : { left: r.left, width: r.width, top: r.bottom + 4 }
      );
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  /** type-ahead: letters typed within 0.7s add up ("ภู" -> ภูเก็ต) */
  const typeAhead = (key: string) => {
    const now = Date.now();
    typed.current = { text: now - typed.current.at < 700 ? typed.current.text + key : key, at: now };
    const q = typed.current.text.toLocaleLowerCase();
    const hit = options.findIndex((o, i) => enabled(i) && o.label.toLocaleLowerCase().startsWith(q));
    if (hit >= 0) setActive(hit);
  };

  const onListKey = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((a) => step(a, 1));
        return;
      case 'ArrowUp':
        e.preventDefault();
        setActive((a) => step(a, -1));
        return;
      case 'Home':
        e.preventDefault();
        setActive(step(-1, 1));
        return;
      case 'End':
        e.preventDefault();
        setActive(step(options.length, -1));
        return;
      case 'Enter':
      case ' ':
        if (e.key === ' ' && typed.current.text && Date.now() - typed.current.at < 700) {
          e.preventDefault();
          typeAhead(' ');
          return;
        }
        e.preventDefault();
        choose(active);
        return;
      case 'Escape':
        e.preventDefault();
        closeList(true);
        return;
      case 'Tab':
        setOpen(false);
        return;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeAhead(e.key);
    }
  };

  return (
    <span className={`kr-select${open ? ' is-open' : ''}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`} ref={wrapRef}>
      {/* the real control for the form checks; focus moves on to the button */}
      <select
        ref={nativeRef}
        className="kr-select-native"
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        disabled={disabled}
        value={value}
        onChange={() => undefined}
        onFocus={() => btnRef.current?.focus()}
      >
        {!current && <option value="" />}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        ref={btnRef}
        id={id}
        type="button"
        className={`kr-select-btn ${showsPlaceholder ? 'is-placeholder' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid || undefined}
        disabled={disabled}
        onClick={() => (open ? closeList(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
      >
        <span className="kr-select-value">{showsPlaceholder ? placeholder ?? current?.label ?? '' : current?.label}</span>
        {/* like a native select, the box is as wide as its longest choice, so a toolbar does not
            jump when another value is picked; these copies are invisible and take no height */}
        <span className="kr-select-sizer" aria-hidden="true">
          {placeholder && <span>{placeholder}</span>}
          {options.map((o) => (
            <span key={o.value}>{o.label}</span>
          ))}
        </span>
      </button>
      {open &&
        createPortal(
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={`kr-menu is-floating${compact ? ' is-compact' : ''}${place?.bottom !== undefined ? ' is-up' : ''}`}
          style={place ? { left: place.left, minWidth: place.width, top: place.top, bottom: place.bottom } : { visibility: 'hidden' }}
          aria-labelledby={id}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <React.Fragment key={o.value}>
            {/* sections of a grouped list are set apart by a line (28 Nov 2026, user request):
                a heading starts each group; an option after a group with none of its own gets the line only */}
            {o.group && o.group !== options[i - 1]?.group && (
              <li role="presentation" className={`kr-menu-group${i > 0 ? ' has-rule' : ''}`}>
                {o.group}
              </li>
            )}
            {!o.group && i > 0 && options[i - 1]?.group && <li role="presentation" className="kr-menu-rule" />}
            <li
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === picked}
              aria-disabled={o.disabled || undefined}
              className={`kr-menu-item ${i === active ? 'is-active' : ''} ${i === picked ? 'is-picked' : ''}${o.hint ? ' has-hint' : ''}`}
              onPointerEnter={() => enabled(i) && setActive(i)}
              onClick={() => choose(i)}
            >
              {o.hint ? (
                <>
                  <span className="kr-menu-label">{o.label}</span>
                  <small className="kr-menu-hint">{o.hint}</small>
                </>
              ) : (
                o.label
              )}
            </li>
            </React.Fragment>
          ))}
        </ul>,
        // inside the app root so the page's theme colours still apply
        wrapRef.current?.closest('.app-root') ?? document.body
      )}
    </span>
  );
}
