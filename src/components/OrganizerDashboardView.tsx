import { RequiredFieldText } from './RequiredFieldText';
import React, { useMemo, useState } from 'react';
import {
  AuditLogEntry,
  CustomFieldType,
  CustomRegistrationField,
  EventStatus,
  FeeBearerPolicy,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizerFieldRequest,
  OrgRole,
  PayoutBatch,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStatus,
  RegistrationStepDef,
  SellerServiceModel,
  ShirtSizeCode,
  SimulatedUiState,
  TeamInvitation,
  TimeWindowFilter,
  UserAccount,
} from '../types';
import {
  DEFAULT_PLATFORM_PROFILE_CONFIG,
  resolveShirtSpec,
} from '../data/runnerProfileDefaults';
import {
  calculateFeeQuote,
  computeMetrics,
  feePolicyLabel,
  formatThb,
  getCurrentTier,
  isWithinTimeWindow,
  sellerModelLabel,
} from '../utils/pricing';
import { BibLedgerStrip } from './BibLedgerStrip';
import { EventMediaManager, EventMediaPatch } from './EventMediaManager';
import { OrganizerAnalyticsCharts } from './OrganizerAnalyticsCharts';
import { CategoryAgeRulesPanel } from './CategoryAgeRulesPanel';
import { formatAgeGroupLabel, type AgeConfigValid } from '../utils/age';
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconBag,
  IconBib,
  IconBuilding,
  IconCheckCircle,
  IconClock,
  IconCopy,
  IconDownload,
  IconFlag,
  IconLedger,
  IconLock,
  IconPlus,
  IconQr,
  IconSearch,
  IconShield,
  IconShirt,
  IconUsers,
} from './Icons';
import {
  EventStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  PayoutStatusBadge,
  RefundStatusBadge,
  RegStatusBadge,
} from './StatusBadges';
import { validateQuotaUpdate } from '../utils/eventConfig';

import { tx, txf } from '../i18n';
export type OrgSection =
  | 'org_overview'
  | 'org_events'
  | 'org_merch_production'
  | 'org_finance'
  | 'org_team_settings'
  | 'evt_overview'
  | 'evt_pricing_quota'
  | 'evt_participants'
  | 'evt_storefront'
  | 'evt_finance'
  | 'evt_checkin_bib';

