import type {
  LoginHistoryEntry,
  PlatformProfileConfig,
  PlatformShirtSizeOption,
  RaceResultSnapshot,
  RunnerAchievement,
  RunnerNotificationPrefs,
  RunnerProfileData,
  RunnerSocialLinks,
  ShirtCutType,
  ShirtSizeMeasurement,
  UserAccount,
} from '../types';
import { FEATURES } from '../config/features';

export const DEFAULT_SHIRT_SIZES: PlatformShirtSizeOption[] = [
  {
    code: 'XS',
    label: 'XS',
    enabled: true,
    sortOrder: 1,
    chartByType: {
      Unisex: { chestInch: '36 นิ้ว', lengthInch: '25 นิ้ว' },
      Men: { chestInch: '36 นิ้ว', lengthInch: '25.5 นิ้ว' },
      Women: { chestInch: '33 นิ้ว', lengthInch: '23.5 นิ้ว' },
    },
  },
  {
    code: 'S',
    label: 'S',
    enabled: true,
    sortOrder: 2,
    chartByType: {
      Unisex: { chestInch: '38 นิ้ว', lengthInch: '26 นิ้ว' },
      Men: { chestInch: '38 นิ้ว', lengthInch: '26.5 นิ้ว' },
      Women: { chestInch: '35 นิ้ว', lengthInch: '24.5 นิ้ว' },
    },
  },
  {
    code: 'M',
    label: 'M',
    enabled: true,
    sortOrder: 3,
    chartByType: {
      Unisex: { chestInch: '40 นิ้ว', lengthInch: '27 นิ้ว' },
      Men: { chestInch: '40 นิ้ว', lengthInch: '27.5 นิ้ว' },
      Women: { chestInch: '37 นิ้ว', lengthInch: '25.5 นิ้ว' },
    },
  },
  {
    code: 'L',
    label: 'L',
    enabled: true,
    sortOrder: 4,
    chartByType: {
      Unisex: { chestInch: '42 นิ้ว', lengthInch: '28 นิ้ว' },
      Men: { chestInch: '42 นิ้ว', lengthInch: '28.5 นิ้ว' },
      Women: { chestInch: '39 นิ้ว', lengthInch: '26.5 นิ้ว' },
    },
  },
  {
    code: 'XL',
    label: 'XL',
    enabled: true,
    sortOrder: 5,
    chartByType: {
      Unisex: { chestInch: '44 นิ้ว', lengthInch: '29 นิ้ว' },
      Men: { chestInch: '44 นิ้ว', lengthInch: '29.5 นิ้ว' },
      Women: { chestInch: '41 นิ้ว', lengthInch: '27 นิ้ว' },
    },
  },
  {
    code: '2XL',
    label: '2XL',
    enabled: true,
    sortOrder: 6,
    chartByType: {
      Unisex: { chestInch: '46 นิ้ว', lengthInch: '30 นิ้ว' },
      Men: { chestInch: '46 นิ้ว', lengthInch: '30.5 นิ้ว' },
      Women: { chestInch: '43 นิ้ว', lengthInch: '27.5 นิ้ว' },
    },
  },
  {
    code: '3XL',
    label: '3XL',
    enabled: true,
    sortOrder: 7,
    chartByType: {
      Unisex: { chestInch: '48 นิ้ว', lengthInch: '31 นิ้ว' },
      Men: { chestInch: '48 นิ้ว', lengthInch: '31.5 นิ้ว' },
      Women: { chestInch: '45 นิ้ว', lengthInch: '28 นิ้ว' },
    },
  },
  {
    code: '4XL',
    label: '4XL',
    enabled: true,
    sortOrder: 8,
    chartByType: {
      Unisex: { chestInch: '50 นิ้ว', lengthInch: '31.5 นิ้ว' },
      Men: { chestInch: '50 นิ้ว', lengthInch: '32 นิ้ว' },
      Women: { chestInch: '47 นิ้ว', lengthInch: '28.5 นิ้ว' },
    },
  },
  {
    code: '5XL',
    label: '5XL',
    enabled: true,
    sortOrder: 9,
    chartByType: {
      Unisex: { chestInch: '52 นิ้ว', lengthInch: '32 นิ้ว' },
      Men: { chestInch: '52 นิ้ว', lengthInch: '32.5 นิ้ว' },
      Women: { chestInch: '49 นิ้ว', lengthInch: '29 นิ้ว' },
    },
  },
];

