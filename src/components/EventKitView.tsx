/**
 * "เสื้อและของที่ได้รับ" — approved mockup (24 Nov 2026).
 * What a runner gets for the entry fee, shirts booked per size, how runners collect the kit,
 * and the shirt production count worked out from real numbers (never counted twice).
 * A request for a production price is not a production order: production starts only after the
 * organizer approves design, price and quantity on the production request itself.
 */
import React, { useId, useMemo, useState } from 'react';
import type {
  PlatformShirtSizeOption,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  ShirtSizeCode,
  ShirtSizeMeasurement,
  ShirtStock,
} from '../types';
import { resolveShirtSpec } from '../data/runnerProfileDefaults';
import { formatThb } from '../utils/pricing';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { SelectMenu } from './SelectMenu';
import '../event-home.css';
import '../event-setup.css';

type ShirtPatch = {
  shirtStocks?: ShirtStock[];
  customSizeChart?: Record<string, ShirtSizeMeasurement>;
};

export interface EventKitViewProps {
  event: RaceEvent;
  /** registrations of this event only */
  registrations: RegistrationRecord[];
  /** production requests of this event, newest first */
  productionInquiries: ProductionInquiry[];
  platformSizes: PlatformShirtSizeOption[];
  canEdit: boolean;
  onUpdateShirtConfig?: (patch: ShirtPatch) => void;
  onSaveShippingFee: (feeSatang: number) => Promise<{ ok: boolean; error?: string }>;
  onRequestQuote: (payload: {
    packageQty: number;
    addonQty: number;
    bufferQty: number;
    existingStockQty: number;
    targetDeliveryDate: string;
  }) => void;
  onOpenPageContent: () => void;
  onOpenAllRequests: () => void;
}

export const EventKitView: React.FC<EventKitViewProps> = (p) => {
  const uid = useId();
  const ids = {
    items: `${uid}-items`,
    sizes: `${uid}-sizes`,
    pickup: `${uid}-pickup`,
    make: `${uid}-make`,
  };
  const jumps = [
    { id: ids.items, label: 'ของในชุดแข่ง' },
    { id: ids.sizes, label: 'เสื้อตามไซซ์' },
    { id: ids.pickup, label: 'วิธีรับของ' },
    { id: ids.make, label: 'สั่งผลิต' },
  ];

  return (
    <div className="es-page">
      <header className="es-head">
        <div>
          <h1>{tx('เสื้อและของที่ได้รับ')}</h1>
          <p className="es-sub">{tx('ของในชุดแข่ง เสื้อแต่ละไซซ์ วิธีรับของ และการสั่งผลิต')}</p>
        </div>
      </header>

      <nav className="es-jumps" aria-label={tx('ไปยังส่วนของหน้านี้')}>
        {jumps.map((j) => (
          <a key={j.id} href={`#${j.id}`} className="es-jump">
            {tx(j.label)}
          </a>
        ))}
      </nav>

      <KitItems id={ids.items} event={p.event} canEdit={p.canEdit} onEdit={p.onOpenPageContent} />
      <ShirtSizes id={ids.sizes} {...p} />
      <div className="kt-grid2">
        <Pickup id={ids.pickup} {...p} />
        <Production id={ids.make} {...p} />
      </div>
    </div>
  );
};

/* ---------------- kit items ---------------- */

