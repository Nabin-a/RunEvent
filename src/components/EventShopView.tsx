/**
 * Event shop ("ร้านค้าของงาน") — approved mockup, 24 Nov 2026.
 *
 * Shop money is shown apart from entry fees. Orders by delivery state double as
 * filters for the order list. Each product says in plain words who sells it, who
 * gets the money and who delivers it. Buying here never creates a race entry.
 */
import React, { useMemo, useState } from 'react';
import type { MerchOrderRecord, RaceEvent, SellerServiceModel } from '../types';
import { formatThb } from '../utils/pricing';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../event-shop.css';

type Category = 'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม';
type StateKey = 'unpaid' | 'preparing' | 'ready' | 'partial' | 'done';

interface Props {
  event: RaceEvent;
  /** shop orders of this event */
  orders: MerchOrderRecord[];
  canEdit: boolean;
  canViewFinance: boolean;
  onAddProduct: (payload: {
    eventId: string;
    nameTh: string;
    categoryLabel: Category;
    saleMode: 'ready_stock' | 'preorder';
    serviceModel: SellerServiceModel;
    priceBaht: number;
    stockOrCeiling: number;
  }) => void;
}

const STATE_META: Record<StateKey, { label: string; icon: string; tone: string }> = {
  unpaid: { label: 'ยังไม่ชำระ', icon: 'clock', tone: 'is-muted' },
  preparing: { label: 'รอผลิตหรือเตรียมของ', icon: 'hourglass-half', tone: 'is-muted' },
  ready: { label: 'พร้อมรับ / ส่งแล้ว', icon: 'truck', tone: 'is-warn' },
  partial: { label: 'รับบางส่วน', icon: 'box-open', tone: 'is-warn' },
  done: { label: 'ส่งมอบครบ', icon: 'circle-check', tone: 'is-ok' },
};
const STATE_ORDER: StateKey[] = ['preparing', 'ready', 'partial', 'done', 'unpaid'];

function orderState(o: MerchOrderRecord): StateKey {
  if (o.paymentStatus !== 'succeeded') return 'unpaid';
  if (o.fulfillmentStatus === 'completed' || o.deliveredQty >= o.quantity) return 'done';
  if (o.fulfillmentStatus === 'partial_received' || o.deliveredQty > 0) return 'partial';
  if (o.fulfillmentStatus === 'ready_or_shipped') return 'ready';
  return 'preparing';
}

const SERVICE_TEXT: Record<SellerServiceModel, string> = {
  organizer_self_sell: 'ผู้จัดขาย รับเงิน และส่งเอง',
  kratai_produce_bulk: 'ผู้จัดขายและรับเงิน · กระต่ายผลิตล็อตใหญ่ส่งให้ผู้จัด',
  kratai_full_service: 'กระต่ายดูแลครบ: รับพรีออเดอร์ ผลิต และส่งถึงผู้ซื้อ',
};

const CAT_ICON: Record<string, string> = {
  เสื้อที่ระลึก: 'shirt',
  เหรียญที่ระลึก: 'medal',
  อุปกรณ์เสริม: 'hat-cowboy',
};

