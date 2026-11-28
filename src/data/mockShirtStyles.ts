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
export type ShirtStyleId = 'tee' | 'sleeveless' | 'tank' | 'longsleeve' | 'tank-wave' | 'sleeveless-oldtown';

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
  /* three more styles (28 Nov 2026, user request: more than three shirt types in the details step,
     to review the sideways style row); demo stock like the two above */
  {
    id: 'longsleeve',
    nameTh: 'เสื้อแขนยาว',
    art: 'tee',
    photo: SHIRT_PHOTOS.longsleeve,
    demoStock: [
      { size: 'S', total: 8, reservedOrConfirmed: 3 },
      { size: 'M', total: 12, reservedOrConfirmed: 6 },
      { size: 'L', total: 10, reservedOrConfirmed: 4 },
      { size: 'XL', total: 6, reservedOrConfirmed: 2 },
    ],
  },
  {
    id: 'tank-wave',
    nameTh: 'เสื้อกล้าม ลายทะเล',
    art: 'tank',
    photo: SHIRT_PHOTOS.tankWave,
    demoStock: [
      { size: 'XS', total: 6, reservedOrConfirmed: 2 },
      { size: 'S', total: 10, reservedOrConfirmed: 4 },
      { size: 'M', total: 12, reservedOrConfirmed: 7 },
      { size: 'L', total: 8, reservedOrConfirmed: 3 },
    ],
  },
  {
    id: 'sleeveless-oldtown',
    nameTh: 'เสื้อแขนกุด ลายเมืองเก่า',
    art: 'sleeveless',
    photo: SHIRT_PHOTOS.sleevelessOldTown,
    demoStock: [
      { size: 'S', total: 10, reservedOrConfirmed: 6 },
      { size: 'M', total: 14, reservedOrConfirmed: 9 },
      { size: 'L', total: 10, reservedOrConfirmed: 5 },
      { size: 'XL', total: 6, reservedOrConfirmed: 6 },
    ],
  },
];

export function shirtStyleName(id: ShirtStyleId): string {
  return SHIRT_STYLES.find((s) => s.id === id)?.nameTh ?? '';
}
