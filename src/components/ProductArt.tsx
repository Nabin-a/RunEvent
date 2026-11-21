import type { ReactNode } from 'react';

/**
 * Line drawings used as the product preview until organizers upload real photos.
 * Always shown with a "ภาพตัวอย่าง" caption so nobody mistakes them for the real item.
 */
export type ProductArtKind = 'tee' | 'sleeveless' | 'tank' | 'medal' | 'cap' | 'bag';

const PATHS: Record<ProductArtKind, ReactNode> = {
  tee: <path d="M35 18 L20 26 L10 42 L22 48 L27 40 L27 86 L73 86 L73 40 L78 48 L90 42 L80 26 L65 18 Q50 30 35 18Z" />,
  sleeveless: (
    <path d="M36 16 L26 22 Q28 36 25 44 L25 86 L75 86 L75 44 Q72 36 74 22 L64 16 Q50 28 36 16Z" />
  ),
  tank: (
    <path d="M38 12 L34 14 Q36 34 26 46 L26 86 L74 86 L74 46 Q64 34 66 14 L62 12 Q58 34 50 34 Q42 34 38 12Z" />
  ),
  medal: (
    <>
      <path d="M34 10 L44 44 M66 10 L56 44" />
      <circle cx="50" cy="64" r="22" />
      <circle cx="50" cy="64" r="13" />
    </>
  ),
  cap: <path d="M18 62 Q18 30 50 28 Q82 30 82 62 Z M18 62 L92 62 Q90 72 70 70" />,
  bag: <path d="M24 36 L76 36 L72 88 L28 88 Z M38 36 Q38 16 50 16 Q62 16 62 36" />,
};

export function ProductArt({ kind, className }: { kind: ProductArtKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      {PATHS[kind]}
    </svg>
  );
}

/** Picks a drawing for a souvenir from its category and name. */
export function souvenirArt(categoryLabel: string, nameTh: string): ProductArtKind {
  if (categoryLabel === 'เหรียญที่ระลึก') return 'medal';
  if (categoryLabel === 'เสื้อที่ระลึก') {
    if (/กล้าม|singlet|tank/i.test(nameTh)) return 'tank';
    if (/แขนกุด|sleeveless/i.test(nameTh)) return 'sleeveless';
    return 'tee';
  }
  if (/หมวก|cap/i.test(nameTh)) return 'cap';
  return 'bag';
}
