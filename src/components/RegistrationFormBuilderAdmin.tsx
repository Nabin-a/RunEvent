import { RequiredFieldText } from './RequiredFieldText';
import React, { useState } from 'react';
import {
  ConditionalRule,
  CustomFieldType,
  FormFieldPolicy,
  FormTemplate,
  GlobalFormFieldDef,
  Organization,
  OrganizerFieldRequest,
  PlatformProfileConfig,
  ProfileCompletionSectionKey,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  ShirtCutType,
} from '../types';
import { DEFAULT_PLATFORM_PROFILE_CONFIG } from '../data/runnerProfileDefaults';
import { policyLabelTh } from '../data/formBuilderData';
import {
  IconAlert,
  IconCheckCircle,
  IconLock,
  IconPlus,
  IconShield,
} from './Icons';

import { tx, txf } from '../i18n';
export type BuilderSubmodule =
  | 'requests_permissions'
  | 'templates'
  | 'steps'
  | 'field_library'
  | 'field_config'
  | 'conditional_logic'
  | 'versions'
  | 'runner_profile_config';

interface RegistrationFormBuilderAdminProps {
  templates: FormTemplate[];
  steps: RegistrationStepDef[];
  globalFields: GlobalFormFieldDef[];
  conditionalRules: ConditionalRule[];
  fieldRequests: OrganizerFieldRequest[];
  events: RaceEvent[];
  organizations: Organization[];
  registrations: RegistrationRecord[];
  platformProfileConfig?: PlatformProfileConfig;
  onUpdatePlatformProfileConfig?: (next: PlatformProfileConfig) => void;
  onUpsertStep: (step: RegistrationStepDef) => void;
  onReorderStep: (stepId: string, direction: 'up' | 'down') => void;
  onDeleteStep: (stepId: string) => void;
  onUpsertGlobalField: (field: GlobalFormFieldDef) => void;
  onAddConditionalRule: (rule: ConditionalRule) => void;
  onDeleteConditionalRule: (ruleId: string) => void;
  onPublishTemplateVersion: (templateId: string, summary: string) => void;
  onCreateTemplate: (nameTh: string, code: string, descriptionTh: string) => void;
  onResolveFieldRequest: (
    requestId: string,
    decision: 'approved' | 'rejected',
    policy: FormFieldPolicy,
    adminNote: string
  ) => void;
}

const inputTypeLabels: Record<CustomFieldType, string> = {
  text: 'Text Input (ข้อความสั้น)',
  textarea: 'Textarea (ข้อความหลายบรรทัด)',
  email: 'Email (อีเมล)',
  phone: 'Phone Number (เบอร์โทรศัพท์)',
  number: 'Number (ตัวเลข)',
  date: 'Date Picker (วันที่)',
  select: 'Dropdown (ตัวเลือกเดียว)',
  radio: 'Radio Group (ปุ่มตัวเลือก)',
  checkbox: 'Checkbox (ช่องติ๊กยืนยัน)',
  multiselect: 'Multi-select (เลือกได้หลายข้อ)',
  file: 'File Upload (อัปโหลดไฟล์ส่วนตัว)',
  image_choice: 'Image Choice (เลือกรูปแบบภาพ)',
  address: 'Address (ที่อยู่จัดส่ง)',
  size_selector: 'Size Selector (ตัวเลือกไซส์เสื้อ)',
  distance_selector: 'Race Distance Selector (ตัวเลือกระยะวิ่ง)',
};

const FORBIDDEN_FIELD_KEYWORDS = [
  'password',
  'รหัสผ่าน',
  'cvv',
  'credit card',
  'เลขบัตรเครดิต',
  'pin ATM',
  'secret token',
];

export const RegistrationFormBuilderAdmin: React.FC<
  RegistrationFormBuilderAdminProps
