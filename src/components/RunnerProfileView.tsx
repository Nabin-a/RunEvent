import { PhoneInput } from './PhoneInput';
import { MascotAnim } from './MascotAnim';
import personalMascot from '../assets/mascot/profile/personal.webp';
import emergencyMascot from '../assets/mascot/profile/emergency.webp';
import addressesMascot from '../assets/mascot/profile/addresses.webp';
import participantsMascot from '../assets/mascot/profile/participants.webp';
import historyMascot from '../assets/mascot/profile/history.webp';
import connectionsMascot from '../assets/mascot/profile/connections.webp';
import privacyMascot from '../assets/mascot/profile/privacy.webp';
import { RequiredFieldText } from './RequiredFieldText';
import { useThemeId } from '../theme';
import { themedMascot } from './mascotArt';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import type {
  AuthProviderType,
  Organization,
  PlatformProfileConfig,
  RaceEvent,
  RegistrationRecord,
  RunnerEmergencyContact,
  RunnerNotificationPrefs,
  RunnerProfileData,
  RunnerSavedAddress,
  SavedParticipant,
  ShirtCutType,
  ShirtFitType,
  TeamInvitation,
  UserAccount,
} from '../types';
import {
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PLATFORM_PROFILE_CONFIG,
  enrichSocialLinksFromIdentities,
  evaluatePersonalInfoCompletion,
  MAX_EMERGENCY_CONTACTS,
} from '../data/runnerProfileDefaults';
import { ProfileCompletionRing } from './ProfileCompletionMeter';
import { FEATURES } from '../config/features';
import {
  AccountSecuritySections,
  ConnectionsPanel,
  PrivacyPanel,
} from './AccountSettingsPanels';
import {
  IconAlert,
  IconArrowRight,
  IconAward,
  IconBib,
  IconBuilding,
  IconCalendar,
  IconCamera,
  IconCheckCircle,
  IconChevronDown,
  IconDownload,
  IconLock,
  IconMapPin,
  IconPlus,
  IconQr,
  IconUsers,
  IconShirt,
} from './Icons';
import {
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  RegStatusBadge,
} from './StatusBadges';
import { DateOfBirthInput } from './DateOfBirthInput';
import { AvatarCropDialog } from './AvatarCropDialog';
import { AVATAR_MAX_FILE_BYTES, readImageFile } from '../utils/avatarFile';
import { NationalitySelect } from './NationalitySelect';
import { SelectMenu } from './SelectMenu';
import { ThaiPostalAddressSelector } from './ThaiPostalAddressSelector';
import { SavedAddressModal, type SavedAddressDraft } from './SavedAddressModal';
import { EmergencyContactModal, type EmergencyContactDraft } from './EmergencyContactModal';
import { SavedParticipantModal } from './SavedParticipantModal';
import { SearchPagedList } from './ListPager';
import { ALL_THAI_PROVINCES } from '../data/thaiPostalAddresses';
import {
  isoToDdMmYyyy,
  sanitizeEnglishNameInput,
  sanitizeThaiNameInput,
} from '../utils/dateFormat';
import { getLang, tx, txf } from '../i18n';
import { ageBreakdownOn, formatAgeGroupLabel, formatBasisDate, todayIsoInTimeZone } from '../utils/age';
import { IdNumberInput } from './IdNumberInput';
import { DefaultAvatarImg } from './DefaultAvatar';

/** Profile menu artwork (one still per menu), drawn at one scale so the rabbit matches across menus. */
const PROFILE_MASCOTS: Record<string, { src: string; w: number; h: number }> = {
  personal: { src: personalMascot, w: 182, h: 300 },
  emergency: { src: emergencyMascot, w: 169, h: 300 },
  addresses: { src: addressesMascot, w: 195, h: 285 },
  participants: { src: participantsMascot, w: 163, h: 300 },
  history: { src: historyMascot, w: 203, h: 300 },
  connections: { src: connectionsMascot, w: 159, h: 300 },
  privacy: { src: privacyMascot, w: 147, h: 300 },
};


function localizeCountryName(raw?: string): string {
  const v = (raw ?? '').trim();
  if (!v) return '';
  if (getLang() === 'en') {
    const thToEn: Record<string, string> = {
      ไทย: 'Thailand',
      ประเทศไทย: 'Thailand',
      ญี่ปุ่น: 'Japan',
      สิงคโปร์: 'Singapore',
      มาเลเซีย: 'Malaysia',
    };
    return thToEn[v] ?? v;
  }
  const enToTh: Record<string, string> = {
    thailand: 'ไทย',
    japan: 'ญี่ปุ่น',
    singapore: 'สิงคโปร์',
    malaysia: 'มาเลเซีย',
    other: 'ประเทศอื่น ๆ',
  };
  return enToTh[v.toLowerCase()] ?? v;
}

export type RunnerProfileTab =
  | 'personal'
  | 'emergency'
  | 'addresses'
  | 'participants'
  | 'history'
  | 'organizer'
  | 'security'
  | 'privacy';


/** the saved-runner dialog is open for a new person, not an existing one */
const NEW_PARTICIPANT_ID = '__new__';

