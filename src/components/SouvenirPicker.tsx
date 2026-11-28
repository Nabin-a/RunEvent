import { useEffect, useMemo, useRef, useState } from 'react';
import type { EventProduct } from '../types';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { ProductArt, souvenirArt } from './ProductArt';
import type { CartLine } from './StorefrontView';
import { IconChevronDown } from './Icons';
import { SouvenirCartBar } from './SouvenirCartBar';
import { Pager } from './ListPager';

const MAX_QTY = 10;

/** a category shows its cards a page at a time (28 Nov 2026, user request "pagination"): one row
    of three on a wide card grid, two rows of two on a narrow one */
const PAGE_WIDE = 3;
const PAGE_NARROW = 4;
/** the card grid has three columns from this width up (styles.css, `.sv-grid` container query) */
const WIDE_FROM_REM = 36;

/** the shirt cut, for the type chips of the souvenir shirt category */
export function shirtTypeOf(nameTh: string): string {
  if (/แขนยาว|long sleeve/i.test(nameTh)) return 'แขนยาว';
  if (/กล้าม|singlet|tank/i.test(nameTh)) return 'เสื้อกล้าม';
  if (/แขนกุด|sleeveless/i.test(nameTh)) return 'แขนกุด';
  return 'แขนสั้น';
}
const ALL_TYPES = '';

/**
 * Souvenirs bought together with the race entry. Each line becomes its own merch order linked
 * to the entry; the entry total is not changed, and the server checks stock again.
 *
 * Redesign (27 Nov 2026, user pick "ก"): no category filter chips and no pages, a card with a
 * large picture per product. "เพิ่ม" opens the card: a product with sizes asks for the size
 * first, then the quantity; a product without sizes starts at one. The bar under the categories
 * sums up what was picked.
 *
 * Picking a size does not put anything in the cart (28 Nov 2026, user request): the runner sets
 * how many, then presses "เพิ่ม". A size already in the cart shows the cart's own count. Sizes
 * show on the card from the start.
 *
 * Categories fold (27 Nov 2026, user request): each one is a header with small pictures of what
 * it holds and what was picked in it; a tap opens its products underneath. Several
 * can be open at once. All start folded, except a category that already has picks (coming back
 * to this step).
 */
/* The folding categories are the only layout (28 Nov 2026, user request): the open shelves and
   the first version (SouvenirPickerClassic) are no longer offered in Dev / Demo. */
