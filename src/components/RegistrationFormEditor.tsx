import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Swal from 'sweetalert2';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  pointerWithin,
  type CollisionDetection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CustomFieldType, CustomRegistrationField, OrganizerFormStep, RaceEvent } from '../types';
import { FORM_PREVIEW_PARAM, type PreviewForm } from './formPreview';
import {
  CORE_STEP,
  FORM_LIMITS,
  QUESTION_KINDS,
  compatibleTypes,
  isChoiceField,
  isContentField,
  kindOf,
  normalizeForm,
  stepOf,
  stepsShown,
  validateAnswers,
} from '../data/registrationForm';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { TextList } from './PageItemEditors';
import { RunnerCustomFieldsInputs, RunnerQuestion } from './PublicEventView';
import { calculateFeeQuote, formatThb, getCurrentTier } from '../utils/pricing';
import '../form-editor.css';

/**
 * The registration form editor (24 Nov 2026, docs/registration-form-editor-plan.md part B):
 * Google-Forms-like question cards the organizer drags from a palette into the "runner details"
 * step or into up to three steps of their own (between runner details and the shop). The core
 * steps are drawn locked. A card opens in place to edit; "Try it" fills the form as a runner would,
 * with the same checks the server runs. Publishing makes a new form version.
 */

type Form = { fields: CustomRegistrationField[]; steps: OrganizerFormStep[] };

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function blankField(type: CustomFieldType, stepKey: string): CustomRegistrationField {
  const choice = type === 'radio' || type === 'multiselect' || type === 'select';
  return {
    id: newId('q'),
    type,
    label: type === 'heading' ? tx('หัวข้อย่อย') : type === 'note' ? tx('ข้อความอธิบาย') : '',
    required: false,
    isSensitive: false,
    stepKey,
    policy: 'CUSTOMIZABLE',
    ...(choice ? { options: [tx('ตัวเลือก 1'), tx('ตัวเลือก 2')] } : {}),
  };
}

/** where a drop lands: the card under the pointer, else the step under it, else the nearest card */
const dropTarget: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  const cards = under.filter((c) => String(c.id).startsWith('f:'));
  if (cards.length > 0) return cards;
  if (under.length > 0) return under;
  return closestCenter(args);
};

const swalLook = {
  buttonsStyling: false,
  heightAuto: false,
  scrollbarPadding: false,
  customClass: {
    container: 'kratai-swal-top',
    popup: 'kratai-swal-popup',
    actions: 'kratai-swal-actions',
    confirmButton: 'btn-primary',
    cancelButton: 'btn-secondary',
  },
} as const;

