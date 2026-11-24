import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  EventProduct,
  OrganizerFormStep,
  RunnerSavedAddress,
  Organization,
  RaceCategory,
  RaceEvent,
  ShirtSizeCode,
  UserAccount,
} from '../types';
import { tx, txf } from '../i18n';
import {
  calculateFeeQuote,
  feePolicyLabel,
  formatThb,
  getCurrentTier,
  kitShippingFee,
  quoteRegistrationShipping,
} from '../utils/pricing';
import { evaluateCategoryAge, formatAgeBasis, formatAgeGroupLabel, formatAgeLimit, formatBasisDate } from '../utils/age';
import { sanitizeEnglishNameInput, sanitizeThaiNameInput } from '../utils/dateFormat';
import { resolveShirtSpec } from '../data/runnerProfileDefaults';
import type { PlatformProfileConfig } from '../types';
import { DateOfBirthInput } from './DateOfBirthInput';
import { IdNumberInput } from './IdNumberInput';
import { PhoneInput } from './PhoneInput';
import { RunnerCustomFieldsInputs } from './PublicEventView';
import { RequiredFieldText } from './RequiredFieldText';
import { SelectMenu } from './SelectMenu';
import { NoteTag, PriceTag } from './RegTags';
import { RegistrationStepper } from './RegistrationStepper';
import { ShirtGallery, type ShirtGalleryStyle } from './ProductGallery';
import { SHIRT_STYLES, shirtStyleName, type ShirtStyleId } from '../data/mockShirtStyles';
import { ThaiPostalAddressSelector, type CascadingAddressValue } from './ThaiPostalAddressSelector';
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconCheckCircle,
  IconMapPin,
  IconShirt,
} from './Icons';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { SouvenirPicker } from './SouvenirPicker';
import { RegistrationTerms } from './RegistrationTerms';
import type { CartLine } from './StorefrontView';
import { RegistrationSummary, type ReviewLedgerGroup, type ReviewSection } from './RegistrationReview';
import { EventCoverMedia } from './Icons';
import { displayPhone } from '../utils/phone';
import { CORE_STEP, answerText, fieldShown, isContentField } from '../data/registrationForm';

/**
 * The registration form (layout B, the only layout since 24 Nov 2026 — layout A was removed on
 * the user's request). Fields are laid out for reading: one column of titled sections, two fields
 * per row only where they belong together, generous space between sections.
 *
 * The form's state, its checks and the booking live in CustomerPortalView (`shared` and `live`):
 * each "next" runs the same checks as before, the organizer's own steps sit between the runner
 * details and the shop (2.1–2.3), and step 7 books and pays through the server.
 */

/** 1 start · 2 details · 2.1–2.3 organizer's steps · 3 shirt · 4 souvenirs · 5 address · 6 review · 7 pay · 8 done */
type LabStep = number;

/** what the live form gives this layout besides its state */
export interface LabLive {
  /** the organizer's steps this runner is asked, in order */
  ownSteps: OrganizerFormStep[];
  /** checks a step before moving on: the first problem, or null (it also marks the questions) */
  check: (step: number, scope: HTMLElement | null) => string | null;
  /** problems per question id, shown under each question */
  errors: Record<string, string>;
  clearError: (fieldId: string) => void;
  /** books the place and takes the payment (the server checks everything again) */
  submit: () => void;
  submitting: boolean;
  /** booking problem, with its own actions (e.g. add an email) */
  payError: ReactNode;
  /** step 8, once booked */
  done: ReactNode;
  /** a note above the form (the organizer's preview) */
  notice?: ReactNode;
  /** the organizer's preview may open any step */
  freeJump?: boolean;
  /** opens the runner's profile (emergency contacts, saved runners) */
  openProfile?: () => void;
  /** "for myself": fill the runner fields from the profile, falling back to the account's names */
  fillSelf?: () => void;
  /** keeps a new address in the runner's profile (signed in only) */
  saveAddresses?: (list: RunnerSavedAddress[]) => Promise<{ ok: boolean; error?: string }>;
}

/** [value, setter] owned by the live form, so switching A <-> B keeps what was typed */
export type Pair<T> = [T, (next: T) => void];

export interface LabShared {
  step: Pair<number>;
  optionId: Pair<string>;
  catId: string;
  forSelf: Pair<boolean | null>;
  savedId: Pair<string>;
  buyerName: Pair<string>;
  firstTh: Pair<string>;
  lastTh: Pair<string>;
  firstEn: Pair<string>;
  lastEn: Pair<string>;
  nickTh: Pair<string>;
  nickEn: Pair<string>;
  dob: Pair<string>;
  gender: Pair<'ไม่ระบุ' | 'ชาย' | 'หญิง'>;
  phone: Pair<string>;
  idType: Pair<'thai_id' | 'passport'>;
  idNumber: Pair<string>;
  emergencyName: Pair<string>;
  emergencyRelation: Pair<string>;
  emergencyPhone: Pair<string>;
  answers: Pair<Record<string, string | boolean>>;
  shirtSize: Pair<ShirtSizeCode>;
  shirtStyle: Pair<ShirtStyleId>;
  addonItems: Pair<CartLine[]>;
  delivery: Pair<'expo_pickup' | 'postal'>;
  addrName: Pair<string>;
  recipient: Pair<string>;
  shipPhone: Pair<string>;
  address: Pair<CascadingAddressValue>;
  addrMode: Pair<'saved' | 'manual'>;
  bookId: Pair<string>;
  channel: Pair<'promptpay' | 'card'>;
  acceptRules: Pair<boolean>;
  acceptPayTerms: Pair<boolean>;
}
type Gender = 'ไม่ระบุ' | 'ชาย' | 'หญิง';
type IdType = 'thai_id' | 'passport';

