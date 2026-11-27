import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { EventDetailPage, RaceEvent } from '../types';
import { FLOW_LIMITS, coreBlockOf, flowProblem, flowStepOf, flowWarnings, formFlowOf } from '../data/formFlow';
import { formStateOf, pageStateOf } from '../data/publishState';
import { isContentField, kindOf } from '../data/registrationForm';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { swalLook } from './RegistrationFormEditor';
import { PublishBar, type PublishVersion } from './studio/PublishBar';
import { StudioFormEditor, newOwnStep, type FlowForm } from './studio/StudioFormEditor';
import { StudioPageEditor, blockKeyOf, livePage, pageRows, pageStart, type PageSel } from './studio/StudioPageEditor';
import '../studio.css';

/**
 * "หน้างานและฟอร์มสมัคร" (27 Nov 2026, docs/registration-form-editor-plan.md section 9, phase 4):
 * one organizer menu for the event page and the registration form, each with its own publishing
 * state. Left: a collapsible menu like the sidebar (page blocks; the form's steps, which can be added,
 * removed and reordered there). Centre: the page or the step as runners see it. Right: settings / add.
 *
 * Changes are kept as a draft on the server (saved a moment after each change); runners keep
 * seeing the published version until it is published, now or at a set time.
 */

export type PublishAction = 'draft' | 'discard' | 'publish' | 'schedule' | 'cancel-schedule' | 'hide' | 'show' | 'restore';
export type PublishCall = (
  part: 'page' | 'form',
  action: PublishAction,
  body?: Record<string, unknown>
) => Promise<{ ok: boolean; error?: string; warnings?: string[]; event?: RaceEvent }>;

type Part = 'page' | 'form';
type Status = { tone: 'idle' | 'err' | 'warn' | 'ok'; text: string };
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const HISTORY_MAX = 60;
const AUTOSAVE_MS = 1200;

/** the form the editor starts from: the saved draft, else what runners use now */
const formStart = (ev: RaceEvent): FlowForm =>
  ev.formDraft ? { fields: ev.formDraft.fields, flow: ev.formDraft.flow } : { fields: ev.customFields ?? [], flow: formFlowOf(ev) };
const formLive = (ev: RaceEvent): FlowForm => ({ fields: ev.customFields ?? [], flow: formFlowOf(ev) });

/**
 * One part's draft: what is on screen (with undo), what the server holds, and saving a moment after
 * each change. Going back to exactly what runners use drops the server draft instead of saving it.
 */
