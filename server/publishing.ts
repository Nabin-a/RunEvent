import type { Express, Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type {
  CustomRegistrationField,
  EventDetailPage,
  FormStepDef,
  RaceEvent,
  RegistrationRecord,
  UserAccount,
} from '../src/types';
import { normalizeDetailPage } from '../src/data/eventDetailLayout';
import { missingRequiredData } from '../src/data/eventPageConvert';
import { answeredIndex, normalizeForm, type AnsweredIndex } from '../src/data/registrationForm';
import { FLOW_LIMITS, checkMaxEntries, customStepsOf, defaultFlow, flowStepOf, flowWarnings, formFlowOf, normalizeFormFlow, stepWithBlock, withoutRetiredBlocks } from '../src/data/formFlow';
import { checkScheduleTime } from '../src/data/publishState';
import { CORE_STEP } from '../src/data/registrationForm';

/**
 * Publishing the event page and the registration form (27 Nov 2026, docs/registration-form-editor-plan.md
 * section 9, phase 2): save a draft, publish it now or at a set time, take the page or web registration
 * down for a while, and bring an older published version back as a draft. The page and the form are
 * handled apart: publishing one never makes a new version of the other.
 *
 * Every change runs in its own write transaction on a freshly read event, so two people (or the timer)
 * can never publish over each other, and a timed publish goes live once.
 */

type Ok<T> = { ok: true; value: T; audit?: [string, string]; warnings?: string[] };
type Fail = { ok: false; status: number; error: string };
type Step<T = RaceEvent> = Ok<T> | Fail;
const fail = (error: string, status = 400): Fail => ({ ok: false, status, error });

type FormSnapshot = { fields: CustomRegistrationField[]; flow: FormStepDef[]; maxEntries: number };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/** a page as the editor sends it, checked; always a freely arranged page (v 3) */
function checkPage(raw: unknown): { ok: true; value: EventDetailPage } | Fail {
  const r = raw && typeof raw === 'object' ? { ...(raw as object), v: 3 } : raw;
  const checked = normalizeDetailPage(r);
  return checked.ok ? { ok: true, value: { ...checked.value, v: 3 } } : fail(checked.error);
}

/** what the page shows runners once published; the built-in blocks' text becomes the event's own */
function applyPage(ev: RaceEvent, page: EventDetailPage, by: string, now: string): { ev: RaceEvent; version: number; warnings: string[] } {
  const next: RaceEvent = { ...ev };
  const versions = next.detailPageVersions ?? [];
  const version = (versions[versions.length - 1]?.version ?? 0) + 1;
  next.detailLayout = page.layout;
  next.detailCustomBlocks = page.customBlocks;
  if (page.card) next.detailRegisterCard = page.card;
  else delete next.detailRegisterCard;
  next.detailPageV = 3;
  const core = page.coreText;
  if (core?.about) {
    next.overviewParagraphs = core.about.paragraphs.filter((p) => p.trim());
    next.highlights = core.about.highlights.filter((h) => h.trim());
  }
  if (core?.racepack) next.racePackItems = core.racepack.items.filter((i) => i.title.trim());
  if (core?.schedule) next.scheduleItems = core.schedule.items.filter((i) => i.title.trim() || i.timeLabel.trim());
  next.detailPageVersions = [...versions, { ...page, version, publishedAt: now, publishedBy: by }].slice(-20);
  // the rule of 24 Nov 2026 (prices and place shown before signing up) is a reminder on a freely
  // arranged page (user decision 27 Nov 2026: the organizer arranges the page freely)
  const missing = missingRequiredData(page);
  const warnings = missing.length
    ? [`หน้านี้ไม่ได้แสดง ${missing.map((m) => `"${m}"`).join(', ')} นักวิ่งเห็นราคาได้จากการ์ดสมัครและหน้าสมัคร`]
    : [];
  return { ev: next, version, warnings };
}

const pageOps = {
  draft(ev: RaceEvent, body: Record<string, unknown>, by: string, now: string): Step {
    const checked = checkPage(body.page);
    if (!checked.ok) return checked;
    return { ok: true, value: { ...ev, detailPageDraft: { ...checked.value, updatedAt: now, updatedBy: by } } };
  },
  discard(ev: RaceEvent): Step {
    if (!ev.detailPageDraft) return fail('ไม่มีการแก้ไขที่ยังไม่เผยแพร่');
    const next = { ...ev };
    delete next.detailPageDraft;
    return { ok: true, value: next, audit: [`ยกเลิกการแก้ไขหน้ารายละเอียดงาน ${ev.code}`, 'ทิ้งร่างที่ยังไม่เผยแพร่'] };
  },
  publish(ev: RaceEvent, _body: Record<string, unknown>, by: string, now: string): Step {
    if (!ev.detailPageDraft) return fail('ไม่มีการแก้ไขที่ต้องเผยแพร่');
    const checked = checkPage(ev.detailPageDraft);
    if (!checked.ok) return checked;
    const { ev: next, version, warnings } = applyPage(ev, checked.value, by, now);
    delete next.detailPageDraft;
    // publishing now replaces a timed publish that was waiting
    delete next.detailPageSchedule;
    delete next.detailPageScheduleFailed;
    return {
      ok: true,
      value: next,
      warnings,
      audit: [`เผยแพร่หน้ารายละเอียดงาน ${ev.code} (ฉบับที่ ${version})`, `${checked.value.layout.filter((l) => l.visible).length} บล็อกที่แสดง · บล็อกอิสระ ${checked.value.customBlocks.length} บล็อก`],
    };
  },
  schedule(ev: RaceEvent, body: Record<string, unknown>, by: string, now: string): Step {
    if (!ev.detailPageDraft) return fail('ไม่มีการแก้ไขที่จะตั้งเวลาเผยแพร่');
    const at = checkScheduleTime(body.at, Date.parse(now));
    if (!at.ok) return fail(at.error);
    const checked = checkPage(ev.detailPageDraft);
    if (!checked.ok) return checked;
    const next = { ...ev, detailPageSchedule: { id: `ps-${Date.now().toString(36)}`, at: at.value, by, createdAt: now, snapshot: checked.value } };
    delete next.detailPageScheduleFailed;
    return { ok: true, value: next, audit: [`ตั้งเวลาเผยแพร่หน้ารายละเอียดงาน ${ev.code}`, `เผยแพร่ ${at.value} (UTC) ด้วยร่าง ณ เวลาที่ตั้ง`] };
  },
  'cancel-schedule'(ev: RaceEvent): Step {
    if (!ev.detailPageSchedule) return fail('ไม่มีการตั้งเวลาเผยแพร่');
    const next = { ...ev };
    delete next.detailPageSchedule;
    return { ok: true, value: next, audit: [`ยกเลิกการตั้งเวลาเผยแพร่หน้ารายละเอียดงาน ${ev.code}`, `เดิมตั้งไว้ ${ev.detailPageSchedule.at} (UTC)`] };
  },
  hide(ev: RaceEvent, _body: Record<string, unknown>, by: string, now: string): Step {
    if (ev.detailPageHidden) return fail('หน้านี้ซ่อนอยู่แล้ว');
    return { ok: true, value: { ...ev, detailPageHidden: { at: now, by } }, audit: [`ซ่อนหน้ารายละเอียดงาน ${ev.code} ชั่วคราว`, 'ใบสมัครที่มีอยู่และสถานะรับสมัครไม่เปลี่ยน'] };
  },
  show(ev: RaceEvent): Step {
    if (!ev.detailPageHidden) return fail('หน้านี้ไม่ได้ซ่อนอยู่');
    const next = { ...ev };
    delete next.detailPageHidden;
    return { ok: true, value: next, audit: [`เปิดหน้ารายละเอียดงาน ${ev.code} อีกครั้ง`, `ซ่อนไว้ตั้งแต่ ${ev.detailPageHidden.at}`] };
  },
  restore(ev: RaceEvent, body: Record<string, unknown>, by: string, now: string): Step {
    const v = Number(body.version);
    const found = (ev.detailPageVersions ?? []).find((x) => x.version === v);
    if (!found) return fail('ไม่พบฉบับที่เลือก', 404);
    const { version: _v, publishedAt: _a, publishedBy: _b, ...page } = found;
    const checked = checkPage(page);
    if (!checked.ok) return checked;
    return {
      ok: true,
      value: { ...ev, detailPageDraft: { ...checked.value, updatedAt: now, updatedBy: by } },
      audit: [`นำหน้ารายละเอียดงาน ${ev.code} ฉบับที่ ${v} กลับมาเป็นร่าง`, 'หน้าจริงยังไม่เปลี่ยนจนกว่าจะเผยแพร่'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

/** questions and step order as the editor sends them, checked against what runners answered */
function checkForm(ev: RaceEvent, raw: unknown, answered: AnsweredIndex): { ok: true; value: FormSnapshot; summary: string; warnings: string[] } | Fail {
  const r = (raw ?? {}) as { fields?: unknown; flow?: unknown; maxEntries?: unknown };
  // "สมัครได้สูงสุดต่อครั้ง": a draft saved before 28 Nov 2026 has none and keeps the live value
  const maxEntries = checkMaxEntries(r.maxEntries === undefined ? ev.maxEntriesPerOrder ?? FLOW_LIMITS.entriesDefault : r.maxEntries);
  if (maxEntries === null) return fail(`สมัครได้สูงสุดต่อครั้งต้องเป็น 1–${FLOW_LIMITS.entriesMax} คน`);
  const liveFlow = formFlowOf(ev);
  const flow = normalizeFormFlow(r.flow, { flow: liveFlow, fields: ev.customFields ?? [] }, answered);
  if (!flow.ok) return fail(flow.error);
  const form = normalizeForm(
    { fields: r.fields },
    { fields: ev.customFields ?? [], steps: ev.formCustomSteps ?? [] },
    answered,
    { stepIds: flow.value.map((s) => s.id), defaultStep: stepWithBlock(flow.value, 'participant')?.id ?? CORE_STEP }
  );
  if (!form.ok) return fail(form.error);
  return {
    ok: true,
    value: { fields: form.value.fields, flow: flow.value, maxEntries },
    summary: `${form.summary} · ${flow.value.length} ขั้น + ชำระเงิน · สมัครได้สูงสุด ${maxEntries} คนต่อครั้ง`,
    warnings: flowWarnings(flow.value),
  };
}

function applyForm(ev: RaceEvent, form: FormSnapshot, summary: string, by: string, now: string): { ev: RaceEvent; label: string } {
  const history = ev.formVersionHistory ?? [];
  const label = `v${history.length + 2}-organizer`;
  const customSteps = customStepsOf(form.flow);
  const next: RaceEvent = {
    ...ev,
    customFields: form.fields,
    formFlow: form.flow,
    maxEntriesPerOrder: form.maxEntries,
    // the runner's form reads this until it reads the flow (phase 3)
    formCustomSteps: customSteps,
    publishedFormVersion: label,
    formVersionHistory: [
      ...history,
      {
        versionId: `fv-${ev.id}-${history.length + 2}`,
        versionLabel: label,
        templateId: ev.activeTemplateId ?? 'organizer',
        status: 'published' as const,
        publishedAt: now,
        publishedBy: by,
        changeSummary: summary,
        steps: ev.formSteps ?? [],
        fields: form.fields,
        customSteps,
        flow: form.flow,
        maxEntries: form.maxEntries,
      },
    ].slice(-30),
  };
  return { ev: next, label };
}

const formOps = {
  draft(ev: RaceEvent, body: Record<string, unknown>, by: string, now: string, answered: AnsweredIndex): Step {
    const checked = checkForm(ev, body.form, answered);
    if (!checked.ok) return checked;
    return { ok: true, value: { ...ev, formDraft: { ...checked.value, updatedAt: now, updatedBy: by } }, warnings: checked.warnings };
  },
  discard(ev: RaceEvent): Step {
    if (!ev.formDraft) return fail('ไม่มีการแก้ไขที่ยังไม่เผยแพร่');
    const next = { ...ev };
    delete next.formDraft;
    return { ok: true, value: next, audit: [`ยกเลิกการแก้ไขฟอร์มสมัครงาน ${ev.code}`, 'ทิ้งร่างที่ยังไม่เผยแพร่'] };
  },
  publish(ev: RaceEvent, _body: Record<string, unknown>, by: string, now: string, answered: AnsweredIndex): Step {
    if (!ev.formDraft) return fail('ไม่มีการแก้ไขที่ต้องเผยแพร่');
    // checked again: runners may have answered since the draft was saved
    const checked = checkForm(ev, ev.formDraft, answered);
    if (!checked.ok) return checked;
    const { ev: next, label } = applyForm(ev, checked.value, checked.summary, by, now);
    delete next.formDraft;
    delete next.formSchedule;
    delete next.formScheduleFailed;
    return { ok: true, value: next, warnings: checked.warnings, audit: [`เผยแพร่ฟอร์มสมัครงาน ${ev.code} (${label})`, checked.summary] };
  },
  schedule(ev: RaceEvent, body: Record<string, unknown>, by: string, now: string, answered: AnsweredIndex): Step {
    if (!ev.formDraft) return fail('ไม่มีการแก้ไขที่จะตั้งเวลาเผยแพร่');
    const at = checkScheduleTime(body.at, Date.parse(now));
    if (!at.ok) return fail(at.error);
    const checked = checkForm(ev, ev.formDraft, answered);
    if (!checked.ok) return checked;
    const next = { ...ev, formSchedule: { id: `fs-${Date.now().toString(36)}`, at: at.value, by, createdAt: now, snapshot: checked.value } };
    delete next.formScheduleFailed;
    return { ok: true, value: next, warnings: checked.warnings, audit: [`ตั้งเวลาเผยแพร่ฟอร์มสมัครงาน ${ev.code}`, `เผยแพร่ ${at.value} (UTC) ด้วยร่าง ณ เวลาที่ตั้ง`] };
  },
  'cancel-schedule'(ev: RaceEvent): Step {
    if (!ev.formSchedule) return fail('ไม่มีการตั้งเวลาเผยแพร่');
    const next = { ...ev };
    delete next.formSchedule;
    return { ok: true, value: next, audit: [`ยกเลิกการตั้งเวลาเผยแพร่ฟอร์มสมัครงาน ${ev.code}`, `เดิมตั้งไว้ ${ev.formSchedule.at} (UTC)`] };
  },
  hide(ev: RaceEvent, _body: Record<string, unknown>, by: string, now: string): Step {
    if (ev.formHidden) return fail('ปิดการสมัครทางเว็บอยู่แล้ว');
    return {
      ok: true,
      value: { ...ev, formHidden: { at: now, by } },
      audit: [`ปิดการสมัครทางเว็บงาน ${ev.code} ชั่วคราว`, 'สถานะงาน โควตา และใบสมัครที่กันที่นั่งไว้ไม่เปลี่ยน'],
    };
  },
  show(ev: RaceEvent): Step {
    if (!ev.formHidden) return fail('การสมัครทางเว็บไม่ได้ปิดอยู่');
    const next = { ...ev };
    delete next.formHidden;
    return { ok: true, value: next, audit: [`เปิดการสมัครทางเว็บงาน ${ev.code} อีกครั้ง`, `ปิดไว้ตั้งแต่ ${ev.formHidden.at}`] };
  },
  restore(ev: RaceEvent, body: Record<string, unknown>, by: string, now: string, answered: AnsweredIndex): Step {
    const label = String(body.version ?? '');
    const found = (ev.formVersionHistory ?? []).find((x) => x.versionLabel === label);
    if (!found) return fail('ไม่พบฉบับที่เลือก', 404);
    const flow = found.flow ? withoutRetiredBlocks(found.flow, found.fields ?? []) : defaultFlow(found.customSteps ?? []);
    // questions keep their step; an old version's questions follow the old order's steps
    const fields = found.fields.map((f) => ({ ...f, stepKey: flowStepOf(f, flow) }));
    const checked = checkForm(ev, { fields, flow, maxEntries: found.maxEntries }, answered);
    if (!checked.ok) return checked;
    return {
      ok: true,
      value: { ...ev, formDraft: { ...checked.value, updatedAt: now, updatedBy: by } },
      warnings: checked.warnings,
      audit: [`นำฟอร์มสมัครงาน ${ev.code} ฉบับ ${label} กลับมาเป็นร่าง`, 'ใบสมัครใหม่ยังใช้ฉบับปัจจุบันจนกว่าจะเผยแพร่'],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Routes and the timer                                                */
/* ------------------------------------------------------------------ */

export interface PublishingDeps {
  db: DatabaseSync;
  sessionUser: (req: Request) => UserAccount | null;
  /** owner / event manager of the event's organization (event assignment honoured) */
  canEdit: (user: UserAccount | null, ev: RaceEvent) => boolean;
  audit: (user: UserAccount | null, ev: RaceEvent, summary: string, detail: string) => void;
  saveEvent: (ev: RaceEvent) => void;
  reply: (res: Response, userId: string, extra: Record<string, unknown>) => void;
}

function readEvent(db: DatabaseSync, id: string): RaceEvent | null {
  const row = db.prepare('SELECT detail_json FROM events WHERE id = ?').get(id) as { detail_json: string } | undefined;
  return row ? (JSON.parse(row.detail_json) as RaceEvent) : null;
}

function answeredFor(db: DatabaseSync, eventId: string): AnsweredIndex {
  const regs = (db.prepare('SELECT detail_json FROM registrations WHERE event_id = ?').all(eventId) as { detail_json: string }[]).map(
    (r) => JSON.parse(r.detail_json) as RegistrationRecord
  );
  return answeredIndex(regs);
}

export function registerPublishingRoutes(app: Express, deps: PublishingDeps): void {
  const { db } = deps;
  const handle = (part: 'page' | 'form') => (req: Request, res: Response) => {
    const ops = part === 'page' ? pageOps : formOps;
    const action = String(req.params.action) as keyof typeof ops;
    if (!Object.prototype.hasOwnProperty.call(ops, action)) return res.status(404).json({ ok: false, error: 'ไม่พบคำสั่งนี้' });
    const user = deps.sessionUser(req);
    db.exec('BEGIN IMMEDIATE');
    try {
      const ev = readEvent(db, String(req.params.id));
      if (!ev) {
        db.exec('ROLLBACK');
        return res.status(404).json({ ok: false, error: 'ไม่พบงานวิ่ง' });
      }
      if (!deps.canEdit(user, ev)) {
        db.exec('ROLLBACK');
        return res.status(403).json({
          ok: false,
          error: part === 'page' ? 'เฉพาะเจ้าขององค์กรหรือผู้จัดการงานจึงแก้หน้ารายละเอียดงานได้' : 'เฉพาะเจ้าขององค์กรหรือผู้จัดการงานจึงแก้ฟอร์มสมัครได้',
        });
      }
      const by = user?.fullNameTh ?? 'ผู้จัดงาน';
      const now = new Date().toISOString();
      const body = (req.body ?? {}) as Record<string, unknown>;
      const answered = part === 'form' ? answeredFor(db, ev.id) : { fieldIds: new Set<string>(), options: new Map() };
      const out = (ops[action] as (e: RaceEvent, b: Record<string, unknown>, by: string, now: string, a: AnsweredIndex) => Step)(ev, body, by, now, answered);
      if (!out.ok) {
        db.exec('ROLLBACK');
        return res.status(out.status).json({ ok: false, error: out.error });
      }
      deps.saveEvent(out.value);
      if (out.audit) deps.audit(user, ev, out.audit[0], out.audit[1]);
      db.exec('COMMIT');
      return deps.reply(res, user!.id, { warnings: out.warnings ?? [] });
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      throw err;
    }
  };
  app.post('/api/events/:id/page/:action', handle('page'));
  app.post('/api/events/:id/form/:action', handle('form'));
}

/**
 * Timed publishes that are due go live, each once: the event is read again inside a write
 * transaction and the schedule must still be the same one. A publish that is no longer valid
 * (for example a question was answered and then removed in the snapshot) is not applied; the
 * failure is kept on the event for the organizer and written to the audit log.
 */
export function runDuePublishes(deps: Pick<PublishingDeps, 'db' | 'audit' | 'saveEvent'>, nowMs = Date.now()): number {
  const { db } = deps;
  const ids = (
    db.prepare(`SELECT id FROM events WHERE detail_json LIKE '%"detailPageSchedule"%' OR detail_json LIKE '%"formSchedule"%'`).all() as {
      id: string;
    }[]
  ).map((r) => r.id);
  let done = 0;
  for (const id of ids) {
    db.exec('BEGIN IMMEDIATE');
    try {
      let ev = readEvent(db, id);
      if (!ev) {
        db.exec('ROLLBACK');
        continue;
      }
      const now = new Date(nowMs).toISOString();
      const notes: [string, string][] = [];
      const page = ev.detailPageSchedule;
      if (page && Date.parse(page.at) <= nowMs) {
        const checked = checkPage(page.snapshot);
        const base: RaceEvent = { ...ev };
        delete base.detailPageSchedule;
        if (checked.ok) {
          const applied = applyPage(base, checked.value, page.by, now);
          ev = applied.ev;
          // the draft goes away only when it is what was published
          if (ev.detailPageDraft && JSON.stringify(checkPage(ev.detailPageDraft)) === JSON.stringify(checked)) delete ev.detailPageDraft;
          notes.push([`เผยแพร่หน้ารายละเอียดงาน ${ev.code} ตามเวลาที่ตั้ง (ฉบับที่ ${applied.version})`, `ตั้งเวลาโดย ${page.by} · ${page.at} (UTC)`]);
        } else {
          ev = { ...base, detailPageScheduleFailed: { at: now, scheduledFor: page.at, error: checked.error } };
          notes.push([`เผยแพร่หน้ารายละเอียดงาน ${ev.code} ตามเวลาที่ตั้งไม่สำเร็จ`, checked.error]);
        }
      }
      const form = ev.formSchedule;
      if (form && Date.parse(form.at) <= nowMs) {
        const base: RaceEvent = { ...ev };
        delete base.formSchedule;
        const checked = checkForm(base, form.snapshot, answeredFor(db, id));
        if (checked.ok) {
          const applied = applyForm(base, checked.value, checked.summary, form.by, now);
          ev = applied.ev;
          if (
            ev.formDraft &&
            JSON.stringify({ fields: ev.formDraft.fields, flow: ev.formDraft.flow, maxEntries: ev.formDraft.maxEntries }) ===
              JSON.stringify({ fields: form.snapshot.fields, flow: form.snapshot.flow, maxEntries: form.snapshot.maxEntries })
          )
            delete ev.formDraft;
          notes.push([`เผยแพร่ฟอร์มสมัครงาน ${ev.code} ตามเวลาที่ตั้ง (${applied.label})`, `ตั้งเวลาโดย ${form.by} · ${checked.summary}`]);
        } else {
          ev = { ...base, formScheduleFailed: { at: now, scheduledFor: form.at, error: checked.error } };
          notes.push([`เผยแพร่ฟอร์มสมัครงาน ${ev.code} ตามเวลาที่ตั้งไม่สำเร็จ`, checked.error]);
        }
      }
      if (notes.length === 0) {
        db.exec('ROLLBACK');
        continue;
      }
      deps.saveEvent(ev);
      for (const [s, d] of notes) deps.audit(null, ev, s, d);
      db.exec('COMMIT');
      done += notes.length;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* already rolled back */
      }
      console.error('[Kratai API] timed publish failed', id, err);
    }
  }
  return done;
}
