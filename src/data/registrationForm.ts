import type { ConditionalRule, CustomFieldType, CustomRegistrationField, OrganizerFormStep } from '../types';

/**
 * Registration form built by the organizer (24 Nov 2026, docs/registration-form-editor-plan.md):
 * questions and content in the "runner details" step and in up to 3 steps of the organizer's own,
 * which sit after "runner details" and before the shop. The core steps keep their order.
 *
 * One module for the editor, the runner's form and the server, so the same rules apply everywhere:
 * what a question may look like, when it is shown, whether an answer is valid, and what may change
 * once runners have answered.
 */

/** questions with this step key (or one that is not an organizer step) belong to "runner details" */
export const CORE_STEP = 'core';

export const FORM_LIMITS = {
  fields: 40,
  steps: 3,
  label: 200,
  description: 500,
  placeholder: 120,
  options: 30,
  option: 120,
  stepTitle: 60,
  stepDescription: 300,
  answer: 2000,
};

export type QuestionGroup = 'text' | 'choice' | 'content';

/** what the organizer can add, Google-Forms style (no brand, plain names) */
export const QUESTION_KINDS: { type: CustomFieldType; label: string; icon: string; group: QuestionGroup }[] = [
  { type: 'text', label: 'ข้อความสั้น', icon: 'font', group: 'text' },
  { type: 'textarea', label: 'ข้อความยาว', icon: 'align-left', group: 'text' },
  { type: 'number', label: 'ตัวเลข', icon: 'hashtag', group: 'text' },
  { type: 'date', label: 'วันที่', icon: 'calendar-day', group: 'text' },
  { type: 'email', label: 'อีเมล', icon: 'at', group: 'text' },
  { type: 'phone', label: 'เบอร์โทร', icon: 'phone', group: 'text' },
  { type: 'radio', label: 'เลือกข้อเดียว', icon: 'circle-dot', group: 'choice' },
  { type: 'multiselect', label: 'เลือกหลายข้อ', icon: 'square-check', group: 'choice' },
  { type: 'select', label: 'ดรอปดาวน์', icon: 'caret-down', group: 'choice' },
  { type: 'checkbox', label: 'ติ๊กยืนยัน', icon: 'check', group: 'choice' },
  { type: 'heading', label: 'หัวข้อย่อย', icon: 'heading', group: 'content' },
  { type: 'note', label: 'ข้อความอธิบาย', icon: 'paragraph', group: 'content' },
];

/** every type the form may hold (older template fields keep their types) */
const ALL_TYPES = new Set<CustomFieldType>([
  'text', 'textarea', 'email', 'phone', 'number', 'date', 'select', 'radio', 'checkbox', 'multiselect',
  'file', 'image_choice', 'address', 'size_selector', 'distance_selector', 'heading', 'note',
]);
const CHOICE_TYPES = new Set<CustomFieldType>(['radio', 'multiselect', 'select', 'image_choice']);
const TEXT_TYPES = new Set<CustomFieldType>(['text', 'textarea', 'address']);

export const isContentField = (f: Pick<CustomRegistrationField, 'type'>) => f.type === 'heading' || f.type === 'note';
export const isChoiceField = (f: Pick<CustomRegistrationField, 'type'>) => CHOICE_TYPES.has(f.type);
export const kindOf = (type: CustomFieldType) => QUESTION_KINDS.find((k) => k.type === type);

/** types a question can switch to without losing what it holds */
export function compatibleTypes(type: CustomFieldType): CustomFieldType[] {
  if (CHOICE_TYPES.has(type)) return ['radio', 'multiselect', 'select'];
  if (TEXT_TYPES.has(type)) return ['text', 'textarea'];
  return [type];
}

