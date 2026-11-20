import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import run1 from '../assets/mascot/run-1.webp';
import run2 from '../assets/mascot/run-2.webp';
import run3 from '../assets/mascot/run-3.webp';
import standImg from '../assets/mascot/stand.webp';
import cheerImg from '../assets/mascot/cheer.webp';
import { tx } from '../i18n';

/**
 * "Kratai" rabbit mascot.
 * - run:   3-frame run cycle (frames swapped with CSS steps + a small bob), loops
 * - stand: idle pose
 * - cheer: high-five jump, hops twice when it appears
 * With prefers-reduced-motion the run shows a single frame and nothing moves.
 * Decorative by default (aria-hidden); pass `label` when the mascot carries meaning.
 */
export type MascotPose = 'run' | 'stand' | 'cheer';

export const MascotSprite: React.FC<{
  pose: MascotPose;
  /** rendered height in px */
  size?: number;
  /** face left (e.g. running back to an earlier step) */
  flip?: boolean;
  label?: string;
  className?: string;
}> = ({ pose, size = 64, flip = false, label, className = '' }) => {
  const style = { '--mascot-h': `${size}px` } as React.CSSProperties;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <span
      className={`mascot mascot-${pose} ${flip ? 'is-flipped' : ''} ${className}`}
      style={style}
      {...a11y}
    >
      {pose === 'run' ? (
        <span className="mascot-frames">
          <img src={run1} alt="" className="mascot-frame f1" draggable={false} />
          <img src={run2} alt="" className="mascot-frame f2" draggable={false} />
          <img src={run3} alt="" className="mascot-frame f3" draggable={false} />
        </span>
      ) : (
        <img src={pose === 'cheer' ? cheerImg : standImg} alt="" className="mascot-still" draggable={false} />
      )}
    </span>
  );
};

/* ------------------------------------------------------------------------ */
/* 1) Registration stepper: the rabbit runs to the current step              */
/* ------------------------------------------------------------------------ */
const STEP_RUN_MS = 900;

export const MascotStepTrack: React.FC<{
  /** the stepper <nav>; its `.circle-step-node` children give the x positions */
  stepperRef: React.RefObject<HTMLElement | null>;
  stepIndex: number;
  complete: boolean;
}> = ({ stepperRef, stepIndex, complete }) => {
  const [x, setX] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [flip, setFlip] = useState(false);
  const prevIndex = useRef(stepIndex);

  useLayoutEffect(() => {
    const nav = stepperRef.current;
    if (!nav) return;
    const measure = () => {
      const nodes = nav.querySelectorAll<HTMLElement>('.circle-step-node');
      const node = nodes[stepIndex];
      if (!node) return;
      const navBox = nav.getBoundingClientRect();
      const ring = node.querySelector<HTMLElement>('.circle-step-ring') ?? node;
      const box = ring.getBoundingClientRect();
      // keep the whole rabbit inside the track at the first / last step
      const half = 30;
      setX(Math.min(Math.max(box.left + box.width / 2 - navBox.left, half), navBox.width - half));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, [stepperRef, stepIndex]);

  useEffect(() => {
    if (prevIndex.current === stepIndex) return;
    setFlip(stepIndex < prevIndex.current);
    prevIndex.current = stepIndex;
    setRunning(true);
    const t = window.setTimeout(() => setRunning(false), STEP_RUN_MS);
    return () => window.clearTimeout(t);
  }, [stepIndex]);

  const pose: MascotPose = running ? 'run' : complete ? 'cheer' : 'stand';
  return (
    <div className="mascot-step-track" aria-hidden="true">
      {x !== null && (
        <span className="mascot-step-runner" style={{ left: `${x}px` }}>
          <MascotSprite pose={pose} size={56} flip={running && flip} />
        </span>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* 2) Home hero: runs in once along a lane, then stands                      */
/* ------------------------------------------------------------------------ */
const HERO_RUN_MS = 2200;

export const MascotHeroLane: React.FC = () => {
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setArrived(true);
      return;
    }
    const t = window.setTimeout(() => setArrived(true), HERO_RUN_MS);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="mascot-hero-lane" aria-hidden="true">
      <span className={`mascot-hero-runner ${arrived ? 'is-arrived' : ''}`}>
        <MascotSprite pose={arrived ? 'stand' : 'run'} size={72} />
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* 3) Waiting states: the rabbit runs in place with a message                */
/* ------------------------------------------------------------------------ */
export const MascotLoader: React.FC<{ message?: string; fullscreen?: boolean }> = ({
  message,
  fullscreen = false,
}) => (
  <div className={`mascot-loader ${fullscreen ? 'is-fullscreen' : ''}`} role="status" aria-live="polite">
    <MascotSprite pose="run" size={fullscreen ? 120 : 72} />
    <span className="mascot-loader-text">{message ?? tx('กำลังโหลด…')}</span>
  </div>
);
