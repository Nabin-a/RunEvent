import { useEffect, useRef, useState } from 'react';
import { tx, txf } from '../../i18n';
import { FaIcon } from '../FaIcon';
import type { PublishState } from '../../data/publishState';
import { useDismiss } from '../../utils/useDismiss';

/**
 * The publishing bar of one part of the combined editor (the event page, or the registration form),
 * 27 Nov 2026: its state (draft / unpublished changes / scheduled / hidden / published), publish now,
 * publish at a set time, take it down for a while, drop the changes, and bring an older version back.
 * Times are entered and shown in the event's time zone (Asia/Bangkok) and sent to the server in UTC.
 */

export interface PublishVersion {
  id: string;
  label: string;
  at: string;
  by?: string;
  note?: string;
}

const TZ = 'Asia/Bangkok';
export const fmtEventTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH-u-ca-gregory', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
/** "YYYY-MM-DDTHH:mm" in Bangkok time, for a datetime-local box */
const toLocalBox = (ms: number) => {
  const d = new Date(ms + 7 * 3600e3);
  return d.toISOString().slice(0, 16);
};
/** a datetime-local value read as Bangkok time (UTC+7, no daylight saving), as UTC ISO */
const fromLocalBox = (v: string) => new Date(`${v}:00+07:00`).toISOString();

