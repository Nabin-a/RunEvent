import React, { useEffect, useRef, useState } from 'react';
import { IconCalendar } from './Icons';
import {
  autoMaskDdMmYyyy,
  ddMmYyyyToIso,
  isoToDdMmYyyy,
} from '../utils/dateFormat';
import { tx } from '../i18n';

interface DateOfBirthInputProps {
  id: string;
  valueIso: string;
  onChangeIso: (nextIso: string) => void;
  required?: boolean;
}

/**
 * ช่องวันเกิดมาตรฐาน dd/mm/yyyy ทั้งการแสดงผลและการพิมพ์ (ไม่เพี้ยนตาม Locale ของ OS)
 * รองรับทั้งการพิมพ์ตัวเลข (เติม / อัตโนมัติ) และการกดปุ่มปฏิทินช่วยเลือก
 */
export const DateOfBirthInput: React.FC<DateOfBirthInputProps> = ({
  id,
  valueIso,
  onChangeIso,
  required = false,
}) => {
  const [displayText, setDisplayText] = useState<string>(() =>
    isoToDdMmYyyy(valueIso)
  );
  const [invalidHint, setInvalidHint] = useState(false);
  const nativeDateRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDisplayText(isoToDdMmYyyy(valueIso));
    setInvalidHint(false);
  }, [valueIso]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = autoMaskDdMmYyyy(e.target.value);
    setDisplayText(masked);

    if (!masked) {
      setInvalidHint(false);
      onChangeIso('');
      return;
    }

    if (masked.length === 10) {
      const parsedIso = ddMmYyyyToIso(masked);
      if (parsedIso) {
        setInvalidHint(false);
        onChangeIso(parsedIso);
      } else {
        setInvalidHint(true);
      }
    } else {
      setInvalidHint(false);
    }
  };

  const handleBlur = () => {
    if (!displayText.trim()) {
      setInvalidHint(false);
      onChangeIso('');
      return;
    }
    const parsedIso = ddMmYyyyToIso(displayText);
    if (parsedIso) {
      setInvalidHint(false);
      setDisplayText(isoToDdMmYyyy(parsedIso));
      onChangeIso(parsedIso);
    } else {
      setInvalidHint(true);
    }
  };

  return (
    <div className="dob-field-stack">
      <div className="dob-input-wrap">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          className="mono-num"
          placeholder={tx('วว/ดด/ปปปป')}
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          maxLength={10}
          required={required}
          aria-invalid={invalidHint}
        />
        <button
          type="button"
          className="dob-picker-trigger"
          aria-label={tx('เลือกวันเกิดจากปฏิทิน')}
          onClick={() => {
            const el = nativeDateRef.current;
            if (!el) return;
            if (typeof el.showPicker === 'function') {
              el.showPicker();
            } else {
              el.focus();
              el.click();
            }
          }}
        >
          <IconCalendar size={15} />
        </button>
        <input
          ref={nativeDateRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          className="dob-hidden-native"
          value={/^\d{4}-\d{2}-\d{2}$/.test(valueIso) ? valueIso : ''}
          max="2026-12-31"
          min="1920-01-01"
          onChange={(e) => {
            const nextIso = e.target.value;
            if (nextIso) {
              setInvalidHint(false);
              setDisplayText(isoToDdMmYyyy(nextIso));
              onChangeIso(nextIso);
            }
          }}
        />
      </div>
      {invalidHint && (
        <span className="text-danger" style={{ fontSize: '0.75rem' }}>
          {tx('กรุณาระบุวันเกิดรูปแบบ วว/ดด/ปปปป ที่ถูกต้อง (เช่น 14/05/1994)')}
        </span>
      )}
    </div>
  );
};
