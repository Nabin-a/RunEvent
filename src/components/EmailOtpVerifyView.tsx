import React, { useEffect, useRef, useState } from 'react';
import { IconCheckCircle, IconMail } from './Icons';
import { tx, txf } from '../i18n';

interface EmailOtpVerifyViewProps {
  targetEmail: string;
  onVerifyEmailWithOtp: (
    email: string,
    otp: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onVerifiedSuccess: (verifiedEmail: string) => void;
  onBackToSecurity: () => void;
}

export const EmailOtpVerifyView: React.FC<EmailOtpVerifyViewProps> = ({
  targetEmail,
  onVerifyEmailWithOtp,
  onVerifiedSuccess,
  onBackToSecurity,
}) => {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

  const handleDigitChange = (idx: number, rawVal: string) => {
    const clean = rawVal.replace(/\D/g, '');
    setErrorMsg(null);
    if (!clean) {
      setDigits((prev) => {
        const next = [...prev];
        next[idx] = '';
        return next;
      });
      return;
    }
    const char = clean.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = char;
      return next;
    });
    if (idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (
    idx: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      inputRefs.current[idx - 1]?.focus();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      e.preventDefault();
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setErrorMsg(null);
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const focusIdx = Math.min(5, pasted.length);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = digits.join('');
    if (code.length < 6) {
      setErrorMsg(tx('กรุณากรอกรหัสยืนยันให้ครบ 6 หลัก'));
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    const res = await onVerifyEmailWithOtp(targetEmail.trim(), code);
    setSubmitting(false);
    if (res.ok) {
      onVerifiedSuccess(targetEmail.trim());
    } else {
      setErrorMsg(res.error ?? tx('รหัสยืนยันไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'));
    }
  };

  return (
    <main className="customer-container otp-verify-shell">
      <section className="clean-panel otp-verify-card">
        <div className="otp-verify-topbar">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={onBackToSecurity}
          >
            {tx('← ย้อนกลับไปหน้าบัญชีและความปลอดภัย')}
          </button>
        </div>

        <div className="otp-verify-header">
          <div className="otp-mail-badge" aria-hidden="true">
            <IconMail size={22} />
          </div>
          <h1>{tx('ยืนยันที่อยู่อีเมล')}</h1>
          <p className="muted-block">
            {tx('ระบบได้ส่งรหัสยืนยัน 6 หลักไปยังอีเมล')}
            <br />
            <strong className="otp-target-email">{targetEmail}</strong>
          </p>
        </div>


        <form className="canvas-stack" onSubmit={handleSubmit}>
          <div className="otp-digit-section">
            <label htmlFor="otp-digit-0" className="otp-digit-label">
              {tx('กรอกรหัสยืนยัน 6 หลัก')}
            </label>
            <div className="otp-digit-grid">
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-digit-${idx}`}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  aria-label={txf('รหัสหลักที่ {0}', idx + 1)}
                  className="otp-digit-input mono-code"
                  value={digit}
                  onChange={(ev) => handleDigitChange(idx, ev.target.value)}
                  onKeyDown={(ev) => handleKeyDown(idx, ev)}
                  onPaste={handlePaste}
                />
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="error-callout" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}

          {resendNotice && !errorMsg && (
            <div className="success-callout" role="status">
              <IconCheckCircle size={16} />
              <span>{tx('ส่งรหัสยืนยันใหม่ไปยังอีเมลเรียบร้อยแล้ว')}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary otp-submit-btn"
            disabled={submitting}
          >
            <IconCheckCircle size={16} />
            <span>
              {submitting ? tx('กำลังตรวจสอบรหัส...') : tx('ยืนยันรหัส')}
            </span>
          </button>
        </form>

        <div className="otp-resend-footer">
          <span className="muted-inline">{tx('ยังไม่ได้รับอีเมล?')}</span>{' '}
          <button
            type="button"
            className="otp-resend-link"
            disabled={resendCooldown > 0}
            onClick={() => {
              setResendCooldown(30);
              setResendNotice(true);
              setErrorMsg(null);
            }}
          >
            {resendCooldown > 0
              ? txf('ส่งรหัสใหม่ได้ใน {0} วินาที', resendCooldown)
              : tx('ส่งรหัสใหม่อีกครั้ง')}
          </button>
        </div>
      </section>
    </main>
  );
};
