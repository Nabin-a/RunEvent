import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { RunnerSavedAddress } from '../types';
import { tx } from '../i18n';
import { IconAlert, IconCheckCircle, IconPlus } from './Icons';
import { PhoneInput } from './PhoneInput';
import { RequiredFieldText } from './RequiredFieldText';
import { ThaiPostalAddressSelector } from './ThaiPostalAddressSelector';
import { confirmDiscardClose, useEscapeToClose } from './modalShared';

/** What the dialog hands back; `label` may be blank (the caller names it "ที่อยู่ที่ <n>"). */
export interface SavedAddressDraft {
  label: string;
  recipientName: string;
  phone: string;
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  country: string;
}

interface SavedAddressModalProps {
  /** the address being edited; null adds a new one */
  address: RunnerSavedAddress | null;
  /** recipient and phone for a new address */
  defaultRecipient?: string;
  defaultPhone?: string;
  contactEmail?: string;
  idPrefix?: string;
  /** close without saving (already confirmed when there were unsaved edits) */
  onCancel: () => void;
  /** save; the caller stores the address and closes the dialog */
  onSave: (draft: SavedAddressDraft) => void | Promise<void>;
  /** extra feedback for a failed check (the dialog also shows the message itself) */
  onInvalid?: (message: string) => void;
}

const draftOf = (a: RunnerSavedAddress | null, recipient: string, phone: string): SavedAddressDraft =>
  a
    ? {
      label: a.addressName,
      recipientName: a.recipientName,
      phone: a.phone,
      address: a.address,
      province: a.province,
      district: a.district,
      subdistrict: a.subdistrict,
      postalCode: a.postalCode,
      country: a.country,
    }
    : {
      label: '',
      recipientName: recipient,
      phone,
      address: '',
      province: 'เชียงใหม่',
      district: 'เมืองเชียงใหม่',
      subdistrict: 'สุเทพ',
      postalCode: '50200',
      country: 'Thailand',
    };

/**
 * Add / edit one saved shipping address. Shared by the profile's address book and the
 * registration form's address step so both show the same dialog (25 Nov 2026, user request).
 */
export const SavedAddressModal: React.FC<SavedAddressModalProps> = ({
  address,
  defaultRecipient = '',
  defaultPhone = '',
  contactEmail,
  idPrefix = 'ad-book',
  onCancel,
  onSave,
  onInvalid,
}) => {
  const [baseline] = useState(() => draftOf(address, defaultRecipient, defaultPhone));
  const [draft, setDraft] = useState<SavedAddressDraft>(baseline);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(address);
  const set = (patch: Partial<SavedAddressDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = (Object.keys(baseline) as (keyof SavedAddressDraft)[]).some((k) => draft[k] !== baseline[k]);

  const requestClose = () => confirmDiscardClose(dirty, onCancel);
  useEscapeToClose(requestClose);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.recipientName.trim() || !draft.address.trim()) {
      const msg = tx('กรุณาระบุชื่อผู้รับ และบ้านเลขที่/ถนนให้ครบถ้วน');
      setError(msg);
      onInvalid?.(msg);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        ...draft,
        label: draft.label.trim(),
        recipientName: draft.recipientName.trim(),
        phone: draft.phone.trim(),
        address: draft.address.trim(),
        postalCode: draft.postalCode.trim(),
        country: draft.country.trim() || 'Thailand',
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
      <div className="runner-modal-dialog" role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-title`}>
        <form className="runner-modal-form" onSubmit={submit}>
          <div className="runner-modal-header">
            <div>
              <h3 id={`${idPrefix}-title`}>
                {editing ? tx('แก้ไขที่อยู่จัดส่ง') : tx('เพิ่มที่อยู่จัดส่งใหม่')}
              </h3>
            </div>
            <button
              type="button"
              className="runner-modal-close-btn"
              aria-label={tx('ปิดหน้าต่างแก้ไข')}
              onClick={requestClose}
            >
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
            {/* right column (recipient, then the summary) rises next to the phone row;
                fields stay in reading order so Tab goes name, recipient, phone, address */}
            <ThaiPostalAddressSelector
              typeableArea
              flow={{
                topLeft: (
                  <div className="form-row">
                    <label htmlFor={`${idPrefix}-lbl`}>{tx('ชื่อเรียกที่อยู่ (ไม่บังคับ)')}</label>
                    <input
                      id={`${idPrefix}-lbl`}
                      type="text"
                      value={draft.label}
                      maxLength={60}
                      onChange={(e) => set({ label: e.target.value })}
                      placeholder={tx('เช่น บ้านพัก / ที่ทำงาน')}
                    />
                  </div>
                ),
                topRight: (
                  <div className="form-row">
                    <label htmlFor={`${idPrefix}-rec`}>
                      <RequiredFieldText text={tx('ชื่อผู้รับพัสดุ *')} />
                    </label>
                    <input
                      id={`${idPrefix}-rec`}
                      type="text"
                      value={draft.recipientName}
                      onChange={(e) => set({ recipientName: e.target.value })}
                      required
                    />
                  </div>
                ),
                left: (
                  <div className="form-row">
                    <label htmlFor={`${idPrefix}-ph`}>
                      <RequiredFieldText text={tx('เบอร์โทรผู้รับ *')} />
                    </label>
                    <PhoneInput
                      id={`${idPrefix}-ph`}
                      value={draft.phone}
                      onChange={(next) => set({ phone: next })}
                      required
                    />
                  </div>
                ),
              }}
              idPrefix={idPrefix}
              contactName={draft.recipientName}
              contactPhone={draft.phone}
              contactEmail={contactEmail}
              required
              streetAddressLabel="ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)"
              streetAddressPlaceholder="เช่น 199/8 ถ.ห้วยแก้ว หมู่บ้านล้านนาวิว"
              value={{
                country: draft.country,
                postalCode: draft.postalCode,
                province: draft.province,
                district: draft.district,
                subdistrict: draft.subdistrict,
                address: draft.address,
              }}
              onChange={(next) =>
                set({
                  country: next.country,
                  postalCode: next.postalCode,
                  province: next.province,
                  district: next.district,
                  subdistrict: next.subdistrict,
                  address: next.address,
                })
              }
            />
          </div>

          <div className="runner-modal-footer">
            <button type="button" className="btn-secondary" onClick={requestClose}>
              {tx('ยกเลิก')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {editing ? <IconCheckCircle size={15} /> : <IconPlus size={15} />}
              <span>
                {saving
                  ? tx('กำลังบันทึก…')
                  : editing
                    ? tx('บันทึกการแก้ไขที่อยู่')
                    : tx('บันทึกที่อยู่จัดส่ง')}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
