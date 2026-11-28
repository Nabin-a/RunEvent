import { useEffect, useRef, useState, type ReactNode } from 'react';
import { backPhotoOf, souvenirPhoto } from '../data/productPhotos';
import { tx } from '../i18n';

const categoryPreviews = import.meta.glob<string>('../assets/souvenir-categories/*.webp', { eager: true, import: 'default' });
const categoryFiles: Record<string, string> = {
  'เสื้อที่ระลึก': 'shirts',
  'เหรียญที่ระลึก': 'medals',
  'อุปกรณ์เสริม': 'accessories',
};

/**
 * Product photo by name (data/productPhotos), else a preview by souvenir category; line
 * drawings remain the fallback.
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

/**
 * How a shirt photo shows its back (28 Nov 2026, user request "hover เสื้อให้แสดงด้านหลัง"):
 * - 'hover': a mouse over the photo shows the back (the default; safe inside a clickable card)
 * - 'button': the same, plus a small "ดูด้านหลัง" button for touch screens and the keyboard;
 *   only where the photo is not inside a button or label, and its box is positioned
 * - 'none': small thumbnails (cart lines, tabs) keep the front
 * Photos with no back view (see data/productPhotos) always show the front.
 */
export type PhotoFlip = 'hover' | 'button' | 'none';

export function ProductPhoto({
  src,
  className,
  alt = '',
  flip = 'hover',
  onError,
}: {
  src: string;
  className?: string;
  /** '' for a picture that sits next to its name */
  alt?: string;
  flip?: PhotoFlip;
  onError?: () => void;
}) {
  const back = flip === 'none' ? undefined : backPhotoOf(src);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // another shirt starts on its front; the back is fetched early so the swap does not blink
  useEffect(() => {
    setHover(false);
    setPinned(false);
    if (back) new Image().src = back;
  }, [src, back]);

  const showBack = !!back && (hover || pinned);
  const enter = (e: React.PointerEvent) => {
    if (back && e.pointerType === 'mouse') setHover(true);
  };
  // moving between the photo and its button keeps the back showing
  const leave = (e: React.PointerEvent) => {
    const to = e.relatedTarget as Node | null;
    if (to && (to === btnRef.current || to === imgRef.current)) return;
    setHover(false);
  };

  const img = (
    <img
      ref={imgRef}
      src={showBack ? back : src}
      className={className}
      alt={alt && showBack ? `${alt} (${tx('ด้านหลัง')})` : alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      decoding="async"
      onError={onError}
      onPointerEnter={enter}
      onPointerLeave={leave}
    />
  );
  if (!back || flip !== 'button') return img;
  return (
    <>
      {img}
      <button
        ref={btnRef}
        type="button"
        className="photo-flip-btn"
        onPointerEnter={enter}
        onPointerLeave={leave}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPinned((v) => !v);
          setHover(false);
        }}
      >
        {/* the button names the side it turns to */}
        {pinned ? tx('ดูด้านหน้า') : tx('ดูด้านหลัง')}
      </button>
    </>
  );
}

export function ProductArt({
  kind,
  className,
  categoryLabel,
  name,
  flip,
}: {
  kind: ProductArtKind;
  className?: string;
  categoryLabel?: string;
  /** product name: picks a product photo when one matches (26 Nov 2026) */
  name?: string;
  /** how a shirt photo shows its back (see PhotoFlip) */
  flip?: PhotoFlip;
}) {
  const file = categoryLabel ? categoryFiles[categoryLabel] : undefined;
  const photo = categoryLabel && name ? souvenirPhoto(categoryLabel, name) : undefined;
  const src = photo ?? (file ? categoryPreviews[`../assets/souvenir-categories/${file}.webp`] : undefined);
  const [failedSrc, setFailedSrc] = useState<string>();
  if (src && src !== failedSrc) {
    return <ProductPhoto src={src} className={`${className ?? ''} product-preview-image`} flip={flip} onError={() => setFailedSrc(src)} />;
  }
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
