import qrcode from 'qrcode-generator';
import { createPortal } from 'react-dom';
import type { MerchOrderRecord, RaceCategory, RaceEvent, RegistrationRecord } from '../types';
import { getLang, tx, txf } from '../i18n';
import { formatBasisDate } from '../utils/age';
import { formatThb } from '../utils/pricing';
import { useEffect, useState } from 'react';
import { FaIcon } from './FaIcon';
import { IconClose } from './Icons';
import { RegSnapshotDetails } from './RegistrationHistoryParts';
import { RegistrationDone, type DoneTone } from './RegistrationReview';
import { useEscapeToClose } from './modalShared';

/**
 * The registration confirmation, shared by the success step and the history popup
 * (27 Nov 2026, user request: print, download, and the same card from the history page).
 */
export interface ConfirmationItem {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}

export function confirmationTitle(reg: RegistrationRecord): string {
  return reg.registrationStatus === 'confirmed'
    ? tx('สมัครวิ่งและชำระเงินสำเร็จ')
    : reg.registrationStatus === 'pending_payment'
      ? tx('สร้างใบจองโควตาสำเร็จ (รอผลชำระเงินภายใน 15 นาที)')
      : tx('ใบสมัครวิ่ง');
}

export function confirmationItems(params: {
  reg: RegistrationRecord;
  event?: RaceEvent;
  category?: RaceCategory;
  addonOrders?: MerchOrderRecord[];
}): ConfirmationItem[] {
  const { reg, event, category, addonOrders = [] } = params;
  const eventName = event ? (getLang() === 'en' ? event.titleEn || event.titleTh : event.titleTh) : '';
  return [
    // the event's name, so a printed or saved copy says which race it is
    ...(eventName ? [{ label: tx('งานวิ่ง'), value: tx(eventName) }] : []),
    { label: tx('รหัสใบสมัครวิ่ง'), value: reg.regCode, mono: true },
    // the BIB, once the entry is paid (moved here from the history card's QR box, 27 Nov 2026)
    ...(reg.registrationStatus === 'confirmed'
      ? [{ label: tx('เลข BIB'), value: reg.bibNumber ?? tx('รอกำหนด BIB'), mono: Boolean(reg.bibNumber) }]
      : []),
    { label: tx('ผู้เข้าแข่งขัน'), value: tx(reg.participantNameTh) },
    ...(category ? [{ label: tx('ระยะ'), value: tx(category.name) }] : []),
    { label: tx('เสื้อตามสิทธิ์สมัคร'), value: `${tx('ไซส์')} ${tx(reg.shirtSize)}` },
    ...addonOrders.map((o) => ({
      label: `${tx(o.productNameTh)}${o.variantSize !== '-' ? ` · ${o.variantSize}` : ''} × ${o.quantity}`,
      value: o.merchOrderCode,
      mono: true,
    })),
    {
      label: tx('ยอดค่าสมัครสุทธิ'),
      value: formatThb(reg.snapshotTotalChargedSatang, true),
      accent: true,
    },
  ];
}

/** the mark at the top: a check only once paid, a clock while waiting for payment */
export function confirmationTone(reg: RegistrationRecord): DoneTone {
  return reg.registrationStatus === 'confirmed'
    ? 'success'
    : reg.registrationStatus === 'pending_payment'
      ? 'pending'
      : 'stopped';
}

/** print and download are offered only for a paid entry (27 Nov 2026, user request) */
export const confirmationIsPaid = (reg: RegistrationRecord) => reg.registrationStatus === 'confirmed';

/** the check-in QR, only once the entry is paid; once the kit is picked up it says so under the
    QR and the QR is drawn faded, so nobody tries to use it again (27 Nov 2026, user request) */
export function confirmationQr(
  reg: RegistrationRecord
): { value: string; caption: string; used?: string } | undefined {
  if (reg.registrationStatus !== 'confirmed') return undefined;
  const picked = reg.fulfillmentStatus === 'kit_picked_up';
  const when = reg.fulfillmentUpdatedAt ? formatBasisDate(reg.fulfillmentUpdatedAt.slice(0, 10)) : '';
  return {
    value: reg.qrCheckInToken,
    caption: tx('QR รับอุปกรณ์ แสดงที่จุดเช็กอิน'),
    used: picked ? (when ? txf('รับอุปกรณ์แล้ว {0}', when) : tx('รับอุปกรณ์แล้ว')) : undefined,
  };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** one person's confirmation, as drawn in the saved picture and the printed copy */
export interface ConfirmationSheet {
  title: string;
  items: ConfirmationItem[];
  qr?: { value: string; caption: string; used?: string };
  tone?: DoneTone;
  /** a small line above the title, e.g. "คนที่ 2 จาก 3" in a group order */
  label?: string;
}

type ImageParams = ConfirmationSheet & {
  fileName: string;
  /** a group order: every person's confirmation, one after another in the same picture */
  sheets?: ConfirmationSheet[];
};

const qrPath = (value: string) => {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  }
  return { d, box: n + 8 };
};

