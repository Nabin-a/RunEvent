import runAnim from '../assets/mascot/anim/run.webp';
import runStill from '../assets/mascot/anim/run-still.webp';
import cheerAnim from '../assets/mascot/anim/cheer.webp';
import cheerStill from '../assets/mascot/anim/cheer-still.webp';
import podiumAnim from '../assets/mascot/anim/podium.webp';
import podiumStill from '../assets/mascot/anim/podium-still.webp';
import jumpAnim from '../assets/mascot/anim/jump.webp';
import jumpStill from '../assets/mascot/anim/jump-still.webp';
import thinkAnim from '../assets/mascot/anim/think.webp';
import thinkStill from '../assets/mascot/anim/think-still.webp';
import winkAnim from '../assets/mascot/anim/wink.webp';
import winkStill from '../assets/mascot/anim/wink-still.webp';
import phoneAnim from '../assets/mascot/anim/phone.webp';
import phoneStill from '../assets/mascot/anim/phone-still.webp';
import standAnim from '../assets/mascot/anim/stand.webp';
import standStill from '../assets/mascot/anim/stand-still.webp';
import heartAnim from '../assets/mascot/anim/heart.webp';
import heartStill from '../assets/mascot/anim/heart-still.webp';

/**
 * The Kratai rabbit (supplied artwork, outfit recoloured to slate + mint) as a
 * looping transparent animation. Users who ask for reduced motion get a still
 * frame instead: <picture> swaps the source with a media query, no JS needed.
 *
 * Built by scripts in the session scratchpad from กระต่าย_KraTai/ต่าย Move:
 * grey background keyed out, one seamless loop kept, blue -> #34495f, lime -> #9be8c7.
 */
/**
 * Pixel size of each clip. Every clip is cut from the same 540px source at the same
 * scale, so drawing them at a common `scale` keeps the rabbit the same size in
 * every pose (a fixed width would shrink the wide poses and blow up the narrow ones).
 */
const ART: Record<string, { moving: string; still: string; w: number; h: number }> = {
  run: { moving: runAnim, still: runStill, w: 169, h: 204 },
  cheer: { moving: cheerAnim, still: cheerStill, w: 154, h: 220 },
  podium: { moving: podiumAnim, still: podiumStill, w: 209, h: 215 },
  jump: { moving: jumpAnim, still: jumpStill, w: 148, h: 223 },
  think: { moving: thinkAnim, still: thinkStill, w: 175, h: 195 },
  wink: { moving: winkAnim, still: winkStill, w: 138, h: 212 },
  phone: { moving: phoneAnim, still: phoneStill, w: 148, h: 159 },
  stand: { moving: standAnim, still: standStill, w: 120, h: 211 },
  heart: { moving: heartAnim, still: heartStill, w: 176, h: 220 },
};

export type MascotPose =
  | 'run'
  | 'cheer'
  | 'podium'
  | 'jump'
  | 'think'
  | 'wink'
  | 'phone'
  | 'stand'
  | 'heart';

export function MascotAnim({
  pose,
  className,
  width,
  scale,
  label,
}: {
  pose: MascotPose;
  className?: string;
  /** rendered width in px; height follows the artwork */
  width?: number;
  /** draw at this fraction of the clip's own size: same scale = same rabbit size in every pose */
  scale?: number;
  /** omit for decoration (default): the image is hidden from screen readers */
  label?: string;
}) {
  const art = ART[pose];
  if (!art) return null;
  const { moving, still } = art;
  const sized = scale
    ? { width: Math.round(art.w * scale), height: Math.round(art.h * scale) }
    : { width };
  return (
    <picture
      className={`mascot-anim ${scale ? 'is-scaled' : ''} ${className ?? ''}`}
      aria-hidden={label ? undefined : true}
    >
      <source srcSet={still} media="(prefers-reduced-motion: reduce)" />
      <img
        src={moving}
        alt={label ?? ''}
        width={sized.width}
        height={'height' in sized ? sized.height : undefined}
        style={scale ? { width: sized.width, height: (sized as { height: number }).height } : undefined}
        loading="lazy"
        decoding="async"
        draggable={false}
      />
    </picture>
  );
}
