import React, { useEffect, useId, useState } from 'react';
import type { RunnerSavedAddress } from '../types';
import { tx } from '../i18n';
import { IconCheckCircle, IconMapPin, IconPlus } from './Icons';

/** value of the "add a new address" row */
export const NEW_ADDRESS = '__new';

const shortLine = (a: RunnerSavedAddress) =>
  `${a.recipientName} · ${a.address} ${a.subdistrict} ${a.district} ${a.province} ${a.postalCode}`;

/**
 * Shipping address picker for the register form: every address in the runner's
 * address book plus a last "add a new address" row. A custom listbox (same list
 * style as the home search) because each option needs two lines: the address
 * name and who/where it goes to. Keyboard: arrows, Home/End, Enter/Space, Escape.
 */
export function SavedAddressSelect({
  addresses,
  value,
  onChange,
  labelledBy,
}: {
  addresses: RunnerSavedAddress[];
  /** id of the picked address, or NEW_ADDRESS */
  value: string;
  onChange: (value: string) => void;
  /** id of the visible field label */
  labelledBy: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const values = [...addresses.map((a) => a.id), NEW_ADDRESS];
  const selectedIndex = Math.max(0, values.indexOf(value));
  const picked = addresses.find((a) => a.id === value);
  const optId = (i: number) => `${listId}-o${i}`;

  // on open, scroll the form so the whole list shows (the register form scrolls inside
  // its own panel, which would otherwise hide the last rows below its edge)
  useEffect(() => {
    if (open) document.getElementById(listId)?.scrollIntoView({ block: 'nearest' });
  }, [open, listId]);

  // keep the keyboard row in view when the list scrolls
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-o${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const choose = (i: number) => {
    onChange(values[i]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = values.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(last, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className="addr-select">
      <button
        type="button"
        className={`addr-select-trigger ${open ? 'is-open' : ''}`}
        role="combobox"
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? optId(active) : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
      >
        <span className="kr-sg-icon" aria-hidden="true">
          {picked ? <IconMapPin size={16} /> : <IconPlus size={16} />}
        </span>
        <span className="kr-sg-text">
          {picked ? (
            <>
              <span className="kr-sg-title">
                {picked.addressName}
                {picked.isDefault && <span className="addr-default-tag">{tx('ค่าเริ่มต้น')}</span>}
              </span>
              <span className="kr-sg-meta addr-select-meta">{shortLine(picked)}</span>
            </>
          ) : (
            <>
              <span className="kr-sg-title">{tx('เพิ่มที่อยู่ใหม่')}</span>
              <span className="kr-sg-meta">{tx('กรอกที่อยู่ด้านล่าง บันทึกลงสมุดหรือใช้เฉพาะครั้งนี้ก็ได้')}</span>
            </>
          )}
        </span>
      </button>

      <ul
        id={listId}
        role="listbox"
        aria-labelledby={labelledBy}
        className="kr-suggest addr-select-list"
        hidden={!open}
      >
        {addresses.map((a, i) => (
          <li
            key={a.id}
            id={optId(i)}
            role="option"
            aria-selected={i === selectedIndex}
            className={`kr-sg-item ${i === active ? 'is-active' : ''}`}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => choose(i)}
          >
            <span className="kr-sg-icon" aria-hidden="true">
              <IconMapPin size={16} />
            </span>
            <span className="kr-sg-text">
              <span className="kr-sg-title">
                {a.addressName}
                {a.isDefault && <span className="addr-default-tag">{tx('ค่าเริ่มต้น')}</span>}
              </span>
              <span className="kr-sg-meta addr-select-meta">{shortLine(a)}</span>
            </span>
            {i === selectedIndex && (
              <span className="kr-sg-check" aria-hidden="true">
                <IconCheckCircle size={18} />
              </span>
            )}
          </li>
        ))}
        <li
          id={optId(addresses.length)}
          role="option"
          aria-selected={selectedIndex === addresses.length}
          className={`kr-sg-item has-divider addr-select-new ${active === addresses.length ? 'is-active' : ''}`}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setActive(addresses.length)}
          onClick={() => choose(addresses.length)}
        >
          <span className="kr-sg-icon" aria-hidden="true">
            <IconPlus size={16} />
          </span>
          <span className="kr-sg-text">
            <span className="kr-sg-title">{tx('เพิ่มที่อยู่ใหม่')}</span>
          </span>
          {selectedIndex === addresses.length && (
            <span className="kr-sg-check" aria-hidden="true">
              <IconCheckCircle size={18} />
            </span>
          )}
        </li>
      </ul>

      {picked && (
        <div className="addr-picked" aria-live="polite">
          <strong>
            {picked.recipientName} <span className="mono-num">({picked.phone})</span>
          </strong>
          <span>
            {picked.address} ต.{picked.subdistrict} อ.{picked.district} จ.{picked.province}{' '}
            <span className="mono-num">{picked.postalCode}</span>
          </span>
        </div>
      )}
    </div>
  );
}