/** Reads the picked image for the crop dialog (the dialog makes the final 320 px square). */
function downloadFinisherCertificateSvg(params: {
  runnerName: string;
  eventTitle: string;
  eventDate: string;
  distanceLabel: string;
  bibNumber: string;
  chipTime: string;
  gunTime: string;
  pace: string;
  rank: string;
  certCode: string;
}) {
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="840" viewBox="0 0 1200 840">
  <rect width="1200" height="840" fill="#f7f8fa"/>
  <rect x="44" y="44" width="1112" height="752" rx="16" fill="#ffffff" stroke="#34495f" stroke-width="3"/>
  <rect x="44" y="44" width="1112" height="96" rx="14" fill="#34495f"/>
  <text x="96" y="102" fill="#f8fafc" font-family="Anuphan, sans-serif" font-size="28" font-weight="700">KRATAI · OFFICIAL FINISHER CERTIFICATE</text>
  <text x="1104" y="102" text-anchor="end" fill="#cbd5e1" font-family="Anuphan, sans-serif" font-size="18">${esc(params.certCode)}</text>
  <text x="600" y="220" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="22">ขอรับรองว่านักวิ่งผู้เข้าแข่งขัน</text>
  <text x="600" y="290" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="46" font-weight="700">${esc(params.runnerName)}</text>
  <line x1="280" y1="322" x2="920" y2="322" stroke="#cbd5e1" stroke-width="2"/>
  <text x="600" y="382" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="30" font-weight="700">${esc(params.eventTitle)}</text>
  <text x="600" y="424" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="20">วันที่แข่งขัน: ${esc(params.eventDate)} · ระยะทาง: ${esc(params.distanceLabel)}</text>
  <rect x="140" y="476" width="920" height="156" rx="12" fill="#f1f4f8" stroke="#cbd5e1"/>
  <text x="255" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">หมายเลข BIB</text>
  <text x="255" y="578" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="30" font-weight="700">${esc(params.bibNumber)}</text>
  <text x="485" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">เวลาสุทธิ (Chip Time)</text>
  <text x="485" y="578" text-anchor="middle" fill="#157347" font-family="Anuphan, sans-serif" font-size="30" font-weight="700">${esc(params.chipTime)}</text>
  <text x="715" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">เฉลี่ยฝีเท้า (Pace)</text>
  <text x="715" y="578" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="28" font-weight="700">${esc(params.pace)}</text>
  <text x="945" y="528" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">อันดับรวม (Overall)</text>
  <text x="945" y="578" text-anchor="middle" fill="#34495f" font-family="Anuphan, sans-serif" font-size="26" font-weight="700">${esc(params.rank)}</text>
  <text x="600" y="720" text-anchor="middle" fill="#475569" font-family="Anuphan, sans-serif" font-size="16">Gun Time: ${esc(params.gunTime)} · Verified Official Result by Kratai Timing Ledger</text>
</svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.certCode}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface RunnerProfileViewProps {
  user: UserAccount;
  initialTab?: RunnerProfileTab;
  events: RaceEvent[];
  organizations: Organization[];
  registrations: RegistrationRecord[];
  invitations: TeamInvitation[];
  platformProfileConfig?: PlatformProfileConfig;
  onSaveProfile: (
    profile: RunnerProfileData,
    names?: { fullNameTh?: string; fullNameEn?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
  onOpenEmailVerifyPage: (email: string) => void;
  /** Used while FEATURES.emailVerification is off: saves the contact email directly. */
  onSaveContactEmail?: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifiedEmailNotice?: string | null;
  onClearVerifiedEmailNotice?: () => void;
  onSetOrChangePassword: (
    newPassword: string,
    grant: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onRequestPasswordCode: () => Promise<{ ok: boolean; error?: string; sentTo?: string }>;
  onVerifyPasswordCode: (
    otp: string
  ) => Promise<{ ok: boolean; error?: string; grant?: string }>;
  onLinkProvider: (provider: 'google' | 'line' | 'facebook') => void;
  onUnlinkProvider: (
    provider: AuthProviderType
  ) => { ok: boolean; error?: string };
  onRevokeOtherSessions: () => void;
  onRevokeSession: (sessionId: string) => Promise<{ ok: boolean; error?: string }>;
  onSetMarketingConsent: (granted: boolean) => Promise<{ ok: boolean; error?: string }>;
  onAcceptTeamInvitation: (code: string) => { ok: boolean; message: string };
  onApplyNewOrganizerOrg: (orgNameTh: string, province: string) => Organization;
  onEnterOrganizerOrg: (orgId: string) => void;
  onManageAccountStatus: (
    action: 'deactivate' | 'request_deletion' | 'cancel_deletion',
    reason?: string,
    confirmCode?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onNavigateDiscoverEvents: () => void;
  onNavigateEventDetail: (eventId: string) => void;
  onPersonalDirtyChange?: (dirty: boolean) => void;
  discardSignal?: number;
}

/**
 * Briefly draws attention to a field the runner was sent to from the completion
 * checklist: amber pulses that fade out (static fade with reduced motion).
 * Radio groups and the address block flash as a whole ([data-flash-group]).
 */
const FLASH_MS = 2400;
function flashFieldAttention(el: HTMLElement) {
  const target = el.closest<HTMLElement>('[data-flash-group]') ?? el;
  target.removeAttribute('data-attention-flash');
  // restart the animation when the same field is requested twice in a row
  void target.offsetWidth;
  target.setAttribute('data-attention-flash', '');
  window.setTimeout(() => target.removeAttribute('data-attention-flash'), FLASH_MS);
}

export const RunnerProfileView: React.FC<RunnerProfileViewProps> = ({
  user,
  initialTab: rawInitialTab = 'personal',
  events,
  organizations,
  registrations,
  platformProfileConfig = DEFAULT_PLATFORM_PROFILE_CONFIG,
  onSaveProfile,
  onOpenEmailVerifyPage,
  onSaveContactEmail,
  verifiedEmailNotice = null,
  onClearVerifiedEmailNotice,
  onSetOrChangePassword,
  onRequestPasswordCode,
  onVerifyPasswordCode,
  onLinkProvider,
  onUnlinkProvider,
  onSetMarketingConsent,
  onAcceptTeamInvitation,
  onApplyNewOrganizerOrg,
  onEnterOrganizerOrg,
  onNavigateDiscoverEvents,
  onNavigateEventDetail,
  onPersonalDirtyChange,
  discardSignal = 0,
}) => {
  const theme = useThemeId();
  // 'security' (old /account/security target) now lives inside the Privacy & data page.
  const initialTab: RunnerProfileTab =
    rawInitialTab === 'security' ? 'privacy' : rawInitialTab;
  const [activeTab, setActiveTab] = useState<RunnerProfileTab>(initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [banner, setBanner] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  const lastHandledDiscardRef = useRef(discardSignal);

  useEffect(() => {
    if (discardSignal !== lastHandledDiscardRef.current) {
      lastHandledDiscardRef.current = discardSignal;
      resetPersonalFormToSaved();
      setBanner(null);
      setMobileNavOpen(false);
      setActiveTab(initialTab);
      return;
    }
    if (initialTab !== activeTab) {
      requestSwitchProfileTab(initialTab);
    } else {
      setMobileNavOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab, discardSignal]);

  const prof = user.runnerProfile ?? {};
  const nameParts = user.fullNameTh.trim().split(/\s+/);
  const enParts = /^[A-Za-z.\s-]+$/.test(user.fullNameEn ?? '')
    ? (user.fullNameEn ?? '').trim().split(/\s+/)
    : [];

  /* ---- 1. Personal Information State ---- */
  const [avatarUrl, setAvatarUrl] = useState(prof.avatarDataUrl ?? '');
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(
    prof.firstName ?? sanitizeThaiNameInput(nameParts[0] ?? '').trim()
  );
  const [lastName, setLastName] = useState(
    prof.lastName ?? sanitizeThaiNameInput(nameParts.slice(1).join(' ')).trim()
  );
  const [nickname, setNickname] = useState(prof.nickname ?? '');
  const [firstNameEn, setFirstNameEn] = useState(
    prof.firstNameEn ?? enParts[0] ?? ''
  );
  const [lastNameEn, setLastNameEn] = useState(
    prof.lastNameEn ?? enParts.slice(1).join(' ') ?? ''
  );
  const [nicknameEn, setNicknameEn] = useState(prof.nicknameEn ?? '');
  const [dob, setDob] = useState(prof.dateOfBirth ?? '');
  const [gender, setGender] = useState<'ชาย' | 'หญิง' | 'ไม่ระบุ'>(
    prof.gender ?? 'ไม่ระบุ'
  );
  const [nationality, setNationality] = useState(prof.nationality ?? 'Thailand');
  const [idType, setIdType] = useState<'none' | 'thai_id' | 'passport'>(
    prof.idType && prof.idType !== 'none' ? prof.idType : 'thai_id'
  );
  const [idNumber, setIdNumber] = useState(prof.idNumber ?? '');

  const [country, setCountry] = useState(prof.country ?? 'Thailand');
  const [province, setProvince] = useState(prof.province ?? 'เชียงใหม่');
  const [district, setDistrict] = useState(
    prof.district ?? 'เมืองเชียงใหม่'
  );
  const [subdistrict, setSubdistrict] = useState(prof.subdistrict ?? 'สุเทพ');
  const [postalCode, setPostalCode] = useState(prof.postalCode ?? '50200');
  const [streetAddress, setStreetAddress] = useState(prof.address ?? '');

  // Email & Phone States
  const [emailInput, setEmailInput] = useState(user.contactEmail ?? '');
  const [phoneInput, setPhoneInput] = useState(prof.phone ?? '');

  useEffect(() => {
    setEmailInput(user.contactEmail ?? '');
  }, [user.contactEmail]);

  const showResultModalAlert = (
    ok: boolean,
    text: string,
    titleText?: string
  ) => {
    void Swal.fire({
      icon: ok ? 'success' : 'error',
      title:
        titleText ??
        (ok ? tx('บันทึกข้อมูลแล้ว') : tx('ไม่สามารถดำเนินการได้')),
      text,
      confirmButtonText: tx('ตกลง'),
      buttonsStyling: false,
      heightAuto: false,
      scrollbarPadding: false,
      customClass: {
        container: 'kratai-swal-top',
        popup: 'kratai-swal-popup',
        actions: 'kratai-swal-actions',
        confirmButton: 'btn-primary',
      },
    });
  };

  useEffect(() => {
    if (verifiedEmailNotice) {
      const msg = txf('ยืนยันอีเมล {0} สำเร็จ', verifiedEmailNotice);
      setBanner({
        tone: 'ok',
        text: msg,
      });
      showResultModalAlert(true, msg, tx('ยืนยันอีเมลแล้ว'));
      onClearVerifiedEmailNotice?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifiedEmailNotice, onClearVerifiedEmailNotice]);

  /* ---- 2. Running & Shirt Preferences State ---- */
  const enabledSizes = useMemo(
    () =>
      [...platformProfileConfig.shirtSizes]
        .filter((s) => s.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [platformProfileConfig.shirtSizes]
  );
  const [prefShirtSize, setPrefShirtSize] = useState<string>(
    prof.preferredShirtSize ?? ''
  );
  const [prefShirtType, setPrefShirtType] = useState<ShirtCutType>(
    prof.preferredShirtType ?? 'Unisex'
  );
  const [prefShirtFit, setPrefShirtFit] = useState<ShirtFitType>(
    prof.preferredShirtFit ?? 'Regular Fit'
  );
  const [prefDistances, setPrefDistances] = useState<string[]>(
    prof.preferredDistances ?? ['10 KM']
  );
  const [prefRunTypes, setPrefRunTypes] = useState<string[]>(
    prof.preferredRunningTypes ?? ['Road Race']
  );
  const [runExp, setRunExp] = useState<'Beginner' | 'Intermediate' | 'Advanced'>(
    prof.runningExperience ?? 'Intermediate'
  );
  const [runningGoal, setRunningGoal] = useState(prof.runningGoal ?? '');
  const [favEventIds, setFavEventIds] = useState<string[]>(
    prof.favoriteEventIds ?? []
  );

  /* ---- 3. Emergency Contacts State ---- */
  const initialEmergencyList: RunnerEmergencyContact[] = useMemo(() => {
    if (prof.emergencyContacts && prof.emergencyContacts.length > 0) {
      return prof.emergencyContacts;
    }
    if (prof.emergencyContactName && prof.emergencyContactPhone) {
      return [
        {
          id: 'ec-migrated-1',
          contactName: prof.emergencyContactName,
          relationship: prof.emergencyContactRelation ?? 'ครอบครัว',
          phone: prof.emergencyContactPhone,
          isPrimary: true,
        },
      ];
    }
    return [];
  }, [prof]);

  const [emergencyList, setEmergencyList] =
    useState<RunnerEmergencyContact[]>(initialEmergencyList);
  const [ecModalOpen, setEcModalOpen] = useState(false);
  const [editingEcId, setEditingEcId] = useState<string | null>(null);


  /* ---- 4. Saved Addresses State ---- */
  const [addressList, setAddressList] = useState<RunnerSavedAddress[]>(
    prof.savedAddresses ?? []
  );
  const [addrModalOpen, setAddrModalOpen] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);


  /* ---- 4.1 Saved Participants State ---- */
  const [participantList, setParticipantList] = useState<SavedParticipant[]>(
    prof.savedParticipants ?? []
  );
  const [editingPartId, setEditingPartId] = useState<string | null>(null);


  /* ---- 5. Running History State ---- */
  const [historyFilter, setHistoryFilter] = useState<
    'all' | 'upcoming' | 'past'
  >('all');
  const [expandedRegId, setExpandedRegId] = useState<string | null>(null);
  const [certPreviewReg, setCertPreviewReg] =
    useState<RegistrationRecord | null>(null);

  /* ---- 7. Social Links State (with Auto-Fill from Linked Facebook / LINE) ---- */
  const initialAutoSocial = enrichSocialLinksFromIdentities(user);
  const [fbUrl, setFbUrl] = useState(initialAutoSocial.facebook ?? '');
  const [igUrl, setIgUrl] = useState(initialAutoSocial.instagram ?? '');
  const [lineUrl, setLineUrl] = useState(initialAutoSocial.line ?? '');
  const [stravaUrl, setStravaUrl] = useState(prof.socialLinks?.strava ?? '');
  const [webUrl, setWebUrl] = useState(prof.socialLinks?.website ?? '');
  const [otherLinks, setOtherLinks] = useState<
    { id: string; label: string; url: string }[]
  >(prof.socialLinks?.otherLinks ?? []);

  /* ---- 9. Notification Preferences State ---- */
  const [notifPrefs, setNotifPrefs] = useState<RunnerNotificationPrefs>(
    prof.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS
  );

  /* ---- 8. Account & Security State ---- */
  const [inviteInput, setInviteInput] = useState('INV-LANNA-STAFF26');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgProv, setNewOrgProv] = useState('ขอนแก่น');

  // Sync local state if user switches via Dev/Demo dock
  useEffect(() => {
    const p = user.runnerProfile ?? {};
    const np = user.fullNameTh.trim().split(/\s+/);
    const ep = /^[A-Za-z.\s-]+$/.test(user.fullNameEn ?? '')
      ? (user.fullNameEn ?? '').trim().split(/\s+/)
      : [];
    setAvatarUrl(p.avatarDataUrl ?? '');
    setFirstName(
      p.firstName ?? sanitizeThaiNameInput(np[0] ?? '').trim()
    );
    setLastName(
      p.lastName ?? sanitizeThaiNameInput(np.slice(1).join(' ')).trim()
    );
    setNickname(p.nickname ?? '');
    setFirstNameEn(p.firstNameEn ?? ep[0] ?? '');
    setLastNameEn(p.lastNameEn ?? ep.slice(1).join(' ') ?? '');
    setNicknameEn(p.nicknameEn ?? '');
    setDob(p.dateOfBirth ?? '');
    setGender(p.gender ?? 'ไม่ระบุ');
    setNationality(p.nationality ?? 'Thailand');
    setIdType(p.idType && p.idType !== 'none' ? p.idType : 'thai_id');
    setIdNumber(p.idNumber ?? '');
    setCountry(p.country ?? 'Thailand');
    setProvince(p.province ?? 'เชียงใหม่');
    setDistrict(p.district ?? 'เมืองเชียงใหม่');
    setSubdistrict(p.subdistrict ?? 'สุเทพ');
    setPostalCode(p.postalCode ?? '50200');
    setStreetAddress(p.address ?? '');
    setEmailInput(user.contactEmail ?? '');
    setPhoneInput(p.phone ?? '');
    setPrefShirtSize(p.preferredShirtSize ?? '');
    setPrefShirtType(p.preferredShirtType ?? 'Unisex');
    setPrefShirtFit(p.preferredShirtFit ?? 'Regular Fit');
    setPrefDistances(p.preferredDistances ?? ['10 KM']);
    setPrefRunTypes(p.preferredRunningTypes ?? ['Road Race']);
    setRunExp(p.runningExperience ?? 'Intermediate');
    setRunningGoal(p.runningGoal ?? '');
    setFavEventIds(p.favoriteEventIds ?? []);
    setEmergencyList(
      p.emergencyContacts ??
      (p.emergencyContactName && p.emergencyContactPhone
        ? [
          {
            id: 'ec-1',
            contactName: p.emergencyContactName,
            relationship: p.emergencyContactRelation ?? 'ครอบครัว',
            phone: p.emergencyContactPhone,
            isPrimary: true,
          },
        ]
        : [])
    );
    setAddressList(p.savedAddresses ?? []);
    setParticipantList(p.savedParticipants ?? []);
    setEcModalOpen(false);
    setEditingEcId(null);
    setAddrModalOpen(false);
    setEditingAddrId(null);
    setEditingPartId(null);
    const syncedSocial = enrichSocialLinksFromIdentities(user);
    setFbUrl(syncedSocial.facebook ?? '');
    setIgUrl(syncedSocial.instagram ?? '');
    setLineUrl(syncedSocial.line ?? '');
    setStravaUrl(p.socialLinks?.strava ?? '');
    setWebUrl(p.socialLinks?.website ?? '');
    setOtherLinks(p.socialLinks?.otherLinks ?? []);
    setNotifPrefs(p.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, user.identities.length]);

  const serializedSavedParticipants = JSON.stringify(
    user.runnerProfile?.savedParticipants ?? []
  );
  const serializedSavedAddresses = JSON.stringify(
    user.runnerProfile?.savedAddresses ?? []
  );
  const serializedEmergencyContacts = JSON.stringify(
    user.runnerProfile?.emergencyContacts ?? []
  );
  useEffect(() => {
    setParticipantList(user.runnerProfile?.savedParticipants ?? []);
  }, [user.id, serializedSavedParticipants]);
  useEffect(() => {
    setAddressList(user.runnerProfile?.savedAddresses ?? []);
  }, [user.id, serializedSavedAddresses]);
  useEffect(() => {
    if (user.runnerProfile?.emergencyContacts) {
      setEmergencyList(user.runnerProfile.emergencyContacts);
    }
  }, [user.id, serializedEmergencyContacts]);

  const openEcModal = (ec?: RunnerEmergencyContact) => {
    setEditingEcId(ec ? ec.id : null);
    setEcModalOpen(true);
  };

  const closeEcModal = () => {
    setEcModalOpen(false);
    setEditingEcId(null);
  };

  const openAddrModal = (addr?: RunnerSavedAddress) => {
    setEditingAddrId(addr ? addr.id : null);
    setAddrModalOpen(true);
  };

  const closeAddrModal = () => {
    setAddrModalOpen(false);
    setEditingAddrId(null);
  };

  const openPartModal = (pt?: SavedParticipant) => {
    setEditingPartId(pt ? pt.id : NEW_PARTICIPANT_ID);
  };

  const closePartModal = () => setEditingPartId(null);

  const savedPersonalBaseline = useMemo(() => {
    const p = user.runnerProfile ?? {};
    const np = user.fullNameTh.trim().split(/\s+/);
    const ep = /^[A-Za-z.\s-]+$/.test(user.fullNameEn ?? '')
      ? (user.fullNameEn ?? '').trim().split(/\s+/)
      : [];
    return {
      avatarUrl: p.avatarDataUrl ?? '',
      firstName: p.firstName ?? sanitizeThaiNameInput(np[0] ?? '').trim(),
      lastName:
        p.lastName ?? sanitizeThaiNameInput(np.slice(1).join(' ')).trim(),
      nickname: p.nickname ?? '',
      firstNameEn: p.firstNameEn ?? ep[0] ?? '',
      lastNameEn: p.lastNameEn ?? ep.slice(1).join(' ') ?? '',
      nicknameEn: p.nicknameEn ?? '',
      dob: p.dateOfBirth ?? '',
      gender: (p.gender ?? 'ไม่ระบุ') as 'ชาย' | 'หญิง' | 'ไม่ระบุ',
      nationality: p.nationality ?? 'Thailand',
      idType: (p.idType && p.idType !== 'none' ? p.idType : 'thai_id') as
        | 'none'
        | 'thai_id'
        | 'passport',
      idNumber: p.idNumber ?? '',
      country: p.country ?? 'Thailand',
      province: p.province ?? 'เชียงใหม่',
      district: p.district ?? 'เมืองเชียงใหม่',
      subdistrict: p.subdistrict ?? 'สุเทพ',
      postalCode: p.postalCode ?? '50200',
      streetAddress: p.address ?? '',
      phoneInput: p.phone ?? '',
    };
  }, [user]);

  // After "save", the stored values (trimmed / normalised) become the form values, so leaving
  // the page right after saving does not ask to discard changes that were in fact saved.
  const resyncPersonalAfterSave = useRef(false);
  const [resyncTick, setResyncTick] = useState(0);
  useEffect(() => {
    if (!resyncPersonalAfterSave.current) return;
    resyncPersonalAfterSave.current = false;
    const b = savedPersonalBaseline;
    setAvatarUrl(b.avatarUrl);
    setFirstName(b.firstName);
    setLastName(b.lastName);
    setNickname(b.nickname);
    setFirstNameEn(b.firstNameEn);
    setLastNameEn(b.lastNameEn);
    setNicknameEn(b.nicknameEn);
    setDob(b.dob);
    setGender(b.gender);
    setNationality(b.nationality);
    setIdType(b.idType);
    setIdNumber(b.idNumber);
    setCountry(b.country);
    setProvince(b.province);
    setDistrict(b.district);
    setSubdistrict(b.subdistrict);
    setPostalCode(b.postalCode);
    setStreetAddress(b.streetAddress);
    setPhoneInput(b.phoneInput);
    setEmailInput(user.contactEmail ?? '');
  }, [savedPersonalBaseline, user.contactEmail, resyncTick]);

  const isPersonalDirty =
    avatarUrl !== savedPersonalBaseline.avatarUrl ||
    firstName !== savedPersonalBaseline.firstName ||
    lastName !== savedPersonalBaseline.lastName ||
    nickname !== savedPersonalBaseline.nickname ||
    firstNameEn !== savedPersonalBaseline.firstNameEn ||
    lastNameEn !== savedPersonalBaseline.lastNameEn ||
    nicknameEn !== savedPersonalBaseline.nicknameEn ||
    dob !== savedPersonalBaseline.dob ||
    gender !== savedPersonalBaseline.gender ||
    nationality !== savedPersonalBaseline.nationality ||
    (idNumber.trim() !== '' && idType !== savedPersonalBaseline.idType) ||
    idNumber !== savedPersonalBaseline.idNumber ||
    country !== savedPersonalBaseline.country ||
    province !== savedPersonalBaseline.province ||
    district !== savedPersonalBaseline.district ||
    subdistrict !== savedPersonalBaseline.subdistrict ||
    postalCode !== savedPersonalBaseline.postalCode ||
    streetAddress !== savedPersonalBaseline.streetAddress ||
    phoneInput !== savedPersonalBaseline.phoneInput ||
    emailInput.trim() !== (user.contactEmail ?? '');

  const effectivePersonalDirty = activeTab === 'personal' && isPersonalDirty;

  useEffect(() => {
    onPersonalDirtyChange?.(effectivePersonalDirty);
    return () => {
      onPersonalDirtyChange?.(false);
    };
  }, [effectivePersonalDirty, onPersonalDirtyChange]);

  useEffect(() => {
    if (!effectivePersonalDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [effectivePersonalDirty]);

  const resetPersonalFormToSaved = () => {
    setAvatarUrl(savedPersonalBaseline.avatarUrl);
    setFirstName(savedPersonalBaseline.firstName);
    setLastName(savedPersonalBaseline.lastName);
    setNickname(savedPersonalBaseline.nickname);
    setFirstNameEn(savedPersonalBaseline.firstNameEn);
    setLastNameEn(savedPersonalBaseline.lastNameEn);
    setNicknameEn(savedPersonalBaseline.nicknameEn);
    setDob(savedPersonalBaseline.dob);
    setGender(savedPersonalBaseline.gender);
    setNationality(savedPersonalBaseline.nationality);
    setIdType(savedPersonalBaseline.idType);
    setIdNumber(savedPersonalBaseline.idNumber);
    setCountry(savedPersonalBaseline.country);
    setProvince(savedPersonalBaseline.province);
    setDistrict(savedPersonalBaseline.district);
    setSubdistrict(savedPersonalBaseline.subdistrict);
    setPostalCode(savedPersonalBaseline.postalCode);
    setStreetAddress(savedPersonalBaseline.streetAddress);
    setPhoneInput(savedPersonalBaseline.phoneInput);
    setEmailInput(user.contactEmail ?? '');
  };

  const requestSwitchProfileTab = (nextTab: RunnerProfileTab) => {
    if (nextTab === activeTab) {
      setMobileNavOpen(false);
      return;
    }
    if (activeTab === 'personal' && isPersonalDirty) {
      setMobileNavOpen(false);
      void Swal.fire({
        icon: 'warning',
        title: tx('ยังไม่ได้บันทึกข้อมูลส่วนตัว'),
        text: tx(
          'คุณมีการแก้ไขข้อมูลส่วนตัวค้างอยู่ กรุณาบันทึกข้อมูลก่อน หรือกดยืนยันเพื่อละทิ้งข้อมูลที่กำลังแก้ไขและเปลี่ยนหน้า'
        ),
        showCancelButton: true,
        confirmButtonText: tx('ละทิ้งการแก้ไขและเปลี่ยนหน้า'),
        cancelButtonText: tx('กลับไปบันทึกข้อมูล'),
        reverseButtons: true,
        buttonsStyling: false,
        heightAuto: false,
        scrollbarPadding: false,
        customClass: {
          container: 'kratai-swal-top',
          popup: 'kratai-swal-popup',
          actions: 'kratai-swal-actions',
          confirmButton: 'btn-primary kratai-swal-discard-btn',
          cancelButton: 'btn-secondary',
        },
      }).then((result) => {
        if (result.isConfirmed) {
          resetPersonalFormToSaved();
          setBanner(null);
          setActiveTab(nextTab);
        }
      });
      return;
    }
    setActiveTab(nextTab);
    setMobileNavOpen(false);
    setBanner(null);
  };

  const completion = useMemo(() => evaluatePersonalInfoCompletion(user), [user]);
  const firstMissingItem = completion.items.find((item) => !item.complete);

  // The completion ring sits in the name card while that card is on screen and moves back to
  // the top of the (sticky) profile menu once the card scrolls away (25 Nov 2026, user request).
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroInView, setHeroInView] = useState(true);
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || typeof IntersectionObserver === 'undefined') return;
    // the sticky top bar covers the top of the page, so the card counts as gone once it is under it
    const topbar = document.querySelector('.global-topbar')?.getBoundingClientRect().height ?? 0;
    const io = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting), {
      rootMargin: `-${Math.round(topbar)}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  // Focus target requested from the completion box / floating ring; applied once
  // the personal tab has rendered (the switch may be deferred by tab navigation).
  const [pendingFocusSelector, setPendingFocusSelector] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!pendingFocusSelector || activeTab !== 'personal') return;
    const frame = window.requestAnimationFrame(() => {
      const el = pendingFocusSelector
        .split('|')
        .map((sel) => document.querySelector<HTMLElement>(sel))
        .find((x): x is HTMLElement => Boolean(x));
      if (el) {
        const reduceMotion = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches;
        el.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'center',
        });
        el.focus({ preventScroll: true });
        flashFieldAttention(el);
      }
      setPendingFocusSelector(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingFocusSelector, activeTab]);

  const goToPersonalField = (selector: string | undefined) => {
    if (activeTab !== 'personal') requestSwitchProfileTab('personal');
    if (selector) {
      setPendingFocusSelector(selector);
    } else {
      document
        .querySelector('.runner-completion-box')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const myRegistrations = useMemo(
    () =>
      registrations.filter(
        (r) =>
          r.runnerUserId === user.id ||
          (user.contactEmail &&
            r.email.toLowerCase() === user.contactEmail.toLowerCase())
      ),
    [registrations, user.id, user.contactEmail]
  );

  const categorizedHistory = useMemo(() => {
    return myRegistrations.map((reg) => {
      const ev = events.find((e) => e.id === reg.eventId);
      const cat = ev?.categories.find((c) => c.id === reg.categoryId);
      const isPast =
        ev?.status === 'completed' ||
        (ev?.eventDate ? ev.eventDate < '2026-11-18' : false);
      return { reg, ev, cat, isPast };
    });
  }, [myRegistrations, events]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'upcoming') {
      return categorizedHistory.filter((x) => !x.isPast);
    }
    if (historyFilter === 'past') {
      return categorizedHistory.filter((x) => x.isPast);
    }
    return categorizedHistory;
  }, [categorizedHistory, historyFilter]);

  const buildMergedProfile = (
    overrides: Partial<RunnerProfileData> = {}
  ): RunnerProfileData => ({
    ...prof,
    avatarDataUrl: avatarUrl || undefined,
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    nickname: nickname.trim() || undefined,
    firstNameEn: firstNameEn.trim() || undefined,
    lastNameEn: lastNameEn.trim() || undefined,
    nicknameEn: nicknameEn.trim() || undefined,
    dateOfBirth: dob || undefined,
    gender,
    phone: phoneInput.trim() || undefined,
    phoneVerified: prof.phoneVerified,
    nationality: nationality.trim() || 'Thailand',
    idType: idNumber.trim() ? idType : 'none',
    idNumber: idType === 'none' ? undefined : idNumber.trim() || undefined,
    country: country.trim() || 'Thailand',
    province,
    district,
    subdistrict,
    postalCode: postalCode.trim(),
    address: streetAddress.trim() || undefined,
    preferredShirtSize: prefShirtSize || undefined,
    preferredShirtType: prefShirtType,
    preferredShirtFit: prefShirtFit,
    preferredDistances: prefDistances,
    preferredRunningTypes: prefRunTypes,
    runningExperience: runExp,
    runningGoal: runningGoal.trim() || undefined,
    favoriteEventIds: favEventIds,
    emergencyContacts: emergencyList,
    savedAddresses: addressList,
    savedParticipants: participantList,
    socialLinks: {
      facebook: fbUrl.trim() || undefined,
      instagram: igUrl.trim() || undefined,
      line: lineUrl.trim() || undefined,
      strava: stravaUrl.trim() || undefined,
      website: webUrl.trim() || undefined,
      otherLinks,
    },
    notificationPrefs: notifPrefs,
    ...overrides,
  });

  const saveProfileWithFeedback = async (
    profile: RunnerProfileData,
    names?: { fullNameTh?: string; fullNameEn?: string },
    successMessage?: string
  ): Promise<boolean> => {
    setBanner(null);
    let result: { ok: boolean; error?: string };
    try {
      result = await onSaveProfile(profile, names);
    } catch {
      result = { ok: false };
    }
    const message = result.ok
      ? successMessage ?? tx('บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว')
      : result.error ?? tx('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    showResultModalAlert(result.ok, message);
    if (!result.ok) setBanner({ tone: 'err', text: message });
    return result.ok;
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstNameEn.trim() || !lastNameEn.trim()) {
      const errMsg = tx(
        'กรุณากรอกชื่อจริงและนามสกุลภาษาอังกฤษให้ครบถ้วน'
      );
      setBanner({ tone: 'err', text: errMsg });
      showResultModalAlert(false, errMsg);
      return;
    }
    if (idType === 'thai_id' && idNumber.trim() && idNumber.trim().length !== 13) {
      const errMsg = tx(
        'เลขบัตรประจำตัวประชาชนต้องครบ 13 หลัก (หรือเว้นว่างหากยังไม่ต้องการระบุ)'
      );
      setBanner({ tone: 'err', text: errMsg });
      showResultModalAlert(false, errMsg);
      return;
    }
    // Contact email is edited in this form and saved first (it has its own API).
    const nextEmail = emailInput.trim();
    const emailChanged = nextEmail !== (user.contactEmail ?? '');
    if (emailChanged) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
        const errMsg = tx('กรุณากรอกที่อยู่อีเมลให้ถูกต้อง');
        setBanner({ tone: 'err', text: errMsg });
        showResultModalAlert(false, errMsg);
        return;
      }
      if (FEATURES.emailVerification) {
        // verification flow (currently shelved) confirms the new address with a code
        onOpenEmailVerifyPage?.(nextEmail);
      } else if (onSaveContactEmail) {
        const res = await onSaveContactEmail(nextEmail);
        if (!res.ok) {
          const errMsg = tx(res.error ?? 'ไม่สามารถบันทึกอีเมลได้');
          setBanner({ tone: 'err', text: errMsg });
          showResultModalAlert(false, errMsg);
          return;
        }
      }
    }

    const composedEn = `${firstNameEn.trim()} ${lastNameEn.trim()}`.trim();
    const composedTh = `${firstName.trim()} ${lastName.trim()}`.trim();

    // First save of a complete current address while the shipping-address tab is still
    // empty: copy it into saved addresses as the default shipping address.
    const currentAddressComplete = Boolean(
      streetAddress.trim() &&
      postalCode.trim() &&
      subdistrict.trim() &&
      district.trim() &&
      province.trim()
    );
    const autoShippingAddress: RunnerSavedAddress | null =
      addressList.length === 0 && currentAddressComplete
        ? {
          id: `addr-${Date.now()}`,
          addressName: 'ที่อยู่ปัจจุบัน',
          recipientName: composedTh || composedEn,
          phone: phoneInput.trim(),
          address: streetAddress.trim(),
          province,
          district,
          subdistrict,
          postalCode: postalCode.trim(),
          country: country.trim() || 'Thailand',
          isDefault: true,
        }
        : null;

    const okMsg = autoShippingAddress
      ? tx('บันทึกข้อมูลส่วนตัวแล้ว และเพิ่มที่อยู่ปัจจุบันเป็นที่อยู่จัดส่งหลักให้อัตโนมัติ')
      : tx('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
    if (
      !(await saveProfileWithFeedback(
        buildMergedProfile(
          autoShippingAddress ? { savedAddresses: [autoShippingAddress] } : {}
        ),
        {
          fullNameTh: composedTh || composedEn,
          fullNameEn: composedEn,
        },
        okMsg
      ))
    )
      return;
    if (autoShippingAddress) {
      setAddressList([autoShippingAddress]);
    }
    resyncPersonalAfterSave.current = true;
    setResyncTick((n) => n + 1);
    setBanner({
      tone: 'ok',
      text: okMsg,
    });
  };

  const handleSaveEmergencyContact = async (d: EmergencyContactDraft) => {
    if (!editingEcId && emergencyList.length >= MAX_EMERGENCY_CONTACTS) {
      const errMsg = txf('บันทึกผู้ติดต่อฉุกเฉินได้สูงสุด {0} คน', MAX_EMERGENCY_CONTACTS);
      setBanner({ tone: 'err', text: errMsg });
      showResultModalAlert(false, errMsg);
      return;
    }
    let nextList: RunnerEmergencyContact[];
    if (editingEcId) {
      nextList = emergencyList.map((c) => (c.id === editingEcId ? { ...c, ...d } : c));
    } else {
      nextList = [...emergencyList, { id: `ec-${Date.now()}`, ...d, isPrimary: emergencyList.length === 0 }];
    }
    setEmergencyList(nextList);
    closeEcModal();
    const okMsg = tx('บันทึกข้อมูลผู้ติดต่อฉุกเฉินเรียบร้อยแล้ว');
    if (
      !(await saveProfileWithFeedback(
        buildMergedProfile({ emergencyContacts: nextList }),
        undefined,
        okMsg
      ))
    )
      return;
    setBanner({
      tone: 'ok',
      text: okMsg,
    });
  };

  const handleSaveAddressItem = async (d: SavedAddressDraft) => {
    // the name is optional; a blank one becomes "ที่อยู่ที่ <n>" by its place in the book
    const editingIdx = editingAddrId ? addressList.findIndex((a) => a.id === editingAddrId) : -1;
    const addrName =
      d.label ||
      txf('ที่อยู่ที่ {0}', editingIdx >= 0 ? editingIdx + 1 : addressList.length + 1);
    const fields = {
      addressName: addrName,
      recipientName: d.recipientName,
      phone: d.phone,
      address: d.address,
      province: d.province,
      district: d.district,
      subdistrict: d.subdistrict,
      postalCode: d.postalCode,
      country: d.country,
    };
    let nextAddrs: RunnerSavedAddress[];
    if (editingAddrId) {
      nextAddrs = addressList.map((a) => (a.id === editingAddrId ? { ...a, ...fields } : a));
    } else {
      nextAddrs = [
        ...addressList,
        { id: `addr-${Date.now()}`, ...fields, isDefault: addressList.length === 0 },
      ];
    }
    setAddressList(nextAddrs);
    closeAddrModal();
    const okMsg = tx('บันทึกที่อยู่จัดส่งเรียบร้อยแล้ว');
    if (
      !(await saveProfileWithFeedback(
        buildMergedProfile({ savedAddresses: nextAddrs }),
        undefined,
        okMsg
      ))
    )
      return;
    setBanner({
      tone: 'ok',
      text: okMsg,
    });
  };

  const activeNavItems: {
    key: RunnerProfileTab;
    label: string;
    icon: React.ReactNode;
    shelved?: false;
    /** Sidebar group, rendered as a small section label (Discord-style settings nav). */
    group?: 'account';
  }[] = [
      {
        key: 'personal',
        label: tx('ข้อมูลส่วนตัว'),
        icon: <IconUsers size={16} />,
      },
      // shipping addresses before emergency contacts (25 Nov 2026, user request)
      {
        key: 'addresses',
        label: tx('ที่อยู่จัดส่ง'),
        icon: <IconMapPin size={16} />,
      },
      {
        key: 'emergency',
        label: tx('ผู้ติดต่อฉุกเฉิน'),
        icon: <IconAlert size={16} />,
      },
      {
        key: 'participants',
        label: tx('รายชื่อเพื่อนที่สมัครให้'),
        icon: <IconUsers size={16} />,
      },
      {
        key: 'history',
        label: tx('ประวัติงานที่สมัคร'),
        icon: <IconBib size={16} />,
      },
      {
        key: 'privacy',
        label: tx('ความเป็นส่วนตัวและข้อมูล'),
        icon: <IconLock size={16} />,
        group: 'account',
      },
    ];

  const navItems = activeNavItems;

  const isEn = getLang() === 'en';
  const heroDisplayName = isEn
    ? user.fullNameEn ||
    `${firstNameEn} ${lastNameEn}`.trim() ||
    tx(user.fullNameTh)
    : user.fullNameTh;
  const heroDisplayNick = isEn ? nicknameEn || tx(nickname) : nickname;
  const notifyResult = (ok: boolean, message: string) => {
    setBanner({ tone: ok ? 'ok' : 'err', text: message });
    showResultModalAlert(ok, message);
  };

  /** go to the first missing item: a field on the personal tab, or the menu that holds it */
  const goToMissing = () => {
    if (firstMissingItem?.tab) requestSwitchProfileTab(firstMissingItem.tab);
    else goToPersonalField(firstMissingItem?.focusSelector);
  };

  /**
   * Profile completion: the ring and its percentage only (25 Nov 2026, user request; the
   * "4/9" count and "ขาดอีก … รายการ" were dropped). Red under 50 %, amber to 84 %, green from 85 %.
   */
  const completionCard = (where: 'hero' | 'nav') => (
    <button
      type="button"
      className={`completion-nav-card is-${where} tone-${completion.tone} ${completion.isComplete ? 'is-complete' : 'is-incomplete'}`}
      onClick={goToMissing}
      aria-label={
        completion.isComplete
          ? tx('โปรไฟล์ครบถ้วน 100%')
          : txf('ความครบถ้วนของโปรไฟล์ {0}% — ไปกรอก{1}', completion.pct, tx(firstMissingItem?.labelTh ?? ''))
      }
    >
      <ProfileCompletionRing
        pct={completion.pct}
        completedCount={completion.completedCount}
        total={completion.total}
        label={tx('ความครบถ้วนของโปรไฟล์')}
        size={where === 'hero' ? 52 : 40}
        tone={completion.tone}
        decorative
      />
      <span className="completion-nav-text" aria-hidden="true">
        <strong>{tx('ความครบถ้วนของโปรไฟล์')}</strong>
        <span className="completion-nav-pct mono-num">{completion.pct}%</span>
      </span>
    </button>
  );

  return (
    <main className="customer-container">
      {/* TOP PROFILE HERO: avatar and name (the completeness strip moved out, 25 Nov 2026) */}
      <section ref={heroRef} className="clean-panel runner-profile-hero">
        <div className="runner-hero-top">
          <div className="runner-avatar-cluster">
            <div className="runner-avatar-frame">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={heroDisplayName}
                  className="runner-avatar-img"
                />
              ) : (
                <DefaultAvatarImg />
              )}
            </div>
            <div className="runner-hero-identity">
              <div className="runner-hero-title-row">
                <h1>
                  {heroDisplayName}
                  {heroDisplayNick ? ` (${heroDisplayNick})` : ''}
                </h1>
                {/* only a pending deletion is worth a badge here; the account code, the "normal
                    account" badge, the page description, the find-events button and the
                    completeness strip were removed (25 Nov 2026, user request) */}
                {user.accountStatus === 'deletion_requested' && (
                  <span className="status-pill badge-amber">
                    <IconAlert size={13} />
                    <span>{tx('รอพิจารณาลบบัญชี')}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          {heroInView && completionCard('hero')}
        </div>
      </section>

      {banner && (
        <div
          className={
            banner.tone === 'ok' ? 'success-callout' : 'error-callout'
          }
          role="status"
        >
          {banner.tone === 'ok' ? (
            <IconCheckCircle size={17} />
          ) : (
            <IconAlert size={17} />
          )}
          <span>{banner.text}</span>
        </div>
      )}


      {/* WORKSPACE LAYOUT: STICKY SUB-NAVIGATION + ACTIVE MODULE */}
      <div className="runner-profile-grid">
        <nav
          className={`runner-profile-nav clean-panel ${mobileNavOpen ? 'is-mobile-open' : ''
            }`}
          aria-label={tx('หมวดจัดการโปรไฟล์นักวิ่ง')}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && mobileNavOpen) {
              setMobileNavOpen(false);
            }
          }}
        >
          {(() => {
            const activeMainIdx = activeNavItems.findIndex(
              (item) => item.key === activeTab
            );
            const activeItem =
              navItems.find((item) => item.key === activeTab) ?? navItems[0];
            return (
              <button
                type="button"
                className="runner-mobile-nav-trigger"
                aria-expanded={mobileNavOpen}
                aria-controls="runner-profile-nav-list"
                onClick={() => setMobileNavOpen((prev) => !prev)}
              >
                <span className="runner-mobile-nav-current">
                  <span className="runner-mobile-nav-dot" aria-hidden="true" />
                  {activeItem.icon}
                  <span className="runner-mobile-nav-title">
                    {activeItem.label}
                  </span>
                  <span className="runner-mobile-nav-count mono-code">
                    {activeMainIdx >= 0
                      ? `(${activeMainIdx + 1}/${activeNavItems.length})`
                      : `(${tx('พักไว้')})`}
                  </span>
                </span>
                <span className="runner-mobile-nav-action">
                  <span>
                    {mobileNavOpen ? tx('พับเก็บ') : tx('เปลี่ยนหมวด')}
                  </span>
                  <IconChevronDown
                    size={15}
                    className={`runner-mobile-chevron ${mobileNavOpen ? 'is-open' : ''
                      }`}
                  />
                </span>
              </button>
            );
          })()}

          {/* the completion ring comes back here once the name card has scrolled away */}
          {!heroInView && completionCard('nav')}

          <div id="runner-profile-nav-list" className="runner-profile-nav-list">
            {activeNavItems.map((item, idx) => (
              <React.Fragment key={item.key}>
                {(idx === 0 || activeNavItems[idx - 1].group !== item.group) && (
                  <span className="runner-nav-group-label">
                    {item.group === 'account' ? tx('ตั้งค่าบัญชี') : tx('ข้อมูลนักวิ่ง')}
                  </span>
                )}
                <button
                  type="button"
                  aria-current={activeTab === item.key ? 'page' : undefined}
                  className={`runner-nav-btn ${activeTab === item.key ? 'active' : ''
                    }`}
                  onClick={() => {
                    requestSwitchProfileTab(item.key);
                  }}
                >
                  <span className="runner-nav-label">
                    {item.icon}
                    <span>{item.label}</span>
                  </span>
                </button>
              </React.Fragment>
            ))}

          </div>
        </nav>

        <div className="runner-profile-content">
          {/* hero for the open menu (boards 21–28): its heading and description sit beside the
              rabbit; the heading block inside the section (.kr-sec-head) is hidden on public pages */}
          <div className="kr-prof-banner">
            {(() => {
              const heads: Record<string, [string, string]> = {
                personal: [
                  tx('ข้อมูลส่วนตัว'),
                  tx('ข้อมูลพื้นฐานที่นำไปเติมในฟอร์มสมัครงานวิ่งอัตโนมัติ (ช่องเลขบัตรประชาชนหรือหนังสือเดินทางไม่บังคับ เก็บเฉพาะกรณีผู้จัดต้องการใช้ออกประกันอุบัติเหตุ)'),
                ],
                emergency: [
                  tx('ผู้ติดต่อฉุกเฉิน'),
                  tx('กำหนดผู้ติดต่อหลักเพื่อเติมในใบสมัครงานวิ่งอัตโนมัติ'),
                ],
                addresses: [
                  tx('ที่อยู่จัดส่ง'),
                  tx('จัดการหลายที่อยู่และกำหนดที่อยู่หลักสำหรับจัดส่งชุดแข่งขันหรือสินค้าที่ระลึก'),
                ],
                history: [
                  tx('ประวัติการสมัครและผลการแข่งขัน'),
                  tx('แสดงรายการสมัครทั้งหมด แยกงานที่กำลังจะมาถึงกับงานที่ผ่านมาแล้ว พร้อมดูข้อมูลใบสมัครและดาวน์โหลดใบประกาศนียบัตร'),
                ],
                organizer: [
                  tx('องค์กรผู้จัดงาน: ร่วมเป็นผู้จัดงาน / กรอกรหัสคำเชิญ'),
                  tx('บัญชีเดียวใช้ได้ทั้งนักวิ่งและผู้จัดงาน กรอกรหัสคำเชิญจากทีมผู้จัด หรือยื่นขอเปิดองค์กรใหม่เพื่อรอ Platform Owner ตรวจสอบ'),
                ],
                participants: [
                  tx('รายชื่อเพื่อนที่สมัครให้'),
                  tx('รายชื่อบุคคลที่คุณสมัครงานวิ่งให้ เพิ่มเองได้ที่นี่ หรือระบบบันทึกให้อัตโนมัติเมื่อสมัครให้ผู้อื่นสำเร็จ แก้ไขหรือลบรายการได้'),
                ],
                privacy: [
                  tx('ความเป็นส่วนตัวและข้อมูล'),
                  tx('จัดการการยินยอม สำเนาข้อมูลส่วนบุคคล (PDPA) ช่องทางเข้าสู่ระบบที่เชื่อมไว้ และรหัสผ่านของคุณ'),
                ],
              };
              const head = heads[activeTab === 'security' ? 'privacy' : activeTab];
              return head ? (
                <div className="kr-prof-banner-copy">
                  <h2>{head[0]}</h2>
                  <p>{head[1]}</p>
                </div>
              ) : null;
            })()}
            {(() => {
              // still artwork made for each menu (output/profile-mascots); menus without one
              // (shelved pages) keep the animated rabbit
              const still = PROFILE_MASCOTS[activeTab === 'security' ? 'privacy' : activeTab];
              return still ? (
                <img
                  src={themedMascot(still.src, theme)}
                  alt=""
                  aria-hidden="true"
                  className="kr-prof-banner-still"
                  width={Math.round(still.w * 0.43)}
                  height={Math.round(still.h * 0.43)}
                  decoding="async"
                />
              ) : (
                <MascotAnim pose="wink" className="kr-prof-banner-mascot" scale={0.6} />
              );
            })()}
          </div>
          {/* ==================== 1. PERSONAL INFORMATION ==================== */}
          {activeTab === 'personal' && (
            <form className="clean-panel canvas-stack" onSubmit={handleSavePersonal}>
              <div className="kr-sec-head">
                <h2>{tx('ข้อมูลส่วนตัว')}</h2>
                <p className="muted-block">
                  {tx(
                    'ข้อมูลพื้นฐานที่นำไปเติมในฟอร์มสมัครงานวิ่งอัตโนมัติ (ช่องเลขบัตรประชาชนหรือหนังสือเดินทางไม่บังคับ เก็บเฉพาะกรณีผู้จัดต้องการใช้ออกประกันอุบัติเหตุ)'
                  )}
                </p>
              </div>

              {/* Profile Picture */}
              <div className="runner-avatar-upload-bar">
                <div className="runner-avatar-frame lg">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={heroDisplayName}
                      className="runner-avatar-img"
                    />
                  ) : (
                    <DefaultAvatarImg />
                  )}
                </div>
                <div className="runner-avatar-controls">
                  <strong>{tx('รูปโปรไฟล์นักวิ่ง')}</strong>
                  <span className="muted-inline">
                    {tx('JPG, PNG หรือ WebP ไม่เกิน 5 MB ครอปและซูมได้ก่อนบันทึก')}
                  </span>
                  <div className="cta-inline-row">
                    <label className="btn-secondary file-pick-btn">
                      <IconCamera size={15} />
                      <span>{tx('เปลี่ยนรูปโปรไฟล์')}</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={async (e) => {
                          const input = e.currentTarget;
                          const f = input.files?.[0];
                          // allow picking the same file again later
                          input.value = '';
                          if (!f) return;
                          if (f.size > AVATAR_MAX_FILE_BYTES) {
                            setBanner({
                              tone: 'err',
                              text: tx('ไฟล์รูปใหญ่เกิน 5 MB กรุณาเลือกไฟล์ที่เล็กลง'),
                            });
                            return;
                          }
                          try {
                            setAvatarCropSrc(await readImageFile(f));
                          } catch {
                            setBanner({
                              tone: 'err',
                              text: tx('อ่านไฟล์รูปไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'),
                            });
                          }
                        }}
                      />
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => setAvatarUrl('')}
                      >
                        {tx('ลบรูปออก')}
                      </button>
                    )}
                  </div>
                </div>
                <AvatarCropDialog
                  src={avatarCropSrc}
                  onCancel={() => setAvatarCropSrc(null)}
                  onConfirm={(dataUrl) => {
                    setAvatarUrl(dataUrl);
                    setAvatarCropSrc(null);
                  }}
                />
              </div>

              <h3>{tx('ชื่อและนามสกุล')}</h3>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="rp-fnen">
                    {<RequiredFieldText text={tx('ชื่อ (ภาษาอังกฤษ) *')} />}
                  </label>
                  <input
                    id="rp-fnen"
                    type="text"
                    value={firstNameEn}
                    onChange={(e) =>
                      setFirstNameEn(sanitizeEnglishNameInput(e.target.value))
                    }
                    placeholder={tx('กรอกชื่อภาษาอังกฤษ')}
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rp-lnen">
                    {<RequiredFieldText text={tx('นามสกุล (ภาษาอังกฤษ) *')} />}
                  </label>
                  <input
                    id="rp-lnen"
                    type="text"
                    value={lastNameEn}
                    onChange={(e) =>
                      setLastNameEn(sanitizeEnglishNameInput(e.target.value))
                    }
                    placeholder={tx('กรอกนามสกุลภาษาอังกฤษ')}
                    required
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rp-fn">{tx('ชื่อ (ภาษาไทย)')}</label>
                  <input
                    id="rp-fn"
                    type="text"
                    value={firstName}
                    onChange={(e) =>
                      setFirstName(sanitizeThaiNameInput(e.target.value))
                    }
                    placeholder={tx('กรอกชื่อภาษาไทย')}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rp-ln">{tx('นามสกุล (ภาษาไทย)')}</label>
                  <input
                    id="rp-ln"
                    type="text"
                    value={lastName}
                    onChange={(e) =>
                      setLastName(sanitizeThaiNameInput(e.target.value))
                    }
                    placeholder={tx('กรอกนามสกุลภาษาไทย')}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rp-nick">{tx('ชื่อเล่น (ภาษาไทย)')}</label>
                  <input
                    id="rp-nick"
                    type="text"
                    value={nickname}
                    onChange={(e) =>
                      setNickname(sanitizeThaiNameInput(e.target.value))
                    }
                    placeholder={tx('กรอกชื่อเล่นภาษาไทย')}
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rp-nicken">
                    {tx('ชื่อเล่น (ภาษาอังกฤษ)')}
                  </label>
                  <input
                    id="rp-nicken"
                    type="text"
                    value={nicknameEn}
                    onChange={(e) =>
                      setNicknameEn(sanitizeEnglishNameInput(e.target.value))
                    }
                    placeholder={tx('กรอกชื่อเล่นภาษาอังกฤษ')}
                  />
                </div>
              </div>

              <h3>{tx('ข้อมูลพื้นฐาน')}</h3>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="rp-dob">{tx('วันเกิด')}</label>
                  <DateOfBirthInput
                    id="rp-dob"
                    valueIso={dob}
                    onChangeIso={setDob}
                    ariaDescribedBy="rp-dob-age"
                  />
                  {(() => {
                    const age = ageBreakdownOn(dob, todayIsoInTimeZone());
                    return age ? (
                      <p id="rp-dob-age" className="reg-age-hint" aria-live="polite">
                        {txf('อายุปัจจุบัน {0} ปี {1} เดือน {2} วัน', age.years, age.months, age.days)}
                      </p>
                    ) : null;
                  })()}
                </div>
                <fieldset className="runner-gender-field" data-flash-group="">
                  <legend>{tx('เพศ')}</legend>
                  <div className="runner-gender-options">
                    {(['ชาย', 'หญิง'] as const).map((option) => (
                      <label key={option}>
                        <input
                          type="radio"
                          name="profile-gender"
                          value={option}
                          checked={gender === option}
                          onChange={() => setGender(option)}
                        />
                        <span>{tx(option)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="form-row">
                  <label htmlFor="rp-nat">{tx('สัญชาติ')}</label>
                  <NationalitySelect
                    id="rp-nat"
                    value={nationality}
                    onChange={setNationality}
                  />
                </div>
              </div>

              {/* Contact Information — Plain Phone Input + Read-only Email Shortcut */}
              <h3>{tx('ข้อมูลติดต่อ')}</h3>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="rp-phone">{tx('เบอร์โทรศัพท์')}</label>
                  <PhoneInput
                    id="rp-phone"
                    value={phoneInput}
                    onChange={(next) => setPhoneInput(next)}
                  />
                </div>

                <div className="form-row">
                  <div className="email-readonly-head">
                    <label htmlFor="rp-email">{tx('อีเมลติดต่อ')}</label>
                    {!FEATURES.emailVerification ? null : user.emailVerified && user.contactEmail ? (
                      <span
                        className="status-pill badge-forest status-pill-verify-icon"
                        title={tx('ยืนยันแล้ว')}
                        aria-label={tx('ยืนยันแล้ว')}
                      >
                        <i
                          className="fa-solid fa-circle-check"
                          aria-hidden="true"
                        />
                      </span>
                    ) : (
                      <span className="status-pill badge-amber">
                        <span>{tx('รอยืนยันอีเมล')}</span>
                      </span>
                    )}
                  </div>
                  <input
                    id="rp-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* National ID / Passport (PII Masked) */}
              <h3>{tx('เอกสารระบุตัวตน (ไม่บังคับ)')}</h3>
              <div className="form-grid-2">
                <div className="form-row">
                  <label htmlFor="rp-idt">
                    {tx('ประเภทเอกสารยืนยันตัวตน')}
                  </label>
                  <SelectMenu
                    id="rp-idt"
                    value={idType}
                    onChange={(v) => setIdType(v as 'none' | 'thai_id' | 'passport')}
                    options={[
                      { value: 'thai_id', label: tx('บัตรประจำตัวประชาชน 13 หลัก') },
                      { value: 'passport', label: tx('หนังสือเดินทาง') },
                      { value: 'none', label: tx('-- ยังไม่ระบุเอกสาร --') },
                    ]}
                  />
                </div>
                {idType !== 'none' && (
                  <div className="form-row">
                    <label htmlFor="rp-idn">
                      {idType === 'thai_id'
                        ? tx('เลขบัตรประจำตัวประชาชน (13 หลัก)')
                        : tx('เลขหนังสือเดินทาง')}
                    </label>
                    <IdNumberInput
                      id="rp-idn"
                      idType={idType}
                      className="mono-code"
                      value={idNumber}
                      onValueChange={setIdNumber}
                      placeholder={
                        idType === 'thai_id'
                          ? 'X-XXXX-XXXXX-XX-X'
                          : tx('กรอกเลขหนังสือเดินทาง')
                      }
                    />
                  </div>
                )}
              </div>

              {/* Residential Address — Cascading from Postal Code */}
              <div className="custom-field-creator canvas-stack" data-flash-group="">
                <strong>
                  {tx(
                    'ที่อยู่ปัจจุบัน'
                  )}
                </strong>
                <ThaiPostalAddressSelector
                  typeableArea
                  idPrefix="rp-res"
                  contactName={`${firstName} ${lastName}`.trim()}
                  contactPhone={phoneInput}
                  contactEmail={user.contactEmail}
                  value={{
                    country,
                    postalCode,
                    province,
                    district,
                    subdistrict,
                    address: streetAddress,
                  }}
                  onChange={(next) => {
                    setCountry(next.country);
                    setPostalCode(next.postalCode);
                    setProvince(next.province);
                    setDistrict(next.district);
                    setSubdistrict(next.subdistrict);
                    setStreetAddress(next.address);
                  }}
                />
              </div>

              <div className="cta-inline-row">
                <button type="submit" className="btn-primary">
                  <IconCheckCircle size={15} />
                  <span>{tx('บันทึกข้อมูลส่วนตัว')}</span>
                </button>
              </div>
            </form>
          )}

          {/* ==================== 3. EMERGENCY CONTACTS ==================== */}
          {activeTab === 'emergency' && (
            <section className="clean-panel canvas-stack">
              <div className="kr-sec-head">
                <h2>{tx('ผู้ติดต่อฉุกเฉิน')}</h2>
                <p className="muted-block">
                  {tx('กำหนดผู้ติดต่อหลักเพื่อเติมในใบสมัครงานวิ่งอัตโนมัติ')}
                </p>
              </div>
              <div className="cta-inline-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    // the limit (10) is not shown on the page; it is only said when someone hits it
                    if (emergencyList.length >= MAX_EMERGENCY_CONTACTS) {
                      notifyResult(
                        false,
                        txf('บันทึกผู้ติดต่อฉุกเฉินได้สูงสุด {0} คน ลบรายชื่อเดิมก่อนเพิ่มใหม่', MAX_EMERGENCY_CONTACTS)
                      );
                      return;
                    }
                    openEcModal();
                  }}
                >
                  <IconPlus size={15} />
                  <span>{tx('เพิ่มผู้ติดต่อฉุกเฉิน')}</span>
                </button>
              </div>

              {emergencyList.length === 0 ? (
                <div className="empty-state-box">
                  <strong>{tx('ยังไม่มีรายชื่อผู้ติดต่อฉุกเฉิน')}</strong>
                  <p className="muted-inline">
                    {tx(
                      'กรุณาเพิ่มผู้ติดต่อฉุกเฉินอย่างน้อย 1 คนเพื่อความรวดเร็วในการสมัครงานวิ่ง'
                    )}
                  </p>
                </div>
              ) : (
                <SearchPagedList
                  items={emergencyList}
                  searchText={(ec) => [ec.contactName, ec.relationship, ec.phone, ec.email].filter(Boolean).join(' ')}
                  searchPlaceholder="ค้นหาชื่อ ความสัมพันธ์ หรือเบอร์โทร"
                  idPrefix="pf-ec"
                >
                  {(pageItems) => (
                <div className="linked-provider-list">
                  {pageItems.map((ec) => (
                    <div key={ec.id} className="linked-provider-row">
                      {/* three lines per contact (25 Nov 2026, user request): name and the primary
                          badge; relationship; phone and email */}
                      <div className="ec-row-info">
                        <div className="ec-row-meta">
                          <strong className="ec-row-name">{tx(ec.contactName)}</strong>
                          {ec.isPrimary && (
                            <span className="status-pill badge-forest">
                              <IconCheckCircle size={12} />
                              <span>{tx('ผู้ติดต่อหลัก (เติมฟอร์มอัตโนมัติ)')}</span>
                            </span>
                          )}
                        </div>
                        <div className="ec-row-meta">
                          <span className="meta-tag">
                            <IconUsers size={14} />
                            <span>{tx(ec.relationship)}</span>
                          </span>
                        </div>
                        {/* line 3 names each value (25 Nov 2026, user request) */}
                        <div className="ec-row-contact muted-inline">
                          <span>
                            {tx('เบอร์โทร')}: <span className="mono-num">{ec.phone}</span>
                          </span>
                          {ec.email && (
                            <span>
                              {tx('อีเมล')}: <span className="mono-num">{ec.email}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="cta-inline-row">
                        {!ec.isPrimary && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={async () => {
                              const next = emergencyList.map((item) => ({
                                ...item,
                                isPrimary: item.id === ec.id,
                              }));
                              setEmergencyList(next);
                              if (!(await saveProfileWithFeedback(
                                buildMergedProfile({ emergencyContacts: next })
                              ))) return;
                            }}
                          >
                            {tx('ตั้งเป็นผู้ติดต่อหลัก')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openEcModal(ec)}
                        >
                          {tx('แก้ไข')}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            void Swal.fire({
                              icon: 'warning',
                              title: tx('ยืนยันการลบผู้ติดต่อฉุกเฉิน?'),
                              text: `${ec.contactName} (${ec.phone})`,
                              showCancelButton: true,
                              confirmButtonText: tx('ลบรายการ'),
                              cancelButtonText: tx('ยกเลิก'),
                              reverseButtons: true,
                              buttonsStyling: false,
                              heightAuto: false,
                              scrollbarPadding: false,
                              customClass: {
                                container: 'kratai-swal-top',
                                popup: 'kratai-swal-popup',
                                actions: 'kratai-swal-actions',
                                confirmButton:
                                  'btn-primary kratai-swal-discard-btn',
                                cancelButton: 'btn-secondary',
                              },
                            }).then(async (res) => {
                              if (!res.isConfirmed) return;
                              const filtered = emergencyList.filter(
                                (x) => x.id !== ec.id
                              );
                              if (
                                filtered.length > 0 &&
                                !filtered.some((x) => x.isPrimary)
                              ) {
                                filtered[0] = {
                                  ...filtered[0],
                                  isPrimary: true,
                                };
                              }
                              setEmergencyList(filtered);
                              if (editingEcId === ec.id) {
                                setEditingEcId(null);
                                setEcModalOpen(false);
                              }
                              const okMsg = tx('ลบผู้ติดต่อฉุกเฉินเรียบร้อยแล้ว');
                              if (
                                !(await saveProfileWithFeedback(
                                  buildMergedProfile({
                                    emergencyContacts: filtered,
                                  }),
                                  undefined,
                                  okMsg
                                ))
                              )
                                return;
                              setBanner({
                                tone: 'ok',
                                text: okMsg,
                              });
                            });
                          }}
                        >
                          {tx('ลบ')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                  )}
                </SearchPagedList>
              )}

              {ecModalOpen && (
                <EmergencyContactModal
                  key={editingEcId ?? 'new'}
                  contact={emergencyList.find((c) => c.id === editingEcId) ?? null}
                  onCancel={closeEcModal}
                  onSave={handleSaveEmergencyContact}
                  onInvalid={(msg) => {
                    setBanner({ tone: 'err', text: msg });
                    showResultModalAlert(false, msg);
                  }}
                />
              )}
            </section>
          )}

          {/* ==================== 4. ADDRESS MANAGEMENT ==================== */}
          {activeTab === 'addresses' && (
            <section className="clean-panel canvas-stack">
              <div className="kr-sec-head">
                <h2>{tx('ที่อยู่จัดส่ง')}</h2>
                <p className="muted-block">
                  {tx(
                    'จัดการหลายที่อยู่และกำหนดที่อยู่หลักสำหรับจัดส่งชุดแข่งขันหรือสินค้าที่ระลึก'
                  )}
                </p>
              </div>
              <div className="cta-inline-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => openAddrModal()}
                >
                  <IconPlus size={15} />
                  <span>{tx('เพิ่มที่อยู่จัดส่ง')}</span>
                </button>
              </div>

              {addressList.length === 0 ? (
                <div className="empty-state-box">
                  <strong>{tx('ยังไม่มีที่อยู่จัดส่งที่บันทึกไว้')}</strong>
                  <p className="muted-inline">
                    {tx('เพิ่มที่อยู่เริ่มต้นเพื่อไม่ต้องพิมพ์ซ้ำในขั้นตอนสมัครงานวิ่ง')}
                  </p>
                </div>
              ) : (
                <SearchPagedList
                  items={addressList}
                  searchText={(addr) =>
                    [addr.addressName, addr.recipientName, addr.phone, addr.address, addr.subdistrict, addr.district, addr.province, addr.postalCode].join(' ')}
                  searchPlaceholder="ค้นหาชื่อที่อยู่ ผู้รับ เบอร์โทร หรือจังหวัด"
                  idPrefix="pf-addr"
                >
                  {(pageItems) => (
                <div className="linked-provider-list">
                  {pageItems.map((addr) => (
                    <div key={addr.id} className="linked-provider-row">
                      <div>
                        <div className="cta-inline-row">
                          <strong>{tx(addr.addressName)}</strong>
                          {addr.isDefault && (
                            <span className="status-pill badge-forest">
                              <IconCheckCircle size={12} />
                              <span>{tx('ที่อยู่หลัก')}</span>
                            </span>
                          )}
                        </div>
                        <div>
                          {tx(addr.recipientName)} ·{' '}
                          <span className="mono-num">{addr.phone}</span>
                        </div>
                        <div className="muted-inline">
                          {tx(addr.address)} {tx(addr.subdistrict)}{' '}
                          {tx(addr.district)} {tx(addr.province)}{' '}
                          <span className="mono-num">{addr.postalCode}</span> (
                          {localizeCountryName(addr.country)})
                        </div>
                      </div>
                      <div className="cta-inline-row">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={async () => {
                              const next = addressList.map((x) => ({
                                ...x,
                                isDefault: x.id === addr.id,
                              }));
                              setAddressList(next);
                              if (!(await saveProfileWithFeedback(
                                buildMergedProfile({ savedAddresses: next })
                              ))) return;
                            }}
                          >
                            {tx('ตั้งเป็นที่อยู่หลัก')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => openAddrModal(addr)}
                        >
                          {tx('แก้ไข')}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={() => {
                            void Swal.fire({
                              icon: 'warning',
                              title: tx('ยืนยันการลบที่อยู่จัดส่ง?'),
                              text: `${addr.addressName} · ${addr.recipientName}`,
                              showCancelButton: true,
                              confirmButtonText: tx('ลบรายการ'),
                              cancelButtonText: tx('ยกเลิก'),
                              reverseButtons: true,
                              buttonsStyling: false,
                              heightAuto: false,
                              scrollbarPadding: false,
                              customClass: {
                                container: 'kratai-swal-top',
                                popup: 'kratai-swal-popup',
                                actions: 'kratai-swal-actions',
                                confirmButton:
                                  'btn-primary kratai-swal-discard-btn',
                                cancelButton: 'btn-secondary',
                              },
                            }).then(async (res) => {
                              if (!res.isConfirmed) return;
                              const filtered = addressList.filter(
                                (x) => x.id !== addr.id
                              );
                              if (
                                filtered.length > 0 &&
                                !filtered.some((x) => x.isDefault)
                              ) {
                                filtered[0] = {
                                  ...filtered[0],
                                  isDefault: true,
                                };
                              }
                              setAddressList(filtered);
                              if (editingAddrId === addr.id) {
                                setEditingAddrId(null);
                                setAddrModalOpen(false);
                              }
                              const okMsg = tx('ลบที่อยู่จัดส่งเรียบร้อยแล้ว');
                              if (
                                !(await saveProfileWithFeedback(
                                  buildMergedProfile({
                                    savedAddresses: filtered,
                                  }),
                                  undefined,
                                  okMsg
                                ))
                              )
                                return;
                              setBanner({
                                tone: 'ok',
                                text: okMsg,
                              });
                            });
                          }}
                        >
                          {tx('ลบ')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                  )}
                </SearchPagedList>
              )}

              {addrModalOpen && (
                <SavedAddressModal
                  key={editingAddrId ?? 'new'}
                  address={addressList.find((a) => a.id === editingAddrId) ?? null}
                  defaultRecipient={user.fullNameTh}
                  defaultPhone={prof.phone ?? ''}
                  contactEmail={user.contactEmail ?? undefined}
                  onCancel={closeAddrModal}
                  onSave={handleSaveAddressItem}
                  onInvalid={(msg) => {
                    setBanner({ tone: 'err', text: msg });
                    showResultModalAlert(false, msg);
                  }}
                />
              )}
            </section>
          )}

          {/* ==================== 5. RUNNING HISTORY & CERTIFICATES ==================== */}
          {activeTab === 'history' && (
            <section className="clean-panel canvas-stack">
              <div className="section-title-bar">
                <div className="kr-sec-head">
                  <h2>{tx('ประวัติการสมัครและผลการแข่งขัน')}</h2>
                  <p className="muted-block">
                    {tx(
                      'แสดงรายการสมัครทั้งหมด แยกงานที่กำลังจะมาถึงกับงานที่ผ่านมาแล้ว พร้อมดูข้อมูลใบสมัครและดาวน์โหลดใบประกาศนียบัตร'
                    )}
                  </p>
                </div>
                <div className="cta-inline-row">
                  {(
                    [
                      ['all', tx('ทั้งหมด')],
                      ['upcoming', tx('กำลังจะมาถึง')],
                      ['past', tx('ผ่านมาแล้ว')],
                    ] as const
                  ).map(([key, lbl]) => (
                    <button
                      key={key}
                      type="button"
                      className={`filter-pill ${historyFilter === key ? 'active' : ''
                        }`}
                      onClick={() => setHistoryFilter(key)}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="empty-state-box">
                  <strong>{tx('ไม่มีรายการงานวิ่งในหมวดนี้')}</strong>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onNavigateDiscoverEvents}
                  >
                    <span>{tx('ค้นหางานวิ่งที่เปิดรับสมัคร')}</span>
                    <IconArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="canvas-stack">
                  {filteredHistory.map(({ reg, ev, cat, isPast }) => (
                    <article key={reg.id} className="custom-field-creator">
                      <div className="section-title-bar">
                        <div>
                          <div className="cta-inline-row">
                            <span className="mono-code">{reg.regCode}</span>
                            <span
                              className={`status-pill ${isPast ? 'badge-neutral' : 'badge-navy'
                                }`}
                            >
                              {isPast
                                ? tx('จบการแข่งขันแล้ว')
                                : tx('กำลังจะมาถึง')}
                            </span>
                            <RegStatusBadge
                              status={reg.registrationStatus}
                            />
                            <PaymentStatusBadge status={reg.paymentStatus} />
                            <FulfillmentStatusBadge
                              status={reg.fulfillmentStatus}
                            />
                          </div>
                          <h3 style={{ margin: '0.45rem 0 0.15rem' }}>
                            {isEn
                              ? ev?.titleEn || tx(ev?.titleTh ?? reg.eventId)
                              : ev?.titleTh ?? reg.eventId}
                          </h3>
                          <div className="muted-inline">
                            <IconCalendar size={13} />{' '}
                            <span className="mono-num">
                              {ev?.eventDate ?? '-'}
                            </span>{' '}
                            · <IconMapPin size={13} />{' '}
                            {tx(ev?.venue ?? '-')} ({tx(ev?.province ?? '-')})
                          </div>
                        </div>

                        <div className="cta-inline-row">
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() =>
                              setExpandedRegId(
                                expandedRegId === reg.id ? null : reg.id
                              )
                            }
                          >
                            {expandedRegId === reg.id
                              ? tx('ซ่อนรายละเอียด')
                              : tx('ดูรายละเอียดใบสมัคร')}
                          </button>
                          {ev && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => onNavigateEventDetail(ev.id)}
                            >
                              {tx('เปิดหน้างานวิ่ง')}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="receipt-summary-box" style={{ marginTop: '0.6rem' }}>
                        <div>
                          <span className="muted-inline">
                            {tx('ประเภท / ระยะทาง')}
                          </span>
                          <strong className="mono-num">
                            {tx(cat?.name ?? '-')} ({cat?.distanceKm ?? '-'}{' '}
                            {tx('กม.')})
                          </strong>
                        </div>
                        <div>
                          <span className="muted-inline">
                            {tx('อายุ / รุ่นอายุ')}
                          </span>
                          {reg.ageSnapshot ? (
                            <strong className="mono-num">
                              {txf(
                                'อายุ {0} ปี ณ {1}',
                                reg.ageSnapshot.ageYears,
                                formatBasisDate(reg.ageSnapshot.basisDate)
                              )}
                              {' · '}
                              {(() => {
                                const snap = reg.ageSnapshot;
                                if (!snap.groupId) {
                                  return cat?.ageGroups?.length
                                    ? tx('ไม่เข้ารุ่นใด')
                                    : tx('งานนี้ไม่แบ่งรุ่นอายุ');
                                }
                                const g = cat?.ageGroups?.find((x) => x.id === snap.groupId);
                                return g
                                  ? formatAgeGroupLabel(g)
                                  : tx(snap.groupLabelTh ?? '');
                              })()}
                            </strong>
                          ) : (
                            <span className="muted-inline">
                              {tx('ไม่มีข้อมูลวันเกิดในใบสมัครนี้')}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="muted-inline">
                            {tx('หมายเลขบิบ')}
                          </span>
                          <strong className="mono-num">
                            {reg.bibNumber ?? tx('รอกำหนดหมายเลข')}
                          </strong>
                        </div>
                        <div>
                          <span className="muted-inline">
                            {tx('ไซส์เสื้อที่เลือกในงานนี้')}
                          </span>
                          <strong className="mono-num">
                            {reg.shirtSize} ({tx('ค่าที่บันทึกไว้ ณ วันสมัคร')})
                          </strong>
                        </div>
                        <div>
                          <span className="muted-inline">
                            {tx('ผลการแข่งขัน')}
                          </span>
                          {reg.raceResult ? (
                            <strong className="mono-num text-forest">
                              {reg.raceResult.chipTime} ({reg.raceResult.paceMinPerKm})
                            </strong>
                          ) : (
                            <span className="muted-inline">
                              {isPast
                                ? tx('รอประกาศผลทางการ')
                                : tx('ยังไม่ถึงวันแข่งขัน')}
                            </span>
                          )}
                        </div>
                      </div>

                      {reg.raceResult && (
                        <div
                          className="cta-inline-row"
                          style={{ marginTop: '0.65rem' }}
                        >
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => setCertPreviewReg(reg)}
                          >
                            <IconAward size={15} />
                            <span>
                              {tx('ดูผลการแข่งขันและใบประกาศนียบัตร')}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              downloadFinisherCertificateSvg({
                                runnerName: reg.participantNameTh,
                                eventTitle: ev?.titleTh ?? reg.eventId,
                                eventDate: ev?.eventDate ?? '-',
                                distanceLabel: `${cat?.distanceKm ?? 10} KM`,
                                bibNumber: reg.bibNumber ?? '-',
                                chipTime: reg.raceResult!.chipTime,
                                gunTime: reg.raceResult!.gunTime,
                                pace: reg.raceResult!.paceMinPerKm,
                                rank: reg.raceResult!.overallRank,
                                certCode: reg.raceResult!.certificateCode,
                              })
                            }
                          >
                            <IconDownload size={15} />
                            <span>{tx('ดาวน์โหลดใบประกาศนียบัตร')}</span>
                          </button>
                        </div>
                      )}

                      {expandedRegId === reg.id && (
                        <div
                          className="price-breakdown-box"
                          style={{ marginTop: '0.65rem' }}
                        >
                          <strong>
                            {tx('ข้อมูลใบสมัครที่บันทึกไว้ ณ เวลาสมัคร (แยกจากโปรไฟล์ปัจจุบัน)')}
                          </strong>
                          <div className="breakdown-line">
                            <span>{tx('ชื่อผู้เข้าแข่งขัน:')}</span>
                            <strong>
                              {isEn
                                ? reg.participantNameEn || reg.participantNameTh
                                : reg.participantNameTh}
                            </strong>
                          </div>
                          {reg.participantSnapshot?.dateOfBirth && (
                            <div className="breakdown-line">
                              <span>{tx('วันเกิด ณ วันสมัคร:')}</span>
                              <span className="mono-num">
                                {isoToDdMmYyyy(reg.participantSnapshot.dateOfBirth)}
                              </span>
                            </div>
                          )}
                          {reg.participantSnapshot?.idNumberMasked && (
                            <div className="breakdown-line">
                              <span>{tx('เลขเอกสารยืนยันตัวตน:')}</span>
                              <span className="mono-code">
                                {reg.participantSnapshot.idNumberMasked}
                              </span>
                            </div>
                          )}
                          <div className="breakdown-line">
                            <span>{tx('ผู้ติดต่อฉุกเฉินของใบสมัครนี้:')}</span>
                            <span>{tx(reg.emergencyContact)}</span>
                          </div>
                          <div className="breakdown-line">
                            <span>{tx('วิธีรับชุดแข่งขัน:')}</span>
                            <span>
                              {reg.kitDeliveryMethod === 'postal_shipping'
                                ? txf(
                                  'จัดส่งไปรษณีย์ ({0})',
                                  reg.shippingAddressSnapshot ?? '-'
                                )
                                : tx('รับที่หน้างานด้วยคิวอาร์โค้ดเช็กอิน')}
                            </span>
                          </div>
                          <div className="breakdown-line">
                            <span>{tx('รหัสเช็กอิน:')}</span>
                            <span className="mono-code">
                              <IconQr size={12} /> {reg.qrCheckInToken}
                            </span>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}

              {certPreviewReg && certPreviewReg.raceResult && (
                <div className="custom-field-creator certificate-preview-card">
                  <div className="section-title-bar">
                    <div>
                      <strong>
                        OFFICIAL FINISHER E-CERTIFICATE ·{' '}
                        <span className="mono-code">
                          {certPreviewReg.raceResult.certificateCode}
                        </span>
                      </strong>
                      <div className="muted-inline">
                        {tx('ยืนยันผลจากระบบจับเวลากลางเมื่อ')}{' '}
                        <span className="mono-num">
                          {certPreviewReg.raceResult.verifiedAt}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-ghost-sm"
                      onClick={() => setCertPreviewReg(null)}
                    >
                      {tx('ปิดหน้าต่างใบเซอร์')}
                    </button>
                  </div>
                  <div className="receipt-summary-box">
                    <div>
                      <span className="muted-inline">{tx('นักวิ่ง')}</span>
                      <strong>{certPreviewReg.participantNameTh}</strong>
                    </div>
                    <div>
                      <span className="muted-inline">Chip Time / Gun Time</span>
                      <strong className="mono-num text-forest">
                        {certPreviewReg.raceResult.chipTime} /{' '}
                        {certPreviewReg.raceResult.gunTime}
                      </strong>
                    </div>
                    <div>
                      <span className="muted-inline">Overall Rank</span>
                      <strong className="mono-num">
                        {certPreviewReg.raceResult.overallRank}
                      </strong>
                    </div>
                    <div>
                      <span className="muted-inline">Age Group Rank</span>
                      <strong className="mono-num">
                        {certPreviewReg.raceResult.categoryRank}
                      </strong>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ==================== 8. ACCOUNT & SECURITY ==================== */}
          {activeTab === 'organizer' && (
            <div className="canvas-stack">
              {/* Organizer Memberships & Invitations (Unified Single Account) */}
              <section className="clean-panel canvas-stack">
                <div className="kr-sec-head">
                  <h2>{tx('องค์กรผู้จัดงาน: ร่วมเป็นผู้จัดงาน / กรอกรหัสคำเชิญ')}</h2>
                  <p className="muted-block">
                    {tx('บัญชีเดียวใช้ได้ทั้งนักวิ่งและผู้จัดงาน กรอกรหัสคำเชิญจากทีมผู้จัด หรือยื่นขอเปิดองค์กรใหม่เพื่อรอ Platform Owner ตรวจสอบ')}
                  </p>
                </div>
                {user.memberships.length === 0 && (
                  <div className="subtle-empty-note">
                    {tx('บัญชีนี้ยังไม่ได้สังกัดองค์กรผู้จัดงาน')}
                  </div>
                )}
                {user.memberships.length > 0 && (
                  <div className="linked-provider-list">
                    {user.memberships.map((m) => {
                      const org = organizations.find(
                        (o) => o.id === m.organizationId
                      );
                      return (
                        <div
                          key={m.organizationId}
                          className="linked-provider-row"
                        >
                          <div>
                            <strong>
                              {tx(org?.nameTh ?? m.organizationId)}
                            </strong>
                            <div className="muted-inline">
                              Role: <span className="mono-code">{m.role}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => onEnterOrganizerOrg(m.organizationId)}
                          >
                            {tx('เปิด Organizer Dashboard')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* พับเก็บตัวเลือกยื่นขอเปิดองค์กรผู้จัดใหม่ชั่วคราว (คงเฉพาะการรับรหัสคำเชิญเข้าทีมเดิม) */}
                <div className="custom-field-creator canvas-stack">
                  <strong>{tx('ตอบรับรหัสคำเชิญเข้าทีมผู้จัดงาน')}</strong>
                  <div className="subdistrict-zip-row">
                    <input
                      type="text"
                      className="mono-code"
                      value={inviteInput}
                      onChange={(e) => setInviteInput(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        const r = onAcceptTeamInvitation(inviteInput.trim());
                        setBanner({
                          tone: r.ok ? 'ok' : 'err',
                          text: r.message,
                        });
                        showResultModalAlert(r.ok, r.message);
                      }}
                    >
                      {tx('รับสิทธิ์')}
                    </button>
                  </div>
                </div>

                {false && (
                  <div className="custom-field-creator canvas-stack">
                    <strong>{tx('ยื่นขอเปิดองค์กรผู้จัดงานวิ่งใหม่')}</strong>
                    <div className="form-grid-2">
                      <input
                        type="text"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        placeholder={tx('ชื่อองค์กร/ชมรมผู้จัดงาน...')}
                      />
                      <label htmlFor="rp-neworg-prov" className="sr-only">
                        {tx('จังหวัดที่ตั้งองค์กร')}
                      </label>
                      <SelectMenu
                        id="rp-neworg-prov"
                        value={newOrgProv}
                        onChange={setNewOrgProv}
                        options={ALL_THAI_PROVINCES.map((prov) => ({ value: prov, label: tx(prov) }))}
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          if (!newOrgName.trim()) return;
                          const created = onApplyNewOrganizerOrg(
                            newOrgName.trim(),
                            newOrgProv
                          );
                          setNewOrgName('');
                          onEnterOrganizerOrg(created.id);
                        }}
                      >
                        <IconBuilding size={14} />
                        <span>{tx('ส่งคำขอเปิดองค์กร')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>

            </div>
          )}

          {activeTab === 'participants' && (
            <section className="clean-panel canvas-stack">
              <div className="kr-sec-head">
                <h2>{tx('รายชื่อเพื่อนที่สมัครให้')}</h2>
                <p className="muted-block">
                  {tx(
                    'รายชื่อบุคคลที่คุณสมัครงานวิ่งให้ เพิ่มเองได้ที่นี่ หรือระบบบันทึกให้อัตโนมัติเมื่อสมัครให้ผู้อื่นสำเร็จ แก้ไขหรือลบรายการได้'
                  )}
                </p>
              </div>
              <div className="cta-inline-row">
                <button type="button" className="btn-primary" onClick={() => openPartModal()}>
                  <IconPlus size={15} />
                  <span>{tx('เพิ่มผู้สมัคร')}</span>
                </button>
              </div>

              {participantList.length === 0 ? (
                <div className="empty-state-box">
                  <strong>{tx('ยังไม่มีรายชื่อเพื่อนที่สมัครให้')}</strong>
                  <p className="muted-inline">
                    {tx(
                      'กด "เพิ่มผู้สมัคร" เพื่อบันทึกไว้ล่วงหน้า หรือรายชื่อจะถูกบันทึกอัตโนมัติเมื่อเลือก "สมัครให้ผู้อื่น" ในหน้าสมัครงานวิ่ง'
                    )}
                  </p>
                </div>
              ) : (
                <SearchPagedList
                  items={participantList}
                  searchText={(pt) =>
                    [pt.firstName, pt.lastName, pt.nickname, pt.firstNameEn, pt.lastNameEn, pt.nicknameEn, pt.phone, pt.relationshipToOwner].filter(Boolean).join(' ')}
                  searchPlaceholder="ค้นหาชื่อ ชื่อเล่น หรือเบอร์โทร"
                  idPrefix="pf-sp"
                >
                  {(pageItems) => (
                <div className="linked-provider-list">
                  {pageItems.map((pt) => {
                    const enFull =
                      `${pt.firstNameEn ?? ''} ${pt.lastNameEn ?? ''}`.trim();
                    const thFull = `${pt.firstName} ${pt.lastName}`.trim();
                    const primaryTitle = isEn
                      ? enFull || tx(thFull)
                      : thFull || enFull;
                    const nickDisplay = isEn
                      ? pt.nicknameEn || tx(pt.nickname ?? '')
                      : pt.nickname || pt.nicknameEn;
                    return (
                      <div key={pt.id} className="linked-provider-row">
                        <div>
                          <div className="cta-inline-row">
                            <span className="runner-avatar-frame sm" aria-hidden="true">
                              {pt.avatarDataUrl ? (
                                <img src={pt.avatarDataUrl} alt="" className="runner-avatar-img" />
                              ) : (
                                <DefaultAvatarImg />
                              )}
                            </span>
                            {/* nickname first (25 Nov 2026, user request) */}
                            <strong>
                              {nickDisplay ? `(${nickDisplay}) ` : ''}
                              {primaryTitle}
                            </strong>
                            {pt.relationshipToOwner && (
                              // details are icon + text; capsules are kept for statuses (26 Nov 2026)
                              <span className="meta-tag">
                                <IconUsers size={14} />
                                <span>{tx(pt.relationshipToOwner)}</span>
                              </span>
                            )}
                            {pt.preferredShirtSize && (
                              <span className="meta-tag">
                                <IconShirt size={14} />
                                <span>
                                  {tx('เสื้อ')} {pt.preferredShirtSize}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="muted-inline">
                            {[
                              pt.dateOfBirth
                                ? `${tx('เกิด')} ${isoToDdMmYyyy(pt.dateOfBirth)}`
                                : '',
                              pt.nationality
                                ? localizeCountryName(pt.nationality)
                                : '',
                              pt.idNumber
                                ? `${pt.idType === 'passport' ? tx('หนังสือเดินทาง') : tx('บัตร ปชช.')} ${pt.idNumber}`
                                : '',
                              pt.phone ? `${tx('เบอร์โทรศัพท์')}: ${pt.phone}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                          {(pt.emergencyContactName ||
                            pt.emergencyContactPhone) && (
                              <div className="muted-inline">
                                <strong>{tx('ผู้ติดต่อฉุกเฉิน:')}</strong>{' '}
                                {[
                                  tx(pt.emergencyContactName ?? ''),
                                  pt.emergencyContactRelation
                                    ? `(${tx(pt.emergencyContactRelation)})`
                                    : '',
                                  pt.emergencyContactPhone ?? '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              </div>
                            )}
                        </div>
                        <div className="cta-inline-row">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => openPartModal(pt)}
                          >
                            {tx('แก้ไข')}
                          </button>
                          <button
                            type="button"
                            className="btn-ghost-sm"
                            onClick={() => {
                              void Swal.fire({
                                icon: 'warning',
                                title: tx('ยืนยันการลบผู้สมัครแทน?'),
                                text: `${nickDisplay ? `(${nickDisplay}) ` : ''}${primaryTitle}`,
                                showCancelButton: true,
                                confirmButtonText: tx('ลบรายการ'),
                                cancelButtonText: tx('ยกเลิก'),
                                reverseButtons: true,
                                buttonsStyling: false,
                                heightAuto: false,
                                scrollbarPadding: false,
                                customClass: {
                                  container: 'kratai-swal-top',
                                  popup: 'kratai-swal-popup',
                                  actions: 'kratai-swal-actions',
                                  confirmButton:
                                    'btn-primary kratai-swal-discard-btn',
                                  cancelButton: 'btn-secondary',
                                },
                              }).then(async (res) => {
                                if (!res.isConfirmed) return;
                                const next = participantList.filter(
                                  (x) => x.id !== pt.id
                                );
                                setParticipantList(next);
                                if (editingPartId === pt.id) {
                                  setEditingPartId(null);
                                }
                                const okMsg = tx('ลบออกจากรายชื่อเพื่อนที่สมัครให้แล้ว');
                                if (
                                  !(await saveProfileWithFeedback(
                                    buildMergedProfile({
                                      savedParticipants: next,
                                    }),
                                    undefined,
                                    okMsg
                                  ))
                                )
                                  return;
                                setBanner({
                                  tone: 'ok',
                                  text: okMsg,
                                });
                              });
                            }}
                          >
                            {tx('ลบ')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  )}
                </SearchPagedList>
              )}

              {editingPartId && (
                <SavedParticipantModal
                  key={editingPartId}
                  owner={{ email: user.contactEmail, phone: prof.phone }}
                  participant={participantList.find((x) => x.id === editingPartId) ?? null}
                  shirtSizes={enabledSizes.map((sz) => sz.code)}
                  onCancel={closePartModal}
                  onInvalid={(msg) => {
                    setBanner({ tone: 'err', text: msg });
                    showResultModalAlert(false, msg);
                  }}
                  onSave={async (item) => {
                    const isNewPart = editingPartId === NEW_PARTICIPANT_ID;
                    const next = isNewPart
                      ? [...participantList, item]
                      : participantList.map((x) => (x.id === editingPartId ? item : x));
                    setParticipantList(next);
                    setEditingPartId(null);
                    const okMsg = isNewPart
                      ? tx('เพิ่มผู้สมัครเรียบร้อยแล้ว')
                      : tx('อัปเดตข้อมูลผู้สมัครแทนเรียบร้อยแล้ว');
                    if (
                      !(await saveProfileWithFeedback(
                        buildMergedProfile({ savedParticipants: next }),
                        undefined,
                        okMsg
                      ))
                    )
                      return;
                    setBanner({ tone: 'ok', text: okMsg });
                  }}
                />
              )}
            </section>
          )}

          {activeTab === 'privacy' && (
            <PrivacyPanel
              user={user}
              onSetMarketingConsent={onSetMarketingConsent}
              notify={notifyResult}
              connections={
                <ConnectionsPanel
                  embedded
                  user={user}
                  onLinkProvider={onLinkProvider}
                  onUnlinkProvider={onUnlinkProvider}
                  notify={notifyResult}
                />
              }
              securitySections={
                <AccountSecuritySections
                  user={user}
                  onSetOrChangePassword={onSetOrChangePassword}
                  onRequestPasswordCode={onRequestPasswordCode}
                  onVerifyPasswordCode={onVerifyPasswordCode}
                  notify={notifyResult}
                />
              }
            />
          )}
        </div>
      </div>
    </main>
  );
};
