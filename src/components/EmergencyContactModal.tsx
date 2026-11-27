import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { RunnerEmergencyContact } from '../types';
import { tx } from '../i18n';
import { IconAlert, IconCheckCircle, IconPlus } from './Icons';
import { PhoneInput } from './PhoneInput';
import { RequiredFieldText } from './RequiredFieldText';
import { confirmDiscardClose, useEscapeToClose } from './modalShared';

export interface EmergencyContactDraft {
  contactName: string;
  relationship: string;
  phone: string;
  email?: string;
}

interface EmergencyContactModalProps {
  /** the contact being edited; null adds a new one */
  contact: RunnerEmergencyContact | null;
  idPrefix?: string;
  onCancel: () => void;
  /** save; the caller stores the contact and closes the dialog */
  onSave: (draft: EmergencyContactDraft) => void | Promise<void>;
  onInvalid?: (message: string) => void;
}

/**
 * Add / edit one emergency contact. Shared by the profile and the registration form's
 * information step (25 Nov 2026, user request).
 */
export const EmergencyContactModal: React.FC<EmergencyContactModalProps> = ({
  contact,
  idPrefix = 'ec',
  onCancel,
  onSave,
  onInvalid,
}) => {
  const [baseline] = useState(() => ({
    name: contact?.contactName ?? '',
    rel: contact?.relationship ?? '',
    phone: contact?.phone ?? '',
    email: contact?.email ?? '',
  }));
  const [name, setName] = useState(baseline.name);
  const [rel, setRel] = useState(baseline.rel);
  const [phone, setPhone] = useState(baseline.phone);
  const [email, setEmail] = useState(baseline.email);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(contact);

  const dirty =
    name !== baseline.name || rel !== baseline.rel || phone !== baseline.phone || email !== baseline.email;
  const requestClose = () => confirmDiscardClose(dirty, onCancel);
  useEscapeToClose(requestClose);

  const fail = (msg: string) => {
    setError(msg);
    onInvalid?.(msg);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.trim().replace(/\D/g, '').length < 9) {
      fail(tx('กรุณาระบุชื่อและเบอร์โทรผู้ติดต่อฉุกเฉิน (9–10 หลัก)'));
      return;
    }
    // the relationship starts empty (placeholder only), so it must be typed
    if (!rel.trim()) {
      fail(tx('กรุณาระบุความสัมพันธ์กับผู้ติดต่อฉุกเฉิน'));
      return;
    }
    // the email is required like the phone (27 Nov 2026, user request)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fail(tx('กรุณากรอกอีเมลผู้ติดต่อฉุกเฉินให้ถูกต้อง'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        contactName: name.trim(),
        relationship: rel.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="runner-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="runner-modal-dialog" role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-modal-title`}>
        <form className="runner-modal-form" onSubmit={submit}>
          <div className="runner-modal-header">
            <div>
              <h3 id={`${idPrefix}-modal-title`}>
                {editing ? tx('แก้ไขผู้ติดต่อฉุกเฉิน') : tx('เพิ่มผู้ติดต่อฉุกเฉินใหม่')}
              </h3>
            </div>
            <button type="button" className="runner-modal-close-btn" aria-label={tx('ปิดหน้าต่างแก้ไข')} onClick={requestClose}>
              ×
            </button>
          </div>

          <div className="runner-modal-body canvas-stack">
            {error && (
              <div className="error-callout" role="alert">
                <IconAlert size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor={`${idPrefix}-name`}>
                  <RequiredFieldText text={tx('ชื่อ-นามสกุลผู้ติดต่อ *')} />
                </label>
                <input
                  id={`${idPrefix}-name`}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={tx('เช่น วีระ วัฒนากูล')}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor={`${idPrefix}-rel`}>
                  <RequiredFieldText text={tx('ความสัมพันธ์ *')} />
                </label>
                <input
                  id={`${idPrefix}-rel`}
                  type="text"
                  value={rel}
                  onChange={(e) => setRel(e.target.value)}
                  placeholder={tx('เช่น บิดา / มารดา / คู่สมรส')}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor={`${idPrefix}-phone`}>
                  <RequiredFieldText text={tx('เบอร์โทรศัพท์ *')} />
                </label>
                <PhoneInput id={`${idPrefix}-phone`} value={phone} onChange={setPhone} required />
              </div>
              <div className="form-row">
                <label htmlFor={`${idPrefix}-email`}>
                  <RequiredFieldText text={tx('อีเมล *')} />
                </label>
                <input
                  id={`${idPrefix}-email`}
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tx('กรอกอีเมลผู้ติดต่อ')}
                />
              </div>
            </div>
          </div>

          <div className="runner-modal-footer">
            <button type="button" className="btn-secondary" onClick={requestClose}>
              {tx('ยกเลิก')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {editing ? <IconCheckCircle size={15} /> : <IconPlus size={15} />}
              <span>
                {saving ? tx('กำลังบันทึก…') : editing ? tx('บันทึกการแก้ไข') : tx('เพิ่มรายชื่อผู้ติดต่อฉุกเฉิน')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
