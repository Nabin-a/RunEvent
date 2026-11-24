import { gsap, ScrollTrigger, useGSAP } from './scrollMotion';

/**
 * Renders nothing. On wide screens, where the register card follows the page, it
 * marks the card `is-compact` once reading starts (first event section at 30%
 * of the screen) until the end of the page, and clears it when the reader goes
 * back up. CSS then drops the cheering rabbit, the registration window and the
 * distance codes, so price, register button and topics fit a short laptop screen.
 *
 * A state change, not movement: it also runs with reduced motion.
 */
export function StickyCardCompact({
  firstSectionId,
  enabled,
  pageKey,
}: {
  /** DOM id of the first event section on the page */
  firstSectionId: string | undefined;
  /** true while the event sections are rendered */
  enabled: boolean;
  /** the event id */
  pageKey: string;
}) {
  useGSAP(
    () => {
      if (!enabled || !firstSectionId) return;
      const card = document.querySelector<HTMLElement>('.event-detail-page .sticky-register-card');
      const first = document.getElementById(firstSectionId);
      if (!card || !first) return;
      const mm = gsap.matchMedia();
      // same breakpoint where the summary card stops following the page (see MobileRegisterBar)
      mm.add('(min-width: 60rem)', () => {
        ScrollTrigger.create({
          trigger: first,
          start: 'top 30%',
          end: 'max',
          toggleClass: { targets: card, className: 'is-compact' },
        });
      });
      return () => mm.revert();
    },
    { dependencies: [enabled, firstSectionId, pageKey], revertOnUpdate: true }
  );
  return null;
}
