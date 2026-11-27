import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Organization, RaceEvent } from '../types';
import { tx, txf } from '../i18n';
import { feePolicyLabel } from '../utils/pricing';
import { IconClose } from './Icons';

/** Version of the payment terms text below; stored on the registration when accepted. */
export const PAYMENT_TERMS_VERSION = 'pay-terms-v1';
/** Version of the PDPA consent text below (sending the entry's data to the organizer). */
export const REGISTRATION_PRIVACY_VERSION = 'reg-privacy-v1';

type TermsKind = 'rules' | 'payment' | 'privacy';

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
  acceptPrivacy,
  onAcceptPrivacy,
}: {
  event: RaceEvent;
  organization?: Organization;
  acceptRules: boolean;
  onAcceptRules: (v: boolean) => void;
  acceptPayment: boolean;
  onAcceptPayment: (v: boolean) => void;
  /** PDPA consent row (27 Nov 2026); shown when the caller passes it */
  acceptPrivacy?: boolean;
  onAcceptPrivacy?: (v: boolean) => void;
}) {
  const [open, setOpen] = useState<TermsKind | null>(null);

  const rows: { kind: TermsKind; checked: boolean; set: (v: boolean) => void; text: string }[] = [
    {
      kind: 'rules',
      checked: acceptRules,
      set: onAcceptRules,
      // the version is recorded on the registration, not shown in the text (27 Nov 2026, user request)
      text: tx('ยอมรับกติกาการแข่งขัน'),
    },
    {
      kind: 'payment',
      checked: acceptPayment,
      set: onAcceptPayment,
      text: tx('ยอมรับเงื่อนไขชำระเงินและคืนเงิน'),
    },
    ...(onAcceptPrivacy
      ? [
          {
            kind: 'privacy' as const,
            checked: acceptPrivacy === true,
            set: onAcceptPrivacy,
            text: tx('ยินยอมส่งข้อมูลส่วนตัวและสุขภาพให้ผู้จัด (PDPA)'),
          },
        ]
      : []),
  ];

  const allOn = rows.every((r) => r.checked);
  const someOn = rows.some((r) => r.checked);

  return (
    <div className="terms-group">
      {/* one tick for every agreement (27 Nov 2026, user request "มีให้ check ทั้งหมด");
          each one below can still be ticked and read on its own */}
      <label className="checkbox-row terms-all">
        <input
          type="checkbox"
          checked={allOn}
          ref={(el) => {
            if (el) el.indeterminate = someOn && !allOn;
          }}
          onChange={(e) => rows.forEach((r) => r.set(e.target.checked))}
        />
        <span>{tx('ยอมรับทั้งหมด')}</span>
      </label>
      {rows.map((r) => (
        <div key={r.kind} className="terms-row">
          <label className="checkbox-row">
            <input type="checkbox" checked={r.checked} onChange={(e) => r.set(e.target.checked)} aria-required="true" />
            {/* a required star like the form fields, not the word [จำเป็น] (27 Nov 2026, user request) */}
            <span>
              <span className="required-field-marker" aria-hidden="true">*</span> {r.text}
              <span className="sr-only"> {tx('(จำเป็น)')}</span>
            </span>
          </label>
          <button type="button" className="terms-link" onClick={() => setOpen(r.kind)} aria-haspopup="dialog">
            {tx('อ่านรายละเอียด')}
          </button>
        </div>
      ))}

      {open && (
        <TermsModal
          title={
            open === 'rules'
              ? tx('กติกาการแข่งขันและเงื่อนไขความปลอดภัย')
              : open === 'payment'
                ? tx('ข้อกำหนดการชำระเงินและการคืนเงิน')
                : tx('การส่งข้อมูลส่วนบุคคลให้ผู้จัดงาน (PDPA)')
          }
          onClose={() => setOpen(null)}
          onAccept={() => {
            (open === 'rules' ? onAcceptRules : open === 'payment' ? onAcceptPayment : onAcceptPrivacy ?? (() => undefined))(true);
            setOpen(null);
          }}
        >
          {open === 'rules' ? (
            <RulesText event={event} organization={organization} />
          ) : open === 'payment' ? (
            <PaymentText event={event} />
          ) : (
            <PrivacyText organization={organization} />
          )}
        </TermsModal>
      )}
    </div>
  );
}

