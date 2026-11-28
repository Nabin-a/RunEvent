import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../i18n';
import {
  PRIVACY_NOTICE_EFFECTIVE_TH,
  PRIVACY_NOTICE_SECTIONS,
  PRIVACY_NOTICE_VERSION,
} from '../data/privacyNotice';
import { IconShield } from './Icons';

interface PrivacyNoticeModalProps {
  open: boolean;
  /**
   * signup   — before creating an account (accept = create account)
   * reconsent — after sign-in when the notice version changed or was never recorded
   * read     — read-only view (e.g. link on the sign-in page), no acknowledgement
   */
  mode?: 'signup' | 'signin' | 'reconsent' | 'read';
  busy?: boolean;
  onAccept?: () => void;
  onCancel: () => void;
}

/**
 * PDPA privacy notice shown before a new account is created.
 * The user must tick the acknowledgement before "accept" is enabled.
 * Marketing consent is NOT bundled here; it stays a separate optional checkbox in the form.
 */
export const PrivacyNoticeModal: React.FC<PrivacyNoticeModalProps> = ({
  open,
  mode = 'signup',
  busy = false,
  onAccept,
  onCancel,
}) => {
  const isRead = mode === 'read';
  const [acknowledged, setAcknowledged] = useState(false);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setAcknowledged(false);
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mode !== 'reconsent') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel, mode]);

  if (!open) return null;

  return createPortal(
    <div
      className="runner-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && mode !== 'reconsent') onCancel();
      }}
    >
      <div
        className="runner-modal-dialog privacy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-modal-title"
      >
        <div className="runner-modal-header">
          <div className="privacy-modal-title">
            <IconShield size={20} />
            <div>
              <h3 id="privacy-modal-title" ref={headingRef} tabIndex={-1}>
                {tx('ประกาศความเป็นส่วนตัว (Privacy Notice)')}
              </h3>
              <span className="muted-inline">
                {tx('มีผลตั้งแต่')} {PRIVACY_NOTICE_EFFECTIVE_TH} · {tx('เวอร์ชัน')}{' '}
                <span className="mono-code">{PRIVACY_NOTICE_VERSION}</span>
              </span>
            </div>
          </div>
          {mode !== 'reconsent' && (
            <button
              type="button"
              className="runner-modal-close-btn"
              aria-label={tx('ปิด')}
              onClick={onCancel}
            >
              ×
            </button>
          )}
        </div>

        <div className="runner-modal-body privacy-modal-body">
          {mode === 'reconsent' && (
            <p className="privacy-reconsent-note">
              {tx(
                'ประกาศความเป็นส่วนตัวมีเวอร์ชันใหม่ หรือบัญชีของคุณยังไม่มีบันทึกการรับทราบ กรุณาอ่านและรับทราบก่อนใช้งานต่อ'
              )}
            </p>
          )}
          {PRIVACY_NOTICE_SECTIONS.map((sec) => (
            <section key={sec.id} className="privacy-section" aria-labelledby={`pv-${sec.id}`}>
              <h4 id={`pv-${sec.id}`}>{sec.title}</h4>
              {sec.paragraphs?.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {sec.bullets && (
                <ul>
                  {sec.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {isRead ? (
          <div className="runner-modal-footer">
            <button type="button" className="btn-primary" onClick={onCancel}>
              {tx('ปิด')}
            </button>
          </div>
        ) : (
        <div className="runner-modal-footer privacy-modal-footer">
          <label className="checkbox-row privacy-ack">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              {tx(
                'ฉันได้อ่านและรับทราบประกาศความเป็นส่วนตัว และยอมรับให้ กระต่าย ประมวลผลข้อมูลเพื่อให้บริการบัญชีและการสมัครงานวิ่ง'
              )}
            </span>
          </label>
          <div className="privacy-modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>
              {mode === 'reconsent' ? tx('ไม่ยอมรับและออกจากระบบ') : tx('ยกเลิก')}
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!acknowledged || busy}
              onClick={onAccept}
            >
              {mode === 'reconsent'
                ? tx('รับทราบและใช้งานต่อ')
                : mode === 'signin'
                  ? tx('ยอมรับและไปหน้าเข้าสู่ระบบ')
                  : tx('ยอมรับและสร้างบัญชี')}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
};