function useDraftPart<T>(opts: {
  part: Part;
  start: T;
  live: T;
  hasServerDraft: boolean;
  canEdit: boolean;
  call: PublishCall;
  check?: (v: T) => string | null;
  toBody: (v: T) => Record<string, unknown>;
  onStatus: (s: Status) => void;
  /** a save went through: an earlier error about saving is no longer true */
  onSaved: () => void;
}) {
  const { part, live, hasServerDraft, canEdit, call, check, toBody, onStatus, onSaved } = opts;
  const [hist, setHist] = useState<{ now: T; past: T[]; future: T[] }>(() => ({ now: opts.start, past: [], future: [] }));
  const [server, setServer] = useState<T>(opts.start);
  const [saving, setSaving] = useState(false);
  const value = hist.now;
  const dirty = !sameJson(value, server);
  const set = useCallback((next: T) => setHist((h) => (sameJson(h.now, next) ? h : { now: next, past: [...h.past, h.now].slice(-HISTORY_MAX), future: [] })), []);
  const undo = () => setHist((h) => (h.past.length ? { now: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.now, ...h.future] } : h));
  const redo = () => setHist((h) => (h.future.length ? { now: h.future[0], past: [...h.past, h.now], future: h.future.slice(1) } : h));
  const reset = (next: T) => {
    setHist({ now: next, past: [], future: [] });
    setServer(next);
  };
  const save = useCallback(async (): Promise<boolean> => {
    if (!canEdit) return false;
    if (sameJson(value, server)) return true;
    const problem = check?.(value);
    if (problem) {
      onStatus({ tone: 'err', text: problem });
      return false;
    }
    setSaving(true);
    const res = sameJson(value, live) && hasServerDraft ? await call(part, 'discard') : await call(part, 'draft', toBody(value));
    setSaving(false);
    if (!res.ok) {
      onStatus({ tone: 'err', text: res.error || tx('บันทึกร่างไม่สำเร็จ ลองอีกครั้ง') });
      return false;
    }
    setServer(value);
    if (res.warnings?.length) onStatus({ tone: 'warn', text: res.warnings[0] });
    else onSaved();
    return true;
  }, [canEdit, value, server, check, live, hasServerDraft, call, part, toBody, onStatus, onSaved]);
  useEffect(() => {
    if (!dirty || !canEdit) return;
    const t = window.setTimeout(() => void save(), AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [dirty, canEdit, save]);
  return { value, set, undo, redo, reset, save, dirty, saving, canUndo: hist.past.length > 0, canRedo: hist.future.length > 0 };
}

export function EventStudio({
  event,
  canEdit,
  answerCounts,
  call,
  onOpenSection,
  startPart = 'page',
  media,
}: {
  event: RaceEvent;
  canEdit: boolean;
  answerCounts: Record<string, number>;
  call: PublishCall;
  onOpenSection: (section: string) => void;
  startPart?: Part;
  /** the cover images manager, shown when "ภาพปกงาน" is picked in the page menu */
  media?: React.ReactNode;
}) {
  const [part, setPart] = useState<Part>(startPart);
  const [status, setStatus] = useState<Status>({ tone: 'idle', text: '' });
  const clearError = useCallback(() => setStatus((s) => (s.tone === 'err' ? { tone: 'idle', text: '' } : s)), []);
  const [busy, setBusy] = useState(false);
  const [mobileTree, setMobileTree] = useState(false);
  const [groupOpen, setGroupOpen] = useState<Record<Part, boolean>>({ page: true, form: true });
  const [rowOpen, setRowOpen] = useState<Record<string, boolean>>({});
  const [layoutLocked, setLayoutLocked] = useState(false);
  /** the preview and the panel over the whole window (27 Nov 2026, user request: a bigger preview) */
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.swal2-container')) setFull(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // the page's enter motion leaves a transform on the canvas, which would hold the fixed layer
    document.body.classList.add('st-full-screen');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      document.body.classList.remove('st-full-screen');
    };
  }, [full]);
  const [pageSel, setPageSel] = useState<PageSel>(null);
  const [pagePanel, setPagePanel] = useState<'set' | 'add'>('set');

  const form = useDraftPart<FlowForm>({
    part: 'form',
    start: formStart(event),
    live: formLive(event),
    hasServerDraft: !!event.formDraft,
    canEdit,
    call,
    check: (v) => flowProblem(v.flow),
    toBody: (v) => ({ form: v }),
    onStatus: setStatus,
    onSaved: clearError,
  });
  const page = useDraftPart<EventDetailPage>({
    part: 'page',
    start: pageStart(event),
    live: livePage(event),
    hasServerDraft: !!event.detailPageDraft,
    canEdit,
    call,
    toBody: (v) => ({ page: v }),
    onStatus: setStatus,
    onSaved: clearError,
  });
  const [view, setView] = useState<string>(() => formStart(event).flow[0]?.id ?? 'pay');
  const active = part === 'page' ? page : form;

  // leaving with unsaved changes
  const anyDirty = form.dirty || page.dirty;
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);
  // undo / redo from the keyboard, outside text boxes, for the part on screen
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        activeRef.current.undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        activeRef.current.redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------------- publishing ---------------- */
  const state = part === 'page' ? pageStateOf(event) : formStateOf(event);
  const run = async (action: PublishAction, body?: Record<string, unknown>, done?: string) => {
    // what is on screen goes to the server first, so the action uses it
    if (['publish', 'schedule'].includes(action) && !(await active.save())) return;
    setBusy(true);
    const res = await call(part, action, body);
    setBusy(false);
    if (!res.ok) {
      setStatus({ tone: 'err', text: res.error || tx('ทำรายการไม่สำเร็จ ลองอีกครั้ง') });
      return;
    }
    if (res.event && (action === 'restore' || action === 'discard' || action === 'publish')) {
      if (part === 'page') page.reset(pageStart(res.event));
      else form.reset(formStart(res.event));
    }
    setStatus({ tone: res.warnings?.length ? 'warn' : 'ok', text: res.warnings?.[0] ?? done ?? '' });
  };
  const confirm = async (title: string, text: string, ok: string) =>
    (await Swal.fire({ ...swalLook, icon: 'question', title, text, showCancelButton: true, confirmButtonText: ok, cancelButtonText: tx('ยกเลิก'), focusConfirm: true })).isConfirmed;
  const versions: PublishVersion[] = useMemo(
    () =>
      part === 'form'
        ? [...(event.formVersionHistory ?? [])].reverse().map((v) => ({ id: v.versionLabel, label: v.versionLabel, at: v.publishedAt, by: v.publishedBy, note: v.changeSummary }))
        : [...(event.detailPageVersions ?? [])].reverse().map((v) => ({ id: String(v.version), label: txf('ฉบับที่ {0}', v.version), at: v.publishedAt, by: v.publishedBy })),
    [part, event.formVersionHistory, event.detailPageVersions]
  );
  const partName = part === 'page' ? 'หน้ารายละเอียดงาน' : 'ฟอร์มสมัคร';

  /* ---------------- menu: page blocks ---------------- */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const rows = pageRows(page.value);
  const moveBlockTo = (from: number, to: number) => {
    const list = page.value.layout;
    const b = list[from];
    if (!canEdit || !b || to < 0 || to >= list.length || from === to) return;
    if (layoutLocked) return setStatus({ tone: 'err', text: tx('ล็อกโครงหน้าอยู่ ปลดล็อกก่อนจึงย้ายได้') });
    if (b.lock || list[to].lock) return setStatus({ tone: 'err', text: tx('บล็อกที่ล็อกไว้ย้ายไม่ได้ ปลดล็อกก่อน') });
    page.set({ ...page.value, layout: arrayMove(list, from, to) });
    setStatus({ tone: 'idle', text: tx('ย้ายบล็อกแล้ว') });
  };
  const onPageDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = page.value.layout.map((l) => `p:${l.block}`);
    moveBlockTo(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
  const pickPage = (key: PageSel) => {
    setPart('page');
    setPageSel(key);
    setPagePanel('set');
    setMobileTree(false);
  };

  /* ---------------- menu: form steps ---------------- */
  const flow = form.value.flow;
  const moveStepTo = (from: number, to: number) => {
    const s = flow[from];
    if (!canEdit || !s || to < 0 || to >= flow.length || from === to) return;
    if (s.lock || flow[to].lock) return setStatus({ tone: 'err', text: tx('ขั้นที่ล็อกไว้ย้ายไม่ได้ ปลดล็อกก่อน') });
    const next = { ...form.value, flow: arrayMove(flow, from, to) };
    const problem = flowProblem(next.flow);
    if (problem) return setStatus({ tone: 'err', text: problem });
    form.set(next);
    const notes = flowWarnings(next.flow);
    setStatus({ tone: notes.length ? 'warn' : 'idle', text: notes[0] ?? txf('ย้ายขั้น "{0}" แล้ว', tx(s.title)) });
  };
  const onFormDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = flow.map((s) => `t:${s.id}`);
    moveStepTo(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
  const addStep = () => {
    if (!canEdit) return;
    if (flow.length >= FLOW_LIMITS.steps) return setStatus({ tone: 'err', text: txf('ฟอร์มมีได้ไม่เกิน {0} ขั้น (ไม่นับขั้นชำระเงิน)', FLOW_LIMITS.steps) });
    const st = newOwnStep(flow.filter((s) => !s.blocks?.length).length + 1);
    const at = Math.max(0, flow.findIndex((s) => s.id === view)) + 1;
    form.set({ ...form.value, flow: [...flow.slice(0, at), st, ...flow.slice(at)] });
    setPart('form');
    setView(st.id);
    setStatus({ tone: 'idle', text: tx('เพิ่มขั้นแล้ว ใส่คำถามจากแผงด้านขวา') });
  };
  const pickStep = (id: string) => {
    setPart('form');
    setView(id);
    setMobileTree(false);
  };

  const groupHead = (p: Part, icon: string, title: string, sub: string) => (
    <button type="button" className={`st-group-head${part === p ? ' is-current' : ''}`} aria-expanded={groupOpen[p]} onClick={() => setGroupOpen((g) => ({ ...g, [p]: !g[p] }))}>
      <span className="st-group-ico">
        <FaIcon name={icon} />
      </span>
      <span>
        {tx(title)}
        <small>{tx(sub)}</small>
      </span>
      <FaIcon name="chevron-down" className="st-chev" />
    </button>
  );

  const tree = (
    <nav className="st-tree" aria-label={tx('เมนูหน้างานและฟอร์มสมัคร')}>
      <section className="st-group">
        {groupHead('page', 'file-lines', 'หน้ารายละเอียดงาน', 'หน้าที่นักวิ่งเห็นก่อนสมัคร')}
        {groupOpen.page && (
          <div className="st-group-body">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPageDragEnd}>
              <SortableContext items={rows.map((r) => `p:${r.key}`)} strategy={verticalListSortingStrategy}>
                <ol className="st-list">
                  {rows.map((r, i) => (
                    <TreeRow
                      key={r.key}
                      id={`p:${r.key}`}
                      label={r.label}
                      icon={r.icon}
                      lock={r.lock}
                      hidden={!r.visible}
                      selected={part === 'page' && blockKeyOf(pageSel) === r.key}
                      movable={canEdit && !layoutLocked && !r.lock}
                      first={i === 0}
                      last={i === rows.length - 1}
                      open={!!rowOpen[r.key]}
                      onToggle={r.pieces.length ? () => setRowOpen((o) => ({ ...o, [r.key]: !o[r.key] })) : undefined}
                      onPick={() => pickPage(r.key)}
                      onMove={(d) => moveBlockTo(i, i + d)}
                      sub={
                        r.pieces.length
                          ? r.pieces.map((p) => (
                              <li key={p.key} className={pageSel === p.key ? 'is-selected' : ''}>
                                <button type="button" onClick={() => pickPage(p.key)}>
                                  <FaIcon name={p.icon} />
                                  <span>{tx(p.label)}</span>
                                </button>
                              </li>
                            ))
                          : null
                      }
                      flag={r.core ? undefined : 'table-columns'}
                    />
                  ))}
                  <li className={`st-row is-system${part === 'page' && pageSel === 'media' ? ' is-selected' : ''}`}>
                    <span className="st-grip is-off" aria-hidden="true" />
                    <button type="button" className="st-row-main" onClick={() => pickPage('media')}>
                      <FaIcon name="image" className="st-ico" />
                      <span className="st-name">{tx('ภาพปกและภาพประกอบ')}</span>
                    </button>
                    <span className="st-caret" aria-hidden="true" />
                  </li>
                  <li className={`st-row is-system${part === 'page' && pageSel === 'card' ? ' is-selected' : ''}`}>
                    <span className="st-grip is-off" aria-hidden="true" />
                    <button type="button" className="st-row-main" onClick={() => pickPage('card')}>
                      <FaIcon name="id-card" className="st-ico" />
                      <span className="st-name">{tx('การ์ดสมัคร (ติดขวา)')}</span>
                    </button>
                    <span className="st-flag" title={tx('ส่วนของระบบ ราคาและที่นั่งมาจากเมนูระยะ ราคา')}>
                      <FaIcon name="lock" />
                    </span>
                  </li>
                </ol>
              </SortableContext>
            </DndContext>
            <button
              type="button"
              className="st-add"
              disabled={!canEdit || layoutLocked}
              onClick={() => {
                setPart('page');
                setPagePanel('add');
              }}
            >
              <FaIcon name="plus" />
              <span>{tx('เพิ่มบล็อก')}</span>
            </button>
          </div>
        )}
      </section>

      <section className="st-group">
        {groupHead('form', 'list-check', 'ขั้นตอนสมัคร', 'ฟอร์มที่นักวิ่งกรอกทีละขั้น')}
        {groupOpen.form && (
          <div className="st-group-body">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onFormDragEnd}>
              <SortableContext items={flow.map((s) => `t:${s.id}`)} strategy={verticalListSortingStrategy}>
                <ol className="st-list">
                  {flow.map((s, i) => {
                    const qs = form.value.fields.filter((f) => flowStepOf(f, flow) === s.id && !isContentField(f));
                    const parts = s.blocks ?? [];
                    return (
                      <TreeRow
                        key={s.id}
                        id={`t:${s.id}`}
                        label={s.title || tx('ขั้นใหม่')}
                        num={i + 1}
                        lock={s.lock}
                        hidden={s.hidden}
                        selected={part === 'form' && view === s.id}
                        movable={canEdit && !s.lock}
                        first={i === 0}
                        last={i === flow.length - 1}
                        open={!!rowOpen[s.id]}
                        onToggle={() => setRowOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                        onPick={() => pickStep(s.id)}
                        onMove={(d) => moveStepTo(i, i + d)}
                        sub={
                          <>
                            {parts.map((b) => (
                              <li key={b} className="is-part">
                                <FaIcon name={coreBlockOf(b).icon} />
                                <span>{tx(coreBlockOf(b).label)}</span>
                                <span className="st-flag" title={tx('ส่วนของระบบ')}>
                                  <FaIcon name="shield-halved" />
                                </span>
                              </li>
                            ))}
                            {qs.map((q) => (
                              <li key={q.id}>
                                <FaIcon name={kindOf(q.type)?.icon ?? 'circle-question'} />
                                <span>{q.label || tx('คำถามใหม่')}</span>
                              </li>
                            ))}
                            {parts.length === 0 && qs.length === 0 && <li className="is-empty">{tx('ยังไม่มีคำถาม นักวิ่งจะข้ามขั้นนี้')}</li>}
                          </>
                        }
                      />
                    );
                  })}
                  <li className={`st-row is-system${part === 'form' && view === 'pay' ? ' is-selected' : ''}`}>
                    <span className="st-grip is-off" aria-hidden="true" />
                    <button type="button" className="st-row-main" onClick={() => pickStep('pay')}>
                      <span className="st-num">{flow.length + 1}</span>
                      <span className="st-name">{tx('ชำระเงิน')}</span>
                    </button>
                    <span className="st-flag" title={tx('ขั้นของระบบ อยู่ท้ายเสมอ')}>
                      <FaIcon name="lock" />
                    </span>
                  </li>
                </ol>
              </SortableContext>
            </DndContext>
            <button type="button" className="st-add" disabled={!canEdit || flow.length >= FLOW_LIMITS.steps} onClick={addStep}>
              <FaIcon name="plus" />
              <span>{tx('เพิ่มขั้นตอน')}</span>
            </button>
          </div>
        )}
      </section>

      <div className="st-links">
        <span className="st-links-title">{tx('ข้อมูลที่แก้ในเมนูอื่น')}</span>
        {(
          [
            ['evt_pricing_quota', 'tags', 'ระยะ ราคา และการรับสมัคร'],
            ['evt_kit', 'shirt', 'เสื้อและของที่ได้รับ'],
            ['evt_storefront', 'store', 'ร้านค้าของงาน'],
          ] as const
        ).map(([section, icon, label]) => (
          <button key={section} type="button" onClick={() => onOpenSection(section)}>
            <FaIcon name={icon} />
            <span>{tx(label)}</span>
            <FaIcon name="arrow-right" className="st-ext" />
          </button>
        ))}
      </div>
    </nav>
  );

  const pageRowName = rows.find((r) => r.key === blockKeyOf(pageSel))?.label;
  const viewName =
    part === 'page'
      ? pageSel === 'card'
        ? tx('การ์ดสมัคร')
        : pageSel === 'media'
          ? tx('ภาพปกและภาพประกอบ')
        : tx(pageRowName ?? 'หน้ารายละเอียดงาน')
      : view === 'pay'
        ? tx('ชำระเงิน')
        : tx(flow.find((s) => s.id === view)?.title ?? '');

  return (
    <div className={`canvas-stack st-page${full ? ' is-full-on' : ''}`}>
      <div className="page-guide-header">
        <h1>{tx('หน้างานและฟอร์มสมัคร')}</h1>
        <p className="page-purpose-desc">
          {tx('จัดหน้ารายละเอียดงานและขั้นตอนสมัครได้เอง การแก้ไขถูกบันทึกเป็นร่าง นักวิ่งเห็นเมื่อเผยแพร่ หน้าและฟอร์มเผยแพร่แยกกัน')}
        </p>
      </div>

      <div className="st-parttabs" role="tablist" aria-label={tx('ส่วนที่แก้')}>
        {(
          [
            ['page', 'file-lines', 'หน้ารายละเอียดงาน', pageStateOf(event).label],
            ['form', 'list-check', 'ขั้นตอนสมัคร', formStateOf(event).label],
          ] as const
        ).map(([p, icon, label, st]) => (
          <button key={p} type="button" role="tab" aria-selected={part === p} onClick={() => setPart(p)}>
            <FaIcon name={icon} />
            <span>{tx(label)}</span>
            <small>{tx(p === 'form' && formStateOf(event).key === 'hidden' ? 'ปิดรับสมัครทางเว็บชั่วคราว' : st)}</small>
          </button>
        ))}
      </div>

      <PublishBar
        key={part}
        part={part}
        state={state}
        dirty={active.dirty}
        saving={active.saving || busy}
        canEdit={canEdit}
        versions={versions}
        hideLabel={part === 'page' ? 'ซ่อนหน้านี้ชั่วคราว' : 'ปิดรับสมัครทางเว็บชั่วคราว'}
        showLabel={part === 'page' ? 'แสดงหน้านี้อีกครั้ง' : 'เปิดรับสมัครทางเว็บอีกครั้ง'}
        onPublish={async () => {
          const text =
            part === 'page'
              ? tx('นักวิ่งจะเห็นหน้าใหม่ทันที ฟอร์มสมัครไม่เปลี่ยน')
              : tx('ใบสมัครใหม่จะใช้ฟอร์มนี้ทันที ใบสมัครเดิมยังผูกกับฉบับเดิม');
          if (await confirm(txf('เผยแพร่{0}?', tx(partName)), text, tx('เผยแพร่'))) void run('publish', undefined, tx('เผยแพร่แล้ว'));
        }}
        onSchedule={(at) => void run('schedule', { at }, tx('ตั้งเวลาเผยแพร่แล้ว'))}
        onCancelSchedule={() => void run('cancel-schedule', undefined, tx('ยกเลิกการตั้งเวลาแล้ว'))}
        onHide={async () => {
          const ok =
            part === 'page'
              ? await confirm(tx('ซ่อนหน้านี้ชั่วคราว?'), tx('หน้ารายละเอียดหายจากรายการงาน ลิงก์เดิมขึ้นข้อความว่าปิดไว้ชั่วคราว ใบสมัครที่มีอยู่ไม่เปลี่ยน'), tx('ซ่อนชั่วคราว'))
              : await confirm(tx('ปิดรับสมัครทางเว็บชั่วคราว?'), tx('นักวิ่งใหม่สมัครทางเว็บไม่ได้จนกว่าจะเปิดอีกครั้ง สถานะงาน โควตา และใบสมัครที่มีอยู่ไม่เปลี่ยน คนที่กรอกค้างอยู่ส่งได้ภายใน 30 นาที'), tx('ปิดชั่วคราว'));
          if (ok) void run('hide', undefined, tx(part === 'page' ? 'ซ่อนหน้าแล้ว' : 'ปิดรับสมัครทางเว็บชั่วคราวแล้ว'));
        }}
        onShow={() => void run('show', undefined, tx(part === 'page' ? 'แสดงหน้าอีกครั้งแล้ว' : 'เปิดรับสมัครทางเว็บอีกครั้งแล้ว'))}
        onDiscard={async () => {
          if (await confirm(tx('ยกเลิกการแก้ไขทั้งหมด?'), txf('ร่างจะถูกทิ้ง {0}กลับเป็นฉบับที่ใช้อยู่', tx(partName)), tx('ยกเลิกการแก้ไข'))) {
            if (state.hasDraft) void run('discard', undefined, tx('ยกเลิกการแก้ไขแล้ว'));
            else if (part === 'page') page.reset(livePage(event));
            else form.reset(formLive(event));
          }
        }}
        onRestore={(id) => void run('restore', { version: part === 'page' ? Number(id) : id }, tx('นำฉบับที่เลือกกลับมาเป็นร่างแล้ว'))}
      />

      <div className="st-toolbar">
        <button type="button" className="btn-secondary st-mobile-tree" aria-expanded={mobileTree} onClick={() => setMobileTree(!mobileTree)}>
          <FaIcon name="bars" />
          <span>
            <small>{tx(part === 'page' ? 'หน้ารายละเอียดงาน' : 'ขั้นตอนสมัคร')}</small>
            {viewName}
          </span>
          <FaIcon name="chevron-down" />
        </button>
        <span className="st-undo">
          <button type="button" className="pe-icon-btn" aria-label={tx('ย้อนกลับ')} title={tx('ย้อนกลับ (Ctrl+Z)')} disabled={!active.canUndo} onClick={active.undo}>
            <FaIcon name="rotate-left" />
          </button>
          <button type="button" className="pe-icon-btn" aria-label={tx('ทำซ้ำ')} title={tx('ทำซ้ำ (Ctrl+Y)')} disabled={!active.canRedo} onClick={active.redo}>
            <FaIcon name="rotate-right" />
          </button>
        </span>
        {part === 'page' && (
          <button
            type="button"
            className={`btn-secondary st-layout-lock${layoutLocked ? ' is-on' : ''}`}
            aria-pressed={layoutLocked}
            disabled={!canEdit}
            title={tx('ล็อกโครงหน้า: ย้าย เพิ่ม ลบไม่ได้ แต่ยังแก้ข้อความได้')}
            onClick={() => setLayoutLocked(!layoutLocked)}
          >
            <FaIcon name={layoutLocked ? 'lock' : 'lock-open'} />
            <span>{tx(layoutLocked ? 'ล็อกโครงหน้าอยู่' : 'ล็อกโครงหน้า')}</span>
          </button>
        )}
        <span className={`st-status is-${status.tone}`} role="status" aria-live="polite">
          {status.text ? tx(status.text) : !canEdit ? tx('ดูอย่างเดียว — บทบาทนี้แก้หน้างานและฟอร์มสมัครไม่ได้') : ''}
        </span>
        <button type="button" className="btn-secondary st-full-toggle" onClick={() => setFull(true)}>
          <FaIcon name="expand" />
          <span>{tx('ขยายเต็มจอ')}</span>
        </button>
      </div>

      <div className={`st-layout${mobileTree ? ' is-tree-open' : ''}${full ? ' is-full' : ''}`} {...(full ? { role: 'dialog', 'aria-modal': true, 'aria-label': tx('ตัวอย่างเต็มจอ') } : {})}>
        {full && (
          <div className="st-fullbar">
            <strong>{tx(part === 'page' ? 'หน้ารายละเอียดงาน' : 'ขั้นตอนสมัคร')}</strong>
            <span className="st-undo">
              <button type="button" className="pe-icon-btn" aria-label={tx('ย้อนกลับ')} disabled={!active.canUndo} onClick={active.undo}>
                <FaIcon name="rotate-left" />
              </button>
              <button type="button" className="pe-icon-btn" aria-label={tx('ทำซ้ำ')} disabled={!active.canRedo} onClick={active.redo}>
                <FaIcon name="rotate-right" />
              </button>
            </span>
            <span className={`st-status is-${status.tone}`} role="status" aria-live="polite">
              {status.text ? tx(status.text) : active.saving ? tx('กำลังบันทึกร่าง…') : ''}
            </span>
            <button type="button" className="btn-secondary" autoFocus onClick={() => setFull(false)}>
              <FaIcon name="compress" />
              <span>{tx('ออกจากเต็มจอ (Esc)')}</span>
            </button>
          </div>
        )}
        {tree}
        {part === 'page' && pageSel === 'media' ? (
          <div className="st-media">{media}</div>
        ) : part === 'page' ? (
          <StudioPageEditor
            event={event}
            canEdit={canEdit}
            layoutLocked={layoutLocked}
            value={page.value}
            onChange={page.set}
            selected={pageSel}
            onSelect={setPageSel}
            onStatus={setStatus}
            onOpenSection={onOpenSection}
            panelTab={pagePanel}
            onPanelTab={setPagePanel}
          />
        ) : (
          <StudioFormEditor
            event={event}
            canEdit={canEdit}
            answerCounts={answerCounts}
            value={form.value}
            onChange={form.set}
            view={view}
            onView={setView}
            onStatus={setStatus}
          />
        )}
      </div>
    </div>
  );
}

