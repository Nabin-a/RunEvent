import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx, txf } from '../i18n';
import { IconBib } from './Icons';

/**
 * Register bar pinned to the bottom of the screen on phones and narrow tablets
 * (CSS shows it below 60rem, where the summary card stops following the page).
 *
 * It slides in only after the summary card's own register button has scrolled
 * out of view, so the page never shows two register buttons at once.
 * Rendered into <body>: the page wrapper animates with a transform, and a
 * transformed ancestor would pin a fixed element to itself instead of the screen.
 */
export function MobileRegisterBar({
  watchSelector,
  headline,
  priceText,
  seatsLeft,
  hideSeatCount = false,
  onRegister,
}: {
  /** the in-page register area; the bar hides while it is on screen */
  watchSelector: string;
  /** short line above the price, e.g. "3 ระยะ · เริ่มต้น" */
  headline: string;
  priceText: string;
  /** seats left in the whole event; 0 disables the button */
  seatsLeft: number;
  /** true when the event's total cap is off: no seat count, only "full" once every distance is full */
  hideSeatCount?: boolean;
  onRegister: () => void;
}) {
  const disabled = seatsLeft <= 0;
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // one rect read per scroll event; React skips the render when the value is unchanged
    const check = () => {
      const target = document.querySelector(watchSelector);
      if (!target) {
        setShown(true);
        return;
      }
      const r = target.getBoundingClientRect();
      setShown(r.bottom <= 0 || r.top >= window.innerHeight);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [watchSelector]);

  return createPortal(
    <div
      className={`mreg-bar ${shown ? 'is-shown' : ''}`}
      role="region"
      aria-label={tx('สมัครงานวิ่งนี้')}
    >
      <div className="mreg-info">
        <span className="mreg-cat">{headline}</span>
        <span className="mreg-meta">
          <strong className="mono-num text-vermilion">{priceText}</strong>
          {!(hideSeatCount && seatsLeft > 0) && (
            <span className="mreg-seats">
              {seatsLeft > 0 ? txf('ว่าง {0} สิทธิ์', seatsLeft) : tx('โควตาเต็มแล้ว')}
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        className="btn-cta-accent mreg-btn"
        disabled={disabled}
        onClick={onRegister}
      >
        <IconBib size={16} />
        <span>{disabled ? tx('โควตาเต็มแล้ว') : tx('สมัครเลย')}</span>
      </button>
    </div>,
    document.body
  );
}
