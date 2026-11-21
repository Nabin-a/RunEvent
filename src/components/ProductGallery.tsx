import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import type { EventProduct } from '../types';
import { NoteTag } from './RegTags';
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
  demo: boolean;
  sizes: { size: string; chest: string; length: string; left: number }[];
}

export function ShirtGallery({
  styles,
  styleId,
  onStyleChange,
  size,
  onSizeChange,
}: {
  styles: ShirtGalleryStyle[];
  styleId: string;
  onStyleChange: (id: string) => void;
  size: string;
  onSizeChange: (size: string) => void;
}) {
  const current = styles.find((s) => s.id === styleId) ?? styles[0];
  if (!current) return null;
  const picked = current.sizes.find((s) => s.size === size);

  return (
    <div className="pg">
      <figure className="pg-hero">
        <ProductArt kind={current.art} className="pg-hero-art" />
        <figcaption>
          <strong>{tx(current.name)}</strong>
          <span>{tx('ภาพตัวอย่าง · รวมในค่าสมัครแล้ว')}</span>
          {current.demo && <NoteTag>{tx('ข้อมูลจำลอง')}</NoteTag>}
        </figcaption>
      </figure>

      <fieldset className="pg-group">
        <legend>{tx('ทรงเสื้อ')}</legend>
        <div className="pg-thumbs">
          {styles.map((s) => (
            <label key={s.id} className={`pg-thumb ${s.id === current.id ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="pg-style"
                checked={s.id === current.id}
                onChange={() => onStyleChange(s.id)}
              />
              <ProductArt kind={s.art} className="pg-thumb-art" />
              <span>{tx(s.name)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="pg-group">
        <legend>{txf('ไซส์และขนาดตัวเสื้อ · {0}', tx(current.name))}</legend>
        <table className="pg-chart">
          <thead>
            <tr>
              <th scope="col">{tx('ไซส์')}</th>
              <th scope="col">{tx('รอบอก')}</th>
              <th scope="col">{tx('ความยาว')}</th>
              <th scope="col">{tx('คงเหลือ')}</th>
            </tr>
          </thead>
          <tbody>
            {current.sizes.map((s) => {
              const out = s.left <= 0;
              const isSel = s.size === size;
              const id = `pg-size-${current.id}-${s.size}`;
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
                        name="pg-size"
                        checked={isSel}
                        disabled={out}
                        onChange={() => onSizeChange(s.size)}
                      />
                      <label htmlFor={id}>{s.size}</label>
                    </span>
                  </th>
                  <td className="mono-num">{tx(s.chest)}</td>
                  <td className="mono-num">{tx(s.length)}</td>
                  <td>{out ? tx('หมดแล้ว') : txf('ว่าง {0} ตัว', s.left)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>

      <p className="pg-summary" aria-live="polite">
        <span>{tx('เลือกแล้ว')}</span>
        <strong>
          {picked ? txf('{0} · ไซส์ {1}', tx(current.name), picked.size) : tx('ยังไม่ได้เลือกไซส์')}
        </strong>
      </p>
      {current.demo && (
        <p className="pg-note">{tx('ทรงนี้ยังเป็นข้อมูลตัวอย่าง ระบบบันทึกเฉพาะไซส์ที่เลือก')}</p>
      )}
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
                  <ProductArt kind={souvenirArt(p.categoryLabel, p.nameTh)} className="pg-card-svg" />
                </div>
                <div className="pg-card-copy">
                  <strong>{tx(p.nameTh)}</strong>
                  <span className="mono-num">+{formatThb(p.priceSatang, true)}</span>
                  <span className="pg-card-meta">
                    {p.saleMode === 'preorder' ? tx('พรีออเดอร์') : tx('พร้อมส่ง')} ·{' '}
                    {left > 0 ? txf('ว่าง {0} ชิ้น', left) : tx('หมดแล้ว')} · {tx('ภาพตัวอย่าง')}
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
