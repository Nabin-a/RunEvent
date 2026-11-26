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
  const [stuck, setStuck] = useState(false);
  const [barH, setBarH] = useState(0);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const sideRef = useRef<HTMLButtonElement | null>(null);

  // the tabs stay on top; once they scroll under the top bar, the picked style shows as a
  // side tab on the chart's left edge, and leaves with the chart's bottom edge instead of
  // hanging below it (26 Nov 2026, user request)
  useEffect(() => {
    if (!tabbed) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const strip = stripRef.current;
      const panel = panelRef.current;
      const tab = sideRef.current;
      if (!strip || !panel || !tab) return;
      const bar = document.querySelector('.global-topbar')?.getBoundingClientRect().height ?? 0;
      const top = bar + 12;
      setBarH(Math.round(bar));
      const panelBox = panel.getBoundingClientRect();
      const on = strip.getBoundingClientRect().bottom < bar && panelBox.bottom > top + 24;
      setStuck(on);
      // past the chart's end the tab is pushed up together with it
      const shift = Math.min(0, panelBox.bottom - (top + tab.offsetHeight));
      tab.style.transform = on ? `translateY(${shift}px)` : '';
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
  }, [tabbed]);

  if (!current) return null;

  return (
    <div className="pg">
      <figure className="pg-hero">
        {current.photo ? (
          <img src={current.photo} alt={tx(current.name)} className="pg-hero-photo" />
        ) : (
          <ProductArt kind={current.art} className="pg-hero-art" />
        )}
        <figcaption>
          <strong>{tx(current.name)}</strong>
          <span>{tx(caption)}</span>
        </figcaption>
      </figure>

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

        {tabbed && (
          <div className="pg-side-anchor" style={{ top: barH + 12 }}>
            <button
              ref={sideRef}
              type="button"
              className={`pg-side-tab ${stuck ? 'is-on' : ''}`}
              aria-hidden={!stuck}
              tabIndex={stuck ? 0 : -1}
              title={tx('เปลี่ยนทรงเสื้อ')}
              aria-label={`${tx(current.name)} · ${tx('เปลี่ยนทรงเสื้อ')}`}
              onClick={() => {
                // back to the style tabs, just under the top bar
                const el = stripRef.current;
                if (!el) return;
                const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                window.scrollTo({
                  top: el.getBoundingClientRect().top + window.scrollY - barH - 12,
                  behavior: reduce ? 'auto' : 'smooth',
                });
              }}
            >
              {current.photo ? (
                <img src={current.photo} alt="" className="pg-side-tab-art pg-stab-photo" />
              ) : (
                <ProductArt kind={current.art} className="pg-side-tab-art" />
              )}
              <span className="pg-side-tab-text">{tx(current.name)}</span>
            </button>
          </div>
        )}

        <div className="pg-stab-panel" ref={panelRef}>
          {cuts && cuts.length > 0 && (
            <fieldset className="pg-group pg-cuts">
              <legend>{tx('แบบเสื้อ')}</legend>
              <div className="pg-cut-chips">
                {cuts.map((c) => (
                  <label key={c.id} className={`pg-chip ${c.id === cut ? 'is-selected' : ''}`}>
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
          )}
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
