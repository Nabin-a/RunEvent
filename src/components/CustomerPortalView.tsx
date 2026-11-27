import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MerchOrderRecord,
  Organization,
  PlatformProfileConfig,
  RaceCategory,
  RaceEvent,
  RegistrationRecord,
  ReturnIntent,
  RunnerProfileData,
  SavedParticipant,
  ShirtSizeCode,
  UserAccount,
} from '../types';
import { resolveShirtSpec } from '../data/runnerProfileDefaults';
import {
  calculateFeeQuote,
  formatThb,
  getCurrentTier,
} from '../utils/pricing';
import {
  EventCoverMedia,
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconBag,
  IconBib,
  IconBuilding,
  IconCalendar,
  IconAward,
  IconCamera,
  IconCheckCircle,
  IconClock,
  IconFlag,
  IconLock,
  IconMapPin,
  IconQr,
  IconSearch,
  IconShirt,
} from './Icons';
import { RegistrationDone } from './RegistrationReview';
import { StorefrontView, type CartLine, type MerchCheckoutPayload, type MerchCheckoutResult } from './StorefrontView';
import { PAYMENT_TERMS_VERSION, REGISTRATION_PRIVACY_VERSION } from './RegistrationTerms';
import type { SouvenirLayout } from './SouvenirPicker';
import {
  ConfirmationFileActions,
  ConfirmationModal,
  confirmationItems,
  confirmationQr,
  confirmationTitle,
} from './RegistrationConfirmation';
import { displayPhone } from '../utils/phone';
import { CategoryAgeGroups, categoryHasAgeGroups } from './EventAgeGroupsSection';
import { ProductArt, souvenirArt } from './ProductArt';
import { pageOf, resolveBlockKey, resolveDetailLayout } from '../data/eventDetailLayout';
import { EventCustomBlockView } from './EventCustomBlockView';
import { EventDataPieceView, type DataPieceCtx } from './EventDataPieceView';
import { dataPieceHasContent, mergedCoreText } from '../data/eventDataPieces';
import { usePagePreview } from './pagePreview';
import { useFormPreview } from './formPreview';
import type { EventDetailBlockId, EventDetailPage, EventPageItem } from '../types';
import { FaIcon } from './FaIcon';
import { RaceCalendarView } from './RaceCalendarView';
import { MobileRegisterBar } from './MobileRegisterBar';
import { ScheduleTimeline } from './ScheduleTimeline';
import { HomeScrollMotion } from './HomeScrollMotion';
import { StickyCardCompact } from './StickyCardCompact';
import { MascotAnim } from './MascotAnim';
import { isTotalQuotaEnabled } from '../utils/eventConfig';
import { DirectoryEmptyState, HeroRegionSelect, HeroSearchField, matchesSearchText, similarSearchTerms } from './DirectorySearch';
import { RegistrationLabView, type LabLive, type LabShared } from './RegistrationLabView';
import { type ShirtStyleId } from '../data/mockShirtStyles';
import { MascotSprite } from './MascotRunner';
import { reportInvalidFieldsWithin } from '../utils/formValidation';
import type { CascadingAddressValue } from './ThaiPostalAddressSelector';
import { maskIdNumber } from '../utils/dateFormat';
import { EventStatusBadge, PaymentStatusBadge } from './StatusBadges';
import { CORE_STEP, stepsShown, validateAnswers } from '../data/registrationForm';

import { getLang, tx, txf } from '../i18n';
import { FEATURES } from '../config/features';
import {
  ageCheckMessage,
  evaluateCategoryAge,
  formatAgeBasis,
  formatAgeLimit,
} from '../utils/age';
import { QrCode } from './QrCode';
import {
  CertificatePreviewCard,
  RegHeadline,
  RegProgress,
  RegResultActions,
  RegSnapshotDetails,
  regAgeShort,
  regIsPast,
  type HistoryFilter,
} from './RegistrationHistoryParts';
import { formatBasisDate, todayIsoInTimeZone } from '../utils/age';
/** Registration wizard steps: 1 start, 2 participant, 3 race-kit shirt, 4 souvenirs,
 *  5 address, 6 payment, 7 done. Step 4 is skipped when the event sells nothing. */
/** 1-8 as before; the organizer's own steps (24 Nov 2026) sit between 2 and 3 as 2.1, 2.2, 2.3 */
type RegStep = number;

export type CustomerSubView =
  | 'directory'
  | 'event_detail'
  | 'event_register'
  | 'my_orders'
  | 'calendar';

