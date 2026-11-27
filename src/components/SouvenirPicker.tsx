import { useMemo, useState } from 'react';
import type { EventProduct } from '../types';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { ProductArt, souvenirArt } from './ProductArt';
import type { CartLine } from './StorefrontView';
import { IconChevronDown } from './Icons';
import { SouvenirCartBar } from './SouvenirCartBar';

const MAX_QTY = 10;

/**
 * Souvenirs bought together with the race entry. Each line becomes its own merch order linked
 * to the entry; the entry total is not changed, and the server checks stock again.
 *
 * Redesign (27 Nov 2026, user pick "ก"): no category filter chips and no pages, a card with a
 * large picture per product. "เพิ่ม" opens the card: a product with sizes asks for the size
 * first, then the quantity; a product without sizes starts at one. The bar under the categories
 * sums up what was picked.
 *
 * Categories fold (27 Nov 2026, user request): each one is a header with small pictures of what
 * it holds and what was picked in it; a tap opens its products underneath. Several
 * can be open at once. All start folded, except a category that already has picks (coming back
 * to this step).
 */
/** 'classic' = the first version (filter chips and pages), see SouvenirPickerClassic */
export type SouvenirLayout = 'accordion' | 'shelves' | 'classic';

export function SouvenirPicker({
  products,
  value,
  onChange,
  layout = 'accordion',
}: {
  products: EventProduct[];
  value: CartLine[];
  onChange: (next: CartLine[]) => void;
  /** 'accordion' = folding categories (default); 'shelves' = the earlier open shelves, kept as a
   *  Dev / Demo choice (27 Nov 2026, user request) */
  layout?: SouvenirLayout;
}) {
  const folds = layout === 'accordion';
  // sold-out items are hidden (26 Nov 2026, user request); `products` still prices lines already in the cart
  const onSale = useMemo(() => products.filter((p) => p.stockOrCeiling - p.soldCount > 0), [products]);
  // shelves in the order the organizer listed the products
  const shelves = useMemo(() => {
    const order: string[] = [];
    const by = new Map<string, EventProduct[]>();
    for (const p of onSale) {
      if (!by.has(p.categoryLabel)) {
        by.set(p.categoryLabel, []);
        order.push(p.categoryLabel);
      }
      by.get(p.categoryLabel)!.push(p);
    }
    return order.map((label, i) => ({ label, key: `sv-shelf-${i}`, items: by.get(label)! }));
  }, [onSale]);

  // open categories: the ones with picks when the step is shown, the rest folded
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const l of value) {
      const p = products.find((x) => x.id === l.productId);
      if (p) m[p.categoryLabel] = true;
    }
    return m;
  });

  // cards the runner opened with "เพิ่ม" (a card with something picked is always open)
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  // size being set on each sized card
  const [sizeOf, setSizeOf] = useState<Record<string, string>>({});

  const qtyOf = (id: string, size: string) => value.find((l) => l.productId === id && l.size === size)?.qty ?? 0;
  const totalOf = (id: string) => value.filter((l) => l.productId === id).reduce((n, l) => n + l.qty, 0);
  const setQty = (id: string, size: string, qty: number) => {
    const rest = value.filter((l) => !(l.productId === id && l.size === size));
    onChange(qty > 0 ? [...rest, { productId: id, size, qty }] : rest);
  };

  const picked = value
    .map((l) => ({ ...l, prd: products.find((p) => p.id === l.productId) }))
    .filter((l): l is CartLine & { prd: EventProduct } => Boolean(l.prd));

  const stepper = (p: EventProduct, size: string, qty: number, room: number) => (
    <div
      className="sf-qty sv-qty"
      role="group"
      aria-label={txf('จำนวนของ {0}', `${tx(p.nameTh)}${size !== '-' ? ` ${size}` : ''}`)}
    >
      <button type="button" onClick={() => setQty(p.id, size, qty - 1)} disabled={qty <= 0} aria-label={tx('ลดจำนวน')}>
        −
      </button>
      <span className="mono-num" aria-live="polite">
        {qty}
      </span>
      <button
        type="button"
        onClick={() => setQty(p.id, size, qty + 1)}
        disabled={qty >= room}
        aria-label={tx('เพิ่มจำนวน')}
      >
        +
      </button>
    </div>
  );

  const card = (p: EventProduct) => {
    const left = Math.max(0, p.stockOrCeiling - p.soldCount);
    const hasSizes = p.availableSizes.length > 1;
    const total = totalOf(p.id);
    const open = opened[p.id] || total > 0;
    const size = hasSizes ? sizeOf[p.id] ?? '' : p.availableSizes[0] ?? '-';
    const qty = size ? qtyOf(p.id, size) : 0;
    const room = Math.min(MAX_QTY, left - total + qty);
    const name = tx(p.nameTh);

    return (
      <article key={p.id} className={`sv-card ${total > 0 ? 'is-picked' : ''}`} aria-label={name}>
        <div className="sv-card-art" aria-hidden="true">
          <ProductArt
            categoryLabel={p.categoryLabel}
            name={p.nameTh}
            kind={souvenirArt(p.categoryLabel, p.nameTh)}
            className="sf-art-svg"
          />
          {total > 0 && <span className="sv-card-count mono-num">×{total}</span>}
        </div>
        <div className="sv-card-copy">
          <strong className="sv-name">{name}</strong>
          <span className="sv-card-line">
            <span className="mono-num sv-price">{formatThb(p.priceSatang, true)}</span>
            <span className="sv-meta">{p.saleMode === 'preorder' ? tx('พรีออเดอร์') : tx('พร้อมส่ง')}</span>
          </span>
        </div>

        {!open ? (
          <button
            type="button"
            className="btn-secondary sv-add"
            onClick={() => {
              setOpened((m) => ({ ...m, [p.id]: true }));
              // nothing to choose: the first tap adds one
              if (!hasSizes) setQty(p.id, size, 1);
            }}
          >
            + {tx('เพิ่ม')}
          </button>
        ) : (
          <div className="sv-card-opts">
            {hasSizes && (
              <fieldset className="sv-sizes">
                <legend className="sv-sizes-label">{size ? tx('ไซส์') : tx('เลือกไซส์')}</legend>
                {p.availableSizes.map((s) => {
                  const n = qtyOf(p.id, s);
                  return (
                    <label key={s} className={`pg-chip ${size === s ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name={`sv-size-${p.id}`}
                        checked={size === s}
                        onChange={() => {
                          setSizeOf((m) => ({ ...m, [p.id]: s }));
                          // a size picked for the first time starts at one
                          if (qtyOf(p.id, s) === 0 && total < Math.min(MAX_QTY, left)) setQty(p.id, s, 1);
                        }}
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
            {size && stepper(p, size, qty, room)}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="sv">
      {shelves.map((sh) => {
        if (!folds) {
          // the earlier layout: every category open, a plain heading over its cards
          return (
            <section key={sh.key} className="sv-shelf-plain" aria-labelledby={sh.key}>
              <h3 id={sh.key} className="sv-shelf-plain-head">
                {tx(sh.label)}
              </h3>
              <div className="sv-grid">{sh.items.map(card)}</div>
            </section>
          );
        }
        const open = Boolean(openCats[sh.label]);
        const inCat = picked.filter((l) => l.prd.categoryLabel === sh.label);
        const inCatCount = inCat.reduce((n, l) => n + l.qty, 0);
        const inCatTotal = inCat.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);
        return (
          <section key={sh.key} className={`sv-shelf ${open ? 'is-open' : ''}`}>
            <h3 className="sv-shelf-title">
              <button
                type="button"
                className="sv-shelf-head"
                aria-expanded={open}
                aria-controls={`${sh.key}-body`}
                onClick={() => setOpenCats((m) => ({ ...m, [sh.label]: !open }))}
              >
                {/* small pictures of what the category holds */}
                <span className="sv-shelf-thumbs" aria-hidden="true">
                  {sh.items.slice(0, 3).map((p) => (
                    <span key={p.id} className="sv-shelf-thumb">
                      <ProductArt
                        categoryLabel={p.categoryLabel}
                        name={p.nameTh}
                        kind={souvenirArt(p.categoryLabel, p.nameTh)}
                        className="sf-art-svg"
                      />
                    </span>
                  ))}
                </span>
                <span className="sv-shelf-copy">
                  <strong>{tx(sh.label)}</strong>
                  {/* no item count (27 Nov 2026, user request); only what was picked here */}
                  <span className="sv-shelf-meta">
                    {inCatCount > 0 && (
                      <span className="sv-shelf-picked">
                        {txf('เลือกแล้ว {0} ชิ้น', inCatCount)} · {formatThb(inCatTotal, true)}
                      </span>
                    )}
                  </span>
                </span>
                <span className="sv-shelf-chevron" aria-hidden="true">
                  <IconChevronDown size={20} />
                </span>
              </button>
            </h3>
            {open && (
              <div id={`${sh.key}-body`} className="sv-grid">
                {sh.items.map(card)}
              </div>
            )}
          </section>
        );
      })}

      {/* the bar opens the cart (27 Nov 2026, user request) */}
      <SouvenirCartBar
        products={products}
        value={value}
        onChange={onChange}
        onClearAll={() => {
          onChange([]);
          setOpened({});
          setSizeOf({});
        }}
      />
    </div>
  );
}
