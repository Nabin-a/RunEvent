import { useMemo, useRef, useState } from 'react';
import type { EventProduct } from '../types';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { ProductArt, souvenirArt } from './ProductArt';
import type { CartLine } from './StorefrontView';
import { IconBag } from './Icons';

const ALL = 'all';
const MAX_QTY = 10;
const PAGE_SIZE = 6;

/**
 * Souvenirs bought together with the race entry (forms A and B): several products, several
 * sizes of the same product, and a quantity for each. Each line becomes its own merch order
 * linked to the entry; the entry total is not changed. Stock is checked again by the server.
 * One product per row (name and price never squeezed); sizes and quantity on a second row.
 * Six products per page; picks on other pages stay counted in the bar.
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
  // sold-out items are hidden (26 Nov 2026, user request); `products` still prices lines already in the cart
  const onSale = useMemo(() => products.filter((p) => p.stockOrCeiling - p.soldCount > 0), [products]);
  const categories = useMemo(() => [...new Set(onSale.map((p) => p.categoryLabel))], [onSale]);
  const [filter, setFilter] = useState<string>(ALL);
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // size being edited on each card
  const [sizeOf, setSizeOf] = useState<Record<string, string>>({});

  const filtered = filter === ALL ? onSale : onSale.filter((p) => p.categoryLabel === filter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageNow = Math.min(page, pageCount - 1);
  const shown = filtered.slice(pageNow * PAGE_SIZE, pageNow * PAGE_SIZE + PAGE_SIZE);
  // from the bottom buttons, bring the start of the new page (and the top buttons) into view
  const goPage = (n: number, from: 'top' | 'bottom') => {
    setPage(n);
    if (from === 'bottom') listRef.current?.scrollIntoView({ block: 'start' });
  };
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

  const qtyStepper = (p: EventProduct, size: string, qty: number, room: number, out: boolean) => (
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
  );

  const pickedCount = picked.reduce((n, l) => n + l.qty, 0);

  // the same page buttons above and below the list
  const pager = (where: 'top' | 'bottom') =>
    pageCount > 1 && (
        <nav className={`sv-pager is-${where}`} aria-label={where === 'top' ? tx('หน้ารายการของที่ระลึก (บน)') : tx('หน้ารายการของที่ระลึก')}>
          <span className="sv-pager-range">
            {txf(
              'แสดง {0}–{1} จาก {2} รายการ',
              pageNow * PAGE_SIZE + 1,
              pageNow * PAGE_SIZE + shown.length,
              filtered.length
            )}
          </span>
          <div className="sv-pager-buttons">
            <button
              type="button"
              className="sv-pager-btn"
              onClick={() => goPage(pageNow - 1, where)}
              disabled={pageNow === 0}
              aria-label={tx('หน้าก่อนหน้า')}
            >
              ‹
            </button>
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                className={`sv-pager-btn ${i === pageNow ? 'is-current' : ''}`}
                aria-current={i === pageNow ? 'page' : undefined}
                aria-label={txf('หน้า {0}', i + 1)}
                onClick={() => goPage(i, where)}
              >
                {i + 1}
              </button>
            ))}
            <button
              type="button"
              className="sv-pager-btn"
              onClick={() => goPage(pageNow + 1, where)}
              disabled={pageNow >= pageCount - 1}
              aria-label={tx('หน้าถัดไป')}
            >
              ›
            </button>
          </div>
        </nav>
    );


  return (
    <div className="sv">
      <p className="muted-block">{tx('ภาพตัวอย่างประจำหมวดสินค้า กรุณาดูรายละเอียดของแต่ละรายการ')}</p>
      <div className="sf-filters" role="group" aria-label={tx('ประเภทของที่ระลึก')}>
        {[ALL, ...categories].map((c) => (
          <button
            key={c}
            type="button"
            className={`kr-chip ${filter === c ? 'is-on' : ''}`}
            aria-pressed={filter === c}
            onClick={() => {
              setFilter(c);
              setPage(0);
            }}
          >
            {c === ALL ? tx('ทั้งหมด') : tx(c)}{' '}
            <span className="mono-num sv-chip-count">
              {c === ALL ? onSale.length : onSale.filter((p) => p.categoryLabel === c).length}
            </span>
          </button>
        ))}
      </div>

      {pager('top')}

      <div className="sv-list" ref={listRef}>
        {shown.map((p) => {
          const left = Math.max(0, p.stockOrCeiling - p.soldCount);
          const size = sizeOf[p.id] ?? p.availableSizes[0] ?? '-';
          const qty = qtyOf(p.id, size);
          const room = Math.min(MAX_QTY, left - totalOf(p.id) + qty);
          const out = left <= 0;
          const hasSizes = p.availableSizes.length > 1;
          return (
            <article key={p.id} className={`sv-item ${totalOf(p.id) > 0 ? 'is-picked' : ''} ${out ? 'is-out' : ''}`}>
              <div className={`sv-main ${hasSizes ? '' : 'has-qty'}`}>
                <div className="sv-art" aria-hidden="true">
                  <ProductArt categoryLabel={p.categoryLabel} name={p.nameTh} kind={souvenirArt(p.categoryLabel, p.nameTh)} className="sf-art-svg" />
                </div>
                <div className="sv-copy">
                  <strong className="sv-name">{tx(p.nameTh)}</strong>
                  <span className="sv-meta">
                    {p.saleMode === 'preorder' ? tx('พรีออเดอร์') : tx('พร้อมส่ง')}
                    {out && <> · {tx('หมดแล้ว')}</>}
                  </span>
                </div>
                <span className="mono-num sv-price">{formatThb(p.priceSatang, true)}</span>
                {!hasSizes && qtyStepper(p, size, qty, room, out)}
              </div>
              {hasSizes && (
                <div className="sv-opts">
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
                  {qtyStepper(p, size, qty, room, out)}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {pager('bottom')}

      <div className="sv-bar" aria-live="polite">
        {picked.length === 0 ? (
          <span className="sv-bar-empty">{tx('ยังไม่ได้เลือกของที่ระลึก รับเฉพาะสิทธิ์สมัครวิ่ง')}</span>
        ) : (
          <>
            <IconBag size={18} />
            <span>{txf('เลือกแล้ว {0} ชิ้น', pickedCount)}</span>
            <strong className="mono-num sv-bar-total">+{formatThb(pickedTotal, true)}</strong>
            <button type="button" className="btn-ghost-sm" onClick={() => onChange([])}>
              {tx('ไม่ซื้อเพิ่ม')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
