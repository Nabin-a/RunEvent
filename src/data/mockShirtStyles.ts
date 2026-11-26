import type { ShirtStock } from '../types';
import type { ProductArtKind } from '../components/ProductArt';
import { SHIRT_PHOTOS } from './productPhotos';

/**
 * Shirt styles for the registration shirt step.
 *
 * Events only store one shirt with stock per size. "เสื้อแขนสั้น" uses that real
 * stock; the other styles are demo data so the style picker can be reviewed. The
 * registration still saves only the size, and stock is taken from the event's
 * single shirt stock, so the demo styles must not go to production as they are.
 */
export type ShirtStyleId = 'tee' | 'sleeveless' | 'tank';

export interface ShirtStyleDef {
  id: ShirtStyleId;
  nameTh: string;
  art: ProductArtKind;
  /** front photo of the shirt (26 Nov 2026) */
  photo: string;
  /** null = use the event's real shirt stock */
  demoStock: ShirtStock[] | null;
}

export const SHIRT_STYLES: ShirtStyleDef[] = [
  { id: 'tee', nameTh: 'เสื้อแขนสั้น', art: 'tee', photo: SHIRT_PHOTOS.tee, demoStock: null },
  {
    id: 'sleeveless',
    nameTh: 'เสื้อแขนกุด',
    art: 'sleeveless',
    photo: SHIRT_PHOTOS.sleeveless,
    demoStock: [
      { size: 'S', total: 15, reservedOrConfirmed: 9 },
      { size: 'M', total: 20, reservedOrConfirmed: 11 },
      { size: 'L', total: 15, reservedOrConfirmed: 11 },
      { size: 'XL', total: 10, reservedOrConfirmed: 8 },
    ],
  },
  {
    id: 'tank',
    nameTh: 'เสื้อกล้าม',
    art: 'tank',
    photo: SHIRT_PHOTOS.tank,
    demoStock: [
      { size: 'S', total: 10, reservedOrConfirmed: 5 },
      { size: 'M', total: 12, reservedOrConfirmed: 5 },
      { size: 'L', total: 10, reservedOrConfirmed: 10 },
    ],
  },
];

export function shirtStyleName(id: ShirtStyleId): string {
  return SHIRT_STYLES.find((s) => s.id === id)?.nameTh ?? '';
}
