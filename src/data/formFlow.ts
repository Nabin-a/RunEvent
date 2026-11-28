import type {
  CustomRegistrationField,
  EditorLock,
  FormCoreBlock,
  FormStepDef,
  OrganizerFormStep,
  RaceEvent,
  RetiredFormBlock,
} from '../types';
import { CORE_STEP, FORM_LIMITS, fieldShown, isContentField, type AnswerContext, type AnsweredIndex } from './registrationForm';

/**
 * The order of the registration steps (27 Nov 2026, docs/registration-form-editor-plan.md section 9).
 *
 * The organizer may add, remove, rename and reorder every step except payment, which always comes
 * last and is not part of this list. The system parts of the form (distance, runner details, shirt,
 * souvenirs, delivery, summary) each sit in exactly one step; they can move to another step but
 * never be removed, because the server needs them to price the entry, hold the seat and the shirt,
 * make the BIB and insure the runner. Steps that use the picked distance come after it.
 *
 * Shared by the editor, the runner's form and the server, like registrationForm.ts.
 * Events saved before this change have no `formFlow`: their order is built from
 * `formCustomSteps`, the same order the runner's form uses today.
 */

export const FLOW_LIMITS = {
  /** every step, payment not counted (user decision 27 Nov 2026) */
  steps: 10,
  /** people one registration order may hold: the organizer picks 1–20, 10 when not set (28 Nov 2026) */
  entriesDefault: 10,
  entriesMax: 20,
};

/** the organizer's "สมัครได้สูงสุดต่อครั้ง", or null when it is not a whole number in range */
export function checkMaxEntries(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= FLOW_LIMITS.entriesMax ? n : null;
}

export interface CoreBlockDef {
  key: FormCoreBlock;
  /** what the editor calls it */
  label: string;
  icon: string;
  /** parts that must come before this one in the form */
  after: FormCoreBlock[];
}

export const CORE_BLOCKS: CoreBlockDef[] = [
  { key: 'category', label: 'เลือกระยะ', icon: 'route', after: [] },
  // the souvenir shirt is part of the runner details since 28 Nov 2026 (user request: one card per
  // person holds general details, the organizer's questions and the souvenirs); the shirt is
  // stocked by the picked distance, so the details come after the distance too
  { key: 'participant', label: 'ข้อมูลผู้สมัคร', icon: 'id-card', after: ['category'] },
  // souvenirs and the summary are priced by the picked distance
  { key: 'souvenir', label: 'ของที่ระลึก', icon: 'bag-shopping', after: ['category'] },
  { key: 'delivery', label: 'วิธีรับอุปกรณ์และที่อยู่', icon: 'truck', after: [] },
  { key: 'review', label: 'สรุปและยอมรับกติกา', icon: 'receipt', after: ['category'] },
];
const BLOCK_KEYS = new Set<FormCoreBlock>(CORE_BLOCKS.map((b) => b.key));
export const coreBlockOf = (key: FormCoreBlock) => CORE_BLOCKS.find((b) => b.key === key) as CoreBlockDef;

/** ids of the steps every form started with; the runner details step keeps the id questions used */
export const DEFAULT_STEP_IDS = {
  category: 'start',
  participant: CORE_STEP,
  souvenir: 'souvenir',
  delivery: 'address',
  review: 'review',
} as const satisfies Record<FormCoreBlock, string>;

const DEFAULT_TITLES: Record<FormCoreBlock, string> = {
  category: 'เริ่ม',
  participant: 'ข้อมูล',
  souvenir: 'ของที่ระลึก',
  delivery: 'ที่อยู่',
  review: 'สรุป',
};

const systemStep = (block: FormCoreBlock): FormStepDef => ({
  id: DEFAULT_STEP_IDS[block],
  title: DEFAULT_TITLES[block],
  blocks: [block],
});

const ownStep = (s: OrganizerFormStep): FormStepDef => ({
  id: s.id,
  title: s.title,
  ...(s.description ? { description: s.description } : {}),
  ...(s.categoryCodes?.length ? { categoryCodes: [...s.categoryCodes] } : {}),
  ...(s.hidden ? { hidden: true } : {}),
});

/** the default order: start, details (with the shirt), the organizer's steps, souvenirs, address, summary */
export function defaultFlow(customSteps: OrganizerFormStep[] = []): FormStepDef[] {
  return [
    systemStep('category'),
    systemStep('participant'),
    ...customSteps.map(ownStep),
    systemStep('souvenir'),
    systemStep('delivery'),
    systemStep('review'),
  ];
}

/**
 * A step order saved before 28 Nov 2026 without the old "เสื้อที่ระลึก" part (the shirt now sits in
 * the runner details). A step that held only the shirt goes away, unless the organizer put
 * questions in it (then it stays as the organizer's own step). Anything else is unchanged.
 */