export function RegistrationLabView({
  event,
  organization,
  currentUser,
  platformProfileConfig,
  openSeatsFor,
  onBack,
  shared,
  live,
}: {
  event: RaceEvent;
  organization?: Organization;
  currentUser: UserAccount | null;
  platformProfileConfig?: PlatformProfileConfig;
  openSeatsFor: (cat: RaceCategory) => number;
  onBack: () => void;
  /** form state owned by the live form (see LabShared) */
  shared: LabShared;
  live: LabLive;
}) {
  const profile = currentUser?.runnerProfile;
  const hasSouvenirs = event.products.length > 0;
  const steps: { step: LabStep; label: string }[] = [
    { step: 1, label: 'เริ่ม' },
    { step: 2, label: 'ข้อมูล' },
    ...live.ownSteps.map((st, i) => ({ step: 2 + (i + 1) / 10, label: st.title })),
    { step: 3, label: 'สินค้า' },
    ...(hasSouvenirs ? [{ step: 4 as LabStep, label: 'ของที่ระลึก' }] : []),
    { step: 5, label: 'ที่อยู่' },
    { step: 6, label: 'สรุป' },
    { step: 7, label: 'ชำระเงิน' },
  ];

  // the step is the live form's (the organizer's preview and the booking move it too)
  const step: LabStep = shared.step[0];
  const [stepError, setStepError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const stepperRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);

  // every step change brings the form back to its top, like the live form
  const prevStep = useRef(step);
  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    shellRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [step]);

  /* ---------- step 1: same options as the live form ---------- */
  const options = useMemo(
    () => [
      {
        optionId: `alumni-${event.categories[0]?.id ?? 'cat'}`,
        catId: event.categories[0]?.id ?? '',
        label: `ศิษย์เก่า / สมาชิกชมรม ${event.titleTh.split(' ')[0]}`,
        subLabel: `${event.categories[0]?.name ?? ''} (${event.categories[0]?.code ?? ''})`,
      },
      ...event.categories.flatMap((cat) => [
        {
          optionId: `female-${cat.id}`,
          catId: cat.id,
          label: `นักวิ่งใหม่ (หญิง) : ${cat.code.toUpperCase()}`,
          subLabel: `${cat.name} · ปล่อยตัว ${cat.startTimeLocal} น.`,
        },
        {
          optionId: `male-${cat.id}`,
          catId: cat.id,
          label: `นักวิ่งใหม่ (ชาย) : ${cat.code.toUpperCase()}`,
          subLabel: `${cat.name} · ปล่อยตัว ${cat.startTimeLocal} น.`,
        },
      ]),
    ],
    [event]
  );
  const optionId =
    shared.optionId[0] ||
    options.find((o) => o.catId === shared.catId)?.optionId ||
    options[0]?.optionId ||
    '';
  const setOptionId = shared.optionId[1];
  const picked = options.find((o) => o.optionId === optionId) ?? options[0];
  const category =
    event.categories.find((c) => c.id === picked?.catId) ?? event.categories[0];
  const tier = category ? getCurrentTier(category) : null;
  const quote = tier ? calculateFeeQuote(tier.priceSatang, event.feeBearerPolicy) : null;

  /* ---------- step 2: participant ---------- */
  const [forSelf, setForSelf] = shared.forSelf;
  const [savedId, setSavedId] = shared.savedId;
  const [buyerName, setBuyerName] = shared.buyerName;
  const [firstTh, setFirstTh] = shared.firstTh;
  const [lastTh, setLastTh] = shared.lastTh;
  const [firstEn, setFirstEn] = shared.firstEn;
  const [lastEn, setLastEn] = shared.lastEn;
  const [nickTh, setNickTh] = shared.nickTh;
  const [nickEn, setNickEn] = shared.nickEn;
  const [dob, setDob] = shared.dob;
  const [gender, setGender] = shared.gender;
  const [phone, setPhone] = shared.phone;
  const [idType, setIdType] = shared.idType;
  const [idNumber, setIdNumber] = shared.idNumber;
  const [emergencyName, setEmergencyName] = shared.emergencyName;
  const [emergencyRelation, setEmergencyRelation] = shared.emergencyRelation;
  const [emergencyPhone, setEmergencyPhone] = shared.emergencyPhone;
  const setEmergency = (name: string, relation: string, phone: string) => {
    setEmergencyName(name);
    setEmergencyRelation(relation);
    setEmergencyPhone(phone);
  };
  const emergency = [
    emergencyName.trim(),
    emergencyRelation.trim() ? `(${emergencyRelation.trim()})` : '',
    displayPhone(emergencyPhone),
  ]
    .filter(Boolean)
    .join(' ');
  const [answers, setAnswers] = shared.answers;

  const fillFrom = (p?: {
    firstName?: string;
    lastName?: string;
    firstNameEn?: string;
    lastNameEn?: string;
    nickname?: string;
    nicknameEn?: string;
    dateOfBirth?: string;
    gender?: Gender;
    phone?: string;
    idType?: 'none' | IdType;
    idNumber?: string;
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    emergencyContactPhone?: string;
  } | null) => {
    setFirstTh(p?.firstName ?? '');
    setLastTh(p?.lastName ?? '');
    setFirstEn(p?.firstNameEn ?? '');
    setLastEn(p?.lastNameEn ?? '');
    setNickTh(p?.nickname ?? '');
    setNickEn(p?.nicknameEn ?? '');
    setDob(p?.dateOfBirth ?? '');
    setGender(p?.gender ?? 'ไม่ระบุ');
    setPhone(p?.phone ?? '');
    setIdType(p?.idType === 'passport' ? 'passport' : 'thai_id');
    setIdNumber(p?.idNumber ?? '');
    setEmergency(p?.emergencyContactName ?? '', p?.emergencyContactRelation ?? '', p?.emergencyContactPhone ?? '');
  };

  const saved = profile?.savedParticipants ?? [];
  const contacts = profile?.emergencyContacts ?? [];
  const ageCheck = category ? evaluateCategoryAge(event, category, dob, gender) : null;

  /* ---------- step 3-5 ---------- */
  const [shirtSize, setShirtSize] = shared.shirtSize;
  const [shirtStyle, setShirtStyle] = shared.shirtStyle;
  const [addonItems, setAddonItems] = shared.addonItems;
  const addonLines = addonItems
    .map((l) => ({ ...l, prd: event.products.find((p) => p.id === l.productId) }))
    .filter((l): l is CartLine & { prd: EventProduct } => Boolean(l.prd));
  const [delivery, setDelivery] = shared.delivery;
  const [addrName, setAddrName] = shared.addrName;
  const [recipient, setRecipient] = shared.recipient;
  const [shipPhone, setShipPhone] = shared.shipPhone;
  const [address, setAddress] = shared.address;
  // address book: starts from the profile; layout B keeps additions on this page only
  const [book, setBook] = useState<RunnerSavedAddress[]>(profile?.savedAddresses ?? []);
  const [addrMode, setAddrMode] = shared.addrMode;
  const [bookId, setBookId] = shared.bookId;
  const [addrNotice, setAddrNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [addrSaving, setAddrSaving] = useState(false);
  const saveToBook = async () => {
    const a = address;
    if (!recipient.trim() || !shipPhone.trim() || !a.address.trim() || !a.postalCode || !a.subdistrict) {
      setAddrNotice({ tone: 'err', text: tx('กรุณากรอกชื่อผู้รับ หมายเลขโทรศัพท์ และที่อยู่ให้ครบถ้วนก่อนบันทึก') });
      return;
    }
    const dup = book.find(
      (x) => x.address.trim() === a.address.trim() && x.postalCode === a.postalCode && x.subdistrict === a.subdistrict
    );
    const entry: RunnerSavedAddress = dup ?? {
      id: `lab-addr-${Date.now().toString(36)}`,
      addressName: addrName.trim() || txf('ที่อยู่จากการสมัคร {0}', event.code),
      recipientName: recipient.trim(),
      phone: shipPhone.trim(),
      address: a.address.trim(),
      province: a.province,
      district: a.district,
      subdistrict: a.subdistrict,
      postalCode: a.postalCode,
      country: a.country || 'Thailand',
      isDefault: book.length === 0,
    };
    if (!dup) {
      if (live.saveAddresses) {
        setAddrSaving(true);
        const res = await live.saveAddresses([...(profile?.savedAddresses ?? []), entry]);
        setAddrSaving(false);
        if (!res.ok) {
          setAddrNotice({ tone: 'err', text: res.error ?? tx('บันทึกที่อยู่ไม่สำเร็จ กรุณาลองอีกครั้ง') });
          return;
        }
      }
      setBook((b) => [...b, entry]);
    }
    setAddrName('');
    setBookId(entry.id);
    setAddrMode('saved');
    setAddrNotice({
      tone: 'ok',
      text: dup
        ? tx('ที่อยู่นี้มีในสมุดแล้ว เลือกให้แล้ว')
        : live.saveAddresses
          ? tx('บันทึกลงสมุดที่อยู่แล้ว และเลือกเป็นที่อยู่จัดส่ง')
          : tx('ใช้ที่อยู่นี้แล้ว (เก็บไว้เฉพาะการสมัครครั้งนี้)'),
    });
  };

  /* ---------- step 6 ---------- */
  const [channel, setChannel] = shared.channel;
  const [acceptRules, setAcceptRules] = shared.acceptRules;
  const [acceptPayTerms, setAcceptPayTerms] = shared.acceptPayTerms;

  const addonSatang = addonLines.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);
  const shipQuote = quoteRegistrationShipping(event, delivery === 'postal' ? 'postal_shipping' : 'pickup_at_expo', addonLines);
  const kitFee = kitShippingFee(event);
  const totalSatang = (quote?.runnerNetPaySatang ?? 0) + addonSatang + shipQuote.totalSatang;
  // Thai name is optional; fall back to the (required) English name
  const participantName = `${firstTh} ${lastTh}`.trim() || `${firstEn} ${lastEn}`.trim();

  const go = (next: LabStep) => {
    setStepError(null);
    shared.step[1](next);
  };
  /** forward: the live form's checks for this step first */
  const goNext = (next: LabStep) => {
    const problem = live.check(step, bodyRef.current);
    if (problem) {
      setStepError(problem);
      return;
    }
    go(next);
  };
  const ownPos = (i: number) => 2 + (i + 1) / 10;
  const afterInfo: LabStep = live.ownSteps.length > 0 ? ownPos(0) : 3;
  const beforeShirt: LabStep = live.ownSteps.length > 0 ? ownPos(live.ownSteps.length - 1) : 2;
  const ownIndex = step > 2 && step < 3 ? Math.round((step - 2) * 10) - 1 : -1;
  const afterShirt: LabStep = hasSouvenirs ? 4 : 5;
  const beforeAddress: LabStep = hasSouvenirs ? 4 : 3;

  const shirtSpec = (size: ShirtSizeCode) =>
    resolveShirtSpec(
      size,
      profile?.preferredShirtType ?? 'Unisex',
      platformProfileConfig?.shirtSizes,
      event.customSizeChart
    );

  const galleryStyles: ShirtGalleryStyle[] = SHIRT_STYLES.map((style) => ({
    id: style.id,
    name: style.nameTh,
    art: style.art,
    demo: style.demoStock !== null,
    sizes: (style.demoStock ?? event.shirtStocks).map((st) => {
      const spec = shirtSpec(st.size);
      return {
        size: st.size,
        chest: spec.chestInch,
        length: spec.lengthInch,
        left: Math.max(0, st.total - st.reservedOrConfirmed),
      };
    }),
  }));

  const footer = (back: LabStep | null, next: LabStep | null, nextLabel = 'ถัดไป') => (
    <>
    {stepError && (
      <div className="error-callout" role="alert">
        <IconAlert size={16} />
        <span>{tx(stepError)}</span>
      </div>
    )}
    <div className="reg-lab-footer">
      {back ? (
        <button type="button" className="btn-secondary" onClick={() => go(back)}>
          {tx('ย้อนกลับ')}
        </button>
      ) : (
        <span />
      )}
      {next && (
        <button type="button" className="btn-primary reg-next-pill-btn" onClick={() => goNext(next)}>
          {tx(nextLabel)}
        </button>
      )}
    </div>
    </>
  );

  return (
    <main className="reg-lab-shell" ref={shellRef}>
      {live.notice}

      <div className="reg-lab-cover" aria-hidden="true">
        <EventCoverMedia event={event} illustrated className="reg-lab-cover-img" />
      </div>

      <header className="reg-lab-head">
        <button type="button" className="btn-ghost-sm reg-lab-back" onClick={onBack}>
          <IconArrowLeft size={15} />
          <span>{tx('กลับ')}</span>
        </button>
        <div className="reg-lab-head-copy">
          <h1>{event.titleEn || event.titleTh}</h1>
          <p className="reg-lab-meta">
            <span>{tx(organization?.nameTh ?? 'องค์กรผู้จัดงานวิ่ง กระต่าย')}</span>
            <span>
              <IconCalendar size={14} />
              {tx(event.eventDate)}
            </span>
            <span>
              <IconMapPin size={14} />
              {tx(event.venue)} · {tx(event.province)}
            </span>
          </p>
        </div>
        {category && quote && (
          <div className="reg-lab-head-price">
            <span className="muted-inline">{tx(category.name)}</span>
            <strong className="mono-num">{formatThb(quote.runnerNetPaySatang, true)}</strong>
          </div>
        )}
      </header>

      <section className="reg-lab-card" aria-label={tx('ขั้นตอนการสมัครเข้าร่วมงานวิ่ง')}>
        {/* event-reg-wizard-pane: picks up the live form's stepper rules, so A and B show the same progress */}
        {step !== 8 && (
          <div className="reg-lab-stepper event-reg-wizard-pane">
            <RegistrationStepper
              steps={steps}
              current={step}
              complete={false}
              stepperRef={stepperRef}
              onJump={go}
              freeJump={live.freeJump}
            />
          </div>
        )}

        <div ref={bodyRef} className={`reg-lab-body ${step === 6 ? 'is-review' : ''}`}>
          {/* ---------- STEP 1 ---------- */}
          {step === 1 && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('เลือกประเภทการสมัคร')}</h2>
                <p>{tx('เลือกระยะและประเภทผู้สมัคร ราคาและจำนวนที่ว่างแสดงในแต่ละตัวเลือก')}</p>
              </div>
              <div className="reg-lab-choices" role="radiogroup" aria-label={tx('เลือกประเภทการสมัคร')}>
                {options.map((opt) => {
                  const cat = event.categories.find((c) => c.id === opt.catId) ?? event.categories[0];
                  const t = cat ? getCurrentTier(cat) : null;
                  const q = t ? calculateFeeQuote(t.priceSatang, event.feeBearerPolicy) : null;
                  const left = cat ? openSeatsFor(cat) : 0;
                  const isSel = optionId === opt.optionId;
                  return (
                    <label
                      key={opt.optionId}
                      className={`reg-category-radio-card ${isSel ? 'selected' : ''} ${left <= 0 ? 'disabled' : ''}`}
                    >
                      <input
                        type="radio"
                        name="lab-cat"
                        checked={isSel}
                        disabled={left <= 0}
                        onChange={() => setOptionId(opt.optionId)}
                      />
                      <span className="custom-radio-circle" aria-hidden="true" />
                      <div className="reg-radio-card-copy">
                        <strong>{tx(opt.label)}</strong>
                        <span className="muted-inline">{tx(opt.subLabel)}</span>
                        <span className="reg-tag-row">
                          {q && <PriceTag satang={q.runnerNetPaySatang} />}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
              {footer(null, 2)}
            </>
          )}

          {/* ---------- STEP 2 ---------- */}
          {step === 2 && category && (
            <>
              <div className="reg-lab-title">
                <h2>{txf('ข้อมูลผู้เข้าแข่งขัน · {0}', tx(category.name))}</h2>
                <p>{tx('ช่องที่มี * จำเป็นต้องกรอก ข้อมูลอื่นช่วยให้ผู้จัดติดต่อและจัดรุ่นอายุได้ถูกต้อง')}</p>
              </div>

              <section className="reg-lab-section" aria-labelledby="lab-who">
                <h3 id="lab-who">{tx('ใครเป็นผู้เข้าแข่งขัน')}</h3>
                <div className="reg-lab-pair-cards" role="radiogroup" aria-labelledby="lab-who">
                  <label className={`reg-category-radio-card ${forSelf === true ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="lab-mode"
                      checked={forSelf === true}
                      onChange={() => {
                        if (live.fillSelf) {
                          live.fillSelf();
                          return;
                        }
                        setForSelf(true);
                        fillFrom(profile ?? null);
                        const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
                        if (primary) setEmergency(primary.contactName, primary.relationship, primary.phone);
                      }}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>{tx('สมัครให้ตนเอง')}</strong>
                      <span className="muted-inline">{tx('ดึงข้อมูลจากโปรไฟล์นักวิ่งของคุณมาเติมให้อัตโนมัติ')}</span>
                    </div>
                  </label>
                  <label className={`reg-category-radio-card ${forSelf === false ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="lab-mode"
                      checked={forSelf === false}
                      onChange={() => {
                        setForSelf(false);
                        const first = saved[0];
                        setSavedId(first ? first.id : 'new');
                        fillFrom(first ?? null);
                      }}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>{tx('สมัครให้ผู้อื่น')}</strong>
                      <span className="muted-inline">
                        {tx('กรอกข้อมูลผู้เข้าแข่งขันคนอื่น ระบบจะบันทึกไว้ให้เลือกใช้ครั้งถัดไป')}
                      </span>
                    </div>
                  </label>
                </div>

                {forSelf === false && (
                  <div className="reg-lab-fields">
                    {saved.length > 0 && (
                      <div className="form-row reg-lab-full">
                        <label htmlFor="lab-saved">{tx('เลือกผู้สมัครที่เคยกรอกไว้')}</label>
                        <SelectMenu
                          id="lab-saved"
                          value={savedId}
                          onChange={(v) => {
                            setSavedId(v);
                            fillFrom(saved.find((x) => x.id === v) ?? null);
                          }}
                          options={[
                            ...saved.map((pt) => ({
                              value: pt.id,
                              label: `${`${pt.firstName} ${pt.lastName}`.trim()}${pt.nickname ? ` · ${pt.nickname}` : ''}`,
                            })),
                            { value: 'new', label: tx('+ เพิ่มผู้สมัครใหม่') },
                          ]}
                        />
                      </div>
                    )}
                    <div className="form-row reg-lab-full">
                      <label htmlFor="lab-buyer">
                        <RequiredFieldText text={tx('ชื่อ-นามสกุลผู้ซื้อคำสั่งซื้อ (ผู้ชำระเงิน) *')} />
                      </label>
                      <input id="lab-buyer" type="text" required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
                    </div>
                  </div>
                )}
              </section>

              {forSelf !== null && (
                <>
                  <section className="reg-lab-section" aria-labelledby="lab-names">
                    <h3 id="lab-names">{tx('ชื่อผู้เข้าแข่งขัน')}</h3>
                    <p className="reg-lab-hint">{tx('ชื่ออังกฤษใช้พิมพ์บนป้าย BIB')}</p>
                    <div className="reg-lab-fields">
                      <div className="form-row">
                        <label htmlFor="lab-fen"><RequiredFieldText text="First Name (EN) *" /></label>
                        <input id="lab-fen" type="text" required value={firstEn} onChange={(e) => setFirstEn(sanitizeEnglishNameInput(e.target.value))} placeholder="e.g. Kanpitcha" />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-len"><RequiredFieldText text="Last Name (EN) *" /></label>
                        <input id="lab-len" type="text" required value={lastEn} onChange={(e) => setLastEn(sanitizeEnglishNameInput(e.target.value))} placeholder="e.g. Wattanakul" />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-fth">{tx('ชื่อจริง (ภาษาไทย)')}</label>
                        <input id="lab-fth" type="text" value={firstTh} onChange={(e) => setFirstTh(sanitizeThaiNameInput(e.target.value))} placeholder={tx('เช่น กานต์พิชชา')} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-lth">{tx('นามสกุล (ภาษาไทย)')}</label>
                        <input id="lab-lth" type="text" value={lastTh} onChange={(e) => setLastTh(sanitizeThaiNameInput(e.target.value))} placeholder={tx('เช่น วัฒนากูล')} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-nth">{tx('ชื่อเล่น')}</label>
                        <input id="lab-nth" type="text" value={nickTh} onChange={(e) => setNickTh(sanitizeThaiNameInput(e.target.value))} placeholder={tx('เช่น กานต์')} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-nen">Nickname (EN)</label>
                        <input id="lab-nen" type="text" value={nickEn} onChange={(e) => setNickEn(sanitizeEnglishNameInput(e.target.value))} placeholder="e.g. Kan" />
                      </div>
                    </div>
                  </section>

                  <section className="reg-lab-section" aria-labelledby="lab-personal">
                    <h3 id="lab-personal">{tx('ข้อมูลส่วนตัวและเอกสารยืนยันตัวตน')}</h3>
                    <div className="reg-lab-fields">
                      <div className="form-row">
                        <label htmlFor="lab-dob">{tx('วันเกิด')}</label>
                        <DateOfBirthInput id="lab-dob" valueIso={dob} onChangeIso={setDob} ariaDescribedBy="lab-dob-age" />
                      </div>
                      <fieldset className="form-row runner-gender-field">
                        <legend>{tx('เพศ')}</legend>
                        <div className="runner-gender-options">
                          {/* two choices only (user request 24 Nov 2026); nothing picked = not given */}
                          {(['ชาย', 'หญิง'] as const).map((opt) => (
                            <label key={opt}>
                              <input
                                type="radio"
                                name="lab-gender"
                                value={opt}
                                checked={gender === opt}
                                onChange={() => setGender(opt as Gender)}
                              />
                              <span>{tx(opt)}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      {ageCheck && category && (ageCheck.ageYears !== null || ageCheck.status === 'missing_dob' || ageCheck.status === 'invalid_dob') && (
                        <p
                          id="lab-dob-age"
                          className={`reg-lab-full reg-age-hint ${ageCheck.eligible ? '' : 'is-error'}`}
                          aria-live="polite"
                        >
                          {ageCheck.ageYears !== null ? (
                            <>
                              {txf('อายุ {0} ปี ณ {1}', ageCheck.ageYears, formatBasisDate(ageCheck.basisDate))}
                              {ageCheck.group && ` · ${txf('รุ่น {0}', formatAgeGroupLabel(ageCheck.group))}`}
                              {ageCheck.unassigned && ` · ${tx('ยังไม่เข้ารุ่นอายุ (ระบุเพศชายหรือหญิงเพื่อจัดรุ่น)')}`}
                              {!ageCheck.eligible && ` · ${txf('ระยะนี้รับ{0}', formatAgeLimit(category) ?? '')}`}
                            </>
                          ) : ageCheck.status === 'missing_dob' ? (
                            txf(
                              'ระยะนี้กำหนด{0} · {1} กรุณาระบุวันเกิด',
                              formatAgeLimit(category) ?? tx('รุ่นอายุ'),
                              formatAgeBasis(ageCheck.basis)
                            )
                          ) : (
                            tx('วันเกิดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
                          )}
                        </p>
                      )}
                      <div className="form-row reg-lab-full">
                        <label htmlFor="lab-phone">{tx('เบอร์โทรศัพท์ผู้เข้าแข่งขัน')}</label>
                        <PhoneInput id="lab-phone" value={phone} onChange={setPhone} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-idtype">{tx('ประเภทเอกสาร')}</label>
                        <SelectMenu
                          id="lab-idtype"
                          value={idType}
                          onChange={(v) => setIdType(v as IdType)}
                          options={[
                            { value: 'thai_id', label: tx('บัตรประจำตัวประชาชน 13 หลัก') },
                            { value: 'passport', label: tx('หนังสือเดินทาง (Passport)') },
                          ]}
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-idnum">
                          {idType === 'thai_id' ? tx('เลขบัตรประจำตัวประชาชน') : tx('เลขหนังสือเดินทาง')}
                        </label>
                        <IdNumberInput
                          id="lab-idnum"
                          idType={idType}
                          className="mono-code"
                          value={idNumber}
                          onValueChange={setIdNumber}
                          placeholder={idType === 'thai_id' ? 'X-XXXX-XXXXX-XX-X' : 'Passport No.'}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="reg-lab-section" aria-labelledby="lab-emergency">
                    <h3 id="lab-emergency">{tx('ผู้ติดต่อฉุกเฉิน')}</h3>
                    <p className="reg-lab-hint">{tx('ผู้จัดจะโทรหาคนนี้หากเกิดเหตุระหว่างแข่งขัน')}</p>
                    <div className="reg-lab-fields">
                      {forSelf && contacts.length > 0 && (
                        <div className="form-row reg-lab-full">
                          <label htmlFor="lab-ec-pick">{tx('เลือกจากโปรไฟล์')}</label>
                          <SelectMenu
                            id="lab-ec-pick"
                            value=""
                            placeholder={tx('เลือกจากโปรไฟล์…')}
                            onChange={(v) => {
                              const c = contacts.find((x) => x.id === v);
                              if (c) setEmergency(c.contactName, c.relationship, c.phone);
                            }}
                            options={contacts.map((c) => ({
                              value: c.id,
                              label: `${c.contactName} (${tx(c.relationship)})${c.isPrimary ? ` · ${tx('หลัก')}` : ''}`,
                            }))}
                          />
                          {live.openProfile && (
                            <button type="button" className="inline-text-link" onClick={live.openProfile}>
                              {tx('จัดการโปรไฟล์')}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="form-row">
                        <label htmlFor="lab-emerg">
                          <RequiredFieldText text={tx('ชื่อผู้ติดต่อฉุกเฉิน *')} />
                        </label>
                        <input
                          id="lab-emerg"
                          type="text"
                          required
                          value={emergencyName}
                          onChange={(e) => setEmergencyName(e.target.value)}
                          placeholder={tx('เช่น วีระ วัฒนากูล')}
                        />
                        {emergencyRelation && (
                          <span className="muted-inline">{txf('ความสัมพันธ์: {0}', tx(emergencyRelation))}</span>
                        )}
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-emerg-phone">
                          <RequiredFieldText text={tx('เบอร์โทรผู้ติดต่อฉุกเฉิน *')} />
                        </label>
                        <PhoneInput id="lab-emerg-phone" value={emergencyPhone} onChange={setEmergencyPhone} required />
                      </div>
                    </div>
                  </section>

                  {(event.customFields?.length ?? 0) > 0 && (
                    // the field list brings its own heading ("ข้อมูลเพิ่มเติมที่ผู้จัดขอ (n ข้อ)")
                    <section className="reg-lab-section reg-lab-custom">
                      <RunnerCustomFieldsInputs
                        fields={event.customFields}
                        answers={answers}
                        onAnswerChange={(id, v) => {
                          live.clearError(id);
                          setStepError(null);
                          setAnswers({ ...answers, [id]: v });
                        }}
                        raceDistanceCode={category.code}
                        shirtSize={shirtSize}
                        publishedFormVersion={event.publishedFormVersion}
                        steps={event.formCustomSteps ?? []}
                        stepId={CORE_STEP}
                        errors={live.errors}
                      />
                    </section>
                  )}
                </>
              )}
              {footer(1, forSelf === null ? null : afterInfo)}
            </>
          )}

          {/* ---------- STEPS 2.1–2.3: the organizer's own steps ---------- */}
          {ownIndex >= 0 && category && (() => {
            const st = live.ownSteps[ownIndex];
            if (!st) {
              // the answers changed and this step is no longer asked
              return footer(2, 3);
            }
            return (
              <>
                <div className="reg-lab-title">
                  <h2>{tx(st.title)}</h2>
                  {st.description && <p>{tx(st.description)}</p>}
                </div>
                <section className="reg-lab-section reg-lab-custom">
                  <RunnerCustomFieldsInputs
                    fields={event.customFields}
                    answers={answers}
                    onAnswerChange={(id, v) => {
                      live.clearError(id);
                      setStepError(null);
                      setAnswers({ ...answers, [id]: v });
                    }}
                    raceDistanceCode={category.code}
                    shirtSize={shirtSize}
                    steps={event.formCustomSteps ?? []}
                    stepId={st.id}
                    errors={live.errors}
                    heading={null}
                  />
                </section>
                {footer(ownIndex > 0 ? ownPos(ownIndex - 1) : 2, ownIndex + 1 < live.ownSteps.length ? ownPos(ownIndex + 1) : 3)}
              </>
            );
          })()}

          {/* ---------- STEP 3 ---------- */}
          {step === 3 && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('เลือกไซส์เสื้อตามสิทธิ์สมัคร')}</h2>
                <p>
                  {tx('เสื้อรวมในค่าสมัครแล้ว แก้ไขไซส์ได้ถึงวันที่')}{' '}
                  <span className="mono-num">{tx(event.editDeadlineDate)}</span>
                </p>
              </div>
              {forSelf && profile?.preferredShirtSize && (
                <p className="reg-lab-inline-note">
                  <IconShirt size={15} />
                  <span>
                    {txf('เลือกไซส์ {0} ไว้ให้ตามโปรไฟล์ เปลี่ยนได้เฉพาะงานนี้', profile.preferredShirtSize)}
                  </span>
                </p>
              )}
              <ShirtGallery
                styles={galleryStyles}
                styleId={shirtStyle}
                onStyleChange={(id) => {
                  setShirtStyle(id as ShirtStyleId);
                  // keep the size when the new style still has it, else the first size left
                  const next = galleryStyles.find((g) => g.id === id);
                  if (!next?.sizes.some((z) => z.size === shirtSize && z.left > 0)) {
                    const first = next?.sizes.find((z) => z.left > 0);
                    if (first) setShirtSize(first.size as ShirtSizeCode);
                  }
                }}
                size={shirtSize}
                onSizeChange={(z) => setShirtSize(z as ShirtSizeCode)}
              />
              {footer(beforeShirt, afterShirt)}
            </>
          )}

          {/* ---------- STEP 4 ---------- */}
          {step === 4 && hasSouvenirs && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('ของที่ระลึก (ไม่บังคับ)')}</h2>
                <p>{tx('สั่งเสื้อหรือเหรียญที่ระลึกเพิ่มพร้อมใบสมัคร ชำระรวมกับค่าสมัคร')}</p>
              </div>
              <SouvenirPicker products={event.products} value={addonItems} onChange={setAddonItems} />
              {footer(3, 5)}
            </>
          )}

          {/* ---------- STEP 5 ---------- */}
          {step === 5 && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('วิธีรับอุปกรณ์ (Race Kit)')}</h2>
                <p>{tx('รับเองที่หน้างานไม่มีค่าใช้จ่าย หรือให้จัดส่งตามเงื่อนไขของผู้จัด')}</p>
              </div>
              <div className="reg-lab-choices" role="radiogroup" aria-label={tx('วิธีรับอุปกรณ์ (Race Kit)')}>
                <label className={`reg-category-radio-card ${delivery === 'expo_pickup' ? 'selected' : ''}`}>
                  <input type="radio" name="lab-kit" checked={delivery === 'expo_pickup'} onChange={() => setDelivery('expo_pickup')} />
                  <span className="custom-radio-circle" aria-hidden="true" />
                  <div className="reg-radio-card-copy">
                    <strong>{tx('รับเสื้อและป้าย BIB ด้วยตนเองที่หน้างาน (QR Check-in)')}</strong>
                    <span className="muted-inline">
                      {tx('กำหนดการรับอุปกรณ์: ')}
                      {tx(event.kitPickupWindow)} {tx(' ณ')} {tx(event.venue)}
                    </span>
                    <span className="reg-tag-row">
                      <NoteTag tone="ok">{tx('ไม่มีค่าจัดส่ง')}</NoteTag>
                    </span>
                  </div>
                </label>
                <label className={`reg-category-radio-card ${delivery === 'postal' ? 'selected' : ''}`}>
                  <input type="radio" name="lab-kit" checked={delivery === 'postal'} onChange={() => setDelivery('postal')} />
                  <span className="custom-radio-circle" aria-hidden="true" />
                  <div className="reg-radio-card-copy">
                    <strong>{tx('ระบุที่อยู่สำหรับรับเอกสาร/จัดส่งอุปกรณ์ทางไปรษณีย์')}</strong>
                    <span className="muted-inline">
                      {tx('บันทึกที่อยู่สำหรับจัดส่งเสื้อและของที่ระลึกตามเงื่อนไขของผู้จัดงาน')}
                    </span>
                    <span className="reg-tag-row">
                      <PriceTag prefix="+" satang={kitFee.satang} />
                      <NoteTag>{tx('ค่าจัดส่งชุดแข่ง')}</NoteTag>
                      {kitFee.isSample && <NoteTag>{tx('ค่าตัวอย่าง ผู้จัดยังไม่ได้กำหนด')}</NoteTag>}
                    </span>
                  </div>
                </label>
              </div>

              {delivery === 'postal' && (
                <section className="reg-lab-section" aria-labelledby="lab-ship">
                  <h3 id="lab-ship">{tx('ที่อยู่สำหรับจัดส่ง')}</h3>

                  {book.length > 0 && (
                    <fieldset className="pg-group reg-lab-addr-tabs">
                      <legend className="sr-only">{tx('วิธีระบุที่อยู่')}</legend>
                      <div className="pg-tabs">
                        {(
                          [
                            ['saved', 'เลือกจากสมุดที่อยู่'],
                            ['manual', 'กรอกที่อยู่ใหม่'],
                          ] as const
                        ).map(([mode, label]) => (
                          <label key={mode} className={`pg-tab ${addrMode === mode ? 'is-selected' : ''}`}>
                            <input
                              type="radio"
                              name="lab-addr-mode"
                              checked={addrMode === mode}
                              onChange={() => {
                                setAddrNotice(null);
                                setAddrMode(mode);
                              }}
                            />
                            <span>{tx(label)}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  )}

                  {addrNotice && (
                    <p
                      className={`ship-addr-notice ${addrNotice.tone === 'err' ? 'is-error' : ''}`}
                      role={addrNotice.tone === 'err' ? 'alert' : 'status'}
                    >
                      {addrNotice.tone === 'err' ? <IconAlert size={15} /> : <IconCheckCircle size={15} />}
                      <span>{addrNotice.text}</span>
                    </p>
                  )}

                  {addrMode === 'saved' && book.length > 0 ? (
                    <div className="reg-lab-choices reg-lab-book" role="radiogroup" aria-label={tx('เลือกจากสมุดที่อยู่')}>
                      {book.map((addr) => (
                        <label
                          key={addr.id}
                          className={`reg-category-radio-card ${bookId === addr.id ? 'selected' : ''}`}
                        >
                          <input
                            type="radio"
                            name="lab-book"
                            checked={bookId === addr.id}
                            onChange={() => setBookId(addr.id)}
                          />
                          <span className="custom-radio-circle" aria-hidden="true" />
                          <div className="reg-radio-card-copy">
                            <strong>
                              {addr.addressName}
                              {addr.isDefault ? ` · ${tx('ค่าเริ่มต้น')}` : ''}
                            </strong>
                            <span className="muted-inline">
                              {addr.recipientName} ({addr.phone})
                            </span>
                            <span className="muted-inline">
                              {addr.address}, ต.{addr.subdistrict} อ.{addr.district} จ.{addr.province}{' '}
                              <span className="mono-num">{addr.postalCode}</span>
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="reg-lab-fields">
                        <div className="form-row reg-lab-full">
                          <label htmlFor="lab-addr-name">{tx('ชื่อเรียกที่อยู่')}</label>
                          <input
                            id="lab-addr-name"
                            type="text"
                            value={addrName}
                            maxLength={60}
                            placeholder={tx('เช่น บ้านพัก / ที่ทำงาน')}
                            onChange={(e) => setAddrName(e.target.value)}
                          />
                        </div>
                        <div className="form-row reg-lab-full">
                          <label htmlFor="lab-recipient"><RequiredFieldText text={tx('ชื่อผู้รับ *')} /></label>
                          <input id="lab-recipient" type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                        </div>
                        <div className="form-row reg-lab-full">
                          <label htmlFor="lab-ship-phone"><RequiredFieldText text={tx('เบอร์โทรผู้รับ *')} /></label>
                          <PhoneInput id="lab-ship-phone" value={shipPhone} onChange={setShipPhone} />
                        </div>
                      </div>
                      <div className="reg-lab-address">
                        <ThaiPostalAddressSelector
                          idPrefix="lab-ship"
                          value={address}
                          onChange={setAddress}
                          contactName={recipient}
                          contactPhone={shipPhone}
                          contactEmail={currentUser?.contactEmail}
                          required
                          streetAddressLabel={tx('ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)')}
                          summaryFooter={
                            <div className="ship-addr-save-row">
                              <span className="muted-inline">
                                {tx('ไม่บันทึกก็ได้ ที่อยู่นี้จะใช้เฉพาะการสมัครครั้งนี้')}
                              </span>
                              <button type="button" className="btn-secondary" disabled={addrSaving} onClick={() => void saveToBook()}>
                                {addrSaving ? tx('กำลังบันทึก…') : tx('บันทึกลงสมุดที่อยู่')}
                              </button>
                            </div>
                          }
                        />
                      </div>
                    </>
                  )}
                </section>
              )}
              {footer(beforeAddress, 6)}
            </>
          )}

          {/* ---------- STEP 6: review the whole form ---------- */}
          {step === 6 && category && tier && quote && (() => {
            const idDigits = idNumber.replace(/\s/g, '');
            const bookAddr = book.find((x) => x.id === bookId);
            const shipText =
              addrMode === 'saved' && bookAddr
                ? `${bookAddr.recipientName} (${bookAddr.phone}) — ${bookAddr.address}, ต.${bookAddr.subdistrict} อ.${bookAddr.district} จ.${bookAddr.province} ${bookAddr.postalCode}`
                : `${recipient} (${shipPhone}) — ${address.address}, ต.${address.subdistrict} อ.${address.district} จ.${address.province} ${address.postalCode}`;
            const answerRows = (event.customFields ?? [])
              .filter((f) => !isContentField(f) && fieldShown(f, answers, { raceDistance: category.code, shirtSize }))
              .map((f) => {
                const val = answers[f.id] ?? f.defaultValue;
                return {
                  label: tx(f.label),
                  value: typeof val === 'boolean' ? (val ? tx('ใช่') : tx('ไม่ใช่')) : tx(answerText(f, val).trim()),
                };
              });
            const sections: ReviewSection[] = [
              {
                key: 'entry',
                title: tx('การสมัคร'),
                editStep: 1,
                rows: [
                  { label: tx('ประเภท'), value: picked ? tx(picked.label) : '' },
                  {
                    label: tx('ระยะ'),
                    value: `${tx(category.name)} · ${tx('ปล่อยตัว')} ${category.startTimeLocal} ${tx('น.')}`,
                  },
                  { label: tx('อัตราค่าสมัคร'), value: tx(tier.label) },
                  {
                    label: tx('เสื้อตามสิทธิ์'),
                    value: `${tx(shirtStyleName(shirtStyle))} · ${shirtSize}`,
                    editStep: 3,
                  },
                ],
              },
              {
                key: 'runner',
                title: tx('ผู้เข้าแข่งขัน'),
                editStep: 2,
                rows: [
                  {
                    label: tx('ชื่อ-นามสกุล'),
                    value: nickTh.trim() ? `${participantName} (${nickTh.trim()})` : participantName,
                  },
                  { label: tx('ชื่อภาษาอังกฤษ'), value: `${firstEn} ${lastEn}`.trim() },
                  { label: tx('วันเกิด · เพศ'), value: [dob, tx(gender)].filter(Boolean).join(' · ') },
                  { label: tx('เบอร์โทร'), value: displayPhone(phone) },
                  {
                    label: idType === 'passport' ? tx('หนังสือเดินทาง') : tx('เลขบัตรประชาชน'),
                    value: idDigits ? `•••• ${idDigits.slice(-4)}` : '',
                  },
                  { label: tx('ผู้ติดต่อฉุกเฉิน'), value: tx(emergency.trim()) },
                  ...answerRows,
                ],
              },
              {
                key: 'kit',
                title: tx('การรับอุปกรณ์'),
                editStep: 5,
                rows: [
                  {
                    label: tx('วิธีรับ'),
                    value: delivery === 'postal' ? tx('จัดส่งทางไปรษณีย์') : tx('รับเองที่หน้างาน (QR Check-in)'),
                  },
                  ...(delivery === 'postal' ? [{ label: tx('ส่งถึง'), value: tx(shipText.trim()) }] : []),
                ],
              },
            ];
            const ledger: ReviewLedgerGroup[] = [
              {
                key: 'entry',
                lines: [
                  {
                    label: txf('ค่าสมัคร {0} ({1})', tx(category.name), tx(tier.label)),
                    sub: txf('{0} · ไซส์ {1}', tx(shirtStyleName(shirtStyle)), shirtSize),
                    satang: quote.baseSatang,
                  },
                  {
                    label: txf('ค่าบริการระบบ ({0})', feePolicyLabel(event.feeBearerPolicy)),
                    satang: quote.runnerFeeSatang,
                  },
                ],
              },
              {
                key: 'souvenir',
                title: txf('ของที่ระลึก {0} ชิ้น', addonLines.reduce((n, l) => n + l.qty, 0)),
                editStep: 4,
                lines: addonLines.map((l) => ({
                  label: `${tx(l.prd.nameTh)}${l.size !== '-' && l.prd.availableSizes.length > 1 ? ` · ${l.size}` : ''} ×${l.qty}`,
                  satang: l.prd.priceSatang * l.qty,
                })),
              },
              {
                key: 'ship',
                lines:
                  shipQuote.kitSatang > 0
                    ? [
                        {
                          label: tx('ค่าจัดส่งชุดแข่ง (ของที่ระลึกจากผู้จัดส่งรวมกล่องนี้)'),
                          satang: shipQuote.kitSatang,
                        },
                        ...shipQuote.sellers.map((x) => ({
                          label: txf('ค่าจัดส่งของที่ระลึก ({0})', tx(x.seller)),
                          satang: x.satang,
                        })),
                      ]
                    : [],
              },
            ];
            return (
              <>
                <div className="reg-lab-title">
                  <h2>{tx('ตรวจข้อมูลก่อนชำระเงิน')}</h2>
                  <p>{tx('ตรวจทุกส่วนให้ถูกต้อง ถ้าต้องการเปลี่ยน กด "แก้ไข" เพื่อกลับไปขั้นนั้น')}</p>
                </div>
                <RegistrationSummary
                  sections={sections}
                  ledger={ledger}
                  totalSatang={totalSatang}
                  onEdit={(st) => go(st as LabStep)}
                  action={{ label: 'ไปชำระเงิน', onClick: () => go(7) }}
                />
                {footer(5, null)}
              </>
            );
          })()}

          {/* ---------- STEP 7: payment ---------- */}
          {step === 7 && category && tier && quote && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('ชำระเงินและยืนยันการสมัคร')}</h2>
                <p>{tx('ยอดคำนวณจากราคาปัจจุบันของงาน')}</p>
              </div>

              <section className="reg-lab-section" aria-labelledby="lab-sum">
                <h3 id="lab-sum">{tx('ยอดที่ต้องชำระ')}</h3>
                <dl className="reg-lab-ledger">
                  <div className="reg-lab-ledger-total">
                    <dt>{tx('ยอดชำระสุทธิทั้งหมด')}</dt>
                    <dd className="mono-num text-vermilion">{formatThb(totalSatang, true)}</dd>
                  </div>
                </dl>
              </section>

              <section className="reg-lab-section">
                <PaymentMethodPicker name="lab-pay" value={channel} onChange={setChannel} />
              </section>

              {live.payError}

              <section className="reg-lab-section">
                <RegistrationTerms
                  event={event}
                  organization={organization}
                  acceptRules={acceptRules}
                  onAcceptRules={setAcceptRules}
                  acceptPayment={acceptPayTerms}
                  onAcceptPayment={setAcceptPayTerms}
                />
              </section>

              <div className="reg-lab-footer">
                <button type="button" className="btn-secondary" disabled={live.submitting} onClick={() => go(6)}>
                  {tx('ย้อนกลับ')}
                </button>
                <div className="reg-lab-footer-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!acceptRules || !acceptPayTerms || live.submitting}
                    onClick={live.submit}
                  >
                    {tx('ชำระเงินและยืนยันการสมัครทันที')}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ---------- STEP 8: booked, on its own centred screen ---------- */}
          {step === 8 && live.done}
        </div>
      </section>
    </main>
  );
}