interface OrganizerDashboardViewProps {
  currentUser: UserAccount;
  organizations: Organization[];
  invitations: TeamInvitation[];
  activeOrgId: string;
  activeEventId: string | null;
  activeSection: OrgSection;
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  productionInquiries: ProductionInquiry[];
  payouts: PayoutBatch[];
  auditLogs: AuditLogEntry[];
  simulatedState: SimulatedUiState;
  onClearSimulatedState: () => void;
  onSelectOrg: (orgId: string) => void;
  onSelectEvent: (eventId: string | null, targetSection?: OrgSection) => void;
  onSelectSection: (section: OrgSection) => void;
  onCreateDraftEvent: (payload: {
    orgId: string;
    titleTh: string;
    province: string;
    eventDate: string;
    requestProductionHelp: boolean;
  }) => void;
  onDuplicateEventWithoutPii: (eventId: string) => void;
  onCompleteDraftReadinessAndSubmit: (eventId: string) => void;
  onUpdateFeeBearerPolicy: (eventId: string, policy: FeeBearerPolicy) => void;
  onAddEventProduct: (payload: {
    eventId: string;
    nameTh: string;
    categoryLabel: 'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม';
    saleMode: 'ready_stock' | 'preorder';
    serviceModel: SellerServiceModel;
    priceBaht: number;
    stockOrCeiling: number;
  }) => void;
  onCreateEventProductionQuote: (payload: {
    orgId: string;
    eventId?: string;
    itemType: ProductionInquiry['itemType'];
    packageQty: number;
    addonQty: number;
    bufferQty: number;
    existingStockQty: number;
    targetDeliveryDate: string;
  }) => void;
  onAssignBibNumber: (
    regId: string,
    bibNumber: string
  ) => { ok: boolean; error?: string };
  onConfirmKitPickup: (regId: string) => { ok: boolean; error?: string };
  onConfirmMerchHandover: (
    merchOrderId: string,
    handoverMode: 'partial_one' | 'complete_all'
  ) => { ok: boolean; message: string };
  onResolveRefundRequest: (
    regId: string,
    decision: 'approve_succeed' | 'reject',
    note: string
  ) => void;
  onCreateSingleUseInvite: (orgId: string, role: OrgRole) => TeamInvitation;
  onOpenPublicPreview: (eventId?: string) => void;
  onUpdateEventTotalQuota: (eventId: string, newTotalQuota: number) => void;
  onUpdateCategoryQuota: (eventId: string, categoryId: string, newCategoryQuota: number) => void;
  onUpdateCategoryAgeRules: (
    eventId: string,
    categoryId: string,
    config: AgeConfigValid
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateCustomFields: (eventId: string, nextFields: CustomRegistrationField[]) => void;
  formTemplates?: FormTemplate[];
  registrationSteps?: RegistrationStepDef[];
  globalFields?: GlobalFormFieldDef[];
  fieldRequests?: OrganizerFieldRequest[];
  onSelectEventTemplate?: (eventId: string, templateId: string) => void;
  onUpdateEventMedia?: (eventId: string, patch: EventMediaPatch) => void;
  platformProfileConfig?: PlatformProfileConfig;
  onUpdateEventShirtConfig?: (
    eventId: string,
    patch: {
      shirtStocks?: RaceEvent['shirtStocks'];
      customSizeChart?: RaceEvent['customSizeChart'];
    }
  ) => void;
  onSubmitOrganizerFieldRequest?: (
    payload: Omit<
      OrganizerFieldRequest,
      'id' | 'requestCode' | 'status' | 'createdAt'
    >
  ) => void;
}

const roleNameMap: Record<OrgRole, string> = {
  owner: 'เจ้าขององค์กร (ดูแลครบทุกส่วน)',
  event_manager: 'ผู้จัดการงาน (ดูแลเฉพาะงานที่มอบหมาย)',
  finance: 'ฝ่ายการเงิน (ตรวจยอดและอนุมัติคืนเงิน)',
  staff: 'เจ้าหน้าที่หน้างาน (เช็กอิน BIB และจ่ายสินค้า)',
};

export function QuotaEditorRow({
  categoryName,
  maxQuota,
  registeredCount,
  reservedCount,
  canEdit,
  compact = false,
  onSaveQuota,
}: {
  categoryName: string;
  maxQuota: number;
  registeredCount: number;
  reservedCount: number;
  canEdit: boolean;
  compact?: boolean;
  onSaveQuota: (nextQuota: number) => void;
}) {
  const [draftQuota, setDraftQuota] = useState<number>(maxQuota);
  const [savedNotice, setSavedNotice] = useState(false);

  React.useEffect(() => {
    setDraftQuota(maxQuota);
    setSavedNotice(false);
  }, [maxQuota]);

  const check = validateQuotaUpdate(draftQuota, registeredCount, reservedCount);

  return (
    <div className={`quota-editor-row ${compact ? 'quota-editor-compact' : ''}`}>
      {!compact && (
        <div>
          <strong>{tx(categoryName)}</strong>{' '}
          <span className="muted-inline mono-num">
            {tx("(ใช้โควตาแล้ว ")} {registeredCount + reservedCount} / {tx(maxQuota)} {tx(" คน)")}
          </span>
        </div>
      )}
      {canEdit ? (
        <div className="quota-editor-controls">
          <div className="cta-inline-row">
            <input
              type="number"
              className="mono-num quota-number-input"
              aria-label={txf("จำนวนรับสมัครของ {0}", categoryName)}
              min={check.minAllowed}
              value={draftQuota}
              onChange={(e) => {
                setSavedNotice(false);
                setDraftQuota(Number(e.target.value));
              }}
            />
            <button
              type="button"
              className="btn-secondary"
              disabled={!check.valid || draftQuota === maxQuota}
              onClick={() => {
                onSaveQuota(draftQuota);
                setSavedNotice(true);
              }}
            >
              {tx("บันทึกโควตา")}
            </button>
          </div>
          <div className="muted-inline mono-num">
            {tx("ใช้แล้ว ")} {registeredCount + reservedCount} / {tx(maxQuota)} {tx(" คน")}
            {savedNotice && (
              <span className="text-forest"> {tx(" · บันทึกแล้ว")}</span>
            )}
          </div>
          {!check.valid && <p className="field-error">{tx(check.message)}</p>}
        </div>
      ) : (
        <span className="mono-num">
          {registeredCount + reservedCount} / <strong>{tx(maxQuota)}</strong> {tx(" คน")}
        </span>
      )}
    </div>
  );
}

// ส่วนตั้งค่าฟอร์มรับสมัครของผู้จัด (เลือกแม่แบบ ปรับตามสิทธิ์ LOCKED/CONFIGURABLE/CUSTOMIZABLE และส่งคำขอหา Platform Owner)
export function CustomFieldsManager({
  event,
  fields = [],
  canEdit,
  templates = [],
  steps = [],
  fieldRequests = [],
  requesterName = 'ผู้จัดงานวิ่ง',
  onChange,
  onSelectTemplate,
  onSubmitFieldRequest,
}: {
  event?: RaceEvent;
  fields?: CustomRegistrationField[];
  canEdit: boolean;
  templates?: FormTemplate[];
  steps?: RegistrationStepDef[];
  fieldRequests?: OrganizerFieldRequest[];
  requesterName?: string;
  onChange: (next: CustomRegistrationField[]) => void;
  onSelectTemplate?: (templateId: string) => void;
  onSubmitFieldRequest?: (
    payload: Omit<
      OrganizerFieldRequest,
      'id' | 'requestCode' | 'status' | 'createdAt'
    >
  ) => void;
}) {
  const [reqLabel, setReqLabel] = useState('');
  const [reqKey, setReqKey] = useState('');
  const [reqType, setReqType] = useState<CustomFieldType>('text');
  const [reqStepKey, setReqStepKey] = useState<string>('step_race_specific');
  const [reqOptionsText, setReqOptionsText] = useState('');
  const [reqConditionHint, setReqConditionHint] = useState('');
  const [reqReasonNote, setReqReasonNote] = useState('');
  const [reqRequired, setReqRequired] = useState(false);
  const [reqSensitive, setReqSensitive] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const fieldTypeLabel: Partial<Record<CustomFieldType, string>> = {
    text: 'Text Input (ข้อความสั้น)',
    textarea: 'Textarea (ข้อความหลายบรรทัด)',
    email: 'Email (อีเมล)',
    phone: 'Phone (เบอร์โทร)',
    number: 'Number (ตัวเลข)',
    date: 'Date Picker (วันที่)',
    select: 'Dropdown (ตัวเลือก)',
    radio: 'Radio Group (ปุ่มตัวเลือก)',
    checkbox: 'Checkbox (ช่องติ๊กยืนยัน)',
    multiselect: 'Multi-select (เลือกหลายข้อ)',
    file: 'File Upload (อัปโหลดไฟล์)',
    image_choice: 'Image Choice (เลือกรูปภาพ)',
    address: 'Address (ที่อยู่)',
    size_selector: 'Size Selector (ไซส์เสื้อ)',
    distance_selector: 'Race Distance Selector (ระยะวิ่ง)',
  };

  const eventRequests = event
    ? fieldRequests.filter((r) => r.eventId === event.id)
    : fieldRequests;

  const handleSendRequest = () => {
    if (!reqLabel.trim() || !reqReasonNote.trim() || !event || !onSubmitFieldRequest) {
      return;
    }
    const cleanKey = (reqKey.trim() || reqLabel.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '') || `req_field_${Date.now()}`;

    onSubmitFieldRequest({
      organizationId: event.organizationId,
      eventId: event.id,
      requestedByName: requesterName,
      requestedLabelTh: reqLabel.trim(),
      requestedFieldKey: cleanKey,
      inputType: reqType,
      targetStepKey: reqStepKey,
      required: reqRequired,
      isSensitive: reqSensitive,
      options:
        reqType === 'select' || reqType === 'radio' || reqType === 'multiselect'
          ? reqOptionsText
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
      conditionHint: reqConditionHint.trim() || undefined,
      reasonNote: reqReasonNote.trim(),
    });
    setSentNotice(
      txf("ส่งคำขอเพิ่มฟิลด์ \"{0}\" ไปยัง Platform Owner (Registration Form Builder) เรียบร้อยแล้ว", reqLabel.trim())
    );
    setReqLabel('');
    setReqKey('');
    setReqOptionsText('');
    setReqConditionHint('');
    setReqReasonNote('');
    setReqRequired(false);
    setReqSensitive(false);
  };

  return (
    <section className="clean-panel">
      <div className="section-title-bar">
        <div>
          <h2>
            {tx("ตั้งค่าฟอร์มรับสมัครและส่งคำขอข้อมูลผู้สมัคร (Organizer Form Customizer & Request)")}
          </h2>
          <p className="muted-block">
            {tx("ขั้นตอนการสมัคร (Steps) และคลังฟิลด์หลักถูกควบคุมจากศูนย์กลางโดย Platform Owner ผู้จัดสามารถเลือกแม่แบบมาตรฐาน ปรับฟิลด์ที่ได้รับสิทธิ์ (CONFIGURABLE / CUSTOMIZABLE) หรือส่งคำขอ (Request) ให้ Platform Owner เพิ่มช่องกรอกข้อมูลเฉพาะของงานนี้ได้")}
          </p>
        </div>
        <div className="cta-inline-row">
          <span className="status-pill badge-forest">
            <span className="mono-code">
              {tx("เวอร์ชันฟอร์ม: ")} {event?.publishedFormVersion ?? 'v1.0-published'}
            </span>
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowPreviewModal((v) => !v)}
          >
            {showPreviewModal
              ? tx("ซ่อนตัวอย่างฟอร์มสมัคร")
              : tx("Preview ฟอร์มที่นักวิ่งจะเห็น")}
          </button>
        </div>
      </div>

      {/* 1. Template Selection & Step Governance Summary */}
      {templates.length > 0 && event && (
        <div
          className="custom-field-creator"
          style={{ marginBottom: '0.9rem' }}
        >
          <div className="form-grid-2">
            <div className="form-row">
              <label htmlFor="org-tpl-pick">
                {tx("เลือกแม่แบบฟอร์มรับสมัครที่ Platform Owner เผยแพร่ไว้ (Published Form Template)")}
              </label>
              <select
                id="org-tpl-pick"
                value={event.activeTemplateId ?? 'tpl-halfmarathon'}
                disabled={!canEdit}
                onChange={(e) => onSelectTemplate?.(e.target.value)}
              >
                {templates
                  .filter((t) => t.status === 'published')
                  .map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      [{tx(tpl.code)}] {tx(tpl.nameTh)} ({tx(tpl.versionLabel)})
                    </option>
                  ))}
              </select>
              <span className="muted-inline">
                {tx("การปรับแต่งในงานนี้จะสร้างเวอร์ชันเฉพาะของงานโดยไม่กระทบแม่แบบกลางของแพลตฟอร์ม")}
              </span>
            </div>

            <div className="form-row">
              <label>{tx("ลำดับขั้นตอนการสมัครของนักวิ่ง (ควบคุมโดย Platform Owner)")}</label>
              <div className="cta-inline-row" style={{ flexWrap: 'wrap' }}>
                {(steps.length > 0 ? steps.filter((s) => s.enabled) : []).map(
                  (st, i) => (
                    <span key={st.id} className="status-pill badge-navy">
                      {st.isSystemLocked && <IconLock size={12} />}
                      <span>
                        Step {i + 1}: {tx(st.titleTh)}
                      </span>
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optional Form Preview Box */}
      {showPreviewModal && (
        <div
          className="custom-field-creator"
          style={{ marginBottom: '0.9rem' }}
        >
          <h3>
            {tx("ตัวอย่างฟอร์มรับสมัครที่นักวิ่งเห็น (")}{tx(fields.length)} {tx(" ฟิลด์เสริม + 4 ฟิลด์ระบบล็อก)")}
          </h3>
          <p className="muted-inline">
            {tx("แสดงผลตามเวอร์ชัน ")} {event?.publishedFormVersion ?? 'v1.0-published'} {tx(" ที่เผยแพร่ของงานนี้")}
          </p>
          <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
            {fields.map((f) => (
              <div key={f.id} className="form-row">
                <label>
                  {tx(f.label)} {f.required ? <RequiredFieldText text="*" /> : tx("(ไม่บังคับ)")}
                </label>
                <input
                  type="text"
                  disabled
                  placeholder={`[${fieldTypeLabel[f.type] ?? f.type}] ${
                    f.options ? f.options.join(' / ') : 'ช่องกรอกสำหรับนักวิ่ง'
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Active Event Fields with LOCKED / CONFIGURABLE / CUSTOMIZABLE enforcement */}
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.98rem' }}>
        {tx("ฟิลด์คำถามที่เปิดใช้งานในงานวิ่งนี้ (")}{tx(fields.length)} {tx(" ข้อ · บังคับตามสิทธิ์ของ Platform Owner)")}
      </h3>
      {fields.length === 0 ? (
        <div className="subtle-empty-note">
          {tx("งานนี้ใช้เฉพาะฟิลด์ระบบมาตรฐาน หากต้องการเก็บข้อมูลเพิ่ม กรุณาเลือกแม่แบบหรือส่งคำขอให้ Platform Owner ด้านล่าง")}
        </div>
      ) : (
        <div className="custom-fields-list">
          {fields.map((f) => {
            const policy = f.policy ?? 'CUSTOMIZABLE';
            const isLocked = policy === 'LOCKED';
            const canDelete = canEdit && policy === 'CUSTOMIZABLE';
            const canToggleReq =
              canEdit && (policy === 'CONFIGURABLE' || policy === 'CUSTOMIZABLE');

            return (
              <div key={f.id} className="custom-field-item">
                <div className="custom-field-meta">
                  <strong>{tx(f.label)}</strong>
                  <span className="mono-code">
                    {fieldTypeLabel[f.type] ?? f.type}
                  </span>
                  {f.options && f.options.length > 0 && (
                    <span className="muted-inline">
                      {tx("ตัวเลือก: ")} {f.options.join(', ')}
                    </span>
                  )}
                  <span
                    className={`status-pill ${
                      isLocked
                        ? 'badge-navy'
                        : policy === 'CONFIGURABLE'
                        ? 'badge-amber'
                        : 'badge-forest'
                    }`}
                  >
                    {isLocked && <IconLock size={12} />}
                    <span>{tx("สิทธิ์:")} {tx(policy)}</span>
                  </span>
                  {f.required && (
                    <span className="status-pill badge-amber">
                      <IconAlert size={13} />
                      <span>{tx("บังคับกรอก")}</span>
                    </span>
                  )}
                  {f.isSensitive && (
                    <span className="status-pill badge-navy">
                      <IconLock size={13} />
                      <span>{tx("ซ่อนจากจุดรับอุปกรณ์ (PII)")}</span>
                    </span>
                  )}
                </div>

                <div className="cta-inline-row">
                  {canToggleReq && (
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() =>
                        onChange(
                          fields.map((item) =>
                            item.id === f.id
                              ? { ...item, required: !item.required }
                              : item
                          )
                        )
                      }
                    >
                      {f.required ? tx("เปลี่ยนเป็นไม่บังคับ") : tx("ตั้งเป็นบังคับกรอก")}
                    </button>
                  )}
                  {isLocked ? (
                    <span className="muted-inline">{tx("ล็อกโดย Platform Owner")}</span>
                  ) : (
                    canDelete && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() =>
                          onChange(fields.filter((item) => item.id !== f.id))
                        }
                      >
                        {tx("ถอดออกจากงานนี้")}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Request Form to Platform Owner */}
      {canEdit && (
        <div className="custom-field-creator" style={{ marginTop: '1rem' }}>
          <h3>
            {tx("ส่งคำขอให้ Platform Owner เพิ่มช่องกรอกข้อมูลหรือปรับขั้นตอนการสมัคร (Request Field to Platform Owner)")}
          </h3>
          <p className="muted-inline">
            {tx("ระบุข้อมูลที่ต้องการให้นักวิ่งกรอกเพิ่มเติมในใบสมัครงานนี้ คำขอจะถูกส่งไปยังหน้า Registration Form Builder ของ Platform Owner เพื่อตรวจสอบความปลอดภัยและอนุมัติเปิดใช้")}
          </p>

          {sentNotice && (
            <div
              className="success-callout"
              role="status"
              style={{ marginTop: '0.6rem' }}
            >
              <IconCheckCircle size={17} />
              <span>{tx(sentNotice)}</span>
            </div>
          )}

          <div className="form-grid-3" style={{ marginTop: '0.65rem' }}>
            <div className="form-row">
              <label htmlFor="cf-req-label">
                {<RequiredFieldText text={tx("หัวข้อข้อมูลที่ต้องการให้นักวิ่งกรอก *")} />}
              </label>
              <input
                id="cf-req-label"
                type="text"
                placeholder={tx("เช่น รอบรถรับส่ง Shuttle Bus หรือ เบอร์เสื้อ Finisher")}
                value={reqLabel}
                onChange={(e) => setReqLabel(e.target.value)}
              />
            </div>

            <div className="form-row">
              <label htmlFor="cf-req-type">{tx("ชนิด Input ที่ต้องการ")}</label>
              <select
                id="cf-req-type"
                value={reqType}
                onChange={(e) => setReqType(e.target.value as CustomFieldType)}
              >
                <option value="text">{tx("Text Input (ข้อความสั้น)")}</option>
                <option value="textarea">{tx("Textarea (ข้อความหลายบรรทัด)")}</option>
                <option value="select">{tx("Dropdown (ตัวเลือกเดียว)")}</option>
                <option value="radio">{tx("Radio Group (ปุ่มตัวเลือก)")}</option>
                <option value="checkbox">{tx("Checkbox (ช่องติ๊กยืนยัน)")}</option>
                <option value="multiselect">{tx("Multi-select (เลือกหลายข้อ)")}</option>
                <option value="number">{tx("Number (ตัวเลข)")}</option>
                <option value="date">{tx("Date Picker (วันที่)")}</option>
                <option value="file">{tx("File Upload (อัปโหลดเอกสาร/ใบรับรองแพทย์)")}</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="cf-req-step">{tx("ขั้นตอน (Step) ที่ต้องการให้แสดง")}</label>
              <select
                id="cf-req-step"
                value={reqStepKey}
                onChange={(e) => setReqStepKey(e.target.value)}
              >
                {(steps.length > 0
                  ? steps.filter((s) => s.key !== 'step_review_payment')
                  : [
                      {
                        key: 'step_race_specific',
                        titleTh: 'Step 3: ข้อมูลสุขภาพ ชมรมวิ่ง & คำถามเฉพาะงาน',
                      },
                      {
                        key: 'step_runner_info',
                        titleTh: 'Step 2: ข้อมูลผู้เข้าแข่งขัน & ผู้ติดต่อฉุกเฉิน',
                      },
                    ]
                ).map((s) => (
                  <option key={s.key} value={s.key}>
                    {tx(s.titleTh)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(reqType === 'select' ||
            reqType === 'radio' ||
            reqType === 'multiselect') && (
            <div className="form-row" style={{ marginTop: '0.6rem' }}>
              <label htmlFor="cf-req-opts">
                {tx("รายการตัวเลือกที่ต้องการ (คั่นด้วยเครื่องหมายจุลภาค ,)")}
              </label>
              <input
                id="cf-req-opts"
                type="text"
                placeholder={tx("เช่น เดินทางเอง, รถรับส่งรอบ 03:30 น., รถรับส่งรอบ 04:00 น.")}
                value={reqOptionsText}
                onChange={(e) => setReqOptionsText(e.target.value)}
              />
            </div>
          )}

          <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
            <div className="form-row">
              <label htmlFor="cf-req-reason">
                {<RequiredFieldText text={tx("เหตุผลความจำเป็นในการเก็บข้อมูลนี้ (แจ้ง Platform Owner) *")} />}
              </label>
              <input
                id="cf-req-reason"
                type="text"
                placeholder={tx("เช่น ใช้คำนวณจำนวนรถสองแถวรับส่งนักวิ่งขึ้นจุดปล่อยตัว")}
                value={reqReasonNote}
                onChange={(e) => setReqReasonNote(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="cf-req-cond">
                {tx("เงื่อนไขการแสดงผล (Conditional Logic ถ้ามี)")}
              </label>
              <input
                id="cf-req-cond"
                type="text"
                placeholder={tx("เช่น แสดงเฉพาะผู้สมัครระยะ 21.1 km หรือ แสดงทุกระยะ")}
                value={reqConditionHint}
                onChange={(e) => setReqConditionHint(e.target.value)}
              />
            </div>
          </div>

          <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={reqRequired}
                onChange={(e) => setReqRequired(e.target.checked)}
              />
              <span>{tx("ขอตั้งเป็นฟิลด์บังคับกรอก (Required)")}</span>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={reqSensitive}
                onChange={(e) => setReqSensitive(e.target.checked)}
              />
              <span>{tx("เป็นข้อมูลส่วนบุคคลอ่อนไหว (ซ่อนจากเจ้าหน้าที่หน้างาน)")}</span>
            </label>

            <button
              type="button"
              className="btn-primary"
              disabled={!reqLabel.trim() || !reqReasonNote.trim()}
              onClick={handleSendRequest}
            >
              <IconPlus size={15} />
              <span>{tx("ส่งคำขอให้ Platform Owner อนุมัติ")}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. History of Organizer Field Requests for this Event */}
      {eventRequests.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.96rem' }}>
            {tx("สถานะคำขอเพิ่มช่องกรอกข้อมูลที่ส่งหา Platform Owner (")}{tx(eventRequests.length)}{' '}
            {tx("รายการ)")}
          </h3>
          <div className="table-scroll">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>{tx("รหัสคำขอ")}</th>
                  <th>{tx("ข้อมูลที่ขอให้นักวิ่งกรอก")}</th>
                  <th>{tx("ชนิด Input / ขั้นตอน")}</th>
                  <th>{tx("เหตุผลที่แจ้ง")}</th>
                  <th>{tx("สถานะการพิจารณาของ Platform Owner")}</th>
                </tr>
              </thead>
              <tbody>
                {eventRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="mono-code">{tx(r.requestCode)}</td>
                    <td>
                      <strong>{tx(r.requestedLabelTh)}</strong>
                      {r.options && r.options.length > 0 && (
                        <div className="muted-inline">
                          {tx("ตัวเลือก: ")} {r.options.join(', ')}
                        </div>
                      )}
                    </td>
                    <td>
                      {fieldTypeLabel[r.inputType] ?? r.inputType}
                      <div className="mono-code">{tx(r.targetStepKey)}</div>
                    </td>
                    <td>{tx(r.reasonNote)}</td>
                    <td>
                      <span
                        className={`status-pill ${
                          r.status === 'approved'
                            ? 'badge-forest'
                            : r.status === 'rejected'
                            ? 'badge-danger'
                            : 'badge-amber'
                        }`}
                      >
                        <span>
                          {r.status === 'approved'
                            ? tx("อนุมัติและเปิดใช้ในฟอร์มแล้ว")
                            : r.status === 'rejected'
                            ? tx("ปฏิเสธคำขอ")
                            : tx("รอ Platform Owner อนุมัติ")}
                        </span>
                      </span>
                      {r.adminNote && (
                        <div className="muted-inline">{tx(r.adminNote)}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

export const OrganizerDashboardView: React.FC<OrganizerDashboardViewProps> = ({
  currentUser,
  organizations,
  invitations,
  activeOrgId,
  activeEventId,
  activeSection,
  events,
  registrations,
  merchOrders,
  productionInquiries,
  payouts,
  auditLogs,
  simulatedState,
  onClearSimulatedState,
  onSelectOrg,
  onSelectEvent,
  onSelectSection,
  onCreateDraftEvent,
  onDuplicateEventWithoutPii,
  onCompleteDraftReadinessAndSubmit,
  onUpdateFeeBearerPolicy,
  onAddEventProduct,
  onCreateEventProductionQuote,
  onAssignBibNumber,
  onConfirmKitPickup,
  onConfirmMerchHandover,
  onResolveRefundRequest,
  onCreateSingleUseInvite,
  onOpenPublicPreview,
  onUpdateEventTotalQuota,
  onUpdateCategoryQuota,
  onUpdateCategoryAgeRules,
  onUpdateCustomFields,
  formTemplates = [],
  registrationSteps = [],
  fieldRequests = [],
  onSelectEventTemplate,
  onUpdateEventMedia,
  platformProfileConfig = DEFAULT_PLATFORM_PROFILE_CONFIG,
  onUpdateEventShirtConfig,
  onSubmitOrganizerFieldRequest,
}) => {
  const [timeWindow, setTimeWindow] = useState<TimeWindowFilter>('all_time');
  const [addEventSizePick, setAddEventSizePick] =
    useState<ShirtSizeCode>('3XL');
  const [addEventSizeQty, setAddEventSizeQty] = useState<number>(80);
  const [eventSearch, setEventSearch] = useState('');
  const [eventStatusFilter, setEventStatusFilter] = useState<
    'all' | EventStatus
  >('all');

  const [participantSearch, setParticipantSearch] = useState('');
  const [participantRegFilter, setParticipantRegFilter] = useState<
    'all' | RegistrationStatus
  >('all');
  const [participantCatFilter, setParticipantCatFilter] =
    useState<string>('all');
  const [inspectedRegId, setInspectedRegId] = useState<string | null>(null);

  // Check-in & Merchandise Handover mode
  const [handoverTab, setHandoverTab] = useState<'race_bib' | 'merch_pickup'>(
    'race_bib'
  );
  const [checkinQuery, setCheckinQuery] = useState('');
  const [bibDraftMap, setBibDraftMap] = useState<Record<string, string>>({});
  const [checkinFeedback, setCheckinFeedback] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Create new draft event form
  const [showNewDraftForm, setShowNewDraftForm] = useState(false);
  const [newDraftTitle, setNewDraftTitle] = useState('');
  const [newDraftProvince, setNewDraftProvince] = useState('เชียงใหม่');
  const [newDraftDate, setNewDraftDate] = useState('2027-03-21');
  const [requestProdHelp, setRequestProdHelp] = useState(true);

  // Add storefront product form
  const [showAddProductForm, setShowAddProductForm] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCat, setNewProdCat] = useState<
    'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม'
  >('เสื้อที่ระลึก');
  const [newProdSaleMode, setNewProdSaleMode] = useState<
    'ready_stock' | 'preorder'
  >('preorder');
  const [newProdService, setNewProdService] = useState<SellerServiceModel>(
    'kratai_full_service'
  );
  const [newProdPrice, setNewProdPrice] = useState(420);
  const [newProdCap, setNewProdCap] = useState(50);

  // Production Quote calculator (non-duplicated sizing formula per section 15.5)
  const [bufferShirtQty, setBufferShirtQty] = useState(15);
  const [existingShirtStock, setExistingShirtStock] = useState(0);
  const [rfqTargetDate, setRfqTargetDate] = useState('2026-12-08');

  const [exportBannerText, setExportBannerText] = useState<string | null>(null);
  const [calcSamplePriceBaht, setCalcSamplePriceBaht] = useState<number>(900);
  const [financeSubFilter, setFinanceSubFilter] = useState<
    'all' | 'payments' | 'refunds' | 'payouts'
  >('all');
  const [orgDrilldownRegFilter, setOrgDrilldownRegFilter] = useState<
    null | 'confirmed' | 'pending_payment'
  >(null);
  const [inviteRolePick, setInviteRolePick] = useState<OrgRole>('staff');

  const activeMembership = useMemo(
    () =>
      currentUser.memberships.find((m) => m.organizationId === activeOrgId) ??
      currentUser.memberships[0],
    [currentUser, activeOrgId]
  );

  const activeOrg = useMemo(
    () =>
      (currentUser.isPlatformAdmin
        ? organizations.find((o) => o.id === activeOrgId)
        : organizations.find(
            (o) => o.id === activeMembership?.organizationId
          )) ?? organizations[0],
    [organizations, activeMembership, activeOrgId, currentUser.isPlatformAdmin]
  );

  const role: OrgRole = currentUser.isPlatformAdmin
    ? 'owner'
    : activeMembership?.role ?? 'staff';
  const canViewFinance = role === 'owner' || role === 'finance';
  const canManageEventConfig = role === 'owner' || role === 'event_manager';
  const canCheckIn =
    role === 'owner' || role === 'event_manager' || role === 'staff';
  const canManageOrgBank = role === 'owner';

  const accessibleOrgEvents = useMemo(() => {
    const orgEvs = events.filter((e) => e.organizationId === activeOrg.id);
    if (!activeMembership?.assignedEventIds) return orgEvs;
    const allowed = new Set(activeMembership.assignedEventIds);
    return orgEvs.filter((e) => allowed.has(e.id));
  }, [events, activeOrg.id, activeMembership]);

  const selectedEvent = useMemo(
    () => accessibleOrgEvents.find((e) => e.id === activeEventId) ?? null,
    [accessibleOrgEvents, activeEventId]
  );

  const orgRegistrations = useMemo(() => {
    const allowedIds = new Set(accessibleOrgEvents.map((e) => e.id));
    return registrations.filter(
      (r) => r.organizationId === activeOrg.id && allowedIds.has(r.eventId)
    );
  }, [registrations, activeOrg.id, accessibleOrgEvents]);

  const orgMerchOrders = useMemo(() => {
    const allowedIds = new Set(accessibleOrgEvents.map((e) => e.id));
    return merchOrders.filter(
      (m) => m.organizationId === activeOrg.id && allowedIds.has(m.eventId)
    );
  }, [merchOrders, activeOrg.id, accessibleOrgEvents]);

  const orgMetrics = useMemo(
    () =>
      computeMetrics(
        accessibleOrgEvents,
        orgRegistrations,
        orgMerchOrders,
        timeWindow
      ),
    [accessibleOrgEvents, orgRegistrations, orgMerchOrders, timeWindow]
  );

  const eventMetrics = useMemo(
    () =>
      selectedEvent
        ? computeMetrics(
          [selectedEvent],
          orgRegistrations.filter((r) => r.eventId === selectedEvent.id),
          orgMerchOrders.filter((m) => m.eventId === selectedEvent.id),
          timeWindow
        )
        : null,
    [selectedEvent, orgRegistrations, orgMerchOrders, timeWindow]
  );

  const urgentActionItems = useMemo(() => {
    const items: {
      id: string;
      title: React.ReactNode;
      whyItMatters: React.ReactNode;
      ctaLabel: string;
      action: () => void;
    }[] = [];

    if (!activeOrg.payoutReady && canManageOrgBank) {
      items.push({
        id: 'act-bank',
        title: 'ยังไม่ได้ผูกบัญชีธนาคารสำหรับรับเงินโอนขององค์กร',
        whyItMatters:
          'ต้องยืนยันบัญชีรับเงินก่อนจึงจะเปิดรับสมัครงานวิ่งและรับยอดนำส่งได้',
        ctaLabel: 'ตั้งค่าบัญชีองค์กร',
        action: () => onSelectSection('org_team_settings'),
      });
    }

    if (canViewFinance) {
      const refundReqs = orgRegistrations.filter(
        (r) => r.refundStatus === 'requested'
      );
      if (refundReqs.length > 0) {
        items.push({
          id: 'act-refund',
          title: (
            <>
              {tx("มีคำขอคืนเงินจากผู้สมัครรอตรวจสอบ")}{' '}
              <span className="mono-num">{tx(refundReqs.length)}</span> {tx(" รายการ")}
            </>
          ),
          whyItMatters: (
            <>
              {tx("ยอดขอคืนรวม")}{' '}
              <span className="mono-num">
                {formatThb(
                  refundReqs.reduce((s, r) => s + r.snapshotBaseSatang, 0),
                  true
                )}
              </span>{' '}
              {tx("รอฝ่ายการเงินพิจารณาอนุมัติหรือปฏิเสธ")}
            </>
          ),
          ctaLabel: 'ตรวจคำขอคืนเงิน',
          action: () => {
            setFinanceSubFilter('refunds');
            onSelectEvent(refundReqs[0].eventId, 'evt_finance');
          },
        });
      }
    }

    if (canManageEventConfig) {
      accessibleOrgEvents
        .filter((e) => e.status === 'draft')
        .forEach((draftEv) => {
          const failedCount = draftEv.readinessChecks.filter(
            (c) => !c.passed
          ).length;
          items.push({
            id: `act-draft-${draftEv.id}`,
            title: (
              <>
                {tx("งานแบบร่าง &ldquo;")}{tx(draftEv.titleTh)}{tx("&rdquo; เหลือตั้งค่าอีก")}{' '}
                <span className="mono-num">{tx(failedCount)}</span> {tx(" หัวข้อ")}
              </>
            ),
            whyItMatters:
              draftEv.statusNote ??
              'เมื่อตั้งค่าครบทุกข้อแล้วจึงจะส่งให้แพลตฟอร์มตรวจเปิดขายได้',
            ctaLabel: 'ไปตั้งค่างานต่อ',
            action: () => onSelectEvent(draftEv.id, 'evt_overview'),
          });
        });
    }

    if (canCheckIn) {
      accessibleOrgEvents
        .filter((e) => e.status === 'published')
        .forEach((pubEv) => {
          const missingBib = orgRegistrations.filter(
            (r) =>
              r.eventId === pubEv.id &&
              r.registrationStatus === 'confirmed' &&
              !r.bibNumber
          ).length;
          if (missingBib > 0) {
            items.push({
              id: `act-bib-${pubEv.id}`,
              title: (
                <>
                  {tx("ผู้สมัครชำระเงินแล้วยังไม่มีเลข BIB")}{' '}
                  <span className="mono-num">{tx(missingBib)}</span> {tx(" คน (")}
                  <span className="mono-code">{tx(pubEv.code)}</span>)
                </>
              ),
              whyItMatters: `ควรกำหนดเลข BIB ล่วงหน้าเพื่อให้จุดรับอุปกรณ์วันงาน ${pubEv.titleTh} ทำงานได้ทันที`,
              ctaLabel: 'กำหนดเลข BIB',
              action: () => {
                setHandoverTab('race_bib');
                onSelectEvent(pubEv.id, 'evt_checkin_bib');
              },
            });
          }
        });
    }

    return items;
  }, [
    activeOrg,
    canManageOrgBank,
    canViewFinance,
    canManageEventConfig,
    canCheckIn,
    orgRegistrations,
    accessibleOrgEvents,
    onSelectSection,
    onSelectEvent,
  ]);

  const handleDrillDown = (
    target:
      | 'confirmed'
      | 'pending_payment'
      | 'payments'
      | 'refunds'
      | 'payouts'
      | 'merch'
  ) => {
    if (target === 'merch') {
      if (selectedEvent) {
        onSelectSection('evt_storefront');
      } else {
        onSelectSection('org_merch_production');
      }
      return;
    }

    if (target === 'confirmed' || target === 'pending_payment') {
      if (selectedEvent) {
        setParticipantSearch('');
        setParticipantCatFilter('all');
        setParticipantRegFilter(target);
        onSelectSection('evt_participants');
      } else {
        setOrgDrilldownRegFilter(target);
        onSelectSection('org_overview');
        window.requestAnimationFrame(() => {
          document
            .getElementById('org-drilldown-source-panel')
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
      return;
    }

    setFinanceSubFilter(target);
    if (!canViewFinance) {
      onSelectSection('org_finance');
      return;
    }
    if (selectedEvent) {
      onSelectSection('evt_finance');
    } else {
      onSelectSection('org_finance');
    }
    window.requestAnimationFrame(() => {
      document
        .getElementById('finance-source-ledger')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const filteredOrgEvents = useMemo(() => {
    return accessibleOrgEvents.filter((ev) => {
      const q = eventSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        ev.titleTh.toLowerCase().includes(q) ||
        ev.code.toLowerCase().includes(q) ||
        ev.province.toLowerCase().includes(q);
      const matchStatus =
        eventStatusFilter === 'all' || ev.status === eventStatusFilter;
      return matchQ && matchStatus;
    });
  }, [accessibleOrgEvents, eventSearch, eventStatusFilter]);

  const eventParticipants = useMemo(() => {
    if (!selectedEvent) return [];
    return orgRegistrations
      .filter((r) => r.eventId === selectedEvent.id)
      .filter((r) => {
        const q = participantSearch.trim().toLowerCase();
        const matchQ =
          !q ||
          r.participantNameTh.toLowerCase().includes(q) ||
          r.participantNameEn.toLowerCase().includes(q) ||
          r.regCode.toLowerCase().includes(q) ||
          (r.bibNumber ?? '').toLowerCase().includes(q) ||
          r.qrCheckInToken.toLowerCase().includes(q);
        const matchStatus =
          participantRegFilter === 'all' ||
          r.registrationStatus === participantRegFilter;
        const matchWindow =
          participantRegFilter !== 'confirmed' ||
          timeWindow === 'all_time' ||
          isWithinTimeWindow(r.createdAt, timeWindow);
        const matchCat =
          participantCatFilter === 'all' ||
          r.categoryId === participantCatFilter;
        return matchQ && matchStatus && matchWindow && matchCat;
      });
  }, [
    selectedEvent,
    orgRegistrations,
    participantSearch,
    participantRegFilter,
    participantCatFilter,
    timeWindow,
  ]);

  const orgScopedSourceRegistrations = useMemo(() => {
    if (!orgDrilldownRegFilter) return [];
    return orgRegistrations.filter((r) => {
      if (r.registrationStatus !== orgDrilldownRegFilter) return false;
      if (
        orgDrilldownRegFilter === 'confirmed' &&
        timeWindow !== 'all_time' &&
        !isWithinTimeWindow(r.createdAt, timeWindow)
      ) {
        return false;
      }
      return true;
    });
  }, [orgRegistrations, orgDrilldownRegFilter, timeWindow]);

  const inspectedReg = useMemo(
    () => eventParticipants.find((r) => r.id === inspectedRegId) ?? null,
    [eventParticipants, inspectedRegId]
  );

  const checkinCandidates = useMemo(() => {
    if (!selectedEvent) return [];
    const q = checkinQuery.trim().toLowerCase();
    return orgRegistrations
      .filter((r) => r.eventId === selectedEvent.id)
      .filter(
        (r) =>
          !q ||
          r.qrCheckInToken.toLowerCase().includes(q) ||
          (r.bibNumber ?? '').toLowerCase().includes(q) ||
          r.participantNameTh.toLowerCase().includes(q) ||
          r.regCode.toLowerCase().includes(q)
      );
  }, [selectedEvent, orgRegistrations, checkinQuery]);

  const eventMerchOrders = useMemo(() => {
    if (!selectedEvent) return [];
    const q = checkinQuery.trim().toLowerCase();
    return orgMerchOrders
      .filter((m) => m.eventId === selectedEvent.id)
      .filter(
        (m) =>
          !q ||
          m.pickupToken.toLowerCase().includes(q) ||
          m.merchOrderCode.toLowerCase().includes(q) ||
          m.buyerName.toLowerCase().includes(q)
      );
  }, [selectedEvent, orgMerchOrders, checkinQuery]);

  const isSectionForbiddenByRole =
    ((activeSection === 'org_finance' || activeSection === 'evt_finance') &&
      !canViewFinance) ||
    (activeSection === 'evt_checkin_bib' && !canCheckIn);

  return (
    <div className="dashboard-workspace">
      {/* SELF-EXPLANATORY SIDEBAR NAVIGATION */}
      <aside
        className="dashboard-rail"
        aria-label={tx("เมนูจัดการสำหรับผู้จัดงานวิ่ง")}
      >
        <div className="rail-org-switcher">
          <label htmlFor="org-ctx-sel" className="rail-field-label">
            {tx("องค์กรผู้จัดที่กำลังดูแล")}
          </label>
          <select
            id="org-ctx-sel"
            value={activeOrg.id}
            onChange={(e) => onSelectOrg(e.target.value)}
          >
            {currentUser.isPlatformAdmin
              ? organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {tx(o.nameTh)}
                  </option>
                ))
              : currentUser.memberships.map((m) => {
                  const o = organizations.find(
                    (org) => org.id === m.organizationId
                  );
                  return (
                    <option key={m.organizationId} value={m.organizationId}>
                      {tx(o?.nameTh)}
                    </option>
                  );
                })}
          </select>
          <div className="rail-role-chip">
            <IconShield size={14} />
            <span>
              {currentUser.isPlatformAdmin
                ? tx("Platform Owner (ดูและจัดการแทนผู้จัด)")
                : tx(roleNameMap[role])}
            </span>
          </div>
        </div>

        <nav className="rail-nav-group" aria-label={tx("เมนูระดับองค์กร")}>
          <div className="rail-group-heading">
            {tx("Organization Overview (ดูภาพรวมทุกงาน)")}
          </div>
          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_overview' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_overview');
            }}
          >
            <IconBuilding size={16} />
            <span>{tx("Organization Overview (ภาพรวมทุกงาน)")}</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_events' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_events');
            }}
          >
            <IconFlag size={16} />
            <span>{tx("งานวิ่งทั้งหมด (")}{tx(accessibleOrgEvents.length)})</span>
          </button>

          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_merch_production' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_merch_production');
            }}
          >
            <IconShirt size={16} />
            <span>{tx("ร้านค้า & สั่งผลิตเสื้อ/เหรียญ")}</span>
          </button>

          {canViewFinance && (
            <button
              type="button"
              className={`rail-nav-btn ${activeSection === 'org_finance' ? 'active' : ''
                }`}
              onClick={() => {
                onSelectEvent(null);
                onSelectSection('org_finance');
              }}
            >
              <IconLedger size={16} />
              <span>{tx("การเงินรวม & รอบโอน")}</span>
            </button>
          )}

          <button
            type="button"
            className={`rail-nav-btn ${activeSection === 'org_team_settings' ? 'active' : ''
              }`}
            onClick={() => {
              onSelectEvent(null);
              onSelectSection('org_team_settings');
            }}
          >
            <IconUsers size={16} />
            <span>{tx("ทีมงาน & บัญชีรับเงิน")}</span>
          </button>
        </nav>

        <div className="rail-event-context">
          <label htmlFor="evt-ctx-sel" className="rail-field-label">
            {tx("เลือกงานวิ่งเพื่อจัดการรายอีเวนต์")}
          </label>
          <select
            id="evt-ctx-sel"
            value={selectedEvent?.id ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                onSelectEvent(null, 'org_overview');
              } else {
                onSelectEvent(
                  val,
                  role === 'staff' ? 'evt_checkin_bib' : 'evt_overview'
                );
              }
            }}
          >
            <option value="">{tx("-- เลือกงานวิ่งที่ต้องการจัดการ --")}</option>
            {accessibleOrgEvents.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {tx(ev.titleTh)}
              </option>
            ))}
          </select>
        </div>

        {accessibleOrgEvents.length > 0 && (
          <nav
            className="rail-nav-group rail-event-subnav"
            aria-label={tx("เมนูจัดการภายในงานวิ่งที่เลือก")}
          >
            <div className="rail-group-heading">
              {selectedEvent
                ? `Event Dashboard: ${selectedEvent.code}`
                : txf("Event Dashboard (คลิกเพื่อเจาะลึก {0})", accessibleOrgEvents[0].code)}
            </div>
            <button
              type="button"
              className={`rail-nav-btn ${
                selectedEvent && activeSection === 'evt_overview'
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                onSelectEvent(
                  selectedEvent?.id ?? accessibleOrgEvents[0].id,
                  'evt_overview'
                )
              }
            >
              <IconFlag size={16} />
              <span>{tx("Event Dashboard (ภาพรวมเจาะลึก)")}</span>
            </button>
            <button
              type="button"
              className={`rail-nav-btn ${
                selectedEvent && activeSection === 'evt_pricing_quota'
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                onSelectEvent(
                  selectedEvent?.id ?? accessibleOrgEvents[0].id,
                  'evt_pricing_quota'
                )
              }
            >
              <IconBib size={16} />
              <span>{tx("ระยะ โควตา & คำถามสมัคร")}</span>
            </button>
            <button
              type="button"
              className={`rail-nav-btn ${
                selectedEvent && activeSection === 'evt_participants'
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                onSelectEvent(
                  selectedEvent?.id ?? accessibleOrgEvents[0].id,
                  'evt_participants'
                )
              }
            >
              <IconUsers size={16} />
              <span>{tx("รายชื่อผู้สมัครวิ่ง")}</span>
            </button>
            <button
              type="button"
              className={`rail-nav-btn ${
                selectedEvent && activeSection === 'evt_storefront'
                  ? 'active'
                  : ''
              }`}
              onClick={() =>
                onSelectEvent(
                  selectedEvent?.id ?? accessibleOrgEvents[0].id,
                  'evt_storefront'
                )
              }
            >
              <IconBag size={16} />
              <span>{tx("ร้านค้า & สินค้าของงานนี้")}</span>
            </button>
            {canCheckIn && (
              <button
                type="button"
                className={`rail-nav-btn ${
                  selectedEvent && activeSection === 'evt_checkin_bib'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  onSelectEvent(
                    selectedEvent?.id ?? accessibleOrgEvents[0].id,
                    'evt_checkin_bib'
                  )
                }
              >
                <IconQr size={16} />
                <span>{tx("เช็กอิน BIB & จ่ายสินค้า")}</span>
              </button>
            )}
            {canViewFinance && (
              <button
                type="button"
                className={`rail-nav-btn ${
                  selectedEvent && activeSection === 'evt_finance'
                    ? 'active'
                    : ''
                }`}
                onClick={() =>
                  onSelectEvent(
                    selectedEvent?.id ?? accessibleOrgEvents[0].id,
                    'evt_finance'
                  )
                }
              >
                <IconLedger size={16} />
                <span>{tx("รายรับ & คืนเงินงานนี้")}</span>
              </button>
            )}
          </nav>
        )}
      </aside>

      {/* MAIN WORKSPACE CANVAS */}
      <main className="dashboard-canvas">
        {/* Top Context & Quick Action Bar */}
        <header className="context-breadcrumb-bar">
          <div className="breadcrumb-trail">
            {selectedEvent ? (
              <>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => onSelectEvent(null, 'org_overview')}
                >
                  <IconArrowLeft size={14} />
                  <span>{tx("รวมทุกงาน")}</span>
                </button>
                <strong>{tx(selectedEvent.titleTh)}</strong>
                <EventStatusBadge status={selectedEvent.status} />
              </>
            ) : (
              <>
                <span className="mono-code">{tx(activeOrg.code)}</span>
                <strong>{tx("กำลังดูภาพรวมของ:")} {tx(activeOrg.nameTh)}</strong>
              </>
            )}
          </div>

          <div className="context-toolbar">
            <label htmlFor="tw-sel" className="sr-only">
              {tx("ช่วงเวลาคำนวณยอดเงิน")}
            </label>
            <select
              id="tw-sel"
              value={timeWindow}
              onChange={(e) =>
                setTimeWindow(e.target.value as TimeWindowFilter)
              }
              aria-label={tx("ช่วงเวลาคำนวณยอดเงิน")}
            >
              <option value="all_time">{tx("ยอดเงิน: ตลอดอายุงาน")}</option>
              <option value="last_30d">{tx("ยอดเงิน: 30 วันล่าสุด")}</option>
              <option value="last_7d">{tx("ยอดเงิน: 7 วันล่าสุด")}</option>
            </select>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => onOpenPublicPreview(selectedEvent?.id)}
            >
              {tx("ดูหน้าเว็บฝั่งลูกค้า")}
            </button>

            {canManageEventConfig && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  onSelectEvent(null);
                  onSelectSection('org_events');
                  setShowNewDraftForm(true);
                }}
              >
                <IconPlus size={15} />
                <span>{tx("สร้างงานวิ่งใหม่")}</span>
              </button>
            )}
          </div>
        </header>

        {/* Special States (Loading / Error / Permission Denied) */}
        {simulatedState === 'loading' ? (
          <section
            className="skeleton-stage"
            aria-busy="true"
            aria-label={tx("กำลังโหลดข้อมูล")}
          >
            <div className="skeleton-banner-note">
              {tx("โหมดทดสอบสถานะกำลังโหลด (Skeleton): รักษาโครงสร้างหน้าจอโดยไม่แสดงตัวเลขศูนย์ปลอม")}
            </div>
            <div className="skeleton-block skel-lg" />
            <div className="skeleton-block skel-md" />
            <div className="skeleton-block skel-table" />
          </section>
        ) : simulatedState === 'permission_denied' ||
          isSectionForbiddenByRole ? (
          <section className="permission-denied-panel" role="alert">
            <IconLock size={28} />
            <h1>{tx("บัญชีของคุณไม่มีสิทธิ์เข้าถึงส่วนงานนี้")}</h1>
            <p>
              {tx("คุณเข้าใช้งานในบทบาท ")} <strong>{tx(roleNameMap[role])}</strong> {tx(" ของ")}{' '}
              <strong>{tx(activeOrg.nameTh)}</strong> {tx(" หากต้องการสิทธิ์เพิ่มเติม กรุณาติดต่อเจ้าขององค์กร (")}{tx(activeOrg.contactEmail)})
            </p>
            <div className="cta-inline-row">
              {simulatedState === 'permission_denied' && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onClearSimulatedState}
                >
                  {tx("กลับสู่สถานะปกติ")}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  onSelectSection(
                    role === 'staff' && selectedEvent
                      ? 'evt_checkin_bib'
                      : 'org_overview'
                  )
                }
              >
                {tx("ไปหน้าที่ได้รับอนุญาต")}
              </button>
            </div>
          </section>
        ) : (
          <>
            {simulatedState === 'partial_error' && (
              <div className="error-callout" role="alert">
                <IconAlert size={18} />
                <div className="callout-flex">
                  <span>
                    <strong>{tx("ดึงสถานะคิวส่งอีเมลแจ้งเตือนไม่สำเร็จชั่วคราว:")}</strong>{' '}
                    {tx("คุณยังจัดการผู้สมัครและดูยอดเงินในส่วนอื่นของหน้านี้ได้ตามปกติ")}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={onClearSimulatedState}
                  >
                    {tx("ลองโหลดใหม่")}
                  </button>
                </div>
              </div>
            )}

            {exportBannerText && (
              <div className="success-callout" role="status">
                <IconCheckCircle size={18} />
                <div className="callout-flex">
                  <span>{tx(exportBannerText)}</span>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => setExportBannerText(null)}
                  >
                    {tx("ปิดข้อความ")}
                  </button>
                </div>
              </div>
            )}

            {/* ================= 1. ORG OVERVIEW ================= */}
            {activeSection === 'org_overview' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("Organization Overview — ดูภาพรวมทุกงานขององค์กร")}</h1>
                  <p className="page-purpose-desc">
                    {tx("ดูงานด่วนที่ต้องทำทันที ตรวจสรุปยอดสมัครและรายได้รวมทุกงานของ ")} {tx(activeOrg.nameTh)}
                    {tx("เปรียบเทียบผลงานแต่ละอีเวนต์ และกดเข้าสู่ Event Dashboard เพื่อเจาะลึกรายงานวิ่ง")}
                  </p>
                </div>

                {accessibleOrgEvents.length === 0 ? (
                  <div className="empty-state-box">
                    <h2>{tx("องค์กรนี้ยังไม่มีงานวิ่ง")}</h2>
                    <p>
                      {tx("เริ่มต้นผูกบัญชีรับเงินขององค์กรให้พร้อม แล้วสร้างงานวิ่งแบบร่างแรกเพื่อกำหนดระยะทางและราคา")}
                    </p>
                    <div className="cta-inline-row">
                      {canManageEventConfig && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            onSelectSection('org_events');
                            setShowNewDraftForm(true);
                          }}
                        >
                          <IconPlus size={15} />
                          <span>{tx("สร้างงานวิ่งแรกขององค์กร")}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => onSelectSection('org_team_settings')}
                      >
                        {tx("ตรวจสถานะบัญชีรับเงิน")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Zone 1: Action Needed */}
                    <section
                      className="action-queue-panel"
                      aria-label={tx("สิ่งที่ต้องจัดการด่วน")}
                    >
                      <div className="section-title-bar">
                        <div>
                          <h2>
                            {tx("สิ่งที่ต้องจัดการก่อน (")}
                            <span className="mono-num">
                              {tx(urgentActionItems.length)}
                            </span>{' '}
                            {tx("รายการ)")}
                          </h2>
                          <span className="muted-inline">
                            {tx("แสดงเฉพาะงานค้างที่บทบาทของคุณมีสิทธิ์กดดำเนินการได้ทันที")}
                          </span>
                        </div>
                      </div>

                      {urgentActionItems.length === 0 ? (
                        <p className="muted-block">
                          {tx("ไม่มีงานค้างเร่งด่วนในขณะนี้ ทุกงานอยู่ในสถานะปกติ")}
                        </p>
                      ) : (
                        <div className="action-queue-rows">
                          {urgentActionItems.map((item) => (
                            <div key={item.id} className="action-queue-item">
                              <div className="action-queue-text">
                                <IconAlert size={17} />
                                <div>
                                  <strong>{tx(item.title)}</strong>
                                  <p>{tx(item.whyItMatters)}</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={item.action}
                              >
                                <span>{tx(item.ctaLabel)}</span>
                                <IconArrowRight size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Zone 2: Quota & Money Summary */}
                    <BibLedgerStrip
                      scopeTitle={`สรุปรวมทุกงานของ ${activeOrg.nameTh}`}
                      scopeCode={activeOrg.code}
                      metrics={orgMetrics}
                      timeWindow={timeWindow}
                      canViewFinance={canViewFinance}
                      onDrillDown={handleDrillDown}
                    />

                    {/* Zone 2.5: P1 / P2 / P3 Analytics Charts Suite */}
                    <OrganizerAnalyticsCharts
                      scopeMode="organization"
                      scopeTitle={`รวมทุกงานของ ${activeOrg.nameTh}`}
                      events={accessibleOrgEvents}
                      selectedEvent={null}
                      registrations={orgRegistrations}
                      merchOrders={orgMerchOrders}
                      metrics={orgMetrics}
                      timeWindow={timeWindow}
                      canViewFinance={canViewFinance}
                      canManageEventConfig={canManageEventConfig}
                      canCheckIn={canCheckIn}
                      onDrillDownStatus={(st) => handleDrillDown(st)}
                      onDrillDownFinance={(t) => handleDrillDown(t)}
                      onSelectEventAction={(evId, sec) =>
                        onSelectEvent(evId, sec)
                      }
                    />

                    {orgDrilldownRegFilter && (
                      <section
                        id="org-drilldown-source-panel"
                        className="clean-panel"
                      >
                        <div className="section-title-bar">
                          <h2>
                            {tx("รายชื่อผู้สมัครต้นทาง:")}{' '}
                            {orgDrilldownRegFilter === 'confirmed'
                              ? tx("ยืนยันสิทธิ์แล้ว")
                              : tx("กันที่นั่งรอจ่าย")}{' '}
                            (<span className="mono-num">
                              {tx(orgScopedSourceRegistrations.length)}
                            </span>{' '}
                            {tx("คน)")}
                          </h2>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => setOrgDrilldownRegFilter(null)}
                          >
                            {tx("ซ่อนตารางนี้")}
                          </button>
                        </div>
                        <div className="table-scroll">
                          <table className="ops-table">
                            <thead>
                              <tr>
                                <th>{tx("รหัสใบสมัคร / งาน")}</th>
                                <th>{tx("ผู้เข้าแข่งขัน")}</th>
                                <th>{tx("สถานะสิทธิ์")}</th>
                                <th>{tx("สถานะเงิน")}</th>
                                <th>{tx("ทางลัด")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {orgScopedSourceRegistrations.map((reg) => {
                                const ev = accessibleOrgEvents.find(
                                  (e) => e.id === reg.eventId
                                );
                                return (
                                  <tr key={reg.id}>
                                    <td>
                                      <span className="mono-code">
                                        {tx(reg.regCode)}
                                      </span>
                                      <div className="muted-inline">
                                        {tx(ev?.titleTh)}
                                      </div>
                                    </td>
                                    <td>{tx(reg.participantNameTh)}</td>
                                    <td>
                                      <RegStatusBadge
                                        status={reg.registrationStatus}
                                      />
                                    </td>
                                    <td>
                                      <PaymentStatusBadge
                                        status={reg.paymentStatus}
                                      />
                                    </td>
                                    <td>
                                      <button
                                        type="button"
                                        className="btn-secondary"
                                        onClick={() => {
                                          setParticipantRegFilter(
                                            orgDrilldownRegFilter
                                          );
                                          onSelectEvent(
                                            reg.eventId,
                                            'evt_participants'
                                          );
                                        }}
                                      >
                                        {tx("เปิดในงานนี้")}
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}

                    {/* Zone 3: Events in Organization */}
                    <section className="clean-panel">
                      <div className="section-title-bar">
                        <div>
                          <h2>{tx("งานวิ่งในความดูแลของคุณ")}</h2>
                          <span className="muted-inline">
                            {tx("กดปุ่ม &ldquo;จัดการงานนี้&rdquo; เพื่อเข้าดูระยะราคา รายชื่อผู้สมัคร ร้านค้า หรือจุดเช็กอิน BIB")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => onSelectSection('org_events')}
                        >
                          {tx("ค้นหา / คัดลอกงานปีถัดไป")}
                        </button>
                      </div>

                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>{tx("ชื่องานวิ่ง")}</th>
                              <th>{tx("วันจัดงาน")}</th>
                              <th>{tx("สถานะปัจจุบัน")}</th>
                              <th>{tx("ผู้รับภาระค่าบริการ")}</th>
                              <th className="num-col">{tx("ผู้สมัครยืนยัน / โควตา")}</th>
                              <th>{tx("เข้าไปจัดการ")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accessibleOrgEvents.map((ev) => {
                              const confirmed = orgRegistrations.filter(
                                (r) =>
                                  r.eventId === ev.id &&
                                  r.registrationStatus === 'confirmed'
                              ).length;
                              return (
                                <tr key={ev.id}>
                                  <td>
                                    <strong>{tx(ev.titleTh)}</strong>
                                    <div className="muted-inline">
                                      <span className="mono-code">{tx(ev.code)}</span>{' '}
                                      · {tx(ev.province)} {tx(" · ร้านค้า")}{' '}
                                      {tx(ev.products.length)} {tx(" รายการ")}
                                    </div>
                                  </td>
                                  <td className="mono-num">{tx(ev.eventDate)}</td>
                                  <td>
                                    <EventStatusBadge status={ev.status} />
                                  </td>
                                  <td>{feePolicyLabel(ev.feeBearerPolicy)}</td>
                                  <td className="num-col mono-num">
                                    <strong>{tx(confirmed)}</strong> /{' '}
                                    {tx(ev.totalEventQuota)}
                                  </td>
                                  <td>
                                    <div className="cta-inline-row">
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() =>
                                          onSelectEvent(
                                            ev.id,
                                            role === 'staff'
                                              ? 'evt_checkin_bib'
                                              : 'evt_overview'
                                          )
                                        }
                                      >
                                        {tx("จัดการงานนี้")}
                                      </button>
                                      {canManageEventConfig && (
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          onClick={() =>
                                            onSelectEvent(
                                              ev.id,
                                              'evt_pricing_quota'
                                            )
                                          }
                                        >
                                          {tx("โควตา & คำถามสมัคร")}
                                        </button>
                                      )}
                                      {canCheckIn &&
                                        ev.status === 'published' && (
                                          <button
                                            type="button"
                                            className="btn-ghost-sm"
                                            onClick={() =>
                                              onSelectEvent(
                                                ev.id,
                                                'evt_checkin_bib'
                                              )
                                            }
                                          >
                                            {tx("เช็กอิน BIB")}
                                          </button>
                                        )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </section>

                    {/* Zone 4: Audit Log */}
                    <section className="clean-panel">
                      <h2>{tx("ประวัติการทำรายการล่าสุดในองค์กร")}</h2>
                      <div className="audit-list">
                        {auditLogs
                          .filter((l) => l.organizationId === activeOrg.id)
                          .slice(0, 5)
                          .map((log) => (
                            <div key={log.id} className="audit-row">
                              <span className="mono-code">{tx(log.timestamp)}</span>
                              <strong>{tx(log.actorName)}</strong>
                              <span className="muted-inline">
                                ({tx(log.actorRole)})
                              </span>
                              <span>{tx(log.actionSummary)}</span>
                              <code className="audit-diff">
                                {tx(log.detailChange)}
                              </code>
                            </div>
                          ))}
                      </div>
                    </section>
                  </>
                )}
              </div>
            )}

            {/* ================= 2. ORG EVENTS & WIZARD ================= */}
            {activeSection === 'org_events' && (
              <div className="canvas-stack">
                <div className="page-heading-row">
                  <div className="page-guide-header">
                    <h1>{tx("รายการงานวิ่งและสร้างงานใหม่")}</h1>
                    <p className="page-purpose-desc">
                      {tx("ใช้สร้างงานวิ่งแบบร่างใหม่ (พร้อมแจ้งขอให้ทีมช่วยผลิตเสื้อ/เหรียญได้) หรือทำสำเนาโครงสร้างงานเดิมไปจัดปีถัดไปโดยไม่คัดลอกข้อมูลส่วนบุคคลผู้สมัคร")}
                    </p>
                  </div>
                  {canManageEventConfig && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowNewDraftForm((v) => !v)}
                    >
                      <IconPlus size={15} />
                      <span>
                        {showNewDraftForm ? tx("ปิดฟอร์มสร้างงาน") : tx("สร้างงานแบบร่าง")}
                      </span>
                    </button>
                  )}
                </div>

                {showNewDraftForm && canManageEventConfig && (
                  <form
                    className="clean-panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newDraftTitle.trim()) return;
                      onCreateDraftEvent({
                        orgId: activeOrg.id,
                        titleTh: newDraftTitle.trim(),
                        province: newDraftProvince.trim(),
                        eventDate: newDraftDate,
                        requestProductionHelp: requestProdHelp,
                      });
                      setNewDraftTitle('');
                      setShowNewDraftForm(false);
                    }}
                  >
                    <h2>{tx("สร้างงานวิ่งแบบร่างใหม่ (บันทึกและแก้ไขต่อได้ก่อนเปิดขาย)")}</h2>
                    <div className="form-grid-3">
                      <div className="form-row">
                        <label htmlFor="nd-title">{tx("ชื่องานวิ่งภาษาไทย")}</label>
                        <input
                          id="nd-title"
                          type="text"
                          value={newDraftTitle}
                          onChange={(e) => setNewDraftTitle(e.target.value)}
                          placeholder={tx("เช่น ขอนแก่น ซิตี้ รัน 2027")}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="nd-prov">{tx("จังหวัด")}</label>
                        <input
                          id="nd-prov"
                          type="text"
                          value={newDraftProvince}
                          onChange={(e) => setNewDraftProvince(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="nd-date">{tx("วันจัดงาน (YYYY-MM-DD)")}</label>
                        <input
                          id="nd-date"
                          type="text"
                          className="mono-num"
                          value={newDraftDate}
                          onChange={(e) => setNewDraftDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <label
                      className="checkbox-row"
                      style={{ margin: '0.85rem 0' }}
                    >
                      <input
                        type="checkbox"
                        checked={requestProdHelp}
                        onChange={(e) => setRequestProdHelp(e.target.checked)}
                      />
                      <span>
                        {tx("ต้องการขอใบเสนอราคาให้ทีม กระต่าย ช่วยออกแบบ/ผลิตเสื้อแข่งขันและเหรียญรางวัลสำหรับงานนี้ด้วย")}
                      </span>
                    </label>

                    <button type="submit" className="btn-primary">
                      {tx("บันทึกแบบร่างและเปิดหน้าตั้งค่างาน")}
                    </button>
                  </form>
                )}

                <div className="filter-bar-panel">
                  <div className="filter-field filter-search">
                    <label htmlFor="ev-q">{tx("ค้นหาชื่องานหรือรหัสงาน")}</label>
                    <div className="input-with-icon">
                      <IconSearch size={16} />
                      <input
                        id="ev-q"
                        type="search"
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder={tx("พิมพ์ชื่องาน จังหวัด หรือรหัส...")}
                      />
                    </div>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="ev-st">{tx("กรองตามสถานะ")}</label>
                    <select
                      id="ev-st"
                      value={eventStatusFilter}
                      onChange={(e) =>
                        setEventStatusFilter(
                          e.target.value as 'all' | EventStatus
                        )
                      }
                    >
                      <option value="all">{tx("ทุกสถานะ")}</option>
                      <option value="published">{tx("กำลังเปิดรับสมัคร")}</option>
                      <option value="draft">{tx("แบบร่าง")}</option>
                      <option value="in_review">{tx("รอตรวจอนุมัติ")}</option>
                      <option value="completed">{tx("จบงานแล้ว")}</option>
                      <option value="suspended">{tx("ระงับชั่วคราว")}</option>
                    </select>
                  </div>
                </div>

                <section className="clean-panel">
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("รหัส / ชื่องานวิ่ง")}</th>
                          <th>{tx("วันจัด / จังหวัด")}</th>
                          <th>{tx("สถานะ")}</th>
                          <th className="num-col">{tx("โควตารวม")}</th>
                          <th>{tx("การจัดการ")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrgEvents.map((ev) => (
                          <tr key={ev.id}>
                            <td>
                              <span className="mono-code">{tx(ev.code)}</span>
                              <div>
                                <strong>{tx(ev.titleTh)}</strong>
                              </div>
                            </td>
                            <td>
                              <span className="mono-num">{tx(ev.eventDate)}</span> ·{' '}
                              {tx(ev.province)}
                            </td>
                            <td>
                              <EventStatusBadge status={ev.status} />
                            </td>
                            <td className="num-col mono-num">
                              {tx(ev.totalEventQuota)} {tx(" คน")}
                            </td>
                            <td>
                              <div className="cta-inline-row">
                                <button
                                  type="button"
                                  className="btn-primary"
                                  onClick={() =>
                                    onSelectEvent(ev.id, 'evt_overview')
                                  }
                                >
                                  {tx("เปิดจัดการ")}
                                </button>
                                {canManageEventConfig && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() =>
                                      onSelectEvent(ev.id, 'evt_pricing_quota')
                                    }
                                  >
                                    {tx("โควตา & คำถามสมัคร")}
                                  </button>
                                )}
                                {canManageEventConfig && (
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() =>
                                      onDuplicateEventWithoutPii(ev.id)
                                    }
                                  >
                                    <IconCopy size={14} />
                                    <span>{tx("คัดลอกงานไปปีหน้า (ไม่คัดลอก PII)")}</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 3. ORG MERCHANDISE & PRODUCTION QUOTES ================= */}
            {activeSection === 'org_merch_production' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("ร้านค้าและคำขอใบเสนอราคาผลิตเสื้อ/เหรียญขององค์กร")}</h1>
                  <p className="page-purpose-desc">
                    {tx("ใช้ติดตามคำสั่งซื้อของที่ระลึกจากลูกค้าทั่วไปข้ามทุกงานวิ่ง และตรวจสถานะคำขอราคา/งานสั่งผลิตเสื้อและเหรียญขององค์กร")}
                  </p>
                </div>

                <section className="clean-panel">
                  <h2>{tx("คำขอใบเสนอราคาและงานสั่งผลิตเสื้อ/เหรียญ (Production Inquiries)")}</h2>
                  <p className="muted-block">
                    {tx("แยกสถานะใบเสนอราคา การอนุมัติแบบ และสถานะการผลิตออกจากกัน (คำขอราคายังไม่ใช่คำสั่งเริ่มผลิตจนกว่าจะยืนยันแบบ จำนวน และเงื่อนไขชำระ)")}
                  </p>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("รหัสคำขอ")}</th>
                          <th>{tx("รายการสั่งทำ / เวอร์ชันแบบ")}</th>
                          <th className="num-col">{tx("สูตรคำนวณยอดผลิตสุทธิ")}</th>
                          <th>{tx("กำหนดรับของ")}</th>
                          <th>{tx("สถานะราคา & การผลิต")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productionInquiries
                          .filter((q) => q.organizationId === activeOrg.id)
                          .map((rfq) => (
                            <tr key={rfq.id}>
                              <td className="mono-code">{tx(rfq.inquiryCode)}</td>
                              <td>
                                <strong>{tx(rfq.itemType)}</strong>
                                <div className="muted-inline">
                                  {tx(rfq.artworkVersion)}
                                </div>
                              </td>
                              <td className="num-col mono-num">
                                {tx("สิทธิ์สมัคร ")} {tx(rfq.packageEntitlementQty)} {tx(" + ร้านค้า")}{' '}
                                {tx(rfq.addonStoreQty)} {tx(" + สำรอง")} {tx(rfq.organizerBufferQty)}{' '}
                                {tx("− มีอยู่ ")} {tx(rfq.existingStockDeductedQty)} ={' '}
                                <strong>{tx(rfq.netQtyToProduce)} {tx(" ชิ้น")}</strong>
                              </td>
                              <td className="mono-num">
                                {tx(rfq.targetDeliveryDate)}
                              </td>
                              <td>
                                <span className="status-pill badge-navy">
                                  <IconClock size={13} />
                                  <span>
                                    {rfq.quoteStatus === 'quoted_demo'
                                      ? tx("ส่งใบเสนอราคาแล้ว")
                                      : rfq.quoteStatus === 'accepted'
                                        ? tx("อนุมัติราคาแล้ว")
                                        : rfq.quoteStatus === 'submitted'
                                          ? tx("ส่งคำขอราคาแล้ว")
                                          : tx("ร่างคำขอราคา")}
                                  </span>
                                </span>{' '}
                                <span className="status-pill badge-amber">
                                  <IconClock size={13} />
                                  <span>
                                    {rfq.productionStatus === 'awaiting_approval'
                                      ? tx("รออนุมัติแบบก่อนผลิต")
                                      : rfq.productionStatus === 'ready_to_produce'
                                        ? tx("พร้อมเริ่มผลิต")
                                        : rfq.productionStatus === 'in_production'
                                          ? tx("กำลังผลิต")
                                          : tx("ตรวจ QC ผ่านแล้ว")}
                                  </span>
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="clean-panel">
                  <h2>
                    {tx("คำสั่งซื้อสินค้าที่ระลึกข้ามทุกงานในองค์กร (")}
                    <span className="mono-num">{tx(orgMerchOrders.length)}</span>{' '}
                    {tx("รายการ)")}
                  </h2>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("รหัสออเดอร์")}</th>
                          <th>{tx("ผู้ซื้อ")}</th>
                          <th>{tx("สินค้า / ขนาด")}</th>
                          <th className="num-col">{tx("จำนวน (ส่งมอบแล้ว)")}</th>
                          <th className="num-col">{tx("ยอดชำระรวม")}</th>
                          <th>{tx("วิธีรับของ")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgMerchOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="mono-code">{tx(ord.merchOrderCode)}</td>
                            <td>{tx(ord.buyerName)}</td>
                            <td>
                              <strong>{tx(ord.productNameTh)}</strong> (
                              {tx(ord.variantSize)})
                            </td>
                            <td className="num-col mono-num">
                              {tx(ord.deliveredQty)} / {tx(ord.quantity)} {tx(" ชิ้น")}
                            </td>
                            <td className="num-col mono-num">
                              {formatThb(ord.totalPaidSatang, true)}
                            </td>
                            <td>
                              {ord.deliveryMethod === 'pickup_at_expo'
                                ? txf("รับหน้างาน ({0})", ord.pickupToken)
                                : tx("จัดส่งไปรษณีย์")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}

            {/* ================= 4. ORG FINANCE ================= */}
            {activeSection === 'org_finance' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("การเงินรวมขององค์กรและตัวจำลองค่าบริการ")}</h1>
                  <p className="page-purpose-desc">
                    {tx("ใช้ตรวจยอดโอนเงินเข้าบัญชีองค์กร เปรียบเทียบนโยบายผู้รับภาระค่าบริการ และส่งออกรายงานกระทบยอดทางบัญชี")}
                  </p>
                </div>

                <BibLedgerStrip
                  scopeTitle={`บัญชีรวมระดับองค์กร: ${activeOrg.nameTh}`}
                  scopeCode={activeOrg.code}
                  metrics={orgMetrics}
                  timeWindow={timeWindow}
                  canViewFinance={canViewFinance}
                  onDrillDown={handleDrillDown}
                />

                <section className="clean-panel">
                  <h2>{tx("เครื่องคำนวณเปรียบเทียบผู้รับภาระค่าบริการ (อัตราจำลอง 5% + ฿15)")}</h2>
                  <div className="sim-input-bar">
                    <label htmlFor="sim-baht-slider">
                      {tx("ทดลองเลื่อนราคาค่าสมัครหน้าป้ายต่อคน:")}{' '}
                      <strong className="mono-num">
                        {formatThb(calcSamplePriceBaht * 100)}
                      </strong>
                    </label>
                    <input
                      id="sim-baht-slider"
                      type="range"
                      min={300}
                      max={2500}
                      step={50}
                      value={calcSamplePriceBaht}
                      onChange={(e) =>
                        setCalcSamplePriceBaht(Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("นโยบายที่ผู้จัดเลือก")}</th>
                          <th className="num-col">{tx("ราคาหน้าป้าย")}</th>
                          <th className="num-col">{tx("นักวิ่งจ่ายสุทธิ")}</th>
                          <th className="num-col">{tx("หักค่าบริการฝั่งผู้จัด")}</th>
                          <th className="num-col">{tx("ผู้จัดได้รับสุทธิ")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            'runner_pays',
                            'organizer_absorbs',
                            'split_50_50',
                          ] as FeeBearerPolicy[]
                        ).map((pol) => {
                          const q = calculateFeeQuote(
                            calcSamplePriceBaht * 100,
                            pol
                          );
                          return (
                            <tr key={pol}>
                              <td>
                                <strong>{feePolicyLabel(pol)}</strong>
                              </td>
                              <td className="num-col mono-num">
                                {formatThb(q.baseSatang, true)}
                              </td>
                              <td className="num-col mono-num">
                                <strong>
                                  {formatThb(q.runnerNetPaySatang, true)}
                                </strong>
                              </td>
                              <td className="num-col mono-num text-danger">
                                −{formatThb(q.organizerFeeSatang, true)}
                              </td>
                              <td className="num-col mono-num text-forest">
                                <strong>
                                  {formatThb(q.organizerNetReceiveSatang, true)}
                                </strong>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section id="finance-source-ledger" className="clean-panel">
                  <div className="section-title-bar">
                    <h2>{tx("รายการธุรกรรมและรอบโอนเงินตามตัวกรอง")}</h2>
                    <div className="cta-inline-row">
                      {(
                        [
                          ['all', 'รอบโอนทั้งหมด'],
                          ['payments', 'รายการรับชำระ'],
                          ['refunds', 'รายการคืนเงิน'],
                          ['payouts', 'รอบโอนสุทธิ'],
                        ] as const
                      ).map(([k, lbl]) => (
                        <button
                          key={k}
                          type="button"
                          className={
                            financeSubFilter === k
                              ? 'btn-primary'
                              : 'btn-ghost-sm'
                          }
                          onClick={() => setFinanceSubFilter(k)}
                        >
                          {tx(lbl)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setExportBannerText(
                            txf("สร้างไฟล์รายงานการเงิน CSV ของ {0} เรียบร้อยแล้ว", activeOrg.code)
                          )
                        }
                      >
                        <IconDownload size={15} />
                        <span>{tx("ส่งออกรายงาน CSV")}</span>
                      </button>
                    </div>
                  </div>

                  {(financeSubFilter === 'payments' ||
                    financeSubFilter === 'refunds') && (
                      <div
                        className="table-scroll"
                        style={{ marginBottom: '1rem' }}
                      >
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>{tx("คำสั่งซื้อ")}</th>
                              <th>{tx("ผู้เข้าแข่งขัน")}</th>
                              <th>{tx("สถานะรับเงิน")}</th>
                              <th className="num-col">{tx("ยอดรับชำระ")}</th>
                              <th>{tx("สถานะคืนเงิน")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orgRegistrations
                              .filter((r) =>
                                financeSubFilter === 'payments'
                                  ? r.paymentStatus === 'succeeded' &&
                                  isWithinTimeWindow(r.paidAt, timeWindow)
                                  : r.refundStatus !== 'none'
                              )
                              .map((r) => (
                                <tr key={r.id}>
                                  <td className="mono-code">{tx(r.orderCode)}</td>
                                  <td>{tx(r.participantNameTh)}</td>
                                  <td>
                                    <PaymentStatusBadge
                                      status={r.paymentStatus}
                                    />
                                  </td>
                                  <td className="num-col mono-num">
                                    {formatThb(
                                      r.snapshotTotalChargedSatang,
                                      true
                                    )}
                                  </td>
                                  <td>
                                    <RefundStatusBadge status={r.refundStatus} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  {(financeSubFilter === 'all' ||
                    financeSubFilter === 'payouts') && (
                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>{tx("รหัสรอบโอน")}</th>
                              <th>{tx("รายละเอียดงวด")}</th>
                              <th>{tx("กำหนดโอน")}</th>
                              <th className="num-col">{tx("รับชำระรวม")}</th>
                              <th className="num-col">{tx("หักคืนเงิน")}</th>
                              <th className="num-col">{tx("ยอดโอนเข้าบัญชีสุทธิ")}</th>
                              <th>{tx("สถานะ")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payouts
                              .filter((p) => p.organizationId === activeOrg.id)
                              .map((po) => (
                                <tr key={po.id}>
                                  <td className="mono-code">{tx(po.payoutCode)}</td>
                                  <td>{tx(po.periodLabel)}</td>
                                  <td className="mono-num">{tx(po.scheduledDate)}</td>
                                  <td className="num-col mono-num">
                                    {formatThb(po.grossSucceededSatang, true)}
                                  </td>
                                  <td className="num-col mono-num text-danger">
                                    −{formatThb(po.deductedRefundSatang, true)}
                                  </td>
                                  <td className="num-col mono-num text-vermilion">
                                    <strong>
                                      {formatThb(po.netPayoutSatang, true)}
                                    </strong>
                                  </td>
                                  <td>
                                    <PayoutStatusBadge status={po.status} />
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                </section>
              </div>
            )}

            {/* ================= 5. ORG TEAM & BANK SETTINGS ================= */}
            {activeSection === 'org_team_settings' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("ทีมงานและบัญชีรับเงินขององค์กร")}</h1>
                  <p className="page-purpose-desc">
                    {tx("ใช้ตรวจสถานะบัญชีธนาคารรับยอดนำส่ง และสร้างรหัสคำเชิญแบบใช้ครั้งเดียวเพื่อเชิญทีมงานเข้าดูแลเฉพาะบทบาท")}
                  </p>
                </div>

                <section className="clean-panel">
                  <h2>{tx("ข้อมูลองค์กรผู้จัดและบัญชีรับเงิน")}</h2>
                  <div className="org-settings-summary">
                    <div>
                      <p>
                        <strong>{tx("องค์กร:")}</strong> {tx(activeOrg.nameTh)} (
                        <span className="mono-code">{tx(activeOrg.code)}</span>)
                      </p>
                      <p>
                        <strong>{tx("บัญชีรับโอนรายได้:")}</strong>{' '}
                        {tx(activeOrg.payoutBankSummary)}
                      </p>
                    </div>
                    <span
                      className={`status-pill ${activeOrg.payoutReady ? 'badge-forest' : 'badge-amber'
                        }`}
                    >
                      {activeOrg.payoutReady ? (
                        <IconCheckCircle size={14} />
                      ) : (
                        <IconAlert size={14} />
                      )}
                      <span>
                        {activeOrg.payoutReady
                          ? tx("บัญชีรับเงินพร้อมใช้งานแล้ว")
                          : tx("รอยืนยันเอกสารบัญชีรับเงิน")}
                      </span>
                    </span>
                  </div>
                  {!canManageOrgBank && (
                    <div className="finance-restricted-note">
                      {tx("บทบาทปัจจุบันไม่อนุญาตให้แก้ไขเลขบัญชีรับเงินขององค์กร (สงวนสิทธิ์เฉพาะเจ้าขององค์กร)")}
                    </div>
                  )}
                </section>

                <section className="clean-panel">
                  <div className="section-title-bar">
                    <h2>{tx("รหัสคำเชิญเข้าร่วมทีม (ใช้ได้ครั้งเดียวและมีวันหมดอายุ)")}</h2>
                    {canManageOrgBank && (
                      <div className="cta-inline-row">
                        <select
                          aria-label={tx("เลือกบทบาทที่จะเชิญ")}
                          value={inviteRolePick}
                          onChange={(e) =>
                            setInviteRolePick(e.target.value as OrgRole)
                          }
                        >
                          <option value="staff">{tx("เจ้าหน้าที่จุดรับอุปกรณ์")}</option>
                          <option value="event_manager">{tx("ผู้จัดการงาน")}</option>
                          <option value="finance">{tx("ฝ่ายการเงิน")}</option>
                        </select>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            onCreateSingleUseInvite(
                              activeOrg.id,
                              inviteRolePick
                            )
                          }
                        >
                          <IconPlus size={15} />
                          <span>{tx("ออกรหัสคำเชิญใหม่")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("รหัสคำเชิญ")}</th>
                          <th>{tx("บทบาทที่ได้รับ")}</th>
                          <th>{tx("หมดอายุ")}</th>
                          <th>{tx("สถานะการใช้งาน")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invitations
                          .filter((i) => i.organizationId === activeOrg.id)
                          .map((inv) => (
                            <tr key={inv.id}>
                              <td className="mono-code">{tx(inv.inviteCode)}</td>
                              <td>{tx(roleNameMap[inv.role])}</td>
                              <td className="mono-num">{tx(inv.expiresAt)}</td>
                              <td>
                                {inv.usedByUserId ? (
                                  <span className="status-pill badge-neutral">
                                    <IconLock size={13} />
                                    <span>{tx("ถูกใช้งานแล้ว (")}{tx(inv.usedByUserId)})</span>
                                  </span>
                                ) : (
                                  <span className="status-pill badge-forest">
                                    <IconCheckCircle size={13} />
                                    <span>{tx("พร้อมส่งให้สมาชิกกดรับสิทธิ์")}</span>
                                  </span>
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

            {/* ================= 6. EVENT OVERVIEW & LIFECYCLE ================= */}
            {selectedEvent && (
              <nav
                className="clean-panel"
                aria-label={tx("แถบสลับหมวดเจาะลึกภายใน Event Dashboard")}
                style={{ padding: '0.65rem 0.9rem' }}
              >
                <div
                  className="cta-inline-row"
                  style={{ justifyContent: 'space-between', width: '100%' }}
                >
                  <div className="cta-inline-row">
                    <span className="priority-chip chip-p1">Event Dashboard</span>
                    <strong>{tx(selectedEvent.titleTh)}</strong>
                    <span className="mono-code">{tx(selectedEvent.code)}</span>
                  </div>
                  <div className="priority-pill-bar">
                    <button
                      type="button"
                      className={`filter-pill ${
                        activeSection === 'evt_overview' ? 'active' : ''
                      }`}
                      onClick={() => onSelectSection('evt_overview')}
                    >
                      {tx("ภาพรวม & กราฟเจาะลึก")}
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${
                        activeSection === 'evt_pricing_quota' ? 'active' : ''
                      }`}
                      onClick={() => onSelectSection('evt_pricing_quota')}
                    >
                      {tx("โควตา & คำถามสมัคร")}
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${
                        activeSection === 'evt_participants' ? 'active' : ''
                      }`}
                      onClick={() => onSelectSection('evt_participants')}
                    >
                      {tx("นักวิ่ง (")}
                      {
                        tx(orgRegistrations.filter(
                          (r) => r.eventId === selectedEvent.id
                        ).length)
                      }
                      )
                    </button>
                    {canViewFinance && (
                      <button
                        type="button"
                        className={`filter-pill ${
                          activeSection === 'evt_finance' ? 'active' : ''
                        }`}
                        onClick={() => onSelectSection('evt_finance')}
                      >
                        {tx("การชำระเงิน & คืนเงิน")}
                      </button>
                    )}
                    {canCheckIn && (
                      <button
                        type="button"
                        className={`filter-pill ${
                          activeSection === 'evt_checkin_bib' ? 'active' : ''
                        }`}
                        onClick={() => onSelectSection('evt_checkin_bib')}
                      >
                        {tx("Check-in & จ่าย BIB")}
                      </button>
                    )}
                    <button
                      type="button"
                      className={`filter-pill ${
                        activeSection === 'evt_storefront' ? 'active' : ''
                      }`}
                      onClick={() => onSelectSection('evt_storefront')}
                    >
                      {tx("ร้านค้าของที่ระลึก")}
                    </button>
                  </div>
                </div>
              </nav>
            )}

            {selectedEvent &&
              activeSection === 'evt_overview' &&
              eventMetrics && (
                <div className="canvas-stack">
                  <div className="page-guide-header">
                    <h1>
                      {tx("Event Dashboard — เจาะลึกงานวิ่ง: ")} {tx(selectedEvent.titleTh)}
                    </h1>
                    <p className="page-purpose-desc">
                      {tx("เจาะลึกข้อมูลเฉพาะงานวิ่งนี้ครบทั้งยอดสมัคร รายได้ โควตา รายชื่อนักวิ่ง การชำระเงิน และสถานะ Check-in หน้างาน")}
                    </p>
                  </div>

                  <EventMediaManager
                    event={selectedEvent}
                    canEdit={canManageEventConfig}
                    onSave={(patch) =>
                      onUpdateEventMedia?.(selectedEvent.id, patch)
                    }
                  />

                  {/* Clear Lifecycle Progress Guide */}
                  <div
                    className="lifecycle-stepper"
                    aria-label={tx("ช่วงชีวิตของงานวิ่งนี้")}
                  >
                    {(
                      [
                        ['1. เตรียมข้อมูลร่าง', selectedEvent.status === 'draft'],
                        [
                          '2. รอตรวจอนุมัติ',
                          selectedEvent.status === 'in_review',
                        ],
                        [
                          '3. เปิดรับสมัคร & เตรียม BIB',
                          selectedEvent.status === 'published',
                        ],
                        [
                          '4. ปิดงาน & ประกาศผล/รูป',
                          selectedEvent.status === 'completed',
                        ],
                      ] as const
                    ).map(([label, isActive], idx) => (
                      <div
                        key={idx}
                        className={`lifecycle-step ${isActive ? 'active' : ''
                          }`}
                      >
                        <strong>{tx(label)}</strong>
                      </div>
                    ))}
                  </div>

                  {selectedEvent.statusNote && (
                    <div className="status-explanation-banner">
                      <IconAlert size={17} />
                      <span>{tx(selectedEvent.statusNote)}</span>
                    </div>
                  )}

                  <BibLedgerStrip
                    scopeTitle={`สรุปเฉพาะงาน: ${selectedEvent.titleTh}`}
                    scopeCode={selectedEvent.code}
                    metrics={eventMetrics}
                    timeWindow={timeWindow}
                    canViewFinance={canViewFinance}
                    onDrillDown={handleDrillDown}
                  />

                  <OrganizerAnalyticsCharts
                    scopeMode="event"
                    scopeTitle={selectedEvent.titleTh}
                    events={accessibleOrgEvents}
                    selectedEvent={selectedEvent}
                    registrations={orgRegistrations}
                    merchOrders={orgMerchOrders}
                    metrics={eventMetrics}
                    timeWindow={timeWindow}
                    canViewFinance={canViewFinance}
                    canManageEventConfig={canManageEventConfig}
                    canCheckIn={canCheckIn}
                    onDrillDownStatus={(st) => handleDrillDown(st)}
                    onDrillDownFinance={(t) => handleDrillDown(t)}
                    onSelectEventAction={(evId, sec) =>
                      onSelectEvent(evId, sec)
                    }
                  />

                  <div className="two-col-ops-grid">
                    <section className="clean-panel">
                      <h2>{tx("Checklist ความพร้อมก่อนเผยแพร่งาน")}</h2>
                      <div className="checklist-rows">
                        {selectedEvent.readinessChecks.map((chk) => (
                          <div key={chk.id} className="checklist-row">
                            <span
                              className={`status-pill ${chk.passed ? 'badge-forest' : 'badge-amber'
                                }`}
                            >
                              {chk.passed ? (
                                <IconCheckCircle size={14} />
                              ) : (
                                <IconAlert size={14} />
                              )}
                              <span>
                                {chk.passed ? tx("พร้อมแล้ว") : tx("ต้องจัดการ")}
                              </span>
                            </span>
                            <div>
                              <strong>{tx(chk.label)}</strong>
                              <div className="muted-inline">
                                {tx(chk.fixTargetHint)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedEvent.status === 'draft' &&
                        canManageEventConfig && (
                          <div className="panel-footer-cta">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() =>
                                onCompleteDraftReadinessAndSubmit(
                                  selectedEvent.id
                                )
                              }
                            >
                              {tx("บันทึกข้อมูลที่ขาดและส่งตรวจอนุมัติเผยแพร่")}
                            </button>
                          </div>
                        )}
                    </section>

                    <section className="clean-panel">
                      <h2>{tx("ผู้รับภาระค่าบริการและภาพรวมการรับของหน้างาน")}</h2>
                      <div className="form-row">
                        <label htmlFor="ev-pol-sel">
                          {tx("ผู้รับภาระค่าบริการ (มีผลกับใบสมัครใหม่ทันที)")}
                        </label>
                        <select
                          id="ev-pol-sel"
                          value={selectedEvent.feeBearerPolicy}
                          disabled={!canManageEventConfig}
                          onChange={(e) =>
                            onUpdateFeeBearerPolicy(
                              selectedEvent.id,
                              e.target.value as FeeBearerPolicy
                            )
                          }
                        >
                          <option value="runner_pays">
                            {tx("นักวิ่งรับภาระค่าบริการ (แสดงราคาสุทธิก่อนจ่าย)")}
                          </option>
                          <option value="organizer_absorbs">
                            {tx("ผู้จัดรับภาระค่าบริการ (นักวิ่งจ่ายตรงราคาป้าย)")}
                          </option>
                          <option value="split_50_50">
                            {tx("แบ่งรับภาระคนละครึ่ง 50 / 50")}
                          </option>
                        </select>
                      </div>

                      <div className="ops-quick-stats">
                        <div>
                          <span className="muted-inline">
                            {tx("นักวิ่งรับเสื้อและ BIB แล้ว")}
                          </span>
                          <strong className="mono-num">
                            {tx(eventMetrics.kitPickedUpCount)} /{' '}
                            {tx(eventMetrics.confirmedParticipants)} {tx(" คน")}
                          </strong>
                        </div>
                        <div>
                          <span className="muted-inline">
                            {tx("ยืนยันสิทธิ์แต่ยังไม่มีเลข BIB")}
                          </span>
                          <strong className="mono-num text-amber">
                            {tx(eventMetrics.unassignedBibCount)} {tx(" คน")}
                          </strong>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
              )}

            {/* ================= 7. EVENT PRICING, SHIRT SIZES & PRODUCTION QUOTE ================= */}
            {selectedEvent && activeSection === 'evt_pricing_quota' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("ระยะแข่งขัน โควตาผู้สมัคร คำถามใบสมัคร และยอดไซส์เสื้อ")}</h1>
                  <p className="page-purpose-desc">
                    {tx("ปรับจำนวนรับสมัครรายระยะและเพดานรวม (ห้ามต่ำกว่ายอดที่สมัครและกันโควตาแล้ว) เพิ่มคำถามเพิ่มเติมในใบสมัคร และคำนวณยอดเสื้อสุทธิเพื่อขอราคาผลิตโดยไม่นับซ้ำ")}
                  </p>
                </div>

                <section className="clean-panel">
                  <div className="section-title-bar">
                    <h2>{tx("ระยะการแข่งขัน ช่วงราคา และการปรับโควตาผู้สมัคร")}</h2>
                  </div>

                  <div className="total-quota-banner">
                    <QuotaEditorRow
                      categoryName="เพดานรับผู้สมัครรวมทั้งงาน (Total Event Quota)"
                      maxQuota={selectedEvent.totalEventQuota}
                      registeredCount={eventMetrics?.confirmedParticipants ?? 0}
                      reservedCount={
                        eventMetrics?.pendingPaymentReservations ?? 0
                      }
                      canEdit={canManageEventConfig}
                      onSaveQuota={(nextTotal) =>
                        onUpdateEventTotalQuota(selectedEvent.id, nextTotal)
                      }
                    />
                  </div>

                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("ระยะแข่งขัน")}</th>
                          <th>{tx("ปล่อยตัว / Cut-off")}</th>
                          <th>{tx("รหัสหน้า BIB")}</th>
                          <th>{tx("ช่วงราคา")}</th>
                          <th className="num-col">{tx("ราคาสุทธินักวิ่ง")}</th>
                          <th>{tx("โควตารายระยะ (ปรับเพิ่ม/ลดได้)")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEvent.categories.map((cat) => {
                          const curTier = getCurrentTier(cat);
                          const quote = calculateFeeQuote(
                            curTier.priceSatang,
                            selectedEvent.feeBearerPolicy
                          );
                          const catConfirmed = orgRegistrations.filter(
                            (r) =>
                              r.eventId === selectedEvent.id &&
                              r.categoryId === cat.id &&
                              r.registrationStatus === 'confirmed'
                          ).length;
                          const catReserved = orgRegistrations.filter(
                            (r) =>
                              r.eventId === selectedEvent.id &&
                              r.categoryId === cat.id &&
                              r.registrationStatus === 'pending_payment'
                          ).length;
                          return (
                            <tr key={cat.id}>
                              <td>
                                <strong>{tx(cat.name)}</strong>{' '}
                                <span
                                  className={`category-bib-chip tone-${cat.colorTag}`}
                                >
                                  {tx(cat.code)}
                                </span>
                              </td>
                              <td className="mono-num">
                                {tx(cat.startTimeLocal)} {tx(" น. (")}{tx(cat.cutoffHours)} {tx(" ชม.)")}
                              </td>
                              <td className="mono-code">{tx(cat.bibPrefix)}-xxxx</td>
                              <td>
                                {cat.priceTiers.map((t) => (
                                  <div key={t.id} className="tier-line">
                                    <span
                                      className={
                                        t.isCurrent
                                          ? 'tier-active-dot'
                                          : 'muted-inline'
                                      }
                                    >
                                      {tx(t.label)}:{' '}
                                      <span className="mono-num">
                                        {formatThb(t.priceSatang)}
                                      </span>{' '}
                                      (<span className="mono-num">{tx(t.startsAt)}</span>{' '}
                                      {tx("ถึง")}{' '}
                                      <span className="mono-num">{tx(t.endsAt)}</span>)
                                      {t.isCurrent ? tx(" [ใช้อยู่]") : ''}
                                    </span>
                                  </div>
                                ))}
                              </td>
                              <td className="num-col mono-num">
                                <strong>
                                  {formatThb(quote.runnerNetPaySatang, true)}
                                </strong>
                              </td>
                              <td>
                                <QuotaEditorRow
                                  categoryName={cat.name}
                                  maxQuota={cat.categoryQuota}
                                  registeredCount={catConfirmed}
                                  reservedCount={catReserved}
                                  canEdit={canManageEventConfig}
                                  compact
                                  onSaveQuota={(nextQuota) =>
                                    onUpdateCategoryQuota(
                                      selectedEvent.id,
                                      cat.id,
                                      nextQuota
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <CategoryAgeRulesPanel
                  event={selectedEvent}
                  registrations={orgRegistrations}
                  canEdit={canManageEventConfig}
                  onSave={(categoryId, config) =>
                    onUpdateCategoryAgeRules(selectedEvent.id, categoryId, config)
                  }
                />

                <CustomFieldsManager
                  event={selectedEvent}
                  fields={selectedEvent.customFields}
                  canEdit={canManageEventConfig}
                  templates={formTemplates}
                  steps={registrationSteps}
                  fieldRequests={fieldRequests}
                  requesterName={currentUser.fullNameTh}
                  onChange={(nextFields) =>
                    onUpdateCustomFields(selectedEvent.id, nextFields)
                  }
                  onSelectTemplate={(tplId) =>
                    onSelectEventTemplate?.(selectedEvent.id, tplId)
                  }
                  onSubmitFieldRequest={(payload) =>
                    onSubmitOrganizerFieldRequest?.(payload)
                  }
                />

                <section className="clean-panel canvas-stack">
                  <h2>{tx("สต็อกเสื้อตามสิทธิ์สมัคร ตารางไซส์เฉพาะงาน และเครื่องมือขอราคาผลิตจากยอดจริง")}</h2>
                  <div className="shirt-stock-strip">
                    {selectedEvent.shirtStocks.map((st) => {
                      const left = Math.max(
                        0,
                        st.total - st.reservedOrConfirmed
                      );
                      const spec = resolveShirtSpec(
                        st.size,
                        'Unisex',
                        platformProfileConfig.shirtSizes,
                        selectedEvent.customSizeChart
                      );
                      return (
                        <div key={st.size} className="shirt-size-cell">
                          <span className="shirt-size-tag">{tx("ไซส์")} {tx(st.size)}</span>
                          <strong className="mono-num">
                            {tx("ว่าง ")} {tx(left)} / {tx(st.total)}
                          </strong>
                          <span className="muted-inline mono-num">
                            {tx("รอบอก")} {tx(spec.chestInch)} · {tx("ยาว")} {tx(spec.lengthInch)}
                          </span>
                          <span className="muted-inline mono-num">
                            {tx("จอง/ยืนยันแล้ว ")} {tx(st.reservedOrConfirmed)} {tx(" ตัว")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {canManageEventConfig && onUpdateEventShirtConfig && (
                    <div className="custom-field-creator canvas-stack">
                      <div className="section-title-bar">
                        <div>
                          <strong>
                            {tx(
                              'ตั้งค่าไซส์เสื้อเพิ่มเติม (XS–5XL) และตารางไซส์เฉพาะงานนี้ (Event-Specific Size Chart)'
                            )}
                          </strong>
                          <p className="muted-inline">
                            {tx(
                              'กำหนดไซส์ที่เปิดให้เลือกและขนาดรอบอก/ความยาวเฉพาะเสื้อของงานนี้ (หากไม่ระบุจะใช้ตารางมาตรฐานของแพลตฟอร์ม)'
                            )}
                          </p>
                        </div>
                      </div>

                      {(() => {
                        const missingPlatformSizes =
                          platformProfileConfig.shirtSizes.filter(
                            (opt) =>
                              opt.enabled &&
                              !selectedEvent.shirtStocks.some(
                                (s) => s.size === opt.code
                              )
                          );
                        return (
                          missingPlatformSizes.length > 0 && (
                            <div className="form-grid-3">
                              <div className="form-row">
                                <label htmlFor="ev-add-sz">
                                  {tx('เพิ่มไซส์เสื้อจากระบบกลางเข้าสู่งานนี้')}
                                </label>
                                <select
                                  id="ev-add-sz"
                                  value={
                                    missingPlatformSizes.some(
                                      (m) => m.code === addEventSizePick
                                    )
                                      ? addEventSizePick
                                      : missingPlatformSizes[0].code
                                  }
                                  onChange={(e) =>
                                    setAddEventSizePick(e.target.value)
                                  }
                                >
                                  {missingPlatformSizes.map((opt) => (
                                    <option key={opt.code} value={opt.code}>
                                      {tx('ไซส์')} {opt.code} ({opt.chartByType.Unisex.chestInch})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-row">
                                <label htmlFor="ev-add-qty">
                                  {tx('โควตาสต็อกเริ่มต้น (ตัว)')}
                                </label>
                                <input
                                  id="ev-add-qty"
                                  type="number"
                                  className="mono-num"
                                  min={1}
                                  value={addEventSizeQty}
                                  onChange={(e) =>
                                    setAddEventSizeQty(
                                      Math.max(1, Number(e.target.value) || 1)
                                    )
                                  }
                                />
                              </div>
                              <div
                                className="form-row"
                                style={{ justifyContent: 'flex-end' }}
                              >
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    const codeToUse = missingPlatformSizes.some(
                                      (m) => m.code === addEventSizePick
                                    )
                                      ? addEventSizePick
                                      : missingPlatformSizes[0].code;
                                    onUpdateEventShirtConfig(selectedEvent.id, {
                                      shirtStocks: [
                                        ...selectedEvent.shirtStocks,
                                        {
                                          size: codeToUse,
                                          total: addEventSizeQty,
                                          reservedOrConfirmed: 0,
                                        },
                                      ],
                                    });
                                  }}
                                >
                                  <IconPlus size={14} />
                                  <span>{tx('เปิดรับไซส์นี้ในงาน')}</span>
                                </button>
                              </div>
                            </div>
                          )
                        );
                      })()}

                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>{tx('ไซส์เสื้อ')}</th>
                              <th>{tx('รอบอกเฉพาะงานนี้')}</th>
                              <th>{tx('ความยาวเฉพาะงานนี้')}</th>
                              <th className="num-col">{tx('โควตาเสื้อรวม')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedEvent.shirtStocks.map((st) => {
                              const resolved = resolveShirtSpec(
                                st.size,
                                'Unisex',
                                platformProfileConfig.shirtSizes,
                                selectedEvent.customSizeChart
                              );
                              return (
                                <tr key={st.size}>
                                  <td>
                                    <strong className="mono-code">{st.size}</strong>
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      aria-label={`${st.size} event chest`}
                                      value={resolved.chestInch}
                                      onChange={(e) => {
                                        const nextChart = {
                                          ...(selectedEvent.customSizeChart ?? {}),
                                          [st.size]: {
                                            chestInch: e.target.value,
                                            lengthInch: resolved.lengthInch,
                                          },
                                        };
                                        onUpdateEventShirtConfig(
                                          selectedEvent.id,
                                          { customSizeChart: nextChart }
                                        );
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="text"
                                      aria-label={`${st.size} event length`}
                                      value={resolved.lengthInch}
                                      onChange={(e) => {
                                        const nextChart = {
                                          ...(selectedEvent.customSizeChart ?? {}),
                                          [st.size]: {
                                            chestInch: resolved.chestInch,
                                            lengthInch: e.target.value,
                                          },
                                        };
                                        onUpdateEventShirtConfig(
                                          selectedEvent.id,
                                          { customSizeChart: nextChart }
                                        );
                                      }}
                                    />
                                  </td>
                                  <td className="num-col">
                                    <input
                                      type="number"
                                      aria-label={`${st.size} stock total`}
                                      className="mono-num"
                                      min={st.reservedOrConfirmed}
                                      value={st.total}
                                      onChange={(e) => {
                                        const nextVal = Math.max(
                                          st.reservedOrConfirmed,
                                          Number(e.target.value) || 0
                                        );
                                        onUpdateEventShirtConfig(
                                          selectedEvent.id,
                                          {
                                            shirtStocks:
                                              selectedEvent.shirtStocks.map((x) =>
                                                x.size === st.size
                                                  ? { ...x, total: nextVal }
                                                  : x
                                              ),
                                          }
                                        );
                                      }}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {canManageEventConfig &&
                    (() => {
                      const packageShirtUsed = selectedEvent.shirtStocks.reduce(
                        (s, x) => s + x.reservedOrConfirmed,
                        0
                      );
                      const addonShirtSold = selectedEvent.products
                        .filter((p) => p.categoryLabel === 'เสื้อที่ระลึก')
                        .reduce((s, p) => s + p.soldCount, 0);
                      const netToProduce = Math.max(
                        0,
                        packageShirtUsed +
                        addonShirtSold +
                        bufferShirtQty -
                        existingShirtStock
                      );

                      return (
                        <div className="production-calc-box">
                          <h3>
                            {tx("สร้างคำขอใบเสนอราคาผลิตเสื้อจากยอดตรวจสอบแล้ว (ป้องกันการนับซ้ำ)")}
                          </h3>
                          <div className="form-grid-3">
                            <div className="form-row">
                              <label htmlFor="buf-qty">
                                {tx("จำนวนสำรองที่ผู้จัดกำหนดเอง (ตัว)")}
                              </label>
                              <input
                                id="buf-qty"
                                type="text"
                                className="mono-num"
                                value={bufferShirtQty}
                                onChange={(e) =>
                                  setBufferShirtQty(
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="ex-qty">
                                {tx("หักสต็อกเสื้อที่มีอยู่แล้ว (ตัว)")}
                              </label>
                              <input
                                id="ex-qty"
                                type="text"
                                className="mono-num"
                                value={existingShirtStock}
                                onChange={(e) =>
                                  setExistingShirtStock(
                                    Math.max(0, Number(e.target.value) || 0)
                                  )
                                }
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="rfq-dt">{tx("วันที่ต้องการรับสินค้า")}</label>
                              <input
                                id="rfq-dt"
                                type="text"
                                className="mono-num"
                                value={rfqTargetDate}
                                onChange={(e) =>
                                  setRfqTargetDate(e.target.value)
                                }
                              />
                            </div>
                          </div>

                          <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
                            <span className="muted-inline">
                              {tx("สูตรยอดผลิตสุทธิ: สิทธิ์สมัคร")}{' '}
                              <strong className="mono-num">
                                {tx(packageShirtUsed)}
                              </strong>{' '}
                              {tx("+ ซื้อเพิ่มหน้าร้าน")}{' '}
                              <strong className="mono-num">
                                {tx(addonShirtSold)}
                              </strong>{' '}
                              {tx("+ สำรอง")}{' '}
                              <strong className="mono-num">
                                {tx(bufferShirtQty)}
                              </strong>{' '}
                              {tx("− สต็อกเดิม")}{' '}
                              <strong className="mono-num">
                                {tx(existingShirtStock)}
                              </strong>{' '}
                              ={' '}
                              <strong className="mono-num text-vermilion">
                                {tx(netToProduce)} {tx(" ตัว")}
                              </strong>
                            </span>
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                onCreateEventProductionQuote({
                                  orgId: activeOrg.id,
                                  eventId: selectedEvent.id,
                                  itemType: 'เสื้อแข่งขันและเสื้อที่ระลึก',
                                  packageQty: packageShirtUsed,
                                  addonQty: addonShirtSold,
                                  bufferQty: bufferShirtQty,
                                  existingStockQty: existingShirtStock,
                                  targetDeliveryDate: rfqTargetDate,
                                });
                                onSelectSection('org_merch_production');
                              }}
                            >
                              {tx("ส่งคำขอใบเสนอราคาผลิต (")}{tx(netToProduce)} {tx(" ตัว)")}
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                </section>
              </div>
            )}

            {/* ================= 8. EVENT PARTICIPANTS ================= */}
            {selectedEvent && activeSection === 'evt_participants' && (
              <div className="canvas-stack">
                <div className="page-heading-row">
                  <div className="page-guide-header">
                    <h1>{tx("รายชื่อผู้สมัครวิ่ง (")}{tx(selectedEvent.titleTh)})</h1>
                    <p className="page-purpose-desc">
                      {tx("ค้นหาผู้สมัคร ตรวจแยกสถานะสิทธิ์/การชำระ/การรับของ ดูผู้สั่งซื้อแยกจากผู้วิ่ง และส่งออกไฟล์รายชื่อตามตัวกรอง")}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() =>
                      setExportBannerText(
                        txf("สร้างไฟล์รายชื่อผู้สมัคร CSV จำนวน {0} คน ตามตัวกรองเรียบร้อยแล้ว", eventParticipants.length)
                      )
                    }
                  >
                    <IconDownload size={15} />
                    <span>
                      {tx("ส่งออกรายชื่อ (")}{tx(eventParticipants.length)} {tx(" คน)")}
                    </span>
                  </button>
                </div>

                <div className="filter-bar-panel">
                  <div className="filter-field filter-search">
                    <label htmlFor="p-search">
                      {tx("ค้นหาชื่อ รหัสใบสมัคร หรือเลข BIB")}
                    </label>
                    <div className="input-with-icon">
                      <IconSearch size={16} />
                      <input
                        id="p-search"
                        type="search"
                        value={participantSearch}
                        onChange={(e) => setParticipantSearch(e.target.value)}
                        placeholder={tx("เช่น กานต์พิชชา, REG-2611, A-0101...")}
                      />
                    </div>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="p-cat">{tx("ระยะทาง")}</label>
                    <select
                      id="p-cat"
                      value={participantCatFilter}
                      onChange={(e) => setParticipantCatFilter(e.target.value)}
                    >
                      <option value="all">{tx("ทุกระยะทาง")}</option>
                      {selectedEvent.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {tx(c.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter-field">
                    <label htmlFor="p-st">{tx("สถานะสิทธิ์")}</label>
                    <select
                      id="p-st"
                      value={participantRegFilter}
                      onChange={(e) =>
                        setParticipantRegFilter(
                          e.target.value as 'all' | RegistrationStatus
                        )
                      }
                    >
                      <option value="all">{tx("ทุกสถานะสิทธิ์")}</option>
                      <option value="confirmed">{tx("ยืนยันสิทธิ์แล้ว")}</option>
                      <option value="pending_payment">{tx("กันที่นั่งรอจ่าย")}</option>
                      <option value="cancelled">{tx("ยกเลิกสิทธิ์")}</option>
                    </select>
                  </div>
                </div>

                {eventParticipants.length === 0 ? (
                  <div className="empty-state-box">
                    <h2>{tx("ไม่พบผู้สมัครตามตัวกรอง")}</h2>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setParticipantSearch('');
                        setParticipantCatFilter('all');
                        setParticipantRegFilter('all');
                      }}
                    >
                      {tx("ล้างตัวกรองทั้งหมด")}
                    </button>
                  </div>
                ) : (
                  <div className="participants-master-detail">
                    <div className="clean-panel">
                      <div className="table-scroll">
                        <table className="ops-table">
                          <thead>
                            <tr>
                              <th>{tx("รหัสใบสมัคร")}</th>
                              <th>{tx("ผู้เข้าแข่งขัน / เสื้อ")}</th>
                              <th>{tx("ระยะ / รุ่นอายุ")}</th>
                              <th>{tx("สถานะสิทธิ์")}</th>
                              <th>{tx("สถานะเงิน")}</th>
                              <th>BIB</th>
                              <th>{tx("รับอุปกรณ์")}</th>
                              <th>{tx("ข้อมูล")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventParticipants.map((reg) => {
                              const cat = selectedEvent.categories.find(
                                (c) => c.id === reg.categoryId
                              );
                              return (
                                <tr
                                  key={reg.id}
                                  className={
                                    inspectedReg?.id === reg.id
                                      ? 'row-highlighted'
                                      : ''
                                  }
                                >
                                  <td className="mono-code">{tx(reg.regCode)}</td>
                                  <td>
                                    <strong>{tx(reg.participantNameTh)}</strong>
                                    <div className="muted-inline">
                                      {tx("เสื้อไซส์ ")} <strong>{tx(reg.shirtSize)}</strong>
                                    </div>
                                  </td>
                                  <td>
                                    {tx(cat?.code)}
                                    <div className="muted-inline">
                                      {reg.ageSnapshot
                                        ? reg.ageSnapshot.groupId && cat?.ageGroups?.some((g) => g.id === reg.ageSnapshot!.groupId)
                                          ? txf(
                                              '{0} ปี · {1}',
                                              reg.ageSnapshot.ageYears,
                                              formatAgeGroupLabel(
                                                cat.ageGroups.find((g) => g.id === reg.ageSnapshot!.groupId)!
                                              )
                                            )
                                          : reg.ageSnapshot.groupLabelTh
                                          ? txf('{0} ปี · {1}', reg.ageSnapshot.ageYears, tx(reg.ageSnapshot.groupLabelTh))
                                          : txf('{0} ปี · ไม่เข้ารุ่น', reg.ageSnapshot.ageYears)
                                        : tx('ไม่มีวันเกิด')}
                                    </div>
                                  </td>
                                  <td>
                                    <RegStatusBadge
                                      status={reg.registrationStatus}
                                    />
                                  </td>
                                  <td>
                                    <PaymentStatusBadge
                                      status={reg.paymentStatus}
                                    />
                                  </td>
                                  <td className="mono-code">
                                    {reg.bibNumber ?? '—'}
                                  </td>
                                  <td>
                                    <FulfillmentStatusBadge
                                      status={reg.fulfillmentStatus}
                                    />
                                  </td>
                                  <td>
                                    <div className="cta-inline-row">
                                      {reg.registrationStatus === 'confirmed' ? (
                                        reg.bibNumber ? (
                                          <span className="status-pill badge-forest">
                                            <IconCheckCircle size={13} />
                                            <span>{tx("ข้อมูล & BIB ครบ")}</span>
                                          </span>
                                        ) : (
                                          <span className="status-pill badge-amber">
                                            <IconAlert size={13} />
                                            <span>{tx("รอเลข BIB")}</span>
                                          </span>
                                        )
                                      ) : (
                                        <span className="status-pill badge-neutral">
                                          <span>{tx("รอกระบวนการชำระ")}</span>
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        className="btn-ghost-sm"
                                        onClick={() => setInspectedRegId(reg.id)}
                                      >
                                        {tx("เปิดดู")}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {inspectedReg && (
                      <aside className="participant-inspector">
                        <div className="section-title-bar">
                          <h2>{tx("รายละเอียด")} {tx(inspectedReg.regCode)}</h2>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => setInspectedRegId(null)}
                          >
                            {tx("ปิด")}
                          </button>
                        </div>
                        <dl className="inspector-dl">
                          <dt>{tx("ผู้เข้าแข่งขันจริง (Participant)")}</dt>
                          <dd>
                            {tx(inspectedReg.participantNameTh)} (
                            {tx(inspectedReg.participantNameEn)})
                          </dd>
                          <dt>{tx("ผู้สั่งซื้อ/จ่ายเงิน (Buyer)")}</dt>
                          <dd>{tx(inspectedReg.buyerName)}</dd>
                          <dt>{tx("ช่องทางติดต่อ")}</dt>
                          <dd>
                            {role === 'staff' ? (
                              <span className="muted-inline">
                                {tx("ซ่อนอีเมลและเบอร์ติดต่อฉุกเฉินตามสิทธิ์เจ้าหน้าที่หน้างาน")}
                              </span>
                            ) : (
                              <>
                                {tx(inspectedReg.email)} · {tx(inspectedReg.phoneMasked)}
                                <div>{tx("ฉุกเฉิน:")} {tx(inspectedReg.emergencyContact)}</div>
                              </>
                            )}
                          </dd>
                          <dt>{tx("วิธีรับ Race Kit / ที่อยู่จัดส่งที่ส่งมากับงานนี้")}</dt>
                          <dd>
                            {inspectedReg.kitDeliveryMethod === 'postal_shipping' ? (
                              role === 'staff' ? (
                                <span className="muted-inline">
                                  {tx("จัดส่งทางไปรษณีย์ (ซ่อนที่อยู่ตามสิทธิ์เจ้าหน้าที่หน้างาน)")}
                                </span>
                              ) : (
                                <span>
                                  <strong>{tx("จัดส่งไปรษณีย์:")}</strong>{' '}
                                  {inspectedReg.shippingAddressSnapshot ??
                                    tx("ไม่พบที่อยู่จัดส่งใน Snapshot")}
                                </span>
                              )
                            ) : (
                              <span className="muted-inline">
                                {tx("รับด้วยตนเองหน้างาน (ไม่เปิดเผยที่อยู่ส่วนตัวของนักวิ่งให้ผู้จัด)")}
                              </span>
                            )}
                          </dd>
                          <dt>{tx("กติกาที่ยอมรับ")}</dt>
                          <dd>
                            {tx("ฉบับ ")} <code>{tx(inspectedReg.acceptedRulesVersion)}</code>{' '}
                            {tx("· การตลาด:")}{' '}
                            {inspectedReg.marketingConsent
                              ? tx("ยินยอม")
                              : tx("ไม่ยินยอม")}
                          </dd>
                          {(selectedEvent.customFields ?? []).length > 0 && (
                            <>
                              <dt>{tx("คำตอบเพิ่มเติม (Custom Fields)")}</dt>
                              <dd>
                                <div className="custom-answers-stack">
                                  {(selectedEvent.customFields ?? []).map(
                                    (cf) => {
                                      const rawVal =
                                        inspectedReg.customAnswers?.[cf.id];
                                      const formatted =
                                        rawVal === undefined || rawVal === ''
                                          ? 'ไม่ได้ระบุ'
                                          : typeof rawVal === 'boolean'
                                          ? rawVal
                                            ? 'ใช่'
                                            : 'ไม่ใช่'
                                          : String(rawVal);
                                      return (
                                        <div
                                          key={cf.id}
                                          className="custom-answer-line"
                                        >
                                          <span className="muted-inline">
                                            {tx(cf.label)}:
                                          </span>{' '}
                                          {role === 'staff' && cf.isSensitive ? (
                                            <span className="muted-inline">
                                              {tx("[ซ่อนข้อมูลอ่อนไหวตามสิทธิ์เจ้าหน้าที่หน้างาน]")}
                                            </span>
                                          ) : (
                                            <strong>{tx(formatted)}</strong>
                                          )}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </dd>
                            </>
                          )}
                        </dl>
                        {inspectedReg.registrationStatus ===
                          'pending_payment' && (
                            <div className="subtle-empty-note">
                              {tx("รายการอยู่ระหว่างกันโควตารอผู้สมัครชำระเงิน ระบบจะเปลี่ยนเป็นยืนยันสิทธิ์อัตโนมัติเมื่อผู้ให้บริการรับชำระยืนยันยอด")}
                            </div>
                          )}
                      </aside>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================= 9. EVENT STOREFRONT & MERCH MANAGEMENT ================= */}
            {selectedEvent && activeSection === 'evt_storefront' && (
              <div className="canvas-stack">
                <div className="page-heading-row">
                  <div className="page-guide-header">
                    <h1>{tx("ร้านค้าและสินค้าที่ระลึกของงาน (")}{tx(selectedEvent.code)})</h1>
                    <p className="page-purpose-desc">
                      {tx("จัดการเสื้อ/เหรียญที่ระลึกสำหรับขายให้นักวิ่งและลูกค้าทั่วไป โดยระบุรูปแบบผู้ขายและผู้รับผิดชอบจัดส่งอย่างชัดเจน")}
                    </p>
                  </div>
                  {canManageEventConfig && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => setShowAddProductForm((v) => !v)}
                    >
                      <IconPlus size={15} />
                      <span>
                        {showAddProductForm
                          ? tx("ปิดฟอร์มเพิ่มสินค้า")
                          : tx("เพิ่มสินค้าหน้าร้าน")}
                      </span>
                    </button>
                  )}
                </div>

                {showAddProductForm && canManageEventConfig && (
                  <form
                    className="clean-panel"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newProdName.trim()) return;
                      onAddEventProduct({
                        eventId: selectedEvent.id,
                        nameTh: newProdName.trim(),
                        categoryLabel: newProdCat,
                        saleMode: newProdSaleMode,
                        serviceModel: newProdService,
                        priceBaht: newProdPrice,
                        stockOrCeiling: newProdCap,
                      });
                      setNewProdName('');
                      setShowAddProductForm(false);
                    }}
                  >
                    <h2>{tx("เพิ่มรายการสินค้าลงหน้าร้านเฉพาะงาน")}</h2>
                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="np-name">{tx("ชื่อสินค้าภาษาไทย")}</label>
                        <input
                          id="np-name"
                          type="text"
                          value={newProdName}
                          onChange={(e) => setNewProdName(e.target.value)}
                          placeholder={tx("เช่น หมวกวิ่งระบายอากาศรุ่นที่ระลึก")}
                          required
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="np-svc">{tx("รูปแบบบริการและผู้รับผิดชอบ")}</label>
                        <select
                          id="np-svc"
                          value={newProdService}
                          onChange={(e) =>
                            setNewProdService(
                              e.target.value as SellerServiceModel
                            )
                          }
                        >
                          <option value="organizer_self_sell">
                            {tx("ผู้จัดมีสินค้าและจัดส่งเอง")}
                          </option>
                          <option value="kratai_produce_bulk">
                            {tx("ให้ กระต่าย ผลิตส่งล็อตใหญ่ให้ผู้จัด")}
                          </option>
                          <option value="kratai_full_service">
                            {tx("ให้ กระต่าย ดูแลครบ (พรีออเดอร์ + ผลิต + จัดส่ง)")}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div
                      className="form-grid-3"
                      style={{ marginTop: '0.65rem' }}
                    >
                      <div className="form-row">
                        <label htmlFor="np-cat">{tx("หมวดสินค้า")}</label>
                        <select
                          id="np-cat"
                          value={newProdCat}
                          onChange={(e) =>
                            setNewProdCat(
                              e.target.value as
                              | 'เสื้อที่ระลึก'
                              | 'เหรียญที่ระลึก'
                              | 'อุปกรณ์เสริม'
                            )
                          }
                        >
                          <option value="เสื้อที่ระลึก">{tx("เสื้อที่ระลึก")}</option>
                          <option value="เหรียญที่ระลึก">{tx("เหรียญที่ระลึก")}</option>
                          <option value="อุปกรณ์เสริม">{tx("อุปกรณ์เสริม")}</option>
                        </select>
                      </div>
                      <div className="form-row">
                        <label htmlFor="np-mode">{tx("รูปแบบการขาย")}</label>
                        <select
                          id="np-mode"
                          value={newProdSaleMode}
                          onChange={(e) =>
                            setNewProdSaleMode(
                              e.target.value as 'ready_stock' | 'preorder'
                            )
                          }
                        >
                          <option value="preorder">{tx("เปิดรับพรีออเดอร์")}</option>
                          <option value="ready_stock">{tx("สินค้าพร้อมขาย")}</option>
                        </select>
                      </div>
                      <div className="form-row">
                        <label htmlFor="np-price">{tx("ราคาต่อชิ้น (บาท)")}</label>
                        <input
                          id="np-price"
                          type="text"
                          className="mono-num"
                          value={newProdPrice}
                          onChange={(e) =>
                            setNewProdPrice(Number(e.target.value) || 350)
                          }
                        />
                      </div>
                    </div>

                    <div
                      className="cta-inline-row"
                      style={{ marginTop: '0.85rem' }}
                    >
                      <label htmlFor="np-cap" className="muted-inline">
                        {tx("เพดานจำนวนขาย:")}
                      </label>
                      <input
                        id="np-cap"
                        type="text"
                        className="mono-num bib-input"
                        value={newProdCap}
                        onChange={(e) =>
                          setNewProdCap(Number(e.target.value) || 50)
                        }
                      />
                      <button type="submit" className="btn-primary">
                        {tx("บันทึกเปิดขายในหน้าร้านงานนี้")}
                      </button>
                    </div>
                  </form>
                )}

                <section className="clean-panel">
                  <h2>{tx("รายการสินค้าที่เปิดขายในหน้าร้านงานนี้")}</h2>
                  {selectedEvent.products.length === 0 ? (
                    <p className="muted-block">
                      {tx("ยังไม่มีสินค้าหน้าร้านสำหรับงานนี้ กดปุ่มเพิ่มสินค้าด้านบนเพื่อเปิดขายได้ทันที")}
                    </p>
                  ) : (
                    <div className="table-scroll">
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>{tx("SKU / ชื่อสินค้า")}</th>
                            <th>{tx("รูปแบบบริการ")}</th>
                            <th>{tx("สถานะขาย")}</th>
                            <th className="num-col">{tx("ราคา")}</th>
                            <th className="num-col">{tx("ขายแล้ว / เพดาน")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEvent.products.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <span className="mono-code">{tx(p.sku)}</span>
                                <div>
                                  <strong>{tx(p.nameTh)}</strong>
                                </div>
                              </td>
                              <td>{sellerModelLabel(p.serviceModel)}</td>
                              <td>
                                {p.saleMode === 'ready_stock'
                                  ? tx("พร้อมขาย")
                                  : txf("พรีออเดอร์ (ขั้นต่ำ {0})", p.preorderMinQty ?? 20)}
                              </td>
                              <td className="num-col mono-num">
                                {formatThb(p.priceSatang)}
                              </td>
                              <td className="num-col mono-num">
                                <strong>{tx(p.soldCount)}</strong> /{' '}
                                {tx(p.stockOrCeiling)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ================= 10. EVENT CHECK-IN BIB & MERCH HANDOVER ================= */}
            {selectedEvent && activeSection === 'evt_checkin_bib' && (
              <div className="canvas-stack">
                <div className="page-guide-header">
                  <h1>{tx("จุดเช็กอินรับ BIB และส่งมอบสินค้าหน้างาน (รองรับมือถือ)")}</h1>
                  <p className="page-purpose-desc">
                    {tx("แยกการเช็กอินรับเสื้อ+BIB ตามสิทธิ์ผู้สมัคร ออกจากจุดส่งมอบสินค้าซื้อเพิ่ม/ลูกค้าทั่วไป พร้อมป้องกันการกดรับซ้ำ")}
                  </p>
                </div>

                <div
                  className="pill-tabs-bar"
                  role="tablist"
                  aria-label={tx("เลือกประเภทการส่งมอบหน้างาน")}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={handoverTab === 'race_bib'}
                    className={`pill-tab ${handoverTab === 'race_bib' ? 'active' : ''
                      }`}
                    onClick={() => {
                      setHandoverTab('race_bib');
                      setCheckinFeedback(null);
                    }}
                  >
                    {tx("1. จ่าย BIB & เสื้อตามสิทธิ์สมัคร (")}{tx(checkinCandidates.length)})
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={handoverTab === 'merch_pickup'}
                    className={`pill-tab ${handoverTab === 'merch_pickup' ? 'active' : ''
                      }`}
                    onClick={() => {
                      setHandoverTab('merch_pickup');
                      setCheckinFeedback(null);
                    }}
                  >
                    {tx("2. จ่ายสินค้าหน้าร้าน / รับบางส่วน (")}{tx(eventMerchOrders.length)})
                  </button>
                </div>

                <div className="filter-bar-panel">
                  <div className="filter-field filter-search">
                    <label htmlFor="scan-box">
                      {handoverTab === 'race_bib'
                        ? tx("สแกน/พิมพ์รหัส QR Token นักวิ่ง หรือเลข BIB / ชื่อ")
                        : tx("สแกน/พิมพ์รหัสรับสินค้าหน้าร้าน (PICK-SHP-...) หรือชื่อผู้ซื้อ")}
                    </label>
                    <div className="input-with-icon">
                      <IconQr size={16} />
                      <input
                        id="scan-box"
                        type="search"
                        value={checkinQuery}
                        onChange={(e) => setCheckinQuery(e.target.value)}
                        placeholder={
                          handoverTab === 'race_bib'
                            ? tx("เช่น TKN-DS26-9F3A1C หรือ A-0101...")
                            : tx("เช่น PICK-SHP-501 หรือ ปรมินทร์...")
                        }
                      />
                    </div>
                  </div>
                </div>

                {checkinFeedback && (
                  <div
                    className={
                      checkinFeedback.tone === 'ok'
                        ? 'success-callout'
                        : 'error-callout'
                    }
                    role="status"
                  >
                    {checkinFeedback.tone === 'ok' ? (
                      <IconCheckCircle size={17} />
                    ) : (
                      <IconAlert size={17} />
                    )}
                    <span>{tx(checkinFeedback.text)}</span>
                  </div>
                )}

                {handoverTab === 'race_bib' ? (
                  <div className="checkin-mobile-list">
                    {checkinCandidates.map((reg) => {
                      const cat = selectedEvent.categories.find(
                        (c) => c.id === reg.categoryId
                      );
                      const draftBib =
                        bibDraftMap[reg.id] ??
                        reg.bibNumber ??
                        `${cat?.bibPrefix ?? 'A'}-0109`;
                      const alreadyPicked =
                        reg.fulfillmentStatus === 'kit_picked_up';
                      const eligible = reg.registrationStatus === 'confirmed';

                      return (
                        <article key={reg.id} className="checkin-card-row">
                          <div className="checkin-row-top">
                            <span className="mono-code">
                              {tx(reg.qrCheckInToken)}
                            </span>
                            <RegStatusBadge status={reg.registrationStatus} />
                            <FulfillmentStatusBadge
                              status={reg.fulfillmentStatus}
                            />
                          </div>

                          <div className="checkin-row-body">
                            <div>
                              <h2>{tx(reg.participantNameTh)}</h2>
                              <p className="muted-block">
                                {tx("ระยะ")}{' '}
                                <span
                                  className={`category-bib-chip tone-${cat?.colorTag ?? 'navy'
                                    }`}
                                >
                                  <strong>{tx(cat?.code)}</strong>
                                </span>{' '}
                                {tx("· เสื้อสิทธิ์สมัครไซส์")}{' '}
                                <strong className="shirt-highlight">
                                  {tx(reg.shirtSize)}
                                </strong>
                              </p>
                              {reg.fulfillmentUpdatedBy && (
                                <p className="muted-inline">
                                  {tx("ส่งมอบโดย ")} {tx(reg.fulfillmentUpdatedBy)} {tx(" เมื่อ")}{' '}
                                  {tx(reg.fulfillmentUpdatedAt)}
                                </p>
                              )}
                            </div>

                            <div className="checkin-controls">
                              <div className="bib-assign-inline">
                                <label htmlFor={`bib-${reg.id}`}>
                                  {tx("เลข BIB (ห้ามซ้ำในงานนี้):")}
                                </label>
                                <div className="cta-inline-row">
                                  <input
                                    id={`bib-${reg.id}`}
                                    type="text"
                                    className="mono-code bib-input"
                                    value={draftBib}
                                    disabled={!eligible || alreadyPicked}
                                    onChange={(e) =>
                                      setBibDraftMap((prev) => ({
                                        ...prev,
                                        [reg.id]: e.target.value.toUpperCase(),
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    disabled={!eligible || alreadyPicked}
                                    onClick={() => {
                                      const res = onAssignBibNumber(
                                        reg.id,
                                        draftBib
                                      );
                                      setCheckinFeedback({
                                        tone: res.ok ? 'ok' : 'err',
                                        text: res.ok
                                          ? txf("บันทึกเลข BIB {0} สำเร็จ", draftBib)
                                          : res.error ?? tx("กำหนด BIB ไม่สำเร็จ"),
                                      });
                                    }}
                                  >
                                    {tx("บันทึก BIB")}
                                  </button>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="btn-primary"
                                disabled={!eligible || !reg.bibNumber}
                                onClick={() => {
                                  const res = onConfirmKitPickup(reg.id);
                                  setCheckinFeedback({
                                    tone: res.ok ? 'ok' : 'err',
                                    text: res.ok
                                      ? txf("ยืนยันจ่ายเสื้อ {0} + BIB {1} ให้ {2} สำเร็จ", reg.shirtSize, reg.bibNumber, reg.participantNameTh)
                                      : res.error ?? tx("ป้องกันการรับซ้ำ"),
                                  });
                                }}
                              >
                                {alreadyPicked
                                  ? tx("รับแล้ว (กดเพื่อทดสอบป้องกันรับซ้ำ)")
                                  : !reg.bibNumber
                                    ? tx("กรุณาบันทึกเลข BIB ก่อนส่งมอบ")
                                    : txf("ยืนยันจ่ายเสื้อ {0} + BIB {1}", reg.shirtSize, reg.bibNumber)}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="checkin-mobile-list">
                    {eventMerchOrders.map((ord) => (
                      <article key={ord.id} className="checkin-card-row">
                        <div className="checkin-row-top">
                          <span className="mono-code">{tx(ord.pickupToken)}</span>
                          <span className="mono-code">
                            {tx(ord.merchOrderCode)}
                          </span>
                          <span className="status-pill badge-navy">
                            <IconBag size={13} />
                            <span>
                              {tx("ส่งมอบแล้ว")}{' '}
                              <span className="mono-num">
                                {tx(ord.deliveredQty)}/{tx(ord.quantity)}
                              </span>{' '}
                              {tx("ชิ้น")}
                            </span>
                          </span>
                        </div>
                        <div className="checkin-row-body">
                          <div>
                            <h2>{tx(ord.buyerName)}</h2>
                            <p className="muted-block">
                              {tx(ord.productNameTh)} {tx(" · ขนาด")}{' '}
                              <strong>{tx(ord.variantSize)}</strong> {tx(" (ไม่สร้างสถานะเช็กอินวิ่ง)")}
                            </p>
                          </div>
                          <div className="cta-inline-row">
                            {ord.quantity > 1 &&
                              ord.deliveredQty < ord.quantity && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => {
                                    const res = onConfirmMerchHandover(
                                      ord.id,
                                      'partial_one'
                                    );
                                    setCheckinFeedback({
                                      tone: res.ok ? 'ok' : 'err',
                                      text: res.message,
                                    });
                                  }}
                                >
                                  {tx("บันทึกรับบางส่วน (+1 ชิ้น)")}
                                </button>
                              )}
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => {
                                const res = onConfirmMerchHandover(
                                  ord.id,
                                  'complete_all'
                                );
                                setCheckinFeedback({
                                  tone: res.ok ? 'ok' : 'err',
                                  text: res.message,
                                });
                              }}
                            >
                              {ord.deliveredQty >= ord.quantity
                                ? tx("รับสินค้าครบแล้ว (ทดสอบป้องกันจ่ายซ้ำ)")
                                : tx("ยืนยันส่งมอบสินค้าครบจำนวน")}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================= 11. EVENT FINANCE & REFUNDS ================= */}
            {selectedEvent &&
              activeSection === 'evt_finance' &&
              eventMetrics && (
                <div className="canvas-stack">
                  <div className="page-guide-header">
                    <h1>{tx("รายรับและคำขอคืนเงินของงาน (")}{tx(selectedEvent.code)})</h1>
                    <p className="page-purpose-desc">
                      {tx("ตรวจรายการชำระระดับคำสั่งซื้อ และอนุมัติหรือปฏิเสธคำขอคืนเงินโดยเก็บเหตุผลไว้ตรวจสอบย้อนหลังเสมอ")}
                    </p>
                  </div>

                  <BibLedgerStrip
                    scopeTitle={`บัญชีเฉพาะงาน: ${selectedEvent.titleTh}`}
                    scopeCode={selectedEvent.code}
                    metrics={eventMetrics}
                    timeWindow={timeWindow}
                    canViewFinance={canViewFinance}
                    onDrillDown={handleDrillDown}
                  />

                  <section id="finance-source-ledger" className="clean-panel">
                    <div className="section-title-bar">
                      <h2>{tx("รายการธุรกรรมค่าสมัครและคำขอคืนเงิน")}</h2>
                      <div className="cta-inline-row">
                        {(
                          [
                            ['all', 'ทั้งหมด'],
                            ['payments', 'ชำระสำเร็จ'],
                            ['refunds', 'ขอคืน/คืนแล้ว'],
                            ['payouts', 'รายการคิดยอดโอน'],
                          ] as const
                        ).map(([k, lbl]) => (
                          <button
                            key={k}
                            type="button"
                            className={
                              financeSubFilter === k
                                ? 'btn-primary'
                                : 'btn-ghost-sm'
                            }
                            onClick={() => setFinanceSubFilter(k)}
                          >
                            {tx(lbl)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="table-scroll">
                      <table className="ops-table">
                        <thead>
                          <tr>
                            <th>{tx("คำสั่งซื้อ / ใบสมัคร")}</th>
                            <th>{tx("ผู้เข้าแข่งขัน")}</th>
                            <th>{tx("สถานะเงิน")}</th>
                            <th className="num-col">{tx("ยอดชำระสุทธิ")}</th>
                            <th className="num-col">{tx("ค่าบริการระบบ")}</th>
                            <th>{tx("สถานะคืนเงิน & เหตุผล")}</th>
                            <th>{tx("การอนุมัติ")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orgRegistrations
                            .filter((r) => r.eventId === selectedEvent.id)
                            .filter((r) => {
                              if (financeSubFilter === 'payments') {
                                return (
                                  r.paymentStatus === 'succeeded' &&
                                  isWithinTimeWindow(r.paidAt, timeWindow)
                                );
                              }
                              if (financeSubFilter === 'refunds') {
                                return r.refundStatus !== 'none';
                              }
                              if (financeSubFilter === 'payouts') {
                                return (
                                  r.paymentStatus === 'succeeded' &&
                                  isWithinTimeWindow(r.paidAt, timeWindow)
                                );
                              }
                              return true;
                            })
                            .map((reg) => (
                              <tr key={reg.id}>
                                <td>
                                  <div className="mono-code">
                                    {tx(reg.orderCode)}
                                  </div>
                                  <small className="mono-code">
                                    {tx(reg.regCode)}
                                  </small>
                                </td>
                                <td>{tx(reg.participantNameTh)}</td>
                                <td>
                                  <PaymentStatusBadge
                                    status={reg.paymentStatus}
                                  />
                                </td>
                                <td className="num-col mono-num">
                                  {formatThb(
                                    reg.snapshotTotalChargedSatang,
                                    true
                                  )}
                                </td>
                                <td className="num-col mono-num">
                                  {formatThb(
                                    reg.snapshotPlatformFeeSatang,
                                    true
                                  )}
                                </td>
                                <td>
                                  <RefundStatusBadge
                                    status={reg.refundStatus}
                                  />
                                  {reg.refundReason && (
                                    <div className="muted-inline">
                                      {tx(reg.refundReason)}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {reg.refundStatus === 'requested' ? (
                                    <div className="cta-inline-row">
                                      <button
                                        type="button"
                                        className="btn-primary"
                                        onClick={() =>
                                          onResolveRefundRequest(
                                            reg.id,
                                            'approve_succeed',
                                            'อนุมัติคืนค่าสมัครตามเอกสารรับรอง'
                                          )
                                        }
                                      >
                                        {tx("อนุมัติคืน (")}{formatThb(reg.snapshotBaseSatang)})
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-ghost-sm"
                                        onClick={() =>
                                          onResolveRefundRequest(
                                            reg.id,
                                            'reject',
                                            'ไม่เข้าเงื่อนไขการคืนเงินของงาน'
                                          )
                                        }
                                      >
                                        {tx("ปฏิเสธ")}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="muted-inline">—</span>
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
          </>
        )}
      </main>
    </div>
  );
};
