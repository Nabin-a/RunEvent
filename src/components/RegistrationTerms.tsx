import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Organization, RaceEvent } from '../types';
import { tx, txf } from '../i18n';
import { feePolicyLabel } from '../utils/pricing';
import { IconClose } from './Icons';

/** Version of the payment terms text below; stored on the registration when accepted. */
export const PAYMENT_TERMS_VERSION = 'pay-terms-v1';

type TermsKind = 'rules' | 'payment';

/**
 * The two required agreements on the payment step (forms A and B): the event rules and the
 * payment terms. Each line has a "read the details" link that opens the full text in a modal;
 * the modal's accept button ticks that box. Marketing consent is not asked here.
 */
export function RegistrationTerms({
  event,
  organization,
  acceptRules,
  onAcceptRules,
  acceptPayment,
  onAcceptPayment,
}: {
  event: RaceEvent;
  organization?: Organization;
  acceptRules: boolean;
  onAcceptRules: (v: boolean) => void;
  acceptPayment: boolean;
  onAcceptPayment: (v: boolean) => void;
}) {
  const [open, setOpen] = useState<TermsKind | null>(null);

  const rows: { kind: TermsKind; checked: boolean; set: (v: boolean) => void; text: string }[] = [
    {
      kind: 'rules',
      checked: acceptRules,
      set: onAcceptRules,
      text: txf('ข้าพเจ้ายอมรับกติกาการแข่งขันและเงื่อนไขความปลอดภัยของงาน ({0})', event.rulesVersion),
    },
    {
      kind: 'payment',
      checked: acceptPayment,
      set: onAcceptPayment,
      text: txf('ข้าพเจ้ายอมรับข้อกำหนดการชำระเงินและการคืนเงิน ({0})', PAYMENT_TERMS_VERSION),
    },
  ];

  return (
    <div className="terms-group">
      {rows.map((r) => (
        <div key={r.kind} className="terms-row">
          <label className="checkbox-row">
            <input type="checkbox" checked={r.checked} onChange={(e) => r.set(e.target.checked)} aria-required="true" />
            <span>
              <strong>{tx('[จำเป็น]')}</strong> {r.text}
            </span>
          </label>
          <button type="button" className="terms-link" onClick={() => setOpen(r.kind)} aria-haspopup="dialog">
            {tx('อ่านรายละเอียดข้อกำหนดเพิ่มเติม')}
          </button>
        </div>
      ))}

      {open && (
        <TermsModal
          title={open === 'rules' ? tx('กติกาการแข่งขันและเงื่อนไขความปลอดภัย') : tx('ข้อกำหนดการชำระเงินและการคืนเงิน')}
          version={open === 'rules' ? event.rulesVersion : PAYMENT_TERMS_VERSION}
          onClose={() => setOpen(null)}
          onAccept={() => {
            (open === 'rules' ? onAcceptRules : onAcceptPayment)(true);
            setOpen(null);
          }}
        >
          {open === 'rules' ? <RulesText event={event} organization={organization} /> : <PaymentText event={event} />}
        </TermsModal>
      )}
    </div>
  );
}

