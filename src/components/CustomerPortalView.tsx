import { RequiredFieldText } from './RequiredFieldText';
import React, { useMemo, useState } from 'react';
import {
  EventProduct,
  MerchOrderRecord,
  Organization,
  PlatformProfileConfig,
  ProductionInquiry,
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
import { DateOfBirthInput } from './DateOfBirthInput';
import {
  CascadingAddressValue,
  ThaiPostalAddressSelector,
} from './ThaiPostalAddressSelector';
import {
  maskIdNumber,
  sanitizeEnglishNameInput,
  sanitizeThaiIdOrPassport,
  sanitizeThaiNameInput,
} from '../utils/dateFormat';
import {
  EventStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  RegStatusBadge,
} from './StatusBadges';
import {
  evaluateConditionRule,
  RunnerCustomFieldsInputs,
} from './PublicEventView';

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
export type CustomerSubView =
  | 'directory'
  | 'event_detail'
  | 'event_register'
  | 'my_orders'
  | 'custom_production';

interface CustomerPortalViewProps {
  subView: CustomerSubView;
  selectedEventId: string | null;
  initialEventTab: 'register' | 'storefront' | 'info_results';
  events: RaceEvent[];
  organizations: Organization[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  productionInquiries: ProductionInquiry[];
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
  onSaveProfilePatch?: (patch: Partial<RunnerProfileData>) => void;
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
    simulateImmediateWebhook: boolean;
    addonProduct?: EventProduct | null;
    addonSize?: string;
    customAnswers?: Record<string, string | boolean>;
  }) => { reg: RegistrationRecord; addonOrder?: MerchOrderRecord };
  onCreateStandaloneMerchOrder: (payload: {
    eventId: string;
    product: EventProduct;
    variantSize: string;
    quantity: number;
    buyerName: string;
    deliveryMethod: 'pickup_at_expo' | 'postal_shipping';
    shippingAddress?: string;
    linkedRegistrationCode?: string;
  }) => MerchOrderRecord;
  onUpdateRunnerShirtSize: (
    regId: string,
    newSize: ShirtSizeCode
  ) => void;
  onCompletePendingPayment: (regId: string) => void;
  onCreateClubProductionInquiry: (payload: {
    requesterName: string;
    requesterContact: string;
    itemType: ProductionInquiry['itemType'];
    estimatedQty: number;
    targetDeliveryDate: string;
  }) => ProductionInquiry;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  subView,
  selectedEventId,
  initialEventTab,
  events,
  organizations,
  registrations,
  merchOrders,
  productionInquiries,
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
  onCreateStandaloneMerchOrder,
  onUpdateRunnerShirtSize,
  onCompletePendingPayment,
  onCreateClubProductionInquiry,
}) => {
  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'open' | 'has_shop' | 'completed'
  >('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Event detail & step-by-step registration state (6-step dedicated page)
  const [detailTab, setDetailTab] = useState<
    'register' | 'storefront' | 'info_results'
  >(initialEventTab);
  const [showRegForm, setShowRegForm] = useState(false);
  const [regStep, setRegStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedDivisionOption, setSelectedDivisionOption] =
    useState<string>('');
  const [kitDeliveryOption, setKitDeliveryOption] = useState<
    'expo_pickup' | 'postal'
  >('expo_pickup');
  const [runnerShippingAddress, setRunnerShippingAddress] = useState(
    '199/8 ถ.ห้วยแก้ว ต.สุเทพ อ.เมือง จ.เชียงใหม่ 50200'
  );
  const [emergencyContactText, setEmergencyContactText] = useState(
    'วีระ วัฒนากูล (089-110-2211)'
  );
  const [shirtSize, setShirtSize] = useState<ShirtSizeCode>('M');
  const [includeAddonId, setIncludeAddonId] = useState<string>('none');
  const [addonSize, setAddonSize] = useState<string>('M');
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
  const [shipRecipient, setShipRecipient] = useState(
    currentUser?.fullNameTh ?? ''
  );
  const [shipPhone, setShipPhone] = useState(
    currentUser?.runnerProfile?.phone ?? ''
  );
  const [saveShipAddrToProfile, setSaveShipAddrToProfile] = useState(true);
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
  const [customAnswers, setCustomAnswers] = useState<
    Record<string, string | boolean>
  >({});
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [paymentChannel, setPaymentChannel] = useState<'promptpay' | 'card'>(
    'promptpay'
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<{
    reg: RegistrationRecord;
    addonOrder?: MerchOrderRecord;
  } | null>(null);

  // Storefront state (General customer without registration)
  const [activeProductId, setActiveProductId] = useState<string>('');
  const [merchSize, setMerchSize] = useState<string>('M');
  const [merchQty, setMerchQty] = useState<number>(1);
  const [deliveryMethod, setDeliveryMethod] = useState<
    'pickup_at_expo' | 'postal_shipping'
  >('pickup_at_expo');
  const [merchAddress, setMerchAddress] = useState(
    '199 ถ.นิมมานเหมินท์ อ.เมือง จ.เชียงใหม่ 50200'
  );
  const [linkedRegForMerch, setLinkedRegForMerch] = useState<string>('');
  const [createdMerchReceipt, setCreatedMerchReceipt] =
    useState<MerchOrderRecord | null>(null);

  // Club/Company custom production inquiry state (no race event needed)
  const [clubName, setClubName] = useState('');
  const [clubContact, setClubContact] = useState('');
  const [clubItemType, setClubItemType] = useState<
    ProductionInquiry['itemType']
  >('เสื้อแข่งขันและเสื้อที่ระลึก');
  const [clubQty, setClubQty] = useState<number>(150);
  const [clubDate, setClubDate] = useState('2027-01-20');
  const [createdClubRfq, setCreatedClubRfq] =
    useState<ProductionInquiry | null>(null);

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
    setEmergencyContactText(
      pt?.emergencyContactName
        ? [
            pt.emergencyContactName,
            pt.emergencyContactRelation ? `(${pt.emergencyContactRelation})` : '',
            pt.emergencyContactPhone ?? '',
          ]
            .filter(Boolean)
            .join(' ')
        : ''
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
      setEmergencyContactText(
        `${primaryContact.contactName} (${primaryContact.relationship}) ${primaryContact.phone}`
      );
    } else if (p?.emergencyContactName && p?.emergencyContactPhone) {
      setEmergencyContactText(
        `${p.emergencyContactName} (${p.emergencyContactPhone})`
      );
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

  const filteredEvents = useMemo(() => {
    return publicVisibleEvents.filter((ev) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesText =
        !q ||
        ev.titleTh.toLowerCase().includes(q) ||
        ev.titleEn.toLowerCase().includes(q) ||
        ev.province.toLowerCase().includes(q) ||
        ev.venue.toLowerCase().includes(q);

      const matchesQuick =
        quickFilter === 'all' ||
        (quickFilter === 'open' && ev.status === 'published') ||
        (quickFilter === 'has_shop' && ev.products.length > 0) ||
        (quickFilter === 'completed' && ev.status === 'completed');

      const matchesRegion =
        regionFilter === 'all' || ev.region === regionFilter;

      const matchesDist =
        distanceFilter === 'all' ||
        ev.categories.some((c) => {
          if (distanceFilter === '5k') return c.distanceKm <= 5.5;
          if (distanceFilter === '10k')
            return c.distanceKm > 5.5 && c.distanceKm <= 12;
          if (distanceFilter === '21k')
            return c.distanceKm >= 20 && c.distanceKm <= 22;
          if (distanceFilter === 'trail') return ev.raceType === 'Trail';
          return true;
        });

      return matchesText && matchesQuick && matchesRegion && matchesDist;
    });
  }, [
    publicVisibleEvents,
    searchQuery,
    quickFilter,
    regionFilter,
    distanceFilter,
  ]);

  const selectedEvent = useMemo(
    () => publicVisibleEvents.find((e) => e.id === selectedEventId) ?? null,
    [publicVisibleEvents, selectedEventId]
  );

  const activeCategory: RaceCategory | null = useMemo(() => {
    if (!selectedEvent) return null;
    return (
      selectedEvent.categories.find((c) => c.id === selectedCatId) ??
      selectedEvent.categories[0] ??
      null
    );
  }, [selectedEvent, selectedCatId]);

  // Age on the category's basis date and the matching age group (same rules as the server).
  const regAgeCheck = useMemo(
    () =>
      selectedEvent && activeCategory
        ? evaluateCategoryAge(selectedEvent, activeCategory, regDob, regGender)
        : null,
    [selectedEvent, activeCategory, regDob, regGender]
  );

  const activeProduct: EventProduct | null = useMemo(() => {
    if (!selectedEvent || selectedEvent.products.length === 0) return null;
    return (
      selectedEvent.products.find((p) => p.id === activeProductId) ??
      selectedEvent.products[0]
    );
  }, [selectedEvent, activeProductId]);

  const selectedAddonProduct: EventProduct | null = useMemo(() => {
    if (!selectedEvent || includeAddonId === 'none') return null;
    return (
      selectedEvent.products.find((p) => p.id === includeAddonId) ?? null
    );
  }, [selectedEvent, includeAddonId]);

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

  const getEventOpenSeats = (ev: RaceEvent) => {
    const used = registrations.filter(
      (r) =>
        r.eventId === ev.id &&
        (r.registrationStatus === 'confirmed' ||
          r.registrationStatus === 'pending_payment')
    ).length;
    return Math.max(0, ev.totalEventQuota - used);
  };

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

  const openEventPage = (
    ev: RaceEvent,
    tab: 'register' | 'storefront' | 'info_results' = 'info_results',
    prelinkRegCode = '',
    openWizardImmediately = false
  ) => {
    setSelectedCatId(ev.categories[0]?.id ?? '');
    setActiveProductId(ev.products[0]?.id ?? '');
    setMerchSize(ev.products[0]?.availableSizes[0] ?? 'M');
    setIncludeAddonId('none');
    setRegStep(1);
    setAcceptedRules(false);
    setCheckoutError(null);
    setCreatedResult(null);
    setCreatedMerchReceipt(null);
    setLinkedRegForMerch(prelinkRegCode);
    setDetailTab(tab);
    setShowRegForm(openWizardImmediately);
    onNavigate('event_detail', ev.id, tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitRegistrationOrder = (payImmediately: boolean) => {
    if (!selectedEvent || !activeCategory) return;

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
    if (!acceptedRules) {
      setCheckoutError(
        txf("กรุณาติ๊กยอมรับกติกาการแข่งขัน ({0}) ก่อนยืนยัน", selectedEvent.rulesVersion)
      );
      return;
    }

    const missingCustom = (selectedEvent.customFields ?? []).find((f) => {
      if (!f.required) return false;
      const isVisible = evaluateConditionRule(
        f.visibilityCondition,
        customAnswers,
        {
          raceDistance: activeCategory.code,
          shirtSize,
        }
      );
      if (!isVisible) return false;
      const val = customAnswers[f.id] ?? f.defaultValue;
      if (f.type === 'checkbox') return val !== true;
      return !String(val ?? '').trim();
    });
    if (missingCustom) {
      setCheckoutError(
        txf("กรุณากรอกข้อมูลเพิ่มเติมที่จำเป็น: \"{0}\" ในขั้นตอนที่ 2", missingCustom.label)
      );
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
    const res = onCreateRegistrationAndOptionalAddon({
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
      simulateImmediateWebhook: payImmediately,
      addonProduct: selectedAddonProduct,
      addonSize,
      customAnswers:
        (selectedEvent.customFields ?? []).length > 0
          ? customAnswers
          : undefined,
    });

    // Persist reusable data back to the Runner Profile
    const profilePatch: Partial<RunnerProfileData> = {};
    if (!registerForSelf) {
      const existing = prof?.savedParticipants ?? [];
      const cleanId = regIdNumber.trim();
      const match =
        existing.find((x) => x.id === selectedParticipantId) ??
        (cleanId ? existing.find((x) => x.idNumber === cleanId) : undefined) ??
        existing.find(
          (x) =>
            x.firstName === regFirstNameTh.trim() &&
            x.lastName === regLastNameTh.trim()
        );
      const emergParts = emergencyContactText.trim().match(/^(.*?)[\s(]*([0-9][0-9\-\s]{7,})\)?\s*$/);
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
        emergencyContactName: emergParts
          ? emergParts[1].trim()
          : emergencyContactText.trim() || undefined,
        emergencyContactPhone: emergParts ? emergParts[2].trim() : undefined,
        lastUsedAt: new Date().toISOString(),
      };
      profilePatch.savedParticipants = match
        ? existing.map((x) => (x.id === match.id ? participant : x))
        : [...existing, participant];
    }
    if (
      shipAddrMode === 'manual' &&
      saveShipAddrToProfile &&
      regCascadeAddr.address.trim()
    ) {
      const existingAddrs = prof?.savedAddresses ?? [];
      const isDup = existingAddrs.some(
        (a) =>
          a.address.trim() === regCascadeAddr.address.trim() &&
          a.postalCode === regCascadeAddr.postalCode &&
          a.subdistrict === regCascadeAddr.subdistrict
      );
      if (!isDup) {
        const newAddr: RunnerSavedAddress = {
          id: `addr-${Date.now()}`,
          addressName: txf('ที่อยู่จากการสมัคร {0}', selectedEvent.code),
          recipientName: shipRecipient.trim() || finalParticipant,
          phone: shipPhone.trim() || regPhone.trim() || prof?.phone || '',
          address: regCascadeAddr.address.trim(),
          province: regCascadeAddr.province,
          district: regCascadeAddr.district,
          subdistrict: regCascadeAddr.subdistrict,
          postalCode: regCascadeAddr.postalCode,
          country: regCascadeAddr.country || 'Thailand',
          isDefault: existingAddrs.length === 0,
        };
        profilePatch.savedAddresses = [...existingAddrs, newAddr];
      }
    }
    if (Object.keys(profilePatch).length > 0) {
      onSaveProfilePatch?.(profilePatch);
    }
    setCreatedResult(res);
    setRegStep(6);
  };

  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitRegistrationOrder(true);
  };

  const handleMerchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !activeProduct) return;

    if (!currentUser) {
      onRequireLoginWithIntent({
        surface: 'events',
        eventId: selectedEvent.id,
        eventTab: 'storefront',
        label: `สั่งซื้อสินค้าที่ระลึกงาน ${selectedEvent.titleTh}`,
      });
      return;
    }

    const receipt = onCreateStandaloneMerchOrder({
      eventId: selectedEvent.id,
      product: activeProduct,
      variantSize: merchSize,
      quantity: merchQty,
      buyerName: currentUser.fullNameTh,
      deliveryMethod:
        selectedEvent.status === 'completed'
          ? 'postal_shipping'
          : deliveryMethod,
      shippingAddress:
        selectedEvent.status === 'completed' ||
        deliveryMethod === 'postal_shipping'
          ? merchAddress.trim()
          : undefined,
      linkedRegistrationCode: linkedRegForMerch || undefined,
    });
    setCreatedMerchReceipt(receipt);
  };

  /* ================= SUBVIEW 4: CLUB / COMPANY CUSTOM PRODUCTION ================= */
  if (subView === 'custom_production') {
    return (
      <main className="customer-container">
        <div className="detail-back-bar">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => onNavigate('directory', null)}
          >
            <IconArrowLeft size={15} />
            <span>{tx("กลับหน้ารวมงานวิ่ง")}</span>
          </button>
        </div>

        <section className="clean-panel">
          <h1>{tx("บริการสั่งผลิตเสื้อวิ่งและเหรียญรางวัลสำหรับชมรม ทีม และองค์กร")}</h1>
          <p className="muted-block">
            {tx("ส่งความต้องการเพื่อขอใบเสนอราคาได้โดยไม่จำเป็นต้องเปิดรับสมัครงานวิ่งในระบบ (คำขอราคายังไม่ใช่คำสั่งเริ่มผลิตจริง จนกว่าจะยืนยันแบบ จำนวน ราคา และเงื่อนไขชำระ)")}
          </p>

          <form
            className="wizard-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const created = onCreateClubProductionInquiry({
                requesterName: clubName.trim(),
                requesterContact: clubContact.trim(),
                itemType: clubItemType,
                estimatedQty: clubQty,
                targetDeliveryDate: clubDate,
              });
              setCreatedClubRfq(created);
            }}
          >
            <div className="form-grid-2">
              <div className="form-row">
                <label htmlFor="clb-name">{tx("ชื่อชมรม / บริษัท / ผู้ติดต่อ")}</label>
                <input
                  id="clb-name"
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="clb-mail">{tx("อีเมลหรือเบอร์ติดต่อกลับ")}</label>
                <input
                  id="clb-mail"
                  type="text"
                  value={clubContact}
                  onChange={(e) => setClubContact(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-grid-3">
              <div className="form-row">
                <label htmlFor="clb-item">{tx("ประเภทสินค้าที่ต้องการสั่งผลิต")}</label>
                <select
                  id="clb-item"
                  value={clubItemType}
                  onChange={(e) =>
                    setClubItemType(
                      e.target.value as ProductionInquiry['itemType']
                    )
                  }
                >
                  <option value="เสื้อแข่งขันและเสื้อที่ระลึก">
                    {tx("เสื้อวิ่งชมรม / เสื้อกิจกรรมองค์กร")}
                  </option>
                  <option value="เหรียญรางวัลและสายคล้อง">
                    {tx("เหรียญที่ระลึกพร้อมสายคล้องพิมพ์ลาย")}
                  </option>
                  <option value="ชุดเสื้อพร้อมเหรียญครบวงจร">
                    {tx("ชุดเสื้อพร้อมเหรียญครบวงจร")}
                  </option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="clb-qty">{tx("จำนวนประมาณการ (ชิ้น)")}</label>
                <input
                  id="clb-qty"
                  type="text"
                  inputMode="numeric"
                  className="mono-num"
                  value={clubQty}
                  onChange={(e) =>
                    setClubQty(Math.max(10, Number(e.target.value) || 50))
                  }
                />
              </div>
              <div className="form-row">
                <label htmlFor="clb-date">{tx("วันที่ต้องการใช้งานสินค้า")}</label>
                <input
                  id="clb-date"
                  type="text"
                  className="mono-num"
                  value={clubDate}
                  onChange={(e) => setClubDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button type="submit" className="btn-primary">
                {tx("ส่งคำขอใบเสนอราคาสั่งผลิต")}
              </button>
            </div>

            {createdClubRfq && (
              <div className="success-callout" role="status">
                <IconCheckCircle size={18} />
                <div>
                  <strong>
                    {tx("บันทึกคำขอราคา ")} {tx(createdClubRfq.inquiryCode)} {tx(" เรียบร้อยแล้ว")}
                  </strong>
                  <p>
                    {tx("ทีมประสานงานจะตรวจสอบแบบและส่งใบเสนอราคาให้พิจารณาอนุมัติก่อนเริ่มผลิตจริง")}
                  </p>
                </div>
              </div>
            )}
          </form>

          {productionInquiries.filter((q) => q.contextType === 'club_or_company')
            .length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <h2>{tx("รายการคำขอราคาของชมรม/บริษัทที่ส่งแล้ว")}</h2>
              <div className="table-scroll">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>{tx("รหัสคำขอ")}</th>
                      <th>{tx("ผู้ขอ / ช่องทางติดต่อ")}</th>
                      <th>{tx("รายการ")}</th>
                      <th className="num-col">{tx("จำนวนประมาณการ")}</th>
                      <th>{tx("สถานะใบเสนอราคา")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionInquiries
                      .filter((q) => q.contextType === 'club_or_company')
                      .map((rfq) => (
                        <tr key={rfq.id}>
                          <td className="mono-code">{tx(rfq.inquiryCode)}</td>
                          <td>
                            <strong>{tx(rfq.requesterName)}</strong>
                            <div className="muted-inline">
                              {tx(rfq.requesterContact)}
                            </div>
                          </td>
                          <td>{tx(rfq.itemType)}</td>
                          <td className="num-col mono-num">
                            {tx(rfq.netQtyToProduce)} {tx(" ชิ้น")}
                          </td>
                          <td>
                            <span className="status-pill badge-amber">
                              <IconClock size={13} />
                              <span>{tx("รอทีมงานส่งใบเสนอราคา")}</span>
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  /* ================= SUBVIEW 3: MY TICKETS & MERCH ORDERS ================= */
  if (subView === 'my_orders') {
    return (
      <main className="customer-container">
        <div className="hub-header-bar">
          <div>
            <h1>{tx("บัตรวิ่งและคำสั่งซื้อสินค้าของฉัน")}</h1>
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
                    const canEditShirt =
                      ev &&
                      ev.status === 'published' &&
                      reg.registrationStatus === 'confirmed' &&
                      reg.fulfillmentStatus === 'ready';

                    return (
                      <article key={reg.id} className="runner-pass-item">
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

                            {canEditShirt && (
                              <div className="inline-shirt-editor">
                                <label htmlFor={`my-shirt-${reg.id}`}>
                                  {tx("แก้ขนาดเสื้อสิทธิ์สมัคร (ถึง ")} {tx(ev.editDeadlineDate)}):
                                </label>
                                <select
                                  id={`my-shirt-${reg.id}`}
                                  value={reg.shirtSize}
                                  onChange={(e) =>
                                    onUpdateRunnerShirtSize(
                                      reg.id,
                                      e.target.value
                                    )
                                  }
                                >
                                  {(ev?.shirtStocks ?? [])
                                    .filter(
                                      (st) =>
                                        st.total - st.reservedOrConfirmed > 0 ||
                                        st.size === reg.shirtSize
                                    )
                                    .map((st) => (
                                      <option key={st.size} value={st.size}>
                                        {tx("ไซส์ ")} {tx(st.size)}
                                      </option>
                                    ))}
                                </select>
                              </div>
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
    const stepLabels: { step: 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
      { step: 1, label: 'เริ่ม' },
      { step: 2, label: 'ข้อมูล' },
      { step: 3, label: 'สินค้า' },
      { step: 4, label: 'ที่อยู่' },
      { step: 5, label: 'ชำระเงิน' },
      { step: 6, label: 'สำเร็จ' },
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
          {/* LEFT POSTER COLUMN */}
          <aside
            className={`event-reg-poster-pane ${
              selectedEvent.coverImageUrl ? 'has-cover-photo' : 'has-cover-motif'
            }`}
            aria-label={tx("ข้อมูลงานวิ่งที่กำลังสมัคร")}
          >
            <div className="poster-cover-media" aria-hidden="true">
              <EventCoverMedia
                event={selectedEvent}
                className="poster-cover-img"
              />
              <div className="poster-cover-scrim" />
            </div>

            <div className="poster-top-copy">
              <p className="poster-org-name">
                {tx(org?.nameTh ?? "องค์กรผู้จัดงานวิ่ง RunEvent")}
              </p>
              <h1 className="poster-event-title">
                {selectedEvent.titleEn || selectedEvent.titleTh}
              </h1>
              <p className="poster-event-sub">{tx(selectedEvent.titleTh)}</p>
              <ul className="poster-meta-list">
                <li>
                  <IconCalendar size={14} />
                  <span className="mono-num">{tx(selectedEvent.eventDate)}</span>
                </li>
                <li>
                  <IconMapPin size={14} />
                  <span>
                    {tx(selectedEvent.venue)} · {tx(selectedEvent.province)}
                  </span>
                </li>
                {activeCategory && (
                  <li>
                    <IconFlag size={14} />
                    <span>
                      {tx(activeCategory.name)} ({tx(activeCategory.code)})
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {(selectedEvent.galleryImageUrls ?? []).length > 0 && (
              <div className="poster-gallery-strip" aria-label={tx("ภาพประกอบงานวิ่ง")}>
                {(selectedEvent.galleryImageUrls ?? []).slice(0, 3).map((src, i) => (
                  <img
                    key={`${src}-${i}`}
                    src={src}
                    alt={txf("{0} ภาพที่ {1}", selectedEvent.titleTh, i + 1)}
                    loading="lazy"
                    decoding="async"
                  />
                ))}
              </div>
            )}

            <div className="poster-bottom-bar">
              <button
                type="button"
                className="poster-back-btn"
                onClick={() =>
                  onNavigate('event_detail', selectedEvent.id, 'info_results')
                }
              >
                <IconArrowLeft size={15} />
                <span>{tx("กลับหน้ารายละเอียดงานวิ่ง")}</span>
              </button>
            </div>
          </aside>

          {/* RIGHT STEP-BY-STEP WIZARD COLUMN */}
          <section
            className="event-reg-wizard-pane"
            aria-label={tx("ขั้นตอนการสมัครเข้าร่วมงานวิ่ง")}
          >
            {/* 6-STEP CONNECTED CIRCLE PROGRESS STEPPER */}
            <nav
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
                        if (item.step < regStep) {
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

                    return (
                      <label
                        key={opt.optionId}
                        className={`reg-category-radio-card ${
                          isSelected ? 'selected' : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="event-reg-cat-option"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedDivisionOption(opt.optionId);
                            setSelectedCatId(opt.catId);
                          }}
                        />
                        <span className="custom-radio-circle" aria-hidden="true" />
                        <div className="reg-radio-card-copy">
                          <strong>{tx(opt.label)}</strong>
                          <span className="muted-inline mono-num">
                            {tx(opt.subLabel)} ·{' '}
                            {quote
                              ? formatThb(quote.runnerNetPaySatang, true)
                              : ''}{' '}
                            {` · ${txf('ว่าง {0} สิทธิ์', openCatSeats)}`}
                            {cat && formatAgeLimit(cat) ? ` · ${formatAgeLimit(cat)}` : ''}
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
                  className="reg-radio-cards-stack reg-mode-choice"
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

                {regModeChosen && (
                  <>
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
                      <legend>{tx("ชื่อผู้เข้าแข่งขัน (ภาษาไทย)")}</legend>
                      <div className="form-grid-3">
                        <div className="form-row">
                          <label htmlFor="p2-fname-th">{<RequiredFieldText text={tx("ชื่อจริง *")} />}</label>
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
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-lname-th">{<RequiredFieldText text={tx("นามสกุล *")} />}</label>
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
                            required
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
                      </div>
                    </fieldset>

                    <fieldset className="reg-field-group">
                      <legend>{tx("ชื่อภาษาอังกฤษ (แสดงบนป้าย BIB)")}</legend>
                      <div className="form-grid-3">
                        <div className="form-row">
                          <label htmlFor="p2-fname-en">First Name (EN)</label>
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
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="p2-lname-en">Last Name (EN)</label>
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

                    <fieldset className="reg-field-group">
                      <legend>{tx("ข้อมูลส่วนตัวและเอกสารยืนยันตัวตน")}</legend>
                      <div className="form-grid-3">
                        <div className="form-row">
                          <label htmlFor="p2-dob">
                            {tx("วันเกิด")}
                          </label>
                          <DateOfBirthInput
                            id="p2-dob"
                            valueIso={regDob}
                            onChangeIso={setRegDob}
                            ariaDescribedBy="p2-dob-age"
                          />
                          {regAgeCheck && (
                            <p
                              id="p2-dob-age"
                              className={`reg-age-hint ${
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
                        </div>
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
                          <label htmlFor="p2-phone">{tx("เบอร์โทรศัพท์ผู้เข้าแข่งขัน")}</label>
                          <input
                            id="p2-phone"
                            type="tel"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="081-234-5678"
                          />
                        </div>
                      </div>
                      <div className="form-grid-2">
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
                        <div className="form-row">
                          <label htmlFor="p2-idnum">
                            {regIdType === 'thai_id'
                              ? tx("เลขบัตรประจำตัวประชาชน")
                              : tx("เลขหนังสือเดินทาง")}
                          </label>
                          <input
                            id="p2-idnum"
                            type="text"
                            inputMode={regIdType === 'thai_id' ? 'numeric' : 'text'}
                            className="mono-code"
                            value={regIdNumber}
                            onChange={(e) =>
                              setRegIdNumber(
                                sanitizeThaiIdOrPassport(e.target.value, regIdType)
                              )
                            }
                            placeholder={
                              regIdType === 'thai_id'
                                ? 'กรอกตัวเลข 13 หลัก'
                                : 'Passport No.'
                            }
                          />
                        </div>
                      </div>
                    </fieldset>

                    <fieldset className="reg-field-group">
                      <legend>{tx("ผู้ติดต่อกรณีฉุกเฉิน")}</legend>
                      <div className="form-row">
                        <label htmlFor="p2-emerg">
                          {<RequiredFieldText text={tx("ชื่อและเบอร์โทรผู้ติดต่อฉุกเฉิน *")} />}
                        </label>
                        <input
                          id="p2-emerg"
                          type="text"
                          value={emergencyContactText}
                          onChange={(e) => setEmergencyContactText(e.target.value)}
                          placeholder={tx("ชื่อผู้ติดต่อ และเบอร์โทร 10 หลัก")}
                        />
                        {registerForSelf &&
                          (currentUser?.runnerProfile?.emergencyContacts ?? []).length > 0 && (
                          <div className="cta-inline-row" style={{ marginTop: '0.25rem' }}>
                            <span className="muted-inline">
                              {tx("เลือกจากโปรไฟล์:")}
                            </span>
                            {(currentUser?.runnerProfile?.emergencyContacts ?? []).map(
                              (ec) => (
                                <button
                                  key={ec.id}
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() =>
                                    setEmergencyContactText(
                                      `${ec.contactName} (${ec.relationship}) ${ec.phone}`
                                    )
                                  }
                                >
                                  {ec.contactName} ({tx(ec.relationship)})
                                  {ec.isPrimary ? ` · ${tx("หลัก")}` : ''}
                                </button>
                              )
                            )}
                            {onOpenRunnerProfile && (
                              <button
                                type="button"
                                className="btn-ghost-sm"
                                onClick={onOpenRunnerProfile}
                              >
                                {tx("จัดการโปรไฟล์")}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </fieldset>

                    <RunnerCustomFieldsInputs
                      fields={selectedEvent.customFields}
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
                  </>
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
                    onClick={() => {
                      if (!regModeChosen) {
                        setStep2Error(tx("กรุณาเลือกว่าจะสมัครให้ตนเองหรือสมัครให้ผู้อื่นก่อน"));
                        return;
                      }
                      if (!regFirstNameTh.trim() || !regLastNameTh.trim() || !buyerName.trim()) {
                        setStep2Error(tx("กรุณากรอกชื่อ-นามสกุลผู้สมัครให้ครบถ้วน"));
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
                      const missingField = (
                        selectedEvent.customFields ?? []
                      ).find((f) => {
                        if (!f.required) return false;
                        const isVisible = evaluateConditionRule(
                          f.visibilityCondition,
                          customAnswers,
                          {
                            raceDistance: activeCategory.code,
                            shirtSize,
                          }
                        );
                        if (!isVisible) return false;
                        const val = customAnswers[f.id] ?? f.defaultValue;
                        if (f.type === 'checkbox') return val !== true;
                        return !String(val ?? '').trim();
                      });
                      if (missingField) {
                        setStep2Error(
                          txf("กรุณาระบุ \"{0}\" ให้ครบก่อนไปขั้นตอนถัดไป", missingField.label)
                        );
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
                      setRegStep(3);
                    }}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: สินค้า — เลือกไซส์เสื้อตามสิทธิ์ & สินค้าซื้อเพิ่ม */}
            {regStep === 3 && activeCategory && (
              <div className="reg-step-body">
                <h2 className="reg-step-accent-heading">
                  {tx("เลือกไซส์เสื้อตามสิทธิ์สมัครและของที่ระลึก")}
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

                <div className="form-row">
                  <label>
                    {tx("เลือกขนาดเสื้อตามสิทธิ์สมัคร (แก้ไขไซส์ได้ถึงวันที่")}{' '}
                    <span className="mono-num">
                      {tx(selectedEvent.editDeadlineDate)}
                    </span>
                    )
                  </label>
                  <div className="reg-radio-cards-stack">
                    {selectedEvent.shirtStocks.map((st) => {
                      const left = Math.max(
                        0,
                        st.total - st.reservedOrConfirmed
                      );
                      const spec = getShirtSpec(st.size);
                      const isPicked = shirtSize === st.size;
                      return (
                        <label
                          key={st.size}
                          className={`reg-category-radio-card ${
                            isPicked ? 'selected' : ''
                          } ${left === 0 ? 'disabled' : ''}`}
                        >
                          <input
                            type="radio"
                            name="event-shirt-size-pick"
                            disabled={left === 0}
                            checked={isPicked}
                            onChange={() => {
                              setShirtSize(st.size);
                              setShirtTouched(true);
                            }}
                          />
                          <span
                            className="custom-radio-circle"
                            aria-hidden="true"
                          />
                          <div className="reg-radio-card-copy">
                            <strong>
                              {tx("เสื้อวิ่งไซส์ ")} {tx(st.size)} {tx(" (รอบอก")} {tx(spec.chestInch)} {tx(" · ยาว")}{' '}
                              {tx(spec.lengthInch)})
                            </strong>
                            <span className="muted-inline mono-num">
                              {left > 0
                                ? txf("คงเหลือ {0} ตัว (รวมในสิทธิ์ค่าสมัครแล้ว)", left)
                                : tx("สต็อกไซส์นี้เต็มแล้ว")}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {selectedEvent.products.length > 0 && (
                  <div className="addon-merch-box">
                    <div className="addon-head">
                      <IconShirt size={16} />
                      <strong>
                        {tx("สั่งซื้อเสื้อหรือเหรียญที่ระลึกเพิ่มพร้อมใบสมัคร (ไม่บังคับ)")}
                      </strong>
                    </div>
                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="p3-addon">{tx("เลือกสินค้าที่ระลึก")}</label>
                        <select
                          id="p3-addon"
                          value={includeAddonId}
                          onChange={(e) => setIncludeAddonId(e.target.value)}
                        >
                          <option value="none">
                            {tx("-- ไม่ซื้อสินค้าเพิ่ม (รับเฉพาะสิทธิ์สมัครวิ่ง) --")}
                          </option>
                          {selectedEvent.products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {tx(p.nameTh)} (+{formatThb(p.priceSatang)})
                            </option>
                          ))}
                        </select>
                      </div>
                      {selectedAddonProduct && (
                        <div className="form-row">
                          <label htmlFor="p3-addon-sz">{tx("ขนาด / รูปแบบ")}</label>
                          <select
                            id="p3-addon-sz"
                            value={addonSize}
                            onChange={(e) => setAddonSize(e.target.value)}
                          >
                            {selectedAddonProduct.availableSizes.map((sz) => (
                              <option key={sz} value={sz}>
                                {tx(sz)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(2)}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <button
                    type="button"
                    className="btn-primary reg-next-pill-btn"
                    onClick={() => setRegStep(4)}
                  >
                    {tx("ถัดไป")}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ที่อยู่ — วิธีรับอุปกรณ์ Race Kit & ที่อยู่จัดส่ง */}
            {regStep === 4 && (
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
                        {tx("รับเสื้อและป้าย BIB ด้วยตนเองที่หน้างาน (QR Check-in · ไม่มีค่าจัดส่ง)")}
                      </strong>
                      <span className="muted-inline">
                        {tx("กำหนดการรับอุปกรณ์: ")} {tx(selectedEvent.kitPickupWindow)} {tx(" ณ")}{' '}
                        {tx(selectedEvent.venue)}
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
                    </div>
                  </label>
                </div>

                <div className="custom-field-creator canvas-stack" style={{ marginTop: '0.6rem' }}>
                  <strong>{<RequiredFieldText text={tx("ที่อยู่ติดต่อ / ที่อยู่สำหรับจัดส่งพัสดุ *")} />}</strong>
                  {(currentUser?.runnerProfile?.savedAddresses ?? []).length > 0 && (
                    <div className="priority-pill-bar" role="tablist" aria-label={tx("วิธีระบุที่อยู่")}>
                      <button
                        type="button"
                        className={`filter-pill ${shipAddrMode === 'saved' ? 'active' : ''}`}
                        onClick={() => {
                          setShipAddrMode('saved');
                          const addr = (currentUser?.runnerProfile?.savedAddresses ?? []).find(
                            (x) => x.id === selectedSavedAddrId
                          ) ?? currentUser?.runnerProfile?.savedAddresses?.[0];
                          if (addr) {
                            setSelectedSavedAddrId(addr.id);
                            setRunnerShippingAddress(
                              `${addr.recipientName} (${addr.phone}) — ${addr.address}, ต.${addr.subdistrict} อ.${addr.district} จ.${addr.province} ${addr.postalCode}`
                            );
                          }
                        }}
                      >
                        {tx("เลือกจากสมุดที่อยู่")}
                      </button>
                      <button
                        type="button"
                        className={`filter-pill ${shipAddrMode === 'manual' ? 'active' : ''}`}
                        onClick={() => {
                          setShipAddrMode('manual');
                          const next = regCascadeAddr;
                          setRunnerShippingAddress(
                            `${shipRecipient} (${shipPhone}) — ${next.address}, ต.${next.subdistrict} อ.${next.district} จ.${next.province} ${next.postalCode}`.trim()
                          );
                        }}
                      >
                        {tx("กรอกที่อยู่ใหม่เอง")}
                      </button>
                    </div>
                  )}

                  {shipAddrMode === 'saved' &&
                    (currentUser?.runnerProfile?.savedAddresses ?? []).length > 0 && (
                    <div className="reg-radio-cards-stack">
                      {(currentUser?.runnerProfile?.savedAddresses ?? []).map((addr) => (
                        <label
                          key={addr.id}
                          className={`reg-category-radio-card ${
                            selectedSavedAddrId === addr.id ? 'selected' : ''
                          }`}
                        >
                          <input
                            type="radio"
                            name="saved-ship-addr"
                            checked={selectedSavedAddrId === addr.id}
                            onChange={() => {
                              setSelectedSavedAddrId(addr.id);
                              setRunnerShippingAddress(
                                `${addr.recipientName} (${addr.phone}) — ${addr.address}, ต.${addr.subdistrict} อ.${addr.district} จ.${addr.province} ${addr.postalCode}`
                              );
                            }}
                          />
                          <span className="custom-radio-circle" aria-hidden="true" />
                          <div className="reg-radio-card-copy">
                            <strong>
                              {addr.addressName}
                              {addr.isDefault ? ` · ${tx("ค่าเริ่มต้น")}` : ''}
                            </strong>
                            <span className="muted-inline">
                              {addr.recipientName} ({addr.phone}) — {addr.address}, ต.{addr.subdistrict} อ.{addr.district} จ.{addr.province}{' '}
                              <span className="mono-num">{addr.postalCode}</span>
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {shipAddrMode === 'manual' && (
                    <>
                      <div className="form-grid-2">
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
                        <div className="form-row">
                          <label htmlFor="ship-phone">{<RequiredFieldText text={tx("เบอร์โทรผู้รับ *")} />}</label>
                          <input
                            id="ship-phone"
                            type="tel"
                            value={shipPhone}
                            onChange={(e) => {
                              setShipPhone(e.target.value);
                              const n = regCascadeAddr;
                              setRunnerShippingAddress(
                                `${shipRecipient} (${e.target.value}) — ${n.address}, ต.${n.subdistrict} อ.${n.district} จ.${n.province} ${n.postalCode}`.trim()
                              );
                            }}
                            placeholder="081-234-5678"
                          />
                        </div>
                      </div>

                      <ThaiPostalAddressSelector
                        idPrefix="ev-reg-ship"
                        required
                        streetAddressLabel="ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)"
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

                      {currentUser && (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={saveShipAddrToProfile}
                            onChange={(e) => setSaveShipAddrToProfile(e.target.checked)}
                          />
                          <span>{tx("บันทึกที่อยู่นี้ลงสมุดที่อยู่ในโปรไฟล์ (เลือกใช้ได้ในการสมัครครั้งถัดไป)")}</span>
                        </label>
                      )}
                    </>
                  )}
                </div>

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

            {/* STEP 5: ชำระเงิน — ตรวจสอบยอดชำระ & ยืนยันการสมัคร */}
            {regStep === 5 && activeCategory && (
              <form
                onSubmit={handleRegistrationSubmit}
                className="reg-step-body"
              >
                <h2 className="reg-step-accent-heading">
                  {tx("สรุปยอดชำระแยกรายการและยืนยันการสมัคร")}
                </h2>

                {(() => {
                  const tier = getCurrentTier(activeCategory);
                  const quote = calculateFeeQuote(
                    tier.priceSatang,
                    selectedEvent.feeBearerPolicy
                  );
                  const addonSatang = selectedAddonProduct
                    ? selectedAddonProduct.priceSatang
                    : 0;
                  const grandTotal = quote.runnerNetPaySatang + addonSatang;

                  return (
                    <div className="price-breakdown-box">
                      <div className="breakdown-line">
                        <span>
                          {tx("ค่าสมัครวิ่ง ")} {tx(activeCategory.name)} ({tx(tier.label)}{tx(") · เสื้อไซส์ ")} {tx(shirtSize)}
                        </span>
                        <span className="mono-num">
                          {formatThb(quote.baseSatang, true)}
                        </span>
                      </div>
                      <div className="breakdown-line">
                        <span>
                          {tx("ค่าบริการระบบ (")}{feePolicyLabel(selectedEvent.feeBearerPolicy)})
                        </span>
                        <span className="mono-num">
                          {formatThb(quote.runnerFeeSatang, true)}
                        </span>
                      </div>
                      {selectedAddonProduct && (
                        <div className="breakdown-line">
                          <span>
                            {tx("สินค้าซื้อเพิ่ม: ")} {tx(selectedAddonProduct.nameTh)} (
                            {tx(addonSize)})
                          </span>
                          <span className="mono-num">
                            {formatThb(selectedAddonProduct.priceSatang, true)}
                          </span>
                        </div>
                      )}
                      <div className="breakdown-total">
                        <strong>{tx("ยอดชำระสุทธิทั้งหมด")}</strong>
                        <strong className="mono-num text-vermilion">
                          {formatThb(grandTotal, true)}
                        </strong>
                      </div>
                    </div>
                  );
                })()}

                <div className="form-row">
                  <label>{tx("เลือกช่องทางชำระเงิน (จำลอง)")}</label>
                  <div className="cta-inline-row">
                    <button
                      type="button"
                      className={`filter-pill ${
                        paymentChannel === 'promptpay' ? 'active' : ''
                      }`}
                      onClick={() => setPaymentChannel('promptpay')}
                    >
                      {tx("QR PromptPay (สแกนจ่ายทันที)")}
                    </button>
                    <button
                      type="button"
                      className={`filter-pill ${
                        paymentChannel === 'card' ? 'active' : ''
                      }`}
                      onClick={() => setPaymentChannel('card')}
                    >
                      {tx("บัตรเครดิต / เดบิต")}
                    </button>
                  </div>
                </div>

                <div className="consent-group">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={acceptedRules}
                      onChange={(e) => setAcceptedRules(e.target.checked)}
                    />
                    <span>
                      <strong>{tx("[จำเป็น]")}</strong> {tx(" ข้าพเจ้ายอมรับกติกาการแข่งขันและเงื่อนไขความปลอดภัยของงาน (")}{tx(selectedEvent.rulesVersion)})
                    </span>
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={marketingConsent}
                      onChange={(e) => setMarketingConsent(e.target.checked)}
                    />
                    <span>
                      {tx("[ไม่บังคับ] ยินยอมรับข่าวสารงานวิ่งและโปรโมชันจากผู้จัดงาน")}
                    </span>
                  </label>
                </div>

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

                <div className="reg-step-footer-between">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRegStep(4)}
                  >
                    {tx("ย้อนกลับ")}
                  </button>
                  <div className="cta-inline-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => submitRegistrationOrder(false)}
                    >
                      {tx("กันโควตาไว้ชำระภายหลัง (15 นาที)")}
                    </button>
                    <button type="submit" className="btn-primary">
                      {tx("ชำระเงินและยืนยันการสมัครทันที")}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 6: สำเร็จ — ใบยืนยันสิทธิ์และ QR Token */}
            {regStep === 6 && createdResult && (
              <div className="reg-step-body">
                <div className="receipt-success-panel">
                  <div className="receipt-head">
                    <IconCheckCircle size={24} />
                    <div>
                      <h2>
                        {createdResult.reg.registrationStatus === 'confirmed'
                          ? tx("สมัครวิ่งและยืนยันการชำระเงินสำเร็จ!")
                          : tx("สร้างใบจองโควตาสำเร็จ (รอผลชำระเงินภายใน 15 นาที)")}
                      </h2>
                      <p className="muted-inline">
                        {tx("บันทึกใบสมัครด้วยฟอร์มเวอร์ชัน")}{' '}
                        <span className="mono-code">
                          {selectedEvent.publishedFormVersion ?? 'v1.2-published'}
                        </span>{' '}
                        {tx("เรียบร้อยแล้ว")}
                      </p>
                    </div>
                  </div>

                  <div className="receipt-grid">
                    <div>
                      <span className="muted-inline">{tx("รหัสใบสมัครวิ่ง")}</span>
                      <strong className="mono-code">
                        {tx(createdResult.reg.regCode)}
                      </strong>
                    </div>
                    <div>
                      <span className="muted-inline">{tx("ผู้เข้าแข่งขัน")}</span>
                      <strong>{tx(createdResult.reg.participantNameTh)}</strong>
                    </div>
                    <div>
                      <span className="muted-inline">{tx("เสื้อตามสิทธิ์สมัคร")}</span>
                      <strong>{tx("ไซส์")} {tx(createdResult.reg.shirtSize)}</strong>
                    </div>
                    <div>
                      <span className="muted-inline">{tx("QR Token รับอุปกรณ์")}</span>
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
              </div>
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

    const stickyCategory = activeCategory ?? selectedEvent.categories[0];
    const stickyTier = stickyCategory ? getCurrentTier(stickyCategory) : null;
    const stickyQuote = stickyTier
      ? calculateFeeQuote(stickyTier.priceSatang, selectedEvent.feeBearerPolicy)
      : null;
    const stickyCatOpen = stickyCategory
      ? getCategoryOpenSeats(selectedEvent.id, stickyCategory)
      : 0;

    const overviewParas =
      selectedEvent.overviewParagraphs &&
      selectedEvent.overviewParagraphs.length > 0
        ? selectedEvent.overviewParagraphs
        : [
            `${selectedEvent.titleTh} (${selectedEvent.titleEn}) จัดขึ้น ณ ${selectedEvent.venue} จังหวัด${selectedEvent.province} ในรูปแบบ ${selectedEvent.raceType} โดยเน้นมาตรฐานความปลอดภัยของเส้นทาง การจัดการจุดปล่อยตัวตามรหัสสี BIB และความโปร่งใสของราคาค่าสมัครสุทธิ`,
            'ผู้สมัครทุกคนจะได้รับเสื้อแข่งขันประจำงาน ป้ายหมายเลข BIB พร้อม QR Token สำหรับรับอุปกรณ์ล่วงหน้า และเหรียญรางวัล Finisher เมื่อวิ่งเข้าเส้นชัยตามเวลาที่กำหนด นอกจากนี้ผู้ติดตามหรือลูกค้าทั่วไปยังสามารถสั่งซื้อเสื้อและของที่ระลึกผ่านหน้าร้านค้าประจำงานได้โดยไม่ต้องสมัครวิ่ง',
          ];

    const racePackList =
      selectedEvent.racePackItems && selectedEvent.racePackItems.length > 0
        ? selectedEvent.racePackItems
        : [
            {
              title: 'เสื้อวิ่งประจำงาน (Official Race Jersey)',
              detail:
                'เนื้อผ้าไมโครโพลีเอสเตอร์ระบายอากาศ แห้งไว เลือกขนาด XS ถึง 2XL ได้ตามโควตาและแก้ไขไซส์ได้ก่อนเส้นตาย',
              scope: 'ผู้สมัครทุกระยะ',
            },
            {
              title: 'ป้ายหมายเลขแข่งขัน (BIB) พร้อม QR Token',
              detail:
                'แยกสีตามระยะการแข่งขัน ใช้แสดงเพื่อรับอุปกรณ์ในวัน Expo และเข้าบล็อกปล่อยตัว',
              scope: 'ผู้สมัครทุกระยะ',
            },
            {
              title: 'เหรียญรางวัล Finisher',
              detail:
                'มอบให้ผู้เข้าแข่งขันที่วิ่งผ่านจุดเช็กและเข้าเส้นชัยภายในเวลา Cut-off ของแต่ละระยะ',
              scope: 'ผู้เข้าเส้นชัยตามกติกา',
            },
            {
              title: 'ประกันอุบัติเหตุ & บริการจุดให้น้ำ-อาหารหลังเส้นชัย',
              detail:
                'ดูแลความปลอดภัยด้วยทีมแพทย์เคลื่อนที่ จุดบริการน้ำดื่มตลอดเส้นทาง และอาหารว่างหลังเข้าเส้นชัย',
              scope: 'ผู้สมัครทุกคน',
            },
          ];

    const scheduleTimeline =
      selectedEvent.scheduleItems && selectedEvent.scheduleItems.length > 0
        ? selectedEvent.scheduleItems
        : [
            {
              timeLabel: `วันนี้ – ${selectedEvent.editDeadlineDate}`,
              title: 'ช่วงเวลาเปิดรับสมัครและแก้ไขขนาดเสื้อออนไลน์',
              detail:
                'สมัครออนไลน์พร้อมรับ QR Token ทันที และสามารถปรับขนาดเสื้อได้ด้วยตนเองก่อนวันปิดแก้ไขข้อมูล',
            },
            {
              timeLabel: selectedEvent.kitPickupWindow,
              title: 'วันรับเสื้อและป้าย BIB (Expo & Race Kit Pickup)',
              detail: `แสดง QR Token ที่จุดรับอุปกรณ์ ณ ${selectedEvent.venue} เพื่อรับเสื้อและป้าย BIB`,
            },
            ...selectedEvent.categories.map((c) => ({
              timeLabel: `${selectedEvent.eventDate} · ${c.startTimeLocal} น.`,
              title: `ปล่อยตัวระยะ ${c.name} (${c.code})`,
              detail: `รหัสหน้า BIB ${c.bibPrefix}-xxxx · เวลา Cut-off ${c.cutoffHours} ชั่วโมง`,
            })),
            {
              timeLabel: `${selectedEvent.eventDate} · หลังเข้าเส้นชัย`,
              title: 'รับเหรียญรางวัล Finisher และประกาศผลการแข่งขัน/อัลบั้มภาพ',
              detail:
                'ตรวจสอบผลการแข่งขันและลิงก์อัลบั้มภาพถ่ายหลังงานที่ผู้จัดตรวจสอบแล้วผ่านหน้าเว็บนี้',
            },
          ];

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

        {/* HERO COVER BANNER */}
        <section className="event-detail-hero">
          <div className="detail-cover-box">
            <EventCoverMedia
              event={selectedEvent}
              className="detail-cover-svg"
            />
          </div>

          <div className="detail-hero-body">
            <div className="detail-meta-top">
              <EventStatusBadge status={selectedEvent.status} />
              <span className="race-type-tag">{tx(selectedEvent.raceType)}</span>
              <span className="mono-code">{tx(selectedEvent.code)}</span>
            </div>

            <h1>{tx(selectedEvent.titleTh)}</h1>
            <p className="muted-block">{tx(selectedEvent.tagline)}</p>

            <div className="detail-key-facts">
              <div>
                <IconCalendar size={16} />
                <span>
                  {tx("วันแข่งขัน:")}{' '}
                  <strong className="mono-num">{tx(selectedEvent.eventDate)}</strong>{' '}
                  {tx("· เปิดรับสมัคร:")}{' '}
                  <strong>
                    {selectedEvent.registrationPeriodLabel
                      ? tx(selectedEvent.registrationPeriodLabel)
                      : txf("ถึง {0}", selectedEvent.editDeadlineDate)}
                  </strong>
                </span>
              </div>
              <div>
                <IconMapPin size={16} />
                <span>
                  {tx("จังหวัด")}{tx(selectedEvent.province)} · {tx(selectedEvent.venue)}
                </span>
              </div>
              <div>
                <IconBuilding size={16} />
                <span>
                  {tx("ผู้จัดงาน: ")} <strong>{tx(org?.nameTh)}</strong> {tx(" · นโยบายค่าบริการ:")}{' '}
                  <strong>{feePolicyLabel(selectedEvent.feeBearerPolicy)}</strong>
                </span>
              </div>
            </div>
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
          className="detail-mode-tabs"
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
            aria-selected={showRegForm && detailTab === 'register'}
            className={`detail-tab-btn ${
              showRegForm && detailTab === 'register' ? 'active' : ''
            }`}
            onClick={() => startRegistrationForCategory(selectedCatId)}
          >
            <IconBib size={16} />
            <span>{tx("กรอกใบสมัครวิ่ง (รับสิทธิ์ BIB)")}</span>
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
              {tx("ร้านค้าของที่ระลึก (")}{tx(selectedEvent.products.length)} {tx(" รายการ — ไม่สมัครวิ่งก็ซื้อได้)")}
            </span>
          </button>
        </div>

        {/* 2-COLUMN RACE.THAI.RUN STYLE LAYOUT: MAIN CONTENT LEFT + STICKY SUMMARY RIGHT */}
        <div
          className={`event-detail-two-col ${
            isEditorialView ? 'is-editorial-mode' : 'is-action-mode'
          }`}
        >
          <div className="event-editorial-col">
            {/* MODE A: FULL EDITORIAL EVENT PAGE (DEFAULT) */}
            {isEditorialView && (
              <div className="editorial-sections-stack">
                <nav
                  className="editorial-anchor-strip"
                  aria-label={tx("ทางลัดไปยังหัวข้อในหน้านี้")}
                >
                  <button
                    type="button"
                    className="filter-pill"
                    onClick={() => jumpToEditorialSection('sec-about')}
                  >
                    {tx("เกี่ยวกับงาน")}
                  </button>
                  <button
                    type="button"
                    className="filter-pill"
                    onClick={() => jumpToEditorialSection('sec-categories')}
                  >
                    {tx("ระยะทาง & ค่าสมัคร")}
                  </button>
                  <button
                    type="button"
                    className="filter-pill"
                    onClick={() => jumpToEditorialSection('sec-racepack')}
                  >
                    {tx("เสื้อ เหรียญ & ตารางไซส์")}
                  </button>
                  <button
                    type="button"
                    className="filter-pill"
                    onClick={() => jumpToEditorialSection('sec-schedule')}
                  >
                    {tx("กำหนดการวันงาน")}
                  </button>
                  <button
                    type="button"
                    className="filter-pill"
                    onClick={() => jumpToEditorialSection('sec-venue-rules')}
                  >
                    {tx("สถานที่ กติกา & รูปภาพ")}
                  </button>
                </nav>

                {/* SECTION 1: ABOUT & HIGHLIGHTS */}
                <section id="sec-about" className="clean-panel">
                  <h2>{tx("รายละเอียดการจัดงานและไฮไลต์สำคัญ")}</h2>
                  {overviewParas.map((p, idx) => (
                    <p key={idx} className="muted-block">
                      {tx(p)}
                    </p>
                  ))}

                  <h3>{tx("จุดเด่นและสิทธิพิเศษสำหรับผู้สมัคร")}</h3>
                  <ul className="compact-bullet-list">
                    {selectedEvent.highlights.map((h, i) => (
                      <li key={i}>{tx(h)}</li>
                    ))}
                    <li>
                      {tx("แสดงราคาสุทธิชัดเจนก่อนชำระเงิน (")}{feePolicyLabel(selectedEvent.feeBearerPolicy)})
                    </li>
                  </ul>
                </section>

                {/* SECTION 2: RACE CATEGORIES, DISTANCES & PRICE TIERS */}
                <section id="sec-categories" className="clean-panel">
                  <div className="section-title-bar">
                    <div>
                      <h2>{tx("ประเภทการแข่งขัน ระยะทาง และอัตราค่าสมัคร")}</h2>
                      <p className="muted-inline">
                        {tx("คลิกเลือกระยะที่ต้องการเพื่อดูราคาสุทธิในการ์ดด้านขวา หรือกดปุ่มสมัครระยะนั้นได้ทันที")}
                      </p>
                    </div>
                  </div>

                  <div className="editorial-category-list">
                    {selectedEvent.categories.map((cat) => {
                      const curTier = getCurrentTier(cat);
                      const quote = calculateFeeQuote(
                        curTier.priceSatang,
                        selectedEvent.feeBearerPolicy
                      );
                      const left = getCategoryOpenSeats(selectedEvent.id, cat);
                      const isPicked = stickyCategory?.id === cat.id;

                      return (
                        <article
                          key={cat.id}
                          className={`editorial-cat-card ${
                            isPicked ? 'selected' : ''
                          }`}
                          onClick={() => setSelectedCatId(cat.id)}
                        >
                          <div className="editorial-cat-head">
                            <div className="cta-inline-row">
                              <span
                                className={`category-bib-chip tone-${cat.colorTag}`}
                              >
                                <strong>{tx(cat.code)}</strong>
                              </span>
                              <h3>{tx(cat.name)}</h3>
                              <span className="mono-code">
                                BIB {tx(cat.bibPrefix)}-xxxx
                              </span>
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
                            {formatAgeLimit(cat) && (
                              <span>
                                <strong>{formatAgeLimit(cat)}</strong>{' '}
                                <span className="muted-inline">
                                  ({formatAgeBasis(cat.ageBasis ?? 'race_day')})
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="editorial-tier-strip">
                            {cat.priceTiers.map((t) => (
                              <span
                                key={t.id}
                                className={`editorial-tier-pill ${
                                  t.isCurrent ? 'active' : ''
                                }`}
                              >
                                <strong>{tx(t.label)}:</strong>{' '}
                                <span className="mono-num">
                                  {formatThb(t.priceSatang)}
                                </span>{' '}
                                ({tx(t.startsAt)} – {tx(t.endsAt)})
                                {t.isCurrent ? tx(" · เปิดใช้อยู่") : ''}
                              </span>
                            ))}
                          </div>

                          <div className="editorial-cat-actions">
                            <span className="muted-inline">
                              {tx("ค่าสมัครป้าย ")} {formatThb(quote.baseSatang)} {tx(" + ค่าบริการฝั่งนักวิ่ง")}{' '}
                              {formatThb(quote.runnerFeeSatang, true)}
                            </span>
                            {selectedEvent.status === 'published' && (
                              <button
                                type="button"
                                className="btn-primary"
                                disabled={left <= 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startRegistrationForCategory(cat.id);
                                }}
                              >
                                <span>
                                  {left > 0
                                    ? txf("สมัครระยะ {0}", cat.code)
                                    : tx("โควตาเต็มแล้ว")}
                                </span>
                                <IconArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {/* SECTION 3: RACE PACK ENTITLEMENTS, SHIRT & MEDAL + SIZE CHART */}
                <section id="sec-racepack" className="clean-panel">
                  <h2>{tx("เสื้อแข่งขัน เหรียญรางวัล สิทธิ์ที่ผู้สมัครจะได้รับ และตารางไซส์เสื้อ")}</h2>
                  <p className="muted-block">
                    {tx("แยกชัดเจนระหว่างสิ่งที่ได้รับตามสิทธิ์การสมัครแข่งขัน (Race Pack) กับสินค้าที่ระลึกที่เปิดขายแยกในหน้าร้านค้า")}
                  </p>

                  <div className="racepack-grid">
                    {racePackList.map((item, idx) => (
                      <div key={idx} className="racepack-item-card">
                        <div className="cta-inline-row">
                          <IconShirt size={16} />
                          <strong>{tx(item.title)}</strong>
                        </div>
                        <p className="muted-block">{tx(item.detail)}</p>
                        <span className="mono-code">{tx(item.scope)}</span>
                      </div>
                    ))}
                  </div>

                  <h3 style={{ marginTop: '1.1rem' }}>
                    {tx("ตารางขนาดเสื้อแข่งขันมาตรฐานและสต็อกคงเหลือจริง")}
                  </h3>
                  <div className="table-scroll">
                    <table className="ops-table">
                      <thead>
                        <tr>
                          <th>{tx("ขนาดเสื้อ (Size)")}</th>
                          <th>{tx("รอบอก (นิ้ว)")}</th>
                          <th>{tx("ความยาวเสื้อ (นิ้ว)")}</th>
                          <th className="num-col">{tx("โควตาเสื้อทั้งหมด")}</th>
                          <th className="num-col">{tx("คงเหลือให้เลือก")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedEvent.shirtStocks.map((st) => {
                          const left = Math.max(
                            0,
                            st.total - st.reservedOrConfirmed
                          );
                          const spec = getShirtSpec(st.size);
                          return (
                            <tr key={st.size}>
                              <td>
                                <strong>{tx("ไซส์")} {tx(st.size)}</strong>
                              </td>
                              <td className="mono-num">{tx(spec.chestInch)}</td>
                              <td className="mono-num">{tx(spec.lengthInch)}</td>
                              <td className="num-col mono-num">
                                {tx(st.total)} {tx(" ตัว")}
                              </td>
                              <td className="num-col mono-num">
                                {left > 0 ? (
                                  <strong className="text-forest">
                                    {tx("ว่าง ")} {tx(left)} {tx(" ตัว")}
                                  </strong>
                                ) : (
                                  <span className="text-danger">{tx("หมดโควตา")}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* SECTION 4: SCHEDULE & TIMELINE */}
                <section id="sec-schedule" className="clean-panel">
                  <h2>{tx("กำหนดการรับอุปกรณ์และตารางเวลาวันแข่งขัน (Timeline)")}</h2>
                  <p className="muted-block">
                    {tx("เวลาอ้างอิงตามเขตเวลามาตรฐานประเทศไทย (")}{tx(selectedEvent.timezone)})
                  </p>

                  <div className="schedule-timeline-list">
                    {scheduleTimeline.map((item, idx) => (
                      <div key={idx} className="schedule-timeline-row">
                        <div className="schedule-time-badge mono-num">
                          <IconClock size={14} />
                          <span>{tx(item.timeLabel)}</span>
                        </div>
                        <div className="schedule-row-body">
                          <strong>{tx(item.title)}</strong>
                          <p className="muted-inline">{tx(item.detail)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* SECTION 5: VENUE, RULES, CONTACT & VERIFIED RESULTS/PHOTOS */}
                <section id="sec-venue-rules" className="clean-panel">
                  <h2>{tx("สถานที่จัดงาน กติกาการแข่งขัน และช่องทางติดต่อผู้จัด")}</h2>
                  <div className="form-grid-2">
                    <div className="racepack-item-card">
                      <strong>{tx("จุดปล่อยตัวและสถานที่จัดงาน")}</strong>
                      <p className="muted-block">
                        {tx(selectedEvent.venue)} {tx(" · จังหวัด")}{tx(selectedEvent.province)} {tx(" (ภูมิภาค")}
                        {tx(selectedEvent.region)})
                      </p>
                      <span className="muted-inline">
                        {tx("เวลารับเสื้อและ BIB: ")} {tx(selectedEvent.kitPickupWindow)}
                      </span>
                    </div>

                    <div className="racepack-item-card">
                      <strong>{tx("กติกาการแข่งขันและการแก้ไขข้อมูล")}</strong>
                      <p className="muted-block">
                        {tx("ใช้กติกาฉบับ ")} <code>{tx(selectedEvent.rulesVersion)}</code> {tx(" · ผู้สมัครแก้ไขขนาดเสื้อด้วยตนเองได้ถึงวันที่")}{' '}
                        <strong className="mono-num">
                          {tx(selectedEvent.editDeadlineDate)}
                        </strong>
                      </p>
                      <span className="muted-inline">
                        {tx("ผู้จัดงาน: ")} {tx(org?.nameTh)} ({tx(org?.contactEmail)})
                      </span>
                    </div>
                  </div>

                  {selectedEvent.verifiedPhotoAlbums &&
                    selectedEvent.verifiedPhotoAlbums.length > 0 && (
                      <div className="completed-showcase-box">
                        <h3>{tx("ผลการแข่งขันและอัลบั้มภาพหลังงาน (ผู้จัดตรวจสอบแล้ว)")}</h3>
                        <div className="album-list">
                          {selectedEvent.verifiedPhotoAlbums.map((alb) => (
                            <div key={alb.id} className="album-item-row">
                              <div>
                                <strong>{tx(alb.title)}</strong>
                                <div className="muted-inline">
                                  {tx(alb.photographerCredit)} ·{' '}
                                  <span className="mono-num">
                                    {alb.photoCount.toLocaleString('th-TH')}
                                  </span>{' '}
                                  {tx("ภาพ")}
                                </div>
                              </div>
                              <span className="status-pill badge-forest">
                                <IconCamera size={13} />
                                <span>{tx("ตรวจสอบแล้ว")}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </section>

                {/* SECTION 6: MERCHANDISE STOREFRONT PREVIEW */}
                {selectedEvent.products.length > 0 && (
                  <section id="sec-merch-preview" className="clean-panel">
                    <div className="section-title-bar">
                      <div>
                        <h2>
                          {tx("ของที่ระลึกประจำงาน (")}{tx(selectedEvent.products.length)}{' '}
                          {tx("รายการ — ลูกค้าทั่วไปซื้อได้โดยไม่ต้องสมัครวิ่ง)")}
                        </h2>
                        <p className="muted-inline">
                          {tx("คำสั่งซื้อสินค้าที่ระลึกจะแยกออกจากใบสมัครวิ่ง และรับของด้วยรหัสรับสินค้าเฉพาะ")}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setShowRegForm(false);
                          setDetailTab('storefront');
                        }}
                      >
                        <IconBag size={15} />
                        <span>{tx("เปิดหน้าร้านค้าของงาน")}</span>
                      </button>
                    </div>

                    <div className="form-grid-2">
                      {selectedEvent.products.map((prd) => {
                        const left = Math.max(
                          0,
                          prd.stockOrCeiling - prd.soldCount
                        );
                        return (
                          <div key={prd.id} className="racepack-item-card">
                            <div className="section-title-bar">
                              <strong>{tx(prd.nameTh)}</strong>
                              <strong className="mono-num text-vermilion">
                                {formatThb(prd.priceSatang, true)}
                              </strong>
                            </div>
                            <p className="muted-inline">{tx(prd.description)}</p>
                            <div className="cta-inline-row">
                              <span className="mono-code">
                                {tx("คงเหลือ ")} {tx(left)}/{tx(prd.stockOrCeiling)} {tx(" ชิ้น")}
                              </span>
                              <button
                                type="button"
                                className="btn-ghost-sm"
                                onClick={() => {
                                  setActiveProductId(prd.id);
                                  setShowRegForm(false);
                                  setDetailTab('storefront');
                                }}
                              >
                                {tx("เลือกซื้อรายการนี้")}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
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
                          const missingField = (
                            selectedEvent.customFields ?? []
                          ).find((f) => {
                            if (!f.required) return false;
                            const isVisible = evaluateConditionRule(
                              f.visibilityCondition,
                              customAnswers,
                              {
                                raceDistance: activeCategory?.code,
                                shirtSize,
                              }
                            );
                            if (!isVisible) return false;
                            const val = customAnswers[f.id] ?? f.defaultValue;
                            if (f.type === 'checkbox') return val !== true;
                            return !String(val ?? '').trim();
                          });
                          if (missingField) {
                            setStep2Error(
                              txf("กรุณาระบุ \"{0}\" ให้ครบก่อนไปขั้นตอนถัดไป", missingField.label)
                            );
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
                      const addonSatang = selectedAddonProduct
                        ? selectedAddonProduct.priceSatang
                        : 0;
                      const grandTotal = quote.runnerNetPaySatang + addonSatang;

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
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => submitRegistrationOrder(false)}
                          >
                            <IconClock size={15} />
                            <span>{tx("ชำระภายหลัง (กันโควตา 30 นาที)")}</span>
                          </button>
                          <button type="submit" className="btn-cta-accent">
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
              <section className="clean-panel">
                <h2>
                  {tx("หน้าร้านประจำงานวิ่ง (ลูกค้าทั่วไปซื้อได้โดยไม่เกิดใบสมัครวิ่ง)")}
                </h2>
            <p className="muted-block">
              {tx("ระบุผู้ขาย สถานะพร้อมขาย/พรีออเดอร์ เพดานขั้นต่ำ วันปิดรับ และผู้รับผิดชอบจัดส่งอย่างชัดเจนในทุกรายการ")}
              {linkedRegForMerch && (
                <>
                  {' '}
                  {tx("· กำลังสั่งซื้อเพิ่มโดยอ้างอิงใบสมัครเดิม")}{' '}
                  <span className="mono-code">{tx(linkedRegForMerch)}</span>{' '}
                  {tx("(สร้างคำสั่งซื้อใหม่แยกจากยอดใบสมัครเดิม)")}
                </>
              )}
            </p>

            {selectedEvent.products.length === 0 ? (
              <div className="subtle-empty-note">
                {tx("งานวิ่งนี้ยังไม่ได้เปิดรายการสินค้าหน้าร้านเพิ่มเติม")}
              </div>
            ) : (
              <div className="storefront-split">
                <div className="merch-catalog-list">
                  {selectedEvent.products.map((prd) => {
                    const remaining = Math.max(
                      0,
                      prd.stockOrCeiling - prd.soldCount
                    );
                    const isPicked = activeProduct?.id === prd.id;
                    return (
                      <article
                        key={prd.id}
                        className={`merch-card-item ${
                          isPicked ? 'selected' : ''
                        }`}
                      >
                        <div className="merch-item-head">
                          <span className="status-pill badge-navy">
                            <IconShirt size={13} />
                            <span>{tx(prd.categoryLabel)}</span>
                          </span>
                          <span
                            className={`status-pill ${
                              prd.saleMode === 'ready_stock'
                                ? 'badge-forest'
                                : 'badge-amber'
                            }`}
                          >
                            <span>
                              {prd.saleMode === 'ready_stock'
                                ? tx("พร้อมขายตามสต็อก")
                                : txf("พรีออเดอร์ · ปิดรับ {0}", prd.preorderCloseDate)}
                            </span>
                          </span>
                        </div>

                        <h3>{tx(prd.nameTh)}</h3>
                        <p className="muted-block">{tx(prd.description)}</p>

                        <div className="merch-policy-meta">
                          <div>
                            <strong>{tx(prd.sellerLabel)}</strong> ·{' '}
                            {tx(prd.fulfillmentOwnerLabel)}
                          </div>
                          <div>{tx("กำหนดส่งมอบ:")} {tx(prd.estimatedDeliveryNote)}</div>
                          <div>{tx("เงื่อนไข:")} {tx(prd.refundAndMinPolicyNote)}</div>
                        </div>

                        <div className="merch-item-foot">
                          <div>
                            <strong className="net-price-figure mono-num">
                              {formatThb(prd.priceSatang)}
                            </strong>
                            <span className="muted-inline mono-num">
                              {' '}
                              {tx("· คงเหลือ ")} {tx(remaining)}/{tx(prd.stockOrCeiling)} {tx(" ชิ้น")}
                              {prd.preorderMinQty
                                ? txf(" (ยอดจองปัจจุบัน {0}/{1} ขั้นต่ำ)", prd.soldCount, prd.preorderMinQty)
                                : ''}
                            </span>
                          </div>
                          <button
                            type="button"
                            className={
                              isPicked ? 'btn-primary' : 'btn-secondary'
                            }
                            onClick={() => {
                              setActiveProductId(prd.id);
                              setMerchSize(prd.availableSizes[0] ?? 'M');
                              setCreatedMerchReceipt(null);
                            }}
                          >
                            {isPicked ? tx("เลือกอยู่") : tx("เลือกสินค้านี้")}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {activeProduct && (
                  <form
                    className="merch-order-panel"
                    onSubmit={handleMerchSubmit}
                  >
                    <h3>{tx("สรุปคำสั่งซื้อสินค้า")}</h3>
                    <p className="muted-inline">
                      {tx("สินค้า: ")} <strong>{tx(activeProduct.nameTh)}</strong>
                    </p>

                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="sf-size">{tx("ขนาด / ตัวเลือก")}</label>
                        <select
                          id="sf-size"
                          value={merchSize}
                          onChange={(e) => setMerchSize(e.target.value)}
                        >
                          {activeProduct.availableSizes.map((sz) => (
                            <option key={sz} value={sz}>
                              {tx(sz)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-row">
                        <label htmlFor="sf-qty">{tx("จำนวน")}</label>
                        <select
                          id="sf-qty"
                          value={merchQty}
                          onChange={(e) => setMerchQty(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {tx(n)} {tx(" ชิ้น")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="sf-deliv">{tx("ช่องทางรับสินค้า")}</label>
                      <select
                        id="sf-deliv"
                        value={
                          selectedEvent.status === 'completed'
                            ? 'postal_shipping'
                            : deliveryMethod
                        }
                        disabled={selectedEvent.status === 'completed'}
                        onChange={(e) =>
                          setDeliveryMethod(
                            e.target.value as
                              | 'pickup_at_expo'
                              | 'postal_shipping'
                          )
                        }
                      >
                        <option value="pickup_at_expo">
                          {tx("รับที่บูธร้านค้าหน้างานด้วยหลักฐานคำสั่งซื้อ (ฟรีค่าส่ง)")}
                        </option>
                        <option value="postal_shipping">
                          {tx("จัดส่งทางไปรษณีย์ (+")}
                          {formatThb(activeProduct.shippingFeeSatang)})
                        </option>
                      </select>
                    </div>

                    {(selectedEvent.status === 'completed' ||
                      deliveryMethod === 'postal_shipping') && (
                      <div className="form-row">
                        <label htmlFor="sf-addr">{tx("ที่อยู่สำหรับจัดส่งพัสดุ")}</label>
                        <input
                          id="sf-addr"
                          type="text"
                          value={merchAddress}
                          onChange={(e) => setMerchAddress(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div className="price-breakdown-box">
                      <div className="breakdown-line">
                        <span>{tx("ค่าสินค้า (")}{tx(merchQty)} {tx(" ชิ้น)")}</span>
                        <span className="mono-num">
                          {formatThb(activeProduct.priceSatang * merchQty, true)}
                        </span>
                      </div>
                      <div className="breakdown-line">
                        <span>{tx("ค่าจัดส่ง")}</span>
                        <span className="mono-num">
                          {formatThb(
                            selectedEvent.status === 'completed' ||
                              deliveryMethod === 'postal_shipping'
                              ? activeProduct.shippingFeeSatang
                              : 0,
                            true
                          )}
                        </span>
                      </div>
                      <div className="breakdown-line breakdown-total">
                        <strong>{tx("ยอดรวมคำสั่งซื้อนี้")}</strong>
                        <strong className="mono-num text-vermilion">
                          {formatThb(
                            activeProduct.priceSatang * merchQty +
                              (selectedEvent.status === 'completed' ||
                              deliveryMethod === 'postal_shipping'
                                ? activeProduct.shippingFeeSatang
                                : 0),
                            true
                          )}
                        </strong>
                      </div>
                    </div>

                    {!currentUser ? (
                      <button
                        type="button"
                        className="btn-primary btn-full"
                        onClick={() =>
                          onRequireLoginWithIntent({
                            surface: 'events',
                            eventId: selectedEvent.id,
                            eventTab: 'storefront',
                            label: `สั่งซื้อ ${activeProduct.nameTh}`,
                          })
                        }
                      >
                        <IconLock size={15} />
                        <span>{tx("เข้าสู่ระบบเพื่อสั่งซื้อสินค้า")}</span>
                      </button>
                    ) : (
                      <button type="submit" className="btn-primary btn-full">
                        <IconBag size={16} />
                        <span>{tx("ยืนยันคำสั่งซื้อและชำระเงิน")}</span>
                      </button>
                    )}

                      {createdMerchReceipt && (
                        <div className="success-callout" role="status">
                          <IconCheckCircle size={18} />
                          <div>
                            <strong>
                              {tx("สร้างคำสั่งซื้อ")}{' '}
                              {tx(createdMerchReceipt.merchOrderCode)} {tx(" สำเร็จ")}
                            </strong>
                            <p>
                              {tx("รหัสรับของ:")}{' '}
                              <code>{tx(createdMerchReceipt.pickupToken)}</code>{' '}
                              {tx("(คำสั่งซื้อนี้ไม่สร้างสิทธิ์แข่งขันหรือเลข BIB)")}
                            </p>
                          </div>
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}
              </section>
            )}
          </div>

          {/* RIGHT COLUMN: STICKY EVENT SUMMARY & REGISTER SIDEBAR */}
          <aside
            className="event-sticky-aside"
            aria-label={tx("สรุปข้อมูลสำคัญและปุ่มสมัครงานวิ่งแบบเกาะตามหน้าจอ")}
          >
            <div className="sticky-register-card">
              <div className="sticky-card-head">
                <EventStatusBadge status={selectedEvent.status} />
                <span className="mono-code">{tx(selectedEvent.code)}</span>
              </div>

              <h2>{tx(selectedEvent.titleTh)}</h2>

              <dl className="sticky-key-facts">
                <div>
                  <dt>{tx("วันแข่งขัน")}</dt>
                  <dd className="mono-num">{tx(selectedEvent.eventDate)}</dd>
                </div>
                <div>
                  <dt>{tx("สถานที่")}</dt>
                  <dd>
                    {tx("จ.")}{tx(selectedEvent.province)} · {tx(selectedEvent.venue)}
                  </dd>
                </div>
              </dl>

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
                      onClick={() =>
                        startRegistrationForCategory(stickyCategory?.id)
                      }
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
                    onClick={() => jumpToEditorialSection('sec-venue-rules')}
                  >
                    <IconCamera size={16} />
                    <span>
                      {selectedEvent.status === 'completed'
                        ? tx("ดูผลการแข่งขัน & รูปภาพหลังงาน")
                        : tx("ดูสถานะและรายละเอียดงาน")}
                    </span>
                  </button>
                )}

                {selectedEvent.products.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary btn-full"
                    onClick={() => {
                      setShowRegForm(false);
                      setDetailTab(
                        !showRegForm && detailTab === 'storefront'
                          ? 'info_results'
                          : 'storefront'
                      );
                    }}
                  >
                    <IconBag size={15} />
                    <span>
                      {!showRegForm && detailTab === 'storefront'
                        ? tx("กลับไปอ่านรายละเอียดงานวิ่ง")
                        : txf("ซื้อเสื้อ/ของที่ระลึก ({0} รายการ)", selectedEvent.products.length)}
                    </span>
                  </button>
                )}
              </div>

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

              {selectedEvent.categories.length > 0 && stickyCategory && (
                <div className="sticky-category-picker">
                  <div className="sticky-selected-cat-summary">
                    <div className="section-title-bar">
                      <strong>{tx(stickyCategory.name)}</strong>
                      <span className="mono-code">
                        {tx("ว่าง ")} {tx(stickyCatOpen)}/{tx(stickyCategory.categoryQuota)}
                      </span>
                    </div>
                    <div className="muted-inline">
                      {tx("ปล่อยตัว")}{' '}
                      <span className="mono-num">
                        {tx(stickyCategory.startTimeLocal)} {tx(" น.")}
                      </span>{' '}
                      · Cut-off{' '}
                      <span className="mono-num">
                        {tx(stickyCategory.cutoffHours)} {tx(" ชม.")}
                      </span>
                    </div>

                    {stickyQuote && stickyTier && (
                      <div className="sticky-price-row">
                        <div>
                          <span className="muted-inline">
                            {tx("ราคาสุทธิ (")}{tx(stickyTier.label)})
                          </span>
                          <div className="muted-inline">
                            {selectedEvent.feeBearerPolicy ===
                            'organizer_absorbs'
                              ? tx("ผู้จัดรับภาระค่าบริการแทนนักวิ่ง")
                              : tx("รวมค่าบริการแพลตฟอร์มแล้ว")}
                          </div>
                        </div>
                        <strong className="sticky-price-big mono-num text-vermilion">
                          {formatThb(stickyQuote.runnerNetPaySatang, true)}
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="sticky-quick-jumps">
                <span className="muted-inline">{tx("หัวข้อในหน้านี้:")}</span>
                <div className="cta-inline-row">
                  <button
                    type="button"
                    className="footer-text-link"
                    onClick={() => jumpToEditorialSection('sec-categories')}
                  >
                    {tx("ระยะและราคา")}
                  </button>
                  <button
                    type="button"
                    className="footer-text-link"
                    onClick={() => jumpToEditorialSection('sec-racepack')}
                  >
                    {tx("เสื้อและตารางไซส์")}
                  </button>
                  <button
                    type="button"
                    className="footer-text-link"
                    onClick={() => jumpToEditorialSection('sec-schedule')}
                  >
                    {tx("กำหนดการ")}
                  </button>
                  <button
                    type="button"
                    className="footer-text-link"
                    onClick={() => jumpToEditorialSection('sec-venue-rules')}
                  >
                    {tx("กติกาและสถานที่")}
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    );
  }

  /* ================= SUBVIEW 1: MODERN MINIMAL DIRECTORY ================= */
  return (
    <main className="customer-container">
      <section className="minimal-hero">
        <div className="minimal-hero-copy">
          <h1>{tx("ค้นหางานวิ่งทั่วไทย สมัครง่าย เห็นราคาสุทธิชัดเจนก่อนจ่าย")}</h1>
          <p className="muted-block">
            {tx("ลงสมัครงานวิ่งพร้อมรับบัตร QR รับอุปกรณ์หน้างาน หรือเลือกซื้อเสื้อและเหรียญที่ระลึกจากหน้าร้านแต่ละงานได้ทันทีโดยไม่ต้องสมัครแข่ง")}
          </p>
        </div>

        <div className="minimal-hero-search">
          <label htmlFor="dir-q" className="field-caption">
            {tx("ค้นหาชื่องานวิ่ง จังหวัด หรือสถานที่ปล่อยตัว")}
          </label>
          <div className="input-with-icon">
            <IconSearch size={17} />
            <input
              id="dir-q"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tx("พิมพ์ชื่อจังหวัดหรือชื่องาน เช่น เชียงใหม่, ภูเก็ต...")}
            />
          </div>

          <div className="quick-pill-bar" role="group" aria-label={tx("หมวดงานวิ่ง")}>
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
                className={`filter-pill ${quickFilter === k ? 'active' : ''}`}
                onClick={() => setQuickFilter(k)}
              >
                {tx(lbl)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="clean-filter-strip" aria-label={tx("ตัวกรองระยะทางและภูมิภาค")}>
        <div className="inline-select-group">
          <div className="inline-select-item">
            <label htmlFor="flt-dist">{tx("ระยะทาง")}</label>
            <select
              id="flt-dist"
              value={distanceFilter}
              onChange={(e) => setDistanceFilter(e.target.value)}
            >
              <option value="all">{tx("ทุกระยะทาง")}</option>
              <option value="5k">Fun Run ~ 5 km</option>
              <option value="10k">Mini Marathon 10 km</option>
              <option value="21k">Half Marathon 21.1 km</option>
              <option value="trail">Trail Running</option>
            </select>
          </div>

          <div className="inline-select-item">
            <label htmlFor="flt-reg">{tx("ภูมิภาค")}</label>
            <select
              id="flt-reg"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="all">{tx("ทุกภูมิภาค")}</option>
              <option value="เหนือ">{tx("ภาคเหนือ")}</option>
              <option value="ใต้">{tx("ภาคใต้")}</option>
              <option value="กลางและกรุงเทพฯ">{tx("ภาคกลางและกรุงเทพฯ")}</option>
              <option value="อีสาน">{tx("ภาคอีสาน")}</option>
            </select>
          </div>
        </div>

        <span className="muted-inline">
          {tx("พบ ")} <strong className="mono-num">{tx(filteredEvents.length)}</strong> {tx(" งานวิ่ง")}
        </span>
      </section>

      {filteredEvents.length === 0 ? (
        <div className="empty-state-box">
          <h2>{tx("ไม่พบงานวิ่งตามตัวกรองที่เลือก")}</h2>
          <p>{tx("สามารถล้างตัวกรองเพื่อดูงานวิ่งทั้งหมดที่เปิดแสดงผลได้ทันที")}</p>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setSearchQuery('');
              setQuickFilter('all');
              setDistanceFilter('all');
              setRegionFilter('all');
            }}
          >
            {tx("ล้างตัวกรองทั้งหมด")}
          </button>
        </div>
      ) : (
        <section className="modern-event-grid" aria-label={tx("รายการงานวิ่ง")}>
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
              <article key={ev.id} className="modern-event-card">
                <div
                  className="card-artwork-wrap"
                  onClick={() => openEventPage(ev, 'register')}
                >
                  <EventCoverMedia
                    event={ev}
                    className="card-cover-svg"
                  />
                  <div className="card-floating-status">
                    <EventStatusBadge status={ev.status} />
                  </div>
                </div>

                <div className="card-body-content">
                  <div className="card-date-loc">
                    <span>
                      <IconCalendar size={14} />{' '}
                      <strong className="mono-num">{tx(ev.eventDate)}</strong>
                    </span>
                    <span>
                      <IconMapPin size={14} /> {tx(ev.province)}
                    </span>
                    <span className="race-type-tag">{tx(ev.raceType)}</span>
                  </div>

                  <h2>{tx(ev.titleTh)}</h2>
                  <p className="card-tagline">{tx(ev.tagline)}</p>

                  <div className="category-chip-group">
                    {ev.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className={`category-bib-chip tone-${cat.colorTag}`}
                      >
                        <strong>{tx(cat.code)}</strong>
                      </span>
                    ))}
                    {ev.products.length > 0 && (
                      <span className="shop-available-pill">
                        <IconBag size={13} />
                        <span>{tx("ร้านเสื้อ/เหรียญ (")}{tx(ev.products.length)} {tx(" รายการ)")}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-footer-bar">
                  <div className="card-price-block">
                    {sampleQuote && (
                      <>
                        <span className="muted-inline">
                          {tx("เริ่มต้นสุทธิ")}{' '}
                          {ev.feeBearerPolicy === 'organizer_absorbs'
                            ? tx("(ฟรีค่าบริการ)")
                            : tx("(รวมค่าบริการ)")}
                        </span>
                        <strong className="card-price-num mono-num">
                          {formatThb(sampleQuote.runnerNetPaySatang, true)}
                        </strong>
                      </>
                    )}
                    <small className="muted-inline mono-num">
                      {tx("ว่าง ")} {tx(openSeats)}/{tx(ev.totalEventQuota)} {tx(" สิทธิ์")}
                    </small>
                  </div>

                  <div className="card-actions">
                    {ev.products.length > 0 && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => openEventPage(ev, 'storefront')}
                      >
                        {tx("ร้านค้างาน")}
                      </button>
                    )}
                    <button
                      type="button"
                      className={
                        ev.status === 'published'
                          ? 'btn-primary'
                          : 'btn-secondary'
                      }
                      onClick={() =>
                        openEventPage(
                          ev,
                          ev.status === 'published'
                            ? 'register'
                            : 'info_results'
                        )
                      }
                    >
                      <span>
                        {ev.status === 'published'
                          ? tx("รายละเอียด & สมัครวิ่ง")
                          : ev.status === 'completed'
                          ? tx("ผล & รูปภาพ")
                          : tx("รายละเอียดงาน")}
                      </span>
                      <IconArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Banner for Club / Company Custom Shirt & Medal Production without Race Event */}
      <section
        className="custom-order-callout"
        aria-label={tx("บริการสั่งทำเสื้อและเหรียญสำหรับชมรมหรือองค์กร")}
      >
        <div>
          <h2>{tx("ต้องการสั่งทำเสื้อวิ่งหรือเหรียญที่ระลึกสำหรับชมรม ทีม หรือกิจกรรมบริษัท?")}</h2>
          <p className="muted-block">
            {tx("ส่งแบบหรือความต้องการเพื่อขอใบเสนอราคาผลิตกับทีมงานได้โดยไม่จำเป็นต้องเปิดงานวิ่งบนแพลตฟอร์ม")}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onNavigate('custom_production', null)}
        >
          <IconShirt size={16} />
          <span>{tx("ขอใบเสนอราคาสั่งผลิต")}</span>
        </button>
      </section>
    </main>
  );
};