export const EventShopView: React.FC<Props> = ({ event, orders, canEdit, canViewFinance, onAddProduct }) => {
  const [stateFilter, setStateFilter] = useState<StateKey | 'all'>('all');
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    nameTh: '',
    categoryLabel: 'เสื้อที่ระลึก' as Category,
    saleMode: 'preorder' as 'ready_stock' | 'preorder',
    serviceModel: 'kratai_produce_bulk' as SellerServiceModel,
    priceBaht: 420,
    stockOrCeiling: 50,
  });
  const [formError, setFormError] = useState('');

  const shopPath = `/events/${event.code.toLowerCase()}/shop`;
  const paid = orders.filter((o) => o.paymentStatus === 'succeeded');
  const salesSatang = paid.reduce((s, o) => s + o.unitPriceSatang * o.quantity, 0);
  const shippingSatang = paid.reduce((s, o) => s + o.shippingSatang, 0);
  const byProduct = event.products
    .map((p) => ({
      p,
      satang: paid.filter((o) => o.productId === p.id).reduce((s, o) => s + o.unitPriceSatang * o.quantity, 0),
    }))
    .filter((x) => x.satang > 0)
    .sort((a, b) => b.satang - a.satang);
  const SHARE_CLASSES = ['sh-c1', 'sh-c2', 'sh-c3'];

  const stateCounts = useMemo(() => {
    const c: Record<StateKey, number> = { unpaid: 0, preparing: 0, ready: 0, partial: 0, done: 0 };
    orders.forEach((o) => (c[orderState(o)] += 1));
    return c;
  }, [orders]);
  const maxState = Math.max(...Object.values(stateCounts), 1);

  const listed = orders
    .filter((o) => stateFilter === 'all' || orderState(o) === stateFilter)
    .slice()
    .reverse();
  const visible = showAll ? listed : listed.slice(0, 8);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${shopPath}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="sh-page">
      <header className="sh-head">
        <div>
          <h1>{tx('ร้านค้าของงาน')}</h1>
          <p className="sh-sub">{tx('ขายของที่ระลึกให้นักวิ่งและคนทั่วไป ซื้อได้โดยไม่ต้องสมัครวิ่ง')}</p>
        </div>
        <div className="sh-actions">
          <button type="button" className="sh-btn" onClick={copyLink}>
            <FaIcon name={copied ? 'check' : 'link'} />
            {tx(copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์ร้าน')}
          </button>
          <a className="sh-btn" href={shopPath} target="_blank" rel="noreferrer">
            <FaIcon name="arrow-up-right-from-square" />
            {tx('ดูหน้าร้าน')}
          </a>
          {canEdit && (
            <button type="button" className="sh-btn is-primary" aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
              <FaIcon name={adding ? 'xmark' : 'plus'} />
              {tx(adding ? 'ปิดฟอร์มเพิ่มสินค้า' : 'เพิ่มสินค้า')}
            </button>
          )}
        </div>
      </header>

      {adding && canEdit && (
        <form
          className="sh-panel sh-form"
          aria-label={tx('เพิ่มสินค้า')}
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.nameTh.trim()) {
              setFormError(tx('ใส่ชื่อสินค้าก่อน'));
              return;
            }
            if (form.priceBaht <= 0 || form.stockOrCeiling <= 0) {
              setFormError(tx('ราคาและจำนวนต้องมากกว่า 0'));
              return;
            }
            onAddProduct({ eventId: event.id, ...form, nameTh: form.nameTh.trim() });
            setForm({ ...form, nameTh: '' });
            setFormError('');
            setAdding(false);
          }}
        >
          <h2>{tx('เพิ่มสินค้า')}</h2>
          <div className="sh-form-grid">
            <label>
              <span>{tx('ชื่อสินค้า')}</span>
              <input
                value={form.nameTh}
                placeholder={tx('เช่น หมวกวิ่งรุ่นที่ระลึก')}
                onChange={(e) => {
                  setForm({ ...form, nameTh: e.target.value });
                  setFormError('');
                }}
              />
            </label>
            <label>
              <span>{tx('หมวด')}</span>
              <select value={form.categoryLabel} onChange={(e) => setForm({ ...form, categoryLabel: e.target.value as Category })}>
                <option value="เสื้อที่ระลึก">{tx('เสื้อที่ระลึก')}</option>
                <option value="เหรียญที่ระลึก">{tx('เหรียญที่ระลึก')}</option>
                <option value="อุปกรณ์เสริม">{tx('อุปกรณ์เสริม')}</option>
              </select>
            </label>
            <label>
              <span>{tx('ขายแบบ')}</span>
              <select
                value={form.saleMode}
                onChange={(e) => setForm({ ...form, saleMode: e.target.value as 'ready_stock' | 'preorder' })}
              >
                <option value="preorder">{tx('พรีออเดอร์ (ผลิตหลังปิดยอด)')}</option>
                <option value="ready_stock">{tx('พร้อมขาย (มีของแล้ว)')}</option>
              </select>
            </label>
            <label>
              <span>{tx('ใครขาย ใครส่ง')}</span>
              <select
                value={form.serviceModel}
                onChange={(e) => setForm({ ...form, serviceModel: e.target.value as SellerServiceModel })}
              >
                <option value="organizer_self_sell">{tx(SERVICE_TEXT.organizer_self_sell)}</option>
                <option value="kratai_produce_bulk">{tx(SERVICE_TEXT.kratai_produce_bulk)}</option>
                <option value="kratai_full_service">{tx(SERVICE_TEXT.kratai_full_service)}</option>
              </select>
            </label>
            <label>
              <span>{tx('ราคาต่อชิ้น (บาท)')}</span>
              <input
                type="number"
                min={1}
                value={form.priceBaht}
                onChange={(e) => setForm({ ...form, priceBaht: Number(e.target.value) })}
              />
            </label>
            <label>
              <span>{tx(form.saleMode === 'preorder' ? 'เพดานจำนวนรับพรีออเดอร์' : 'จำนวนที่มีขาย')}</span>
              <input
                type="number"
                min={1}
                value={form.stockOrCeiling}
                onChange={(e) => setForm({ ...form, stockOrCeiling: Number(e.target.value) })}
              />
            </label>
          </div>
          {formError && (
            <p className="sh-error" role="alert">
              <FaIcon name="triangle-exclamation" />
              {formError}
            </p>
          )}
          <div className="sh-form-actions">
            <button type="submit" className="sh-btn is-primary">
              {tx('เปิดขายในร้านงานนี้')}
            </button>
          </div>
        </form>
      )}

      <div className="sh-grid2">
        <section className="sh-panel" aria-labelledby="sh-money-h">
          <div className="sh-panel-head">
            <h2 id="sh-money-h">{tx('ยอดขายสินค้า')}</h2>
            <span className="sh-sub">{tx('แยกบัญชีจากค่าสมัคร · นับเฉพาะคำสั่งซื้อที่จ่ายแล้ว')}</span>
          </div>
          {canViewFinance ? (
            <>
              <p className="sh-big">
                {formatThb(salesSatang)}
                <span className="sh-sub">
                  {' '}
                  {txf('+ ค่าส่ง {0} · {1} คำสั่งซื้อที่จ่ายแล้ว', formatThb(shippingSatang), paid.length)}
                </span>
              </p>
              {byProduct.length > 0 && (
                <>
                  <div className="sh-share" aria-hidden="true">
                    {byProduct.slice(0, 3).map((x, i) => (
                      <span
                        key={x.p.id}
                        className={SHARE_CLASSES[i]}
                        style={{ width: `${(x.satang / Math.max(salesSatang, 1)) * 100}%` }}
                      />
                    ))}
                  </div>
                  <ul className="sh-legend">
                    {byProduct.slice(0, 3).map((x, i) => (
                      <li key={x.p.id}>
                        <i className={`sh-sw ${SHARE_CLASSES[i]}`} aria-hidden="true" />
                        {tx(x.p.nameTh)} <strong>{formatThb(x.satang)}</strong>
                      </li>
                    ))}
                    {byProduct.length > 3 && <li className="sh-sub">{txf('และอีก {0} รายการ', byProduct.length - 3)}</li>}
                  </ul>
                </>
              )}
            </>
          ) : (
            <p className="sh-sub">
              <FaIcon name="lock" /> {tx('ตัวเลขเงินเห็นเฉพาะเจ้าขององค์กรและฝ่ายการเงิน')}
            </p>
          )}
        </section>

        <section className="sh-panel" aria-labelledby="sh-state-h">
          <div className="sh-panel-head">
            <h2 id="sh-state-h">{tx('คำสั่งซื้อตามสถานะส่งของ')}</h2>
            <span className="sh-sub">{tx('กดแถบเพื่อดูรายการ')}</span>
          </div>
          {orders.length === 0 ? (
            <p className="sh-sub">{tx('ยังไม่มีคำสั่งซื้อ')}</p>
          ) : (
            <div className="sh-states">
              {STATE_ORDER.filter((k) => stateCounts[k] > 0).map((k) => {
                const on = stateFilter === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    className={`sh-state${on ? ' is-on' : ''}`}
                    onClick={() => setStateFilter(on ? 'all' : k)}
                  >
                    <span className="sh-state-label">
                      <FaIcon name={STATE_META[k].icon} />
                      {tx(STATE_META[k].label)}
                    </span>
                    <span className="sh-state-track" aria-hidden="true">
                      <span
                        className={k === 'unpaid' ? 'is-neutral' : ''}
                        style={{ width: `${(stateCounts[k] / maxState) * 100}%` }}
                      />
                    </span>
                    <strong>{stateCounts[k]}</strong>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="sh-panel" aria-labelledby="sh-prod-h">
        <div className="sh-panel-head">
          <h2 id="sh-prod-h">{tx('สินค้า')}</h2>
          <span className="sh-sub">{txf('{0} รายการ · ขายแล้วเทียบเพดาน', event.products.length)}</span>
        </div>
        {event.products.length === 0 ? (
          <div className="sh-empty">
            <FaIcon name="store" />
            <strong>{tx('ยังไม่มีสินค้าในร้านของงานนี้')}</strong>
            <span className="sh-sub">{tx('เพิ่มสินค้าแรกได้จากปุ่ม "เพิ่มสินค้า" ด้านบน')}</span>
          </div>
        ) : (
          <ul className="sh-products">
            {event.products.map((p) => {
              const pct = p.stockOrCeiling ? Math.min(100, (p.soldCount / p.stockOrCeiling) * 100) : 0;
              const full = p.stockOrCeiling > 0 && p.soldCount >= p.stockOrCeiling;
              return (
                <li key={p.id} className="sh-product">
                  <span className="sh-thumb" aria-hidden="true">
                    <FaIcon name={CAT_ICON[p.categoryLabel] ?? 'bag-shopping'} />
                  </span>
                  <div className="sh-prod-main">
                    <div className="sh-prod-title">
                      <strong>{tx(p.nameTh)}</strong>
                      {full ? (
                        <span className="sh-tag is-danger">
                          <FaIcon name="ban" />
                          {tx('ขายครบเพดานแล้ว')}
                        </span>
                      ) : p.saleMode === 'preorder' ? (
                        <span className="sh-tag is-warn">
                          <FaIcon name="clock" />
                          {p.preorderCloseDate ? txf('พรีออเดอร์ ปิด {0}', p.preorderCloseDate) : tx('พรีออเดอร์')}
                        </span>
                      ) : (
                        <span className="sh-tag is-ok">
                          <FaIcon name="check" />
                          {tx('พร้อมขาย')}
                        </span>
                      )}
                    </div>
                    <span className="sh-sub">
                      {tx(SERVICE_TEXT[p.serviceModel])}
                      {p.preorderMinQty ? ` · ${txf('ผลิตเมื่อถึง {0} ชิ้น', p.preorderMinQty)}` : ''}
                    </span>
                  </div>
                  <div className="sh-prod-sold">
                    <span>
                      {txf('{0} / {1} ชิ้น', p.soldCount, p.stockOrCeiling)}
                    </span>
                    <span
                      className="sh-bar"
                      role="img"
                      aria-label={txf('ขายแล้ว {0} จาก {1}', p.soldCount, p.stockOrCeiling)}
                    >
                      <span style={{ width: `${pct}%` }} />
                    </span>
                  </div>
                  <strong className="sh-price">{formatThb(p.priceSatang)}</strong>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="sh-panel" aria-labelledby="sh-orders-h">
        <div className="sh-panel-head">
          <h2 id="sh-orders-h">{tx(stateFilter === 'all' ? 'คำสั่งซื้อล่าสุด' : 'คำสั่งซื้อตามสถานะที่เลือก')}</h2>
          <span className="sh-sub">{tx('คนซื้อไม่จำเป็นต้องเป็นนักวิ่ง')}</span>
          {stateFilter !== 'all' && (
            <button type="button" className="sh-link" onClick={() => setStateFilter('all')}>
              {tx('ดูทุกสถานะ')}
            </button>
          )}
        </div>
        {listed.length === 0 ? (
          <p className="sh-sub">{tx('ยังไม่มีคำสั่งซื้อ')}</p>
        ) : (
          <table className="sh-table">
            <thead>
              <tr>
                <th scope="col">{tx('เลขคำสั่งซื้อ')}</th>
                <th scope="col">{tx('ผู้ซื้อ · รายการ')}</th>
                <th scope="col">{tx('เงิน')}</th>
                <th scope="col">{tx('ส่งของ')}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const st = orderState(o);
                return (
                  <tr key={o.id}>
                    <td className="sh-code">{o.merchOrderCode}</td>
                    <td>
                      <strong>{tx(o.buyerName)}</strong>
                      <span className="sh-sub sh-block">
                        {tx(o.productNameTh)} {o.variantSize && txf('ไซซ์ {0}', o.variantSize)} ×{o.quantity} ·{' '}
                        {o.linkedRegistrationCode ? txf('ผู้สมัคร {0}', o.linkedRegistrationCode) : tx('ไม่ได้สมัครวิ่ง')} ·{' '}
                        {tx(o.deliveryMethod === 'postal_shipping' ? 'ส่งไปรษณีย์' : 'รับหน้างาน')}
                      </span>
                    </td>
                    <td>
                      {o.paymentStatus === 'succeeded' ? (
                        <span className="sh-tag is-ok">
                          <FaIcon name="money-bill" />
                          {canViewFinance ? txf('จ่ายแล้ว {0}', formatThb(o.totalPaidSatang)) : tx('จ่ายแล้ว')}
                        </span>
                      ) : (
                        <span className="sh-tag is-muted">
                          <FaIcon name="clock" />
                          {tx('ยังไม่ชำระ')}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`sh-tag ${STATE_META[st].tone}`}>
                        <FaIcon name={STATE_META[st].icon} />
                        {st === 'partial' ? txf('รับแล้ว {0}/{1}', o.deliveredQty, o.quantity) : tx(STATE_META[st].label)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {listed.length > 8 && (
          <button type="button" className="sh-link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? tx('ย่อรายการ') : txf('ดูทั้งหมด {0} รายการ', listed.length)}
          </button>
        )}
      </section>
    </div>
  );
};