export function PublishBar({
  part,
  state,
  dirty,
  saving,
  canEdit,
  versions,
  compact = false,
  hideLabel,
  showLabel,
  onPublish,
  onSchedule,
  onCancelSchedule,
  onHide,
  onShow,
  onDiscard,
  onRestore,
}: {
  part: 'page' | 'form';
  state: PublishState;
  /** local changes not sent to the server yet (they are saved before any action) */
  dirty: boolean;
  saving: boolean;
  canEdit: boolean;
  versions: PublishVersion[];
  /** one line for the editor's top bar: the explanation goes into the badge's tooltip */
  compact?: boolean;
  hideLabel: string;
  showLabel: string;
  onPublish: () => void;
  onSchedule: (atIso: string) => void;
  onCancelSchedule: () => void;
  onHide: () => void;
  onShow: () => void;
  onDiscard: () => void;
  onRestore: (id: string) => void;
}) {
  const [pop, setPop] = useState<null | 'schedule' | 'versions' | 'more'>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  useDismiss(pop !== null, [boxRef], () => setPop(null));
  const [when, setWhen] = useState(() => toLocalBox(Date.now() + 60 * 60e3));
  useEffect(() => {
    if (pop === 'schedule') setWhen(toLocalBox(Math.max(Date.now() + 60 * 60e3, state.schedule ? Date.parse(state.schedule.at) : 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pop]);
  const hasChanges = state.hasDraft || dirty;
  const partName = part === 'page' ? 'หน้ารายละเอียดงาน' : 'ฟอร์มสมัคร';
  const badgeIcon = { draft: 'pen-ruler', changed: 'pen', scheduled: 'clock', hidden: 'eye-slash', published: 'circle-check' }[state.key];
  const noteText = saving
    ? tx('กำลังบันทึกร่าง…')
    : state.schedule
      ? txf('เผยแพร่ {0} (ตั้งโดย {1})', fmtEventTime(state.schedule.at), state.schedule.by)
      : state.hidden
        ? txf(part === 'form' ? 'ปิดโดย {0} เมื่อ {1}' : 'ซ่อนโดย {0} เมื่อ {1}', state.hidden.by, fmtEventTime(state.hidden.at))
        : hasChanges
          ? tx('ร่างถูกบันทึกแล้ว นักวิ่งยังเห็นฉบับเดิมจนกว่าจะเผยแพร่')
          : '';

  return (
    <div className={`st-pubbar${compact ? ' is-compact' : ''}`} ref={boxRef} role="region" aria-label={txf('การเผยแพร่{0}', tx(partName))}>
      <span className={`st-state is-${state.key}`} title={compact ? noteText || undefined : undefined}>
        <FaIcon name={badgeIcon} />
        {/* a paused form means runners cannot sign up on the web; say so in those words */}
        <span>{tx(part === 'form' && state.key === 'hidden' ? 'ปิดรับสมัครทางเว็บชั่วคราว' : state.label)}</span>
      </span>
      {!compact && (
        <span className="st-state-note" role="status" aria-live="polite">
          {noteText}
        </span>
      )}
      {state.failed && (
        <span className="st-state-fail" role="alert">
          <FaIcon name="triangle-exclamation" />
          {txf('เผยแพร่ตามเวลา {0} ไม่สำเร็จ: {1}', fmtEventTime(state.failed.scheduledFor), tx(state.failed.error))}
        </span>
      )}
      {canEdit && (
        <span className="st-pub-actions">
          {state.schedule ? (
            <button type="button" className="btn-secondary" onClick={onCancelSchedule} title={compact ? noteText : undefined}>
              <FaIcon name="calendar-xmark" />
              <span>{tx('ยกเลิกการตั้งเวลา')}</span>
            </button>
          ) : (
            <span className="st-pop-anchor">
              <button
                type="button"
                className="btn-secondary"
                aria-expanded={pop === 'schedule'}
                disabled={!hasChanges}
                onClick={() => setPop(pop === 'schedule' ? null : 'schedule')}
              >
                <FaIcon name="clock" />
                <span>{tx('ตั้งเวลา')}</span>
              </button>
              {pop === 'schedule' && (
                <div className="st-pop" role="dialog" aria-label={tx('ตั้งเวลาเผยแพร่')}>
                  <label className="st-field">
                    <span>{tx('เผยแพร่เมื่อ (เวลาประเทศไทย)')}</span>
                    <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                  </label>
                  <p className="st-hint">{tx('ระบบเผยแพร่ร่าง ณ ตอนกดตั้งเวลา แก้ร่างต่อหลังจากนี้จะไม่เปลี่ยนสิ่งที่ขึ้น')}</p>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!when}
                    onClick={() => {
                      setPop(null);
                      onSchedule(fromLocalBox(when));
                    }}
                  >
                    {tx('ตั้งเวลาเผยแพร่')}
                  </button>
                </div>
              )}
            </span>
          )}
          <button type="button" className="btn-primary" disabled={!hasChanges || saving} onClick={onPublish}>
            <FaIcon name="paper-plane" />
            <span>{tx('เผยแพร่')}</span>
          </button>
          <span className="st-pop-anchor">
            <button
              type="button"
              className="btn-secondary st-icon-only"
              aria-label={tx('ตัวเลือกเพิ่มเติม')}
              aria-expanded={pop === 'more'}
              onClick={() => setPop(pop === 'more' ? null : 'more')}
            >
              <FaIcon name="ellipsis" />
            </button>
            {pop === 'more' && (
              <div className="st-pop st-menu" role="menu">
                {state.hidden ? (
                  <button type="button" role="menuitem" onClick={() => { setPop(null); onShow(); }}>
                    <FaIcon name="eye" />
                    <span>{tx(showLabel)}</span>
                  </button>
                ) : (
                  <button type="button" role="menuitem" onClick={() => { setPop(null); onHide(); }}>
                    <FaIcon name="eye-slash" />
                    <span>{tx(hideLabel)}</span>
                  </button>
                )}
                <button type="button" role="menuitem" disabled={!hasChanges} onClick={() => { setPop(null); onDiscard(); }}>
                  <FaIcon name="rotate-left" />
                  <span>{tx('ยกเลิกการแก้ไขทั้งหมด')}</span>
                </button>
                <button type="button" role="menuitem" disabled={versions.length === 0} onClick={() => setPop('versions')}>
                  <FaIcon name="clock-rotate-left" />
                  <span>{tx('ฉบับย้อนหลัง')}</span>
                </button>
              </div>
            )}
            {pop === 'versions' && (
              <div className="st-pop st-versions" role="dialog" aria-label={tx('ฉบับย้อนหลัง')}>
                <p className="st-hint">{tx('เลือกฉบับเพื่อนำกลับมาเป็นร่าง หน้าจริงยังไม่เปลี่ยนจนกว่าจะเผยแพร่')}</p>
                <ul>
                  {versions.map((v) => (
                    <li key={v.id}>
                      <span>
                        <strong>{v.label}</strong>
                        <small>
                          {fmtEventTime(v.at)}
                          {v.by ? ` · ${v.by}` : ''}
                        </small>
                        {v.note && <small>{tx(v.note)}</small>}
                      </span>
                      <button type="button" className="btn-secondary" onClick={() => { setPop(null); onRestore(v.id); }}>
                        {tx('นำกลับมา')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </span>
        </span>
      )}
    </div>
  );
}
