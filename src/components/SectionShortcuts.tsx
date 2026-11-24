import { useState } from 'react';
import { tx } from '../i18n';
import type { ResolvedDetailBlock } from '../data/eventDetailLayout';
import { ScrollTrigger, useGSAP, useScrollTriggerAutoRefresh } from './scrollMotion';

/**
 * "Topics on this page" links on the register card. While the event sections are
 * on the page, the link of the section being read is marked (scroll spy), so the
 * reader knows where they are in a long page. The order comes from the blocks,
 * so an organizer's saved layout needs no change here.
 *
 * This is state, not movement: it also runs with reduced motion.
 */
export function SectionShortcuts({
  blocks,
  spy,
  pageKey,
  onJump,
}: {
  /** visible page blocks in display order */
  blocks: ResolvedDetailBlock[];
  /** true while the event sections are rendered (not the register form or shop) */
  spy: boolean;
  /** the event id: a different event means new sections to watch */
  pageKey: string;
  onJump: (sectionId: string) => void;
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const shortcuts = blocks.filter((b) => b.inShortcuts);
  const layoutKey = blocks.map((b) => b.id).join('|');

  useScrollTriggerAutoRefresh(spy);

  useGSAP(
    () => {
      setCurrent(null);
      if (!spy) return;
      // one reading line at 40% of the screen; each block owns the stretch from its top
      // to the next block's top, so moving between blocks never leaves a gap
      const sections = blocks
        .map((b) => ({ block: b, el: document.getElementById(b.sectionId) }))
        .filter((s): s is { block: ResolvedDetailBlock; el: HTMLElement } => s.el !== null);
      sections.forEach(({ block, el }, i) => {
        const next = sections[i + 1]?.el;
        ScrollTrigger.create({
          trigger: el,
          start: 'top 40%',
          ...(next ? { endTrigger: next, end: 'top 40%' } : { end: 'bottom 40%' }),
          onToggle: (self) => {
            if (self.isActive) setCurrent(block.inShortcuts ? block.id : null);
            else setCurrent((cur) => (cur === block.id ? null : cur));
          },
        });
      });
    },
    { dependencies: [spy, layoutKey, pageKey], revertOnUpdate: true }
  );

  if (shortcuts.length === 0) return null;

  return (
    <nav className="sticky-quick-jumps" aria-label={tx('หัวข้อในหน้านี้')}>
      <span className="muted-inline">{tx('หัวข้อในหน้านี้:')}</span>
      <div className="cta-inline-row">
        {shortcuts.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`footer-text-link section-jump ${current === b.id ? 'is-current' : ''}`}
            aria-current={current === b.id ? 'location' : undefined}
            onClick={() => onJump(b.sectionId)}
          >
            {tx(b.label)}
          </button>
        ))}
      </div>
    </nav>
  );
}
