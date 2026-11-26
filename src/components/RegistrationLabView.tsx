import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  EventProduct,
  OrganizerFormStep,
  RunnerSavedAddress,
  RunnerEmergencyContact,
  SavedParticipant,
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
import { MAX_EMERGENCY_CONTACTS, resolveShirtSpec } from '../data/runnerProfileDefaults';
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
import { SHIRT_PHOTOS } from '../data/productPhotos';

/** shirt cut picked on the shirt step */
type ShirtCut = 'Men' | 'Women' | 'Kids';
const SHIRT_CUTS: { id: ShirtCut; label: string }[] = [
  { id: 'Men', label: 'ชาย' },
  { id: 'Women', label: 'หญิง' },
  { id: 'Kids', label: 'เด็ก' },
];
/** sample kids' measurements: the unisex chart minus 8" chest and 6" length (no real kids chart yet) */
const shrinkInch = (v: string, by: number) => v.replace(/\d+(\.\d+)?/, (n) => String(Math.max(0, Number(n) - by)));
const kidsSampleSpec = (m: { chestInch: string; lengthInch: string }) => ({
  ...m,
  chestInch: shrinkInch(m.chestInch, 8),
  lengthInch: shrinkInch(m.lengthInch, 6),
});
import { ThaiPostalAddressSelector, type CascadingAddressValue } from './ThaiPostalAddressSelector';
import { SavedAddressModal, type SavedAddressDraft } from './SavedAddressModal';
import { SavedParticipantModal } from './SavedParticipantModal';
import { SavedCardPicker } from './SavedCardPicker';
import { EmergencyContactModal, type EmergencyContactDraft } from './EmergencyContactModal';
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
import { DefaultAvatarImg } from './DefaultAvatar';
import { firstFriendContactProblem, friendContactProblems } from '../utils/friendContact';

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
  /** keeps an edited saved participant / emergency contact in the runner's profile (signed in only) */
  saveParticipants?: (list: SavedParticipant[]) => Promise<{ ok: boolean; error?: string }>;
  saveEmergencyContacts?: (list: RunnerEmergencyContact[]) => Promise<{ ok: boolean; error?: string }>;
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
  /** a friend's own email (registering someone else) */
  email: Pair<string>;
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
  // the souvenir step shows only when something is still on sale (sold-out items are hidden)
  const hasSouvenirs = event.products.some((p) => p.stockOrCeiling - p.soldCount > 0);
  const steps: { step: LabStep; label: string }[] = [
    { step: 1, label: 'เริ่ม' },
    { step: 2, label: 'ข้อมูล' },
    ...live.ownSteps.map((st, i) => ({ step: 2 + (i + 1) / 10, label: st.title })),
    { step: 3, label: 'เสื้อที่ระลึก' },
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
  const [email, setEmail] = shared.email;
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
    email?: string;
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
    setEmail(p?.email ?? '');
    setIdType(p?.idType === 'passport' ? 'passport' : 'thai_id');
    setIdNumber(p?.idNumber ?? '');
    setEmergency(p?.emergencyContactName ?? '', p?.emergencyContactRelation ?? '', p?.emergencyContactPhone ?? '');
  };

  // saved participants and emergency contacts start from the profile; edits made here are kept
  // in the profile too and shown at once (25 Nov 2026, user request: work like the address step)
  const [saved, setSaved] = useState<SavedParticipant[]>(profile?.savedParticipants ?? []);
  const [contacts, setContacts] = useState<RunnerEmergencyContact[]>(profile?.emergencyContacts ?? []);
  // the profile can arrive after this page opens (a direct link / reload), and saving here updates it
  useEffect(() => {
    setSaved(profile?.savedParticipants ?? []);
  }, [profile?.savedParticipants]);
  useEffect(() => {
    setContacts(profile?.emergencyContacts ?? []);
  }, [profile?.emergencyContacts]);
  // a friend has their own email and phone, never the account owner's (26 Nov 2026, user request)
  const ownerContact = { email: currentUser?.contactEmail, phone: profile?.phone };
  const friendProblems =
    forSelf === false ? friendContactProblems({ email, phone }, ownerContact, { requireBoth: true }) : {};
  const [friendContactCheck, setFriendContactCheck] = useState(false);
  const shownFriendProblems = friendContactCheck ? friendProblems : {};
  const ageCheck = category ? evaluateCategoryAge(event, category, dob, gender) : null;
  // a distance with an age limit or age groups needs the date of birth (26 Nov 2026, user request)
  const dobRequired = Boolean(ageCheck && ageCheck.status !== 'not_required');

  /* participant: "เลือกจากรายชื่อที่บันทึกไว้" or "กรอกผู้สมัครใหม่" ('new') */
  const partMode: 'saved' | 'manual' = saved.length > 0 && savedId !== 'new' ? 'saved' : 'manual';

  // The organizer's questions belong to the person being registered: changing who that is
  // (yourself / a friend / another friend / a new one) clears the answers, so one person's
  // blood group never lands on someone else's entry (26 Nov 2026, user request)
  const answersOwner = forSelf === null ? '' : forSelf ? 'self' : savedId || 'new';
  const lastAnswersOwner = useRef(answersOwner);
  const keepAnswersOnce = useRef(false);
  useEffect(() => {
    if (lastAnswersOwner.current === answersOwner) return;
    const was = lastAnswersOwner.current;
    lastAnswersOwner.current = answersOwner;
    // saving the friend being typed only gives that same person an id
    if (keepAnswersOnce.current) {
      keepAnswersOnce.current = false;
      return;
    }
    if (was !== '') setAnswers({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answersOwner]);
  const lastSavedId = useRef<string>('');
  const [partEditId, setPartEditId] = useState<string | null>(null);
  const [step2Notice, setStep2Notice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const pickParticipant = (id: string) => {
    setSavedId(id);
    fillFrom(saved.find((x) => x.id === id) ?? null);
  };
  const saveEditedParticipant = async (item: SavedParticipant) => {
    const next = saved.map((x) => (x.id === item.id ? item : x));
    if (live.saveParticipants) {
      const res = await live.saveParticipants(next);
      if (!res.ok) {
        setStep2Notice({ tone: 'err', text: res.error ?? tx('บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง') });
        setPartEditId(null);
        return;
      }
    }
    setSaved(next);
    if (savedId === item.id) fillFrom(item);
    setPartEditId(null);
    setStep2Notice({ tone: 'ok', text: tx('อัปเดตข้อมูลผู้สมัครแทนเรียบร้อยแล้ว') });
  };

  /* emergency contact (registering for yourself): pick from the profile or type a new one */
  const [ecMode, setEcMode] = useState<'saved' | 'manual'>('saved');
  const [ecEditId, setEcEditId] = useState<string | null>(null);
  const pickedEc = contacts.find(
    (c) => c.contactName === emergencyName && c.phone === emergencyPhone
  );
  const ecFromProfile = forSelf === true && contacts.length > 0 && ecMode === 'saved';
  // in "from the profile" mode one contact is always picked, so the hidden fields are never empty
  useEffect(() => {
    if (!ecFromProfile || pickedEc) return;
    const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
    if (primary) setEmergency(primary.contactName, primary.relationship, primary.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecFromProfile, pickedEc, contacts]);
  const saveEditedContact = async (d: EmergencyContactDraft) => {
    const wasPicked = pickedEc?.id === ecEditId;
    const next = contacts.map((c) => (c.id === ecEditId ? { ...c, ...d } : c));
    if (live.saveEmergencyContacts) {
      const res = await live.saveEmergencyContacts(next);
      if (!res.ok) {
        setStep2Notice({ tone: 'err', text: res.error ?? tx('บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง') });
        setEcEditId(null);
        return;
      }
    }
    setContacts(next);
    if (wasPicked) setEmergency(d.contactName, d.relationship, d.phone);
    setEcEditId(null);
    setStep2Notice({ tone: 'ok', text: tx('บันทึกข้อมูลผู้ติดต่อฉุกเฉินเรียบร้อยแล้ว') });
  };

  /* "บันทึก" buttons in the manual tabs (26 Nov 2026, user request): save what was typed, then go
     back to the "pick from saved" tab with the new entry picked */
  const [savingNew, setSavingNew] = useState(false);
  const saveNewContact = async () => {
    const name = emergencyName.trim();
    const rel = emergencyRelation.trim();
    const ph = emergencyPhone.trim();
    if (!name || !rel || ph.replace(/\D/g, '').length < 9) {
      setStep2Notice({ tone: 'err', text: tx('กรอกชื่อ ความสัมพันธ์ และเบอร์โทร (9–10 หลัก) ให้ครบก่อนบันทึก') });
      return;
    }
    const digits = (v: string) => v.replace(/\D/g, '');
    const dup = contacts.find((c) => c.contactName.trim() === name && digits(c.phone) === digits(ph));
    if (dup) {
      setEcMode('saved');
      setEmergency(dup.contactName, dup.relationship, dup.phone);
      setStep2Notice({ tone: 'ok', text: tx('มีผู้ติดต่อนี้ในโปรไฟล์แล้ว เลือกให้แล้ว') });
      return;
    }
    if (contacts.length >= MAX_EMERGENCY_CONTACTS) {
      setStep2Notice({
        tone: 'err',
        text: txf('โปรไฟล์มีผู้ติดต่อฉุกเฉินครบ {0} คนแล้ว ใช้ผู้ติดต่อนี้กับการสมัครครั้งนี้ได้ แต่บันทึกเพิ่มไม่ได้', MAX_EMERGENCY_CONTACTS),
      });
      return;
    }
    const entry: RunnerEmergencyContact = {
      id: `ec-${Date.now().toString(36)}`,
      contactName: name,
      relationship: rel,
      phone: ph,
      isPrimary: contacts.length === 0,
    };
    const next = [...contacts, entry];
    if (live.saveEmergencyContacts) {
      setSavingNew(true);
      const res = await live.saveEmergencyContacts(next);
      setSavingNew(false);
      if (!res.ok) {
        setStep2Notice({ tone: 'err', text: res.error ?? tx('บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง') });
        return;
      }
    }
    setContacts(next);
    setEcMode('saved');
    setEmergency(entry.contactName, entry.relationship, entry.phone);
    setStep2Notice({ tone: 'ok', text: tx('บันทึกผู้ติดต่อฉุกเฉินลงโปรไฟล์แล้ว') });
  };

  const saveNewFriend = async () => {
    if (!firstEn.trim() || !lastEn.trim()) {
      setStep2Notice({ tone: 'err', text: tx('กรอกชื่อและนามสกุลภาษาอังกฤษของเพื่อนก่อนบันทึก') });
      return;
    }
    const contactProblem = firstFriendContactProblem(friendProblems);
    if (contactProblem) {
      setFriendContactCheck(true);
      setStep2Notice({ tone: 'err', text: tx(contactProblem) });
      return;
    }
    const idDigits = idNumber.replace(/\s/g, '');
    const same = (a?: string, b?: string) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
    const dup = saved.find(
      (x) => (idDigits && x.idNumber === idDigits) || (same(x.firstNameEn, firstEn) && same(x.lastNameEn, lastEn))
    );
    if (dup) {
      pickParticipant(dup.id);
      setStep2Notice({ tone: 'ok', text: tx('มีเพื่อนคนนี้ในรายชื่อแล้ว เลือกให้แล้ว') });
      return;
    }
    const item: SavedParticipant = {
      id: `sp-${Date.now().toString(36)}`,
      firstName: firstTh.trim(),
      lastName: lastTh.trim(),
      nickname: nickTh.trim() || undefined,
      firstNameEn: firstEn.trim(),
      lastNameEn: lastEn.trim(),
      nicknameEn: nickEn.trim() || undefined,
      dateOfBirth: dob || undefined,
      gender,
      idType: idDigits ? idType : 'none',
      idNumber: idDigits || undefined,
      phone: phone.trim() || undefined,
      email: email.trim().toLowerCase() || undefined,
      emergencyContactName: emergencyName.trim() || undefined,
      emergencyContactRelation: emergencyRelation.trim() || undefined,
      emergencyContactPhone: emergencyPhone.trim() || undefined,
    };
    const next = [...saved, item];
    if (live.saveParticipants) {
      setSavingNew(true);
      const res = await live.saveParticipants(next);
      setSavingNew(false);
      if (!res.ok) {
        setStep2Notice({ tone: 'err', text: res.error ?? tx('บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง') });
        return;
      }
    }
    setSaved(next);
    keepAnswersOnce.current = true;
    setSavedId(item.id);
    setStep2Notice({ tone: 'ok', text: tx('บันทึกลงรายชื่อเพื่อนแล้ว') });
  };

  const step2NoticeEl = step2Notice && (
    <p
      className={`ship-addr-notice ${step2Notice.tone === 'err' ? 'is-error' : ''}`}
      role={step2Notice.tone === 'err' ? 'alert' : 'status'}
    >
      {step2Notice.tone === 'err' ? <IconAlert size={15} /> : <IconCheckCircle size={15} />}
      <span>{step2Notice.text}</span>
    </p>
  );

  /** two tabs like the address step ("เลือกจาก…" / "กรอก…ใหม่") */
  const modeTabs = (
    name: string,
    legend: string,
    value: 'saved' | 'manual',
    labels: [string, string],
    onPick: (mode: 'saved' | 'manual') => void
  ) => (
    <fieldset className="pg-group reg-lab-addr-tabs">
      <legend className="sr-only">{tx(legend)}</legend>
      <div className="pg-tabs">
        {(['saved', 'manual'] as const).map((mode, i) => (
          <label key={mode} className={`pg-tab ${value === mode ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name={name}
              checked={value === mode}
              onChange={() => {
                setStep2Notice(null);
                onPick(mode);
              }}
            />
            <span>{tx(labels[i])}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  /** age at the event's basis date + age group (shown under the cards when the fields are hidden) */
  const ageHint = (
    ageCheck && category && (ageCheck.ageYears !== null || ageCheck.status === 'missing_dob' || ageCheck.status === 'invalid_dob') && (
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
                      )
  );

  /* saved-item text for the card picker's search, its "ดูทั้งหมด" rows and its order */
  /** Thai nickname, or the English one when there is none (English first in EN), like the profile page */
  // the English name (as on the BIB) leads, with the English nickname (26 Nov 2026, user request)
  const ptNick = (pt: SavedParticipant) => pt.nicknameEn || pt.nickname || '';
  const ptName = (pt: SavedParticipant) => {
    const th = `${pt.firstName} ${pt.lastName}`.trim();
    const en = `${pt.firstNameEn ?? ''} ${pt.lastNameEn ?? ''}`.trim();
    // nickname first, as on the profile page (25 Nov 2026, user request)
    const nick = ptNick(pt);
    return `${nick ? `(${nick}) ` : ''}${en || th}`;
  };
  const ptMeta = (pt: SavedParticipant) =>
    [
      pt.relationshipToOwner ? tx(pt.relationshipToOwner) : '',
      pt.dateOfBirth ? txf('เกิด {0}', formatBasisDate(pt.dateOfBirth)) : '',
      pt.phone ? displayPhone(pt.phone) : '',
    ]
      .filter(Boolean)
      .join(' · ');
  const ptSearch = (pt: SavedParticipant) =>
    [pt.firstName, pt.lastName, pt.nickname, pt.firstNameEn, pt.lastNameEn, pt.nicknameEn, pt.phone, pt.relationshipToOwner]
      .filter(Boolean)
      .join(' ');
  // most recently registered first; never used ones keep their saved order at the end
  const byLastUsed = (a: SavedParticipant, b: SavedParticipant) =>
    (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? '');
  const primaryFirst = (a: RunnerEmergencyContact, b: RunnerEmergencyContact) =>
    Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary));
  const defaultFirst = (a: RunnerSavedAddress, b: RunnerSavedAddress) =>
    Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault));

  /** filled tag for the primary contact / default address, on its own beside the name (26 Nov 2026) */
  const primaryTag = (label: string) => (
    <span className="reg-primary-tag">
      <IconCheckCircle size={12} />
      <span>{tx(label)}</span>
    </span>
  );

  const editButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      className="btn-secondary reg-lab-book-edit"
      aria-label={`${tx('แก้ไข')} ${label}`}
      onClick={(e) => {
        e.preventDefault();
        setStep2Notice(null);
        onClick();
      }}
    >
      {tx('แก้ไข')}
    </button>
  );

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
  // follow the profile once it loads (it can arrive after this page opens)
  useEffect(() => {
    if (profile?.savedAddresses) setBook(profile.savedAddresses);
  }, [profile?.savedAddresses]);
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

  // edit a saved address in the same dialog as the profile's address book (25 Nov 2026, user request)
  const [editAddrId, setEditAddrId] = useState<string | null>(null);
  const saveEditedAddr = async (d: SavedAddressDraft) => {
    const idx = book.findIndex((x) => x.id === editAddrId);
    if (idx < 0) return;
    const patch = {
      addressName: d.label || txf('ที่อยู่ที่ {0}', idx + 1),
      recipientName: d.recipientName,
      phone: d.phone,
      address: d.address,
      province: d.province,
      district: d.district,
      subdistrict: d.subdistrict,
      postalCode: d.postalCode,
      country: d.country,
    };
    const profileList = profile?.savedAddresses ?? [];
    // only addresses already in the profile go to the server; one kept for this registration stays local
    if (live.saveAddresses && profileList.some((x) => x.id === editAddrId)) {
      const res = await live.saveAddresses(profileList.map((x) => (x.id === editAddrId ? { ...x, ...patch } : x)));
      if (!res.ok) {
        setAddrNotice({ tone: 'err', text: res.error ?? tx('บันทึกที่อยู่ไม่สำเร็จ กรุณาลองอีกครั้ง') });
        setEditAddrId(null);
        return;
      }
    }
    setBook((b) => b.map((x) => (x.id === editAddrId ? { ...x, ...patch } : x)));
    setEditAddrId(null);
    setAddrNotice({ tone: 'ok', text: tx('บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว') });
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
    // show the friend's email / phone problems next to the fields along with any other gaps
    if (step === 2 && forSelf === false) setFriendContactCheck(true);
    let problem = live.check(step, bodyRef.current);
    if (!problem && step === 2 && forSelf === false && partMode === 'saved' && (!emergencyName.trim() || !emergencyPhone.trim())) {
      problem = 'เพื่อนคนนี้ยังไม่มีผู้ติดต่อฉุกเฉิน กด แก้ไข ที่การ์ดเพื่อเพิ่ม';
    }
    if (!problem && step === 2 && forSelf === false) {
      const contactProblem = firstFriendContactProblem(friendProblems);
      if (contactProblem) {
        setFriendContactCheck(true);
        problem =
          partMode === 'saved'
            ? friendProblems.email && !email.trim()
              ? 'เพื่อนคนนี้ยังไม่มีอีเมล กด แก้ไข ที่การ์ดเพื่อเพิ่ม'
              : friendProblems.phone && !phone.trim()
                ? 'เพื่อนคนนี้ยังไม่มีเบอร์โทร กด แก้ไข ที่การ์ดเพื่อเพิ่ม'
                : `${contactProblem} กด แก้ไข ที่การ์ดเพื่อแก้`
            : contactProblem;
      }
    }
    if (!problem && step === 3 && !shirtSize) {
      problem = 'กรุณาเลือกไซส์เสื้อตามสิทธิ์สมัคร';
      document.querySelector('.reg-lab-body .pg-tabbed')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
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

  /* shirt cut: ชาย / หญิง / เด็ก (26 Nov 2026, user request). Kept on this page only for now:
     the registration stores the size; storing the cut and the finisher size is a backend task. */
  const defaultCut = (): ShirtCut => {
    const pref = forSelf ? profile?.preferredShirtType : undefined;
    if (pref === 'Men' || pref === 'Women') return pref;
    return gender === 'หญิง' ? 'Women' : 'Men';
  };
  const [shirtCutPick, setShirtCut] = useState<ShirtCut | null>(null);
  const shirtCut = shirtCutPick ?? defaultCut();
  // finisher shirt: on unless the organizer turns it off (the organizer switch is not built yet)
  const hasFinisher = event.finisherShirtEnabled ?? true;
  const [finisherSize, setFinisherSize] = useState('');
  const [finisherCutPick, setFinisherCut] = useState<ShirtCut | null>(null);
  const finisherCut = finisherCutPick ?? shirtCut;
  const cutLabel = (c: ShirtCut) => SHIRT_CUTS.find((x) => x.id === c)?.label ?? c;

  const shirtSpec = (size: ShirtSizeCode, cut: ShirtCut = shirtCut) => {
    const spec = resolveShirtSpec(
      size,
      cut === 'Kids' ? 'Unisex' : cut,
      platformProfileConfig?.shirtSizes,
      event.customSizeChart
    );
    return cut === 'Kids' ? kidsSampleSpec(spec) : spec;
  };

  const allStyles: ShirtGalleryStyle[] = SHIRT_STYLES.map((style) => ({
    id: style.id,
    name: style.nameTh,
    art: style.art,
    photo: style.photo,
    demo: style.demoStock !== null,
    sizes: (style.demoStock ?? event.shirtStocks).map((st) => {
      const spec = shirtSpec(st.size, shirtCut);
      return {
        size: st.size,
        chest: spec.chestInch,
        length: spec.lengthInch,
        left: Math.max(0, st.total - st.reservedOrConfirmed),
      };
    }),
  }));
  // a style sold out in every size is hidden like the sold-out sizes
  const inStockStyles = allStyles.filter((st) => st.sizes.some((z) => z.left > 0));
  const galleryStyles = inStockStyles.length > 0 ? inStockStyles : allStyles;
  useEffect(() => {
    if (!galleryStyles.some((st) => st.id === shirtStyle)) setShirtStyle(galleryStyles[0].id as ShirtStyleId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryStyles.map((st) => st.id).join('|'), shirtStyle]);

  // one style; every size of the event, no stock count shown (stock is not set up yet)
  const finisherStyle: ShirtGalleryStyle = {
    id: 'finisher',
    name: 'เสื้อ Finisher',
    art: 'tee',
    photo: SHIRT_PHOTOS.finisher,
    demo: false,
    sizes: event.shirtStocks.map((st) => {
      const spec = shirtSpec(st.size, finisherCut);
      return { size: st.size, chest: spec.chestInch, length: spec.lengthInch, left: 1 };
    }),
  };

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

                {forSelf === false && saved.length > 0 && (
                  <>
                    {modeTabs(
                      'lab-part-mode',
                      'วิธีระบุผู้เข้าแข่งขัน',
                      partMode,
                      ['เลือกจากรายชื่อเพื่อนที่สมัครให้', 'กรอกผู้สมัครใหม่'],
                      (mode) => {
                        if (mode === 'manual') {
                          if (savedId !== 'new') lastSavedId.current = savedId;
                          setSavedId('new');
                          fillFrom(null);
                        } else {
                          const back = saved.find((x) => x.id === lastSavedId.current) ?? saved[0];
                          pickParticipant(back.id);
                        }
                      }
                    )}
                    {step2NoticeEl}
                    {partMode === 'saved' && (
                      <SavedCardPicker
                        items={saved}
                        selectedId={savedId}
                        getId={(pt) => pt.id}
                        searchText={ptSearch}
                        title={ptName}
                        meta={ptMeta}
                        compare={byLastUsed}
                        orderLabel="ใช้ล่าสุด"
                        onPick={pickParticipant}
                        groupLabel="เลือกจากรายชื่อเพื่อนที่สมัครให้"
                        searchPlaceholder="ค้นหาชื่อ ชื่อเล่น หรือเบอร์โทร"
                        allTitle="รายชื่อเพื่อนที่สมัครให้ทั้งหมด"
                        idPrefix="lab-saved"
                        renderCard={(pt) => {
                          const nameTh = `${pt.firstName} ${pt.lastName}`.trim();
                          const nameEn = `${pt.firstNameEn ?? ''} ${pt.lastNameEn ?? ''}`.trim();
                          const missingEn = !(pt.firstNameEn ?? '').trim() || !(pt.lastNameEn ?? '').trim();
                          return (
                            <label key={pt.id} className={`reg-category-radio-card ${savedId === pt.id ? 'selected' : ''}`}>
                              <input
                                type="radio"
                                name="lab-saved"
                                checked={savedId === pt.id}
                                onChange={() => pickParticipant(pt.id)}
                              />
                              <span className="custom-radio-circle" aria-hidden="true" />
                              <div className="reg-radio-card-copy">
                                <span className="reg-card-head">
                                  <span className="runner-avatar-frame sm" aria-hidden="true">
                                    {pt.avatarDataUrl ? (
                                      <img src={pt.avatarDataUrl} alt="" className="runner-avatar-img" />
                                    ) : (
                                      <DefaultAvatarImg />
                                    )}
                                  </span>
                                  <strong>
                                    {ptNick(pt) ? `(${ptNick(pt)}) ` : ''}
                                    {nameEn || nameTh}
                                  </strong>
                                </span>
                                {nameTh && nameEn && <span className="muted-inline">{nameTh}</span>}
                                <span className="muted-inline">
                                  {[
                                    pt.relationshipToOwner ? tx(pt.relationshipToOwner) : '',
                                    pt.dateOfBirth ? txf('เกิด {0}', formatBasisDate(pt.dateOfBirth)) : '',
                                    pt.phone ? displayPhone(pt.phone) : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                                {missingEn && (
                                  <span className="reg-tag-row">
                                    <NoteTag>{tx('ยังไม่มีชื่อภาษาอังกฤษ กด แก้ไข เพื่อเพิ่ม')}</NoteTag>
                                  </span>
                                )}
                                {(!pt.emergencyContactName || !pt.emergencyContactPhone) && (
                                  <span className="reg-tag-row">
                                    <NoteTag>{tx('ยังไม่มีผู้ติดต่อฉุกเฉิน กด แก้ไข เพื่อเพิ่ม')}</NoteTag>
                                  </span>
                                )}
                                {dobRequired && !pt.dateOfBirth && (
                                  <span className="reg-tag-row">
                                    <NoteTag>{tx('ระยะนี้ต้องใช้วันเกิด กด แก้ไข เพื่อเพิ่ม')}</NoteTag>
                                  </span>
                                )}
                              </div>
                              {editButton(nameTh || nameEn, () => setPartEditId(pt.id))}
                            </label>
                          );
                        }}
                      />
                    )}
                  </>
                )}

                {forSelf === false && (
                  <div className="reg-lab-fields">
                    <div className="form-row reg-lab-full">
                      <label htmlFor="lab-buyer">
                        <RequiredFieldText text={tx('ชื่อ-นามสกุลผู้ซื้อคำสั่งซื้อ (ผู้ชำระเงิน) *')} />
                      </label>
                      <input id="lab-buyer" type="text" required value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
                    </div>
                  </div>
                )}
              </section>

              {forSelf === false && partMode === 'saved' && ageHint}

              {forSelf !== null && (
                <>
                  {!(forSelf === false && partMode === 'saved') && (
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
                        <label htmlFor="lab-dob">
                          {dobRequired ? <RequiredFieldText text={tx('วันเกิด *')} /> : tx('วันเกิด')}
                        </label>
                        <DateOfBirthInput
                          id="lab-dob"
                          valueIso={dob}
                          onChangeIso={setDob}
                          required={dobRequired}
                          // a full date that fails the age rule is marked at once
                          invalid={Boolean(dob && ageCheck && !ageCheck.eligible)}
                          ariaDescribedBy="lab-dob-age"
                        />
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
                      {ageHint}
                      {forSelf === false ? (
                        <>
                          {/* the friend's own phone and email, never the account owner's */}
                          <div className="form-row">
                            <label htmlFor="lab-phone">
                              <RequiredFieldText text={tx('เบอร์โทรศัพท์ของเพื่อน *')} />
                            </label>
                            <PhoneInput
                              id="lab-phone"
                              value={phone}
                              onChange={setPhone}
                              required
                              ariaDescribedBy={shownFriendProblems.phone ? 'lab-phone-err' : undefined}
                            />
                            {shownFriendProblems.phone && (
                              <span id="lab-phone-err" className="field-error" role="alert">
                                {tx(shownFriendProblems.phone)}
                              </span>
                            )}
                          </div>
                          <div className="form-row">
                            <label htmlFor="lab-email">
                              <RequiredFieldText text={tx('อีเมลของเพื่อน *')} />
                            </label>
                            <input
                              id="lab-email"
                              type="email"
                              inputMode="email"
                              autoComplete="off"
                              required
                              value={email}
                              placeholder="name@example.com"
                              aria-invalid={shownFriendProblems.email ? true : undefined}
                              aria-describedby={shownFriendProblems.email ? 'lab-email-err' : undefined}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                            {shownFriendProblems.email && (
                              <span id="lab-email-err" className="field-error" role="alert">
                                {tx(shownFriendProblems.email)}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="form-row reg-lab-full">
                          <label htmlFor="lab-phone">{tx('เบอร์โทรศัพท์ผู้เข้าแข่งขัน')}</label>
                          <PhoneInput id="lab-phone" value={phone} onChange={setPhone} />
                        </div>
                      )}
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

                  </>
                  )}

                  {/* the organizer's questions come before the emergency contact (26 Nov 2026, user request) */}
                  {(event.customFields?.length ?? 0) > 0 && (
                    // the field list brings its own heading ("ข้อมูลเพิ่มเติม (n ข้อ)")
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

                  {/* a saved friend's emergency contact comes from the friend's record and is edited in
                      the friend's dialog, so the fields are not shown here (26 Nov 2026, user request) */}
                  {!(forSelf === false && partMode === 'saved') && (
                  <section className="reg-lab-section" aria-labelledby="lab-emergency">
                    <h3 id="lab-emergency">{tx('ผู้ติดต่อฉุกเฉิน')}</h3>
                    <p className="reg-lab-hint">
                      {forSelf === false
                        ? tx('ผู้ติดต่อฉุกเฉินของเพื่อนที่สมัครให้ (ไม่ใช่ของคุณ) ผู้จัดจะโทรหาคนนี้หากเกิดเหตุระหว่างแข่งขัน')
                        : tx('ผู้จัดจะโทรหาคนนี้หากเกิดเหตุระหว่างแข่งขัน')}
                    </p>
                    {forSelf === true && contacts.length > 0 && (
                      <>
                        {modeTabs(
                          'lab-ec-mode',
                          'วิธีระบุผู้ติดต่อฉุกเฉิน',
                          ecMode,
                          ['เลือกจากโปรไฟล์', 'กรอกผู้ติดต่อใหม่'],
                          (mode) => {
                            setEcMode(mode);
                            if (mode === 'manual') setEmergency('', '', '');
                          }
                        )}
                        {forSelf === true && step2NoticeEl}
                      </>
                    )}
                    {ecFromProfile ? (
                      <SavedCardPicker
                        items={contacts}
                        selectedId={pickedEc?.id}
                        getId={(c) => c.id}
                        searchText={(c) => [c.contactName, c.relationship, c.phone, c.email].filter(Boolean).join(' ')}
                        title={(c) => tx(c.contactName)}
                        badge={(c) => (c.isPrimary ? primaryTag('ผู้ติดต่อหลัก') : null)}
                        meta={(c) => `${tx(c.relationship)} · ${displayPhone(c.phone)}`}
                        compare={primaryFirst}
                        orderLabel="ผู้ติดต่อหลักก่อน"
                        onPick={(id) => {
                          const c = contacts.find((x) => x.id === id);
                          if (c) setEmergency(c.contactName, c.relationship, c.phone);
                        }}
                        groupLabel="เลือกจากโปรไฟล์"
                        searchPlaceholder="ค้นหาชื่อ ความสัมพันธ์ หรือเบอร์โทร"
                        allTitle="ผู้ติดต่อฉุกเฉินทั้งหมด"
                        idPrefix="lab-ec"
                        renderCard={(c) => (
                          <label key={c.id} className={`reg-category-radio-card ${pickedEc?.id === c.id ? 'selected' : ''}`}>
                            <input
                              type="radio"
                              name="lab-ec-pick"
                              checked={pickedEc?.id === c.id}
                              onChange={() => setEmergency(c.contactName, c.relationship, c.phone)}
                            />
                            <span className="custom-radio-circle" aria-hidden="true" />
                            <div className="reg-radio-card-copy">
                              <span className="reg-card-head">
                                <strong>{tx(c.contactName)}</strong>
                                {c.isPrimary && primaryTag('ผู้ติดต่อหลัก')}
                              </span>
                              <span className="muted-inline">{tx(c.relationship)}</span>
                              <span className="muted-inline">
                                {tx('เบอร์โทร')}: <span className="mono-num">{displayPhone(c.phone)}</span>
                              </span>
                            </div>
                            {editButton(c.contactName, () => setEcEditId(c.id))}
                          </label>
                        )}
                      />
                    ) : (
                    <div className="reg-lab-fields">
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
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-emerg-rel">{tx('ความสัมพันธ์')}</label>
                        <input
                          id="lab-emerg-rel"
                          type="text"
                          value={emergencyRelation}
                          onChange={(e) => setEmergencyRelation(e.target.value)}
                          placeholder={tx('เช่น บิดา / มารดา / คู่สมรส')}
                        />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-emerg-phone">
                          <RequiredFieldText text={tx('เบอร์โทรผู้ติดต่อฉุกเฉิน *')} />
                        </label>
                        <PhoneInput id="lab-emerg-phone" value={emergencyPhone} onChange={setEmergencyPhone} required />
                      </div>
                      {forSelf === true && contacts.length === 0 && <div className="reg-lab-full">{step2NoticeEl}</div>}
                      {forSelf === true && live.saveEmergencyContacts && (
                        <div className="ship-addr-save-row reg-lab-full">
                          <button type="button" className="btn-secondary" disabled={savingNew} onClick={() => void saveNewContact()}>
                            {savingNew ? tx('กำลังบันทึก…') : tx('บันทึกลงโปรไฟล์')}
                          </button>
                        </div>
                      )}
                    </div>
                    )}
                    {forSelf === false && partMode === 'manual' && saved.length === 0 && step2NoticeEl}
                    {forSelf === false && partMode === 'manual' && live.saveParticipants && (
                      <div className="ship-addr-save-row reg-lab-friend-save">
                        <button type="button" className="btn-secondary" disabled={savingNew} onClick={() => void saveNewFriend()}>
                          {savingNew ? tx('กำลังบันทึก…') : tx('บันทึกลงรายชื่อเพื่อน')}
                        </button>
                      </div>
                    )}
                  </section>
                  )}
                </>
              )}
              {partEditId && (
                <SavedParticipantModal
                  key={partEditId}
                  owner={{ email: currentUser?.contactEmail, phone: currentUser?.runnerProfile?.phone }}
                  idPrefix="lab-sp-edit"
                  participant={saved.find((x) => x.id === partEditId) ?? null}
                  shirtSizes={(platformProfileConfig?.shirtSizes ?? [])
                    .filter((sz) => sz.enabled)
                    .sort((x, y) => x.sortOrder - y.sortOrder)
                    .map((sz) => sz.code)}
                  onCancel={() => setPartEditId(null)}
                  onSave={saveEditedParticipant}
                />
              )}
              {ecEditId && (
                <EmergencyContactModal
                  key={ecEditId}
                  idPrefix="lab-ec-edit"
                  contact={contacts.find((c) => c.id === ecEditId) ?? null}
                  onCancel={() => setEcEditId(null)}
                  onSave={saveEditedContact}
                />
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
              <h3 className="reg-lab-shirt-h" id="lab-race-shirt-h">
                <RequiredFieldText text={tx('เสื้อแข่ง *')} />
              </h3>
              {forSelf && profile?.preferredShirtSize && (
                <p className="reg-lab-inline-note">
                  <IconShirt size={15} />
                  <span>
                    {txf('ไซส์ในโปรไฟล์ของคุณ: {0}', profile.preferredShirtSize)}
                  </span>
                </p>
              )}
              <ShirtGallery
                styles={galleryStyles}
                styleId={shirtStyle}
                onStyleChange={(id) => {
                  setShirtStyle(id as ShirtStyleId);
                  // a new style starts with no size picked (26 Nov 2026, user request)
                  setShirtSize('' as ShirtSizeCode);
                }}
                size={shirtSize}
                onSizeChange={(z) => setShirtSize(z as ShirtSizeCode)}
                cuts={SHIRT_CUTS}
                cut={shirtCut}
                onCutChange={(c) => setShirtCut(c as ShirtCut)}
                cutNote={null}
              />
              {hasFinisher && (
                <section className="reg-lab-section reg-lab-finisher" id="lab-finisher" aria-labelledby="lab-finisher-h">
                  <h3 id="lab-finisher-h">
                    {tx('เสื้อ Finisher (ไม่บังคับ)')}
                  </h3>
                  <p className="reg-lab-hint">
                    {tx('ได้รับเมื่อวิ่งเข้าเส้นชัยภายในเวลาที่กำหนด เลือกไซส์ไว้ล่วงหน้า')}
                  </p>
                  <ShirtGallery
                    idPrefix="pg-fin"
                    styles={[finisherStyle]}
                    styleId="finisher"
                    onStyleChange={() => undefined}
                    size={finisherSize}
                    onSizeChange={(z) => {
                      setFinisherSize(z);
                      setStepError(null);
                    }}
                    caption="ได้รับเมื่อวิ่งเข้าเส้นชัย"
                    cuts={SHIRT_CUTS}
                    cut={finisherCut}
                    onCutChange={(c) => setFinisherCut(c as ShirtCut)}
                    cutNote={null}
                  />
                </section>
              )}
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
                    <SavedCardPicker
                      items={book}
                      selectedId={bookId}
                      getId={(addr) => addr.id}
                      searchText={(addr) =>
                        [addr.addressName, addr.recipientName, addr.phone, addr.address, addr.subdistrict, addr.district, addr.province, addr.postalCode].join(' ')
                      }
                      title={(addr) => addr.addressName}
                      badge={(addr) => (addr.isDefault ? primaryTag('ที่อยู่หลัก') : null)}
                      meta={(addr) => `${addr.recipientName} · ${addr.district} ${addr.province} ${addr.postalCode}`}
                      compare={defaultFirst}
                      orderLabel="ที่อยู่หลักก่อน"
                      onPick={setBookId}
                      groupLabel="เลือกจากสมุดที่อยู่"
                      searchPlaceholder="ค้นหาชื่อที่อยู่ ผู้รับ เบอร์โทร หรือจังหวัด"
                      allTitle="สมุดที่อยู่ทั้งหมด"
                      idPrefix="lab-book"
                      renderCard={(addr) => (
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
                            <span className="reg-card-head">
                              <strong>{addr.addressName}</strong>
                              {addr.isDefault && primaryTag('ที่อยู่หลัก')}
                            </span>
                            <span className="muted-inline">
                              {addr.recipientName} ({addr.phone})
                            </span>
                            <span className="muted-inline">
                              {addr.address}, ต.{addr.subdistrict} อ.{addr.district} จ.{addr.province}{' '}
                              <span className="mono-num">{addr.postalCode}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary reg-lab-book-edit"
                            aria-label={`${tx('แก้ไข')} ${addr.addressName}`}
                            onClick={(e) => {
                              e.preventDefault();
                              setAddrNotice(null);
                              setEditAddrId(addr.id);
                            }}
                          >
                            {tx('แก้ไข')}
                          </button>
                        </label>
                      )}
                    />
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
                          // province / district / subdistrict can be typed to search (25 Nov 2026, user request)
                          typeableArea
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
              {editAddrId && (
                <SavedAddressModal
                  key={editAddrId}
                  idPrefix="lab-book-edit"
                  address={book.find((x) => x.id === editAddrId) ?? null}
                  contactEmail={currentUser?.contactEmail ?? undefined}
                  onCancel={() => setEditAddrId(null)}
                  onSave={saveEditedAddr}
                />
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
                    value: `${tx(shirtStyleName(shirtStyle))} · ${tx(cutLabel(shirtCut))} · ${shirtSize}`,
                    editStep: 3,
                  },
                  ...(hasFinisher
                    ? [
                        {
                          label: tx('เสื้อ Finisher'),
                          value: finisherSize ? `${tx(cutLabel(finisherCut))} · ${finisherSize}` : tx('ไม่ระบุ'),
                          editStep: 3 as LabStep,
                        },
                      ]
                    : []),
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
                    sub: txf('{0} · ไซส์ {1}', `${tx(shirtStyleName(shirtStyle))} · ${tx(cutLabel(shirtCut))}`, shirtSize),
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