> = ({
  templates,
  steps,
  globalFields,
  conditionalRules,
  fieldRequests,
  events,
  organizations,
  registrations,
  platformProfileConfig = DEFAULT_PLATFORM_PROFILE_CONFIG,
  onUpdatePlatformProfileConfig,
  onUpsertStep,
  onReorderStep,
  onDeleteStep,
  onUpsertGlobalField,
  onAddConditionalRule,
  onDeleteConditionalRule,
  onPublishTemplateVersion,
  onCreateTemplate,
  onResolveFieldRequest,
}) => {
  const [subTab, setSubTab] = useState<BuilderSubmodule>('requests_permissions');
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // State for Platform Runner Profile & Shirt Size Governance
  const [chartCutEdit, setChartCutEdit] = useState<ShirtCutType>('Unisex');
  const [newSizeCode, setNewSizeCode] = useState('');
  const [newSizeChest, setNewSizeChest] = useState('54 นิ้ว');
  const [newSizeLength, setNewSizeLength] = useState('33.5 นิ้ว');

  // State for Step Management
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepKey, setNewStepKey] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');
  const [dragStepId, setDragStepId] = useState<string | null>(null);
  const [previewStepIdx, setPreviewStepIdx] = useState(0);

  // State for Field Library & Field Configuration
  const [selectedFieldId, setSelectedFieldId] = useState<string>(
    globalFields.find((f) => f.policy !== 'LOCKED')?.id ?? globalFields[0]?.id ?? ''
  );
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldStepKey, setNewFieldStepKey] =
    useState<string>('step_race_specific');
  const [newFieldPolicy, setNewFieldPolicy] =
    useState<FormFieldPolicy>('CONFIGURABLE');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldSensitive, setNewFieldSensitive] = useState(false);

  // State for Conditional Logic Builder
  const [condSourceKey, setCondSourceKey] = useState('race_distance');
  const [condOperator, setCondOperator] = useState<
    'equals' | 'not_equals' | 'contains'
  >('equals');
  const [condValue, setCondValue] = useState('21.1 km');
  const [condTargetType, setCondTargetType] = useState<'field' | 'step'>('field');
  const [condTargetKey, setCondTargetKey] = useState('cf_experience');

  // State for Template Creation
  const [tplName, setTplName] = useState('');
  const [tplCode, setTplCode] = useState('');
  const [tplDesc, setTplDesc] = useState('');

  // State for Organizer Request resolution
  const [reqNotes, setReqNotes] = useState<Record<string, string>>({});
  const [reqPolicyPick, setReqPolicyPick] = useState<
    Record<string, FormFieldPolicy>
  >({});

  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  const enabledSteps = sortedSteps.filter((s) => s.enabled);
  const pendingReqCount = fieldRequests.filter(
    (r) => r.status === 'pending'
  ).length;

  const selectedField =
    globalFields.find((f) => f.id === selectedFieldId) ?? globalFields[0];

  const handleCreateStep = () => {
    setErrorMsg(null);
    if (!newStepTitle.trim() || !newStepKey.trim()) {
      setErrorMsg(tx("กรุณาระบุชื่อขั้นตอน (Step Title) และรหัสอ้างอิง (Step Key)"));
      return;
    }
    const cleanKey = newStepKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    if (steps.some((s) => s.key === cleanKey)) {
      setErrorMsg(txf("รหัสขั้นตอน \"{0}\" มีอยู่ในระบบแล้ว", cleanKey));
      return;
    }
    // แทรกก่อนขั้นตอนสุดท้าย (Review & Payment) เสมอ
    const nextOrder = Math.max(1, steps.length);
    onUpsertStep({
      id: `stp-${Date.now()}`,
      key: cleanKey,
      titleTh: newStepTitle.trim(),
      descriptionTh:
        newStepDesc.trim() || 'ขั้นตอนเพิ่มเติมที่กำหนดโดยผู้ดูแลแพลตฟอร์ม',
      order: nextOrder,
      enabled: true,
      isSystemLocked: false,
    });
    setNewStepTitle('');
    setNewStepKey('');
    setNewStepDesc('');
    setBannerMsg(txf("เพิ่มขั้นตอน \"{0}\" ในลำดับการสมัครเรียบร้อยแล้ว", newStepTitle.trim()));
  };

  const handleCreateLibraryField = () => {
    setErrorMsg(null);
    if (!newFieldLabel.trim() || !newFieldKey.trim()) {
      setErrorMsg(tx("กรุณาระบุป้ายชื่อฟิลด์ (Field Label) และ Unique Field Key"));
      return;
    }
    const combinedCheck = `${newFieldLabel} ${newFieldKey}`.toLowerCase();
    if (FORBIDDEN_FIELD_KEYWORDS.some((kw) => combinedCheck.includes(kw))) {
      setErrorMsg(
        tx("ไม่อนุญาตให้สร้างฟิลด์เก็บข้อมูลรหัสผ่าน เลขบัตรเครดิต CVV หรือความลับทางการเงินตามนโยบายความปลอดภัย (§7)")
      );
      return;
    }
    const cleanKey = newFieldKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    const newId = `cf_${cleanKey}`;
    if (
      globalFields.some((f) => f.fieldKey === cleanKey || f.id === newId)
    ) {
      setErrorMsg(txf("Field Key \"{0}\" ซ้ำกับฟิลด์ที่มีอยู่ในคลังกลางแล้ว", cleanKey));
      return;
    }
    const parsedOpts =
      newFieldType === 'select' ||
      newFieldType === 'radio' ||
      newFieldType === 'multiselect' ||
      newFieldType === 'image_choice'
        ? newFieldOptions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const fieldObj: GlobalFormFieldDef = {
      id: newId,
      fieldKey: cleanKey,
      label: newFieldLabel.trim(),
      type: newFieldType,
      stepKey: newFieldStepKey,
      required: newFieldRequired,
      isSensitive: newFieldSensitive,
      policy: newFieldPolicy,
      options: parsedOpts,
      categoryTag: 'custom_library',
    };
    onUpsertGlobalField(fieldObj);
    setSelectedFieldId(fieldObj.id);
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldOptions('');
    setBannerMsg(
      txf("เพิ่มฟิลด์ \"{0}\" ({1}) เข้าสู่ Global Field Library แล้ว", fieldObj.label, fieldObj.fieldKey)
    );
  };

  return (
    <div className="canvas-stack">
      <div className="page-guide-header">
        <h1>
          {tx("Registration Form Builder — ศูนย์จัดการขั้นตอนและฟอร์มรับสมัครกลาง (Platform Owner)")}
        </h1>
        <p className="page-purpose-desc">
          {tx("ควบคุมแม่แบบใบสมัคร (Templates), ลำดับขั้นตอนการสมัครของนักวิ่ง (Steps), คลังฟิลด์กลาง (Field Library), เงื่อนไขการแสดงผล (Conditional Logic), เวอร์ชันฟอร์ม และอนุมัติคำขอข้อมูลผู้สมัครจากผู้จัดงาน")}
        </p>
      </div>

      {/* Submodule Navigation Bar (7 Submodules) */}
      <nav
        className="clean-panel"
        aria-label={tx("เมนูย่อยของ Registration Form Builder")}
        style={{ padding: '0.65rem 0.9rem' }}
      >
        <div className="priority-pill-bar">
          {(
            [
              [
                'requests_permissions',
                `1. คำขอจากผู้จัด & สิทธิ์ (${pendingReqCount} รออนุมัติ)`,
              ],
              ['steps', `2. Step Management (${steps.length} ขั้นตอน)`],
              ['field_library', `3. Field Library (${globalFields.length} ฟิลด์)`],
              ['field_config', '4. Field Configuration & Preview'],
              [
                'conditional_logic',
                `5. Conditional Logic (${conditionalRules.length} กฎ)`,
              ],
              ['templates', `6. Form Templates (${templates.length} แม่แบบ)`],
              ['versions', '7. Form Version Management'],
              [
                'runner_profile_config',
                `8. Runner Profile & Shirt Sizes (${platformProfileConfig.shirtSizes.filter((s) => s.enabled).length} ไซส์)`,
              ],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`filter-pill ${subTab === key ? 'active' : ''}`}
              onClick={() => {
                setSubTab(key);
                setErrorMsg(null);
              }}
            >
              {tx(label)}
            </button>
          ))}
        </div>
      </nav>

      {bannerMsg && (
        <div className="success-callout" role="status">
          <IconCheckCircle size={18} />
          <div className="callout-flex">
            <span>{tx(bannerMsg)}</span>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => setBannerMsg(null)}
            >
              {tx("ปิดข้อความ")}
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="error-callout" role="alert">
          <IconAlert size={18} />
          <div className="callout-flex">
            <span>{tx(errorMsg)}</span>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => setErrorMsg(null)}
            >
              {tx("รับทราบ")}
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 1: ORGANIZER PERMISSIONS & FIELD REQUESTS QUEUE
         ===================================================================== */}
      {subTab === 'requests_permissions' && (
        <div className="canvas-stack">
          <section className="clean-panel">
            <div className="section-title-bar">
              <div>
                <h2>
                  {tx("คำขอเพิ่ม/ปรับฟิลด์ใบสมัครจากผู้จัดงาน (Organizer Field Requests · รออนุมัติ")}{' '}
                  <span className="mono-num">{tx(pendingReqCount)}</span> {tx(" รายการ)")}
                </h2>
                <p className="muted-block">
                  {tx("ผู้จัดงานไม่สามารถแก้โครงสร้างระบบเองโดยตรง แต่จะส่งคำขอว่าต้องการให้นักวิ่งกรอกข้อมูลใดบ้าง เมื่อ Platform Owner กดอนุมัติ ระบบจะสร้างฟิลด์เข้าคลังกลางและอัปเดตเวอร์ชันฟอร์มของงานนั้นทันที")}
                </p>
              </div>
            </div>

            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>{tx("รหัสคำขอ / งานวิ่ง")}</th>
                    <th>{tx("ข้อมูลที่ผู้จัดขอให้นักวิ่งกรอก")}</th>
                    <th>{tx("ชนิด Input / ขั้นตอนที่แสดง")}</th>
                    <th>{tx("เหตุผลของผู้จัด & เงื่อนไข")}</th>
                    <th>{tx("สถานะ")}</th>
                    <th>{tx("การอนุมัติและกำหนดสิทธิ์")}</th>
                  </tr>
                </thead>
                <tbody>
                  {fieldRequests.map((req) => {
                    const ev = events.find((e) => e.id === req.eventId);
                    const org = organizations.find(
                      (o) => o.id === req.organizationId
                    );
                    const pickedPolicy =
                      reqPolicyPick[req.id] ?? 'CONFIGURABLE';

                    return (
                      <tr key={req.id}>
                        <td>
                          <span className="mono-code">{tx(req.requestCode)}</span>
                          <div>
                            <strong>{ev?.titleTh ?? req.eventId}</strong>
                          </div>
                          <div className="muted-inline">
                            {tx(org?.nameTh)} {tx(" · โดย")} {tx(req.requestedByName)}
                          </div>
                        </td>
                        <td>
                          <strong>{tx(req.requestedLabelTh)}</strong>
                          <div className="mono-code">
                            key: {tx(req.requestedFieldKey)}
                          </div>
                          {req.options && req.options.length > 0 && (
                            <div className="muted-inline">
                              {tx("ตัวเลือก: ")} {req.options.join(', ')}
                            </div>
                          )}
                        </td>
                        <td>
                          <div>{tx(inputTypeLabels[req.inputType])}</div>
                          <div className="muted-inline">
                            Step: <span className="mono-code">{tx(req.targetStepKey)}</span>
                          </div>
                          <div className="cta-inline-row" style={{ marginTop: '0.25rem' }}>
                            {req.required && (
                              <span className="status-pill badge-amber">
                                {tx("บังคับกรอก")}
                              </span>
                            )}
                            {req.isSensitive && (
                              <span className="status-pill badge-navy">
                                {tx("ข้อมูลอ่อนไหว (PII)")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div>{tx(req.reasonNote)}</div>
                          {req.conditionHint && (
                            <div className="muted-inline">
                              {tx("เงื่อนไข: ")} {tx(req.conditionHint)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              req.status === 'approved'
                                ? 'badge-forest'
                                : req.status === 'rejected'
                                ? 'badge-danger'
                                : 'badge-amber'
                            }`}
                          >
                            <span>
                              {req.status === 'approved'
                                ? tx("อนุมัติและเปิดใช้แล้ว")
                                : req.status === 'rejected'
                                ? tx("ปฏิเสธคำขอ")
                                : tx("รอ Platform Owner อนุมัติ")}
                            </span>
                          </span>
                          {req.adminNote && (
                            <div className="muted-inline">{tx(req.adminNote)}</div>
                          )}
                        </td>
                        <td>
                          {req.status === 'pending' ? (
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                                minWidth: '15rem',
                              }}
                            >
                              <select
                                aria-label={txf("ระดับสิทธิ์ของ {0}", req.requestedLabelTh)}
                                value={pickedPolicy}
                                onChange={(e) =>
                                  setReqPolicyPick((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value as FormFieldPolicy,
                                  }))
                                }
                              >
                                <option value="CONFIGURABLE">
                                  {tx("สิทธิ์: CONFIGURABLE (แก้ป้าย/Required ได้)")}
                                </option>
                                <option value="CUSTOMIZABLE">
                                  {tx("สิทธิ์: CUSTOMIZABLE (ปรับตัวเลือกได้)")}
                                </option>
                                <option value="LOCKED">
                                  {tx("สิทธิ์: LOCKED (ห้ามผู้จัดแก้หลังอนุมัติ)")}
                                </option>
                              </select>
                              <input
                                type="text"
                                placeholder={tx("หมายเหตุแจ้งผู้จัด (ถ้ามี)")}
                                value={reqNotes[req.id] ?? ''}
                                onChange={(e) =>
                                  setReqNotes((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value,
                                  }))
                                }
                              />
                              <div className="cta-inline-row">
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() => {
                                    onResolveFieldRequest(
                                      req.id,
                                      'approved',
                                      pickedPolicy,
                                      reqNotes[req.id] ||
                                        'อนุมัติและเพิ่มเข้าสู่ฟอร์มรับสมัครของงานแล้ว'
                                    );
                                    setBannerMsg(
                                      txf("อนุมัติคำขอ \"{0}\" และเผยแพร่เข้าสู่ฟอร์มงานวิ่งเรียบร้อยแล้ว", req.requestedLabelTh)
                                    );
                                  }}
                                >
                                  {tx("อนุมัติ & สร้างฟิลด์")}
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() => {
                                    onResolveFieldRequest(
                                      req.id,
                                      'rejected',
                                      pickedPolicy,
                                      reqNotes[req.id] ||
                                        'ข้อมูลซ้ำซ้อนกับฟิลด์มาตรฐานที่มีอยู่แล้ว'
                                    );
                                    setBannerMsg(
                                      txf("ปฏิเสธคำขอ {0} เรียบร้อยแล้ว", req.requestCode)
                                    );
                                  }}
                                >
                                  {tx("ปฏิเสธ")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <span className="muted-inline">
                              {tx("ดำเนินการเมื่อ ")} {req.resolvedAt ?? tx("เมื่อสักครู่")}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Organizer Permission Policies Table */}
          <section className="clean-panel">
            <h2>
              {tx("ตารางควบคุมสิทธิ์ผู้จัดงานรายฟิลด์ (Organizer Field Permission Matrix: LOCKED / CONFIGURABLE / CUSTOMIZABLE)")}
            </h2>
            <p className="muted-block">
              {tx("กำหนดว่าฟิลด์ใดที่ระบบบังคับล็อกตายตัว (LOCKED), ฟิลด์ใดที่ผู้จัดปรับป้ายชื่อหรือความจำเป็นได้ (CONFIGURABLE), และฟิลด์ใดที่ผู้จัดปรับตัวเลือกหรือเปิด-ปิดเองได้ (CUSTOMIZABLE)")}
            </p>
            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Field Key</th>
                    <th>{tx("ชื่อฟิลด์ (Label)")}</th>
                    <th>{tx("ขั้นตอน (Step)")}</th>
                    <th>{tx("ชนิด Input")}</th>
                    <th>{tx("นโยบายสิทธิ์ของผู้จัด (Policy)")}</th>
                    <th>{tx("เปลี่ยนระดับสิทธิ์")}</th>
                  </tr>
                </thead>
                <tbody>
                  {globalFields.map((gf) => (
                    <tr key={gf.id}>
                      <td className="mono-code">{tx(gf.fieldKey)}</td>
                      <td>
                        <strong>{tx(gf.label)}</strong>
                        {gf.categoryTag === 'system' && (
                          <div className="muted-inline">
                            {tx("ฟิลด์แกนกลางของระบบ (System Field)")}
                          </div>
                        )}
                      </td>
                      <td className="mono-code">{tx(gf.stepKey)}</td>
                      <td>{tx(inputTypeLabels[gf.type])}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            gf.policy === 'LOCKED'
                              ? 'badge-navy'
                              : gf.policy === 'CONFIGURABLE'
                              ? 'badge-amber'
                              : 'badge-forest'
                          }`}
                        >
                          {gf.policy === 'LOCKED' && <IconLock size={13} />}
                          <span>{policyLabelTh(gf.policy)}</span>
                        </span>
                      </td>
                      <td>
                        {gf.categoryTag === 'system' ? (
                          <span className="muted-inline">
                            {tx("ล็อกถาวรตามกฎความปลอดภัย")}
                          </span>
                        ) : (
                          <select
                            aria-label={txf("เปลี่ยนสิทธิ์ของ {0}", gf.label)}
                            value={gf.policy}
                            onChange={(e) => {
                              onUpsertGlobalField({
                                ...gf,
                                policy: e.target.value as FormFieldPolicy,
                              });
                              setBannerMsg(
                                txf("อัปเดตสิทธิ์ของฟิลด์ \"{0}\" เป็น {1} แล้ว", gf.label, e.target.value)
                              );
                            }}
                          >
                            <option value="LOCKED">LOCKED</option>
                            <option value="CONFIGURABLE">CONFIGURABLE</option>
                            <option value="CUSTOMIZABLE">CUSTOMIZABLE</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 2: STEP MANAGEMENT (CREATE, REORDER, LOCK, PREVIEW)
         ===================================================================== */}
      {subTab === 'steps' && (
        <div className="canvas-stack">
          <div className="two-col-ops-grid">
            <section className="clean-panel">
              <h2>
                {tx("จัดการลำดับขั้นตอนการสมัครของนักวิ่ง (Step Management · Drag & Drop / จัดลำดับ)")}
              </h2>
              <p className="muted-block">
                {tx("ลากสลับลำดับหรือใช้ปุ่มเลื่อนขึ้น/ลงเพื่อจัดขั้นตอนการสมัครของนักวิ่ง ขั้นตอนที่ติดป้าย SYSTEM LOCKED (เช่น ตรวจสอบยืนยันและชำระเงิน) จะไม่สามารถปิดหรือลบได้ตามกฎแพลตฟอร์ม")}
              </p>

              <div className="checklist-rows">
                {sortedSteps.map((st, idx) => {
                  const stepFields = globalFields.filter(
                    (f) => f.stepKey === st.key
                  );
                  return (
                    <div
                      key={st.id}
                      className="checklist-row"
                      draggable={!st.isSystemLocked}
                      onDragStart={() => setDragStepId(st.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragStepId || dragStepId === st.id) return;
                        onReorderStep(dragStepId, 'up');
                        setDragStepId(null);
                      }}
                      style={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div className="cta-inline-row">
                          <span className="mono-code">Step {tx(st.order)}</span>
                          <strong>{tx(st.titleTh)}</strong>
                          <span className="mono-code">({tx(st.key)})</span>
                          {st.isSystemLocked ? (
                            <span className="status-pill badge-navy">
                              <IconLock size={13} />
                              <span>SYSTEM LOCKED</span>
                            </span>
                          ) : (
                            <span
                              className={`status-pill ${
                                st.enabled ? 'badge-forest' : 'badge-neutral'
                              }`}
                            >
                              <span>
                                {st.enabled ? tx("เปิดใช้งาน") : tx("ปิดซ่อนไว้")}
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="muted-inline" style={{ marginTop: '0.2rem' }}>
                          {tx(st.descriptionTh)} {tx(" · มีฟิลด์ในขั้นตอนนี้")}{' '}
                          <strong className="mono-num">{tx(stepFields.length)}</strong>{' '}
                          {tx("ฟิลด์")}
                        </p>
                      </div>

                      <div className="cta-inline-row">
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          disabled={idx === 0 || idx === sortedSteps.length - 1}
                          onClick={() => onReorderStep(st.id, 'up')}
                        >
                          {tx("เลื่อนขึ้น")}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          disabled={idx >= sortedSteps.length - 2}
                          onClick={() => onReorderStep(st.id, 'down')}
                        >
                          {tx("เลื่อนลง")}
                        </button>
                        {!st.isSystemLocked && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                onUpsertStep({ ...st, enabled: !st.enabled })
                              }
                            >
                              {st.enabled ? tx("ปิดขั้นตอนนี้") : tx("เปิดขั้นตอนนี้")}
                            </button>
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() => onDeleteStep(st.id)}
                            >
                              {tx("ลบ")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="custom-field-creator" style={{ marginTop: '1rem' }}>
                <h3>{tx("เพิ่มขั้นตอนการสมัครใหม่ (Create Registration Step)")}</h3>
                <div className="form-grid-2">
                  <div className="form-row">
                    <label htmlFor="stp-title">{tx("ชื่อขั้นตอน (Step Title)")}</label>
                    <input
                      id="stp-title"
                      type="text"
                      placeholder={tx("เช่น ข้อมูลการเดินทางและที่พักนักวิ่ง")}
                      value={newStepTitle}
                      onChange={(e) => setNewStepTitle(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label htmlFor="stp-key">{tx("รหัสอ้างอิง (Step Key ภาษาอังกฤษ)")}</label>
                    <input
                      id="stp-key"
                      type="text"
                      className="mono-code"
                      placeholder={tx("เช่น step_travel_logistics")}
                      value={newStepKey}
                      onChange={(e) => setNewStepKey(e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-row" style={{ marginTop: '0.5rem' }}>
                  <label htmlFor="stp-desc">{tx("คำอธิบายขั้นตอน")}</label>
                  <input
                    id="stp-desc"
                    type="text"
                    placeholder={tx("อธิบายสั้น ๆ ให้นักวิ่งทราบว่าขั้นตอนนี้ต้องกรอกอะไร")}
                    value={newStepDesc}
                    onChange={(e) => setNewStepDesc(e.target.value)}
                  />
                </div>
                <div className="cta-inline-row" style={{ marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleCreateStep}
                  >
                    <IconPlus size={15} />
                    <span>{tx("เพิ่มขั้นตอนเข้าสู่ระบบ")}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Interactive Registration Step Flow Preview */}
            <section className="clean-panel">
              <h2>{tx("ตัวอย่างลำดับขั้นตอนที่นักวิ่งจะเห็น (Interactive Flow Preview)")}</h2>
              <p className="muted-block">
                {tx("คลิกแต่ละขั้นตอนเพื่อดูว่านักวิ่งจะเห็นหัวข้อและฟิลด์ใดบ้างเมื่อเปิดหน้าสมัครวิ่ง")}
              </p>

              <div className="wizard-stepper" role="list">
                {enabledSteps.map((st, i) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`wizard-step-pill ${
                      previewStepIdx === i ? 'current' : ''
                    }`}
                    onClick={() => setPreviewStepIdx(i)}
                    style={{ cursor: 'pointer', textAlign: 'left' }}
                  >
                    <strong>
                      {tx("ขั้นที่ ")} {i + 1}: {tx(st.titleTh)}
                    </strong>
                  </button>
                ))}
              </div>

              {enabledSteps[previewStepIdx] && (
                <div
                  className="custom-field-creator"
                  style={{ marginTop: '0.85rem' }}
                >
                  <div className="cta-inline-row">
                    <span className="mono-code">
                      {tx(enabledSteps[previewStepIdx].key)}
                    </span>
                    <strong>{tx(enabledSteps[previewStepIdx].titleTh)}</strong>
                  </div>
                  <p className="muted-block">
                    {tx(enabledSteps[previewStepIdx].descriptionTh)}
                  </p>
                  <div className="custom-fields-list" style={{ marginTop: '0.6rem' }}>
                    {globalFields
                      .filter(
                        (f) => f.stepKey === enabledSteps[previewStepIdx].key
                      )
                      .map((f) => (
                        <div key={f.id} className="custom-field-item">
                          <div className="custom-field-meta">
                            <strong>{tx(f.label)}</strong>
                            <span className="mono-code">{tx(f.fieldKey)}</span>
                            <span className="muted-inline">
                              ({tx(inputTypeLabels[f.type])})
                            </span>
                            {f.required && (
                              <span className="status-pill badge-amber">
                                Required
                              </span>
                            )}
                          </div>
                          <span className="mono-code">{tx(f.policy)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 3: GLOBAL FIELD LIBRARY
         ===================================================================== */}
      {subTab === 'field_library' && (
        <div className="canvas-stack">
          <section className="clean-panel">
            <div className="section-title-bar">
              <div>
                <h2>
                  {tx("Global Field Library — คลังฟิลด์มาตรฐานและฟิลด์เฉพาะงานวิ่ง (")}{tx(globalFields.length)}{' '}
                  {tx("รายการ)")}
                </h2>
                <p className="muted-block">
                  {tx("คลังฟิลด์กลางที่รองรับ Input ครบทั้ง 15 ชนิด พร้อมฟิลด์เฉพาะงานวิ่ง (T-shirt Size, Race Distance, Running Experience, Running Club, Emergency Contact, Nationality, Food Preference, Transportation)")}
                </p>
              </div>
            </div>

            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Unique Key</th>
                    <th>Field Label</th>
                    <th>{tx("ชนิด Input")}</th>
                    <th>{tx("อยู่ในขั้นตอน (Step)")}</th>
                    <th>{tx("หมวดหมู่")}</th>
                    <th>{tx("สิทธิ์ผู้จัด")}</th>
                    <th>{tx("ตั้งค่าเชิงลึก")}</th>
                  </tr>
                </thead>
                <tbody>
                  {globalFields.map((f) => (
                    <tr key={f.id}>
                      <td className="mono-code">{tx(f.fieldKey)}</td>
                      <td>
                        <strong>{tx(f.label)}</strong>
                        {f.options && f.options.length > 0 && (
                          <div className="muted-inline">
                            {tx("ตัวเลือก: ")} {f.options.join(', ')}
                          </div>
                        )}
                      </td>
                      <td>{tx(inputTypeLabels[f.type])}</td>
                      <td className="mono-code">{tx(f.stepKey)}</td>
                      <td>
                        <span className="mono-code">{tx(f.categoryTag)}</span>
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            f.policy === 'LOCKED'
                              ? 'badge-navy'
                              : f.policy === 'CONFIGURABLE'
                              ? 'badge-amber'
                              : 'badge-forest'
                          }`}
                        >
                          <span>{tx(f.policy)}</span>
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setSelectedFieldId(f.id);
                            setSubTab('field_config');
                          }}
                        >
                          {tx("แก้ไข / Preview")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="custom-field-creator" style={{ marginTop: '1rem' }}>
              <h3>{tx("สร้างฟิลด์ใหม่เข้าสู่ Global Field Library")}</h3>
              <div className="form-grid-3">
                <div className="form-row">
                  <label htmlFor="lib-lbl">{tx("Field Label (ชื่อคำถาม)")}</label>
                  <input
                    id="lib-lbl"
                    type="text"
                    placeholder={tx("เช่น เบอร์เสื้อวิ่งที่ระลึก หรือ เป้าหมายเวลาจบ")}
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="lib-key">{tx("Unique Field Key (ภาษาอังกฤษ)")}</label>
                  <input
                    id="lib-key"
                    type="text"
                    className="mono-code"
                    placeholder={tx("เช่น target_finish_time")}
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="lib-type">{tx("ชนิด Input (Input Type)")}</label>
                  <select
                    id="lib-type"
                    value={newFieldType}
                    onChange={(e) =>
                      setNewFieldType(e.target.value as CustomFieldType)
                    }
                  >
                    {Object.entries(inputTypeLabels).map(([k, lbl]) => (
                      <option key={k} value={k}>
                        {tx(lbl)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3" style={{ marginTop: '0.6rem' }}>
                <div className="form-row">
                  <label htmlFor="lib-step">{tx("แสดงในขั้นตอน (Step)")}</label>
                  <select
                    id="lib-step"
                    value={newFieldStepKey}
                    onChange={(e) => setNewFieldStepKey(e.target.value)}
                  >
                    {sortedSteps
                      .filter((s) => s.key !== 'step_review_payment')
                      .map((s) => (
                        <option key={s.id} value={s.key}>
                          Step {tx(s.order)}: {tx(s.titleTh)}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="lib-pol">{tx("สิทธิ์การแก้ไขของผู้จัดงาน")}</label>
                  <select
                    id="lib-pol"
                    value={newFieldPolicy}
                    onChange={(e) =>
                      setNewFieldPolicy(e.target.value as FormFieldPolicy)
                    }
                  >
                    <option value="CONFIGURABLE">CONFIGURABLE</option>
                    <option value="CUSTOMIZABLE">CUSTOMIZABLE</option>
                    <option value="LOCKED">LOCKED</option>
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="lib-opts">
                    {tx("ตัวเลือก (คั่นด้วยจุลภาค , เมื่อใช้ Dropdown/Radio)")}
                  </label>
                  <input
                    id="lib-opts"
                    type="text"
                    placeholder={tx("เช่น รอบ 03:30, รอบ 04:00, เดินทางเอง")}
                    value={newFieldOptions}
                    onChange={(e) => setNewFieldOptions(e.target.value)}
                  />
                </div>
              </div>

              <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={newFieldRequired}
                    onChange={(e) => setNewFieldRequired(e.target.checked)}
                  />
                  <span>{tx("บังคับกรอก (Required)")}</span>
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={newFieldSensitive}
                    onChange={(e) => setNewFieldSensitive(e.target.checked)}
                  />
                  <span>{tx("เป็นข้อมูลส่วนบุคคลอ่อนไหว (ซ่อนจากเจ้าหน้าที่หน้างาน)")}</span>
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateLibraryField}
                >
                  <IconPlus size={15} />
                  <span>{tx("บันทึกเข้าสู่ Global Field Library")}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 4: FIELD CONFIGURATION EDITOR & LIVE INPUT PREVIEW
         ===================================================================== */}
      {subTab === 'field_config' && selectedField && (
        <div className="two-col-ops-grid">
          <section className="clean-panel">
            <h2>{tx("Field Configuration Editor — ตั้งค่าคุณสมบัติและกฎตรวจสอบ (Validation)")}</h2>
            <div className="form-row">
              <label htmlFor="fc-pick">{tx("เลือกฟิลด์ที่ต้องการปรับแต่ง")}</label>
              <select
                id="fc-pick"
                value={selectedField.id}
                onChange={(e) => setSelectedFieldId(e.target.value)}
              >
                {globalFields.map((gf) => (
                  <option key={gf.id} value={gf.id}>
                    [{tx(gf.fieldKey)}] {tx(gf.label)} ({tx(gf.policy)})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-grid-2" style={{ marginTop: '0.75rem' }}>
              <div className="form-row">
                <label htmlFor="fc-lbl">Field Label</label>
                <input
                  id="fc-lbl"
                  type="text"
                  value={selectedField.label}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      label: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="fc-ph">Placeholder</label>
                <input
                  id="fc-ph"
                  type="text"
                  value={selectedField.placeholderTh ?? ''}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      placeholderTh: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: '0.6rem' }}>
              <label htmlFor="fc-desc">{tx("คำอธิบายช่วยเหลือผู้สมัคร (Description)")}</label>
              <input
                id="fc-desc"
                type="text"
                value={selectedField.descriptionTh ?? ''}
                onChange={(e) =>
                  onUpsertGlobalField({
                    ...selectedField,
                    descriptionTh: e.target.value,
                  })
                }
              />
            </div>

            <div className="form-grid-3" style={{ marginTop: '0.6rem' }}>
              <div className="form-row">
                <label htmlFor="fc-min">{tx("ความยาวขั้นต่ำ (Min Length)")}</label>
                <input
                  id="fc-min"
                  type="number"
                  className="mono-num"
                  value={selectedField.minLength ?? 0}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      minLength: Number(e.target.value) || undefined,
                    })
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="fc-max">{tx("ความยาวสูงสุด (Max Length)")}</label>
                <input
                  id="fc-max"
                  type="number"
                  className="mono-num"
                  value={selectedField.maxLength ?? 200}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      maxLength: Number(e.target.value) || undefined,
                    })
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="fc-def">{tx("ค่าเริ่มต้น (Default Value)")}</label>
                <input
                  id="fc-def"
                  type="text"
                  value={selectedField.defaultValue ?? ''}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      defaultValue: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="form-row" style={{ marginTop: '0.6rem' }}>
              <label htmlFor="fc-valmsg">
                {tx("ข้อความแจ้งเตือนเมื่อกรอกไม่ผ่านเกณฑ์ (Validation Error Message)")}
              </label>
              <input
                id="fc-valmsg"
                type="text"
                placeholder={tx("เช่น กรุณาระบุข้อมูลในช่องนี้ให้ครบถ้วนก่อนไปขั้นตอนถัดไป")}
                value={selectedField.validationMessageTh ?? ''}
                onChange={(e) =>
                  onUpsertGlobalField({
                    ...selectedField,
                    validationMessageTh: e.target.value,
                  })
                }
              />
            </div>

            <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  disabled={selectedField.categoryTag === 'system'}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      required: e.target.checked,
                    })
                  }
                />
                <span>{tx("บังคับกรอก (Required)")}</span>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedField.isSensitive}
                  onChange={(e) =>
                    onUpsertGlobalField({
                      ...selectedField,
                      isSensitive: e.target.checked,
                    })
                  }
                />
                <span>{tx("ซ่อนจากจุดรับอุปกรณ์ (PII Protection)")}</span>
              </label>
            </div>
          </section>

          {/* Live Input Preview */}
          <section className="clean-panel">
            <h2>{tx("Live Field Preview — ตัวอย่างการแสดงผลที่หน้านักวิ่ง")}</h2>
            <div className="custom-field-creator">
              <div className="form-row">
                <label htmlFor="live-prev-input">
                  {tx(selectedField.label)}{' '}
                  {selectedField.required ? <RequiredFieldText text="*" /> : tx("(ไม่บังคับ)")}
                </label>
                {selectedField.descriptionTh && (
                  <span className="muted-inline">
                    {tx(selectedField.descriptionTh)}
                  </span>
                )}

                {selectedField.type === 'select' ||
                selectedField.type === 'size_selector' ||
                selectedField.type === 'distance_selector' ? (
                  <select
                    id="live-prev-input"
                    defaultValue={selectedField.defaultValue ?? ''}
                  >
                    <option value="">{tx("-- เลือกคำตอบ --")}</option>
                    {(selectedField.options ?? ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2']).map(
                      (opt) => (
                        <option key={opt} value={opt}>
                          {tx(opt)}
                        </option>
                      )
                    )}
                  </select>
                ) : selectedField.type === 'textarea' ? (
                  <textarea
                    id="live-prev-input"
                    rows={3}
                    placeholder={selectedField.placeholderTh ?? tx("พิมพ์คำตอบ...")}
                  />
                ) : selectedField.type === 'radio' ? (
                  <div className="cta-inline-row">
                    {(selectedField.options ?? ['ใช่', 'ไม่ใช่']).map((opt) => (
                      <label key={opt} className="checkbox-row">
                        <input type="radio" name="prev-rad" />
                        <span>{tx(opt)}</span>
                      </label>
                    ))}
                  </div>
                ) : selectedField.type === 'checkbox' ? (
                  <label className="checkbox-row">
                    <input id="live-prev-input" type="checkbox" />
                    <span>{tx("ยืนยัน")} {tx(selectedField.label)}</span>
                  </label>
                ) : (
                  <input
                    id="live-prev-input"
                    type="text"
                    placeholder={selectedField.placeholderTh ?? ''}
                    defaultValue={selectedField.defaultValue ?? ''}
                  />
                )}
              </div>

              <div className="muted-inline" style={{ marginTop: '0.65rem' }}>
                Key: <span className="mono-code">{tx(selectedField.fieldKey)}</span> ·
                Step: <span className="mono-code">{tx(selectedField.stepKey)}</span> ·
                Policy: <span className="mono-code">{tx(selectedField.policy)}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 5: CONDITIONAL LOGIC BUILDER
         ===================================================================== */}
      {subTab === 'conditional_logic' && (
        <div className="canvas-stack">
          <section className="clean-panel">
            <h2>
              {tx("Visual Conditional Logic Builder — เงื่อนไขการแสดงผลฟิลด์และขั้นตอนอัตโนมัติ")}
            </h2>
            <p className="muted-block">
              {tx("กำหนดกฎการแสดงผลแบบมีเงื่อนไข เช่น ถ้านักวิ่งเลือกระยะ 21.1 km จึงแสดงคำถามประสบการณ์วิ่งระยะไกล หรือถ้าเลือก &ldquo;มีโรคประจำตัวหรือแพ้ยา&rdquo; จึงแสดงช่องกรอกรายละเอียดทางการแพทย์")}
            </p>

            <div className="checklist-rows">
              {conditionalRules.map((rule) => (
                <div
                  key={rule.id}
                  className="checklist-row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <div>
                    <span className="mono-code">
                      IF {tx(rule.sourceFieldKey)} {rule.operator.toUpperCase()} &ldquo;
                      {tx(rule.value)}&rdquo; &rarr; SHOW {rule.targetType.toUpperCase()}{' '}
                      [{tx(rule.targetKey)}]
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => onDeleteConditionalRule(rule.id)}
                  >
                    {tx("ลบกฎนี้")}
                  </button>
                </div>
              ))}
            </div>

            <div className="custom-field-creator" style={{ marginTop: '1rem' }}>
              <h3>{tx("สร้างกฎเงื่อนไขใหม่ (IF ... THEN SHOW ...)")}</h3>
              <div className="form-grid-3">
                <div className="form-row">
                  <label htmlFor="cnd-src">{tx("IF ฟิลด์ต้นทาง (Source Field)")}</label>
                  <select
                    id="cnd-src"
                    value={condSourceKey}
                    onChange={(e) => setCondSourceKey(e.target.value)}
                  >
                    <option value="race_distance">
                      {tx("race_distance (ระยะทางแข่งขัน)")}
                    </option>
                    <option value="shirt_size">{tx("shirt_size (ไซส์เสื้อ)")}</option>
                    {globalFields.map((gf) => (
                      <option key={gf.id} value={gf.id}>
                        {tx(gf.id)} ({tx(gf.label)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="cnd-op">{tx("ตัวดำเนินการ (Operator)")}</label>
                  <select
                    id="cnd-op"
                    value={condOperator}
                    onChange={(e) =>
                      setCondOperator(
                        e.target.value as 'equals' | 'not_equals' | 'contains'
                      )
                    }
                  >
                    <option value="equals">{tx("เท่ากับ (=)")}</option>
                    <option value="not_equals">{tx("ไม่เท่ากับ (!=)")}</option>
                    <option value="contains">{tx("มีคำว่า (CONTAINS)")}</option>
                  </select>
                </div>

                <div className="form-row">
                  <label htmlFor="cnd-val">{tx("ค่าที่เปรียบเทียบ (Value)")}</label>
                  <input
                    id="cnd-val"
                    type="text"
                    placeholder={tx("เช่น 21.1 km หรือ มีโรคประจำตัวหรือแพ้ยา")}
                    value={condValue}
                    onChange={(e) => setCondValue(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                <div className="form-row">
                  <label htmlFor="cnd-ttype">{tx("THEN SHOW ประเภทเป้าหมาย")}</label>
                  <select
                    id="cnd-ttype"
                    value={condTargetType}
                    onChange={(e) =>
                      setCondTargetType(e.target.value as 'field' | 'step')
                    }
                  >
                    <option value="field">{tx("แสดงฟิลด์ (Field)")}</option>
                    <option value="step">{tx("แสดงขั้นตอน (Step)")}</option>
                  </select>
                </div>
                <div className="form-row">
                  <label htmlFor="cnd-tkey">{tx("ฟิลด์หรือขั้นตอนที่ต้องการให้แสดง")}</label>
                  <select
                    id="cnd-tkey"
                    value={condTargetKey}
                    onChange={(e) => setCondTargetKey(e.target.value)}
                  >
                    {condTargetType === 'field'
                      ? globalFields
                          .filter((f) => f.categoryTag !== 'system')
                          .map((f) => (
                            <option key={f.id} value={f.id}>
                              [{tx(f.id)}] {tx(f.label)}
                            </option>
                          ))
                      : sortedSteps
                          .filter((s) => !s.isSystemLocked)
                          .map((s) => (
                            <option key={s.id} value={s.key}>
                              [{tx(s.key)}] {tx(s.titleTh)}
                            </option>
                          ))}
                  </select>
                </div>
              </div>

              <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    if (condSourceKey === condTargetKey) {
                      setErrorMsg(
                        tx("ตรวจพบ Circular Dependency: ฟิลด์ต้นทางและฟิลด์ปลายทางต้องไม่เป็นฟิลด์เดียวกัน")
                      );
                      return;
                    }
                    onAddConditionalRule({
                      id: `cnd-${Date.now()}`,
                      sourceFieldKey: condSourceKey,
                      operator: condOperator,
                      value: condValue.trim(),
                      targetType: condTargetType,
                      targetKey: condTargetKey,
                    });
                    setBannerMsg(tx("เพิ่มกฎเงื่อนไข Conditional Logic เรียบร้อยแล้ว"));
                  }}
                >
                  <IconPlus size={15} />
                  <span>{tx("ตรวจ Dependency และบันทึกกฎเงื่อนไข")}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 6: FORM TEMPLATES MANAGEMENT
         ===================================================================== */}
      {subTab === 'templates' && (
        <div className="canvas-stack">
          <section className="clean-panel">
            <h2>
              {tx("Form Templates — แม่แบบฟอร์มรับสมัครมาตรฐาน (Fun Run / Mini / Half / Marathon / Custom)")}
            </h2>
            <p className="muted-block">
              {tx("ผู้จัดงานสามารถเลือกแม่แบบที่เผยแพร่แล้ว (Published) ไปใช้ตั้งต้นกับงานวิ่งของตนได้โดยไม่กระทบแม่แบบกลางของระบบ")}
            </p>

            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>{tx("รหัส / ชื่อแม่แบบ")}</th>
                    <th>{tx("เวอร์ชันปัจจุบัน")}</th>
                    <th>{tx("สถานะ")}</th>
                    <th>{tx("จำนวนขั้นตอน / ฟิลด์")}</th>
                    <th>{tx("อัปเดตล่าสุด")}</th>
                    <th>{tx("การจัดการ")}</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((tpl) => (
                    <tr key={tpl.id}>
                      <td>
                        <span className="mono-code">{tx(tpl.code)}</span>
                        <div>
                          <strong>{tx(tpl.nameTh)}</strong>
                        </div>
                        <div className="muted-inline">{tx(tpl.descriptionTh)}</div>
                      </td>
                      <td className="mono-code">{tx(tpl.versionLabel)}</td>
                      <td>
                        <span
                          className={`status-pill ${
                            tpl.status === 'published'
                              ? 'badge-forest'
                              : 'badge-amber'
                          }`}
                        >
                          <span>
                            {tpl.status === 'published'
                              ? tx("Published (พร้อมใช้)")
                              : tx("Draft (ฉบับร่าง)")}
                          </span>
                        </span>
                      </td>
                      <td className="mono-num">
                        {tx(tpl.steps.length)} Steps · {tx(tpl.fieldIds.length)} {tx(" ฟิลด์เสริม")}
                      </td>
                      <td className="mono-num">{tx(tpl.updatedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onPublishTemplateVersion(
                              tpl.id,
                              'อัปเดตชุดฟิลด์และเผยแพร่เวอร์ชันแม่แบบใหม่โดย Platform Owner'
                            );
                            setBannerMsg(
                              txf("เผยแพร่เวอร์ชันใหม่ของแม่แบบ \"{0}\" เรียบร้อยแล้ว", tpl.nameTh)
                            );
                          }}
                        >
                          {tx("Publish เวอร์ชันใหม่")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="custom-field-creator" style={{ marginTop: '1rem' }}>
              <h3>{tx("สร้างแม่แบบฟอร์มรับสมัครใหม่ (Create Form Template)")}</h3>
              <div className="form-grid-3">
                <div className="form-row">
                  <label htmlFor="nt-name">{tx("ชื่อแม่แบบ")}</label>
                  <input
                    id="nt-name"
                    type="text"
                    placeholder={tx("เช่น Ultra Trail 100K Template")}
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="nt-code">{tx("รหัสแม่แบบ")}</label>
                  <input
                    id="nt-code"
                    type="text"
                    className="mono-code"
                    placeholder={tx("เช่น TPL-ULTRA-100K")}
                    value={tplCode}
                    onChange={(e) => setTplCode(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="nt-desc">{tx("คำอธิบาย")}</label>
                  <input
                    id="nt-desc"
                    type="text"
                    placeholder={tx("ระบุกลุ่มงานวิ่งที่เหมาะกับแม่แบบนี้")}
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="cta-inline-row" style={{ marginTop: '0.65rem' }}>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!tplName.trim() || !tplCode.trim()}
                  onClick={() => {
                    onCreateTemplate(
                      tplName.trim(),
                      tplCode.trim().toUpperCase(),
                      tplDesc.trim() || 'แม่แบบที่สร้างโดย Platform Owner'
                    );
                    setTplName('');
                    setTplCode('');
                    setTplDesc('');
                    setBannerMsg(tx("สร้างแม่แบบฟอร์มรับสมัครใหม่เรียบร้อยแล้ว"));
                  }}
                >
                  <IconPlus size={15} />
                  <span>{tx("สร้างและเผยแพร่แม่แบบ")}</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =====================================================================
          SUBMODULE 7: FORM VERSION MANAGEMENT (IMMUTABLE VERSIONS)
         ===================================================================== */}
      {subTab === 'versions' && (
        <div className="canvas-stack">
          <section className="clean-panel">
            <h2>
              {tx("Form Version Management — ประวัติเวอร์ชันฟอร์มแบบไม่แก้ไขย้อนหลัง (Immutable Versions)")}
            </h2>
            <p className="muted-block">
              {tx("ทุกใบสมัครของนักวิ่งจะถูกผูกไว้กับเลขเวอร์ชันของฟอร์ม ณ เวลาที่กดส่งใบสมัคร (formVersionUsed) เมื่อมีการเพิ่มฟิลด์หรืออนุมัติคำขอใหม่ ระบบจะออกเลขเวอร์ชันใหม่โดยไม่ทำลายคำตอบของผู้สมัครเดิม")}
            </p>

            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>{tx("งานวิ่ง")}</th>
                    <th>{tx("แม่แบบที่ใช้อ้างอิง")}</th>
                    <th>{tx("เวอร์ชันฟอร์มที่เปิดใช้ (Published)")}</th>
                    <th>{tx("จำนวนฟิลด์ในเวอร์ชันปัจจุบัน")}</th>
                    <th>{tx("จำนวนใบสมัครที่ผูกกับฟอร์มงานนี้")}</th>
                    <th>{tx("การรับประกันข้อมูลเดิม")}</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => {
                    const tpl = templates.find(
                      (t) => t.id === (ev.activeTemplateId ?? 'tpl-halfmarathon')
                    );
                    const evRegCount = registrations.filter(
                      (r) => r.eventId === ev.id
                    ).length;

                    return (
                      <tr key={ev.id}>
                        <td>
                          <strong>{tx(ev.titleTh)}</strong>
                          <div className="mono-code">{tx(ev.code)}</div>
                        </td>
                        <td>{tpl?.nameTh ?? 'Half Marathon Template'}</td>
                        <td>
                          <span className="status-pill badge-forest">
                            <span className="mono-code">
                              {ev.publishedFormVersion ?? 'v1.0-published'}
                            </span>
                          </span>
                        </td>
                        <td className="mono-num">
                          {tx((ev.customFields ?? []).length)} {tx(" ฟิลด์เสริม + 4 ฟิลด์ระบบ")}
                        </td>
                        <td className="mono-num">{tx(evRegCount)} {tx(" ใบสมัคร")}</td>
                        <td>
                          <span className="status-pill badge-navy">
                            <IconShield size={13} />
                            <span>{tx("Immutable Snapshot (ไม่ลบคำตอบเดิม)")}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ================= SUBMODULE 8: RUNNER PROFILE & SHIRT SIZE GOVERNANCE ================= */}
      {subTab === 'runner_profile_config' && (
        <div className="canvas-stack">
          <section className="clean-panel canvas-stack">
            <div className="section-title-bar">
              <div>
                <h2>
                  {tx(
                    'จัดการตัวเลือกไซส์เสื้อกลางและตารางไซส์ตามทรงเสื้อ (Platform Shirt Sizes & Size Charts)'
                  )}
                </h2>
                <p className="muted-block">
                  {tx(
                    'เพิ่ม แก้ไข หรือเปิด/ปิดไซส์เสื้อมาตรฐาน (XS–5XL) พร้อมกำหนดขนาดรอบอกและความยาวแยกตาม Unisex, Men และ Women สำหรับใช้ใน Runner Profile และเป็นค่าเริ่มต้นของทุกงานวิ่ง'
                  )}
                </p>
              </div>
              <div className="priority-pill-bar">
                {(['Unisex', 'Men', 'Women'] as ShirtCutType[]).map((cut) => (
                  <button
                    key={cut}
                    type="button"
                    className={`filter-pill ${chartCutEdit === cut ? 'active' : ''}`}
                    onClick={() => setChartCutEdit(cut)}
                  >
                    {tx('ตารางทรง')} {cut}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>{tx('รหัสไซส์')}</th>
                    <th>{tx('สถานะใน Runner Profile')}</th>
                    <th>{tx(`รอบอก (${chartCutEdit})`)}</th>
                    <th>{tx(`ความยาวเสื้อ (${chartCutEdit})`)}</th>
                    <th>{tx('การจัดการ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {platformProfileConfig.shirtSizes
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((sz) => {
                      const spec = sz.chartByType[chartCutEdit];
                      return (
                        <tr key={sz.code}>
                          <td>
                            <strong className="mono-code">{sz.code}</strong>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                sz.enabled ? 'badge-forest' : 'badge-neutral'
                              }`}
                            >
                              {sz.enabled ? tx('เปิดใช้งาน') : tx('ปิดใช้งาน')}
                            </span>
                          </td>
                          <td>
                            <input
                              type="text"
                              aria-label={`${sz.code} chest`}
                              value={spec.chestInch}
                              onChange={(e) => {
                                if (!onUpdatePlatformProfileConfig) return;
                                const nextSizes =
                                  platformProfileConfig.shirtSizes.map((item) =>
                                    item.code === sz.code
                                      ? {
                                          ...item,
                                          chartByType: {
                                            ...item.chartByType,
                                            [chartCutEdit]: {
                                              ...item.chartByType[chartCutEdit],
                                              chestInch: e.target.value,
                                            },
                                          },
                                        }
                                      : item
                                  );
                                onUpdatePlatformProfileConfig({
                                  ...platformProfileConfig,
                                  shirtSizes: nextSizes,
                                });
                              }}
                            />
                          </td>
                          <td>
                            <input
                              type="text"
                              aria-label={`${sz.code} length`}
                              value={spec.lengthInch}
                              onChange={(e) => {
                                if (!onUpdatePlatformProfileConfig) return;
                                const nextSizes =
                                  platformProfileConfig.shirtSizes.map((item) =>
                                    item.code === sz.code
                                      ? {
                                          ...item,
                                          chartByType: {
                                            ...item.chartByType,
                                            [chartCutEdit]: {
                                              ...item.chartByType[chartCutEdit],
                                              lengthInch: e.target.value,
                                            },
                                          },
                                        }
                                      : item
                                  );
                                onUpdatePlatformProfileConfig({
                                  ...platformProfileConfig,
                                  shirtSizes: nextSizes,
                                });
                              }}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              onClick={() => {
                                if (!onUpdatePlatformProfileConfig) return;
                                const nextSizes =
                                  platformProfileConfig.shirtSizes.map((item) =>
                                    item.code === sz.code
                                      ? { ...item, enabled: !item.enabled }
                                      : item
                                  );
                                onUpdatePlatformProfileConfig({
                                  ...platformProfileConfig,
                                  shirtSizes: nextSizes,
                                });
                                setBannerMsg(
                                  txf(
                                    'อัปเดตสถานะไซส์เสื้อ {0} เรียบร้อยแล้ว',
                                    sz.code
                                  )
                                );
                              }}
                            >
                              {sz.enabled ? tx('ปิดใช้งาน') : tx('เปิดใช้งาน')}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="custom-field-creator canvas-stack">
              <strong>{tx('เพิ่มตัวเลือกไซส์เสื้อใหม่ในระบบกลาง')}</strong>
              <div className="form-grid-3">
                <div className="form-row">
                  <label htmlFor="plat-new-sz">{tx('รหัสไซส์ (เช่น 6XL / KIDS-M)')}</label>
                  <input
                    id="plat-new-sz"
                    type="text"
                    className="mono-code"
                    value={newSizeCode}
                    onChange={(e) => setNewSizeCode(e.target.value.toUpperCase())}
                    placeholder="6XL"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="plat-new-ch">{tx('รอบอกมาตรฐาน')}</label>
                  <input
                    id="plat-new-ch"
                    type="text"
                    value={newSizeChest}
                    onChange={(e) => setNewSizeChest(e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="plat-new-ln">{tx('ความยาวมาตรฐาน')}</label>
                  <input
                    id="plat-new-ln"
                    type="text"
                    value={newSizeLength}
                    onChange={(e) => setNewSizeLength(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const code = newSizeCode.trim().toUpperCase();
                    if (!code || !onUpdatePlatformProfileConfig) return;
                    if (
                      platformProfileConfig.shirtSizes.some(
                        (s) => s.code.toUpperCase() === code
                      )
                    ) {
                      setErrorMsg(tx('มีรหัสไซส์นี้อยู่ในระบบแล้ว'));
                      return;
                    }
                    const baseSpec = {
                      chestInch: newSizeChest.trim() || '54 นิ้ว',
                      lengthInch: newSizeLength.trim() || '33.5 นิ้ว',
                    };
                    onUpdatePlatformProfileConfig({
                      ...platformProfileConfig,
                      shirtSizes: [
                        ...platformProfileConfig.shirtSizes,
                        {
                          code,
                          label: code,
                          sortOrder:
                            platformProfileConfig.shirtSizes.length + 1,
                          enabled: true,
                          chartByType: {
                            Unisex: baseSpec,
                            Men: baseSpec,
                            Women: baseSpec,
                          },
                        },
                      ],
                    });
                    setNewSizeCode('');
                    setErrorMsg(null);
                    setBannerMsg(
                      txf('เพิ่มตัวเลือกไซส์เสื้อ {0} สำเร็จ', code)
                    );
                  }}
                >
                  <IconPlus size={14} />
                  <span>{tx('เพิ่มตัวเลือกไซส์เสื้อ')}</span>
                </button>
              </div>
            </div>
          </section>

          <section className="clean-panel canvas-stack">
            <h2>
              {tx(
                'เกณฑ์ความสมบูรณ์ของโปรไฟล์นักวิ่ง (Required Sections for Profile Completion)'
              )}
            </h2>
            <p className="muted-block">
              {tx(
                'กำหนดว่าหมวดข้อมูลใดใน Runner Profile ที่นำมาคำนวณเป็นเปอร์เซ็นต์ความครบถ้วน (Profile Completion %) เพื่อเตรียมข้อมูลสมัครงานวิ่งอัตโนมัติ'
              )}
            </p>
            <div className="form-grid-2">
              {(
                [
                  ['personal', 'ข้อมูลส่วนตัวพื้นฐาน (Personal Information)'],
                  ['contact', 'อีเมลและเบอร์โทรที่ยืนยันแล้ว (Contact Verification)'],
                  ['running_prefs', 'ไซส์เสื้อและระยะวิ่งที่ชอบ (Running Preferences)'],
                  ['emergency', 'ผู้ติดต่อกรณีฉุกเฉินหลัก (Primary Emergency Contact)'],
                  ['address', 'ที่อยู่จัดส่งอุปกรณ์เริ่มต้น (Default Address)'],
                ] as [ProfileCompletionSectionKey, string][]
              ).map(([secKey, label]) => {
                const checked =
                  platformProfileConfig.requiredProfileSections.includes(secKey);
                return (
                  <label key={secKey} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        if (!onUpdatePlatformProfileConfig) return;
                        const cur =
                          platformProfileConfig.requiredProfileSections;
                        const nextSecs = checked
                          ? cur.filter((k) => k !== secKey)
                          : [...cur, secKey];
                        if (nextSecs.length === 0) return;
                        onUpdatePlatformProfileConfig({
                          ...platformProfileConfig,
                          requiredProfileSections: nextSecs,
                        });
                        setBannerMsg(
                          tx('อัปเดตเกณฑ์คำนวณความสมบูรณ์ของ Runner Profile แล้ว')
                        );
                      }}
                    />
                    <span>{tx(label)}</span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
