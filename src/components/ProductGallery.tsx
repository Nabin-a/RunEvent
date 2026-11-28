import { useEffect, useRef, useState } from 'react';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import type { EventProduct } from '../types';
import { ProductArt, ProductPhoto, souvenirArt, type ProductArtKind } from './ProductArt';
import { IconArrowLeft, IconArrowRight } from './Icons';

/**
 * Picture-led product pickers for registration layout B.
 *
 * ShirtGallery: a wide preview of the chosen style, thumbnail cards to switch
 * style, and the style's size chart where each row is the size choice.
 * SouvenirCards: one tab per souvenir category, each item a card with its
 * picture, price and variants; one item can be picked in total.
 */

export interface ShirtGalleryStyle {
  id: string;
  name: string;
  art: ProductArtKind;
  /** front photo; the drawn art is used when there is none */
  photo?: string;
  demo: boolean;
  sizes: { size: string; chest: string; length: string; left: number }[];
}

export interface ShirtCutOption {
  id: string;
  label: string;
}

/**
 * The shirt styles as one row of picture tiles that scrolls sideways, with arrow buttons and dots
 * when there are more than fit (28 Nov 2026, user pick "C" from output/shirt-style-many-mockup:
 * the browser-style tabs hid every style past the third).
 */
function StyleRail({
  styles,
  currentId,
  name,
  onPick,
}: {
  styles: ShirtGalleryStyle[];
  currentId: string;
  name: string;
  onPick: (id: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [edge, setEdge] = useState({ prev: false, next: false, pages: 1, page: 0 });
  const measure = () => {
    const t = trackRef.current;
    if (!t) return;
    const max = t.scrollWidth - t.clientWidth;
    setEdge({
      prev: t.scrollLeft > 4,
      next: t.scrollLeft < max - 4,
      pages: max > 4 ? Math.ceil(t.scrollWidth / t.clientWidth - 0.05) : 1,
      page: max > 4 ? Math.round((t.scrollLeft / max) * (Math.ceil(t.scrollWidth / t.clientWidth - 0.05) - 1)) : 0,
    });
  };
  useEffect(() => {
    measure();
    const t = trackRef.current;
    if (!t) return;
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    return () => ro.disconnect();
  }, [styles.length]);
  // the picked style stays in view (a style picked from elsewhere, or on the way back)
  useEffect(() => {
    const t = trackRef.current;
    const tile = t?.querySelector<HTMLElement>('.pg-tile.is-selected');
    if (!t || !tile) return;
    if (tile.offsetLeft < t.scrollLeft || tile.offsetLeft + tile.offsetWidth > t.scrollLeft + t.clientWidth) {
      t.scrollLeft = tile.offsetLeft - (t.clientWidth - tile.offsetWidth) / 2;
    }
  }, [currentId]);
  const go = (dir: 1 | -1) => {
    const t = trackRef.current;
    if (!t) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    t.scrollBy({ left: dir * t.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };
  // hold and slide with the mouse (28 Nov 2026, user request); a finger already swipes the row.
  // A drag of more than a few pixels does not count as picking the tile it started on.
  // The whole row area (round the tiles, the dots) slides; the open hand shows there and the
  // pointer stays on the tiles and arrows (28 Nov 2026, user request).
  const dragRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean; id: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = trackRef.current;
    if (!t || e.pointerType !== 'mouse' || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.pg-rail-arrow')) return;
    drag.current = { x: e.clientX, left: t.scrollLeft, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const t = trackRef.current;
    if (!d || !t) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) > 5) {
      d.moved = true;
      setDragging(true);
      dragRef.current?.setPointerCapture(d.id);
    }
    if (d.moved) t.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const box = dragRef.current;
    const d = drag.current;
    if (box && d?.moved && box.hasPointerCapture(d.id)) box.releasePointerCapture(d.id);
    setDragging(false);
    // keep the flag for the click that follows the release, then forget the drag
    window.setTimeout(() => {
      drag.current = null;
    }, 0);
  };
  const overflow = edge.prev || edge.next;
  return (
    <fieldset className="pg-rail">
      <legend className="pg-rail-label">
        {tx('ทรงเสื้อ')} <small>{txf('{0} ทรง', styles.length)}</small>
      </legend>
      <div
        ref={dragRef}
        className={`pg-rail-drag${overflow ? ' can-drag' : ''}${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          // the click at the end of a slide is not a pick
          if (drag.current?.moved) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
      <div className={`pg-rail-box${overflow ? ' has-arrows' : ''}`}>
        {overflow && (
          <button type="button" className="pg-rail-arrow is-prev" disabled={!edge.prev} aria-label={tx('ทรงก่อนหน้า')} onClick={() => go(-1)}>
            <IconArrowLeft size={16} />
          </button>
        )}
        <div className="pg-rail-track" ref={trackRef} onScroll={measure}>
          {styles.map((s) => (
            <label key={s.id} className={`pg-tile ${s.id === currentId ? 'is-selected' : ''}`}>
              <input type="radio" name={name} checked={s.id === currentId} onChange={() => onPick(s.id)} />
              {s.photo ? (
                <img src={s.photo} alt="" className="pg-tile-photo" />
              ) : (
                <ProductArt kind={s.art} className="pg-tile-art" />
              )}
              <span>{tx(s.name)}</span>
            </label>
          ))}
        </div>
        {overflow && (
          <button type="button" className="pg-rail-arrow is-next" disabled={!edge.next} aria-label={tx('ทรงถัดไป')} onClick={() => go(1)}>
            <IconArrowRight size={16} />
          </button>
        )}
      </div>
      {edge.pages > 1 && (
        <div className="pg-rail-dots" aria-hidden="true">
          {Array.from({ length: edge.pages }, (_, i) => (
            <i key={i} className={i === edge.page ? 'is-on' : ''} />
          ))}
        </div>
      )}
      </div>
    </fieldset>
  );
}

export function ShirtGallery({
  styles,
  styleId,
  onStyleChange,
  size,
  onSizeChange,
  idPrefix = 'pg',
  cuts,
  cut,
  onCutChange,
  cutNote,
}: {
  styles: ShirtGalleryStyle[];
  styleId: string;
  onStyleChange: (id: string) => void;
  size: string;
  onSizeChange: (size: string) => void;
  /** keeps radio names / ids apart when two galleries share a page (race shirt + finisher shirt) */
  idPrefix?: string;
  /** shirt cut choice above the size chart (ชาย / หญิง / เด็ก) */
  cuts?: ShirtCutOption[];
  cut?: string;
  onCutChange?: (cut: string) => void;
  /** short note under the chart (for example "the kids' chart is sample data") */
  cutNote?: string | null;
}) {
  const current = styles.find((s) => s.id === styleId) ?? styles[0];
  const tabbed = styles.length > 1;
  const [follow, setFollow] = useState(false);
  const [barH, setBarH] = useState(0);
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);
  const followRef = useRef<HTMLDivElement | null>(null);

  /* The shirt preview follows the size chart (27 Nov 2026, user request).
     Wide screens: two columns and the preview is sticky in its own column (CSS only).
     Phones: once the preview scrolls under the top bar a compact copy floats under the bar.
     The copy lives in a zero-height sticky anchor, so showing it never changes the page
     height; changing the real preview's size made the page jump and flicker at the bottom. */
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = heroRef.current;
      const gallery = galleryRef.current;
      const bar = followRef.current;
      if (!hero || !gallery) return;
      const topBar = document.querySelector('.global-topbar')?.getBoundingClientRect().height ?? 0;
      setBarH(Math.round(topBar));
      const top = topBar + 8;
      const galleryBottom = gallery.getBoundingClientRect().bottom;
      const on = hero.getBoundingClientRect().bottom < top && galleryBottom > top + 32;
      setFollow(on);
      // near the gallery's end the copy is pushed up with it instead of hanging below
      if (bar) {
        const shift = Math.min(0, galleryBottom - (top + bar.offsetHeight));
        bar.style.transform = on ? `translateY(${shift}px)` : '';
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  if (!current) return null;

  const art = (cls: string, alt = '') =>
    current.photo ? (
      // the big preview turns to the back on hover, with no "ดูด้านหลัง" button in the form
      // (28 Nov 2026, user request); the floating copy stays front
      <ProductPhoto src={current.photo} alt={alt} className={`${cls}-photo`} flip={cls === 'pg-hero' ? 'hover' : 'none'} />
    ) : (
      <ProductArt kind={current.art} className={`${cls}-art`} />
    );

  const hasCuts = !!cuts && cuts.length > 0;
  const sizeBlock = (
    <>
      <fieldset className="pg-group">
        <legend>{tx('ไซส์และขนาดตัวเสื้อ')}</legend>
        <table className="pg-chart">
          <thead>
            <tr>
              <th scope="col">{tx('ไซส์')}</th>
              <th scope="col">{tx('รอบอก')}</th>
              <th scope="col">{tx('ความยาว')}</th>
            </tr>
          </thead>
          <tbody>
            {/* sold-out sizes are hidden (26 Nov 2026, user request) */}
            {current.sizes.filter((s) => s.left > 0).map((s) => {
              const out = s.left <= 0;
              const isSel = s.size === size;
              const id = `${idPrefix}-size-${current.id}-${s.size}`;
              return (
                <tr
                  key={s.size}
                  className={`${isSel ? 'is-selected' : ''} ${out ? 'is-out' : ''}`}
                  onClick={() => !out && onSizeChange(s.size)}
                >
                  <th scope="row">
                    <span className="pg-size-cell">
                      <input
                        id={id}
                        type="radio"
                        name={`${idPrefix}-size`}
                        checked={isSel}
                        disabled={out}
                        onChange={() => onSizeChange(s.size)}
                      />
                      <label htmlFor={id}>{s.size}</label>
                      {out && <span className="pg-out-tag">{tx('หมดแล้ว')}</span>}
                    </span>
                  </th>
                  <td className="mono-num">{tx(s.chest)}</td>
                  <td className="mono-num">{tx(s.length)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>
      {!current.sizes.some((s) => s.left > 0) && (
        <p className="pg-note">{tx('ทรงนี้หมดทุกไซส์แล้ว')}</p>
      )}
      {cutNote && <p className="pg-note">{tx(cutNote)}</p>}
    </>
  );

  return (
    <div className="pg" ref={galleryRef}>
      <figure className="pg-hero" ref={heroRef} style={{ top: barH + 12 }}>
        {art('pg-hero', tx(current.name))}
        {/* the shirt's name only; the line under it ("รวมในค่าสมัครแล้ว" / "ได้รับเมื่อวิ่งเข้าเส้นชัย")
            was taken off (28 Nov 2026, user request) */}
        <figcaption>
          <strong>{tx(current.name)}</strong>
        </figcaption>
      </figure>

      {/* phones: the compact copy that floats under the top bar while the chart scrolls */}
      <div className="pg-follow-anchor" style={{ top: barH + 8 }} aria-hidden="true">
        <div ref={followRef} className={`pg-follow ${follow ? 'is-on' : ''}`}>
          {art('pg-follow')}
          <strong>{tx(current.name)}</strong>
        </div>
      </div>

      {/* the styles: a row of picture tiles over the size chart (28 Nov 2026, user pick "C") */}
      <div className={`pg-tabbed ${tabbed ? 'is-rail' : 'is-single'}`}>
        {tabbed && (
          <StyleRail styles={styles} currentId={current.id} name={`${idPrefix}-style`} onPick={onStyleChange} />
        )}

        <div className="pg-stab-panel">
          {hasCuts ? (
            /* ชาย / หญิง / เด็ก are tabs on top of the size chart too, inside the style panel
               (27 Nov 2026, user request "ตอนเลือก gender ให้ทำเป็น tab panel เหมือนกัน").
               Styled as coloured file dividers (28 Nov 2026, user request, after codepen
               _massimo/oYWbqL): each tab has its own tint by position, and the panel under it
               takes the tint of the picked one; tabs stay on top. */
            <div className="pg-tabbed pg-cut-tabbed">
              <fieldset className="pg-stabs pg-cuts">
                <legend className="sr-only">{tx('แบบเสื้อ')}</legend>
                <div className="pg-stab-strip">
                  {cuts.map((c, i) => (
                    <label key={c.id} className={`pg-stab pg-cut-tab tone-${i % 3} ${c.id === cut ? 'is-selected' : ''}`}>
                      <input
                        type="radio"
                        name={`${idPrefix}-cut`}
                        checked={c.id === cut}
                        onChange={() => onCutChange?.(c.id)}
                      />
                      <span>{tx(c.label)}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {/* keyed by the cut so the chart slides in again on each change */}
              <div
                key={cut}
                className={`pg-stab-panel pg-cut-panel tone-${Math.max(0, cuts.findIndex((c) => c.id === cut)) % 3}`}
              >
                {sizeBlock}
              </div>
            </div>
          ) : (
            sizeBlock
          )}
        </div>
      </div>

    </div>
  );
}

const NONE_TAB = 'none';

export function SouvenirCards({
  products,
  tab,
  onTabChange,
  value,
  onChange,
}: {
  products: EventProduct[];
  /** category label, or 'none' */
  tab: string;
  onTabChange: (tab: string) => void;
  /** `${productId}::${variant}` or '' */
  value: string;
  onChange: (value: string) => void;
}) {
  const categories = [...new Set(products.map((p) => p.categoryLabel))];
  const items = products.filter((p) => p.categoryLabel === tab);
  const [pickedId, pickedVariant] = value ? value.split('::') : ['', ''];
  const picked = products.find((p) => p.id === pickedId);

  return (
    <div className="pg">
      <fieldset className="pg-group">
        <legend className="sr-only">{tx('ประเภทของที่ระลึก')}</legend>
        <div className="pg-tabs">
          {[NONE_TAB, ...categories].map((c) => (
            <label key={c} className={`pg-tab ${c === tab ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="pg-souvenir-tab"
                checked={c === tab}
                onChange={() => {
                  onTabChange(c);
                  if (c === NONE_TAB) onChange('');
                }}
              />
              <span>{c === NONE_TAB ? tx('ไม่ซื้อเพิ่ม') : tx(c)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {tab === NONE_TAB ? (
        <p className="pg-note">{tx('รับเฉพาะสิทธิ์สมัครวิ่ง ไม่ซื้อสินค้าเพิ่ม')}</p>
      ) : (
        <div className="pg-cards">
          {items.map((p) => {
            const left = Math.max(0, p.stockOrCeiling - p.soldCount);
            const isPicked = p.id === pickedId;
            return (
              <article key={p.id} className={`pg-card ${isPicked ? 'is-selected' : ''}`}>
                <div className="pg-card-art">
                  <ProductArt categoryLabel={p.categoryLabel} name={p.nameTh} kind={souvenirArt(p.categoryLabel, p.nameTh)} className="pg-card-svg" flip="button" />
                </div>
                <div className="pg-card-copy">
                  <strong>{tx(p.nameTh)}</strong>
                  <span className="mono-num">+{formatThb(p.priceSatang, true)}</span>
                  <span className="pg-card-meta">
                    {p.saleMode === 'preorder' ? tx('พรีออเดอร์') : tx('พร้อมส่ง')} ·{' '}
                    {left > 0 ? txf('ว่าง {0} ชิ้น', left) : tx('หมดแล้ว')}
                  </span>
                </div>
                <fieldset className="pg-variants" disabled={left <= 0}>
                  <legend className="sr-only">{txf('เลือกแบบของ {0}', tx(p.nameTh))}</legend>
                  {p.availableSizes.map((v) => {
                    const val = `${p.id}::${v}`;
                    const isSel = isPicked && pickedVariant === v;
                    return (
                      <label key={v} className={`pg-chip ${isSel ? 'is-selected' : ''}`}>
                        <input
                          type="radio"
                          name="pg-souvenir"
                          checked={isSel}
                          onChange={() => onChange(val)}
                        />
                        <span>{tx(v)}</span>
                      </label>
                    );
                  })}
                </fieldset>
              </article>
            );
          })}
        </div>
      )}

      <p className="pg-summary" aria-live="polite">
        <span>{tx('ของที่ระลึก')}</span>
        <strong>
          {picked
            ? `${tx(picked.nameTh)} · ${tx(pickedVariant)} · +${formatThb(picked.priceSatang, true)}`
            : tx('ไม่ซื้อเพิ่ม')}
        </strong>
      </p>
    </div>
  );
}
