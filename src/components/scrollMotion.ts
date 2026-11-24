import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

// Registered once for the whole app; every ScrollTrigger user imports from here.
gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

export const MOTION_OK = '(prefers-reduced-motion: no-preference)';

let refreshTimer: number | undefined;

/**
 * ScrollTrigger measures positions once; the page then keeps changing height
 * (banner images load, age-group panels open, tabs swap content). Watch the
 * body size and re-measure, debounced and shared by every caller.
 */
export function useScrollTriggerAutoRefresh(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
    });
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [enabled]);
}
