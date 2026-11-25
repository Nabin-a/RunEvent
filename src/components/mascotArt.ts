import type { ThemeId } from '../theme';

/**
 * Art for the LINE theme (25 Nov 2026, user request):
 * - every picture under assets/mascot has a twin at the same path under assets/mascot-line:
 *   the profile menu rabbits from output/line-night (tools/build-line-night-assets.py), the
 *   animated rabbits and step sprites recoloured by tools/recolor-mascot-line.py;
 * - each painted scene assets/illustrations/<name>.webp may have a night twin <name>-night.webp
 *   (the supplied scenes in output/line-night, tools/build-line-night-assets.py).
 * Components keep importing the usual art and
 * pass the URL through `themedArt`, which returns the twin when the LINE theme is on.
 */
const usualMascot = import.meta.glob<string>('../assets/mascot/**/*.webp', { eager: true, import: 'default' });
const lineMascot = import.meta.glob<string>('../assets/mascot-line/**/*.webp', { eager: true, import: 'default' });
const scenes = import.meta.glob<string>('../assets/illustrations/*.webp', { eager: true, import: 'default' });

const toLine = new Map<string, string>();
for (const [path, url] of Object.entries(usualMascot)) {
  const twin = lineMascot[path.replace('/assets/mascot/', '/assets/mascot-line/')];
  if (twin) toLine.set(url, twin);
}
for (const [path, url] of Object.entries(scenes)) {
  if (path.endsWith('-night.webp')) continue;
  const twin = scenes[path.replace(/\.webp$/, '-night.webp')];
  if (twin) toLine.set(url, twin);
}

export function themedArt(url: string, theme: ThemeId): string {
  return theme === 'line' ? (toLine.get(url) ?? url) : url;
}

/** the rabbit's art for the current theme */
export const themedMascot = themedArt;
