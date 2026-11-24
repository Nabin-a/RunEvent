import { useEffect, useRef } from 'react';
import { gsap, MOTION_OK, ScrollTrigger, useGSAP, useScrollTriggerAutoRefresh } from './scrollMotion';

/**
 * Scroll motion of the home page (renders nothing):
 * - the hero rabbit runs off to the right as the hero scrolls away, speeding up;
 * - event cards below the first screen rise in as they arrive, once.
 *
 * Cards already on screen are never hidden, so the first view does not wait on
 * an entrance. Only the first list is staged: after a filter or search changes
 * the list, every card still waiting is shown at once (no replay).
 * Everything is off under `prefers-reduced-motion: reduce`.
 */
export function HomeScrollMotion({ cardCount, listKey }: { cardCount: number; listKey: string }) {
  const armed = useRef(false);
  // the list the cards were staged for; a different list shows the waiting cards
  const stagedKey = useRef<string | null>(null);
  const pending = useRef<{ cards: HTMLElement[]; triggers: ScrollTrigger[] } | null>(null);
  useScrollTriggerAutoRefresh(cardCount > 0);

  // hero rabbit
  useGSAP(() => {
    const hero = document.querySelector<HTMLElement>('.kr-hero');
    const rabbit = hero?.querySelector<HTMLElement>('.kr-hero-mascot');
    if (!hero || !rabbit) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.to(rabbit, {
        // to just past the hero's right edge (the hero clips it there)
        x: () => hero.clientWidth - rabbit.offsetLeft,
        ease: 'power2.in',
        scrollTrigger: {
          trigger: hero,
          start: 0,
          end: 'bottom top',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });
    });
    return () => mm.revert();
  });

  // event cards: staged once, when the first list has rendered
  useGSAP(
    () => {
      if (armed.current || cardCount === 0) return;
      armed.current = true;
      stagedKey.current = listKey;
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const fold = window.innerHeight * 0.92;
        const below = gsap.utils
          .toArray<HTMLElement>('#kr-results .kr-event-card')
          .filter((card) => card.getBoundingClientRect().top > fold);
        if (below.length === 0) return;
        // the card's own hover transition would smear the tween
        gsap.set(below, { opacity: 0, y: 14, transition: 'none' });
        const triggers = ScrollTrigger.batch(below, {
          start: 'top 92%',
          once: true,
          onEnter: (batch) => {
            gsap.to(batch, {
              opacity: 1,
              y: 0,
              duration: 0.5,
              ease: 'expo.out',
              stagger: 0.06,
              overwrite: true,
              clearProps: 'opacity,transform,transition',
            });
          },
        });
        pending.current = { cards: below, triggers };
      });
      return () => {
        mm.revert();
        // unmount (or a dev StrictMode remount): allow staging again
        armed.current = false;
        pending.current = null;
      };
    },
    { dependencies: [cardCount > 0] }
  );

  // the list changed (filter, search): show every card still waiting, without motion
  useEffect(() => {
    if (listKey === stagedKey.current || !pending.current) return;
    const { cards, triggers } = pending.current;
    pending.current = null;
    triggers.forEach((t) => t.kill());
    gsap.killTweensOf(cards);
    gsap.set(cards, { clearProps: 'opacity,transform,transition' });
  }, [listKey]);

  return null;
}
