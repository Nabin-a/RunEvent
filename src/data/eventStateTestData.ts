import type { RaceCategory, RaceEvent } from '../types';
import { todayIsoInTimeZone } from '../utils/age';

/*
 * Test data (27 Nov 2026, user request "เพิ่มงาน/แก้ไขงานเดิม ให้มีสถานะครบตามตัวอย่าง"): one
 * fictional event per runner-facing state that the existing events do not already show, so every
 * state of output/event-status-mockup can be seen in the app.
 *
 * Dates are counted from the day the data is loaded (Bangkok), so on that day each event sits in
 * its state. They are written to the database once; as days pass the events move on through the
 * states (a race-day event becomes "รอประกาศผล", and so on). Reset the local database to start
 * over (docs/run-local-guide.md).
 *
 * States already shown by existing events: เปิดรับสมัคร (ดอยสุเทพ), บางระยะเต็ม (สุโขทัย),
 * เลื่อนงาน (แหลมพรหมเทพ), ประกาศผลแล้ว (คูเมือง), ระงับชั่วคราว (แม่ริม).
 */

const TODAY = todayIsoInTimeZone();

/** YYYY-MM-DD shifted by whole days */
export function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
const day = (n: number) => shiftDays(TODAY, n);
const thaiDay = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`)
  );

interface StateEventSpec {
  key: string;
  code: string;
  organizationId: string;
  titleTh: string;
  titleEn: string;
  tagline: string;
  province: string;
  region: RaceEvent['region'];
  venue: string;
  coverMotif: RaceEvent['coverMotif'];
  raceType?: RaceEvent['raceType'];
  status: RaceEvent['status'];
  statusNote?: string;
  eventIn: number;
  salesFrom: number;
  salesTo: number;
  kitFrom: number;
  kitTo?: number;
  quotas: [number, number];
  totalQuota?: number;
  formHidden?: boolean;
  /** an existing event's cover picture, reused (27 Nov 2026, user request) */
  cover: string;
}

function category(spec: StateEventSpec, i: 0 | 1): RaceCategory {
  const k = i === 0 ? '10k' : '5k';
  return {
    id: `cat-${spec.key}-${k}`,
    code: i === 0 ? '10 km' : '5 km',
    name: i === 0 ? 'City 10.0 กม.' : 'Fun Run 5.0 กม.',
    distanceKm: i === 0 ? 10 : 5,
    startTimeLocal: i === 0 ? '05:30' : '06:00',
    cutoffHours: i === 0 ? 2 : 1.5,
    categoryQuota: spec.quotas[i],
    bibPrefix: i === 0 ? 'S' : 'F',
    colorTag: i === 0 ? 'navy' : 'forest',
    priceTiers: [
      {
        id: `tier-${spec.key}-${k}`,
        label: 'Regular',
        priceSatang: i === 0 ? 59000 : 39000,
        startsAt: day(spec.salesFrom),
        endsAt: day(spec.salesTo),
        isCurrent: true,
      },
    ],
  };
}

function stateEvent(spec: StateEventSpec): RaceEvent {
  const kitFrom = day(spec.kitFrom);
  const kitTo = day(spec.kitTo ?? spec.kitFrom);
  return {
    id: `evt-state-${spec.key}`,
    code: spec.code,
    organizationId: spec.organizationId,
    titleTh: spec.titleTh,
    titleEn: spec.titleEn,
    tagline: spec.tagline,
    coverMotif: spec.coverMotif,
    coverImageUrl: `/event-covers/${spec.cover}.webp`,
    coverImageAlt: 'ภาพแบนเนอร์ประกอบงานวิ่ง',
    province: spec.province,
    region: spec.region,
    venue: spec.venue,
    eventDate: day(spec.eventIn),
    timezone: 'Asia/Bangkok',
    raceType: spec.raceType ?? 'Road Race',
    status: spec.status,
    statusNote: spec.statusNote,
    totalEventQuota: spec.totalQuota ?? spec.quotas[0] + spec.quotas[1],
    totalEventQuotaEnabled: spec.totalQuota !== undefined,
    feeBearerPolicy: 'runner_pays',
    editDeadlineDate: day(spec.salesTo),
    rulesVersion: 'v1.0',
    kitPickupWindow:
      kitFrom === kitTo
        ? `${thaiDay(kitFrom)} เวลา 11:00–19:00 น. ณ จุดรับอุปกรณ์ของงาน`
        : `${thaiDay(kitFrom)} – ${thaiDay(kitTo)} เวลา 11:00–19:00 น. ณ จุดรับอุปกรณ์ของงาน`,
    kitPickupFrom: kitFrom,
    kitPickupTo: kitTo,
    ...(spec.formHidden ? { formHidden: { at: `${TODAY}T08:00:00+07:00`, by: 'ทีมผู้จัด' } } : {}),
    highlights: ['ปล่อยตัว 05:30 น.', 'เสื้อวิ่งตามสิทธิ์สมัคร', 'เหรียญ Finisher ทุกระยะ'],
    categories: [category(spec, 0), category(spec, 1)],
    shirtStocks: [
      { size: 'S', total: 40, reservedOrConfirmed: 0 },
      { size: 'M', total: 40, reservedOrConfirmed: 0 },
      { size: 'L', total: 30, reservedOrConfirmed: 0 },
      { size: 'XL', total: 20, reservedOrConfirmed: 0 },
    ],
    products: [],
    readinessChecks: [
      { id: `chk-${spec.key}-1`, label: 'ผ่านการตรวจสอบความพร้อมเปิดรับสมัครครบทุกข้อ', passed: true, fixTargetHint: 'พร้อมขาย' },
    ],
  } as RaceEvent;
}

const SPECS: StateEventSpec[] = [
  {
    key: 'announced', cover: 'evt-oldmoat-2026', code: 'EVT-LPG-2701', organizationId: 'org-lanna',
    titleTh: 'ลำปาง รถม้า ฮาล์ฟรัน 2027', titleEn: 'Lampang Carriage Run 2027',
    tagline: 'วิ่งผ่านย่านรถม้าและสะพานรัษฎาภิเศก', province: 'ลำปาง', region: 'เหนือ',
    venue: 'ลานหน้าสถานีรถไฟนครลำปาง', coverMotif: 'heritage', status: 'published',
    eventIn: 110, salesFrom: 20, salesTo: 95, kitFrom: 109, quotas: [60, 60],
  },
  {
    key: 'closing', cover: 'evt-doisuthep-2026', code: 'EVT-CRI-2601', organizationId: 'org-lanna',
    titleTh: 'เชียงราย ไร่ชา รัน 2026', titleEn: 'Chiang Rai Tea Hill Run 2026',
    tagline: 'วิ่งขึ้นเนินไร่ชายามเช้ามีหมอก', province: 'เชียงราย', region: 'เหนือ',
    venue: 'ไร่ชาฉุยฟง อ.แม่จัน', coverMotif: 'mountain', status: 'published',
    eventIn: 30, salesFrom: -60, salesTo: 2, kitFrom: 29, quotas: [80, 80],
  },
  {
    key: 'almost', cover: 'evt-oldmoat-2026', code: 'EVT-KKN-2601', organizationId: 'org-andaman',
    titleTh: 'ขอนแก่น บึงแก่นนคร ไนท์รัน 2026', titleEn: 'Khon Kaen Lake Night Run 2026',
    tagline: 'วิ่งรอบบึงแก่นนครใต้แสงไฟยามค่ำ', province: 'ขอนแก่น', region: 'อีสาน',
    venue: 'บึงแก่นนคร อ.เมืองขอนแก่น', coverMotif: 'river', status: 'published',
    eventIn: 40, salesFrom: -30, salesTo: 30, kitFrom: 39, quotas: [10, 10], totalQuota: 10,
  },
  {
    key: 'full', cover: 'evt-promthep-2026', code: 'EVT-HHN-2601', organizationId: 'org-andaman',
    titleTh: 'หัวหิน บีช 10K 2026', titleEn: 'Hua Hin Beach 10K 2026',
    tagline: 'วิ่งเลียบชายหาดหัวหินตอนพระอาทิตย์ขึ้น', province: 'ประจวบคีรีขันธ์', region: 'กลางและกรุงเทพฯ',
    venue: 'ชายหาดหัวหิน หน้าโรงแรมรถไฟ', coverMotif: 'coast', status: 'published',
    eventIn: 35, salesFrom: -45, salesTo: 25, kitFrom: 34, quotas: [2, 1],
  },
  {
    key: 'paused', cover: 'evt-doisuthep-2026', code: 'EVT-UBN-2701', organizationId: 'org-andaman',
    titleTh: 'อุบล ริมมูล รัน 2027', titleEn: 'Ubon Moon River Run 2027',
    tagline: 'วิ่งเลียบแม่น้ำมูลยามเช้า', province: 'อุบลราชธานี', region: 'อีสาน',
    venue: 'หาดคูเดื่อ อ.เมืองอุบลราชธานี', coverMotif: 'river', status: 'published',
    eventIn: 60, salesFrom: -20, salesTo: 45, kitFrom: 59, quotas: [60, 60], formHidden: true,
  },
  {
    key: 'closed', cover: 'evt-promthep-2026', code: 'EVT-RYG-2601', organizationId: 'org-andaman',
    titleTh: 'ระยอง เสม็ด ซีวิว รัน 2026', titleEn: 'Rayong Samet Seaview Run 2026',
    tagline: 'วิ่งริมทะเลบ้านเพ มองเห็นเกาะเสม็ด', province: 'ระยอง', region: 'ตะวันออก',
    venue: 'ท่าเรือบ้านเพ อ.เมืองระยอง', coverMotif: 'coast', status: 'closed',
    eventIn: 12, salesFrom: -70, salesTo: -5, kitFrom: 11, quotas: [80, 80],
  },
  {
    key: 'kit', cover: 'evt-oldmoat-2026', code: 'EVT-BKK-2601', organizationId: 'org-andaman',
    titleTh: 'กรุงเทพ สวนลุม มอร์นิ่งรัน 2026', titleEn: 'Bangkok Lumphini Morning Run 2026',
    tagline: 'วิ่งรอบสวนลุมพินีก่อนเมืองตื่น', province: 'กรุงเทพมหานคร', region: 'กลางและกรุงเทพฯ',
    venue: 'สวนลุมพินี เขตปทุมวัน', coverMotif: 'heritage', status: 'closed',
    eventIn: 2, salesFrom: -60, salesTo: -4, kitFrom: -1, kitTo: 1, quotas: [100, 100],
  },
  {
    key: 'raceday', cover: 'evt-doisuthep-2026', code: 'EVT-PLK-2601', organizationId: 'org-lanna',
    titleTh: 'พิษณุโลก ริมน่าน มินิมาราธอน 2026', titleEn: 'Phitsanulok Riverside Mini Marathon 2026',
    tagline: 'วิ่งเลียบแม่น้ำน่านผ่านวัดใหญ่', province: 'พิษณุโลก', region: 'เหนือ',
    venue: 'ลานหน้าวัดพระศรีรัตนมหาธาตุ', coverMotif: 'river', status: 'closed',
    eventIn: 0, salesFrom: -60, salesTo: -6, kitFrom: -1, quotas: [100, 100],
  },
  {
    key: 'pending', cover: 'evt-promthep-2026', code: 'EVT-TRG-2601', organizationId: 'org-andaman',
    titleTh: 'ตรัง อันดามัน ฮาล์ฟ 2026', titleEn: 'Trang Andaman Half 2026',
    tagline: 'วิ่งผ่านสวนยางและชายหาดปากเมง', province: 'ตรัง', region: 'ใต้',
    venue: 'หาดปากเมง อ.สิเกา', coverMotif: 'coast', status: 'closed',
    eventIn: -2, salesFrom: -70, salesTo: -10, kitFrom: -3, quotas: [100, 100],
  },
  {
    key: 'cancelled', cover: 'evt-maerim-suspended', code: 'EVT-KYI-2601', organizationId: 'org-andaman',
    titleTh: 'เขาใหญ่ เทรล 2026', titleEn: 'Khao Yai Trail 2026', raceType: 'Trail',
    tagline: 'เทรลผ่านทุ่งหญ้าและป่าดิบแล้งเชิงเขาใหญ่', province: 'นครราชสีมา', region: 'อีสาน',
    venue: 'ลานกิจกรรม อ.ปากช่อง', coverMotif: 'trail', status: 'cancelled',
    statusNote: 'ยกเลิกงานเพราะพื้นที่ปิดเส้นทางจากน้ำป่า คืนค่าสมัครเต็มจำนวนให้ผู้สมัครทุกคนอัตโนมัติ',
    eventIn: 20, salesFrom: -50, salesTo: 5, kitFrom: 19, quotas: [60, 60],
  },
];

export const STATE_TEST_EVENTS: RaceEvent[] = SPECS.map(stateEvent);

/** seats taken in the "almost full" and "full" events, by fictional runners */
export const STATE_TEST_SEAT_FILLERS: { eventKey: string; cat: '10k' | '5k'; count: number }[] = [
  { eventKey: 'almost', cat: '10k', count: 9 },
  { eventKey: 'full', cat: '10k', count: 2 },
  { eventKey: 'full', cat: '5k', count: 1 },
];

/** USR-901's own entries, so the history page shows these states too */
export const STATE_TEST_RUNNER_ENTRIES: { eventId: string; catId: string; key: string }[] = [
  { eventId: 'evt-state-kit', catId: 'cat-kit-10k', key: 'kit' },
  { eventId: 'evt-state-raceday', catId: 'cat-raceday-10k', key: 'raceday' },
  { eventId: 'evt-state-pending', catId: 'cat-pending-10k', key: 'pending' },
  { eventId: 'evt-state-closed', catId: 'cat-closed-10k', key: 'closed' },
  { eventId: 'evt-state-cancelled', catId: 'cat-cancelled-10k', key: 'cancelled' },
  { eventId: 'evt-promthep-2026', catId: 'cat-pk-10k', key: 'postponed' },
];

export const STATE_TEST_TODAY = TODAY;