/** one row of the menu: drag to reorder (or Alt+arrows / the arrow buttons), expand to see inside */
function TreeRow({
  id,
  label,
  icon,
  num,
  flag,
  lock,
  hidden,
  selected,
  movable,
  first,
  last,
  open,
  onToggle,
  onPick,
  onMove,
  sub,
}: {
  id: string;
  label: string;
  icon?: string;
  num?: number;
  flag?: string;
  lock?: 'position' | 'all';
  hidden?: boolean;
  selected: boolean;
  movable: boolean;
  first: boolean;
  last: boolean;
  open: boolean;
  onToggle?: () => void;
  onPick: () => void;
  onMove: (d: -1 | 1) => void;
  sub: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !movable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`st-row-wrap${isDragging ? ' is-dragging' : ''}`}
      onKeyDown={(e) => {
        if (!movable || !e.altKey) return;
        if (e.key === 'ArrowUp' && !first) {
          e.preventDefault();
          onMove(-1);
        } else if (e.key === 'ArrowDown' && !last) {
          e.preventDefault();
          onMove(1);
        }
      }}
    >
      <div className={`st-row${selected ? ' is-selected' : ''}${hidden ? ' is-hidden' : ''}`}>
        <button type="button" className={`st-grip${movable ? '' : ' is-off'}`} aria-label={txf('ลากเพื่อย้าย {0} (หรือ Alt+ลูกศรขึ้น/ลง)', tx(label))} {...attributes} {...listeners} tabIndex={movable ? 0 : -1}>
          <FaIcon name="grip-vertical" />
        </button>
        <button type="button" className="st-row-main" onClick={onPick} aria-current={selected ? 'true' : undefined}>
          {num !== undefined ? <span className="st-num">{num}</span> : icon ? <FaIcon name={icon} className="st-ico" /> : null}
          <span className="st-name">{tx(label)}</span>
        </button>
        {flag && (
          <span className="st-flag" title={tx('บล็อกอิสระ')}>
            <FaIcon name={flag} />
          </span>
        )}
        {hidden && (
          <span className="st-flag" title={tx('ซ่อนอยู่')}>
            <FaIcon name="eye-slash" />
          </span>
        )}
        {lock && (
          <span className="st-flag" title={tx(lock === 'all' ? 'ล็อกทั้งหมด' : 'ล็อกตำแหน่ง')}>
            <FaIcon name={lock === 'all' ? 'lock' : 'thumbtack'} />
          </span>
        )}
        <span className="st-move">
          <button type="button" className="pe-icon-btn" aria-label={txf('ย้าย {0} ขึ้น', tx(label))} disabled={!movable || first} onClick={() => onMove(-1)}>
            <FaIcon name="arrow-up" />
          </button>
          <button type="button" className="pe-icon-btn" aria-label={txf('ย้าย {0} ลง', tx(label))} disabled={!movable || last} onClick={() => onMove(1)}>
            <FaIcon name="arrow-down" />
          </button>
        </span>
        {onToggle ? (
          <button type="button" className="st-caret" aria-expanded={open} aria-label={txf('{0}สิ่งที่อยู่ใน {1}', open ? tx('ซ่อน') : tx('แสดง'), tx(label))} onClick={onToggle}>
            <FaIcon name="chevron-down" />
          </button>
        ) : (
          <span className="st-caret" aria-hidden="true" />
        )}
      </div>
      {open && sub && <ul className="st-sub">{sub}</ul>}
    </li>
  );
}