const KitItems: React.FC<{ id: string; event: RaceEvent; canEdit: boolean; onEdit: () => void }> = ({
  id,
  event,
  canEdit,
  onEdit,
}) => {
  const items = event.racePackItems ?? [];
  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('ของในชุดแข่ง')}</h2>
        <span className="es-sub">{tx('ได้ตามสิทธิ์สมัคร ไม่ใช่ของที่ซื้อเพิ่ม')}</span>
        {canEdit && (
          <button type="button" className="es-link" onClick={onEdit}>
            {tx('แก้รายการในเนื้อหาหน้างาน')}
            <FaIcon name="chevron-right" />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="es-empty">{tx('ยังไม่ได้ระบุของในชุดแข่ง นักวิ่งจะไม่เห็นว่าได้อะไรบ้าง')}</p>
      ) : (
        <ul className="kt-items">
          {items.map((it, i) => (
            <li key={`${it.title}-${i}`} className="kt-item">
              <FaIcon name={it.icon || 'box-open'} />
              <span className="kt-item-main">
                <strong>{tx(it.title)}</strong>
                {it.scope && <span className="es-sub">{tx(it.scope)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/* ---------------- shirts per size ---------------- */

const ShirtSizes: React.FC<EventKitViewProps & { id: string }> = ({
  id,
  event,
  platformSizes,
  canEdit,
  onUpdateShirtConfig,
}) => {
  const [openSize, setOpenSize] = useState<string | null>(null);
  const editable = canEdit && !!onUpdateShirtConfig;
  const spec = (size: string) => resolveShirtSpec(size, 'Unisex', platformSizes, event.customSizeChart);
  const missing = platformSizes.filter((o) => o.enabled && !event.shirtStocks.some((s) => s.size === o.code));
  const totals = event.shirtStocks.reduce(
    (a, s) => ({ booked: a.booked + s.reservedOrConfirmed, open: a.open + s.total }),
    { booked: 0, open: 0 }
  );

  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('เสื้อตามไซซ์')}</h2>
        <span className="es-sub">
          {txf('จองแล้ว {0} จากที่เปิดให้จอง {1} ตัว', totals.booked, totals.open)}
        </span>
      </div>

      {event.shirtStocks.length === 0 ? (
        <p className="es-empty">{tx('ยังไม่ได้เปิดไซซ์เสื้อ นักวิ่งจะเลือกไซซ์ไม่ได้')}</p>
      ) : (
        <>
          <p className="es-legend" aria-hidden="true">
            <span><i className="es-sw is-confirmed" />{tx('จองแล้ว (ยืนยัน + รอชำระ)')}</span>
            <span><i className="es-sw" style={{ background: 'var(--es-trk)' }} />{tx('ยังว่าง')}</span>
          </p>
          <div className="kt-size-head" aria-hidden="true">
            <span>{tx('ไซซ์')}</span>
            <span className="kt-size-spec">{tx('รอบอก · ยาว (นิ้ว)')}</span>
            <span />
            <span style={{ textAlign: 'right' }}>{tx('จองแล้ว / เปิดจอง')}</span>
          </div>
          <ul className="kt-sizes">
            {event.shirtStocks.map((st) => {
              const sp = spec(st.size);
              const left = Math.max(0, st.total - st.reservedOrConfirmed);
              const closed = st.total === 0;
              const full = !closed && left === 0;
              const low = !closed && !full && left <= Math.max(5, Math.ceil(st.total * 0.1));
              const open = openSize === st.size;
              return (
                <li key={st.size}>
                  <button
                    type="button"
                    className={`kt-size-row${open ? ' is-open' : ''}`}
                    disabled={!editable}
                    aria-expanded={editable ? open : undefined}
                    aria-label={txf(
                      'ไซซ์ {0} จองแล้ว {1} จาก {2} ตัว เหลือ {3}',
                      st.size,
                      st.reservedOrConfirmed,
                      st.total,
                      left
                    )}
                    onClick={() => setOpenSize(open ? null : st.size)}
                  >
                    <span className="kt-size-code">{st.size}</span>
                    <span className="kt-size-spec es-sub mono-num">
                      {sp.chestInch} · {sp.lengthInch}
                    </span>
                    <span className="kt-size-bar" aria-hidden="true">
                      <span
                        className={`kt-size-fill${low || full ? ' is-low' : ''}`}
                        style={{ width: `${st.total ? (st.reservedOrConfirmed / st.total) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="kt-size-num">
                      <span className="mono-num">
                        {st.reservedOrConfirmed} / {st.total}
                      </span>
                      {closed ? (
                        <span className="es-sub">{tx('ยังไม่เปิดจอง')}</span>
                      ) : full ? (
                        <span className="es-tag is-bad">{tx('เต็มแล้ว')}</span>
                      ) : low ? (
                        <span className="es-tag is-wait">{txf('ใกล้หมด · เหลือ {0}', left)}</span>
                      ) : (
                        <span className="es-sub">{txf('เหลือ {0}', left)}</span>
                      )}
                    </span>
                  </button>
                  {open && editable && (
                    <SizeEditor
                      stock={st}
                      spec={sp}
                      onCancel={() => setOpenSize(null)}
                      onSave={(total, chest, length) => {
                        onUpdateShirtConfig!({
                          shirtStocks: event.shirtStocks.map((x) => (x.size === st.size ? { ...x, total } : x)),
                          customSizeChart: {
                            ...(event.customSizeChart ?? {}),
                            [st.size]: { chestInch: chest, lengthInch: length },
                          },
                        });
                        setOpenSize(null);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <p className="es-note">
        {editable
          ? tx('กดแถวเพื่อแก้จำนวนเปิดจองและขนาดเสื้อ · ลดต่ำกว่าที่จองแล้วไม่ได้ · ไซซ์ที่เต็ม นักวิ่งจะเลือกไม่ได้')
          : tx('ไซซ์ที่เต็ม นักวิ่งจะเลือกไม่ได้')}
      </p>

      {editable && missing.length > 0 && (
        <AddSize
          missing={missing}
          onAdd={(size, total) =>
            onUpdateShirtConfig!({
              shirtStocks: [...event.shirtStocks, { size, total, reservedOrConfirmed: 0 }],
            })
          }
        />
      )}
    </section>
  );
};

const SizeEditor: React.FC<{
  stock: ShirtStock;
  spec: ShirtSizeMeasurement;
  onSave: (total: number, chest: string, length: string) => void;
  onCancel: () => void;
}> = ({ stock, spec, onSave, onCancel }) => {
  const uid = useId();
  const [total, setTotal] = useState(String(stock.total));
  const [chest, setChest] = useState(spec.chestInch);
  const [length, setLength] = useState(spec.lengthInch);
  const n = Number(total);
  const error =
    !Number.isInteger(n) || n < 0
      ? tx('จำนวนต้องเป็นจำนวนเต็ม')
      : n < stock.reservedOrConfirmed
        ? txf('ลดต่ำกว่าที่จองแล้ว ({0} ตัว) ไม่ได้', stock.reservedOrConfirmed)
        : null;

  return (
    <form
      className="kt-size-edit"
      onSubmit={(e) => {
        e.preventDefault();
        if (!error) onSave(n, chest.trim(), length.trim());
      }}
    >
      <label className="kt-field" htmlFor={`${uid}-t`}>
        {txf('เปิดจองไซซ์ {0} (ตัว)', stock.size)}
        <input
          id={`${uid}-t`}
          type="number"
          inputMode="numeric"
          className="mono-num"
          min={stock.reservedOrConfirmed}
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          autoFocus
        />
      </label>
      <label className="kt-field" htmlFor={`${uid}-c`}>
        {tx('รอบอก (นิ้ว)')}
        <input id={`${uid}-c`} type="text" value={chest} onChange={(e) => setChest(e.target.value)} />
      </label>
      <label className="kt-field" htmlFor={`${uid}-l`}>
        {tx('ยาว (นิ้ว)')}
        <input id={`${uid}-l`} type="text" value={length} onChange={(e) => setLength(e.target.value)} />
      </label>
      <button type="submit" className="es-btn is-primary es-btn-sm" disabled={!!error}>
        {tx('บันทึก')}
      </button>
      <button type="button" className="es-btn es-btn-sm" onClick={onCancel}>
        {tx('ยกเลิก')}
      </button>
      {error && (
        <p className="es-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};

const AddSize: React.FC<{
  missing: PlatformShirtSizeOption[];
  onAdd: (size: ShirtSizeCode, total: number) => void;
}> = ({ missing, onAdd }) => {
  const uid = useId();
  const [pick, setPick] = useState<string>(missing[0].code);
  const [qty, setQty] = useState('20');
  const code = missing.some((m) => m.code === pick) ? pick : missing[0].code;
  const n = Number(qty);
  const ok = Number.isInteger(n) && n >= 1;
  return (
    <form
      className="kt-calc-inputs"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onAdd(code as ShirtSizeCode, n);
      }}
    >
      <label className="kt-field" htmlFor={`${uid}-s`}>
        {tx('เพิ่มไซซ์')}
        <SelectMenu
          id={`${uid}-s`}
          value={code}
          onChange={(v) => setPick(v)}
          options={missing.map((m) => ({ value: m.code, label: `${m.code} (${m.chartByType.Unisex.chestInch})` }))}
        />
      </label>
      <label className="kt-field" htmlFor={`${uid}-q`}>
        {tx('เปิดจอง (ตัว)')}
        <input
          id={`${uid}-q`}
          type="number"
          inputMode="numeric"
          className="mono-num"
          min={1}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
        />
      </label>
      <button type="submit" className="es-btn es-btn-sm" disabled={!ok}>
        <FaIcon name="plus" />
        {tx('เปิดไซซ์นี้')}
      </button>
    </form>
  );
};

/* ---------------- pickup methods ---------------- */

const Pickup: React.FC<EventKitViewProps & { id: string }> = ({
  id,
  event,
  registrations,
  canEdit,
  onSaveShippingFee,
}) => {
  const counts = useMemo(() => {
    let pickup = 0;
    let post = 0;
    for (const r of registrations) {
      if (r.registrationStatus !== 'confirmed' && r.registrationStatus !== 'pending_payment') continue;
      if (r.kitDeliveryMethod === 'postal_shipping') post += 1;
      else pickup += 1;
    }
    return { pickup, post };
  }, [registrations]);

  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('วิธีรับชุดแข่ง')}</h2>
        <span className="es-sub">{tx('นักวิ่งเลือกตอนสมัคร · นับใบสมัครที่ยืนยันและรอชำระ')}</span>
      </div>
      <div className="kt-methods">
        <div className="kt-method">
          <div className="kt-method-head">
            <FaIcon name="store" />
            <strong>{tx('รับหน้างาน')}</strong>
            <span className="kt-method-count mono-num">{txf('{0} คน', counts.pickup)}</span>
          </div>
          <span className="es-sub">{event.kitPickupWindow ? tx(event.kitPickupWindow) : tx('ยังไม่ได้ระบุวันและสถานที่รับ')}</span>
        </div>
        <div className="kt-method">
          <div className="kt-method-head">
            <FaIcon name="truck-fast" />
            <strong>{tx('ส่งไปรษณีย์')}</strong>
            <span className="kt-method-count mono-num">{txf('{0} คน', counts.post)}</span>
          </div>
          <ShippingFee currentSatang={event.kitShippingFeeSatang} canEdit={canEdit} onSave={onSaveShippingFee} />
        </div>
      </div>
    </section>
  );
};

/** postal fee for the race kit (moved from the old kit page, same rules: 0–1,000 baht, new registrations only) */
const ShippingFee: React.FC<{
  currentSatang?: number;
  canEdit: boolean;
  onSave: (feeSatang: number) => Promise<{ ok: boolean; error?: string }>;
}> = ({ currentSatang, canEdit, onSave }) => {
  const uid = useId();
  const [baht, setBaht] = useState(currentSatang !== undefined ? String(currentSatang / 100) : '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const n = Number(baht);
    if (baht.trim() === '' || !Number.isFinite(n) || n < 0 || n > 1000) {
      setMsg({ ok: false, text: tx('กรอกค่าจัดส่งเป็นตัวเลข 0–1,000 บาท') });
      return;
    }
    setSaving(true);
    const res = await onSave(Math.round(n * 100));
    setSaving(false);
    setMsg(
      res.ok
        ? { ok: true, text: tx('บันทึกแล้ว ใช้กับใบสมัครใหม่ตั้งแต่ตอนนี้') }
        : { ok: false, text: res.error ? tx(res.error) : tx('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง') }
    );
  };

  return (
    <form
      className="kt-calc-inputs"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="kt-field" htmlFor={`${uid}-fee`}>
        {tx('ค่าส่งต่อคน (บาท)')}
        <input
          id={`${uid}-fee`}
          type="number"
          inputMode="decimal"
          min={0}
          max={1000}
          step={1}
          className="mono-num"
          value={baht}
          placeholder="50"
          disabled={!canEdit || saving}
          onChange={(e) => {
            setBaht(e.target.value);
            setMsg(null);
          }}
        />
      </label>
      {canEdit && (
        <button type="submit" className="es-btn es-btn-sm" disabled={saving}>
          {saving ? tx('กำลังบันทึก…') : tx('บันทึก')}
        </button>
      )}
      <p className="es-sub" style={{ flexBasis: '100%', margin: 0 }}>
        {currentSatang === undefined
          ? tx('ยังไม่ได้กำหนด หน้าสมัครใช้ค่าเริ่มต้น 50 บาท')
          : txf('ตอนนี้ {0} · จ่ายพร้อมค่าสมัคร · นับเป็นยอดของผู้จัด · มีผลกับใบสมัครใหม่', formatThb(currentSatang))}
      </p>
      {msg && (
        <p className={msg.ok ? 'es-ok' : 'es-error'} role={msg.ok ? 'status' : 'alert'} style={{ margin: 0 }}>
          {msg.text}
        </p>
      )}
    </form>
  );
};

/* ---------------- production ---------------- */

const QUOTE_STATUS: Record<ProductionInquiry['quoteStatus'], { label: string; tone: string }> = {
  draft: { label: 'ร่าง', tone: 'is-wait' },
  submitted: { label: 'รอใบเสนอราคา', tone: 'is-wait' },
  quoted_demo: { label: 'ได้ใบเสนอราคาแล้ว', tone: 'is-wait' },
  accepted: { label: 'อนุมัติราคาแล้ว', tone: 'is-ok' },
};

const MAKE_STATUS: Record<ProductionInquiry['productionStatus'], { label: string; tone: string }> = {
  awaiting_approval: { label: 'ยังไม่เริ่ม · รอคุณอนุมัติแบบ', tone: 'is-wait' },
  ready_to_produce: { label: 'พร้อมผลิต', tone: 'is-ok' },
  in_production: { label: 'กำลังผลิต', tone: 'is-ok' },
  qc_passed: { label: 'ตรวจคุณภาพผ่าน', tone: 'is-ok' },
};

const Production: React.FC<EventKitViewProps & { id: string }> = ({
  id,
  event,
  productionInquiries,
  canEdit,
  onRequestQuote,
  onOpenAllRequests,
}) => {
  const uid = useId();
  const [buffer, setBuffer] = useState('15');
  const [existing, setExisting] = useState('0');
  const [target, setTarget] = useState('');
  const [sent, setSent] = useState(false);

  const pkg = event.shirtStocks.reduce((s, x) => s + x.reservedOrConfirmed, 0);
  const shop = event.products.filter((x) => x.categoryLabel === 'เสื้อที่ระลึก').reduce((s, x) => s + x.soldCount, 0);
  const buf = Math.max(0, Math.floor(Number(buffer) || 0));
  const have = Math.max(0, Math.floor(Number(existing) || 0));
  const net = Math.max(0, pkg + shop + buf - have);

  // waterfall geometry: each step starts where the previous one ended
  const peak = Math.max(pkg + shop + buf, net, 1);
  const h = (n: number) => `${(n / peak) * 100}%`;
  const steps = [
    { label: 'สิทธิ์สมัคร', value: pkg, base: 0, kind: '' , sign: '' },
    { label: 'ซื้อในร้าน', value: shop, base: pkg, kind: 'is-add', sign: '+' },
    { label: 'สำรอง', value: buf, base: pkg + shop, kind: 'is-add', sign: '+' },
    { label: 'มีอยู่แล้ว', value: have, base: Math.max(0, pkg + shop + buf - have), kind: 'is-sub', sign: '−' },
    { label: 'ต้องผลิต', value: net, base: 0, kind: 'is-total', sign: '' },
  ];
  const latest = productionInquiries[0];

  return (
    <section id={id} className="es-panel es-anchor" aria-labelledby={`${id}-h`}>
      <div className="es-panel-head">
        <h2 id={`${id}-h`}>{tx('สั่งผลิตเสื้อ')}</h2>
        <span className="es-sub">{tx('คำนวณจากยอดจริง ไม่นับซ้ำ')}</span>
      </div>

      <div
        role="img"
        aria-label={txf(
          'สิทธิ์สมัคร {0} บวกซื้อในร้าน {1} บวกสำรอง {2} ลบที่มีอยู่แล้ว {3} เท่ากับต้องผลิต {4} ตัว',
          pkg,
          shop,
          buf,
          have,
          net
        )}
      >
        <div className="kt-fall" aria-hidden="true">
          {steps.map((s) => (
            <div key={s.label} className="kt-fall-col">
              <span className={`kt-fall-bar ${s.kind}`} style={{ bottom: h(s.base), height: h(s.value) }} />
              <span className="kt-fall-val mono-num" style={{ bottom: h(s.base + s.value) }}>
                {s.sign}
                {s.value}
              </span>
            </div>
          ))}
        </div>
        <div className="kt-fall-labels" aria-hidden="true">
          {steps.map((s) => (
            <span key={s.label}>{tx(s.label)}</span>
          ))}
        </div>
      </div>

      {canEdit && (
        <form
          className="kt-calc-inputs"
          onSubmit={(e) => {
            e.preventDefault();
            if (net <= 0 || !target) return;
            onRequestQuote({
              packageQty: pkg,
              addonQty: shop,
              bufferQty: buf,
              existingStockQty: have,
              targetDeliveryDate: target,
            });
            setSent(true);
          }}
        >
          <label className="kt-field" htmlFor={`${uid}-b`}>
            {tx('สำรองเผื่อ (ตัว)')}
            <input id={`${uid}-b`} type="number" min={0} inputMode="numeric" className="mono-num" value={buffer} onChange={(e) => { setBuffer(e.target.value); setSent(false); }} />
          </label>
          <label className="kt-field" htmlFor={`${uid}-e`}>
            {tx('มีอยู่แล้ว (ตัว)')}
            <input id={`${uid}-e`} type="number" min={0} inputMode="numeric" className="mono-num" value={existing} onChange={(e) => { setExisting(e.target.value); setSent(false); }} />
          </label>
          <label className="kt-field" htmlFor={`${uid}-d`}>
            {tx('ต้องการรับของ')}
            <input id={`${uid}-d`} type="date" value={target} onChange={(e) => { setTarget(e.target.value); setSent(false); }} style={{ width: '10rem' }} />
          </label>
          <button type="submit" className="es-btn is-primary" disabled={net <= 0 || !target}>
            {txf('ขอราคาผลิต {0} ตัว', net)}
          </button>
          <p className="es-sub" style={{ flexBasis: '100%', margin: 0 }}>
            {!target
              ? tx('เลือกวันที่ต้องการรับของก่อนส่งคำขอ')
              : tx('ขอราคายังไม่ใช่การสั่งผลิต จะเริ่มผลิตเมื่อคุณอนุมัติแบบ ราคา และจำนวนแล้ว')}
          </p>
          {sent && (
            <p className="es-ok" role="status" style={{ margin: 0 }}>
              {tx('ส่งคำขอราคาแล้ว ดูสถานะด้านล่าง')}
            </p>
          )}
        </form>
      )}

      {latest ? (
        <div className="kt-rfq">
          <div className="es-panel-head">
            <strong>{txf('คำขอ {0} · {1} {2} ตัว', latest.inquiryCode, tx(latest.itemType), latest.netQtyToProduce)}</strong>
            <span className="es-sub">{txf('ส่งเมื่อ {0}', latest.createdAt)}</span>
          </div>
          <ul className="kt-rfq-steps">
            <li>
              <span className="es-sub">{tx('ราคา')}</span>
              <span className={`es-tag ${QUOTE_STATUS[latest.quoteStatus].tone}`}>{tx(QUOTE_STATUS[latest.quoteStatus].label)}</span>
            </li>
            <li>
              <span className="es-sub">{tx('การผลิต')}</span>
              <span className={`es-tag ${MAKE_STATUS[latest.productionStatus].tone}`}>{tx(MAKE_STATUS[latest.productionStatus].label)}</span>
            </li>
            {latest.quotedTotalSatang !== undefined && (
              <li>
                <span className="es-sub">{tx('ยอดตามใบเสนอราคา')}</span>
                <strong className="mono-num">{formatThb(latest.quotedTotalSatang)}</strong>
              </li>
            )}
          </ul>
          <button type="button" className="es-link" style={{ alignSelf: 'flex-start' }} onClick={onOpenAllRequests}>
            {tx('ดูคำขอผลิตทั้งหมดขององค์กร')}
            <FaIcon name="chevron-right" />
          </button>
        </div>
      ) : (
        <p className="es-sub" style={{ margin: 0 }}>{tx('ยังไม่มีคำขอผลิตของงานนี้')}</p>
      )}
    </section>
  );
};
