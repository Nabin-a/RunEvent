import { useId, useState } from 'react';
import { tx, txf } from '../i18n';
import { IconCheckCircle, IconChevronDown } from './Icons';
import { MascotSprite, type MascotPose, useStepRun } from './MascotRunner';

/**
 * Phone-sized progress for the registration wizard (shown below 48rem instead of
 * the circle stepper): the current step by name, "2 / 7", a segmented bar the
 * rabbit runs along, what comes next, and an expandable list of every step where
 * finished steps can be reopened.
 */
export interface MobileStep<S extends number = number> {
  step: S;
  label: string;
}

export function MobileStepProgress<S extends number>({
  steps,
  current,
  complete,
  onJump,
}: {
  steps: MobileStep<S>[];
  current: S;
  complete: boolean;
  /** reopen a finished step */
  onJump: (step: S) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const total = steps.length;
  const index = Math.max(0, steps.findIndex((s) => s.step === current));
  const now = steps[index];
  const next = complete ? undefined : steps[index + 1];
  const { running, flip } = useStepRun(index);
  const pose: MascotPose = running ? 'run' : complete ? 'cheer' : 'stand';
  // centre of the current segment, kept inside the lane at both ends
  const pct = ((index + 0.5) / total) * 100;

  return (
    <nav className="mstep" aria-label={tx('ความคืบหน้าขั้นตอนการสมัคร')}>
      <div className="mstep-head">
        <p className="mstep-title">
          <strong>{tx(now?.label ?? '')}</strong>
          <span className="mstep-count mono-num" aria-hidden="true">
            {index + 1} / {total}
          </span>
          <span className="sr-only">{txf('ขั้นที่ {0} จาก {1}', index + 1, total)}</span>
        </p>
        <button
          type="button"
          className="mstep-toggle"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          <span>{open ? tx('ซ่อนขั้นตอน') : tx('ดูทุกขั้น')}</span>
          <IconChevronDown size={14} />
        </button>
      </div>

      <div className="mstep-lane" aria-hidden="true">
        <span
          className="mstep-runner"
          style={{ left: `clamp(1.1rem, ${pct}%, calc(100% - 1.1rem))` }}
        >
          <MascotSprite pose={pose} size={34} flip={running && flip} />
        </span>
        <div className="mstep-segs">
          {steps.map((s, i) => (
            <span
              key={s.step}
              className={`mstep-seg ${
                complete || i < index ? 'is-done' : i === index ? 'is-current' : ''
              }`}
            />
          ))}
        </div>
      </div>

      {next && (
        <p className="mstep-next">{txf('ถัดไป: {0}', tx(next.label))}</p>
      )}

      {open && (
        <ol id={listId} className="mstep-list">
          {steps.map((s, i) => {
            const done = complete || i < index;
            const isNow = !complete && i === index;
            const body = (
              <>
                <span className="mstep-list-mark" aria-hidden="true">
                  {done ? <IconCheckCircle size={16} /> : i + 1}
                </span>
                <span className="mstep-list-label">{tx(s.label)}</span>
                <span className="mstep-list-state">
                  {done ? tx('เสร็จแล้ว') : isNow ? tx('ขั้นปัจจุบัน') : ''}
                </span>
              </>
            );
            return (
              <li
                key={s.step}
                className={`mstep-list-item ${done ? 'is-done' : isNow ? 'is-current' : ''}`}
                aria-current={isNow ? 'step' : undefined}
              >
                {done && !complete ? (
                  <button
                    type="button"
                    className="mstep-list-btn"
                    onClick={() => {
                      setOpen(false);
                      onJump(s.step);
                    }}
                  >
                    {body}
                  </button>
                ) : (
                  <div className="mstep-list-btn is-static">{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </nav>
  );
}
