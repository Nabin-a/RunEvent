import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SavedParticipant } from '../types';
import { getLang, tx } from '../i18n';
import { sanitizeEnglishNameInput, sanitizeThaiNameInput } from '../utils/dateFormat';
import { DateOfBirthInput } from './DateOfBirthInput';
import { IconAlert, IconCheckCircle } from './Icons';
import { IdNumberInput } from './IdNumberInput';
import { PhoneInput } from './PhoneInput';
import { RequiredFieldText } from './RequiredFieldText';
import { SelectMenu } from './SelectMenu';
import { confirmDiscardClose, useEscapeToClose } from './modalShared';

const emptyParticipant = (): SavedParticipant => ({
  id: '',
  firstName: '',
  lastName: '',
  nickname: '',
  firstNameEn: '',
  lastNameEn: '',
  nicknameEn: '',
  dateOfBirth: '',
  gender: 'ไม่ระบุ',
  nationality: 'Thailand',
  idType: 'thai_id',
  idNumber: '',
  phone: '',
  preferredShirtSize: '',
  emergencyContactName: '',
  emergencyContactRelation: '',
  emergencyContactPhone: '',
  relationshipToOwner: '',
});

interface SavedParticipantModalProps {
  /** the saved participant being edited; null adds a new one */
  participant: SavedParticipant | null;
  /** shirt size codes for the "ไซส์เสื้อวิ่ง" choice */
  shirtSizes: string[];
  idPrefix?: string;
  onCancel: () => void;
  /** save the cleaned-up participant (a new one gets its id here); the caller stores it and closes */
  onSave: (participant: SavedParticipant) => void | Promise<void>;
  onInvalid?: (message: string) => void;
}

/**
 * Add / edit one participant saved for registering on someone else's behalf. Shared by the
 * profile and the registration form's information step (25 Nov 2026, user request).
 */
