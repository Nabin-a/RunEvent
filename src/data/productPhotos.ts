/**
 * Product photos for souvenirs and registration shirts (26 Nov 2026, user request: use the
 * generated product images in place of the drawn art; one photo may serve several products).
 * A product is matched by its category and Thai/English name; no match keeps the drawn art.
 */
import tankHills from '../assets/products/tank-hills.webp';
import tankWave from '../assets/products/tank-wave.webp';
import tankOldTown from '../assets/products/tank-oldtown.webp';
import sleevelessSunrise from '../assets/products/sleeveless-sunrise.webp';
import sleevelessWave from '../assets/products/sleeveless-wave.webp';
import sleevelessOldTown from '../assets/products/sleeveless-oldtown.webp';
import tee from '../assets/products/tee.webp';
import longSleeve from '../assets/products/longsleeve.webp';
import medalElephant from '../assets/products/medal-elephant.webp';
import medalFrame from '../assets/products/medal-frame.webp';
import medalSet from '../assets/products/medal-set.webp';
import capTrail from '../assets/products/cap-trail.webp';
import capRun from '../assets/products/cap-run.webp';
import capHeritage from '../assets/products/cap-heritage.webp';
import visor from '../assets/products/visor.webp';
import tote from '../assets/products/tote.webp';
import belt from '../assets/products/belt.webp';
import armSleeves from '../assets/products/arm-sleeves.webp';
import armSleevesUv from '../assets/products/arm-sleeves-uv.webp';
import socks from '../assets/products/socks.webp';
import softFlask from '../assets/products/soft-flask.webp';
import bottle from '../assets/products/bottle.webp';
import coolingTowel from '../assets/products/cooling-towel.webp';
import beachTowel from '../assets/products/beach-towel.webp';
import teeBack from '../assets/products/tee-back.webp';
import tankHillsBack from '../assets/products/tank-hills-back.webp';
import sleevelessSunriseBack from '../assets/products/sleeveless-sunrise-back.webp';

/**
 * Back views of the shirts that have one (28 Nov 2026, user request: hovering a shirt shows its
 * back). A front photo with no entry here simply keeps showing its front.
 */
const BACKS = new Map<string, string>([
  [tee, teeBack],
  [tankHills, tankHillsBack],
  [sleevelessSunrise, sleevelessSunriseBack],
]);

/** the back view of a product photo, when there is one */
export function backPhotoOf(front: string | undefined): string | undefined {
  return front ? BACKS.get(front) : undefined;
}

/** shirts on the registration shirt step */
export const SHIRT_PHOTOS = {
  tee,
  sleeveless: sleevelessSunrise,
  tank: tankHills,
  longsleeve: longSleeve,
  tankWave,
  sleevelessOldTown,
  finisher: tee,
} as const;

/** the finisher medal shown on the shirt step of an event that gives a medal instead of a shirt */
export const FINISHER_MEDAL_PHOTO = medalElephant;

const seaside = /ทะเล|andaman|wave|breeze|beach|sunset|cape|promthep/i;
const oldTown = /old|moat|town|thalang|gate|ประตู|เมืองเก่า|heritage|sino|riverside|ping|night/i;

/** Photo for a souvenir, or undefined to keep the drawn art (e.g. headlamp, LED armband). */
export function souvenirPhoto(categoryLabel: string, nameTh: string): string | undefined {
  const n = nameTh;
  if (/ไฟคาดศีรษะ|headlamp|led|armband/i.test(n)) return undefined;
  if (categoryLabel === 'เหรียญที่ระลึก') {
    if (/กรอบ|ตั้งโต๊ะ|frame/i.test(n)) return medalFrame;
    if (/ช้าง|elephant/i.test(n)) return medalElephant;
    return medalSet;
  }
  if (categoryLabel === 'เสื้อที่ระลึก') {
    if (/แขนยาว|long sleeve/i.test(n)) return longSleeve;
    if (/กล้าม|singlet|tank/i.test(n)) return seaside.test(n) ? tankWave : oldTown.test(n) ? tankOldTown : tankHills;
    if (/แขนกุด|sleeveless/i.test(n)) {
      return seaside.test(n) ? sleevelessWave : oldTown.test(n) ? sleevelessOldTown : sleevelessSunrise;
    }
    return tee;
  }
  if (/ไวเซอร์|visor/i.test(n)) return visor;
  if (/หมวก|cap/i.test(n)) return oldTown.test(n) ? capHeritage : /trail|doi|ดอย/i.test(n) ? capTrail : capRun;
  if (/ถุงผ้า|tote/i.test(n)) return tote;
  if (/คาดเอว|belt/i.test(n)) return belt;
  if (/ปลอกแขน|sleeves/i.test(n)) return /uv|andaman/i.test(n) ? armSleevesUv : armSleeves;
  if (/ถุงเท้า|socks/i.test(n)) return socks;
  if (/พับได้|flask/i.test(n)) return softFlask;
  if (/กระบอกน้ำ|ขวดน้ำ|bottle/i.test(n)) return bottle;
  if (/ผ้าเย็น|cooling/i.test(n)) return coolingTowel;
  if (/ผ้าเช็ดตัว|towel/i.test(n)) return beachTowel;
  return undefined;
}
