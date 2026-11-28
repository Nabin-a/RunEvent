import { useState } from 'react';
import Swal from 'sweetalert2';
import { DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { CustomFieldType, CustomRegistrationField, EditorLock, FormCoreBlock, FormStepDef, RaceEvent } from '../../types';
import { FORM_LIMITS, QUESTION_KINDS, isContentField, kindOf, validateAnswers } from '../../data/registrationForm';
import { CORE_BLOCKS, FLOW_LIMITS, coreBlockOf, customStepsOf, flowProblem, flowStepOf, flowWarnings, runnerFlow, stepWithBlock } from '../../data/formFlow';
import { tx, txf } from '../../i18n';
import { FaIcon } from '../FaIcon';
import { SelectMenu } from '../SelectMenu';
import { RunnerCustomFieldsInputs } from '../PublicEventView';
import {
  CategoryPicker,
  LockedBody,
  PaletteItem,
  QuestionCard,
  RunnerFormPreview,
  StepColumn,
  SystemFields,
  WizardNode,
  blankField,
  dropTarget,
  swalLook,
  type WizardStep,
} from '../RegistrationFormEditor';
import '../../form-editor.css';

/**
 * The registration form part of the combined editor "หน้างานและฟอร์มสมัคร" (27 Nov 2026,
 * docs/registration-form-editor-plan.md section 9, phase 4). Steps are one free list (formFlow.ts):
 * the organizer adds, removes, renames and reorders them, and moves the system parts between steps;
 * payment always comes last. Questions are the Google-Forms-like cards of the earlier editor.
 *
 * Controlled: the shell (EventStudio) owns the form and saves it as a draft; this part reports every
 * change through `onChange`. A change that breaks the step rules is refused with a message.
 */

export type FlowForm = { fields: CustomRegistrationField[]; flow: FormStepDef[]; maxEntries: number };

const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
/** the old editor's key for each system part (their locked look is reused) */
const BLOCK_VIEW: Record<FormCoreBlock, string> = {
  category: 'start',
  participant: 'core',
  souvenir: 'souvenir',
  delivery: 'address',
  review: 'review',
};

export function StudioFormEditor({
  event,
  canEdit,
  answerCounts,
  value,
  onChange,
  view,
  onView,
  onStatus,
}: {
  event: RaceEvent;
  canEdit: boolean;
  answerCounts: Record<string, number>;
  value: FlowForm;
  onChange: (next: FlowForm) => void;
  /** the step open (a step id, or 'pay') */
  view: string;
  onView: (stepId: string) => void;
  onStatus: (s: { tone: 'idle' | 'err' | 'warn' | 'ok'; text: string }) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'edit' | 'try' | 'preview'>('edit');
  const [fullDevice, setFullDevice] = useState<'desktop' | 'phone'>('desktop');
  const [dragging, setDragging] = useState<string | null>(null);
  const [nodeOver, setNodeOver] = useState<string | null>(null);
  const [tryCode, setTryCode] = useState(event.categories[0]?.code ?? '');
  const [tryAnswers, setTryAnswers] = useState<Record<string, string | boolean>>({});
  const [tryErrors, setTryErrors] = useState<Record<string, string>>({});

  const { fields, flow } = value;
  const cats = event.categories.map((c) => ({ code: c.code, name: c.name }));
  const answered = (id: string) => (answerCounts[id] ?? 0) > 0;
  const stepOfField = (f: CustomRegistrationField) => flowStepOf(f, flow);
  const fieldsOf = (stepId: string) => fields.filter((f) => stepOfField(f) === stepId);
  const stepById = (id: string) => flow.find((s) => s.id === id);
  const stepHasAnswers = (id: string) => fields.some((f) => stepOfField(f) === id && answered(f.id));
  const questionCount = fields.filter((f) => !isContentField(f) && !f.hidden).length;
  const canEditStep = (s?: FormStepDef) => canEdit && !!s && s.lock !== 'all';
  const canMoveStep = (s?: FormStepDef) => canEdit && !!s && !s.lock;

  /** every change goes through here: the step rules are kept (the server checks them again) */
  const commit = (next: FlowForm, done?: string) => {
    const problem = flowProblem(next.flow);
    if (problem) {
      onStatus({ tone: 'err', text: problem });
      return false;
    }
    onChange(next);
    const notes = flowWarnings(next.flow);
    onStatus({ tone: notes.length ? 'warn' : 'idle', text: notes[0] ?? done ?? '' });
    return true;
  };
  const setFields = (fn: (f: CustomRegistrationField[]) => CustomRegistrationField[]) => commit({ ...value, fields: fn(fields), flow });
  const setFlow = (fn: (s: FormStepDef[]) => FormStepDef[], done?: string) => commit({ ...value, fields, flow: fn(flow) }, done);
  const patchStep = (id: string, patch: Partial<FormStepDef>) => setFlow((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const patchField = (id: string, patch: Partial<CustomRegistrationField>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  /** put a field at a position of a step (the list order is the order inside each step) */
  const placeField = (field: CustomRegistrationField, stepId: string, beforeId: string | null) =>
    setFields((fs) => {
      const rest = fs.filter((f) => f.id !== field.id);
      const moved = { ...field, stepKey: stepId };
      if (beforeId) {
        const at = rest.findIndex((f) => f.id === beforeId);
        if (at >= 0) return [...rest.slice(0, at), moved, ...rest.slice(at)];
      }
      let last = -1;
      rest.forEach((f, i) => {
        if (flowStepOf(f, flow) === stepId) last = i;
      });
      return last >= 0 ? [...rest.slice(0, last + 1), moved, ...rest.slice(last + 1)] : [...rest, moved];
    });

  const currentStep = stepById(view);
  const addTarget = currentStep && canEditStep(currentStep) ? currentStep.id : null;
  const addField = (type: CustomFieldType, stepId = addTarget, beforeId: string | null = null) => {
    if (!canEdit || !stepId) return;
    if (!canEditStep(stepById(stepId))) {
      onStatus({ tone: 'err', text: tx('ขั้นนี้ล็อกทั้งหมดอยู่ ปลดล็อกก่อนจึงเพิ่มคำถามได้') });
      return;
    }
    if (fields.length >= FORM_LIMITS.fields) {
      onStatus({ tone: 'err', text: txf('ฟอร์มมีคำถามได้ไม่เกิน {0} ข้อ', FORM_LIMITS.fields) });
      return;
    }
    const f = blankField(type, stepId);
    placeField(f, stepId, beforeId);
    setSelected(f.id);
  };
  const moveField = (id: string, d: -1 | 1) => {
    const f = fields.find((x) => x.id === id);
    if (!f) return;
    const list = fieldsOf(stepOfField(f));
    const i = list.findIndex((x) => x.id === id);
    const other = list[i + d];
    if (!other) return;
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
    const copy: CustomRegistrationField = { ...f, id: newId('q'), policy: 'CUSTOMIZABLE', approval: undefined, hidden: undefined };
    placeField(copy, stepOfField(f), fields[fields.findIndex((x) => x.id === f.id) + 1]?.id ?? null);
    setSelected(copy.id);
  };

  /** move a system part to another step (it keeps its place before or after the other parts there) */
  const moveBlock = (block: FormCoreBlock, toId: string) =>
    setFlow(
      (ss) =>
        ss.map((s) => {
          const without = (s.blocks ?? []).filter((b) => b !== block);
          if (s.id !== toId) return { ...s, blocks: without.length ? without : undefined };
          // keep the parts of a step in the order of CORE_BLOCKS (distance first, summary last)
          const order = CORE_BLOCKS.map((c) => c.key);
          const blocks = [...without, block].sort((a, b) => order.indexOf(a) - order.indexOf(b));
          return { ...s, blocks, categoryCodes: undefined, hidden: undefined };
        }),
      txf('ย้าย "{0}" แล้ว', tx(coreBlockOf(block).label))
    );

  const removeStep = async (st: FormStepDef) => {
    if (!canMoveStep(st)) return;
    if (stepHasAnswers(st.id)) {
      onStatus({ tone: 'err', text: tx('ขั้นนี้มีคำถามที่คนตอบแล้ว ลบไม่ได้ ใช้ "ซ่อน" แทน') });
      return;
    }
    const others = flow.filter((s) => s.id !== st.id);
    if (others.length === 0) return;
    const parts = st.blocks ?? [];
    let target = '';
    if (parts.length) {
      const res = await Swal.fire({
        ...swalLook,
        icon: 'question',
        title: txf('ลบขั้น "{0}"?', tx(st.title)),
        text: txf('ขั้นนี้มีส่วนของระบบ ({0}) ซึ่งลบไม่ได้ เลือกขั้นที่จะย้ายไปไว้', parts.map((b) => tx(coreBlockOf(b).label)).join(', ')),
        input: 'select',
        inputOptions: Object.fromEntries(others.map((s) => [s.id, tx(s.title)])),
        showCancelButton: true,
        confirmButtonText: tx('ลบขั้นและย้าย'),
        cancelButtonText: tx('ยกเลิก'),
      });
      if (!res.isConfirmed) return;
      target = String(res.value);
    } else {
      const n = fieldsOf(st.id).length;
      const res = await Swal.fire({
        ...swalLook,
        icon: 'warning',
        title: txf('ลบขั้น "{0}"?', tx(st.title)),
        text: n ? txf('คำถาม {0} ข้อในขั้นนี้จะถูกลบด้วย ย้อนกลับได้ด้วยปุ่มย้อนกลับ', n) : tx('ย้อนกลับได้ด้วยปุ่มย้อนกลับ'),
        showCancelButton: true,
        confirmButtonText: tx('ลบขั้น'),
        cancelButtonText: tx('ยกเลิก'),
      });
      if (!res.isConfirmed) return;
    }
    const order = CORE_BLOCKS.map((c) => c.key);
    const nextFlow = others.map((s) =>
      s.id === target ? { ...s, blocks: [...(s.blocks ?? []), ...parts].sort((a, b) => order.indexOf(a) - order.indexOf(b)), categoryCodes: undefined, hidden: undefined } : s
    );
    const ok = commit(
      { ...value, flow: nextFlow, fields: parts.length ? fields.map((f) => (flowStepOf(f, flow) === st.id ? { ...f, stepKey: target } : f)) : fields.filter((f) => flowStepOf(f, flow) !== st.id) },
      txf('ลบขั้น "{0}" แล้ว', tx(st.title))
    );
    if (ok) onView(target || others[0].id);
  };

  /* ---------------- drag and drop (questions; the step tree has its own) ---------------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const pointerAt = (e: { activatorEvent: Event; delta: { x: number; y: number } }) => {
    const start = e.activatorEvent as PointerEvent | KeyboardEvent;
    return 'clientX' in start ? { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y } : null;
  };
  const stepButtonAt = (p: { x: number; y: number } | null) => {
    if (!p) return null;
    const el = document.elementFromPoint(p.x, p.y)?.closest<HTMLElement>('[data-fe-step]');
    return el && el.dataset.feDrop === 'yes' ? (el.dataset.feStep ?? null) : null;
  };
  const onDragStart = (e: DragStartEvent) => setDragging(String(e.active.id));
  const onDragMove = (e: DragMoveEvent) => {
    const key = stepButtonAt(pointerAt(e));
    if (key !== nodeOver) setNodeOver(key);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    setNodeOver(null);
    const a = String(e.active.id);
    const onStep = stepButtonAt(pointerAt(e));
    if (onStep && canEdit) {
      if (a.startsWith('pal:')) {
        addField(a.slice(4) as CustomFieldType, onStep, null);
        onView(onStep);
        return;
      }
      const moving = fields.find((x) => `f:${x.id}` === a);
      if (!moving) return;
      if (moving.policy === 'LOCKED' && onStep !== stepOfField(moving)) {
        onStatus({ tone: 'err', text: tx('ช่องที่แพลตฟอร์มล็อกไว้ย้ายข้ามขั้นตอนไม่ได้') });
        return;
      }
      if (!canEditStep(stepById(onStep))) {
        onStatus({ tone: 'err', text: tx('ขั้นนี้ล็อกทั้งหมดอยู่ ปลดล็อกก่อนจึงย้ายคำถามเข้าไปได้') });
        return;
      }
      placeField(moving, onStep, null);
      onStatus({ tone: 'idle', text: txf('ย้าย "{0}" ไปขั้น "{1}" แล้ว', moving.label || tx('คำถาม'), tx(stepById(onStep)?.title ?? '')) });
      return;
    }
    const o = e.over ? String(e.over.id) : null;
    if (!o || !canEdit) return;
    let stepId: string;
    let beforeId: string | null = null;
    if (o.startsWith('step:')) stepId = o.slice(5);
    else {
      const overField = fields.find((f) => `f:${f.id}` === o);
      if (!overField) return;
      stepId = stepOfField(overField);
      const overRect = e.over!.rect;
      const start = e.activatorEvent as PointerEvent | KeyboardEvent;
      const pointerY = 'clientY' in start ? start.clientY + e.delta.y : null;
      const activeRect = e.active.rect.current.translated;
      const y = pointerY ?? (activeRect ? activeRect.top + activeRect.height / 2 : overRect.top);
      if (y > overRect.top + overRect.height / 2) {
        const list = fieldsOf(stepId);
        beforeId = list[list.findIndex((f) => f.id === overField.id) + 1]?.id ?? null;
      } else beforeId = overField.id;
    }
    if (!canEditStep(stepById(stepId))) return;
    if (a.startsWith('pal:')) return addField(a.slice(4) as CustomFieldType, stepId, beforeId);
    const f = fields.find((x) => `f:${x.id}` === a);
    if (!f || beforeId === f.id) return;
    if (f.policy === 'LOCKED' && stepId !== stepOfField(f)) {
      onStatus({ tone: 'err', text: tx('ช่องที่แพลตฟอร์มล็อกไว้ย้ายข้ามขั้นตอนไม่ได้') });
      return;
    }
    placeField(f, stepId, beforeId);
  };

  /* ---------------- the wizard ---------------- */
  const hasSouvenirs = (event.products ?? []).length > 0;
  const placed = fields.map((f) => ({ ...f, stepKey: stepOfField(f) }));
  const tryCtx = { raceDistance: tryCode };
  const shown = mode === 'try' ? runnerFlow(flow, placed, tryAnswers, tryCtx, { hasSouvenirs }) : flow;
  const wizard: WizardStep[] = [
    ...shown.map((s) => ({ key: s.id, label: s.title || tx('ขั้นใหม่'), kind: (s.blocks?.length ? 'core' : 'own') as WizardStep['kind'], hidden: s.hidden })),
    { key: 'pay', label: tx('ชำระเงิน'), kind: 'locked' },
  ];
  const at = Math.max(0, wizard.findIndex((w) => w.key === view));
  const current = wizard[at];
  const step = stepById(current.key);
  const onTryAnswer = (id: string, v: string | boolean) => {
    setTryAnswers((p) => ({ ...p, [id]: v }));
    setTryErrors((p) => {
      const n = { ...p };
      delete n[id];
      return n;
    });
  };
  const goNext = () => {
    if (at >= wizard.length - 1) return;
    if (mode === 'try' && step) {
      const problems = validateAnswers(placed, tryAnswers, tryCtx, { steps: flow, stepId: step.id });
      setTryErrors(problems);
      if (Object.keys(problems).length > 0) return;
    }
    onView(wizard[at + 1].key);
  };
  const draggedField = dragging?.startsWith('f:') ? fields.find((f) => `f:${f.id}` === dragging) : null;
  const draggedKind = dragging?.startsWith('pal:') ? kindOf(dragging.slice(4) as CustomFieldType) : draggedField ? kindOf(draggedField.type) : null;
  const previewForm = { fields, steps: customStepsOf(flow), flow };

  const card = (f: CustomRegistrationField, index: number, count: number) => (
    <QuestionCard
      key={f.id}
      field={f}
      index={index}
      count={count}
      selected={selected === f.id}
      canEdit={canEditStep(step)}
      answers={answerCounts[f.id] ?? 0}
      cats={cats}
      onSelect={() => setSelected(selected === f.id ? null : f.id)}
      onChange={(patch) => patchField(f.id, patch)}
      onMove={(d) => moveField(f.id, d)}
      onDuplicate={() => duplicateField(f)}
      onRemove={() => removeField(f)}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={dropTarget}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      autoScroll={{ threshold: { x: 0, y: 0.06 } }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setDragging(null);
        setNodeOver(null);
      }}
    >
      <div className="st-form">
        <div className="st-center">
          <div className="st-center-bar">
            <span className="fe-seg" role="group" aria-label={tx('โหมด')}>
              {(
                [
                  ['edit', 'pen', 'แก้ไข'],
                  ['try', 'hand-pointer', 'ลองกรอก'],
                  ['preview', 'eye', 'ตัวอย่างหน้าจริง'],
                ] as const
              ).map(([m, icon, label]) => (
                <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? 'is-on' : ''} onClick={() => setMode(m)}>
                  <FaIcon name={icon} />
                  <span>{tx(label)}</span>
                </button>
              ))}
            </span>
            {mode === 'preview' && (
              <span className="fe-seg" role="group" aria-label={tx('ขนาดจอของตัวอย่าง')}>
                {(['desktop', 'phone'] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={fullDevice === d} className={fullDevice === d ? 'is-on' : ''} onClick={() => setFullDevice(d)}>
                    <FaIcon name={d === 'phone' ? 'mobile-screen' : 'desktop'} />
                    <span>{tx(d === 'phone' ? 'มือถือ' : 'เดสก์ท็อป')}</span>
                  </button>
                ))}
              </span>
            )}
            {mode === 'try' && (
              <label className="st-try">
                <span>{tx('ลองในฐานะผู้สมัครระยะ')}</span>
                <SelectMenu
                  compact
                  ariaLabel={tx('ลองในฐานะผู้สมัครระยะ')}
                  value={tryCode}
                  onChange={(v) => setTryCode(v)}
                  options={event.categories.map((c) => ({ value: c.code, label: tx(c.name) }))}
                />
                <button type="button" className="btn-secondary" onClick={() => { setTryAnswers({}); setTryErrors({}); }}>
                  {tx('ล้างคำตอบ')}
                </button>
              </label>
            )}
            <span className="fe-count">
              {txf('คำถาม {0}/{1}', questionCount, FORM_LIMITS.fields)} · {txf('ขั้น {0}/{1}', flow.length, FLOW_LIMITS.steps)}
            </span>
          </div>

          {mode === 'preview' ? (
            <div className="st-preview">
              <RunnerFormPreview
                event={event}
                form={previewForm}
                step={view}
                device={fullDevice}
                busy={false}
                onStep={(key) => {
                  if (key === 'pay' || flow.some((s) => s.id === key)) onView(key);
                }}
              />
              <p className="fe-hint">{tx('หน้าสมัครจริงของนักวิ่งพร้อมการแก้ไขที่ยังไม่เผยแพร่ ไม่มีการส่งใบสมัครหรือชำระเงินจริง')}</p>
            </div>
          ) : (
            <div className="event-reg-wizard-pane fe-wizard">
              <nav className="circle-stepper-bar" aria-label={tx('ขั้นตอนการสมัคร')}>
                {wizard.map((w, i) => (
                  <WizardNode
                    key={w.key}
                    step={w}
                    index={i}
                    current={at}
                    last={i === wizard.length - 1}
                    droppable={mode === 'edit' && w.key !== 'pay' && canEditStep(stepById(w.key))}
                    over={nodeOver === w.key}
                    onOpen={() => onView(w.key)}
                  />
                ))}
              </nav>
              <div className="reg-step-body fe-step-body">
                {!step && <LockedBody stepKey="pay" event={event} />}
                {step && (
                  <>
                    {/* a step of system parts shows their own headings; the step's name is in the bar above */}
                    <h2 className={step.blocks?.length ? 'st-step-flags' : 'reg-step-accent-heading'}>
                      {!step.blocks?.length && tx(step.title)}
                      {step.lock && (
                        <span className="fe-badge">
                          <FaIcon name={step.lock === 'all' ? 'lock' : 'thumbtack'} /> {tx(step.lock === 'all' ? 'ล็อกทั้งหมด' : 'ล็อกตำแหน่ง')}
                        </span>
                      )}
                      {step.hidden && <span className="fe-badge">{tx('ซ่อนอยู่')}</span>}
                    </h2>
                    {step.description && <p className="muted-block">{tx(step.description)}</p>}
                    {(step.blocks ?? []).map((b) =>
                      b === 'participant' ? (
                        // the runner card's groups (28 Nov 2026): general details here, the
                        // organizer's questions below, the souvenirs after them
                        <div key={b} className="st-part">
                          <h3 className="st-part-group">{tx('ข้อมูลทั่วไป')}</h3>
                          <SystemFields />
                        </div>
                      ) : (
                        <div key={b} className="st-part">
                          <LockedBody stepKey={BLOCK_VIEW[b]} event={event} />
                        </div>
                      )
                    )}
                    {mode === 'edit' ? (
                      <StepColumn
                        stepId={step.id}
                        title={
                          step.blocks?.includes('participant')
                            ? tx('ข้อมูลเพิ่มเติม (คำถามของผู้จัด)')
                            : step.blocks?.length
                              ? tx('คำถามของผู้จัดในขั้นนี้')
                              : undefined
                        }
                        fields={fieldsOf(step.id)}
                        renderCard={card}
                      />
                    ) : (
                      <>
                        <RunnerCustomFieldsInputs
                          fields={placed}
                          answers={tryAnswers}
                          onAnswerChange={onTryAnswer}
                          raceDistanceCode={tryCode}
                          steps={flow}
                          stepId={step.id}
                          errors={tryErrors}
                          heading={step.blocks?.includes('participant') ? undefined : null}
                        />
                        {Object.keys(tryErrors).length > 0 && (
                          <div className="error-callout" role="alert">
                            <span>{tx(Object.values(tryErrors)[0])}</span>
                          </div>
                        )}
                      </>
                    )}
                    {step.blocks?.includes('participant') && (
                      <div className="st-part">
                        <h3 className="st-part-group">{tx('สินค้าที่ระลึก')}</h3>
                        <LockedBody stepKey="shop" event={event} />
                      </div>
                    )}
                  </>
                )}
                <div className="reg-step-footer-between">
                  <button type="button" className="btn-secondary" aria-disabled={at === 0 || undefined} onClick={() => at > 0 && onView(wizard[at - 1].key)}>
                    {tx('ย้อนกลับ')}
                  </button>
                  <button type="button" className="btn-primary reg-next-pill-btn" aria-disabled={at === wizard.length - 1 || undefined} onClick={goNext}>
                    {mode === 'try' && step ? tx('ถัดไป (ตรวจคำตอบ)') : tx('ถัดไป')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="st-panel" aria-label={tx('ตั้งค่าและเพิ่มคำถาม')}>
          {step ? (
            <StepSettings
              step={step}
              flow={flow}
              cats={cats}
              canEdit={canEdit}
              hasAnswers={stepHasAnswers(step.id)}
              maxEntries={value.maxEntries}
              onMaxEntries={(n) => commit({ ...value, maxEntries: n })}
              onChange={(patch) => patchStep(step.id, patch)}
              onMoveBlock={moveBlock}
              onRemove={() => void removeStep(step)}
            />
          ) : (
            <div className="st-panel-sec">
              <h3>
                <FaIcon name="lock" /> {tx('ชำระเงิน')}
              </h3>
              <p className="fe-hint">{tx('ขั้นชำระเงินเป็นของระบบ อยู่ท้ายเสมอ ย้าย ลบ หรือเพิ่มคำถามไม่ได้')}</p>
            </div>
          )}
          {mode === 'edit' && (
            <div className="st-panel-sec">
              <h3>
                <FaIcon name="plus" /> {addTarget ? txf('เพิ่มในขั้น "{0}"', tx(stepById(addTarget)?.title ?? '')) : tx('เพิ่มคำถาม')}
              </h3>
              {(['text', 'choice', 'content'] as const).map((g) => (
                <div key={g} className="fe-pal-group">
                  <span className="fe-pal-title">
                    {g === 'text' ? tx('คำถามแบบพิมพ์') : g === 'choice' ? tx('คำถามแบบเลือก') : tx('เนื้อหา (ไม่ใช่คำถาม)')}
                  </span>
                  {QUESTION_KINDS.filter((k) => k.group === g).map((k) => (
                    <PaletteItem key={k.type} type={k.type} label={tx(k.label)} icon={k.icon} disabled={!addTarget} onAdd={() => addField(k.type)} />
                  ))}
                </div>
              ))}
              <p className="fe-hint">{addTarget ? tx('คลิกเพื่อเพิ่มท้ายขั้นนี้ หรือลากไปวางตรงที่ต้องการ ลากการ์ดไปวางบนชื่อขั้นในแถบด้านบนเพื่อย้ายขั้น') : tx('เลือกขั้นที่ไม่ได้ล็อกเพื่อเพิ่มคำถาม')}</p>
            </div>
          )}
        </aside>
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
  );
}

/** the open step's settings: name, description, distances, hide, lock, and its system parts */
function StepSettings({
  step,
  flow,
  cats,
  canEdit,
  hasAnswers,
  maxEntries,
  onMaxEntries,
  onChange,
  onMoveBlock,
  onRemove,
}: {
  step: FormStepDef;
  flow: FormStepDef[];
  cats: { code: string; name: string }[];
  canEdit: boolean;
  hasAnswers: boolean;
  maxEntries: number;
  onMaxEntries: (n: number) => void;
  onChange: (patch: Partial<FormStepDef>) => void;
  onMoveBlock: (block: FormCoreBlock, toStepId: string) => void;
  onRemove: () => void;
}) {
  const parts = step.blocks ?? [];
  const editable = canEdit && step.lock !== 'all';
  const lock = step.lock ?? 'none';
  const setLock = (v: EditorLock | 'none') => onChange({ lock: v === 'none' ? undefined : v });
  return (
    <div className="st-panel-sec">
      <h3>
        <FaIcon name="list-check" /> {txf('ขั้นที่ {0}', flow.indexOf(step) + 1)}
      </h3>
      <label className="st-field">
        <span>{tx('ชื่อขั้น')}</span>
        <input type="text" value={step.title} maxLength={FORM_LIMITS.stepTitle} disabled={!editable} onChange={(e) => onChange({ title: e.target.value })} />
      </label>
      <label className="st-field">
        <span>{tx('คำอธิบายใต้ชื่อ (ไม่บังคับ)')}</span>
        <textarea rows={2} value={step.description ?? ''} maxLength={FORM_LIMITS.stepDescription} disabled={!editable} onChange={(e) => onChange({ description: e.target.value || undefined })} />
      </label>
      {parts.length === 0 ? (
        <CategoryPicker label={tx('แสดงขั้นนี้กับ')} cats={cats} codes={step.categoryCodes ?? []} disabled={!editable} onChange={(c) => onChange({ categoryCodes: c.length ? c : undefined })} />
      ) : (
        <p className="fe-hint">{tx('ขั้นที่มีส่วนของระบบแสดงกับทุกระยะและซ่อนไม่ได้')}</p>
      )}

      <div className="st-field">
        <span>{tx('ล็อก')}</span>
        <span className="st-seg" role="group" aria-label={tx('ล็อก')}>
          {(
            [
              ['none', 'lock-open', 'ไม่ล็อก'],
              ['position', 'thumbtack', 'ล็อกตำแหน่ง'],
              ['all', 'lock', 'ล็อกทั้งหมด'],
            ] as const
          ).map(([v, icon, label]) => (
            <button key={v} type="button" aria-pressed={lock === v} disabled={!canEdit} onClick={() => setLock(v)}>
              <FaIcon name={icon} />
              <span>{tx(label)}</span>
            </button>
          ))}
        </span>
        <small className="fe-hint">
          {tx(lock === 'position' ? 'แก้ชื่อและคำถามได้ แต่ย้ายหรือลบขั้นไม่ได้' : lock === 'all' ? 'แก้ ย้าย หรือลบขั้นและคำถามในขั้นไม่ได้ จนกว่าจะปลดล็อก' : 'ย้าย แก้ และลบได้')}
        </small>
      </div>

      {parts.length > 0 && (
        <div className="st-field">
          <span>{tx('ส่วนของระบบในขั้นนี้')}</span>
          <ul className="st-parts">
            {parts.map((b) => (
              <li key={b}>
                <FaIcon name={coreBlockOf(b).icon} />
                <span>{tx(coreBlockOf(b).label)}</span>
                <SelectMenu
                  ariaLabel={txf('ย้าย {0} ไปขั้น', tx(coreBlockOf(b).label))}
                  value={step.id}
                  disabled={!editable || !!step.lock}
                  onChange={(v) => onMoveBlock(b, v)}
                  options={flow.map((s, i) => ({
                    value: s.id,
                    label: txf('ขั้นที่ {0}: {1}', i + 1, tx(s.title)),
                  }))}
                />
              </li>
            ))}
          </ul>
          <small className="fe-hint">{tx('ลบไม่ได้ ย้ายไปขั้นอื่นได้ ข้อมูลผู้สมัคร (มีไซส์เสื้อ) ของที่ระลึก และสรุปต้องอยู่หลังเลือกระยะ')}</small>
        </div>
      )}

      {/* group registration (28 Nov 2026): set where the runner cards are */}
      {parts.includes('participant') && (
        <div className="st-field">
          <span id="st-max-entries">{tx('สมัครได้สูงสุดต่อครั้ง')}</span>
          <span className="st-stepper" role="group" aria-labelledby="st-max-entries">
            <button
              type="button"
              className="pe-icon-btn"
              aria-label={tx('ลดจำนวน')}
              disabled={!canEdit || maxEntries <= 1}
              onClick={() => onMaxEntries(maxEntries - 1)}
            >
              <FaIcon name="minus" />
            </button>
            <output className="mono-num" aria-live="polite">
              {txf('{0} คน', maxEntries)}
            </output>
            <button
              type="button"
              className="pe-icon-btn"
              aria-label={tx('เพิ่มจำนวน')}
              disabled={!canEdit || maxEntries >= FLOW_LIMITS.entriesMax}
              onClick={() => onMaxEntries(maxEntries + 1)}
            >
              <FaIcon name="plus" />
            </button>
          </span>
          <small className="fe-hint">
            {txf('นักวิ่งสมัครให้ตัวเองและเพื่อนในคำสั่งซื้อเดียวได้ไม่เกินจำนวนนี้ (1–{0} คน) จ่ายครั้งเดียว แต่ละคนได้ใบสมัคร BIB และ QR ของตัวเอง', FLOW_LIMITS.entriesMax)}
          </small>
        </div>
      )}

      <div className="st-panel-actions">
        {hasAnswers && parts.length === 0 && (
          <button type="button" className="btn-secondary" disabled={!editable} onClick={() => onChange({ hidden: step.hidden ? undefined : true })}>
            <FaIcon name={step.hidden ? 'eye' : 'eye-slash'} />
            <span>{tx(step.hidden ? 'แสดงขั้นนี้' : 'ซ่อนขั้นนี้')}</span>
          </button>
        )}
        {!hasAnswers && (
          <button type="button" className="btn-secondary is-danger" disabled={!canEdit || !!step.lock || flow.length <= 1} onClick={onRemove}>
            <FaIcon name="trash-can" />
            <span>{tx('ลบขั้นนี้')}</span>
          </button>
        )}
      </div>
    </div>
  );
}

/** a new step of the organizer's own, placed after the step open (or at the end) */
export function newOwnStep(index: number): FormStepDef {
  return { id: newId('st'), title: txf('ขั้นใหม่ {0}', index) };
}

export { stepWithBlock };
