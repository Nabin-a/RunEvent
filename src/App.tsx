import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AdminLogin } from './admin/AdminLogin';
import Swal from 'sweetalert2';
import {
  DEMO_CUSTOM_FIELDS,
  DEMO_ORGANIZATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_EVENTS,
  INITIAL_INVITATIONS,
  INITIAL_MERCH_ORDERS,
  INITIAL_PAYOUTS,
  INITIAL_PRODUCTION_INQUIRIES,
  INITIAL_REGISTRATIONS,
  INITIAL_USERS,
} from './data/mockData';
import {
  INITIAL_CONDITIONAL_RULES,
  INITIAL_FIELD_REQUESTS,
  INITIAL_FORM_TEMPLATES,
  INITIAL_GLOBAL_FIELDS,
  INITIAL_REGISTRATION_STEPS,
} from './data/formBuilderData';
import {
  DEFAULT_PLATFORM_PROFILE_CONFIG,
  deriveProviderSocialHandle,
  enrichSocialLinksFromIdentities,
  evaluatePersonalInfoCompletion,
} from './data/runnerProfileDefaults';
import { ProfileCompletionStatusText } from './components/ProfileCompletionMeter';
import { FEATURES } from './config/features';
import { PrivacyNoticeModal } from './components/PrivacyNoticeModal';
import { PRIVACY_NOTICE_VERSION } from './data/privacyNotice';
import {
  AuditLogEntry,
  AuthProviderType,
  ConditionalRule,
  CustomRegistrationField,
  OrganizerFormStep,
  EventCoreText,
  EventRegisterCardConfig,
  EventProduct,
  EventStatus,
  FeeBearerPolicy,
  FormFieldPolicy,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizationType,
  OrganizerDocumentItem,
  OrganizerFieldRequest,
  OrganizerVerificationWorkflowStatus,
  OrgRole,
  PayoutBatch,
  PayoutStatus,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  ReturnIntent,
  RunnerProfileData,
  SellerServiceModel,
  ShirtSizeCode,
  SimulatedUiState,
  TeamInvitation,
  UserAccount,
} from './types';
import { type AgeConfigValid } from './utils/age';
import { installInvalidFieldHighlight } from './utils/formValidation';
import { MascotLoader } from './components/MascotRunner';
import { isPagePreviewUrl } from './components/pagePreview';
import { isFormPreviewUrl } from './components/formPreview';
import { cloneCustomFieldsSchema } from './utils/eventConfig';
import { AuthScreen } from './components/AuthViews';
import {
  RunnerProfileTab,
  RunnerProfileView,
} from './components/RunnerProfileView';
import { EmailOtpVerifyView } from './components/EmailOtpVerifyView';
import {
  CustomerPortalView,
  CustomerSubView,
} from './components/CustomerPortalView';
import type { SouvenirLayout } from './components/SouvenirPicker';
import { useDismiss } from './utils/useDismiss';
import {
  IconAlert,
  IconArrowRight,
  IconCalendar,
  IconBuilding,
  IconCheckCircle,
  IconChevronDown,
  IconClose,
  IconEye,
  IconFlag,
  IconLedger,
  IconLineMark,
  IconQr,
  IconRunner,
  IconLock,
  IconMenu,
  IconShield,
  IconHistory,
  IconSunMoon,
  IconSliders,
  IconSwitch,
  IconUsers,
} from './components/Icons';
import { useTheme } from './theme';
import {
  OrganizerDashboardView,
  OrgSection,
} from './components/OrganizerDashboardView';
import {
  PlatformAdminView,
  PlatformSection,
} from './components/PlatformAdminView';

import { tx, txf, useI18n } from './i18n';
import { apiRequest } from './api/client';
import { LangSwitch } from './components/LangSwitch';
import { DefaultAvatarImg } from './components/DefaultAvatar';
import { ROLE_LABEL, roleDuties } from './data/orgRoles';

type RootSurface =
  | 'customer'
  | 'organizer'
  | 'platform_admin'
  | 'auth'
  | 'runner_profile'
  | 'account_security'
  | 'verify_email';

const STORAGE_KEY = 'kratai_v2_mock_system';
const SESSION_USER_KEY = 'kratai_v2_session_user_id';

interface PersistedSystemState {
  users: UserAccount[];
  organizations: Organization[];
  invitations: TeamInvitation[];
  events: RaceEvent[];
  registrations: RegistrationRecord[];
  merchOrders: MerchOrderRecord[];
  productionInquiries: ProductionInquiry[];
  payouts: PayoutBatch[];
  auditLogs: AuditLogEntry[];
  formTemplates: FormTemplate[];
  registrationSteps: RegistrationStepDef[];
  globalFields: GlobalFormFieldDef[];
  conditionalRules: ConditionalRule[];
  fieldRequests: OrganizerFieldRequest[];
  platformProfileConfig?: PlatformProfileConfig;
}

function createDefaultState(): PersistedSystemState {
  return {
    users: INITIAL_USERS,
    organizations: DEMO_ORGANIZATIONS,
    invitations: INITIAL_INVITATIONS,
    events: INITIAL_EVENTS,
    registrations: INITIAL_REGISTRATIONS,
    merchOrders: INITIAL_MERCH_ORDERS,
    productionInquiries: INITIAL_PRODUCTION_INQUIRIES,
    payouts: INITIAL_PAYOUTS,
    auditLogs: INITIAL_AUDIT_LOGS,
    formTemplates: INITIAL_FORM_TEMPLATES,
    registrationSteps: INITIAL_REGISTRATION_STEPS,
    globalFields: INITIAL_GLOBAL_FIELDS,
    conditionalRules: INITIAL_CONDITIONAL_RULES,
    fieldRequests: INITIAL_FIELD_REQUESTS,
    platformProfileConfig: DEFAULT_PLATFORM_PROFILE_CONFIG,
  };
}

function normalizeCategoryDistanceCode(code: string, distanceKm: number): string {
  if (/km/i.test(code)) return code;
  const replaced = code.replace(/(\d+(?:\.\d+)?)K\b/i, '$1 km').replace(/\s+Trail$/i, '').trim();
  if (/km/i.test(replaced)) return replaced;
  return `${distanceKm} km`;
}

function loadSystemState(): PersistedSystemState {
  // Initial render seed while /api/bootstrap loads authoritative SQLite state
  return {
    ...createDefaultState(),
    events: INITIAL_EVENTS.map((ev) => ({
      ...ev,
      activeTemplateId: ev.activeTemplateId ?? 'tpl-halfmarathon',
      publishedFormVersion: ev.publishedFormVersion ?? 'v1.2-published',
      customFields:
        ev.customFields === undefined &&
          (ev.id === 'evt-doisuthep-2026' ||
            ev.id === 'evt-promthep-2026' ||
            ev.id === 'evt-oldmoat-2026')
          ? DEMO_CUSTOM_FIELDS
          : ev.customFields,
      categories: ev.categories.map((cat) => ({
        ...cat,
        code: normalizeCategoryDistanceCode(cat.code, cat.distanceKm),
      })),
    })),
  };
}

function loadInitialSessionUserId(): string | null {
  return null;
}

interface ParsedUrlRoute {
  surface: RootSurface;
  customerSubView: CustomerSubView;
  eventSlug: string | null;
  eventTab: 'register' | 'storefront' | 'info_results';
  authTab: 'signin' | 'signup' | 'forgot';
  verifyEmailParam?: string | null;
}

const PDPA_SESSION_KEY = 'kratai_pdpa_ack';
/** The privacy notice version accepted at the navbar sign-in pop-up in this browser session. */
function hasSessionPdpaAck(): boolean {
  try {
    return window.sessionStorage.getItem(PDPA_SESSION_KEY) === PRIVACY_NOTICE_VERSION;
  } catch {
    return false;
  }
}
function rememberPdpaAck(): void {
  try {
    window.sessionStorage.setItem(PDPA_SESSION_KEY, PRIVACY_NOTICE_VERSION);
  } catch {
    // storage blocked: the pop-up simply shows again next time
  }
}