/** a multi-choice answer is stored as one string, one choice per line */
export const splitMulti = (v: unknown): string[] =>
  String(v ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
export const joinMulti = (values: string[]) => values.join('\n');
/** the "Other" choice is stored with this prefix and the runner's text */
export const OTHER_PREFIX = 'อื่น ๆ: ';

/**
 * Blood group choices (25 Nov 2026, user request): the stored values are the ones given by the
 * user, "unknown" included; it reads "ไม่ทราบ" in Thai and "Unknown" in English.
 * Answers saved before this change (A, B, AB, O) are kept as they were.
 */
export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'];

/** option values whose label differs from the value: the Thai label (tx() gives the English one) */
const OPTION_LABELS: Record<string, string> = { unknown: 'ไม่ทราบ' };

/** the Thai source text shown for a choice value; wrap it in tx() for the current language */
export const optionLabel = (value: string): string => OPTION_LABELS[value] ?? value;

/** an answer as people read it (exports, the registrant panel) */
export function answerText(field: CustomRegistrationField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'checkbox') return value === true ? 'ยืนยันแล้ว' : 'ไม่ได้ยืนยัน';
  if (field.type === 'multiselect') return splitMulti(value).map(optionLabel).join(', ');
  if (field.type === 'select' || field.type === 'radio') return optionLabel(String(value));
  return String(value);
}

export function evaluateConditionRule(
  rule: ConditionalRule | undefined,
  answers: Record<string, string | boolean>,
  contextValues: { raceDistance?: string; shirtSize?: string }
): boolean {
  if (!rule) return true;
  let actualValue = '';
  if (rule.sourceFieldKey === 'race_distance') actualValue = contextValues.raceDistance ?? '';
  else if (rule.sourceFieldKey === 'shirt_size') actualValue = contextValues.shirtSize ?? '';
  else actualValue = String(answers[rule.sourceFieldKey] ?? '');
  if (rule.operator === 'equals') return actualValue === rule.value;
  if (rule.operator === 'not_equals') return actualValue !== '' && actualValue !== rule.value;
  if (rule.operator === 'contains') return actualValue.toLowerCase().includes(rule.value.toLowerCase());
  return true;
}

export type AnswerContext = { raceDistance?: string; shirtSize?: string };

/** asked of this runner right now (not retired, approved, right distance, condition met) */
export function fieldShown(field: CustomRegistrationField, answers: Record<string, string | boolean>, ctx: AnswerContext): boolean {
  if (field.hidden || field.approval === 'pending') return false;
  if (field.categoryCodes && field.categoryCodes.length > 0 && !field.categoryCodes.includes(ctx.raceDistance ?? '')) return false;
  return evaluateConditionRule(field.visibilityCondition, answers, ctx);
}

/** which step a question lives in: one of the organizer's steps, or "runner details" */
export function stepOf(field: CustomRegistrationField, steps: OrganizerFormStep[] = []): string {
  return field.stepKey && steps.some((s) => s.id === field.stepKey) ? field.stepKey : CORE_STEP;
}

