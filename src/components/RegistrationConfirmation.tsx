import qrcode from 'qrcode-generator';
import { createPortal } from 'react-dom';
import type { MerchOrderRecord, RaceCategory, RaceEvent, RegistrationRecord } from '../types';
import { getLang, tx, txf } from '../i18n';
import { formatBasisDate } from '../utils/age';
import { formatThb } from '../utils/pricing';
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

/** Saves the confirmation as a PNG picture (drawn as SVG, then turned into pixels). */
export function downloadConfirmationImage(params: {
  title: string;
  items: ConfirmationItem[];
  qr?: { value: string; caption: string; used?: string };
  fileName: string;
}) {
  const W = 900;
  const font = "Anuphan, 'Leelawadee UI', Tahoma, sans-serif";
  const rowH = 56;
  const top = 150;
  const qrSize = params.qr ? 260 : 0;
  const listH = params.items.length * rowH;
  const H = top + listH + (params.qr ? qrSize + (params.qr.used ? 140 : 110) : 40) + 40;

  let qrSvg = '';
  if (params.qr) {
    const qr = qrcode(0, 'M');
    qr.addData(params.qr.value);
    qr.make();
    const n = qr.getModuleCount();
    const box = n + 8;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    }
    const y = top + listH + 30;
    qrSvg = `<svg x="${(W - qrSize) / 2}" y="${y}" width="${qrSize}" height="${qrSize}" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#ffffff"/><path d="${d}" fill="#000000"/></svg>
  <text x="${W / 2}" y="${y + qrSize + 34}" text-anchor="middle" fill="#475569" font-family="${font}" font-size="20">${esc(params.qr.caption)}</text>
  <text x="${W / 2}" y="${y + qrSize + 64}" text-anchor="middle" fill="#34495f" font-family="monospace" font-size="18">${esc(params.qr.value)}</text>${
    params.qr.used
      ? `
  <text x="${W / 2}" y="${y + qrSize + 94}" text-anchor="middle" fill="#157347" font-family="${font}" font-size="20" font-weight="700">${esc(params.qr.used)}</text>`
      : ''
  }`;
  }

  const rows = params.items
    .map((it, i) => {
      const y = top + i * rowH + 36;
      return `<text x="60" y="${y}" fill="#475569" font-family="${font}" font-size="20">${esc(it.label)}</text>
  <text x="${W - 60}" y="${y}" text-anchor="end" fill="${it.accent ? '#c2410c' : '#1f2937'}" font-family="${it.mono ? 'monospace' : font}" font-size="${it.accent ? 26 : 21}" font-weight="700">${esc(it.value)}</text>
  <line x1="60" y1="${y + 18}" x2="${W - 60}" y2="${y + 18}" stroke="#e2e8f0" stroke-width="1"/>`;
    })
    .join('\n  ');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect x="0" y="0" width="${W}" height="96" fill="#34495f"/>
  <text x="60" y="60" fill="#f8fafc" font-family="${font}" font-size="30" font-weight="700">${esc(tx('กระต่าย'))}</text>
  <text x="${W - 60}" y="60" text-anchor="end" fill="#cbd5e1" font-family="${font}" font-size="20">${esc(tx('ใบยืนยันการสมัคร'))}</text>
  <text x="60" y="${top - 14}" fill="#34495f" font-family="${font}" font-size="26" font-weight="700">${esc(params.title)}</text>
  ${rows}
  ${qrSvg}
</svg>`;

  const save = (url: string, ext: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${params.fileName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      save(svgUrl, 'svg');
      return;
    }
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    canvas.toBlob((blob) => {
      URL.revokeObjectURL(svgUrl);
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      save(pngUrl, 'png');
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
    }, 'image/png');
  };
  // the picture could not be drawn: hand over the SVG itself
  img.onerror = () => save(svgUrl, 'svg');
  img.src = svgUrl;
}

/** Print / download buttons shown under the card. */
export function ConfirmationFileActions({
  title,
  items,
  qr,
  fileName,
}: {
  title: string;
  items: ConfirmationItem[];
  qr?: { value: string; caption: string; used?: string };
  fileName: string;
}) {
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => window.print()}>
        <FaIcon name="print" />
        <span>{tx('พิมพ์')}</span>
      </button>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => downloadConfirmationImage({ title, items, qr, fileName })}
      >
        <FaIcon name="download" />
        <span>{tx('ดาวน์โหลด')}</span>
      </button>
    </>
  );
}

/** The confirmation card in a popup, opened from the registration history. */
export function ConfirmationModal({
  reg,
  event,
  category,
  addonOrders,
  onClose,
}: {
  reg: RegistrationRecord;
  event?: RaceEvent;
  category?: RaceCategory;
  addonOrders?: MerchOrderRecord[];
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
            <ConfirmationFileActions title={title} items={items} qr={qr} fileName={reg.regCode} />
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
