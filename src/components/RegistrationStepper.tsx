import React, { type RefObject } from 'react';
import { tx } from '../i18n';
import { IconCheckCircle } from './Icons';
import { MascotStepTrack } from './MascotRunner';
import { MobileStepProgress } from './MobileStepProgress';

/**
 * The registration progress exactly as the current form draws it: connected
 * circles with the rabbit running above them on wide screens, and the phone
 * progress bar below 48rem. Shared markup and class names, so both layouts
 * compare on the form body only.
 */
export function RegistrationStepper<S extends number>({
  steps,
  current,
  complete,
  stepperRef,
  onJump,
  freeJump = false,
}: {
  steps: { step: S; label: string }[];
  current: S;
  complete: boolean;
  stepperRef: RefObject<HTMLElement | null>;
  /** reopen a finished step */
  onJump: (step: S) => void;
  /** any step can be opened, also ahead (the organizer's preview of the form) */
  freeJump?: boolean;
}) {
  return (
    <>
      <nav
        ref={stepperRef as RefObject<HTMLElement>}
        className="circle-stepper-bar"
        aria-label={tx('ความคืบหน้าขั้นตอนการสมัคร')}
      >
        {steps.map((item, idx) => {
          const isCurrent = current === item.step;
          const isDone = current > item.step;
          return (
            <React.Fragment key={item.step}>
              <button
                type="button"
                className={`circle-step-node ${isCurrent ? 'active' : isDone ? 'done' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => {
                  if (item.step < current || (freeJump && item.step !== current)) onJump(item.step);
                }}
              >
                <span className="circle-step-label">{tx(item.label)}</span>
                <span className="circle-step-ring" aria-hidden="true">
                  {isDone && <IconCheckCircle size={14} />}
                </span>
              </button>
              {idx < steps.length - 1 && (
                <div
                  className={`circle-stepper-line ${current > item.step ? 'line-done' : ''}`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </nav>
      <MascotStepTrack
        stepperRef={stepperRef}
        stepIndex={Math.max(0, steps.findIndex((s) => s.step === current))}
        stepCount={steps.length}
        complete={complete}
      />
      <MobileStepProgress
        steps={steps}
        current={current}
        complete={complete}
        onJump={(step) => {
          if (step < current || (freeJump && step !== current)) onJump(step);
        }}
      />
    </>
  );
}
