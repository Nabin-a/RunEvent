/**
 * Font Awesome Free icon from the webfont already loaded in main.tsx
 * (`@fortawesome/fontawesome-free`, icons CC BY 4.0). Decorative: the control that
 * holds it carries the accessible name.
 */
export function FaIcon({
  name,
  variant = 'solid',
  className = '',
}: {
  /** icon name without the `fa-` prefix, e.g. "desktop", "mobile-screen" */
  name: string;
  variant?: 'solid' | 'regular';
  className?: string;
}) {
  return <i className={`fa-${variant} fa-${name} fa-fw ${className}`.trim()} aria-hidden="true" />;
}
