import { useEffect, useRef, type RefObject } from 'react';

type Inside = RefObject<HTMLElement | null> | string;

/**
 * Closes a floating menu or panel when the user presses anywhere outside it, or presses Escape
 * (27 Nov 2026, user request: the profile menu, the Dev / Demo tools and the other menus of that
 * style close on an outside tap).
 *
 * `inside` lists what counts as the menu itself: refs, or CSS selectors for parts rendered
 * elsewhere (e.g. a panel in a portal). A press inside a dialog opened from the menu (a modal
 * on top of it) does not close it either.
 */
export function useDismiss(open: boolean, inside: Inside[], onClose: () => void) {
  // the latest values, so the listeners are added once per opening
  const latest = useRef({ inside, onClose });
  latest.current = { inside, onClose };

  useEffect(() => {
    if (!open) return;
    const isInside = (target: EventTarget | null) => {
      if (!(target instanceof Node)) return false;
      const el = target instanceof Element ? target : target.parentElement;
      if (el?.closest('[role="dialog"], [role="alertdialog"]')) return true;
      return latest.current.inside.some((part) => {
        if (typeof part === 'string') return Boolean(el?.closest(part));
        return Boolean(part.current?.contains(target));
      });
    };
    const onDown = (e: PointerEvent) => {
      if (!isInside(e.target)) latest.current.onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current.onClose();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
}