function RulesText({ event, organization }: { event: RaceEvent; organization?: Organization }) {
  return (
    <>
      <p className="terms-note">
        {tx('สรุปจากข้อมูลงานในระบบ ข้อความกติกาฉบับเต็มเผยแพร่โดยผู้จัดงาน (ระบบทดลองยังไม่มีไฟล์ฉบับเต็ม)')}
      </p>
      <h4>{tx('ระยะการแข่งขัน เวลาปล่อยตัว และเวลาตัดตัว')}</h4>
      <ul>
        {event.categories.map((c) => (
          <li key={c.id}>
            {txf('{0}: ปล่อยตัว {1} น. · ต้องเข้าเส้นชัยภายใน {2} ชั่วโมง', tx(c.name), c.startTimeLocal, c.cutoffHours)}
          </li>
        ))}
      </ul>
      <h4>{tx('การรับอุปกรณ์')}</h4>
      <p>{txf('รับเสื้อและ BIB ตามช่วงเวลา: {0} แสดง QR Token ของใบสมัครเพื่อรับอุปกรณ์', tx(event.kitPickupWindow))}</p>
      <h4>{tx('ความปลอดภัย')}</h4>
      <ul>
        <li>{tx('ผู้สมัครรับรองว่ามีสุขภาพพร้อมสำหรับระยะที่สมัคร และให้ข้อมูลผู้ติดต่อฉุกเฉินที่ติดต่อได้จริง')}</li>
        <li>{tx('ปฏิบัติตามคำแนะนำของเจ้าหน้าที่และทีมแพทย์ตลอดเส้นทาง')}</li>
        <li>{tx('BIB ใช้ได้เฉพาะผู้สมัครที่มีชื่อในใบสมัคร')}</li>
      </ul>
      <h4>{tx('ติดต่อผู้จัดงาน')}</h4>
      <p>
        {tx(organization?.nameTh ?? 'ผู้จัดงาน')}
        {organization?.contactEmail ? ` · ${organization.contactEmail}` : ''}
      </p>
    </>
  );
}

function PaymentText({ event }: { event: RaceEvent }) {
  return (
    <>
      <p className="terms-note">{tx('ข้อความตัวอย่างสำหรับระบบทดลอง ยังไม่ใช่ข้อกำหนดที่ผ่านการตรวจทางกฎหมาย')}</p>
      <h4>{tx('ราคาและค่าบริการ')}</h4>
      <ul>
        <li>{tx('ราคาคำนวณโดยระบบ ณ เวลายืนยันคำสั่งซื้อ และบันทึกยอดไว้กับใบสมัคร')}</li>
        <li>{txf('นโยบายค่าบริการของงานนี้: {0}', feePolicyLabel(event.feeBearerPolicy))}</li>
        <li>{tx('ของที่ระลึกที่ซื้อพร้อมใบสมัครเป็นคำสั่งซื้อแยก ไม่เปลี่ยนยอดค่าสมัคร')}</li>
      </ul>
      <h4>{tx('การชำระเงิน')}</h4>
      <ul>
        <li>{tx('สิทธิ์สมัครยืนยันเมื่อผู้ให้บริการรับชำระยืนยันยอดแล้ว ไม่ใช้หน้ายืนยันของเบราว์เซอร์เป็นหลักฐาน')}</li>
        <li>{tx('ในระบบทดลองนี้เป็นการชำระเงินจำลอง ไม่มีการตัดเงินจริง')}</li>
      </ul>
      <h4>{tx('การคืนเงิน')}</h4>
      <ul>
        <li>{tx('การคืนเงินเป็นไปตามนโยบายของผู้จัดงานแต่ละงาน และคืนได้ไม่เกินยอดที่ชำระจริง')}</li>
        <li>{tx('ทุกคำขอคืนเงินมีบันทึกเหตุผลและประวัติ')}</li>
      </ul>
    </>
  );
}

function TermsModal({
  title,
  version,
  children,
  onClose,
  onAccept,
}: {
  title: string;
  version: string;
  children: ReactNode;
  onClose: () => void;
  onAccept: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus();
    };
  }, [onClose]);

  // on <body>: a transformed ancestor would otherwise trap position: fixed
  return createPortal(
    <div className="sf-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="terms-dialog" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <header className="terms-head">
          <div>
            <h3 id="terms-title">{title}</h3>
            <span className="muted-inline mono-code">{version}</span>
          </div>
          <button ref={closeRef} type="button" className="sf-dialog-close" onClick={onClose} aria-label={tx('ปิด')}>
            <IconClose size={18} />
          </button>
        </header>
        <div className="terms-body">{children}</div>
        <footer className="terms-foot">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tx('ปิด')}
          </button>
          <button type="button" className="btn-primary" onClick={onAccept}>
            {tx('รับทราบและยอมรับ')}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
