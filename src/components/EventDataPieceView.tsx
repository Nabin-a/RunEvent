import type React from 'react';
import type { EventPageItem, Organization, RaceCategory, RaceEvent, ShirtSizeCode } from '../types';
import { dataPieceHasContent, dataSourceDef } from '../data/eventDataPieces';
import { tx, txf } from '../i18n';
import { calculateFeeQuote, formatThb, getCurrentTier } from '../utils/pricing';
import { FaIcon } from './FaIcon';
import { ProductArt, souvenirArt } from './ProductArt';

/**
 * A data piece of a free block: event data shown live and read-only (data/eventDataPieces.ts).
 * The page that draws it hands over what it already knows (seats, shirt sizes, actions) in `ctx`.
 * With nothing to show it renders nothing on the public page and a note in the editor preview.
 */
export interface DataPieceCtx {
  event: RaceEvent;
  org?: Organization;
  openSeats: (cat: RaceCategory) => number;
  /** seats left for the whole event, or null when the whole-event cap is switched off */
  eventOpenSeats: number | null;
  shirtSpec: (size: ShirtSizeCode) => { chestInch: string; lengthInch: string };
  registerOpen: boolean;
  onRegister: (catId?: string) => void;
  onOpenStore: (productId?: string) => void;
  formatAge: (cat: RaceCategory) => string | null;
  /** the page's own category cards (same look as before the blocks became free blocks) */
  renderCategoryCards?: (cats: RaceCategory[], opts: { showAllTiers?: boolean; showAge?: boolean }) => React.ReactNode;
}