export const DEFAULT_PLATFORM_PROFILE_CONFIG: PlatformProfileConfig = {
  shirtSizes: DEFAULT_SHIRT_SIZES,
  requiredProfileSections: [
    'personal',
    'contact',
    'emergency',
    'address',
  ],
  distanceOptions: [
    '3 KM',
    '5 KM',
    '10 KM',
    '21 KM',
    '42 KM',
    'Ultra Marathon',
  ],
  runningTypeOptions: [
    'Road Race',
    'Trail Run',
    'City Fun Run',
    'Night Run',
    'Virtual Run',
  ],
};

export const DEFAULT_NOTIFICATION_PREFS: RunnerNotificationPrefs = {
  emailNotification: true,
  smsNotification: false,
  eventUpdates: true,
  registrationConfirmation: true,
  paymentConfirmation: true,
  raceReminder: true,
  raceResultAnnouncement: true,
  marketingPromotion: false,
};

export const SEEDED_RUNNER_901_PROFILE: RunnerProfileData = {
  firstName: 'กานต์พิชชา',
  lastName: 'วัฒนากูล',
  nickname: 'กานต์',
  firstNameEn: 'Kanpitcha',
  lastNameEn: 'Wattanakul',
  nicknameEn: 'Kan',
  dateOfBirth: '1994-05-14',
  gender: 'หญิง',
  phone: '081-442-9910',
  phoneVerified: true,
  nationality: 'Thailand',
  idType: 'thai_id',
  idNumber: '1509900442108',
  country: 'Thailand',
  province: 'เชียงใหม่',
  district: 'เมืองเชียงใหม่',
  subdistrict: 'สุเทพ',
  postalCode: '50200',
  address: '199/8 ถ.ห้วยแก้ว หมู่บ้านล้านนาวิว',
  preferredShirtSize: 'M',
  preferredShirtType: 'Women',
  preferredShirtFit: 'Regular Fit',
  preferredDistances: ['10 KM', '21 KM'],
  preferredRunningTypes: ['Road Race', 'Trail Run'],
  runningGoal: 'จบ Half Marathon ดอยสุเทพต่ำกว่า 2 ชั่วโมง 15 นาที',
  favoriteEventIds: ['evt-doisuthep-2026', 'evt-oldmoat-2026'],
  runningExperience: 'Intermediate',
  emergencyContactName: 'วีระ วัฒนากูล',
  emergencyContactRelation: 'บิดา',
  emergencyContactPhone: '089-110-2211',
  emergencyContacts: [
    {
      id: 'ec-901-1',
      contactName: 'วีระ วัฒนากูล',
      relationship: 'บิดา',
      phone: '089-110-2211',
      email: 'weera.family@demo.local',
      isPrimary: true,
    },
    {
      id: 'ec-901-2',
      contactName: 'ปวีณา วัฒนากูล',
      relationship: 'มารดา',
      phone: '089-220-3344',
      isPrimary: false,
    },
  ],
  savedAddresses: [
    {
      id: 'addr-901-1',
      addressName: 'บ้านพักเชียงใหม่',
      recipientName: 'กานต์พิชชา วัฒนากูล',
      phone: '081-442-9910',
      address: '199/8 ถ.ห้วยแก้ว หมู่บ้านล้านนาวิว',
      province: 'เชียงใหม่',
      district: 'เมืองเชียงใหม่',
      subdistrict: 'สุเทพ',
      postalCode: '50200',
      country: 'Thailand',
      isDefault: true,
    },
    {
      id: 'addr-901-2',
      addressName: 'ออฟฟิศนิมมานฯ',
      recipientName: 'กานต์พิชชา วัฒนากูล',
      phone: '081-442-9910',
      address: '88 อาคารแคมปัส ชั้น 4 ถ.นิมมานเหมินท์ ซอย 9',
      province: 'เชียงใหม่',
      district: 'เมืองเชียงใหม่',
      subdistrict: 'สุเทพ',
      postalCode: '50200',
      country: 'Thailand',
      isDefault: false,
    },
  ],
  savedParticipants: [
    {
      id: 'sp-901-1',
      firstName: 'ภาคิน',
      lastName: 'วัฒนากูล',
      nickname: 'คิน',
      firstNameEn: 'Phakin',
      lastNameEn: 'Wattanakul',
      nicknameEn: 'Kin',
      dateOfBirth: '1997-08-22',
      gender: 'ชาย',
      nationality: 'Thailand',
      idType: 'thai_id',
      idNumber: '1509900773214',
      phone: '086-319-4420',
      preferredShirtSize: 'L',
      emergencyContactName: 'วีระ วัฒนากูล',
      emergencyContactRelation: 'บิดา',
      emergencyContactPhone: '089-110-2211',
      relationshipToOwner: 'น้องชาย',
      lastUsedAt: '2026-11-10T09:15:00.000Z',
    },
    {
      id: 'sp-901-2',
      firstName: '',
      lastName: '',
      firstNameEn: 'Elena',
      lastNameEn: 'Sato',
      nicknameEn: 'Lena',
      dateOfBirth: '1995-11-03',
      gender: 'หญิง',
      nationality: 'Japan',
      idType: 'passport',
      idNumber: 'TK8849201',
      phone: '092-745-8812',
      preferredShirtSize: 'S',
      emergencyContactName: 'Kenji Sato',
      emergencyContactRelation: 'คู่สมรส',
      emergencyContactPhone: '092-745-8819',
      relationshipToOwner: 'เพื่อนร่วมทีมวิ่ง',
      lastUsedAt: '2026-11-14T18:30:00.000Z',
    },
  ],
  socialLinks: {
    facebook: 'https://facebook.com/kanpitcha.runs',
    instagram: 'https://instagram.com/kanpitcha.run',
    strava: 'https://strava.com/athletes/901882',
    website: '',
    otherLinks: [],
  },
  notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
};