/** The confirmation as a picture: a PNG (drawn as SVG, then turned into pixels), or the SVG itself
    when the browser cannot draw it. A group order draws every person's confirmation in the same
    layout, one under another with a dashed cut line between them (28 Nov 2026, user request). */
function confirmationImage(params: ImageParams): Promise<{ blob: Blob; ext: 'png' | 'svg' }> {
  const sheets: ConfirmationSheet[] =
    params.sheets && params.sheets.length > 0
      ? params.sheets
      : [{ title: params.title, items: params.items, qr: params.qr, label: params.label }];
  const W = 900;
  const font = "Anuphan, 'Leelawadee UI', Tahoma, sans-serif";
  const rowH = 56;
  const head = 96;
  const qrSize = 260;

  let y = head;
  const parts: string[] = [];
  sheets.forEach((sh, k) => {
    if (k > 0) {
      parts.push(
        `<line x1="40" y1="${y + 20}" x2="${W - 40}" y2="${y + 20}" stroke="#94a3b8" stroke-width="2" stroke-dasharray="10 8"/>`
      );
      y += 40;
    }
    let top = y + 54;
    if (sh.label) {
      parts.push(`<text x="60" y="${y + 44}" fill="#64748b" font-family="${font}" font-size="18" font-weight="700">${esc(sh.label)}</text>`);
      top += 30;
    }
    parts.push(`<text x="60" y="${top - 14 + 30}" fill="#34495f" font-family="${font}" font-size="26" font-weight="700">${esc(sh.title)}</text>`);
    const rowsTop = top + 30;
    sh.items.forEach((it, i) => {
      const ry = rowsTop + i * rowH + 36;
      parts.push(`<text x="60" y="${ry}" fill="#475569" font-family="${font}" font-size="20">${esc(it.label)}</text>
  <text x="${W - 60}" y="${ry}" text-anchor="end" fill="${it.accent ? '#c2410c' : '#1f2937'}" font-family="${it.mono ? 'monospace' : font}" font-size="${it.accent ? 26 : 21}" font-weight="700">${esc(it.value)}</text>
  <line x1="60" y1="${ry + 18}" x2="${W - 60}" y2="${ry + 18}" stroke="#e2e8f0" stroke-width="1"/>`);
    });
    y = rowsTop + sh.items.length * rowH;
    if (sh.qr) {
      const { d, box } = qrPath(sh.qr.value);
      const qy = y + 30;
      parts.push(`<svg x="${(W - qrSize) / 2}" y="${qy}" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>
  <text x="${W / 2}" y="${qy + qrSize + 34}" text-anchor="middle" fill="#475569" font-family="${font}" font-size="20">${esc(sh.qr.caption)}</text>
  <text x="${W / 2}" y="${qy + qrSize + 64}" text-anchor="middle" fill="#34495f" font-family="monospace" font-size="18">${esc(sh.qr.value)}</text>`);
      if (sh.qr.used) {
        parts.push(`<text x="${W / 2}" y="${qy + qrSize + 94}" text-anchor="middle" fill="#157347" font-family="${font}" font-size="20" font-weight="700">${esc(sh.qr.used)}</text>`);
      }
      y = qy + qrSize + (sh.qr.used ? 110 : 80);
    } else {
      y += 20;
    }
  });
  const H = y + 40;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="${head}" fill="#34495f"/>
  <text x="60" y="60" fill="#f8fafc" font-family="${font}" font-size="30" font-weight="700">${esc(tx('กระต่าย'))}</text>
  <text x="${W - 60}" y="60" text-anchor="end" fill="#cbd5e1" font-family="${font}" font-size="20">${esc(tx('ใบยืนยันการสมัคร'))}</text>
  ${parts.join('\n  ')}
</svg>`;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  return new Promise((resolve) => {
    const svgUrl = URL.createObjectURL(svgBlob);
    const asSvg = () => {
      URL.revokeObjectURL(svgUrl);
      resolve({ blob: svgBlob, ext: 'svg' });
    };
    const img = new Image();
    img.onload = () => {
      // a long group picture is drawn at 1x so it stays inside the browser's canvas limits
      const scale = H > 7000 ? 1 : 2;
      const canvas = document.createElement('canvas');
      canvas.width = W * scale;
      canvas.height = H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return asSvg();
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return asSvg();
        URL.revokeObjectURL(svgUrl);
        resolve({ blob, ext: 'png' });
      }, 'image/png');
    };
    // the picture could not be drawn: hand over the SVG itself
    img.onerror = asSvg;
    img.src = svgUrl;
  });
}

/** Saves the confirmation as a picture file. */
export async function downloadConfirmationImage(params: ImageParams) {
  const { blob, ext } = await confirmationImage(params);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.fileName}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** true where the phone's share sheet takes picture files (LINE, chat apps and so on) */
function useCanShareImage() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    try {
      const probe = new File([new Blob(['x'], { type: 'image/png' })], 'x.png', { type: 'image/png' });
      setCan(typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] }));
    } catch {
      setCan(false);
    }
  }, []);
  return can;
}

/** Opens the share sheet with the confirmation picture; anything but a cancel saves it instead. */
async function shareConfirmationImage(params: ImageParams) {
  const { blob, ext } = await confirmationImage(params);
  const file = new File([blob], `${params.fileName}.${ext}`, { type: blob.type });
  try {
    await navigator.share({ files: [file], title: params.title });
  } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') await downloadConfirmationImage(params);
  }
}

/** a group order's confirmations: one sheet per person, in the order they were entered */
export function orderConfirmationSheets(params: {
  regs: RegistrationRecord[];
  event?: RaceEvent;
  addonOrders?: MerchOrderRecord[];
}): ConfirmationSheet[] {
  const n = params.regs.length;
  return params.regs.map((r, i) => ({
    title: confirmationTitle(r),
    items: confirmationItems({
      reg: r,
      event: params.event,
      category: params.event?.categories.find((c) => c.id === r.categoryId),
      addonOrders: (params.addonOrders ?? []).filter((m) => m.linkedRegistrationCode === r.regCode),
    }),
    qr: confirmationQr(r),
    tone: confirmationTone(r),
    label: txf('คนที่ {0} จาก {1}', i + 1, n),
  }));
}

/** The printed copy of a group order: every person's confirmation, one page each. Hidden on
    screen; the print rules show only this (styles.css, "reg-print-set"). */
function ConfirmationPrintSet({ sheets }: { sheets: ConfirmationSheet[] }) {
  return createPortal(
    <div className="reg-print-set" aria-hidden="true">
      {sheets.map((sh, i) => (
        <RegistrationDone
          key={i}
          title={sh.title}
          subtitle={sh.label}
          items={sh.items}
          qr={sh.qr}
          tone={sh.tone ?? 'success'}
        />
      ))}
    </div>,
    document.body
  );
}

/** Print / download (and, on phones that can, share) buttons shown under the card. With `sheets`
    (a group order) both the printout and the picture hold every person's confirmation. */
export function ConfirmationFileActions({
  title,
  items,
  qr,
  fileName,
  sheets,
}: {
  title: string;
  items: ConfirmationItem[];
  qr?: { value: string; caption: string; used?: string };
  fileName: string;
  sheets?: ConfirmationSheet[];
}) {
  const canShare = useCanShareImage();
  const many = !!sheets && sheets.length > 1;
  const file: ImageParams = { title, items, qr, fileName, sheets: many ? sheets : undefined };
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => window.print()}>
        <FaIcon name="print" />
        <span>{tx('พิมพ์')}</span>
      </button>
      <button type="button" className="btn-secondary" onClick={() => downloadConfirmationImage(file)}>
        <FaIcon name="download" />
        <span>{tx('ดาวน์โหลด')}</span>
      </button>
      {canShare && (
        <button type="button" className="btn-secondary" onClick={() => shareConfirmationImage(file)}>
          <FaIcon name="share-nodes" />
          <span>{tx('แชร์')}</span>
        </button>
      )}
      {many && <ConfirmationPrintSet sheets={sheets} />}
    </>
  );
}

/** The confirmation card in a popup, opened from the registration history. */
export function ConfirmationModal({
  reg,
  event,
  category,
  addonOrders,
  orderRegs = [],
  orderAddonOrders,
  onClose,
}: {
  reg: RegistrationRecord;
  event?: RaceEvent;
  category?: RaceCategory;
  addonOrders?: MerchOrderRecord[];
  /** every entry of the same order (a group order): printed and saved together, one sheet each */
  orderRegs?: RegistrationRecord[];
  /** the souvenirs of the whole order, matched to each person by their entry code */
  orderAddonOrders?: MerchOrderRecord[];
  onClose: () => void;
}) {
  useEscapeToClose(onClose);
  const title = confirmationTitle(reg);
  const items = confirmationItems({ reg, event, category, addonOrders });
  const qr = confirmationQr(reg);
  return createPortal(
    <div
      className="runner-modal-backdrop reg-confirm-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="reg-confirm-dialog" role="dialog" aria-modal="true" aria-label={tx('ใบยืนยันการสมัคร')}>
        <button type="button" className="reg-confirm-close" aria-label={tx('ปิด')} onClick={onClose}>
          <IconClose size={18} />
        </button>
        <RegistrationDone
          title={title}
          items={items}
          qr={qr}
          tone={confirmationTone(reg)}
          details={
            /* the entry details saved at sign-up, folded away; shown on screen only, never in
               the printed or downloaded copy (27 Nov 2026, user request: one button) */
            <details className="reg-done-more">
              <summary>{tx('ดูรายละเอียดใบสมัคร')}</summary>
              <RegSnapshotDetails reg={reg} />
            </details>
          }
        >
          {confirmationIsPaid(reg) && (
            <ConfirmationFileActions
              title={title}
              items={items}
              qr={qr}
              fileName={orderRegs.length > 1 ? reg.orderCode : reg.regCode}
              sheets={
                orderRegs.length > 1
                  ? orderConfirmationSheets({ regs: orderRegs, event, addonOrders: orderAddonOrders })
                  : undefined
              }
            />
          )}
          <button type="button" className="btn-primary" onClick={onClose}>
            {tx('ปิด')}
          </button>
        </RegistrationDone>
      </div>
    </div>,
    document.body
  );
}
