/**
 * On-site check-in ("เช็กอินหน้างาน") — mobile-first, approved mockup 24 Nov 2026.
 *
 * Screens: start (scan or search + progress) → found runner (big BIB, items to hand
 * over, one confirm button) → blocked when already picked up (who and when, no confirm)
 * → shop pickup with partial hand-over. BIB hand-over and shop hand-over stay separate
 * records; the server blocks double pickups whatever this screen shows.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { MerchOrderRecord, RaceEvent, RegistrationRecord } from '../types';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../event-checkin.css';

type Mode = 'bib' | 'merch';
type Feedback = { tone: 'ok' | 'err'; text: string } | null;

interface Props {
  event: RaceEvent;
  /** registrations of this event */
  registrations: RegistrationRecord[];
  /** shop orders of this event */
  merchOrders: MerchOrderRecord[];
  staffName: string;
  onAssignBib: (regId: string, bib: string) => { ok: boolean; error?: string };
  onConfirmKit: (regId: string) => { ok: boolean; error?: string };
  onMerchHandover: (orderId: string, mode: 'partial_one' | 'complete_all') => { ok: boolean; message: string };
}

const norm = (s: string) => s.trim().toLowerCase();

function hourlyPickups(regs: RegistrationRecord[]) {
  const stamps = regs
    .filter((r) => r.fulfillmentStatus === 'kit_picked_up' && r.fulfillmentUpdatedAt)
    .map((r) => r.fulfillmentUpdatedAt as string);
  if (stamps.length === 0) return null;
  const day = stamps.map((s) => s.slice(0, 10)).sort().pop() as string;
  const counts = new Map<number, number>();
  stamps
    .filter((s) => s.startsWith(day))
    .forEach((s) => {
      const h = Number(s.slice(11, 13));
      if (!Number.isNaN(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
    });
  const hours = Array.from(counts.keys());
  const from = Math.min(...hours);
  const to = Math.max(...hours);
  const bars = [];
  for (let h = from; h <= to; h++) bars.push({ h, n: counts.get(h) ?? 0 });
  return { day, bars, total: stamps.filter((s) => s.startsWith(day)).length };
}

export const EventCheckInView: React.FC<Props> = ({
  event,
  registrations,
  merchOrders,
  staffName,
  onAssignBib,
  onConfirmKit,
  onMerchHandover,
}) => {
  const [mode, setMode] = useState<Mode>('bib');
  const [query, setQuery] = useState('');
  const [regId, setRegId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [bibDraft, setBibDraft] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const detailRef = useRef<HTMLHeadingElement>(null);

  const reg = registrations.find((r) => r.id === regId) ?? null;
  const order = merchOrders.find((m) => m.id === orderId) ?? null;
  const onDetail = Boolean(reg || order);

  useEffect(() => {
    if (onDetail) detailRef.current?.focus();
    else searchRef.current?.focus();
  }, [onDetail, regId, orderId]);

  const kitPickupRegs = registrations.filter(
    (r) => r.registrationStatus === 'confirmed' && r.kitDeliveryMethod !== 'postal_shipping'
  );
  const pickedUp = kitPickupRegs.filter((r) => r.fulfillmentStatus === 'kit_picked_up').length;
  const hourly = useMemo(() => hourlyPickups(registrations), [registrations]);

  const regHits = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    return registrations
      .filter(
        (r) =>
          norm(r.qrCheckInToken) === q ||
          norm(r.bibNumber ?? '').includes(q) ||
          norm(r.participantNameTh).includes(q) ||
          norm(r.participantNameEn ?? '').includes(q) ||
          norm(r.regCode).includes(q)
      )
      .slice(0, 8);
  }, [query, registrations]);

  const orderHits = useMemo(() => {
    const q = norm(query);
    if (!q) return [];
    return merchOrders
      .filter(
        (m) =>
          m.deliveryMethod === 'pickup_at_expo' &&
          (norm(m.pickupToken) === q || norm(m.merchOrderCode).includes(q) || norm(m.buyerName).includes(q))
      )
      .slice(0, 8);
  }, [query, merchOrders]);

  const openReg = (id: string) => {
    const r = registrations.find((x) => x.id === id);
    setRegId(id);
    setOrderId(null);
    setFeedback(null);
    const cat = event.categories.find((c) => c.id === r?.categoryId);
    setBibDraft(r?.bibNumber ?? `${cat?.bibPrefix ?? ''}`);
  };
  const openOrder = (id: string) => {
    setOrderId(id);
    setRegId(null);
    setFeedback(null);
  };
  const backToStart = (msg?: Feedback) => {
    setRegId(null);
    setOrderId(null);
    setQuery('');
    setFeedback(msg ?? null);
  };

  const submitSearch = () => {
    const hits = mode === 'bib' ? regHits : orderHits;
    if (hits.length === 1) {
      if (mode === 'bib') openReg(hits[0].id);
      else openOrder(hits[0].id);
    }
  };

  /* ---------- runner detail ---------- */
  const renderRunner = (r: RegistrationRecord) => {
    const cat = event.categories.find((c) => c.id === r.categoryId);
    const picked = r.fulfillmentStatus === 'kit_picked_up';
    const eligible = r.registrationStatus === 'confirmed';
    const postal = r.kitDeliveryMethod === 'postal_shipping';
    const shopOrders = merchOrders.filter(
      (m) =>
        m.deliveryMethod === 'pickup_at_expo' &&
        m.deliveredQty < m.quantity &&
        (m.linkedRegistrationCode === r.regCode || norm(m.buyerName) === norm(r.participantNameTh))
    );
    const ageGroup = r.ageSnapshot?.groupLabelTh ?? '';

    return (
      <div className="ci-detail">
        <div>
          <h2 ref={detailRef} tabIndex={-1} className="ci-name">
            {tx(r.participantNameTh)}
          </h2>
          <p className="ci-meta">
            {tx(cat?.name ?? '')}
            {ageGroup && ` · ${tx(ageGroup)}`} · {r.regCode}
          </p>
          <div className="ci-tags">
            <span className={`ci-tag ${eligible ? 'is-ok' : 'is-warn'}`}>
              <FaIcon name={eligible ? 'check' : 'clock'} />
              {tx(eligible ? 'ยืนยันสิทธิ์' : r.registrationStatus === 'pending_payment' ? 'ยังไม่ชำระ' : 'ไม่มีสิทธิ์')}
            </span>
            {r.paymentStatus === 'succeeded' && (
              <span className="ci-tag is-ok">
                <FaIcon name="money-bill" />
                {tx('จ่ายแล้ว')}
              </span>
            )}
          </div>
        </div>

        {picked ? (
          <div className="ci-alert is-danger" role="alert">
            <FaIcon name="ban" />
            <strong>{tx('รับไปแล้ว ห้ามมอบซ้ำ')}</strong>
            <span>
              {txf('มอบเมื่อ {0}', r.fulfillmentUpdatedAt ?? '-')}
              <br />
              {txf('โดย {0}', r.fulfillmentUpdatedBy ?? '-')}
            </span>
          </div>
        ) : !eligible ? (
          <div className="ci-alert is-warn" role="alert">
            <FaIcon name="hand" />
            <strong>{tx('ยังรับของไม่ได้')}</strong>
            <span>
              {tx(
                r.registrationStatus === 'pending_payment'
                  ? 'ใบสมัครนี้ยังไม่ได้ชำระเงิน ให้นักวิ่งชำระให้เสร็จก่อน'
                  : 'ใบสมัครนี้ถูกยกเลิกหรือหมดเวลาชำระ ไม่มีสิทธิ์รับของ'
              )}
            </span>
          </div>
        ) : null}

        {picked && (
          <p className="ci-hint">
            <FaIcon name="circle-info" />
            {tx('ถ้านักวิ่งบอกว่าไม่ได้รับ ให้เรียกหัวหน้าจุดก่อน อย่ามอบชุดใหม่')}
          </p>
        )}

        {eligible && !picked && (
          <>
            {r.bibNumber ? (
              <div className="ci-bib" aria-label={txf('เลข BIB {0}', r.bibNumber)}>
                <span>{tx('เลข BIB')}</span>
                <strong>{r.bibNumber}</strong>
              </div>
            ) : (
              <form
                className="ci-bib-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = onAssignBib(r.id, bibDraft.trim().toUpperCase());
                  setFeedback({
                    tone: res.ok ? 'ok' : 'err',
                    text: res.ok
                      ? txf('บันทึกเลข BIB {0} แล้ว', bibDraft.trim().toUpperCase())
                      : res.error ?? tx('บันทึกเลข BIB ไม่สำเร็จ'),
                  });
                }}
              >
                <label htmlFor="ci-bib-input">{tx('ยังไม่มีเลข BIB ใส่เลขก่อนมอบ (ห้ามซ้ำในงานนี้)')}</label>
                <div className="ci-row">
                  <input
                    id="ci-bib-input"
                    value={bibDraft}
                    onChange={(e) => setBibDraft(e.target.value.toUpperCase())}
                    autoComplete="off"
                    inputMode="text"
                  />
                  <button type="submit" className="ci-btn">
                    {tx('บันทึกเลข')}
                  </button>
                </div>
              </form>
            )}

            {postal && (
              <p className="ci-hint is-warn">
                <FaIcon name="truck" />
                {tx('นักวิ่งเลือกส่งไปรษณีย์ไว้ ตรวจกับหัวหน้าจุดก่อนมอบที่งาน')}
              </p>
            )}

            <div>
              <p className="ci-caption">{tx('ส่งของเหล่านี้ให้นักวิ่ง')}</p>
              <ul className="ci-items">
                <li>
                  <FaIcon name="id-badge" />
                  <span>{tx('BIB พร้อมชิปจับเวลา')}</span>
                </li>
                <li>
                  <FaIcon name="shirt" />
                  <span>
                    {tx('เสื้อวิ่ง')} <strong className="ci-size">{txf('ไซซ์ {0}', r.shirtSize)}</strong>
                  </span>
                </li>
              </ul>
            </div>
          </>
        )}

        {shopOrders.length > 0 && (
          <button type="button" className="ci-shop-note" onClick={() => {
            setMode('merch');
            openOrder(shopOrders[0].id);
          }}>
            <FaIcon name="bag-shopping" />
            <span>
              {txf(
                'มีของที่ซื้อในร้านด้วย: {0}',
                shopOrders.map((m) => `${tx(m.productNameTh)} ×${m.quantity - m.deliveredQty}`).join(', ')
              )}
            </span>
            <span className="ci-shop-go">{tx('จ่ายด้วย')}</span>
          </button>
        )}

        {feedback && (
          <p className={`ci-feedback is-${feedback.tone}`} role="status">
            <FaIcon name={feedback.tone === 'ok' ? 'circle-check' : 'triangle-exclamation'} />
            {tx(feedback.text)}
          </p>
        )}

        <div className="ci-actions">
          {eligible && !picked && (
            <button
              type="button"
              className="ci-big is-confirm"
              onClick={() => {
                if (!r.bibNumber) {
                  setFeedback({ tone: 'err', text: tx('บันทึกเลข BIB ก่อนแล้วจึงยืนยันมอบ') });
                  return;
                }
                const res = onConfirmKit(r.id);
                if (res.ok) {
                  backToStart({
                    tone: 'ok',
                    text: txf('มอบ BIB {0} และเสื้อไซซ์ {1} ให้ {2} แล้ว', r.bibNumber, r.shirtSize, tx(r.participantNameTh)),
                  });
                } else {
                  setFeedback({ tone: 'err', text: res.error ?? tx('ยืนยันไม่สำเร็จ ลองอีกครั้ง') });
                }
              }}
            >
              <FaIcon name="check" />
              {tx('ยืนยันมอบแล้ว')}
            </button>
          )}
          <button type="button" className="ci-big is-plain" onClick={() => backToStart()}>
            <FaIcon name="qrcode" />
            {tx(picked || !eligible ? 'สแกนคนถัดไป' : 'ยกเลิก กลับไปสแกน')}
          </button>
        </div>
      </div>
    );
  };

  /* ---------- shop order detail ---------- */
  const renderOrder = (m: MerchOrderRecord) => {
    const done = m.deliveredQty >= m.quantity;
    const left = m.quantity - m.deliveredQty;
    return (
      <div className="ci-detail">
        <div>
          <h2 ref={detailRef} tabIndex={-1} className="ci-name">
            {tx(m.buyerName)}
          </h2>
          <p className="ci-meta">
            {m.merchOrderCode}
            {m.linkedRegistrationCode ? ` · ${txf('ผู้สมัคร {0}', m.linkedRegistrationCode)}` : ` · ${tx('ไม่ได้สมัครวิ่ง')}`}
          </p>
          <div className="ci-tags">
            <span className={`ci-tag ${m.paymentStatus === 'succeeded' ? 'is-ok' : 'is-warn'}`}>
              <FaIcon name={m.paymentStatus === 'succeeded' ? 'money-bill' : 'clock'} />
              {tx(m.paymentStatus === 'succeeded' ? 'จ่ายแล้ว' : 'ยังไม่ชำระ')}
            </span>
          </div>
        </div>

        {done && (
          <div className="ci-alert is-danger" role="alert">
            <FaIcon name="ban" />
            <strong>{tx('ส่งมอบครบแล้ว ห้ามจ่ายซ้ำ')}</strong>
            <span>{txf('ส่งมอบแล้ว {0} จาก {1} ชิ้น', m.deliveredQty, m.quantity)}</span>
          </div>
        )}

        <div>
          <p className="ci-caption">{txf('ส่งมอบแล้ว {0} จาก {1} ชิ้น', m.deliveredQty, m.quantity)}</p>
          <div className="ci-seg" aria-hidden="true">
            {Array.from({ length: m.quantity }).map((_, i) => (
              <span key={i} className={i < m.deliveredQty ? 'is-done' : ''} />
            ))}
          </div>
          <ul className="ci-items">
            <li>
              <FaIcon name="bag-shopping" />
              <span>
                {tx(m.productNameTh)} <strong className="ci-size">{txf('ไซซ์ {0}', m.variantSize)}</strong> ×{m.quantity}
              </span>
            </li>
          </ul>
          {!done && m.quantity > 1 && (
            <p className="ci-hint">
              <FaIcon name="circle-info" />
              {tx('ของยังมาไม่ครบ มอบเท่าที่มีได้ ระบบบันทึกว่ารับบางส่วนและยังไม่ปิดคำสั่งซื้อ')}
            </p>
          )}
        </div>

        {feedback && (
          <p className={`ci-feedback is-${feedback.tone}`} role="status">
            <FaIcon name={feedback.tone === 'ok' ? 'circle-check' : 'triangle-exclamation'} />
            {tx(feedback.text)}
          </p>
        )}

        <div className="ci-actions">
          {!done && m.paymentStatus === 'succeeded' && (
            <>
              {left > 1 && (
                <button
                  type="button"
                  className="ci-big is-plain"
                  onClick={() => {
                    const res = onMerchHandover(m.id, 'partial_one');
                    setFeedback({ tone: res.ok ? 'ok' : 'err', text: res.message });
                  }}
                >
                  <FaIcon name="plus" />
                  {tx('มอบ 1 ชิ้น')}
                </button>
              )}
              <button
                type="button"
                className="ci-big is-confirm"
                onClick={() => {
                  const res = onMerchHandover(m.id, 'complete_all');
                  if (res.ok) backToStart({ tone: 'ok', text: res.message });
                  else setFeedback({ tone: 'err', text: res.message });
                }}
              >
                <FaIcon name="check" />
                {txf('ยืนยันส่งมอบ {0} ชิ้น', left)}
              </button>
            </>
          )}
          <button type="button" className="ci-big is-plain" onClick={() => backToStart()}>
            <FaIcon name="qrcode" />
            {tx(done ? 'สแกนคนถัดไป' : 'ยกเลิก กลับไปสแกน')}
          </button>
        </div>
      </div>
    );
  };

  /* ---------- start screen ---------- */
  const hits = mode === 'bib' ? regHits : orderHits;
  const maxBar = hourly ? Math.max(...hourly.bars.map((b) => b.n), 1) : 1;

  return (
    <div className="ci-page">
      <div className="ci-head">
        <div>
          <h1>{tx('เช็กอินหน้างาน')}</h1>
          <p className="ci-meta">
            {txf('เจ้าหน้าที่: {0}', tx(staffName))} · {tx(event.kitPickupWindow)}
          </p>
        </div>
      </div>

      {onDetail ? (
        reg ? (
          renderRunner(reg)
        ) : (
          order && renderOrder(order)
        )
      ) : (
        <>
          <div className="ci-tabs" role="tablist" aria-label={tx('ประเภทการส่งมอบ')}>
            {(
              [
                ['bib', 'มอบ BIB', 'id-badge'],
                ['merch', 'จ่ายของที่ซื้อ', 'bag-shopping'],
              ] as const
            ).map(([m, label, icon]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                className={mode === m ? 'is-active' : ''}
                onClick={() => {
                  setMode(m);
                  setFeedback(null);
                  searchRef.current?.focus();
                }}
              >
                <FaIcon name={icon} />
                {tx(label)}
              </button>
            ))}
          </div>

          {feedback && (
            <p className={`ci-feedback is-${feedback.tone}`} role="status">
              <FaIcon name={feedback.tone === 'ok' ? 'circle-check' : 'triangle-exclamation'} />
              {tx(feedback.text)}
            </p>
          )}

          <form
            className="ci-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <label htmlFor="ci-q">
              <FaIcon name="qrcode" />
              {tx(mode === 'bib' ? 'สแกน QR ของนักวิ่ง หรือพิมพ์ค้นหา' : 'สแกน QR รับสินค้า หรือพิมพ์ค้นหา')}
            </label>
            <input
              ref={searchRef}
              id="ci-q"
              type="search"
              value={query}
              autoComplete="off"
              placeholder={tx(mode === 'bib' ? 'ชื่อ เลข BIB หรือรหัสใบสมัคร' : 'ชื่อผู้ซื้อ หรือเลขคำสั่งซื้อ')}
              onChange={(e) => setQuery(e.target.value)}
            />
            <p className="ci-hint">{tx('เครื่องสแกนแบบพิมพ์ให้ ใช้ได้ทันที ถ้าเจอคนเดียวจะเปิดให้อัตโนมัติเมื่อกด Enter')}</p>
          </form>

          {query.trim() && (
            <ul className="ci-results" aria-label={tx('ผลการค้นหา')}>
              {hits.length === 0 && <li className="ci-empty">{tx('ไม่พบ ลองพิมพ์ชื่อหรือเลขอื่น')}</li>}
              {mode === 'bib'
                ? (hits as RegistrationRecord[]).map((r) => {
                    const cat = event.categories.find((c) => c.id === r.categoryId);
                    const picked = r.fulfillmentStatus === 'kit_picked_up';
                    return (
                      <li key={r.id}>
                        <button type="button" onClick={() => openReg(r.id)}>
                          <span className="ci-res-main">
                            <strong>{tx(r.participantNameTh)}</strong>
                            <span className="ci-meta">
                              {tx(cat?.name ?? '')} · {r.bibNumber ?? tx('ยังไม่มีเลข BIB')}
                            </span>
                          </span>
                          <span className={`ci-tag ${picked ? 'is-muted' : r.registrationStatus === 'confirmed' ? 'is-ok' : 'is-warn'}`}>
                            <FaIcon name={picked ? 'circle-check' : r.registrationStatus === 'confirmed' ? 'box' : 'clock'} />
                            {tx(picked ? 'รับแล้ว' : r.registrationStatus === 'confirmed' ? 'รอรับ' : 'ยังรับไม่ได้')}
                          </span>
                        </button>
                      </li>
                    );
                  })
                : (hits as MerchOrderRecord[]).map((m) => (
                    <li key={m.id}>
                      <button type="button" onClick={() => openOrder(m.id)}>
                        <span className="ci-res-main">
                          <strong>{tx(m.buyerName)}</strong>
                          <span className="ci-meta">
                            {m.merchOrderCode} · {tx(m.productNameTh)} ×{m.quantity}
                          </span>
                        </span>
                        <span className={`ci-tag ${m.deliveredQty >= m.quantity ? 'is-muted' : 'is-ok'}`}>
                          {txf('{0}/{1} ชิ้น', m.deliveredQty, m.quantity)}
                        </span>
                      </button>
                    </li>
                  ))}
            </ul>
          )}

          <section className="ci-progress" aria-labelledby="ci-prog-h">
            <div className="ci-prog-head">
              <h2 id="ci-prog-h">{tx('รับของแล้ว')}</h2>
              <span className="ci-prog-num">
                <strong>{pickedUp}</strong> / {txf('{0} คน', kitPickupRegs.length)}
              </span>
            </div>
            <div
              className="ci-prog-track"
              role="img"
              aria-label={txf('รับของแล้ว {0} จาก {1} คนที่รับหน้างาน', pickedUp, kitPickupRegs.length)}
            >
              <span style={{ width: `${kitPickupRegs.length ? (pickedUp / kitPickupRegs.length) * 100 : 0}%` }} />
            </div>
            <p className="ci-hint">{tx('นับเฉพาะผู้ยืนยันสิทธิ์ที่เลือกรับของหน้างาน')}</p>
            {hourly ? (
              <>
                <p className="ci-caption">{txf('คนมารับรายชั่วโมง วันที่ {0}', hourly.day)}</p>
                <div
                  className="ci-hours"
                  role="img"
                  aria-label={hourly.bars.map((b) => txf('{0} น. {1} คน', b.h, b.n)).join(', ')}
                >
                  {hourly.bars.map((b) => (
                    <div key={b.h} className="ci-hour">
                      <span className="ci-hour-n">{b.n}</span>
                      <span className="ci-hour-bar" style={{ height: `${(b.n / maxBar) * 100}%` }} />
                      <span className="ci-hour-h">{b.h}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="ci-hint">{tx('ยังไม่มีใครมารับของ กราฟรายชั่วโมงจะขึ้นเมื่อเริ่มมอบ')}</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};
