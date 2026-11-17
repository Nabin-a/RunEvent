import React, { useEffect, useState } from 'react';
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
  PLATFORM_OWNER_USER,
} from './data/mockData';
import {
  AuditLogEntry,
  AuthProviderType,
  CustomRegistrationField,
  EventProduct,
  EventStatus,
  FeeBearerPolicy,
  MerchOrderRecord,
  Organization,
  OrgRole,
  PayoutBatch,
  PayoutStatus,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  ReturnIntent,
  SellerServiceModel,
  SimulatedUiState,
  TeamInvitation,
  UserAccount,
} from './types';
import { calculateFeeQuote, getCurrentTier } from './utils/pricing';
import { cloneCustomFieldsSchema } from './utils/eventConfig';
import { AccountSecurityView, AuthScreen } from './components/AuthViews';
import {
  CustomerPortalView,
  CustomerSubView,
} from './components/CustomerPortalView';
import {
  IconAlert,
  IconArrowRight,
  IconBag,
  IconBib,
  IconBuilding,
  IconCheckCircle,
  IconFlag,
  IconLock,
  IconShield,
  IconShirt,
  IconSliders,
  IconSwitch,
  IconUsers,
} from './components/Icons';
import {
  OrganizerDashboardView,
  OrgSection,
} from './components/OrganizerDashboardView';
import {
  PlatformAdminView,
  PlatformSection,
} from './components/PlatformAdminView';

type RootSurface =
  | 'customer'
  | 'organizer'
  | 'platform_admin'
  | 'auth'
  | 'account_security';

const STORAGE_KEY = 'runevent_v2_mock_system';
const SESSION_USER_KEY = 'runevent_v2_session_user_id';

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
  };
}

function normalizeCategoryDistanceCode(code: string, distanceKm: number): string {
  if (/km/i.test(code)) return code;
  const replaced = code.replace(/(\d+(?:\.\d+)?)K\b/i, '$1 km').replace(/\s+Trail$/i, '').trim();
  if (/km/i.test(replaced)) return replaced;
  return `${distanceKm} km`;
}

function loadSystemState(): PersistedSystemState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedSystemState;
      if (
        Array.isArray(parsed.users) &&
        Array.isArray(parsed.events) &&
        Array.isArray(parsed.registrations)
      ) {
        const hasPlatformOwner = parsed.users.some(
          (u) => u.id === PLATFORM_OWNER_USER.id || u.isPlatformAdmin
        );
        const migratedUsers = hasPlatformOwner
          ? parsed.users
          : [PLATFORM_OWNER_USER, ...parsed.users];
        const hasClubRfq = (parsed.productionInquiries ?? []).some(
          (q) => q.id === 'pinq-02'
        );
        const migratedInquiries = hasClubRfq
          ? parsed.productionInquiries
          : [
              ...(parsed.productionInquiries ?? []),
              ...INITIAL_PRODUCTION_INQUIRIES.filter((q) => q.id === 'pinq-02'),
            ];

        return {
          ...parsed,
          users: migratedUsers,
          payouts: Array.isArray(parsed.payouts)
            ? parsed.payouts
            : INITIAL_PAYOUTS,
          productionInquiries: migratedInquiries,
          events: parsed.events.map((ev) => ({
            ...ev,
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
          registrations: parsed.registrations.map((reg) => {
            if (reg.customAnswers !== undefined) return reg;
            if (reg.id === 'reg-01') {
              return {
                ...reg,
                customAnswers: {
                  cf_medical: 'แพ้ยาแอสไพริน',
                  cf_club: 'Chiang Mai Morning Miles',
                  cf_blood: 'O',
                },
              };
            }
            if (reg.id === 'reg-02') {
              return {
                ...reg,
                customAnswers: {
                  cf_medical: 'ไม่มี',
                  cf_club: 'Lanna Road Runners',
                  cf_blood: 'B',
                },
              };
            }
            return reg;
          }),
        };
      }
    }
  } catch {
    // Fallback to initial state if storage unavailable
  }
  return createDefaultState();
}

function loadInitialSessionUserId(): string | null {
  try {
    const saved = window.localStorage.getItem(SESSION_USER_KEY);
    return saved ? saved : null;
  } catch {
    return null;
  }
}

interface ParsedUrlRoute {
  surface: RootSurface;
  customerSubView: CustomerSubView;
  eventSlug: string | null;
  eventTab: 'register' | 'storefront' | 'info_results';
  authTab: 'signin' | 'signup' | 'forgot';
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
  if (cleanPath === '/account/security') {
    return {
      surface: 'account_security',
      customerSubView: 'directory',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
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
  if (cleanPath === '/custom-production') {
    return {
      surface: 'customer',
      customerSubView: 'custom_production',
      eventSlug: null,
      eventTab: 'register',
      authTab: 'signin',
    };
  }
  if (cleanPath.startsWith('/events/')) {
    const parts = cleanPath.split('/').filter(Boolean);
    const slug = parts[1] ?? null;
    const sub = parts[2] ?? '';
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

function findEventBySlug(events: RaceEvent[], slug: string | null): RaceEvent | null {
  if (!slug) return null;
  const lower = slug.toLowerCase();
  return (
    events.find(
      (e) => e.code.toLowerCase() === lower || e.id.toLowerCase() === lower
    ) ?? null
  );
}

export const App: React.FC = () => {
  const [sys, setSys] = useState<PersistedSystemState>(loadSystemState);

  const initialParsed = parseUrlRoute(
    window.location.pathname,
    window.location.search
  );
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

  // Default first-time visitor is Guest (null), persisted across refreshes
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    loadInitialSessionUserId
  );
  const [returnIntent, setReturnIntent] = useState<ReturnIntent | null>(null);

  const [activeOrgId, setActiveOrgId] = useState<string>('org-lanna');
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [activeOrgSection, setActiveOrgSection] =
    useState<OrgSection>('org_overview');
  const [activePlatformSection, setActivePlatformSection] =
    useState<PlatformSection>('plat_overview');
  const [simulatedState, setSimulatedState] =
    useState<SimulatedUiState>('normal');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDemoTools, setShowDemoTools] = useState(false);
  const [externalSocialScenario, setExternalSocialScenario] = useState<{
    seq: number;
    provider: 'google' | 'line';
    scenario: 'new_no_email' | 'collision' | 'cancelled';
  } | null>(null);

  const pushUrl = (url: string, replace = false) => {
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
  };

  useEffect(() => {
    const onPopState = () => {
      applyRouteStateFromUrl(window.location.pathname, window.location.search);
      setShowProfileMenu(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sys.events]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sys));
    } catch {
      // Ignore storage quota limits
    }
  }, [sys]);