export function SouvenirPicker({
  products,
  value,
  onChange,
}: {
  products: EventProduct[];
  value: CartLine[];
  onChange: (next: CartLine[]) => void;
}) {
  // cards per page follow the grid's columns, measured on this box
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [perPage, setPerPage] = useState(PAGE_WIDE);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const fit = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setPerPage(el.clientWidth >= WIDE_FROM_REM * rem ? PAGE_WIDE : PAGE_NARROW);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
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
  // how many to put in the cart for a size not in it yet (starts at one)
  const [draftOf, setDraftOf] = useState<Record<string, number>>({});
  // per category: the shirt type picked in its chips ('' = all) and the page shown
  const [typeIn, setTypeIn] = useState<Record<string, string>>({});
  const [pageIn, setPageIn] = useState<Record<string, number>>({});

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
    // a product with sizes shows them straight away, no "เพิ่ม" first (28 Nov 2026, user request)
    const open = hasSizes || opened[p.id] || total > 0;
    const size = hasSizes ? sizeOf[p.id] ?? '' : p.availableSizes[0] ?? '-';
    const qty = size ? qtyOf(p.id, size) : 0;
    const room = Math.min(MAX_QTY, left - total + qty);
    const name = tx(p.nameTh);
    // a size picked but not in the cart yet: a count of its own and a button to add it
    const inCart = qty > 0;
    const draftRoom = Math.min(MAX_QTY, left - total);
    const draft = Math.max(1, Math.min(draftOf[p.id] ?? 1, Math.max(1, draftRoom)));

    return (
      <article key={p.id} className={`sv-card ${total > 0 ? 'is-picked' : ''}`} aria-label={name}>
        <div className="sv-card-art">
          <ProductArt
            categoryLabel={p.categoryLabel}
            name={p.nameTh}
            kind={souvenirArt(p.categoryLabel, p.nameTh)}
            className="sf-art-svg"
            flip="button"
          />
          {total > 0 && (
            <span className="sv-card-count mono-num" aria-hidden="true">
              ×{total}
            </span>
          )}
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
              /* size buttons toggle (28 Nov 2026, user request): press again to clear the size */
              <fieldset className="sv-sizes">
                <legend className="sv-sizes-label">{size ? tx('ไซส์') : tx('เลือกไซส์')}</legend>
                {p.availableSizes.map((s) => {
                  const n = qtyOf(p.id, s);
                  const on = size === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`pg-chip sv-size ${on ? 'is-selected' : ''}`}
                      aria-pressed={on}
                      onClick={() => {
                        // only the choice of size; the cart changes with "เพิ่ม"
                        setSizeOf((m) => ({ ...m, [p.id]: on ? '' : s }));
                        setDraftOf((m) => ({ ...m, [p.id]: 1 }));
                      }}
                    >
                      {tx(s)}
                      {n > 0 ? ` ×${n}` : ''}
                    </button>
                  );
                })}
              </fieldset>
            )}
            {size && (hasSizes && !inCart ? (
              <div className="sv-add-row">
                <div
                  className="sf-qty sv-qty"
                  role="group"
                  aria-label={txf('จำนวนของ {0}', `${name} ${size}`)}
                >
                  <button
                    type="button"
                    onClick={() => setDraftOf((m) => ({ ...m, [p.id]: draft - 1 }))}
                    disabled={draft <= 1}
                    aria-label={tx('ลดจำนวน')}
                  >
                    −
                  </button>
                  <span className="mono-num" aria-live="polite">
                    {draft}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDraftOf((m) => ({ ...m, [p.id]: draft + 1 }))}
                    disabled={draft >= draftRoom}
                    aria-label={tx('เพิ่มจำนวน')}
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-primary sv-add-cart"
                  disabled={draftRoom <= 0}
                  onClick={() => setQty(p.id, size, draft)}
                >
                  {txf('เพิ่ม · {0}', formatThb(p.priceSatang * draft, true))}
                </button>
              </div>
            ) : (
              stepper(p, size, qty, room)
            ))}
          </div>
        )}
      </article>
    );
  };

  const shelfBody = (sh: { label: string; key: string; items: EventProduct[] }, id?: string) => {
    const isShirts = sh.label === 'เสื้อที่ระลึก';
    const types = isShirts ? [...new Set(sh.items.map((p) => shirtTypeOf(p.nameTh)))] : [];
    const type = types.length > 1 ? typeIn[sh.label] ?? ALL_TYPES : ALL_TYPES;
    const items = type ? sh.items.filter((p) => shirtTypeOf(p.nameTh) === type) : sh.items;
    const pageCount = Math.max(1, Math.ceil(items.length / perPage));
    const page = Math.min(pageIn[sh.label] ?? 0, pageCount - 1);
    const shown = items.slice(page * perPage, (page + 1) * perPage);
    return (
      <div id={id} className="sv-shelf-body">
        {types.length > 1 && (
          <div className="sv-types" role="group" aria-label={tx('ทรงเสื้อ')}>
            {[ALL_TYPES, ...types].map((t) => {
              const n = t ? sh.items.filter((p) => shirtTypeOf(p.nameTh) === t).length : sh.items.length;
              return (
                <button
                  key={t || 'all'}
                  type="button"
                  className="sv-type"
                  aria-pressed={type === t}
                  onClick={() => {
                    setTypeIn((m) => ({ ...m, [sh.label]: t }));
                    setPageIn((m) => ({ ...m, [sh.label]: 0 }));
                  }}
                >
                  {t ? tx(t) : tx('ทั้งหมด')}
                  <span className="sv-type-count mono-num">{n}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="sv-grid">{shown.map(card)}</div>
        {pageCount > 1 && (
          <Pager
            className="sv-pager"
            page={page}
            pageCount={pageCount}
            pageSize={perPage}
            shown={shown.length}
            total={items.length}
            onPage={(n) => setPageIn((m) => ({ ...m, [sh.label]: n }))}
          />
        )}
      </div>
    );
  };

  return (
    <div className="sv" ref={rootRef}>
      {shelves.map((sh) => {
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
                        flip="none"
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
            {open && shelfBody(sh, `${sh.key}-body`)}
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
          setPageIn({});
        }}
      />
    </div>
  );
}