export function EventDataPieceView({ item, ctx, preview }: { item: EventPageItem; ctx: DataPieceCtx; preview: boolean }) {
  const def = dataSourceDef(item.source);
  const o = item.options ?? {};
  const ev = ctx.event;
  if (!def) return null;
  if (!dataPieceHasContent(ev, item)) {
    return preview ? (
      <p className="custom-block-empty data-piece-empty">
        <FaIcon name="eye-slash" />
        <span>{txf('{0}: งานนี้ยังไม่มีข้อมูล หน้าจริงจะไม่แสดงส่วนนี้', tx(def.label))}</span>
      </p>
    ) : null;
  }
  const cats = o.categoryIds?.length ? ev.categories.filter((c) => o.categoryIds?.includes(c.id)) : ev.categories;

  switch (item.source) {
    case 'categories': {
      if (o.layout === 'table') {
        return (
          <div className="table-scroll data-piece">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>{tx('ระยะ')}</th>
                  <th>{tx('ปล่อยตัว')}</th>
                  <th>{tx('Cut-off')}</th>
                  <th className="num-col">{tx('ราคาสุทธิ')}</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((cat) => {
                  const tier = getCurrentTier(cat);
                  const quote = calculateFeeQuote(tier.priceSatang, ev.feeBearerPolicy);
                  return (
                    <tr key={cat.id}>
                      <td>
                        <strong>{tx(cat.name)}</strong>
                        {o.showAge !== false && ctx.formatAge(cat) && <span className="muted-inline"> · {ctx.formatAge(cat)}</span>}
                      </td>
                      <td className="mono-num">{txf('{0} น.', cat.startTimeLocal)}</td>
                      <td className="mono-num">{txf('{0} ชม.', cat.cutoffHours)}</td>
                      <td className="num-col mono-num">
                        <strong>{formatThb(quote.runnerNetPaySatang, true)}</strong>
                        <span className="muted-inline"> ({tx(tier.label)})</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      }
      if (ctx.renderCategoryCards) {
        return <div className="data-piece">{ctx.renderCategoryCards(cats, { showAllTiers: o.showAllTiers, showAge: o.showAge })}</div>;
      }
      return (
        <div className="data-piece data-cat-list">
          {cats.map((cat) => {
            const tier = getCurrentTier(cat);
            const quote = calculateFeeQuote(tier.priceSatang, ev.feeBearerPolicy);
            return (
              <article key={cat.id} className="data-cat-card">
                <div className="data-cat-head">
                  <span className={`category-bib-chip tone-${cat.colorTag}`}>
                    <strong>{tx(cat.code)}</strong>
                  </span>
                  <strong className="data-cat-name">{tx(cat.name)}</strong>
                  <strong className="mono-num text-vermilion data-cat-price">{formatThb(quote.runnerNetPaySatang, true)}</strong>
                </div>
                <p className="muted-inline">
                  {txf('ปล่อยตัว {0} น. · Cut-off {1} ชม.', cat.startTimeLocal, cat.cutoffHours)}
                  {o.showAge !== false && ctx.formatAge(cat) ? ` · ${ctx.formatAge(cat)}` : ''}
                </p>
                {o.showAllTiers !== false && cat.priceTiers.length > 1 && (
                  <ul className="data-tier-list">
                    {cat.priceTiers.map((t) => (
                      <li key={t.id} className={t.isCurrent ? 'is-current' : ''}>
                        {tx(t.label)}: <span className="mono-num">{formatThb(t.priceSatang)}</span>
                        {t.isCurrent ? ` · ${tx('ช่วงปัจจุบัน')}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      );
    }
    case 'quota': {
      const label = (left: number, cap: number) => {
        if (o.quotaStyle === 'label') {
          if (left <= 0) return tx('เต็มแล้ว');
          return left / Math.max(1, cap) <= 0.2 ? tx('ใกล้เต็ม') : tx('ยังว่าง');
        }
        return txf('เหลือ {0} / {1}', left, cap);
      };
      if (o.quotaMode === 'total') {
        const left = ctx.eventOpenSeats ?? 0;
        return (
          <p className="data-piece data-quota-total">
            <FaIcon name="chair" />
            <span>
              {tx('ที่นั่งรวมทั้งงาน')}: <strong className="mono-num">{label(left, ev.totalEventQuota)}</strong>
            </span>
          </p>
        );
      }
      return (
        <ul className="data-piece data-quota-list">
          {cats.map((cat) => (
            <li key={cat.id}>
              <span>{tx(cat.name)}</span>
              <strong className="mono-num">{label(ctx.openSeats(cat), cat.categoryQuota)}</strong>
            </li>
          ))}
        </ul>
      );
    }
    case 'register':
      return (
        <div className="data-piece">
          <button type="button" className="btn-primary" disabled={!ctx.registerOpen} onClick={() => ctx.onRegister()}>
            <FaIcon name="pen-to-square" />
            <span>{ctx.registerOpen ? tx('สมัครเลย') : tx('ยังไม่เปิดรับสมัคร')}</span>
          </button>
        </div>
      );
    case 'sizechart':
      return (
        <div className="table-scroll data-piece">
          <table className="ops-table">
            <thead>
              <tr>
                <th>{tx('ไซส์')}</th>
                <th>{tx('รอบอก (นิ้ว)')}</th>
                <th>{tx('ความยาว (นิ้ว)')}</th>
                {o.showStock !== false && <th className="num-col">{tx('คงเหลือ')}</th>}
              </tr>
            </thead>
            <tbody>
              {ev.shirtStocks.map((st) => {
                const spec = ctx.shirtSpec(st.size);
                const left = Math.max(0, st.total - st.reservedOrConfirmed);
                return (
                  <tr key={st.size}>
                    <td>
                      <strong>{tx(st.size)}</strong>
                    </td>
                    <td className="mono-num">{tx(spec.chestInch)}</td>
                    <td className="mono-num">{tx(spec.lengthInch)}</td>
                    {o.showStock !== false && (
                      <td className="num-col mono-num">{left > 0 ? txf('ว่าง {0} ตัว', left) : tx('หมดแล้ว')}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    case 'venue':
      return (
        <dl className="data-piece data-facts">
          <div>
            <dt>
              <FaIcon name="location-dot" /> {tx('สถานที่จัดงาน')}
            </dt>
            <dd>
              {tx(ev.venue)} · {tx('จ.')}
              {tx(ev.province)}
            </dd>
          </div>
          {o.showDate !== false && (
            <div>
              <dt>
                <FaIcon name="calendar-day" /> {tx('วันงาน')}
              </dt>
              <dd className="mono-num">{tx(ev.eventDate)}</dd>
            </div>
          )}
        </dl>
      );
    case 'contact':
      return (
        <dl className="data-piece data-facts">
          <div>
            <dt>
              <FaIcon name="building" /> {tx('ผู้จัดงาน')}
            </dt>
            <dd>
              {tx(ctx.org?.nameTh ?? '')}
              {ctx.org?.contactEmail && (
                <>
                  {' · '}
                  <a href={`mailto:${ctx.org.contactEmail}`}>{ctx.org.contactEmail}</a>
                </>
              )}
            </dd>
          </div>
          {o.showRules !== false && (
            <div>
              <dt>
                <FaIcon name="flag-checkered" /> {tx('กติกาการแข่งขัน')}
              </dt>
              <dd>{txf('ใช้กติกาฉบับ {0}', ev.rulesVersion)}</dd>
            </div>
          )}
        </dl>
      );
    case 'kit':
      return (
        <dl className="data-piece data-facts">
          <div>
            <dt>
              <FaIcon name="box-open" /> {tx('รับเสื้อและป้าย BIB')}
            </dt>
            <dd>{tx(ev.kitPickupWindow)}</dd>
          </div>
          {!!ev.kitShippingFeeSatang && (
            <div>
              <dt>
                <FaIcon name="truck" /> {tx('จัดส่งถึงบ้าน')}
              </dt>
              <dd className="mono-num">{txf('ค่าส่ง {0}', formatThb(ev.kitShippingFeeSatang))}</dd>
            </div>
          )}
        </dl>
      );
    case 'products': {
      const list = ev.products
        .filter((p) => !o.productCategory || p.categoryLabel === o.productCategory)
        .slice(0, o.productCount ?? 4);
      return (
        <div className="data-piece">
          <ul className="data-product-list">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" className="data-product" onClick={() => ctx.onOpenStore(p.id)}>
                  <ProductArt categoryLabel={p.categoryLabel} name={p.nameTh} kind={souvenirArt(p.categoryLabel, p.nameTh)} className="data-product-art" />
                  <span className="data-product-name">{tx(p.nameTh)}</span>
                  <strong className="mono-num">{formatThb(p.priceSatang)}</strong>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-secondary" onClick={() => ctx.onOpenStore()}>
            <FaIcon name="bag-shopping" />
            <span>{tx('ไปที่ร้านค้า')}</span>
          </button>
        </div>
      );
    }
    default:
      return null;
  }
}
