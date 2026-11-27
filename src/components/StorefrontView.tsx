import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { EventProduct, MerchOrderRecord, RaceEvent, UserAccount } from '../types';
import { tx, txf } from '../i18n';
import { formatThb } from '../utils/pricing';
import { displayPhone } from '../utils/phone';
import { ProductArt, souvenirArt } from './ProductArt';
import { RegistrationStepper } from './RegistrationStepper';
import { RegistrationDone, RegistrationSummary, type ReviewSection } from './RegistrationReview';
import { PhoneInput } from './PhoneInput';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { RequiredFieldText } from './RequiredFieldText';
import { ThaiPostalAddressSelector, type CascadingAddressValue } from './ThaiPostalAddressSelector';
import { IconAlert, IconBag, IconClose } from './Icons';

/**
 * Event storefront with a cart (customers can buy without registering).
 *
 * Browse: product cards with a sample picture, filtered by category; a card opens a
 * detail dialog (size, quantity, seller / payee / who delivers) that adds to the cart.
 * Checkout: cart → collection (expo booth or post) → review and pay → success.
 * The server re-prices every line, checks stock for the whole cart in one transaction
 * and writes one order per line under a shared checkout code.
 */

export interface CartLine {
  productId: string;
  size: string;
  qty: number;
}

export interface MerchCheckoutPayload {
  eventId: string;
  items: CartLine[];
  buyerName: string;
  deliveryMethod: 'pickup_at_expo' | 'postal_shipping';
  shippingAddress?: string;
  linkedRegistrationCode?: string;
}

export interface MerchCheckoutResult {
  ok: boolean;
  error?: string;
  orders?: MerchOrderRecord[];
  checkoutCode?: string;
}

type Step = 1 | 2 | 3;
const ALL = 'all';
const MAX_QTY = 10;

const cartKey = (eventId: string) => `kratai.cart.${eventId}`;