function RulesText({ event, organization }: { event: RaceEvent; organization?: Organization }) {
  return (
    <>
      <p className="terms-note">
        {tx('สรุปจากข้อมูลงานในระบบ ข้อความกติกาฉบับเต็มเผยแพร่โดยผู้จัดงาน')}
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
      <p>{txf('รับ Race Kit ตามช่วงเวลา: {0} แสดง QR Token ของใบสมัครเพื่อรับ', tx(event.kitPickupWindow))}</p>
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
      <h4>{tx('ราคาและค่าบริการ')}</h4>
      <ul>
        <li>{tx('ราคาคำนวณโดยระบบ ณ เวลายืนยันคำสั่งซื้อ และบันทึกยอดไว้กับใบสมัคร')}</li>
        <li>{txf('นโยบายค่าบริการของงานนี้: {0}', feePolicyLabel(event.feeBearerPolicy))}</li>
        <li>{tx('ของที่ระลึกที่ซื้อพร้อมใบสมัครเป็นคำสั่งซื้อแยก ไม่เปลี่ยนยอดค่าสมัคร')}</li>
      </ul>
      <h4>{tx('การชำระเงิน')}</h4>
      <ul>
        <li>{tx('สิทธิ์สมัครยืนยันเมื่อผู้ให้บริการรับชำระยืนยันยอดแล้ว ไม่ใช้หน้ายืนยันของเบราว์เซอร์เป็นหลักฐาน')}</li>
        <li>{tx('ระบบนี้ยังไม่มีการตัดเงินจริง')}</li>
      </ul>
      <h4>{tx('การคืนเงิน')}</h4>
      <ul>
        <li>{tx('การคืนเงินเป็นไปตามนโยบายของผู้จัดงานแต่ละงาน และคืนได้ไม่เกินยอดที่ชำระจริง')}</li>
        <li>{tx('ทุกคำขอคืนเงินมีบันทึกเหตุผลและประวัติ')}</li>
      </ul>
    </>
  );
}

function PrivacyText({ organization }: { organization?: Organization }) {
  return (
    <>
      <h4>{tx('ข้อมูลที่ส่งให้ผู้จัดงาน')}</h4>
      <ul>
        <li>{tx('ชื่อ-นามสกุล วันเกิด เพศ และเอกสารยืนยันตัวตนของผู้เข้าแข่งขัน')}</li>
        <li>{tx('เบอร์โทร อีเมล และผู้ติดต่อฉุกเฉิน')}</li>
        <li>{tx('ข้อมูลสุขภาพที่กรอกในใบสมัคร เช่น กรุ๊ปเลือด โรคประจำตัว และประวัติแพ้ยา')}</li>
        <li>{tx('ไซส์เสื้อ ที่อยู่จัดส่ง และคำตอบในฟอร์มสมัคร')}</li>
      </ul>
      <h4>{tx('ใช้เพื่อ')}</h4>
      <ul>
        <li>{tx('จัดการแข่งขัน กำหนดเลข BIB รุ่นอายุ และส่งมอบอุปกรณ์')}</li>
        <li>{tx('ดูแลความปลอดภัยและการปฐมพยาบาลระหว่างแข่งขัน')}</li>
        <li>{tx('ติดต่อผู้เข้าแข่งขันเรื่องงานนี้')}</li>
      </ul>
      <h4>{tx('ผู้รับข้อมูล')}</h4>
      <p>{tx(organization?.nameTh ?? 'ผู้จัดงาน')}</p>
      <p className="terms-note">
        {tx('ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหว ใช้เฉพาะงานนี้และไม่ใช้เพื่อการตลาด ขอดูหรือขอลบข้อมูลได้ตามประกาศความเป็นส่วนตัวของแพลตฟอร์ม')}
      </p>
    </>
  );
}

function TermsModal({
  title,
  children,
  onClose,
  onAccept,
}: {
  title: string;
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