export function withoutRetiredBlocks(
  flow: FormStepDef[],
  fields: Pick<CustomRegistrationField, 'stepKey'>[] = []
): FormStepDef[] {
  const retired = new Set<string>(['shirt' satisfies RetiredFormBlock]);
  // (also used on raw drafts from the browser, so a step may not even be an object)
  const has = (s: FormStepDef) => Array.isArray(s?.blocks) && s.blocks.some((b) => retired.has(b));
  if (!flow.some(has)) return flow;
  const out: FormStepDef[] = [];
  for (const s of flow) {
    if (!has(s)) {
      out.push(s);
      continue;
    }
    const had = s.blocks ?? [];
    const kept = had.filter((b) => !retired.has(b));
    if (kept.length === had.length) {
      out.push(s);
      continue;
    }
    if (kept.length === 0 && !fields.some((f) => f.stepKey === s.id)) continue;
    const { blocks: _gone, ...rest } = s;
    out.push(kept.length ? { ...rest, blocks: kept } : rest);
  }
  return out;
}

/** the event's steps in order (payment not included) */
export function formFlowOf(ev: Pick<RaceEvent, 'formFlow' | 'formCustomSteps' | 'customFields'>): FormStepDef[] {
  if (Array.isArray(ev.formFlow) && ev.formFlow.length > 0) {
    const flow = withoutRetiredBlocks(ev.formFlow, ev.customFields ?? []);
    if (flowProblem(flow) === null) return flow;
  }
  return defaultFlow(ev.formCustomSteps ?? []);
}

/** steps without system parts, in the shape the runner's form reads today (until it reads the flow) */
export function customStepsOf(flow: FormStepDef[]): OrganizerFormStep[] {
  return flow
    .filter((s) => !s.blocks?.length)
    .map((s) => ({
      id: s.id,
      title: s.title,
      ...(s.description ? { description: s.description } : {}),
      ...(s.categoryCodes?.length ? { categoryCodes: [...s.categoryCodes] } : {}),
      ...(s.hidden ? { hidden: true } : {}),
    }));
}

/** the step a system part sits in */
export const stepWithBlock = (flow: FormStepDef[], block: FormCoreBlock) => flow.find((s) => s.blocks?.includes(block));

/**
 * Which step a question lives in. A question whose step was removed, or that never had one,
 * belongs with the runner details (where questions always lived before 24 Nov 2026).
 */
export function flowStepOf(field: Pick<CustomRegistrationField, 'stepKey'>, flow: FormStepDef[]): string {
  if (field.stepKey && flow.some((s) => s.id === field.stepKey)) return field.stepKey;
  return stepWithBlock(flow, 'participant')?.id ?? CORE_STEP;
}

/**
 * The steps this runner goes through, in order: not retired, right distance, and with something
 * to do (a system part that applies, or a question they are asked). An empty step is skipped
 * (user decision 27 Nov 2026: an empty step does not stop publishing).
 */
export function runnerFlow(
  flow: FormStepDef[],
  fields: CustomRegistrationField[],
  answers: Record<string, string | boolean>,
  ctx: AnswerContext,
  opts: { hasSouvenirs: boolean }
): FormStepDef[] {
  return flow.filter((s) => {
    if (s.hidden) return false;
    if (s.categoryCodes?.length && !s.categoryCodes.includes(ctx.raceDistance ?? '')) return false;
    const hasBlock = (s.blocks ?? []).some((b) => b !== 'souvenir' || opts.hasSouvenirs);
    if (hasBlock) return true;
    return fields.some((f) => flowStepOf(f, flow) === s.id && !isContentField(f) && fieldShown(f, answers, ctx));
  });
}

/** null when the order is usable, otherwise what is wrong (for the organizer) */
export function flowProblem(flow: FormStepDef[]): string | null {
  if (flow.length === 0) return 'ฟอร์มต้องมีอย่างน้อย 1 ขั้น';
  if (flow.length > FLOW_LIMITS.steps) return `ฟอร์มมีได้ไม่เกิน ${FLOW_LIMITS.steps} ขั้น (ไม่นับขั้นชำระเงิน)`;
  // where each system part sits: step index, then its place in the step
  const at = new Map<FormCoreBlock, [number, number]>();
  for (const [i, s] of flow.entries()) {
    for (const [j, b] of (s.blocks ?? []).entries()) {
      if (!BLOCK_KEYS.has(b)) return 'ส่วนของระบบในขั้นตอนไม่ถูกต้อง';
      if (at.has(b)) return `"${coreBlockOf(b).label}" อยู่ได้ที่เดียว`;
      at.set(b, [i, j]);
    }
  }
  for (const def of CORE_BLOCKS) {
    if (!at.has(def.key)) return `"${def.label}" เป็นส่วนของระบบ ลบไม่ได้ ย้ายไปไว้ในขั้นอื่นแทน`;
  }
  for (const def of CORE_BLOCKS) {
    const [si, bi] = at.get(def.key) as [number, number];
    for (const need of def.after) {
      const [ni, nj] = at.get(need) as [number, number];
      if (ni > si || (ni === si && nj > bi)) {
        return `"${def.label}" ใช้ระยะที่เลือก ต้องอยู่หลัง "${coreBlockOf(need).label}"`;
      }
    }
  }
  for (const s of flow) {
    if (!s.blocks?.length) continue;
    // every runner must pass the system parts
    if (s.hidden) return `ขั้น "${s.title}" มีส่วนของระบบ ซ่อนไม่ได้`;
    if (s.categoryCodes?.length) return `ขั้น "${s.title}" มีส่วนของระบบ ต้องแสดงกับทุกระยะ`;
  }
  return null;
}

