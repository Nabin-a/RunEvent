import { useEffect, useRef, useState } from 'react';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import type { EventProduct } from '../types';
import { ProductArt, souvenirArt, type ProductArtKind } from './ProductArt';

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

export function ShirtGallery({
  styles,
  styleId,
  onStyleChange,
  size,
  onSizeChange,
  idPrefix = 'pg',
  caption = 'รวมในค่าสมัครแล้ว',
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
  caption?: string;
  /** shirt cut choice above the size chart (ชาย / หญิง / เด็ก) */
  cuts?: ShirtCutOption[];
  cut?: string;
  onCutChange?: (cut: string) => void;
  /** short note under the chart (for example "the kids' chart is sample data") */
  cutNote?: string | null;
}) {
  const current = styles.find((s) => s.id === styleId) ?? styles[0];
  const tabbed = styles.length > 1;
  const stripRef = useRef<HTMLFieldSetElement | null>(null);
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
      <img src={current.photo} alt={alt} className={`${cls}-photo`} />
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
        <figcaption>
          <strong>{tx(current.name)}</strong>
          <span>{tx(caption)}</span>
        </figcaption>
      </figure>

      {/* phones: the compact copy that floats under the top bar while the chart scrolls */}
      <div className="pg-follow-anchor" style={{ top: barH + 8 }} aria-hidden="true">
        <div ref={followRef} className={`pg-follow ${follow ? 'is-on' : ''}`}>
          {art('pg-follow')}
          <strong>{tx(current.name)}</strong>
        </div>
      </div>

      {/* the styles are tabs on top of the size chart, like browser tabs; the chosen tab joins the panel */}
      <div className={`pg-tabbed ${tabbed ? '' : 'is-single'}`}>
        {tabbed && (
          <fieldset className="pg-stabs" ref={stripRef}>
            <legend className="sr-only">{tx('ทรงเสื้อ')}</legend>
            <div className="pg-stab-strip">
              {styles.map((s) => (
                <label key={s.id} className={`pg-stab ${s.id === current.id ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name={`${idPrefix}-style`}
                    checked={s.id === current.id}
                    onChange={() => onStyleChange(s.id)}
                  />
                  {s.photo ? (
                    <img src={s.photo} alt="" className="pg-stab-art pg-stab-photo" />
                  ) : (
                    <ProductArt kind={s.art} className="pg-stab-art" />
                  )}
                  <span>{tx(s.name)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="pg-stab-panel">
          {hasCuts ? (
            /* ชาย / หญิง / เด็ก are tabs on top of the size chart too, inside the style panel
               (27 Nov 2026, user request "ตอนเลือก gender ให้ทำเป็น tab panel เหมือนกัน") */
            <div className="pg-tabbed pg-cut-tabbed">
              <fieldset className="pg-stabs pg-cuts">
                <legend className="sr-only">{tx('แบบเสื้อ')}</legend>
                <div className="pg-stab-strip">
                  {cuts.map((c) => (
                    <label key={c.id} className={`pg-stab pg-cut-tab ${c.id === cut ? 'is-selected' : ''}`}>
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
              <div className="pg-stab-panel pg-cut-panel">{sizeBlock}</div>
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
                  <ProductArt categoryLabel={p.categoryLabel} name={p.nameTh} kind={souvenirArt(p.categoryLabel, p.nameTh)} className="pg-card-svg" />
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
