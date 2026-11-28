import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import run1 from '../assets/mascot/run-1.webp';
import run2 from '../assets/mascot/run-2.webp';
import run3 from '../assets/mascot/run-3.webp';
import standImg from '../assets/mascot/stand.webp';
import cheerImg from '../assets/mascot/cheer.webp';
import tiredImg from '../assets/mascot/step-tired.webp';
import finishImg from '../assets/mascot/step-finish.webp';
import { tx } from '../i18n';
import { useThemeId } from '../theme';
import { themedMascot } from './mascotArt';

/**
 * "Kratai" rabbit mascot.
 * - run:   3-frame run cycle (frames swapped with CSS steps + a small bob), loops
 * - stand: idle pose
 * - cheer: high-five jump, hops twice when it appears
 * - tired: wiping sweat (supplied pose 07), where the stepper rabbit stops on a middle step
 * - finish: cheerful stride (supplied pose 06), on the stepper's last step
 * With prefers-reduced-motion the run shows a single frame and nothing moves.
 * Decorative by default (aria-hidden); pass `label` when the mascot carries meaning.
 */
export type MascotPose = 'run' | 'stand' | 'cheer' | 'tired' | 'finish';

const STILLS: Record<Exclude<MascotPose, 'run'>, string> = {
  stand: standImg,
  cheer: cheerImg,
  tired: tiredImg,
  finish: finishImg,
};

export const MascotSprite: React.FC<{
  pose: MascotPose;
  /** rendered height in px */
  size?: number;
  /** face left (e.g. running back to an earlier step) */
  flip?: boolean;
  label?: string;
  className?: string;
}> = ({ pose, size = 64, flip = false, label, className = '' }) => {
  const theme = useThemeId();
  const art = (url: string) => themedMascot(url, theme);
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
          <img src={art(run1)} alt="" className="mascot-frame f1" draggable={false} />
          <img src={art(run2)} alt="" className="mascot-frame f2" draggable={false} />
          <img src={art(run3)} alt="" className="mascot-frame f3" draggable={false} />
        </span>
      ) : (
        <img src={art(STILLS[pose])} alt="" className="mascot-still" draggable={false} />
      )}
    </span>
  );
};

/* ------------------------------------------------------------------------ */
/* 1) Registration stepper: the rabbit runs to the current step              */
/* ------------------------------------------------------------------------ */
const STEP_RUN_MS = 900;
/** half of each resting pose's width at the stepper's 44px height (the pictures are 240px tall) */
const HALF_WIDTH_44: Record<string, number> = {
  stand: Math.ceil((44 * 130) / 240 / 2),
  tired: Math.ceil((44 * 190) / 240 / 2),
  finish: Math.ceil((44 * 166) / 240 / 2),
};

/**
 * The pose the stepper rabbit rests in (25 Nov 2026, user request): the usual standing pose on
 * the first step, pose 07 (wiping sweat) on every middle step, pose 06 (cheerful stride) on the
 * last step and once the registration is complete.
 */
export function restingStepPose(index: number, count: number, complete: boolean): MascotPose {
  if (complete || (count > 1 && index >= count - 1)) return 'finish';
  if (index <= 0) return 'stand';
  return 'tired';
}

/**
 * Run state for a mascot that moves between steps: `running` is true for one
 * run cycle after `stepIndex` changes, and `flip` says it is running back.
 */
export function useStepRun(stepIndex: number): { running: boolean; flip: boolean } {
  const [running, setRunning] = useState(false);
  const [flip, setFlip] = useState(false);
  const prevIndex = useRef(stepIndex);
  useEffect(() => {
    if (prevIndex.current === stepIndex) return;
    setFlip(stepIndex < prevIndex.current);
    prevIndex.current = stepIndex;
    setRunning(true);
    const t = window.setTimeout(() => setRunning(false), STEP_RUN_MS);
    return () => window.clearTimeout(t);
  }, [stepIndex]);
  return { running, flip };
}

export const MascotStepTrack: React.FC<{
  /** the stepper <nav>; its `.circle-step-node` children give the x positions */
  stepperRef: React.RefObject<HTMLElement | null>;
  stepIndex: number;
  /** how many steps the stepper shows (first and last get their own resting pose) */
  stepCount: number;
  complete: boolean;
}> = ({ stepperRef, stepIndex, stepCount, complete }) => {
  const [x, setX] = useState<number | null>(null);
  const { running, flip } = useStepRun(stepIndex);
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Where the rabbit stops: right under the current ring's centre, measured against the track
  // the rabbit moves in (not the stepper, which can be wider or offset). Measured again when the
  // run ends, when fonts load and when either box changes size, so a measure taken mid-run
  // (wider running pose, form below changing height) never leaves it off the ring.
  useLayoutEffect(() => {
    const nav = stepperRef.current;
    const track = trackRef.current;
    if (!nav || !track) return;
    const measure = () => {
      const node = nav.querySelectorAll<HTMLElement>('.circle-step-node')[stepIndex];
      if (!node) return;
      const ring = node.querySelector<HTMLElement>('.circle-step-ring') ?? node;
      const box = ring.getBoundingClientRect();
      const trackBox = track.getBoundingClientRect();
      // keep the resting rabbit inside the track (its width, not the wider running pose)
      const half = HALF_WIDTH_44[restingStepPose(stepIndex, stepCount, complete)] ?? HALF_WIDTH_44.stand;
      const centre = box.left + box.width / 2 - trackBox.left;
      setX(Math.min(Math.max(centre, half), trackBox.width - half));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    ro.observe(track);
    let alive = true;
    void document.fonts?.ready.then(() => alive && measure());
    return () => {
      alive = false;
      ro.disconnect();
    };
  }, [stepperRef, stepIndex, stepCount, complete, running]);

  const pose: MascotPose = running ? 'run' : restingStepPose(stepIndex, stepCount, complete);
  return (
    <div ref={trackRef} className="mascot-step-track" aria-hidden="true">
      {x !== null && (
        // transform, not left: the run is composited on the GPU, no layout work per frame
        <span className="mascot-step-runner" style={{ transform: `translateX(${x}px) translateX(-50%)` }}>
          <MascotSprite pose={pose} size={44} flip={running && flip} />
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
