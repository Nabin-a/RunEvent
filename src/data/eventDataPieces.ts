import type {
  EventCoreText,
  EventDataPieceOptions,
  EventDataSource,
  EventPageItem,
  RaceEvent,
} from '../types';

/**
 * Data pieces of the page editor (phase A, confirmed 24 Nov 2026): pieces that show the
 * event's business data read-only — prices, seats, shirt sizes, venue, contact, kit pickup,
 * souvenirs. The organizer only picks what to show; the values come live from the menus that
 * own them, so the page never holds a stale copy. A piece with nothing to show is left out of
 * the public page (the editor marks it instead).
 *
 * Also the editable text of the built-in blocks "about", "race pack" and "schedule"
 * (`EventCoreText`), with the defaults the page shows before the organizer edits anything.
 * Shared by the page, the editor and the server.
 */

export interface DataSourceDef {
  id: EventDataSource;
  label: string;
  icon: string;
  /** shown in the editor: which menu owns this data */
  menuLabel: string;
  /** organizer dashboard section that edits it */
  section: string;
  /** extra note when the data has no edit screen yet */
  note?: string;
  keywords: string;
}

export const DATA_SOURCES: DataSourceDef[] = [
  { id: 'categories', label: 'ระยะและค่าสมัคร', icon: 'person-running', menuLabel: 'ระยะ โควตา & คำถามสมัคร', section: 'evt_pricing_quota', keywords: 'categories price distance fee' },
  { id: 'quota', label: 'ที่นั่งคงเหลือ', icon: 'chair', menuLabel: 'ระยะ โควตา & คำถามสมัคร', section: 'evt_pricing_quota', keywords: 'quota seats remaining' },
  { id: 'register', label: 'ปุ่มสมัคร', icon: 'pen-to-square', menuLabel: 'สถานะงาน', section: 'evt_overview', keywords: 'register signup button cta' },
  { id: 'sizechart', label: 'ตารางไซส์เสื้อ', icon: 'shirt', menuLabel: 'ระยะ โควตา & คำถามสมัคร (สต็อกเสื้อ)', section: 'evt_pricing_quota', keywords: 'shirt size chart stock' },
  { id: 'venue', label: 'สถานที่และวันงาน', icon: 'location-dot', menuLabel: 'ข้อมูลงาน', section: 'evt_overview', note: 'ตั้งไว้ตอนสร้างงาน ยังไม่มีหน้าจอแก้', keywords: 'venue place date location' },
  { id: 'contact', label: 'ติดต่อผู้จัด', icon: 'address-card', menuLabel: 'ทีมและตั้งค่าองค์กร', section: 'org_team_settings', keywords: 'contact organizer email rules' },
  { id: 'kit', label: 'วันรับอุปกรณ์', icon: 'box-open', menuLabel: 'ข้อมูลงาน', section: 'evt_overview', note: 'ตั้งไว้ตอนสร้างงาน ยังไม่มีหน้าจอแก้', keywords: 'kit pickup bib expo shipping' },
  { id: 'products', label: 'สินค้าที่ระลึก', icon: 'bag-shopping', menuLabel: 'ร้านค้า & สินค้าของงานนี้', section: 'evt_storefront', keywords: 'souvenir merch products shop' },
];

export const DATA_SOURCE_IDS = DATA_SOURCES.map((d) => d.id);
export const dataSourceDef = (id: string | undefined) => DATA_SOURCES.find((d) => d.id === id);

/** what each data piece shows before the organizer changes anything */
export function defaultDataOptions(source: EventDataSource): EventDataPieceOptions {
  switch (source) {
    case 'categories':
      return { showAllTiers: true, showAge: true, layout: 'cards' };
    case 'quota':
      return { quotaMode: 'per-category', quotaStyle: 'number' };
    case 'sizechart':
      return { showStock: true };
    case 'venue':
      return { showDate: true };
    case 'contact':
      return { showRules: true };
    case 'products':
      return { productCount: 4 };
    default:
      return {};
  }
}

/** event data a piece can read (what the public page already receives) */
export type DataPieceEvent = Pick<
  RaceEvent,
  'categories' | 'shirtStocks' | 'venue' | 'province' | 'eventDate' | 'kitPickupWindow' | 'products' | 'totalEventQuota' | 'totalEventQuotaEnabled'
>;

/** does this data piece have anything to show for this event (else the public page leaves it out) */
export function dataPieceHasContent(event: DataPieceEvent, item: Pick<EventPageItem, 'source' | 'options'>): boolean {
  const o = item.options ?? {};
  const cats = o.categoryIds?.length ? event.categories.filter((c) => o.categoryIds?.includes(c.id)) : event.categories;
  switch (item.source) {
    case 'categories':
      return cats.length > 0;
    case 'quota':
      return o.quotaMode === 'total' ? event.totalEventQuotaEnabled !== false && event.totalEventQuota > 0 : cats.length > 0;
    case 'register':
      return event.categories.length > 0;
    case 'sizechart':
      return event.shirtStocks.length > 0;
    case 'venue':
      return !!event.venue?.trim();
    case 'contact':
      return true;
    case 'kit':
      return !!event.kitPickupWindow?.trim();
    case 'products':
      return event.products.length > 0;
    default:
      return false;
  }
}

