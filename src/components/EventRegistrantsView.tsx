/**
 * Registrants ("ผู้สมัคร") — approved mockup, 24 Nov 2026.
 *
 * Two status bars double as filters (application status, and readiness of the
 * confirmed: BIB / no BIB / picked up). Search + distance filter, a table, and a
 * detail panel that keeps entry, money and kit status apart. Export downloads a
 * CSV of exactly the filtered rows, with no contact details in it.
 * Staff never see contact details or sensitive answers; the server enforces this too.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { RaceEvent, RegistrationRecord, RegistrationStatus } from '../types';
import type { OrgSection } from './OrganizerDashboardView';
import { formatThb } from '../utils/pricing';
import { answerText, isContentField } from '../data/registrationForm';
import { FaIcon } from './FaIcon';
import { tx, txf } from '../i18n';
import '../event-home.css';
import '../event-registrants.css';

type StatusFilter = 'all' | RegistrationStatus;
type Readiness = 'all' | 'has_bib' | 'no_bib' | 'picked';

interface Props {
  event: RaceEvent;
  /** registrations of this event */
  registrations: RegistrationRecord[];
  isStaff: boolean;
  canManageEventConfig: boolean;
  canViewFinance: boolean;
  search: string;
  onSearch: (q: string) => void;
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
  categoryFilter: string;
  onCategoryFilter: (id: string) => void;
  onAssignBib: (regId: string, bib: string) => { ok: boolean; error?: string };
  onNavigate: (section: OrgSection) => void;
}

const STATUS_META: { key: RegistrationStatus; label: string; cls: string }[] = [
  { key: 'confirmed', label: 'ยืนยันแล้ว', cls: 'rg-s-confirmed' },
  { key: 'pending_payment', label: 'รอชำระ', cls: 'rg-s-pending' },
  { key: 'expired', label: 'หมดเวลาชำระ', cls: 'rg-s-expired' },
  { key: 'cancelled', label: 'ยกเลิก', cls: 'rg-s-cancelled' },
];

const csvCell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function RightTag({ r }: { r: RegistrationRecord }) {
  const m = {
    confirmed: ['is-ok', 'check', 'ยืนยัน'],
    pending_payment: ['is-warn', 'clock', 'รอชำระ'],
    expired: ['is-muted', 'hourglass-end', 'หมดเวลา'],
    cancelled: ['is-danger', 'xmark', 'ยกเลิก'],
  }[r.registrationStatus] as [string, string, string];
  return (
    <span className={`rg-tag ${m[0]}`}>
      <FaIcon name={m[1]} />
      {tx(m[2])}
    </span>
  );
}

function MoneyTag({ r }: { r: RegistrationRecord }) {
  if (r.refundStatus === 'requested' || r.refundStatus === 'approved' || r.refundStatus === 'processing') {
    return (
      <span className="rg-tag is-warn">
        <FaIcon name="rotate-left" />
        {tx('ขอคืนเงิน')}
      </span>
    );
  }
  if (r.refundStatus === 'succeeded') {
    return (
      <span className="rg-tag is-danger">
        <FaIcon name="rotate-left" />
        {tx('คืนเงินแล้ว')}
      </span>
    );
  }
  if (r.paymentStatus === 'succeeded') {
    return (
      <span className="rg-tag is-ok">
        <FaIcon name="money-bill" />
        {tx('จ่ายแล้ว')}
      </span>
    );
  }
  return (
    <span className="rg-tag is-muted">
      <FaIcon name="money-bill" />
      {tx(r.paymentStatus === 'failed' ? 'จ่ายไม่สำเร็จ' : 'ยังไม่จ่าย')}
    </span>
  );
}

function KitTag({ r }: { r: RegistrationRecord }) {
  if (r.fulfillmentStatus === 'kit_picked_up') {
    return (
      <span className="rg-tag is-ok">
        <FaIcon name="box" />
        {tx('รับของแล้ว')}
      </span>
    );
  }
  return (
    <span className="rg-tag is-muted">
      <FaIcon name="box-open" />
      {tx('ยังไม่รับ')}
    </span>
  );
}

