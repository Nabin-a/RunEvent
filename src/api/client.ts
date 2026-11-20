import type {
  AuditLogEntry,
  ConditionalRule,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizerFieldRequest,
  PayoutBatch,
  PlatformProfileConfig,
  ProductionInquiry,
  RaceEvent,
  RegistrationRecord,
  RegistrationStepDef,
  TeamInvitation,
  UserAccount,
} from '../types';

export interface ApiSystemState {
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
  platformProfileConfig: PlatformProfileConfig;
}

export interface ApiSnapshotResponse {
  ok: boolean;
  error?: string;
  currentUserId?: string | null;
  state?: ApiSystemState;
  /** Server switches; sandboxTools = dev switcher, reset and simulated social sign-in. */
  config?: { sandboxTools: boolean };
  user?: UserAccount;
  organization?: Organization;
  event?: RaceEvent;
  reg?: RegistrationRecord;
  addonOrder?: MerchOrderRecord;
  order?: MerchOrderRecord;
  inquiry?: ProductionInquiry;
  invitation?: TeamInvitation;
  /** Generic payload (e.g. /api/account/export). */
  data?: unknown;
}

let cachedApiOrigin = '';

function resolveFallbackApiOrigin(): string {
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  if (port === '3001') return '';
  return `${protocol}//${hostname}:3001`;
}

export async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<ApiSnapshotResponse> {
  const doFetch = (base: string) =>
    fetch(`${base}${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  try {
    let res = await doFetch(cachedApiOrigin);
    const contentType = res.headers.get('content-type') ?? '';

    // When served behind static Nginx (e.g. :8090 without /api proxy), fallback to same-host :3001 API
    if (!cachedApiOrigin && !contentType.includes('application/json')) {
      const fallback = resolveFallbackApiOrigin();
      if (fallback) {
        const retryRes = await doFetch(fallback);
        if ((retryRes.headers.get('content-type') ?? '').includes('application/json')) {
          cachedApiOrigin = fallback;
          res = retryRes;
        }
      }
    }

    const json = (await res.json()) as ApiSnapshotResponse;
    if (!res.ok && json.ok === undefined) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return json;
  } catch (err) {
    if (!cachedApiOrigin) {
      const fallback = resolveFallbackApiOrigin();
      if (fallback) {
        try {
          const retryRes = await doFetch(fallback);
          const json = (await retryRes.json()) as ApiSnapshotResponse;
          cachedApiOrigin = fallback;
          return json;
        } catch {
          // ignore secondary error
        }
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error connecting to local API',
    };
  }
}