export const SavedParticipantModal: React.FC<SavedParticipantModalProps> = ({
  participant,
  shirtSizes,
  idPrefix = 'sp',
  onCancel,
  onSave,
  onInvalid,
}) => {
  const isEn = getLang() === 'en';
  const [baseline] = useState(() => JSON.stringify({ ...emptyParticipant(), ...(participant ?? {}) }));
  const [draft, setDraft] = useState<SavedParticipant>(() => ({ ...emptyParticipant(), ...(participant ?? {}) }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(participant);

  const requestClose = () => confirmDiscardClose(JSON.stringify(draft) !== baseline, onCancel);
  useEscapeToClose(requestClose);

  const fail = (msg: string) => {
    setError(msg);
    onInvalid?.(msg);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(draft.firstNameEn ?? '').trim() || !(draft.lastNameEn ?? '').trim()) {
      fail(tx('กรุณากรอกชื่อและนามสกุลภาษาอังกฤษของผู้สมัครแทน'));
      return;
    }
    if (draft.idType === 'thai_id' && draft.idNumber && draft.idNumber.length !== 13) {
      fail(tx('เลขบัตรประจำตัวประชาชนต้องครบ 13 หลัก'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        ...draft,
        id: participant?.id ?? `sp-${Date.now().toString(36)}`,
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        nickname: (draft.nickname ?? '').trim() || undefined,
        firstNameEn: (draft.firstNameEn ?? '').trim(),
        lastNameEn: (draft.lastNameEn ?? '').trim(),
        nicknameEn: (draft.nicknameEn ?? '').trim() || undefined,
        dateOfBirth: draft.dateOfBirth || undefined,
        nationality: (draft.nationality ?? '').trim() || 'Thailand',
        idType: (draft.idNumber ?? '').trim() ? draft.idType ?? 'thai_id' : 'none',
        idNumber: (draft.idNumber ?? '').trim() || undefined,
        phone: (draft.phone ?? '').trim() || undefined,
        preferredShirtSize: draft.preferredShirtSize || undefined,
        relationshipToOwner: (draft.relationshipToOwner ?? '').trim() || undefined,
        emergencyContactName: (draft.emergencyContactName ?? '').trim() || undefined,
        emergencyContactRelation: (draft.emergencyContactRelation ?? '').trim() || undefined,
        emergencyContactPhone: (draft.emergencyContactPhone ?? '').trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const shownName = isEn
    ? `${draft.firstNameEn ?? ''} ${draft.lastNameEn ?? ''}`.trim() || `${draft.firstName} ${draft.lastName}`.trim()
    : `${draft.firstName} ${draft.lastName}`.trim() || `${draft.firstNameEn ?? ''} ${draft.lastNameEn ?? ''}`.trim();

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
              <h3 id={`${idPrefix}-modal-title`}>{editing ? tx('แก้ไขข้อมูลผู้สมัครแทน') : tx('เพิ่มผู้สมัคร')}</h3>
              <p className="muted-inline">{shownName}</p>
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
                  <label htmlFor={`${idPrefix}-fne`}>
                    {<RequiredFieldText text={tx('ชื่อ (ภาษาอังกฤษ) *')} />}
                  </label>
                  <input
                    id={`${idPrefix}-fne`}
                    type="text"
                    placeholder={tx('กรอกชื่อภาษาอังกฤษ')}
                    value={draft.firstNameEn ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        firstNameEn: sanitizeEnglishNameInput(
                          e.target.value
                        ),
                      })
                    }
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-lne`}>
                    {<RequiredFieldText text={tx('นามสกุล (ภาษาอังกฤษ) *')} />}
                  </label>
                  <input
                    id={`${idPrefix}-lne`}
                    type="text"
                    placeholder={tx('กรอกนามสกุลภาษาอังกฤษ')}
                    value={draft.lastNameEn ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lastNameEn: sanitizeEnglishNameInput(
                          e.target.value
                        ),
                      })
                    }
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-nke`}>
                    {tx('ชื่อเล่น (ภาษาอังกฤษ)')}
                  </label>
                  <input
                    id={`${idPrefix}-nke`}
                    type="text"
                    placeholder={tx('กรอกชื่อเล่นภาษาอังกฤษ')}
                    value={draft.nicknameEn ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        nicknameEn: sanitizeEnglishNameInput(
                          e.target.value
                        ),
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-fn`}>
                    {tx('ชื่อ (ภาษาไทย)')}
                  </label>
                  <input
                    id={`${idPrefix}-fn`}
                    type="text"
                    placeholder={tx('ไม่บังคับสำหรับชาวต่างชาติ')}
                    value={draft.firstName}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        firstName: sanitizeThaiNameInput(
                          e.target.value
                        ),
                      })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-ln`}>
                    {tx('นามสกุล (ภาษาไทย)')}
                  </label>
                  <input
                    id={`${idPrefix}-ln`}
                    type="text"
                    placeholder={tx('ไม่บังคับสำหรับชาวต่างชาติ')}
                    value={draft.lastName}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        lastName: sanitizeThaiNameInput(
                          e.target.value
                        ),
                      })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-nk`}>
                    {tx('ชื่อเล่น (ภาษาไทย)')}
                  </label>
                  <input
                    id={`${idPrefix}-nk`}
                    type="text"
                    placeholder={tx('กรอกชื่อเล่นภาษาไทย')}
                    value={draft.nickname ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        nickname: sanitizeThaiNameInput(
                          e.target.value
                        ),
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-dob`}>{tx('วันเกิด')}</label>
                  <DateOfBirthInput
                    id={`${idPrefix}-dob`}
                    valueIso={draft.dateOfBirth ?? ''}
                    onChangeIso={(v) =>
                      setDraft({ ...draft, dateOfBirth: v })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-gen`}>{tx('เพศ')}</label>
                  <SelectMenu
                    id={`${idPrefix}-gen`}
                    value={draft.gender ?? 'ไม่ระบุ'}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        gender: v as 'ชาย' | 'หญิง' | 'ไม่ระบุ',
                      })
                    }
                    options={[
                      { value: 'ไม่ระบุ', label: tx('ไม่ระบุ') },
                      { value: 'ชาย', label: tx('ชาย') },
                      { value: 'หญิง', label: tx('หญิง') },
                    ]}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-nat`}>{tx('สัญชาติ')}</label>
                  <input
                    id={`${idPrefix}-nat`}
                    type="text"
                    placeholder={tx('ระบุสัญชาติ')}
                    value={
                      !isEn &&
                        (draft.nationality ?? '')
                          .trim()
                          .toLowerCase() === 'thailand'
                        ? 'ไทย'
                        : isEn &&
                          (draft.nationality ?? '').trim() ===
                          'ไทย'
                          ? 'Thailand'
                          : draft.nationality ?? 'Thailand'
                    }
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        nationality: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-ph`}>{tx('เบอร์โทรศัพท์')}</label>
                  <PhoneInput
                    id={`${idPrefix}-ph`}
                    value={draft.phone ?? ''}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        phone: next,
                      })}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-idt`}>
                    {tx('ประเภทเอกสาร')}
                  </label>
                  <SelectMenu
                    id={`${idPrefix}-idt`}
                    value={
                      draft.idType && draft.idType !== 'none'
                        ? draft.idType
                        : 'thai_id'
                    }
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        idType: v as 'none' | 'thai_id' | 'passport',
                      })
                    }
                    options={[
                      { value: 'thai_id', label: tx('บัตรประจำตัวประชาชน 13 หลัก') },
                      { value: 'passport', label: tx('หนังสือเดินทาง') },
                    ]}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-idn`}>
                    {tx('เลขบัตร / เลขหนังสือเดินทาง')}
                  </label>
                  <IdNumberInput
                    id={`${idPrefix}-idn`}
                    idType={
                      draft.idType && draft.idType !== 'none'
                        ? draft.idType
                        : 'thai_id'
                    }
                    className="mono-code"
                    value={draft.idNumber ?? ''}
                    onValueChange={(next) =>
                      setDraft({ ...draft, idNumber: next })
                    }
                    placeholder={
                      draft.idType === 'passport'
                        ? tx('กรอกเลขหนังสือเดินทาง')
                        : 'X-XXXX-XXXXX-XX-X'
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-shirt`}>
                    {tx('ไซส์เสื้อวิ่ง')}
                  </label>
                  <SelectMenu
                    id={`${idPrefix}-shirt`}
                    value={draft.preferredShirtSize ?? ''}
                    onChange={(v) =>
                      setDraft({
                        ...draft,
                        preferredShirtSize: v,
                      })
                    }
                    options={[
                      { value: '', label: tx('ไม่ระบุ') },
                      ...shirtSizes.map((code) => ({ value: code, label: code })),
                    ]}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-rel-owner`}>
                    {tx('ความสัมพันธ์')}
                  </label>
                  <input
                    id={`${idPrefix}-rel-owner`}
                    type="text"
                    placeholder={tx('เช่น น้องชาย / เพื่อนร่วมทีม')}
                    value={draft.relationshipToOwner ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        relationshipToOwner: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-em-name`}>
                    {tx('ชื่อผู้ติดต่อฉุกเฉิน')}
                  </label>
                  <input
                    id={`${idPrefix}-em-name`}
                    type="text"
                    placeholder={tx('ชื่อ-นามสกุลผู้ติดต่อฉุกเฉิน')}
                    value={draft.emergencyContactName ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        emergencyContactName: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-em-rel`}>
                    {tx('ความสัมพันธ์ผู้ติดต่อฉุกเฉิน')}
                  </label>
                  <input
                    id={`${idPrefix}-em-rel`}
                    type="text"
                    placeholder={tx('เช่น บิดา / มารดา / คู่สมรส')}
                    value={draft.emergencyContactRelation ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        emergencyContactRelation: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-row">
                  <label htmlFor={`${idPrefix}-em-phone`}>
                    {tx('เบอร์โทรฉุกเฉิน')}
                  </label>
                  <PhoneInput
                    id={`${idPrefix}-em-phone`}
                    value={draft.emergencyContactPhone ?? ''}
                    onChange={(next) =>
                      setDraft({
                        ...draft,
                        emergencyContactPhone: next,
                      })}
                  />
                </div>
              </div>
            </div>

          <div className="runner-modal-footer">
            <button type="button" className="btn-secondary" onClick={requestClose}>
              {tx('ยกเลิก')}
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <IconCheckCircle size={15} />
              <span>{saving ? tx('กำลังบันทึก…') : editing ? tx('บันทึกการแก้ไข') : tx('เพิ่มผู้สมัคร')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