export function RegistrationFormEditor({
  event,
  canEdit,
  answerCounts,
  onPublish,
}: {
  event: RaceEvent;
  canEdit: boolean;
  /** how many registrations answered each question (question id -> count) */
  answerCounts: Record<string, number>;
  onPublish: (form: Form) => Promise<{ ok: boolean; error?: string }>;
}) {
  const live = useMemo<Form>(() => ({ fields: event.customFields ?? [], steps: event.formCustomSteps ?? [] }), [event]);
  const [form, setForm] = useState<Form>(live);
  const [saved, setSaved] = useState<Form>(live);
  const [selected, setSelected] = useState<string | null>(null);
  // 'preview' = the runner's real sign-up page on its own tab, full width (user choice 24 Nov 2026)
  const [mode, setMode] = useState<'edit' | 'try' | 'preview'>('edit');
  const [fullDevice, setFullDevice] = useState<'desktop' | 'phone'>('desktop');
  const [status, setStatus] = useState<{ tone: 'idle' | 'saving' | 'ok' | 'err'; text: string }>({ tone: 'idle', text: '' });
  const [dragging, setDragging] = useState<string | null>(null);
  /** the step shown, like the runner's wizard: 'start', CORE_STEP, an own step id, or a later core step */
  const [view, setView] = useState<string>(CORE_STEP);
  /** the live runner page next to the editor: phone or desktop width, or hidden */
  const [device, setDevice] = useState<PreviewDevice>('phone');
  const [tryCode, setTryCode] = useState(event.categories[0]?.code ?? '');
  const [tryAnswers, setTryAnswers] = useState<Record<string, string | boolean>>({});
  const [tryErrors, setTryErrors] = useState<Record<string, string>>({});
  const dirty = !sameJson(form, saved);
  const cats = event.categories;
  const answered = (id: string) => (answerCounts[id] ?? 0) > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const setFields = (fn: (f: CustomRegistrationField[]) => CustomRegistrationField[]) => setForm((p) => ({ ...p, fields: fn(p.fields) }));
  const setSteps = (fn: (s: OrganizerFormStep[]) => OrganizerFormStep[]) => setForm((p) => ({ ...p, steps: fn(p.steps) }));
  const patchField = (id: string, patch: Partial<CustomRegistrationField>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const fieldsOf = (stepId: string) => form.fields.filter((f) => stepOf(f, form.steps) === stepId);
  const questionCount = form.fields.filter((f) => !isContentField(f) && !f.hidden).length;
  const visibleSteps = form.steps.filter((s) => !s.hidden).length;

  /** put a field at a position of a step (the list order is the order inside each step) */
  const placeField = (field: CustomRegistrationField, stepId: string, beforeId: string | null) => {
    setFields((fs) => {
      const rest = fs.filter((f) => f.id !== field.id);
      const moved = { ...field, stepKey: stepId };
      if (beforeId) {
        const at = rest.findIndex((f) => f.id === beforeId);
        if (at >= 0) return [...rest.slice(0, at), moved, ...rest.slice(at)];
      }
      // after the last field of that step (or at the end)
      let last = -1;
      rest.forEach((f, i) => {
        if (stepOf(f, form.steps) === stepId) last = i;
      });
      return last >= 0 ? [...rest.slice(0, last + 1), moved, ...rest.slice(last + 1)] : [...rest, moved];
    });
  };

  const addField = (type: CustomFieldType, stepId = view === CORE_STEP || form.steps.some((x) => x.id === view) ? view : CORE_STEP, beforeId: string | null = null) => {
    if (!canEdit) return;
    if (form.fields.length >= FORM_LIMITS.fields) {
      setStatus({ tone: 'err', text: txf('ฟอร์มมีคำถามได้ไม่เกิน {0} ข้อ', FORM_LIMITS.fields) });
      return;
    }
    const f = blankField(type, stepId);
    placeField(f, stepId, beforeId);
    setSelected(f.id);
    setStatus({ tone: 'idle', text: '' });
  };

  const moveField = (id: string, d: -1 | 1) => {
    const f = form.fields.find((x) => x.id === id);
    if (!f) return;
    const list = fieldsOf(stepOf(f, form.steps));
    const i = list.findIndex((x) => x.id === id);
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const other = list[j];
    setFields((fs) => {
      const a = fs.findIndex((x) => x.id === id);
      const b = fs.findIndex((x) => x.id === other.id);
      const next = [...fs];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  };

  const removeField = (f: CustomRegistrationField) => {
    if (answered(f.id) || f.policy === 'LOCKED') return;
    setFields((fs) => fs.filter((x) => x.id !== f.id));
    setSelected(null);
  };

  const duplicateField = (f: CustomRegistrationField) => {
    if (f.policy === 'LOCKED') return;
    const copy: CustomRegistrationField = { ...f, id: newId('q'), label: f.label, policy: 'CUSTOMIZABLE', approval: undefined, hidden: undefined };
    placeField(copy, stepOf(f, form.steps), form.fields[form.fields.findIndex((x) => x.id === f.id) + 1]?.id ?? null);
    setSelected(copy.id);
  };

  const addStep = () => {
    if (visibleSteps >= FORM_LIMITS.steps) return;
    const st: OrganizerFormStep = { id: newId('st'), title: txf('ขั้นตอนที่ {0} ของคุณ', visibleSteps + 1) };
    setForm((p) => ({ steps: [...p.steps, st], fields: [...p.fields, { ...blankField('text', st.id), label: '' }] }));
    setView(st.id);
  };
  const stepHasAnswers = (id: string) => form.fields.some((f) => f.stepKey === id && answered(f.id));
  const removeStep = (st: OrganizerFormStep) => {
    if (stepHasAnswers(st.id)) return;
    setForm((p) => ({ steps: p.steps.filter((s) => s.id !== st.id), fields: p.fields.filter((f) => f.stepKey !== st.id) }));
    setView(CORE_STEP);
  };
  const moveStep = (id: string, d: -1 | 1) =>
    setSteps((ss) => {
      const i = ss.findIndex((s) => s.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= ss.length) return ss;
      const next = [...ss];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  /* ---------------- drag and drop ---------------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  /** the step button under the pointer, when a card or a palette item is held over the step bar */
  const [nodeOver, setNodeOver] = useState<string | null>(null);
  const pointerAt = (e: { activatorEvent: Event; delta: { x: number; y: number } }) => {
    const start = e.activatorEvent as PointerEvent | KeyboardEvent;
    return 'clientX' in start ? { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y } : null;
  };
  const stepButtonAt = (p: { x: number; y: number } | null) => {
    if (!p) return null;
    const el = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>('[data-fe-step]');
    return el && el.dataset.feDrop === 'yes' ? (el.dataset.feStep ?? null) : null;
  };
  const onDragMove = (e: DragMoveEvent) => {
    const key = stepButtonAt(pointerAt(e));
    if (key !== nodeOver) setNodeOver(key);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    setNodeOver(null);
    const a = String(e.active.id);
    // dropped on a step in the step bar: to the end of that step
    const onStep = stepButtonAt(pointerAt(e));
    if (onStep && canEdit) {
      if (a.startsWith('pal:')) {
        addField(a.slice(4) as CustomFieldType, onStep, null);
        setView(onStep);
        return;
      }
      const moving = form.fields.find((x) => `f:${x.id}` === a);
      if (!moving) return;
      if (moving.policy === 'LOCKED' && onStep !== stepOf(moving, form.steps)) {
        setStatus({ tone: 'err', text: tx('ช่องที่แพลตฟอร์มล็อกไว้ย้ายข้ามขั้นตอนไม่ได้') });
        return;
      }
      placeField(moving, onStep, null);
      const name = wizard.find((w) => w.key === onStep)?.label ?? '';
      setStatus({ tone: 'idle', text: txf('ย้าย "{0}" ไปขั้น "{1}" แล้ว', moving.label || tx('คำถาม'), name) });
      return;
    }
    const o = e.over ? String(e.over.id) : null;
    if (!o || !canEdit) return;
    // where it lands: before a field, or at the end of a step
    let stepId: string;
    let beforeId: string | null = null;
    if (o.startsWith('step:')) stepId = o.slice(5);
    else {
      const overField = form.fields.find((f) => `f:${f.id}` === o);
      if (!overField) return;
      stepId = stepOf(overField, form.steps);
      // above or below the card under the pointer: compare the pointer with its middle
      const overRect = e.over!.rect;
      const start = e.activatorEvent as PointerEvent | KeyboardEvent;
      const pointerY = 'clientY' in start ? start.clientY + e.delta.y : null;
      const activeRect = e.active.rect.current.translated;
      const y = pointerY ?? (activeRect ? activeRect.top + activeRect.height / 2 : overRect.top);
      const below = y > overRect.top + overRect.height / 2;
      if (below) {
        const list = fieldsOf(stepId);
        const i = list.findIndex((f) => f.id === overField.id);
        beforeId = list[i + 1]?.id ?? null;
      } else beforeId = overField.id;
    }
    if (a.startsWith('pal:')) {
      addField(a.slice(4) as CustomFieldType, stepId, beforeId);
      return;
    }
    const f = form.fields.find((x) => `f:${x.id}` === a);
    if (!f || beforeId === f.id) return;
    // the platform's locked fields stay in the step they belong to
    if (f.policy === 'LOCKED' && stepId !== stepOf(f, form.steps)) {
      setStatus({ tone: 'err', text: tx('ช่องที่แพลตฟอร์มล็อกไว้ย้ายข้ามขั้นตอนไม่ได้') });
      return;
    }
    placeField(f, stepId, beforeId);
  };

  /* ---------------- publish ---------------- */
  const discard = () => {
    setForm(saved);
    setSelected(null);
    setStatus({ tone: 'idle', text: '' });
  };
  const publish = async () => {
    if (!canEdit || status.tone === 'saving') return;
    const checked = normalizeForm(form, saved, { fieldIds: new Set(), options: new Map() });
    if (!checked.ok) {
      setStatus({ tone: 'err', text: checked.error });
      return;
    }
    const answer = await Swal.fire({
      ...swalLook,
      icon: 'question',
      title: tx('เผยแพร่ฟอร์มสมัคร?'),
      text: txf('{0} — ใบสมัครใหม่จะใช้ฟอร์มนี้ทันที ใบสมัครเดิมยังผูกกับเวอร์ชันเดิม', checked.summary),
      showCancelButton: true,
      confirmButtonText: tx('เผยแพร่'),
      cancelButtonText: tx('ยกเลิก'),
      focusConfirm: true,
    });
    if (!answer.isConfirmed) return;
    setStatus({ tone: 'saving', text: tx('กำลังเผยแพร่…') });
    const res = await onPublish(form);
    if (res.ok) {
      setSaved(form);
      setStatus({ tone: 'ok', text: tx('เผยแพร่แล้ว ใบสมัครใหม่ใช้ฟอร์มนี้') });
    } else setStatus({ tone: 'err', text: res.error || tx('เผยแพร่ไม่สำเร็จ ลองอีกครั้ง') });
  };

  /* ---------------- the wizard (the runner's steps) ---------------- */
  const tryCtx = { raceDistance: tryCode };
  const ownSteps = mode === 'try' ? stepsShown(form.steps, form.fields, tryAnswers, tryCtx) : form.steps;
  const hasSouvenirs = (event.products ?? []).length > 0;
  const wizard: WizardStep[] = [
    { key: 'start', label: tx('เริ่ม'), kind: 'locked' },
    { key: CORE_STEP, label: tx('ข้อมูล'), kind: 'core' },
    ...ownSteps.map((st) => ({ key: st.id, label: st.title || tx('ขั้นของคุณ'), kind: 'own' as const, hidden: st.hidden })),
    { key: 'shop', label: tx('สินค้า'), kind: 'locked' },
    ...(hasSouvenirs ? [{ key: 'souvenir', label: tx('ของที่ระลึก'), kind: 'locked' as const }] : []),
    { key: 'address', label: tx('ที่อยู่'), kind: 'locked' },
    { key: 'review', label: tx('สรุป'), kind: 'locked' },
    { key: 'pay', label: tx('ชำระเงิน'), kind: 'locked' },
  ];
  const at = Math.max(0, wizard.findIndex((w) => w.key === view) >= 0 ? wizard.findIndex((w) => w.key === view) : 1);
  const current = wizard[at];
  const ownStep = form.steps.find((x) => x.id === current.key);
  const editableView = current.kind !== 'locked';
  const onTryAnswer = (id: string, v: string | boolean) => {
    setTryAnswers((p) => ({ ...p, [id]: v }));
    setTryErrors((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };
  const tryStep = (stepId: string) => (
    <>
      <RunnerCustomFieldsInputs
        fields={form.fields}
        answers={tryAnswers}
        onAnswerChange={onTryAnswer}
        raceDistanceCode={tryCode}
        steps={form.steps}
        stepId={stepId}
        errors={tryErrors}
        heading={stepId === CORE_STEP ? undefined : null}
      />
      {Object.keys(tryErrors).length > 0 && (
        <div className="error-callout" role="alert">
          <span>{tx(Object.values(tryErrors)[0])}</span>
        </div>
      )}
    </>
  );
  const goNext = () => {
    if (at >= wizard.length - 1) return;
    if (mode === 'try' && current.kind !== 'locked') {
      const problems = validateAnswers(form.fields, tryAnswers, tryCtx, { steps: form.steps, stepId: current.key });
      setTryErrors(problems);
      if (Object.keys(problems).length > 0) return;
    }
    setView(wizard[at + 1].key);
  };

  /* ---------------- render ---------------- */
  const draggedField = dragging?.startsWith('f:') ? form.fields.find((f) => `f:${f.id}` === dragging) : null;
  const draggedKind = dragging?.startsWith('pal:') ? kindOf(dragging.slice(4) as CustomFieldType) : draggedField ? kindOf(draggedField.type) : null;

  return (
    <div className="canvas-stack fe-page">
      <div className="page-guide-header">
        <h1>{tx('ฟอร์มสมัคร')}</h1>
        <p className="page-purpose-desc">
          {tx('ลากคำถามจากคลังทางซ้ายมาวางในฟอร์ม คลิกการ์ดเพื่อแก้ ขั้นตอนหลักของระบบล็อกไว้ เพิ่มขั้นตอนของคุณได้ไม่เกิน 3 ขั้น ระหว่าง "ข้อมูลผู้สมัคร" กับ "สินค้า"')}
        </p>
      </div>

      <div className="fe-bar" role="region" aria-label={tx('เผยแพร่ฟอร์มสมัคร')}>
        <span className={`fe-status is-${status.tone}`} role="status" aria-live="polite">
          {status.text ||
            (dirty
              ? tx('มีการแก้ไขที่ยังไม่เผยแพร่')
              : canEdit
                ? txf('ฟอร์มที่ใช้อยู่: {0}', event.publishedFormVersion ?? tx('ฉบับตั้งต้น'))
                : tx('ดูอย่างเดียว — บทบาทนี้แก้ฟอร์มสมัครไม่ได้'))}
        </span>
        <span className="fe-actions">
          <span className="fe-seg" role="group" aria-label={tx('โหมด')}>
            <button type="button" aria-pressed={mode === 'edit'} className={mode === 'edit' ? 'is-on' : ''} onClick={() => setMode('edit')}>
              <FaIcon name="pen" />
              <span>{tx('แก้ไข')}</span>
            </button>
            <button type="button" aria-pressed={mode === 'try'} className={mode === 'try' ? 'is-on' : ''} onClick={() => setMode('try')}>
              <FaIcon name="hand-pointer" />
              <span>{tx('ลองกรอก')}</span>
            </button>
            <button type="button" aria-pressed={mode === 'preview'} className={mode === 'preview' ? 'is-on' : ''} onClick={() => setMode('preview')}>
              <FaIcon name="eye" />
              <span>{tx('ตัวอย่าง')}</span>
            </button>
          </span>
          {mode === 'preview' ? (
            <span className="fe-seg" role="group" aria-label={tx('ขนาดจอของตัวอย่าง')}>
              {(['desktop', 'phone'] as const).map((d) => (
                <button key={d} type="button" aria-pressed={fullDevice === d} className={fullDevice === d ? 'is-on' : ''} onClick={() => setFullDevice(d)}>
                  <FaIcon name={d === 'phone' ? 'mobile-screen' : 'desktop'} />
                  <span>{tx(d === 'phone' ? 'มือถือ' : 'เดสก์ท็อป')}</span>
                </button>
              ))}
            </span>
          ) : (
            // the phone-size page beside the editor; wide screens only (CSS hides it below 1280px)
            <span className="fe-seg fe-side-toggle" role="group" aria-label={tx('ตัวอย่างข้างฟอร์ม')}>
              <button type="button" aria-pressed={device !== 'off'} className={device !== 'off' ? 'is-on' : ''} onClick={() => setDevice(device === 'off' ? 'phone' : 'off')}>
                <FaIcon name={device === 'off' ? 'eye-slash' : 'mobile-screen'} />
                <span>{tx(device === 'off' ? 'แสดงตัวอย่างข้างฟอร์ม' : 'ตัวอย่างข้างฟอร์ม')}</span>
              </button>
            </span>
          )}
          <span className="fe-count">
            {txf('คำถาม {0}/{1}', questionCount, FORM_LIMITS.fields)} · {txf('ขั้นของคุณ {0}/{1}', visibleSteps, FORM_LIMITS.steps)}
          </span>
          {canEdit && (
            <>
              <button type="button" className="btn-secondary" aria-disabled={!dirty || undefined} onClick={() => dirty && discard()}>
                <FaIcon name="rotate-left" />
                <span>{tx('ยกเลิกการแก้ไข')}</span>
              </button>
              <button type="button" className="btn-primary" onClick={() => void publish()}>
                <FaIcon name="paper-plane" />
                <span>{status.tone === 'saving' ? tx('กำลังเผยแพร่…') : tx('เผยแพร่ฟอร์ม')}</span>
              </button>
            </>
          )}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={dropTarget}
        // drop spots are measured again while dragging (the page may scroll), and the page scrolls
        // only when the pointer is very close to an edge, so the step bar on top stays a target
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        autoScroll={{ threshold: { x: 0, y: 0.06 } }}
        onDragStart={onDragStart} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => { setDragging(null); setNodeOver(null); }}>
        <div
          className={`fe-layout${mode === 'try' ? ' is-try' : ''}${
            mode === 'preview' ? ' is-preview' : device !== 'off' ? ' has-preview is-phone' : ''
          }`}
        >
          {mode === 'edit' && (
            <aside className="fe-palette" aria-label={tx('คลังคำถาม')}>
              {(['text', 'choice', 'content'] as const).map((g) => (
                <div key={g} className="fe-pal-group">
                  <span className="fe-pal-title">
                    {g === 'text' ? tx('คำถามแบบพิมพ์') : g === 'choice' ? tx('คำถามแบบเลือก') : tx('เนื้อหา (ไม่ใช่คำถาม)')}
                  </span>
                  {QUESTION_KINDS.filter((k) => k.group === g).map((k) => (
                    <PaletteItem key={k.type} type={k.type} label={tx(k.label)} icon={k.icon} disabled={!canEdit || !editableView} onAdd={() => addField(k.type)} />
                  ))}
                </div>
              ))}
              <button type="button" className="btn-secondary fe-add-step" disabled={!canEdit || visibleSteps >= FORM_LIMITS.steps} onClick={addStep}>
                <FaIcon name="layer-group" />
                <span>{tx('เพิ่มขั้นตอนของคุณ')}</span>
              </button>
              <p className="fe-hint">
                {editableView
                  ? tx('คลิกเพื่อเพิ่มในขั้นที่เปิดอยู่ หรือลากไปวางตรงที่ต้องการ ลากการ์ดไปวางบนชื่อขั้นในแถบด้านบนเพื่อย้ายขั้น')
                  : tx('ขั้นนี้เป็นขั้นหลักของระบบ เปิดขั้น "ข้อมูล" หรือขั้นของคุณเพื่อเพิ่มคำถาม')}
              </p>
            </aside>
          )}

          {mode !== 'preview' && (
          <div className="fe-canvas">
            {mode === 'try' && (
              <div className="fe-try-bar">
                <label>
                  <span className="fe-label">{tx('ลองในฐานะผู้สมัครระยะ')}</span>
                  <select value={tryCode} onChange={(e) => setTryCode(e.target.value)}>
                    {event.categories.map((c) => (
                      <option key={c.id} value={c.code}>
                        {tx(c.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="btn-secondary" onClick={() => { setTryAnswers({}); setTryErrors({}); }}>
                  <FaIcon name="eraser" />
                  <span>{tx('ล้างคำตอบ')}</span>
                </button>
                <span className="fe-hint">{tx('กรอกทีละขั้นเหมือนนักวิ่ง ไม่มีการบันทึกคำตอบในโหมดนี้')}</span>
              </div>
            )}

            <div className="event-reg-wizard-pane fe-wizard">
              <nav className="circle-stepper-bar" aria-label={tx('ขั้นตอนการสมัคร')}>
                {wizard.map((w, i) => (
                  <WizardNode
                    key={w.key}
                    step={w}
                    index={i}
                    current={at}
                    last={i === wizard.length - 1}
                    droppable={mode === 'edit' && w.kind !== 'locked'}
                    over={nodeOver === w.key}
                    onOpen={() => setView(w.key)}
                  />
                ))}
              </nav>

              <div className="reg-step-body fe-step-body">
                {current.kind === 'locked' && <LockedBody stepKey={current.key} event={event} />}

                {current.kind === 'core' && (
                  <>
                    <h2 className="reg-step-accent-heading">{tx('กรอกข้อมูลผู้เข้าแข่งขัน')}</h2>
                    <SystemFields />
                    {mode === 'edit' ? (
                      <StepColumn stepId={CORE_STEP} title={tx('ข้อมูลเพิ่มเติมที่ผู้จัดขอ')} fields={fieldsOf(CORE_STEP)} renderCard={(f, i, n) => card(f, i, n)} />
                    ) : (
                      tryStep(CORE_STEP)
                    )}
                  </>
                )}

                {current.kind === 'own' && ownStep && (
                  mode === 'edit' ? (
                    <StepColumn
                      stepId={ownStep.id}
                      head={
                        <OwnStepHead
                          step={ownStep}
                          index={form.steps.indexOf(ownStep)}
                          count={form.steps.length}
                          cats={cats.map((c) => ({ code: c.code, name: c.name }))}
                          canEdit={canEdit}
                          hasAnswers={stepHasAnswers(ownStep.id)}
                          onChange={(patch) => setSteps((ss) => ss.map((x) => (x.id === ownStep.id ? { ...x, ...patch } : x)))}
                          onMove={(d) => moveStep(ownStep.id, d)}
                          onRemove={() => removeStep(ownStep)}
                        />
                      }
                      fields={fieldsOf(ownStep.id)}
                      renderCard={(f, i, n) => card(f, i, n)}
                    />
                  ) : (
                    <>
                      <h2 className="reg-step-accent-heading">{tx(ownStep.title)}</h2>
                      {ownStep.description && <p className="muted-block">{tx(ownStep.description)}</p>}
                      {tryStep(ownStep.id)}
                    </>
                  )
                )}

                <div className="reg-step-footer-between">
                  <button type="button" className="btn-secondary" aria-disabled={at === 0 || undefined} onClick={() => at > 0 && setView(wizard[at - 1].key)}>
                    {tx('ย้อนกลับ')}
                  </button>
                  <button type="button" className="btn-primary reg-next-pill-btn" aria-disabled={at === wizard.length - 1 || undefined} onClick={goNext}>
                    {mode === 'try' && current.kind !== 'locked' ? tx('ถัดไป (ตรวจคำตอบ)') : tx('ถัดไป')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
          {(mode === 'preview' || device !== 'off') && (
            <aside className={`fe-preview${mode === 'preview' ? ' is-full' : ' is-side'}`} aria-label={tx('ตัวอย่างหน้าสมัครจริง')}>
              <div className="fe-preview-head">
                <span>
                  <FaIcon name="eye" /> {tx('ตัวอย่างหน้าสมัครจริง')}
                </span>
                <span className={`fe-preview-note${dirty ? ' is-dirty' : ''}`}>
                  {dirty ? tx('แสดงฟอร์มที่ยังไม่เผยแพร่') : tx('ตรงกับฟอร์มที่ใช้อยู่')}
                </span>
              </div>
              <RunnerFormPreview
                event={event}
                form={form}
                step={view}
                device={mode === 'preview' ? fullDevice : 'phone'}
                busy={dragging !== null}
                onStep={(key) => {
                  if (wizard.some((w) => w.key === key)) setView(key);
                }}
              />
              <p className="fe-hint">
                {tx('กรอกลองได้ทุกขั้นเหมือนนักวิ่ง ขั้นที่เปิดตรงกับขั้นในตัวแก้ไข ไม่มีการส่งใบสมัครหรือชำระเงินจริง')}
              </p>
            </aside>
          )}
        </div>
        <DragOverlay dropAnimation={null} style={{ pointerEvents: 'none' }}>
          {draggedKind ? (
            <div className="fe-ghost">
              <FaIcon name={draggedKind.icon} />
              <span>{draggedField ? draggedField.label || tx(draggedKind.label) : tx(draggedKind.label)}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );

  function card(f: CustomRegistrationField, index: number, count: number) {
    return (
      <QuestionCard
        key={f.id}
        field={f}
        index={index}
        count={count}
        selected={selected === f.id}
        canEdit={canEdit}
        answers={answerCounts[f.id] ?? 0}
        cats={cats.map((c) => ({ code: c.code, name: c.name }))}
        onSelect={() => setSelected(selected === f.id ? null : f.id)}
        onChange={(patch) => patchField(f.id, patch)}
        onMove={(d) => moveField(f.id, d)}
        onDuplicate={() => duplicateField(f)}
        onRemove={() => removeField(f)}
      />
    );
  }
}

const PREVIEW_WIDTH = { desktop: 1280, phone: 390 } as const;
type PreviewDevice = keyof typeof PREVIEW_WIDTH | 'off';

/**
 * The runner's real sign-up page in an iframe (`/events/<id>/register?preview=form`), fed the unsaved
 * form by postMessage. It follows the step open in the editor, and the editor follows when the
 * runner moves on inside it. The page blocks the final submit, so nothing is booked or paid.
 */
function RunnerFormPreview({
  event,
  form,
  step,
  device,
  busy,
  onStep,
}: {
  event: RaceEvent;
  form: PreviewForm;
  step: string;
  device: Exclude<PreviewDevice, 'off'>;
  /** a drag is going on: the frame must not swallow the pointer */
  busy: boolean;
  onStep: (key: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const width = PREVIEW_WIDTH[device];
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / width) : 1;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'kr-form-preview', form, step }, window.location.origin);
  }, [form, step]);

  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; step?: string };
      if (data?.type === 'kr-form-ready') {
        setReady(true);
        sendRef.current();
      }
      if (data?.type === 'kr-form-step' && typeof data.step === 'string') onStep(data.step);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onStep]);

  return (
    <div ref={boxRef} className={`fe-preview-frame is-${device}`}>
      {!ready && <p className="fe-preview-loading">{tx('กำลังโหลดตัวอย่าง…')}</p>}
      <iframe
        ref={frameRef}
        key={device}
        title={tx('ตัวอย่างหน้าสมัครของนักวิ่ง (ไม่ส่งใบสมัครจริง)')}
        src={`/events/${encodeURIComponent(event.id)}/register?preview=${FORM_PREVIEW_PARAM}`}
        style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})`, pointerEvents: busy ? 'none' : undefined }}
        onLoad={() => send()}
      />
    </div>
  );
}

type WizardStep = { key: string; label: string; kind: 'locked' | 'core' | 'own'; hidden?: boolean };

function WizardNode({
  step,
  index,
  current,
  last,
  droppable,
  over,
  onOpen,
}: {
  step: WizardStep;
  index: number;
  current: number;
  last: boolean;
  droppable: boolean;
  over: boolean;
  onOpen: () => void;
}) {
  const isOver = over;
  const isCurrent = index === current;
  const isDone = index < current;
  return (
    <>
      <button
        type="button"
        data-fe-step={step.key}
        data-fe-drop={droppable ? 'yes' : 'no'}
        className={`circle-step-node ${isCurrent ? 'active' : isDone ? 'done' : ''} fe-node is-${step.kind}${isOver ? ' is-over' : ''}${step.hidden ? ' is-hidden' : ''}`}
        aria-current={isCurrent ? 'step' : undefined}
        onClick={onOpen}
      >
        <span className="circle-step-label">
          {step.kind === 'locked' && <FaIcon name="lock" className="fe-node-lock" />}
          {step.label}
        </span>
        <span className="circle-step-ring" aria-hidden="true" />
      </button>
      {!last && <div className={`circle-stepper-line ${isDone ? 'line-done' : ''}`} aria-hidden="true" />}
    </>
  );
}

/** the system's own fields of "runner details", as runners see them, locked */
function SystemFields() {
  const rows: [string, string][] = [
    ['ชื่อจริง (ภาษาไทย)', 'เช่น กานต์พิชชา'],
    ['นามสกุล (ภาษาไทย)', 'เช่น วัฒนากูล'],
    ['ชื่อเล่น', 'เช่น กานต์'],
    ['วันเกิด', 'วว/ดด/ปปปป'],
    ['เพศ', 'ชาย / หญิง / ไม่ระบุ'],
    ['เบอร์โทรศัพท์ผู้เข้าแข่งขัน', '08x-xxx-xxxx'],
    ['เลขบัตรประจำตัวประชาชน', 'บัตรประชาชน 13 หลัก หรือหนังสือเดินทาง'],
    ['ชื่อผู้ติดต่อฉุกเฉิน *', 'เช่น วีระ วัฒนากูล'],
    ['เบอร์โทรผู้ติดต่อฉุกเฉิน *', '08x-xxx-xxxx'],
  ];
  return (
    <fieldset className="fe-system" disabled>
      <legend>
        <FaIcon name="lock" /> {tx('ช่องหลักของระบบ (ล็อก — นักวิ่งกรอกเองหรือดึงจากโปรไฟล์)')}
      </legend>
      <div className="form-grid-2">
        {rows.map(([label, ph]) => (
          <div key={label} className="form-row">
            <label>{tx(label)}</label>
            <input type="text" placeholder={tx(ph)} aria-label={tx(label)} />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

/** a core step after "runner details": what runners see there, drawn locked */
function LockedBody({ stepKey, event }: { stepKey: string; event: RaceEvent }) {
  const head: Record<string, [string, string]> = {
    start: ['เลือกประเภทการสมัคร', 'นักวิ่งเลือกระยะและประเภทการสมัคร ราคาและที่นั่งมาจากเมนู "ระยะ ราคา และการรับสมัคร"'],
    shop: ['เลือกไซส์เสื้อและสิ่งที่ได้รับ', 'ไซส์เสื้อตามสต็อก จากเมนู "เสื้อและของที่ได้รับ"'],
    souvenir: ['ของที่ระลึก (ซื้อเพิ่มได้)', 'สินค้าของงาน จากเมนู "ร้านค้าของงาน"'],
    address: ['ที่อยู่และการรับอุปกรณ์', 'รับที่งานหรือจัดส่ง ตามที่ตั้งไว้ในเมนู "เสื้อและของที่ได้รับ"'],
    review: ['ตรวจสอบข้อมูลก่อนชำระ', 'สรุปข้อมูลผู้สมัคร รวมคำตอบของคำถามที่คุณตั้ง และยอมรับกติกา'],
    pay: ['ชำระเงิน', 'ชำระเงินผ่านระบบ (ในต้นแบบเป็นการจำลอง)'],
  };
  const [title, note] = head[stepKey] ?? ['', ''];
  return (
    <div className="fe-locked-body">
      <h2 className="reg-step-accent-heading">
        {tx(title)} <span className="fe-badge"><FaIcon name="lock" /> {tx('ขั้นหลักของระบบ')}</span>
      </h2>
      <p className="muted-block">{tx(note)}</p>
      {stepKey === 'start' && (
        <div className="fe-cat-list" inert>
          {event.categories.map((c) => {
            const tier = getCurrentTier(c);
            const quote = calculateFeeQuote(tier.priceSatang, event.feeBearerPolicy);
            return (
              <div key={c.id} className="reg-category-radio-card">
                <span className="custom-radio-circle" aria-hidden="true" />
                <span>
                  <strong>{tx(c.name)}</strong>
                  <span className="muted-inline"> · {formatThb(quote.runnerNetPaySatang, true)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PaletteItem({ type, label, icon, disabled, onAdd }: { type: CustomFieldType; label: string; icon: string; disabled: boolean; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `pal:${type}`, disabled });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`fe-pal-item${isDragging ? ' is-dragging' : ''}`}
      disabled={disabled}
      onClick={onAdd}
      aria-label={txf('เพิ่ม{0}', label)}
      {...attributes}
      {...listeners}
    >
      <FaIcon name={icon} />
      <span>{label}</span>
      <FaIcon name="grip-vertical" className="fe-pal-grip" />
    </button>
  );
}

function StepColumn({
  stepId,
  title,
  note,
  head,
  fields,
  renderCard,
}: {
  stepId: string;
  title?: string;
  note?: string;
  head?: ReactNode;
  fields: CustomRegistrationField[];
  renderCard: (f: CustomRegistrationField, index: number, count: number) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `step:${stepId}` });
  return (
    <section className={`fe-step${isOver ? ' is-over' : ''}`} aria-label={title}>
      {head ??
        (title && (
          <div className="fe-step-head">
            <span className="fe-step-title">{title}</span>
          </div>
        ))}
      {note && <p className="fe-hint">{note}</p>}
      <SortableContext items={fields.map((f) => `f:${f.id}`)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="fe-list">
          {fields.map((f, i) => renderCard(f, i, fields.length))}
          {fields.length === 0 && <p className="fe-empty">{tx('ลากคำถามมาวางที่นี่')}</p>}
        </div>
      </SortableContext>
    </section>
  );
}

function OwnStepHead({
  step,
  index,
  count,
  cats,
  canEdit,
  hasAnswers,
  onChange,
  onMove,
  onRemove,
}: {
  step: OrganizerFormStep;
  index: number;
  count: number;
  cats: { code: string; name: string }[];
  canEdit: boolean;
  hasAnswers: boolean;
  onChange: (patch: Partial<OrganizerFormStep>) => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const codes = step.categoryCodes ?? [];
  return (
    <div className="fe-own-head">
      <div className="fe-step-head">
        <span className="fe-badge is-own">
          <FaIcon name="layer-group" /> {txf('ขั้นของคุณ {0}', index + 1)}
        </span>
        {step.hidden && <span className="fe-badge">{tx('ซ่อนอยู่')}</span>}
        <span className="fe-tools">
          <button type="button" className="pe-icon-btn" aria-label={tx('ย้ายขั้นนี้ขึ้น')} aria-disabled={index === 0 || undefined} disabled={!canEdit} onClick={() => onMove(-1)}>
            <FaIcon name="arrow-up" />
          </button>
          <button type="button" className="pe-icon-btn" aria-label={tx('ย้ายขั้นนี้ลง')} aria-disabled={index === count - 1 || undefined} disabled={!canEdit} onClick={() => onMove(1)}>
            <FaIcon name="arrow-down" />
          </button>
          {hasAnswers ? (
            <button type="button" className="pe-icon-btn" aria-label={step.hidden ? tx('แสดงขั้นนี้') : tx('ซ่อนขั้นนี้')} disabled={!canEdit} onClick={() => onChange({ hidden: !step.hidden })}>
              <FaIcon name={step.hidden ? 'eye' : 'eye-slash'} />
            </button>
          ) : (
            <button type="button" className="pe-icon-btn is-danger" aria-label={tx('ลบขั้นนี้และคำถามในขั้น')} disabled={!canEdit} onClick={onRemove}>
              <FaIcon name="trash-can" />
            </button>
          )}
        </span>
      </div>
      <input
        type="text"
        className="fe-step-title-input"
        value={step.title}
        maxLength={FORM_LIMITS.stepTitle}
        aria-label={tx('ชื่อขั้นตอน')}
        placeholder={tx('ชื่อขั้นตอน เช่น ข้อมูลทีม')}
        disabled={!canEdit}
        onChange={(e) => onChange({ title: e.target.value })}
      />
      <textarea
        rows={2}
        value={step.description ?? ''}
        maxLength={FORM_LIMITS.stepDescription}
        aria-label={tx('คำอธิบายขั้นตอน')}
        placeholder={tx('คำอธิบายสั้น ๆ ว่าขั้นนี้ถามอะไร (ไม่บังคับ)')}
        disabled={!canEdit}
        onChange={(e) => onChange({ description: e.target.value || undefined })}
      />
      <CategoryPicker label={tx('แสดงขั้นนี้กับ')} cats={cats} codes={codes} disabled={!canEdit} onChange={(c) => onChange({ categoryCodes: c.length ? c : undefined })} />
    </div>
  );
}

function CategoryPicker({
  label,
  cats,
  codes,
  disabled,
  onChange,
}: {
  label: string;
  cats: { code: string; name: string }[];
  codes: string[];
  disabled: boolean;
  onChange: (codes: string[]) => void;
}) {
  return (
    <fieldset className="fe-cats" disabled={disabled}>
      <legend>{label}</legend>
      <label className="checkbox-row">
        <input type="checkbox" checked={codes.length === 0} onChange={() => onChange([])} />
        <span>{tx('ทุกระยะ')}</span>
      </label>
      {cats.map((c) => (
        <label key={c.code} className="checkbox-row">
          <input
            type="checkbox"
            checked={codes.includes(c.code)}
            onChange={(e) => onChange(e.target.checked ? [...codes, c.code] : codes.filter((x) => x !== c.code))}
          />
          <span>{tx(c.name)}</span>
        </label>
      ))}
    </fieldset>
  );
}

function QuestionCard({
  field: f,
  index,
  count,
  selected,
  canEdit,
  answers,
  cats,
  onSelect,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  field: CustomRegistrationField;
  index: number;
  count: number;
  selected: boolean;
  canEdit: boolean;
  answers: number;
  cats: { code: string; name: string }[];
  onSelect: () => void;
  onChange: (patch: Partial<CustomRegistrationField>) => void;
  onMove: (d: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `f:${f.id}`, disabled: !canEdit });
  const kind = kindOf(f.type);
  const content = isContentField(f);
  const locked = f.policy === 'LOCKED';
  const configurable = f.policy === 'CONFIGURABLE';
  const editable = canEdit && !locked && !configurable;
  const style = { transform: CSS.Transform.toString(transform), transition };
  const types = compatibleTypes(f.type).filter((t) => answers === 0 || t === f.type);
  const labelId = `fe-q-${f.id}`;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`fe-card${selected ? ' is-selected' : ''}${isDragging ? ' is-dragging' : ''}${f.hidden ? ' is-hidden' : ''}${content ? ' is-content' : ''}`}
      aria-labelledby={labelId}
    >
      <div className="fe-card-top">
        <button type="button" className="fe-grip" aria-label={txf('ลากเพื่อย้าย {0}', f.label || tx(kind?.label ?? ''))} {...attributes} {...listeners}>
          <FaIcon name="grip-vertical" />
        </button>
        <button type="button" className="fe-card-face" onClick={onSelect} aria-expanded={selected}>
          <span id={labelId} className="sr-only">
            {f.label || tx('(ยังไม่ได้ตั้งชื่อคำถาม)')}
          </span>
          <span className="fe-badges">
            <span className="fe-badge">
              <FaIcon name={kind?.icon ?? 'circle-question'} /> {tx(kind?.label ?? f.type)}
            </span>
            {selected ? <span className="fe-badge is-own">{tx('กำลังแก้')}</span> : <span className="fe-badge">{tx('คลิกเพื่อแก้')}</span>}
            {locked && (
              <span className="fe-badge">
                <FaIcon name="lock" /> {tx('ล็อก')}
              </span>
            )}
            {configurable && <span className="fe-badge">{tx('ปรับได้เฉพาะบังคับตอบ')}</span>}
            {answers > 0 && <span className="fe-badge">{txf('มีคนตอบ {0}', answers)}</span>}
            {f.approval === 'pending' && <span className="fe-badge is-warn">{tx('รอ Platform Owner อนุมัติ')}</span>}
            {f.hidden && <span className="fe-badge">{tx('ซ่อนอยู่')}</span>}
            {(f.categoryCodes?.length ?? 0) > 0 && (
              <span className="fe-badge">
                <FaIcon name="filter" /> {(f.categoryCodes ?? []).join(', ')}
              </span>
            )}
          </span>
        </button>
      </div>

      {!selected && (
        <div className="fe-runner-look" onClick={onSelect}>
          <div inert>
            {f.label ? (
              <RunnerQuestion field={f} value={undefined} onChange={() => {}} />
            ) : (
              <p className="fe-empty">{tx('(ยังไม่ได้ตั้งชื่อคำถาม) — คลิกเพื่อแก้')}</p>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div className="fe-card-edit">
          <div className="fe-row">
            <label className="fe-grow">
              <span className="fe-label">{content ? tx('ข้อความ') : tx('คำถาม')}</span>
              {f.type === 'note' ? (
                <textarea rows={3} value={f.label} maxLength={FORM_LIMITS.description} disabled={!editable} onChange={(e) => onChange({ label: e.target.value })} />
              ) : (
                <input
                  type="text"
                  value={f.label}
                  maxLength={FORM_LIMITS.label}
                  placeholder={content ? '' : tx('เช่น เคยวิ่งระยะ 21 กม. มาก่อนไหม')}
                  disabled={!editable}
                  autoFocus={editable && !f.label}
                  onChange={(e) => onChange({ label: e.target.value })}
                />
              )}
            </label>
            {!content && (
              <label>
                <span className="fe-label">{tx('ประเภท')}</span>
                <select value={f.type} disabled={!editable || types.length < 2} onChange={(e) => onChange({ type: e.target.value as CustomFieldType })}>
                  {types.map((t) => (
                    <option key={t} value={t}>
                      {tx(kindOf(t)?.label ?? t)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {!content && (
            <label>
              <span className="fe-label">{tx('คำอธิบายใต้คำถาม (ไม่บังคับ)')}</span>
              <input type="text" value={f.descriptionTh ?? ''} maxLength={FORM_LIMITS.description} disabled={!editable} onChange={(e) => onChange({ descriptionTh: e.target.value || undefined })} />
            </label>
          )}

          {isChoiceField(f) && (
            <fieldset className="fe-plain" disabled={!editable}>
              <TextList
                title={tx('ตัวเลือก')}
                rows={(f.options ?? []).map((o) => ({ o }))}
                fields={[{ key: 'o', label: tx('ตัวเลือก'), max: FORM_LIMITS.option }]}
                max={FORM_LIMITS.options}
                blank={{ o: '' }}
                inline={{ marker: f.type === 'multiselect' ? 'bullet' : 'number' }}
                addLabel={tx('เพิ่มตัวเลือก')}
                onChange={(rows) => onChange({ options: rows.map((r) => r.o) })}
              />
              {(f.type === 'radio' || f.type === 'multiselect') && (
                <label className="checkbox-row">
                  <input type="checkbox" checked={f.allowOther === true} disabled={!editable} onChange={(e) => onChange({ allowOther: e.target.checked || undefined })} />
                  <span>{tx('มีตัวเลือก "อื่น ๆ (ระบุ)"')}</span>
                </label>
              )}
            </fieldset>
          )}

          {!content && (
            <details className="fe-more">
              <summary>{tx('ตรวจคำตอบ และแสดงกับใคร')}</summary>
              {f.type === 'multiselect' && (
                <div className="fe-row">
                  <NumberBox label={tx('เลือกอย่างน้อย (ข้อ)')} value={f.minChoices} disabled={!editable} onChange={(v) => onChange({ minChoices: v })} />
                  <NumberBox label={tx('เลือกได้ไม่เกิน (ข้อ)')} value={f.maxChoices} disabled={!editable} onChange={(v) => onChange({ maxChoices: v })} />
                </div>
              )}
              {(f.type === 'text' || f.type === 'textarea') && (
                <div className="fe-row">
                  <NumberBox label={tx('ยาวอย่างน้อย (ตัวอักษร)')} value={f.minLength} disabled={!editable} onChange={(v) => onChange({ minLength: v })} />
                  <NumberBox label={tx('ยาวไม่เกิน (ตัวอักษร)')} value={f.maxLength} disabled={!editable} onChange={(v) => onChange({ maxLength: v })} />
                </div>
              )}
              {f.type === 'number' && (
                <div className="fe-row">
                  <NumberBox label={tx('ค่าต่ำสุด')} value={f.minValue} disabled={!editable} onChange={(v) => onChange({ minValue: v })} />
                  <NumberBox label={tx('ค่าสูงสุด')} value={f.maxValue} disabled={!editable} onChange={(v) => onChange({ maxValue: v })} />
                </div>
              )}
              <CategoryPicker
                label={tx('ถามเฉพาะผู้สมัครระยะ')}
                cats={cats}
                codes={f.categoryCodes ?? []}
                disabled={!editable}
                onChange={(c) => onChange({ categoryCodes: c.length ? c : undefined })}
              />
              <label className="checkbox-row">
                <input type="checkbox" checked={f.isSensitive} disabled={!editable} onChange={(e) => onChange({ isSensitive: e.target.checked })} />
                <span>{tx('ข้อมูลอ่อนไหว (สุขภาพ เลขเอกสาร) — ต้องรอ Platform Owner อนุมัติก่อนถามจริง และเจ้าหน้าที่หน้างานไม่เห็นคำตอบ')}</span>
              </label>
            </details>
          )}

          <div className="fe-card-foot">
            {!content && (
              <label className="fe-switch">
                <input type="checkbox" checked={f.required} disabled={!canEdit || locked} onChange={(e) => onChange({ required: e.target.checked })} />
                <span>{tx('บังคับตอบ')}</span>
              </label>
            )}
            <span className="fe-tools">
              <button type="button" className="pe-icon-btn" aria-label={tx('ย้ายขึ้น')} aria-disabled={index === 0 || undefined} disabled={!canEdit} onClick={() => onMove(-1)}>
                <FaIcon name="arrow-up" />
              </button>
              <button type="button" className="pe-icon-btn" aria-label={tx('ย้ายลง')} aria-disabled={index === count - 1 || undefined} disabled={!canEdit} onClick={() => onMove(1)}>
                <FaIcon name="arrow-down" />
              </button>
              <button type="button" className="pe-icon-btn" aria-label={tx('ทำสำเนา')} disabled={!canEdit || locked} onClick={onDuplicate}>
                <FaIcon name="clone" />
              </button>
              {answers > 0 || locked ? (
                <button
                  type="button"
                  className="pe-icon-btn"
                  aria-label={f.hidden ? tx('ถามข้อนี้อีกครั้ง') : tx('ซ่อนข้อนี้ (มีคนตอบแล้ว ลบไม่ได้)')}
                  disabled={!canEdit || locked}
                  onClick={() => onChange({ hidden: f.hidden ? undefined : true })}
                >
                  <FaIcon name={f.hidden ? 'eye' : 'eye-slash'} />
                </button>
              ) : (
                <button type="button" className="pe-icon-btn is-danger" aria-label={tx('ลบคำถาม')} disabled={!canEdit} onClick={onRemove}>
                  <FaIcon name="trash-can" />
                </button>
              )}
            </span>
          </div>
          {answers > 0 && <p className="fe-hint">{tx('มีคนตอบข้อนี้แล้ว: เปลี่ยนประเภทหรือลบไม่ได้ ตัวเลือกที่มีคนเลือกแล้วลบไม่ได้ (เพิ่มได้)')}</p>}
        </div>
      )}
    </article>
  );
}

function NumberBox({ label, value, disabled, onChange }: { label: string; value?: number; disabled: boolean; onChange: (v: number | undefined) => void }) {
  return (
    <label className="fe-num">
      <span className="fe-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    </label>
  );
}
