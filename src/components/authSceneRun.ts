/**
 * The sign-in scene's rabbit runs down the middle lane of the background picture
 * (assets/illustrations/hero-running-track.webp, drawn with `30% bottom / cover`): from the far
 * end at the right horizon towards the viewer, growing with the lane, through to the bottom
 * of the screen (behind the sign-in card), then starts again at the far end, again and again.
 * User's sketch and notes, 24 Nov 2026. Wider screens only; phones show no rabbit (CSS).
 * Sign-up (25 Nov 2026) scrolls over a fixed landscape: there the rabbit is fixed too and the
 * path is fitted to the screen, not to the (taller) page.
 *
 * LANE is the middle of the three lanes: half way between the 2nd and 3rd white lines,
 * measured on the picture row by row (the lines converge towards the horizon), so the path
 * follows the curve at every screen size and crop.
 */
const IMG_W = 1600;
const IMG_H = 533;
const BG_POS_X = 0.3;

/** [x, y (feet), lane width] in picture pixels, far -> near */
const LANE: [number, number, number][] = [
  [1505, 364, 22],
  [1480, 367, 40],
  [1451, 370, 60],
  [1376, 380, 85],
  [1307, 390, 106],
  [1240, 400, 133],
  [1175, 410, 152],
  [1110, 420, 176],
  [1050, 430, 199],
  [990, 440, 226],
  [936, 450, 254],
  [887, 460, 281],
  [841, 470, 311],
  [800, 480, 340],
  [765, 490, 367],
  [736, 500, 394],
  [713, 510, 419],
  [695, 520, 444],
  [682, 530, 469],
];
/** below the picture the lane keeps its last direction while the rabbit leaves the screen */
const EXIT_DX_PER_ROW = -1.3;

/** where the feet are on the rabbit picture (it faces left; speed lines trail on the right) */
const FEET_X = 0.26;
const FEET_Y = 0.97;
/** the rabbit's width as a share of the lane's width at its feet */
const SIZE_IN_LANE = 0.3;
/** screen pixels per second along the path */
const SPEED = 170;
const STEPS_PER_SEGMENT = 4;
/** time out of sight between laps, as if the rabbit ran round the rest of the track
 *  (25 Nov 2026, user request: a longer wait before it starts again) */
const LAP_GAP_MS = 10000;

type Point = { x: number; y: number; k: number };

export function startSceneRun(
  scene: HTMLElement,
  rabbit: HTMLElement,
  { fixed = false }: { fixed?: boolean } = {},
): () => void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let anim: Animation | null = null;

  const measure = () => {
    const W = fixed ? document.documentElement.clientWidth : scene.clientWidth;
    const H = fixed ? window.innerHeight : scene.clientHeight;
    const s = Math.max(W / IMG_W, H / IMG_H);
    const baseW = rabbit.offsetWidth || 1;
    const baseH = rabbit.querySelector('img')?.offsetHeight || baseW * 1.2;
    // short screens lift the rabbit's box a little off the bottom (CSS)
    const lift = parseFloat(getComputedStyle(rabbit).bottom) || 0;
    return { W, H, s, offX: (W - IMG_W * s) * BG_POS_X, offY: H - IMG_H * s, baseW, baseH, lift };
  };

  const path = (m: ReturnType<typeof measure>): Point[] => {
    const pt = (x: number, y: number, lane: number): Point => ({
      x: m.offX + x * m.s,
      y: m.offY + y * m.s,
      k: Math.max(0.1, (lane * m.s * SIZE_IN_LANE) / m.baseW),
    });
    const dense: Point[] = [];
    for (let i = 0; i < LANE.length - 1; i += 1) {
      const [x0, y0, l0] = LANE[i];
      const [x1, y1, l1] = LANE[i + 1];
      for (let j = 0; j < STEPS_PER_SEGMENT; j += 1) {
        const t = j / STEPS_PER_SEGMENT;
        dense.push(pt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, l0 + (l1 - l0) * t));
      }
    }
    const [xe, ye, le] = LANE[LANE.length - 1];
    dense.push(pt(xe, ye, le));
    // off the bottom: keep the size, carry on until the whole rabbit is below the screen
    const last = dense[dense.length - 1];
    const rows = (m.baseH * last.k) / m.s + 4;
    dense.push({ ...pt(xe + EXIT_DX_PER_ROW * rows, ye + rows, le), k: last.k });

    // start just off the right edge when the far end of the lane is cropped away
    const visible = dense.findIndex((p) => p.x - FEET_X * m.baseW * p.k <= m.W);
    return dense.slice(Math.max(0, visible - 1));
  };

  const keyframes = (m: ReturnType<typeof measure>, pts: Point[]) => {
    const dist = pts.map((p, i) => (i === 0 ? 0 : Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)));
    const total = dist.reduce((a, b) => a + b, 0) || 1;
    // the box sits at left 0 / bottom `lift`; the feet are the scale origin (CSS transform-origin)
    const restTop = m.H - m.lift - m.baseH;
    const toTransform = (p: Point) =>
      `translate(${(p.x - FEET_X * m.baseW).toFixed(1)}px, ${(p.y - FEET_Y * m.baseH - restTop).toFixed(1)}px) scale(${p.k.toFixed(3)})`;
    const runMs = Math.min(11000, Math.max(5000, (total / SPEED) * 1000));
    const ms = runMs + LAP_GAP_MS;
    // the run takes the first part of each lap; for the rest the rabbit waits below the screen
    const runShare = runMs / ms;
    let run = 0;
    const frames: Keyframe[] = pts.map((p, i) => {
      run += dist[i];
      return { offset: (run / total) * runShare, transform: toTransform(p) };
    });
    frames.push({ offset: 1, transform: toTransform(pts[pts.length - 1]) });
    return { frames, ms, toTransform };
  };

  const place = () => {
    const m = measure();
    const pts = path(m);
    const { frames, ms, toTransform } = keyframes(m, pts);
    rabbit.style.transformOrigin = `${FEET_X * 100}% ${FEET_Y * 100}%`;
    rabbit.style.opacity = '1';
    if (reduce) {
      // no running: the rabbit stands on the lane, part way along and clear of the card
      rabbit.style.transform = toTransform(pts[Math.floor(pts.length * 0.35)]);
      return;
    }
    if (!anim) {
      anim = rabbit.animate(frames, { duration: ms, easing: 'linear', iterations: Infinity });
      return;
    }
    const share = anim.effect?.getComputedTiming().progress ?? 0;
    const effect = anim.effect as KeyframeEffect;
    effect.setKeyframes(frames);
    effect.updateTiming({ duration: ms });
    anim.currentTime = share * ms;
  };

  place();
  // re-fit when the window changes size
  const ro = new ResizeObserver(() => place());
  ro.observe(scene);
  if (fixed) window.addEventListener('resize', place);
  return () => {
    ro.disconnect();
    window.removeEventListener('resize', place);
    anim?.cancel();
    rabbit.style.transform = '';
    rabbit.style.transformOrigin = '';
    rabbit.style.opacity = '';
  };
}