/**
 * Notes that do not stop publishing: a summary placed before a priced part shows the runner a
 * total that is not final yet.
 */
export function flowWarnings(flow: FormStepDef[]): string[] {
  const idx = (b: FormCoreBlock) => flow.findIndex((s) => s.blocks?.includes(b));
  const review = idx('review');
  const out: string[] = [];
  for (const b of ['souvenir', 'delivery'] as FormCoreBlock[]) {
    if (idx(b) > review) out.push(`"${coreBlockOf(b).label}" อยู่หลังสรุป ยอดที่นักวิ่งเห็นในสรุปจะยังไม่รวมส่วนนี้`);
  }
  return out;
}

const ID_RE = /^[A-Za-z0-9_-]{1,60}$/;
const line = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .slice(0, max)
    .trim();
const text = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, max)
    .trim();

/**
 * The step order the organizer wants to save, checked against what is live: shape and limits,
 * system parts each placed once and after what they depend on, and steps holding answered
 * questions kept (they may be hidden instead).
 */
export function normalizeFormFlow(
  raw: unknown,
  prev: { flow: FormStepDef[]; fields: CustomRegistrationField[] },
  answered: AnsweredIndex
): { ok: true; value: FormStepDef[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: 'ข้อมูลขั้นตอนไม่ถูกต้อง' };
  // a draft made before 28 Nov 2026 may still carry the old shirt part
  const steps = withoutRetiredBlocks(raw as FormStepDef[], prev.fields) as unknown[];
  if (steps.length > FLOW_LIMITS.steps) return { ok: false, error: `ฟอร์มมีได้ไม่เกิน ${FLOW_LIMITS.steps} ขั้น (ไม่นับขั้นชำระเงิน)` };
  const flow: FormStepDef[] = [];
  for (const s of steps as Record<string, unknown>[]) {
    const id = String(s?.id ?? '');
    if (!ID_RE.test(id) || id === 'pay') return { ok: false, error: 'รหัสขั้นตอนไม่ถูกต้อง' };
    if (flow.some((x) => x.id === id)) return { ok: false, error: 'มีขั้นตอนซ้ำกัน' };
    const title = line(s?.title, FORM_LIMITS.stepTitle);
    if (!title) return { ok: false, error: 'ตั้งชื่อขั้นตอนให้ครบทุกขั้น' };
    const description = text(s?.description, FORM_LIMITS.stepDescription);
    const blocks = Array.isArray(s?.blocks) ? (s.blocks as unknown[]).map(String) : [];
    if (blocks.some((b) => !BLOCK_KEYS.has(b as FormCoreBlock))) return { ok: false, error: 'ส่วนของระบบในขั้นตอนไม่ถูกต้อง' };
    const codes = Array.isArray(s?.categoryCodes)
      ? (s.categoryCodes as unknown[]).map((c) => line(c, 20)).filter(Boolean).slice(0, 20)
      : [];
    const lock = s?.lock === 'position' || s?.lock === 'all' ? (s.lock as EditorLock) : undefined;
    flow.push({
      id,
      title,
      ...(description ? { description } : {}),
      ...(blocks.length ? { blocks: blocks as FormCoreBlock[] } : {}),
      ...(codes.length ? { categoryCodes: codes } : {}),
      ...(s?.hidden === true ? { hidden: true } : {}),
      ...(lock ? { lock } : {}),
    });
  }
  const problem = flowProblem(flow);
  if (problem) return { ok: false, error: problem };
  // a step holding questions runners answered stays (it may be hidden)
  for (const s of prev.flow) {
    if (flow.some((x) => x.id === s.id)) continue;
    const holds = prev.fields.some((f) => flowStepOf(f, prev.flow) === s.id && answered.fieldIds.has(f.id));
    if (holds) return { ok: false, error: `ขั้น "${s.title}" มีคำถามที่คนตอบแล้ว ลบไม่ได้ ใช้ "ซ่อน" แทน` };
  }
  return { ok: true, value: flow };
}
