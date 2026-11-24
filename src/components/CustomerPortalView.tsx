import { RequiredFieldText } from './RequiredFieldText';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EventProduct,
  MerchOrderRecord,
  Organization,
  PlatformProfileConfig,
  RaceCategory,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  ReturnIntent,
  RunnerProfileData,
  RunnerSavedAddress,
  SavedParticipant,
  ShirtSizeCode,
  UserAccount,
} from '../types';
import { resolveShirtSpec } from '../data/runnerProfileDefaults';
import {
  calculateFeeQuote,
  feePolicyLabel,
  formatThb,
  getCurrentTier,
  kitShippingFee,
  quoteRegistrationShipping,
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
import { RegistrationDone, RegistrationSummary, type ReviewLedgerGroup, type ReviewSection } from './RegistrationReview';
import { PaymentMethodPicker } from './PaymentMethodPicker';
import { StorefrontView, type CartLine, type MerchCheckoutPayload, type MerchCheckoutResult } from './StorefrontView';
import { SouvenirPicker } from './SouvenirPicker';
import { PAYMENT_TERMS_VERSION, RegistrationTerms } from './RegistrationTerms';
import { displayPhone } from '../utils/phone';
import { DateOfBirthInput } from './DateOfBirthInput';
import { CategoryAgeGroups, categoryHasAgeGroups } from './EventAgeGroupsSection';
import { ProductArt, souvenirArt } from './ProductArt';
import { pageOf, resolveBlockKey, resolveDetailBlocksDeep, resolveDetailLayout } from '../data/eventDetailLayout';
import { EventCustomBlockView } from './EventCustomBlockView';
import { EventDataPieceView, type DataPieceCtx } from './EventDataPieceView';
import { dataPieceHasContent, mergedCoreText } from '../data/eventDataPieces';
import { usePagePreview } from './pagePreview';
import { useFormPreview } from './formPreview';
import type { EventDetailBlockId, EventDetailPage, EventPageItem } from '../types';
import { FaIcon } from './FaIcon';
import { RaceCalendarView } from './RaceCalendarView';
import { NoteTag, PriceTag } from './RegTags';
import { MobileStepProgress } from './MobileStepProgress';
import { MobileRegisterBar } from './MobileRegisterBar';
import { SectionShortcuts } from './SectionShortcuts';
import { ScheduleTimeline } from './ScheduleTimeline';
import { HomeScrollMotion } from './HomeScrollMotion';
import { NEW_ADDRESS, SavedAddressSelect } from './SavedAddressSelect';
import { StickyCardCompact } from './StickyCardCompact';
import { MascotAnim } from './MascotAnim';
import { isTotalQuotaEnabled } from '../utils/eventConfig';
import { DirectoryEmptyState, HeroRegionSelect, HeroSearchField, matchesSearchText, similarSearchTerms } from './DirectorySearch';
import { RegistrationLabView, type LabShared } from './RegistrationLabView';
import { ProductPicker, type PickerType } from './ProductPicker';
import { SHIRT_STYLES, shirtStyleName, type ShirtStyleId } from '../data/mockShirtStyles';
import { MascotSprite, MascotStepTrack } from './MascotRunner';
import { reportInvalidFieldsWithin } from '../utils/formValidation';
import {
  CascadingAddressValue,
  ThaiPostalAddressSelector,
} from './ThaiPostalAddressSelector';
import {
  maskIdNumber,
  sanitizeEnglishNameInput,
  sanitizeThaiNameInput,
} from '../utils/dateFormat';
import {
  EventStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  RegStatusBadge,
} from './StatusBadges';
import { RunnerCustomFieldsInputs } from './PublicEventView';
import { CORE_STEP, answerText, fieldShown, isContentField, stepsShown, validateAnswers } from '../data/registrationForm';

import { PhoneInput } from './PhoneInput';
import { tx, txf } from '../i18n';
import { FEATURES } from '../config/features';
import {
  ageCheckMessage,
  evaluateCategoryAge,
  formatAgeBasis,
  formatAgeGroupLabel,
  formatAgeLimit,
  formatBasisDate,
} from '../utils/age';
import { IdNumberInput } from './IdNumberInput';
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
  registrationSteps?: RegistrationStepDef[];
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
    emergencyContact?: string;
    shirtSize: ShirtSizeCode;
    kitDeliveryMethod?: 'pickup_at_expo' | 'postal_shipping';
    shippingAddressSnapshot?: string;
    participantSnapshot?: RegistrationRecord['participantSnapshot'];
    marketingConsent: boolean;
    acceptedRules: boolean;
    acceptedPaymentTermsVersion?: string;
    simulateImmediateWebhook: boolean;
    addonItems?: CartLine[];
    customAnswers?: Record<string, string | boolean>;
    requestId: string;
  }) => Promise<
    | { ok: true; reg: RegistrationRecord; addonOrders?: MerchOrderRecord[] }
    | { ok: false; error: string }
  >;
  onCompletePendingPayment: (regId: string) => void;
  /** storefront cart checkout (server checks stock for the whole cart in one go) */
  onCheckoutMerchCart: (payload: MerchCheckoutPayload) => Promise<MerchCheckoutResult>;
  /** 'b' renders the alternative registration layout (sandbox review only, cannot submit) */
  registrationLayout?: 'a' | 'b';
  /** event-wide quota box on the event detail page (dev-dock mockup for now) */
  showQuotaBox?: boolean;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  subView,
  selectedEventId,
  initialEventTab,
  events,
  organizations,
  registrations,
  merchOrders,
  registrationSteps = [],
  platformProfileConfig,
  currentUser,
  onNavigate,
  onRequireLoginWithIntent,
  onOpenAccountSecurity,
  onOpenRunnerProfile,
  onSaveProfilePatch,
  onOpenOrganizerDashboard,
  onCreateRegistrationAndOptionalAddon,
  onCompletePendingPayment,
  onCheckoutMerchCart,
  registrationLayout = 'a',
  showQuotaBox = true,
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
  const [kitDeliveryOption, setKitDeliveryOption] = useState<
    'expo_pickup' | 'postal'
  >('expo_pickup');
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
  const [shirtSize, setShirtSize] = useState<ShirtSizeCode>('M');
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
  // Shipping address mode (saved address book vs manual entry)
  const [shipAddrMode, setShipAddrMode] = useState<'saved' | 'manual'>(
    (currentUser?.runnerProfile?.savedAddresses ?? []).length > 0
      ? 'saved'
      : 'manual'
  );
  const [selectedSavedAddrId, setSelectedSavedAddrId] = useState<string>(
    currentUser?.runnerProfile?.savedAddresses?.find((a) => a.isDefault)?.id ??
      currentUser?.runnerProfile?.savedAddresses?.[0]?.id ??
      ''
  );
  // name the runner gives a new address (e.g. home / office) when saving it to the book
  const [shipAddrName, setShipAddrName] = useState('');
  const [shipRecipient, setShipRecipient] = useState(
    currentUser?.fullNameTh ?? ''
  );
  const [shipPhone, setShipPhone] = useState(
    currentUser?.runnerProfile?.phone ?? ''
  );
  // saving a newly typed address into the profile address book (separate button)
  const [savingShipAddr, setSavingShipAddr] = useState(false);
  const [shipAddrNotice, setShipAddrNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [shirtTouched, setShirtTouched] = useState(false);
  const [regCascadeAddr, setRegCascadeAddr] = useState<CascadingAddressValue>({
    country: 'Thailand',
    postalCode: currentUser?.runnerProfile?.postalCode ?? '50200',
    province: currentUser?.runnerProfile?.province ?? 'เชียงใหม่',
    district: currentUser?.runnerProfile?.district ?? 'เมืองเชียงใหม่',
    subdistrict: currentUser?.runnerProfile?.subdistrict ?? 'สุเทพ',
    address: currentUser?.runnerProfile?.address ?? '199/8 ถ.ห้วยแก้ว',
  });
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  // payment terms on the payment step (required, like the event rules)
  const [acceptedPayTerms, setAcceptedPayTerms] = useState(false);
  const [customAnswers, setCustomAnswers] = useState<
    Record<string, string | boolean>
  >({});
  const [step2Error, setStep2Error] = useState<string | null>(null);
  /** the check result of the organizer's questions, by question id (shown under each one) */
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [paymentChannel, setPaymentChannel] = useState<'promptpay' | 'card'>(
    'promptpay'
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // checkout: waiting for the server, and the id that makes a retry safe (see submitRegistrationOrder)
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
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
    setStep2Error(null);
  }, [initialEventTab, selectedEventId]);

  React.useEffect(() => {
    setRegisterForSelf(true);
    setRegModeChosen(Boolean(currentUser));
    setShirtTouched(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  // Pick a shirt size for the current event: preferred size if in stock, else keep current/first available
  const applyPreferredShirt = (preferred?: string) => {
    const ev = events.find((e) => e.id === selectedEventId);
    if (!ev || ev.shirtStocks.length === 0) return;
    const isOpen = (size: string) =>
      ev.shirtStocks.some(
        (st) => st.size === size && st.total - st.reservedOrConfirmed > 0
      );
    if (preferred && isOpen(preferred)) {
      setShirtSize(preferred);
      return;
    }
    setShirtSize((prev) => {
      if (isOpen(prev)) return prev;
      const firstOpen =
        ev.shirtStocks.find((st) => st.total - st.reservedOrConfirmed > 0) ??
        ev.shirtStocks[0];
      return firstOpen?.size ?? prev;
    });
  };

  // Fill participant fields from a saved participant (or clear for a new one)
  const applySavedParticipant = (pt: SavedParticipant | null) => {
    setCustomAnswers({});
    setRegFirstNameTh(pt?.firstName ?? '');
    setRegLastNameTh(pt?.lastName ?? '');
    setParticipantNameTh(pt ? `${pt.firstName} ${pt.lastName}`.trim() : '');
    setRegNicknameTh(pt?.nickname ?? '');
    setRegFirstNameEn(pt?.firstNameEn ?? '');
    setRegLastNameEn(pt?.lastNameEn ?? '');
    setRegNicknameEn(pt?.nicknameEn ?? '');
    setParticipantNameEn(
      pt ? `${pt.firstNameEn ?? ''} ${pt.lastNameEn ?? ''}`.trim() : ''
    );
    setRegDob(pt?.dateOfBirth ?? '');
    setRegGender(pt?.gender ?? 'ไม่ระบุ');
    setRegIdType(pt?.idType && pt.idType !== 'none' ? pt.idType : 'thai_id');
    setRegIdNumber(pt?.idNumber ?? '');
    setRegPhone(pt?.phone ?? '');
    setEmergencyContact(
      pt?.emergencyContactName ?? '',
      pt?.emergencyContactRelation ?? '',
      pt?.emergencyContactPhone ?? ''
    );
  };

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
    setRegFirstNameEn(p?.firstNameEn ?? '');
    setRegLastNameEn(p?.lastNameEn ?? '');
    setRegNicknameEn(p?.nicknameEn ?? '');
    setRegDob(p?.dateOfBirth ?? '');
    setRegGender(p?.gender ?? 'ไม่ระบุ');
    setRegIdType(p?.idType && p.idType !== 'none' ? p.idType : 'thai_id');
    setRegIdNumber(p?.idNumber ?? '');
    setRegPhone(p?.phone ?? '');
    const contacts = p?.emergencyContacts ?? [];
    const primaryContact =
      contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
    if (primaryContact) {
      setEmergencyContact(primaryContact.contactName, primaryContact.relationship, primaryContact.phone);
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
    if (registerForSelf) {
      applySelfProfile();
      setRegModeChosen(true);
      if (!shirtTouched) applyPreferredShirt(p?.preferredShirtSize);
    }

    const addrs = p?.savedAddresses ?? [];
    const defAddr = addrs.find((a) => a.isDefault) ?? addrs[0] ?? null;
    setShipRecipient((prev) => prev || fullTh);
    setShipPhone((prev) => prev || p?.phone || '');
    if (defAddr) {
      setShipAddrMode('saved');
      setSelectedSavedAddrId((prev) =>
        addrs.some((a) => a.id === prev) ? prev : defAddr.id
      );
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

  // Auto-select Preferred Shirt Size from Runner Profile when opening an Event Registration
  React.useEffect(() => {
    const ev = events.find((e) => e.id === selectedEventId);
    if (!ev || ev.shirtStocks.length === 0) return;
    const prefSize = currentUser?.runnerProfile?.preferredShirtSize;
    if (prefSize) {
      const match = ev.shirtStocks.find(
        (s) => s.size === prefSize && s.total - s.reservedOrConfirmed > 0
      );
      if (match) {
        setShirtSize(match.size);
        return;
      }
    }
    const currentAvailable = ev.shirtStocks.find(
      (s) => s.size === shirtSize && s.total - s.reservedOrConfirmed > 0
    );
    if (!currentAvailable) {
      const firstOpen =
        ev.shirtStocks.find((s) => s.total - s.reservedOrConfirmed > 0) ??
        ev.shirtStocks[0];
      if (firstOpen) setShirtSize(firstOpen.size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId, currentUser?.id, currentUser?.runnerProfile?.preferredShirtSize, events.length]);

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

  const addonLines = useMemo(
    () =>
      selectedEvent
        ? addonItems
            .map((l) => ({ ...l, prd: selectedEvent.products.find((p) => p.id === l.productId) }))
            .filter((l): l is CartLine & { prd: EventProduct } => Boolean(l.prd))
        : [],
    [selectedEvent, addonItems]
  );
  const addonSatangTotal = addonLines.reduce((n, l) => n + l.prd.priceSatang * l.qty, 0);
  // postage shown on the delivery step, itemised on the review step and added to the total;
  // the server works it out again with the same helper
  const regShipQuote = quoteRegistrationShipping(
    selectedEvent ?? {},
    kitDeliveryOption === 'postal' ? 'postal_shipping' : 'pickup_at_expo',
    addonLines
  );
  const regKitFee = kitShippingFee(selectedEvent ?? {});
  // the older inline form on the event page still picks a single souvenir: these read and
  // write the first line only
  const selectedAddonProduct: EventProduct | null = addonLines[0]?.prd ?? null;
  const includeAddonId = addonLines[0]?.productId ?? 'none';
  const addonSize = addonLines[0]?.size ?? 'M';
  const setIncludeAddonId = (id: string) => {
    const prd = selectedEvent?.products.find((p) => p.id === id);
    setAddonItems(prd ? [{ productId: prd.id, size: prd.availableSizes[0] ?? '-', qty: 1 }] : []);
  };
  const setAddonSize = (size: string) =>
    setAddonItems((prev) => (prev.length > 0 ? [{ ...prev[0], size }, ...prev.slice(1)] : prev));

  const myRegistrations = useMemo(() => {
    if (!currentUser) return [];
    return registrations.filter(
      (r) =>
        r.runnerUserId === currentUser.id ||
        (currentUser.contactEmail &&
          r.email.toLowerCase() === currentUser.contactEmail.toLowerCase())
    );
  }, [registrations, currentUser]);

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
      setCheckoutError(
        txf("กรุณาติ๊กยอมรับกติกาการแข่งขัน ({0}) ก่อนยืนยัน", selectedEvent.rulesVersion)
      );
      return;
    }
    if (!acceptedPayTerms) {
      setCheckoutError(tx("กรุณาติ๊กยอมรับข้อกำหนดการชำระเงินและการคืนเงินก่อนยืนยัน"));
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
      phone: regPhone.trim() || prof?.phone,
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
    setCreatedResult(res);
    setRegStep(8);
  };

  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitRegistrationOrder(true);
  };

  /* ================= SUBVIEW 3: MY TICKETS & MERCH ORDERS ================= */
  if (subView === 'my_orders') {
    return (
      <main className="customer-container">
        <div className="hub-header-bar kr-orders-head">
          <IconBib size={44} className="kr-orders-icon" />
          <div>
            <h1>{tx("บัตรวิ่งและคำสั่งซื้อของฉัน")}</h1>
            <p className="muted-block">
              {tx("แยกแสดงระหว่าง ")} <strong>{tx("สิทธิ์เข้าร่วมการแข่งขัน (รับ BIB)")}</strong> {tx(" และ")}{' '}
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
                  label: 'เปิดดูบัตรวิ่งและคำสั่งซื้อของฉัน',
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
                    {tx("แสดง QR Token นี้ที่จุดเช็กอินนักวิ่งเพื่อรับป้าย BIB และเสื้อตามสิทธิ์สมัคร")}
                  </p>
                </div>
              </div>

              {myRegistrations.length === 0 ? (
                <div className="subtle-empty-note">
                  {tx("บัญชีนี้ยังไม่มีใบสมัครวิ่ง (ลูกค้าทั่วไปสามารถดูคำสั่งซื้อสินค้าที่ระลึกได้ในส่วนถัดไปด้านล่าง)")}
                </div>
              ) : (
                <div className="pass-list">
                  {myRegistrations.map((reg) => {
                    const ev = events.find((e) => e.id === reg.eventId);
                    const cat = ev?.categories.find(
                      (c) => c.id === reg.categoryId
                    );
                    return (
                      <article key={reg.id} className="runner-pass-item kr-pass">
                        {ev && (
                          <div className="kr-pass-thumb" aria-hidden="true">
                            <EventCoverMedia event={ev} illustrated className="kr-card-img" />
                          </div>
                        )}
                        <div className="pass-main-info">
                          <div className="pass-badges-row">
                            <span className="mono-code">{tx(reg.regCode)}</span>
                            <RegStatusBadge status={reg.registrationStatus} />
                            <PaymentStatusBadge status={reg.paymentStatus} />
                            <FulfillmentStatusBadge
                              status={reg.fulfillmentStatus}
                            />
                          </div>
                          <h3>{ev?.titleTh ?? reg.eventId}</h3>
                          <p className="muted-block">
                            {tx("ระยะทาง: ")} <strong>{tx(cat?.name)}</strong> {tx(" · วันงาน:")}{' '}
                            <span className="mono-num">{tx(ev?.eventDate)}</span> {tx(" · ผู้เข้าแข่งขัน: ")} <strong>{tx(reg.participantNameTh)}</strong>{' '}
                            {tx("(ผู้สั่งซื้อ: ")} {tx(reg.buyerName)})
                          </p>
                          <p className="muted-inline">
                            {tx("ชำระสุทธิ:")}{' '}
                            <strong className="mono-num">
                              {formatThb(reg.snapshotTotalChargedSatang, true)}
                            </strong>{' '}
                            {tx("(ไม่แก้ยอดใบสมัครย้อนหลังหากมีการสั่งซื้อของที่ระลึกเพิ่มภายหลัง)")}
                          </p>

                          <div className="cta-inline-row" style={{ marginTop: '0.55rem' }}>
                            {reg.registrationStatus === 'pending_payment' && (
                              <button
                                type="button"
                                className="btn-primary"
                                onClick={() => onCompletePendingPayment(reg.id)}
                              >
                                <IconCheckCircle size={15} />
                                <span>
                                  {tx("ชำระเงินต่อให้เสร็จสิ้น (")}
                                  {formatThb(
                                    reg.snapshotTotalChargedSatang,
                                    true
                                  )}
                                  )
                                </span>
                              </button>
                            )}

                            {ev && ev.products.length > 0 && (
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() =>
                                  openEventPage(ev, 'storefront', reg.regCode)
                                }
                              >
                                <IconBag size={14} />
                                <span>{tx("ซื้อเสื้อ/เหรียญที่ระลึกเพิ่ม (สร้างออเดอร์ใหม่)")}</span>
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
                          </div>
                        </div>

                        <div className="pass-qr-card">
                          <div className="pass-bib-num mono-num">
                            {reg.bibNumber ?? tx("รอกำหนด BIB")}
                          </div>
                          <div className="qr-token-box">
                            <IconQr size={26} />
                            <div>
                              <div className="mono-code">
                                {tx(reg.qrCheckInToken)}
                              </div>
                              <small>{tx("เสื้อตามสิทธิ์: ไซส์")} {tx(reg.shirtSize)}</small>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
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
    if (registrationLayout === 'b') {
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
        shirtSize: [
          shirtSize,
          (v) => {
            setShirtSize(v);
            setShirtTouched(true);
          },
        ],
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
      };
      return (
        <RegistrationLabView
          shared={labShared}
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
    const hasSouvenirs = selectedEvent.products.length > 0;
    // the organizer's own steps for this runner (right distance, with a question to answer)
    const formCtx = { raceDistance: activeCategory?.code, shirtSize };
    const runnerSteps = stepsShown(selectedEvent.formCustomSteps, selectedEvent.customFields, customAnswers, formCtx);
    const stepPos = (i: number) => 2 + (i + 1) / 10;
    const firstAfterInfo = runnerSteps.length > 0 ? stepPos(0) : 3;
    const lastBeforeShop = runnerSteps.length > 0 ? stepPos(runnerSteps.length - 1) : 2;
    const stepLabels: { step: RegStep; label: string }[] = [
      { step: 1, label: 'เริ่ม' },
      { step: 2, label: 'ข้อมูล' },
      ...runnerSteps.map((st, i) => ({ step: stepPos(i), label: st.title })),
      { step: 3, label: 'สินค้า' },
      ...(hasSouvenirs ? [{ step: 4 as RegStep, label: 'ของที่ระลึก' }] : []),
      { step: 5, label: 'ที่อยู่' },
      { step: 6, label: 'สรุป' },
      { step: 7, label: 'ชำระเงิน' },
    ];

    const getShirtSpec = (size: ShirtSizeCode) =>
      resolveShirtSpec(
        size,
        currentUser?.runnerProfile?.preferredShirtType ?? 'Unisex',
        platformProfileConfig?.shirtSizes,
        selectedEvent.customSizeChart
      );

    // สร้างตัวเลือกรายการสมัครแบบการ์ด Radio เรียงแนวตั้งตามระยะของงานวิ่ง
    const registrationOptions = [
      {
        optionId: `alumni-${selectedEvent.categories[0]?.id ?? 'cat'}`,
        catId: selectedEvent.categories[0]?.id ?? '',
        label: `ศิษย์เก่า / สมาชิกชมรม ${selectedEvent.titleTh.split(' ')[0]}`,
        subLabel: `${selectedEvent.categories[0]?.name ?? ''} (${
          selectedEvent.categories[0]?.code ?? ''
        })`,
      },
      ...selectedEvent.categories.flatMap((cat) => [
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
    ];

    const currentPickedOptionId =
      selectedDivisionOption ||
      registrationOptions.find((o) => o.catId === activeCategory?.id)
        ?.optionId ||
      registrationOptions[0]?.optionId ||
      '';

    return (
      <main className="event-reg-page-shell">
        <div className="event-reg-split-frame">
          {/* EVENT BANNER (top): cover + scrim, back, title and key facts */}
          <header
            className={`reg-banner ${
              selectedEvent.coverImageUrl ? 'has-cover-photo' : 'has-cover-motif'
            }`}
            aria-label={tx("ข้อมูลงานวิ่งที่กำลังสมัคร")}
          >
            <div className="poster-cover-media" aria-hidden="true">
              <EventCoverMedia
                event={selectedEvent}
                illustrated
                className="poster-cover-img"
              />
              <div className="poster-cover-scrim" />
            </div>
            <button
              type="button"
              className="reg-banner-back"
              aria-label={tx("กลับหน้ารายละเอียดงานวิ่ง")}
              onClick={() =>
                onNavigate('event_detail', selectedEvent.id, 'info_results')
              }
            >
              <IconArrowLeft size={15} />
              <span>{tx("กลับ")}</span>
            </button>
            <div className="reg-banner-copy">
              <h1 className="reg-banner-title">
                {selectedEvent.titleEn || selectedEvent.titleTh}
              </h1>
              <p className="reg-banner-meta">
                <span className="reg-banner-org">
                  {tx(org?.nameTh ?? "องค์กรผู้จัดงานวิ่ง กระต่าย")}
                </span>
                <span>
                  <IconCalendar size={14} />
                  {tx(selectedEvent.eventDate)}
                </span>
                <span>
                  <IconMapPin size={14} />
                  {tx(selectedEvent.venue)} · {tx(selectedEvent.province)}
                </span>
                {activeCategory && (
                  <span>
                    <IconFlag size={14} />
                    {tx(activeCategory.name)}
                  </span>
                )}
              </p>
            </div>
            {activeCategory && (
              <PriceTag
                onDark
                satang={
                  calculateFeeQuote(
                    getCurrentTier(activeCategory).priceSatang,
                    selectedEvent.feeBearerPolicy
                  ).runnerNetPaySatang
                }
              />
            )}
          </header>

          {/* STEP-BY-STEP WIZARD (below the banner) */}
          <section
            className="event-reg-wizard-pane"
            aria-label={tx("ขั้นตอนการสมัครเข้าร่วมงานวิ่ง")}
          >
            {formPreview.active && (
              <p className="form-preview-banner" role="status">
                {tx('ตัวอย่างฟอร์มสมัคร — แสดงคำถามที่ยังไม่เผยแพร่ กรอกลองได้ แต่ไม่ส่งใบสมัครจริง')}
              </p>
            )}
            {regStep !== 8 && (
            <>
            {/* 6-STEP CONNECTED CIRCLE PROGRESS STEPPER */}
            <nav
              ref={stepperRef}
              className="circle-stepper-bar"
              aria-label={tx("ความคืบหน้าขั้นตอนการสมัคร")}
            >
              {stepLabels.map((item, idx) => {
                const isCurrent = regStep === item.step;
                const isDone = regStep > item.step;
                return (
                  <React.Fragment key={item.step}>
                    <button
                      type="button"
                      className={`circle-step-node ${
                        isCurrent ? 'active' : isDone ? 'done' : ''
                      }`}
                      onClick={() => {
                        if (item.step < regStep || formPreview.active) {
                          setRegStep(item.step);
                        }
                      }}
                    >
                      <span className="circle-step-label">{tx(item.label)}</span>
                      <span className="circle-step-ring" aria-hidden="true">
                        {isDone && <IconCheckCircle size={14} />}
                      </span>
                    </button>
                    {idx < stepLabels.length - 1 && (
                      <div
                        className={`circle-stepper-line ${
                          regStep > item.step ? 'line-done' : ''
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </nav>
            <MascotStepTrack
              stepperRef={stepperRef}
              stepIndex={Math.max(0, stepLabels.findIndex((s) => s.step === regStep))}
              complete={false}
            />
            {/* phones: current step + segmented bar instead of 7 squeezed circles */}
            <MobileStepProgress
              steps={stepLabels}
              current={regStep}
              complete={false}
              onJump={(step) => {
                if (step < regStep || formPreview.active) setRegStep(step);
              }}
            />
            </>
            )}

            {/* STEP 1: เริ่ม — เลือกประเภทการสมัคร */}
            {regStep === 1 && (
              <div className="reg-step-body">
                <h2 className="reg-step-accent-heading">{tx("เลือกประเภทการสมัคร")}</h2>

                <div
                  className="reg-radio-cards-stack"
                  role="radiogroup"
                  aria-label={tx("เลือกประเภทการสมัคร")}
                >
                  {registrationOptions.map((opt) => {
                    const cat =
                      selectedEvent.categories.find(
                        (c) => c.id === opt.catId
                      ) ?? selectedEvent.categories[0];
                    const tier = cat ? getCurrentTier(cat) : null;
                    const quote = tier
                      ? calculateFeeQuote(
                          tier.priceSatang,
                          selectedEvent.feeBearerPolicy
                        )
                      : null;
                    const openCatSeats = cat
                      ? getCategoryOpenSeats(selectedEvent.id, cat)
                      : 0;
                    const isSelected = currentPickedOptionId === opt.optionId;

                    const isFull = openCatSeats <= 0;
                    return (
                      <label
                        key={opt.optionId}
                        className={`reg-category-radio-card ${
                          isSelected ? 'selected' : ''
                        } ${isFull ? 'disabled' : ''}`}
                      >
                        <input
                          type="radio"
                          name="event-reg-cat-option"
                          disabled={isFull}
                          checked={isSelected}
                          onChange={() => {
                            setSelectedDivisionOption(opt.optionId);
                            setSelectedCatId(opt.catId);
                          }}
                        />
                        <span className="custom-radio-circle" aria-hidden="true" />
                        <div className="reg-radio-card-copy">
                          <strong>{tx(opt.label)}</strong>
                          <span className="muted-inline">{tx(opt.subLabel)}</span>
                          <span className="reg-tag-row">
                            {quote && <PriceTag satang={quote.runnerNetPaySatang} />}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <div className="reg-step-footer-center">
                  <button
                    type="button"
                    className="btn-primary reg-next-pill-btn"
                    onClick={() => {
                      if (!selectedCatId && selectedEvent.categories[0]) {
                        setSelectedCatId(selectedEvent.categories[0].id);
                      }
                      setRegStep(2);
                    }}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: ข้อมูล — ข้อมูลผู้สมัคร & คำถามเฉพาะงาน */}
            {regStep === 2 && activeCategory && (
              <div className="reg-step-body">
                <div className="reg-step-head">
                <h2 className="reg-step-accent-heading">
                  {tx("กรอกข้อมูลผู้เข้าแข่งขัน (")}{tx(activeCategory.name)})
                </h2>

                {!currentUser && (
                  <div className="login-prompt-inline">
                    <div>
                      <strong>{tx("ยังไม่ได้เข้าสู่ระบบ:")}</strong>{' '}
                      {tx("คุณสามารถกรอกข้อมูลไว้ก่อนได้ และระบบจะให้ยืนยันตัวตนก่อนชำระเงินในขั้นตอนที่ 5")}
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        onRequireLoginWithIntent({
                          surface: 'events',
                          eventId: selectedEvent.id,
                          eventTab: 'register',
                          label: `สมัครวิ่ง ${selectedEvent.titleTh}`,
                        })
                      }
                    >
                      {tx("เข้าสู่ระบบ / สมัครบัญชี")}
                    </button>
                  </div>
                )}

                {/* เลือกก่อนเข้าฟอร์ม: สมัครให้ตนเอง / สมัครให้ผู้อื่น */}
                <div
                  className={`reg-radio-cards-stack reg-mode-choice ${
                    regModeChosen ? 'is-compact' : ''
                  }`}
                  role="radiogroup"
                  aria-label={tx("เลือกผู้เข้าแข่งขัน")}
                >
                  <label
                    className={`reg-category-radio-card ${
                      regModeChosen && registerForSelf ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="reg-mode"
                      checked={regModeChosen && registerForSelf}
                      onChange={() => {
                        setRegisterForSelf(true);
                        setRegModeChosen(true);
                        setStep2Error(null);
                        applySelfProfile();
                        setShirtTouched(false);
                        applyPreferredShirt(
                          currentUser?.runnerProfile?.preferredShirtSize
                        );
                      }}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>{tx("สมัครให้ตนเอง")}</strong>
                      <span className="muted-inline">
                        {tx("ดึงข้อมูลจากโปรไฟล์นักวิ่งของคุณมาเติมให้อัตโนมัติ")}
                      </span>
                    </div>
                  </label>
                  <label
                    className={`reg-category-radio-card ${
                      regModeChosen && !registerForSelf ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="reg-mode"
                      checked={regModeChosen && !registerForSelf}
                      onChange={() => {
                        setRegisterForSelf(false);
                        setRegModeChosen(true);
                        setStep2Error(null);
                        const saved =
                          currentUser?.runnerProfile?.savedParticipants ?? [];
                        setShirtTouched(false);
                        if (saved.length > 0) {
                          setSelectedParticipantId(saved[0].id);
                          applySavedParticipant(saved[0]);
                          applyPreferredShirt(saved[0].preferredShirtSize);
                        } else {
                          setSelectedParticipantId('new');
                          applySavedParticipant(null);
                        }
                      }}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>{tx("สมัครให้ผู้อื่น")}</strong>
                      <span className="muted-inline">
                        {tx("กรอกข้อมูลผู้เข้าแข่งขันคนอื่น ระบบจะบันทึกไว้ให้เลือกใช้ครั้งถัดไป")}
                      </span>
                    </div>
                  </label>
                </div>

                </div>

                {regModeChosen && (
                  <div className="reg-step-grid">
                    <div className="reg-step-col">
                  {regModeChosen && !registerForSelf && (
                    <div className="form-row">
                      <label htmlFor="p2-saved-part">
                        {tx("เลือกผู้สมัครที่เคยกรอกไว้")}
                      </label>
                      <select
                        id="p2-saved-part"
                        value={selectedParticipantId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setSelectedParticipantId(id);
                          const found = (
                            currentUser?.runnerProfile?.savedParticipants ?? []
                          ).find((x) => x.id === id);
                          applySavedParticipant(found ?? null);
                          setShirtTouched(false);
                          applyPreferredShirt(found?.preferredShirtSize);
                        }}
                      >
                        {(currentUser?.runnerProfile?.savedParticipants ?? []).map(
                          (pt) => {
                            const enName =
                              `${pt.firstNameEn ?? ''} ${pt.lastNameEn ?? ''}`.trim();
                            const thName = `${pt.firstName} ${pt.lastName}`.trim();
                            const disp =
                              enName && thName
                                ? `${enName} (${thName})`
                                : enName || thName;
                            const nick = pt.nicknameEn || pt.nickname;
                            return (
                              <option key={pt.id} value={pt.id}>
                                {disp}
                                {nick ? ` · ${nick}` : ''}
                              </option>
                            );
                          }
                        )}
                        <option value="new">{tx("+ เพิ่มผู้สมัครใหม่")}</option>
                      </select>
                    </div>
                  )}
                    {!registerForSelf && (
                      <div className="form-row">
                        <label htmlFor="p2-buyer">
                          {<RequiredFieldText text={tx("ชื่อ-นามสกุลผู้ซื้อคำสั่งซื้อ (ผู้ชำระเงิน) *")} />}
                        </label>
                        <input
                          id="p2-buyer"
                          type="text"
                          value={buyerName}
                          onChange={(e) => setBuyerName(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <fieldset className="reg-field-group">
                      <legend>
                        {tx("ชื่อผู้เข้าแข่งขัน")}{' '}
                        <span className="reg-legend-note">
                          · {tx("ชื่ออังกฤษแสดงบนป้าย BIB")}
                        </span>
                      </legend>
                      {/* two fields per row: English name (required, printed on the BIB), Thai name, nicknames */}
                      <div className="reg-name-grid">
                        <div className="form-row">
                          <label htmlFor="p2-fname-en">{<RequiredFieldText text="First Name (EN) *" />}</label>
                          <input
                            id="p2-fname-en"
                            type="text"
                            value={regFirstNameEn}
                            onChange={(e) => {
                              const v = sanitizeEnglishNameInput(e.target.value);
                              setRegFirstNameEn(v);
                              setParticipantNameEn(`${v} ${regLastNameEn}`.trim());
                            }}
                            placeholder="e.g. Kanpitcha"
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-lname-en">{<RequiredFieldText text="Last Name (EN) *" />}</label>
                          <input
                            id="p2-lname-en"
                            type="text"
                            value={regLastNameEn}
                            onChange={(e) => {
                              const v = sanitizeEnglishNameInput(e.target.value);
                              setRegLastNameEn(v);
                              setParticipantNameEn(`${regFirstNameEn} ${v}`.trim());
                            }}
                            placeholder="e.g. Wattanakul"
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-fname-th">{tx("ชื่อจริง (ภาษาไทย)")}</label>
                          <input
                            id="p2-fname-th"
                            type="text"
                            value={regFirstNameTh}
                            onChange={(e) => {
                              const v = sanitizeThaiNameInput(e.target.value);
                              setRegFirstNameTh(v);
                              setParticipantNameTh(
                                `${v} ${regLastNameTh}`.trim()
                              );
                            }}
                            placeholder={tx("เช่น กานต์พิชชา")}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-lname-th">{tx("นามสกุล (ภาษาไทย)")}</label>
                          <input
                            id="p2-lname-th"
                            type="text"
                            value={regLastNameTh}
                            onChange={(e) => {
                              const v = sanitizeThaiNameInput(e.target.value);
                              setRegLastNameTh(v);
                              setParticipantNameTh(
                                `${regFirstNameTh} ${v}`.trim()
                              );
                            }}
                            placeholder={tx("เช่น วัฒนากูล")}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-nick-th">{tx("ชื่อเล่น")}</label>
                          <input
                            id="p2-nick-th"
                            type="text"
                            value={regNicknameTh}
                            onChange={(e) =>
                              setRegNicknameTh(
                                sanitizeThaiNameInput(e.target.value)
                              )
                            }
                            placeholder={tx("เช่น กานต์")}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-nick-en">Nickname (EN)</label>
                          <input
                            id="p2-nick-en"
                            type="text"
                            value={regNicknameEn}
                            onChange={(e) =>
                              setRegNicknameEn(
                                sanitizeEnglishNameInput(e.target.value)
                              )
                            }
                            placeholder="e.g. Kan"
                          />
                        </div>
                      </div>
                    </fieldset>


                    </div>

                    <div className="reg-step-col">
                    <fieldset className="reg-field-group">
                      <legend>{tx("ข้อมูลส่วนตัวและเอกสารยืนยันตัวตน")}</legend>
                      <div className="form-grid-3">
                        <div className="form-row reg-span-all">
                          <label htmlFor="p2-dob">
                            {tx("วันเกิด")}
                          </label>
                          <DateOfBirthInput
                            id="p2-dob"
                            valueIso={regDob}
                            onChangeIso={setRegDob}
                            ariaDescribedBy="p2-dob-age"
                          />
                        </div>
                          {regAgeCheck && (
                            <p
                              id="p2-dob-age"
                              className={`reg-age-hint reg-span-all ${
                                regAgeCheck.eligible ? '' : 'is-error'
                              }`}
                              aria-live="polite"
                            >
                              {regAgeCheck.ageYears !== null ? (
                                <>
                                  {txf(
                                    'อายุ {0} ปี ณ {1}',
                                    regAgeCheck.ageYears,
                                    formatBasisDate(regAgeCheck.basisDate)
                                  )}
                                  {regAgeCheck.group &&
                                    ` · ${txf('รุ่น {0}', formatAgeGroupLabel(regAgeCheck.group))}`}
                                  {regAgeCheck.unassigned &&
                                    ` · ${tx('ยังไม่เข้ารุ่นอายุ (ระบุเพศชายหรือหญิงเพื่อจัดรุ่น)')}`}
                                  {!regAgeCheck.eligible &&
                                    ` · ${txf('ระยะนี้รับ{0}', formatAgeLimit(activeCategory) ?? '')}`}
                                </>
                              ) : regAgeCheck.status === 'missing_dob' ? (
                                txf(
                                  'ระยะนี้กำหนด{0} · {1} กรุณาระบุวันเกิด',
                                  formatAgeLimit(activeCategory) ?? tx('รุ่นอายุ'),
                                  formatAgeBasis(regAgeCheck.basis)
                                )
                              ) : regAgeCheck.status === 'invalid_dob' ? (
                                tx('วันเกิดไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง')
                              ) : null}
                            </p>
                          )}
                        <div className="form-row reg-span-all">
                          <label htmlFor="p2-phone">{tx("เบอร์โทรศัพท์ผู้เข้าแข่งขัน")}</label>
                          <PhoneInput
                            id="p2-phone"
                            value={regPhone}
                            onChange={(next) => setRegPhone(next)}
                          />
                        </div>
                      </div>
                      <div className="form-grid-2">
                        <div className="form-row">
                          <label htmlFor="p2-gender">{tx("เพศ")}</label>
                          <select
                            id="p2-gender"
                            value={regGender}
                            onChange={(e) =>
                              setRegGender(
                                e.target.value as 'ชาย' | 'หญิง' | 'ไม่ระบุ'
                              )
                            }
                          >
                            <option value="ไม่ระบุ">{tx("ไม่ระบุ")}</option>
                            <option value="ชาย">{tx("ชาย")}</option>
                            <option value="หญิง">{tx("หญิง")}</option>
                          </select>
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-idtype">{tx("ประเภทเอกสาร")}</label>
                          <select
                            id="p2-idtype"
                            value={regIdType}
                            onChange={(e) =>
                              setRegIdType(
                                e.target.value as 'none' | 'thai_id' | 'passport'
                              )
                            }
                          >
                            <option value="thai_id">
                              {tx("บัตรประจำตัวประชาชน 13 หลัก")}
                            </option>
                            <option value="passport">
                              {tx("หนังสือเดินทาง (Passport)")}
                            </option>
                          </select>
                        </div>
                        <div className="form-row reg-span-all">
                          <label htmlFor="p2-idnum">
                            {regIdType === 'thai_id'
                              ? tx("เลขบัตรประจำตัวประชาชน")
                              : tx("เลขหนังสือเดินทาง")}
                          </label>
                          <IdNumberInput
                            id="p2-idnum"
                            idType={regIdType}
                            className="mono-code"
                            value={regIdNumber}
                            onValueChange={setRegIdNumber}
                            placeholder={
                              regIdType === 'thai_id'
                                ? 'X-XXXX-XXXXX-XX-X'
                                : 'Passport No.'
                            }
                          />
                        </div>
                      </div>
                    </fieldset>

                    </div>

                    <div className="reg-step-col">
                    <div className="reg-field-group">
                      <div className="form-row">
                        <label htmlFor="p2-emerg">
                          {<RequiredFieldText text={tx("ชื่อผู้ติดต่อฉุกเฉิน *")} />}
                        </label>
                        <input
                          id="p2-emerg"
                          type="text"
                          value={emergencyName}
                          onChange={(e) => {
                            setEmergencyName(e.target.value);
                            setEmergencyRelation('');
                          }}
                          placeholder={tx("เช่น วีระ วัฒนากูล")}
                          required
                        />
                        {emergencyRelation && (
                          <span className="muted-inline">
                            {txf("ความสัมพันธ์: {0}", tx(emergencyRelation))}
                          </span>
                        )}
                      </div>
                      <div className="form-row">
                        <label htmlFor="p2-emerg-phone">
                          {<RequiredFieldText text={tx("เบอร์โทรผู้ติดต่อฉุกเฉิน *")} />}
                        </label>
                        <PhoneInput
                          id="p2-emerg-phone"
                          value={emergencyPhone}
                          onChange={setEmergencyPhone}
                          required
                        />
                        {registerForSelf &&
                          (currentUser?.runnerProfile?.emergencyContacts ?? []).length > 0 && (
                          <div className="reg-ec-pick">
                            <select
                              aria-label={tx("เลือกผู้ติดต่อฉุกเฉินจากโปรไฟล์")}
                              value=""
                              onChange={(e) => {
                                const ec = (
                                  currentUser?.runnerProfile?.emergencyContacts ?? []
                                ).find((x) => x.id === e.target.value);
                                if (ec) setEmergencyContact(ec.contactName, ec.relationship, ec.phone);
                              }}
                            >
                              <option value="">{tx("เลือกจากโปรไฟล์…")}</option>
                              {(currentUser?.runnerProfile?.emergencyContacts ?? []).map(
                                (ec) => (
                                  <option key={ec.id} value={ec.id}>
                                    {ec.contactName} ({tx(ec.relationship)})
                                    {ec.isPrimary ? ` · ${tx("หลัก")}` : ''}
                                  </option>
                                )
                              )}
                            </select>
                            {onOpenRunnerProfile && (
                              <button
                                type="button"
                                className="inline-text-link"
                                onClick={onOpenRunnerProfile}
                              >
                                {tx("จัดการโปรไฟล์")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <RunnerCustomFieldsInputs
                      fields={selectedEvent.customFields}
                      steps={selectedEvent.formCustomSteps ?? []}
                      stepId={CORE_STEP}
                      errors={formErrors}
                      answers={customAnswers}
                      raceDistanceCode={activeCategory.code}
                      shirtSize={shirtSize}
                      publishedFormVersion={
                        selectedEvent.publishedFormVersion ?? 'v1.2-published'
                      }
                      onAnswerChange={(fieldId, val) => {
                        setStep2Error(null);
                        setCustomAnswers((prev) => ({
                          ...prev,
                          [fieldId]: val,
                        }));
                      }}
                    />
                    </div>
                  </div>
                )}

                {step2Error && (
                  <div className="error-callout" role="alert">
                    <IconAlert size={16} />
                    <span>{tx(step2Error)}</span>
                  </div>
                )}

                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(1)}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary reg-next-pill-btn"
                    onClick={(e) => {
                      if (!regModeChosen) {
                        setStep2Error(tx("กรุณาเลือกว่าจะสมัครให้ตนเองหรือสมัครให้ผู้อื่นก่อน"));
                        return;
                      }
                      if (!reportInvalidFieldsWithin(e.currentTarget.closest('.reg-step-body'))) {
                        setStep2Error(tx("กรุณากรอกช่องที่มีเครื่องหมาย * ให้ครบ ช่องที่ยังไม่ครบถูกไฮไลต์ไว้"));
                        return;
                      }
                      if (!regFirstNameEn.trim() || !regLastNameEn.trim() || !buyerName.trim()) {
                        setStep2Error(tx("กรุณากรอกชื่อ-นามสกุลภาษาอังกฤษของผู้เข้าแข่งขันให้ครบ"));
                        return;
                      }
                      if (regIdType === 'thai_id' && regIdNumber.trim() && regIdNumber.trim().length !== 13) {
                        setStep2Error(tx("เลขบัตรประจำตัวประชาชนต้องครบ 13 หลัก"));
                        return;
                      }
                      if (regAgeCheck && !regAgeCheck.eligible) {
                        setStep2Error(ageCheckMessage(regAgeCheck, activeCategory));
                        return;
                      }
                      const stepProblems = validateAnswers(
                        selectedEvent.customFields ?? [],
                        customAnswers,
                        { raceDistance: activeCategory.code, shirtSize },
                        { steps: selectedEvent.formCustomSteps ?? [], stepId: CORE_STEP }
                      );
                      setFormErrors(stepProblems);
                      const firstProblem = Object.values(stepProblems)[0];
                      if (firstProblem) {
                        setStep2Error(firstProblem);
                        return;
                      }
                      setStep2Error(null);
                      if (!shirtTouched) {
                        if (registerForSelf) {
                          applyPreferredShirt(
                            currentUser?.runnerProfile?.preferredShirtSize
                          );
                        } else {
                          const pt = (
                            currentUser?.runnerProfile?.savedParticipants ?? []
                          ).find((x) => x.id === selectedParticipantId);
                          applyPreferredShirt(pt?.preferredShirtSize);
                        }
                      }
                      setRegStep(firstAfterInfo);
                    }}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* the organizer's own steps (24 Nov 2026), between runner details and the shop */}
            {regStep > 2 && regStep < 3 && activeCategory && (() => {
              const idx = Math.round((regStep - 2) * 10) - 1;
              const st = runnerSteps[idx];
              if (!st) {
                // the answers changed and this step is no longer asked: carry on
                return (
                  <div className="reg-step-body">
                    <div className="reg-step-footer-between">
                      <button type="button" className="btn-secondary" onClick={() => setRegStep(2)}>
                        {tx('ย้อนกลับ')}
                      </button>
                      <button type="button" className="btn-primary reg-next-pill-btn" onClick={() => setRegStep(3)}>
                        {tx('ถัดไป')}
                      </button>
                    </div>
                  </div>
                );
              }
              const goNext = () => {
                const problems = validateAnswers(selectedEvent.customFields ?? [], customAnswers, formCtx, {
                  steps: selectedEvent.formCustomSteps ?? [],
                  stepId: st.id,
                });
                setFormErrors(problems);
                const first = Object.values(problems)[0];
                if (first) {
                  setStep2Error(first);
                  return;
                }
                setStep2Error(null);
                setRegStep(idx + 1 < runnerSteps.length ? stepPos(idx + 1) : 3);
              };
              return (
                <div className="reg-step-body">
                  <div className="reg-step-head">
                    <h2 className="reg-step-accent-heading">{tx(st.title)}</h2>
                    {st.description && <p className="muted-block">{tx(st.description)}</p>}
                  </div>
                  <RunnerCustomFieldsInputs
                    fields={selectedEvent.customFields}
                    answers={customAnswers}
                    raceDistanceCode={activeCategory.code}
                    shirtSize={shirtSize}
                    steps={selectedEvent.formCustomSteps ?? []}
                    stepId={st.id}
                    errors={formErrors}
                    heading={null}
                    onAnswerChange={(fieldId, val) => {
                      setStep2Error(null);
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next[fieldId];
                        return next;
                      });
                      setCustomAnswers((prev) => ({ ...prev, [fieldId]: val }));
                    }}
                  />
                  {step2Error && (
                    <div className="error-callout" role="alert">
                      <IconAlert size={16} />
                      <span>{tx(step2Error)}</span>
                    </div>
                  )}
                  <div className="reg-step-footer-between">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setRegStep(idx > 0 ? stepPos(idx - 1) : 2)}
                    >
                      {tx('ย้อนกลับ')}
                    </button>
                    <button type="button" className="btn-primary reg-next-pill-btn" onClick={goNext}>
                      {tx('ถัดไป')}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STEP 3: สินค้า — เลือกไซส์เสื้อตามสิทธิ์สมัคร */}
            {regStep === 3 && activeCategory && (
              <div className="reg-step-body">
                <h2 className="reg-step-accent-heading">
                  {tx("เลือกไซส์เสื้อตามสิทธิ์สมัคร")}
                </h2>

                {registerForSelf && currentUser?.runnerProfile?.preferredShirtSize && (
                  <div className="info-callout">
                    <IconShirt size={15} />
                    <span>
                      {txf(
                        "ดึงค่าเริ่มต้นจาก Runner Profile (ไซส์ {0} · ทรง {1}) คุณเลือกเปลี่ยนไซส์สำหรับงานนี้ได้อิสระโดยไม่กระทบงานที่ยืนยันแล้ว",
                        currentUser.runnerProfile.preferredShirtSize,
                        currentUser.runnerProfile.preferredShirtType ?? 'Unisex'
                      )}
                    </span>
                  </div>
                )}

                <p className="reg-step-lede">
                  {tx("เสื้อรวมในค่าสมัครแล้ว แก้ไขไซส์ได้ถึงวันที่")}{' '}
                  <span className="mono-num">{tx(selectedEvent.editDeadlineDate)}</span>
                </p>

                {(() => {
                  const shirtTypes: PickerType[] = SHIRT_STYLES.map((style) => {
                    const stock = style.demoStock ?? selectedEvent.shirtStocks;
                    return {
                      id: style.id,
                      name: style.nameTh,
                      art: style.art,
                      demo: style.demoStock !== null,
                      optionLegend: 'ไซส์',
                      options: stock.map((st) => {
                        const spec = getShirtSpec(st.size);
                        return {
                          value: st.size,
                          label: st.size,
                          sub: txf('อก {0} · ยาว {1}', spec.chestInch, spec.lengthInch),
                          left: Math.max(0, st.total - st.reservedOrConfirmed),
                          total: st.total,
                          unit: 'ตัว',
                        };
                      }),
                    };
                  });
                  return (
                    <ProductPicker
                      idPrefix="reg-shirt"
                      typeLegend="ประเภทเสื้อ"
                      types={shirtTypes}
                      typeId={shirtStyle}
                      onTypeChange={(id) => {
                        setShirtStyle(id as ShirtStyleId);
                        // keep the size if the new style has it in stock, else take the first one left
                        const next = shirtTypes.find((t) => t.id === id);
                        const keep = next?.options.find((o) => o.value === shirtSize && o.left > 0);
                        const first = next?.options.find((o) => o.left > 0);
                        if (!keep && first) setShirtSize(first.value as ShirtSizeCode);
                        setShirtTouched(true);
                      }}
                      optionValue={shirtSize}
                      onOptionChange={(v) => {
                        setShirtSize(v as ShirtSizeCode);
                        setShirtTouched(true);
                      }}
                    />
                  );
                })()}

                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(lastBeforeShop)}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary reg-next-pill-btn"
                    onClick={() => setRegStep(hasSouvenirs ? 4 : 5)}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ของที่ระลึก — สินค้าซื้อเพิ่ม (ไม่บังคับ) */}
            {regStep === 4 && hasSouvenirs && (
              <div className="reg-step-body">
                <h2 className="reg-step-accent-heading">
                  {tx("ของที่ระลึก (ไม่บังคับ)")}
                </h2>
                <p className="reg-step-lede">
                  {tx("สั่งเสื้อหรือเหรียญที่ระลึกเพิ่มพร้อมใบสมัคร ชำระรวมกับค่าสมัคร")}
                </p>

                <SouvenirPicker products={selectedEvent.products} value={addonItems} onChange={setAddonItems} />
                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(3)}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary reg-next-pill-btn"
                    onClick={() => setRegStep(5)}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: ที่อยู่ — วิธีรับอุปกรณ์ Race Kit & ที่อยู่จัดส่ง */}
            {regStep === 5 && (
              <div className="reg-step-body">
                <h2 className="reg-step-accent-heading">
                  {tx("เลือกวิธีรับอุปกรณ์ (Race Kit) และที่อยู่ติดต่อ")}
                </h2>

                <div className="reg-radio-cards-stack">
                  <label
                    className={`reg-category-radio-card ${
                      kitDeliveryOption === 'expo_pickup' ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="kit-delivery-mode"
                      checked={kitDeliveryOption === 'expo_pickup'}
                      onChange={() => setKitDeliveryOption('expo_pickup')}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>
                        {tx("รับเสื้อและป้าย BIB ด้วยตนเองที่หน้างาน (QR Check-in)")}
                      </strong>
                      <span className="muted-inline">
                        {tx("กำหนดการรับอุปกรณ์: ")} {tx(selectedEvent.kitPickupWindow)} {tx(" ณ")}{' '}
                        {tx(selectedEvent.venue)}
                      </span>
                      <span className="reg-tag-row">
                        <NoteTag tone="ok">{tx("ไม่มีค่าจัดส่ง")}</NoteTag>
                      </span>
                    </div>
                  </label>

                  <label
                    className={`reg-category-radio-card ${
                      kitDeliveryOption === 'postal' ? 'selected' : ''
                    }`}
                  >
                    <input
                      type="radio"
                      name="kit-delivery-mode"
                      checked={kitDeliveryOption === 'postal'}
                      onChange={() => setKitDeliveryOption('postal')}
                    />
                    <span className="custom-radio-circle" aria-hidden="true" />
                    <div className="reg-radio-card-copy">
                      <strong>
                        {tx("ระบุที่อยู่สำหรับรับเอกสาร/จัดส่งอุปกรณ์ทางไปรษณีย์")}
                      </strong>
                      <span className="muted-inline">
                        {tx("บันทึกที่อยู่สำหรับจัดส่งเสื้อและของที่ระลึกตามเงื่อนไขของผู้จัดงาน")}
                      </span>
                      <span className="reg-tag-row">
                        <PriceTag prefix="+" satang={regKitFee.satang} />
                        <NoteTag>{tx("ค่าจัดส่งชุดแข่ง")}</NoteTag>
                        {regKitFee.isSample && <NoteTag>{tx("ค่าตัวอย่าง ผู้จัดยังไม่ได้กำหนด")}</NoteTag>}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Pick-up at the venue needs no address: the form only shows for postal delivery */}
                {kitDeliveryOption === 'postal' && (
                <div className="custom-field-creator canvas-stack" style={{ marginTop: '0.6rem' }}>
                  <strong id="ship-addr-label">{<RequiredFieldText text={tx("ที่อยู่ติดต่อ / ที่อยู่สำหรับจัดส่งพัสดุ *")} />}</strong>
                  {/* address book as one dropdown; its last row opens the form for a new address */}
                  {(currentUser?.runnerProfile?.savedAddresses ?? []).length > 0 && (
                    <SavedAddressSelect
                      addresses={currentUser?.runnerProfile?.savedAddresses ?? []}
                      value={shipAddrMode === 'manual' ? NEW_ADDRESS : selectedSavedAddrId}
                      labelledBy="ship-addr-label"
                      onChange={(id) => {
                        setShipAddrNotice(null);
                        if (id === NEW_ADDRESS) {
                          setShipAddrMode('manual');
                          const n = regCascadeAddr;
                          setRunnerShippingAddress(
                            `${shipRecipient} (${shipPhone}) — ${n.address}, ต.${n.subdistrict} อ.${n.district} จ.${n.province} ${n.postalCode}`.trim()
                          );
                          return;
                        }
                        const addr = (currentUser?.runnerProfile?.savedAddresses ?? []).find((x) => x.id === id);
                        if (!addr) return;
                        setShipAddrMode('saved');
                        setSelectedSavedAddrId(addr.id);
                        setRunnerShippingAddress(
                          `${addr.recipientName} (${addr.phone}) — ${addr.address}, ต.${addr.subdistrict} อ.${addr.district} จ.${addr.province} ${addr.postalCode}`
                        );
                      }}
                    />
                  )}

                  {shipAddrNotice && (
                    <p
                      className={`ship-addr-notice ${shipAddrNotice.tone === 'err' ? 'is-error' : ''}`}
                      role={shipAddrNotice.tone === 'err' ? 'alert' : 'status'}
                    >
                      {shipAddrNotice.tone === 'err' ? <IconAlert size={15} /> : <IconCheckCircle size={15} />}
                      <span>{shipAddrNotice.text}</span>
                    </p>
                  )}

                  {shipAddrMode === 'manual' && (
                    <>
                      {/* compact grid: name | phone, recipient | postal code, street | area, then a one-line summary */}
                      <ThaiPostalAddressSelector
                        idPrefix="ev-reg-ship"
                        compact
                        compactLead={
                          <>
                            <div className="form-row">
                              <label htmlFor="ship-addr-name">{tx('ชื่อเรียกที่อยู่')}</label>
                              <input
                                id="ship-addr-name"
                                type="text"
                                value={shipAddrName}
                                maxLength={60}
                                placeholder={tx('เช่น บ้านพัก / ที่ทำงาน')}
                                onChange={(e) => setShipAddrName(e.target.value)}
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="ship-phone">{<RequiredFieldText text={tx("เบอร์โทรผู้รับ *")} />}</label>
                              <PhoneInput
                                id="ship-phone"
                                value={shipPhone}
                                onChange={(next) => {
                                  setShipPhone(next);
                                  const n = regCascadeAddr;
                                  setRunnerShippingAddress(
                                    `${shipRecipient} (${next}) — ${n.address}, ต.${n.subdistrict} อ.${n.district} จ.${n.province} ${n.postalCode}`.trim()
                                  );
                                }}
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="ship-recipient">{<RequiredFieldText text={tx("ชื่อผู้รับ *")} />}</label>
                              <input
                                id="ship-recipient"
                                type="text"
                                value={shipRecipient}
                                onChange={(e) => {
                                  setShipRecipient(e.target.value);
                                  const n = regCascadeAddr;
                                  setRunnerShippingAddress(
                                    `${e.target.value} (${shipPhone}) — ${n.address}, ต.${n.subdistrict} อ.${n.district} จ.${n.province} ${n.postalCode}`.trim()
                                  );
                                }}
                              />
                            </div>
                          </>
                        }
                        contactPhone={shipPhone}
                        contactEmail={currentUser?.contactEmail}
                        required
                        streetAddressLabel="ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)"
                        summaryFooter={
                          currentUser && (
                              <div className="ship-addr-save-row">
                                <span className="muted-inline">
                                  {tx('ไม่บันทึกก็ได้ ที่อยู่นี้จะใช้เฉพาะการสมัครครั้งนี้')}
                                </span>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  disabled={savingShipAddr}
                                  onClick={async () => {
                                    const a = regCascadeAddr;
                                    if (
                                      !shipRecipient.trim() ||
                                      !shipPhone.trim() ||
                                      !a.address.trim() ||
                                      !a.postalCode ||
                                      !a.province ||
                                      !a.district ||
                                      !a.subdistrict
                                    ) {
                                      setShipAddrNotice({
                                        tone: 'err',
                                        text: tx('กรอกชื่อผู้รับ เบอร์โทร และที่อยู่ให้ครบก่อนบันทึก'),
                                      });
                                      return;
                                    }
                                    const existing = currentUser.runnerProfile?.savedAddresses ?? [];
                                    const dup = existing.find(
                                      (x) =>
                                        x.address.trim() === a.address.trim() &&
                                        x.postalCode === a.postalCode &&
                                        x.subdistrict === a.subdistrict
                                    );
                                    const saved: RunnerSavedAddress = dup ?? {
                                      id: `addr-${Date.now().toString(36)}`,
                                      addressName: shipAddrName.trim() || txf('ที่อยู่จากการสมัคร {0}', selectedEvent.code),
                                      recipientName: shipRecipient.trim(),
                                      phone: shipPhone.trim(),
                                      address: a.address.trim(),
                                      province: a.province,
                                      district: a.district,
                                      subdistrict: a.subdistrict,
                                      postalCode: a.postalCode,
                                      country: a.country || 'Thailand',
                                      isDefault: existing.length === 0,
                                    };
                                    if (!dup) {
                                      setSavingShipAddr(true);
                                      const res = await onSaveProfilePatch?.({
                                        savedAddresses: [...existing, saved],
                                      });
                                      setSavingShipAddr(false);
                                      if (res && !res.ok) {
                                        setShipAddrNotice({
                                          tone: 'err',
                                          text: res.error ?? tx('บันทึกที่อยู่ไม่สำเร็จ กรุณาลองอีกครั้ง'),
                                        });
                                        return;
                                      }
                                    }
                                    // back to the address book with the new address picked
                                    setSelectedSavedAddrId(saved.id);
                                    setRunnerShippingAddress(
                                      `${saved.recipientName} (${saved.phone}) — ${saved.address}, ต.${saved.subdistrict} อ.${saved.district} จ.${saved.province} ${saved.postalCode}`
                                    );
                                    setShipAddrMode('saved');
                                    setShipAddrName('');
                                    setShipAddrNotice({
                                      tone: 'ok',
                                      text: dup
                                        ? tx('ที่อยู่นี้มีในสมุดแล้ว เลือกให้แล้ว')
                                        : tx('บันทึกลงสมุดที่อยู่แล้ว และเลือกเป็นที่อยู่จัดส่ง'),
                                    });
                                  }}
                                >
                                  {savingShipAddr ? tx('กำลังบันทึก…') : tx('บันทึกลงสมุดที่อยู่')}
                                </button>
                              </div>
                          )
                        }
                        value={regCascadeAddr}
                        onChange={(next) => {
                          setRegCascadeAddr(next);
                          const place =
                            next.country === 'Thailand'
                              ? `${next.address}, ต.${next.subdistrict} อ.${next.district} จ.${next.province} ${next.postalCode}`
                              : `${next.address}, ${next.subdistrict}, ${next.district}, ${next.province} ${next.postalCode} (${next.country})`;
                          setRunnerShippingAddress(
                            `${shipRecipient} (${shipPhone}) — ${place}`.trim()
                          );
                        }}
                      />
                    </>
                  )}
                </div>
                )}

                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(hasSouvenirs ? 4 : 3)}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary reg-next-pill-btn"
                    onClick={() => setRegStep(6)}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: สรุป — ตรวจข้อมูลทั้งฟอร์มก่อนชำระเงิน */}
            {regStep === 6 && activeCategory && (() => {
              const tier = getCurrentTier(activeCategory);
              const quote = calculateFeeQuote(tier.priceSatang, selectedEvent.feeBearerPolicy);
              const addonSatang = addonSatangTotal;
              const picked = registrationOptions.find((o) => o.optionId === currentPickedOptionId);
              const idDigits = regIdNumber.replace(/\s/g, '');
              const answerRows = (selectedEvent.customFields ?? [])
                .filter((f) => !isContentField(f) && fieldShown(f, customAnswers, { raceDistance: activeCategory.code, shirtSize }))
                .map((f) => {
                const val = customAnswers[f.id] ?? f.defaultValue;
                return {
                  label: tx(f.label),
                  value:
                    typeof val === 'boolean' ? (val ? tx('ใช่') : tx('ไม่ใช่')) : tx(answerText(f, val).trim()),
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
                      value: `${tx(activeCategory.name)} · ${tx('ปล่อยตัว')} ${activeCategory.startTimeLocal} ${tx('น.')}`,
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
                      value: [`${regFirstNameTh} ${regLastNameTh}`.trim(), regNicknameTh.trim() ? `(${regNicknameTh.trim()})` : '']
                        .filter(Boolean)
                        .join(' '),
                    },
                    { label: tx('ชื่อภาษาอังกฤษ'), value: `${regFirstNameEn} ${regLastNameEn}`.trim() },
                    { label: tx('วันเกิด · เพศ'), value: [regDob, tx(regGender)].filter(Boolean).join(' · ') },
                    { label: tx('เบอร์โทร'), value: displayPhone(regPhone) },
                    {
                      label: regIdType === 'passport' ? tx('หนังสือเดินทาง') : tx('เลขบัตรประชาชน'),
                      value: idDigits ? `•••• ${idDigits.slice(-4)}` : '',
                    },
                    { label: tx('ผู้ติดต่อฉุกเฉิน'), value: tx(emergencyContactText.trim()) },
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
                      value:
                        kitDeliveryOption === 'postal'
                          ? tx('จัดส่งทางไปรษณีย์')
                          : tx('รับเองที่หน้างาน (QR Check-in)'),
                    },
                    ...(kitDeliveryOption === 'postal'
                      ? [{ label: tx('ส่งถึง'), value: tx(runnerShippingAddress.trim()) }]
                      : []),
                  ],
                },
              ];
              const ledger: ReviewLedgerGroup[] = [
                {
                  key: 'entry',
                  lines: [
                    {
                      label: `${tx('ค่าสมัคร')} ${tx(activeCategory.name)} (${tx(tier.label)})`,
                      sub: `${tx(shirtStyleName(shirtStyle))} · ${tx('ไซส์')} ${shirtSize}`,
                      satang: quote.baseSatang,
                    },
                    {
                      label: `${tx('ค่าบริการระบบ')} (${feePolicyLabel(selectedEvent.feeBearerPolicy)})`,
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
                    regShipQuote.kitSatang > 0
                      ? [
                          {
                            label: tx('ค่าจัดส่งชุดแข่ง (ของที่ระลึกจากผู้จัดส่งรวมกล่องนี้)'),
                            satang: regShipQuote.kitSatang,
                          },
                          ...regShipQuote.sellers.map((x) => ({
                            label: txf('ค่าจัดส่งของที่ระลึก ({0})', tx(x.seller)),
                            satang: x.satang,
                          })),
                        ]
                      : [],
                },
              ];
              return (
                <div className="reg-step-body">
                  <h2 className="reg-step-accent-heading">{tx('ตรวจข้อมูลก่อนชำระเงิน')}</h2>
                  <p className="muted-block">
                    {tx('ตรวจทุกส่วนให้ถูกต้อง ถ้าต้องการเปลี่ยน กด "แก้ไข" เพื่อกลับไปขั้นนั้น')}
                  </p>
                  <RegistrationSummary
                    sections={sections}
                    ledger={ledger}
                    totalSatang={quote.runnerNetPaySatang + addonSatang + regShipQuote.totalSatang}
                    onEdit={(st) => setRegStep(st as RegStep)}
                    action={{ label: 'ไปชำระเงิน', onClick: () => setRegStep(7) }}
                  />
                  <div className="reg-step-footer-between">
                    <button type="button" className="btn-secondary" onClick={() => setRegStep(5)}>
                      {tx('ย้อนกลับ')}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* STEP 7: ชำระเงิน — ยอดสุทธิ ช่องทางชำระ และยอมรับกติกา */}
            {regStep === 7 && activeCategory && (
              <form
                onSubmit={handleRegistrationSubmit}
                className="reg-step-body"
              >
                <h2 className="reg-step-accent-heading">
                  {tx("ชำระเงินและยืนยันการสมัคร")}
                </h2>

                {(() => {
                  const tier = getCurrentTier(activeCategory);
                  const quote = calculateFeeQuote(
                    tier.priceSatang,
                    selectedEvent.feeBearerPolicy
                  );
                  const addonSatang = addonSatangTotal;
                  const grandTotal = quote.runnerNetPaySatang + addonSatang + regShipQuote.totalSatang;

                  return (
                    <div className="price-breakdown-box reg-pay-total-box">
                      <div className="breakdown-total">
                        <strong>{tx("ยอดชำระสุทธิทั้งหมด")}</strong>
                        <strong className="mono-num text-vermilion">
                          {formatThb(grandTotal, true)}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <PaymentMethodPicker name="reg-a-pay" value={paymentChannel} onChange={setPaymentChannel} />

                <RegistrationTerms
                  event={selectedEvent}
                  organization={org}
                  acceptRules={acceptedRules}
                  onAcceptRules={setAcceptedRules}
                  acceptPayment={acceptedPayTerms}
                  onAcceptPayment={setAcceptedPayTerms}
                />

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

                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(6)}
                    disabled={submitting}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <div className="cta-inline-row">
                    <button type="submit" className="btn-primary" disabled={submitting}>
                      {tx("ชำระเงินและยืนยันการสมัครทันที")}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 8: สำเร็จ — หน้าแยก ไม่มีแถบขั้นตอน ข้อมูลอยู่กลางจอ */}
            {regStep === 8 && createdResult && (
              <RegistrationDone
                title={
                  createdResult.reg.registrationStatus === 'confirmed'
                    ? tx('สมัครวิ่งและชำระเงินสำเร็จ')
                    : tx('สร้างใบจองโควตาสำเร็จ (รอผลชำระเงินภายใน 15 นาที)')
                }
                subtitle={
                  <>
                    {tx('บันทึกใบสมัครด้วยฟอร์มเวอร์ชัน')}{' '}
                    <span className="mono-code">{selectedEvent.publishedFormVersion ?? 'v1.2-published'}</span>{' '}
                    {tx('เรียบร้อยแล้ว')}
                  </>
                }
                items={[
                  { label: tx('รหัสใบสมัครวิ่ง'), value: tx(createdResult.reg.regCode), mono: true },
                  { label: tx('ผู้เข้าแข่งขัน'), value: tx(createdResult.reg.participantNameTh) },
                  ...(activeCategory ? [{ label: tx('ระยะ'), value: tx(activeCategory.name) }] : []),
                  { label: tx('เสื้อตามสิทธิ์สมัคร'), value: `${tx('ไซส์')} ${tx(createdResult.reg.shirtSize)}` },
                  { label: tx('QR Token รับอุปกรณ์'), value: tx(createdResult.reg.qrCheckInToken), mono: true },
                  ...(createdResult.addonOrders ?? []).map((o) => ({
                    label: `${tx(o.productNameTh)}${o.variantSize !== '-' ? ` · ${o.variantSize}` : ''} × ${o.quantity}`,
                    value: o.merchOrderCode,
                    mono: true,
                  })),
                  {
                    label: tx('ยอดค่าสมัครสุทธิ'),
                    value: formatThb(createdResult.reg.snapshotTotalChargedSatang, true),
                    accent: true,
                  },
                ]}
              >
                <button type="button" className="btn-primary" onClick={() => onNavigate('my_orders', null)}>
                  {tx('ไปหน้าบัตรวิ่งและคำสั่งซื้อของฉัน')}
                </button>
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
            )}
          </section>
        </div>
      </main>
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
                    <ProductArt kind={souvenirArt(prd.categoryLabel, prd.nameTh)} className="sf-art-svg" />
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

            {/* MODE B: 3-STEP RACE REGISTRATION WIZARD */}
            {showRegForm && detailTab === 'register' && (
              <section className="clean-panel">
                {selectedEvent.status !== 'published' ? (
                  <div className="empty-state-box">
                    <h2>{tx("งานวิ่งนี้ไม่ได้เปิดรับสมัครในขณะนี้")}</h2>
                    <p>
                      {tx("คุณสามารถกลับไปดูรายละเอียดกำหนดการ ผลการแข่งขัน อัลบั้มภาพหลังงาน หรือเลือกซื้อสินค้าที่ระลึกในร้านค้าของงานได้")}
                    </p>
                    <div className="cta-inline-row">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setShowRegForm(false);
                          setDetailTab('info_results');
                        }}
                      >
                        {tx("ดูรายละเอียดงานและผลการแข่งขัน")}
                      </button>
                      {selectedEvent.products.length > 0 && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setShowRegForm(false);
                            setDetailTab('storefront');
                          }}
                        >
                          {tx("เปิดร้านค้าของงาน")}
                        </button>
                      )}
                    </div>
                  </div>
                ) : createdResult ? (
                  <div className="registration-complete-view" role="status">
                    <div className="complete-icon-badge">
                      <IconCheckCircle size={28} />
                    </div>
                    <h2>
                      {createdResult.reg.registrationStatus === 'confirmed'
                        ? tx("ยืนยันการสมัครวิ่งเรียบร้อยแล้ว")
                        : tx("กันโควตาชั่วคราวแล้ว (รอชำระเงินภายใน 30 นาที)")}
                    </h2>
                    <p className="muted-block">
                      {tx("ใบสมัคร")}{' '}
                      <strong className="mono-code">
                        {tx(createdResult.reg.regCode)}
                      </strong>
                      {createdResult.addonOrder && (
                        <>
                          {' '}
                          {tx("และคำสั่งซื้อสินค้าเพิ่ม")}{' '}
                          <strong className="mono-code">
                            {tx(createdResult.addonOrder.merchOrderCode)}
                          </strong>
                        </>
                      )}{' '}
                      {tx("ได้รับการบันทึกในบัญชีของคุณแล้ว สามารถตรวจสอบสถานะและ QR รับอุปกรณ์ได้ในหน้าบัตรวิ่งของฉัน")}
                    </p>

                    <div className="receipt-summary-box">
                      <div>
                        <span className="muted-inline">{tx("ผู้เข้าแข่งขัน")}</span>
                        <strong>{tx(createdResult.reg.participantNameTh)}</strong>
                      </div>
                      <div>
                        <span className="muted-inline">{tx("เสื้อตามสิทธิ์สมัคร")}</span>
                        <strong>{tx("ไซส์")} {tx(createdResult.reg.shirtSize)}</strong>
                      </div>
                      <div>
                        <span className="muted-inline">{tx("QR Token รับ BIB")}</span>
                        <strong className="mono-code">
                          {tx(createdResult.reg.qrCheckInToken)}
                        </strong>
                      </div>
                      <div>
                        <span className="muted-inline">{tx("ยอดค่าสมัครสุทธิ")}</span>
                        <strong className="mono-num text-vermilion">
                          {formatThb(
                            createdResult.reg.snapshotTotalChargedSatang,
                            true
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="cta-inline-row">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onNavigate('my_orders', null)}
                      >
                        {tx("ไปหน้าบัตรวิ่งและคำสั่งซื้อของฉัน")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setCreatedResult(null);
                          setRegStep(1);
                        }}
                      >
                        {tx("สมัครเพิ่มอีกท่าน")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={handleRegistrationSubmit}
                    className="wizard-stack"
                  >
                    <div className="wizard-steps-indicator">
                      <button
                        type="button"
                        className={`step-pill ${
                          regStep === 1 ? 'current' : 'done'
                        }`}
                        onClick={() => setRegStep(1)}
                      >
                        1.{' '}
                        {registrationSteps.find(
                          (s) => s.key === 'step_distance_shirt'
                        )?.titleTh ?? tx("เลือกระยะทาง & เสื้อ")}
                      </button>
                      <button
                        type="button"
                        className={`step-pill ${
                          regStep === 2
                            ? 'current'
                            : regStep > 2
                            ? 'done'
                            : ''
                        }`}
                        onClick={() => setRegStep(2)}
                      >
                        2.{' '}
                        {registrationSteps.find(
                          (s) => s.key === 'step_runner_info'
                        )?.titleTh ?? tx("ข้อมูลผู้สมัคร & คำถามเฉพาะงาน")}
                      </button>
                      <button
                        type="button"
                        className={`step-pill ${regStep === 3 ? 'current' : ''}`}
                        onClick={() => setRegStep(3)}
                      >
                        3.{' '}
                        {registrationSteps.find(
                          (s) => s.key === 'step_review_payment'
                        )?.titleTh ?? tx("สรุปยอดแยกรายการ & ยืนยัน")}
                      </button>
                    </div>

                {regStep === 1 && activeCategory && (
                  <div className="wizard-pane">
                    <h2>{tx("เลือกระยะทาง เสื้อตามสิทธิ์ และสินค้าซื้อเพิ่ม (ไม่บังคับ)")}</h2>
                    <p className="muted-block">
                      {tx("นโยบายค่าบริการงานนี้:")}{' '}
                      <strong>{feePolicyLabel(selectedEvent.feeBearerPolicy)}</strong>
                    </p>

                    <div className="distance-choice-grid">
                      {selectedEvent.categories.map((cat) => {
                        const tier = getCurrentTier(cat);
                        const quote = calculateFeeQuote(
                          tier.priceSatang,
                          selectedEvent.feeBearerPolicy
                        );
                        const left = getCategoryOpenSeats(
                          selectedEvent.id,
                          cat
                        );
                        const isPicked = activeCategory.id === cat.id;

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            className={`distance-option-card ${
                              isPicked ? 'selected' : ''
                            }`}
                            onClick={() => setSelectedCatId(cat.id)}
                          >
                            <div className="dist-opt-top">
                              <span
                                className={`category-bib-chip tone-${cat.colorTag}`}
                              >
                                <strong>{tx(cat.code)}</strong>
                              </span>
                              <span className="mono-num muted-inline">
                                {tx("ว่าง ")} {tx(left)}/{tx(cat.categoryQuota)}
                              </span>
                            </div>
                            <strong>{tx(cat.name)}</strong>
                            <span className="muted-inline mono-num">
                              {tx("ปล่อยตัว ")} {tx(cat.startTimeLocal)} {tx(" น. · Cut-off")}{' '}
                              {tx(cat.cutoffHours)} {tx(" ชม.")}
                            </span>
                            {formatAgeLimit(cat) && (
                              <span className="muted-inline">{formatAgeLimit(cat)}</span>
                            )}
                            <div className="dist-opt-price">
                              <strong className="mono-num">
                                {formatThb(quote.runnerNetPaySatang, true)}
                              </strong>
                              <small className="muted-inline">
                                {tx("ช่วง ")} {tx(tier.label)} {tx(" (ป้าย")}{' '}
                                <span className="mono-num">
                                  {formatThb(tier.priceSatang)}
                                </span>
                                )
                              </small>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="shirt-picker-block">
                      <h3>{tx("ขนาดเสื้อแข่งขันที่รวมในแพ็กเกจสมัครแล้ว")}</h3>
                      <div className="size-pill-row">
                        {selectedEvent.shirtStocks
                          .filter((s) => s.total > 0)
                          .map((st) => {
                            const rem = Math.max(
                              0,
                              st.total - st.reservedOrConfirmed
                            );
                            return (
                              <button
                                key={st.size}
                                type="button"
                                disabled={rem <= 0}
                                className={`size-choice-btn ${
                                  shirtSize === st.size ? 'selected' : ''
                                }`}
                                onClick={() => setShirtSize(st.size)}
                              >
                                <strong>{tx("ไซส์")} {tx(st.size)}</strong>
                                <span className="mono-num">{tx("เหลือ")} {tx(rem)}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {selectedEvent.products.length > 0 && (
                      <div className="addon-box">
                        <h3>{tx("ซื้อสินค้าที่ระลึกเพิ่มพร้อมการสมัคร (ทางเลือก — แยกรายการจากค่าสมัคร)")}</h3>
                        <div className="form-grid-2">
                          <div className="form-row">
                            <label htmlFor="addon-sel">{tx("เลือกรายการซื้อเพิ่ม")}</label>
                            <select
                              id="addon-sel"
                              value={includeAddonId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setIncludeAddonId(val);
                                const found = selectedEvent.products.find(
                                  (p) => p.id === val
                                );
                                if (found) {
                                  setAddonSize(found.availableSizes[0] ?? 'M');
                                }
                              }}
                            >
                              <option value="none">
                                {tx("ไม่ซื้อสินค้าเพิ่ม (รับเฉพาะสิทธิ์ตามแพ็กเกจสมัคร)")}
                              </option>
                              {selectedEvent.products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  + {tx(p.nameTh)} ({formatThb(p.priceSatang)})
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedAddonProduct && (
                            <div className="form-row">
                              <label htmlFor="addon-sz">{tx("ขนาดสินค้าซื้อเพิ่ม")}</label>
                              <select
                                id="addon-sz"
                                value={addonSize}
                                onChange={(e) => setAddonSize(e.target.value)}
                              >
                                {selectedAddonProduct.availableSizes.map((s) => (
                                  <option key={s} value={s}>
                                    {tx(s)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="wizard-nav-row">
                      <span className="muted-inline">
                        {tx("ระยะที่เลือก: ")} <strong>{tx(activeCategory.name)}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setRegStep(2)}
                      >
                        <span>{tx("ถัดไป: ข้อมูลผู้สมัคร")}</span>
                        <IconArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {regStep === 2 && (
                  <div className="wizard-pane">
                    <h2>{tx("กรอกข้อมูลผู้เข้าแข่งขันและยอมรับกติกางาน")}</h2>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={registerForSelf}
                        onChange={(e) => setRegisterForSelf(e.target.checked)}
                      />
                      <span>{tx("สมัครให้ตนเอง (ผู้ซื้อและผู้เข้าแข่งขันเป็นบุคคลเดียวกัน)")}</span>
                    </label>

                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="reg-b-name">{tx("ชื่อ-นามสกุลผู้ซื้อคำสั่งซื้อ")}</label>
                        <input
                          id="reg-b-name"
                          type="text"
                          value={buyerName}
                          onChange={(e) => {
                            setBuyerName(e.target.value);
                            if (registerForSelf) {
                              setParticipantNameTh(e.target.value);
                            }
                          }}
                          required
                        />
                      </div>

                      {!registerForSelf && (
                        <div className="form-row">
                          <label htmlFor="reg-p-name">
                            {tx("ชื่อ-นามสกุลผู้เข้าแข่งขันจริง")}
                          </label>
                          <input
                            id="reg-p-name"
                            type="text"
                            value={participantNameTh}
                            onChange={(e) =>
                              setParticipantNameTh(e.target.value)
                            }
                            required
                          />
                        </div>
                      )}

                      <div className="form-row">
                        <label htmlFor="reg-p-en">{tx("ชื่อภาษาอังกฤษบนป้าย BIB")}</label>
                        <input
                          id="reg-p-en"
                          type="text"
                          value={participantNameEn}
                          onChange={(e) => setParticipantNameEn(e.target.value)}
                        />
                      </div>
                    </div>

                    <RunnerCustomFieldsInputs
                      fields={selectedEvent.customFields}
                      answers={customAnswers}
                      raceDistanceCode={activeCategory?.code}
                      shirtSize={shirtSize}
                      publishedFormVersion={
                        selectedEvent.publishedFormVersion ?? 'v1.2-published'
                      }
                      onAnswerChange={(fieldId, val) => {
                        setStep2Error(null);
                        setCustomAnswers((prev) => ({
                          ...prev,
                          [fieldId]: val,
                        }));
                      }}
                    />

                    {step2Error && (
                      <div className="error-callout" role="alert">
                        <IconAlert size={16} />
                        <span>{tx(step2Error)}</span>
                      </div>
                    )}

                    <div className="consent-group">
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={acceptedRules}
                          onChange={(e) => setAcceptedRules(e.target.checked)}
                        />
                        <span>
                          <strong>{tx("[จำเป็น]")}</strong> {tx(" ยอมรับกติกาการแข่งขันและเงื่อนไขความปลอดภัยฉบับ")}{' '}
                          <span className="mono-code">
                            {tx(selectedEvent.rulesVersion)}
                          </span>
                        </span>
                      </label>

                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={marketingConsent}
                          onChange={(e) =>
                            setMarketingConsent(e.target.checked)
                          }
                        />
                        <span>
                          {tx("[ไม่บังคับ] ยินยอมรับข่าวสารประชาสัมพันธ์จากผู้จัดงาน")}
                        </span>
                      </label>
                    </div>

                    <div className="wizard-nav-row">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setRegStep(1)}
                      >
                        {tx("ย้อนกลับ")}
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          const allProblems = validateAnswers(selectedEvent.customFields ?? [], customAnswers, {
                            raceDistance: activeCategory?.code,
                            shirtSize,
                          });
                          setFormErrors(allProblems);
                          const firstProblem = Object.values(allProblems)[0];
                          if (firstProblem) {
                            setStep2Error(firstProblem);
                            return;
                          }
                          setStep2Error(null);
                          setRegStep(3);
                        }}
                      >
                        <span>{tx("ถัดไป: ตรวจสอบยอดรวม")}</span>
                        <IconArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {regStep === 3 && activeCategory && (
                  <div className="wizard-pane">
                    <h2>{tx("สรุปยอดชำระแยกรายการก่อนยืนยัน")}</h2>
                    {(() => {
                      const tier = getCurrentTier(activeCategory);
                      const quote = calculateFeeQuote(
                        tier.priceSatang,
                        selectedEvent.feeBearerPolicy
                      );
                      const addonSatang = addonSatangTotal;
                      const grandTotal = quote.runnerNetPaySatang + addonSatang + regShipQuote.totalSatang;

                      return (
                        <div className="price-breakdown-box">
                          <div className="breakdown-line">
                            <span>
                              {tx("ค่าสมัครวิ่ง ")} {tx(activeCategory.name)} ({tx(tier.label)}{tx(") · เสื้อสิทธิ์สมัครไซส์ ")} {tx(shirtSize)}
                            </span>
                            <span className="mono-num">
                              {formatThb(quote.baseSatang, true)}
                            </span>
                          </div>
                          <div className="breakdown-line">
                            <span>{tx("ค่าบริการแพลตฟอร์มฝั่งผู้สมัคร")}</span>
                            <span className="mono-num">
                              {formatThb(quote.runnerFeeSatang, true)}
                            </span>
                          </div>
                          {selectedAddonProduct && (
                            <div className="breakdown-line">
                              <span>
                                {tx("สินค้าซื้อเพิ่ม: ")} {tx(selectedAddonProduct.nameTh)} (
                                {tx(addonSize)}{tx(") — รับหน้างาน")}
                              </span>
                              <span className="mono-num">
                                {formatThb(addonSatang, true)}
                              </span>
                            </div>
                          )}
                          <div className="breakdown-line breakdown-total">
                            <strong>{tx("ยอดชำระสุทธิรวมทั้งหมด")}</strong>
                            <strong className="mono-num text-vermilion">
                              {formatThb(grandTotal, true)}
                            </strong>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="form-row">
                      <label>{tx("ช่องทางชำระเงิน")}</label>
                      <div className="pill-tabs-bar" role="radiogroup" aria-label={tx("เลือกช่องทางชำระเงิน")}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={paymentChannel === 'promptpay'}
                          className={`pill-tab ${
                            paymentChannel === 'promptpay' ? 'active' : ''
                          }`}
                          onClick={() => setPaymentChannel('promptpay')}
                        >
                          {tx("QR PromptPay (สแกนจ่ายทันที)")}
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={paymentChannel === 'card'}
                          className={`pill-tab ${
                            paymentChannel === 'card' ? 'active' : ''
                          }`}
                          onClick={() => setPaymentChannel('card')}
                        >
                          {tx("บัตรเครดิต / เดบิต")}
                        </button>
                      </div>
                    </div>

                    {checkoutError && (
                      <div className="error-callout" role="alert">
                        <IconAlert size={16} />
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
                                ? tx("ไปหน้าเพิ่มและยืนยันอีเมล")
                                : tx("ไปหน้าเพิ่มอีเมล")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="wizard-nav-row">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setRegStep(2)}
                      >
                        {tx("ย้อนกลับ")}
                      </button>
                      {!currentUser ? (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() =>
                            onRequireLoginWithIntent({
                              surface: 'events',
                              eventId: selectedEvent.id,
                              eventTab: 'register',
                              label: `ยืนยันการสมัครงาน ${selectedEvent.titleTh}`,
                            })
                          }
                        >
                          <IconLock size={15} />
                          <span>{tx("เข้าสู่ระบบเพื่อดำเนินการชำระเงิน")}</span>
                        </button>
                      ) : (
                        <div className="cta-inline-row">
                          {submitting && (
                            <span className="reg-submit-wait" role="status" aria-live="polite">
                              <MascotSprite pose="run" size={30} />
                              <span>{tx("กำลังกันที่และยืนยันคำสั่งซื้อ…")}</span>
                            </span>
                          )}
                          <button type="submit" className="btn-cta-accent" disabled={submitting}>
                            <IconCheckCircle size={16} />
                            <span>
                              {tx("ชำระเงินด้วย")}{' '}
                              {paymentChannel === 'promptpay'
                                ? 'PromptPay'
                                : tx("บัตร")}
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            )}
          </section>
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
                        {txf('ค่าสมัคร {0} ระยะ', selectedEvent.categories.length)}
                      </strong>
                    </div>
                    <div className="muted-inline">
                      {selectedEvent.categories.map((c) => tx(c.code)).join(' · ')}
                    </div>
                    <div className="sticky-price-row">
                      <div>
                        <span className="muted-inline">{tx('ราคาสุทธิเริ่มต้น')}</span>
                        <div className="muted-inline">
                          {selectedEvent.feeBearerPolicy === 'organizer_absorbs'
                            ? tx("ผู้จัดรับภาระค่าบริการแทนนักวิ่ง")
                            : tx("รวมค่าบริการแพลตฟอร์มแล้ว")}
                        </div>
                      </div>
                      <strong className="sticky-price-big mono-num text-vermilion">
                        {formatThb(priceFromSatang, true)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {cardCfg.showShortcuts !== false && (
                <SectionShortcuts
                  blocks={resolveDetailBlocksDeep(shownPage)}
                  spy={isEditorialView}
                  pageKey={selectedEvent.id}
                  onJump={jumpToEditorialSection}
                />
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
              onClick={() => setDistanceFilter(v)}
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
                onClick={() => setQuickFilter(k)}
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
                    {isTotalQuotaEnabled(ev) ? (
                      <small className="mono-num">
                        {txf("ว่าง {0}/{1} สิทธิ์", openSeats, ev.totalEventQuota)}
                      </small>
                    ) : openSeats <= 0 ? (
                      <small>{tx("โควตาเต็มแล้ว")}</small>
                    ) : null}
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
