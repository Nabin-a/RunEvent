import { useRef } from 'react';
import { tx } from '../i18n';
import { IconClock } from './Icons';
import { gsap, MOTION_OK, useGSAP, useScrollTriggerAutoRefresh } from './scrollMotion';

export interface ScheduleItem {
  timeLabel: string;
  title: string;
  detail: string;
}

/**
 * Event schedule as a course line: a rail joins one dot per item, and as the
 * reader scrolls the rail fills down to a reading line at 70% of the screen,
 * filling each dot it reaches (same idea as the route line drawn on covers).
 *
 * Default markup shows the whole rail filled and every dot done, so the list
 * reads the same with reduced motion or without scripts; the scroll fill only
 * switches on under `prefers-reduced-motion: no-preference`.
 */
export function ScheduleTimeline({
  items,
  editBase,
  dragList,
}: {
  items: ScheduleItem[];
  /** editor preview only: mark each text for in-place editing (`<editBase>.<n>.<field>`) */
  editBase?: string;
  /** editor preview only: rows can be dragged to reorder, as list `<dragList>` */
  dragList?: string;
}) {
  const ed = (n: number, field: keyof ScheduleItem, value: string) =>
    editBase ? { 'data-page-edit': `${editBase}.${n}.${field}`, 'data-edit-mode': field === 'detail' ? 'multi' : 'line', 'data-edit-value': value } : {};
  const root = useRef<HTMLDivElement>(null);
  // the parent rebuilds the array on every render; re-measure only when the content changes
  const itemsKey = items.map((i) => `${i.timeLabel}|${i.title}`).join('\n');
  useScrollTriggerAutoRefresh(items.length > 1);

  useGSAP(
    () => {
      const el = root.current;
      if (!el || items.length < 2) return;
      const rail = el.querySelector<HTMLElement>('.schedule-rail');
      const fill = el.querySelector<HTMLElement>('.schedule-rail-fill');
      const rows = Array.from(el.querySelectorAll<HTMLElement>('.schedule-timeline-row'));
      const dots = Array.from(el.querySelectorAll<HTMLElement>('.schedule-dot'));
      if (!rail || !fill || dots.length !== rows.length) return;

      // dot centres measured from the top of the list; the rail runs first dot to last dot
      let centres: number[] = [];
      const measure = () => {
        const top = el.getBoundingClientRect().top;
        centres = dots.map((d) => {
          const r = d.getBoundingClientRect();
          return r.top + r.height / 2 - top;
        });
        rail.style.top = `${centres[0]}px`;
        rail.style.height = `${centres[centres.length - 1] - centres[0]}px`;
      };
      measure();

      const markPassed = (progress: number) => {
        const reached = progress * (centres[centres.length - 1] - centres[0]);
        rows.forEach((row, i) => {
          row.classList.toggle('is-passed', progress > 0 && centres[i] - centres[0] <= reached + 0.5);
        });
      };

      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        el.classList.add('is-tracing');
        gsap.fromTo(
          fill,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            // the fill trails the scroll a little; dots follow the drawn fill, not the scroll
            // (fromTo renders at once, so read the tween from `this`, not a const)
            onUpdate(this: gsap.core.Tween) {
              markPassed(this.progress());
            },
            scrollTrigger: {
              trigger: el,
              start: () => `top+=${centres[0]} 70%`,
              end: () => `top+=${centres[centres.length - 1]} 70%`,
              scrub: 0.4,
              invalidateOnRefresh: true,
              onRefreshInit: measure,
            },
          }
        );
        return () => {
          el.classList.remove('is-tracing');
          rows.forEach((row) => row.classList.remove('is-passed'));
        };
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [itemsKey], revertOnUpdate: true }
  );

  return (
    <div ref={root} className="schedule-trace">
      {items.length > 1 && (
        <span className="schedule-rail" aria-hidden="true">
          <span className="schedule-rail-fill" />
        </span>
      )}
      <div className="schedule-timeline-list">
        {items.map((item, idx) => (
          <div key={idx} className="schedule-timeline-row" {...(dragList ? { 'data-core-item': `${dragList}:${idx}` } : {})}>
            {items.length > 1 && <span className="schedule-dot" aria-hidden="true" />}
            <div className="schedule-time-badge mono-num">
              <IconClock size={14} />
              <span {...ed(idx, 'timeLabel', item.timeLabel)}>{tx(item.timeLabel)}</span>
            </div>
            <div className="schedule-row-body">
              <strong {...ed(idx, 'title', item.title)}>{tx(item.title)}</strong>
              <p className="muted-inline" {...ed(idx, 'detail', item.detail)}>
                {tx(item.detail)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