/* ------------------------------------------------------------------ */
/* Text of the built-in blocks                                          */
/* ------------------------------------------------------------------ */

export const CORE_TEXT_LIMITS = {
  paragraphs: 8,
  paragraph: 1500,
  highlights: 10,
  highlight: 150,
  racepackItems: 12,
  racepackTitle: 120,
  racepackDetail: 400,
  racepackScope: 80,
  scheduleItems: 20,
  scheduleTime: 80,
  scheduleTitle: 160,
  scheduleDetail: 400,
};

type CoreTextEvent = Pick<
  RaceEvent,
  | 'titleTh'
  | 'titleEn'
  | 'venue'
  | 'province'
  | 'raceType'
  | 'overviewParagraphs'
  | 'highlights'
  | 'racePackItems'
  | 'scheduleItems'
  | 'editDeadlineDate'
  | 'kitPickupWindow'
  | 'eventDate'
  | 'categories'
>;

/** the text the page shows: the event's saved text, else the generated default */
export function coreTextOf(ev: CoreTextEvent): Required<EventCoreText> {
  return {
    about: {
      paragraphs:
        ev.overviewParagraphs && ev.overviewParagraphs.length > 0
          ? ev.overviewParagraphs
          : [
              `${ev.titleTh} (${ev.titleEn}) จัดขึ้น ณ ${ev.venue} จังหวัด${ev.province} ในรูปแบบ ${ev.raceType} โดยเน้นมาตรฐานความปลอดภัยของเส้นทาง การจัดการจุดปล่อยตัวตามรหัสสี BIB และความโปร่งใสของราคาค่าสมัครสุทธิ`,
            ],
      highlights: ev.highlights ?? [],
    },
    racepack: {
      items:
        ev.racePackItems && ev.racePackItems.length > 0
          ? ev.racePackItems
          : [
              {
                title: 'เสื้อวิ่งประจำงาน (Official Race Jersey)',
                detail: 'เนื้อผ้าไมโครโพลีเอสเตอร์ระบายอากาศ แห้งไว เลือกขนาด XS ถึง 2XL ได้ตามโควตาตอนสมัคร',
                scope: 'ผู้สมัครทุกระยะ',
              },
              {
                title: 'ป้ายหมายเลขแข่งขัน (BIB) พร้อม QR Token',
                detail: 'แยกสีตามระยะการแข่งขัน ใช้แสดงเพื่อรับอุปกรณ์ในวัน Expo และเข้าบล็อกปล่อยตัว',
                scope: 'ผู้สมัครทุกระยะ',
              },
              {
                title: 'เหรียญรางวัล Finisher',
                detail: 'มอบให้ผู้เข้าแข่งขันที่วิ่งผ่านจุดเช็กและเข้าเส้นชัยภายในเวลา Cut-off ของแต่ละระยะ',
                scope: 'ผู้เข้าเส้นชัยตามกติกา',
              },
              {
                title: 'ประกันอุบัติเหตุ & บริการจุดให้น้ำ-อาหารหลังเส้นชัย',
                detail: 'ดูแลความปลอดภัยด้วยทีมแพทย์เคลื่อนที่ จุดบริการน้ำดื่มตลอดเส้นทาง และอาหารว่างหลังเข้าเส้นชัย',
                scope: 'ผู้สมัครทุกคน',
              },
            ],
    },
    schedule: {
      items:
        ev.scheduleItems && ev.scheduleItems.length > 0
          ? ev.scheduleItems
          : [
              {
                timeLabel: `วันนี้ – ${ev.editDeadlineDate}`,
                title: 'ช่วงเวลาเปิดรับสมัครออนไลน์',
                detail: 'สมัครออนไลน์และรับ QR Token สำหรับรับอุปกรณ์ทันทีหลังชำระเงิน',
              },
              {
                timeLabel: ev.kitPickupWindow,
                title: 'วันรับเสื้อและป้าย BIB (Expo & Race Kit Pickup)',
                detail: `แสดง QR Token ที่จุดรับอุปกรณ์ ณ ${ev.venue} เพื่อรับเสื้อและป้าย BIB`,
              },
              ...ev.categories.map((c) => ({
                timeLabel: `${ev.eventDate} · ${c.startTimeLocal} น.`,
                title: `ปล่อยตัวระยะ ${c.name} (${c.code})`,
                detail: `รหัสหน้า BIB ${c.bibPrefix}-xxxx · เวลา Cut-off ${c.cutoffHours} ชั่วโมง`,
              })),
              {
                timeLabel: `${ev.eventDate} · หลังเข้าเส้นชัย`,
                title: 'รับเหรียญรางวัล Finisher และประกาศผลการแข่งขัน/อัลบั้มภาพ',
                detail: 'ตรวจสอบผลการแข่งขันและลิงก์อัลบั้มภาพถ่ายหลังงานที่ผู้จัดตรวจสอบแล้วผ่านหน้าเว็บนี้',
              },
            ],
    },
  };
}

/** the page draft's text where it has some, else the event's (draft wins block by block) */
export function mergedCoreText(ev: CoreTextEvent, draft?: EventCoreText): Required<EventCoreText> {
  const base = coreTextOf(ev);
  return {
    about: draft?.about ?? base.about,
    racepack: draft?.racepack ?? base.racepack,
    schedule: draft?.schedule ?? base.schedule,
  };
}