export const SEEDED_RUNNER_901_ACHIEVEMENTS: RunnerAchievement[] = [
  {
    id: 'ach-901-01',
    title: 'Official 10K Finisher — เชียงใหม่ คูเมือง คลาสสิก',
    eventId: 'evt-oldmoat-2026',
    eventNameTh: 'เชียงใหม่ คูเมือง คลาสสิก 10K 2026',
    achievementType: 'Finisher',
    achievementDate: '2026-10-25',
    medalOrAward: 'เหรียญรางวัล Finisher โลหะหล่อ 3 มิติ',
    certificateCode: 'CERT-CMI2510-B0214',
    distanceKm: 10,
    finishTime: '00:54:18',
  },
  {
    id: 'ach-901-02',
    title: 'Top 15% Age Group (F 30–39) — 10 KM Road Race',
    eventId: 'evt-oldmoat-2026',
    eventNameTh: 'เชียงใหม่ คูเมือง คลาสสิก 10K 2026',
    achievementType: 'Personal Best',
    achievementDate: '2026-10-25',
    medalOrAward: 'สถิติเวลา Chip Time 00:54:18 (Pace 5:26 /km)',
    certificateCode: 'CERT-CMI2510-B0214',
    distanceKm: 10,
    finishTime: '00:54:18',
  },
];

export const SEEDED_OLDMOAT_RACE_RESULT: RaceResultSnapshot = {
  gunTime: '00:54:42',
  chipTime: '00:54:18',
  paceMinPerKm: '5:26 /km',
  overallRank: '68 / 420',
  categoryRank: '12 / 118 (หญิง 30–39)',
  status: 'Finisher',
  certificateCode: 'CERT-CMI2510-B0214',
  verifiedAt: '2026-10-25 10:30',
};

export const SEEDED_RUNNER_901_LOGIN_HISTORY: LoginHistoryEntry[] = [
  {
    id: 'lh-901-1',
    timestamp: '2026-11-18 09:15',
    method: 'Email + Password',
    deviceLabel: 'Chrome บน Windows (อุปกรณ์ปัจจุบัน)',
    ipOrLocation: 'เชียงใหม่, ไทย',
    status: 'success',
  },
  {
    id: 'lh-901-2',
    timestamp: '2026-11-16 20:40',
    method: 'Google OAuth',
    deviceLabel: 'Safari บน iPhone 16',
    ipOrLocation: 'เชียงใหม่, ไทย',
    status: 'success',
  },
];

export function resolveShirtSpec(
  sizeCode: string,
  shirtType: ShirtCutType = 'Unisex',
  platformSizes: PlatformShirtSizeOption[] = DEFAULT_SHIRT_SIZES,
  eventCustomChart?: Record<string, ShirtSizeMeasurement>
): ShirtSizeMeasurement {
  if (eventCustomChart && eventCustomChart[sizeCode]) {
    return eventCustomChart[sizeCode];
  }
  const found = platformSizes.find((s) => s.code === sizeCode);
  if (found) {
    return found.chartByType[shirtType] ?? found.chartByType.Unisex;
  }
  return { chestInch: '40 นิ้ว', lengthInch: '27 นิ้ว' };
}

