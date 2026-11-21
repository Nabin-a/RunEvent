import React, { useMemo, useState } from 'react';
import {
  AuthProviderType,
  Organization,
  OrganizationType,
  OrganizerDocumentItem,
  ReturnIntent,
  RunnerProfileData,
  TeamInvitation,
  UserAccount,
} from '../types';
import {
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconBuilding,
  IconCheckCircle,
  IconDevice,
  IconEye,
  IconEyeOff,
  IconFacebookMark,
  IconFlag,
  IconGoogleMark,
  IconLineMark,
  IconLock,
  IconMail,
  IconShield,
  IconUsers,
} from './Icons';

import { PhoneInput } from './PhoneInput';
import { tx, txf } from '../i18n';
import { RequiredFieldText } from './RequiredFieldText';
import { DateOfBirthInput } from './DateOfBirthInput';
import { PrivacyNoticeModal } from './PrivacyNoticeModal';
import { reportInvalidFieldsWithin } from '../utils/formValidation';
import { NationalitySelect } from './NationalitySelect';
import { ThaiPostalAddressSelector } from './ThaiPostalAddressSelector';
import {
  detectNameScript,
  sanitizeEnglishNameInput,
  sanitizeSingleLanguageNameInput,
  sanitizeThaiNameInput,
} from '../utils/dateFormat';
import { DEFAULT_SHIRT_SIZES } from '../data/runnerProfileDefaults';
import { IdNumberInput } from './IdNumberInput';
import { MascotAnim } from './MascotAnim';

function computePasswordStrength(pw: string): {
  score: number;
  label: string;
  toneClass: string;
} {
  if (!pw) return { score: 0, label: 'ยังไม่ได้กรอกรหัสผ่าน', toneClass: 'badge-neutral' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 2) {
    return {
      score: Math.max(1, score),
      label: 'ความแข็งแรง: อ่อน (ควรมีอย่างน้อย 8 ตัว ผสมตัวเลข/ตัวพิมพ์ใหญ่)',
      toneClass: 'badge-amber',
    };
  }
  if (score === 3) {
    return {
      score,
      label: 'ความแข็งแรง: ปานกลาง (ปลอดภัยตามเกณฑ์มาตรฐาน)',
      toneClass: 'badge-navy',
    };
  }
  return {
    score,
    label: 'ความแข็งแรง: สูงมาก (ปลอดภัยสูง)',
    toneClass: 'badge-forest',
  };
}

export function computeRunnerProfileCompletion(
  user: UserAccount
): { pct: number; completedItems: number; totalItems: number } {
  const p = user.runnerProfile;
  const checks = [
    Boolean((p?.firstNameEn && p?.lastNameEn) || user.fullNameEn),
    Boolean(user.contactEmail && user.emailVerified),
    Boolean(p?.phone),
    Boolean(p?.dateOfBirth),
    Boolean(p?.gender && p.gender !== 'ไม่ระบุ'),
    Boolean(p?.nationality),
  ];
  const completedItems = checks.filter(Boolean).length;
  const totalItems = checks.length;
  return {
    pct: Math.round((completedItems / totalItems) * 100),
    completedItems,
    totalItems,
  };
}

interface AuthScreenProps {
  /** Simulated Google / Facebook / LINE sign-in is only offered when the server allows it. */
  sandboxAuthEnabled?: boolean;
  users: UserAccount[];
  returnIntent: ReturnIntent | null;
  initialTab?: 'signin' | 'signup' | 'forgot';
  externalSocialScenario?: {
    seq: number;
    provider: 'google' | 'line' | 'facebook';
    scenario: 'new_no_email' | 'collision' | 'cancelled';
  } | null;
  onAuthenticated: (user: UserAccount, preferredOrgId?: string) => void;
  onPasswordLogin?: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string; user?: UserAccount }>;
  onRegisterEmailUser: (payload: {
    fullNameTh: string;
    fullNameEn?: string;
    email: string;
    password?: string;
    marketingConsent: boolean;
    runnerProfile?: RunnerProfileData;
  }) => { ok: boolean; error?: string; user?: UserAccount };
  onRegisterSocialUser: (payload: {
    provider: 'google' | 'line' | 'facebook';
    fullNameTh: string;
    fullNameEn?: string;
    email: string | null;
    marketingConsent: boolean;
    runnerProfile?: RunnerProfileData;
  }) => UserAccount;
  onSubmitOrganizerOnboarding?: (payload: {
    firstName: string;
    lastName: string;
    email: string;
    password?: string;
    phone: string;
    position: string;
    orgNameTh: string;
    orgNameEn: string;
    orgType: OrganizationType;
    businessRegNumber: string;
    website: string;
    orgEmail: string;
    orgPhone: string;
    address: string;
    province: string;
    district: string;
    subdistrict: string;
    postalCode: string;
    descriptionTh: string;
    previousEvents: string;
    facebookPage: string;
    mainContactName: string;
    mainContactPosition: string;
    mainContactPhone: string;
    mainContactEmail: string;
    documents: OrganizerDocumentItem[];
    marketingConsent: boolean;
  }) => { user: UserAccount; organization: Organization };
  onNavigateExploreEvents?: () => void;
  onNavigateRunnerDashboard?: () => void;
  onNavigateOrganizerWorkspace?: (orgId: string) => void;
}

const ORG_DRAFT_STORAGE_KEY = 'kratai_v2_org_onboarding_draft';
const ENABLE_ORGANIZER_SELF_ONBOARDING = false;

