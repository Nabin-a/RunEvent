import { useId, useRef, useState } from 'react';
import type { EventProduct } from '../types';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { useDismiss } from '../utils/useDismiss';
import { ProductArt, souvenirArt } from './ProductArt';
import type { CartLine } from './StorefrontView';
import { IconBag, IconChevronDown, IconClose } from './Icons';

const MAX_QTY = 10;

/**
 * The sticky bar under the souvenir step and its cart (27 Nov 2026, user request "click แล้วเด้ง
 * ไปที่ตะกร้า", pick "แผงตะกร้าเด้งขึ้นจากแถบ"). A tap on the bar opens the cart right above it:
 * every picked line with its picture, size, quantity (− / +), a remove button and the line
 * total, then the sum. A tap on the bar again, outside the cart or Escape closes it. The round
 * X clears every pick. Used by all three souvenir layouts.
 */
export function SouvenirCartBar({
  products,
  value,
  onChange,
  onClearAll,
}: {
  products: EventProduct[];
  value: CartLine[];
  onChange: (next: CartLine[]) => void;
  /** clears the picks and whatever the layout keeps beside them (opened cards, sizes) */
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  useDismiss(open, [wrapRef], () => setOpen(false));

  const lines = value
    .map((l) => ({ ...l, prd: products.find((p) => p.id === l.productId) }))
    .filter((l): l is CartLine & { prd: EventProduct } => Boolean(l.prd));
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);
  const isOpen = open && lines.length > 0;

  const setQty = (id: string, size: string, qty: number) => {
    const rest = value.filter((l) => !(l.productId === id && l.size === size));
    const next = qty > 0 ? value.map((l) => (l.productId === id && l.size === size ? { ...l, qty } : l)) : rest;
    onChange(next);
    if (next.length === 0) setOpen(false);
  };
  const roomFor = (p: EventProduct, size: string) => {
    const left = Math.max(0, p.stockOrCeiling - p.soldCount);
    const picked = value.filter((l) => l.productId === p.id).reduce((n, l) => n + l.qty, 0);
    const here = value.find((l) => l.productId === p.id && l.size === size)?.qty ?? 0;
    return Math.min(MAX_QTY, left - picked + here);
  };

  if (lines.length === 0) {
    return (
      <div className="sv-bar" aria-live="polite">
        <span className="sv-bar-empty">{tx('ยังไม่ได้เลือกของที่ระลึก รับเฉพาะสิทธิ์สมัครวิ่ง')}</span>
      </div>
    );
  }

  return (
    <div className={`sv-bar-wrap ${isOpen ? 'is-open' : ''}`} ref={wrapRef}>
      {isOpen && (
        <section id={panelId} className="sv-cart" aria-label={tx('ตะกร้าของที่ระลึก')}>
          <header className="sv-cart-head">
            <strong>{tx('ตะกร้าของที่ระลึก')}</strong>
            <span>{txf('{0} ชิ้น', count)}</span>
            {/* clear the whole cart from inside it too (27 Nov 2026, user request) */}
            <button
              type="button"
              className="sv-cart-clear"
              onClick={() => {
                setOpen(false);
                onClearAll();
              }}
            >
              {tx('ลบทั้งหมด')}
            </button>
          </header>
          <ul className="sv-cart-lines">
            {lines.map((l) => {
              const room = roomFor(l.prd, l.size);
              const name = tx(l.prd.nameTh);
              return (
                <li key={`${l.productId}-${l.size}`} className="sv-cart-line">
                  <span className="sv-cart-art" aria-hidden="true">
                    <ProductArt
                      categoryLabel={l.prd.categoryLabel}
                      name={l.prd.nameTh}
                      kind={souvenirArt(l.prd.categoryLabel, l.prd.nameTh)}
                      className="sf-art-svg"
                    />
                  </span>
                  <span className="sv-cart-copy">
                    <strong>{name}</strong>
                    <span>
                      {l.size !== '-' ? `${tx('ไซส์')} ${tx(l.size)} · ` : ''}
                      {formatThb(l.prd.priceSatang, true)}
                    </span>
                  </span>
                  <span className="sf-qty sv-qty" role="group" aria-label={txf('จำนวนของ {0}', name)}>
                    <button
                      type="button"
                      onClick={() => setQty(l.productId, l.size, l.qty - 1)}
                      aria-label={tx('ลดจำนวน')}
                    >
                      −
                    </button>
                    <span className="mono-num" aria-live="polite">
                      {l.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(l.productId, l.size, l.qty + 1)}
                      disabled={l.qty >= room}
                      aria-label={tx('เพิ่มจำนวน')}
                    >
                      +
                    </button>
                  </span>
                  <strong className="mono-num sv-cart-sum">{formatThb(l.prd.priceSatang * l.qty, true)}</strong>
                  <button
                    type="button"
                    className="sv-cart-remove"
                    aria-label={txf('เอา {0} ออก', name)}
                    onClick={() => setQty(l.productId, l.size, 0)}
                  >
                    <IconClose size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
          <footer className="sv-cart-foot">
            <span>{tx('รวมของที่ระลึก')}</span>
            <strong className="mono-num">{formatThb(total, true)}</strong>
          </footer>
        </section>
      )}

      <div className="sv-bar" aria-live="polite">
        <button
          type="button"
          className="sv-bar-open"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          <IconBag size={18} />
          <span>{txf('เลือกแล้ว {0} ชิ้น', count)}</span>
          <strong className="mono-num sv-bar-total">+{formatThb(total, true)}</strong>
          <span className="sv-bar-chevron" aria-hidden="true">
            <IconChevronDown size={18} />
          </span>
        </button>
        <button
          type="button"
          className="sv-bar-clear"
          aria-label={tx('ไม่ซื้อเพิ่ม (ล้างของที่เลือกทั้งหมด)')}
          title={tx('ไม่ซื้อเพิ่ม')}
          onClick={() => {
            setOpen(false);
            onClearAll();
          }}
        >
          <IconClose size={16} />
        </button>
      </div>
    </div>
  );
}
