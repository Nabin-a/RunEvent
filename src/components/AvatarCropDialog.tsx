import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx } from '../i18n';

/**
 * Crop & zoom dialog for the profile picture (built in-house, no library).
 *
 * - Drag (mouse / touch) to move, pinch or mouse wheel to zoom, slider and − / + buttons too.
 * - Keyboard on the image area: arrow keys move (Shift = larger step), + / − zoom, 0 resets.
 * - The image always covers the circle, so the result never has empty corners.
 * - Output: square JPEG (OUTPUT_PX) shown in a circle across the app.
 */

const OUTPUT_PX = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Props {
  /** Data URL of the picked file; null keeps the dialog closed. */
  src: string | null;
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
}

export const AvatarCropDialog: React.FC<Props> = ({ src, onCancel, onConfirm }) => {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [stage, setStage] = useState(288);
  const [zoom, setZoom] = useState(1);
  // pan as a fraction of the stage size, so it survives a resize of the dialog
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; zoom: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // load the picked image
  useEffect(() => {
    if (!src) return;
    setImg(null);
    setFailed(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    const im = new Image();
    im.onload = () => setImg(im);
    im.onerror = () => setFailed(true);
    im.src = src;
  }, [src]);

  // dialog behaviour: focus, Esc, lock page scroll
  useEffect(() => {
    if (!src) return;
    headingRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onCancel]);

  // stage is responsive: measure it
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const apply = () => setStage(el.clientWidth || 288);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src, img]);

  const baseScale = img ? Math.max(stage / img.naturalWidth, stage / img.naturalHeight) : 1;
  const dispW = img ? img.naturalWidth * baseScale * zoom : stage;
  const dispH = img ? img.naturalHeight * baseScale * zoom : stage;

  // keep the image covering the stage
  const clampPan = useCallback(
    (p: { x: number; y: number }, z: number) => {
      if (!img) return p;
      const w = img.naturalWidth * baseScale * z;
      const h = img.naturalHeight * baseScale * z;
      const maxX = Math.max(0, (w - stage) / 2) / stage;
      const maxY = Math.max(0, (h - stage) / 2) / stage;
      return { x: clamp(p.x, -maxX, maxX), y: clamp(p.y, -maxY, maxY) };
    },
    [img, baseScale, stage]
  );

  const setZoomClamped = (z: number) => {
    const next = clamp(z, MIN_ZOOM, MAX_ZOOM);
    setZoom(next);
    setPan((p) => clampPan(p, next));
  };

  const moveBy = (dxPx: number, dyPx: number) =>
    setPan((p) => clampPan({ x: p.x + dxPx / stage, y: p.y + dyPx / stage }, zoom));

  /* ---------------- pointer: drag + pinch ---------------- */
  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // capture is a nicety (keeps dragging when the pointer leaves the stage)
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      setZoomClamped((gesture.current.zoom * dist) / Math.max(1, gesture.current.dist));
      return;
    }
    moveBy(e.clientX - prev.x, e.clientY - prev.y);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  // wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = clamp(zoomRef.current * Math.exp(-e.deltaY * 0.0015), MIN_ZOOM, MAX_ZOOM);
      zoomRef.current = next;
      setZoom(next);
      setPan((p) => clampPan(p, next));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [clampPan, img]);

  const onStageKey = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const map: Record<string, () => void> = {
      ArrowLeft: () => moveBy(step, 0),
      ArrowRight: () => moveBy(-step, 0),
      ArrowUp: () => moveBy(0, step),
      ArrowDown: () => moveBy(0, -step),
      '+': () => setZoomClamped(zoom + 0.1),
      '=': () => setZoomClamped(zoom + 0.1),
      '-': () => setZoomClamped(zoom - 0.1),
      '0': () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      },
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const confirm = () => {
    if (!img) return;
    const k = baseScale * zoom; // displayed px per source px
    const left = stage / 2 + pan.x * stage - dispW / 2;
    const top = stage / 2 + pan.y * stage - dispH / 2;
    const sx = -left / k;
    const sy = -top / k;
    const size = stage / k;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_PX;
    canvas.height = OUTPUT_PX;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, size, size, 0, 0, OUTPUT_PX, OUTPUT_PX);
    onConfirm(canvas.toDataURL('image/jpeg', 0.86));
  };

  if (!src) return null;

  const tfX = pan.x * stage;
  const tfY = pan.y * stage;

  return createPortal(
    <div
      className="runner-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="runner-modal-dialog avatar-crop-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
        aria-describedby="avatar-crop-help"
      >
        <div className="runner-modal-header">
          <h3 id="avatar-crop-title" ref={headingRef} tabIndex={-1}>
            {tx('ปรับรูปโปรไฟล์')}
          </h3>
          <button type="button" className="runner-modal-close-btn" aria-label={tx('ปิด')} onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="runner-modal-body avatar-crop-body">
          <p id="avatar-crop-help" className="muted-inline">
            {tx('ลากเพื่อเลื่อนตำแหน่ง ใช้แถบหรือล้อเมาส์เพื่อซูม บนมือถือใช้สองนิ้วถ่างหรือหุบ')}
          </p>

          <div
            ref={stageRef}
            className={`avatar-crop-stage ${img ? '' : 'is-loading'}`}
            tabIndex={0}
            role="group"
            aria-label={tx('พื้นที่ปรับรูป ใช้ปุ่มลูกศรเพื่อเลื่อน และปุ่ม + หรือ − เพื่อซูม')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onStageKey}
          >
            {img && (
              <img
                src={src}
                alt=""
                draggable={false}
                className="avatar-crop-img"
                style={{
                  width: `${dispW}px`,
                  height: `${dispH}px`,
                  transform: `translate(-50%, -50%) translate(${tfX}px, ${tfY}px)`,
                }}
              />
            )}
            <div className="avatar-crop-mask" aria-hidden="true" />
            {failed && <p className="avatar-crop-error">{tx('อ่านไฟล์รูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')}</p>}
          </div>

          <div className="avatar-crop-zoom">
            <button
              type="button"
              className="avatar-crop-zoom-btn"
              aria-label={tx('ซูมออก')}
              onClick={() => setZoomClamped(zoom - 0.2)}
              disabled={!img || zoom <= MIN_ZOOM}
            >
              −
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              aria-label={tx('ระดับการซูม')}
              aria-valuetext={`${Math.round(zoom * 100)}%`}
              disabled={!img}
              onChange={(e) => setZoomClamped(Number(e.target.value))}
            />
            <button
              type="button"
              className="avatar-crop-zoom-btn"
              aria-label={tx('ซูมเข้า')}
              onClick={() => setZoomClamped(zoom + 0.2)}
              disabled={!img || zoom >= MAX_ZOOM}
            >
              +
            </button>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              disabled={!img}
            >
              {tx('รีเซ็ต')}
            </button>
          </div>
        </div>

        <div className="runner-modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {tx('ยกเลิก')}
          </button>
          <button type="button" className="btn-primary" onClick={confirm} disabled={!img}>
            {tx('ใช้รูปนี้')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