/** the organizer's steps this runner goes through: shown, right distance, and with a question to answer */
export function stepsShown(
  steps: OrganizerFormStep[] = [],
  fields: CustomRegistrationField[] = [],
  answers: Record<string, string | boolean>,
  ctx: AnswerContext
): OrganizerFormStep[] {
  return steps.filter(
    (s) =>
      !s.hidden &&
      (!s.categoryCodes || s.categoryCodes.length === 0 || s.categoryCodes.includes(ctx.raceDistance ?? '')) &&
      fields.some((f) => stepOf(f, steps) === s.id && !isContentField(f) && fieldShown(f, answers, ctx))
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,16}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** one answer: null when fine, otherwise what to tell the runner */
export function validateAnswer(field: CustomRegistrationField, value: string | boolean | undefined): string | null {
  if (isContentField(field)) return null;
  const v = value ?? field.defaultValue;
  if (field.type === 'checkbox') return field.required && v !== true ? `กรุณายืนยัน "${field.label}"` : null;
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return field.required ? (isChoiceField(field) ? `กรุณาเลือก "${field.label}"` : `กรุณากรอก "${field.label}"`) : null;
  if (s.length > FORM_LIMITS.answer) return `"${field.label}" มีความยาวเกิน ${FORM_LIMITS.answer} ตัวอักษร`;
  const options = field.options ?? [];
  const okChoice = (x: string) => options.includes(x) || (field.allowOther === true && x.startsWith(OTHER_PREFIX) && x.length > OTHER_PREFIX.length);
  switch (field.type) {
    case 'email':
      return EMAIL_RE.test(s) ? null : `กรุณากรอก "${field.label}" เป็นอีเมลที่ถูกต้อง เช่น name@example.com`;
    case 'phone':
      return PHONE_RE.test(s) ? null : `กรุณากรอก "${field.label}" เป็นหมายเลขโทรศัพท์ที่ถูกต้อง เช่น 0812345678`;
    case 'number': {
      const n = Number(s);
      if (!Number.isFinite(n)) return `กรุณากรอก "${field.label}" เป็นตัวเลข`;
      if (field.minValue !== undefined && n < field.minValue) return `"${field.label}" ต้องมีค่าไม่น้อยกว่า ${field.minValue}`;
      if (field.maxValue !== undefined && n > field.maxValue) return `"${field.label}" ต้องมีค่าไม่เกิน ${field.maxValue}`;
      return null;
    }
    case 'date':
      return DATE_RE.test(s) && !Number.isNaN(Date.parse(s)) ? null : `กรุณาระบุ "${field.label}" เป็นวันที่ที่ถูกต้อง`;
    case 'radio':
    case 'select':
    case 'image_choice':
      return okChoice(s) ? null : `กรุณาเลือก "${field.label}" จากตัวเลือกที่กำหนด`;
    case 'multiselect': {
      const picked = splitMulti(s);
      if (picked.some((x) => !okChoice(x))) return `กรุณาเลือก "${field.label}" จากตัวเลือกที่กำหนด`;
      if (field.minChoices && picked.length < field.minChoices) return `กรุณาเลือก "${field.label}" อย่างน้อย ${field.minChoices} ข้อ`;
      if (field.maxChoices && picked.length > field.maxChoices) return `กรุณาเลือก "${field.label}" ไม่เกิน ${field.maxChoices} ข้อ`;
      return null;
    }
    default:
      if (field.minLength && s.length < field.minLength) return `"${field.label}" ต้องมีความยาวอย่างน้อย ${field.minLength} ตัวอักษร`;
      if (field.maxLength && s.length > field.maxLength) return `"${field.label}" ต้องมีความยาวไม่เกิน ${field.maxLength} ตัวอักษร`;
      return null;
  }
}

/** answers of the questions this runner is asked (optionally of one step only): field id -> message */
export function validateAnswers(
  fields: CustomRegistrationField[] = [],
  answers: Record<string, string | boolean>,
  ctx: AnswerContext,
  only?: { steps: OrganizerFormStep[]; stepId: string }
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    if (only && stepOf(f, only.steps) !== only.stepId) continue;
    if (!fieldShown(f, answers, ctx)) continue;
    const msg = validateAnswer(f, answers[f.id]);
    if (msg) out[f.id] = msg;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Saving the form (server and editor)                                 */
/* ------------------------------------------------------------------ */

/** questions that must never be asked (blueprint 17.6) */
export const FORBIDDEN_QUESTION_WORDS = ['password', 'รหัสผ่าน', 'cvv', 'credit card', 'เลขบัตรเครดิต', 'pin atm', 'secret token', 'otp'];

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, max);
const line = (v: unknown, max: number) => clean(v, max).replace(/\n/g, ' ').trim();
const int = (v: unknown, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : undefined;
};

/** what runners have already answered: question ids, and the choices picked per question */
export type AnsweredIndex = { fieldIds: Set<string>; options: Map<string, Set<string>> };

export function answeredIndex(registrations: { customAnswers?: Record<string, string | boolean> }[]): AnsweredIndex {
  const fieldIds = new Set<string>();
  const options = new Map<string, Set<string>>();
  for (const r of registrations) {
    for (const [id, v] of Object.entries(r.customAnswers ?? {})) {
      if (v === '' || v === false || v === undefined || v === null) continue;
      fieldIds.add(id);
      const set = options.get(id) ?? new Set<string>();
      if (typeof v === 'string') for (const x of splitMulti(v)) set.add(x);
      options.set(id, set);
    }
  }
  return { fieldIds, options };
}

export type FormDraft = { fields: CustomRegistrationField[]; steps: OrganizerFormStep[] };

/**
 * The form the organizer wants to publish, checked against what is live: field rules, locked and
 * configurable fields kept as the platform set them, answered questions not removed or retyped,
 * answered choices not dropped, sensitive questions sent for approval. Returns the form to store.
 */
export function normalizeForm(
  raw: unknown,
  prev: FormDraft,
  answered: AnsweredIndex,
  /**
   * The step order of 27 Nov 2026 (formFlow.ts), already checked by normalizeFormFlow: questions may
   * sit in any of its steps, steps are not limited to 3 and may be empty (the runner skips them).
   * The returned `steps` is then empty; the caller derives the organizer's steps from the flow.
   */
  flowMode?: { stepIds: string[]; defaultStep: string }
): { ok: true; value: FormDraft; summary: string } | { ok: false; error: string } {
  const r = (raw ?? {}) as { fields?: unknown; steps?: unknown };
  if (!Array.isArray(r.fields) || (!flowMode && !Array.isArray(r.steps))) return { ok: false, error: 'ข้อมูลฟอร์มไม่ถูกต้อง' };
  if (r.fields.length > FORM_LIMITS.fields) return { ok: false, error: `ฟอร์มมีคำถามได้ไม่เกิน ${FORM_LIMITS.fields} ข้อ` };

  // steps
  const steps: OrganizerFormStep[] = [];
  for (const s of (flowMode ? [] : r.steps) as Record<string, unknown>[]) {
    const id = String(s?.id ?? '');
    if (!ID_RE.test(id) || id === CORE_STEP) return { ok: false, error: 'รหัสขั้นตอนไม่ถูกต้อง' };
    if (steps.some((x) => x.id === id)) return { ok: false, error: 'มีขั้นตอนซ้ำกัน' };
    const title = line(s?.title, FORM_LIMITS.stepTitle);
    if (!title) return { ok: false, error: 'ตั้งชื่อขั้นตอนให้ครบทุกขั้น' };
    const description = clean(s?.description, FORM_LIMITS.stepDescription).trim();
    const codes = Array.isArray(s?.categoryCodes) ? (s.categoryCodes as unknown[]).map((c) => line(c, 20)).filter(Boolean).slice(0, 20) : [];
    steps.push({
      id,
      title,
      ...(description ? { description } : {}),
      ...(codes.length ? { categoryCodes: codes } : {}),
      ...(s?.hidden === true ? { hidden: true } : {}),
    });
  }
  if (!flowMode && steps.filter((s) => !s.hidden).length > FORM_LIMITS.steps) return { ok: false, error: `เพิ่มขั้นตอนของผู้จัดได้ไม่เกิน ${FORM_LIMITS.steps} ขั้น` };

  // fields
  const prevById = new Map(prev.fields.map((f) => [f.id, f]));
  const fields: CustomRegistrationField[] = [];
  for (const f of r.fields as Record<string, unknown>[]) {
    const id = String(f?.id ?? '');
    if (!ID_RE.test(id)) return { ok: false, error: 'รหัสคำถามไม่ถูกต้อง' };
    if (fields.some((x) => x.id === id)) return { ok: false, error: 'มีคำถามซ้ำกัน' };
    const before = prevById.get(id);
    const stepKey = flowMode
      ? typeof f?.stepKey === 'string' && flowMode.stepIds.includes(f.stepKey)
        ? (f.stepKey as string)
        : flowMode.defaultStep
      : typeof f?.stepKey === 'string' && steps.some((s) => s.id === f.stepKey)
        ? (f.stepKey as string)
        : CORE_STEP;

    // fields the platform locked: kept exactly; configurable: only "required" may change
    if (before?.policy === 'LOCKED') {
      fields.push({ ...before, stepKey: before.stepKey ?? stepKey, hidden: undefined });
      continue;
    }
    if (before?.policy === 'CONFIGURABLE') {
      fields.push({ ...before, required: f?.required === true, hidden: f?.hidden === true ? true : undefined });
      continue;
    }

    const type = String(f?.type ?? '') as CustomFieldType;
    if (!ALL_TYPES.has(type)) return { ok: false, error: 'ประเภทคำถามไม่ถูกต้อง' };
    const content = type === 'heading' || type === 'note';
    const label = content && type === 'note' ? clean(f?.label, FORM_LIMITS.description).trim() : line(f?.label, FORM_LIMITS.label);
    if (!label) return { ok: false, error: content ? 'ใส่ข้อความของหัวข้อย่อย/ข้อความอธิบายให้ครบ' : 'ตั้งชื่อคำถามให้ครบทุกข้อ' };
    const lower = label.toLowerCase();
    if (FORBIDDEN_QUESTION_WORDS.some((w) => lower.includes(w))) return { ok: false, error: `คำถาม "${label}" ขอข้อมูลที่ห้ามเก็บ (รหัสผ่าน บัตรชำระเงิน หรือรหัสลับ)` };

    if (before && answered.fieldIds.has(id) && before.type !== type) {
      return { ok: false, error: `"${before.label}" มีคนตอบแล้ว เปลี่ยนประเภทคำถามไม่ได้` };
    }

    const out: CustomRegistrationField = {
      ...(before ?? {}),
      id,
      label,
      type,
      stepKey,
      required: content ? false : f?.required === true,
      isSensitive: content ? false : f?.isSensitive === true,
      policy: before?.policy ?? 'CUSTOMIZABLE',
    };
    const description = clean(f?.descriptionTh, FORM_LIMITS.description).trim();
    if (description && !content) out.descriptionTh = description;
    else delete out.descriptionTh;
    const placeholder = line(f?.placeholderTh, FORM_LIMITS.placeholder);
    if (placeholder && !content) out.placeholderTh = placeholder;
    else delete out.placeholderTh;

    if (CHOICE_TYPES.has(type)) {
      const opts = Array.isArray(f?.options) ? (f.options as unknown[]).map((o) => line(o, FORM_LIMITS.option)).filter(Boolean) : [];
      const unique = [...new Set(opts)];
      if (unique.length === 0) return { ok: false, error: `"${label}" ต้องมีตัวเลือกอย่างน้อย 1 ข้อ` };
      if (unique.length > FORM_LIMITS.options) return { ok: false, error: `"${label}" มีตัวเลือกได้ไม่เกิน ${FORM_LIMITS.options} ข้อ` };
      const picked = answered.options.get(id);
      const lost = picked ? [...picked].filter((x) => !x.startsWith(OTHER_PREFIX) && !unique.includes(x)) : [];
      if (lost.length > 0) return { ok: false, error: `"${label}": ตัวเลือก "${lost[0]}" มีคนเลือกแล้ว ลบไม่ได้` };
      out.options = unique;
      if ((type === 'radio' || type === 'multiselect') && f?.allowOther === true) out.allowOther = true;
      else delete out.allowOther;
    } else {
      delete out.options;
      delete out.allowOther;
    }
    if (type === 'multiselect') {
      const lo = int(f?.minChoices, 0, FORM_LIMITS.options);
      const hi = int(f?.maxChoices, 0, FORM_LIMITS.options);
      if (lo) out.minChoices = lo;
      else delete out.minChoices;
      if (hi) out.maxChoices = hi;
      else delete out.maxChoices;
      if (lo && hi && lo > hi) return { ok: false, error: `"${label}": จำนวนเลือกขั้นต่ำมากกว่าสูงสุด` };
    } else {
      delete out.minChoices;
      delete out.maxChoices;
    }
    if (TEXT_TYPES.has(type)) {
      const lo = int(f?.minLength, 0, FORM_LIMITS.answer);
      const hi = int(f?.maxLength, 0, FORM_LIMITS.answer);
      if (lo) out.minLength = lo;
      else delete out.minLength;
      if (hi) out.maxLength = hi;
      else delete out.maxLength;
    } else {
      delete out.minLength;
      delete out.maxLength;
    }
    if (type === 'number') {
      const lo = Number(f?.minValue);
      const hi = Number(f?.maxValue);
      if (f?.minValue !== undefined && f?.minValue !== '' && Number.isFinite(lo)) out.minValue = lo;
      else delete out.minValue;
      if (f?.maxValue !== undefined && f?.maxValue !== '' && Number.isFinite(hi)) out.maxValue = hi;
      else delete out.maxValue;
    } else {
      delete out.minValue;
      delete out.maxValue;
    }
    const codes = Array.isArray(f?.categoryCodes) ? (f.categoryCodes as unknown[]).map((c) => line(c, 20)).filter(Boolean).slice(0, 20) : [];
    if (codes.length) out.categoryCodes = codes;
    else delete out.categoryCodes;
    if (f?.hidden === true) out.hidden = true;
    else delete out.hidden;
    // sensitive questions the organizer writes wait for the Platform Owner (decision 23 Nov 2026);
    // the organizer cannot approve them by sending "approved"
    // A sensitive question that is already live and unchanged keeps its standing (one approved
    // before, or one the platform's template brought in, which has no approval mark); a new one,
    // or one whose wording or type changed, waits.
    if (out.isSensitive) {
      const unchangedLive =
        !!before && before.isSensitive && before.approval !== 'pending' && before.label === out.label && before.type === out.type;
      if (unchangedLive) {
        if (before.approval === 'approved') out.approval = 'approved';
        else delete out.approval;
      } else out.approval = 'pending';
    } else delete out.approval;
    // the text editor does not touch these; the rest of the old field is kept above
    delete out.regexPattern;
    fields.push(out);
  }

  // answered questions stay (they may be retired with "hidden")
  for (const before of prev.fields) {
    if (!fields.some((f) => f.id === before.id) && answered.fieldIds.has(before.id)) {
      return { ok: false, error: `"${before.label}" มีคนตอบแล้ว ลบไม่ได้ ใช้ "ซ่อน" แทน` };
    }
    if (before.policy === 'LOCKED' && !fields.some((f) => f.id === before.id)) {
      return { ok: false, error: `"${before.label}" เป็นช่องที่แพลตฟอร์มล็อกไว้ ลบไม่ได้` };
    }
  }
  // steps that hold answered questions stay (they may be hidden); in flow mode normalizeFormFlow checks it
  for (const s of flowMode ? [] : prev.steps) {
    if (steps.some((x) => x.id === s.id)) continue;
    const holds = prev.fields.some((f) => f.stepKey === s.id && answered.fieldIds.has(f.id));
    if (holds) return { ok: false, error: `ขั้น "${s.title}" มีคำถามที่คนตอบแล้ว ลบไม่ได้ ใช้ "ซ่อน" แทน` };
  }
  // a step runners can reach needs a question (an empty step is skipped in flow mode, 27 Nov 2026)
  for (const s of flowMode ? [] : steps) {
    if (s.hidden) continue;
    const has = fields.some((f) => f.stepKey === s.id && !f.hidden && !isContentField(f));
    if (!has) return { ok: false, error: `ขั้น "${s.title}" ยังไม่มีคำถาม ใส่อย่างน้อย 1 ข้อหรือลบขั้นนี้` };
  }

  const pending = fields.filter((f) => f.approval === 'pending').length;
  const summary = [
    `คำถาม ${fields.filter((f) => !isContentField(f) && !f.hidden).length} ข้อ`,
    ...(flowMode ? [] : [`ขั้นของผู้จัด ${steps.filter((s) => !s.hidden).length} ขั้น`]),
    ...(pending ? [`รอ Platform Owner อนุมัติ ${pending} ข้อ`] : []),
  ].join(' · ');
  return { ok: true, value: { fields, steps }, summary };
}
