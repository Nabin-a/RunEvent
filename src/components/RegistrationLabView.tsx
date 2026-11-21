import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  RunnerSavedAddress,
  Organization,
  RaceCategory,
  RaceEvent,
  ShirtSizeCode,
  UserAccount,
} from '../types';
import { tx, txf } from '../i18n';
import { calculateFeeQuote, feePolicyLabel, formatThb, getCurrentTier } from '../utils/pricing';
import { evaluateCategoryAge, formatAgeGroupLabel, formatBasisDate } from '../utils/age';
import { resolveShirtSpec } from '../data/runnerProfileDefaults';
import type { PlatformProfileConfig } from '../types';
import { DateOfBirthInput } from './DateOfBirthInput';
import { IdNumberInput } from './IdNumberInput';
import { PhoneInput } from './PhoneInput';
import { RunnerCustomFieldsInputs } from './PublicEventView';
import { RequiredFieldText } from './RequiredFieldText';
import { NoteTag, PriceTag } from './RegTags';
import { RegistrationStepper } from './RegistrationStepper';
import { ShirtGallery, SouvenirCards, type ShirtGalleryStyle } from './ProductGallery';
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

/**
 * Registration form, layout B (sandbox review only).
 *
 * Same steps, same questions and the same progress stepper as the live form, but
 * the fields are laid out for reading instead of fitting one screen: one column of
 * titled sections, two fields per row only where they belong together (first /
 * last name, document type / number), and generous space between sections.
 *
 * It cannot submit. State is local and nothing is sent to the server; step 7 shows
 * a sample receipt.
 */

type LabStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  emergency: Pair<string>;
  answers: Pair<Record<string, string | boolean>>;
  shirtSize: Pair<ShirtSizeCode>;
  shirtStyle: Pair<ShirtStyleId>;
  addonId: Pair<string>;
  addonSize: Pair<string>;
  souvenirTab: Pair<string>;
  delivery: Pair<'expo_pickup' | 'postal'>;
  recipient: Pair<string>;
  shipPhone: Pair<string>;
  address: Pair<CascadingAddressValue>;
  addrMode: Pair<'saved' | 'manual'>;
  bookId: Pair<string>;
  channel: Pair<'promptpay' | 'card'>;
  acceptRules: Pair<boolean>;
  marketing: Pair<boolean>;
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
}: {
  event: RaceEvent;
  organization?: Organization;
  currentUser: UserAccount | null;
  platformProfileConfig?: PlatformProfileConfig;
  openSeatsFor: (cat: RaceCategory) => number;
  onBack: () => void;
  /** form state owned by the live form (see LabShared) */
  shared: LabShared;
}) {
  const profile = currentUser?.runnerProfile;
  const hasSouvenirs = event.products.length > 0;
  const steps: { step: LabStep; label: string }[] = [
    { step: 1, label: 'เริ่ม' },
    { step: 2, label: 'ข้อมูล' },
    { step: 3, label: 'สินค้า' },
    ...(hasSouvenirs ? [{ step: 4 as LabStep, label: 'ของที่ระลึก' }] : []),
    { step: 5, label: 'ที่อยู่' },
    { step: 6, label: 'ชำระเงิน' },
    { step: 7, label: 'สำเร็จ' },
  ];

  const [step, setStep] = useState<LabStep>(
    Math.min(6, Math.max(1, shared.step[0])) as LabStep
  );
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
  const [emergency, setEmergency] = shared.emergency;
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
    setEmergency(
      p?.emergencyContactName
        ? `${p.emergencyContactName}${p.emergencyContactPhone ? ` (${p.emergencyContactPhone})` : ''}`
        : ''
    );
  };

  const saved = profile?.savedParticipants ?? [];
  const contacts = profile?.emergencyContacts ?? [];
  const ageCheck = category && dob ? evaluateCategoryAge(event, category, dob, gender) : null;

  /* ---------- step 3-5 ---------- */
  const [shirtSize, setShirtSize] = shared.shirtSize;
  const [shirtStyle, setShirtStyle] = shared.shirtStyle;
  const [addonId, setAddonId] = shared.addonId;
  const addon = event.products.find((p) => p.id === addonId) ?? null;
  const [addonSize, setAddonSize] = shared.addonSize;
  const [souvenirTab, setSouvenirTab] = shared.souvenirTab;
  const [delivery, setDelivery] = shared.delivery;
  const [recipient, setRecipient] = shared.recipient;
  const [shipPhone, setShipPhone] = shared.shipPhone;
  const [address, setAddress] = shared.address;
  // address book: starts from the profile; layout B keeps additions on this page only
  const [book, setBook] = useState<RunnerSavedAddress[]>(profile?.savedAddresses ?? []);
  const [addrMode, setAddrMode] = shared.addrMode;
  const [bookId, setBookId] = shared.bookId;
  const [addrNotice, setAddrNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const saveToBook = () => {
    const a = address;
    if (!recipient.trim() || !shipPhone.trim() || !a.address.trim() || !a.postalCode || !a.subdistrict) {
      setAddrNotice({ tone: 'err', text: tx('กรอกชื่อผู้รับ เบอร์โทร และที่อยู่ให้ครบก่อนบันทึก') });
      return;
    }
    const dup = book.find(
      (x) => x.address.trim() === a.address.trim() && x.postalCode === a.postalCode && x.subdistrict === a.subdistrict
    );
    const entry: RunnerSavedAddress = dup ?? {
      id: `lab-addr-${Date.now().toString(36)}`,
      addressName: txf('ที่อยู่จากการสมัคร {0}', event.code),
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
    if (!dup) setBook((b) => [...b, entry]);
    setBookId(entry.id);
    setAddrMode('saved');
    setAddrNotice({
      tone: 'ok',
      text: dup
        ? tx('ที่อยู่นี้มีในสมุดแล้ว เลือกให้แล้ว')
        : tx('เพิ่มลงสมุดที่อยู่แล้ว (แบบ B ไม่บันทึกลงโปรไฟล์จริง)'),
    });
  };

  /* ---------- step 6 ---------- */
  const [channel, setChannel] = shared.channel;
  const [acceptRules, setAcceptRules] = shared.acceptRules;
  const [marketing, setMarketing] = shared.marketing;

  const addonSatang = addon ? addon.priceSatang : 0;
  const totalSatang = (quote?.runnerNetPaySatang ?? 0) + addonSatang;
  const participantName = `${firstTh} ${lastTh}`.trim();

  const go = (next: LabStep) => {
    setStep(next);
    if (next < 7) shared.step[1](next);
  };
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
    <div className="reg-lab-footer">
      {back ? (
        <button type="button" className="btn-secondary" onClick={() => go(back)}>
          {tx('ย้อนกลับ')}
        </button>
      ) : (
        <span />
      )}
      {next && (
        <button type="button" className="btn-primary reg-next-pill-btn" onClick={() => go(next)}>
          {tx(nextLabel)}
        </button>
      )}
    </div>
  );

  return (
    <main className="reg-lab-shell" ref={shellRef}>
      <p className="reg-lab-notice" role="note">
        <IconAlert size={15} />
        <span>
          {tx('ฟอร์มสมัครแบบ B (ทดลอง) สำหรับเทียบการจัดวางกับแบบเดิม กรอกดูได้ แต่ส่งใบสมัครจริงไม่ได้')}
        </span>
      </p>

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
        <div className="reg-lab-stepper event-reg-wizard-pane">
          <RegistrationStepper
            steps={steps}
            current={step}
            complete={step === 7}
            stepperRef={stepperRef}
            onJump={go}
          />
        </div>

        <div className="reg-lab-body">
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
                        setForSelf(true);
                        fillFrom(profile ?? null);
                        const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
                        if (primary) setEmergency(`${primary.contactName} (${primary.phone})`);
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
                        <select
                          id="lab-saved"
                          value={savedId}
                          onChange={(e) => {
                            setSavedId(e.target.value);
                            fillFrom(saved.find((x) => x.id === e.target.value) ?? null);
                          }}
                        >
                          {saved.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {`${pt.firstName} ${pt.lastName}`.trim()}
                              {pt.nickname ? ` · ${pt.nickname}` : ''}
                            </option>
                          ))}
                          <option value="new">{tx('+ เพิ่มผู้สมัครใหม่')}</option>
                        </select>
                      </div>
                    )}
                    <div className="form-row reg-lab-full">
                      <label htmlFor="lab-buyer">
                        <RequiredFieldText text={tx('ชื่อ-นามสกุลผู้ซื้อคำสั่งซื้อ (ผู้ชำระเงิน) *')} />
                      </label>
                      <input id="lab-buyer" type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
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
                        <label htmlFor="lab-fth"><RequiredFieldText text={tx('ชื่อจริง *')} /></label>
                        <input id="lab-fth" type="text" value={firstTh} onChange={(e) => setFirstTh(e.target.value)} placeholder={tx('เช่น กานต์พิชชา')} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-lth"><RequiredFieldText text={tx('นามสกุล *')} /></label>
                        <input id="lab-lth" type="text" value={lastTh} onChange={(e) => setLastTh(e.target.value)} placeholder={tx('เช่น วัฒนากูล')} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-fen">First Name (EN)</label>
                        <input id="lab-fen" type="text" value={firstEn} onChange={(e) => setFirstEn(e.target.value)} placeholder="e.g. Kanpitcha" />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-len">Last Name (EN)</label>
                        <input id="lab-len" type="text" value={lastEn} onChange={(e) => setLastEn(e.target.value)} placeholder="e.g. Wattanakul" />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-nth">{tx('ชื่อเล่น')}</label>
                        <input id="lab-nth" type="text" value={nickTh} onChange={(e) => setNickTh(e.target.value)} placeholder={tx('เช่น กานต์')} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-nen">Nickname (EN)</label>
                        <input id="lab-nen" type="text" value={nickEn} onChange={(e) => setNickEn(e.target.value)} placeholder="e.g. Kan" />
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
                      <div className="form-row">
                        <label htmlFor="lab-gender">{tx('เพศ')}</label>
                        <select id="lab-gender" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                          <option value="ไม่ระบุ">{tx('ไม่ระบุ')}</option>
                          <option value="ชาย">{tx('ชาย')}</option>
                          <option value="หญิง">{tx('หญิง')}</option>
                        </select>
                      </div>
                      {ageCheck && (
                        <p
                          id="lab-dob-age"
                          className={`reg-lab-full reg-age-hint ${ageCheck.eligible ? '' : 'is-error'}`}
                          aria-live="polite"
                        >
                          {ageCheck.ageYears !== null
                            ? txf('อายุ {0} ปี ณ {1}', ageCheck.ageYears, formatBasisDate(ageCheck.basisDate))
                            : tx('วันเกิดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')}
                          {ageCheck.group ? ` · ${txf('รุ่น {0}', formatAgeGroupLabel(ageCheck.group))}` : ''}
                        </p>
                      )}
                      <div className="form-row reg-lab-full">
                        <label htmlFor="lab-phone">{tx('เบอร์โทรศัพท์ผู้เข้าแข่งขัน')}</label>
                        <PhoneInput id="lab-phone" value={phone} onChange={setPhone} />
                      </div>
                      <div className="form-row">
                        <label htmlFor="lab-idtype">{tx('ประเภทเอกสาร')}</label>
                        <select id="lab-idtype" value={idType} onChange={(e) => setIdType(e.target.value as IdType)}>
                          <option value="thai_id">{tx('บัตรประจำตัวประชาชน 13 หลัก')}</option>
                          <option value="passport">{tx('หนังสือเดินทาง (Passport)')}</option>
                        </select>
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
                          <select
                            id="lab-ec-pick"
                            value=""
                            onChange={(e) => {
                              const c = contacts.find((x) => x.id === e.target.value);
                              if (c) setEmergency(`${c.contactName} (${c.phone})`);
                            }}
                          >
                            <option value="">{tx('เลือกจากโปรไฟล์…')}</option>
                            {contacts.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.contactName} ({c.relationship}){c.isPrimary ? ` · ${tx('หลัก')}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="form-row reg-lab-full">
                        <label htmlFor="lab-emerg">
                          <RequiredFieldText text={tx('ชื่อและเบอร์โทรผู้ติดต่อฉุกเฉิน *')} />
                        </label>
                        <input
                          id="lab-emerg"
                          type="text"
                          value={emergency}
                          onChange={(e) => setEmergency(e.target.value)}
                          placeholder={tx('ชื่อผู้ติดต่อ และเบอร์โทร 10 หลัก')}
                        />
                      </div>
                    </div>
                  </section>

                  {(event.customFields?.length ?? 0) > 0 && (
                    // the field list brings its own heading ("ข้อมูลเพิ่มเติมที่ผู้จัดขอ (n ข้อ)")
                    <section className="reg-lab-section reg-lab-custom">
                      <RunnerCustomFieldsInputs
                        fields={event.customFields}
                        answers={answers}
                        onAnswerChange={(id, v) => setAnswers({ ...answers, [id]: v })}
                        raceDistanceCode={category.code}
                        shirtSize={shirtSize}
                        publishedFormVersion={event.publishedFormVersion}
                      />
                    </section>
                  )}
                </>
              )}
              {footer(1, forSelf === null ? null : 3)}
            </>
          )}

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
              {footer(2, afterShirt)}
            </>
          )}

          {/* ---------- STEP 4 ---------- */}
          {step === 4 && hasSouvenirs && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('ของที่ระลึก (ไม่บังคับ)')}</h2>
                <p>{tx('สั่งเสื้อหรือเหรียญที่ระลึกเพิ่มพร้อมใบสมัคร ชำระรวมกับค่าสมัคร')}</p>
              </div>
              <SouvenirCards
                products={event.products}
                tab={souvenirTab}
                onTabChange={setSouvenirTab}
                value={addon ? `${addon.id}::${addonSize}` : ''}
                onChange={(v) => {
                  if (!v) {
                    setAddonId('none');
                    return;
                  }
                  const [pid, variant] = v.split('::');
                  setAddonId(pid);
                  setAddonSize(variant);
                }}
              />
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
                          contactPhone={shipPhone}
                          contactEmail={currentUser?.contactEmail}
                          required
                          streetAddressLabel={tx('ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)')}
                        />
                      </div>
                      <div className="ship-addr-save-row">
                        <button type="button" className="btn-secondary" onClick={saveToBook}>
                          {tx('บันทึกลงสมุดที่อยู่')}
                        </button>
                        <span className="muted-inline">
                          {tx('ไม่บันทึกก็ได้ ที่อยู่นี้จะใช้เฉพาะการสมัครครั้งนี้')}
                        </span>
                      </div>
                    </>
                  )}
                </section>
              )}
              {footer(beforeAddress, 6)}
            </>
          )}

          {/* ---------- STEP 6 ---------- */}
          {step === 6 && category && tier && quote && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('ตรวจยอดและยืนยันการสมัคร')}</h2>
                <p>{tx('ตรวจรายการก่อนชำระ ยอดคำนวณจากราคาปัจจุบันของงาน')}</p>
              </div>

              <section className="reg-lab-section" aria-labelledby="lab-sum">
                <h3 id="lab-sum">{tx('สรุปยอดชำระ')}</h3>
                <dl className="reg-lab-ledger">
                  <div>
                    <dt>
                      {txf('ค่าสมัคร {0} ({1})', tx(category.name), tx(tier.label))}
                      <span className="muted-inline">{txf('{0} · ไซส์ {1}', tx(shirtStyleName(shirtStyle)), shirtSize)}</span>
                    </dt>
                    <dd className="mono-num">{formatThb(quote.baseSatang, true)}</dd>
                  </div>
                  <div>
                    <dt>{txf('ค่าบริการระบบ ({0})', feePolicyLabel(event.feeBearerPolicy))}</dt>
                    <dd className="mono-num">{formatThb(quote.runnerFeeSatang, true)}</dd>
                  </div>
                  {addon && (
                    <div>
                      <dt>{txf('สินค้าซื้อเพิ่ม: {0} ({1})', tx(addon.nameTh), addonSize)}</dt>
                      <dd className="mono-num">{formatThb(addon.priceSatang, true)}</dd>
                    </div>
                  )}
                  <div className="reg-lab-ledger-total">
                    <dt>{tx('ยอดชำระสุทธิทั้งหมด')}</dt>
                    <dd className="mono-num text-vermilion">{formatThb(totalSatang, true)}</dd>
                  </div>
                </dl>
              </section>

              <section className="reg-lab-section" aria-labelledby="lab-pay">
                <h3 id="lab-pay">{tx('ช่องทางชำระเงิน (จำลอง)')}</h3>
                <div className="reg-lab-pair-cards" role="radiogroup" aria-labelledby="lab-pay">
                  {(
                    [
                      ['promptpay', 'QR PromptPay', 'สแกนจ่ายทันที'],
                      ['card', 'บัตรเครดิต / เดบิต', 'Visa · Mastercard · JCB'],
                    ] as const
                  ).map(([id, title, sub]) => (
                    <label key={id} className={`reg-category-radio-card ${channel === id ? 'selected' : ''}`}>
                      <input type="radio" name="lab-pay" checked={channel === id} onChange={() => setChannel(id)} />
                      <span className="custom-radio-circle" aria-hidden="true" />
                      <div className="reg-radio-card-copy">
                        <strong>{tx(title)}</strong>
                        <span className="muted-inline">{tx(sub)}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              <section className="reg-lab-section" aria-labelledby="lab-consent">
                <h3 id="lab-consent">{tx('ข้อตกลง')}</h3>
                <div className="reg-lab-consents">
                  <label className="checkbox-row">
                    <input type="checkbox" checked={acceptRules} onChange={(e) => setAcceptRules(e.target.checked)} />
                    <span>
                      <strong>{tx('[จำเป็น]')}</strong>{' '}
                      {txf('ข้าพเจ้ายอมรับกติกาการแข่งขันและเงื่อนไขความปลอดภัยของงาน ({0})', event.rulesVersion)}
                    </span>
                  </label>
                  <label className="checkbox-row">
                    <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
                    <span>{tx('[ไม่บังคับ] ยินยอมรับข่าวสารงานวิ่งและโปรโมชันจากผู้จัดงาน')}</span>
                  </label>
                </div>
              </section>

              <div className="reg-lab-footer">
                <button type="button" className="btn-secondary" onClick={() => go(5)}>
                  {tx('ย้อนกลับ')}
                </button>
                <div className="reg-lab-footer-actions">
                  <button type="button" className="btn-secondary" onClick={() => go(7)}>
                    {tx('กันโควตาไว้ชำระภายหลัง (15 นาที)')}
                  </button>
                  <button type="button" className="btn-primary" disabled={!acceptRules} onClick={() => go(7)}>
                    {tx('ชำระเงินและยืนยันการสมัครทันที')}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ---------- STEP 7 (sample) ---------- */}
          {step === 7 && (
            <div className="reg-lab-done">
              <IconCheckCircle size={28} />
              <h2>{tx('ตัวอย่างหน้าสมัครสำเร็จ')}</h2>
              <p>{tx('แบบ B ไม่ได้ส่งใบสมัครจริง ข้อมูลด้านล่างเป็นค่าที่กรอกในหน้านี้เท่านั้น')}</p>
              <dl className="reg-lab-ledger">
                <div>
                  <dt>{tx('ผู้เข้าแข่งขัน')}</dt>
                  <dd>{participantName || '—'}</dd>
                </div>
                <div>
                  <dt>{tx('ระยะ')}</dt>
                  <dd>{category ? tx(category.name) : '—'}</dd>
                </div>
                <div>
                  <dt>{tx('เสื้อตามสิทธิ์สมัคร')}</dt>
                  <dd>{txf('{0} · ไซส์ {1}', tx(shirtStyleName(shirtStyle)), shirtSize)}</dd>
                </div>
                <div className="reg-lab-ledger-total">
                  <dt>{tx('ยอดชำระสุทธิทั้งหมด')}</dt>
                  <dd className="mono-num text-vermilion">{formatThb(totalSatang, true)}</dd>
                </div>
              </dl>
              <div className="reg-lab-footer">
                <span />
                <button type="button" className="btn-secondary" onClick={() => go(1)}>
                  {tx('เริ่มกรอกใหม่')}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