export type PersonalInfoCompletionKey =
  | 'name_en'
  | 'name_th'
  | 'dob'
  | 'gender'
  | 'nationality'
  | 'phone'
  | 'email'
  | 'identity'
  | 'address'
  | 'emergency_contact'
  | 'shipping_address';

export interface PersonalInfoCompletionItem {
  key: PersonalInfoCompletionKey;
  /** Thai source label (translated at render time with tx). */
  labelTh: string;
  complete: boolean;
  /** CSS selector of the field to focus inside the "ข้อมูลส่วนตัว" tab. */
  /** CSS selector of the field to focus; "a|b" tries a first, then b (e.g. when a is hidden). */
  focusSelector: string;
  /** profile menu that holds the item when it is not on the personal tab */
  tab?: 'emergency' | 'addresses';
}

export interface PersonalInfoCompletionSummary {
  pct: number;
  /** red / amber / green band of the percentage */
  tone: CompletionTone;
  completedCount: number;
  total: number;
  isComplete: boolean;
  items: PersonalInfoCompletionItem[];
}

const hasText = (v: string | null | undefined): boolean => Boolean(v && v.trim());

/**
 * Profile completion (25 Nov 2026, user request): the nine saved fields of the
 * "ข้อมูลส่วนตัว" (personal) tab, plus at least one emergency contact and at least one
 * saved shipping address (11 items). Optional fields (avatar, nicknames) are not counted.
 */
/** Most emergency contacts one runner profile may keep (checked in the UI and by the API). */
/**
 * Most emergency contacts one runner profile may keep (checked in the UI and by the API).
 * 10 since 25 Nov 2026 (user request); the number is not shown on the page, only a message
 * when someone tries to add one more.
 */
export const MAX_EMERGENCY_CONTACTS = 10;

export function evaluatePersonalInfoCompletion(
  user: UserAccount
): PersonalInfoCompletionSummary {
  const p = user.runnerProfile ?? {};

  // Mirror the personal form's fallback: names saved on the account itself count.
  const thParts = (user.fullNameTh ?? '').trim().split(/\s+/).filter(Boolean);
  const enParts = /^[A-Za-z.\s-]+$/.test(user.fullNameEn ?? '')
    ? (user.fullNameEn ?? '').trim().split(/\s+/).filter(Boolean)
    : [];
  const firstNameEn = p.firstNameEn ?? enParts[0] ?? '';
  const lastNameEn = p.lastNameEn ?? enParts.slice(1).join(' ');
  const firstNameTh = p.firstName ?? thParts[0] ?? '';
  const lastNameTh = p.lastName ?? thParts.slice(1).join(' ');

  const idType = p.idType && p.idType !== 'none' ? p.idType : 'thai_id';
  const idDigits = (p.idNumber ?? '').replace(/\D/g, '');
  const identityComplete =
    idType === 'thai_id' ? idDigits.length === 13 : hasText(p.idNumber);

  const items: PersonalInfoCompletionItem[] = [
    {
      key: 'name_en',
      labelTh: 'ชื่อ-นามสกุล (ภาษาอังกฤษ)',
      complete: hasText(firstNameEn) && hasText(lastNameEn),
      focusSelector: '#rp-fnen',
    },
    {
      key: 'name_th',
      labelTh: 'ชื่อ-นามสกุล (ภาษาไทย)',
      complete: hasText(firstNameTh) && hasText(lastNameTh),
      focusSelector: '#rp-fn',
    },
    {
      key: 'dob',
      labelTh: 'วันเกิด',
      complete: hasText(p.dateOfBirth),
      focusSelector: '#rp-dob',
    },
    {
      key: 'gender',
      labelTh: 'เพศ',
      complete: p.gender === 'ชาย' || p.gender === 'หญิง',
      focusSelector: 'input[name="profile-gender"]',
    },
    {
      key: 'nationality',
      labelTh: 'สัญชาติ',
      // The personal form pre-fills "Thailand" when nothing is saved yet, so the
      // meter mirrors what the runner sees instead of flagging a filled field.
      complete: hasText(p.nationality ?? 'Thailand'),
      focusSelector: '#rp-nat',
    },
    {
      key: 'phone',
      labelTh: 'เบอร์โทรศัพท์',
      complete: (p.phone ?? '').replace(/\D/g, '').length >= 9,
      focusSelector: '#rp-phone',
    },
    {
      key: 'email',
      labelTh: FEATURES.emailVerification ? 'อีเมลที่ยืนยันแล้ว' : 'อีเมลติดต่อ',
      complete:
        hasText(user.contactEmail) &&
        (!FEATURES.emailVerification || Boolean(user.emailVerified)),
      focusSelector: '#rp-email',
    },
    {
      key: 'identity',
      labelTh: 'เอกสารระบุตัวตน',
      complete: identityComplete,
      focusSelector: '#rp-idn|#rp-idt',
    },
    {
      key: 'address',
      labelTh: 'ที่อยู่ปัจจุบัน',
      complete:
        hasText(p.address) &&
        hasText(p.postalCode) &&
        hasText(p.subdistrict) &&
        hasText(p.district) &&
        hasText(p.province),
      focusSelector: '#rp-res-addr',
    },
    {
      key: 'shipping_address',
      labelTh: 'ที่อยู่จัดส่ง',
      complete: (p.savedAddresses ?? []).length > 0,
      focusSelector: '',
      tab: 'addresses',
    },
    {
      key: 'emergency_contact',
      labelTh: 'ผู้ติดต่อฉุกเฉิน',
      complete:
        (p.emergencyContacts ?? []).length > 0 ||
        (hasText(p.emergencyContactName) && hasText(p.emergencyContactPhone)),
      focusSelector: '',
      tab: 'emergency',
    },
  ];

  const completedCount = items.filter((i) => i.complete).length;
  const total = items.length;
  const pct = Math.round((completedCount / total) * 100);
  return {
    pct,
    completedCount,
    total,
    isComplete: completedCount === total,
    tone: completionTone(pct),
    items,
  };
}