function readCart(eventId: string): CartLine[] {
  try {
    const raw = window.sessionStorage.getItem(cartKey(eventId));
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(eventId: string, lines: CartLine[]) {
  try {
    if (lines.length === 0) window.sessionStorage.removeItem(cartKey(eventId));
    else window.sessionStorage.setItem(cartKey(eventId), JSON.stringify(lines));
  } catch {
    /* storage blocked: the cart lasts until the page is left */
  }
}

const leftOf = (p: EventProduct) => Math.max(0, p.stockOrCeiling - p.soldCount);

export function StorefrontView({
  event,
  currentUser,
  linkedRegistrationCode,
  focusProduct,
  onRequireLogin,
  onCheckout,
  onViewOrders,
}: {
  event: RaceEvent;
  currentUser: UserAccount | null;
  linkedRegistrationCode?: string;
  /** open this product's dialog (changes when another page asks to show a product) */
  focusProduct?: { id: string; n: number } | null;
  onRequireLogin: () => void;
  onCheckout: (payload: MerchCheckoutPayload) => Promise<MerchCheckoutResult>;
  onViewOrders: () => void;
}) {
  const products = event.products;
  const categories = useMemo(() => [...new Set(products.map((p) => p.categoryLabel))], [products]);
  const [filter, setFilter] = useState<string>(ALL);
  const [cart, setCart] = useState<CartLine[]>(() => readCart(event.id));
  const [detailId, setDetailId] = useState<string | null>(null);
  const [mode, setMode] = useState<'browse' | 'checkout'>('browse');
  const [step, setStep] = useState<Step>(1);
  const [done, setDone] = useState<MerchCheckoutResult | null>(null);
  const stepperRef = useRef<HTMLElement | null>(null);
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => writeCart(event.id, cart), [event.id, cart]);
  useEffect(() => {
    if (focusProduct?.id && products.some((p) => p.id === focusProduct.id)) setDetailId(focusProduct.id);
  }, [focusProduct, products]);
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [mode, step, done]);

  const byId = (id: string) => products.find((p) => p.id === id);
  const inCart = (id: string) => cart.filter((l) => l.productId === id).reduce((n, l) => n + l.qty, 0);
  const cartLines = cart
    .map((l) => ({ ...l, prd: byId(l.productId) }))
    .filter((l): l is CartLine & { prd: EventProduct } => Boolean(l.prd));
  const cartCount = cartLines.reduce((n, l) => n + l.qty, 0);
  const subtotal = cartLines.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);

  const addToCart = (productId: string, size: string, qty: number) => {
    setCart((prev) => {
      const i = prev.findIndex((l) => l.productId === productId && l.size === size);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(MAX_QTY, next[i].qty + qty) };
        return next;
      }
      return [...prev, { productId, size, qty }];
    });
  };
  const setLineQty = (idx: number, qty: number) =>
    setCart((prev) => (qty <= 0 ? prev.filter((_, i) => i !== idx) : prev.map((l, i) => (i === idx ? { ...l, qty } : l))));

  /* ---------- checkout: collection ---------- */
  const postalOnly = event.status === 'completed';
  const [delivery, setDelivery] = useState<'pickup_at_expo' | 'postal_shipping'>(
    postalOnly ? 'postal_shipping' : 'pickup_at_expo'
  );
  const savedAddrs = currentUser?.runnerProfile?.savedAddresses ?? [];
  const [addrMode, setAddrMode] = useState<'saved' | 'manual'>(savedAddrs.length > 0 ? 'saved' : 'manual');
  const [addrId, setAddrId] = useState<string>(
    savedAddrs.find((a) => a.isDefault)?.id ?? savedAddrs[0]?.id ?? ''
  );
  const [buyerName, setBuyerName] = useState(currentUser?.fullNameTh ?? '');
  const [recipient, setRecipient] = useState(currentUser?.fullNameTh ?? '');
  const [phone, setPhone] = useState(currentUser?.runnerProfile?.phone ?? '');
  const [addr, setAddr] = useState<CascadingAddressValue>({
    country: 'Thailand',
    postalCode: '',
    province: '',
    district: '',
    subdistrict: '',
    address: '',
  });
  const [channel, setChannel] = useState<'promptpay' | 'card'>('promptpay');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const savedAddr = savedAddrs.find((a) => a.id === addrId);
  const shippingText =
    delivery !== 'postal_shipping'
      ? ''
      : addrMode === 'saved' && savedAddr
      ? `${savedAddr.recipientName} (${savedAddr.phone}) — ${savedAddr.address}, ต.${savedAddr.subdistrict} อ.${savedAddr.district} จ.${savedAddr.province} ${savedAddr.postalCode}`
      : addr.address.trim() && addr.postalCode && addr.subdistrict
      ? `${recipient.trim()} (${phone.trim()}) — ${addr.address.trim()}, ต.${addr.subdistrict} อ.${addr.district} จ.${addr.province} ${addr.postalCode}`
      : '';

  // shipping is charged once per seller (each seller sends their own parcel); the server applies the same rule
  const shippingBySeller = useMemo(() => {
    const m = new Map<string, number>();
    if (delivery !== 'postal_shipping') return m;
    for (const l of cartLines) m.set(l.prd.sellerLabel, Math.max(m.get(l.prd.sellerLabel) ?? 0, l.prd.shippingFeeSatang));
    return m;
  }, [delivery, cartLines]);
  const shippingTotal = [...shippingBySeller.values()].reduce((a, b) => a + b, 0);
  const total = subtotal + shippingTotal;

  const startCheckout = () => {
    if (!currentUser) {
      onRequireLogin();
      return;
    }
    setError('');
    setMode('checkout');
    setStep(1);
  };

  const collectionError = (): string => {
    if (!buyerName.trim()) return tx('กรุณาระบุชื่อผู้สั่งซื้อ');
    if (delivery === 'postal_shipping') {
      if (addrMode === 'manual' && (!recipient.trim() || !phone.trim())) return tx('กรุณาระบุชื่อผู้รับและเบอร์โทร');
      if (!shippingText) return tx('กรุณาระบุที่อยู่สำหรับจัดส่งให้ครบ');
    }
    return '';
  };

  const submit = async () => {
    setError('');
    setSubmitting(true);
    const res = await onCheckout({
      eventId: event.id,
      items: cartLines.map(({ productId, size, qty }) => ({ productId, size, qty })),
      buyerName: buyerName.trim(),
      deliveryMethod: delivery,
      shippingAddress: delivery === 'postal_shipping' ? shippingText : undefined,
      linkedRegistrationCode,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ? tx(res.error) : tx('สั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง'));
      return;
    }
    setCart([]);
    setDone(res);
  };

  const steps: { step: Step; label: string }[] = [
    { step: 1, label: 'ตะกร้า' },
    { step: 2, label: 'รับสินค้า' },
    { step: 3, label: 'สรุปและชำระเงิน' },
  ];

  /* ================= success ================= */
  if (done) {
    const orders = done.orders ?? [];
    const paid = orders.reduce((n, o) => n + o.totalPaidSatang, 0);
    return (
      <section className="clean-panel sf-shell" ref={topRef}>
        <RegistrationDone
          title={tx('สั่งซื้อสินค้าสำเร็จ')}
          subtitle={
            <>
              {tx('เลขที่ตะกร้า')} <span className="mono-code">{done.checkoutCode}</span> ·{' '}
              {txf('แยกเป็น {0} คำสั่งซื้อตามรายการสินค้า', orders.length)}
            </>
          }
          items={[
            ...orders.map((o) => ({
              label: `${tx(o.productNameTh)}${o.variantSize && o.variantSize !== '-' ? ` · ${o.variantSize}` : ''} × ${o.quantity}`,
              value: o.merchOrderCode,
              mono: true,
            })),
            {
              label: tx('วิธีรับสินค้า'),
              value: orders[0]?.deliveryMethod === 'postal_shipping' ? tx('จัดส่งทางไปรษณีย์') : tx('รับที่บูธหน้างาน'),
            },
            { label: tx('ยอดชำระรวม'), value: formatThb(paid, true), accent: true },
          ]}
          note={
            orders[0]?.deliveryMethod === 'pickup_at_expo'
              ? tx('แสดงรหัสคำสั่งซื้อที่บูธร้านค้าเพื่อรับสินค้า ดูรหัสรับสินค้าได้ที่หน้าบัตรวิ่งและคำสั่งซื้อ')
              : tx('ผู้ขายแต่ละรายจะจัดส่งพัสดุของตัวเอง ติดตามสถานะได้ที่หน้าบัตรวิ่งและคำสั่งซื้อ')
          }
        >
          <button type="button" className="btn-primary" onClick={onViewOrders}>
            {tx('ไปหน้าประวัติการสมัคร & การสั่งซื้อ')}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setDone(null);
              setMode('browse');
            }}
          >
            {tx('เลือกซื้อสินค้าต่อ')}
          </button>
        </RegistrationDone>
      </section>
    );
  }

  /* ================= checkout ================= */
  if (mode === 'checkout') {
    const sections: ReviewSection[] = [
      {
        key: 'items',
        title: tx('สินค้า'),
        editStep: 1,
        rows: cartLines.map((l) => ({
          label: `${tx(l.prd.nameTh)}${l.size !== '-' ? ` · ${l.size}` : ''}`,
          value: `× ${l.qty} · ${tx(l.prd.sellerLabel)}`,
        })),
      },
      {
        key: 'collect',
        title: tx('การรับสินค้า'),
        editStep: 2,
        rows: [
          { label: tx('ผู้สั่งซื้อ'), value: buyerName.trim() },
          {
            label: tx('วิธีรับ'),
            value: delivery === 'postal_shipping' ? tx('จัดส่งทางไปรษณีย์') : tx('รับที่บูธร้านค้าหน้างาน'),
          },
          ...(delivery === 'postal_shipping' ? [{ label: tx('ที่อยู่จัดส่ง'), value: shippingText }] : []),
        ],
      },
    ];

    return (
      <section className="clean-panel sf-shell sf-checkout event-reg-wizard-pane" ref={topRef}>
        <div className="sf-checkout-head">
          <button type="button" className="btn-ghost-sm" onClick={() => setMode('browse')}>
            {tx('กลับไปเลือกสินค้า')}
          </button>
          <h2>{tx('สั่งซื้อสินค้าที่ระลึก')}</h2>
        </div>
        <RegistrationStepper steps={steps} current={step} complete={false} stepperRef={stepperRef} onJump={setStep} />

        {step === 1 && (
          <div className="sf-step">
            <h3 className="sf-step-title">{tx('ตะกร้าสินค้า')}</h3>
            {cartLines.length === 0 ? (
              <p className="subtle-empty-note">{tx('ยังไม่มีสินค้าในตะกร้า')}</p>
            ) : (
              <ul className="sf-cart">
                {cartLines.map((l, idx) => {
                  const room = leftOf(l.prd) - inCart(l.productId) + l.qty;
                  return (
                    <li key={`${l.productId}-${l.size}`} className="sf-cart-line">
                      <div className="sf-cart-art" aria-hidden="true">
                        <ProductArt categoryLabel={l.prd.categoryLabel} name={l.prd.nameTh} kind={souvenirArt(l.prd.categoryLabel, l.prd.nameTh)} className="sf-art-svg" />
                      </div>
                      <div className="sf-cart-copy">
                        <strong>{tx(l.prd.nameTh)}</strong>
                        <span className="muted-inline">
                          {l.size !== '-' ? `${tx('ไซส์')} ${l.size} · ` : ''}
                          {tx(l.prd.sellerLabel)}
                        </span>
                        <span className="mono-num">{formatThb(l.prd.priceSatang, true)}</span>
                      </div>
                      <div className="sf-qty" role="group" aria-label={txf('จำนวนของ {0}', tx(l.prd.nameTh))}>
                        <button type="button" onClick={() => setLineQty(idx, l.qty - 1)} aria-label={tx('ลดจำนวน')}>
                          −
                        </button>
                        <span className="mono-num" aria-live="polite">{l.qty}</span>
                        <button
                          type="button"
                          onClick={() => setLineQty(idx, l.qty + 1)}
                          disabled={l.qty >= Math.min(MAX_QTY, room)}
                          aria-label={tx('เพิ่มจำนวน')}
                        >
                          +
                        </button>
                      </div>
                      <button type="button" className="sf-cart-remove" onClick={() => setLineQty(idx, 0)}>
                        {tx('ลบ')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="sf-subtotal">
              <span>{txf('ค่าสินค้า ({0} ชิ้น)', cartCount)}</span>
              <strong className="mono-num">{formatThb(subtotal, true)}</strong>
            </div>
            <div className="reg-step-footer-between">
              <button type="button" className="btn-secondary" onClick={() => setMode('browse')}>
                {tx('เลือกสินค้าเพิ่ม')}
              </button>
              <button
                type="button"
                className="btn-primary reg-next-pill-btn"
                disabled={cartLines.length === 0}
                onClick={() => setStep(2)}
              >
                {tx('ถัดไป')}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="sf-step">
            <h3 className="sf-step-title">{tx('วิธีรับสินค้า')}</h3>
            <div className="form-row">
              <label htmlFor="sf-buyer">
                <RequiredFieldText text={tx('ชื่อผู้สั่งซื้อ *')} />
              </label>
              <input id="sf-buyer" type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>

            <div className="reg-lab-pair-cards" role="radiogroup" aria-label={tx('วิธีรับสินค้า')}>
              {(
                [
                  ['pickup_at_expo', 'รับที่บูธร้านค้าหน้างาน', 'แสดงรหัสคำสั่งซื้อ ไม่มีค่าส่ง'],
                  ['postal_shipping', 'จัดส่งทางไปรษณีย์', 'ค่าส่งคิดครั้งเดียวต่อผู้ขาย'],
                ] as const
              ).map(([id, title, sub]) => {
                const off = id === 'pickup_at_expo' && postalOnly;
                return (
                  <label
                    key={id}
                    className={`reg-category-radio-card ${delivery === id ? 'selected' : ''} ${off ? 'is-disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="sf-delivery"
                      checked={delivery === id}
                      disabled={off}
                      onChange={() => setDelivery(id)}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>{tx(title)}</strong>
                      <span className="muted-inline">{off ? tx('งานจบแล้ว รับหน้างานไม่ได้') : tx(sub)}</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {delivery === 'postal_shipping' && (
              <div className="sf-address">
                <div className="priority-pill-bar" role="group" aria-label={tx('ที่อยู่จัดส่ง')}>
                  <button
                    type="button"
                    aria-pressed={addrMode === 'saved'}
                    className={`filter-pill ${addrMode === 'saved' ? 'active' : ''}`}
                    disabled={savedAddrs.length === 0}
                    onClick={() => setAddrMode('saved')}
                  >
                    {tx('เลือกจากสมุดที่อยู่')}
                  </button>
                  <button
                    type="button"
                    aria-pressed={addrMode === 'manual'}
                    className={`filter-pill ${addrMode === 'manual' ? 'active' : ''}`}
                    onClick={() => setAddrMode('manual')}
                  >
                    {tx('กรอกที่อยู่ใหม่เอง')}
                  </button>
                </div>
                {addrMode === 'saved' ? (
                  <div className="sf-addr-list" role="radiogroup" aria-label={tx('สมุดที่อยู่')}>
                    {savedAddrs.map((a) => (
                      <label key={a.id} className={`reg-category-radio-card ${addrId === a.id ? 'selected' : ''}`}>
                        <input type="radio" name="sf-addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} />
                        <span className="custom-radio-circle" aria-hidden="true" />
                        <div className="reg-radio-card-copy">
                          <strong>{tx(a.addressName)}</strong>
                          <span className="muted-inline">
                            {a.recipientName} ({displayPhone(a.phone)}) · {a.address} ต.{a.subdistrict} อ.{a.district} จ.
                            {a.province} {a.postalCode}
                          </span>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <ThaiPostalAddressSelector
                    idPrefix="sf-ship"
                    compact
                    required
                    value={addr}
                    onChange={setAddr}
                    contactPhone={phone}
                    compactLead={
                      <>
                        <div className="form-row">
                          <label htmlFor="sf-recipient">
                            <RequiredFieldText text={tx('ชื่อผู้รับ *')} />
                          </label>
                          <input
                            id="sf-recipient"
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="sf-phone">
                            <RequiredFieldText text={tx('เบอร์โทรผู้รับ *')} />
                          </label>
                          <PhoneInput id="sf-phone" value={phone} onChange={setPhone} />
                        </div>
                      </>
                    }
                  />
                )}
              </div>
            )}

            {error && (
              <div className="error-callout" role="alert">
                <IconAlert size={17} />
                <span>{error}</span>
              </div>
            )}
            <div className="reg-step-footer-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>
                {tx('ย้อนกลับ')}
              </button>
              <button
                type="button"
                className="btn-primary reg-next-pill-btn"
                onClick={() => {
                  const msg = collectionError();
                  setError(msg);
                  if (!msg) setStep(3);
                }}
              >
                {tx('ถัดไป')}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="sf-step">
            <h3 className="sf-step-title">{tx('ตรวจคำสั่งซื้อและชำระเงิน')}</h3>
            <RegistrationSummary
              sections={sections}
              ledger={[
                {
                  key: 'items',
                  lines: cartLines.map((l) => ({
                    label: `${tx(l.prd.nameTh)} × ${l.qty}`,
                    sub: l.prd.saleMode === 'preorder' ? `${tx('พรีออเดอร์')} · ${tx(l.prd.estimatedDeliveryNote)}` : undefined,
                    satang: l.prd.priceSatang * l.qty,
                  })),
                },
                {
                  key: 'ship',
                  lines: [...shippingBySeller.entries()].map(([seller, fee]) => ({
                    label: txf('ค่าจัดส่ง ({0})', tx(seller)),
                    satang: fee,
                  })),
                },
              ]}
              totalSatang={total}
              onEdit={(s) => setStep(s as Step)}
            />
            <PaymentMethodPicker name="sf-pay" value={channel} onChange={setChannel} disabled={submitting} />
            {error && (
              <div className="error-callout" role="alert">
                <IconAlert size={17} />
                <span>{error}</span>
              </div>
            )}
            <div className="reg-step-footer-between">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)} disabled={submitting}>
                {tx('ย้อนกลับ')}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={submitting || cartLines.length === 0}
                onClick={() => void submit()}
              >
                {submitting ? tx('กำลังยืนยันคำสั่งซื้อ…') : txf('ชำระเงิน {0}', formatThb(total, true))}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ================= browse ================= */
  const shown = filter === ALL ? products : products.filter((p) => p.categoryLabel === filter);
  const detail = detailId ? byId(detailId) : undefined;

  return (
    <section className="clean-panel sf-shell" ref={topRef}>
      <header className="sf-head">
        <div>
          <h2>{tx('ร้านค้าของที่ระลึก')}</h2>
          <p className="muted-block">
            {tx('ซื้อได้โดยไม่ต้องสมัครวิ่ง แต่ละรายการระบุผู้ขาย ผู้รับเงิน และผู้ส่งมอบ')}
            {linkedRegistrationCode && (
              <>
                {' '}
                · {tx('อ้างอิงใบสมัคร')} <span className="mono-code">{linkedRegistrationCode}</span>{' '}
                {tx('(เป็นคำสั่งซื้อใหม่ ไม่แก้ยอดใบสมัครเดิม)')}
              </>
            )}
          </p>
        </div>
      </header>

      {products.length === 0 ? (
        <p className="subtle-empty-note">{tx('งานวิ่งนี้ยังไม่ได้เปิดรายการสินค้าหน้าร้านเพิ่มเติม')}</p>
      ) : (
        <>
          <div className="sf-filters" role="group" aria-label={tx('ประเภทสินค้า')}>
            {[ALL, ...categories].map((c) => {
              const n = c === ALL ? products.length : products.filter((p) => p.categoryLabel === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  className={`kr-chip ${filter === c ? 'is-on' : ''}`}
                  aria-pressed={filter === c}
                  onClick={() => setFilter(c)}
                >
                  {c === ALL ? tx('ทั้งหมด') : tx(c)} <span className="mono-num">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="sf-grid">
            {shown.map((p) => {
              const left = leftOf(p);
              const badge =
                left <= 0
                  ? tx('หมดแล้ว')
                  : p.saleMode === 'preorder'
                  ? tx('พรีออเดอร์')
                  : left <= 20
                  ? txf('เหลือ {0} ชิ้น', left)
                  : tx('พร้อมส่ง');
              return (
                <article key={p.id} className={`sf-card ${left <= 0 ? 'is-out' : ''}`}>
                  <button type="button" className="sf-card-hit" onClick={() => setDetailId(p.id)}>
                    <div className="sf-card-art">
                      <ProductArt categoryLabel={p.categoryLabel} name={p.nameTh} kind={souvenirArt(p.categoryLabel, p.nameTh)} className="sf-art-svg" />
                      <span className={`sf-badge ${left <= 0 ? 'is-out' : ''}`}>{badge}</span>
                    </div>
                    <div className="sf-card-body">
                      <span className="muted-inline">{tx(p.categoryLabel)}</span>
                      <strong>{tx(p.nameTh)}</strong>
                      <span className="muted-inline">{tx(p.sellerLabel)}</span>
                      <span className="sf-card-foot">
                        <span className="mono-num sf-price">{formatThb(p.priceSatang, true)}</span>
                        <span className="sf-card-cta">{tx('ดูสินค้า')}</span>
                      </span>
                    </div>
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      {cartCount > 0 && (
        <div className="sf-cart-bar" role="region" aria-label={tx('ตะกร้าสินค้า')}>
          <IconBag size={18} />
          <span>
            {txf('ตะกร้า {0} ชิ้น', cartCount)} · <strong className="mono-num">{formatThb(subtotal, true)}</strong>
          </span>
          <button type="button" className="btn-primary" onClick={startCheckout}>
            {currentUser ? tx('ไปชำระเงิน') : tx('เข้าสู่ระบบเพื่อสั่งซื้อ')}
          </button>
        </div>
      )}

      {detail && (
        <ProductDialog
          product={detail}
          alreadyInCart={inCart(detail.id)}
          onClose={() => setDetailId(null)}
          onAdd={(size, qty) => {
            addToCart(detail.id, size, qty);
            setDetailId(null);
          }}
        />
      )}
    </section>
  );
}

function ProductDialog({
  product: p,
  alreadyInCart,
  onClose,
  onAdd,
}: {
  product: EventProduct;
  alreadyInCart: number;
  onClose: () => void;
  onAdd: (size: string, qty: number) => void;
}) {
  const left = leftOf(p);
  const room = Math.max(0, Math.min(MAX_QTY, left - alreadyInCart));
  const [size, setSize] = useState(p.availableSizes[0] ?? '-');
  const [qty, setQty] = useState(1);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // rendered on <body>: a transformed ancestor would otherwise trap position: fixed
  return createPortal(
    <div className="sf-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sf-dialog" role="dialog" aria-modal="true" aria-labelledby="sf-dialog-title">
        <button ref={closeRef} type="button" className="sf-dialog-close" onClick={onClose} aria-label={tx('ปิด')}>
          <IconClose size={18} />
        </button>
        <div className="sf-dialog-art">
          <ProductArt categoryLabel={p.categoryLabel} name={p.nameTh} kind={souvenirArt(p.categoryLabel, p.nameTh)} className="sf-art-svg" />
        </div>
        <div className="sf-dialog-body">
          <span className="muted-inline">{tx(p.categoryLabel)}</span>
          <h3 id="sf-dialog-title">{tx(p.nameTh)}</h3>
          <p className="sf-dialog-price mono-num">{formatThb(p.priceSatang, true)}</p>
          <p className="muted-block">{tx(p.description)}</p>

          {p.availableSizes.length > 0 && (
            <fieldset className="sf-sizes">
              <legend>{tx('ไซส์ / แบบ')}</legend>
              {p.availableSizes.map((s) => (
                <label key={s} className={`pg-chip ${size === s ? 'is-selected' : ''}`}>
                  <input type="radio" name="sf-size" checked={size === s} onChange={() => setSize(s)} />
                  <span>{tx(s)}</span>
                </label>
              ))}
            </fieldset>
          )}

          <div className="sf-qty-row">
            <span>{tx('จำนวน')}</span>
            <div className="sf-qty" role="group" aria-label={tx('จำนวน')}>
              <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label={tx('ลดจำนวน')}>
                −
              </button>
              <span className="mono-num" aria-live="polite">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(room, q + 1))}
                disabled={qty >= room}
                aria-label={tx('เพิ่มจำนวน')}
              >
                +
              </button>
            </div>
            <span className="muted-inline">
              {left <= 0
                ? tx('หมดแล้ว')
                : alreadyInCart > 0
                ? txf('เหลือ {0} ชิ้น · อยู่ในตะกร้าแล้ว {1}', left, alreadyInCart)
                : txf('เหลือ {0} ชิ้น', left)}
            </span>
          </div>

          <dl className="sf-facts">
            <div>
              <dt>{tx('ผู้ขาย / ผู้รับเงิน')}</dt>
              <dd>{tx(p.sellerLabel)}</dd>
            </div>
            <div>
              <dt>{tx('ผู้ส่งมอบสินค้า')}</dt>
              <dd>{tx(p.fulfillmentOwnerLabel)}</dd>
            </div>
            <div>
              <dt>{p.saleMode === 'preorder' ? tx('พรีออเดอร์ ปิดรับ') : tx('สถานะ')}</dt>
              <dd>{p.saleMode === 'preorder' ? p.preorderCloseDate ?? '—' : tx('พร้อมส่งตามสต็อก')}</dd>
            </div>
            <div>
              <dt>{tx('กำหนดส่งมอบ')}</dt>
              <dd>{tx(p.estimatedDeliveryNote)}</dd>
            </div>
            <div>
              <dt>{tx('เงื่อนไข')}</dt>
              <dd>{tx(p.refundAndMinPolicyNote)}</dd>
            </div>
          </dl>

          <button
            type="button"
            className="btn-primary btn-full"
            disabled={room <= 0}
            onClick={() => onAdd(size, qty)}
          >
            {room <= 0 ? tx('เพิ่มไม่ได้แล้ว') : txf('ใส่ตะกร้า · {0}', formatThb(p.priceSatang * qty, true))}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
