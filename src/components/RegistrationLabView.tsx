import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  EventProduct,
  FormCoreBlock,
  FormStepDef,
  RunnerSavedAddress,
  RunnerEmergencyContact,
  SavedParticipant,
  Organization,
  RaceCategory,
  RaceEvent,
  ShirtSizeCode,
  UserAccount,
  RegistrationRecord,
  MerchOrderRecord,
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
import { FaIcon } from './FaIcon';
import { NoteTag, PriceTag } from './RegTags';
import { RegistrationStepper } from './RegistrationStepper';
import { ShirtGallery, type ShirtGalleryStyle } from './ProductGallery';
import { SHIRT_STYLES, shirtStyleName, type ShirtStyleId } from '../data/mockShirtStyles';
import { FINISHER_MEDAL_PHOTO, SHIRT_PHOTOS } from '../data/productPhotos';

/** shirt cut picked on the shirt step */
type ShirtCut = 'Men' | 'Women' | 'Kids' | 'Unisex';
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
  IconClock,
  IconMapPin,
  IconChevronDown,
  IconLedger,
  IconShirt,
  IconUsers,
} from './Icons';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { SouvenirPicker } from './SouvenirPicker';
import { RegistrationTerms } from './RegistrationTerms';
import type { CartLine } from './StorefrontView';
import { RegistrationOrderSheet, type SheetBlock, type SheetPerson } from './RegistrationReview';
import { EventCoverMedia } from './Icons';
import { displayPhone } from '../utils/phone';
import { CORE_STEP, answerText, fieldShown, isContentField } from '../data/registrationForm';
import { flowStepOf } from '../data/formFlow';
import { firstFriendContactProblem, friendContactProblems } from '../utils/friendContact';

/**
 * The registration form (layout B, the only layout since 24 Nov 2026 — layout A was removed on
 * the user's request). Fields are laid out for reading: one column of titled sections, two fields
 * per row only where they belong together, generous space between sections.
 *
 * The form's state, its checks and the booking live in CustomerPortalView (`shared` and `live`):
 * each "next" runs the same checks as before, and the payment step books and pays through the server.
 *
 * The steps follow the order the organizer set (27 Nov 2026, src/data/formFlow.ts): each step holds
 * system parts (distance, runner details, shirt, souvenirs, delivery, summary) and/or questions, and
 * shows them in that order with one pair of back / next buttons. Payment always comes last.
 */

/** 1..n the runner's steps in the organizer's order · PAY_STEP payment · DONE_STEP booked */
type LabStep = number;
export const PAY_STEP = 20;
export const DONE_STEP = 21;