/**
 * Colour of the completion ring (25 Nov 2026, user request): red under 50 %, amber from
 * 50 % up to 84 %, green from 85 % (10 of 11 items) up.
 */
export type CompletionTone = 'low' | 'mid' | 'high';
export const completionTone = (pct: number): CompletionTone =>
  pct >= 85 ? 'high' : pct >= 50 ? 'mid' : 'low';

export function deriveProviderSocialHandle(
  provider: 'facebook' | 'line',
  info: {
    fullNameTh?: string;
    fullNameEn?: string;
    email?: string | null;
    providerSubject?: string;
  }
): string {
  const mailPrefix = (info.email ?? '').split('@')[0]?.trim() ?? '';
  const enSlug = /^[A-Za-z0-9.\s_-]+$/.test(info.fullNameEn ?? '')
    ? (info.fullNameEn ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.')
    : '';
  const baseHandle = mailPrefix || enSlug;

  if (provider === 'facebook') {
    if (baseHandle) return `facebook.com/${baseHandle}`;
    if (info.fullNameTh?.trim()) return `${info.fullNameTh.trim()} (Facebook)`;
    return info.providerSubject || 'facebook.com/runner';
  }

  if (baseHandle) return `@${baseHandle.replace(/^@+/, '')}`;
  if (info.fullNameTh?.trim()) {
    return info.providerSubject
      ? `${info.fullNameTh.trim()} (${info.providerSubject})`
      : info.fullNameTh.trim();
  }
  return info.providerSubject || '@line_runner';
}

export function enrichSocialLinksFromIdentities(
  user: Pick<
    UserAccount,
    'fullNameTh' | 'fullNameEn' | 'contactEmail' | 'identities' | 'runnerProfile'
  >,
  forceProvider?: 'facebook' | 'line'
): RunnerSocialLinks {
  const existing: RunnerSocialLinks = {
    ...(user.runnerProfile?.socialLinks ?? {}),
  };
  const fbIdentity = user.identities.find((i) => i.provider === 'facebook');
  const lineIdentity = user.identities.find((i) => i.provider === 'line');

  if (!existing.facebook && (fbIdentity || forceProvider === 'facebook')) {
    existing.facebook = deriveProviderSocialHandle('facebook', {
      fullNameTh: user.fullNameTh,
      fullNameEn: user.fullNameEn,
      email: fbIdentity?.providerEmail ?? user.contactEmail,
      providerSubject: fbIdentity?.providerSubject,
    });
  }

  if (!existing.line && (lineIdentity || forceProvider === 'line')) {
    existing.line = deriveProviderSocialHandle('line', {
      fullNameTh: user.fullNameTh,
      fullNameEn: user.fullNameEn,
      email: lineIdentity?.providerEmail ?? user.contactEmail,
      providerSubject: lineIdentity?.providerSubject,
    });
  }

  return existing;
}