export const EventRegistrantsView: React.FC<Props> = ({
  event,
  registrations,
  isStaff,
  canManageEventConfig,
  canViewFinance,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  categoryFilter,
  onCategoryFilter,
  onAssignBib,
  onNavigate,
}) => {
  const [readiness, setReadiness] = useState<Readiness>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [bibDraft, setBibDraft] = useState('');
  const [bibMsg, setBibMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [page, setPage] = useState(0);
  const panelRef = useRef<HTMLHeadingElement>(null);
  const PAGE = 25;

  const counts = useMemo(() => {
    const c: Record<RegistrationStatus, number> = { confirmed: 0, pending_payment: 0, expired: 0, cancelled: 0 };
    registrations.forEach((r) => (c[r.registrationStatus] += 1));
    return c;
  }, [registrations]);
  const confirmed = registrations.filter((r) => r.registrationStatus === 'confirmed');
  const ready = {
    has_bib: confirmed.filter((r) => r.bibNumber).length,
    no_bib: confirmed.filter((r) => !r.bibNumber).length,
    picked: confirmed.filter((r) => r.fulfillmentStatus === 'kit_picked_up').length,
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter((r) => {
      if (statusFilter !== 'all' && r.registrationStatus !== statusFilter) return false;
      if (categoryFilter !== 'all' && r.categoryId !== categoryFilter) return false;
      if (readiness !== 'all') {
        if (r.registrationStatus !== 'confirmed') return false;
        if (readiness === 'has_bib' && !r.bibNumber) return false;
        if (readiness === 'no_bib' && r.bibNumber) return false;
        if (readiness === 'picked' && r.fulfillmentStatus !== 'kit_picked_up') return false;
      }
      if (!q) return true;
      return (
        r.participantNameTh.toLowerCase().includes(q) ||
        (r.participantNameEn ?? '').toLowerCase().includes(q) ||
        r.regCode.toLowerCase().includes(q) ||
        (r.bibNumber ?? '').toLowerCase().includes(q) ||
        r.buyerName.toLowerCase().includes(q)
      );
    });
  }, [registrations, search, statusFilter, categoryFilter, readiness]);

  useEffect(() => setPage(0), [search, statusFilter, categoryFilter, readiness]);

  const open = registrations.find((r) => r.id === openId) ?? null;
  useEffect(() => {
    setShowContact(false);
    setBibMsg(null);
    setBibDraft(open?.bibNumber ?? `${event.categories.find((c) => c.id === open?.categoryId)?.bibPrefix ?? ''}`);
    if (open) panelRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const catName = (id: string) => event.categories.find((c) => c.id === id)?.name ?? '';
  // headings and notes are page content, not questions; retired questions keep old answers
  const questions = (event.customFields ?? []).filter((cf) => !isContentField(cf));
  const filtered =
    statusFilter !== 'all' || categoryFilter !== 'all' || readiness !== 'all' || search.trim() !== '';
  const total = registrations.length;
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);

  const exportCsv = () => {
    const head = ['รหัสใบสมัคร', 'ชื่อผู้วิ่ง', 'ชื่อภาษาอังกฤษ', 'ระยะ', 'สถานะสิทธิ์', 'สถานะเงิน', 'เลข BIB', 'ไซซ์เสื้อ', 'วิธีรับของ', 'รับของแล้ว'];
    const lines = rows.map((r) =>
      [
        r.regCode,
        r.participantNameTh,
        r.participantNameEn,
        catName(r.categoryId),
        r.registrationStatus,
        r.paymentStatus,
        r.bibNumber ?? '',
        r.shirtSize,
        r.kitDeliveryMethod === 'postal_shipping' ? 'ไปรษณีย์' : 'หน้างาน',
        r.fulfillmentStatus === 'kit_picked_up' ? 'ใช่' : 'ไม่',
      ]
        .map(csvCell)
        .join(',')
    );
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.code}-registrants-${rows.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    onSearch('');
    onStatusFilter('all');
    onCategoryFilter('all');
    setReadiness('all');
  };

  const statusTotal = Math.max(total, 1);
  const readyTotal = Math.max(confirmed.length, 1);

  return (
    <div className="rg-page">
      <header className="rg-head">
        <div>
          <h1>{tx('ผู้สมัคร')}</h1>
          <p className="rg-sub">{tx('ค้นหา ตรวจสถานะ และกำหนดเลข BIB ของผู้สมัครงานนี้')}</p>
        </div>
        {!isStaff && (
          <button type="button" className="rg-btn" onClick={exportCsv} disabled={rows.length === 0}>
            <FaIcon name="download" />
            {filtered ? txf('ส่งออก {0} แถวตามตัวกรอง', rows.length) : txf('ส่งออกทั้งหมด {0} แถว', rows.length)}
          </button>
        )}
      </header>

      <section className="rg-panel" aria-labelledby="rg-status-h">
        <div className="rg-panel-head">
          <h2 id="rg-status-h">{tx('สถานะใบสมัคร')}</h2>
          <span className="rg-sub">{txf('ทั้งหมด {0} ใบ · กดเพื่อกรอง', total)}</span>
        </div>
        <div className="rg-stack" aria-hidden="true">
          {STATUS_META.map((s) =>
            counts[s.key] > 0 ? (
              <span key={s.key} className={s.cls} style={{ width: `${(counts[s.key] / statusTotal) * 100}%` }} />
            ) : null
          )}
        </div>
        <div className="rg-chips" role="group" aria-label={tx('กรองตามสถานะใบสมัคร')}>
          {STATUS_META.map((s) => {
            const on = statusFilter === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                className={`rg-chip${on ? ' is-on' : ''}`}
                onClick={() => {
                  onStatusFilter(on ? 'all' : s.key);
                  setReadiness('all');
                }}
              >
                <i className={`rg-sw ${s.cls}`} aria-hidden="true" />
                {tx(s.label)} {counts[s.key]}
                {on && <FaIcon name="xmark" />}
              </button>
            );
          })}
        </div>

        <div className="rg-panel-head rg-gap">
          <h2>{tx('ความพร้อมก่อนวันงาน')}</h2>
          <span className="rg-sub">{txf('เฉพาะ {0} คนที่ยืนยันแล้ว', confirmed.length)}</span>
        </div>
        <div className="rg-stack" aria-hidden="true">
          {ready.has_bib > 0 && <span className="rg-s-confirmed" style={{ width: `${(ready.has_bib / readyTotal) * 100}%` }} />}
          {ready.no_bib > 0 && <span className="rg-s-nobib" style={{ width: `${(ready.no_bib / readyTotal) * 100}%` }} />}
        </div>
        <div className="rg-chips" role="group" aria-label={tx('กรองตามความพร้อม')}>
          {(
            [
              ['has_bib', 'มีเลข BIB', ready.has_bib, 'rg-s-confirmed'],
              ['no_bib', 'ยังไม่มีเลข BIB', ready.no_bib, 'rg-s-nobib'],
              ['picked', 'รับของแล้ว', ready.picked, ''],
            ] as const
          ).map(([key, label, n, cls]) => {
            const on = readiness === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                className={`rg-chip${on ? ' is-on' : ''}`}
                onClick={() => {
                  setReadiness(on ? 'all' : key);
                  if (!on) onStatusFilter('all');
                }}
              >
                {cls ? <i className={`rg-sw ${cls}`} aria-hidden="true" /> : <FaIcon name="box" />}
                {tx(label)} {n}
                {on && <FaIcon name="xmark" />}
              </button>
            );
          })}
        </div>
      </section>

      <div className="rg-filters">
        <div className="rg-search" role="search">
          <FaIcon name="magnifying-glass" />
          <label htmlFor="rg-q" className="eh-sr">
            {tx('ค้นหาชื่อ รหัสใบสมัคร หรือเลข BIB')}
          </label>
          <input
            id="rg-q"
            type="search"
            value={search}
            placeholder={tx('ค้นหาชื่อ รหัสใบสมัคร หรือเลข BIB')}
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
        <div className="rg-seg" role="group" aria-label={tx('ระยะ')}>
          <button type="button" aria-pressed={categoryFilter === 'all'} className={categoryFilter === 'all' ? 'is-on' : ''} onClick={() => onCategoryFilter('all')}>
            {tx('ทุกระยะ')}
          </button>
          {event.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoryFilter === c.id}
              className={categoryFilter === c.id ? 'is-on' : ''}
              onClick={() => onCategoryFilter(c.id)}
            >
              {c.code}
            </button>
          ))}
        </div>
        {filtered && (
          <button type="button" className="rg-link" onClick={clearAll}>
            {tx('ล้างตัวกรอง')}
          </button>
        )}
      </div>

      <div className={`rg-body${open ? ' has-panel' : ''}`}>
        <section className="rg-panel rg-table-wrap" aria-label={tx('รายชื่อผู้สมัคร')}>
          {rows.length === 0 ? (
            <div className="rg-empty">
              <FaIcon name="magnifying-glass" />
              <strong>{tx(total === 0 ? 'งานนี้ยังไม่มีผู้สมัคร' : 'ไม่พบผู้สมัครตามตัวกรอง')}</strong>
              {total > 0 && (
                <button type="button" className="rg-link" onClick={clearAll}>
                  {tx('ล้างตัวกรอง')}
                </button>
              )}
            </div>
          ) : (
            <table className="rg-table">
              <thead>
                <tr>
                  <th scope="col">{tx('ผู้วิ่ง')}</th>
                  <th scope="col">{tx('ระยะ')}</th>
                  <th scope="col">{tx('สิทธิ์ · เงิน')}</th>
                  <th scope="col">{tx('BIB')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className={r.id === openId ? 'is-open' : ''}>
                    <td>
                      <button
                        type="button"
                        className="rg-name"
                        aria-expanded={r.id === openId}
                        onClick={() => setOpenId(r.id === openId ? null : r.id)}
                      >
                        <strong>{tx(r.participantNameTh)}</strong>
                        <span className="rg-sub">
                          {r.regCode}
                          {r.buyerName !== r.participantNameTh && ` · ${txf('สมัครโดย {0}', tx(r.buyerName))}`}
                        </span>
                      </button>
                    </td>
                    <td>
                      {tx(catName(r.categoryId))}
                      {r.ageSnapshot?.groupLabelTh && (
                        <span className="rg-sub rg-block">{tx(r.ageSnapshot.groupLabelTh)}</span>
                      )}
                    </td>
                    <td>
                      <span className="rg-tags">
                        <RightTag r={r} />
                        <MoneyTag r={r} />
                      </span>
                    </td>
                    <td>
                      {r.bibNumber ? (
                        <span className="rg-bib">{r.bibNumber}</span>
                      ) : r.registrationStatus === 'confirmed' ? (
                        <span className="rg-tag is-warn">
                          <FaIcon name="clock" />
                          {tx('รอเลข')}
                        </span>
                      ) : (
                        <span className="rg-sub">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > PAGE && (
            <div className="rg-pager">
              <span className="rg-sub">
                {txf('แสดง {0}–{1} จาก {2}', page * PAGE + 1, Math.min(rows.length, (page + 1) * PAGE), rows.length)}
              </span>
              <button type="button" className="rg-link" disabled={page === 0} onClick={() => setPage(page - 1)}>
                ‹ {tx('ก่อนหน้า')}
              </button>
              <button
                type="button"
                className="rg-link"
                disabled={(page + 1) * PAGE >= rows.length}
                onClick={() => setPage(page + 1)}
              >
                {tx('ถัดไป')} ›
              </button>
            </div>
          )}
        </section>

        {open && (
          <aside className="rg-panel rg-detail" aria-labelledby="rg-detail-h">
            <div className="rg-detail-head">
              <h2 id="rg-detail-h" ref={panelRef} tabIndex={-1}>
                {tx(open.participantNameTh)}
              </h2>
              <button type="button" className="rg-icon" aria-label={tx('ปิดรายละเอียด')} onClick={() => setOpenId(null)}>
                <FaIcon name="xmark" />
              </button>
            </div>
            <p className="rg-sub">
              {open.regCode} · {tx(catName(open.categoryId))}
              {open.ageSnapshot?.groupLabelTh ? ` · ${tx(open.ageSnapshot.groupLabelTh)}` : ''}
            </p>

            <div className="rg-three" role="list" aria-label={tx('สถานะแยก 3 เรื่อง')}>
              <div role="listitem">
                <span className="rg-sub">{tx('สิทธิ์')}</span>
                <RightTag r={open} />
              </div>
              <div role="listitem">
                <span className="rg-sub">{tx('เงิน')}</span>
                <MoneyTag r={open} />
              </div>
              <div role="listitem">
                <span className="rg-sub">{tx('รับของ')}</span>
                <KitTag r={open} />
              </div>
            </div>

            <dl className="rg-dl">
              <dt>{tx('เสื้อ')}</dt>
              <dd>
                {txf('ไซซ์ {0}', open.shirtSize)} · {tx(open.kitDeliveryMethod === 'postal_shipping' ? 'ส่งไปรษณีย์' : 'รับหน้างาน')}
              </dd>
              <dt>{tx('ผู้จ่ายเงิน')}</dt>
              <dd>{open.buyerName === open.participantNameTh ? tx('คนเดียวกับผู้วิ่ง') : tx(open.buyerName)}</dd>
              {canViewFinance && open.paymentStatus === 'succeeded' && (
                <>
                  <dt>{tx('ยอดที่จ่าย')}</dt>
                  <dd>{formatThb(open.snapshotTotalChargedSatang, true)}</dd>
                </>
              )}
              <dt>{tx('ติดต่อ')}</dt>
              <dd>
                {isStaff ? (
                  <span className="rg-sub">{tx('ซ่อนตามสิทธิ์เจ้าหน้าที่หน้างาน')}</span>
                ) : showContact ? (
                  <>
                    {open.email} · {open.phoneMasked}
                    <br />
                    {txf('ฉุกเฉิน: {0}', open.emergencyContact)}
                  </>
                ) : (
                  <button type="button" className="rg-link" onClick={() => setShowContact(true)}>
                    <FaIcon name="eye" /> {tx('แสดงข้อมูลติดต่อ')}
                  </button>
                )}
              </dd>
              {questions.length > 0 && (
                <>
                  <dt>{tx('คำตอบเพิ่ม')}</dt>
                  <dd>
                    {questions.map((cf) => {
                      const text = answerText(cf, open.customAnswers?.[cf.id]);
                      return (
                        <div key={cf.id}>
                          <span className="rg-sub">
                            {tx(cf.label)}
                            {cf.hidden && ` ${tx('(เลิกถามแล้ว)')}`}:
                          </span>{' '}
                          {isStaff && cf.isSensitive ? (
                            <span className="rg-sub">{tx('ซ่อนข้อมูลอ่อนไหว')}</span>
                          ) : text ? (
                            tx(text)
                          ) : (
                            <span className="rg-sub">{tx('ไม่ได้ระบุ')}</span>
                          )}
                        </div>
                      );
                    })}
                  </dd>
                </>
              )}
              <dt>{tx('กติกา')}</dt>
              <dd>
                {txf('ยอมรับฉบับ {0}', open.acceptedRulesVersion)} ·{' '}
                {tx(open.marketingConsent ? 'การตลาด: ยินยอม' : 'การตลาด: ไม่ยินยอม')}
              </dd>
            </dl>

            {canManageEventConfig && open.registrationStatus === 'confirmed' && open.fulfillmentStatus !== 'kit_picked_up' && (
              <form
                className="rg-bibform"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = bibDraft.trim().toUpperCase();
                  const res = onAssignBib(open.id, v);
                  setBibMsg({ ok: res.ok, text: res.ok ? txf('บันทึกเลข BIB {0} แล้ว', v) : res.error ?? tx('บันทึกเลข BIB ไม่สำเร็จ') });
                }}
              >
                <label htmlFor="rg-bib">{tx(open.bibNumber ? 'เปลี่ยนเลข BIB (ห้ามซ้ำในงานนี้)' : 'กำหนดเลข BIB (ห้ามซ้ำในงานนี้)')}</label>
                <div className="rg-row">
                  <input id="rg-bib" value={bibDraft} onChange={(e) => setBibDraft(e.target.value.toUpperCase())} autoComplete="off" />
                  <button type="submit" className="rg-btn is-primary">
                    {tx('บันทึกเลข')}
                  </button>
                </div>
                {bibMsg && (
                  <p className={`rg-msg ${bibMsg.ok ? 'is-ok' : 'is-err'}`} role="status">
                    <FaIcon name={bibMsg.ok ? 'circle-check' : 'triangle-exclamation'} />
                    {tx(bibMsg.text)}
                  </p>
                )}
              </form>
            )}

            <div>
              <p className="rg-caption">{tx('ประวัติ')}</p>
              <ol className="rg-history">
                <li>{txf('{0} · สมัคร', open.createdAt.replace('T', ' ').slice(0, 16))}</li>
                {open.paidAt && <li>{txf('{0} · ชำระเงินสำเร็จ (ยืนยันจากผู้ให้บริการ)', open.paidAt.replace('T', ' ').slice(0, 16))}</li>}
                {open.refundedAt && <li>{txf('{0} · คืนเงินสำเร็จ', open.refundedAt.replace('T', ' ').slice(0, 16))}</li>}
                {open.fulfillmentUpdatedAt && (
                  <li>{txf('{0} · รับของ โดย {1}', open.fulfillmentUpdatedAt, open.fulfillmentUpdatedBy ?? '-')}</li>
                )}
              </ol>
            </div>

            {open.registrationStatus === 'pending_payment' && (
              <p className="rg-note">{tx('กันที่นั่งไว้ระหว่างรอชำระ จะเปลี่ยนเป็นยืนยันเองเมื่อผู้ให้บริการรับชำระยืนยันยอด')}</p>
            )}

            {canViewFinance && (
              <button type="button" className="rg-link is-danger" onClick={() => onNavigate('evt_finance')}>
                {tx('ยกเลิกสิทธิ์หรือคืนเงิน ทำที่หน้ารายรับและคืนเงิน')} ›
              </button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