/** what the live form gives this layout besides its state */
export interface LabLive {
  /** the steps this runner goes through, in order (payment not included) */
  pages: FormStepDef[];
  /** every step of the form, for placing the questions (formFlow.ts) */
  flow: FormStepDef[];
  /** checks a step before moving on: the first problem, or null (it also marks the questions) */
  check: (page: FormStepDef, scope: HTMLElement | null) => string | null;
  /** problems per question id, shown under each question */
  errors: Record<string, string>;
  clearError: (fieldId: string) => void;
  /** books the place and takes the payment (the server checks everything again) */
  submit: () => void;
  /** books the place as "waiting for payment" (the summary step's button, 26 Nov 2026) */
  book?: () => void;
  /** the registration held for payment, while there is one */
  held?: LabHeld | null;
  /** group registration (28 Nov 2026): the people already filled in on this order; the card
   *  being filled is the form itself. Absent = one person only (not signed in / organizer preview). */
  group?: LabGroup;
  /** why the form went back (e.g. the 15 minutes to pay ran out) */
  resumeNotice?: string | null;
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

/** a person already filled in on a group order, as the form shows them */
export interface LabGroupPerson {
  key: string;
  name: string;
  isSelf: boolean;
  savedId: string;
  catName: string;
  shirtSize: string;
  /** what this person pays (fee + service fee) */
  satang: number;
  baseSatang: number;
  tierLabel: string;
  /** what this person still lacks, by part of the window ('ระยะ', 'ข้อมูลทั่วไป'…); empty = complete */
  missing: string[];
  /** the entry type picked (an option of the distance list) */
  optionId: string;
  /** label / value rows for the summary step */
  details: { label: string; value: string }[];
}

/**
 * Group registration (28 Nov 2026, user approved output/group-registration-modal-mockup): the
 * "ผู้สมัครและระยะ" step lists the people of the order; each one is filled in a window (modal).
 * The form's fields are the window's working copy while it is open.
 */
export interface LabGroup {
  people: LabGroupPerson[];
  /** the most people per order (the organizer's setting) */
  max: number;
  /** this account already holds a place in the event: "yourself" cannot be added again */
  selfRegCode?: string;
  /** the window: null = closed, -1 = a new person, i = person i */
  editing: number | null;
  /** the person whose window opened because "ถัดไป" found something missing */
  errorsAt: number | null;
  /** opens person i, or a new one for yourself / someone else */
  open: (target: number | 'self' | 'friend', withErrors?: boolean) => void;
  /** puts the window's copy into the list as it is (nothing is checked until "ถัดไป") */
  save: () => void;
  /** closes the window without keeping its edits */
  cancel: () => void;
  /** the window holds edits not in the list yet */
  isDirty: () => boolean;
  remove: (i: number) => void;
}

/** A registration booked at the summary step and held (15 minutes) until it is paid. */
export interface LabHeld {
  reg: RegistrationRecord;
  /** everyone of the order (one person = just reg) */
  regs?: RegistrationRecord[];
  addonOrders: MerchOrderRecord[];
  /** this form booked it, so going back to edit still has everything typed */
  fromForm: boolean;
  busy: boolean;
  error: string | null;
  pay: () => void;
  /** gives the hold back and goes back to edit */
  cancel: () => void;
  /** keeps the hold and starts the form again for someone else */
  another: () => void;
}

/** [value, setter] owned by the live form, so switching A <-> B keeps what was typed */
export type Pair<T> = [T, (next: T) => void];

export interface LabShared {
  /** which person the form is filling (group registration): a new id = a different card, so the
   *  answers and the shirt that came with it are kept, not cleared as for a change of person */
  personId?: string;
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
  /** '' = not picked yet (every radio choice starts empty, 27 Nov 2026) */
  delivery: Pair<'expo_pickup' | 'postal' | ''>;
  addrName: Pair<string>;
  recipient: Pair<string>;
  shipPhone: Pair<string>;
  address: Pair<CascadingAddressValue>;
  addrMode: Pair<'saved' | 'manual'>;
  bookId: Pair<string>;
  channel: Pair<'promptpay' | 'card' | ''>;
  acceptRules: Pair<boolean>;
  acceptPayTerms: Pair<boolean>;
  acceptPdpa: Pair<boolean>;
}
type Gender = 'ไม่ระบุ' | 'ชาย' | 'หญิง';
/** areas of a step that get the red frame when their choice is missing */
type Zone = 'cat' | 'who' | 'friend' | 'ec' | 'shirt' | 'kit' | 'addr' | 'terms' | 'pay';

/**
 * One group of the runner card (28 Nov 2026, user request): "ข้อมูลทั่วไป", "ข้อมูลเพิ่มเติม" and
 * "สินค้าที่ระลึก", each folding open like a dropdown. Closed, the head says what was filled in and
 * whether something is still missing (in words, not colour only). The fields stay in the page while
 * folded, so the step's checks still see them; a failed check opens the group with the problem.
 * A group starts open while it is incomplete; after that the runner's own clicks decide.
 */
function RegGroup({
  gid,
  icon,
  title,
  summary,
  done,
  todo,
  children,
}: {
  gid: string;
  icon: ReactNode;
  title: string;
  summary: string;
  done: boolean;
  todo: string;
  children: ReactNode;
}) {
  const [startOpen] = useState(!done);
  return (
    <details className="reg-group" open={startOpen} data-group={gid}>
      <summary className="reg-group-head">
        <span className="reg-group-ico" aria-hidden="true">
          {icon}
        </span>
        <span className="reg-group-title">
          <strong>{tx(title)}</strong>
          {summary && <small>{summary}</small>}
        </span>
        <span className={`reg-group-state ${done ? 'is-done' : 'is-todo'}`}>
          {done ? `✓ ${tx('ครบ')}` : tx(todo)}
        </span>
        <IconChevronDown size={16} className="reg-group-chev" />
      </summary>
      <div className="reg-group-body">{children}</div>
    </details>
  );
}
type IdType = 'thai_id' | 'passport';

/**
 * The person window of a group order (28 Nov 2026). Without `open` it renders its content as is
 * (one-person form). Esc / ✕ / "ยกเลิก" = cancel (the caller asks first when there are edits);
 * A click outside the window does nothing (28 Nov 2026, user decision; it closed the window and kept
 * what was typed before): it closes only by "บันทึก" or a cancel.
 */
function PersonWindow({
  open,
  title,
  banner,
  blocked,
  onCancel,
  onSave,
  windowRef,
  children,
}: {
  open: boolean;
  title: string;
  banner: ReactNode;
  /** another dialog sits on top: Esc belongs to it */
  blocked: boolean;
  onCancel: () => void;
  onSave: () => void;
  windowRef: React.MutableRefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const backTo = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    backTo.current = document.activeElement as HTMLElement | null;
    const body = document.body;
    const was = body.style.overflow;
    body.style.overflow = 'hidden';
    // after the click that opened it has finished (else focus stays on that button)
    const t = window.setTimeout(() => {
      if (!windowRef.current?.contains(document.activeElement)) windowRef.current?.focus();
    }, 30);
    return () => {
      window.clearTimeout(t);
      body.style.overflow = was;
      // back to what opened it, when that is still on the page (else the list's add button)
      const back = backTo.current;
      window.setTimeout(() => {
        if (back && document.contains(back)) back.focus();
        else document.querySelector<HTMLElement>('.reg-pw-add, .reg-pw-start button')?.focus();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return <>{children}</>;
  return (
    <div className="reg-pw-backdrop">
      <div
        className="reg-pw"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reg-pw-title"
        tabIndex={-1}
        ref={windowRef}
        onKeyDown={(e) => {
          if (e.key !== 'Escape' || blocked || e.defaultPrevented) return;
          // an open dropdown closes first
          if (document.querySelector('.kr-menu.is-floating')) return;
          e.preventDefault();
          onCancel();
        }}
      >
        <header className="reg-pw-head">
          <h2 id="reg-pw-title">{title}</h2>
          <button type="button" className="reg-pw-close" aria-label={tx('ปิด')} onClick={onCancel}>
            <FaIcon name="xmark" />
          </button>
        </header>
        <div className="reg-pw-body">
          {banner}
          {children}
        </div>
        <footer className="reg-pw-foot">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {tx('ยกเลิก')}
          </button>
          <button type="button" className="btn-primary" onClick={onSave}>
            {tx('บันทึก')}
          </button>
        </footer>
      </div>
    </div>
  );
}

/** a small yes / no box; focus starts on the safe choice and Esc means no */
function ConfirmBox({
  text,
  yesLabel,
  noLabel = 'ยกเลิก',
  danger,
  onYes,
  onNo,
}: {
  text: string;
  yesLabel: string;
  noLabel?: string;
  danger?: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const noRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    noRef.current?.focus();
  }, []);
  return (
    <div
      className="reg-pw-backdrop is-confirm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onNo();
      }}
    >
      <div
        className="reg-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="reg-confirm-text"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onNo();
          }
        }}
      >
        <p id="reg-confirm-text">{tx(text)}</p>
        <div className="reg-confirm-actions">
          <button type="button" className="btn-secondary" ref={noRef} onClick={onNo}>
            {tx(noLabel)}
          </button>
          <button type="button" className={danger ? 'btn-primary reg-confirm-danger' : 'btn-primary'} onClick={onYes}>
            {tx(yesLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const pages = live.pages;
  const steps: { step: LabStep; label: string }[] = [
    ...pages.map((p, i) => ({ step: i + 1, label: p.title })),
    { step: PAY_STEP, label: 'ชำระเงิน' },
  ];
  // questions sit in their step; one whose step is gone goes with the runner details
  const placedFields = useMemo(
    () => (event.customFields ?? []).map((f) => ({ ...f, stepKey: flowStepOf(f, live.flow) })),
    [event.customFields, live.flow]
  );

  // the step is the live form's (the organizer's preview and the booking move it too)
  const step: LabStep = shared.step[0];
  /** this step, while on one of the runner's steps (not payment / done) */
  const page: FormStepDef | undefined = step >= 1 && step <= pages.length ? pages[step - 1] : undefined;
  const has = (block: FormCoreBlock) => !!page?.blocks?.includes(block);
  /** the step number of the step holding a system part (0 = not shown to this runner) */
  const pageNoOf = (block: FormCoreBlock) => pages.findIndex((p) => p.blocks?.includes(block)) + 1;
  const isLastPage = !!page && step === pages.length;
  const prevPage: LabStep | null = page && step > 1 ? step - 1 : null;
  const nextPage: LabStep | null = page && step < pages.length ? step + 1 : null;
  const [stepError, setStepError] = useState<string | null>(null);
  /* group order (28 Nov 2026): the people of the order and the person window */
  const group = live.group;
  const people = group?.people ?? [];
  const editing = group ? group.editing : null;
  const windowOpen = editing !== null;
  /** "yourself" is on another card of this order */
  const selfAt = people.findIndex((x, k) => x.isSelf && k !== editing);
  const selfBlocked = Boolean(group?.selfRegCode) || selfAt >= 0;
  const selfListed = people.some((x) => x.isSelf);
  const canAdd = !!group && people.length < group.max;
  const windowRef = useRef<HTMLDivElement | null>(null);
  const [confirmDrop, setConfirmDrop] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /* the custom area (not a plain input) that holds the step's problem; outlined while the
     step error shows (27 Nov 2026, user request: every step highlights and jumps to the gap) */
  const [invalidZone, setInvalidZone] = useState<Zone | null>(null);
  /* every choice still missing when "ถัดไป" was pressed, not only the first (28 Nov 2026, user
     report: the souvenir shirt was not marked while the distance was also missing); each one
     loses its mark as soon as it is picked */
  const [markZones, setMarkZones] = useState<Zone[]>([]);
  const zoneMark = (zone: Zone) =>
    (stepError && invalidZone === zone) || (markZones.includes(zone) && zoneMissing(zone))
      ? { 'data-step-invalid': '' }
      : {};
  /** after a failed step: scroll to and focus the first marked problem on the page */
  const jumpToProblem = () => {
    window.setTimeout(() => {
      const body = bodyRef.current;
      if (!body) return;
      // a problem inside a folded group: open that group first
      body.querySelectorAll<HTMLDetailsElement>('details.reg-group:not([open])').forEach((d) => {
        if (d.querySelector('[aria-invalid="true"], [data-step-invalid], .field-error, :invalid')) d.open = true;
      });
      const shown = (el: HTMLElement) => el.offsetParent !== null || el.getClientRects().length > 0;
      const marked = [
        ...body.querySelectorAll<HTMLElement>('[aria-invalid="true"], [data-step-invalid], .field-error'),
      ].filter(shown);
      marked.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      // every gap blinks a few times (28 Nov 2026, user request), again on each press; the red
      // mark stays until fixed. Reduced motion: the CSS keeps the mark still.
      for (const el of marked) {
        if (el.matches('.field-error')) continue;
        el.classList.remove('reg-flash');
        void el.offsetWidth;
        el.classList.add('reg-flash');
        el.addEventListener('animationend', () => el.classList.remove('reg-flash'), { once: true });
      }
      const first = marked[0];
      if (!first) return;
      // what to focus inside the marked area: the picked friend's "แก้ไข", the first shirt size,
      // the first unchecked consent, else the first control
      const target =
        first.querySelector<HTMLElement>('label:has(input:checked) button') ??
        first.querySelector<HTMLElement>('input[name="pg-size"]:not([disabled])') ??
        first.querySelector<HTMLElement>('input[type="checkbox"]:not(:checked)') ??
        (first.matches('input, select, textarea, button')
          ? first
          : first.querySelector<HTMLElement>(
              'input:not([type="hidden"]):not([disabled]), select, textarea, button:not([disabled])'
            ) ??
            (first.closest('.form-row, fieldset') as HTMLElement | null)?.querySelector<HTMLElement>(
              'input:not([type="hidden"]), select, textarea, button'
            ));
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // a small hidden radio scrolls via its label
      const scrollTo = (target?.closest('label') as HTMLElement | null) ?? target ?? first;
      scrollTo.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      target?.focus({ preventScroll: true });
    }, 80);
  };
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
  // every radio choice starts empty, the entry type too (27 Nov 2026, user request)
  const optionId = shared.optionId[0] || '';
  const setOptionId = shared.optionId[1];
  const picked = options.find((o) => o.optionId === optionId);
  const category =
    event.categories.find((c) => c.id === picked?.catId) ?? event.categories[0];
  const tier = category ? getCurrentTier(category) : null;
  const quote = tier ? calculateFeeQuote(tier.priceSatang, event.feeBearerPolicy) : null;

  /* ---------- step 2: participant ---------- */
  const [forSelf, setForSelf] = shared.forSelf;
  const [savedId, setSavedId] = shared.savedId;
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
  /* the card's form shows once we know who it is for (28 Nov 2026, user request): yourself at once;
     someone else after a friend (or "+ เพิ่มคนใหม่") is picked from the list */
  const formShown = forSelf === true || (forSelf === false && (saved.length === 0 || savedId !== ''));

  // The organizer's questions belong to the person being registered: changing who that is
  // (yourself / a friend / another friend / a new one) clears the answers, so one person's
  // blood group never lands on someone else's entry (26 Nov 2026, user request)
  const answersOwner = forSelf === null ? '' : forSelf ? 'self' : savedId || 'new';
  const lastAnswersOwner = useRef(answersOwner);
  const keepAnswersOnce = useRef(false);
  // group registration: another card brings its own answers and shirt, so a new card is not a
  // change of person on this card
  const personId = shared.personId ?? '';
  const lastPersonId = useRef(personId);
  useEffect(() => {
    if (lastPersonId.current !== personId) {
      lastPersonId.current = personId;
      lastAnswersOwner.current = answersOwner;
      return;
    }
    if (lastAnswersOwner.current === answersOwner) return;
    const was = lastAnswersOwner.current;
    lastAnswersOwner.current = answersOwner;
    // saving the friend being typed only gives that same person an id
    if (keepAnswersOnce.current) {
      keepAnswersOnce.current = false;
      return;
    }
    if (was !== '') {
      setAnswers({});
      // the souvenir shirt is the person's too (it sits in their card since 28 Nov 2026)
      setShirtSize('' as ShirtSizeCode);
      setFinisherSize('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answersOwner, personId]);
  const lastSavedId = useRef<string>('');
  /* registering someone else: the emergency contact starts as the account owner (27 Nov 2026,
     user request) unless the friend's saved data has one; the runner can change it. The
     relationship stays empty for the runner to fill in (27 Nov 2026, user request) */
  const ownerEmergency = {
    name:
      `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || currentUser?.fullNameTh || '',
    relation: '',
    phone: profile?.phone ?? '',
  };
  const fillFriend = (p: SavedParticipant | null) => {
    fillFrom(p);
    if (!p?.emergencyContactName?.trim() && !p?.emergencyContactPhone?.trim()) {
      setEmergency(ownerEmergency.name, ownerEmergency.relation, ownerEmergency.phone);
    }
  };

  const [partEditId, setPartEditId] = useState<string | null>(null);
  // the friend editor was opened by a failed step: it marks the missing fields on open
  const [partEditCheck, setPartEditCheck] = useState(false);
  const [step2Notice, setStep2Notice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const pickParticipant = (id: string) => {
    setSavedId(id);
    fillFriend(saved.find((x) => x.id === id) ?? null);
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
    if (savedId === item.id) fillFriend(item);
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
  // "from the profile": the runner picks a contact (none is picked for them, 27 Nov 2026)
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
                              {/* the age says what it is counted on, not the date (28 Nov 2026, user request):
                                  "ณ วันแข่ง" or "ณ สิ้นปีที่แข่ง" (the organizer's choice per distance) */}
                              {txf('อายุ {0} ปี', ageCheck.ageYears)}{' '}
                              {ageCheck.basis === 'year_end' ? tx('ณ สิ้นปีที่แข่ง') : tx('ณ วันแข่ง')}
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
  const [acceptPdpa, setAcceptPdpa] = shared.acceptPdpa;

  const addonSatang = addonLines.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);
  const shipQuote = quoteRegistrationShipping(event, delivery === 'postal' ? 'postal_shipping' : 'pickup_at_expo', addonLines);
  const kitFee = kitShippingFee(event);
  // Thai name is optional; fall back to the (required) English name
  const participantName = `${firstTh} ${lastTh}`.trim() || `${firstEn} ${lastEn}`.trim();

  const go = (next: LabStep) => {
    setStepError(null);
    setInvalidZone(null);
    setMarkZones([]);
    // leaving the payment step backwards gives the held seat back first (it returns to edit)
    if (step === PAY_STEP && live.held && next < PAY_STEP) {
      live.held.cancel();
      return;
    }
    shared.step[1](next);
  };
  // payment step without a held registration (e.g. it was paid elsewhere): back to the summary
  useEffect(() => {
    if (step === PAY_STEP && !live.held && !live.freeJump) shared.step[1](pageNoOf('review') || pages.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, live.held]);
  // the steps changed under the runner (another distance skips a step): stay on a real step
  useEffect(() => {
    if (step > pages.length && step < PAY_STEP) shared.step[1](Math.max(1, pages.length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pages.length]);
  const termsRef = useRef<HTMLDivElement | null>(null);
  /** summary: accept the terms, then the entry is booked and held while the runner pays */
  const bookAndPay = () => {
    if (live.submitting) return;
    if (!acceptRules || !acceptPayTerms || !acceptPdpa) {
      // the agreements sit with the summary, which may be on an earlier step
      if (!has('review') && pageNoOf('review')) shared.step[1](pageNoOf('review'));
      setStepError('กรุณาติ๊กยอมรับทุกข้อที่มี * ก่อนไปชำระเงิน');
      setInvalidZone('terms');
      jumpToProblem();
      return;
    }
    setStepError(null);
    (live.book ?? live.submit)();
  };
  /** forward: the live form's checks for this step first */
  // a missing choice made: its frame and message go away at once
  useEffect(() => {
    if (!invalidZone) return;
    const fixed =
      (invalidZone === 'cat' && Boolean(picked)) ||
      (invalidZone === 'who' && forSelf !== null) ||
      // only the "pick a friend" message; a picked friend with missing data stays marked
      (invalidZone === 'friend' && Boolean(stepError?.startsWith('กรุณาเลือกเพื่อน')) && Boolean(savedId)) ||
      (invalidZone === 'ec' && Boolean(pickedEc)) ||
      (invalidZone === 'kit' && Boolean(delivery)) ||
      (invalidZone === 'addr' && Boolean(bookId));
    if (fixed) {
      setStepError(null);
      setInvalidZone(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidZone, picked, forSelf, savedId, pickedEc, delivery, bookId]);

  const goNext = (next: LabStep, onOk?: () => void) => {
    if (!page) return go(next);
    // group order: every person of the list must be complete; the first one that is not opens
    // its window with the gaps marked (nothing is checked before "ถัดไป", 28 Nov 2026)
    if (group && has('participant') && editing === null) {
      if (people.length === 0) {
        setStepError('กรุณาเพิ่มผู้สมัครอย่างน้อย 1 คน');
        setInvalidZone(null);
        return;
      }
      const bad = people.findIndex((pp) => pp.missing.length > 0);
      if (bad >= 0) {
        setStepError(null);
        setInvalidZone(null);
        group.open(bad, true);
        return;
      }
      setStepError(null);
      setInvalidZone(null);
      if (next === PAY_STEP) return bookAndPay();
      return go(next);
    }
    const onDetails = has('participant');
    // show the friend's email / phone problems next to the fields along with any other gaps
    if (onDetails && forSelf === false) setFriendContactCheck(true);
    let problem = live.check(page, bodyRef.current);
    if (!problem && onDetails && forSelf === false) {
      const contactProblem = firstFriendContactProblem(friendProblems);
      if (contactProblem) {
        setFriendContactCheck(true);
        problem = contactProblem;
      }
    }
    let zone: Zone | null = null;
    if (onDetails && forSelf === null) zone = 'who';
    // choices that start empty: say which one is missing and frame it
    const pickProblem: [string, Zone] | null =
      has('category') && !picked
        ? ['กรุณาเลือกประเภทการสมัคร', 'cat']
        : onDetails && forSelf === false && saved.length > 0 && !savedId
          ? ['กรุณาเลือกเพื่อนจากรายชื่อ หรือเลือก เพิ่มคนใหม่', 'friend']
          : onDetails && ecFromProfile && !pickedEc
            ? ['กรุณาเลือกผู้ติดต่อฉุกเฉิน', 'ec']
            : has('delivery') && !delivery
              ? ['กรุณาเลือกวิธีรับอุปกรณ์', 'kit']
              : has('delivery') && delivery === 'postal' && addrMode === 'saved' && book.length > 0 && !bookId
                ? ['กรุณาเลือกที่อยู่จัดส่ง', 'addr']
                : null;
    if (pickProblem) [problem, zone] = pickProblem;
    // the souvenir shirt is part of the runner details since 28 Nov 2026
    if (!problem && onDetails && !shirtSize) {
      problem = 'กรุณาเลือกไซส์เสื้อตามสิทธิ์สมัคร';
      zone = 'shirt';
    }
    if (problem) {
      setStepError(problem);
      setInvalidZone(zone);
      setMarkZones(
        [
          ...(has('category') ? (['cat'] as Zone[]) : []),
          ...(onDetails ? (['who', 'friend', 'ec', 'shirt'] as Zone[]) : []),
          ...(has('delivery') ? (['kit', 'addr'] as Zone[]) : []),
        ].filter(zoneMissing)
      );
      jumpToProblem();
      return;
    }
    setMarkZones([]);
    // a group card checked: file it (or open another one) instead of moving on
    if (onOk) {
      setStepError(null);
      setInvalidZone(null);
      setFriendContactCheck(false);
      onOk();
      return;
    }
    // the last step before payment books the place (the summary's own button does it on its step)
    if (next === PAY_STEP) return bookAndPay();
    go(next);
  };

  /** a choice area that is still empty (its red mark goes once it is picked) */
  const zoneMissing = (z: Zone): boolean => {
    switch (z) {
      case 'who':
        return forSelf === null;
      case 'friend':
        return forSelf === false && saved.length > 0 && !savedId;
      case 'cat':
        return !picked;
      case 'ec':
        return ecFromProfile && !pickedEc;
      case 'shirt':
        return !shirtSize;
      case 'kit':
        return !delivery;
      case 'addr':
        return delivery === 'postal' && addrMode === 'saved' && book.length > 0 && !bookId;
      default:
        return false;
    }
  };

  /* the window opened by "ถัดไป", and "บันทึก" in the window (28 Nov 2026, user request): mark what
     the person still lacks, like a step check; true when nothing is missing */
  const checkPerson = (): boolean => {
    const scope = windowRef.current;
    if (forSelf === false) setFriendContactCheck(true);
    let problem = page ? live.check(page, scope) : null;
    if (!problem && forSelf === false) problem = firstFriendContactProblem(friendProblems) ?? null;
    let zone: Zone | null = null;
    const pickProblem: [string, Zone] | null =
      forSelf === true && group?.selfRegCode
        ? [txf('คุณสมัครงานนี้แล้ว ({0}) เลือกผู้สมัครคนอื่น หรือลบการ์ดนี้', group.selfRegCode), 'who']
        : forSelf === null
        ? ['กรุณาเลือกผู้สมัคร', 'who']
        : forSelf === false && saved.length > 0 && !savedId
          ? ['กรุณาเลือกเพื่อนจากรายชื่อ หรือเลือก เพิ่มคนใหม่', 'friend']
          : !picked
            ? ['กรุณาเลือกระยะ', 'cat']
            : ecFromProfile && !pickedEc
              ? ['กรุณาเลือกผู้ติดต่อฉุกเฉิน', 'ec']
              : null;
    if (pickProblem) [problem, zone] = pickProblem;
    if (!problem && !shirtSize) {
      problem = 'กรุณาเลือกไซส์เสื้อตามสิทธิ์สมัคร';
      zone = 'shirt';
    }
    if (!problem) return true;
    setStepError(problem);
    setInvalidZone(zone);
    setMarkZones((['who', 'friend', 'cat', 'ec', 'shirt'] as Zone[]).filter(zoneMissing));
    jumpToProblem();
    return false;
  };
  const errorsShownFor = useRef<number | null>(null);
  useEffect(() => {
    if (!group || editing === null || editing !== group.errorsAt) {
      errorsShownFor.current = null;
      return;
    }
    if (errorsShownFor.current === editing) return;
    errorsShownFor.current = editing;
    window.setTimeout(() => checkPerson(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, group?.errorsAt]);
  const resetChecks = () => {
    setStepError(null);
    setInvalidZone(null);
    setMarkZones([]);
    setFriendContactCheck(false);
  };
  const openPerson = (target: number | 'self' | 'friend') => {
    if (!group) return;
    resetChecks();
    group.open(target);
  };
  // "บันทึก" files the person only when everything is filled in; otherwise the window stays open
  // with the gaps marked (28 Nov 2026, user request: validate on save like the step check)
  const savePerson = () => {
    if (!group) return;
    resetChecks();
    if (!checkPerson()) return;
    group.save();
  };
  const closePerson = () => {
    if (!group) return;
    resetChecks();
    setConfirmDiscard(false);
    group.cancel();
  };
  /** ✕ / ยกเลิก / Esc: edits are thrown away only after asking */
  const cancelPerson = () => {
    if (!group) return;
    if (group.isDirty()) setConfirmDiscard(true);
    else closePerson();
  };
  /** "yourself" in the who list / the radio: fill from the profile */
  const pickSelf = () => {
    if (live.fillSelf) {
      live.fillSelf();
      return;
    }
    setForSelf(true);
    fillFrom(profile ?? null);
    const primary = contacts.find((c) => c.isPrimary) ?? contacts[0];
    if (primary) setEmergency(primary.contactName, primary.relationship, primary.phone);
  };
  const selfName =
    `${profile?.firstNameEn ?? ''} ${profile?.lastNameEn ?? ''}`.trim() ||
    `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() ||
    currentUser?.fullNameTh ||
    '';
  const whoValue = forSelf === true ? 'self' : forSelf === false ? savedId : '';
  const pickWho = (v: string) => {
    setStep2Notice(null);
    if (v === 'self') return pickSelf();
    if (v === 'new') {
      if (forSelf === false && savedId && savedId !== 'new') lastSavedId.current = savedId;
      setForSelf(false);
      setSavedId('new');
      fillFriend(null);
      return;
    }
    setForSelf(false);
    pickParticipant(v);
  };
  /* who this window is for (28 Nov 2026, user decision): people already on another card of this
     order are left out of the list (their card is right behind the window), and so is "yourself"
     when this account already holds a place in the event (the list page names that entry).
     The person this window holds stays in the list. An empty group loses its heading too. */
  const showSelf = forSelf === true || !selfBlocked;
  const whoOptions = [
    ...(showSelf
      ? [
          {
            value: 'self',
            label: selfName ? txf('ตัวฉัน · {0}', selfName) : tx('ตัวฉัน'),
            hint: tx('ข้อมูลจากโปรไฟล์'),
            group: tx('บัญชีของฉัน'),
          },
        ]
      : []),
    ...[...saved]
      .sort(byLastUsed)
      .filter((pt) => (forSelf === false && savedId === pt.id) || !people.some((x, k) => k !== editing && !x.isSelf && x.savedId === pt.id))
      .map((pt) => ({
        value: pt.id,
        label: ptName(pt),
        hint: ptMeta(pt) || undefined,
        group: tx('เพื่อนที่บันทึกไว้'),
      })),
    { value: 'new', label: tx('+ เพิ่มคนใหม่'), hint: tx('กรอกข้อมูลเอง') },
  ];

  /* the group heads of the runner card (28 Nov 2026) */
  const extraFields = placedFields.filter((f) => page && f.stepKey === page.id && !isContentField(f));
  const isAnswered = (v: unknown) => v !== undefined && v !== null && v !== '' && v !== false;
  const extraAnswered = extraFields.filter((f) => isAnswered(answers[f.id])).length;
  const extraDone = extraFields.every((f) => !f.required || isAnswered(answers[f.id]));
  const generalDone = Boolean(
    firstEn.trim() &&
      lastEn.trim() &&
      emergencyName.trim() &&
      emergencyRelation.trim() &&
      emergencyPhone.trim() &&
      (!dobRequired || dob) &&
      (!ageCheck || ageCheck.eligible) &&
      (forSelf !== false || (phone.trim() && email.trim()))
  );
  const generalSummary = [
    `${firstEn} ${lastEn}`.trim(),
    ageCheck?.group ? txf('รุ่น {0}', formatAgeGroupLabel(ageCheck.group)) : '',
    phone ? displayPhone(phone) : '',
    emergencyName.trim() ? txf('ฉุกเฉิน: {0}', emergencyName.trim()) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  /* shirt cut: ชาย / หญิง / เด็ก (26 Nov 2026, user request). Kept on this page only for now:
     the registration stores the size; storing the cut and the finisher size is a backend task. */
  // an event with unisex shirts asks no cut (27 Nov 2026, user request)
  const unisex = event.shirtUnisex === true;
  const defaultCut = (): ShirtCut => {
    if (unisex) return 'Unisex';
    const pref = forSelf ? profile?.preferredShirtType : undefined;
    if (pref === 'Men' || pref === 'Women') return pref;
    return gender === 'หญิง' ? 'Women' : 'Men';
  };
  const [shirtCutPick, setShirtCut] = useState<ShirtCut | null>(null);
  const shirtCut = unisex ? 'Unisex' : shirtCutPick ?? defaultCut();
  // finisher shirt: on unless the organizer turns it off (the organizer switch is not built yet)
  // an event may give finishers a medal instead (27 Nov 2026, user request): no size to pick
  const finisherMedal = event.finisherReward === 'medal';
  const hasFinisher = !finisherMedal && (event.finisherShirtEnabled ?? true);
  const [finisherSize, setFinisherSize] = useState('');
  const [finisherCutPick, setFinisherCut] = useState<ShirtCut | null>(null);
  const finisherCut = unisex ? 'Unisex' : finisherCutPick ?? shirtCut;
  const cutLabel = (c: ShirtCut) => SHIRT_CUTS.find((x) => x.id === c)?.label ?? c;
  // "ทรง · แบบ" for the summary; a unisex shirt has no cut to name
  const withCut = (text: string, c: ShirtCut) => (c === 'Unisex' ? text : `${text} · ${tx(cutLabel(c))}`);

  const souvenirSummary = shirtSize
    ? `${withCut(tx(shirtStyleName(shirtStyle)), shirtCut)} · ${txf('ไซส์ {0}', shirtSize)}${finisherMedal ? ` · ${tx('เหรียญ Finisher')}` : ''}`
    : tx('เสื้อแข่งรวมในค่าสมัคร เลือกทรงและไซส์');

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

  const footer = (back: LabStep | null, next: LabStep | null, nextLabel = next === PAY_STEP ? (live.submitting ? 'กำลังกันที่นั่ง…' : 'ไปชำระเงิน') : 'ถัดไป') => (
    <>
    {stepError && !windowOpen && (
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
        {!group && picked && category && quote && (
          <div className="reg-lab-head-price">
            <span className="muted-inline">{tx(category.name)}</span>
            <strong className="mono-num">{formatThb(quote.runnerNetPaySatang, true)}</strong>
          </div>
        )}
      </header>

      <section className="reg-lab-card" aria-label={tx('ขั้นตอนการสมัครเข้าร่วมงานวิ่ง')}>
        {/* event-reg-wizard-pane: picks up the live form's stepper rules, so A and B show the same progress */}
        {step !== DONE_STEP && (
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

        <div ref={bodyRef} className={`reg-lab-body ${has('review') ? 'is-review' : ''}`}>
          {/* no notice bar over the form (28 Nov 2026, user request); a refused person still
              sees the reason inside their window */}
          {/* a step of the organizer's own (no system part): its title and description */}
          {page && !page.blocks?.length && (
            <div className="reg-lab-title">
              <h2>{tx(page.title)}</h2>
              {page.description && <p>{tx(page.description)}</p>}
            </div>
          )}

          {/* ---------- PART: distance ---------- */}
          {has('category') && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('เลือกประเภทการสมัคร')}</h2>
                <p>{tx('เลือกระยะและประเภทผู้สมัคร ราคาและจำนวนที่ว่างแสดงในแต่ละตัวเลือก')}</p>
              </div>
              <div className="reg-lab-choices" role="radiogroup" aria-label={tx('เลือกประเภทการสมัคร')} {...zoneMark('cat')}>
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
            </>
          )}

          {/* ---------- PART: the people of a group order (28 Nov 2026) ---------- */}
          {has('participant') && group && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('ผู้สมัครและระยะ')}</h2>
                <p>{tx('เพิ่มผู้สมัครได้หลายคนในคำสั่งซื้อเดียว แต่ละคนเลือกระยะของตัวเอง แล้วชำระเงินครั้งเดียว')}</p>
              </div>
              {people.length === 0 ? (
                <div className="reg-pw-start">
                  <button type="button" disabled={selfBlocked} onClick={() => openPerson('self')}>
                    <span className="reg-pw-start-ico" aria-hidden="true">
                      <FaIcon name="user" />
                    </span>
                    <strong>{tx('สมัครให้ตนเอง')}</strong>
                    <small>
                      {group.selfRegCode
                        ? txf('คุณสมัครงานนี้แล้ว ({0}) ดูได้ที่ประวัติการสมัคร', group.selfRegCode)
                        : tx('ใช้ข้อมูลจากโปรไฟล์ กรอกเพิ่มเฉพาะที่ขาด')}
                    </small>
                  </button>
                  <button type="button" onClick={() => openPerson('friend')}>
                    <span className="reg-pw-start-ico" aria-hidden="true">
                      <FaIcon name="user-group" />
                    </span>
                    <strong>{tx('สมัครให้ผู้อื่น')}</strong>
                    <small>{tx('เลือกจากรายชื่อเพื่อนที่บันทึกไว้ หรือเพิ่มคนใหม่')}</small>
                  </button>
                </div>
              ) : (
                <>
                  <ol className="reg-pw-list" aria-label={txf('ผู้สมัครในคำสั่งซื้อนี้ {0} คน', people.length)}>
                    {people.map((pp, i) => (
                      <li key={pp.key} className={`reg-pw-card ${pp.missing.length > 0 ? 'is-todo' : ''}`}>
                        <span className="reg-person-no" aria-hidden="true">
                          {i + 1}
                        </span>
                        <span className="reg-pw-card-main">
                          <strong>
                            {pp.name}
                            {pp.isSelf ? ` (${tx('ตัวฉัน')})` : ''}
                          </strong>
                          <small>
                            {[pp.catName || tx('ยังไม่เลือกระยะ'), pp.shirtSize ? txf('ไซส์ {0}', pp.shirtSize) : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </small>
                          <span className={`reg-pw-chip ${pp.missing.length > 0 ? 'is-todo' : 'is-done'}`}>
                            <FaIcon name={pp.missing.length > 0 ? 'triangle-exclamation' : 'check'} />
                            <span>
                              {pp.missing.length > 0
                                ? txf('ยังขาด: {0}', pp.missing.map((m) => tx(m)).join(', '))
                                : tx('ครบ')}
                            </span>
                          </span>
                        </span>
                        <span className="reg-pw-card-actions">
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            aria-label={txf('แก้ไข {0}', pp.name)}
                            onClick={() => openPerson(i)}
                          >
                            <FaIcon name="pen" />
                            <span>{tx('แก้ไข')}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-sm reg-person-remove"
                            aria-label={txf('ลบ {0}', pp.name)}
                            onClick={() => setConfirmDrop(i)}
                          >
                            <FaIcon name="trash-can" />
                            <span>{tx('ลบ')}</span>
                          </button>
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className={`reg-pw-adds ${selfListed ? 'is-single' : ''}`}>
                    {!selfListed && (
                      <button type="button" className="reg-pw-add" disabled={selfBlocked || !canAdd} onClick={() => openPerson('self')}>
                        <span>
                          <FaIcon name="user" /> {tx('+ สมัครให้ตนเอง')}
                        </span>
                        {group.selfRegCode && <small>{txf('คุณสมัครงานนี้แล้ว ({0})', group.selfRegCode)}</small>}
                      </button>
                    )}
                    <button type="button" className="reg-pw-add" disabled={!canAdd} onClick={() => openPerson('friend')}>
                      <span>
                        <FaIcon name="user-group" /> {tx('+ สมัครให้ผู้อื่น')}
                      </span>
                    </button>
                  </div>
                  <p className="reg-pw-count">
                    {canAdd
                      ? txf('{0}/{1} คนต่อครั้ง', people.length, group.max)
                      : txf('ครบ {0} คนต่อครั้งแล้ว', group.max)}
                  </p>
                </>
              )}
              {confirmDrop !== null && (
                <ConfirmBox
                  text="ต้องการลบผู้สมัครรายนี้หรือไม่"
                  yesLabel="ลบผู้สมัคร"
                  danger
                  onNo={() => setConfirmDrop(null)}
                  onYes={() => {
                    group.remove(confirmDrop);
                    setConfirmDrop(null);
                    resetChecks();
                  }}
                />
              )}
            </>
          )}

          {/* ---------- PART: runner details (a group order: inside the person window) ---------- */}
          {has('participant') && category && (!group || windowOpen) && (
            <PersonWindow
              open={!!group}
              title={txf('ผู้สมัครคนที่ {0}', editing !== null && editing >= 0 ? editing + 1 : people.length + 1)}
              banner={
                stepError ? (
                  <div className="error-callout" role="alert">
                    <IconAlert size={16} />
                    <span>{tx(stepError)}</span>
                  </div>
                ) : group && editing !== null && editing === group.errorsAt && live.resumeNotice ? (
                  // the booking was refused for this person (e.g. already registered): say why
                  // inside their window, not only on the page behind it (28 Nov 2026)
                  <div className="error-callout" role="alert">
                    <IconAlert size={16} />
                    <span>{tx(live.resumeNotice)}</span>
                  </div>
                ) : null
              }
              blocked={Boolean(partEditId || ecEditId || confirmDiscard)}
              onCancel={cancelPerson}
              onSave={savePerson}
              windowRef={windowRef}
            >
            <>
              {!group && (
              <div className="reg-lab-title">
                {/* the distance is named only once picked (the organizer may ask the runner first, 27 Nov 2026) */}
                <h2>{picked ? txf('ข้อมูลผู้เข้าแข่งขัน · {0}', tx(category.name)) : tx('ข้อมูลผู้เข้าแข่งขัน')}</h2>
                <p>{tx('ช่องที่มี * จำเป็นต้องกรอก ข้อมูลอื่นช่วยให้ผู้จัดติดต่อและจัดรุ่นอายุได้ถูกต้อง')}</p>
              </div>
              )}

              {group ? (
                <section className="reg-lab-section reg-pw-who" aria-label={tx('ผู้สมัครและระยะ')}>
                  <div className="form-row reg-lab-friend-pick reg-lab-zone" {...zoneMark(forSelf === false ? 'friend' : 'who')}>
                    <label htmlFor="lab-who-pick">
                      <RequiredFieldText text={tx('สมัครให้ใคร *')} />
                    </label>
                    <SelectMenu
                      id="lab-who-pick"
                      value={whoValue}
                      placeholder={tx(showSelf ? 'เลือกตัวฉัน เพื่อน หรือเพิ่มคนใหม่' : 'เลือกเพื่อนที่บันทึกไว้ หรือเพิ่มคนใหม่')}
                      onChange={pickWho}
                      options={whoOptions}
                    />
                    {step2NoticeEl}
                  </div>
                  <div className="form-row reg-lab-friend-pick reg-lab-zone" {...zoneMark('cat')}>
                    <label htmlFor="lab-card-dist">
                      <RequiredFieldText text={tx('ระยะ *')} />
                    </label>
                    <SelectMenu
                      id="lab-card-dist"
                      value={optionId}
                      placeholder={tx('เลือกระยะ')}
                      onChange={(v) => setOptionId(v)}
                      options={options.map((o) => {
                        const c = event.categories.find((x) => x.id === o.catId);
                        const t = c ? getCurrentTier(c) : null;
                        const q = t ? calculateFeeQuote(t.priceSatang, event.feeBearerPolicy) : null;
                        const left = c ? openSeatsFor(c) : 0;
                        return {
                          value: o.optionId,
                          label: tx(o.label),
                          hint: [tx(o.subLabel), q ? formatThb(q.runnerNetPaySatang, true) : '', left <= 0 ? tx('เต็มแล้ว') : '']
                            .filter(Boolean)
                            .join(' · '),
                          disabled: left <= 0,
                        };
                      })}
                    />
                  </div>
                </section>
              ) : (
              <section className="reg-lab-section" aria-labelledby="lab-who" {...zoneMark('who')}>
                <h3 id="lab-who">{tx('ใครเป็นผู้เข้าแข่งขัน')}</h3>
                <div className="reg-lab-pair-cards" role="radiogroup" aria-labelledby="lab-who">
                  <label className={`reg-category-radio-card ${forSelf === true ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="lab-mode"
                      checked={forSelf === true}
                      onChange={pickSelf}
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
                        // no friend is picked for the runner; with no saved friends the form opens
                        setSavedId(saved.length > 0 ? '' : 'new');
                        fillFriend(null);
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

                {/* someone else: pick the friend from one list before the form shows (28 Nov 2026, user
                    request); "+ เพิ่มคนใหม่" opens an empty form. With no saved friends the form opens at once. */}
                {forSelf === false && saved.length > 0 && (
                  <div className="form-row reg-lab-friend-pick reg-lab-zone" {...zoneMark('friend')}>
                    <label htmlFor="lab-friend">
                      <RequiredFieldText text={tx('สมัครให้ใคร *')} />
                    </label>
                    <SelectMenu
                      id="lab-friend"
                      value={savedId}
                      placeholder={tx('เลือกเพื่อนที่บันทึกไว้ หรือเพิ่มคนใหม่')}
                      onChange={(v) => {
                        setStep2Notice(null);
                        if (v === 'new') {
                          if (savedId !== 'new') lastSavedId.current = savedId;
                          setSavedId('new');
                          fillFriend(null);
                        } else pickParticipant(v);
                      }}
                      options={[
                        ...[...saved].sort(byLastUsed).map((pt) => ({
                          value: pt.id,
                          label: ptName(pt),
                          hint: ptMeta(pt) || undefined,
                          group: tx('เพื่อนที่บันทึกไว้'),
                        })),
                        { value: 'new', label: tx('+ เพิ่มคนใหม่'), hint: tx('กรอกข้อมูลเอง') },
                      ]}
                    />
                    {step2NoticeEl}
                  </div>
                )}

              </section>

              )}

              {formShown && (
                <>
                  <RegGroup
                    key={`general-${personId}-${answersOwner}`}
                    gid="general"
                    icon={<IconUsers size={18} />}
                    title="ข้อมูลทั่วไป"
                    summary={generalSummary}
                    done={generalDone}
                    todo="ยังไม่ครบ"
                  >
                  <section className="reg-lab-section" aria-labelledby="lab-names">
                    <h3 id="lab-names">{tx('ชื่อผู้เข้าแข่งขัน')}</h3>
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

                  <section className="reg-lab-section" aria-labelledby="lab-emergency">
                    <h3 id="lab-emergency">{tx('ผู้ติดต่อฉุกเฉิน')}</h3>
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
                      <div className="reg-lab-zone" {...zoneMark('ec')}>
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
                      </div>
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
                        {/* required on the entry form (27 Nov 2026, user request) */}
                        <label htmlFor="lab-emerg-rel">
                          <RequiredFieldText text={tx('ความสัมพันธ์ *')} />
                        </label>
                        <input
                          id="lab-emerg-rel"
                          type="text"
                          required
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
                  </RegGroup>

                  {extraFields.length > 0 && (
                    <RegGroup
                      key={`extra-${personId}-${answersOwner}`}
                      gid="extra"
                      icon={<IconLedger size={18} />}
                      title="ข้อมูลเพิ่มเติม"
                      summary={txf('ตอบแล้ว {0} จาก {1} ข้อ', extraAnswered, extraFields.length)}
                      done={extraDone}
                      todo="ยังไม่ครบ"
                    >
                    <section className="reg-lab-section reg-lab-custom">
                      <RunnerCustomFieldsInputs
                        fields={placedFields}
                        answers={answers}
                        onAnswerChange={(id, v) => {
                          live.clearError(id);
                          setStepError(null);
                          setAnswers({ ...answers, [id]: v });
                        }}
                        raceDistanceCode={category.code}
                        shirtSize={shirtSize}
                        publishedFormVersion={event.publishedFormVersion}
                        steps={live.flow}
                        stepId={page?.id ?? CORE_STEP}
                        errors={live.errors}
                        heading={null}
                      />
                    </section>

                    </RegGroup>
                  )}

                  <RegGroup
                    key={`souvenir-${personId}-${answersOwner}`}
                    gid="souvenir"
                    icon={<IconShirt size={18} />}
                    title="สินค้าที่ระลึก"
                    summary={souvenirSummary}
                    done={Boolean(shirtSize)}
                    todo="ยังไม่เลือกไซส์เสื้อ"
                  >
                    {/* no hint lines under the headings of the form (28 Nov 2026, user request) */}
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
              <div className="reg-lab-zone" {...zoneMark('shirt')}>
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
                cuts={unisex ? undefined : SHIRT_CUTS}
                cut={shirtCut}
                onCutChange={(c) => {
                  setShirtCut(c as ShirtCut);
                  // a new cut starts with no size picked, like a new style (27 Nov 2026, user request)
                  if (c !== shirtCut) setShirtSize('' as ShirtSizeCode);
                }}
                cutNote={unisex ? 'เสื้อแบบ Unisex ทรงเดียว ใส่ได้ทั้งชายและหญิง' : null}
              />
              </div>
              {finisherMedal && (
                <section className="reg-lab-section reg-lab-finisher" id="lab-finisher" aria-labelledby="lab-finisher-h">
                  <h3 id="lab-finisher-h">{tx('เหรียญ Finisher')}</h3>
                  <figure className="reg-lab-medal">
                    <img src={FINISHER_MEDAL_PHOTO} alt={tx('เหรียญ Finisher')} />
                    <figcaption>
                      <strong>{tx('ได้รับเมื่อวิ่งเข้าเส้นชัยภายในเวลาที่กำหนด')}</strong>
                      <span>{tx('รวมในค่าสมัครแล้ว')}</span>
                    </figcaption>
                  </figure>
                </section>
              )}
              {hasFinisher && (
                <section className="reg-lab-section reg-lab-finisher" id="lab-finisher" aria-labelledby="lab-finisher-h">
                  <h3 id="lab-finisher-h">
                    {tx('เสื้อ Finisher (ไม่บังคับ)')}
                  </h3>
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
                    cuts={unisex ? undefined : SHIRT_CUTS}
                    cut={finisherCut}
                    onCutChange={(c) => {
                      if (c !== finisherCut) setFinisherSize('');
                      setFinisherCut(c as ShirtCut);
                    }}
                    cutNote={unisex ? 'เสื้อแบบ Unisex ทรงเดียว ใส่ได้ทั้งชายและหญิง' : null}
                  />
                </section>
              )}
                  </RegGroup>

                </>
              )}
              {partEditId && (
                <SavedParticipantModal
                  key={partEditId}
                  owner={{ email: currentUser?.contactEmail, phone: currentUser?.runnerProfile?.phone }}
                  idPrefix="lab-sp-edit"
                  participant={saved.find((x) => x.id === partEditId) ?? null}
                  entryRules={{ dob: dobRequired }}
                  ownerEmergency={ownerEmergency}
                  checkOnOpen={partEditCheck}
                  shirtSizes={(platformProfileConfig?.shirtSizes ?? [])
                    .filter((sz) => sz.enabled)
                    .sort((x, y) => x.sortOrder - y.sortOrder)
                    .map((sz) => sz.code)}
                  onCancel={() => {
                    setPartEditId(null);
                    setPartEditCheck(false);
                  }}
                  onSave={async (item) => {
                    await saveEditedParticipant(item);
                    setPartEditCheck(false);
                    if (invalidZone === 'friend') {
                      setStepError(null);
                      setInvalidZone(null);
                    }
                  }}
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
              {confirmDiscard && (
                <ConfirmBox
                  text="ทิ้งการแก้ไขของผู้สมัครคนนี้หรือไม่"
                  yesLabel="ทิ้งการแก้ไข"
                  noLabel="กลับไปแก้ไข"
                  danger
                  onNo={() => setConfirmDiscard(false)}
                  onYes={closePerson}
                />
              )}
            </>
            </PersonWindow>
          )}

          {/* ---------- PART: souvenirs ---------- */}
          {has('souvenir') && hasSouvenirs && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('ของที่ระลึก (ไม่บังคับ)')}</h2>
                <p>{tx('สั่งเสื้อหรือเหรียญที่ระลึกเพิ่มพร้อมใบสมัคร ชำระรวมกับค่าสมัคร')}</p>
              </div>
              <SouvenirPicker products={event.products} value={addonItems} onChange={setAddonItems} />
            </>
          )}

          {/* ---------- PART: delivery and address ---------- */}
          {has('delivery') && (
            <>
              <div className="reg-lab-title">
                <h2>{tx('วิธีรับอุปกรณ์ (Race Kit)')}</h2>
                <p>{tx('รับเองที่หน้างานไม่มีค่าใช้จ่าย หรือให้จัดส่งตามเงื่อนไขของผู้จัด')}</p>
              </div>
              <div className="reg-lab-choices" role="radiogroup" aria-label={tx('วิธีรับอุปกรณ์ (Race Kit)')} {...zoneMark('kit')}>
                <label className={`reg-category-radio-card ${delivery === 'expo_pickup' ? 'selected' : ''}`}>
                  <input type="radio" name="lab-kit" checked={delivery === 'expo_pickup'} onChange={() => setDelivery('expo_pickup')} />
                  <span className="custom-radio-circle" aria-hidden="true" />
                  <div className="reg-radio-card-copy">
                    <strong>{tx('รับ Race Kit ด้วยตนเองที่หน้างาน (QR Check-in)')}</strong>
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
                    <div className="reg-lab-zone" {...zoneMark('addr')}>
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
                          <input id="lab-recipient" type="text" required value={recipient} onChange={(e) => setRecipient(e.target.value)} />
                        </div>
                        <div className="form-row reg-lab-full">
                          <label htmlFor="lab-ship-phone"><RequiredFieldText text={tx('เบอร์โทรผู้รับ *')} /></label>
                          <PhoneInput id="lab-ship-phone" value={shipPhone} onChange={setShipPhone} required />
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
            </>
          )}

          {/* ---------- PART: summary (the agreements sit here) ---------- */}
          {has('review') && category && tier && quote && (() => {
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
            /* the order sheet (28 Nov 2026, user pick "B"): people, souvenirs, kit, totals, pay */
            const detailsStep = pageNoOf('participant') || undefined;
            const optionLabel = (id: string) => {
              const o = options.find((x) => x.optionId === id);
              return o ? tx(o.label) : '';
            };
            const sheetPeople: SheetPerson[] = group
              ? people.map((pp, i) => ({
                  key: pp.key,
                  name: pp.name,
                  isSelf: pp.isSelf,
                  line: [pp.catName, pp.tierLabel, pp.shirtSize ? txf('ไซส์ {0}', pp.shirtSize) : ''].filter(Boolean).join(' · '),
                  satang: pp.satang,
                  rows: [{ label: tx('ประเภท'), value: optionLabel(pp.optionId) }, ...pp.details],
                  onEdit: detailsStep
                    ? () => {
                        go(detailsStep as LabStep);
                        group.open(i);
                      }
                    : undefined,
                }))
              : [
                  {
                    key: 'one',
                    name: `${firstEn} ${lastEn}`.trim() || participantName,
                    isSelf: forSelf === true && !!currentUser,
                    line: [tx(category.name), tx(tier.label), shirtSize ? txf('ไซส์ {0}', shirtSize) : ''].filter(Boolean).join(' · '),
                    satang: quote.runnerNetPaySatang,
                    rows: [
                      { label: tx('ประเภท'), value: picked ? tx(picked.label) : '' },
                      {
                        label: tx('ระยะ'),
                        value: `${tx(category.name)} · ${tx('ปล่อยตัว')} ${category.startTimeLocal} ${tx('น.')}`,
                      },
                      {
                        label: tx('ชื่อ-นามสกุล'),
                        value: nickTh.trim() ? `${participantName} (${nickTh.trim()})` : participantName,
                      },
                      { label: tx('วันเกิด · เพศ'), value: [dob, tx(gender)].filter(Boolean).join(' · ') },
                      { label: tx('เบอร์โทร'), value: displayPhone(phone) },
                      {
                        label: idType === 'passport' ? tx('หนังสือเดินทาง') : tx('เลขบัตรประชาชน'),
                        value: idDigits ? `•••• ${idDigits.slice(-4)}` : '',
                      },
                      { label: tx('ผู้ติดต่อฉุกเฉิน'), value: tx(emergency.trim()) },
                      { label: tx('เสื้อตามสิทธิ์'), value: `${withCut(tx(shirtStyleName(shirtStyle)), shirtCut)} · ${shirtSize}` },
                      ...(finisherMedal
                        ? [{ label: tx('เหรียญ Finisher'), value: tx('ได้รับเมื่อวิ่งเข้าเส้นชัยภายในเวลาที่กำหนด') }]
                        : []),
                      ...(hasFinisher
                        ? [
                            {
                              label: tx('เสื้อ Finisher'),
                              value: finisherSize ? (unisex ? finisherSize : `${tx(cutLabel(finisherCut))} · ${finisherSize}`) : tx('ไม่ระบุ'),
                            },
                          ]
                        : []),
                      ...answerRows,
                    ],
                    onEdit: detailsStep ? () => go(detailsStep as LabStep) : undefined,
                  },
                ];
            const addonCount = addonLines.reduce((n, l) => n + l.qty, 0);
            const sheetBlocks: SheetBlock[] = [
              {
                key: 'souvenir',
                title: tx('ของที่ระลึก'),
                count: txf('{0} ชิ้น', addonCount),
                editStep: pageNoOf('souvenir') || undefined,
                lines: addonLines.map((l, k) => ({
                  key: `${l.prd.id}-${l.size}-${k}`,
                  label: `${tx(l.prd.nameTh)}${l.size !== '-' && l.prd.availableSizes.length > 1 ? ` · ${l.size}` : ''} ×${l.qty}`,
                  satang: l.prd.priceSatang * l.qty,
                })),
              },
              {
                key: 'kit',
                title: tx('การรับอุปกรณ์'),
                editStep: pageNoOf('delivery') || undefined,
                lines: [
                  {
                    key: 'how',
                    label: delivery === 'postal' ? tx('จัดส่งทางไปรษณีย์') : tx('รับเองที่หน้างาน (QR Check-in)'),
                    sub: delivery === 'postal' ? tx(shipText.trim()) : undefined,
                    ...(shipQuote.kitSatang > 0 ? { satang: shipQuote.kitSatang } : { freeText: tx('ไม่มีค่าจัดส่ง') }),
                  },
                  ...shipQuote.sellers.map((x) => ({
                    key: `seller-${x.seller}`,
                    label: txf('ค่าจัดส่งของที่ระลึก ({0})', tx(x.seller)),
                    satang: x.satang,
                  })),
                ],
              },
            ];
            const peopleSatang = group ? people.reduce((n, pp) => n + pp.satang, 0) : quote.runnerNetPaySatang;
            const sheetTotals = [
              group
                ? { label: txf('ค่าสมัคร {0} คน', people.length), sub: tx('รวมค่าบริการระบบแล้ว'), satang: peopleSatang }
                : { label: txf('ค่าสมัคร ({0})', tx(tier.label)), satang: quote.baseSatang },
              ...(group
                ? []
                : [{ label: txf('ค่าบริการระบบ ({0})', feePolicyLabel(event.feeBearerPolicy)), satang: quote.runnerFeeSatang }]),
              ...(addonCount > 0 ? [{ label: tx('ของที่ระลึก'), satang: addonSatang }] : []),
              ...(shipQuote.totalSatang > 0 ? [{ label: tx('ค่าจัดส่ง'), satang: shipQuote.totalSatang }] : []),
            ];
            const reviewTotal = peopleSatang + addonSatang + shipQuote.totalSatang;
            return (
              <>
                <div className="reg-lab-title">
                  <h2>{tx('ตรวจข้อมูลก่อนชำระเงิน')}</h2>
                  <p>{tx('ตรวจทุกส่วนให้ถูกต้อง ถ้าต้องการเปลี่ยน กด "แก้ไข" เพื่อกลับไปขั้นนั้น')}</p>
                </div>
                <RegistrationOrderSheet
                  people={sheetPeople}
                  peopleEditStep={detailsStep}
                  blocks={sheetBlocks}
                  totals={sheetTotals}
                  totalSatang={reviewTotal}
                  onEdit={(st) => go(st as LabStep)}
                  // the summary books the place only when nothing comes after it; otherwise
                  // the next steps follow and the last one goes to payment
                  action={
                    isLastPage
                      ? {
                          label: live.submitting ? 'กำลังกันที่นั่ง…' : 'ไปชำระเงิน',
                          onClick: bookAndPay,
                        }
                      : undefined
                  }
                  consent={
                    /* the entry is booked when leaving this step, so the agreements are ticked
                       here, right above the pay button */
                    <div className="reg-lab-terms" ref={termsRef} {...zoneMark('terms')}>
                      <RegistrationTerms
                        event={event}
                        organization={organization}
                        acceptRules={acceptRules}
                        onAcceptRules={(v) => {
                          setAcceptRules(v);
                          setStepError(null);
                        }}
                        acceptPayment={acceptPayTerms}
                        onAcceptPayment={(v) => {
                          setAcceptPayTerms(v);
                          setStepError(null);
                        }}
                        acceptPrivacy={acceptPdpa}
                        onAcceptPrivacy={(v) => {
                          setAcceptPdpa(v);
                          setStepError(null);
                        }}
                      />
                    </div>
                  }
                />
                {live.payError}
              </>
            );
          })()}

          {/* questions of a step that does not hold the runner details (those sit inside it) */}
          {page && !has('participant') && category && (
            <section className="reg-lab-section reg-lab-custom">
              <RunnerCustomFieldsInputs
                fields={placedFields}
                answers={answers}
                onAnswerChange={(id, v) => {
                  live.clearError(id);
                  setStepError(null);
                  setAnswers({ ...answers, [id]: v });
                }}
                raceDistanceCode={category.code}
                shirtSize={shirtSize}
                steps={live.flow}
                stepId={page.id}
                errors={live.errors}
                heading={page.blocks?.length ? undefined : null}
              />
            </section>
          )}
          {page && isLastPage && !has('review') && live.payError}
          {/* one pair of buttons per step; the summary's own button books when it is the last step */}
          {page && footer(prevPage, isLastPage ? (has('review') ? null : PAY_STEP) : nextPage)}

          {/* ---------- payment of the held registration ---------- */}
          {step === PAY_STEP && live.held && (() => {
            const held = live.held;
            const reg = held.reg;
            const regs = held.regs && held.regs.length > 0 ? held.regs : [reg];
            const regCat = event.categories.find((c) => c.id === reg.categoryId);
            const addonSatang = held.addonOrders.reduce((sum, o) => sum + o.totalPaidSatang, 0);
            const total = regs.reduce((sum, r) => sum + r.snapshotTotalChargedSatang, 0) + addonSatang;
            // the kit postage is charged once, on the first entry: shown on its own line, not inside
            // that person's fee (28 Nov 2026, the payment step showed 695 for a 645 entry)
            const kitShip = (r: RegistrationRecord) => r.snapshotKitShippingSatang ?? 0;
            const feeOf = (r: RegistrationRecord) => r.snapshotTotalChargedSatang - kitShip(r);
            const shipSatang = regs.reduce((sum, r) => sum + kitShip(r), 0);
            return (
              <>
                <div className="reg-lab-title">
                  <h2>{tx('ชำระเงินและยืนยันการสมัคร')}</h2>
                  <p>{tx('บันทึกใบสมัครไว้แล้ว ชำระเงินเพื่อยืนยันสิทธิ์')}</p>
                </div>

                <HoldCountdown expiresAt={reg.reservationExpiresAt} />

                <section className="reg-lab-section" aria-labelledby="lab-held">
                  {/* the code labels the card: same row as the heading, on the right; on a narrow
                      screen it drops under the heading (28 Nov 2026, user request) */}
                  <div className="reg-lab-held-head">
                    <h3 id="lab-held">{tx('ใบสมัครที่รอชำระ')}</h3>
                    <p className="reg-lab-hint">
                      {regs.length > 1 ? (
                        <>
                          {tx('รหัสคำสั่งซื้อ')} <span className="mono-code">{reg.orderCode}</span> ·{' '}
                          {txf('ใบสมัคร {0} ใบ', regs.length)}
                        </>
                      ) : (
                        // the code alone, no word before it (28 Nov 2026, user request); a screen
                        // reader still hears what it is
                        <>
                          <span className="sr-only">{tx('รหัสใบสมัคร')} </span>
                          <span className="mono-code">{reg.regCode}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <dl className="reg-lab-ledger">
                    {regs.length > 1 ? (
                      // a group order: one line per person (28 Nov 2026)
                      regs.map((r, i) => {
                        const rc = event.categories.find((c) => c.id === r.categoryId);
                        return (
                          <div key={r.id}>
                            <dt>
                              {txf('คนที่ {0}', i + 1)} · {r.participantNameEn || r.participantNameTh}
                              {rc ? ` · ${tx(rc.name)}` : ''}
                            </dt>
                            <dd className="mono-num">{formatThb(feeOf(r), true)}</dd>
                          </div>
                        );
                      })
                    ) : (
                      <>
                        <div>
                          <dt>{tx('ผู้เข้าแข่งขัน')}</dt>
                          <dd>{reg.participantNameEn || reg.participantNameTh}</dd>
                        </div>
                        {regCat && (
                          <div>
                            <dt>{tx('ระยะ')}</dt>
                            <dd>{tx(regCat.name)}</dd>
                          </div>
                        )}
                        <div>
                          <dt>{tx('ค่าสมัคร')}</dt>
                          <dd className="mono-num">{formatThb(feeOf(reg), true)}</dd>
                        </div>
                      </>
                    )}
                    {shipSatang > 0 && (
                      <div>
                        <dt>{tx('ค่าจัดส่งชุดแข่ง')}</dt>
                        <dd className="mono-num">{formatThb(shipSatang, true)}</dd>
                      </div>
                    )}
                    {held.addonOrders.map((o) => (
                      <div key={o.id}>
                        <dt>
                          {tx(o.productNameTh)}
                          {o.variantSize !== '-' ? ` · ${o.variantSize}` : ''} × {o.quantity}
                        </dt>
                        <dd className="mono-num">{formatThb(o.totalPaidSatang, true)}</dd>
                      </div>
                    ))}
                    <div className="reg-lab-ledger-total">
                      <dt>{tx('ยอดชำระสุทธิทั้งหมด')}</dt>
                      <dd className="mono-num text-vermilion">{formatThb(total, true)}</dd>
                    </div>
                  </dl>
                </section>

                <section className="reg-lab-section" {...zoneMark('pay')}>
                  <PaymentMethodPicker
                    name="lab-pay"
                    value={channel}
                    onChange={(c) => {
                      setChannel(c);
                      if (invalidZone === 'pay') {
                        setStepError(null);
                        setInvalidZone(null);
                      }
                    }}
                  />
                </section>
                {invalidZone === 'pay' && stepError && (
                  <div className="error-callout" role="alert">
                    <IconAlert size={17} />
                    <span>{tx(stepError)}</span>
                  </div>
                )}

                {held.error && (
                  <div className="error-callout" role="alert">
                    <IconAlert size={17} />
                    <span>{tx(held.error)}</span>
                  </div>
                )}

                <div className="reg-lab-footer">
                  <button type="button" className="btn-secondary" disabled={held.busy} onClick={held.cancel}>
                    {held.fromForm ? tx('ย้อนกลับไปแก้ไข') : tx('ยกเลิกและกรอกใหม่')}
                  </button>
                  <div className="reg-lab-footer-actions">
                    <button type="button" className="btn-ghost-sm" disabled={held.busy} onClick={held.another}>
                      {tx('สมัครให้คนอื่น')}
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={held.busy}
                      onClick={() => {
                        // the payment method starts unpicked too (27 Nov 2026)
                        if (!channel) {
                          setStepError('กรุณาเลือกช่องทางชำระเงิน');
                          setInvalidZone('pay');
                          jumpToProblem();
                          return;
                        }
                        held.pay();
                      }}
                    >
                      {held.busy ? tx('กำลังดำเนินการ…') : txf('ชำระเงิน {0}', formatThb(total, true))}
                    </button>
                  </div>
                </div>
              </>
            );
          })()}

          {/* ---------- booked, on its own centred screen ---------- */}
          {step === DONE_STEP && live.done}
        </div>
      </section>
    </main>
  );
}

/** minutes:seconds left on a held registration; past zero it says the time is up */
function HoldCountdown({ expiresAt }: { expiresAt: string | null | undefined }) {
  const end = expiresAt ? Date.parse(expiresAt) : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(end)) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [end]);
  if (!Number.isFinite(end)) return null;
  const left = Math.max(0, Math.floor((end - now) / 1000));
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className={`reg-hold-timer ${left === 0 ? 'is-over' : left < 120 ? 'is-low' : ''}`} role="timer" aria-live="off">
      <IconClock size={17} />
      {left > 0 ? (
        <span>
          {tx('กันที่นั่งไว้ให้ ชำระภายใน')} <strong className="mono-num">{mm}:{ss}</strong>
        </span>
      ) : (
        <span>{tx('หมดเวลาชำระเงินแล้ว กดชำระเงินเพื่อตรวจสถานะ หรือกรอกใหม่')}</span>
      )}
    </div>
  );
}