  useEffect(() => {
    try {
      if (currentUserId) {
        window.localStorage.setItem(SESSION_USER_KEY, currentUserId);
      } else {
        window.localStorage.removeItem(SESSION_USER_KEY);
      }
    } catch {
      // Ignore storage quota limits
    }
  }, [currentUserId]);

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
          label: 'ดูบัตรวิ่งและคำสั่งซื้อของฉัน',
        });
        setAuthInitialTab('signin');
        setSurface('auth');
        pushUrl('/login', true);
      }
    }
  }, [currentUser, surface, customerSubView]);

  const navigateCustomer = (
    view: CustomerSubView,
    evId?: string | null,
    tab?: 'register' | 'storefront' | 'info_results'
  ) => {
    setShowProfileMenu(false);
    if (view === 'my_orders' && !currentUser) {
      setReturnIntent({
        surface: 'my_orders',
        label: 'ดูบัตรวิ่งและคำสั่งซื้อของฉัน',
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
    } else if (view === 'custom_production') {
      pushUrl('/custom-production');
    } else if (view === 'my_orders') {
      pushUrl('/my-orders');
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
  };

  const navigateLogin = (mode: 'signin' | 'signup' | 'forgot' = 'signin') => {
    setShowProfileMenu(false);
    setAuthInitialTab(mode);
    setSurface('auth');
    pushUrl(mode === 'signin' ? '/login' : `/login?mode=${mode}`);
  };

  const navigateAccountSecurity = () => {
    setShowProfileMenu(false);
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
  };

  const navigateOrganizer = (orgId?: string, evId?: string | null) => {
    setShowProfileMenu(false);
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
  };

  const navigatePlatformAdmin = (sec?: PlatformSection) => {
    setShowProfileMenu(false);
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
  };

  const handleLogout = () => {
    setCurrentUserId(null);
    setShowProfileMenu(false);
    setReturnIntent(null);
    if (
      surface === 'platform_admin' ||
      surface === 'organizer' ||
      surface === 'account_security' ||
      (surface === 'customer' && customerSubView === 'my_orders')
    ) {
      setSurface('customer');
      setCustomerSubView('directory');
      pushUrl('/');
    }
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

  const handleAuthenticated = (user: UserAccount, preferredOrgId?: string) => {
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
        const suffix =
          tab === 'storefront'
            ? '/shop'
            : tab === 'info_results'
              ? '/results'
              : '';
        setSelectedPublicEventId(intent.eventId);
        setInitialEventTab(tab);
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
      if (intent.surface === 'custom_production') {
        setCustomerSubView('custom_production');
        setSurface('customer');
        pushUrl('/custom-production');
        return;
      }
      if (intent.surface === 'account_security') {
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
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(SESSION_USER_KEY);
    setSys(createDefaultState());
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
    email: string;
    marketingConsent: boolean;
  }) => {
    const exists = sys.users.some(
      (u) =>
        (u.contactEmail ?? '').toLowerCase() === payload.email.toLowerCase()
    );
    if (exists) {
      return {
        ok: false,
        error:
          'ไม่สามารถใช้ช่องทางนี้สร้างบัญชีซ้ำได้ กรุณาเข้าสู่ระบบด้วยบัญชีเดิมหรือกดลืมรหัสผ่าน',
      };
    }
    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      code: `USR-${sys.users.length + 910}`,
      fullNameTh: payload.fullNameTh,
      fullNameEn: payload.fullNameTh,
      contactEmail: payload.email,
      emailVerified: false, // Must verify email before race registration
      hasPassword: true,
      identities: [
        {
          id: `id-pw-${Date.now()}`,
          provider: 'password',
          providerSubject: payload.email.toLowerCase(),
          providerEmail: payload.email.toLowerCase(),
          linkedAt: '2026-11-17 09:45',
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
      demoRoleSummary: 'สมาชิกใหม่สมัครด้วยอีเมล',
      isDemoPreset: false,
    };
    setSys((prev) => ({ ...prev, users: [...prev.users, newUser] }));
    return { ok: true, user: newUser };
  };

  const handleRegisterSocialUser = (payload: {
    provider: 'google' | 'line';
    fullNameTh: string;
    email: string | null;
    marketingConsent: boolean;
  }): UserAccount => {
    const newUser: UserAccount = {
      id: `usr-soc-${Date.now()}`,
      code: `USR-${sys.users.length + 920}`,
      fullNameTh: payload.fullNameTh,
      fullNameEn: payload.fullNameTh,
      contactEmail: payload.email,
      emailVerified: Boolean(payload.email),
      hasPassword: false,
      identities: [
        {
          id: `id-soc-${Date.now()}`,
          provider: payload.provider,
          providerSubject: `${payload.provider}-uid-${Date.now()}`,
          providerEmail: payload.email ?? undefined,
          linkedAt: '2026-11-17 09:45',
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
    return newUser;
  };

  const handleVerifyContactEmail = (email: string) => {
    if (!currentUser) return;
    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? { ...u, contactEmail: email, emailVerified: true }
          : u
      ),
    }));
  };

  const handleSetOrChangePassword = () => {
    if (!currentUser) return;
    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) => {
        if (u.id !== currentUser.id) return u;
        const hasPwIdentity = u.identities.some(
          (i) => i.provider === 'password'
        );
        return {
          ...u,
          hasPassword: true,
          identities: hasPwIdentity
            ? u.identities
            : [
              ...u.identities,
              {
                id: `id-pw-${Date.now()}`,
                provider: 'password',
                providerSubject: u.contactEmail ?? u.code,
                linkedAt: '2026-11-17 09:46',
              },
            ],
        };
      }),
    }));
  };

  const handleLinkProvider = (provider: 'google' | 'line') => {
    if (!currentUser) return;
    setSys((prev) => ({
      ...prev,
      users: prev.users.map((u) =>
        u.id === currentUser.id
          ? {
            ...u,
            identities: [
              ...u.identities,
              {
                id: `id-${provider}-${Date.now()}`,
                provider,
                providerSubject: `${provider}-linked-${Date.now()}`,
                linkedAt: '2026-11-17 09:46',
              },
            ],
          }
          : u
      ),
    }));
  };

  const handleUnlinkProvider = (
    provider: AuthProviderType
  ): { ok: boolean; error?: string } => {
    if (!currentUser) return { ok: false, error: 'ไม่พบบัญชีผู้ใช้' };
    if (currentUser.identities.length <= 1) {
      return {
        ok: false,
        error:
          'ไม่อนุญาตให้ถอดช่องทางเข้าสู่ระบบช่องทางสุดท้าย กรุณาเพิ่มรหัสผ่านหรือเชื่อมช่องทางอื่นทดแทนก่อน',
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
  };

  const handleAcceptTeamInvitation = (
    code: string
  ): { ok: boolean; message: string } => {
    if (!currentUser) return { ok: false, message: 'กรุณาเข้าสู่ระบบก่อน' };
    const inv = sys.invitations.find(
      (i) => i.inviteCode.toUpperCase() === code.toUpperCase()
    );
    if (!inv) {
      return { ok: false, message: 'ไม่พบรหัสคำเชิญนี้ในระบบ' };
    }
    if (inv.usedByUserId) {
      return {
        ok: false,
        message: 'รหัสคำเชิญนี้ถูกใช้งานไปแล้ว (คำเชิญทีมจำกัดการใช้เพียงครั้งเดียว)',
      };
    }
    const alreadyInOrg = currentUser.memberships.some(
      (m) => m.organizationId === inv.organizationId
    );
    if (alreadyInOrg) {
      return {
        ok: false,
        message: 'บัญชีของคุณเป็นสมาชิกขององค์กรนี้อยู่แล้ว',
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
    return {
      ok: true,
      message: `เข้าร่วมทีม ${org?.nameTh ?? inv.organizationId} ในบทบาท ${roleTh} สำเร็จ!`,
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
    return newOrg;
  };

  /* ---- Customer & Runner Operations ---- */
  const handleCreateRegistrationAndAddon = (payload: {
    eventId: string;
    categoryId: string;
    buyerName: string;
    participantNameTh: string;
    participantNameEn: string;
    shirtSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL';
    marketingConsent: boolean;
    simulateImmediateWebhook: boolean;
    addonProduct?: EventProduct | null;
    addonSize?: string;
    customAnswers?: Record<string, string | boolean>;
  }) => {
    const ev = sys.events.find((e) => e.id === payload.eventId)!;
    const cat = ev.categories.find((c) => c.id === payload.categoryId)!;
    const tier = getCurrentTier(cat);
    const quote = calculateFeeQuote(tier.priceSatang, ev.feeBearerPolicy);

    const seq = sys.registrations.length + 101;
    const regCode = `REG-2611-${seq}`;
    const orderCode = `ORD-89${seq}`;
    const tokenSuffix = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    const newReg: RegistrationRecord = {
      id: `reg-dyn-${Date.now()}`,
      regCode,
      orderCode,
      eventId: ev.id,
      organizationId: ev.organizationId,
      categoryId: cat.id,
      runnerUserId: currentUser?.id,
      buyerName: payload.buyerName,
      participantNameTh: payload.participantNameTh,
      participantNameEn: payload.participantNameEn,
      email: currentUser?.contactEmail ?? 'verified.runner@demo.local',
      phoneMasked: '081-•••-9900',
      emergencyContact: 'ผู้ติดต่อฉุกเฉินจำลอง 089-•••-0011',
      shirtSize: payload.shirtSize,
      customAnswers: payload.customAnswers,
      bibNumber: null,
      qrCheckInToken: `TKN-${cat.bibPrefix}${seq}-${tokenSuffix}`,
      acceptedRulesVersion: ev.rulesVersion,
      marketingConsent: payload.marketingConsent,
      createdAt: '2026-11-17T09:45:00+07:00',
      paidAt: payload.simulateImmediateWebhook
        ? '2026-11-17T09:45:05+07:00'
        : null,
      refundedAt: null,
      reservationExpiresAt: payload.simulateImmediateWebhook
        ? null
        : '2026-11-17T10:00:00+07:00',
      registrationStatus: payload.simulateImmediateWebhook
        ? 'confirmed'
        : 'pending_payment',
      paymentStatus: payload.simulateImmediateWebhook ? 'succeeded' : 'pending',
      refundStatus: 'none',
      fulfillmentStatus: payload.simulateImmediateWebhook
        ? 'ready'
        : 'not_ready',
      snapshotBaseSatang: quote.baseSatang,
      snapshotPlatformFeeSatang: quote.platformFeeSatang,
      snapshotRunnerFeeSatang: quote.runnerFeeSatang,
      snapshotOrganizerFeeSatang: quote.organizerFeeSatang,
      snapshotTotalChargedSatang: quote.runnerNetPaySatang,
      snapshotRefundedSatang: 0,
    };

    let addonOrder: MerchOrderRecord | undefined;
    if (payload.addonProduct) {
      const mSeq = sys.merchOrders.length + 510;
      addonOrder = {
        id: `mord-dyn-${Date.now()}`,
        merchOrderCode: `SHP-2611-${mSeq}`,
        eventId: ev.id,
        organizationId: ev.organizationId,
        buyerUserId: currentUser?.id,
        buyerName: payload.buyerName,
        buyerEmail: currentUser?.contactEmail ?? 'ติดต่อผ่านบัญชีผู้ใช้',
        productId: payload.addonProduct.id,
        productNameTh: payload.addonProduct.nameTh,
        sellerLabel: payload.addonProduct.sellerLabel,
        variantSize: payload.addonSize ?? 'M',
        quantity: 1,
        deliveredQty: 0,
        deliveryMethod: 'pickup_at_expo',
        unitPriceSatang: payload.addonProduct.priceSatang,
        shippingSatang: 0,
        totalPaidSatang: payload.addonProduct.priceSatang,
        paymentStatus: payload.simulateImmediateWebhook
          ? 'succeeded'
          : 'pending',
        fulfillmentStatus: 'ready_or_shipped',
        pickupToken: `PICK-SHP-${mSeq}`,
        linkedRegistrationCode: regCode,
        createdAt: '2026-11-17T09:45:05+07:00',
      };
    }

    setSys((prev) => ({
      ...prev,
      events: prev.events.map((item) =>
        item.id === ev.id
          ? {
            ...item,
            shirtStocks: item.shirtStocks.map((st) =>
              st.size === payload.shirtSize
                ? { ...st, reservedOrConfirmed: st.reservedOrConfirmed + 1 }
                : st
            ),
            products: payload.addonProduct
              ? item.products.map((p) =>
                p.id === payload.addonProduct!.id
                  ? { ...p, soldCount: p.soldCount + 1 }
                  : p
              )
              : item.products,
          }
          : item
      ),
      registrations: [newReg, ...prev.registrations],
      merchOrders: addonOrder
        ? [addonOrder, ...prev.merchOrders]
        : prev.merchOrders,
    }));

    appendAudit(
      ev.organizationId,
      `สมัครวิ่งรายการใหม่ (${regCode})${addonOrder ? ` พร้อมซื้อสินค้าเพิ่ม (${addonOrder.merchOrderCode})` : ''
      }`,
      `${cat.code} · เสื้อ ${payload.shirtSize}`,
      ev.id
    );

    return { reg: newReg, addonOrder };
  };

  const handleCreateStandaloneMerchOrder = (payload: {
    eventId: string;
    product: EventProduct;
    variantSize: string;
    quantity: number;
    buyerName: string;
    deliveryMethod: 'pickup_at_expo' | 'postal_shipping';
    shippingAddress?: string;
    linkedRegistrationCode?: string;
  }): MerchOrderRecord => {
    const ev = sys.events.find((e) => e.id === payload.eventId)!;
    const mSeq = sys.merchOrders.length + 520;
    const shipFee =
      payload.deliveryMethod === 'postal_shipping'
        ? payload.product.shippingFeeSatang
        : 0;

    const newOrder: MerchOrderRecord = {
      id: `mord-${Date.now()}`,
      merchOrderCode: `SHP-2611-${mSeq}`,
      eventId: ev.id,
      organizationId: ev.organizationId,
      buyerUserId: currentUser?.id,
      buyerName: payload.buyerName,
      buyerEmail: currentUser?.contactEmail ?? 'บัญชี LINE (ไม่มีอีเมล)',
      productId: payload.product.id,
      productNameTh: payload.product.nameTh,
      sellerLabel: payload.product.sellerLabel,
      variantSize: payload.variantSize,
      quantity: payload.quantity,
      deliveredQty: 0,
      deliveryMethod: payload.deliveryMethod,
      shippingAddress: payload.shippingAddress,
      unitPriceSatang: payload.product.priceSatang,
      shippingSatang: shipFee,
      totalPaidSatang: payload.product.priceSatang * payload.quantity + shipFee,
      paymentStatus: 'succeeded',
      fulfillmentStatus:
        payload.deliveryMethod === 'pickup_at_expo'
          ? 'ready_or_shipped'
          : 'preparing',
      pickupToken: `PICK-SHP-${mSeq}`,
      linkedRegistrationCode: payload.linkedRegistrationCode,
      createdAt: '2026-11-17T09:46:00+07:00',
    };

    setSys((prev) => ({
      ...prev,
      merchOrders: [newOrder, ...prev.merchOrders],
      events: prev.events.map((e) =>
        e.id === ev.id
          ? {
            ...e,
            products: e.products.map((p) =>
              p.id === payload.product.id
                ? { ...p, soldCount: p.soldCount + payload.quantity }
                : p
            ),
          }
          : e
      ),
    }));

    appendAudit(
      ev.organizationId,
      `คำสั่งซื้อสินค้าหน้าร้าน (${newOrder.merchOrderCode})`,
      `${payload.product.nameTh} × ${payload.quantity} (ไม่เกิดใบสมัครวิ่ง)`,
      ev.id
    );

    return newOrder;
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
  };

  const handleUpdateCustomFields = (
    eventId: string,
    nextFields: CustomRegistrationField[]
  ) => {
    const target = sys.events.find((e) => e.id === eventId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      events: prev.events.map((ev) =>
        ev.id === eventId ? { ...ev, customFields: nextFields } : ev
      ),
    }));

    appendAudit(
      target.organizationId,
      `อัปเดตคำถามเพิ่มเติมในใบสมัครงาน ${target.code}`,
      `จำนวนคำถามทั้งหมด ${nextFields.length} ข้อ`,
      target.id
    );
  };

  const handleUpdateRunnerShirtSize = (
    regId: string,
    newSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL'
  ) => {
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target || target.shirtSize === newSize) return;
    const oldSize = target.shirtSize;

    setSys((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId ? { ...r, shirtSize: newSize } : r
      ),
      events: prev.events.map((ev) =>
        ev.id === target.eventId
          ? {
            ...ev,
            shirtStocks: ev.shirtStocks.map((st) => {
              if (st.size === oldSize) {
                return {
                  ...st,
                  reservedOrConfirmed: Math.max(
                    0,
                    st.reservedOrConfirmed - 1
                  ),
                };
              }
              if (st.size === newSize) {
                return {
                  ...st,
                  reservedOrConfirmed: st.reservedOrConfirmed + 1,
                };
              }
              return st;
            }),
          }
          : ev
      ),
    }));

    appendAudit(
      target.organizationId,
      `แก้ไขขนาดเสื้อตามสิทธิ์สมัคร (${target.regCode})`,
      `${oldSize} -> ${newSize}`,
      target.eventId
    );
  };

  const handleCreateClubProductionInquiry = (payload: {
    requesterName: string;
    requesterContact: string;
    itemType: ProductionInquiry['itemType'];
    estimatedQty: number;
    targetDeliveryDate: string;
  }): ProductionInquiry => {
    const rfq: ProductionInquiry = {
      id: `rfq-club-${Date.now()}`,
      inquiryCode: `RFQ-CLB-${sys.productionInquiries.length + 11}`,
      requesterName: payload.requesterName,
      requesterContact: payload.requesterContact,
      contextType: 'club_or_company',
      itemType: payload.itemType,
      serviceModel: 'produce_bulk',
      packageEntitlementQty: 0,
      addonStoreQty: 0,
      organizerBufferQty: payload.estimatedQty,
      existingStockDeductedQty: 0,
      netQtyToProduce: payload.estimatedQty,
      artworkVersion: 'รอส่งไฟล์แบบให้ทีมงานตรวจ',
      targetDeliveryDate: payload.targetDeliveryDate,
      quoteStatus: 'submitted',
      productionStatus: 'awaiting_approval',
      createdAt: '2026-11-17 09:47',
    };
    setSys((prev) => ({
      ...prev,
      productionInquiries: [rfq, ...prev.productionInquiries],
    }));
    return rfq;
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
          fixTargetHint: 'กดปุ่มเติมข้อมูลจำลองด้านล่างเพื่อส่งตรวจเปิดขาย',
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
        artworkVersion: 'ขอคำปรึกษาออกแบบจากทีม RunEvent',
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
        payload.serviceModel === 'runevent_full_service'
          ? 'ดูแลพรีออเดอร์และจัดส่งโดย RunEvent (จำลอง)'
          : 'ผู้ขาย: องค์กรผู้จัดงาน (จำลอง)',
      fulfillmentOwnerLabel:
        payload.serviceModel === 'runevent_full_service'
          ? 'RunEvent ผลิตและจัดส่ง'
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
  };

  const handleAssignBibNumber = (
    regId: string,
    bibNumber: string
  ): { ok: boolean; error?: string } => {
    const trimmed = bibNumber.trim().toUpperCase();
    if (!trimmed) return { ok: false, error: 'กรุณาระบุเลข BIB' };
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return { ok: false, error: 'ไม่พบใบสมัคร' };

    const dup = sys.registrations.find(
      (r) =>
        r.eventId === target.eventId &&
        r.id !== regId &&
        (r.bibNumber ?? '').toUpperCase() === trimmed
    );
    if (dup) {
      return {
        ok: false,
        error: `เลข BIB "${trimmed}" ซ้ำกับผู้สมัคร ${dup.participantNameTh} (${dup.regCode}) ในงานเดียวกัน!`,
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
    return { ok: true };
  };

  const handleConfirmKitPickup = (
    regId: string
  ): { ok: boolean; error?: string } => {
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return { ok: false, error: 'ไม่พบใบสมัคร' };
    if (target.fulfillmentStatus === 'kit_picked_up') {
      return {
        ok: false,
        error: `ป้องกันการรับซ้ำ: ${target.participantNameTh} รับเสื้อและ BIB ไปแล้วโดย ${target.fulfillmentUpdatedBy} เมื่อ ${target.fulfillmentUpdatedAt}`,
      };
    }
    if (!target.bibNumber) {
      return { ok: false, error: 'กรุณากำหนดเลข BIB ก่อนส่งมอบอุปกรณ์' };
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
    return { ok: true };
  };

  const handleConfirmMerchHandover = (
    merchOrderId: string,
    mode: 'partial_one' | 'complete_all'
  ): { ok: boolean; message: string } => {
    const ord = sys.merchOrders.find((m) => m.id === merchOrderId);
    if (!ord) return { ok: false, message: 'ไม่พบคำสั่งซื้อสินค้า' };
    if (ord.deliveredQty >= ord.quantity) {
      return {
        ok: false,
        message: `ป้องกันการส่งมอบสินค้าซ้ำ: คำสั่งซื้อ ${ord.merchOrderCode} รับครบ ${ord.quantity} ชิ้นไปแล้ว`,
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
    return {
      ok: true,
      message: `บันทึกส่งมอบสินค้า ${ord.merchOrderCode} สำเร็จ (${nextDelivered}/${ord.quantity} ชิ้น)`,
    };
  };

  const handleSimulateWebhookConfirm = (regId: string) => {
    const target = sys.registrations.find((r) => r.id === regId);
    if (!target) return;
    setSys((prev) => ({
      ...prev,
      registrations: prev.registrations.map((r) =>
        r.id === regId
          ? {
            ...r,
            registrationStatus: 'confirmed',
            paymentStatus: 'succeeded',
            fulfillmentStatus: 'ready',
            paidAt: '2026-11-17T09:50:00+07:00',
            reservationExpiresAt: null,
          }
          : r
      ),
    }));
    appendAudit(
      target.organizationId,
      `ยืนยันผล Webhook รับเงินสำเร็จ (${target.orderCode})`,
      `${target.regCode}: confirmed`,
      target.eventId
    );
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
    return inv;
  };

  /* ---- Platform Owner Governance Operations ---- */
  const handleReviewOrganization = (
    orgId: string,
    action: 'approve_kyc_bank' | 'hold_bank' | 'suspend_org' | 'reinstate_org',
    bankSummary?: string
  ) => {
    const target = sys.organizations.find((o) => o.id === orgId);
    if (!target) return;

    setSys((prev) => ({
      ...prev,
      organizations: prev.organizations.map((o) => {
        if (o.id !== orgId) return o;
        if (action === 'approve_kyc_bank' || action === 'reinstate_org') {
          return {
            ...o,
            nameTh: o.nameTh.replace(/\s*\(องค์กรใหม่รอตรวจ\)|\s*\(รอตรวจสอบผู้จัด\)/g, ''),
            verificationStatus: 'verified',
            payoutReady: true,
            payoutBankSummary:
              bankSummary || o.payoutBankSummary,
          };
        }
        if (action === 'hold_bank') {
          return {
            ...o,
            payoutReady: false,
            payoutBankSummary: 'พักความพร้อมบัญชีรับเงินชั่วคราวโดยผู้ดูแลแพลตฟอร์ม',
          };
        }
        return {
          ...o,
          verificationStatus: 'suspended',
          payoutReady: false,
        };
      }),
    }));

    appendAudit(
      orgId,
      action === 'approve_kyc_bank'
        ? `อนุมัติองค์กรผู้จัดและบัญชีรับเงิน (${target.code})`
        : action === 'reinstate_org'
        ? `ปลดระงับองค์กรผู้จัด (${target.code})`
        : action === 'hold_bank'
        ? `สั่งพักสถานะบัญชีรับเงินขององค์กร (${target.code})`
        : `สั่งระงับองค์กรผู้จัดชั่วคราว (${target.code})`,
      bankSummary ?? target.nameTh
    );
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
      `quote=${patch.quoteStatus ?? target.quoteStatus}, prod=${
        patch.productionStatus ?? target.productionStatus
      }`,
      target.eventId
    );
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
  };

  const isPlatformOwner = Boolean(currentUser?.isPlatformAdmin);
  const hasOrganizerAccess = Boolean(
    currentUser && (currentUser.memberships.length > 0 || currentUser.isPlatformAdmin)
  );
  const pendingWebhookRegs = sys.registrations.filter(
    (r) => r.registrationStatus === 'pending_payment'
  );

  return (
    <div className="app-root">
      {/* PRODUCTION ROLE-BASED TOP HEADER */}
      <header className="global-topbar">
        <div className="brand-lockup">
          <button
            type="button"
            className="brand-home-btn"
            onClick={() => navigateCustomer('directory', null)}
          >
            <span className="brand-bib-mark" aria-hidden="true">
              <IconBib size={17} />
            </span>
            <strong className="brand-name">RunEvent</strong>
          </button>
        </div>

        <nav className="global-surface-nav" aria-label="เมนูหลักของแพลตฟอร์ม">
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
            <span>ค้นหางานวิ่ง</span>
          </button>

          <button
            type="button"
            className={`surface-switch-btn ${surface === 'customer' && customerSubView === 'custom_production'
              ? 'active'
              : ''
              }`}
            onClick={() => navigateCustomer('custom_production')}
          >
            <IconShirt size={15} />
            <span>สั่งผลิตเสื้อ/เหรียญ</span>
          </button>

          <button
            type="button"
            className={`surface-switch-btn ${surface === 'customer' && customerSubView === 'my_orders'
              ? 'active'
              : ''
              }`}
            onClick={() => navigateCustomer('my_orders')}
          >
            <IconBag size={15} />
            <span>บัตรวิ่ง & คำสั่งซื้อ</span>
          </button>

          {/* VISIBLE ONLY WHEN LOGGED IN AS AN ORGANIZER MEMBER (OR PLATFORM ADMIN) */}
          {hasOrganizerAccess && (
            <button
              type="button"
              className={`surface-switch-btn ${surface === 'organizer' ? 'active' : ''
                }`}
              onClick={() => navigateOrganizer()}
            >
              <IconBuilding size={15} />
              <span>ระบบผู้จัดงาน</span>
            </button>
          )}

          {/* VISIBLE ONLY WHEN LOGGED IN AS PLATFORM OWNER */}
          {isPlatformOwner && (
            <button
              type="button"
              className={`surface-switch-btn ${
                surface === 'platform_admin' ? 'active' : ''
              }`}
              onClick={() => navigatePlatformAdmin()}
            >
              <IconShield size={15} />
              <span>จัดการแพลตฟอร์ม</span>
            </button>
          )}
        </nav>

        <div className="topbar-user-actions">
          {!currentUser ? (
            <>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigateLogin('signup')}
              >
                <span>สมัครสมาชิก</span>
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => navigateLogin('signin')}
              >
                <IconLock size={14} />
                <span>เข้าสู่ระบบ</span>
              </button>
            </>
          ) : (
            <div className="profile-menu-wrap">
              <button
                type="button"
                className={`btn-account-pill ${showProfileMenu || surface === 'account_security'
                  ? 'active'
                  : ''
                  }`}
                aria-expanded={showProfileMenu}
                onClick={() => setShowProfileMenu((v) => !v)}
              >
                {hasOrganizerAccess ? (
                  <IconShield size={15} />
                ) : (
                  <IconUsers size={15} />
                )}
                <span>{currentUser.fullNameTh}</span>
              </button>

              {showProfileMenu && (
                <div
                  className="profile-dropdown"
                  role="menu"
                  aria-label="เมนูบัญชีผู้ใช้งาน"
                >
                  <div className="profile-dropdown-head">
                    <strong>{currentUser.fullNameTh}</strong>
                    <div className="muted-inline">
                      {currentUser.contactEmail ??
                        'เข้าใช้งานผ่าน LINE (ยังไม่ได้ผูกอีเมล)'}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={() => navigateCustomer('my_orders')}
                  >
                    <IconBag size={15} />
                    <span>บัตรวิ่ง & คำสั่งซื้อของฉัน</span>
                  </button>

                  <button
                    type="button"
                    className="profile-menu-item"
                    onClick={navigateAccountSecurity}
                  >
                    <IconShield size={15} />
                    <span>บัญชีและความปลอดภัย</span>
                  </button>

                  {isPlatformOwner && (
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => navigatePlatformAdmin()}
                    >
                      <IconShield size={15} />
                      <span>ศูนย์ควบคุม Platform Owner</span>
                    </button>
                  )}

                  {hasOrganizerAccess ? (
                    <div className="profile-org-section">
                      <span className="muted-inline">องค์กรผู้จัดที่คุณสังกัด:</span>
                      {currentUser.memberships.map((m) => {
                        const org = sys.organizations.find(
                          (o) => o.id === m.organizationId
                        );
                        return (
                          <button
                            key={m.organizationId}
                            type="button"
                            className="profile-menu-item"
                            onClick={() => navigateOrganizer(m.organizationId)}
                          >
                            <IconBuilding size={15} />
                            <span>{org?.nameTh ?? m.organizationId}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={navigateAccountSecurity}
                    >
                      <IconBuilding size={15} />
                      <span>ร่วมเป็นผู้จัดงาน / กรอกรหัสคำเชิญ</span>
                    </button>
                  )}

                  <div className="profile-menu-divider" />

                  <button
                    type="button"
                    className="profile-menu-item profile-logout-btn"
                    onClick={handleLogout}
                  >
                    <IconLock size={15} />
                    <span>ออกจากระบบ</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ACTIVE SURFACE */}
      {surface === 'customer' && (
        <CustomerPortalView
          subView={customerSubView}
          selectedEventId={selectedPublicEventId}
          initialEventTab={initialEventTab}
          events={sys.events}
          organizations={sys.organizations}
          registrations={sys.registrations}
          merchOrders={sys.merchOrders}
          productionInquiries={sys.productionInquiries}
          currentUser={currentUser}
          onNavigate={navigateCustomer}
          onRequireLoginWithIntent={(intent) => {
            setReturnIntent(intent);
            navigateLogin('signin');
          }}
          onOpenAccountSecurity={navigateAccountSecurity}
          onOpenOrganizerDashboard={(orgId, evId) =>
            navigateOrganizer(orgId, evId)
          }
          onCreateRegistrationAndOptionalAddon={
            handleCreateRegistrationAndAddon
          }
          onCreateStandaloneMerchOrder={handleCreateStandaloneMerchOrder}
          onUpdateRunnerShirtSize={handleUpdateRunnerShirtSize}
          onCompletePendingPayment={handleSimulateWebhookConfirm}
          onCreateClubProductionInquiry={handleCreateClubProductionInquiry}
        />
      )}

      {surface === 'auth' && (
        <AuthScreen
          users={sys.users}
          currentUser={currentUser}
          returnIntent={returnIntent}
          initialTab={authInitialTab}
          externalSocialScenario={externalSocialScenario}
          onAuthenticated={handleAuthenticated}
          onRegisterEmailUser={handleRegisterEmailUser}
          onRegisterSocialUser={handleRegisterSocialUser}
          onLogout={handleLogout}
        />
      )}

      {surface === 'account_security' && currentUser && (
        <AccountSecurityView
          user={currentUser}
          organizations={sys.organizations}
          invitations={sys.invitations}
          onVerifyContactEmail={handleVerifyContactEmail}
          onSetOrChangePassword={handleSetOrChangePassword}
          onLinkProvider={handleLinkProvider}
          onUnlinkProvider={handleUnlinkProvider}
          onRevokeOtherSessions={handleRevokeOtherSessions}
          onAcceptTeamInvitation={handleAcceptTeamInvitation}
          onApplyNewOrganizerOrg={handleApplyNewOrganizerOrg}
          onEnterOrganizerOrg={(orgId) => navigateOrganizer(orgId, null)}
        />
      )}

      {surface === 'organizer' &&
        currentUser &&
        (hasOrganizerAccess ? (
          <OrganizerDashboardView
            currentUser={currentUser}
            organizations={sys.organizations}
            invitations={sys.invitations}
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
            onUpdateCategoryQuota={handleUpdateCategoryQuota}
            onUpdateCustomFields={handleUpdateCustomFields}
          />
        ) : (
          <main className="customer-container">
            <div className="empty-state-box">
              <div className="cta-inline-row" style={{ marginBottom: '0.45rem' }}>
                <span className="status-pill badge-danger">
                  <IconAlert size={14} />
                  <span>ไม่มีสิทธิ์เข้าถึง (403 Forbidden)</span>
                </span>
              </div>
              <h1>บัญชีนี้ยังไม่ได้สังกัดองค์กรผู้จัดงานวิ่ง</h1>
              <p>
                ระบบผู้จัดงานจำกัดเฉพาะสมาชิกที่ได้รับสิทธิ์ในองค์กรผู้จัด (
                <code>OrganizationMembership</code>) เท่านั้น
                หากคุณได้รับรหัสคำเชิญเข้าทีม หรือต้องการยื่นขอเปิดองค์กรผู้จัดงานใหม่
                สามารถดำเนินการต่อได้ที่หน้าบัญชีและความปลอดภัย
              </p>
              <div className="cta-inline-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={navigateAccountSecurity}
                >
                  <IconBuilding size={15} />
                  <span>ขอเปิดองค์กรผู้จัดใหม่ / กรอกรหัสคำเชิญ</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => navigateCustomer('directory', null)}
                >
                  <span>กลับหน้าค้นหางานวิ่ง</span>
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
            onReviewOrganization={handleReviewOrganization}
            onGovernEventStatus={handleGovernEventStatus}
            onUpdateProductionInquiry={handleUpdateProductionInquiry}
            onUpdatePayoutBatchStatus={handleUpdatePayoutBatchStatus}
            onCreatePayoutBatch={handleCreatePayoutBatch}
            onAdminResolveOrForceRefund={handleAdminResolveOrForceRefund}
            onAdminUpdateUserAccess={handleAdminUpdateUserAccess}
            onOpenPublicEvent={(evId) =>
              navigateCustomer('event_detail', evId, 'register')
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
                  <span>ไม่มีสิทธิ์เข้าถึงส่วนกลางแพลตฟอร์ม (403 Forbidden)</span>
                </span>
              </div>
              <h1>หน้านี้จำกัดเฉพาะผู้ดูแลระบบสูงสุดของแพลตฟอร์ม (Platform Owner)</h1>
              <p>
                บัญชีผู้จัดงานและลูกค้าทั่วไปไม่สามารถเข้าถึงศูนย์อนุมัติกลางของ RunEvent ได้
              </p>
              <div className="cta-inline-row">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigateCustomer('directory', null)}
                >
                  <span>กลับหน้าค้นหางานวิ่ง</span>
                </button>
              </div>
            </div>
          </main>
        ))}

      {/* Production Minimal Footer with Organizer Onboarding Link + Honest Prototype Notice */}
      <footer className="minimal-footer">
        <div className="footer-links-group">
          <span>
            <strong>RunEvent</strong> · แพลตฟอร์มงานวิ่งและร้านค้าที่ระลึกประจำงาน
          </span>
          <button
            type="button"
            className="footer-text-link"
            onClick={() => {
              if (hasOrganizerAccess) {
                navigateOrganizer();
              } else {
                navigateAccountSecurity();
              }
            }}
          >
            สำหรับผู้จัดงาน / เปิดรับสมัครงานวิ่งกับเรา
          </button>
        </div>
        <span className="muted-inline">
          โหมดต้นแบบฝั่งหน้าบ้าน (SPA + localStorage) · ข้อมูลสาธิต · ไม่มีการตัดเงินจริง
        </span>
      </footer>

      {/* COLLAPSIBLE FLOATING DEV / DEMO SWITCHER BAR (SEPARATED FROM PRODUCTION UI) */}
      <aside
        className="dev-demo-dock"
        aria-label="แถบเครื่องมือสำหรับผู้พัฒนาและสลับบัญชีสาธิต"
      >
        {showDemoTools && (
          <div className="dev-demo-drawer">
            <div className="dev-drawer-head">
              <div>
                <strong>Dev / Demo Tools</strong>
                <div className="muted-inline">
                  แยกออกจากเมนูเว็บจริงเพื่อทดสอบทุกบทบาทได้ทันที
                </div>
              </div>
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => setShowDemoTools(false)}
              >
                พับเก็บ
              </button>
            </div>

            <div className="dev-drawer-section">
              <div className="dev-section-label">
                สลับสถานะผู้ใช้ทดสอบ (ตรวจการแสดง/ซ่อนเมนูผู้จัดงาน)
              </div>
              <button
                type="button"
                className={`dev-persona-btn ${!currentUser ? 'active' : ''}`}
                onClick={() => {
                  handleLogout();
                  setShowDemoTools(false);
                }}
              >
                <span>ผู้เยี่ยมชมทั่วไป (Guest · ยังไม่ Login)</span>
                <span className="mono-code">Guest</span>
              </button>

              {sys.users
                .filter((u) => u.isDemoPreset)
                .map((u) => {
                  const isCur = currentUser?.id === u.id;
                  const isOrg = u.memberships.length > 0;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={`dev-persona-btn ${isCur ? 'active' : ''}`}
                      onClick={() => {
                        handleAuthenticated(
                          u,
                          u.memberships[0]?.organizationId
                        );
                        setShowDemoTools(false);
                      }}
                    >
                      <div>
                        <strong>{u.fullNameTh}</strong>
                        <div className="muted-inline">
                          {u.isPlatformAdmin
                            ? 'Platform Owner · อนุมัติผู้จัด/งานวิ่ง/รอบโอนทั้งระบบ'
                            : isOrg
                            ? `ทีมผู้จัด (${u.memberships.length} องค์กร) · เห็นเมนูผู้จัด`
                            : 'ลูกค้า/นักวิ่งทั่วไป · ไม่เห็นเมนูผู้จัด'}
                        </div>
                      </div>
                      <IconArrowRight size={14} />
                    </button>
                  );
                })}
            </div>

            <div className="dev-drawer-section">
              <div className="dev-section-label">
                จำลองเคสพิเศษหน้า Login (ตามแผนข้อ 16)
              </div>
              <div className="cta-inline-row">
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    navigateLogin('signin');
                    setExternalSocialScenario((prev) => ({
                      seq: (prev?.seq ?? 0) + 1,
                      provider: 'line',
                      scenario: 'new_no_email',
                    }));
                    setShowDemoTools(false);
                  }}
                >
                  LINE ไม่มีอีเมล
                </button>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    navigateLogin('signin');
                    setExternalSocialScenario((prev) => ({
                      seq: (prev?.seq ?? 0) + 1,
                      provider: 'google',
                      scenario: 'collision',
                    }));
                    setShowDemoTools(false);
                  }}
                >
                  อีเมลชนบัญชีเดิม
                </button>
                <button
                  type="button"
                  className="btn-ghost-sm"
                  onClick={() => {
                    navigateLogin('signin');
                    setExternalSocialScenario((prev) => ({
                      seq: (prev?.seq ?? 0) + 1,
                      provider: 'line',
                      scenario: 'cancelled',
                    }));
                    setShowDemoTools(false);
                  }}
                >
                  ยกเลิกที่ Provider
                </button>
              </div>
            </div>

            {pendingWebhookRegs.length > 0 && (
              <div className="dev-drawer-section">
                <div className="dev-section-label">
                  จำลองสัญญาณ Webhook ชำระเงิน ({pendingWebhookRegs.length})
                </div>
                {pendingWebhookRegs.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="dev-persona-btn"
                    onClick={() => handleSimulateWebhookConfirm(r.id)}
                  >
                    <span>
                      ยืนยันรับเงิน {r.regCode} ({r.participantNameTh})
                    </span>
                    <IconCheckCircle size={14} />
                  </button>
                ))}
              </div>
            )}

            <div className="dev-drawer-section">
              <label htmlFor="dev-sim-ui" className="dev-section-label">
                จำลองสถานะหน้าจอ Organizer UX:
              </label>
              <select
                id="dev-sim-ui"
                value={simulatedState}
                onChange={(e) => {
                  setSimulatedState(e.target.value as SimulatedUiState);
                  if (hasOrganizerAccess) {
                    navigateOrganizer();
                  }
                }}
              >
                <option value="normal">ปกติ (Normal)</option>
                <option value="loading">กำลังโหลด (Skeleton)</option>
                <option value="partial_error">โหลดผิดพลาดบางส่วน</option>
                <option value="permission_denied">ไม่มีสิทธิ์เข้าถึง</option>
              </select>
            </div>

            <button
              type="button"
              className="btn-secondary btn-full"
              onClick={handleResetAllDemoData}
            >
              <IconSwitch size={14} />
              <span>รีเซ็ตข้อมูลจำลองเริ่มต้นทั้งหมด</span>
            </button>
          </div>
        )}

        <button
          type="button"
          className="dev-dock-pill"
          aria-expanded={showDemoTools}
          onClick={() => setShowDemoTools((v) => !v)}
        >
          <IconSliders size={15} />
          <span>
            Dev / Demo ·{' '}
            {currentUser
              ? currentUser.fullNameTh.split(' ')[0]
              : 'Guest'}
          </span>
        </button>
      </aside>
    </div>
  );
};