interface CustomerPortalViewProps {
  subView: CustomerSubView;
  selectedEventId: string | null;
  initialEventTab: 'register' | 'storefront' | 'info_results';
  events: RaceEvent[];
  organizations: Organization[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  platformProfileConfig?: PlatformProfileConfig;
  currentUser: UserAccount | null;
  onNavigate: (
    view: CustomerSubView,
    eventId?: string | null,
    tab?: 'register' | 'storefront' | 'info_results'
  ) => void;
  onRequireLoginWithIntent: (intent: ReturnIntent) => void;
  onOpenAccountSecurity: () => void;
  onOpenRunnerProfile?: () => void;
  onSaveProfilePatch?: (
    patch: Partial<RunnerProfileData>
  ) => Promise<{ ok: boolean; error?: string }> | void;
  onOpenOrganizerDashboard: (orgId: string, eventId?: string) => void;
  onCreateRegistrationAndOptionalAddon: (payload: {
    eventId: string;
    categoryId: string;
    buyerName: string;
    participantNameTh: string;
    participantNameEn: string;
    phone?: string;
    /** registering someone else: the server checks the friend's own email and phone */
    forFriend?: boolean;
    emergencyContact?: string;
    shirtSize: ShirtSizeCode;
    kitDeliveryMethod?: 'pickup_at_expo' | 'postal_shipping';
    shippingAddressSnapshot?: string;
    participantSnapshot?: RegistrationRecord['participantSnapshot'];
    marketingConsent: boolean;
    acceptedRules: boolean;
    acceptedPaymentTermsVersion?: string;
    /** PDPA consent to send the entry's personal and health data to the organizer */
    acceptedPrivacyVersion?: string;
    simulateImmediateWebhook: boolean;
    addonItems?: CartLine[];
    customAnswers?: Record<string, string | boolean>;
    requestId: string;
  }) => Promise<
    | { ok: true; reg: RegistrationRecord; addonOrders?: MerchOrderRecord[] }
    | { ok: false; error: string }
  >;
  /** pays a registration held at the summary step; `expired` when its 15 minutes ran out */
  onPayHeldRegistration: (
    regId: string
  ) => Promise<{ ok: true; reg: RegistrationRecord } | { ok: false; error: string; expired: boolean }>;
  /** gives a held registration back (runner goes back to edit) */
  onCancelHeldRegistration: (regId: string) => Promise<{ ok: boolean; error?: string }>;
  /** storefront cart checkout (server checks stock for the whole cart in one go) */
  onCheckoutMerchCart: (payload: MerchCheckoutPayload) => Promise<MerchCheckoutResult>;
  /** 'b' renders the alternative registration layout (sandbox review only, cannot submit) */
  /** event-wide quota box on the event detail page (dev-dock mockup for now) */
  showQuotaBox?: boolean;
  /** souvenir step layout picked in the Dev / Demo dock */
  souvenirLayout?: SouvenirLayout;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  subView,
  selectedEventId,
  initialEventTab,
  events,
  organizations,
  registrations,
  merchOrders,
  platformProfileConfig,
  currentUser,
  onNavigate,
  onRequireLoginWithIntent,
  onOpenAccountSecurity,
  onOpenRunnerProfile,
  onSaveProfilePatch,
  onOpenOrganizerDashboard,
  onCreateRegistrationAndOptionalAddon,
  onPayHeldRegistration,
  onCancelHeldRegistration,
  onCheckoutMerchCart,
  showQuotaBox = true,
  souvenirLayout = 'accordion',
}) => {
  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  // Hero field: what the visitor is typing; the list follows it only once they press search.
  const [searchDraft, setSearchDraft] = useState('');
  // Filter bar over the results: filters live, a moment after typing stops.
  const [filterText, setFilterText] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setSearchQuery(filterText), 250);
    return () => window.clearTimeout(t);
  }, [filterText]);
  // keep the hero field showing the search that is applied
  useEffect(() => {
    setSearchDraft(searchQuery);
  }, [searchQuery]);
  const applySearch = (text: string) => {
    setFilterText(text);
    setSearchQuery(text);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById('kr-browse')
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  // my orders page: race entries or merchandise orders tab
  const [ordersTab, setOrdersTab] = useState<'entries' | 'merch'>('entries');
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'open' | 'has_shop' | 'completed'
  >('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  /** after a filter is clicked, bring the results into view (27 Nov 2026, user request) */
  const jumpToResults = () => {
    window.setTimeout(() => {
      const target = document.getElementById('kr-results-top');
      if (!target) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }, 0);
  };
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Event detail & step-by-step registration state (6-step dedicated page)
  // live preview inside the organizer page editor (no effect on the public page)
  const pagePreview = usePagePreview();
  // the runner's sign-up page inside the organizer's form editor (?preview=form): the unsaved form wins
  const formPreview = useFormPreview();
  const [detailTab, setDetailTab] = useState<
    'register' | 'storefront' | 'info_results'
  >(initialEventTab);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regStep, setRegStep] = useState<RegStep>(1);
  const stepperRef = useRef<HTMLElement | null>(null);
  // Every step change (next / back / clicking a done step) brings the form back to its top.
  // going back to edit starts a fresh checkout attempt (a new booking id)
  useEffect(() => {
    if (regStep < 7) checkoutRequestId.current = null;
  }, [regStep]);
  const prevRegStep = useRef(regStep);
  useEffect(() => {
    if (prevRegStep.current === regStep) return;
    prevRegStep.current = regStep;
    // the whole form frame (banner included) comes back into view, not just the stepper
    const top =
      stepperRef.current?.closest<HTMLElement>('.event-reg-page-shell') ?? stepperRef.current;
    if (!top) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    top.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }, [regStep]);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedDivisionOption, setSelectedDivisionOption] =
    useState<string>('');
  // radio choices start empty; the runner picks each one (27 Nov 2026, user request)
  const [kitDeliveryOption, setKitDeliveryOption] = useState<
    'expo_pickup' | 'postal' | ''
  >('');
  const [runnerShippingAddress, setRunnerShippingAddress] = useState(
    '199/8 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200'
  );
  // emergency contact: name and phone are separate fields; the relationship is kept when the
  // contact comes from the profile or a saved participant. The registration still sends one line.
  const [emergencyName, setEmergencyName] = useState('วีระ วัฒนากูล');
  const [emergencyRelation, setEmergencyRelation] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('089-110-2211');
  const setEmergencyContact = (name: string, relation: string, phone: string) => {
    setEmergencyName(name);
    setEmergencyRelation(relation);
    setEmergencyPhone(phone);
  };
  const emergencyContactText = [
    emergencyName.trim(),
    emergencyRelation.trim() ? `(${emergencyRelation.trim()})` : '',
    displayPhone(emergencyPhone),
  ]
    .filter(Boolean)
    .join(' ');
  // no size is picked for the runner: they choose it on the shirt step (26 Nov 2026, user request)
  const [shirtSize, setShirtSize] = useState<ShirtSizeCode>('' as ShirtSizeCode);
  // souvenirs bought with the entry: any products, sizes and quantities (one merch order per line)
  const [addonItems, setAddonItems] = useState<CartLine[]>([]);
  // shirt style in the shirt step (only 'tee' is real stock; see data/mockShirtStyles.ts)
  const [shirtStyle, setShirtStyle] = useState<ShirtStyleId>('tee');
  const [registerForSelf, setRegisterForSelf] = useState(true);
  const [buyerName, setBuyerName] = useState(
    currentUser?.fullNameTh ?? ''
  );
  const [participantNameTh, setParticipantNameTh] = useState(
    currentUser?.fullNameTh ?? ''
  );
  const [participantNameEn, setParticipantNameEn] = useState(
    currentUser?.fullNameEn ?? ''
  );
  const [regNicknameTh, setRegNicknameTh] = useState(
    currentUser?.runnerProfile?.nickname ?? ''
  );
  const [regFirstNameEn, setRegFirstNameEn] = useState(
    currentUser?.runnerProfile?.firstNameEn ?? ''
  );
  const [regLastNameEn, setRegLastNameEn] = useState(
    currentUser?.runnerProfile?.lastNameEn ?? ''
  );
  const [regNicknameEn, setRegNicknameEn] = useState(
    currentUser?.runnerProfile?.nicknameEn ?? ''
  );
  const [regDob, setRegDob] = useState(
    currentUser?.runnerProfile?.dateOfBirth ?? ''
  );
  const [regIdType, setRegIdType] = useState<'none' | 'thai_id' | 'passport'>(
    currentUser?.runnerProfile?.idType &&
      currentUser.runnerProfile.idType !== 'none'
      ? currentUser.runnerProfile.idType
      : 'thai_id'
  );
  const [regIdNumber, setRegIdNumber] = useState(
    currentUser?.runnerProfile?.idNumber ?? ''
  );
  // Registration mode: self vs other (chosen before the participant form)
  const [regModeChosen, setRegModeChosen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] =
    useState<string>('new');
  const [regFirstNameTh, setRegFirstNameTh] = useState(
    currentUser?.runnerProfile?.firstName ?? ''
  );
  const [regLastNameTh, setRegLastNameTh] = useState(
    currentUser?.runnerProfile?.lastName ?? ''
  );
  const [regGender, setRegGender] = useState<'ชาย' | 'หญิง' | 'ไม่ระบุ'>(
    currentUser?.runnerProfile?.gender ?? 'ไม่ระบุ'
  );
  const [regPhone, setRegPhone] = useState(
    currentUser?.runnerProfile?.phone ?? ''
  );
  // a friend's own email (registering someone else; must not be the account owner's)
  const [regEmail, setRegEmail] = useState('');
  // Shipping address mode (saved address book vs manual entry)
  const [shipAddrMode, setShipAddrMode] = useState<'saved' | 'manual'>(
    (currentUser?.runnerProfile?.savedAddresses ?? []).length > 0
      ? 'saved'
      : 'manual'
  );
  const [selectedSavedAddrId, setSelectedSavedAddrId] = useState<string>('');
  // name the runner gives a new address (e.g. home / office) when saving it to the book
  const [shipAddrName, setShipAddrName] = useState('');
  const [shipRecipient, setShipRecipient] = useState(
    currentUser?.fullNameTh ?? ''
  );
  const [shipPhone, setShipPhone] = useState(
    currentUser?.runnerProfile?.phone ?? ''
  );
  const [regCascadeAddr, setRegCascadeAddr] = useState<CascadingAddressValue>({
    country: 'Thailand',
    postalCode: currentUser?.runnerProfile?.postalCode ?? '50200',
    province: currentUser?.runnerProfile?.province ?? 'เชียงใหม่',
    district: currentUser?.runnerProfile?.district ?? 'เมืองเชียงใหม่',
    subdistrict: currentUser?.runnerProfile?.subdistrict ?? 'สุเทพ',
    address: currentUser?.runnerProfile?.address ?? '199/8 ถ.ห้วยแก้ว',
  });
  const [acceptedRules, setAcceptedRules] = useState(false);
  // no consent checkbox on the form yet: bookings go out without marketing consent
  const [marketingConsent] = useState(false);
  // payment terms on the payment step (required, like the event rules)
  // history: the entry whose confirmation popup is open
  const [confirmRegId, setConfirmRegId] = useState<string | null>(null);
  const [acceptedPayTerms, setAcceptedPayTerms] = useState(false);
  // PDPA: sending the entry's personal and health data to the organizer (27 Nov 2026, user request)
  const [acceptedPdpa, setAcceptedPdpa] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<
    Record<string, string | boolean>
  >({});
  /** the check result of the organizer's questions, by question id (shown under each one) */
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentChannel, setPaymentChannel] = useState<'promptpay' | 'card' | ''>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // checkout: waiting for the server, and the id that makes a retry safe (see submitRegistrationOrder)
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  /* A registration held at the summary step (pending_payment), waiting to be paid (26 Nov 2026,
     user request): leaving without paying and coming back opens its payment step again. */
  const [heldRegId, setHeldRegId] = useState<string | null>(null);
  // true when this form booked the hold, so "back to edit" still has everything typed
  const heldFromForm = useRef(false);
  const [heldBusy, setHeldBusy] = useState(false);
  const [heldError, setHeldError] = useState<string | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  // holds the runner set aside with "สมัครให้คนอื่น" in this visit are not reopened
  const skipResume = useRef<Set<string>>(new Set());
  const heldReg = heldRegId ? registrations.find((r) => r.id === heldRegId) ?? null : null;
  const checkoutRequestId = useRef<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    reg: RegistrationRecord;
    addonOrder?: MerchOrderRecord;
    addonOrders?: MerchOrderRecord[];
  } | null>(null);

  // Storefront state (General customer without registration)
  const [linkedRegForMerch, setLinkedRegForMerch] = useState<string>('');
  const [storeFocus, setStoreFocus] = useState<{ id: string; n: number } | null>(null);


  React.useEffect(() => {
    setDetailTab(initialEventTab);
    setShowRegForm(false);
    setCustomAnswers({});
  }, [initialEventTab, selectedEventId]);

  React.useEffect(() => {
    setRegisterForSelf(true);
    // "who is running" starts unpicked too (27 Nov 2026, user request)
    setRegModeChosen(false);
    setShirtSize('' as ShirtSizeCode);
    setSelectedDivisionOption('');
    setSelectedParticipantId('');
    setKitDeliveryOption('');
    setSelectedSavedAddrId('');
    setPaymentChannel('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  const applySelfProfile = () => {
    if (!currentUser) return;
    const p = currentUser.runnerProfile;
    const np = currentUser.fullNameTh.trim().split(/\s+/);
    const first = p?.firstName ?? np[0] ?? '';
    const last = p?.lastName ?? np.slice(1).join(' ');
    setRegFirstNameTh(first);
    setRegLastNameTh(last);
    setParticipantNameTh(`${first} ${last}`.trim());
    const composedEn =
      p?.firstNameEn || p?.lastNameEn
        ? `${p?.firstNameEn ?? ''} ${p?.lastNameEn ?? ''}`.trim()
        : currentUser.fullNameEn;
    setParticipantNameEn(composedEn);
    setRegNicknameTh(p?.nickname ?? '');
    const enParts = (currentUser.fullNameEn ?? '').trim().split(/\s+/).filter(Boolean);
    setRegFirstNameEn(p?.firstNameEn || enParts[0] || '');
    setRegLastNameEn(p?.lastNameEn || enParts.slice(1).join(' ') || '');
    // the payer is the runner themself
    setBuyerName(`${first} ${last}`.trim() || currentUser.fullNameTh);
    setRegNicknameEn(p?.nicknameEn ?? '');
    setRegDob(p?.dateOfBirth ?? '');
    setRegGender(p?.gender ?? 'ไม่ระบุ');
    setRegIdType(p?.idType && p.idType !== 'none' ? p.idType : 'thai_id');
    setRegIdNumber(p?.idNumber ?? '');
    setRegPhone(p?.phone ?? '');
    const contacts = p?.emergencyContacts ?? [];
    if (contacts.length > 0) {
      // saved contacts: the runner picks one on the form
      setEmergencyContact('', '', '');
    } else if (p?.emergencyContactName && p?.emergencyContactPhone) {
      setEmergencyContact(p.emergencyContactName, p.emergencyContactRelation ?? '', p.emergencyContactPhone);
    }
  };

  React.useEffect(() => {
    if (!currentUser) return;
    const p = currentUser.runnerProfile;
    const fullTh =
      p?.firstName && p?.lastName
        ? `${p.firstName} ${p.lastName}`.trim()
        : currentUser.fullNameTh;
    setBuyerName(fullTh);
    // "for myself" is not picked for the runner any more; picking it fills the profile in
    if (registerForSelf) applySelfProfile();

    const addrs = p?.savedAddresses ?? [];
    const defAddr = addrs.find((a) => a.isDefault) ?? addrs[0] ?? null;
    setShipRecipient((prev) => prev || fullTh);
    setShipPhone((prev) => prev || p?.phone || '');
    if (defAddr) {
      setShipAddrMode('saved');
      setSelectedSavedAddrId((prev) => (addrs.some((a) => a.id === prev) ? prev : ''));
      setRunnerShippingAddress(
        `${defAddr.recipientName} (${defAddr.phone}) — ${defAddr.address}, ต.${defAddr.subdistrict} อ.${defAddr.district} จ.${defAddr.province} ${defAddr.postalCode}`
      );
    } else {
      setShipAddrMode('manual');
      if (p?.address && p?.province) {
        setRegCascadeAddr({
          country: p.country || 'Thailand',
          postalCode: p.postalCode || '50200',
          province: p.province,
          district: p.district || '',
          subdistrict: p.subdistrict || '',
          address: p.address,
        });
      }
    }

    if (p) {
      setCustomAnswers((prev) => {
        const next = { ...prev };
        if (p.nationality && !next['nationality']) {
          next['nationality'] = p.nationality;
        }
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, registerForSelf]);


  const publicVisibleEvents = useMemo(
    () => events.filter((e) => e.status !== 'draft' && e.status !== 'in_review'),
    [events]
  );

  // One predicate for the list and for the counts beside each filter option.
  // A count answers "how many events would I see if I picked this option",
  // keeping every other active filter (faceted counting).
  type DirectoryFilters = {
    quick: typeof quickFilter;
    region: string;
    distance: string;
  };
  const matchesDirectoryFilters = (ev: RaceEvent, f: DirectoryFilters) => {
      const matchesText = matchesSearchText(ev, searchQuery);

      const matchesQuick =
        f.quick === 'all' ||
        (f.quick === 'open' && ev.status === 'published') ||
        (f.quick === 'has_shop' && ev.products.length > 0) ||
        (f.quick === 'completed' && ev.status === 'completed');

      const matchesRegion = f.region === 'all' || ev.region === f.region;

      const matchesDist =
        f.distance === 'all' ||
        ev.categories.some((c) => {
          if (f.distance === '5k') return c.distanceKm <= 5.5;
          if (f.distance === '10k')
            return c.distanceKm > 5.5 && c.distanceKm <= 12;
          if (f.distance === '21k')
            return c.distanceKm >= 20 && c.distanceKm <= 22;
          if (f.distance === 'trail') return ev.raceType === 'Trail';
          return true;
        });

      return matchesText && matchesQuick && matchesRegion && matchesDist;
  };
  const activeDirectoryFilters: DirectoryFilters = {
    quick: quickFilter,
    region: regionFilter,
    distance: distanceFilter,
  };
  const filteredEvents = publicVisibleEvents.filter((ev) =>
    matchesDirectoryFilters(ev, activeDirectoryFilters)
  );
  const countWith = (override: Partial<DirectoryFilters>) =>
    publicVisibleEvents.filter((ev) =>
      matchesDirectoryFilters(ev, { ...activeDirectoryFilters, ...override })
    ).length;

  const selectedEvent = useMemo(() => {
    const ev =
      publicVisibleEvents.find((e) => e.id === selectedEventId) ??
      (formPreview.active ? events.find((e) => e.id === selectedEventId) : undefined) ??
      null;
    if (!ev || !formPreview.active || !formPreview.form) return ev;
    return { ...ev, customFields: formPreview.form.fields, formCustomSteps: formPreview.form.steps };
  }, [publicVisibleEvents, events, selectedEventId, formPreview.active, formPreview.form]);

  // Opening the sign-up page with an unpaid, still-held registration for this event goes
  // straight to its payment step (checked once per visit to the page).
  const resumeCheckedFor = useRef('');
  useEffect(() => {
    if (subView !== 'event_register' || !selectedEvent || !currentUser || formPreview.active) {
      resumeCheckedFor.current = '';
      return;
    }
    const key = `${selectedEvent.id}:${currentUser.id}`;
    if (resumeCheckedFor.current === key || registrations.length === 0) return;
    resumeCheckedFor.current = key;
    const now = Date.now();
    const pending = registrations
      .filter(
        (r) =>
          r.eventId === selectedEvent.id &&
          r.runnerUserId === currentUser.id &&
          r.registrationStatus === 'pending_payment' &&
          (!r.reservationExpiresAt || Date.parse(r.reservationExpiresAt) > now) &&
          !skipResume.current.has(r.id)
      )
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if (!pending) return;
    if (heldRegId !== pending.id) heldFromForm.current = false;
    setHeldRegId(pending.id);
    setHeldError(null);
    setRegStep(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subView, selectedEvent?.id, currentUser?.id, registrations, formPreview.active]);

  const activeCategory: RaceCategory | null = useMemo(() => {
    if (!selectedEvent) return null;
    return (
      selectedEvent.categories.find((c) => c.id === selectedCatId) ??
      selectedEvent.categories[0] ??
      null
    );
  }, [selectedEvent, selectedCatId]);

  // Form editor preview: the editor's step keys <-> this wizard's step numbers (own steps are 2.1-2.3)
  const previewSteps = () =>
    selectedEvent
      ? stepsShown(selectedEvent.formCustomSteps, selectedEvent.customFields, customAnswers, {
          raceDistance: activeCategory?.code,
          shirtSize,
        })
      : [];
  const PREVIEW_STEP_NO: Record<string, RegStep> = { start: 1, core: 2, shop: 3, souvenir: 4, address: 5, review: 6, pay: 7 };
  const previewKeyOf = (n: number) => {
    const named = Object.entries(PREVIEW_STEP_NO).find(([, v]) => v === n)?.[0];
    if (named) return named;
    return previewSteps()[Math.round((n - 2) * 10) - 1]?.id ?? 'core';
  };
  useEffect(() => {
    if (!formPreview.active || !formPreview.step) return;
    const key = formPreview.step.key;
    let next: RegStep | undefined = PREVIEW_STEP_NO[key];
    if (next === undefined) {
      const i = previewSteps().findIndex((st) => st.id === key);
      // a step this runner would not see (other distance, no question yet): stay where it is
      if (i < 0) return;
      next = 2 + (i + 1) / 10;
    }
    setRegStep(next);
    // only when the editor names a step, not on every answer typed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formPreview.active, formPreview.step]);
  useEffect(() => {
    if (formPreview.active) formPreview.report(previewKeyOf(regStep));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formPreview.active, regStep]);

  // Age on the category's basis date and the matching age group (same rules as the server).
  const regAgeCheck = useMemo(
    () =>
      selectedEvent && activeCategory
        ? evaluateCategoryAge(selectedEvent, activeCategory, regDob, regGender)
        : null,
    [selectedEvent, activeCategory, regDob, regGender]
  );

  const setIncludeAddonId = (id: string) => {
    const prd = selectedEvent?.products.find((p) => p.id === id);
    setAddonItems(prd ? [{ productId: prd.id, size: prd.availableSizes[0] ?? '-', qty: 1 }] : []);
  };

  const myRegistrations = useMemo(() => {
    if (!currentUser) return [];
    return registrations.filter(
      (r) =>
        r.runnerUserId === currentUser.id ||
        (currentUser.contactEmail &&
          r.email.toLowerCase() === currentUser.contactEmail.toLowerCase())
    );
  }, [registrations, currentUser]);

  // one place for every entry (27 Nov 2026, user request): the profile's old "ประวัติงานที่สมัคร"
  // filters, results, certificates and sign-up details now live on this page
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);
  const [certPreviewReg, setCertPreviewReg] = useState<RegistrationRecord | null>(null);
  const historyToday = todayIsoInTimeZone();
  const shownRegistrations = useMemo(
    () =>
      myRegistrations.filter((r) => {
        if (historyFilter === 'all') return true;
        const past = regIsPast(events.find((e) => e.id === r.eventId), historyToday);
        return historyFilter === 'past' ? past : !past;
      }),
    [myRegistrations, historyFilter, events, historyToday]
  );

  const myMerchOrders = useMemo(() => {
    if (!currentUser) return [];
    return merchOrders.filter((m) => m.buyerUserId === currentUser.id);
  }, [merchOrders, currentUser]);

  const getCategoryOpenSeats = (evId: string, cat: RaceCategory) => {
    const used = registrations.filter(
      (r) =>
        r.eventId === evId &&
        r.categoryId === cat.id &&
        (r.registrationStatus === 'confirmed' ||
          r.registrationStatus === 'pending_payment')
    ).length;
    return Math.max(0, cat.categoryQuota - used);
  };

  // Seats still open for the event. With the whole-event cap switched off, only the
  // per-distance quotas limit sign-ups, so the event is full only when every distance is full.
  const getEventOpenSeats = (ev: RaceEvent) => {
    if (!isTotalQuotaEnabled(ev)) {
      return ev.categories.reduce((sum, cat) => sum + getCategoryOpenSeats(ev.id, cat), 0);
    }
    const used = registrations.filter(
      (r) =>
        r.eventId === ev.id &&
        (r.registrationStatus === 'confirmed' ||
          r.registrationStatus === 'pending_payment')
    ).length;
    return Math.max(0, ev.totalEventQuota - used);
  };

  const openEventPage = (
    ev: RaceEvent,
    tab: 'register' | 'storefront' | 'info_results' = 'info_results',
    prelinkRegCode = '',
    openWizardImmediately = false
  ) => {
    setSelectedCatId(ev.categories[0]?.id ?? '');
    setIncludeAddonId('none');
    setRegStep(1);
    setAcceptedRules(false);
    setAcceptedPayTerms(false);
    setAcceptedPdpa(false);
    // every radio choice starts empty each time the form opens (27 Nov 2026, user request)
    setSelectedDivisionOption('');
    setSelectedParticipantId('');
    setKitDeliveryOption('');
    setSelectedSavedAddrId('');
    setPaymentChannel('');
    setEmergencyContact('', '', '');
    setCheckoutError(null);
    setCreatedResult(null);
    setLinkedRegForMerch(prelinkRegCode);
    setDetailTab(tab);
    setShowRegForm(openWizardImmediately);
    onNavigate('event_detail', ev.id, tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitRegistrationOrder = async (payImmediately: boolean) => {
    if (!selectedEvent || !activeCategory) return;
    // a request is already on its way: a second press must not send another booking
    // (a ref, not state: two clicks in the same tick both see the old state value)
    if (submittingRef.current) return;
    if (formPreview.active) {
      setCheckoutError(tx('นี่คือตัวอย่างฟอร์มในหน้าผู้จัด ไม่มีการส่งใบสมัครหรือชำระเงินจริง'));
      return;
    }

    if (!currentUser) {
      onRequireLoginWithIntent({
        surface: 'events',
        eventId: selectedEvent.id,
        eventTab: 'register',
        label: `สมัครวิ่งงาน ${selectedEvent.titleTh}`,
      });
      return;
    }

    // Email verification is shelved: a saved contact email is enough to register.
    if (
      !currentUser.contactEmail ||
      (FEATURES.emailVerification && !currentUser.emailVerified)
    ) {
      setCheckoutError(
        FEATURES.emailVerification
          ? tx("บัญชีของคุณยังไม่ได้ยืนยันอีเมลติดต่อ กรุณากดปุ่ม \"เพิ่มและยืนยันอีเมล\" ด้านล่างก่อนออกใบยืนยันสิทธิ์แข่งขัน")
          : tx("บัญชีของคุณยังไม่มีอีเมลติดต่อ กรุณากดปุ่ม \"เพิ่มอีเมล\" ด้านล่างก่อนออกใบยืนยันสิทธิ์แข่งขัน")
      );
      return;
    }

    const finalBuyer = buyerName.trim();
    const finalParticipant =
      `${regFirstNameTh.trim()} ${regLastNameTh.trim()}`.trim() ||
      `${regFirstNameEn.trim()} ${regLastNameEn.trim()}`.trim() ||
      (registerForSelf ? finalBuyer : participantNameTh.trim());

    if (!finalBuyer || !finalParticipant) {
      setCheckoutError(tx("กรุณากรอกชื่อผู้ชำระเงินและชื่อผู้เข้าแข่งขันให้ครบถ้วน"));
      return;
    }
    // the English name is the required one (printed on the BIB); Thai is optional
    if (!regFirstNameEn.trim() || !regLastNameEn.trim()) {
      setCheckoutError(tx("กรุณากรอกชื่อ-นามสกุลภาษาอังกฤษของผู้เข้าแข่งขันให้ครบ"));
      return;
    }
    if (!acceptedRules) {
      setCheckoutError(tx("กรุณาติ๊กยอมรับกติกาการแข่งขันก่อนยืนยัน"));
      return;
    }
    if (!acceptedPayTerms) {
      setCheckoutError(tx("กรุณาติ๊กยอมรับข้อกำหนดการชำระเงินและการคืนเงินก่อนยืนยัน"));
      return;
    }
    if (!acceptedPdpa) {
      setCheckoutError(tx("กรุณาติ๊กยินยอมการส่งข้อมูลส่วนบุคคลให้ผู้จัดงานก่อนยืนยัน"));
      return;
    }

    const customProblems = validateAnswers(selectedEvent.customFields ?? [], customAnswers, {
      raceDistance: activeCategory.code,
      shirtSize,
    });
    const firstCustomProblem = Object.values(customProblems)[0];
    if (firstCustomProblem) {
      setFormErrors(customProblems);
      setCheckoutError(txf('กรุณาตรวจคำตอบที่ผู้จัดถาม: {0}', firstCustomProblem));
      return;
    }

    const ageCheck = evaluateCategoryAge(selectedEvent, activeCategory, regDob, regGender);
    if (!ageCheck.eligible) {
      setCheckoutError(ageCheckMessage(ageCheck, activeCategory));
      return;
    }

    const catSeats = getCategoryOpenSeats(selectedEvent.id, activeCategory);
    const eventSeats = getEventOpenSeats(selectedEvent);
    if (catSeats <= 0 || eventSeats <= 0) {
      setCheckoutError(tx("ขออภัย โควตาเต็มแล้ว ระบบป้องกันการขายเกินอัตโนมัติ"));
      return;
    }

    setCheckoutError(null);
    const prof = currentUser?.runnerProfile;
    const deliveryMode: 'pickup_at_expo' | 'postal_shipping' =
      kitDeliveryOption === 'postal' ? 'postal_shipping' : 'pickup_at_expo';
    const composedBibEn =
      `${regFirstNameEn.trim()} ${regLastNameEn.trim()}`.trim() ||
      participantNameEn.trim() ||
      finalParticipant;
    // one id per checkout attempt, kept across retries until a booking succeeds
    if (!checkoutRequestId.current) {
      checkoutRequestId.current = `reg-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
    }
    submittingRef.current = true;
    setSubmitting(true);
    let outcome: Awaited<ReturnType<typeof onCreateRegistrationAndOptionalAddon>>;
    try {
    outcome = await onCreateRegistrationAndOptionalAddon({
      requestId: checkoutRequestId.current,
      eventId: selectedEvent.id,
      categoryId: activeCategory.id,
      buyerName: finalBuyer,
      participantNameTh: finalParticipant,
      participantNameEn: composedBibEn,
      // a friend's entry carries the friend's own phone, never the owner's (26 Nov 2026)
      phone: registerForSelf ? regPhone.trim() || prof?.phone : regPhone.trim(),
      forFriend: !registerForSelf,
      emergencyContact: emergencyContactText.trim(),
      shirtSize,
      kitDeliveryMethod: deliveryMode,
      shippingAddressSnapshot:
        deliveryMode === 'postal_shipping'
          ? runnerShippingAddress.trim()
          : undefined,
      participantSnapshot: {
        firstName: regFirstNameTh.trim() || undefined,
        lastName: regLastNameTh.trim() || undefined,
        nickname: regNicknameTh.trim() || undefined,
        firstNameEn: regFirstNameEn.trim() || undefined,
        lastNameEn: regLastNameEn.trim() || undefined,
        nicknameEn: regNicknameEn.trim() || undefined,
        phone: regPhone.trim() || undefined,
        email: registerForSelf ? undefined : regEmail.trim().toLowerCase() || undefined,
        dateOfBirth: regDob || undefined,
        gender: regGender,
        nationality: registerForSelf ? prof?.nationality : undefined,
        idType: regIdNumber.trim() ? regIdType : 'none',
        idNumberMasked: regIdNumber.trim()
          ? maskIdNumber(regIdNumber)
          : undefined,
        emergencyContactName: registerForSelf
          ? prof?.emergencyContacts?.find((c) => c.isPrimary)?.contactName ??
            prof?.emergencyContactName
          : undefined,
        emergencyContactRelation: registerForSelf
          ? prof?.emergencyContacts?.find((c) => c.isPrimary)?.relationship ??
            prof?.emergencyContactRelation
          : undefined,
        emergencyContactPhone: registerForSelf
          ? prof?.emergencyContacts?.find((c) => c.isPrimary)?.phone ??
            prof?.emergencyContactPhone
          : undefined,
        preferredShirtType: registerForSelf ? prof?.preferredShirtType : undefined,
        preferredShirtFit: registerForSelf ? prof?.preferredShirtFit : undefined,
      },
      marketingConsent,
      acceptedRules: true,
      acceptedPaymentTermsVersion: PAYMENT_TERMS_VERSION,
      acceptedPrivacyVersion: REGISTRATION_PRIVACY_VERSION,
      simulateImmediateWebhook: payImmediately,
      addonItems: addonItems.length > 0 ? addonItems : undefined,
      customAnswers:
        (selectedEvent.customFields ?? []).length > 0
          ? customAnswers
          : undefined,
    });
    } finally {
      // always unlock, even if the request throws, so the runner is never stuck
      submittingRef.current = false;
      setSubmitting(false);
    }
    if (!outcome.ok) {
      // keep everything the runner typed; pressing confirm again retries with the same id
      setCheckoutError(outcome.error);
      return;
    }
    checkoutRequestId.current = null;
    const res = { reg: outcome.reg, addonOrder: outcome.addonOrders?.[0], addonOrders: outcome.addonOrders };

    // Persist reusable data back to the Runner Profile
    const profilePatch: Partial<RunnerProfileData> = {};
    if (!registerForSelf) {
      const existing = prof?.savedParticipants ?? [];
      const cleanId = regIdNumber.trim();
      const match =
        existing.find((x) => x.id === selectedParticipantId) ??
        (cleanId ? existing.find((x) => x.idNumber === cleanId) : undefined) ??
        existing.find((x) =>
          regFirstNameTh.trim()
            ? x.firstName === regFirstNameTh.trim() && x.lastName === regLastNameTh.trim()
            : (x.firstNameEn ?? '').toLowerCase() === regFirstNameEn.trim().toLowerCase() &&
              (x.lastNameEn ?? '').toLowerCase() === regLastNameEn.trim().toLowerCase()
        );
      const participant: SavedParticipant = {
        id: match?.id ?? `sp-${Date.now()}`,
        firstName: regFirstNameTh.trim(),
        lastName: regLastNameTh.trim(),
        nickname: regNicknameTh.trim() || undefined,
        firstNameEn: regFirstNameEn.trim() || undefined,
        lastNameEn: regLastNameEn.trim() || undefined,
        nicknameEn: regNicknameEn.trim() || undefined,
        dateOfBirth: regDob || undefined,
        gender: regGender,
        idType: cleanId ? regIdType : 'none',
        idNumber: cleanId || undefined,
        phone: regPhone.trim() || undefined,
        email: regEmail.trim().toLowerCase() || undefined,
        preferredShirtSize: shirtSize,
        emergencyContactName: emergencyName.trim() || undefined,
        emergencyContactRelation: emergencyRelation.trim() || undefined,
        emergencyContactPhone: emergencyPhone.trim() || undefined,
        lastUsedAt: new Date().toISOString(),
      };
      profilePatch.savedParticipants = match
        ? existing.map((x) => (x.id === match.id ? participant : x))
        : [...existing, participant];
    }
    if (Object.keys(profilePatch).length > 0) {
      onSaveProfilePatch?.(profilePatch);
    }
    if (!payImmediately) {
      // booked and held: the payment step pays this registration
      heldFromForm.current = true;
      setHeldRegId(outcome.reg.id);
      setHeldError(null);
      setResumeNotice(null);
      setRegStep(7);
      return;
    }
    setCreatedResult(res);
    setRegStep(8);
  };

  const payHeld = async () => {
    if (!heldReg || heldBusy) return;
    setHeldBusy(true);
    setHeldError(null);
    const out = await onPayHeldRegistration(heldReg.id);
    setHeldBusy(false);
    if (!out.ok) {
      if (out.expired) {
        const fromForm = heldFromForm.current;
        heldFromForm.current = false;
        setHeldRegId(null);
        setResumeNotice(
          fromForm
            ? tx('หมดเวลาชำระเงิน 15 นาที ที่นั่งถูกคืนแล้ว ตรวจข้อมูลแล้วกด "ไปชำระเงิน" อีกครั้ง')
            : tx('หมดเวลาชำระเงิน 15 นาที ที่นั่งถูกคืนแล้ว กรุณาสมัครใหม่')
        );
        setRegStep(fromForm ? 6 : 1);
      } else {
        setHeldError(out.error);
      }
      return;
    }
    const linked = merchOrders.filter(
      (m) => m.linkedRegistrationCode === out.reg.regCode && m.eventId === out.reg.eventId
    );
    heldFromForm.current = false;
    setHeldRegId(null);
    setCreatedResult({ reg: out.reg, addonOrder: linked[0], addonOrders: linked });
    setRegStep(8);
  };

  const cancelHeld = async () => {
    if (!heldReg || heldBusy) return;
    setHeldBusy(true);
    setHeldError(null);
    const out = await onCancelHeldRegistration(heldReg.id);
    setHeldBusy(false);
    if (!out.ok) {
      setHeldError(out.error ?? tx('ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง'));
      return;
    }
    const fromForm = heldFromForm.current;
    heldFromForm.current = false;
    setHeldRegId(null);
    setResumeNotice(fromForm ? null : tx('ยกเลิกใบสมัครที่รอชำระแล้ว กรอกข้อมูลใหม่ได้เลย'));
    setRegStep(fromForm ? 6 : 1);
  };

  // "ชำระเงินต่อ" in the order history: open that registration's payment step
  const openHeldPayment = (reg: RegistrationRecord) => {
    if (currentUser) resumeCheckedFor.current = `${reg.eventId}:${currentUser.id}`;
    heldFromForm.current = false;
    setHeldRegId(reg.id);
    setHeldError(null);
    setResumeNotice(null);
    setCreatedResult(null);
    setRegStep(7);
    onNavigate('event_register', reg.eventId, 'register');
  };

  const registerAnother = () => {
    if (heldReg) skipResume.current.add(heldReg.id);
    heldFromForm.current = false;
    setHeldRegId(null);
    setHeldError(null);
    setResumeNotice(null);
    setRegModeChosen(false);
    setAcceptedRules(false);
    setAcceptedPayTerms(false);
    setAcceptedPdpa(false);
    // every radio choice starts empty each time the form opens (27 Nov 2026, user request)
    setSelectedDivisionOption('');
    setSelectedParticipantId('');
    setKitDeliveryOption('');
    setSelectedSavedAddrId('');
    setPaymentChannel('');
    setEmergencyContact('', '', '');
    setCheckoutError(null);
    setRegStep(1);
  };


  /* ================= SUBVIEW 3: MY TICKETS & MERCH ORDERS ================= */
  if (subView === 'my_orders') {
    return (
      <main className="customer-container">
        <div className="hub-header-bar kr-orders-head">
          <IconBib size={44} className="kr-orders-icon" />
          <div>
            {/* same words as the account menu item (27 Nov 2026, user request) */}
            <h1>{tx("ประวัติการสมัคร & การสั่งซื้อ")}</h1>
            <p className="muted-block">
              {tx("แยกแสดงระหว่าง ")} <strong>{tx("สิทธิ์เข้าร่วมการแข่งขัน (รับ Race Kit)")}</strong> {tx(" และ")}{' '}
              <strong>{tx("คำสั่งซื้อสินค้าที่ระลึก")}</strong> {tx(" อย่างชัดเจนเพื่อความสะดวกรวดเร็วในวันรับของ")}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('directory', null)}
          >
            <IconArrowLeft size={15} />
            <span>{tx("ดูงานวิ่งทั้งหมด")}</span>
          </button>
          <MascotAnim pose="wink" className="kr-orders-mascot" />
        </div>

        {!currentUser ? (
          <div className="empty-state-box">
            <h2>{tx("กรุณาเข้าสู่ระบบเพื่อดูบัตรวิ่งและคำสั่งซื้อของคุณ")}</h2>
            <p>
              {tx("เข้าสู่ระบบด้วยอีเมล, Google หรือ LINE เพื่อตรวจสอบบัตร QR รับอุปกรณ์และประวัติคำสั่งซื้อสินค้าที่ระลึก")}
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                onRequireLoginWithIntent({
                  surface: 'my_orders',
                  label: 'เปิดดูประวัติการสมัคร & การสั่งซื้อ',
                })
              }
            >
              <IconLock size={15} />
              <span>{tx("เข้าสู่ระบบ")}</span>
            </button>
          </div>
        ) : (
          <div className="hub-sections-stack">
            {/* race entries and merchandise orders are separate things: one tab each */}
            <div className="kr-orders-tabs" role="group" aria-label={tx("เลือกรายการที่จะแสดง")}>
              <button
                type="button"
                className={`kr-orders-tab ${ordersTab === 'entries' ? 'is-on' : ''}`}
                aria-pressed={ordersTab === 'entries'}
                onClick={() => setOrdersTab('entries')}
              >
                <IconBib size={20} />
                <span>{tx("รายการสมัครวิ่ง")}</span>
                <span className="mono-num kr-orders-count">{myRegistrations.length}</span>
              </button>
              <button
                type="button"
                className={`kr-orders-tab ${ordersTab === 'merch' ? 'is-on' : ''}`}
                aria-pressed={ordersTab === 'merch'}
                onClick={() => setOrdersTab('merch')}
              >
                <IconBag size={20} />
                <span>{tx("คำสั่งซื้อสินค้า")}</span>
                <span className="mono-num kr-orders-count">{myMerchOrders.length}</span>
              </button>
            </div>

            {ordersTab === 'entries' && (
            <section className="clean-panel" aria-label={tx("ใบสมัครวิ่งของฉัน")}>
              <div className="section-title-bar">
                <div>
                  <h2>
                    {tx("ใบสมัครวิ่งและบัตร QR รับอุปกรณ์แข่งขัน (")}
                    <span className="mono-num">{tx(myRegistrations.length)}</span>)
                  </h2>
                  <p className="muted-inline">
                    {tx("แสดง QR Token นี้ที่จุดเช็กอินนักวิ่งเพื่อรับ Race Kit ตามสิทธิ์สมัคร")}
                  </p>
                </div>
                {myRegistrations.length > 0 && (
                  <div className="cta-inline-row" role="group" aria-label={tx('กรองใบสมัคร')}>
                    {(
                      [
                        ['all', 'ทั้งหมด'],
                        ['upcoming', 'กำลังจะมาถึง'],
                        ['past', 'ผ่านมาแล้ว'],
                      ] as const
                    ).map(([key, lbl]) => (
                      <button
                        key={key}
                        type="button"
                        className={`filter-pill ${historyFilter === key ? 'active' : ''}`}
                        aria-pressed={historyFilter === key}
                        onClick={() => setHistoryFilter(key)}
                      >
                        {tx(lbl)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {myRegistrations.length === 0 ? (
                <div className="subtle-empty-note">
                  {tx("บัญชีนี้ยังไม่มีใบสมัครวิ่ง (ลูกค้าทั่วไปสามารถดูคำสั่งซื้อสินค้าที่ระลึกได้ในส่วนถัดไปด้านล่าง)")}
                </div>
              ) : shownRegistrations.length === 0 ? (
                <div className="subtle-empty-note">{tx('ไม่มีรายการงานวิ่งในหมวดนี้')}</div>
              ) : (
                <div className="pass-list">
                  {shownRegistrations.map((reg) => {
                    const ev = events.find((e) => e.id === reg.eventId);
                    const cat = ev?.categories.find(
                      (c) => c.id === reg.categoryId
                    );
                    const isPast = regIsPast(ev, historyToday);
                    const ageText = regAgeShort(reg, cat);
                    return (
                      <article key={reg.id} className="runner-pass-item kr-pass">
                        {ev && (
                          <div className="kr-pass-thumb" aria-hidden="true">
                            <EventCoverMedia event={ev} illustrated className="kr-card-img" />
                          </div>
                        )}
                        <div className="pass-main-info">
                          {/* easy-to-read card (27 Nov 2026, user request): one headline status, a
                              three-step track, then the key facts in a small grid */}
                          <div className="reg-card-head">
                            <RegHeadline reg={reg} isPast={isPast} />
                            <span className="mono-code reg-card-code">{reg.regCode}</span>
                          </div>
                          <h3>{getLang() === 'en' ? ev?.titleEn || ev?.titleTh || reg.eventId : ev?.titleTh ?? reg.eventId}</h3>
                          <p className="reg-card-meta">
                            {ev?.eventDate && (
                              <span>
                                <IconCalendar size={14} /> {formatBasisDate(ev.eventDate)}
                              </span>
                            )}
                            {ev?.province && (
                              <span>
                                <IconMapPin size={14} /> {tx(ev.province)}
                              </span>
                            )}
                          </p>
                          <RegProgress reg={reg} />
                          <dl className="reg-card-facts">
                            <div>
                              <dt>{tx('ผู้เข้าแข่งขัน')}</dt>
                              <dd>{getLang() === 'en' ? reg.participantNameEn || reg.participantNameTh : reg.participantNameTh}</dd>
                            </div>
                            <div>
                              <dt>{tx('ระยะ')}</dt>
                              <dd>{tx(cat?.name ?? '-')}</dd>
                            </div>
                            {ageText && (
                              <div>
                                <dt>{tx('อายุ / รุ่นอายุ')}</dt>
                                <dd>{ageText}</dd>
                              </div>
                            )}
                            <div>
                              <dt>{reg.registrationStatus === 'pending_payment' ? tx('ยอดที่ต้องชำระ') : tx('ยอดชำระ')}</dt>
                              <dd className="mono-num">{formatThb(reg.snapshotTotalChargedSatang, true)}</dd>
                            </div>
                            {reg.buyerName && reg.buyerName.trim() !== reg.participantNameTh.trim() && (
                              <div>
                                <dt>{tx('ผู้ชำระเงิน')}</dt>
                                <dd>{reg.buyerName}</dd>
                              </div>
                            )}
                          </dl>

                          <div className="cta-inline-row" style={{ marginTop: '0.55rem' }}>
                            {ev && ev.products.length > 0 && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  openEventPage(ev, 'storefront', reg.regCode)
                                }
                              >
                                <IconBag size={14} />
                                <span>{tx("ซื้อของที่ระลึก")}</span>
                              </button>
                            )}

                            {ev?.verifiedPhotoAlbums &&
                              ev.verifiedPhotoAlbums.length > 0 && (
                                <button
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() =>
                                    openEventPage(ev, 'info_results')
                                  }
                                >
                                  <IconCamera size={14} />
                                  <span>{tx("ดูผลและรูปภาพหลังงาน")}</span>
                                </button>
                              )}

                            {/* the confirmation card in a popup, with print and download (27 Nov 2026) */}
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              aria-haspopup="dialog"
                              onClick={() => setConfirmRegId(reg.id)}
                            >
                              <IconQr size={14} />
                              <span>{tx('ใบยืนยันการสมัคร')}</span>
                            </button>
                            <button
                              type="button"
                              className="btn-ghost-sm"
                              aria-expanded={expandedRegId === reg.id}
                              onClick={() => setExpandedRegId(expandedRegId === reg.id ? null : reg.id)}
                            >
                              {expandedRegId === reg.id ? tx('ซ่อนรายละเอียด') : tx('ดูรายละเอียดใบสมัคร')}
                            </button>
                          </div>
                          <RegResultActions reg={reg} ev={ev} cat={cat} onPreview={setCertPreviewReg} />
                          {expandedRegId === reg.id && <RegSnapshotDetails reg={reg} />}
                        </div>

                        <div className="pass-qr-card">
                          <div className="pass-bib-num mono-num">
                            {reg.bibNumber ?? tx("รอกำหนด BIB")}
                          </div>
                          {/* unpaid: pay right under the BIB (26 Nov 2026, user request) */}
                          {reg.registrationStatus === 'pending_payment' && (
                            <button
                              type="button"
                              className="btn-primary pass-pay-btn"
                              onClick={() => openHeldPayment(reg)}
                            >
                              {tx('ชำระเงิน')}
                            </button>
                          )}
                          <div className="qr-token-box">
                            {reg.registrationStatus === 'confirmed' ? (
                              <QrCode
                                value={reg.qrCheckInToken}
                                size={96}
                                label={txf('QR รับอุปกรณ์ของ {0}', reg.regCode)}
                                className="pass-qr-img"
                              />
                            ) : (
                              <IconQr size={26} />
                            )}
                            <div>
                              <div className="mono-code">
                                {tx(reg.qrCheckInToken)}
                              </div>
                              <small>{txf("เสื้อไซส์ {0}", reg.shirtSize)}</small>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {certPreviewReg && (
                <CertificatePreviewCard reg={certPreviewReg} onClose={() => setCertPreviewReg(null)} />
              )}
              {(() => {
                const reg = confirmRegId ? myRegistrations.find((r) => r.id === confirmRegId) : undefined;
                if (!reg) return null;
                const ev = events.find((e) => e.id === reg.eventId);
                return (
                  <ConfirmationModal
                    reg={reg}
                    event={ev}
                    category={ev?.categories.find((c) => c.id === reg.categoryId)}
                    addonOrders={merchOrders.filter((m) => m.linkedRegistrationCode === reg.regCode)}
                    onClose={() => setConfirmRegId(null)}
                  />
                );
              })()}
            </section>
            )}

            {ordersTab === 'merch' && (
            <section className="clean-panel" aria-label={tx("คำสั่งซื้อสินค้าที่ระลึก")}>
              <div className="section-title-bar">
                <div>
                  <h2>
                    {tx("คำสั่งซื้อสินค้าที่ระลึกและพรีออเดอร์ (")}
                    <span className="mono-num">{tx(myMerchOrders.length)}</span>)
                  </h2>
                  <p className="muted-inline">
                    {tx("ใช้รหัสรับสินค้าด้านขวาในการรับของที่บูธร้านค้า (ไม่ต้องมีเลข BIB และไม่กระทบสถานะเช็กอินวิ่ง)")}
                  </p>
                </div>
              </div>

              {myMerchOrders.length === 0 ? (
                <div className="subtle-empty-note">
                  {tx("ยังไม่มีคำสั่งซื้อสินค้าที่ระลึกในบัญชีนี้")}
                </div>
              ) : (
                <div className="pass-list">
                  {myMerchOrders.map((ord) => {
                    const ev = events.find((e) => e.id === ord.eventId);
                    return (
                      <article key={ord.id} className="runner-pass-item">
                        <div className="pass-main-info">
                          <div className="pass-badges-row">
                            <span className="mono-code">
                              {tx(ord.merchOrderCode)}
                            </span>
                            <PaymentStatusBadge status={ord.paymentStatus} />
                            {ord.linkedRegistrationCode && (
                              <span className="muted-inline">
                                {tx("อ้างอิงใบสมัคร ")} {tx(ord.linkedRegistrationCode)}
                              </span>
                            )}
                          </div>
                          <h3>{tx(ord.productNameTh)}</h3>
                          <p className="muted-block">
                            {tx("งาน: ")} {tx(ev?.titleTh)} {tx(" · ขนาด:")}{' '}
                            <strong>{tx(ord.variantSize)}</strong> {tx(" · จำนวน")}{' '}
                            <span className="mono-num">{tx(ord.quantity)}</span> {tx(" ชิ้น (รับแล้ว")}{' '}
                            <span className="mono-num">{tx(ord.deliveredQty)}</span>/
                            <span className="mono-num">{tx(ord.quantity)}</span>{tx(") · ยอดรวม")}{' '}
                            <strong className="mono-num">
                              {formatThb(ord.totalPaidSatang, true)}
                            </strong>
                          </p>
                          <p className="muted-inline">
                            {tx(ord.sellerLabel)} ·{' '}
                            {ord.deliveryMethod === 'pickup_at_expo'
                              ? tx("รับที่บูธร้านค้าหน้างาน")
                              : txf("จัดส่งไปรษณีย์: {0}", ord.shippingAddress ?? '')}
                          </p>
                        </div>

                        <div className="pass-qr-card">
                          <span className="muted-inline">{tx("รหัสรับสินค้า")}</span>
                          <strong className="mono-code">{tx(ord.pickupToken)}</strong>
                          <small className="muted-inline">
                            {tx("สถานะส่งมอบ:")}{' '}
                            {ord.fulfillmentStatus === 'completed'
                              ? tx("รับสินค้าครบแล้ว")
                              : ord.fulfillmentStatus === 'partial_received'
                              ? tx("รับสินค้าบางส่วนแล้ว")
                              : ord.fulfillmentStatus === 'ready_or_shipped'
                              ? tx("พร้อมรับ / จัดส่งแล้ว")
                              : tx("กำลังเตรียมของ")}
                          </small>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            )}
          </div>
        )}
      </main>
    );
  }

  /* ================= SUBVIEW 2A: DEDICATED EVENT REGISTRATION PAGE (/events/:code/register) ================= */
  if (subView === 'event_register' && selectedEvent) {
    const org = organizations.find(
      (o) => o.id === selectedEvent.organizationId
    );
    // Layout B reads and writes this form's own state, so switching A <-> B keeps
    // everything typed. The shipping text the live form submits is rebuilt here
    // whenever B changes an address field.
    const savedAddrs = currentUser?.runnerProfile?.savedAddresses ?? [];
    const shipLine = (o: {
      mode?: 'saved' | 'manual';
      id?: string;
      rec?: string;
      ph?: string;
      addr?: CascadingAddressValue;
    }) => {
      const mode = o.mode ?? shipAddrMode;
      if (mode === 'saved') {
        const a = savedAddrs.find((x) => x.id === (o.id ?? selectedSavedAddrId));
        if (a) {
          setRunnerShippingAddress(
            `${a.recipientName} (${a.phone}) — ${a.address}, ต.${a.subdistrict} อ.${a.district} จ.${a.province} ${a.postalCode}`
          );
        }
        return;
      }
      const n = o.addr ?? regCascadeAddr;
      setRunnerShippingAddress(
        `${o.rec ?? shipRecipient} (${o.ph ?? shipPhone}) — ${n.address}, ต.${n.subdistrict} อ.${n.district} จ.${n.province} ${n.postalCode}`.trim()
      );
    };
    const labShared: LabShared = {
      step: [regStep, (v) => setRegStep(v as RegStep)],
      optionId: [
        selectedDivisionOption,
        (id) => {
          setSelectedDivisionOption(id);
          // option ids are `<kind>-<categoryId>` (see registrationOptions)
          const cat = selectedEvent.categories.find((c) => id.slice(id.indexOf('-') + 1) === c.id);
          if (cat) setSelectedCatId(cat.id);
        },
      ],
      catId: selectedCatId,
      forSelf: [
        regModeChosen ? registerForSelf : null,
        (v) => {
          setRegModeChosen(v !== null);
          if (v !== null) setRegisterForSelf(v);
        },
      ],
      savedId: [selectedParticipantId, setSelectedParticipantId],
      buyerName: [buyerName, setBuyerName],
      firstTh: [
        regFirstNameTh,
        (v) => {
          setRegFirstNameTh(v);
          setParticipantNameTh(`${v} ${regLastNameTh}`.trim());
        },
      ],
      lastTh: [
        regLastNameTh,
        (v) => {
          setRegLastNameTh(v);
          setParticipantNameTh(`${regFirstNameTh} ${v}`.trim());
        },
      ],
      firstEn: [
        regFirstNameEn,
        (v) => {
          setRegFirstNameEn(v);
          setParticipantNameEn(`${v} ${regLastNameEn}`.trim());
        },
      ],
      lastEn: [
        regLastNameEn,
        (v) => {
          setRegLastNameEn(v);
          setParticipantNameEn(`${regFirstNameEn} ${v}`.trim());
        },
      ],
      nickTh: [regNicknameTh, setRegNicknameTh],
      nickEn: [regNicknameEn, setRegNicknameEn],
      dob: [regDob, setRegDob],
      gender: [regGender, setRegGender],
      phone: [regPhone, setRegPhone],
      email: [regEmail, setRegEmail],
      idType: [regIdType === 'passport' ? 'passport' : 'thai_id', setRegIdType],
      idNumber: [regIdNumber, setRegIdNumber],
      emergencyName: [
        emergencyName,
        (v) => {
          setEmergencyName(v);
          setEmergencyRelation('');
        },
      ],
      emergencyRelation: [emergencyRelation, setEmergencyRelation],
      emergencyPhone: [emergencyPhone, setEmergencyPhone],
      answers: [customAnswers, setCustomAnswers],
      shirtSize: [shirtSize, setShirtSize],
      shirtStyle: [shirtStyle, setShirtStyle],
      addonItems: [addonItems, setAddonItems],
      delivery: [kitDeliveryOption, setKitDeliveryOption],
      addrName: [shipAddrName, setShipAddrName],
      recipient: [
        shipRecipient,
        (v) => {
          setShipRecipient(v);
          shipLine({ rec: v });
        },
      ],
      shipPhone: [
        shipPhone,
        (v) => {
          setShipPhone(v);
          shipLine({ ph: v });
        },
      ],
      address: [
        regCascadeAddr,
        (v) => {
          setRegCascadeAddr(v);
          shipLine({ addr: v });
        },
      ],
      addrMode: [
        shipAddrMode,
        (v) => {
          setShipAddrMode(v);
          shipLine({ mode: v });
        },
      ],
      bookId: [
        selectedSavedAddrId,
        (v) => {
          setSelectedSavedAddrId(v);
          shipLine({ id: v });
        },
      ],
      channel: [paymentChannel, setPaymentChannel],
      acceptRules: [acceptedRules, setAcceptedRules],
      acceptPayTerms: [acceptedPayTerms, setAcceptedPayTerms],
      acceptPdpa: [acceptedPdpa, setAcceptedPdpa],
    };
    // what layout B needs besides its state: the same checks, the organizer's steps, the booking
    const formCtx = { raceDistance: activeCategory?.code, shirtSize };
    const ownSteps = stepsShown(selectedEvent.formCustomSteps, selectedEvent.customFields, customAnswers, formCtx);
    const checkStep = (step: number, scope: HTMLElement | null): string | null => {
      if (step === 1) {
        if (!selectedCatId && selectedEvent.categories[0]) setSelectedCatId(selectedEvent.categories[0].id);
        return null;
      }
      if (!activeCategory) return null;
      if (step === 2) {
        if (!regModeChosen) return 'กรุณาเลือกว่าจะสมัครให้ตนเองหรือสมัครให้ผู้อื่นก่อน';
        // the organizer's questions are checked together with the runner fields, so every
        // missing answer is marked at once (they used to wait until the runner fields were done)
        const problems = validateAnswers(selectedEvent.customFields ?? [], customAnswers, formCtx, {
          steps: selectedEvent.formCustomSteps ?? [],
          stepId: CORE_STEP,
        });
        setFormErrors(problems);
        if (!reportInvalidFieldsWithin(scope)) return 'กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบ ช่องที่ยังไม่ครบถูกไฮไลต์ไว้';
        if (!regFirstNameEn.trim() || !regLastNameEn.trim() || !buyerName.trim()) {
          return 'กรุณากรอกชื่อ-นามสกุลภาษาอังกฤษของผู้เข้าแข่งขันให้ครบ';
        }
        if (regIdType === 'thai_id' && regIdNumber.trim() && regIdNumber.trim().length !== 13) {
          return 'เลขบัตรประจำตัวประชาชนต้องครบ 13 หลัก';
        }
        if (regAgeCheck && !regAgeCheck.eligible) return ageCheckMessage(regAgeCheck, activeCategory);
        const first = Object.values(problems)[0];
        if (first) return first;
        return null;
      }
      if (step === 5 && kitDeliveryOption === 'postal' && !reportInvalidFieldsWithin(scope)) {
        return 'กรุณากรอกชื่อผู้รับ หมายเลขโทรศัพท์ และที่อยู่จัดส่งให้ครบถ้วน ช่องที่ยังไม่ครบถูกไฮไลต์ไว้';
      }
      if (step > 2 && step < 3) {
        const st = ownSteps[Math.round((step - 2) * 10) - 1];
        if (!st) return null;
        const problems = validateAnswers(selectedEvent.customFields ?? [], customAnswers, formCtx, {
          steps: selectedEvent.formCustomSteps ?? [],
          stepId: st.id,
        });
        setFormErrors(problems);
        return Object.values(problems)[0] ?? null;
      }
      return null;
    };
    const labLive: LabLive = {
      ownSteps,
      check: checkStep,
      errors: formErrors,
      clearError: (id) =>
        setFormErrors((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        }),
      submit: () => void submitRegistrationOrder(true),
      book: () => void submitRegistrationOrder(false),
      held: heldReg
        ? {
            reg: heldReg,
            addonOrders: merchOrders.filter(
              (m) => m.linkedRegistrationCode === heldReg.regCode && m.eventId === heldReg.eventId
            ),
            fromForm: heldFromForm.current,
            busy: heldBusy,
            error: heldError,
            pay: () => void payHeld(),
            cancel: () => void cancelHeld(),
            another: registerAnother,
          }
        : null,
      resumeNotice,
      submitting,
      payError: (
        <>
            {checkoutError && (
              <div className="error-callout" role="alert">
                <IconAlert size={17} />
                <div className="callout-flex">
                  <span>{tx(checkoutError)}</span>
                  {currentUser &&
                    (FEATURES.emailVerification
                      ? !currentUser.emailVerified
                      : !currentUser.contactEmail) && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={onOpenAccountSecurity}
                    >
                      {FEATURES.emailVerification
                        ? tx("เพิ่มและยืนยันอีเมล")
                        : tx("เพิ่มอีเมล")}
                    </button>
                  )}
                </div>
              </div>
            )}
            {submitting && (
              <div className="reg-submit-wait" role="status" aria-live="polite">
                <MascotSprite pose="run" size={34} />
                <span>{tx("กำลังกันที่และยืนยันคำสั่งซื้อ… กรุณาอย่าปิดหน้านี้")}</span>
              </div>
            )}
        </>
      ),
      done: createdResult ? (
          (() => {
            // shared with the history popup (27 Nov 2026): the same items, print and download
            const reg = createdResult.reg;
            const title = confirmationTitle(reg);
            const items = confirmationItems({
              reg,
              event: selectedEvent,
              category: activeCategory ?? undefined,
              addonOrders: createdResult.addonOrders ?? [],
            });
            const qr = confirmationQr(reg);
            return (
              <RegistrationDone title={title} subtitle={tx('บันทึกใบสมัครเรียบร้อยแล้ว')} qr={qr} items={items}>
                <button type="button" className="btn-primary" onClick={() => onNavigate('my_orders', null)}>
                  {tx('ไปหน้าประวัติการสมัคร & การสั่งซื้อ')}
                </button>
                <ConfirmationFileActions title={title} items={items} qr={qr} fileName={reg.regCode} />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setCreatedResult(null);
                    setRegStep(1);
                  }}
                >
                  {tx('สมัครเพิ่มอีกท่าน')}
                </button>
              </RegistrationDone>
            );
          })()
        ) : null,
      notice: formPreview.active ? (
        <p className="form-preview-banner" role="status">
          {tx('ตัวอย่างฟอร์มสมัคร — แสดงคำถามที่ยังไม่เผยแพร่ กรอกลองได้ แต่ไม่ส่งใบสมัครจริง')}
        </p>
      ) : null,
      freeJump: formPreview.active,
      fillSelf: () => {
        setRegisterForSelf(true);
        setRegModeChosen(true);
        applySelfProfile();
      },
      openProfile: onOpenRunnerProfile,
      saveAddresses:
        currentUser && onSaveProfilePatch
          ? async (list) => (await onSaveProfilePatch({ savedAddresses: list })) ?? { ok: true }
          : undefined,
      saveParticipants:
        currentUser && onSaveProfilePatch
          ? async (list) => (await onSaveProfilePatch({ savedParticipants: list })) ?? { ok: true }
          : undefined,
      saveEmergencyContacts:
        currentUser && onSaveProfilePatch
          ? async (list) => (await onSaveProfilePatch({ emergencyContacts: list })) ?? { ok: true }
          : undefined,
    };
    return (
      <RegistrationLabView
        live={labLive}
        shared={labShared}
        souvenirLayout={souvenirLayout}
        key={selectedEvent.id}
        event={selectedEvent}
        organization={org}
        currentUser={currentUser}
        platformProfileConfig={platformProfileConfig}
        openSeatsFor={(cat) => getCategoryOpenSeats(selectedEvent.id, cat)}
        onBack={() => onNavigate('event_detail', selectedEvent.id, 'info_results')}
      />
    );
  }

  /* ================= SUBVIEW 2: EVENT DETAIL (EDITORIAL + STICKY SIDEBAR + REGISTRATION + STOREFRONT) ================= */
  if (subView === 'event_detail' && selectedEvent) {
    const org = organizations.find(
      (o) => o.id === selectedEvent.organizationId
    );
    const openSeats = getEventOpenSeats(selectedEvent);
    const usedSeats = Math.max(0, selectedEvent.totalEventQuota - openSeats);
    const quotaPct = Math.min(
      100,
      Math.round((usedSeats / Math.max(1, selectedEvent.totalEventQuota)) * 100)
    );
    const canManageThisEvent = Boolean(
      currentUser?.isPlatformAdmin ||
        currentUser?.memberships.some(
          (m) => m.organizationId === selectedEvent.organizationId
        )
    );

    // the distance list on this page is read-only; the distance is chosen in the
    // registration form, so the summary shows the cheapest current net price
    const priceFromSatang = selectedEvent.categories.reduce<number | null>((min, cat) => {
      const net = calculateFeeQuote(
        getCurrentTier(cat).priceSatang,
        selectedEvent.feeBearerPolicy
      ).runnerNetPaySatang;
      return min === null || net < min ? net : min;
    }, null);

    // text of the built-in blocks: the editor's unsaved page, then the saved draft (editor
    // preview only), then the event's own text, then the generated default (eventDataPieces.ts)
    const coreText = mergedCoreText(
      selectedEvent,
      pagePreview.page?.coreText ?? (pagePreview.active ? selectedEvent.detailPageDraft?.coreText : undefined)
    );
    const overviewParas = coreText.about.paragraphs;
    const highlightList = coreText.about.highlights;
    const racePackList = coreText.racepack.items;
    const scheduleTimeline = coreText.schedule.items;
    /** editor preview: mark text of a built-in block for in-place editing */
    /** the page editor's preview marks text for in-place editing; a look-only preview does not */
    const editMarks = pagePreview.active && !pagePreview.readOnly;
    const coreEd = (target: string, mode: 'line' | 'multi', value: string) =>
      editMarks ? { 'data-page-edit': `core:${target}`, 'data-edit-mode': mode, 'data-edit-value': value } : {};

    const getShirtSpec = (size: ShirtSizeCode) =>
      resolveShirtSpec(
        size,
        currentUser?.runnerProfile?.preferredShirtType ?? 'Unisex',
        platformProfileConfig?.shirtSizes,
        selectedEvent.customSizeChart
      );

    const startRegistrationForCategory = (catId?: string) => {
      if (catId) setSelectedCatId(catId);
      setCreatedResult(null);
      setRegStep(1);
      onNavigate('event_register', selectedEvent.id, 'register');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const jumpToEditorialSection = (sectionId: string) => {
      setDetailTab('info_results');
      setShowRegForm(false);
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 30);
    };

    const isEditorialView =
      !showRegForm && detailTab !== 'storefront';

    // Event page sections as blocks: one view per block id, drawn in the order of
    // resolveDetailLayout (the organizer's published order, or the default one).
    // Inside the organizer page editor (?preview=page) the unsaved page it sends wins,
    // then the saved draft.
    // One template for every event (24 Nov 2026): the built-in sections in their fixed order,
    // filled from the event's own data and text. Pages organizers built before stay stored, unused.
    const shownPage: EventDetailPage = {
      layout: [],
      customBlocks: [],
      // the "page content" menu's preview sends its unsaved register-card text
      ...((pagePreview.page?.card ?? pageOf(selectedEvent).card) ? { card: pagePreview.page?.card ?? pageOf(selectedEvent).card } : {}),
    };
    /** the sticky register card's text and switches (EventRegisterCardConfig) */
    const cardCfg = shownPage.card ?? {};
    const detailBlocks = resolveDetailLayout(shownPage).filter(
      (b) => b.id !== 'merch' || selectedEvent.products.length > 0 || editMarks
    );
    // the strip is a teaser: a few items, the rest live in the shop tab
    const MERCH_STRIP_MAX = 4;
    const openStore = (productId?: string) => {
      if (productId) setStoreFocus({ id: productId, n: Date.now() });
      setShowRegForm(false);
      setDetailTab('storefront');
    };
    /** the category cards of the event page (also drawn by the "categories" data piece) */
    const renderCategoryCards = (cats: RaceCategory[], opts: { showAllTiers?: boolean; showAge?: boolean } = {}) => (
            <div className="editorial-category-list">
              {cats.map((cat) => {
                const curTier = getCurrentTier(cat);
                const quote = calculateFeeQuote(curTier.priceSatang, selectedEvent.feeBearerPolicy);
                const left = getCategoryOpenSeats(selectedEvent.id, cat);
                return (
                  <article key={cat.id} className="editorial-cat-card">
                    <div className="editorial-cat-head">
                      <div className="cta-inline-row">
                        <span className={`category-bib-chip tone-${cat.colorTag}`}>
                          <strong>{tx(cat.code)}</strong>
                        </span>
                        <h3>{tx(cat.name)}</h3>
                      </div>

                      <div className="editorial-cat-price">
                        <span className="muted-inline">
                          {tx("ราคาสุทธิ (")}{tx(curTier.label)})
                        </span>
                        <strong className="mono-num text-vermilion">
                          {formatThb(quote.runnerNetPaySatang, true)}
                        </strong>
                      </div>
                    </div>

                    <div className="editorial-cat-facts">
                      <span>
                        <IconClock size={14} /> {tx(" ปล่อยตัว")}{' '}
                        <strong className="mono-num">
                          {tx(cat.startTimeLocal)} {tx(" น.")}
                        </strong>
                      </span>
                      <span>
                        {tx("เวลา Cut-off")}{' '}
                        <strong className="mono-num">
                          {tx(cat.cutoffHours)} {tx(" ชม.")}
                        </strong>
                      </span>
                      <span>
                        {tx("ที่นั่งว่าง")}{' '}
                        <strong className="mono-num">
                          {tx(left)} / {tx(cat.categoryQuota)}
                        </strong>{' '}
                        {tx("สิทธิ์")}
                      </span>
                      {opts.showAge !== false && formatAgeLimit(cat) && (
                        <span>
                          <strong>{formatAgeLimit(cat)}</strong>{' '}
                          <span className="muted-inline">
                            ({formatAgeBasis(cat.ageBasis ?? 'race_day')})
                          </span>
                        </span>
                      )}
                    </div>

                    {opts.showAllTiers !== false && (
                    <div className="editorial-tier-strip">
                      {cat.priceTiers.map((t) => (
                        <span
                          key={t.id}
                          className={`editorial-tier-pill ${t.isCurrent ? 'active' : ''}`}
                        >
                          <strong>{tx(t.label)}:</strong>{' '}
                          <span className="mono-num">{formatThb(t.priceSatang)}</span>{' '}
                          ({tx(t.startsAt)} – {tx(t.endsAt)})
                          {t.isCurrent ? tx(" · เปิดใช้อยู่") : ''}
                        </span>
                      ))}
                    </div>
                    )}

                    <div className="editorial-cat-actions">
                      <span className="muted-inline">
                        {tx("ค่าสมัครป้าย ")} {formatThb(quote.baseSatang)} {tx(" + ค่าบริการฝั่งนักวิ่ง")}{' '}
                        {formatThb(quote.runnerFeeSatang, true)}
                      </span>
                    </div>

                    {opts.showAge !== false && categoryHasAgeGroups(cat) && (
                      <details className="cat-age-details">
                        <summary>{tx("ดูรุ่นอายุ")}</summary>
                        <CategoryAgeGroups event={selectedEvent} cat={cat} />
                      </details>
                    )}
                  </article>
                );
              })}
            </div>
    );

    const detailBlockViews: Record<EventDetailBlockId, React.ReactNode> = {
      about: (
        <section id="sec-about" className="clean-panel">
          <h2>{tx("เกี่ยวกับงาน")}</h2>
          {overviewParas.map((p, idx) => (
            <p key={idx} className="muted-block" {...coreEd(`about:paragraphs.${idx}`, 'multi', p)}>
              {tx(p)}
            </p>
          ))}
          {highlightList.length > 0 && (
            <>
              <h3>{tx("จุดเด่น")}</h3>
              <ul className="compact-bullet-list">
                {highlightList.map((h, i) => (
                  <li key={i} {...coreEd(`about:highlights.${i}`, 'line', h)}>
                    {tx(h)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      ),

      categories: (
        <section id="sec-categories" className="clean-panel">
          <div className="section-title-bar">
            <div>
              <h2>{tx("ระยะและค่าสมัคร")}</h2>
              <p className="muted-inline">{tx("เลือกระยะได้ตอนกรอกใบสมัคร")}</p>
            </div>
          </div>

          {renderCategoryCards(selectedEvent.categories)}
        </section>
      ),

      racepack: (
        <section id="sec-racepack" className="clean-panel">
          <h2>{tx("สิ่งที่ได้รับและตารางไซส์เสื้อ")}</h2>

          <div className="racepack-grid">
            {racePackList.map((item, idx) => (
              <div key={idx} className="racepack-item-card" {...(editMarks ? { 'data-core-item': `racepack:${idx}` } : {})}>
                <div className="cta-inline-row">
                  {item.iconImage ? (
                    <img className="custom-card-icon" src={item.iconImage} alt="" />
                  ) : item.icon ? (
                    <FaIcon name={item.icon} />
                  ) : (
                    <IconShirt size={16} />
                  )}
                  <strong {...coreEd(`racepack:items.${idx}.title`, 'line', item.title)}>{tx(item.title)}</strong>
                </div>
                <p className="muted-block" {...coreEd(`racepack:items.${idx}.detail`, 'multi', item.detail)}>
                  {tx(item.detail)}
                </p>
                <span className="mono-code" {...coreEd(`racepack:items.${idx}.scope`, 'line', item.scope)}>
                  {tx(item.scope)}
                </span>
              </div>
            ))}
          </div>

          <h3 className="racepack-size-head">{tx("ตารางไซส์เสื้อแข่งขัน")}</h3>
          <div className="table-scroll">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>{tx("ไซส์")}</th>
                  <th>{tx("รอบอก (นิ้ว)")}</th>
                  <th>{tx("ความยาว (นิ้ว)")}</th>
                  <th className="num-col">{tx("คงเหลือ")}</th>
                </tr>
              </thead>
              <tbody>
                {selectedEvent.shirtStocks.map((st) => {
                  const left = Math.max(0, st.total - st.reservedOrConfirmed);
                  const spec = getShirtSpec(st.size);
                  return (
                    <tr key={st.size}>
                      <td>
                        <strong>{tx(st.size)}</strong>
                      </td>
                      <td className="mono-num">{tx(spec.chestInch)}</td>
                      <td className="mono-num">{tx(spec.lengthInch)}</td>
                      <td className="num-col mono-num">
                        {left > 0 ? (
                          <strong className="text-forest">
                            {txf("ว่าง {0} ตัว", left)}
                          </strong>
                        ) : (
                          <span className="text-danger">{tx("หมดแล้ว")}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ),

      schedule: (
        <section id="sec-schedule" className="clean-panel">
          <h2>{tx("กำหนดการ")}</h2>
          <ScheduleTimeline
            items={scheduleTimeline}
            editBase={editMarks ? 'core:schedule:items' : undefined}
            dragList={editMarks ? 'schedule' : undefined}
          />
        </section>
      ),

      venue: (
        <section id="sec-venue" className="clean-panel">
          <h2>{tx("สถานที่และติดต่อผู้จัด")}</h2>
          <dl className="venue-facts">
            <div>
              <dt>
                <IconMapPin size={16} />
                {tx("สถานที่จัดงาน")}
              </dt>
              <dd>
                {tx(selectedEvent.venue)}
                <span className="muted-inline">
                  {' · '}
                  {tx("จ.")}{tx(selectedEvent.province)} ({tx("ภาค")}{tx(selectedEvent.region)})
                </span>
              </dd>
            </div>
            <div>
              <dt>
                <IconBuilding size={16} />
                {tx("ผู้จัดงาน")}
              </dt>
              <dd>
                {tx(org?.nameTh)}
                {org?.contactEmail && (
                  <>
                    {' · '}
                    <a href={`mailto:${org.contactEmail}`}>{org.contactEmail}</a>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>
                <IconFlag size={16} />
                {tx("กติกาการแข่งขัน")}
              </dt>
              <dd>{txf("ใช้กติกาฉบับ {0}", selectedEvent.rulesVersion)}</dd>
            </div>
          </dl>
        </section>
      ),

      merch: (
        <section id="sec-merch" className="clean-panel merch-strip" aria-labelledby="merch-strip-title">
          <div className="merch-strip-head">
            <div>
              <h2 id="merch-strip-title">{tx("ของที่ระลึกประจำงาน")}</h2>
              <p className="muted-inline">{tx("ซื้อได้โดยไม่ต้องสมัครวิ่ง")}</p>
              {editMarks && selectedEvent.products.length === 0 && (
                <p className="custom-block-empty data-piece-empty">
                  {tx("งานนี้ยังไม่มีสินค้า หน้าจริงจะไม่แสดงส่วนนี้")}
                </p>
              )}
            </div>
            <button type="button" className="btn-secondary" onClick={() => openStore()}>
              <IconBag size={15} />
              <span>
                {selectedEvent.products.length > MERCH_STRIP_MAX
                  ? txf("ดูทั้งหมด {0} รายการ", selectedEvent.products.length)
                  : tx("ไปที่ร้านค้า")}
              </span>
            </button>
          </div>
          <ul className="merch-strip-list">
            {selectedEvent.products.slice(0, MERCH_STRIP_MAX).map((prd) => (
              <li key={prd.id}>
                <button type="button" className="merch-strip-item" onClick={() => openStore(prd.id)}>
                  <span className="merch-strip-art" aria-hidden="true">
                    <ProductArt categoryLabel={prd.categoryLabel} name={prd.nameTh} kind={souvenirArt(prd.categoryLabel, prd.nameTh)} className="sf-art-svg" />
                  </span>
                  <span className="merch-strip-name">{tx(prd.nameTh)}</span>
                  <strong className="merch-strip-price mono-num">{formatThb(prd.priceSatang, true)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ),
    };

    return (
      <main className="customer-container event-detail-page">
        <div className="detail-back-bar">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => onNavigate('directory', null)}
          >
            <IconArrowLeft size={15} />
            <span>{tx("กลับหน้ารวมงานวิ่งทั้งหมด")}</span>
          </button>

          <div className="cta-inline-row">
            {!isEditorialView && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowRegForm(false);
                  setDetailTab('info_results');
                }}
              >
                <IconArrowLeft size={14} />
                <span>{tx("กลับไปอ่านรายละเอียดงานวิ่ง")}</span>
              </button>
            )}

            {canManageThisEvent && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  onOpenOrganizerDashboard(
                    selectedEvent.organizationId,
                    selectedEvent.id
                  )
                }
              >
                {tx("จัดการงานนี้ใน Organizer Dashboard")}
              </button>
            )}
          </div>
        </div>

        {/* 2-COLUMN RACE.THAI.RUN STYLE LAYOUT: MAIN CONTENT LEFT + STICKY SUMMARY RIGHT */}
        <div
          className={`event-detail-two-col ${
            isEditorialView ? 'is-editorial-mode' : 'is-action-mode'
          }`}
        >
          <div className="event-editorial-col">
            {/* HERO COVER BANNER */}
            <section className="event-detail-hero">
              <div className={`detail-cover-box ${selectedEvent.coverImageUrl ? 'has-banner' : ''}`}>
                <EventCoverMedia
                  event={selectedEvent}
                  illustrated
                  className="detail-cover-svg"
                />
                <span className="kr-card-status">
                  <EventStatusBadge status={selectedEvent.status} />
                </span>
              </div>

              <div className="detail-hero-body">
                <div className="detail-meta-top">
                  <span className="race-type-tag">{tx(selectedEvent.raceType)}</span>
                </div>

                <h1>{tx(selectedEvent.titleTh)}</h1>
                <p className="kr-detail-when">
                  <span>
                    <IconCalendar size={20} />
                    <span className="mono-num">{tx(selectedEvent.eventDate)}</span>
                  </span>
                  <span>
                    <IconMapPin size={20} />
                    <span>
                      {tx(selectedEvent.venue)}
                      <span className="kr-detail-province"> · {tx("จ.")}{tx(selectedEvent.province)}</span>
                    </span>
                  </span>
                </p>
                <p className="muted-block">{tx(selectedEvent.tagline)}</p>

              </div>
            </section>

            {selectedEvent.statusNote && (
              <div className="status-explanation-banner" role="status">
                <IconAlert size={17} />
                <span>{tx(selectedEvent.statusNote)}</span>
              </div>
            )}

            {/* TOP SECTION & MODE BAR */}
            <div
              id="event-main-workspace"
              className="detail-mode-tabs kr-mode-tabs"
              role="tablist"
              aria-label={tx("เลือกดูรายละเอียดงาน สมัครวิ่ง หรือร้านค้าของที่ระลึก")}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isEditorialView}
                className={`detail-tab-btn ${isEditorialView ? 'active' : ''}`}
                onClick={() => {
                  setShowRegForm(false);
                  setDetailTab('info_results');
                }}
              >
                <IconFlag size={16} />
                <span>{tx("รายละเอียดงานวิ่งครบถ้วน")}</span>
              </button>


              <button
                type="button"
                role="tab"
                aria-selected={!showRegForm && detailTab === 'storefront'}
                className={`detail-tab-btn ${
                  !showRegForm && detailTab === 'storefront' ? 'active' : ''
                }`}
                onClick={() => {
                  setShowRegForm(false);
                  setDetailTab('storefront');
                }}
              >
                <IconBag size={16} />
                <span>
                  {txf("ร้านค้า ({0})", selectedEvent.products.length)}
                </span>
              </button>

            </div>

            {/* MODE A: FULL EDITORIAL EVENT PAGE (DEFAULT) */}
            {isEditorialView && (
              <div className="editorial-sections-stack">

                {/* RESULTS & ALBUMS (board 04): finished races only. The platform has no
                    results data yet, so the results card says so instead of inventing numbers. */}
                {selectedEvent.status === 'completed' && (
                  <section id="sec-results" className="kr-results" aria-labelledby="kr-results-title">
                    <h2 id="kr-results-title" className="sr-only">
                      {tx("ผลการแข่งขันและอัลบั้มภาพ")}
                    </h2>
                    <div className="kr-results-card">
                      <h3 className="kr-results-head">
                        <IconAward size={20} />
                        {tx("ผลการแข่งขัน")}
                      </h3>
                      <div className="kr-results-empty">
                        <MascotAnim pose="podium" className="kr-results-mascot" />
                        <strong>{tx("ยังไม่มีการประกาศผลการแข่งขัน")}</strong>
                        <p>
                          {tx("ผู้จัดงานยังไม่ได้เผยแพร่ผลการแข่งขันในขณะนี้ กรุณาติดตามอีกครั้งในภายหลัง")}
                        </p>
                      </div>
                    </div>
                    <div className="kr-results-card">
                      <h3 className="kr-results-head">
                        <IconCamera size={20} />
                        {tx("อัลบั้มภาพงาน")}
                      </h3>
                      {selectedEvent.verifiedPhotoAlbums && selectedEvent.verifiedPhotoAlbums.length > 0 ? (
                        <ul className="kr-album-list">
                          {selectedEvent.verifiedPhotoAlbums.map((alb) => (
                            <li key={alb.id}>
                              <strong>{tx(alb.title)}</strong>
                              <span className="muted-inline">
                                {tx(alb.photographerCredit)} ·{' '}
                                <span className="mono-num">{alb.photoCount.toLocaleString('th-TH')}</span>{' '}
                                {tx("ภาพ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="kr-results-empty">
                          <IconCamera size={40} />
                          <strong>{tx("อัลบั้มภาพยังไม่เปิดเผย")}</strong>
                          <p>{tx("ผู้จัดงานจะเผยแพร่อัลบั้มภาพหลังจบงาน")}</p>
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {/* sections in the order the organizer set (default order until they do) */}
                {detailBlocks.map((b) => {
                  const dataCtx: DataPieceCtx = {
                    event: selectedEvent,
                    org: org ?? undefined,
                    openSeats: (cat) => getCategoryOpenSeats(selectedEvent.id, cat),
                    eventOpenSeats: isTotalQuotaEnabled(selectedEvent) ? getEventOpenSeats(selectedEvent) : null,
                    shirtSpec: getShirtSpec,
                    registerOpen: selectedEvent.status === 'published',
                    onRegister: (catId) => {
                      if (!pagePreview.active) startRegistrationForCategory(catId);
                    },
                    onOpenStore: (productId) => {
                      if (!pagePreview.active) openStore(productId);
                    },
                    formatAge: (cat) => formatAgeLimit(cat) || null,
                    renderCategoryCards,
                  };
                  const renderData = (item: EventPageItem) => <EventDataPieceView item={item} ctx={dataCtx} preview={pagePreview.active} />;
                  const dataHasContent = (item: EventPageItem) => dataPieceHasContent(selectedEvent, item);
                  // a block placed inside a column of this free block (one level deep)
                  const renderNested = (ref: string): React.ReactNode => {
                    const inner = resolveBlockKey(shownPage, ref);
                    if (!inner) return null;
                    if (inner.core) {
                      if (inner.core === 'merch' && selectedEvent.products.length === 0 && !pagePreview.active) return null;
                      return detailBlockViews[inner.core];
                    }
                    return inner.custom ? (
                      <EventCustomBlockView
                        block={inner.custom}
                        sectionId={inner.sectionId}
                        preview={pagePreview.active}
                        selectedKey={pagePreview.selected}
                        onPick={pagePreview.pick}
                        nested
                        renderData={renderData}
                        dataHasContent={dataHasContent}
                      />
                    ) : null;
                  };
                  const view = b.custom ? (
                    <EventCustomBlockView
                      block={b.custom}
                      sectionId={b.sectionId}
                      preview={pagePreview.active}
                      selectedKey={pagePreview.selected}
                      onPick={pagePreview.pick}
                      renderNested={renderNested}
                      renderData={renderData}
                      dataHasContent={dataHasContent}
                    />
                  ) : (
                    b.core && detailBlockViews[b.core]
                  );
                  if (!pagePreview.active) return <React.Fragment key={b.id}>{view}</React.Fragment>;
                  // editor preview: click a block to select it in the editor
                  return (
                    <div
                      key={b.id}
                      data-page-key={b.id}
                      className={`page-preview-block ${pagePreview.selected === b.id ? 'is-picked' : ''}`}
                      onClickCapture={(e) => {
                        // a piece of a free block selects itself (its own handler); anything
                        // else in the block (buttons, links) must not act inside the editor
                        if ((e.target as HTMLElement).closest('[data-page-item]')) return;
                        e.preventDefault();
                        e.stopPropagation();
                        pagePreview.pick(b.id);
                      }}
                    >
                      <span className="page-preview-tag" aria-hidden="true">
                        {b.label}
                      </span>
                      {view}
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODE C: EVENT STOREFRONT FOR GENERAL CUSTOMERS */}
            {!showRegForm && detailTab === 'storefront' && (
              <StorefrontView
                event={selectedEvent}
                currentUser={currentUser}
                linkedRegistrationCode={linkedRegForMerch || undefined}
                focusProduct={storeFocus}
                onRequireLogin={() =>
                  onRequireLoginWithIntent({
                    surface: 'events',
                    eventId: selectedEvent.id,
                    eventTab: 'storefront',
                    label: `สั่งซื้อสินค้าที่ระลึกงาน ${selectedEvent.titleTh}`,
                  })
                }
                onCheckout={onCheckoutMerchCart}
                onViewOrders={() => onNavigate('my_orders', null)}
              />
            )}
          </div>

          {/* RIGHT COLUMN: STICKY EVENT SUMMARY & REGISTER SIDEBAR */}
          <aside
            className="event-sticky-aside"
            aria-label={tx("สรุปข้อมูลสำคัญและปุ่มสมัครงานวิ่งแบบเกาะตามหน้าจอ")}
          >
            <div
              className={`sticky-register-card ${pagePreview.active && pagePreview.selected === 'card' ? 'is-picked' : ''}`}
              {...(pagePreview.active
                ? {
                    'data-page-card': '',
                    // editor preview: the card is picked as a whole; its buttons and links stay inert
                    onClickCapture: (e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      pagePreview.pick('card');
                    },
                  }
                : {})}
            >
              <div className="kr-sticky-top">
                <div>
                  <div className="sticky-card-head">
                    <EventStatusBadge status={selectedEvent.status} />
                  </div>
                  <h2>
                    <span
                      className="kr-sticky-kicker"
                      {...(editMarks
                        ? { 'data-page-edit': 'card:kicker', 'data-edit-mode': 'line', 'data-edit-value': cardCfg.kicker ?? 'สมัครร่วมงาน' }
                        : {})}
                    >
                      {cardCfg.kicker ? cardCfg.kicker : tx("สมัครร่วมงาน")}
                    </span>{' '}
                    {tx(selectedEvent.titleTh)}
                  </h2>
                  {(cardCfg.promo || editMarks) && (
                    <p
                      className={`kr-sticky-promo ${cardCfg.promo ? '' : 'is-placeholder'}`}
                      {...(editMarks
                        ? { 'data-page-edit': 'card:promo', 'data-edit-mode': 'line', 'data-edit-value': cardCfg.promo ?? '' }
                        : {})}
                    >
                      {cardCfg.promo || tx("ดับเบิลคลิกเพื่อเพิ่มข้อความโปรโมตสั้น ๆ")}
                    </p>
                  )}
                  {selectedEvent.status === 'published' && selectedEvent.registrationPeriodLabel && (
                    <p className="kr-sticky-period">
                      <IconCalendar size={15} />
                      <span>
                        {tx("เปิดรับสมัคร")} {tx(selectedEvent.registrationPeriodLabel)}
                      </span>
                    </p>
                  )}
                </div>
                {cardCfg.showMascot !== false && <MascotAnim pose="cheer" className="kr-sticky-mascot" />}
              </div>

              {/* PRIMARY STICKY CTA & MERCHANDISE BUTTONS */}
              <div className="sticky-cta-group">
                {selectedEvent.status === 'published' ? (
                  showRegForm && detailTab === 'register' ? (
                    <div className="sticky-active-wizard-note">
                      <div className="cta-inline-row">
                        <IconCheckCircle size={15} />
                        <strong>{tx("กำลังกรอกใบสมัคร (ขั้นตอนที่")} {tx(regStep)}/3)</strong>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary btn-full"
                        onClick={() => {
                          setShowRegForm(false);
                          setDetailTab('info_results');
                        }}
                      >
                        {tx("กลับไปอ่านรายละเอียดงานวิ่ง")}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-cta-accent btn-full"
                      disabled={openSeats <= 0}
                      onClick={() => startRegistrationForCategory()}
                    >
                      <IconBib size={16} />
                      <span>
                        {openSeats <= 0
                          ? tx("โควตาเต็มแล้ว")
                          : tx("สมัครเข้าร่วมงานวิ่ง")}
                      </span>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className="btn-secondary btn-full"
                    onClick={() =>
                      jumpToEditorialSection(
                        selectedEvent.status === 'completed'
                          ? 'sec-results'
                          : (detailBlocks.find((b) => b.custom?.cells.some((c) => c.some((it) => it.kind === 'data' && it.source === 'venue')))
                              ?.sectionId ?? 'sec-venue')
                      )
                    }
                  >
                    <IconCamera size={16} />
                    <span>
                      {selectedEvent.status === 'completed'
                        ? tx("ดูผลการแข่งขัน & รูปภาพหลังงาน")
                        : tx("ดูสถานะและรายละเอียดงาน")}
                    </span>
                  </button>
                )}
              </div>

              {/* The whole-event count and bar are hidden when the organizer switched the total cap off. */}
              {showQuotaBox && isTotalQuotaEnabled(selectedEvent) && cardCfg.showQuota !== false && (
              <div className="sticky-quota-box">
                <div className="sticky-quota-top">
                  <span className="muted-inline">{tx("โควตารวมทั้งงาน")}</span>
                  <strong className="mono-num">
                    {tx("ว่าง ")} {tx(openSeats)} / {tx(selectedEvent.totalEventQuota)} {tx(" สิทธิ์")}
                  </strong>
                </div>
                <div
                  className="quota-track-bar"
                  role="img"
                  aria-label={txf("ใช้โควตาแล้ว {0} จาก {1} สิทธิ์", usedSeats, selectedEvent.totalEventQuota)}
                >
                  <div
                    className="quota-seg-confirmed"
                    style={{ width: `${Math.max(quotaPct, usedSeats > 0 ? 8 : 0)}%` }}
                  />
                </div>
              </div>
              )}

              {priceFromSatang !== null && (
                <div className="sticky-category-picker">
                  <div className="sticky-selected-cat-summary">
                    <div className="section-title-bar">
                      <strong>
                        {txf('ระยะวิ่ง {0} ระยะ', selectedEvent.categories.length)}
                      </strong>
                    </div>
                    {/* one distance per line, larger, each with its own colour (the text says it all) */}
                    <ul className="sticky-dist-list">
                      {selectedEvent.categories.map((c, i) => (
                        <li key={c.id} className={`sticky-dist is-tone-${i % 4}`}>
                          <strong className="sticky-dist-km">{tx(c.code)}</strong>
                          <span className="sticky-dist-name">{tx(c.name)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <StickyCardCompact
                firstSectionId={detailBlocks[0]?.sectionId}
                enabled={isEditorialView}
                pageKey={selectedEvent.id}
              />
            </div>
          </aside>
        </div>

        {isEditorialView &&
          selectedEvent.status === 'published' &&
          priceFromSatang !== null && (
            <MobileRegisterBar
              watchSelector=".event-detail-page .sticky-cta-group"
              headline={txf('{0} ระยะ · เริ่มต้น', selectedEvent.categories.length)}
              priceText={formatThb(priceFromSatang, true)}
              seatsLeft={openSeats}
              hideSeatCount={!isTotalQuotaEnabled(selectedEvent)}
              onRegister={() => startRegistrationForCategory()}
            />
          )}
      </main>
    );
  }

  /* ================= SUBVIEW: RACE CALENDAR ================= */
  if (subView === 'calendar') {
    return (
      <main className="customer-container">
        <RaceCalendarView
          events={publicVisibleEvents}
          onOpenEvent={(ev) =>
            openEventPage(ev, ev.status === 'published' ? 'register' : 'info_results')
          }
        />
      </main>
    );
  }

  /* ================= SUBVIEW 1: MODERN MINIMAL DIRECTORY ================= */
  return (
    <main className="customer-container">
      <HomeScrollMotion
        cardCount={filteredEvents.length}
        listKey={filteredEvents.map((ev) => ev.id).join(',')}
      />
      {/* HERO: headline, running rabbit, search (keyword + region) */}
      <section className="kr-hero" aria-labelledby="kr-hero-title">
        <div className="kr-hero-copy">
          <h1 id="kr-hero-title" className="kr-hero-title">
            <span className="kr-nowrap">{tx("ก้าวต่อไป")}</span>{' '}
            <span className="kr-swoosh">{tx("ไปด้วยกัน")}</span>
          </h1>
          <p className="kr-hero-sub">{tx("ค้นหางานวิ่งที่ใช่ แล้วออกไปสนุกกัน")}</p>
        </div>
        <MascotAnim pose="run" className="kr-hero-mascot" />

        <form
          className="kr-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            applySearch(searchDraft);
          }}
        >
          <HeroSearchField
            events={publicVisibleEvents}
            value={searchDraft}
            onChange={setSearchDraft}
            onPickEvent={(ev) => openEventPage(ev, 'register')}
            onPickPlace={applySearch}
            srLabel={tx("ค้นหาชื่องานวิ่ง จังหวัด หรือสถานที่ปล่อยตัว")}
            placeholder={tx("ค้นหาชื่องานวิ่ง, สถานที่, จังหวัด")}
          />
          <HeroRegionSelect
            label={tx("ภูมิภาค")}
            value={regionFilter}
            onChange={setRegionFilter}
            options={(
              [
                ['all', 'ทุกภูมิภาค'],
                ['เหนือ', 'ภาคเหนือ'],
                ['กลางและกรุงเทพฯ', 'ภาคกลางและกรุงเทพฯ'],
                ['อีสาน', 'ภาคอีสาน'],
                ['ตะวันออก', 'ภาคตะวันออก'],
                ['ใต้', 'ภาคใต้'],
              ] as const
            ).map(([v, lbl]) => ({ value: v, label: tx(lbl), count: countWith({ region: v }) }))}
          />
          <button type="submit" className="kr-search-btn">
            {tx("ค้นหางานวิ่ง")}
          </button>
        </form>
      </section>

      {/* FILTERS: distance chips, then race status chips + result count */}
      <section id="kr-browse" className="kr-filters" aria-label={tx("ตัวกรองระยะทางและสถานะงาน")}>
        <div className="kr-filter-top">
        <div className="kr-chip-row" role="group" aria-label={tx("ระยะวิ่ง")}>
          <span className="kr-chip-label">{tx("ระยะวิ่ง")}</span>
          {(
            [
              ['all', 'ทั้งหมด'],
              ['5k', '5K'],
              ['10k', '10K'],
              ['21k', '21K'],
              ['trail', 'Trail'],
            ] as const
          ).map(([v, lbl]) => (
            <button
              key={v}
              type="button"
              className={`kr-chip ${distanceFilter === v ? 'is-on' : ''}`}
              aria-pressed={distanceFilter === v}
              onClick={() => {
                setDistanceFilter(v);
                jumpToResults();
              }}
            >
              {tx(lbl)}
            </button>
          ))}
        </div>
          <label className="kr-filter-search">
            <IconSearch size={16} />
            <span className="sr-only">{tx("ค้นในผลลัพธ์")}</span>
            <input
              type="search"
              autoComplete="off"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={tx("ค้นในผลลัพธ์")}
            />
          </label>
        </div>
        <div className="kr-status-row">
          <div className="kr-tabs" role="group" aria-label={tx("หมวดงานวิ่ง")}>
            {(
              [
                ['all', 'งานทั้งหมด'],
                ['open', 'กำลังเปิดรับสมัคร'],
                ['has_shop', 'มีร้านเสื้อ/เหรียญ'],
                ['completed', 'จบงานแล้ว / รูปภาพ'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                className={`kr-tab ${quickFilter === k ? 'is-on' : ''}`}
                aria-pressed={quickFilter === k}
                onClick={() => {
                  setQuickFilter(k);
                  jumpToResults();
                }}
              >
                {tx(lbl)} <span className="mono-num">{countWith({ quick: k })}</span>
              </button>
            ))}
          </div>
          <span className="kr-count">
            {tx("พบ ")} <strong className="mono-num">{tx(filteredEvents.length)}</strong> {tx(" งานวิ่ง")}
          </span>
        </div>
      </section>

      {/* where a filter click scrolls to: the top of the results (or the empty note) */}
      <div id="kr-results-top" className="kr-results-top" aria-hidden="true" />
      {filteredEvents.length === 0 ? (
        <DirectoryEmptyState
          query={searchQuery}
          textOnlyCount={
            searchQuery.trim()
              ? publicVisibleEvents.filter((ev) => matchesSearchText(ev, searchQuery)).length
              : 0
          }
          otherFiltersOn={quickFilter !== 'all' || distanceFilter !== 'all' || regionFilter !== 'all'}
          similar={similarSearchTerms(publicVisibleEvents, searchQuery)}
          onUseTerm={applySearch}
          onClearSearch={() => {
            setFilterText('');
            setSearchQuery('');
          }}
          onClearOthers={() => {
            setQuickFilter('all');
            setDistanceFilter('all');
            setRegionFilter('all');
          }}
          onClearAll={() => {
            setFilterText('');
            setSearchQuery('');
            setQuickFilter('all');
            setDistanceFilter('all');
            setRegionFilter('all');
          }}
        />
      ) : (
        <section id="kr-results" className="modern-event-grid kr-event-grid" aria-label={tx("รายการงานวิ่ง")}>
          {filteredEvents.map((ev) => {
            const openSeats = getEventOpenSeats(ev);
            const lowestCat = [...ev.categories].sort(
              (a, b) =>
                getCurrentTier(a).priceSatang - getCurrentTier(b).priceSatang
            )[0];
            const lowestTier = lowestCat ? getCurrentTier(lowestCat) : null;
            const sampleQuote = lowestTier
              ? calculateFeeQuote(lowestTier.priceSatang, ev.feeBearerPolicy)
              : null;

            return (
              <article key={ev.id} className="kr-event-card">
                <button
                  type="button"
                  className="kr-card-cover"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={() => openEventPage(ev, 'register')}
                >
                  <EventCoverMedia event={ev} illustrated className="kr-card-img" />
                  <span className="kr-card-status">
                    <EventStatusBadge status={ev.status} />
                  </span>
                </button>

                <div className="kr-card-body">
                  <h2 className="kr-card-title">{tx(ev.titleTh)}</h2>
                  <p className="kr-card-meta">
                    <IconCalendar size={15} />
                    <span className="mono-num">{tx(ev.eventDate)}</span>
                  </p>
                  <p className="kr-card-meta">
                    <IconMapPin size={15} />
                    <span>{tx("จ.")}{tx(ev.province)}</span>
                  </p>
                  <div className="kr-card-chips">
                    {ev.categories.map((cat) => (
                      <span key={cat.id} className="kr-dist">
                        {tx(cat.code)}
                      </span>
                    ))}
                    {ev.products.length > 0 && (
                      <button
                        type="button"
                        className="kr-shop-link"
                        onClick={() => openEventPage(ev, 'storefront')}
                      >
                        <IconBag size={13} />
                        {txf("ร้านค้า {0} รายการ", ev.products.length)}
                      </button>
                    )}
                  </div>
                </div>

                <div className="kr-card-foot">
                  <p className="kr-card-price">
                    {sampleQuote ? (
                      <>
                        <span>{tx("เริ่มต้น")}</span>{' '}
                        <strong className="mono-num">
                          {/* whole baht reads like the board; satang shown only when present */}
                          {formatThb(
                            sampleQuote.runnerNetPaySatang,
                            sampleQuote.runnerNetPaySatang % 100 !== 0
                          )}
                        </strong>{' '}
                        <span>{tx("(สุทธิ)")}</span>
                      </>
                    ) : (
                      <span>{tx("ยังไม่เปิดราคา")}</span>
                    )}
                    {/* seats left are no longer shown on the list (26 Nov 2026, user request); a full event still says so */}
                    {openSeats <= 0 && <small>{tx("โควตาเต็มแล้ว")}</small>}
                  </p>
                  <button
                    type="button"
                    className="kr-card-go"
                    aria-label={txf(
                      ev.status === 'published' ? 'ดูรายละเอียดและสมัคร {0}' : 'ดูรายละเอียด {0}',
                      ev.titleTh
                    )}
                    onClick={() =>
                      openEventPage(ev, ev.status === 'published' ? 'register' : 'info_results')
                    }
                  >
                    <IconArrowRight size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

    </main>
  );
};