export const AuthScreen: React.FC<AuthScreenProps> = ({
  sandboxAuthEnabled = true,
  users,
  returnIntent,
  initialTab = 'signin',
  externalSocialScenario,
  onAuthenticated,
  onPasswordLogin,
  onRegisterEmailUser,
  onRegisterSocialUser,
  onSubmitOrganizerOnboarding,
  onNavigateExploreEvents,
  onNavigateOrganizerWorkspace,
}) => {
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'forgot'>(
    initialTab
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Registration Flow Mode: Direct Runner Form when Organizer self-onboarding is folded
  const [signupFlowMode, setSignupFlowMode] = useState<
    | 'select_type'
    | 'runner_wizard'
    | 'runner_completed'
    | 'organizer_wizard'
    | 'organizer_completed'
  >(ENABLE_ORGANIZER_SELF_ONBOARDING ? 'select_type' : 'runner_wizard');

  // Shared Account Step 1 State (Preserved when switching between Runner and Organizer)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [socialAuthPrepopulated, setSocialAuthPrepopulated] = useState<
    null | 'google' | 'line' | 'facebook'
  >(null);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  // Runner Wizard State (2 Steps — Slimmed down to essential fields + auto TH/EN language mapping)
  const [runnerStep, setRunnerStep] = useState<1 | 2>(1);
  const [runnerAltFirstNameTh, setRunnerAltFirstNameTh] = useState('');
  const [runnerAltLastNameTh, setRunnerAltLastNameTh] = useState('');
  const [runnerFirstNameEn, setRunnerFirstNameEn] = useState('');
  const [runnerLastNameEn, setRunnerLastNameEn] = useState('');
  const [runnerDob, setRunnerDob] = useState('');
  const [runnerGender, setRunnerGender] = useState<'ชาย' | 'หญิง' | 'ไม่ระบุ'>(
    'ไม่ระบุ'
  );
  const [runnerNationality, setRunnerNationality] = useState('Thailand');
  const [runnerIdType, setRunnerIdType] = useState<
    'none' | 'thai_id' | 'passport'
  >('thai_id');
  const [runnerIdNumber, setRunnerIdNumber] = useState('');
  const [runnerShirtSize, setRunnerShirtSize] = useState('');

  // Organizer Wizard State (3 Steps + Save Draft)
  const [orgStep, setOrgStep] = useState<1 | 2 | 3>(1);
  const [jobTitle, setJobTitle] = useState('ผู้อำนวยการจัดการแข่งขัน (Race Director)');
  const [orgNameTh, setOrgNameTh] = useState('');
  const [orgNameEn, setOrgNameEn] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('Private Company');
  const [businessRegNo, setBusinessRegNo] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPhone, setOrgPhone] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');
  const [officeProvince, setOfficeProvince] = useState<string>('เชียงใหม่');
  const [officeDistrict, setOfficeDistrict] = useState<string>('เมืองเชียงใหม่');
  const [officeSubdistrict, setOfficeSubdistrict] = useState<string>('สุเทพ');
  const [officePostalCode, setOfficePostalCode] = useState<string>('50200');
  const [orgDescription, setOrgDescription] = useState('');
  const [previousEvents, setPreviousEvents] = useState('');
  const [facebookPage, setFacebookPage] = useState('');
  const [sameAsAccountContact, setSameAsAccountContact] = useState(true);
  const [mainContactName, setMainContactName] = useState('');
  const [mainContactPos, setMainContactPos] = useState('');
  const [mainContactPhone, setMainContactPhone] = useState('');
  const [mainContactEmail, setMainContactEmail] = useState('');

  // Step 3 Organizer Verification Documents
  const [idDocType, setIdDocType] = useState('บัตรประจำตัวประชาชน');
  const [idDocExpiry, setIdDocExpiry] = useState('2030-12-31');
  const [isAuthorizedRep, setIsAuthorizedRep] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<OrganizerDocumentItem[]>([
    {
      id: 'doc-init-id',
      category: 'identity',
      docTypeLabel: 'สำเนาบัตรประจำตัวประชาชนผู้ยื่นคำขอ',
      fileName: 'thai_national_id_verified.pdf',
      fileSizeKb: 840,
      mimeType: 'application/pdf',
      expiryDate: '2030-12-31',
      privateStorageKey: 'priv://kyc-vault/2026/id-doc-sample.pdf',
    },
    {
      id: 'doc-init-org',
      category: 'organization',
      docTypeLabel: 'หนังสือรับรองนิติบุคคล / ทะเบียนชมรม',
      fileName: 'dbd_company_certificate_2026.pdf',
      fileSizeKb: 1420,
      mimeType: 'application/pdf',
      privateStorageKey: 'priv://kyc-vault/2026/org-cert-sample.pdf',
    },
  ]);
  const [consentAccurate, setConsentAccurate] = useState(false);
  const [consentVerification, setConsentVerification] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [draftSavedNotice, setDraftSavedNotice] = useState<string | null>(null);
  const [completedOrgResult, setCompletedOrgResult] = useState<{
    user: UserAccount;
    organization: Organization;
  } | null>(null);

  // Unsaved changes confirmation modal state
  const [pendingSwitchTarget, setPendingSwitchTarget] = useState<
    null | 'select_type' | 'runner_wizard' | 'organizer_wizard'
  >(null);

  // Social OAuth simulation flow state
  const [socialPendingStep, setSocialPendingStep] = useState<
    | null
    | {
      mode:
      | 'new_line_no_email'
      | 'email_collision_verify'
      | 'provider_cancelled';
      provider: 'google' | 'line' | 'facebook';
      tempName: string;
      collisionUser?: UserAccount;
    }
  >(null);
  const [socialTermsAccepted, setSocialTermsAccepted] = useState(false);

  // PDPA privacy notice: readable here; it is acknowledged from the navbar sign-in button.
  const [privacyReadOpen, setPrivacyReadOpen] = useState(false);

  const signupPrivacyNote = (includeSocial: boolean) => (
    <p className="auth-privacy-note">
      {includeSocial
        ? tx("การสร้างบัญชี (รวมถึงสมัครผ่าน Google, Facebook หรือ LINE) เป็นไปตาม")
        : tx("การสร้างบัญชีเป็นไปตาม")}{' '}
      <button
        type="button"
        className="auth-inline-link-btn"
        onClick={() => setPrivacyReadOpen(true)}
      >
        {tx("ประกาศความเป็นส่วนตัว")}
      </button>
    </p>
  );
  // 21 Nov 2026 (user decision): the PDPA notice is acknowledged in one place only, the
  // pop-up after the navbar "เข้าสู่ระบบ" button (App.tsx), so sign-up no longer stops here.
  const requirePrivacyConsent = (proceed: () => void) => {
    proceed();
  };
  const [collisionPasswordCheck, setCollisionPasswordCheck] = useState('');

  // Forgot password simulation
  const [resetRequestedEmail, setResetRequestedEmail] = useState<string | null>(
    null
  );
  const [resetDoneBanner, setResetDoneBanner] = useState(false);

  const [statusAlert, setStatusAlert] = useState<{
    tone: 'ok' | 'err' | 'warn';
    text: string;
  } | null>(null);

  const pwStrength = useMemo(
    () => computePasswordStrength(regPass),
    [regPass]
  );

  const hasUnsavedWizardData =
    Boolean(firstName.trim()) ||
    Boolean(lastName.trim()) ||
    Boolean(regEmail.trim()) ||
    Boolean(orgNameTh.trim());

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSocialPendingStep(null);
    const normalized = email.trim().toLowerCase();
    if (!password.trim()) {
      setStatusAlert({ tone: 'err', text: tx("กรุณากรอกรหัสผ่าน") });
      return;
    }
    if (onPasswordLogin) {
      const res = await onPasswordLogin(normalized, password);
      if (!res.ok || !res.user) {
        setStatusAlert({
          tone: 'err',
          text: tx(
            res.error ??
            "อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากสมัครไว้ด้วย LINE หรือ Google อย่างเดียว กรุณาเข้าสู่ระบบด้วยปุ่มช่องทางนั้น)"
          ),
        });
        return;
      }
      setStatusAlert(null);
      onAuthenticated(res.user, res.user.memberships[0]?.organizationId);
      return;
    }
    const matched = users.find((u) => {
      const em = (u.contactEmail ?? '').toLowerCase();
      const localPart = em.includes('@') ? em.split('@')[0] : '';
      return (
        em === normalized ||
        u.code.toLowerCase() === normalized ||
        (localPart !== '' && localPart === normalized)
      );
    });
    if (!matched || !matched.hasPassword) {
      setStatusAlert({
        tone: 'err',
        text: tx("อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากสมัครไว้ด้วย LINE หรือ Google อย่างเดียว กรุณาเข้าสู่ระบบด้วยปุ่มช่องทางนั้น)"),
      });
      return;
    }
    setStatusAlert(null);
    onAuthenticated(matched, matched.memberships[0]?.organizationId);
  };

  const validateStep1AccountFields = (requirePhone: boolean): boolean => {
    if (!firstName.trim() || !lastName.trim()) {
      setStatusAlert({
        tone: 'err',
        text: tx("กรุณากรอกชื่อจริงและนามสกุลให้ครบถ้วน"),
      });
      return false;
    }
    const fnScript = detectNameScript(firstName);
    const lnScript = detectNameScript(lastName);
    if (fnScript !== lnScript) {
      setStatusAlert({
        tone: 'err',
        text: tx(
          "กรุณากรอกชื่อจริงและนามสกุลให้เป็นภาษาเดียวกัน (ภาษาไทยทั้งคู่ หรือ ภาษาอังกฤษทั้งคู่)"
        ),
      });
      return false;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(regEmail.trim())) {
      setStatusAlert({
        tone: 'err',
        text: tx("รูปแบบอีเมลไม่ถูกต้อง (ตัวอย่าง: runner@example.com)"),
      });
      return false;
    }
    if (requirePhone && regPhone.trim().replace(/\D/g, '').length < 9) {
      setStatusAlert({
        tone: 'err',
        text: tx("กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้ (9–10 หลัก)"),
      });
      return false;
    }
    if (!socialAuthPrepopulated) {
      if (regPass.length < 8) {
        setStatusAlert({
          tone: 'err',
          text: tx("รหัสผ่านต้องมีความยาวอย่างน้อย 8 ตัวอักษร"),
        });
        return false;
      }
      if (regPass !== regConfirmPass) {
        setStatusAlert({
          tone: 'err',
          text: tx("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"),
        });
        return false;
      }
    }
    setStatusAlert(null);
    return true;
  };

  const handleCompleteRunnerRegistration = (skipOptionalProfile: boolean) => {
    const step1IsEnglish = detectNameScript(firstName) === 'en';

    if (
      !skipOptionalProfile &&
      !step1IsEnglish &&
      (!runnerFirstNameEn.trim() || !runnerLastNameEn.trim())
    ) {
      setStatusAlert({
        tone: 'err',
        text: tx(
          "กรุณากรอกชื่อจริงและนามสกุลภาษาอังกฤษให้ครบถ้วน"
        ),
      });
      return;
    }

    if (
      !skipOptionalProfile &&
      runnerIdType === 'thai_id' &&
      runnerIdNumber.trim() &&
      runnerIdNumber.trim().length !== 13
    ) {
      setStatusAlert({
        tone: 'err',
        text: tx("เลขบัตรประจำตัวประชาชนต้องครบ 13 หลัก (หรือเว้นว่างหากยังไม่ต้องการระบุ)"),
      });
      return;
    }

    const mappedFirstTh = step1IsEnglish
      ? skipOptionalProfile
        ? ''
        : runnerAltFirstNameTh.trim()
      : firstName.trim();
    const mappedLastTh = step1IsEnglish
      ? skipOptionalProfile
        ? ''
        : runnerAltLastNameTh.trim()
      : lastName.trim();
    const mappedFirstEn = step1IsEnglish
      ? firstName.trim()
      : skipOptionalProfile
        ? ''
        : runnerFirstNameEn.trim();
    const mappedLastEn = step1IsEnglish
      ? lastName.trim()
      : skipOptionalProfile
        ? ''
        : runnerLastNameEn.trim();

    const composedTh = `${mappedFirstTh} ${mappedLastTh}`.trim();
    const composedEn = `${mappedFirstEn} ${mappedLastEn}`.trim();
    const fullNameTh = composedTh || composedEn;

    const profilePayload: RunnerProfileData = skipOptionalProfile
      ? {
          firstName: mappedFirstTh || undefined,
          lastName: mappedLastTh || undefined,
          firstNameEn: mappedFirstEn || undefined,
          lastNameEn: mappedLastEn || undefined,
          phone: regPhone.trim() || undefined,
          nationality: 'Thailand',
        }
      : {
          firstName: mappedFirstTh || undefined,
          lastName: mappedLastTh || undefined,
          firstNameEn: mappedFirstEn || undefined,
          lastNameEn: mappedLastEn || undefined,
          phone: regPhone.trim() || undefined,
          dateOfBirth: runnerDob || undefined,
          gender: runnerGender,
          nationality: runnerNationality.trim() || 'Thailand',
          idType: runnerIdNumber.trim() ? runnerIdType : 'none',
          idNumber:
            runnerIdType === 'none'
              ? undefined
              : runnerIdNumber.trim() || undefined,
          preferredShirtSize: runnerShirtSize || undefined,
        };

    if (socialAuthPrepopulated) {
      const created = onRegisterSocialUser({
        provider: socialAuthPrepopulated,
        fullNameTh,
        fullNameEn: composedEn || undefined,
        email: regEmail.trim(),
        marketingConsent: marketingOptIn,
        runnerProfile: profilePayload,
      });
      onAuthenticated(created);
      if (!returnIntent) {
        onNavigateExploreEvents?.();
      }
      return;
    }

    const res = onRegisterEmailUser({
      fullNameTh,
      fullNameEn: composedEn || undefined,
      email: regEmail.trim(),
      password: regPass,
      marketingConsent: marketingOptIn,
      runnerProfile: profilePayload,
    });
    if (!res.ok || !res.user) {
      setStatusAlert({
        tone: 'err',
        text: res.error ?? tx("ไม่สามารถสร้างบัญชีได้ (อีเมลอาจซ้ำกับบัญชีเดิม)"),
      });
      setRunnerStep(1);
      return;
    }
    onAuthenticated(res.user);
    if (!returnIntent) {
      onNavigateExploreEvents?.();
    }
  };

  const handleSaveOrganizerDraft = () => {
    const draftPayload = {
      firstName,
      lastName,
      regEmail,
      regPhone,
      jobTitle,
      orgNameTh,
      orgNameEn,
      orgType,
      businessRegNo,
      orgWebsite,
      orgEmail,
      orgPhone,
      officeAddress,
      officeProvince,
      officeDistrict,
      officeSubdistrict,
      officePostalCode,
      orgDescription,
      previousEvents,
      facebookPage,
      savedAt: '2026-11-18 09:30',
    };
    try {
      window.localStorage.setItem(
        ORG_DRAFT_STORAGE_KEY,
        JSON.stringify(draftPayload)
      );
      setDraftSavedNotice(
        tx("บันทึกแบบร่างคำขอขึ้นทะเบียนผู้จัด (สถานะ DRAFT) ลงในเครื่องเรียบร้อยแล้ว สามารถกลับมาทำต่อได้ทุกเมื่อ")
      );
    } catch {
      // ignore storage error
    }
  };

  const handleLoadOrganizerDraft = () => {
    try {
      const raw = window.localStorage.getItem(ORG_DRAFT_STORAGE_KEY);
      if (!raw) {
        setStatusAlert({
          tone: 'warn',
          text: tx("ยังไม่มีแบบร่างที่บันทึกไว้ก่อนหน้า"),
        });
        return;
      }
      const d = JSON.parse(raw);
      setFirstName(d.firstName ?? '');
      setLastName(d.lastName ?? '');
      setRegEmail(d.regEmail ?? '');
      setRegPhone(d.regPhone ?? '');
      setJobTitle(d.jobTitle ?? '');
      setOrgNameTh(d.orgNameTh ?? '');
      setOrgNameEn(d.orgNameEn ?? '');
      setOrgType(d.orgType ?? 'Private Company');
      setBusinessRegNo(d.businessRegNo ?? '');
      setOrgWebsite(d.orgWebsite ?? '');
      setOrgEmail(d.orgEmail ?? '');
      setOrgPhone(d.orgPhone ?? '');
      setOfficeAddress(d.officeAddress ?? '');
      setOfficeProvince(d.officeProvince ?? 'เชียงใหม่');
      setOfficeDistrict(d.officeDistrict ?? 'เมืองเชียงใหม่');
      setOfficeSubdistrict(d.officeSubdistrict ?? 'สุเทพ');
      setOfficePostalCode(d.officePostalCode ?? '50200');
      setOrgDescription(d.orgDescription ?? '');
      setPreviousEvents(d.previousEvents ?? '');
      setFacebookPage(d.facebookPage ?? '');
      setDraftSavedNotice(txf("โหลดข้อมูลแบบร่างที่บันทึกเมื่อ {0} เรียบร้อยแล้ว", d.savedAt));
    } catch {
      // ignore parse error
    }
  };

  const handleFinalSubmitOrganizerWizard = () => {
    if (!consentAccurate || !consentVerification || !consentPrivacy) {
      setStatusAlert({
        tone: 'err',
        text: tx("กรุณาติ๊กยืนยันความถูกต้องของข้อมูล ยอมรับกระบวนการตรวจสอบ และรับทราบประกาศความเป็นส่วนตัวให้ครบทั้ง 3 ข้อ"),
      });
      return;
    }
    if (uploadedDocs.length < 2) {
      setStatusAlert({
        tone: 'err',
        text: tx("กรุณาอัปโหลดเอกสารยืนยันตัวตนและเอกสารรับรององค์กรอย่างน้อย 2 รายการ"),
      });
      return;
    }
    if (isAuthorizedRep && !uploadedDocs.some((d) => d.category === 'authorization')) {
      setStatusAlert({
        tone: 'err',
        text: tx("กรณีผู้ยื่นคำขอเป็นผู้รับมอบอำนาจ กรุณาแนบหนังสือมอบอำนาจ (Power of Attorney)"),
      });
      return;
    }
    if (!onSubmitOrganizerOnboarding) return;

    const fullContactName = sameAsAccountContact
      ? `${firstName.trim()} ${lastName.trim()}`.trim()
      : mainContactName.trim();

    const res = onSubmitOrganizerOnboarding({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: regEmail.trim(),
      password: regPass || undefined,
      phone: regPhone.trim(),
      position: jobTitle.trim(),
      orgNameTh: orgNameTh.trim(),
      orgNameEn: orgNameEn.trim() || orgNameTh.trim(),
      orgType,
      businessRegNumber: businessRegNo.trim(),
      website: orgWebsite.trim(),
      orgEmail: orgEmail.trim() || regEmail.trim(),
      orgPhone: orgPhone.trim() || regPhone.trim(),
      address: officeAddress.trim(),
      province: officeProvince,
      district: officeDistrict,
      subdistrict: officeSubdistrict,
      postalCode: officePostalCode,
      descriptionTh: orgDescription.trim(),
      previousEvents: previousEvents.trim(),
      facebookPage: facebookPage.trim(),
      mainContactName: fullContactName,
      mainContactPosition: sameAsAccountContact
        ? jobTitle.trim()
        : mainContactPos.trim(),
      mainContactPhone: sameAsAccountContact
        ? regPhone.trim()
        : mainContactPhone.trim(),
      mainContactEmail: sameAsAccountContact
        ? regEmail.trim()
        : mainContactEmail.trim(),
      documents: uploadedDocs,
      marketingConsent: marketingOptIn,
    });
    setCompletedOrgResult(res);
    setSignupFlowMode('organizer_completed');
  };

  const handleSocialButton = (
    provider: 'google' | 'line' | 'facebook',
    scenario: 'existing' | 'new_no_email' | 'collision' | 'cancelled'
  ) => {
    setStatusAlert(null);
    if (scenario === 'cancelled') {
      setSocialPendingStep({
        mode: 'provider_cancelled',
        provider,
        tempName: '',
      });
      return;
    }
    if (scenario === 'existing') {
      const existing = users.find((u) =>
        u.identities.some((id) => id.provider === provider)
      );
      if (existing) {
        onAuthenticated(existing, existing.memberships[0]?.organizationId);
      }
      return;
    }
    if (scenario === 'new_no_email') {
      setSocialTermsAccepted(false);
      setSocialPendingStep({
        mode: 'new_line_no_email',
        provider: 'line',
        tempName: 'วรินทร สายลมเหนือ',
      });
      return;
    }
    if (scenario === 'collision') {
      const targetCollision =
        users.find((u) => u.id === 'usr-manager') ?? users[0];
      setCollisionPasswordCheck('');
      setSocialPendingStep({
        mode: 'email_collision_verify',
        provider: 'google',
        tempName: targetCollision.fullNameTh,
        collisionUser: targetCollision,
      });
    }
  };

  React.useEffect(() => {
    setAuthTab(initialTab);
    if (initialTab === 'signup' && !ENABLE_ORGANIZER_SELF_ONBOARDING) {
      setSignupFlowMode('runner_wizard');
    }
  }, [initialTab]);

  React.useEffect(() => {
    if (externalSocialScenario) {
      setAuthTab('signin');
      handleSocialButton(
        externalSocialScenario.provider,
        externalSocialScenario.scenario
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSocialScenario?.seq]);

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResetRequestedEmail(email.trim());
    setResetDoneBanner(false);
  };

  const isWideOrganizerFlow =
    authTab === 'signup' &&
    ENABLE_ORGANIZER_SELF_ONBOARDING &&
    (signupFlowMode === 'select_type' || signupFlowMode === 'organizer_wizard');

  return (
    <main
      className={`auth-page-shell ${isWideOrganizerFlow ? 'auth-signup-shell' : 'auth-single-shell'
        }`}
    >
      {returnIntent && (
        <div className="intent-return-banner" role="status">
          <IconArrowRight size={16} />
          <span>
            {tx("กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ: ")} <strong>{tx(returnIntent.label)}</strong>
          </span>
        </div>
      )}

      <div
        className={`auth-centered-wrap ${isWideOrganizerFlow ? 'is-signup' : 'kr-auth-split'
          }`}
      >
        {/* left art panel (boards 05–08): greeting + the rabbit on a mint landscape */}
        {!isWideOrganizerFlow && (
          <aside className="kr-auth-art" aria-hidden="true">
            <p className="kr-auth-art-title">
              {authTab === 'signup'
                ? tx("สมัครสมาชิก เริ่มต้นเส้นทางนักวิ่งกับกระต่าย")
                : authTab === 'forgot'
                  ? tx("ลืมรหัสผ่าน?")
                  : tx("ยินดีต้อนรับกลับสู่กระต่าย")}
            </p>
            <p className="kr-auth-art-sub">
              {authTab === 'signup'
                ? tx("สร้างบัญชีเพื่อสมัครงานวิ่ง และติดตามผลการวิ่งของคุณ")
                : authTab === 'forgot'
                  ? tx("ไม่ต้องกังวล เราช่วยตั้งรหัสผ่านใหม่ให้อย่างปลอดภัย")
                  : tx("แพลตฟอร์มงานวิ่งสำหรับนักวิ่งทุกคน")}
            </p>
            <MascotAnim
              pose={authTab === 'signup' ? 'jump' : authTab === 'forgot' ? 'think' : 'run'}
              className="kr-auth-mascot"
            />
          </aside>
        )}
        <section
          className="clean-panel auth-primary-card"
          aria-label={tx("เข้าสู่ระบบหรือลงทะเบียนสมาชิก กระต่าย")}
        >
          <div className="auth-card-head">
            <h1>
              {authTab === 'signup'
                ? runnerStep === 2 && signupFlowMode === 'runner_wizard'
                  ? tx("ข้อมูลโปรไฟล์นักวิ่ง (ข้ามไปเติมภายหลังได้)")
                  : tx("สมัครสมาชิก กระต่าย")
                : authTab === 'forgot'
                  ? tx("ลืมรหัสผ่าน")
                  : tx("เข้าสู่ระบบ กระต่าย")}
            </h1>
            <p className="muted-block">
              {authTab === 'signup'
                ? runnerStep === 2 && signupFlowMode === 'runner_wizard'
                  ? tx("ข้อมูลส่วนนี้ใช้เติมฟอร์มสมัครงานวิ่งอัตโนมัติในอนาคต คุณสามารถกดข้ามเพื่อสร้างบัญชีทันทีได้")
                  : sandboxAuthEnabled
                    ? tx("สร้างบัญชีผู้ใช้งานใหม่ หรือสมัครด่วนผ่านบัญชีโซเชียลด้านล่าง")
                    : tx("สร้างบัญชีผู้ใช้งานใหม่ด้วยอีเมล")
                : authTab === 'forgot'
                  ? tx("กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่")
                  : sandboxAuthEnabled
                    ? tx("เลือกช่องทางเข้าสู่ระบบ หรือใช้อีเมลและรหัสผ่าน")
                    : tx("เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน")}
            </p>
          </div>

          {authTab === 'forgot' && (
            <div className="auth-back-signin-bar">
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => {
                  setAuthTab('signin');
                  setStatusAlert(null);
                  window.history.replaceState({}, '', '/login');
                }}
              >
                <IconArrowLeft size={14} />
                <span>{tx("กลับไปหน้าเข้าสู่ระบบ")}</span>
              </button>
            </div>
          )}

          {statusAlert && (
            <div
              className={
                statusAlert.tone === 'ok'
                  ? 'success-callout'
                  : 'error-callout'
              }
              role="alert"
            >
              <IconAlert size={16} />
              <span>{tx(statusAlert.text)}</span>
            </div>
          )}

          {/* Unsaved Changes Confirmation Banner */}
          {pendingSwitchTarget && (
            <div className="error-callout" role="alert">
              <IconAlert size={18} />
              <div className="callout-flex">
                <span>
                  <strong>{tx("มีข้อมูลที่กรอกค้างไว้ในฟอร์ม:")}</strong>{' '}
                  {tx("ระบบจะเก็บชื่อ อีเมล และเบอร์โทรพื้นฐานไว้ให้ ยืนยันการสลับประเภทการสมัครหรือไม่?")}
                </span>
                <div className="cta-inline-row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      setSignupFlowMode(pendingSwitchTarget);
                      setPendingSwitchTarget(null);
                      setStatusAlert(null);
                    }}
                  >
                    {tx("ยืนยันการสลับ")}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => setPendingSwitchTarget(null)}
                  >
                    {tx("ทำรายการเดิมต่อ")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 1: SIGN IN (SOCIAL FIRST)
             ================================================================= */}
          {authTab === 'signin' && (
            <>

              {sandboxAuthEnabled && (
              <>              {/* Social login: Google, Facebook, LINE */}
              <div className="social-buttons-stack">
                {/* Layer 4: Google Login */}
                <button
                  type="button"
                  className="btn-social btn-social-google"
                  onClick={() => handleSocialButton('google', 'existing')}
                >
                  <IconGoogleMark size={18} />
                  <span>{tx("ดำเนินการต่อด้วย Google")}</span>
                </button>

                {/* Layer 5: Facebook Login */}
                <button
                  type="button"
                  className="btn-social btn-social-facebook"
                  onClick={() => handleSocialButton('facebook', 'existing')}
                >
                  <IconFacebookMark size={18} />
                  <span>{tx("ดำเนินการต่อด้วย Facebook")}</span>
                </button>

                {/* Layer 6: LINE Login */}
                <button
                  type="button"
                  className="btn-social btn-social-line"
                  onClick={() => handleSocialButton('line', 'existing')}
                >
                  <IconLineMark size={18} />
                  <span>{tx("ดำเนินการต่อด้วย LINE")}</span>
                </button>

              </div>

              <div className="divider-line-text">
                <span>{tx("หรือเข้าสู่ระบบด้วยอีเมล")}</span>
              </div>
              </>
              )}

              <form onSubmit={handleEmailSignIn} className="auth-cred-form">
                {/* Layer 1: Username / Email */}
                <div className="form-row">
                  <label htmlFor="signin-email">
                    {tx("อีเมล")}
                  </label>
                  <input
                    id="signin-email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={tx("name@example.com")}
                    autoComplete="username"
                    required
                  />
                </div>

                {/* Layer 2: Password */}
                <div className="form-row">
                  <label htmlFor="signin-pass">{tx("รหัสผ่าน")}</label>
                  <div className="password-field-wrap">
                    <input
                      id="signin-pass"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tx("กรอกรหัสผ่านของคุณ")}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      className="password-eye-btn"
                      onClick={() => setShowPassword((v) => !v)}
                      title={
                        showPassword ? tx("ซ่อนรหัสผ่าน") : tx("แสดงรหัสผ่าน")
                      }
                      aria-label={
                        showPassword ? tx("ซ่อนรหัสผ่าน") : tx("แสดงรหัสผ่าน")
                      }
                    >
                      {showPassword ? (
                        <IconEyeOff size={17} />
                      ) : (
                        <IconEye size={17} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Layer 3: Forgot Password + Sign In Button */}
                <div className="auth-forgot-row">
                  <button
                    type="button"
                    className="auth-inline-link-btn"
                    onClick={() => {
                      setAuthTab('forgot');
                      setStatusAlert(null);
                      window.history.replaceState({}, '', '/login?mode=forgot');
                    }}
                  >
                    {tx("ลืมรหัสผ่าน?")}
                  </button>
                </div>

                <button type="submit" className="btn-primary btn-full">
                  <IconLock size={16} />
                  <span>{tx("เข้าสู่ระบบ")}</span>
                </button>
              </form>

              {socialPendingStep?.mode === 'provider_cancelled' && (
                <div className="status-explanation-banner" role="alert">
                  <IconAlert size={16} />
                  <span>
                    {tx("การยืนยันตัวตนผ่าน ")} {socialPendingStep.provider.toUpperCase()}{' '}
                    {tx("ถูกยกเลิกหรือหมดเวลา — ยังไม่มีการสร้างหรือเปลี่ยนสถานะบัญชี กรุณาเลือกวิธีเข้าสู่ระบบอีกครั้ง")}
                  </span>
                </div>
              )}

              {socialPendingStep?.mode === 'new_line_no_email' && (
                <div className="social-onboarding-box">
                  <h2>{tx("ตั้งค่าบัญชีใหม่จาก LINE (กรณี LINE ไม่ส่งอีเมล)")}</h2>
                  <p className="muted-block">
                    {tx("ระบบสร้างบัญชีจากรหัสตัวตน LINE ที่ตรวจสอบแล้วโดยไม่สร้างอีเมลสมมติแทน คุณสามารถเพิ่มและยืนยันอีเมลภายหลังเมื่อต้องการรับใบเสร็จหรือคำเชิญทีม")}
                  </p>
                  <div className="form-row">
                    <label htmlFor="line-new-name">
                      {tx("ชื่อที่ใช้แสดงในบัญชี (ชื่อจริงสำหรับแข่งขันจะถามแยกเมื่อสมัครงานวิ่ง)")}
                    </label>
                    <input
                      id="line-new-name"
                      type="text"
                      value={socialPendingStep.tempName}
                      onChange={(e) =>
                        setSocialPendingStep({
                          ...socialPendingStep,
                          tempName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={socialTermsAccepted}
                      onChange={(e) => setSocialTermsAccepted(e.target.checked)}
                    />
                    <span>{tx("ยอมรับข้อกำหนดการใช้งานแพลตฟอร์ม (v1.0)")}</span>
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!socialTermsAccepted}
                    onClick={() => {
                      const tempName = socialPendingStep.tempName;
                      requirePrivacyConsent(() => {
                        const created = onRegisterSocialUser({
                          provider: 'line',
                          fullNameTh: tempName.trim() || 'ผู้ใช้ LINE ใหม่',
                          email: null,
                          marketingConsent: false,
                        });
                        setSocialPendingStep(null);
                        onAuthenticated(created);
                      });
                    }}
                  >
                    {tx("ยืนยันสร้างบัญชีและเข้าใช้งาน")}
                  </button>
                  {signupPrivacyNote(false)}
                </div>
              )}

              {socialPendingStep?.mode === 'email_collision_verify' &&
                socialPendingStep.collisionUser && (
                  <div className="social-onboarding-box">
                    <h2>{tx("พบอีเมลตรงกับบัญชีเดิม — ต้องยืนยันเจ้าของก่อนเชื่อม")}</h2>
                    <p className="muted-block">
                      {tx("อีเมล")}{' '}
                      <strong>
                        {tx(socialPendingStep.collisionUser.contactEmail)}
                      </strong>{' '}
                      {tx("มีบัญชีอยู่แล้ว ระบบจะ")}<strong>{tx("ไม่รวมบัญชีอัตโนมัติ")}</strong>{' '}
                      {tx("กรุณากรอกรหัสผ่านของบัญชีเดิมเพื่อยืนยันความเป็นเจ้าของก่อนผูก Google")}
                    </p>
                    <div className="form-row">
                      <label htmlFor="collision-pass">
                        {tx("รหัสผ่านบัญชีเดิม (ทดสอบใช้รหัส ")} <code>demo1234</code>)
                      </label>
                      <input
                        id="collision-pass"
                        type="password"
                        value={collisionPasswordCheck}
                        onChange={(e) =>
                          setCollisionPasswordCheck(e.target.value)
                        }
                      />
                    </div>
                    <div className="cta-inline-row">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          if (!collisionPasswordCheck.trim()) return;
                          const target = socialPendingStep.collisionUser!;
                          setSocialPendingStep(null);
                          onAuthenticated(
                            target,
                            target.memberships[0]?.organizationId
                          );
                        }}
                      >
                        {tx("ยืนยันรหัสผ่านและเข้าสู่บัญชีเดิม")}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => setSocialPendingStep(null)}
                      >
                        {tx("ยกเลิก")}
                      </button>
                    </div>
                  </div>
                )}

              {/* Layer 8: Spaced Divider -> Register */}
              <div className="auth-register-footer-row">
                <span className="muted-inline">{tx("ยังไม่มีบัญชีผู้ใช้งาน?")}</span>
                <button
                  type="button"
                  className="auth-register-cta-link"
                  onClick={() => {
                    setAuthTab('signup');
                    setRunnerStep(1);
                    setSignupFlowMode(
                      ENABLE_ORGANIZER_SELF_ONBOARDING
                        ? 'select_type'
                        : 'runner_wizard'
                    );
                    setStatusAlert(null);
                    window.history.replaceState({}, '', '/login?mode=signup');
                  }}
                >
                  <span>{tx("สมัครสมาชิกใหม่")}</span>
                  <IconArrowRight size={14} />
                </button>
              </div>
            </>
          )}

          {/* Sign-in / forgot: the notice stays readable at the foot of the card (no acknowledgement).
              Sign-up shows its own note under each create-account button instead. */}
          {authTab !== 'signup' && (
            <p className="auth-privacy-link-row">
              <button
                type="button"
                className="auth-inline-link-btn"
                onClick={() => setPrivacyReadOpen(true)}
              >
                {tx("ประกาศความเป็นส่วนตัว (PDPA)")}
              </button>
            </p>
          )}
          <PrivacyNoticeModal
            open={privacyReadOpen}
            mode="read"
            onCancel={() => setPrivacyReadOpen(false)}
          />

          {/* =================================================================
              TAB 2: COMPLETE REGISTRATION SYSTEM (ACCOUNT SELECTION + WIZARDS)
             ================================================================= */}
          {authTab === 'signup' && (
            <div className="canvas-stack">
              {/* 1. ACCOUNT TYPE SELECTION ENTRY POINT (Folded when ENABLE_ORGANIZER_SELF_ONBOARDING is false) */}
              {ENABLE_ORGANIZER_SELF_ONBOARDING && signupFlowMode === 'select_type' && (
                <div className="canvas-stack">
                  <div className="auth-role-grid">
                    {/* Runner Card */}
                    <article className="auth-role-option">
                      <div className="auth-role-body">
                        <div className="auth-role-head">
                          <span className="auth-role-icon tone-runner" aria-hidden="true">
                            <IconUsers size={18} />
                          </span>
                          <div className="auth-role-title-group">
                            <h2>{tx("นักวิ่งและผู้ใช้งานทั่วไป")}</h2>
                            <span className="auth-role-meta">
                              {tx("บัญชีนักวิ่ง · 2 ขั้นตอน")}
                            </span>
                          </div>
                        </div>
                        <p className="muted-block">
                          {tx("ค้นหางานวิ่งทั่วไทย สมัครเข้าร่วมแข่งขัน ซื้อเสื้อที่ระลึก และจัดการบัตรวิ่ง QR ของคุณในที่เดียว")}
                        </p>
                        <ul className="feature-bullet-list">
                          <li>{tx("สมัครง่ายใน 2 ขั้นตอน (ข้ามฟิลด์โปรไฟล์ไม่บังคับไปเติมภายหลังได้)")}</li>
                          <li>{tx("ไม่บังคับเลือกไซส์เสื้อหรือระยะวิ่งตอนเปิดบัญชี (เลือกแยกตามแต่ละงานวิ่ง)")}</li>
                          <li>{tx("รองรับเข้าใช้งานด้วยอีเมล, Google, Facebook และ LINE")}</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="btn-primary btn-full"
                        onClick={() => {
                          setRunnerStep(1);
                          setSignupFlowMode('runner_wizard');
                        }}
                      >
                        <span>{tx("สมัครเป็นนักวิ่ง")}</span>
                        <IconArrowRight size={15} />
                      </button>
                    </article>

                    {/* Organizer Card */}
                    <article className="auth-role-option">
                      <div className="auth-role-body">
                        <div className="auth-role-head">
                          <span className="auth-role-icon tone-organizer" aria-hidden="true">
                            <IconBuilding size={18} />
                          </span>
                          <div className="auth-role-title-group">
                            <h2>{tx("องค์กรและผู้จัดงานวิ่ง")}</h2>
                            <span className="auth-role-meta">
                              {tx("ยืนยันตัวตนผู้จัด · 3 ขั้นตอน")}
                            </span>
                          </div>
                        </div>
                        <p className="muted-block">
                          {tx("สำหรับบริษัท หน่วยงานรัฐ ชมรมวิ่ง หรือผู้จัดอิสระที่ต้องการเปิดรับสมัครงานวิ่งและบริหารจัดการครบวงจร")}
                        </p>
                        <ul className="feature-bullet-list">
                          <li>{tx("กรอกข้อมูลผู้ติดต่อ ข้อมูลองค์กร/ที่อยู่ และอัปโหลดเอกสารยืนยันตัวตน (KYC)")}</li>
                          <li>{tx("รองรับการบันทึกแบบร่าง (Save Draft) เพื่อกลับมาทำต่อ")}</li>
                          <li>{tx("เข้าสู่กระบวนการตรวจสอบ 7 สถานะโดย Platform Owner ก่อนเปิดขายจริง")}</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary btn-full"
                        onClick={() => {
                          setOrgStep(1);
                          setSignupFlowMode('organizer_wizard');
                        }}
                      >
                        <IconBuilding size={15} />
                        <span>{tx("ขึ้นทะเบียนผู้จัดงาน")}</span>
                      </button>
                    </article>
                  </div>
                </div>
              )}

              {/* 2. SINGLE-CARD 1-COLUMN REGISTRATION TEMPLATE (MATCHES LOGIN) */}
              {signupFlowMode === 'runner_wizard' && (
                <div className="canvas-stack">
                  {ENABLE_ORGANIZER_SELF_ONBOARDING && (
                    <div
                      className="cta-inline-row"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => {
                          if (hasUnsavedWizardData) {
                            setPendingSwitchTarget('select_type');
                          } else {
                            setSignupFlowMode('select_type');
                          }
                        }}
                      >
                        <IconArrowLeft size={14} />
                        <span>{tx("กลับหน้าเลือกประเภทบัญชี")}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => {
                          if (hasUnsavedWizardData) {
                            setPendingSwitchTarget('organizer_wizard');
                          } else {
                            setSignupFlowMode('organizer_wizard');
                          }
                        }}
                      >
                        <span>{tx("สลับไปสมัครเป็น Organizer (รักษาข้อมูลที่กรอกไว้)")}</span>
                        <IconArrowRight size={13} />
                      </button>
                    </div>
                  )}

                  {runnerStep === 1 && (
                    <>
                      {/* Social signup: Google, Facebook, LINE */}
                      {sandboxAuthEnabled && (
                      <>
                      <div className="social-buttons-stack">
                        <button
                          type="button"
                          className="btn-social btn-social-google"
                          onClick={() => {
                            setFirstName('กิตติพงศ์');
                            setLastName('เจริญรัตน์');
                            setRegEmail('kittipong.runner@gmail.demo.local');
                            setSocialAuthPrepopulated('google');
                            setStatusAlert({
                              tone: 'ok',
                              text: tx("ดึงชื่อและอีเมลจากบัญชี Google แล้ว ตรวจสอบข้อมูลแล้วกดสมัครสมาชิกเพื่อไปต่อ"),
                            });
                          }}
                        >
                          <IconGoogleMark size={18} />
                          <span>{tx("ดำเนินการต่อด้วย Google")}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-social btn-social-facebook"
                          onClick={() => {
                            setFirstName('ณัฐณิชา');
                            setLastName('อัครเดช');
                            setRegEmail('nattanicha.fb@demo.local');
                            setSocialAuthPrepopulated('facebook');
                            setStatusAlert({
                              tone: 'ok',
                              text: tx("ดึงชื่อและอีเมลจาก Facebook เรียบร้อยแล้ว ตรวจสอบข้อมูลแล้วกดสมัครสมาชิกเพื่อไปต่อ"),
                            });
                          }}
                        >
                          <IconFacebookMark size={18} />
                          <span>{tx("ดำเนินการต่อด้วย Facebook")}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-social btn-social-line"
                          onClick={() => {
                            setFirstName('ปาริชาติ');
                            setLastName('สายลมเหนือ');
                            setRegEmail('parichat.line@demo.local');
                            setSocialAuthPrepopulated('line');
                            setStatusAlert({
                              tone: 'ok',
                              text: tx("ดึงข้อมูลโปรไฟล์จาก LINE เรียบร้อยแล้ว ตรวจสอบข้อมูลแล้วกดสมัครสมาชิกเพื่อไปต่อ"),
                            });
                          }}
                        >
                          <IconLineMark size={18} />
                          <span>{tx("ดำเนินการต่อด้วย LINE")}</span>
                        </button>

                      </div>

                      <div className="divider-line-text">
                        <span>{tx("หรือสมัครสมาชิกด้วยอีเมล")}</span>
                      </div>
                      </>
                      )}

                      <form
                        className="auth-cred-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (validateStep1AccountFields(false)) {
                            setRunnerStep(2);
                          }
                        }}
                      >
                        {/* 1. First Name (Accepts EN or TH — Auto-mapped on Save) */}
                        <div className="form-row">
                          <label htmlFor="rn-fname">
                            {<RequiredFieldText text={tx("ชื่อจริง (ภาษาไทยหรืออังกฤษ) *")} />}
                          </label>
                          <input
                            id="rn-fname"
                            type="text"
                            value={firstName}
                            onChange={(e) =>
                              setFirstName(
                                sanitizeSingleLanguageNameInput(e.target.value)
                              )
                            }
                            placeholder={tx("Kanpitcha หรือ กานต์พิชชา")}
                            required
                          />
                        </div>

                        {/* 2. Last Name (Accepts EN or TH — Auto-mapped on Save) */}
                        <div className="form-row">
                          <label htmlFor="rn-lname">
                            {<RequiredFieldText text={tx("นามสกุล (ภาษาไทยหรืออังกฤษ) *")} />}
                          </label>
                          <input
                            id="rn-lname"
                            type="text"
                            value={lastName}
                            onChange={(e) =>
                              setLastName(
                                sanitizeSingleLanguageNameInput(e.target.value)
                              )
                            }
                            placeholder={tx("Wattanakul หรือ วัฒนากูล")}
                            required
                          />
                        </div>

                        {/* 3. Email */}
                        <div className="form-row">
                          <label htmlFor="rn-email">
                            {<RequiredFieldText text={tx("อีเมล *")} />}
                          </label>
                          <input
                            id="rn-email"
                            type="email"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="runner@example.com"
                            autoComplete="email"
                            required
                          />
                        </div>

                        {/* 4. Phone Number */}
                        <div className="form-row">
                          <label htmlFor="rn-phone">
                            {tx("เบอร์โทรศัพท์ (ไม่บังคับ)")}
                          </label>
                          <PhoneInput
                            id="rn-phone"
                            value={regPhone}
                            onChange={(next) => setRegPhone(next)}
                          />
                        </div>

                        {/* 5 & 6. Password + Confirm Password (with independent show/hide toggles) */}
                        {!socialAuthPrepopulated && (
                          <>
                            <div className="form-row">
                              <label htmlFor="rn-pass">
                                {<RequiredFieldText text={tx("รหัสผ่าน (อย่างน้อย 8 ตัวอักษร) *")} />}
                              </label>
                              <div className="password-field-wrap">
                                <input
                                  id="rn-pass"
                                  type={showRegPassword ? 'text' : 'password'}
                                  value={regPass}
                                  onChange={(e) => setRegPass(e.target.value)}
                                  placeholder={tx("ตั้งรหัสผ่านอย่างน้อย 8 ตัวอักษร")}
                                  autoComplete="new-password"
                                  required
                                />
                                <button
                                  type="button"
                                  className="password-eye-btn"
                                  onClick={() => setShowRegPassword((v) => !v)}
                                  title={
                                    showRegPassword
                                      ? tx("ซ่อนรหัสผ่าน")
                                      : tx("แสดงรหัสผ่าน")
                                  }
                                  aria-label={
                                    showRegPassword
                                      ? tx("ซ่อนรหัสผ่าน")
                                      : tx("แสดงรหัสผ่าน")
                                  }
                                >
                                  {showRegPassword ? (
                                    <IconEyeOff size={17} />
                                  ) : (
                                    <IconEye size={17} />
                                  )}
                                </button>
                              </div>
                            </div>

                            <div className="form-row">
                              <label htmlFor="rn-cpass">
                                {<RequiredFieldText text={tx("ยืนยันรหัสผ่าน *")} />}
                              </label>
                              <div className="password-field-wrap">
                                <input
                                  id="rn-cpass"
                                  type={
                                    showRegConfirmPassword ? 'text' : 'password'
                                  }
                                  value={regConfirmPass}
                                  onChange={(e) =>
                                    setRegConfirmPass(e.target.value)
                                  }
                                  placeholder={tx("กรอกรหัสผ่านอีกครั้งเพื่อยืนยัน")}
                                  autoComplete="new-password"
                                  required
                                />
                                <button
                                  type="button"
                                  className="password-eye-btn"
                                  onClick={() =>
                                    setShowRegConfirmPassword((v) => !v)
                                  }
                                  title={
                                    showRegConfirmPassword
                                      ? tx("ซ่อนรหัสผ่านยืนยัน")
                                      : tx("แสดงรหัสผ่านยืนยัน")
                                  }
                                  aria-label={
                                    showRegConfirmPassword
                                      ? tx("ซ่อนรหัสผ่านยืนยัน")
                                      : tx("แสดงรหัสผ่านยืนยัน")
                                  }
                                >
                                  {showRegConfirmPassword ? (
                                    <IconEyeOff size={17} />
                                  ) : (
                                    <IconEye size={17} />
                                  )}
                                </button>
                              </div>
                            </div>

                            {regPass.length > 0 && (
                              <div className="cta-inline-row">
                                <span
                                  className={`status-pill ${pwStrength.toneClass}`}
                                >
                                  <span>{tx(pwStrength.label)}</span>
                                </span>
                              </div>
                            )}
                          </>
                        )}

                        <button type="submit" className="btn-primary btn-full">
                          <span>{tx("สมัครสมาชิก")}</span>
                          <IconArrowRight size={15} />
                        </button>
                        {signupPrivacyNote(sandboxAuthEnabled)}
                      </form>

                      {/* Spaced Footer -> Back to Sign In (Mirrors Login Layer 8) */}
                      <div className="auth-register-footer-row">
                        <span className="muted-inline">
                          {tx("มีบัญชีผู้ใช้งานอยู่แล้ว?")}
                        </span>
                        <button
                          type="button"
                          className="auth-register-cta-link"
                          onClick={() => {
                            setAuthTab('signin');
                            setStatusAlert(null);
                            window.history.replaceState({}, '', '/login');
                          }}
                        >
                          <span>{tx("เข้าสู่ระบบ")}</span>
                          <IconArrowRight size={14} />
                        </button>
                      </div>
                    </>
                  )}

                  {/* STEP 2: ESSENTIAL PROFILE INFO ONLY (REST DEFERRED TO /profile) */}
                  {runnerStep === 2 && (
                    <div className="auth-cred-form">
                      {detectNameScript(firstName) === 'en' ? (
                        <>
                          <div className="form-row">
                            <label htmlFor="rn-alt-fn-th">
                              {tx("ชื่อจริงภาษาไทย (ไม่บังคับ)")}
                            </label>
                            <input
                              id="rn-alt-fn-th"
                              type="text"
                              value={runnerAltFirstNameTh}
                              onChange={(e) =>
                                setRunnerAltFirstNameTh(
                                  sanitizeThaiNameInput(e.target.value)
                                )
                              }
                              placeholder={tx("เช่น กานต์พิชชา")}
                            />
                          </div>

                          <div className="form-row">
                            <label htmlFor="rn-alt-ln-th">
                              {tx("นามสกุลภาษาไทย (ไม่บังคับ)")}
                            </label>
                            <input
                              id="rn-alt-ln-th"
                              type="text"
                              value={runnerAltLastNameTh}
                              onChange={(e) =>
                                setRunnerAltLastNameTh(
                                  sanitizeThaiNameInput(e.target.value)
                                )
                              }
                              placeholder={tx("เช่น วัฒนากูล")}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="form-row">
                            <label htmlFor="rn-fname-en">
                              {<RequiredFieldText text={tx("ชื่อจริงภาษาอังกฤษ *")} />}
                            </label>
                            <input
                              id="rn-fname-en"
                              type="text"
                              value={runnerFirstNameEn}
                              onChange={(e) =>
                                setRunnerFirstNameEn(
                                  sanitizeEnglishNameInput(e.target.value)
                                )
                              }
                              placeholder="e.g. Kanpitcha"
                              required
                            />
                          </div>

                          <div className="form-row">
                            <label htmlFor="rn-lname-en">
                              {<RequiredFieldText text={tx("นามสกุลภาษาอังกฤษ *")} />}
                            </label>
                            <input
                              id="rn-lname-en"
                              type="text"
                              value={runnerLastNameEn}
                              onChange={(e) =>
                                setRunnerLastNameEn(
                                  sanitizeEnglishNameInput(e.target.value)
                                )
                              }
                              placeholder="e.g. Wattanakul"
                              required
                            />
                          </div>
                        </>
                      )}

                      <div className="form-row">
                        <label htmlFor="rn-dob">
                          {tx("วันเกิด (ไม่บังคับ)")}
                        </label>
                        <DateOfBirthInput
                          id="rn-dob"
                          valueIso={runnerDob}
                          onChangeIso={setRunnerDob}
                        />
                      </div>

                      <fieldset className="runner-gender-field">
                        <legend>{tx("เพศ (ไม่บังคับ)")}</legend>
                        <div className="runner-gender-options">
                          {(['ชาย', 'หญิง'] as const).map((opt) => (
                            <label key={opt}>
                              <input
                                type="radio"
                                name="rn-reg-gender"
                                value={opt}
                                checked={runnerGender === opt}
                                onChange={() => setRunnerGender(opt)}
                              />
                              <span>{tx(opt)}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="form-row">
                        <label htmlFor="rn-nat">
                          {tx("สัญชาติ")}
                        </label>
                        <NationalitySelect
                          id="rn-nat"
                          value={runnerNationality}
                          onChange={setRunnerNationality}
                        />
                      </div>

                      <div className="form-row">
                        <label htmlFor="rn-idtype">
                          {tx("ประเภทเอกสารยืนยันตัวตน (บัตรประชาชน / Passport)")}
                        </label>
                        <select
                          id="rn-idtype"
                          value={runnerIdType}
                          onChange={(e) =>
                            setRunnerIdType(
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
                          <option value="none">
                            {tx("-- ยังไม่ระบุในขั้นตอนนี้ --")}
                          </option>
                        </select>
                      </div>

                      {runnerIdType !== 'none' && (
                        <div className="form-row">
                          <label htmlFor="rn-idnum">
                            {runnerIdType === 'thai_id'
                              ? tx("เลขบัตรประจำตัวประชาชน (13 หลัก · ไม่บังคับ)")
                              : tx("เลขหนังสือเดินทาง (ไม่บังคับ)")}
                          </label>
                          <IdNumberInput
                            id="rn-idnum"
                            idType={runnerIdType}
                            className="mono-code"
                            value={runnerIdNumber}
                            onValueChange={setRunnerIdNumber}
                            placeholder={
                              runnerIdType === 'thai_id'
                                ? 'X-XXXX-XXXXX-XX-X'
                                : 'Passport No.'
                            }
                          />
                        </div>
                      )}

                      <fieldset className="runner-shirt-radio-field">
                        <legend>{tx("ไซส์เสื้อวิ่งเริ่มต้น (ไม่บังคับ)")}</legend>
                        <div className="runner-shirt-radio-group">
                          <label
                            className={`runner-shirt-radio-option ${
                              runnerShirtSize === '' ? 'is-selected' : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="rn-reg-shirt-size"
                              value=""
                              checked={runnerShirtSize === ''}
                              onChange={() => setRunnerShirtSize('')}
                            />
                            <span>{tx("ไม่ระบุ")}</span>
                          </label>
                          {DEFAULT_SHIRT_SIZES.filter((s) => s.enabled).map(
                            (sz) => (
                              <label
                                key={sz.code}
                                className={`runner-shirt-radio-option ${
                                  runnerShirtSize === sz.code
                                    ? 'is-selected'
                                    : ''
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="rn-reg-shirt-size"
                                  value={sz.code}
                                  checked={runnerShirtSize === sz.code}
                                  onChange={() => setRunnerShirtSize(sz.code)}
                                />
                                <span>{sz.code}</span>
                              </label>
                            )
                          )}
                        </div>
                      </fieldset>

                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={marketingOptIn}
                          onChange={(e) => setMarketingOptIn(e.target.checked)}
                        />
                        <span>
                          {tx("[ไม่บังคับ] รับข่าวสารงานวิ่งเปิดใหม่และสิทธิพิเศษจาก กระต่าย")}
                        </span>
                      </label>

                      <button
                        type="button"
                        className="btn-primary btn-full"
                        onClick={(e) => {
                          if (!reportInvalidFieldsWithin(e.currentTarget.closest('.auth-cred-form'))) return;
                          requirePrivacyConsent(() => handleCompleteRunnerRegistration(false));
                        }}
                      >
                        <IconCheckCircle size={15} />
                        <span>{tx("บันทึกโปรไฟล์และสร้างบัญชี")}</span>
                      </button>

                      <button
                        type="button"
                        className="btn-secondary btn-full"
                        onClick={() =>
                          requirePrivacyConsent(() => handleCompleteRunnerRegistration(true))
                        }
                      >
                        <span>{tx("ข้ามข้อมูลไม่บังคับและสร้างบัญชีทันที")}</span>
                      </button>
                      {signupPrivacyNote(false)}

                      <div className="auth-register-footer-row">
                        <button
                          type="button"
                          className="auth-inline-link-btn"
                          onClick={() => setRunnerStep(1)}
                        >
                          {tx("← ย้อนกลับไปแก้ไขข้อมูลบัญชี (ขั้นตอนที่ 1)")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. ORGANIZER 3-STEP REGISTRATION WIZARD (FOLDED WHILE SELF-ONBOARDING IS SHELVED) */}
              {ENABLE_ORGANIZER_SELF_ONBOARDING &&
                signupFlowMode === 'organizer_wizard' && (
                  <div className="canvas-stack">
                    <div
                      className="cta-inline-row"
                      style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
                    >
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => {
                          if (hasUnsavedWizardData) {
                            setPendingSwitchTarget('select_type');
                          } else {
                            setSignupFlowMode('select_type');
                          }
                        }}
                      >
                        <IconArrowLeft size={14} />
                        <span>{tx("กลับหน้าเลือกประเภทบัญชี")}</span>
                      </button>

                      <div className="cta-inline-row">
                        <button
                          type="button"
                          className="btn-ghost-sm"
                          onClick={handleLoadOrganizerDraft}
                        >
                          {tx("โหลดแบบร่างเดิม")}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleSaveOrganizerDraft}
                        >
                          {tx("บันทึกแบบร่าง (Save Draft)")}
                        </button>
                      </div>
                    </div>

                    {draftSavedNotice && (
                      <div className="success-callout" role="status">
                        <IconCheckCircle size={17} />
                        <span>{tx(draftSavedNotice)}</span>
                      </div>
                    )}

                    {/* 3-Step Progress Stepper */}
                    <div className="wizard-steps-indicator">
                      <button
                        type="button"
                        className={`step-pill ${orgStep === 1 ? 'current' : 'done'
                          }`}
                        onClick={() => setOrgStep(1)}
                      >
                        Step 1: Account & Contact
                      </button>
                      <button
                        type="button"
                        className={`step-pill ${orgStep === 2
                          ? 'current'
                          : orgStep > 2
                            ? 'done'
                            : ''
                          }`}
                        onClick={() => {
                          if (validateStep1AccountFields(true)) {
                            setOrgStep(2);
                          }
                        }}
                      >
                        Step 2: Organization Details
                      </button>
                      <button
                        type="button"
                        className={`step-pill ${orgStep === 3 ? 'current' : ''}`}
                        onClick={() => {
                          if (
                            validateStep1AccountFields(true) &&
                            orgNameTh.trim() &&
                            officeAddress.trim()
                          ) {
                            setOrgStep(3);
                          } else {
                            setStatusAlert({
                              tone: 'err',
                              text: tx("กรุณากรอกข้อมูลใน Step 1 และ Step 2 (ชื่อองค์กรและที่อยู่สำนักงาน) ให้ครบก่อนไปขั้นตอนที่ 3"),
                            });
                          }
                        }}
                      >
                        Step 3: Identity & Verification
                      </button>
                    </div>

                    {/* STEP 1: ACCOUNT & CONTACT INFORMATION */}
                    {orgStep === 1 && (
                      <div className="custom-field-creator">
                        <h2>
                          {tx("Step 1 — Account & Contact Information (ข้อมูลบัญชีและผู้ยื่นคำขอ)")}
                        </h2>
                        <div className="auth-social-grid">
                          <button
                            type="button"
                            className="btn-social btn-social-google"
                            onClick={() => {
                              setFirstName('ทานตะวัน');
                              setLastName('วงศ์เจริญ');
                              setRegEmail('director.google@organization.demo.local');
                              setSocialAuthPrepopulated('google');
                              setStatusAlert({
                                tone: 'ok',
                                text: tx("ดึงชื่อและอีเมลจาก Google Account เรียบร้อยแล้ว คุณสามารถแก้ไขข้อมูลก่อนกดถัดไปได้"),
                              });
                            }}
                          >
                            <IconGoogleMark size={17} />
                            <span>{tx("ดำเนินการต่อด้วย Google")}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-social btn-social-facebook"
                            onClick={() => {
                              setFirstName('วรพล');
                              setLastName('กิจเจริญ');
                              setRegEmail('worapol.fb@organization.demo.local');
                              setSocialAuthPrepopulated('facebook');
                              setStatusAlert({
                                tone: 'ok',
                                text: tx("ดึงชื่อและอีเมลจาก Facebook เรียบร้อยแล้ว คุณสามารถแก้ไขข้อมูลก่อนกดถัดไปได้"),
                              });
                            }}
                          >
                            <IconFacebookMark size={17} />
                            <span>{tx("ดำเนินการต่อด้วย Facebook")}</span>
                          </button>
                          <button
                            type="button"
                            className="btn-social btn-social-line"
                            onClick={() => {
                              setFirstName('ชลธิชา');
                              setLastName('รุ่งเรือง');
                              setRegEmail('chonthicha.line@organization.demo.local');
                              setSocialAuthPrepopulated('line');
                              setStatusAlert({
                                tone: 'ok',
                                text: tx("ดึงข้อมูลโปรไฟล์จาก LINE เรียบร้อยแล้ว คุณสามารถแก้ไขข้อมูลก่อนกดถัดไปได้"),
                              });
                            }}
                          >
                            <IconLineMark size={17} />
                            <span>{tx("ดำเนินการต่อด้วย LINE")}</span>
                          </button>
                        </div>
                        <div className="form-grid-3">
                          <div className="form-row">
                            <label htmlFor="og-fn">{<RequiredFieldText text={tx("First Name (ชื่อจริง) *")} />}</label>
                            <input
                              id="og-fn"
                              type="text"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              placeholder={tx("เช่น ทานตะวัน")}
                              required
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-ln">{<RequiredFieldText text={tx("Last Name (นามสกุล) *")} />}</label>
                            <input
                              id="og-ln"
                              type="text"
                              value={lastName}
                              onChange={(e) => setLastName(e.target.value)}
                              placeholder={tx("เช่น วงศ์เจริญ")}
                              required
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-pos">
                              {<RequiredFieldText text={tx("Position / Job Title (ตำแหน่งในองค์กร) *")} />}
                            </label>
                            <input
                              id="og-pos"
                              type="text"
                              value={jobTitle}
                              onChange={(e) => setJobTitle(e.target.value)}
                              placeholder={tx("เช่น Race Director / กรรมการผู้จัดการ")}
                              required
                            />
                          </div>
                        </div>

                        <div
                          className="form-grid-2"
                          style={{ marginTop: '0.6rem' }}
                        >
                          <div className="form-row">
                            <label htmlFor="og-em">{<RequiredFieldText text={tx("Email (อีเมลติดต่อหลัก) *")} />}</label>
                            <input
                              id="og-em"
                              type="email"
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="director@organization.co.th"
                              required
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-ph">{<RequiredFieldText text={tx("Phone Number (เบอร์โทรศัพท์) *")} />}</label>
                            <PhoneInput
                              id="og-ph"
                              value={regPhone}
                              onChange={(next) => setRegPhone(next)}
                              required
                            />
                          </div>
                        </div>

                        {!socialAuthPrepopulated && (
                          <>
                            <div
                              className="form-grid-2"
                              style={{ marginTop: '0.6rem' }}
                            >
                              <div className="form-row">
                                <label htmlFor="og-pw">
                                  {<RequiredFieldText text={tx("รหัสผ่าน (อย่างน้อย 8 ตัวอักษร) *")} />}
                                </label>
                                <input
                                  id="og-pw"
                                  type="password"
                                  value={regPass}
                                  onChange={(e) => setRegPass(e.target.value)}
                                />
                              </div>
                              <div className="form-row">
                                <label htmlFor="og-cpw">
                                  {<RequiredFieldText text={tx("ยืนยันรหัสผ่าน *")} />}
                                </label>
                                <input
                                  id="og-cpw"
                                  type="password"
                                  value={regConfirmPass}
                                  onChange={(e) =>
                                    setRegConfirmPass(e.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <div
                              className="cta-inline-row"
                              style={{ marginTop: '0.45rem' }}
                            >
                              <span
                                className={`status-pill ${pwStrength.toneClass}`}
                              >
                                <span>{tx(pwStrength.label)}</span>
                              </span>
                            </div>
                          </>
                        )}

                        <div className="cta-inline-row" style={{ marginTop: '0.9rem' }}>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                              if (validateStep1AccountFields(true)) {
                                setOrgStep(2);
                              }
                            }}
                          >
                            <span>{tx("ถัดไป: Step 2 ข้อมูลองค์กรและที่อยู่")}</span>
                            <IconArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: ORGANIZATION DETAILS (SECTIONS A, B, C, D) */}
                    {orgStep === 2 && (
                      <div className="custom-field-creator">
                        <h2>{tx("Step 2 — Organization Details (ข้อมูลองค์กรผู้จัดงานวิ่ง)")}</h2>

                        {/* Section A */}
                        <h3 style={{ margin: '0.6rem 0 0.45rem', fontSize: '0.96rem' }}>
                          {tx("Section A — Organization Profile (ข้อมูลพื้นฐานองค์กร)")}
                        </h3>
                        <div className="form-grid-3">
                          <div className="form-row">
                            <label htmlFor="og-nameth">
                              <RequiredFieldText text="Organization Name (Thai) *" />
                            </label>
                            <input
                              id="og-nameth"
                              type="text"
                              value={orgNameTh}
                              onChange={(e) => setOrgNameTh(e.target.value)}
                              placeholder={tx("เช่น บริษัท สยาม เทรล สปอร์ต จำกัด")}
                              required
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-nameen">
                              {tx("Organization Name (English · ไม่บังคับ)")}
                            </label>
                            <input
                              id="og-nameen"
                              type="text"
                              value={orgNameEn}
                              onChange={(e) => setOrgNameEn(e.target.value)}
                              placeholder={tx("เช่น Siam Trail Sports Co., Ltd.")}
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-type"><RequiredFieldText text="Organization Type *" /></label>
                            <select
                              id="og-type"
                              value={orgType}
                              onChange={(e) =>
                                setOrgType(e.target.value as OrganizationType)
                              }
                            >
                              <option value="Private Company">
                                {tx("Private Company (บริษัทเอกชน / นิติบุคคล)")}
                              </option>
                              <option value="Government Organization">
                                {tx("Government Organization (หน่วยงานราชการ / ท้องถิ่น)")}
                              </option>
                              <option value="Sports Club / Association">
                                {tx("Sports Club / Association (ชมรมวิ่ง / สมาคมกีฬา)")}
                              </option>
                              <option value="Independent Organizer">
                                {tx("Independent Organizer (ผู้จัดงานอิสระ)")}
                              </option>
                              <option value="Non-Profit Organization">
                                {tx("Non-Profit Organization (มูลนิธิ / องค์กรการกุศล)")}
                              </option>
                              <option value="Other">{tx("Other (อื่น ๆ)")}</option>
                            </select>
                          </div>
                        </div>

                        <div
                          className="form-grid-3"
                          style={{ marginTop: '0.6rem' }}
                        >
                          <div className="form-row">
                            <label htmlFor="og-regno">
                              Business Registration Number{' '}
                              {orgType === 'Private Company' ||
                                orgType === 'Non-Profit Organization'
                                ? <RequiredFieldText text={tx("(บังคับตามประเภทองค์กร) *")} />
                                : tx("(เลขทะเบียนนิติบุคคล/ชมรม ถ้ามี)")}
                            </label>
                            <input
                              id="og-regno"
                              type="text"
                              className="mono-code"
                              value={businessRegNo}
                              onChange={(e) => setBusinessRegNo(e.target.value)}
                              placeholder={tx("เช่น 0505569001234")}
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-oem"><RequiredFieldText text="Organization Email *" /></label>
                            <input
                              id="og-oem"
                              type="email"
                              value={orgEmail || regEmail}
                              onChange={(e) => setOrgEmail(e.target.value)}
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-oph"><RequiredFieldText text="Organization Phone *" /></label>
                            <PhoneInput
                              id="og-oph"
                              value={orgPhone || regPhone}
                              onChange={(next) => setOrgPhone(next)}
                            />
                          </div>
                        </div>

                        {/* Section B: Cascading Postal Code Address */}
                        <h3 style={{ margin: '0.95rem 0 0.45rem', fontSize: '0.9375rem' }}>
                          {tx("Section B — Office Address (ที่อยู่สำนักงานแบบไล่จากรหัสไปรษณีย์ -> จังหวัด -> อำเภอ -> ตำบล)")}
                        </h3>
                        <ThaiPostalAddressSelector
                          idPrefix="og-office"
                          showCountry={false}
                          required
                          streetAddressLabel="ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)"
                          streetAddressPlaceholder="เช่น 199/8 ถนนห้วยแก้ว"
                          value={{
                            country: 'Thailand',
                            postalCode: officePostalCode,
                            province: officeProvince,
                            district: officeDistrict,
                            subdistrict: officeSubdistrict,
                            address: officeAddress,
                          }}
                          onChange={(next) => {
                            setOfficePostalCode(next.postalCode);
                            setOfficeProvince(next.province);
                            setOfficeDistrict(next.district);
                            setOfficeSubdistrict(next.subdistrict);
                            setOfficeAddress(next.address);
                          }}
                        />

                        {/* Section C: Organization Description */}
                        <h3 style={{ margin: '0.95rem 0 0.45rem', fontSize: '0.96rem' }}>
                          Section C — Organization Description & Previous Events
                        </h3>
                        <div className="form-grid-2">
                          <div className="form-row">
                            <label htmlFor="og-desc">
                              {<RequiredFieldText text={tx("คำอธิบายองค์กรและประสบการณ์จัดงาน *")} />}
                            </label>
                            <textarea
                              id="og-desc"
                              rows={2}
                              value={orgDescription}
                              onChange={(e) => setOrgDescription(e.target.value)}
                              placeholder={tx("ระบุประสบการณ์ของทีมงานและรูปแบบงานวิ่งที่จัด...")}
                            />
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-prev">
                              {tx("ผลงานการจัดงานวิ่งที่ผ่านมา & ลิงก์เพจ Facebook")}
                            </label>
                            <textarea
                              id="og-prev"
                              rows={2}
                              value={previousEvents}
                              onChange={(e) => setPreviousEvents(e.target.value)}
                              placeholder={tx("เช่น งานวิ่ง Chiang Mai City Run 2024–2025, fb.com/...")}
                            />
                          </div>
                        </div>

                        {/* Section D: Main Contact Person */}
                        <h3 style={{ margin: '0.95rem 0 0.45rem', fontSize: '0.96rem' }}>
                          {tx("Section D — Main Contact Person (ผู้ประสานงานหลัก)")}
                        </h3>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={sameAsAccountContact}
                            onChange={(e) =>
                              setSameAsAccountContact(e.target.checked)
                            }
                          />
                          <span>
                            {tx("Same as account contact (ใช้ข้อมูลเดียวกับผู้ติดต่อในขั้นตอนที่ 1:")}{' '}
                            {tx(firstName)} {tx(lastName)})
                          </span>
                        </label>

                        {!sameAsAccountContact && (
                          <div
                            className="form-grid-2"
                            style={{ marginTop: '0.5rem' }}
                          >
                            <div className="form-row">
                              <label htmlFor="og-mc-n"><RequiredFieldText text="Contact Person Name *" /></label>
                              <input
                                id="og-mc-n"
                                type="text"
                                value={mainContactName}
                                onChange={(e) =>
                                  setMainContactName(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="og-mc-pos">{<RequiredFieldText text={tx("Position (ตำแหน่ง) *")} />}</label>
                              <input
                                id="og-mc-pos"
                                type="text"
                                value={mainContactPos}
                                onChange={(e) =>
                                  setMainContactPos(e.target.value)
                                }
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="og-mc-p"><RequiredFieldText text="Contact Phone *" /></label>
                              <PhoneInput
                                id="og-mc-p"
                                value={mainContactPhone}
                                onChange={(next) =>
                                  setMainContactPhone(next)}
                              />
                            </div>
                            <div className="form-row">
                              <label htmlFor="og-mc-em"><RequiredFieldText text="Contact Email *" /></label>
                              <input
                                id="og-mc-em"
                                type="email"
                                value={mainContactEmail}
                                onChange={(e) =>
                                  setMainContactEmail(e.target.value)
                                }
                              />
                            </div>
                          </div>
                        )}

                        <div className="cta-inline-row" style={{ marginTop: '0.9rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setOrgStep(1)}
                          >
                            {tx("ย้อนกลับ Step 1")}
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={() => {
                              if (!orgNameTh.trim() || !officeAddress.trim()) {
                                setStatusAlert({
                                  tone: 'err',
                                  text: tx("กรุณาระบุชื่อองค์กร (ภาษาไทย) และที่อยู่สำนักงานให้ครบถ้วน"),
                                });
                                return;
                              }
                              if (
                                (orgType === 'Private Company' ||
                                  orgType === 'Non-Profit Organization') &&
                                !businessRegNo.trim()
                              ) {
                                setStatusAlert({
                                  tone: 'err',
                                  text: txf("ประเภทองค์กร \"{0}\" ต้องระบุเลขทะเบียนนิติบุคคล (Business Registration Number)", orgType),
                                });
                                return;
                              }
                              setStatusAlert(null);
                              setOrgStep(3);
                            }}
                          >
                            <span>{tx("ถัดไป: Step 3 ยืนยันตัวตนและอัปโหลดเอกสาร")}</span>
                            <IconArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: IDENTITY & ORGANIZATION VERIFICATION */}
                    {orgStep === 3 && (
                      <div className="custom-field-creator">
                        <h2>
                          {tx("Step 3 — Identity & Organization Verification (อัปโหลดเอกสารยืนยันตัวตนใน Private Storage)")}
                        </h2>
                        <p className="muted-block">
                          {tx("รองรับไฟล์ PDF, JPG, JPEG, PNG ขนาดไม่เกิน 10 MB ต่อไฟล์ เอกสารทั้งหมดถูกจัดเก็บใน Private Storage และไม่เปิดเผยผ่าน Public URL")}
                        </p>

                        <div className="form-grid-2" style={{ marginTop: '0.6rem' }}>
                          <div className="form-row">
                            <label htmlFor="og-iddoc">
                              {tx("Section B — ประเภทเอกสารยืนยันตัวตนบุคคล")}
                            </label>
                            <select
                              id="og-iddoc"
                              value={idDocType}
                              onChange={(e) => setIdDocType(e.target.value)}
                            >
                              <option value="บัตรประจำตัวประชาชน">
                                {tx("บัตรประจำตัวประชาชน (Thai National ID)")}
                              </option>
                              <option value="หนังสือเดินทาง (Passport)">
                                {tx("หนังสือเดินทาง (Passport)")}
                              </option>
                            </select>
                          </div>
                          <div className="form-row">
                            <label htmlFor="og-idexp">
                              {tx("วันหมดอายุเอกสาร (Document Expiry Date)")}
                            </label>
                            <input
                              id="og-idexp"
                              type="date"
                              value={idDocExpiry}
                              onChange={(e) => setIdDocExpiry(e.target.value)}
                            />
                          </div>
                        </div>

                        <label
                          className="checkbox-row"
                          style={{ marginTop: '0.65rem' }}
                        >
                          <input
                            type="checkbox"
                            checked={isAuthorizedRep}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsAuthorizedRep(checked);
                              if (
                                checked &&
                                !uploadedDocs.some(
                                  (d) => d.category === 'authorization'
                                )
                              ) {
                                setUploadedDocs((prev) => [
                                  ...prev,
                                  {
                                    id: `doc-auth-${Date.now()}`,
                                    category: 'authorization',
                                    docTypeLabel:
                                      'หนังสือมอบอำนาจแต่งตั้งตัวแทนผู้จัดงาน (Power of Attorney)',
                                    fileName: 'power_of_attorney_signed.pdf',
                                    fileSizeKb: 620,
                                    mimeType: 'application/pdf',
                                    privateStorageKey:
                                      'priv://kyc-vault/2026/poa-signed.pdf',
                                  },
                                ]);
                              }
                            }}
                          />
                          <span>
                            {tx("Section D (ตามเงื่อนไข) — ผู้ยื่นคำขอเป็นผู้รับมอบอำนาจ (ต้องแนบหนังสือมอบอำนาจ Power of Attorney)")}
                          </span>
                        </label>

                        {/* Document Upload List */}
                        <div
                          className="custom-fields-list"
                          style={{ marginTop: '0.75rem' }}
                        >
                          {uploadedDocs.map((doc) => (
                            <div key={doc.id} className="custom-field-item">
                              <div className="custom-field-meta">
                                <IconLock size={14} />
                                <strong>{tx(doc.docTypeLabel)}</strong>
                                <span className="mono-code">{tx(doc.fileName)}</span>
                                <span className="muted-inline mono-num">
                                  ({tx(doc.fileSizeKb)} KB · {tx(doc.mimeType)})
                                </span>
                                <span className="status-pill badge-forest">
                                  <span>{tx("อัปโหลดเข้า Private Vault 100%")}</span>
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn-ghost-sm"
                                onClick={() =>
                                  setUploadedDocs((prev) =>
                                    prev.filter((x) => x.id !== doc.id)
                                  )
                                }
                              >
                                {tx("ลบ / เปลี่ยนไฟล์")}
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="cta-inline-row" style={{ marginTop: '0.6rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() =>
                              setUploadedDocs((prev) => [
                                ...prev,
                                {
                                  id: `doc-extra-${Date.now()}`,
                                  category: 'organization',
                                  docTypeLabel:
                                    'เอกสารรับรององค์กร / หนังสืออนุญาตจัดงานเพิ่มเติม',
                                  fileName: `org_supporting_doc_${prev.length + 1
                                    }.pdf`,
                                  fileSizeKb: 950,
                                  mimeType: 'application/pdf',
                                  privateStorageKey: `priv://kyc-vault/2026/doc-${Date.now()}.pdf`,
                                },
                              ])
                            }
                          >
                            {tx("+ แนบไฟล์เอกสารยืนยันเพิ่มเติม (PDF / JPG / PNG)")}
                          </button>
                        </div>

                        {/* Section E: Consent */}
                        <div
                          className="consent-group"
                          style={{ marginTop: '0.9rem' }}
                        >
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={consentAccurate}
                              onChange={(e) =>
                                setConsentAccurate(e.target.checked)
                              }
                            />
                            <span>
                              <strong>{tx("[จำเป็น]")}</strong> {tx(" ยืนยันว่าข้อมูลองค์กรและเอกสารที่ยื่นทั้งหมดถูกต้องเป็นความจริง")}
                            </span>
                          </label>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={consentVerification}
                              onChange={(e) =>
                                setConsentVerification(e.target.checked)
                              }
                            />
                            <span>
                              <strong>{tx("[จำเป็น]")}</strong> {tx(" ยินยอมให้แพลตฟอร์มตรวจสอบสถานะองค์กรและประวัติผู้จัดงานตามขั้นตอน KYC")}
                            </span>
                          </label>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={consentPrivacy}
                              onChange={(e) => setConsentPrivacy(e.target.checked)}
                            />
                            <span>
                              <strong>{tx("[จำเป็น]")}</strong> {tx(" รับทราบประกาศความเป็นส่วนตัวสำหรับผู้จัดงาน (Privacy Notice v2.1)")}
                            </span>
                          </label>
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={marketingOptIn}
                              onChange={(e) => setMarketingOptIn(e.target.checked)}
                            />
                            <span>
                              {tx("[ไม่บังคับ — แยกจากความยินยอมหลัก] รับข่าวสารและสิทธิประโยชน์สำหรับผู้จัดงานจาก กระต่าย")}
                            </span>
                          </label>
                        </div>

                        <div className="cta-inline-row" style={{ marginTop: '0.9rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setOrgStep(2)}
                          >
                            {tx("ย้อนกลับ Step 2")}
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleFinalSubmitOrganizerWizard}
                          >
                            <IconCheckCircle size={15} />
                            <span>{tx("ส่งคำขอขึ้นทะเบียนผู้จัดงาน (สถานะ SUBMITTED)")}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* 3B. ORGANIZER REGISTRATION COMPLETION SCREEN */}
              {signupFlowMode === 'organizer_completed' && completedOrgResult && (
                <div className="receipt-success-panel">
                  <div className="receipt-head">
                    <IconCheckCircle size={24} />
                    <div>
                      <h2>
                        {tx("ส่งคำขอขึ้นทะเบียนองค์กรผู้จัดงานสำเร็จ!")}
                      </h2>
                      <p className="muted-inline">
                        {tx("ระบบบันทึกคำขอของคุณในสถานะ SUBMITTED (PENDING_REVIEW) เรียบร้อยแล้ว โดยจะไม่อนุมัติอัตโนมัติจนกว่า Platform Owner จะตรวจสอบเอกสารครบถ้วน")}
                      </p>
                    </div>
                  </div>

                  <div className="receipt-grid">
                    <div>
                      <span className="muted-inline">{tx("ชื่อองค์กรผู้จัด")}</span>
                      <strong>{tx(completedOrgResult.organization.nameTh)}</strong>
                    </div>
                    <div>
                      <span className="muted-inline">
                        {tx("หมายเลขอ้างอิงคำขอ (Reference Number)")}
                      </span>
                      <strong className="mono-code">
                        {completedOrgResult.organization.referenceNumber ??
                          'ORG-REF-2026-8841'}
                      </strong>
                    </div>
                    <div>
                      <span className="muted-inline">{tx("วันที่ส่งคำขอ")}</span>
                      <strong className="mono-num">
                        {completedOrgResult.organization.submittedAt ??
                          '2026-11-18 09:30'}
                      </strong>
                    </div>
                    <div>
                      <span className="muted-inline">{tx("สถานะการตรวจสอบเริ่มต้น")}</span>
                      <span className="status-pill badge-amber">
                        <span>SUBMITTED / PENDING_REVIEW</span>
                      </span>
                    </div>
                  </div>

                  <div className="status-explanation-banner">
                    <IconShield size={16} />
                    <span>
                      <strong>{tx("ขั้นตอนถัดไป (Next Steps):")}</strong> {tx(" ทีม Platform Owner จะตรวจสอบเอกสารนิติบุคคลและบัญชีรับเงินภายใน 1–2 วันทำการ (ผ่านสถานะ SUBMITTED &rarr; UNDER_REVIEW &rarr; APPROVED) ระหว่างนี้คุณสามารถเข้าสู่ Organizer Dashboard เพื่อเตรียมงานวิ่งแบบร่างไว้ล่วงหน้าได้ทันที")}
                    </span>
                  </div>

                  <div className="cta-inline-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => {
                        onAuthenticated(
                          completedOrgResult.user,
                          completedOrgResult.organization.id
                        );
                        onNavigateOrganizerWorkspace?.(
                          completedOrgResult.organization.id
                        );
                      }}
                    >
                      <IconBuilding size={15} />
                      <span>{tx("เข้าสู่ Organizer Dashboard ขององค์กรนี้")}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {authTab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="auth-cred-form">
              <p className="muted-block">
                {tx("กรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่แบบใช้ครั้งเดียว (ระบบตอบข้อความเดียวกันเสมอเพื่อไม่เปิดเผยว่าอีเมลใดมีอยู่ในระบบ)")}
              </p>
              <div className="form-row">
                <label htmlFor="forgot-email">{tx("อีเมลที่ลงทะเบียน")}</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary btn-full">
                <IconMail size={16} />
                <span>{tx("ส่งลิงก์รีเซ็ตรหัสผ่าน")}</span>
              </button>

              {resetRequestedEmail && !resetDoneBanner && (
                <div className="status-explanation-banner" role="status">
                  <div>
                    <strong>
                      {tx("หากอีเมล ")} {tx(resetRequestedEmail)} {tx(" มีอยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตที่มีอายุ 15 นาทีไปให้แล้ว")}
                    </strong>
                    <div style={{ marginTop: '0.45rem' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setResetDoneBanner(true)}
                      >
                        {tx("เปิดลิงก์ยืนยันตั้งรหัสผ่านใหม่จากอีเมล")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {resetDoneBanner && (
                <div className="success-callout" role="status">
                  <IconCheckCircle size={17} />
                  <span>
                    {tx("ตั้งรหัสผ่านใหม่สำเร็จ และเพิกถอนลิงก์รีเซ็ตเดิมเรียบร้อยแล้ว สามารถกลับไปแท็บเข้าสู่ระบบได้ทันที")}
                  </span>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
};

/* ================= ACCOUNT & SECURITY + RUNNER PROFILE VIEW ================= */

interface AccountSecurityViewProps {
  user: UserAccount;
  organizations: Organization[];
  invitations: TeamInvitation[];
  onVerifyContactEmail: (email: string) => void;
  onSetOrChangePassword: () => void;
  onLinkProvider: (provider: 'google' | 'line' | 'facebook') => void;
  onUnlinkProvider: (
    provider: AuthProviderType
  ) => { ok: boolean; error?: string };
  onRevokeOtherSessions: () => void;
  onAcceptTeamInvitation: (
    inviteCode: string
  ) => { ok: boolean; message: string };
  onApplyNewOrganizerOrg: (
    orgNameTh: string,
    province: string
  ) => Organization;
  onEnterOrganizerOrg: (orgId: string) => void;
  onUpdateRunnerProfile?: (profile: RunnerProfileData) => void;
  onNavigateDiscoverEvents?: () => void;
  onNavigateMyOrders?: () => void;
}

export const AccountSecurityView: React.FC<AccountSecurityViewProps> = ({
  user,
  organizations,
  invitations,
  onVerifyContactEmail,
  onSetOrChangePassword,
  onLinkProvider,
  onUnlinkProvider,
  onRevokeOtherSessions,
  onAcceptTeamInvitation,
  onApplyNewOrganizerOrg,
  onEnterOrganizerOrg,
  onUpdateRunnerProfile,
  onNavigateDiscoverEvents,
  onNavigateMyOrders,
}) => {
  const [emailDraft, setEmailDraft] = useState(user.contactEmail ?? '');
  const [inviteInput, setInviteInput] = useState('INV-LANNA-STAFF26');
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgProv, setNewOrgProv] = useState('ขอนแก่น');
  const [feedback, setFeedback] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Runner profile editor state
  const [profPhone, setProfPhone] = useState(user.runnerProfile?.phone ?? '081-442-9910');
  const [profDob, setProfDob] = useState(user.runnerProfile?.dateOfBirth ?? '1994-05-14');
  const [profGender, setProfGender] = useState<'ชาย' | 'หญิง' | 'ไม่ระบุ'>(
    user.runnerProfile?.gender ?? 'หญิง'
  );
  const [profExp, setProfExp] = useState<
    'Beginner' | 'Intermediate' | 'Advanced'
  >(user.runnerProfile?.runningExperience ?? 'Intermediate');
  const [profEmergName, setProfEmergName] = useState(
    user.runnerProfile?.emergencyContactName ?? 'วีระ วัฒนากูล'
  );
  const [profEmergPhone, setProfEmergPhone] = useState(
    user.runnerProfile?.emergencyContactPhone ?? '089-110-2211'
  );

  const hasGoogle = user.identities.some((i) => i.provider === 'google');
  const hasFacebook = user.identities.some((i) => i.provider === 'facebook');
  const hasLine = user.identities.some((i) => i.provider === 'line');
  const otherSessionsCount = user.sessions.filter(
    (s) => !s.isCurrentDevice
  ).length;
  const profileCompletion = computeRunnerProfileCompletion(user);

  return (
    <main className="customer-container">
      <div className="hub-header-bar">
        <div>
          <h1>
            {tx("Runner Dashboard & ความปลอดภัยบัญชี (")}{tx(user.fullNameTh)})
          </h1>
          <p className="muted-block">
            {tx("จัดการโปรไฟล์นักวิ่ง (Runner Profile), ผู้ติดต่อฉุกเฉิน, ช่องทางเข้าสู่ระบบที่เชื่อมไว้ (Google / LINE), อุปกรณ์ที่ใช้งาน และการสลับบทบาทเข้าสู่ทีมผู้จัดงานด้วยบัญชีเดียว")}
          </p>
        </div>
        <div className="cta-inline-row">
          {onNavigateDiscoverEvents && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onNavigateDiscoverEvents}
            >
              <IconFlag size={15} />
              <span>{tx("Discover Events (ค้นหางานวิ่ง)")}</span>
            </button>
          )}
          {onNavigateMyOrders && (
            <button
              type="button"
              className="btn-primary"
              onClick={onNavigateMyOrders}
            >
              <span>My Registrations & Payment History</span>
              <IconArrowRight size={15} />
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={
            feedback.tone === 'ok' ? 'success-callout' : 'error-callout'
          }
          role="status"
        >
          {feedback.tone === 'ok' ? (
            <IconCheckCircle size={17} />
          ) : (
            <IconAlert size={17} />
          )}
          <span>{tx(feedback.text)}</span>
        </div>
      )}

      {/* Runner Profile & Completion Strip */}
      <section className="clean-panel" style={{ marginBottom: '1rem' }}>
        <div className="section-title-bar">
          <div>
            <h2>
              {tx("Runner Profile & Emergency Contact (ความสมบูรณ์โปรไฟล์:")}{' '}
              <span className="mono-num text-forest">
                {tx(profileCompletion.pct)}%
              </span>
              )
            </h2>
            <p className="muted-inline">
              {tx("ข้อมูลโปรไฟล์ทั่วไปของนักวิ่ง (ไซส์เสื้อและระยะแข่งขันจะเลือกแยกตามแต่ละงานวิ่งตอนกดสมัคร)")}
            </p>
          </div>
        </div>

        <div className="hbar-track" style={{ marginBottom: '0.85rem' }}>
          <div
            className="hbar-fill fill-forest"
            style={{ width: `${Math.max(12, profileCompletion.pct)}%` }}
          />
        </div>

        <div className="form-grid-3">
          <div className="form-row">
            <label htmlFor="rp-ph">{tx("เบอร์โทรศัพท์นักวิ่ง")}</label>
            <PhoneInput
              id="rp-ph"
              value={profPhone}
              onChange={(next) => setProfPhone(next)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="rp-dob">
              {tx("วันเกิด (Date of Birth)")}
            </label>
            <DateOfBirthInput
              id="rp-dob"
              valueIso={profDob}
              onChangeIso={setProfDob}
            />
          </div>
          <div className="form-row">
            <label htmlFor="rp-exp">{tx("ประสบการณ์การวิ่ง (Running Experience)")}</label>
            <select
              id="rp-exp"
              value={profExp}
              onChange={(e) =>
                setProfExp(
                  e.target.value as 'Beginner' | 'Intermediate' | 'Advanced'
                )
              }
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div className="form-grid-3" style={{ marginTop: '0.6rem' }}>
          <div className="form-row">
            <label htmlFor="rp-gen">{tx("เพศ (Gender)")}</label>
            <select
              id="rp-gen"
              value={profGender}
              onChange={(e) =>
                setProfGender(e.target.value as 'ชาย' | 'หญิง' | 'ไม่ระบุ')
              }
            >
              <option value="หญิง">{tx("หญิง")}</option>
              <option value="ชาย">{tx("ชาย")}</option>
              <option value="ไม่ระบุ">{tx("ไม่ระบุ")}</option>
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="rp-emn">{tx("ชื่อผู้ติดต่อฉุกเฉินเริ่มต้น")}</label>
            <input
              id="rp-emn"
              type="text"
              value={profEmergName}
              onChange={(e) => setProfEmergName(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label htmlFor="rp-emp">{tx("เบอร์โทรผู้ติดต่อฉุกเฉิน")}</label>
            <PhoneInput
              id="rp-emp"
              value={profEmergPhone}
              onChange={(next) => setProfEmergPhone(next)}
            />
          </div>
        </div>

        <div className="cta-inline-row" style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onUpdateRunnerProfile?.({
                phone: profPhone,
                dateOfBirth: profDob,
                gender: profGender,
                nationality: 'Thailand',
                runningExperience: profExp,
                emergencyContactName: profEmergName,
                emergencyContactPhone: profEmergPhone,
                preferredDistances: ['10 km', 'Half Marathon (21.1 km)'],
              });
              setFeedback({
                tone: 'ok',
                text: tx("บันทึกข้อมูล Runner Profile และผู้ติดต่อฉุกเฉินเรียบร้อยแล้ว (ความสมบูรณ์โปรไฟล์ 100%)"),
              });
            }}
          >
            {tx("บันทึกโปรไฟล์นักวิ่ง")}
          </button>
        </div>
      </section>

      <div className="security-grid">
        {/* Contact Email & Password */}
        <section className="clean-panel">
          <h2>{tx("อีเมลติดต่อและรหัสผ่าน")}</h2>
          <p className="muted-inline">
            {tx("สถานะปัจจุบัน:")}{' '}
            {user.contactEmail ? (
              user.emailVerified ? (
                <strong className="text-forest">
                  {tx("ยืนยันอีเมลแล้ว (")}{tx(user.contactEmail)})
                </strong>
              ) : (
                <strong className="text-amber">
                  {tx("รอยืนยันลิงก์ในอีเมล (")}{tx(user.contactEmail)})
                </strong>
              )
            ) : (
              <strong className="text-amber">
                {tx("ยังไม่มีอีเมลติดต่อ (เข้าผ่าน LINE — กรุณาเพิ่มอีเมลเพื่อรับใบเสร็จ)")}
              </strong>
            )}
          </p>

          <div className="form-row" style={{ marginTop: '0.75rem' }}>
            <label htmlFor="sec-email">{tx("อีเมลติดต่อสำหรับรับใบยืนยันและใบเสร็จ")}</label>
            <div className="cta-inline-row">
              <input
                id="sec-email"
                type="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder={tx("ระบุอีเมลของคุณ...")}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  if (!emailDraft.trim()) return;
                  onVerifyContactEmail(emailDraft.trim());
                  setFeedback({
                    tone: 'ok',
                    text: txf("บันทึกและยืนยันอีเมล {0} สำเร็จ", emailDraft.trim()),
                  });
                }}
              >
                {tx("บันทึกและยืนยันอีเมล")}
              </button>
            </div>
          </div>

          <div className="security-subblock">
            <div>
              <strong>{tx("รหัสผ่านของบัญชี")}</strong>
              <div className="muted-inline">
                {user.hasPassword
                  ? tx("ตั้งรหัสผ่านไว้แล้ว สามารถเปลี่ยนรหัสผ่านใหม่ได้")
                  : tx("ยังไม่ได้ตั้งรหัสผ่าน (สมัครผ่าน Social Login)")}
              </div>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                onSetOrChangePassword();
                setFeedback({
                  tone: 'ok',
                  text: user.hasPassword
                    ? tx("เปลี่ยนรหัสผ่านและส่งแจ้งเตือนความปลอดภัยเรียบร้อยแล้ว")
                    : tx("เพิ่มรหัสผ่านให้บัญชีสำเร็จ ตอนนี้เข้าสู่ระบบด้วยอีเมล+รหัสผ่านได้แล้ว"),
                });
              }}
            >
              {user.hasPassword ? tx("เปลี่ยนรหัสผ่าน") : tx("ตั้งรหัสผ่านเพิ่มเติม")}
            </button>
          </div>
        </section>

        {/* Linked Login Methods */}
        <section className="clean-panel">
          <h2>{tx("วิธีเข้าสู่ระบบที่เชื่อมอยู่กับบัญชีนี้")}</h2>
          <p className="muted-block">
            {tx("ระบบไม่อนุญาตให้ถอดช่องทางสุดท้ายที่ใช้เข้าสู่ระบบได้ เพื่อป้องกันบัญชีถูกล็อกถาวร")}
          </p>

          <div className="linked-provider-list">
            <div className="linked-provider-row">
              <div className="persona-identity">
                <IconGoogleMark size={18} />
                <div>
                  <strong>Google Account</strong>
                  <div className="muted-inline">
                    {hasGoogle ? tx("เชื่อมต่อกับบัญชีนี้แล้ว") : tx("ยังไม่ได้เชื่อมต่อ")}
                  </div>
                </div>
              </div>
              {hasGoogle ? (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    const res = onUnlinkProvider('google');
                    setFeedback({
                      tone: res.ok ? 'ok' : 'err',
                      text: res.ok
                        ? tx("ถอดการเชื่อมบัญชี Google เรียบร้อยแล้ว")
                        : res.error ?? tx("ไม่สามารถถอดช่องทางสุดท้ายได้"),
                    });
                  }}
                >
                  {tx("ถอดการเชื่อม")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onLinkProvider('google');
                    setFeedback({
                      tone: 'ok',
                      text: tx("เชื่อมบัญชี Google เข้ากับบัญชี กระต่าย เดิมสำเร็จ"),
                    });
                  }}
                >
                  {tx("เชื่อม Google เพิ่ม")}
                </button>
              )}
            </div>

            <div className="linked-provider-row">
              <div className="persona-identity">
                <IconFacebookMark size={18} />
                <div>
                  <strong>Facebook Account</strong>
                  <div className="muted-inline">
                    {hasFacebook ? tx("เชื่อมต่อกับบัญชีนี้แล้ว") : tx("ยังไม่ได้เชื่อมต่อ")}
                  </div>
                </div>
              </div>
              {hasFacebook ? (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    const res = onUnlinkProvider('facebook');
                    setFeedback({
                      tone: res.ok ? 'ok' : 'err',
                      text: res.ok
                        ? tx("ถอดการเชื่อมบัญชี Facebook เรียบร้อยแล้ว")
                        : res.error ?? tx("ไม่สามารถถอดช่องทางสุดท้ายได้"),
                    });
                  }}
                >
                  {tx("ถอดการเชื่อม")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onLinkProvider('facebook');
                    setFeedback({
                      tone: 'ok',
                      text: tx("เชื่อมบัญชี Facebook เข้ากับบัญชี กระต่าย เดิมสำเร็จ"),
                    });
                  }}
                >
                  {tx("เชื่อม Facebook เพิ่ม")}
                </button>
              )}
            </div>

            <div className="linked-provider-row">
              <div className="persona-identity">
                <IconLineMark size={18} />
                <div>
                  <strong>LINE Login</strong>
                  <div className="muted-inline">
                    {hasLine ? tx("เชื่อมต่อกับบัญชีนี้แล้ว") : tx("ยังไม่ได้เชื่อมต่อ")}
                  </div>
                </div>
              </div>
              {hasLine ? (
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    const res = onUnlinkProvider('line');
                    setFeedback({
                      tone: res.ok ? 'ok' : 'err',
                      text: res.ok
                        ? tx("ถอดการเชื่อมบัญชี LINE เรียบร้อยแล้ว")
                        : res.error ?? tx("ไม่สามารถถอดช่องทางสุดท้ายได้"),
                    });
                  }}
                >
                  {tx("ถอดการเชื่อม")}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onLinkProvider('line');
                    setFeedback({
                      tone: 'ok',
                      text: tx("เชื่อมบัญชี LINE เข้ากับบัญชี กระต่าย เดิมสำเร็จ"),
                    });
                  }}
                >
                  {tx("เชื่อม LINE เพิ่ม")}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Active Device Sessions */}
        <section className="clean-panel">
          <div className="section-title-bar">
            <h2>{tx("อุปกรณ์ที่เข้าสู่ระบบอยู่ (")}{tx(user.sessions.length)})</h2>
            {otherSessionsCount > 0 && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onRevokeOtherSessions();
                  setFeedback({
                    tone: 'ok',
                    text: tx("ออกจากระบบอุปกรณ์อื่นทั้งหมดเรียบร้อยแล้ว"),
                  });
                }}
              >
                {tx("ออกจากระบบอุปกรณ์อื่น (")}{tx(otherSessionsCount)})
              </button>
            )}
          </div>

          <div className="linked-provider-list">
            {user.sessions.map((ses) => (
              <div key={ses.id} className="linked-provider-row">
                <div className="persona-identity">
                  <IconDevice size={18} />
                  <div>
                    <strong>{tx(ses.deviceLabel)}</strong>
                    <div className="muted-inline">
                      {tx(ses.locationHint)} {tx(" · ใช้งานล่าสุด:")} {tx(ses.lastActiveAt)}
                    </div>
                  </div>
                </div>
                {ses.isCurrentDevice && (
                  <span className="status-pill badge-forest">
                    <IconCheckCircle size={13} />
                    <span>{tx("เครื่องนี้")}</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Organizer Memberships, Single-Use Team Invites & New Organizer Onboarding */}
        <section className="clean-panel">
          <h2>{tx("สิทธิ์ทีมผู้จัดงานและคำเชิญเข้าร่วมองค์กร")}</h2>
          <p className="muted-block">
            {tx("บัญชีนักวิ่งเดิมสามารถรับคำเชิญเข้าทีมงานวิ่ง หรือขอเปิดองค์กรผู้จัดใหม่ได้โดยไม่ต้องสมัครบัญชีแยก")}
          </p>

          {user.memberships.length > 0 && (
            <div
              className="membership-action-list"
              style={{ marginBottom: '0.9rem' }}
            >
              {user.memberships.map((m) => {
                const org = organizations.find(
                  (o) => o.id === m.organizationId
                );
                return (
                  <button
                    key={m.organizationId}
                    type="button"
                    className="btn-org-enter"
                    onClick={() => onEnterOrganizerOrg(m.organizationId)}
                  >
                    <IconBuilding size={15} />
                    <span>
                      {tx("เปิดจัดการ ")} <strong>{tx(org?.nameTh)}</strong> {tx(" (สถานะ:")}{' '}
                      <code>
                        {org?.workflowStatus ??
                          (org?.verificationStatus === 'verified'
                            ? 'APPROVED'
                            : 'SUBMITTED')}
                      </code>{' '}
                      {tx("· สิทธิ์:")}{' '}
                      <strong>
                        {m.role === 'owner'
                          ? tx("เจ้าขององค์กร")
                          : m.role === 'event_manager'
                            ? tx("ผู้จัดการงานวิ่ง")
                            : m.role === 'finance'
                              ? tx("ฝ่ายการเงิน")
                              : tx("เจ้าหน้าที่หน้างาน")}
                      </strong>
                      )
                    </span>
                    <IconArrowRight size={14} />
                  </button>
                );
              })}
            </div>
          )}

          <div className="form-row">
            <label htmlFor="inv-code-input">
              {tx("ตอบรับคำเชิญเข้าทีมผู้จัด (รหัสใช้ครั้งเดียว เช่น")}{' '}
              <code>
                {invitations.find((i) => !i.usedByUserId)?.inviteCode ??
                  'INV-LANNA-STAFF26'}
              </code>
              )
            </label>
            <div className="cta-inline-row">
              <input
                id="inv-code-input"
                type="text"
                className="mono-code"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value.toUpperCase())}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const res = onAcceptTeamInvitation(inviteInput.trim());
                  setFeedback({
                    tone: res.ok ? 'ok' : 'err',
                    text: res.message,
                  });
                }}
              >
                {tx("ยืนยันรับคำเชิญ")}
              </button>
            </div>
          </div>

          <form
            className="security-subblock"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newOrgName.trim()) return;
              const createdOrg = onApplyNewOrganizerOrg(
                newOrgName.trim(),
                newOrgProv.trim()
              );
              setNewOrgName('');
              setFeedback({
                tone: 'ok',
                text: txf("สร้างองค์กรผู้จัดใหม่ \"{0}\" (รหัสอ้างอิง {1}) ในสถานะ SUBMITTED รอตรวจสอบผู้จัดแล้ว", createdOrg.nameTh, createdOrg.referenceNumber ?? createdOrg.code),
              });
            }}
          >
            <div style={{ flex: 1 }}>
              <strong>{tx("สมัครเปิดองค์กรผู้จัดงานวิ่งใหม่")}</strong>
              <div className="form-grid-2" style={{ marginTop: '0.45rem' }}>
                <input
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder={tx("ชื่อองค์กร/ชมรมผู้จัดงาน...")}
                  aria-label={tx("ชื่อองค์กรผู้จัดใหม่")}
                  required
                />
                <input
                  type="text"
                  value={newOrgProv}
                  onChange={(e) => setNewOrgProv(e.target.value)}
                  placeholder={tx("จังหวัด...")}
                  aria-label={tx("จังหวัดขององค์กร")}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary">
              {tx("ส่งคำขอเปิดองค์กร")}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
};
