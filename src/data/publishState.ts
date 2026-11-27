import type { CustomRegistrationField, PublishFailure, PublishHold, RaceEvent } from '../types';

/**
 * Publishing states of the event page and of the registration form (27 Nov 2026, user decision,
 * docs/registration-form-editor-plan.md section 9). The page and the form each have their own
 * state; neither is the event's status (open / closed for registration), a registration's status
 * or a payment's status.
 *
 * Shared by the organizer screens, the runner's form and the server.
 */

export type PublishStateKey = 'draft' | 'changed' | 'scheduled' | 'hidden' | 'published';

export const PUBLISH_STATE_LABEL: Record<PublishStateKey, string> = {
  draft: 'ร่าง',
  changed: 'มีการแก้ไขที่ยังไม่เผยแพร่',
  scheduled: 'ตั้งเวลาเผยแพร่',
  hidden: 'ซ่อนชั่วคราว',
  published: 'เผยแพร่แล้ว',
};

export const PUBLISH_LIMITS = {
  /** a timed publish is at least this far ahead */
  scheduleMinLeadMs: 60 * 1000,
  /** and at most about a year ahead */
  scheduleMaxAheadMs: 366 * 24 * 60 * 60 * 1000,
  /** a runner who started on a form version that was then replaced may still send it this long */
  formVersionGraceMs: 2 * 60 * 60 * 1000,
  /** a runner already filling in the form when web registration was paused may still send it this long */
  hiddenFormGraceMs: 30 * 60 * 1000,
};

export interface PublishState {
  key: PublishStateKey;
  label: string;
  /** an unpublished edit exists */
  hasDraft: boolean;
  hidden: PublishHold | null;
  schedule: { at: string; by: string } | null;
  failed: PublishFailure | null;
}

/** runners cannot see the event yet: its page and form are drafts whatever was published */
const notLiveYet = (ev: Pick<RaceEvent, 'status'>) => ev.status === 'draft' || ev.status === 'in_review';

function stateOf(
  ev: Pick<RaceEvent, 'status'>,
  parts: { hasDraft: boolean; hidden?: PublishHold; schedule?: { at: string; by: string }; failed?: PublishFailure }
): PublishState {
  const key: PublishStateKey = parts.hidden
    ? 'hidden'
    : notLiveYet(ev)
      ? 'draft'
      : parts.schedule
        ? 'scheduled'
        : parts.hasDraft
          ? 'changed'
          : 'published';
  return {
    key,
    label: PUBLISH_STATE_LABEL[key],
    hasDraft: parts.hasDraft,
    hidden: parts.hidden ?? null,
    schedule: parts.schedule ? { at: parts.schedule.at, by: parts.schedule.by } : null,
    failed: parts.failed ?? null,
  };
}

export function pageStateOf(
  ev: Pick<RaceEvent, 'status' | 'detailPageDraft' | 'detailPageHidden' | 'detailPageSchedule' | 'detailPageScheduleFailed'>
): PublishState {
  return stateOf(ev, {
    hasDraft: !!ev.detailPageDraft,
    hidden: ev.detailPageHidden,
    schedule: ev.detailPageSchedule,
    failed: ev.detailPageScheduleFailed,
  });
}

export function formStateOf(
  ev: Pick<RaceEvent, 'status' | 'formDraft' | 'formHidden' | 'formSchedule' | 'formScheduleFailed'>
): PublishState {
  return stateOf(ev, {
    hasDraft: !!ev.formDraft,
    hidden: ev.formHidden,
    schedule: ev.formSchedule,
    failed: ev.formScheduleFailed,
  });
}

/** a time for a timed publish: ISO text in UTC, or what is wrong with it */
export function checkScheduleTime(at: unknown, now: number): { ok: true; value: string } | { ok: false; error: string } {
  const t = typeof at === 'string' ? Date.parse(at) : NaN;
  if (!Number.isFinite(t)) return { ok: false, error: 'ระบุวันและเวลาเผยแพร่ให้ถูกต้อง' };
  if (t < now + PUBLISH_LIMITS.scheduleMinLeadMs) return { ok: false, error: 'เวลาเผยแพร่ต้องอยู่ในอนาคตอย่างน้อย 1 นาที' };
  if (t > now + PUBLISH_LIMITS.scheduleMaxAheadMs) return { ok: false, error: 'ตั้งเวลาเผยแพร่ล่วงหน้าได้ไม่เกิน 1 ปี' };
  return { ok: true, value: new Date(t).toISOString() };
}

/**
 * Whether this registration may be sent, and which form version its answers are checked against
 * (user decision 27 Nov 2026: a runner who started on a version finishes on it). `requested` is the
 * version the runner's page loaded; without it, the live version is used (as before 27 Nov 2026).
 */
export function formGate(
  ev: Pick<RaceEvent, 'publishedFormVersion' | 'customFields' | 'formVersionHistory' | 'formHidden'>,
  requested: string | undefined,
  now: number
): { ok: true; fields: CustomRegistrationField[]; versionLabel: string | undefined } | { ok: false; error: string } {
  if (ev.formHidden) {
    const since = now - Date.parse(ev.formHidden.at);
    if (!requested || !(since <= PUBLISH_LIMITS.hiddenFormGraceMs)) {
      return { ok: false, error: 'ผู้จัดงานปิดการสมัครทางเว็บไว้ชั่วคราว ลองใหม่ภายหลัง' };
    }
  }
  const current = ev.publishedFormVersion;
  if (!requested || requested === current) return { ok: true, fields: ev.customFields ?? [], versionLabel: current };
  const history = ev.formVersionHistory ?? [];
  const i = history.findIndex((h) => h.versionLabel === requested);
  const replacedAt = i >= 0 ? history[i + 1]?.publishedAt : undefined;
  if (i >= 0 && replacedAt && now - Date.parse(replacedAt) <= PUBLISH_LIMITS.formVersionGraceMs) {
    return { ok: true, fields: history[i].fields, versionLabel: requested };
  }
  return { ok: false, error: 'ฟอร์มสมัครมีการปรับปรุง กรุณาโหลดหน้าใหม่แล้วตรวจคำตอบอีกครั้ง' };
}
