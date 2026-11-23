import { useMemo, useState } from 'react';
import type { EventProduct } from '../types';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { ProductArt, souvenirArt } from './ProductArt';
import type { CartLine } from './StorefrontView';

const ALL = 'all';
const MAX_QTY = 10;

/**
 * Souvenirs bought together with the race entry (forms A and B): several products, several
 * sizes of the same product, and a quantity for each. Each line becomes its own merch order
 * linked to the entry; the entry total is not changed. Stock is checked again by the server.
 */
export function SouvenirPicker({
  products,
  value,
  onChange,
}: {
  products: EventProduct[];
  value: CartLine[];
  onChange: (next: CartLine[]) => void;
}) {
  const categories = useMemo(() => [...new Set(products.map((p) => p.categoryLabel))], [products]);
  const [filter, setFilter] = useState<string>(ALL);
  // size being edited on each card
  const [sizeOf, setSizeOf] = useState<Record<string, string>>({});

  const shown = filter === ALL ? products : products.filter((p) => p.categoryLabel === filter);
  const qtyOf = (id: string, size: string) => value.find((l) => l.productId === id && l.size === size)?.qty ?? 0;
  const totalOf = (id: string) => value.filter((l) => l.productId === id).reduce((n, l) => n + l.qty, 0);

  const setQty = (id: string, size: string, qty: number) => {
    const rest = value.filter((l) => !(l.productId === id && l.size === size));
    onChange(qty > 0 ? [...rest, { productId: id, size, qty }] : rest);
  };

  const picked = value
    .map((l) => ({ ...l, prd: products.find((p) => p.id === l.productId) }))
    .filter((l): l is CartLine & { prd: EventProduct } => Boolean(l.prd));
  const pickedTotal = picked.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);

  return (
    <div className="sv">
      <div className="sf-filters" role="group" aria-label={tx('ประเภทของที่ระลึก')}>
        {[ALL, ...categories].map((c) => (
          <button
            key={c}
            type="button"
            className={`kr-chip ${filter === c ? 'is-on' : ''}`}
            aria-pressed={filter === c}
            onClick={() => setFilter(c)}
          >
            {c === ALL ? tx('ทั้งหมด') : tx(c)}
          </button>
        ))}
      </div>

      <div className="sv-list">
        {shown.map((p) => {
          const left = Math.max(0, p.stockOrCeiling - p.soldCount);
          const size = sizeOf[p.id] ?? p.availableSizes[0] ?? '-';
          const qty = qtyOf(p.id, size);
          const room = Math.min(MAX_QTY, left - totalOf(p.id) + qty);
          const out = left <= 0;
          return (
            <article key={p.id} className={`sv-item ${totalOf(p.id) > 0 ? 'is-picked' : ''} ${out ? 'is-out' : ''}`}>
              <div className="sv-art" aria-hidden="true">
                <ProductArt kind={souvenirArt(p.categoryLabel, p.nameTh)} className="sf-art-svg" />
              </div>
              <div className="sv-copy">
                <strong>{tx(p.nameTh)}</strong>
                <span className="mono-num sv-price">+{formatThb(p.priceSatang, true)}</span>
                <span className="muted-inline">
                  {p.saleMode === 'preorder' ? tx('พรีออเดอร์') : tx('พร้อมส่ง')} ·{' '}
                  {out ? tx('หมดแล้ว') : txf('เหลือ {0} ชิ้น', left)} · {tx('ภาพตัวอย่าง')}
                </span>
                {p.availableSizes.length > 1 && (
                  <fieldset className="sv-sizes" disabled={out}>
                    <legend className="sr-only">{txf('เลือกแบบของ {0}', tx(p.nameTh))}</legend>
                    {p.availableSizes.map((s) => {
                      const n = qtyOf(p.id, s);
                      return (
                        <label key={s} className={`pg-chip ${size === s ? 'is-selected' : ''}`}>
                          <input
                            type="radio"
                            name={`sv-size-${p.id}`}
                            checked={size === s}
                            onChange={() => setSizeOf((m) => ({ ...m, [p.id]: s }))}
                          />
                          <span>
                            {tx(s)}
                            {n > 0 ? ` ×${n}` : ''}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>
                )}
              </div>
              <div
                className="sf-qty sv-qty"
                role="group"
                aria-label={txf('จำนวนของ {0}', `${tx(p.nameTh)}${size !== '-' ? ` ${size}` : ''}`)}
              >
                <button
                  type="button"
                  onClick={() => setQty(p.id, size, qty - 1)}
                  disabled={qty <= 0}
                  aria-label={tx('ลดจำนวน')}
                >
                  −
                </button>
                <span className="mono-num" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(p.id, size, qty + 1)}
                  disabled={out || qty >= room}
                  aria-label={tx('เพิ่มจำนวน')}
                >
                  +
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="sv-summary" aria-live="polite">
        {picked.length === 0 ? (
          <span className="muted-inline">{tx('ยังไม่ได้เลือกของที่ระลึก รับเฉพาะสิทธิ์สมัครวิ่ง')}</span>
        ) : (
          <>
            <ul>
              {picked.map((l) => (
                <li key={`${l.productId}-${l.size}`}>
                  <span>
                    {tx(l.prd.nameTh)}
                    {l.size !== '-' ? ` · ${l.size}` : ''} × {l.qty}
                  </span>
                  <span className="mono-num">{formatThb(l.prd.priceSatang * l.qty, true)}</span>
                </li>
              ))}
            </ul>
            <div className="sv-summary-foot">
              <strong>{txf('ของที่ระลึก {0} ชิ้น', picked.reduce((n, l) => n + l.qty, 0))}</strong>
              <strong className="mono-num">+{formatThb(pickedTotal, true)}</strong>
              <button type="button" className="btn-ghost-sm" onClick={() => onChange([])}>
                {tx('ไม่ซื้อเพิ่ม')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
