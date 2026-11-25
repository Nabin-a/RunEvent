/**
 * Colour theme (25 Nov 2026, user request): the usual slate/mint theme, or a dark theme in LINE
 * green and black. The choice is kept in this browser only (localStorage) and set as
 * <html data-theme="line">; every colour change lives in theme-line.css, and the mascot art
 * switches to its LINE-coloured copy (mascotArt.ts).
 */
import { useCallback, useSyncExternalStore } from 'react';

export type ThemeId = 'default' | 'line';

const THEME_STORAGE_KEY = 'kratai-theme';

export function readStoredTheme(): ThemeId {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'line' ? 'line' : 'default';
  } catch {
    return 'default';
  }
}

let current: ThemeId = typeof window === 'undefined' ? 'default' : readStoredTheme();
const listeners = new Set<() => void>();

export function applyTheme(theme: ThemeId): void {
  current = theme;
  const root = document.documentElement;
  if (theme === 'line') root.dataset.theme = 'line';
  else delete root.dataset.theme;
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => listeners.delete(notify);
}

/** the current theme; components re-render when it changes */
export function useThemeId(): ThemeId {
  return useSyncExternalStore(subscribe, () => current, () => 'default');
}

export function useTheme(): { theme: ThemeId; toggleTheme: () => void } {
  const theme = useThemeId();
  const toggleTheme = useCallback(() => {
    const next: ThemeId = current === 'line' ? 'default' : 'line';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // private mode or blocked storage: the theme still changes for this visit
    }
    applyTheme(next);
  }, []);
  return { theme, toggleTheme };
}