function parseUrlRoute(pathname: string, search: string): ParsedUrlRoute {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);
  const modeParam = params.get('mode');
  const authTab: 'signin' | 'signup' | 'forgot' =
    modeParam === 'signup'
      ? 'signup'
      : modeParam === 'forgot'
        ? 'forgot'
        : 'signin';

  if (cleanPath === '/login') {
    return {
      surface: 'auth',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab,
    };
  }
  if (cleanPath === '/profile') {
    return {
      surface: 'runner_profile',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (
    cleanPath === '/account/security' ||
    // Email verification is shelved: old /verify-email links land on account security.
    (cleanPath === '/verify-email' && !FEATURES.emailVerification)
  ) {
    return {
      surface: 'account_security',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (cleanPath === '/verify-email') {
    return {
      surface: 'verify_email',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
      verifyEmailParam: params.get('email'),
    };
  }
  if (
    cleanPath === '/platform-admin' ||
    cleanPath.startsWith('/platform-admin/')
  ) {
    return {
      surface: 'platform_admin',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (cleanPath === '/organizer' || cleanPath.startsWith('/organizer/')) {
    return {
      surface: 'organizer',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (cleanPath === '/my-orders') {
    return {
      surface: 'customer',
      customerSubView: 'my_orders',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (cleanPath === '/calendar') {
    return {
      surface: 'customer',
      customerSubView: 'calendar',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (cleanPath.startsWith('/events/')) {
    const parts = cleanPath.split('/').filter(Boolean);
    const slug = parts[1] ?? null;
    const sub = parts[2] ?? '';
    // register-b: old address of the one-time layout B review, now the same form
    if ((sub === 'register' || sub === 'register-b') && slug) {
      return {
        surface: 'customer',
        customerSubView: 'event_register',
        eventSlug: slug,
        eventTab: 'register',
        authTab: 'signin',
      };
    }
    const tab: 'register' | 'storefront' | 'info_results' =
      sub === 'shop'
        ? 'storefront'
        : sub === 'results'
          ? 'info_results'
          : 'register';
    return {
      surface: 'customer',
      customerSubView: slug ? 'event_detail' : 'directory',
      eventSlug: slug,
      eventTab: tab,
      authTab: 'signin',
    };
  }

  return {
    surface: 'customer',
    customerSubView: 'directory',
    eventSlug: null,
    eventTab: 'register',
    authTab: 'signin',
  };
}


/** Public site address used by the Platform Owner console (VITE_PUBLIC_SITE_URL, else :5173 on this host). */
function publicSiteOrigin(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return env?.VITE_PUBLIC_SITE_URL || `${window.location.protocol}//${window.location.hostname}:5173`;
}
const DEV_SOUVENIR_LAYOUT_KEY = 'kratai.dev.souvenirLayout';

function findEventBySlug(events: RaceEvent[], slug: string | null): RaceEvent | null {
  if (!slug) return null;
  const lower = slug.toLowerCase();
  return (
    events.find(
      (e) => e.code.toLowerCase() === lower || e.id.toLowerCase() === lower
    ) ?? null
  );
}

export const App: React.FC<{ mode?: 'public' | 'admin' }> = ({ mode = 'public' }) => {
  // 'admin' = the separate Platform Owner console (its own entry, port, sign-in and session)
  const isAdminApp = mode === 'admin';
  // ใช้ context ภาษาเพื่อให้ทั้ง tree re-render เมื่อสลับ TH/EN
  const { lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [sys, setSys] = useState<PersistedSystemState>(loadSystemState);
  // Off until the server says otherwise, so production never flashes the dev tools.
  const [sandboxTools, setSandboxTools] = useState(false);

  // Highlight required / invalid fields in every form (see utils/formValidation.ts)
  useEffect(() => installInvalidFieldHighlight(), []);

  // วัดความสูง header จริงให้ sidebar sticky ของผู้จัด/Platform Owner วางตำแหน่งพอดี
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.global-topbar');
    if (!header) return;
    const apply = () => {
      const isSticky = getComputedStyle(header).position === 'sticky';
      document.documentElement.style.setProperty(
        '--topbar-height',
        isSticky ? `${header.offsetHeight}px` : '0px'
      );
      // always the real header height (used by full-height layouts such as the registration form)
      document.documentElement.style.setProperty('--app-header-height', `${header.offsetHeight}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(header);
    window.addEventListener('resize', apply);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
    };
  }, []);

  const initialParsed = (() => {
    const parsed = parseUrlRoute(window.location.pathname, window.location.search);
    // the console only has the platform section and the organizer workspace it inspects
    if (isAdminApp && parsed.surface !== 'organizer') {
      return { ...parsed, surface: 'platform_admin' as RootSurface };
    }
    return parsed;
  })();
  const initialMatchedEvent = findEventBySlug(
    sys.events,
    initialParsed.eventSlug
  );

  const [surface, setSurface] = useState<RootSurface>(initialParsed.surface);
  const [customerSubView, setCustomerSubView] = useState<CustomerSubView>(
    initialParsed.eventSlug && !initialMatchedEvent
      ? 'directory'
      : initialParsed.customerSubView
  );
  const [selectedPublicEventId, setSelectedPublicEventId] = useState<
    string | null
  >(initialMatchedEvent?.id ?? null);
  const [initialEventTab, setInitialEventTab] = useState<
    'register' | 'storefront' | 'info_results'
  >(initialParsed.eventTab);
  const [authInitialTab, setAuthInitialTab] = useState<
    'signin' | 'signup' | 'forgot'
  >(initialParsed.authTab);
  const [profileInitialTab, setProfileInitialTab] = useState<RunnerProfileTab>(
    initialParsed.surface === 'account_security' ? 'security' : 'personal'
  );
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState<string>(
    initialParsed.verifyEmailParam ?? ''
  );
  const [verifiedEmailNotice, setVerifiedEmailNotice] = useState<string | null>(
    null
  );

  // Default first-time visitor is Guest (null), persisted across refreshes
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    loadInitialSessionUserId
  );
  const [returnIntent, setReturnIntent] = useState<ReturnIntent | null>(null);
  // PDPA (21 Nov 2026, user decision): the notice is acknowledged in one place only, a
  // pop-up after the navbar "เข้าสู่ระบบ" button. The acknowledgement is kept for this
  // browser session and written to the account once the user is signed in.
  const [pdpaGateOpen, setPdpaGateOpen] = useState(false);

  const [activeOrgId, setActiveOrgId] = useState<string>('org-lanna');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeOrgSection, setActiveOrgSection] =
    useState<OrgSection>('org_overview');
  const [activePlatformSection, setActivePlatformSection] =
    useState<PlatformSection>('plat_overview');
  const [simulatedState, setSimulatedState] =
    useState<SimulatedUiState>('normal');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showDemoTools, setShowDemoTools] = useState(false);
  // testers' review comments (sandbox only): drop-a-pin mode, list panel, open count
  // floating menus close on a press outside them or Escape (27 Nov 2026, user request)
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const devDockRef = useRef<HTMLElement | null>(null);
  useDismiss(showProfileMenu, [profileMenuRef], () => setShowProfileMenu(false));
  useDismiss(showDemoTools, [devDockRef], () => setShowDemoTools(false));
  const personalDirtyRef = useRef(false);
  const [personalDiscardSeq, setPersonalDiscardSeq] = useState(0);
  const handlePersonalDirtyChange = useCallback((dirty: boolean) => {
    personalDirtyRef.current = dirty;
  }, []);

  const guardUnsavedProfileNavigation = (proceed: () => void) => {
    if (
      (surface === 'runner_profile' || surface === 'account_security') &&
      personalDirtyRef.current
    ) {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
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
          personalDirtyRef.current = false;
          setPersonalDiscardSeq((s) => s + 1);
          proceed();
        }
      });
      return;
    }
    proceed();
  };
  // Dev / Demo: which souvenir step layout the registration form shows (27 Nov 2026, user
  // request "สร้าง template แบบเดิม แยกในเมนู dev / demo"); kept in this browser only
  const [devSouvenirLayout, setDevSouvenirLayout] = useState<SouvenirLayout>(() => {
    try {
      const v = window.localStorage.getItem(DEV_SOUVENIR_LAYOUT_KEY);
      return v === 'shelves' || v === 'classic' ? v : 'accordion';
    } catch {
      return 'accordion';
    }
  });
  // Dev / Demo: what each demo account is, by role (27 Nov 2026, user request)
  const devRoleOf = (u: UserAccount) => {
    if (u.isPlatformAdmin) {
      return { order: 4, Icon: IconShield, title: 'ผู้ดูแลระบบ', sub: tx('อนุมัติผู้จัด งาน และรอบโอน') };
    }
    if (u.memberships.some((m) => m.role === 'owner')) {
      return {
        order: 2,
        Icon: IconBuilding,
        title: 'ผู้จัด',
        sub: txf('เจ้าขององค์กร · {0} องค์กร', u.memberships.length),
      };
    }
    const team = u.memberships[0];
    if (team) {
      const assigned = team.assignedEventIds?.length ?? 0;
      return {
        order: 3,
        // the icon follows the duty: event setup, money, kit check-in
        Icon: team.role === 'finance' ? IconLedger : team.role === 'staff' ? IconQr : IconCalendar,
        title: `ทีมงานผู้จัด · ${ROLE_LABEL[team.role]}`,
        sub: [
          // the duty the role is known for, so the line matches its icon and stays short
          ...[(() => {
            const all = roleDuties(team.role);
            const key = team.role === 'event_manager' ? all[0] : all[all.length - 1];
            return tx((key ?? '').replace(/\s*\(.*\)$/, ''));
          })()],
          ...(assigned > 0 ? [txf('เฉพาะ {0} งานที่ได้รับมอบหมาย', assigned)] : []),
        ].join(' · '),
      };
    }
    const viaLine = u.identities.some((i) => i.provider === 'line');
    return {
      order: 1,
      // a runner; the one who signed in with LINE shows the LINE mark
      Icon: viaLine ? IconLineMark : IconRunner,
      title: 'นักวิ่ง',
      sub: viaLine ? tx('ลูกค้าทั่วไปผ่าน LINE ซื้อของได้โดยไม่สมัครวิ่ง') : tx('สมาชิก มีโปรไฟล์ เพื่อน และประวัติสมัคร'),
    };
  };

  const pickDevSouvenirLayout = (l: SouvenirLayout) => {
    setDevSouvenirLayout(l);
    try {
      window.localStorage.setItem(DEV_SOUVENIR_LAYOUT_KEY, l);
    } catch {
      /* storage blocked: the choice lasts until reload */
    }
  };

  const pushUrl = (url: string, replace = false) => {
    // the console keeps its own address (it may live under a sub-path such as /admin/ next to the
    // public site's files); public-site URLs pushed here would reload into the public app
    if (isAdminApp) return;
    // the page editor's preview never leaves its event page (it would lose ?preview=page and
    // turn into the whole app inside the editor)
    if (isPagePreviewUrl() || isFormPreviewUrl()) return;
    const currentFull = `${window.location.pathname}${window.location.search}`;
    if (currentFull === url) return;
    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  };

  const applyRouteStateFromUrl = (pathname: string, search: string) => {
    const parsed = parseUrlRoute(pathname, search);
    const matchedEv = findEventBySlug(sys.events, parsed.eventSlug);
    setSurface(parsed.surface);
    setCustomerSubView(
      parsed.eventSlug && !matchedEv ? 'directory' : parsed.customerSubView
    );
    setSelectedPublicEventId(matchedEv?.id ?? null);
    setInitialEventTab(parsed.eventTab);
    setAuthInitialTab(parsed.authTab);
    if (parsed.verifyEmailParam !== undefined) {
      setPendingVerifyEmail(parsed.verifyEmailParam ?? '');
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const targetPath = window.location.pathname;
      const targetSearch = window.location.search;
      if (
        (surface === 'runner_profile' || surface === 'account_security') &&
        personalDirtyRef.current &&
        targetPath !== '/profile'
      ) {
        window.history.pushState({}, '', '/profile');
        guardUnsavedProfileNavigation(() => {
          window.history.replaceState(
            {},
            '',
            `${targetPath}${targetSearch}`
          );
          applyRouteStateFromUrl(targetPath, targetSearch);
          setShowProfileMenu(false);
          setShowMobileMenu(false);
        });
        return;
      }
      applyRouteStateFromUrl(targetPath, targetSearch);
      setShowProfileMenu(false);
      setShowMobileMenu(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys.events, surface]);

  // Prevent background page scrolling when any modal or SweetAlert2 dialog is open
  // without setting overflow: hidden/clip on html/body (preserving position: sticky)
  useEffect(() => {
    const canScrollInsideModal = (
      target: EventTarget | null,
      deltaY?: number
    ): boolean => {
      if (!(target instanceof Element)) return false;
      const scroller = target.closest(
        '.runner-modal-body, .swal2-html-container'
      ) as HTMLElement | null;
      if (!scroller) return false;
      if (scroller.scrollHeight <= scroller.clientHeight) return false;
      if (deltaY !== undefined) {
        if (deltaY < 0 && scroller.scrollTop <= 0) return false;
        if (
          deltaY > 0 &&
          scroller.scrollTop + scroller.clientHeight >=
          scroller.scrollHeight - 1
        ) {
          return false;
        }
      }
      return true;
    };

    const hasOpenModalOverlay = () =>
      Boolean(
        document.querySelector(
          '.swal2-container:not(.swal2-toast-shown), .runner-modal-backdrop'
        )
      );

    const onWheel = (e: WheelEvent) => {
      if (!hasOpenModalOverlay()) return;
      if (canScrollInsideModal(e.target, e.deltaY)) return;
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!hasOpenModalOverlay()) return;
      if (canScrollInsideModal(e.target)) return;
      e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  // Session & business data are backed by Node.js + SQLite API (/api/bootstrap + HttpOnly cookie)
  const [apiBootstrapped, setApiBootstrapped] = useState(false);
  // Only show the loader when the first load is slow, so fast loads do not flash it.
  const [bootIsSlow, setBootIsSlow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setBootIsSlow(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  const syncApi = async (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown
  ) => {
    const res = await apiRequest(method, path, body);
    if (res.ok && res.state) {
      setSys(res.state);
      if (res.currentUserId !== undefined) {
        setCurrentUserId(res.currentUserId);
      }
    }
    return res;
  };

  useEffect(() => {
    // Clean up legacy client-side mockup storage keys so SQLite is the single source of truth
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SESSION_USER_KEY);
    } catch {
      // ignore
    }
    let active = true;
    apiRequest('GET', '/api/bootstrap').then((res) => {
      if (!active) return;
      if (res.ok && res.state) {
        setSys(res.state);
        setCurrentUserId(res.currentUserId ?? null);
        setSandboxTools(Boolean(res.config?.sandboxTools));
        const parsed = parseUrlRoute(window.location.pathname, window.location.search);
        if (parsed.eventSlug) {
          const matched = findEventBySlug(res.state.events, parsed.eventSlug);
          if (matched) {
            setSelectedPublicEventId(matched.id);
            setCustomerSubView(parsed.customerSubView);
          }
        }
      }
      setApiBootstrapped(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const currentUser =
    sys.users.find((u) => u.id === currentUserId) ?? null;

  // Sync activeOrgId when switching to an organizer user whose memberships don't include activeOrgId
  useEffect(() => {
    if (currentUser && currentUser.memberships.length > 0) {
      const hasCurrent = currentUser.memberships.some(
        (m) => m.organizationId === activeOrgId
      );
      if (!hasCurrent) {
        const firstMem = currentUser.memberships[0];
        setActiveOrgId(firstMem.organizationId);
        if (firstMem.role === 'staff') {
          const evId = firstMem.assignedEventIds?.[0] ?? null;
          setActiveEventId(evId);
          setActiveOrgSection(evId ? 'evt_checkin_bib' : 'org_overview');
        } else {
          setActiveEventId(null);
          setActiveOrgSection('org_overview');
        }
      }
    }
  }, [currentUser, activeOrgId]);

  // Production Route Guard: redirect unauthenticated visitors from protected routes to /login with ReturnIntent
  useEffect(() => {
    if (!apiBootstrapped) return;
    // the console has its own sign-in gate; sending it to the public sign-in page here made the
    // two fight over the surface every render (the sign-in page flickered)
    if (isAdminApp) return;
    if (!currentUser) {
      if (surface === 'platform_admin') {
        setReturnIntent({
          surface: 'platform_admin',
          label: 'เข้าใช้งานศูนย์ควบคุม Platform Owner',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      } else if (surface === 'organizer') {
        setReturnIntent({
          surface: 'organizer',
          label: 'เข้าใช้งานระบบผู้จัดงาน (Organizer Dashboard)',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      } else if (surface === 'runner_profile') {
        setReturnIntent({
          surface: 'runner_profile',
          label: 'จัดการโปรไฟล์นักวิ่ง (Runner Profile)',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      } else if (surface === 'account_security') {
        setReturnIntent({
          surface: 'account_security',
          label: 'จัดการบัญชีและความปลอดภัย',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      } else if (surface === 'customer' && customerSubView === 'my_orders') {
        setReturnIntent({
          surface: 'my_orders',
          label: 'ดูประวัติการสมัคร & การสั่งซื้อ',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      } else if (
        surface === 'customer' &&
        customerSubView === 'event_register' &&
        selectedPublicEventId &&
        !isFormPreviewUrl()
      ) {
        // the sign-up form needs an account first (user request 24 Nov 2026); after signing in
        // the runner lands back on this event's form
        const ev = sys.events.find((e) => e.id === selectedPublicEventId);
        setReturnIntent({
          surface: 'events',
          eventId: selectedPublicEventId,
          eventTab: 'register',
          label: ev ? `สมัครวิ่งงาน ${ev.titleTh}` : 'สมัครวิ่ง',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      }
    } else if (surface === 'auth') {
      // Signed-in visitors never see the sign-in / sign-up / forgot-password forms
      // (/login, /login?mode=signup|forgot). Every successful auth path already
      // navigates away inside handleAuthenticated, so this only catches direct
      // visits, stale links, and Back-button returns. Replace history so Back
      // cannot land on the form again.
      setReturnIntent(null);
      setCustomerSubView('directory');
      setSurface('customer');
      pushUrl('/', true);
    }
  }, [apiBootstrapped, currentUser, surface, customerSubView, selectedPublicEventId]);

  const navigateCustomer = (
    view: CustomerSubView,
    evId?: string | null,
    tab?: 'register' | 'storefront' | 'info_results'
  ) => {
    guardUnsavedProfileNavigation(() => {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      if (view === 'my_orders' && !currentUser) {
        setReturnIntent({
          surface: 'my_orders',
          label: 'ดูประวัติการสมัคร & การสั่งซื้อ',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login');
        return;
      }

      setSurface('customer');
      setCustomerSubView(view);
      const resolvedId = evId !== undefined ? evId : selectedPublicEventId;
      if (evId !== undefined) setSelectedPublicEventId(evId);
      const resolvedTab = tab ?? 'register';
      if (tab) setInitialEventTab(tab);

      if (view === 'directory') {
        pushUrl('/');
      } else if (view === 'calendar') {
        pushUrl('/calendar');
      } else if (view === 'my_orders') {
        pushUrl('/my-orders');
      } else if (view === 'event_register' && resolvedId) {
        const ev = sys.events.find((e) => e.id === resolvedId);
        const codeSlug = (ev?.code ?? resolvedId).toLowerCase();
        pushUrl(`/events/${codeSlug}/register`);
      } else if (view === 'event_detail' && resolvedId) {
        const ev = sys.events.find((e) => e.id === resolvedId);
        const codeSlug = (ev?.code ?? resolvedId).toLowerCase();
        const suffix =
          resolvedTab === 'storefront'
            ? '/shop'
            : resolvedTab === 'info_results'
              ? '/results'
              : '';
        pushUrl(`/events/${codeSlug}${suffix}`);
      }
    });
  };

  const navigateLogin = (mode: 'signin' | 'signup' | 'forgot' = 'signin') => {
    guardUnsavedProfileNavigation(() => {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      setAuthInitialTab(mode);
      setSurface('auth');
      pushUrl(mode === 'signin' ? '/login' : `/login?mode=${mode}`);
    });
  };

  const navigateRunnerProfile = (tab: RunnerProfileTab = 'personal') => {
    const run = () => {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      setProfileInitialTab(tab);
      if (!currentUser) {
        setReturnIntent({
          surface: 'runner_profile',
          label: 'จัดการโปรไฟล์นักวิ่ง (Runner Profile)',
        });
        navigateLogin('signin');
        return;
      }
      setSurface('runner_profile');
      pushUrl('/profile');
    };
    if (tab !== 'personal') {
      guardUnsavedProfileNavigation(run);
    } else {
      run();
    }
  };

  const navigateAccountSecurity = () => {
    guardUnsavedProfileNavigation(() => {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      setProfileInitialTab('security');
      if (!currentUser) {
        setReturnIntent({
          surface: 'account_security',
          label: 'จัดการบัญชีและความปลอดภัย / ขอเปิดองค์กรผู้จัดงาน',
        });
        navigateLogin('signin');
        return;
      }
      setSurface('account_security');
      pushUrl('/account/security');
    });
  };

  const navigateOrganizer = (orgId?: string, evId?: string | null) => {
    guardUnsavedProfileNavigation(() => {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      if (orgId) {
        setActiveOrgId(orgId);
        setActiveEventId(evId ?? null);
        setActiveOrgSection(evId ? 'evt_overview' : 'org_overview');
      }
      if (!currentUser) {
        setReturnIntent({
          surface: 'organizer',
          label: 'เข้าใช้งานระบบผู้จัดงาน (Organizer Dashboard)',
        });
        navigateLogin('signin');
        return;
      }
      setSurface('organizer');
      pushUrl('/organizer');
    });
  };

  const navigatePlatformAdmin = (sec?: PlatformSection) => {
    guardUnsavedProfileNavigation(() => {
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      if (sec) setActivePlatformSection(sec);
      if (!currentUser) {
        setReturnIntent({
          surface: 'platform_admin',
          label: 'เข้าใช้งานศูนย์ควบคุม Platform Owner',
        });
        navigateLogin('signin');
        return;
      }
      setSurface('platform_admin');
      pushUrl('/platform-admin');
    });
  };

  const handleLogout = () => {
    guardUnsavedProfileNavigation(() => {
      void syncApi('POST', '/api/auth/logout');
      setCurrentUserId(null);
      setShowProfileMenu(false);
      setShowMobileMenu(false);
      setReturnIntent(null);
      if (
        surface === 'platform_admin' ||
        surface === 'organizer' ||
        surface === 'runner_profile' ||
        surface === 'account_security' ||
        (surface === 'customer' && customerSubView === 'my_orders')
      ) {
        setSurface('customer');
        setCustomerSubView('directory');
        pushUrl('/');
      }
    });
  };

  const handlePasswordLogin = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string; user?: UserAccount }> => {
    const res = await syncApi('POST', '/api/auth/login', { email, password });
    return { ok: res.ok, error: res.error, user: res.user };
  };

  const appendAudit = (
    orgId: string,
    actionSummary: string,
    detailChange: string,
    eventId?: string
  ) => {
    const entry: AuditLogEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 999)}`,
      organizationId: orgId,
      eventId,
      timestamp: '2026-11-17 13:40',
      actorName: currentUser?.fullNameTh ?? 'ผู้ใช้งานระบบ',
      actorRole: currentUser?.isPlatformAdmin
        ? 'Platform Owner'
        : currentUser && currentUser.memberships.length > 0
          ? 'ทีมผู้จัดงาน'
          : 'ลูกค้า / นักวิ่ง',
      actionSummary,
      detailChange,
    };
    setSys((prev) => ({
      ...prev,
      auditLogs: [entry, ...prev.auditLogs],
    }));
  };

  const handleAuthenticated = (
    incomingUser: UserAccount,
    preferredOrgId?: string
  ) => {
    const user =
      sys.users.find((u) => u.id === incomingUser.id) ??
      (incomingUser.contactEmail
        ? sys.users.find(
          (u) =>
            (u.contactEmail ?? '').toLowerCase() ===
            incomingUser.contactEmail!.toLowerCase()
        )
        : undefined) ??
      (currentUser && currentUser.fullNameTh === incomingUser.fullNameTh
        ? currentUser
        : incomingUser);
    const autoSocial = enrichSocialLinksFromIdentities(user);
    const prevSocial = user.runnerProfile?.socialLinks ?? {};
    const socialChanged =
      autoSocial.facebook !== prevSocial.facebook ||
      autoSocial.line !== prevSocial.line;

    if (socialChanged) {
      const nextProf: RunnerProfileData = {
        ...(user.runnerProfile ?? {}),
        socialLinks: autoSocial,
      };
      setSys((prev) => ({
        ...prev,
        users: prev.users.map((u) =>
          u.id === user.id ? { ...u, runnerProfile: nextProf } : u
        ),
      }));
    }

    const existsInUsers = sys.users.some((u) => u.id === user.id);
    if (sandboxTools && currentUserId !== user.id && existsInUsers) {
      void syncApi('POST', '/api/auth/dev-switch', { userId: user.id }).then(
        () => {
          if (socialChanged) {
            void syncApi('PATCH', '/api/profile', {
              runnerProfile: {
                ...(user.runnerProfile ?? {}),
                socialLinks: autoSocial,
              },
            });
          }
        }
      );
    } else if (socialChanged) {
      void syncApi('PATCH', '/api/profile', {
        runnerProfile: {
          ...(user.runnerProfile ?? {}),
          socialLinks: autoSocial,
        },
      });
    }
    setCurrentUserId(user.id);
    setSimulatedState('normal');
    setShowProfileMenu(false);

    // Honor validated internal ReturnIntent first (Section 16.1 & 16.2)
    if (returnIntent) {
      const intent = returnIntent;
      setReturnIntent(null);
      if (intent.surface === 'events' && intent.eventId) {
        const ev = sys.events.find((e) => e.id === intent.eventId);
        const slug = (ev?.code ?? intent.eventId).toLowerCase();
        const tab = intent.eventTab ?? 'register';
        setSelectedPublicEventId(intent.eventId);
        setInitialEventTab(tab);
        if (tab === 'register') {
          setCustomerSubView('event_register');
          setSurface('customer');
          pushUrl(`/events/${slug}/register`);
          return;
        }
        const suffix =
          tab === 'storefront'
            ? '/shop'
            : tab === 'info_results'
              ? '/results'
              : '';
        setCustomerSubView('event_detail');
        setSurface('customer');
        pushUrl(`/events/${slug}${suffix}`);
        return;
      }
      if (intent.surface === 'my_orders') {
        setCustomerSubView('my_orders');
        setSurface('customer');
        pushUrl('/my-orders');
        return;
      }
      if (intent.surface === 'runner_profile') {
        setProfileInitialTab('personal');
        setSurface('runner_profile');
        pushUrl('/profile');
        return;
      }
      if (intent.surface === 'account_security') {
        setProfileInitialTab('security');
        setSurface('account_security');
        pushUrl('/account/security');
        return;
      }
      if (intent.surface === 'platform_admin') {
        setSurface('platform_admin');
        pushUrl('/platform-admin');
        return;
      }
      if (intent.surface === 'organizer') {
        if (user.memberships.length > 0) {
          const targetOrg =
            preferredOrgId ?? user.memberships[0].organizationId;
          setActiveOrgId(targetOrg);
        }
        setSurface('organizer');
        pushUrl('/organizer');
        return;
      }
    }

    if (user.isPlatformAdmin && !preferredOrgId) {
      setActivePlatformSection('plat_overview');
      setSurface('platform_admin');
      pushUrl('/platform-admin');
      return;
    }

    if (preferredOrgId || user.memberships.length > 0) {
      const targetOrg =
        preferredOrgId ?? user.memberships[0]?.organizationId ?? 'org-lanna';
      const mem = user.memberships.find((m) => m.organizationId === targetOrg);
      setActiveOrgId(targetOrg);
      if (mem?.role === 'staff') {
        const firstEv = mem.assignedEventIds?.[0] ?? null;
        setActiveEventId(firstEv);
        setActiveOrgSection(firstEv ? 'evt_checkin_bib' : 'org_overview');
      } else {
        setActiveEventId(null);
        setActiveOrgSection('org_overview');
      }
      setSurface('organizer');
      pushUrl('/organizer');
    } else {
      setSurface('customer');
      setCustomerSubView('directory');
      pushUrl('/');
    }
  };

  const handleResetAllDemoData = () => {
    void syncApi('POST', '/api/dev/reset');
    setSys(loadSystemState());
    setCurrentUserId(null);
    setActiveOrgId('org-lanna');
    setActiveEventId(null);
    setSimulatedState('normal');
    setShowDemoTools(false);
    setShowProfileMenu(false);
    setSurface('customer');
    setCustomerSubView('directory');
    pushUrl('/');
  };

  /* ---- Auth & Account Security Handlers ---- */
  const handleRegisterEmailUser = (payload: {
    fullNameTh: string;
    fullNameEn?: string;
    email: string;
    password?: string;
    marketingConsent: boolean;
    runnerProfile?: RunnerProfileData;
  }) => {
    const exists = sys.users.some(
      (u) =>
        (u.contactEmail ?? '').toLowerCase() === payload.email.toLowerCase()
    );
    if (exists) {
      return {
        ok: false,
        error:
          tx("ไม่สามารถใช้ช่องทางนี้สร้างบัญชีซ้ำได้ กรุณาเข้าสู่ระบบด้วยบัญชีเดิมหรือกดลืมรหัสผ่าน"),
      };
    }
    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      code: `USR-${sys.users.length + 910}`,
      fullNameTh: payload.fullNameTh,
      fullNameEn: payload.fullNameEn ?? payload.fullNameTh,
      contactEmail: payload.email,
      emailVerified: true,
      hasPassword: true,
      runnerProfile: payload.runnerProfile,
      identities: [
        {
          id: `id-pw-${Date.now()}`,
          provider: 'password',
          providerSubject: payload.email.toLowerCase(),
          providerEmail: payload.email.toLowerCase(),
          linkedAt: '2026-11-18 09:30',
        },
      ],
      sessions: [
        {
          id: `ses-${Date.now()}`,
          deviceLabel: 'เบราว์เซอร์ปัจจุบัน (เพิ่งสมัครใหม่)',
          locationHint: 'ไทย',
          lastActiveAt: 'เมื่อสักครู่',
          isCurrentDevice: true,
        },
      ],
      memberships: [],
      demoRoleSummary: 'สมาชิกใหม่สมัครด้วยอีเมล (Runner 2-Step Wizard)',
      isDemoPreset: false,
    };
    setSys((prev) => ({ ...prev, users: [...prev.users, newUser] }));
    setCurrentUserId(newUser.id);
    void syncApi('POST', '/api/auth/register-runner', {
      ...payload,
      password: payload.password || 'demo1234',
    });
    return { ok: true, user: newUser };
  };

  const handleRegisterSocialUser = (payload: {
    provider: 'google' | 'line' | 'facebook';
    fullNameTh: string;
    fullNameEn?: string;
    email: string | null;
    marketingConsent: boolean;
    runnerProfile?: RunnerProfileData;
  }): UserAccount => {
    const providerSubject = `${payload.provider}-uid-${Date.now()}`;
    const existingSocial = payload.runnerProfile?.socialLinks ?? {};
    const enrichedSocial = {
      ...existingSocial,
      ...(payload.provider === 'facebook' && !existingSocial.facebook
        ? {
          facebook: deriveProviderSocialHandle('facebook', {
            fullNameTh: payload.fullNameTh,
            fullNameEn: payload.fullNameEn,
            email: payload.email,
            providerSubject,
          }),
        }
        : {}),
      ...(payload.provider === 'line' && !existingSocial.line
        ? {
          line: deriveProviderSocialHandle('line', {
            fullNameTh: payload.fullNameTh,
            fullNameEn: payload.fullNameEn,
            email: payload.email,
            providerSubject,
          }),
        }
        : {}),
    };
    const enrichedProfile: RunnerProfileData = {
      ...(payload.runnerProfile ?? {}),
      socialLinks: enrichedSocial,
    };
    const enrichedPayload = {
      ...payload,
      runnerProfile: enrichedProfile,
    };

    const newUser: UserAccount = {
      id: `usr-soc-${Date.now()}`,
      code: `USR-${sys.users.length + 920}`,
      fullNameTh: payload.fullNameTh,
      fullNameEn: payload.fullNameEn ?? payload.fullNameTh,
      contactEmail: payload.email,
      emailVerified: Boolean(payload.email),
      hasPassword: false,
      runnerProfile: enrichedProfile,
      identities: [
        {
          id: `id-soc-${Date.now()}`,
          provider: payload.provider,
          providerSubject,
          providerEmail: payload.email ?? undefined,
          linkedAt: '2026-11-18 09:30',
        },
      ],
      sessions: [
        {
          id: `ses-soc-${Date.now()}`,
          deviceLabel: `เข้าผ่าน ${payload.provider.toUpperCase()} (เครื่องปัจจุบัน)`,
          locationHint: 'ไทย',
          lastActiveAt: 'เมื่อสักครู่',
          isCurrentDevice: true,
        },
      ],
      memberships: [],
      demoRoleSummary: `สมาชิกใหม่ผ่าน ${payload.provider.toUpperCase()}`,
      isDemoPreset: false,
    };
    setSys((prev) => ({ ...prev, users: [...prev.users, newUser] }));
    setCurrentUserId(newUser.id);
    void syncApi('POST', '/api/auth/register-social', enrichedPayload);
    return newUser;
  };

  const handleSaveRunnerProfile = async (
    patch: Partial<RunnerProfileData>,
    opts?: { fullNameTh?: string; fullNameEn?: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const mergedProfile: RunnerProfileData = {
      ...(currentUser.runnerProfile ?? {}),
      ...patch,
    };
    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
            ...u,
            fullNameTh: opts?.fullNameTh ?? u.fullNameTh,
            fullNameEn: opts?.fullNameEn ?? u.fullNameEn,
            runnerProfile: mergedProfile,
          }
          : u
      ),
    }));
    const res = await syncApi('PATCH', '/api/account/profile', {
      profile: patch,
      fullNameTh: opts?.fullNameTh,
      fullNameEn: opts?.fullNameEn,
    });
    return { ok: res.ok, error: res.error };
  };

  const handleVerifyEmailWithOtp = async (
    email: string,
    otp: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await syncApi('POST', '/api/account/verify-email', {
      email,
      otp,
    });
    return { ok: res.ok, error: res.error };
  };

  // Email verification is shelved (FEATURES.emailVerification = false). The local API
  // has no unverified-email endpoint, so this reuses /verify-email without an OTP,
  // which stores the address and flags it verified in the sandbox DB.
  const handleSaveContactEmail = async (
    email: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await syncApi('POST', '/api/account/verify-email', { email });
    return { ok: res.ok, error: res.error };
  };

  const handleManageAccountStatus = async (
    action: 'deactivate' | 'request_deletion' | 'cancel_deletion',
    reason?: string,
    confirmCode?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await syncApi('POST', '/api/account/status', {
      action,
      reason,
      confirmCode,
    });
    if (res.ok && action === 'deactivate') {
      setCurrentUserId(null);
      setSurface('customer');
      setCustomerSubView('directory');
      pushUrl('/');
    }
    return { ok: res.ok, error: res.error };
  };

  const handleUpdatePlatformProfileConfig = (next: PlatformProfileConfig) => {
    setSys((prev) => ({
      ...prev,
      platformProfileConfig: next,
    }));
    void syncApi('PATCH', '/api/admin/profile-config', { config: next });
  };

  const handleUpdateEventShirtConfig = (
    eventId: string,
    patch: {
      shirtStocks?: RaceEvent['shirtStocks'];
      customSizeChart?: RaceEvent['customSizeChart'];
    }
  ) => {
    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId
          ? {
            ...ev,
            shirtStocks: patch.shirtStocks ?? ev.shirtStocks,
            customSizeChart: patch.customSizeChart ?? ev.customSizeChart,
          }
          : ev
      ),
    }));
    void syncApi('PATCH', `/api/events/${eventId}`, patch);
  };

  const handleSubmitOrganizerOnboarding = (payload: {
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
  }): { user: UserAccount; organization: Organization } => {
    const newOrgId = `org-onb-${Date.now()}`;
    const refNo = `ORG-REF-2026-${8840 + sys.organizations.length + 1}`;
    const newOrg: Organization = {
      id: newOrgId,
      code: `ORG-NEW-${sys.organizations.length + 10}`,
      nameTh: payload.orgNameTh,
      nameEn: payload.orgNameEn,
      province: payload.province,
      verificationStatus: 'pending_review',
      workflowStatus: 'SUBMITTED',
      referenceNumber: refNo,
      orgType: payload.orgType,
      businessRegNumber: payload.businessRegNumber,
      website: payload.website,
      orgPhone: payload.orgPhone,
      officeAddress: {
        address: payload.address,
        province: payload.province,
        district: payload.district,
        subdistrict: payload.subdistrict,
        postalCode: payload.postalCode,
        country: 'Thailand',
      },
      descriptionTh: payload.descriptionTh,
      previousEvents: payload.previousEvents,
      facebookPage: payload.facebookPage,
      mainContact: {
        name: payload.mainContactName,
        position: payload.mainContactPosition,
        phone: payload.mainContactPhone,
        email: payload.mainContactEmail,
      },
      documents: payload.documents,
      verificationHistory: [
        {
          id: `vh-${Date.now()}`,
          status: 'SUBMITTED',
          actorName: `${payload.firstName} ${payload.lastName}`.trim(),
          note: `ยื่นคำขอขึ้นทะเบียนผู้จัดงาน (${payload.orgType}) พร้อมเอกสาร ${payload.documents.length} รายการ`,
          timestamp: '2026-11-18 09:32',
        },
      ],
      submittedAt: '2026-11-18 09:32',
      payoutBankSummary: 'รอ Platform Owner ตรวจสอบเอกสารนิติบุคคลและบัญชีรับเงิน',
      payoutReady: false,
      contactEmail: payload.orgEmail,
    };

    const existingUser =
      currentUser ??
      sys.users.find(
        (u) =>
          (u.contactEmail ?? '').toLowerCase() === payload.email.toLowerCase()
      );

    const targetUser: UserAccount = existingUser
      ? {
        ...existingUser,
        memberships: [
          ...existingUser.memberships,
          { organizationId: newOrgId, role: 'owner' },
        ],
      }
      : {
        id: `usr-org-${Date.now()}`,
        code: `USR-${sys.users.length + 930}`,
        fullNameTh: `${payload.firstName} ${payload.lastName}`.trim(),
        fullNameEn: `${payload.firstName} ${payload.lastName}`.trim(),
        contactEmail: payload.email,
        emailVerified: true,
        hasPassword: true,
        identities: [
          {
            id: `id-org-pw-${Date.now()}`,
            provider: 'password',
            providerSubject: payload.email.toLowerCase(),
            providerEmail: payload.email.toLowerCase(),
            linkedAt: '2026-11-18 09:32',
          },
        ],
        sessions: [
          {
            id: `ses-org-${Date.now()}`,
            deviceLabel: 'เบราว์เซอร์ปัจจุบัน (ขึ้นทะเบียนผู้จัด)',
            locationHint: `${payload.province}, ไทย`,
            lastActiveAt: 'เมื่อสักครู่',
            isCurrentDevice: true,
          },
        ],
        memberships: [{ organizationId: newOrgId, role: 'owner' }],
        demoRoleSummary: `ผู้จัดงานใหม่ (${payload.orgNameTh})`,
        isDemoPreset: false,
      };

    setSys((prev) => ({
      ...prev,
      organizations: [newOrg, ...prev.organizations],
      users: existingUser
        ? prev.users.map((u) => (u.id === existingUser.id ? targetUser : u))
        : [...prev.users, targetUser],
    }));

    appendAudit(
      newOrgId,
      `ยื่นคำขอขึ้นทะเบียนผู้จัดงานใหม่ (${refNo})`,
      `${payload.orgNameTh} · สถานะเริ่มต้น SUBMITTED (PENDING_REVIEW)`
    );
    void syncApi('POST', '/api/auth/register-organizer', {
      ...payload,
      clientOrgId: newOrgId,
    });

    return { user: targetUser, organization: newOrg };
  };

  // Sends the typed password; the server hashes it and stamps passwordChangedAt.
  const handleSetOrChangePassword = async (
    newPassword: string,
    grant: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await syncApi('POST', '/api/account/password', { newPassword, grant });
    return { ok: res.ok, error: res.error };
  };

  // Password change step 1: ask the API to "send" a code to the contact email (sandbox, no real email).
  const handleRequestPasswordCode = async (): Promise<{
    ok: boolean;
    error?: string;
    sentTo?: string;
  }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await apiRequest('POST', '/api/account/password/request-code', {});
    const data = res.data as { sentTo?: string } | undefined;
    return { ok: res.ok, error: res.error, sentTo: data?.sentTo };
  };

  // Password change step 2: verify the code; the API returns a one-time grant for step 3.
  const handleVerifyPasswordCode = async (
    otp: string
  ): Promise<{ ok: boolean; error?: string; grant?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await apiRequest('POST', '/api/account/password/verify-code', { otp });
    const data = res.data as { grant?: string } | undefined;
    return { ok: res.ok, error: res.error, grant: data?.grant };
  };

  const handleRevokeSession = async (
    sessionId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await syncApi('DELETE', `/api/account/sessions/${encodeURIComponent(sessionId)}`);
    return { ok: res.ok, error: res.error };
  };

  const handleSetMarketingConsent = async (
    granted: boolean
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!currentUser) return { ok: false, error: tx("กรุณาเข้าสู่ระบบก่อน") };
    const res = await syncApi('POST', '/api/account/consents', {
      type: 'marketing',
      granted,
    });
    return { ok: res.ok, error: res.error };
  };

  const handleLinkProvider = (provider: 'google' | 'line' | 'facebook') => {
    if (!currentUser) return;
    const newSubject = `${provider}-linked-${Date.now()}`;
    const nextSocial =
      provider === 'facebook' || provider === 'line'
        ? enrichSocialLinksFromIdentities(
          {
            ...currentUser,
            identities: [
              ...currentUser.identities,
              {
                id: `id-${provider}-tmp`,
                provider,
                providerSubject: newSubject,
                linkedAt: '2026-11-17 09:46',
              },
            ],
          },
          provider
        )
        : currentUser.runnerProfile?.socialLinks;

    const nextRunnerProfile: RunnerProfileData = {
      ...(currentUser.runnerProfile ?? {}),
      ...(nextSocial ? { socialLinks: nextSocial } : {}),
    };

    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
            ...u,
            runnerProfile: nextRunnerProfile,
            identities: [
              ...u.identities,
              {
                id: `id-${provider}-${Date.now()}`,
                provider,
                providerSubject: newSubject,
                linkedAt: '2026-11-17 09:46',
              },
            ],
          }
          : u
      ),
    }));
    void syncApi('POST', '/api/account/providers', { provider }).then(() => {
      if (provider === 'facebook' || provider === 'line') {
        void syncApi('PATCH', '/api/profile', {
          runnerProfile: nextRunnerProfile,
        });
      }
    });
  };

  const handleUnlinkProvider = (
    provider: AuthProviderType
  ): { ok: boolean; error?: string } => {
    if (!currentUser) return { ok: false, error: tx("ไม่พบบัญชีผู้ใช้") };
    if (currentUser.identities.length <= 1) {
      return {
        ok: false,
        error:
          tx("ไม่อนุญาตให้ถอดช่องทางเข้าสู่ระบบช่องทางสุดท้าย กรุณาเพิ่มรหัสผ่านหรือเชื่อมช่องทางอื่นทดแทนก่อน"),
      };
    }
    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
            ...u,
            identities: u.identities.filter((i) => i.provider !== provider),
          }
          : u
      ),
    }));
    void syncApi('DELETE', `/api/account/providers/${provider}`);
    return { ok: true };
  };

  const handleRevokeOtherSessions = () => {
    if (!currentUser) return;
    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
            ...u,
            sessions: u.sessions.filter((s) => s.isCurrentDevice),
          }
          : u
      ),
    }));
    void syncApi('POST', '/api/account/revoke-sessions');
  };

  const handleAcceptTeamInvitation = (
    code: string
  ): { ok: boolean; message: string } => {
    if (!currentUser) return { ok: false, message: tx("กรุณาเข้าสู่ระบบก่อน") };
    const inv = sys.invitations.find(
      (i) => i.inviteCode.toUpperCase() === code.toUpperCase()
    );
    if (!inv) {
      return { ok: false, message: tx("ไม่พบรหัสคำเชิญนี้ในระบบ") };
    }
    if (inv.usedByUserId) {
      return {
        ok: false,
        message: tx("รหัสคำเชิญนี้ถูกใช้งานไปแล้ว (คำเชิญทีมจำกัดการใช้เพียงครั้งเดียว)"),
      };
    }
    const alreadyInOrg = currentUser.memberships.some(
      (m) => m.organizationId === inv.organizationId
    );
    if (alreadyInOrg) {
      return {
        ok: false,
        message: tx("บัญชีของคุณเป็นสมาชิกขององค์กรนี้อยู่แล้ว"),
      };
    }

    const org = sys.organizations.find((o) => o.id === inv.organizationId);
    setSys((prev) => ({
      ...prev,
      invitations: prev.invitations.map((i) =>
        i.id === inv.id ? { ...i, usedByUserId: currentUser.code } : i
      ),
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
            ...u,
            memberships: [
              ...u.memberships,
              {
                organizationId: inv.organizationId,
                role: inv.role,
                assignedEventIds: inv.assignedEventIds,
              },
            ],
          }
          : u
      ),
    }));
    const roleTh =
      inv.role === 'owner'
        ? 'เจ้าขององค์กร'
        : inv.role === 'event_manager'
          ? 'ผู้จัดการงานวิ่ง'
          : inv.role === 'finance'
            ? 'ฝ่ายการเงิน'
            : 'เจ้าหน้าที่หน้างาน';
    void syncApi('POST', '/api/invitations/accept', { code });
    return {
      ok: true,
      message: txf("เข้าร่วมทีม {0} ในบทบาท {1} สำเร็จ!", org?.nameTh ?? inv.organizationId, roleTh),
    };
  };

  const handleApplyNewOrganizerOrg = (
    orgNameTh: string,
    province: string
  ): Organization => {
    const newOrg: Organization = {
      id: `org-custom-${Date.now()}`,
      code: `ORG-NEW-0${sys.organizations.length + 1}`,
      nameTh: `${orgNameTh} (รอตรวจสอบผู้จัด)`,
      nameEn: orgNameTh,
      province,
      verificationStatus: 'pending_review',
      payoutBankSummary: 'รอยืนยันเอกสารผู้จัดและบัญชีธนาคารรับยอดนำส่ง',
      payoutReady: false,
      contactEmail: currentUser?.contactEmail ?? 'pending@demo.local',
    };
    setSys((prev) => ({
      ...prev,
      organizations: [...prev.organizations, newOrg],
      users: prev.users.map((u) =>
        u.id === currentUser?.id
          ? {
            ...u,
            memberships: [
              ...u.memberships,
              { organizationId: newOrg.id, role: 'owner' },
            ],
          }
          : u
      ),
    }));
    void syncApi('POST', '/api/organizations', {
      id: newOrg.id,
      orgNameTh,
      province,
    });
    return newOrg;
  };

  /* ---- Customer & Runner Operations ---- */
  const handleCreateRegistrationAndAddon = async (payload: {
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
    simulateImmediateWebhook: boolean;
    addonItems?: { productId: string; size: string; qty: number }[];
    customAnswers?: Record<string, string | boolean>;
    /** one id per checkout attempt; the same id on a retry so the server never books twice */
    requestId: string;
  }): Promise<
    | { ok: true; reg: RegistrationRecord; addonOrders?: MerchOrderRecord[] }
    | { ok: false; error: string }
  > => {
    // The seat, shirt and price are decided by the server inside one locked transaction, so
    // the page waits for its answer instead of showing a booking the server might refuse.
    const { requestId, addonItems, ...rest } = payload;
    const res = await syncApi('POST', '/api/registrations', {
      ...rest,
      id: requestId,
      addonItems: addonItems?.map((l) => ({ productId: l.productId, variantSize: l.size, quantity: l.qty })),
      addonOrderId: addonItems && addonItems.length > 0 ? `${requestId}-addon` : undefined,
    });
    if (!res.ok || !res.reg) {
      return {
        ok: false,
        error: res.error ?? tx('ระบบยืนยันคำสั่งซื้อไม่สำเร็จ กรุณาลองอีกครั้ง'),
      };
    }
    return { ok: true, reg: res.reg, addonOrders: res.addonOrders ?? (res.addonOrder ? [res.addonOrder] : []) };
  };

  // A registration held at the summary step (pending_payment): pay it, or give it back so the
  // runner can edit (26 Nov 2026). The server re-checks the 15-minute hold on both.
  const handlePayHeldRegistration = async (
    regId: string
  ): Promise<{ ok: true; reg: RegistrationRecord } | { ok: false; error: string; expired: boolean }> => {
    const res = await syncApi('POST', `/api/registrations/${regId}/confirm-payment`);
    if (!res.ok || !res.reg) {
      // the hold may have run out: fetch the state that shows it released
      if (res.expired) await syncApi('GET', '/api/bootstrap');
      return { ok: false, error: res.error ?? tx('ชำระเงินไม่สำเร็จ กรุณาลองอีกครั้ง'), expired: Boolean(res.expired) };
    }
    return { ok: true, reg: res.reg };
  };
  const handleCancelHeldRegistration = async (regId: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await syncApi('POST', `/api/registrations/${regId}/cancel-hold`);
    return { ok: res.ok, error: res.error };
  };

  // Storefront cart: the server prices every line, checks stock for the whole cart in one
  // transaction and returns the orders it wrote; nothing is added locally before it answers.
  const handleCheckoutMerchCart = async (payload: {
    eventId: string;
    items: { productId: string; size: string; qty: number }[];
    buyerName: string;
    deliveryMethod: 'pickup_at_expo' | 'postal_shipping';
    shippingAddress?: string;
    linkedRegistrationCode?: string;
  }) => {
    const res = await syncApi('POST', '/api/merch-orders/checkout', {
      ...payload,
      items: payload.items.map((l) => ({ productId: l.productId, variantSize: l.size, quantity: l.qty })),
    });
    return { ok: res.ok, error: res.error, orders: res.orders, checkoutCode: res.checkoutCode };
  };

  const handleUpdateEventTotalQuota = (
    eventId: string,
    newTotalQuota: number
  ) => {
    const target = sys.events.find((e) => e.id === eventId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId ? { ...ev, totalEventQuota: newTotalQuota } : ev
      ),
    }));

    appendAudit(
      target.organizationId,
      `ปรับเพดานโควตารวมงาน ${target.code}`,
      `${target.totalEventQuota} -> ${newTotalQuota} คน`,
      target.id
    );
    void syncApi('PATCH', `/api/events/${eventId}`, { totalEventQuota: newTotalQuota });
  };

  // Whole-event cap on/off. The server checks the role and the cap against seats already used;
  // the returned snapshot replaces local state (no optimistic update).
  const handleToggleEventTotalQuota = async (
    eventId: string,
    enabled: boolean,
    newTotalQuota?: number
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await syncApi('PATCH', `/api/events/${eventId}`, {
      totalEventQuotaEnabled: enabled,
      ...(newTotalQuota !== undefined ? { totalEventQuota: newTotalQuota } : {}),
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  };

  // Server validates and stores the age rules; the returned snapshot replaces local state.
  const handleUpdateCategoryAgeRules = async (
    eventId: string,
    categoryId: string,
    config: AgeConfigValid
  ): Promise<{ ok: boolean; error?: string }> => {
    const res = await syncApi('PATCH', `/api/events/${eventId}`, {
      categoryAgeUpdate: { categoryId, ...config },
    });
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  };

  const handleUpdateCategoryQuota = (
    eventId: string,
    categoryId: string,
    newCategoryQuota: number
  ) => {
    const target = sys.events.find((e) => e.id === eventId);
    const targetCat = target?.categories.find((c) => c.id === categoryId);
    if (!target || !targetCat) return;

    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) => {
        if (ev.id !== eventId) return ev;
        const nextCategories = ev.categories.map((cat) =>
          cat.id === categoryId
            ? { ...cat, categoryQuota: newCategoryQuota }
            : cat
        );
        const nextTotalQuota = nextCategories.reduce(
          (sum, cat) => sum + cat.categoryQuota,
          0
        );
        return {
          ...ev,
          categories: nextCategories,
          totalEventQuota: Math.max(ev.totalEventQuota, nextTotalQuota),
        };
      }),
    }));

    appendAudit(
      target.organizationId,
      `ปรับโควตาระยะ ${targetCat.code} งาน ${target.code}`,
      `${targetCat.categoryQuota} -> ${newCategoryQuota} คน`,
      target.id
    );
    void syncApi('PATCH', `/api/events/${eventId}`, {
      categoryQuotaUpdate: { categoryId, newCategoryQuota },
    });
  };

  // Page editor: the server checks the role, validates the page and keeps the versions
  /** the registration form: the organizer's questions and own steps; saving publishes a new version */
  const handleSaveRegistrationForm = async (
    eventId: string,
    form: { fields: CustomRegistrationField[]; steps: OrganizerFormStep[] }
  ) => {
    const res = await syncApi('PATCH', `/api/events/${eventId}`, { form });
    return { ok: Boolean(res.ok), error: res.ok ? undefined : String(res.error ?? '') || undefined };
  };

  /** the text of the one-template event page (about, race pack, schedule, register card) */
  const handleSavePageContent = async (
    eventId: string,
    content: { coreText: Required<EventCoreText>; card: EventRegisterCardConfig }
  ) => {
    const res = await syncApi('PATCH', `/api/events/${eventId}`, { pageContent: content });
    return { ok: Boolean(res.ok), error: res.ok ? undefined : String(res.error ?? '') || undefined };
  };

  /* ---- Dynamic Registration Form Builder (Platform Owner & Organizer) ---- */
  const handleUpdateEventMedia = (
    eventId: string,
    patch: {
      coverImageUrl?: string;
      coverImageAlt?: string;
      galleryImageUrls?: string[];
    }
  ) => {
    const target = sys.events.find((e) => e.id === eventId);
    if (!target) return;
    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId
          ? {
            ...ev,
            coverImageUrl: patch.coverImageUrl,
            coverImageAlt: patch.coverImageAlt,
            galleryImageUrls: patch.galleryImageUrls ?? [],
          }
          : ev
      ),
    }));
    appendAudit(
      target.organizationId,
      `อัปเดตรูปปกงาน ${target.code}`,
      patch.coverImageUrl
        ? `ตั้งรูปปก + ภาพประกอบ ${patch.galleryImageUrls?.length ?? 0} รูป`
        : 'ลบรูปปก (ใช้ภาพปกลายเส้นแทน)',
      target.id
    );
    void syncApi('PATCH', `/api/events/${eventId}`, { media: patch });
  };
  const handleUpsertStep = (step: RegistrationStepDef) => {
    setSys((prev) => {
      const exists = prev.registrationSteps.some((s) => s.id === step.id);
      const nextSteps = exists
        ? prev.registrationSteps.map((s) => (s.id === step.id ? step : s))
        : [...prev.registrationSteps, step];
      return { ...prev, registrationSteps: nextSteps };
    });
    appendAudit(
      'PLATFORM-HQ',
      `อัปเดตขั้นตอนการสมัคร (${step.key})`,
      `${step.titleTh} · enabled=${step.enabled}`
    );
    void syncApi('POST', '/api/form-builder/steps', { step });
  };

  const handleReorderStep = (stepId: string, direction: 'up' | 'down') => {
    setSys((prev) => {
      const sorted = [...prev.registrationSteps].sort(
        (a, b) => a.order - b.order
      );
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      // ห้ามเลื่อนข้ามขั้นตอนสุดท้าย (Review & Payment)
      if (swapIdx < 0 || swapIdx >= sorted.length - 1) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[swapIdx];
      sorted[swapIdx] = temp;
      const reindexed = sorted.map((s, i) => ({ ...s, order: i + 1 }));
      return { ...prev, registrationSteps: reindexed };
    });
    void syncApi('POST', '/api/form-builder/steps/reorder', { stepId, direction });
  };

  const handleDeleteStep = (stepId: string) => {
    const target = sys.registrationSteps.find((s) => s.id === stepId);
    if (!target || target.isSystemLocked) return;
    setSys((prev) => ({
      ...prev,
      registrationSteps: prev.registrationSteps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order: i + 1 })),
    }));
    appendAudit(
      'PLATFORM-HQ',
      `ลบขั้นตอนการสมัคร ${target.key}`,
      target.titleTh
    );
    void syncApi('DELETE', `/api/form-builder/steps/${stepId}`);
  };

  const handleUpsertGlobalField = (field: GlobalFormFieldDef) => {
    setSys((prev) => {
      const exists = prev.globalFields.some((f) => f.id === field.id);
      const nextGlobal = exists
        ? prev.globalFields.map((f) => (f.id === field.id ? field : f))
        : [...prev.globalFields, field];

      // ซิงก์นโยบายและคุณสมบัติไปยังฟิลด์ที่มี id เดียวกันในงานวิ่งด้วย
      const nextEvents = prev.events.map((ev) => ({
        ...ev,
        customFields: (ev.customFields ?? []).map((cf) =>
          cf.id === field.id
            ? {
              ...cf,
              label: field.label,
              policy: field.policy,
              descriptionTh: field.descriptionTh,
              placeholderTh: field.placeholderTh,
              options: field.options ?? cf.options,
              visibilityCondition: field.visibilityCondition,
            }
            : cf
        ),
      }));
      return { ...prev, globalFields: nextGlobal, events: nextEvents };
    });
    appendAudit(
      'PLATFORM-HQ',
      `อัปเดตคลังฟิลด์กลาง (${field.fieldKey})`,
      `Policy: ${field.policy} · Type: ${field.type}`
    );
    void syncApi('POST', '/api/form-builder/fields', { field });
  };

  const handleAddConditionalRule = (rule: ConditionalRule) => {
    setSys((prev) => ({
      ...prev,
      conditionalRules: [...prev.conditionalRules, rule],
      globalFields: prev.globalFields.map((gf) =>
        rule.targetType === 'field' && gf.id === rule.targetKey
          ? { ...gf, visibilityCondition: rule }
          : gf
      ),
      events: prev.events.map((ev) => ({
        ...ev,
        customFields: (ev.customFields ?? []).map((cf) =>
          rule.targetType === 'field' && cf.id === rule.targetKey
            ? { ...cf, visibilityCondition: rule }
            : cf
        ),
      })),
    }));
    appendAudit(
      'PLATFORM-HQ',
      `เพิ่มกฎ Conditional Logic (${rule.id})`,
      `IF ${rule.sourceFieldKey} ${rule.operator} "${rule.value}" -> SHOW ${rule.targetKey}`
    );
    void syncApi('POST', '/api/form-builder/rules', { rule });
  };

  const handleDeleteConditionalRule = (ruleId: string) => {
    setSys((prev) => ({
      ...prev,
      conditionalRules: prev.conditionalRules.filter((r) => r.id !== ruleId),
    }));
    void syncApi('DELETE', `/api/form-builder/rules/${ruleId}`);
  };

  const handlePublishTemplateVersion = (templateId: string, summary: string) => {
    setSys((prev) => ({
      ...prev,
      formTemplates: prev.formTemplates.map((tpl) => {
        if (tpl.id !== templateId) return tpl;
        const nextVerNum =
          Number(tpl.versionLabel.replace(/[^0-9.]/g, '')) + 0.1;
        return {
          ...tpl,
          status: 'published',
          versionLabel: `v${nextVerNum.toFixed(1)}`,
          updatedAt: '2026-11-18 09:05',
        };
      }),
    }));
    appendAudit('PLATFORM-HQ', `Publish แม่แบบฟอร์ม ${templateId}`, summary);
    void syncApi('POST', `/api/form-builder/templates/${templateId}/publish`, { summary });
  };

  const handleCreateTemplate = (
    nameTh: string,
    code: string,
    descriptionTh: string
  ) => {
    const newTpl: FormTemplate = {
      id: `tpl-${Date.now()}`,
      code,
      nameTh,
      descriptionTh,
      status: 'published',
      versionLabel: 'v1.0',
      updatedAt: '2026-11-18 09:05',
      steps: sys.registrationSteps,
      fieldIds: ['cf_blood', 'cf_has_medical', 'cf_medical', 'cf_club'],
      conditionalRules: sys.conditionalRules,
    };
    setSys((prev) => ({
      ...prev,
      formTemplates: [...prev.formTemplates, newTpl],
    }));
    appendAudit('PLATFORM-HQ', `สร้างแม่แบบฟอร์มใหม่ (${code})`, nameTh);
    void syncApi('POST', '/api/form-builder/templates', {
      id: newTpl.id,
      nameTh,
      code,
      descriptionTh,
    });
  };

  const handleResolveFieldRequest = (
    requestId: string,
    decision: 'approved' | 'rejected',
    policy: FormFieldPolicy,
    adminNote: string
  ) => {
    const req = sys.fieldRequests.find((r) => r.id === requestId);
    if (!req) return;

    const newFieldId = `cf_${req.requestedFieldKey}`;
    const newGlobalField: GlobalFormFieldDef = {
      id: newFieldId,
      fieldKey: req.requestedFieldKey,
      label: req.requestedLabelTh,
      type: req.inputType,
      stepKey: req.targetStepKey,
      required: req.required,
      isSensitive: req.isSensitive,
      policy,
      options: req.options,
      categoryTag: 'custom_library',
    };

    setSys((prev) => {
      const nextRequests = prev.fieldRequests.map((r) =>
        r.id === requestId
          ? {
            ...r,
            status: decision,
            adminNote,
            resolvedAt: '2026-11-18 09:10',
          }
          : r
      );

      if (decision === 'rejected') {
        return { ...prev, fieldRequests: nextRequests };
      }

      const existsInGlobal = prev.globalFields.some(
        (gf) => gf.id === newFieldId
      );
      const nextGlobals = existsInGlobal
        ? prev.globalFields
        : [...prev.globalFields, newGlobalField];

      const nextEvents = prev.events.map((ev) => {
        if (ev.id !== req.eventId) return ev;
        const currentFields = ev.customFields ?? [];
        const alreadyHas = currentFields.some((f) => f.id === newFieldId);
        return {
          ...ev,
          publishedFormVersion: 'v1.3-published',
          customFields: alreadyHas
            ? currentFields
            : [...currentFields, newGlobalField],
        };
      });

      return {
        ...prev,
        fieldRequests: nextRequests,
        globalFields: nextGlobals,
        events: nextEvents,
      };
    });

    appendAudit(
      req.organizationId,
      `Platform Owner ${decision === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'
      }คำขอฟิลด์ ${req.requestCode}`,
      `${req.requestedLabelTh} · สิทธิ์: ${policy} · ${adminNote}`,
      req.eventId
    );
    void syncApi('POST', `/api/form-builder/field-requests/${requestId}/resolve`, {
      decision,
      policy,
      adminNote,
    });
  };



  /* ---- Organizer Operations ---- */
  const handleCreateDraftEvent = (payload: {
    orgId: string;
    titleTh: string;
    province: string;
    eventDate: string;
    requestProductionHelp: boolean;
  }) => {
    const num = sys.events.length + 10;
    const newEv: RaceEvent = {
      id: `evt-drf-${Date.now()}`,
      code: `EVT-DRF-27${num}`,
      organizationId: payload.orgId,
      titleTh: payload.titleTh,
      titleEn: payload.titleTh,
      tagline: 'งานวิ่งแบบร่างที่สร้างใหม่ รอกำหนดรายละเอียดและส่งตรวจเปิดขาย',
      coverMotif: 'mountain',
      province: payload.province,
      region: 'เหนือ',
      venue: 'สถานที่จัดงาน (รอกำหนดรายละเอียด)',
      eventDate: payload.eventDate,
      timezone: 'Asia/Bangkok',
      raceType: 'Road Race',
      status: 'draft',
      statusNote:
        'งานแบบร่างเพิ่งสร้างใหม่ — ตรวจ Checklist ความพร้อมด้านล่างก่อนส่งอนุมัติเปิดขาย',
      totalEventQuota: 100,
      feeBearerPolicy: 'runner_pays',
      editDeadlineDate: payload.eventDate,
      rulesVersion: 'v0.1-draft',
      kitPickupWindow: 'วันก่อนแข่งขัน เวลา 10:00–18:00 น.',
      highlights: ['งานวิ่งที่สร้างใหม่ผ่านหน้าผู้จัดงาน'],
      categories: [
        {
          id: `cat-drf-${Date.now()}`,
          code: '10 km',
          name: 'Mini Marathon 10.0 กม.',
          distanceKm: 10,
          startTimeLocal: '05:30',
          cutoffHours: 2.5,
          categoryQuota: 100,
          bibPrefix: 'D',
          colorTag: 'vermilion',
          priceTiers: [
            {
              id: `tier-drf-${Date.now()}`,
              label: 'Regular',
              priceSatang: 70000,
              startsAt: '2026-12-01',
              endsAt: payload.eventDate,
              isCurrent: true,
            },
          ],
        },
      ],
      shirtStocks: [
        { size: 'XS', total: 10, reservedOrConfirmed: 0 },
        { size: 'S', total: 20, reservedOrConfirmed: 0 },
        { size: 'M', total: 35, reservedOrConfirmed: 0 },
        { size: 'L', total: 25, reservedOrConfirmed: 0 },
        { size: 'XL', total: 10, reservedOrConfirmed: 0 },
        { size: '2XL', total: 0, reservedOrConfirmed: 0 },
      ],
      products: [],
      readinessChecks: [
        {
          id: 'chk-n1',
          label: 'ระบุชื่อจังหวัดและวันจัดงานเบื้องต้นแล้ว',
          passed: true,
          fixTargetHint: 'ข้อมูลพื้นฐานครบแล้ว',
        },
        {
          id: 'chk-n2',
          label: 'ยืนยันโควตาเสื้อ 2XL และนโยบายการคืนเงินก่อนส่งตรวจ',
          passed: false,
          fixTargetHint: 'กดปุ่มเติมข้อมูลด้านล่างเพื่อส่งตรวจเปิดขาย',
        },
      ],
    };

    const optRfq: ProductionInquiry | null = payload.requestProductionHelp
      ? {
        id: `rfq-ev-${Date.now()}`,
        inquiryCode: `RFQ-2611-0${sys.productionInquiries.length + 2}`,
        organizationId: payload.orgId,
        requesterName: currentUser?.fullNameTh ?? 'ผู้จัดงาน',
        requesterContact: 'ผ่านระบบผู้จัดงาน',
        eventId: newEv.id,
        contextType: 'event_organizer',
        itemType: 'ชุดเสื้อพร้อมเหรียญครบวงจร',
        serviceModel: 'produce_bulk',
        packageEntitlementQty: 100,
        addonStoreQty: 0,
        organizerBufferQty: 10,
        existingStockDeductedQty: 0,
        netQtyToProduce: 110,
        artworkVersion: 'ขอคำปรึกษาออกแบบจากทีม กระต่าย',
        targetDeliveryDate: payload.eventDate,
        quoteStatus: 'submitted',
        productionStatus: 'awaiting_approval',
        createdAt: '2026-11-17 09:48',
      }
      : null;

    setSys((prev) => ({
      ...prev,
      events: [newEv, ...prev.events],
      productionInquiries: optRfq
        ? [optRfq, ...prev.productionInquiries]
        : prev.productionInquiries,
    }));

    appendAudit(
      payload.orgId,
      `สร้างงานแบบร่างใหม่ (${newEv.code})`,
      payload.requestProductionHelp
        ? `${payload.titleTh} + ส่งคำขอช่วยผลิตเสื้อ/เหรียญ`
        : payload.titleTh,
      newEv.id
    );
    setActiveEventId(newEv.id);
    setActiveOrgSection('evt_overview');
    void syncApi('POST', '/api/events', {
      ...payload,
      id: newEv.id,
      code: newEv.code,
    });
  };

  const handleDuplicateEventWithoutPii = (sourceEventId: string) => {
    const src = sys.events.find((e) => e.id === sourceEventId);
    if (!src) return;
    const copyCode = `${src.code}-NEXT`;
    const copyEv: RaceEvent = {
      ...src,
      id: `evt-copy-${Date.now()}`,
      code: copyCode,
      titleTh: `${src.titleTh} (สำเนาจัดครั้งถัดไป)`,
      status: 'draft',
      statusNote:
        'ทำสำเนาเฉพาะโครงสร้างระยะ ราคา และตารางไซส์เสื้อตั้งต้น — ไม่คัดลอกข้อมูลส่วนบุคคลของผู้สมัครเดิม',
      shirtStocks: src.shirtStocks.map((s) => ({
        ...s,
        reservedOrConfirmed: 0,
      })),
      products: src.products.map((p) => ({
        ...p,
        id: `prd-copy-${p.id}-${Date.now()}`,
        soldCount: 0,
      })),
      verifiedPhotoAlbums: undefined,
      officialResultsUrl: undefined,
      customFields: cloneCustomFieldsSchema(src.customFields ?? []),
    };
    setSys((prev) => ({ ...prev, events: [copyEv, ...prev.events] }));
    appendAudit(
      src.organizationId,
      `คัดลอกโครงสร้างงานโดยไม่คัดลอกข้อมูลผู้สมัครเดิม`,
      `${src.code} -> ${copyCode}`,
      copyEv.id
    );
    setActiveEventId(copyEv.id);
    setActiveOrgSection('evt_overview');
    void syncApi('POST', `/api/events/${sourceEventId}/duplicate`, {
      newEventId: copyEv.id,
      copyCode: copyEv.code,
    });
  };

  const handleCompleteDraftReadinessAndSubmit = (eventId: string) => {
    const target = sys.events.find((e) => e.id === eventId);
    if (!target) return;
    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId
          ? {
            ...ev,
            status: 'in_review',
            rulesVersion: 'v1.0-submitted',
            statusNote:
              'ส่งตรวจความพร้อมเรียบร้อยแล้ว รอผู้ดูแลแพลตฟอร์มอนุมัติเปิดรับสมัคร',
            shirtStocks: ev.shirtStocks.map((s) =>
              s.size === '2XL' && s.total === 0 ? { ...s, total: 10 } : s
            ),
            readinessChecks: ev.readinessChecks.map((c) => ({
              ...c,
              passed: true,
            })),
          }
          : ev
      ),
    }));
    appendAudit(
      target.organizationId,
      `ส่งงาน ${target.code} เข้าคิวตรวจอนุมัติเผยแพร่`,
      'draft -> in_review',
      target.id
    );
    void syncApi('POST', `/api/events/${eventId}/submit-review`);
  };

  const handleUpdateFeeBearerPolicy = (
    eventId: string,
    policy: FeeBearerPolicy
  ) => {
    const target = sys.events.find((e) => e.id === eventId);
    if (!target) return;
    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId ? { ...ev, feeBearerPolicy: policy } : ev
      ),
    }));
    appendAudit(
      target.organizationId,
      `เปลี่ยนนโยบายผู้รับภาระค่าบริการงาน ${target.code}`,
      `เป็น ${policy} (เฉพาะใบสมัครใหม่)`,
      target.id
    );
    void syncApi('PATCH', `/api/events/${eventId}`, { feeBearerPolicy: policy });
  };

  const handleAddEventProduct = (payload: {
    eventId: string;
    nameTh: string;
    categoryLabel: 'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม';
    saleMode: 'ready_stock' | 'preorder';
    serviceModel: SellerServiceModel;
    priceBaht: number;
    stockOrCeiling: number;
  }) => {
    const target = sys.events.find((e) => e.id === payload.eventId);
    if (!target) return;
    const newPrd: EventProduct = {
      id: `prd-${Date.now()}`,
      sku: `SKU-${Date.now().toString().slice(-4)}`,
      eventId: payload.eventId,
      nameTh: payload.nameTh,
      categoryLabel: payload.categoryLabel,
      saleMode: payload.saleMode,
      serviceModel: payload.serviceModel,
      sellerLabel:
        payload.serviceModel === 'kratai_full_service'
          ? 'ดูแลพรีออเดอร์และจัดส่งโดย กระต่าย'
          : 'ผู้ขาย: องค์กรผู้จัดงาน',
      fulfillmentOwnerLabel:
        payload.serviceModel === 'kratai_full_service'
          ? 'กระต่าย ผลิตและจัดส่ง'
          : 'ผู้จัดงานส่งมอบ',
      priceSatang: payload.priceBaht * 100,
      shippingFeeSatang: 5000,
      stockOrCeiling: payload.stockOrCeiling,
      soldCount: 0,
      preorderMinQty: payload.saleMode === 'preorder' ? 20 : undefined,
      preorderCloseDate:
        payload.saleMode === 'preorder' ? target.editDeadlineDate : undefined,
      estimatedDeliveryNote: 'ตามกำหนดนัดรับหน้างานหรือจัดส่งไปรษณีย์',
      refundAndMinPolicyNote:
        payload.saleMode === 'preorder'
          ? 'หากยอดไม่ถึงขั้นต่ำจะยกเลิกและคืนเงินเต็มจำนวน'
          : 'เปลี่ยนได้กรณีชำรุดจากการผลิต',
      availableSizes:
        payload.categoryLabel === 'เสื้อที่ระลึก'
          ? ['S', 'M', 'L', 'XL']
          : ['มาตรฐาน'],
      description: 'รายการสินค้าที่ระลึกเฉพาะงาน ลูกค้าทั่วไปซื้อได้โดยไม่ต้องสมัครวิ่ง',
    };
    setSys((prev) => ({
      ...prev,
      events: prev.events.map((e) =>
        e.id === payload.eventId
          ? { ...e, products: [...e.products, newPrd] }
          : e
      ),
    }));
    appendAudit(
      target.organizationId,
      `เพิ่มสินค้าหน้าร้าน ${newPrd.nameTh}`,
      `${newPrd.sku} · ฿${payload.priceBaht}`,
      target.id
    );
    void syncApi('PATCH', `/api/events/${payload.eventId}`, {
      addProduct: { ...payload, id: newPrd.id, sku: newPrd.sku },
    });
  };

  const handleCreateEventProductionQuote = (payload: {
    orgId: string;
    eventId?: string;
    itemType: ProductionInquiry['itemType'];
    packageQty: number;
    addonQty: number;
    bufferQty: number;
    existingStockQty: number;
    targetDeliveryDate: string;
  }) => {
    const net = Math.max(
      0,
      payload.packageQty +
      payload.addonQty +
      payload.bufferQty -
      payload.existingStockQty
    );
    const rfq: ProductionInquiry = {
      id: `rfq-${Date.now()}`,
      inquiryCode: `RFQ-2611-0${sys.productionInquiries.length + 3}`,
      organizationId: payload.orgId,
      requesterName: currentUser?.fullNameTh ?? 'ผู้จัดงาน',
      requesterContact: 'ผ่านระบบผู้จัดงาน',
      eventId: payload.eventId,
      contextType: 'event_organizer',
      itemType: payload.itemType,
      serviceModel: 'produce_bulk',
      packageEntitlementQty: payload.packageQty,
      addonStoreQty: payload.addonQty,
      organizerBufferQty: payload.bufferQty,
      existingStockDeductedQty: payload.existingStockQty,
      netQtyToProduce: net,
      artworkVersion: 'Artwork-v1.0 (รอสรุปใบเสนอราคา)',
      targetDeliveryDate: payload.targetDeliveryDate,
      quoteStatus: 'submitted',
      productionStatus: 'awaiting_approval',
      createdAt: '2026-11-17 09:50',
    };
    setSys((prev) => ({
      ...prev,
      productionInquiries: [rfq, ...prev.productionInquiries],
    }));
    appendAudit(
      payload.orgId,
      `ส่งคำขอใบเสนอราคาผลิต (${rfq.inquiryCode})`,
      `ยอดสุทธิ ${net} ชิ้น`,
      payload.eventId
    );
    void syncApi('POST', '/api/production-inquiries', {
      ...payload,
      contextType: 'event_organizer',
      id: rfq.id,
      inquiryCode: rfq.inquiryCode,
    });
  };

  const handleAssignBibNumber = (
    regId: string,
    bibNumber: string
  ): { ok: boolean; error?: string } => {
    const trimmed = bibNumber.trim().toUpperCase();
    if (!trimmed) return { ok: false, error: tx("กรุณาระบุเลข BIB") };
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return { ok: false, error: tx("ไม่พบใบสมัคร") };

    const dup = sys.registrations.find(
      (r) =>
        r.eventId === target.eventId &&
        r.id !== regId &&
        (r.bibNumber ?? '').toUpperCase() === trimmed
    );
    if (dup) {
      return {
        ok: false,
        error: txf("เลข BIB \"{0}\" ซ้ำกับผู้สมัคร {1} ({2}) ในงานเดียวกัน!", trimmed, dup.participantNameTh, dup.regCode),
      };
    }

    setSys((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId ? { ...r, bibNumber: trimmed } : r
      ),
    }));
    appendAudit(
      target.organizationId,
      `กำหนดเลข BIB ให้ ${target.regCode}`,
      `BIB -> ${trimmed}`,
      target.eventId
    );
    void syncApi('POST', `/api/registrations/${regId}/bib`, { bibNumber: trimmed });
    return { ok: true };
  };

  const handleConfirmKitPickup = (
    regId: string
  ): { ok: boolean; error?: string } => {
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return { ok: false, error: tx("ไม่พบใบสมัคร") };
    if (target.fulfillmentStatus === 'kit_picked_up') {
      return {
        ok: false,
        error: txf("ป้องกันการรับซ้ำ: {0} รับเสื้อและ BIB ไปแล้วโดย {1} เมื่อ {2}", target.participantNameTh, target.fulfillmentUpdatedBy, target.fulfillmentUpdatedAt),
      };
    }
    if (!target.bibNumber) {
      return { ok: false, error: tx("กรุณากำหนดเลข BIB ก่อนส่งมอบอุปกรณ์") };
    }
    const actor = currentUser?.fullNameTh ?? 'เจ้าหน้าที่จุดรับอุปกรณ์';
    setSys((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? {
            ...r,
            fulfillmentStatus: 'kit_picked_up',
            fulfillmentUpdatedBy: actor,
            fulfillmentUpdatedAt: '2026-11-17 09:50',
          }
          : r
      ),
    }));
    appendAudit(
      target.organizationId,
      `ส่งมอบเสื้อ ${target.shirtSize} และ BIB ${target.bibNumber}`,
      `${target.regCode}: kit_picked_up`,
      target.eventId
    );
    void syncApi('POST', `/api/registrations/${regId}/pickup`);
    return { ok: true };
  };

  const handleConfirmMerchHandover = (
    merchOrderId: string,
    mode: 'partial_one' | 'complete_all'
  ): { ok: boolean; message: string } => {
    const ord = sys.merchOrders.find((m) => m.id === merchOrderId);
    if (!ord) return { ok: false, message: tx("ไม่พบคำสั่งซื้อสินค้า") };
    if (ord.deliveredQty >= ord.quantity) {
      return {
        ok: false,
        message: txf("ป้องกันการส่งมอบสินค้าซ้ำ: คำสั่งซื้อ {0} รับครบ {1} ชิ้นไปแล้ว", ord.merchOrderCode, ord.quantity),
      };
    }
    const nextDelivered =
      mode === 'partial_one'
        ? Math.min(ord.quantity, ord.deliveredQty + 1)
        : ord.quantity;
    const nextStatus =
      nextDelivered >= ord.quantity ? 'completed' : 'partial_received';

    setSys((prev) => ({
      ...prev,
      merchOrders: prev.merchOrders.map((m) =>
        m.id === merchOrderId
          ? {
            ...m,
            deliveredQty: nextDelivered,
            fulfillmentStatus: nextStatus,
          }
          : m
      ),
    }));
    appendAudit(
      ord.organizationId,
      `ส่งมอบสินค้าหน้าร้าน (${ord.merchOrderCode})`,
      `รับแล้ว ${nextDelivered}/${ord.quantity} ชิ้น`,
      ord.eventId
    );
    void syncApi('POST', `/api/merch-orders/${merchOrderId}/handover`, { mode });
    return {
      ok: true,
      message: txf("บันทึกส่งมอบสินค้า {0} สำเร็จ ({1}/{2} ชิ้น)", ord.merchOrderCode, nextDelivered, ord.quantity),
    };
  };

  const handleResolveRefundRequest = (
    regId: string,
    decision: 'approve_succeed' | 'reject',
    note: string
  ) => {
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return;
    setSys((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? decision === 'approve_succeed'
            ? {
              ...r,
              registrationStatus: 'cancelled',
              refundStatus: 'succeeded',
              refundedAt: '2026-11-17T09:52:00+07:00',
              snapshotRefundedSatang: r.snapshotBaseSatang,
              refundReason: `${r.refundReason ?? ''} (${note})`,
            }
            : {
              ...r,
              refundStatus: 'rejected',
              refundReason: `${r.refundReason ?? ''} (ปฏิเสธ: ${note})`,
            }
          : r
      ),
    }));
    appendAudit(
      target.organizationId,
      decision === 'approve_succeed'
        ? `อนุมัติคืนเงินคำสั่งซื้อ ${target.orderCode}`
        : `ปฏิเสธคำขอคืนเงิน ${target.orderCode}`,
      note,
      target.eventId
    );
    void syncApi('POST', `/api/registrations/${regId}/refund`, { decision, note });
  };

  const handleCreateSingleUseInvite = (
    orgId: string,
    role: OrgRole
  ): TeamInvitation => {
    const inv: TeamInvitation = {
      id: `inv-${Date.now()}`,
      inviteCode: `INV-${role.toUpperCase().slice(0, 4)}-${Math.floor(
        100 + Math.random() * 899
      )}`,
      organizationId: orgId,
      role,
      expiresAt: '2026-12-15',
    };
    setSys((prev) => ({
      ...prev,
      invitations: [inv, ...prev.invitations],
    }));
    void syncApi('POST', '/api/invitations', {
      orgId,
      role,
      id: inv.id,
      inviteCode: inv.inviteCode,
    });
    return inv;
  };

  /* ---- Platform Owner Governance Operations ---- */
  const handleReviewOrganization = (
    orgId: string,
    action:
      | 'approve_kyc_bank'
      | 'hold_bank'
      | 'suspend_org'
      | 'reinstate_org'
      | 'under_review'
      | 'request_more_info'
      | 'reject_org',
    bankSummary?: string
  ) => {
    const target = sys.organizations.find((o) => o.id === orgId);
    if (!target) return;

    const workflowMap: Record<
      typeof action,
      OrganizerVerificationWorkflowStatus
    > = {
      approve_kyc_bank: 'APPROVED',
      reinstate_org: 'APPROVED',
      hold_bank: 'MORE_INFORMATION_REQUIRED',
      suspend_org: 'SUSPENDED',
      under_review: 'UNDER_REVIEW',
      request_more_info: 'MORE_INFORMATION_REQUIRED',
      reject_org: 'REJECTED',
    };
    const nextWf = workflowMap[action];

    setSys((prev) => ({
      ...prev,
      organizations: prev.organizations.map((o) => {
        if (o.id !== orgId) return o;
        const historyEntry = {
          id: `vh-${Date.now()}`,
          status: nextWf,
          actorName: currentUser?.fullNameTh ?? 'Platform Owner',
          note: bankSummary || `เปลี่ยนสถานะเป็น ${nextWf}`,
          timestamp: '2026-11-18 09:35',
        };
        const nextHistory = [historyEntry, ...(o.verificationHistory ?? [])];

        if (action === 'approve_kyc_bank' || action === 'reinstate_org') {
          return {
            ...o,
            nameTh: o.nameTh.replace(
              /\s*\(องค์กรใหม่รอตรวจ\)|\s*\(รอตรวจสอบผู้จัด\)/g,
              ''
            ),
            verificationStatus: 'verified',
            workflowStatus: 'APPROVED',
            payoutReady: true,
            payoutBankSummary: bankSummary || o.payoutBankSummary,
            verificationHistory: nextHistory,
          };
        }
        if (
          action === 'under_review' ||
          action === 'request_more_info' ||
          action === 'hold_bank'
        ) {
          return {
            ...o,
            verificationStatus: 'pending_review',
            workflowStatus: nextWf,
            payoutReady: false,
            payoutBankSummary:
              bankSummary ||
              (action === 'under_review'
                ? 'อยู่ระหว่าง Platform Owner ตรวจสอบเอกสาร (UNDER_REVIEW)'
                : 'ขอเอกสารยืนยันตัวตน/บัญชีธนาคารเพิ่มเติม (MORE_INFORMATION_REQUIRED)'),
            verificationHistory: nextHistory,
          };
        }
        return {
          ...o,
          verificationStatus: 'suspended',
          workflowStatus: nextWf,
          payoutReady: false,
          verificationHistory: nextHistory,
        };
      }),
    }));

    appendAudit(
      orgId,
      `Platform Owner อัปเดตสถานะผู้จัด (${target.code} -> ${nextWf})`,
      bankSummary ?? target.nameTh
    );
    void syncApi('POST', `/api/admin/organizations/${orgId}/review`, {
      action,
      bankSummary,
    });
  };

  const handleGovernEventStatus = (
    eventId: string,
    nextStatus: EventStatus,
    adminNote?: string,
    postRaceLinks?: {
      resultsUrl?: string;
      albumTitle?: string;
      albumUrl?: string;
    }
  ) => {
    const target = sys.events.find((e) => e.id === eventId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) => {
        if (ev.id !== eventId) return ev;
        const nextAlbums =
          nextStatus === 'completed' && postRaceLinks?.albumTitle
            ? [
              ...(ev.verifiedPhotoAlbums ?? []),
              {
                id: `alb-adm-${Date.now()}`,
                title: postRaceLinks.albumTitle,
                photographerCredit: 'ตรวจสอบและประกาศผ่านระบบแพลตฟอร์ม',
                photoCount: 850,
                externalUrl:
                  postRaceLinks.albumUrl ??
                  `#verified-album-${ev.code.toLowerCase()}`,
              },
            ]
            : ev.verifiedPhotoAlbums;

        return {
          ...ev,
          status: nextStatus,
          statusNote: adminNote || undefined,
          officialResultsUrl:
            nextStatus === 'completed' && postRaceLinks?.resultsUrl
              ? postRaceLinks.resultsUrl
              : ev.officialResultsUrl,
          verifiedPhotoAlbums: nextAlbums,
        };
      }),
    }));

    appendAudit(
      target.organizationId,
      `ผู้ดูแลแพลตฟอร์มเปลี่ยนสถานะงาน ${target.code} (${target.status} -> ${nextStatus})`,
      adminNote || nextStatus,
      target.id
    );
    void syncApi('POST', `/api/admin/events/${eventId}/govern`, {
      nextStatus,
      adminNote,
      postRaceLinks,
    });
  };

  const handleUpdateProductionInquiry = (
    inquiryId: string,
    patch: {
      quoteStatus?: ProductionInquiry['quoteStatus'];
      productionStatus?: ProductionInquiry['productionStatus'];
      quotedTotalSatang?: number;
      adminNote?: string;
    }
  ) => {
    const target = sys.productionInquiries.find((q) => q.id === inquiryId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      productionInquiries: prev.productionInquiries.map((q) =>
        q.id === inquiryId
          ? {
            ...q,
            quoteStatus: patch.quoteStatus ?? q.quoteStatus,
            productionStatus: patch.productionStatus ?? q.productionStatus,
            quotedTotalSatang:
              patch.quotedTotalSatang !== undefined
                ? patch.quotedTotalSatang
                : q.quotedTotalSatang,
            adminNote:
              patch.adminNote !== undefined ? patch.adminNote : q.adminNote,
          }
          : q
      ),
    }));

    appendAudit(
      target.organizationId ?? 'PLATFORM-HQ',
      `อัปเดตใบเสนอราคา/การผลิต ${target.inquiryCode}`,
      `quote=${patch.quoteStatus ?? target.quoteStatus}, prod=${patch.productionStatus ?? target.productionStatus
      }`,
      target.eventId
    );
    void syncApi('PATCH', `/api/production-inquiries/${inquiryId}`, patch);
  };

  const handleUpdatePayoutBatchStatus = (
    payoutId: string,
    nextStatus: PayoutStatus
  ) => {
    const target = sys.payouts.find((p) => p.id === payoutId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      payouts: prev.payouts.map((p) =>
        p.id === payoutId ? { ...p, status: nextStatus } : p
      ),
    }));

    appendAudit(
      target.organizationId,
      `อัปเดตสถานะรอบโอนยอดนำส่ง ${target.payoutCode}`,
      `${target.status} -> ${nextStatus}`,
      target.eventId
    );
    void syncApi('PATCH', `/api/admin/payouts/${payoutId}`, { nextStatus });
  };

  const handleCreatePayoutBatch = (payload: {
    organizationId: string;
    eventId: string;
    periodLabel: string;
    scheduledDate: string;
    netPayoutSatang: number;
  }) => {
    const code = `PO-2026-${Math.floor(1200 + Math.random() * 800)}`;
    const newBatch: PayoutBatch = {
      id: `po-dyn-${Date.now()}`,
      payoutCode: code,
      organizationId: payload.organizationId,
      eventId: payload.eventId,
      periodLabel: payload.periodLabel,
      scheduledDate: payload.scheduledDate,
      grossSucceededSatang: payload.netPayoutSatang,
      deductedRefundSatang: 0,
      deductedOrganizerFeeSatang: 0,
      netPayoutSatang: payload.netPayoutSatang,
      status: 'scheduled',
    };

    setSys((prev) => ({
      ...prev,
      payouts: [newBatch, ...prev.payouts],
    }));

    appendAudit(
      payload.organizationId,
      `สร้างรอบโอนยอดนำส่งใหม่ (${code})`,
      payload.periodLabel,
      payload.eventId
    );
    void syncApi('POST', '/api/admin/payouts', {
      ...payload,
      id: newBatch.id,
      payoutCode: code,
    });
  };

  const handleAdminResolveOrForceRefund = (
    regId: string,
    decision: 'approve_succeed' | 'reject' | 'admin_force_refund',
    reason: string
  ) => {
    if (decision === 'approve_succeed' || decision === 'reject') {
      handleResolveRefundRequest(regId, decision, `[Platform Owner] ${reason}`);
      return;
    }
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? {
            ...r,
            registrationStatus: 'cancelled',
            refundStatus: 'succeeded',
            refundedAt: '2026-11-17T13:45:00+07:00',
            snapshotRefundedSatang: r.snapshotBaseSatang,
            refundReason: `[Platform Exception] ${reason}`,
          }
          : r
      ),
    }));

    appendAudit(
      target.organizationId,
      `ผู้ดูแลแพลตฟอร์มสั่งคืนเงินกรณีพิเศษ (${target.regCode})`,
      reason,
      target.eventId
    );
    void syncApi('POST', `/api/admin/registrations/${regId}/force-refund`, {
      decision,
      reason,
    });
  };

  const handleAdminUpdateUserAccess = (
    targetUserId: string,
    action:
      | { kind: 'verify_email' }
      | { kind: 'toggle_platform_admin' }
      | { kind: 'grant_org_role'; organizationId: string; role: OrgRole }
      | { kind: 'revoke_org_role'; organizationId: string }
  ) => {
    const targetUser = sys.users.find((u) => u.id === targetUserId);
    if (!targetUser) return;

    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id !== targetUserId) return u;
        if (action.kind === 'verify_email') {
          return {
            ...u,
            contactEmail: u.contactEmail ?? `${u.code.toLowerCase()}@verified.local`,
            emailVerified: true,
          };
        }
        if (action.kind === 'toggle_platform_admin') {
          return {
            ...u,
            isPlatformAdmin: !u.isPlatformAdmin,
          };
        }
        if (action.kind === 'grant_org_role') {
          const rest = u.memberships.filter(
            (m) => m.organizationId !== action.organizationId
          );
          return {
            ...u,
            memberships: [
              ...rest,
              { organizationId: action.organizationId, role: action.role },
            ],
          };
        }
        return {
          ...u,
          memberships: u.memberships.filter(
            (m) => m.organizationId !== action.organizationId
          ),
        };
      }),
    }));

    appendAudit(
      action.kind === 'grant_org_role' || action.kind === 'revoke_org_role'
        ? action.organizationId
        : 'PLATFORM-HQ',
      `ปรับสิทธิ์บัญชีผู้ใช้ ${targetUser.fullNameTh} (${targetUser.code})`,
      action.kind
    );
    void syncApi('PATCH', `/api/admin/users/${targetUserId}/access`, { action });
  };

  // Platform Owner tools live only in the separate console; on the public site the same account
  // is an ordinary runner / organizer member (the server enforces the same split)
  const isPlatformOwner = isAdminApp && Boolean(currentUser?.isPlatformAdmin);
  const hasOrganizerAccess = Boolean(
    currentUser && (currentUser.memberships.length > 0 || isPlatformOwner)
  );

  useEffect(() => {
    if (isAdminApp && surface !== 'platform_admin' && surface !== 'organizer') {
      setSurface('platform_admin');
    }
    if (!isAdminApp && surface === 'platform_admin') {
      setSurface('customer');
      setCustomerSubView('directory');
      pushUrl('/', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminApp, surface]);

  const handleAdminLogin = async (email: string, password: string): Promise<string | null> => {
    const res = await syncApi('POST', '/api/auth/login', { email, password });
    return res.ok ? null : res.error ?? tx('เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
  };
  // the name in the top bar and the account menu: English first + last name from the runner
  // profile in both languages (user request 24 Nov 2026), then the account's English name,
  // then the Thai name
  const currentUserNameEn = currentUser
    ? [currentUser.runnerProfile?.firstNameEn, currentUser.runnerProfile?.lastNameEn]
      .map((x) => (x ?? '').trim())
      .filter(Boolean)
      .join(' ') ||
    currentUser.fullNameEn ||
    currentUser.fullNameTh
    : '';
  const currentUserDisplayName = currentUserNameEn;
  const currentUserAvatarUrl = currentUser?.runnerProfile?.avatarDataUrl ?? '';
  const currentUserCompletion = currentUser
    ? evaluatePersonalInfoCompletion(currentUser)
    : null;

  const latestPrivacyAck = currentUser
    ? [...(currentUser.consents ?? [])].reverse().find((c) => c.type === 'privacy')
    : undefined;
  const accountNeedsPrivacyAck = Boolean(
    currentUser && latestPrivacyAck?.version !== PRIVACY_NOTICE_VERSION
  );
  // signed in after accepting at the navbar: store it on the account (once per version)
  const pdpaRecording = useRef(false);
  useEffect(() => {
    if (!accountNeedsPrivacyAck || !hasSessionPdpaAck() || pdpaRecording.current) return;
    pdpaRecording.current = true;
    // the sign-in request may still be on its way (no session cookie yet): retry a few times
    let cancelled = false;
    void (async () => {
      for (let attempt = 0; attempt < 5 && !cancelled; attempt += 1) {
        const res = await syncApi('POST', '/api/account/consents', {
          type: 'privacy',
          version: PRIVACY_NOTICE_VERSION,
        });
        if (res.ok) break;
        await new Promise((r) => window.setTimeout(r, 800 * (attempt + 1)));
      }
      pdpaRecording.current = false;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountNeedsPrivacyAck, currentUser?.id]);

  return (
    <div
      className={`app-root ${surface === 'organizer' || surface === 'platform_admin' ? 'is-backoffice' : 'is-public'
        } ${isPagePreviewUrl() || isFormPreviewUrl() ? 'is-embed' : ''}`}
    >
      <PrivacyNoticeModal
        open={pdpaGateOpen}
        mode="signin"
        onAccept={() => {
          rememberPdpaAck();
          setPdpaGateOpen(false);
          navigateLogin('signin');
        }}
        onCancel={() => setPdpaGateOpen(false)}
      />
      {isAdminApp && (
        <header className="global-topbar admin-topbar">
          <div className="brand-lockup">
            <span className="brand-home-btn">
              <span className="brand-rabbit-mark" aria-hidden="true" />
              <strong className="brand-name">{tx('กระต่าย')}</strong>
            </span>
            <span className="admin-topbar-tag">{tx('ศูนย์ควบคุม Platform Owner')}</span>
          </div>
          {currentUser && (
            <>
              <nav className="global-surface-nav" aria-label={tx('เมนูศูนย์ควบคุม')}>
                <button
                  type="button"
                  className={`surface-switch-btn ${surface === 'platform_admin' ? 'active' : ''}`}
                  aria-current={surface === 'platform_admin' ? 'page' : undefined}
                  onClick={() => navigatePlatformAdmin()}
                >
                  <IconShield size={15} />
                  <span>{tx('ศูนย์ควบคุม')}</span>
                </button>
                {surface === 'organizer' && (
                  <span className="surface-switch-btn active" aria-current="page">
                    <IconBuilding size={15} />
                    <span>{tx('ตรวจพื้นที่ผู้จัด')}</span>
                  </span>
                )}
              </nav>
            </>
          )}
          <div className="topbar-user-actions">
            <button
              type="button"
              className="theme-switch admin-theme-switch"
              aria-pressed={theme === 'line'}
              onClick={toggleTheme}
              title={tx('ธีม LINE (โหมดมืด สีเขียว)')}
              aria-label={tx('ธีม LINE')}
            >
              <IconSunMoon size={15} />
            </button>
            {currentUser && (
              <>
                <span className="admin-topbar-user">{currentUser.fullNameTh}</span>
                <button type="button" className="btn-ghost-sm admin-topbar-logout" onClick={handleLogout}>
                  {tx('ออกจากระบบ')}
                </button>
              </>
            )}
          </div>
        </header>
      )}

      {/* PRODUCTION ROLE-BASED TOP HEADER */}
      {!isAdminApp && (
        <header
          className="global-topbar"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowMobileMenu(false);
              setShowProfileMenu(false);
            }
          }}
        >
          <div className="brand-lockup">
            <button
              type="button"
              className="brand-home-btn"
              onClick={() => navigateCustomer('directory', null)}
            >
              <span className="brand-rabbit-mark" aria-hidden="true" />
              <strong className="brand-name">{tx('กระต่าย')}</strong>
            </button>
          </div>

          <nav className="global-surface-nav" aria-label={tx("เมนูหลักของแพลตฟอร์ม")}>
            <button
              type="button"
              className={`surface-switch-btn ${surface === 'customer' &&
                (customerSubView === 'directory' ||
                  customerSubView === 'event_detail')
                ? 'active'
                : ''
                }`}
              onClick={() => navigateCustomer('directory', null)}
            >
              <IconFlag size={15} />
              <span>{tx("ค้นหางานวิ่ง")}</span>
            </button>

            <button
              type="button"
              className={`surface-switch-btn ${surface === 'customer' && customerSubView === 'calendar'
                ? 'active'
                : ''
                }`}
              onClick={() => navigateCustomer('calendar')}
            >
              <IconCalendar size={15} />
              <span>{tx("ปฏิทินงานวิ่ง")}</span>
            </button>

            {/* VISIBLE ONLY WHEN LOGGED IN AS PLATFORM OWNER */}
            {isPlatformOwner && (
              <button
                type="button"
                className={`surface-switch-btn ${surface === 'platform_admin' ? 'active' : ''
                  }`}
                onClick={() => navigatePlatformAdmin()}
              >
                <IconShield size={15} />
                <span>{tx("จัดการแพลตฟอร์ม")}</span>
              </button>
            )}
          </nav>

          <div className="topbar-user-actions">
            <LangSwitch lang={lang} setLang={setLang} />
            <button
              type="button"
              className="theme-switch"
              aria-pressed={theme === 'line'}
              onClick={toggleTheme}
              title={tx('ธีม LINE (โหมดมืด สีเขียว)')}
              aria-label={tx('ธีม LINE')}
            >
              <IconSunMoon size={15} />
            </button>
            {!currentUser ? (
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  if (hasSessionPdpaAck()) navigateLogin('signin');
                  else setPdpaGateOpen(true);
                }}
              >
                <IconLock size={14} />
                <span>{tx("เข้าสู่ระบบ")}</span>
              </button>
            ) : (
              <div className="profile-menu-wrap" ref={profileMenuRef}>
                <button
                  type="button"
                  className={`btn-account-pill ${showProfileMenu || surface === 'account_security' || surface === 'runner_profile'
                    ? 'active'
                    : ''
                    }`}
                  aria-expanded={showProfileMenu}
                  aria-label={txf('บัญชีของ {0}', currentUserDisplayName)}
                  onClick={() => {
                    // phones and tablets (where the menu button shows and this button is just
                    // the avatar): it opens the profile page; the menu button holds the rest
                    // (27 Nov 2026, user request)
                    if (window.matchMedia('(max-width: 67.5rem)').matches) {
                      setShowProfileMenu(false);
                      setShowMobileMenu(false);
                      navigateRunnerProfile('personal');
                      return;
                    }
                    setShowMobileMenu(false);
                    setShowProfileMenu((v) => !v);
                  }}
                >
                  <span className="runner-avatar-frame xs" aria-hidden="true">
                    {currentUserAvatarUrl ? (
                      <img
                        src={currentUserAvatarUrl}
                        alt=""
                        className="runner-avatar-img"
                      />
                    ) : (
                      <DefaultAvatarImg />
                    )}
                  </span>
                  <span className="btn-account-pill-name">
                    {currentUserDisplayName}
                  </span>
                  <IconChevronDown size={14} className="btn-account-pill-chevron" />
                </button>

                {showProfileMenu && (
                  <div
                    className="profile-dropdown"
                    role="menu"
                    aria-label={tx("เมนูบัญชีผู้ใช้งาน")}
                  >
                    <div className="profile-dropdown-head">
                      <div className="runner-avatar-frame sm" aria-hidden="true">
                        {currentUserAvatarUrl ? (
                          <img
                            src={currentUserAvatarUrl}
                            alt=""
                            className="runner-avatar-img"
                          />
                        ) : (
                          <DefaultAvatarImg />
                        )}
                      </div>
                      <div className="profile-dropdown-identity">
                        <strong>{currentUserNameEn}</strong>
                        <div className="muted-inline profile-dropdown-email">
                          {currentUser.contactEmail ??
                            tx("เข้าใช้งานผ่าน LINE (ยังไม่ได้ผูกอีเมล)")}
                        </div>
                      </div>
                    </div>

                    {/* two groups: the runner's own account, then the organizer system
                        (26 Nov 2026, user request: keep them apart) */}
                    <div className="profile-menu-group" role="group" aria-labelledby="pm-runner-h">
                      <span id="pm-runner-h" className="profile-menu-group-label">{tx("บัญชีนักวิ่ง")}</span>
                      {currentUserCompletion && (
                        <button
                          type="button"
                          className={`profile-completion-status ${currentUserCompletion.isComplete
                            ? 'is-complete'
                            : 'is-warning'
                            }`}
                          onClick={() => navigateRunnerProfile('personal')}
                        >
                          <ProfileCompletionStatusText
                            isComplete={currentUserCompletion.isComplete}
                            pct={currentUserCompletion.pct}
                          />
                          <span className="profile-completion-status-meter" aria-hidden="true">
                            <span
                              style={{ width: `${currentUserCompletion.pct}%` }}
                            />
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => navigateRunnerProfile('personal')}
                      >
                        <IconUsers size={15} />
                        <span>{tx("บัญชีของฉัน")}</span>
                      </button>

                      <button
                        type="button"
                        className="profile-menu-item"
                        onClick={() => navigateCustomer('my_orders')}
                      >
                        <IconHistory size={15} />
                        <span>{tx("ประวัติการสมัคร & การสั่งซื้อ")}</span>
                      </button>
                    </div>

                    {/* organizer members (and the platform owner) reach the organizer system from here */}
                    {hasOrganizerAccess && (
                      <div className="profile-menu-group" role="group" aria-labelledby="pm-org-h">
                        <span id="pm-org-h" className="profile-menu-group-label">{tx("ระบบผู้จัดงาน")}</span>
                        <button
                          type="button"
                          className={`profile-menu-item ${surface === 'organizer' ? 'is-current' : ''}`}
                          aria-current={surface === 'organizer' ? 'page' : undefined}
                          onClick={() => navigateOrganizer()}
                        >
                          <IconSwitch size={15} />
                          <span>{tx("เข้าสู่ระบบผู้จัดงาน")}</span>
                        </button>
                        {/* the organization list was dropped (26 Nov 2026, user request); orgs are picked inside the organizer system */}
                      </div>
                    )}

                    {isPlatformOwner && (
                      <div className="profile-menu-group" role="group" aria-labelledby="pm-platform-h">
                        <span id="pm-platform-h" className="profile-menu-group-label">{tx("แพลตฟอร์ม")}</span>
                        <button
                          type="button"
                          className="profile-menu-item"
                          onClick={() => navigatePlatformAdmin()}
                        >
                          <IconShield size={15} />
                          <span>{tx("ศูนย์ควบคุม Platform Owner")}</span>
                        </button>
                      </div>
                    )}

                    <div className="profile-menu-divider" />

                    <button
                      type="button"
                      className="profile-menu-item profile-logout-btn"
                      onClick={handleLogout}
                    >
                      <IconLock size={15} />
                      <span>{tx("ออกจากระบบ")}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MOBILE HAMBURGER BUTTON (Option 1 — visible only on <= 67.5rem) */}
            <button
              type="button"
              className={`mobile-hamburger-btn ${showMobileMenu ? 'is-open' : ''}`}
              aria-expanded={showMobileMenu}
              aria-controls="mobile-primary-drawer"
              aria-label={
                showMobileMenu ? tx("ปิดเมนูนำทาง") : tx("เปิดเมนูนำทาง")
              }
              onClick={() => {
                setShowProfileMenu(false);
                setShowMobileMenu((v) => !v);
              }}
            >
              {showMobileMenu ? <IconClose size={18} /> : <IconMenu size={18} />}
            </button>
          </div>

          {/* MOBILE SLIDE-DOWN DRAWER + BACKDROP (Option 1) */}
          {showMobileMenu && (
            <>
              <button
                type="button"
                className="mobile-nav-backdrop"
                aria-label={tx("ปิดเมนูนำทาง")}
                tabIndex={-1}
                onClick={() => setShowMobileMenu(false)}
              />
              <div
                id="mobile-primary-drawer"
                className="mobile-nav-drawer"
                role="dialog"
                aria-label={tx("เมนูหลักของแพลตฟอร์ม")}
              >
                {/* who is signed in, with the profile meter (the account menu's head, which
                    phones no longer open separately) */}
                {currentUser && (
                  <div className="mobile-drawer-account">
                    <div className="profile-dropdown-head">
                      <div className="runner-avatar-frame sm" aria-hidden="true">
                        {currentUserAvatarUrl ? (
                          <img src={currentUserAvatarUrl} alt="" className="runner-avatar-img" />
                        ) : (
                          <DefaultAvatarImg />
                        )}
                      </div>
                      <div className="profile-dropdown-identity">
                        <strong>{currentUserNameEn}</strong>
                        <div className="muted-inline profile-dropdown-email">
                          {currentUser.contactEmail ?? tx("เข้าใช้งานผ่าน LINE (ยังไม่ได้ผูกอีเมล)")}
                        </div>
                      </div>
                    </div>
                    {currentUserCompletion && (
                      <button
                        type="button"
                        className={`profile-completion-status ${currentUserCompletion.isComplete ? 'is-complete' : 'is-warning'}`}
                        onClick={() => navigateRunnerProfile('personal')}
                      >
                        <ProfileCompletionStatusText
                          isComplete={currentUserCompletion.isComplete}
                          pct={currentUserCompletion.pct}
                        />
                        <span className="profile-completion-status-meter" aria-hidden="true">
                          <span style={{ width: `${currentUserCompletion.pct}%` }} />
                        </span>
                      </button>
                    )}
                  </div>
                )}
                <nav className="mobile-drawer-links" aria-label={tx("เมนูหลักของแพลตฟอร์ม")}>
                  <button
                    type="button"
                    className={`mobile-drawer-link ${surface === 'customer' &&
                        (customerSubView === 'directory' ||
                          customerSubView === 'event_detail')
                        ? 'active'
                        : ''
                      }`}
                    onClick={() => navigateCustomer('directory', null)}
                  >
                    <span className="mobile-drawer-link-label">
                      <IconFlag size={16} />
                      <span>{tx("ค้นหางานวิ่ง")}</span>
                    </span>
                    {surface === 'customer' &&
                      (customerSubView === 'directory' ||
                        customerSubView === 'event_detail') && (
                        <span className="mobile-drawer-dot" aria-hidden="true" />
                      )}
                  </button>

                  <button
                    type="button"
                    className={`mobile-drawer-link ${surface === 'customer' && customerSubView === 'calendar'
                        ? 'active'
                        : ''
                      }`}
                    onClick={() => navigateCustomer('calendar')}
                  >
                    <span className="mobile-drawer-link-label">
                      <IconCalendar size={16} />
                      <span>{tx("ปฏิทินงานวิ่ง")}</span>
                    </span>
                    {surface === 'customer' && customerSubView === 'calendar' && (
                      <span className="mobile-drawer-dot" aria-hidden="true" />
                    )}
                  </button>

                  {currentUser && (
                    <>
                      <span className="mobile-drawer-group-label">{tx("บัญชีนักวิ่ง")}</span>
                      <button
                        type="button"
                        className={`mobile-drawer-link ${surface === 'runner_profile' ? 'active' : ''
                          }`}
                        onClick={() => navigateRunnerProfile('personal')}
                      >
                        <span className="mobile-drawer-link-label">
                          <IconUsers size={16} />
                          <span>{tx("บัญชีของฉัน")}</span>
                        </span>
                        {surface === 'runner_profile' && (
                          <span className="mobile-drawer-dot" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        className={`mobile-drawer-link ${surface === 'customer' && customerSubView === 'my_orders' ? 'active' : ''
                          }`}
                        onClick={() => navigateCustomer('my_orders')}
                      >
                        <span className="mobile-drawer-link-label">
                          <IconHistory size={16} />
                          <span>{tx("ประวัติการสมัคร & การสั่งซื้อ")}</span>
                        </span>
                        {surface === 'customer' && customerSubView === 'my_orders' && (
                          <span className="mobile-drawer-dot" aria-hidden="true" />
                        )}
                      </button>

                      {/* "ตั้งค่าบัญชี" removed here too, as in the desktop account menu (25 Nov 2026) */}
                    </>
                  )}

                  {hasOrganizerAccess && (
                    <>
                    <span className="mobile-drawer-group-label">{tx("ระบบผู้จัดงาน")}</span>
                    <button
                      type="button"
                      className={`mobile-drawer-link ${surface === 'organizer' ? 'active' : ''
                        }`}
                      onClick={() => navigateOrganizer()}
                    >
                      <span className="mobile-drawer-link-label">
                        <IconSwitch size={16} />
                        <span>{tx("เข้าสู่ระบบผู้จัดงาน")}</span>
                      </span>
                      {surface === 'organizer' && (
                        <span className="mobile-drawer-dot" aria-hidden="true" />
                      )}
                    </button>
                    </>
                  )}

                  {isPlatformOwner && (
                    <>
                    <span className="mobile-drawer-group-label">{tx("แพลตฟอร์ม")}</span>
                    <button
                      type="button"
                      className={`mobile-drawer-link ${surface === 'platform_admin' ? 'active' : ''
                        }`}
                      onClick={() => navigatePlatformAdmin()}
                    >
                      <span className="mobile-drawer-link-label">
                        <IconShield size={16} />
                        <span>{tx("จัดการแพลตฟอร์ม")}</span>
                      </span>
                      {surface === 'platform_admin' && (
                        <span className="mobile-drawer-dot" aria-hidden="true" />
                      )}
                    </button>
                    </>
                  )}
                </nav>

                <div className="mobile-drawer-footer">
                  <LangSwitch lang={lang} setLang={setLang} />
                  {/* same round switch as the desktop bar (26 Nov 2026, user request) */}
                  <button
                    type="button"
                    className="theme-switch"
                    aria-pressed={theme === 'line'}
                    onClick={toggleTheme}
                    title={tx('ธีม LINE (โหมดมืด สีเขียว)')}
                    aria-label={tx('ธีม LINE')}
                  >
                    <IconSunMoon size={15} />
                  </button>

                  {currentUser ? (
                    <button
                      type="button"
                      className="mobile-drawer-logout-btn"
                      onClick={handleLogout}
                    >
                      <IconLock size={14} />
                      <span>{tx("ออกจากระบบ")}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="auth-register-cta-link"
                      onClick={() => navigateLogin('signup')}
                    >
                      <span>{tx("สมัครสมาชิกใหม่ (Register)")}</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </header>
      )}

      {/* console: sign in first */}
      {isAdminApp && !currentUser ? (
        apiBootstrapped ? <AdminLogin onSubmit={handleAdminLogin} /> : null
      ) : (
        <>
          {/* ACTIVE SURFACE */}
          {surface === 'customer' && (
            <CustomerPortalView
              souvenirLayout={sandboxTools ? devSouvenirLayout : 'accordion'}
              subView={customerSubView}
              selectedEventId={selectedPublicEventId}
              initialEventTab={initialEventTab}
              events={sys.events}
              organizations={sys.organizations}
              registrations={sys.registrations}
              merchOrders={sys.merchOrders}
              platformProfileConfig={
                sys.platformProfileConfig ?? DEFAULT_PLATFORM_PROFILE_CONFIG
              }
              currentUser={currentUser}
              onNavigate={navigateCustomer}
              onRequireLoginWithIntent={(intent) => {
                setReturnIntent(intent);
                navigateLogin('signin');
              }}
              onOpenAccountSecurity={navigateAccountSecurity}
              onOpenRunnerProfile={() => navigateRunnerProfile('personal')}
              onSaveProfilePatch={(patch) => handleSaveRunnerProfile(patch)}
              onOpenOrganizerDashboard={(orgId, evId) =>
                navigateOrganizer(orgId, evId)
              }
              onCreateRegistrationAndOptionalAddon={
                handleCreateRegistrationAndAddon
              }
              onCheckoutMerchCart={handleCheckoutMerchCart}
              onPayHeldRegistration={handlePayHeldRegistration}
              onCancelHeldRegistration={handleCancelHeldRegistration}
            />
          )}

          {surface === 'auth' && (
            <AuthScreen
              users={sys.users}
              returnIntent={returnIntent}
              initialTab={authInitialTab}
              onAuthenticated={handleAuthenticated}
              sandboxAuthEnabled={sandboxTools}
              onPasswordLogin={handlePasswordLogin}
              onRegisterEmailUser={handleRegisterEmailUser}
              onRegisterSocialUser={handleRegisterSocialUser}
              onSubmitOrganizerOnboarding={handleSubmitOrganizerOnboarding}
              onNavigateExploreEvents={() => navigateCustomer('directory', null)}
              onNavigateRunnerDashboard={() => navigateRunnerProfile('personal')}
              onNavigateOrganizerWorkspace={(orgId) =>
                navigateOrganizer(orgId, null)
              }
            />
          )}

          {(surface === 'runner_profile' || surface === 'account_security') &&
            currentUser && (
              <RunnerProfileView
                user={currentUser}
                events={sys.events}
                registrations={sys.registrations}
                organizations={sys.organizations}
                invitations={sys.invitations}
                platformProfileConfig={
                  sys.platformProfileConfig ?? DEFAULT_PLATFORM_PROFILE_CONFIG
                }
                initialTab={
                  surface === 'account_security' ? 'security' : profileInitialTab
                }
                onSaveProfile={handleSaveRunnerProfile}
                onOpenEmailVerifyPage={(email) => {
                  setPendingVerifyEmail(email);
                  setProfileInitialTab('security');
                  setSurface('verify_email');
                  pushUrl(`/verify-email?email=${encodeURIComponent(email)}`);
                }}
                onSaveContactEmail={handleSaveContactEmail}
                verifiedEmailNotice={verifiedEmailNotice}
                onClearVerifiedEmailNotice={() => setVerifiedEmailNotice(null)}
                onSetOrChangePassword={handleSetOrChangePassword}
                onRequestPasswordCode={handleRequestPasswordCode}
                onVerifyPasswordCode={handleVerifyPasswordCode}
                onLinkProvider={handleLinkProvider}
                onUnlinkProvider={handleUnlinkProvider}
                onRevokeOtherSessions={handleRevokeOtherSessions}
                onRevokeSession={handleRevokeSession}
                onSetMarketingConsent={handleSetMarketingConsent}
                onAcceptTeamInvitation={handleAcceptTeamInvitation}
                onApplyNewOrganizerOrg={handleApplyNewOrganizerOrg}
                onEnterOrganizerOrg={(orgId) => navigateOrganizer(orgId, null)}
                onManageAccountStatus={handleManageAccountStatus}
                onNavigateDiscoverEvents={() => navigateCustomer('directory', null)}
                onNavigateEventDetail={(eventId) =>
                  navigateCustomer('event_detail', eventId, 'info_results')
                }
                onPersonalDirtyChange={handlePersonalDirtyChange}
                discardSignal={personalDiscardSeq}
              />
            )}

          {FEATURES.emailVerification && surface === 'verify_email' && currentUser && (
            <EmailOtpVerifyView
              targetEmail={pendingVerifyEmail || currentUser.contactEmail || ''}
              onVerifyEmailWithOtp={handleVerifyEmailWithOtp}
              onVerifiedSuccess={(verifiedEmail) => {
                setVerifiedEmailNotice(verifiedEmail);
                setProfileInitialTab('security');
                setSurface('runner_profile');
                pushUrl('/profile');
              }}
              onBackToSecurity={() => {
                setProfileInitialTab('security');
                setSurface('runner_profile');
                pushUrl('/profile');
              }}
            />
          )}

          {surface === 'organizer' &&
            currentUser &&
            (hasOrganizerAccess ? (
              <OrganizerDashboardView
                currentUser={currentUser}
                organizations={sys.organizations}
                invitations={sys.invitations}
                teamMembers={sys.users
                  .filter((u) => u.memberships.some((m) => m.organizationId === activeOrgId))
                  .map((u) => {
                    const m = u.memberships.find((x) => x.organizationId === activeOrgId)!;
                    return { id: u.id, name: u.fullNameTh, role: m.role, assignedEventIds: m.assignedEventIds, lastLoginAt: u.lastLoginAt };
                  })}
                activeOrgId={activeOrgId}
                activeEventId={activeEventId}
                activeSection={activeOrgSection}
                events={sys.events}
                registrations={sys.registrations}
                merchOrders={sys.merchOrders}
                productionInquiries={sys.productionInquiries}
                payouts={sys.payouts}
                auditLogs={sys.auditLogs}
                simulatedState={simulatedState}
                onClearSimulatedState={() => setSimulatedState('normal')}
                onSelectOrg={(orgId) => {
                  setActiveOrgId(orgId);
                  setActiveEventId(null);
                  setActiveOrgSection('org_overview');
                }}
                onSelectEvent={(evId, targetSec) => {
                  setActiveEventId(evId);
                  if (targetSec) {
                    setActiveOrgSection(targetSec);
                  } else if (!evId) {
                    setActiveOrgSection('org_overview');
                  }
                }}
                onSelectSection={setActiveOrgSection}
                onCreateDraftEvent={handleCreateDraftEvent}
                onDuplicateEventWithoutPii={handleDuplicateEventWithoutPii}
                onCompleteDraftReadinessAndSubmit={
                  handleCompleteDraftReadinessAndSubmit
                }
                onUpdateFeeBearerPolicy={handleUpdateFeeBearerPolicy}
                onAddEventProduct={handleAddEventProduct}
                onCreateEventProductionQuote={handleCreateEventProductionQuote}
                onAssignBibNumber={handleAssignBibNumber}
                onConfirmKitPickup={handleConfirmKitPickup}
                onConfirmMerchHandover={handleConfirmMerchHandover}
                onResolveRefundRequest={handleResolveRefundRequest}
                onCreateSingleUseInvite={handleCreateSingleUseInvite}
                onOpenPublicPreview={(evId) => {
                  if (evId) {
                    navigateCustomer('event_detail', evId, 'register');
                  } else {
                    navigateCustomer('directory', null);
                  }
                }}
                onUpdateEventTotalQuota={handleUpdateEventTotalQuota}
                onToggleEventTotalQuota={handleToggleEventTotalQuota}
                onUpdateEventKitShipping={async (eventId, feeSatang) => {
                  const res = await syncApi('PATCH', `/api/events/${eventId}`, { kitShippingFeeSatang: feeSatang });
                  return { ok: res.ok, error: res.error };
                }}
                onUpdateCategoryQuota={handleUpdateCategoryQuota}
                onUpdateCategoryAgeRules={handleUpdateCategoryAgeRules}
                onSavePageContent={handleSavePageContent}
                onSaveRegistrationForm={handleSaveRegistrationForm}
                onUpdateEventMedia={handleUpdateEventMedia}
                platformProfileConfig={
                  sys.platformProfileConfig ?? DEFAULT_PLATFORM_PROFILE_CONFIG
                }
                onUpdateEventShirtConfig={handleUpdateEventShirtConfig}
              />
            ) : (
              <main className="customer-container">
                <div className="empty-state-box">
                  <div className="cta-inline-row" style={{ marginBottom: '0.45rem' }}>
                    <span className="status-pill badge-danger">
                      <IconAlert size={14} />
                      <span>{tx("ไม่มีสิทธิ์เข้าถึง (403 Forbidden)")}</span>
                    </span>
                  </div>
                  <h1>{tx("บัญชีนี้ยังไม่ได้สังกัดองค์กรผู้จัดงานวิ่ง")}</h1>
                  <p>
                    {tx("ระบบผู้จัดงานจำกัดเฉพาะสมาชิกที่ได้รับสิทธิ์ในองค์กรผู้จัด (")}
                    <code>OrganizationMembership</code>{tx(") เท่านั้น หากคุณได้รับรหัสคำเชิญเข้าทีม หรือต้องการยื่นขอเปิดองค์กรผู้จัดงานใหม่ สามารถดำเนินการต่อได้ที่หน้าบัญชีและความปลอดภัย")}
                  </p>
                  <div className="cta-inline-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigateRunnerProfile('organizer')}
                    >
                      <IconBuilding size={15} />
                      <span>{tx("ขอเปิดองค์กรผู้จัดใหม่ / กรอกรหัสคำเชิญ")}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => navigateCustomer('directory', null)}
                    >
                      <span>{tx("กลับหน้าค้นหางานวิ่ง")}</span>
                    </button>
                  </div>
                </div>
              </main>
            ))}

          {surface === 'platform_admin' &&
            currentUser &&
            (isPlatformOwner ? (
              <PlatformAdminView
                currentUser={currentUser}
                activeSection={activePlatformSection}
                onSelectSection={setActivePlatformSection}
                organizations={sys.organizations}
                events={sys.events}
                registrations={sys.registrations}
                merchOrders={sys.merchOrders}
                productionInquiries={sys.productionInquiries}
                payouts={sys.payouts}
                users={sys.users}
                auditLogs={sys.auditLogs}
                formTemplates={sys.formTemplates}
                registrationSteps={sys.registrationSteps}
                globalFields={sys.globalFields}
                conditionalRules={sys.conditionalRules}
                fieldRequests={sys.fieldRequests}
                platformProfileConfig={
                  sys.platformProfileConfig ?? DEFAULT_PLATFORM_PROFILE_CONFIG
                }
                onUpdatePlatformProfileConfig={handleUpdatePlatformProfileConfig}
                onUpsertStep={handleUpsertStep}
                onReorderStep={handleReorderStep}
                onDeleteStep={handleDeleteStep}
                onUpsertGlobalField={handleUpsertGlobalField}
                onAddConditionalRule={handleAddConditionalRule}
                onDeleteConditionalRule={handleDeleteConditionalRule}
                onPublishTemplateVersion={handlePublishTemplateVersion}
                onCreateTemplate={handleCreateTemplate}
                onResolveFieldRequest={handleResolveFieldRequest}
                onReviewOrganization={handleReviewOrganization}
                onGovernEventStatus={handleGovernEventStatus}
                onUpdateProductionInquiry={handleUpdateProductionInquiry}
                onUpdatePayoutBatchStatus={handleUpdatePayoutBatchStatus}
                onCreatePayoutBatch={handleCreatePayoutBatch}
                onAdminResolveOrForceRefund={handleAdminResolveOrForceRefund}
                onAdminUpdateUserAccess={handleAdminUpdateUserAccess}
                onOpenPublicEvent={(evId) =>
                  isAdminApp
                    ? window.open(`${publicSiteOrigin()}/events/${evId}`, '_blank', 'noopener')
                    : navigateCustomer('event_detail', evId, 'register')
                }
                onInspectOrganizerWorkspace={(orgId, evId) =>
                  navigateOrganizer(orgId, evId)
                }
              />
            ) : (
              <main className="customer-container">
                <div className="empty-state-box">
                  <div className="cta-inline-row" style={{ marginBottom: '0.45rem' }}>
                    <span className="status-pill badge-danger">
                      <IconAlert size={14} />
                      <span>{tx("ไม่มีสิทธิ์เข้าถึงส่วนกลางแพลตฟอร์ม (403 Forbidden)")}</span>
                    </span>
                  </div>
                  <h1>{tx("หน้านี้จำกัดเฉพาะผู้ดูแลระบบสูงสุดของแพลตฟอร์ม (Platform Owner)")}</h1>
                  <p>
                    {tx("บัญชีผู้จัดงานและลูกค้าทั่วไปไม่สามารถเข้าถึงศูนย์อนุมัติกลางของ กระต่าย ได้")}
                  </p>
                  <div className="cta-inline-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => navigateCustomer('directory', null)}
                    >
                      <span>{tx("กลับหน้าค้นหางานวิ่ง")}</span>
                    </button>
                  </div>
                </div>
              </main>
            ))}

        </>
      )}

      {/* Production Minimal Footer with Organizer Onboarding Link + Honest Prototype Notice */}
      <footer className="minimal-footer">
        <div className="footer-links-group">
          <span>
            <strong>{tx('กระต่าย')}</strong> {tx(" · แพลตฟอร์มงานวิ่งและร้านค้าที่ระลึกประจำงาน")}
          </span>
          {hasOrganizerAccess && !isAdminApp && (
            <button
              type="button"
              className="footer-text-link"
              onClick={() => navigateOrganizer()}
            >
              {tx("เข้าสู่ระบบบริหารผู้จัดงาน")}
            </button>
          )}
        </div>
      </footer>

      {!apiBootstrapped && bootIsSlow && (
        <MascotLoader fullscreen message={tx('กำลังเตรียมข้อมูลงานวิ่ง…')} />
      )}

      {/* COLLAPSIBLE FLOATING DEV / DEMO SWITCHER BAR (SEPARATED FROM PRODUCTION UI) */}
      {/* Hidden when the server runs without sandbox tools (production) and in the console */}
      {sandboxTools && !isAdminApp && (
        <aside
          ref={devDockRef}
          className="dev-demo-dock"
          aria-label={tx("แถบเครื่องมือสำหรับผู้พัฒนาและสลับบัญชีสาธิต")}
        >
          {showDemoTools && (
            /* Dev / Demo tools redesign (27 Nov 2026, user request): plain wording, who you are
               now on top, then four numbered parts: switch user, this page's layout, try a
               situation, reset data */
            <div className="dev-demo-drawer" role="dialog" aria-labelledby="dev-tools-title">
              <div className="dev-drawer-head">
                <div>
                  <strong id="dev-tools-title" className="dev-drawer-title">Dev / Demo</strong>
                  <div className="dev-drawer-sub">{tx("ใช้ตอนพัฒนาเท่านั้น เว็บจริงไม่มีแถบนี้")}</div>
                </div>
                <button
                  type="button"
                  className="dev-icon-btn"
                  aria-label={tx("ปิด Dev / Demo")}
                  onClick={() => setShowDemoTools(false)}
                >
                  <IconClose size={16} />
                </button>
              </div>

              {(() => {
                const now = currentUser ? devRoleOf(currentUser) : null;
                return (
                  <div className="dev-now">
                    {now ? <now.Icon size={20} /> : <IconEye size={20} />}
                    <div>
                      <span className="dev-now-label">{tx("ตอนนี้ใช้งานเป็น")}</span>
                      <strong>
                        {now ? `${tx(now.title)} · ${tx(currentUser!.fullNameTh.split(' ')[0])}` : tx("ผู้เยี่ยมชม (ยังไม่เข้าสู่ระบบ)")}
                      </strong>
                    </div>
                  </div>
                );
              })()}

              <section className="dev-drawer-section" aria-labelledby="dev-sec-user">
                <h3 id="dev-sec-user" className="dev-sec-title">
                  <IconUsers size={15} /> {tx("เปลี่ยนคนที่ใช้งาน")}
                </h3>
                <p className="dev-sec-help">{tx("กดแล้วเข้าระบบเป็นคนนั้นทันที ไม่ต้องใส่รหัส")}</p>
                <button
                  type="button"
                  className={`dev-row ${!currentUser ? 'active' : ''}`}
                  aria-current={!currentUser ? 'true' : undefined}
                  onClick={() => {
                    handleLogout();
                    setShowDemoTools(false);
                  }}
                >
                  <IconEye size={18} />
                  <span className="dev-row-copy">
                    <strong>{tx("ผู้เยี่ยมชม")}</strong>
                    <span>{tx("ยังไม่เข้าสู่ระบบ")}</span>
                  </span>
                  {!currentUser && <IconCheckCircle size={16} />}
                </button>
                {sys.users
                  .filter((u) => u.isDemoPreset)
                  .map((u) => ({ u, r: devRoleOf(u) }))
                  .sort((x, y) => x.r.order - y.r.order)
                  .map(({ u, r }) => {
                    const isCur = currentUser?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        className={`dev-row ${isCur ? 'active' : ''}`}
                        aria-current={isCur ? 'true' : undefined}
                        onClick={() => {
                          handleAuthenticated(u, u.memberships[0]?.organizationId);
                          setShowDemoTools(false);
                        }}
                      >
                        <r.Icon size={18} />
                        <span className="dev-row-copy">
                          <strong>{tx(r.title)}</strong>
                          <span>{r.sub}</span>
                        </span>
                        {isCur ? <IconCheckCircle size={16} /> : <IconArrowRight size={14} />}
                      </button>
                    );
                  })}
              </section>

              {/* Dev / Demo keeps three parts only (27 Nov 2026, user request): test users, the
                  entry form's template, reset */}
              <section className="dev-drawer-section" aria-labelledby="dev-sec-page">
                <h3 id="dev-sec-page" className="dev-sec-title">
                  <IconSliders size={15} /> {tx("หน้าตาฟอร์มสมัคร")}
                </h3>
                <p className="dev-sec-help">{tx("สลับแล้วหน้าเดิมยังอยู่ ข้อมูลที่กรอกไม่หาย")}</p>
                {/* switching keeps the form on its step with everything picked (27 Nov 2026) */}
                <div className="dev-field">
                  <span id="dev-sv-layout" className="dev-field-label">{tx("ขั้นของที่ระลึก")}</span>
                  <div className="dev-seg is-three" role="radiogroup" aria-labelledby="dev-sv-layout">
                    {(
                      [
                        ['accordion', 'พับตามหมวด'],
                        ['shelves', 'เปิดทุกหมวด'],
                        ['classic', 'แบบแรก'],
                      ] as const
                    ).map(([l, label]) => (
                      <button
                        key={l}
                        type="button"
                        role="radio"
                        aria-checked={devSouvenirLayout === l}
                        className={devSouvenirLayout === l ? 'is-on' : ''}
                        onClick={() => pickDevSouvenirLayout(l)}
                      >
                        {tx(label)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="dev-drawer-section is-danger" aria-labelledby="dev-sec-reset">
                <h3 id="dev-sec-reset" className="dev-sec-title">
                  <IconAlert size={15} /> {tx("ล้างข้อมูล")}
                </h3>
                <p className="dev-sec-help">{tx("ล้างข้อมูลทดสอบของทุกคนกลับเป็นค่าเริ่มต้น ย้อนกลับไม่ได้")}</p>
                <button
                  type="button"
                  className="dev-reset-btn"
                  onClick={() => {
                    if (window.confirm(tx("ล้างข้อมูลทดสอบของทุกคนกลับเป็นค่าเริ่มต้น? ย้อนกลับไม่ได้"))) {
                      handleResetAllDemoData();
                    }
                  }}
                >
                  {tx("รีเซ็ตข้อมูลทั้งหมด…")}
                </button>
              </section>
            </div>
          )}
          <button
            type="button"
            className="dev-dock-pill"
            aria-expanded={showDemoTools}
            onClick={() => setShowDemoTools((v) => !v)}
          >
            <IconSliders size={15} />
            {/* just the name (27 Nov 2026, user request: "Dev / Demo"); who you are is inside */}
            <span>Dev / Demo</span>
          </button>
        </aside>
      )}
    </div>
  );
};
