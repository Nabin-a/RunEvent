import type {
  AuditLogEntry,
  ConditionalRule,
  FormTemplate,
  GlobalFormFieldDef,
  MerchOrderRecord,
  Organization,
  OrganizerFieldRequest,
  PayoutBatch,
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
}

export interface ApiSnapshotResponse {
  ok: boolean;
  error?: string;
  currentUserId?: string | null;
  state?: ApiSystemState;
  user?: UserAccount;
  organization?: Organization;
  event?: RaceEvent;
  reg?: RegistrationRecord;
  addonOrder?: MerchOrderRecord;
  order?: MerchOrderRecord;
  inquiry?: ProductionInquiry;
  invitation?: TeamInvitation;
}

export async function apiRequest(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<ApiSnapshotResponse> {
  try {
    const res = await fetch(path, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as ApiSnapshotResponse;
    if (!res.ok && json.ok === undefined) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return json;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error connecting to local API',
    };
  }
}
