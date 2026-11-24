import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * A drop-in for <select> whose open list looks like every other list in the forms (24 Nov 2026,
 * user request "dropdown style ให้เหมือนกันหมด"): the native list is drawn by the operating
 * system and cannot be styled.
 *
 * - The button takes the field's `id`, so `<label htmlFor>` still points at it.
 * - A hidden real <select> keeps `required` working with the form checks
 *   (reportInvalidFieldsWithin) and its red "invalid" mark shows on the button.
 * - Keyboard: ↑/↓ or Enter/Space open; ↑/↓, Home/End and typing move; Enter picks; Esc closes.
 */
export type SelectMenuOption = { value: string; label: string; disabled?: boolean };

export function SelectMenu({
  id,
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
  id: string;
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
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
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
    <span className={`kr-select ${open ? 'is-open' : ''} ${className ?? ''}`} ref={wrapRef}>
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
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className="kr-menu"
          aria-labelledby={id}
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === picked}
              aria-disabled={o.disabled || undefined}
              className={`kr-menu-item ${i === active ? 'is-active' : ''} ${i === picked ? 'is-picked' : ''}`}
              onPointerEnter={() => enabled(i) && setActive(i)}
              onClick={() => choose(i)}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
