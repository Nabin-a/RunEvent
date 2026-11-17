export type EventStatus =
  | 'draft'
  | 'in_review'
  | 'published'
  | 'closed'
  | 'completed'
  | 'suspended'
  | 'cancelled';

export type RegistrationStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'expired';

export type CustomFieldType = 'text' | 'select' | 'checbox'

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'expired';

export type RefundStatus =
  | 'none'
  | 'requested'
  | 'approved'
  | 'processing'
  | 'succeeded'
  | 'rejected';

export type PayoutStatus = 'scheduled' | 'processing' | 'paid' | 'held';

export type FulfillmentStatus =
  | 'not_ready'
  | 'ready'
  | 'checked_in'
  | 'kit_picked_up';

export type FeeBearerPolicy =
  | 'runner_pays'
  | 'organizer_absorbs'
  | 'split_50_50';

export type OrgRole = 'owner' | 'event_manager' | 'finance' | 'staff';

export type TimeWindowFilter = 'all_time' | 'last_30d' | 'last_7d';

export type SimulatedUiState =
  | 'normal'
  | 'loading'
  | 'partial_error'
  | 'permission_denied';

export type AuthProviderType = 'password' | 'google' | 'line';

export interface LinkedAuthIdentity {
  id: string;
  provider: AuthProviderType;
  providerSubject: string;
  providerEmail?: string;
  linkedAt: string;
}

export interface DeviceSession {
  id: string;
  deviceLabel: string;
  locationHint: string;
  lastActiveAt: string;
  isCurrentDevice: boolean;
}

export interface OrganizationMembership {
  organizationId: string;
  role: OrgRole;
  assignedEventIds?: string[];
}

export interface UserAccount {
  id: string;
  code: string;
  fullNameTh: string;
  fullNameEn: string;
  contactEmail: string | null;
  emailVerified: boolean;
  hasPassword: boolean;
  demoPasswordHint?: string;
  identities: LinkedAuthIdentity[];
  sessions: DeviceSession[];
  memberships: OrganizationMembership[];
  demoRoleSummary: string;
  isDemoPreset: boolean;
}

export interface TeamInvitation {
  id: string;
  inviteCode: string;
  organizationId: string;
  targetEmail?: string;
  role: OrgRole;
  assignedEventIds?: string[];
  expiresAt: string;
  usedByUserId?: string;
}

export interface ReturnIntent {
  surface:
  | 'events'
  | 'my_orders'
  | 'custom_production'
  | 'organizer'
  | 'account_security';
  eventId?: string | null;
  eventTab?: 'register' | 'storefront' | 'info_results';
  label: string;
}

export interface Organization {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  province: string;
  verificationStatus: 'verified' | 'pending_review';
  payoutBankSummary: string;
  payoutReady: boolean;
  contactEmail: string;
}

export interface PriceTier {
  id: string;
  label: string;
  priceSatang: number;
  startsAt: string;
  endsAt: string;
  isCurrent: boolean;
}

export interface RaceCategory {
  id: string;
  code: string;
  name: string;
  distanceKm: number;
  startTimeLocal: string;
  cutoffHours: number;
  categoryQuota: number;
  bibPrefix: string;
  colorTag: 'vermilion' | 'navy' | 'forest' | 'amber';
  priceTiers: PriceTier[];
}

export interface ShirtStock {
  size: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL';
  total: number;
  reservedOrConfirmed: number;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  passed: boolean;
  fixTargetHint: string;
}

export interface CustomRegistrationField {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  options?: string[];     // ใช้เมื่อ type เป็น 'select'
  isSensitive: boolean;   // ถ้าเป็น true จะซ่อนจากเจ้าหน้าที่รับอุปกรณ์หน้างาน
}

export interface CategoryQuotaPatch {
  maxQuota: number;
  registeredCount: number; // ชำระเงินสำเร็จแล้ว
  reservedCount: number;   // กำลังถือโควตารอผลชำระเงิน
}

export interface EventCustomConfigPatch {
  customFields?: CustomRegistrationField[];
}

export interface RegistrationAnswerPatch {
  customAnswers?: Record<string, string | boolean>;
}

export type SellerServiceModel =
  | 'organizer_self_sell'
  | 'runevent_produce_bulk'
  | 'runevent_full_service';

export interface EventProduct {
  id: string;
  sku: string;
  eventId: string;
  nameTh: string;
  categoryLabel: 'เสื้อที่ระลึก' | 'เหรียญที่ระลึก' | 'อุปกรณ์เสริม';
  saleMode: 'ready_stock' | 'preorder';
  serviceModel: SellerServiceModel;
  sellerLabel: string;
  fulfillmentOwnerLabel: string;
  priceSatang: number;
  shippingFeeSatang: number;
  stockOrCeiling: number;
  soldCount: number;
  preorderMinQty?: number;
  preorderCloseDate?: string;
  estimatedDeliveryNote: string;
  refundAndMinPolicyNote: string;
  availableSizes: string[];
  description: string;
}

export interface MerchOrderRecord {
  id: string;
  merchOrderCode: string;
  eventId: string;
  organizationId: string;
  buyerUserId?: string;
  buyerName: string;
  buyerEmail: string;
  productId: string;
  productNameTh: string;
  sellerLabel: string;
  variantSize: string;
  quantity: number;
  deliveredQty: number;
  deliveryMethod: 'pickup_at_expo' | 'postal_shipping';
  shippingAddress?: string;
  trackingCode?: string;
  unitPriceSatang: number;
  shippingSatang: number;
  totalPaidSatang: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus:
  | 'unallocated'
  | 'preparing'
  | 'ready_or_shipped'
  | 'partial_received'
  | 'completed';
  pickupToken: string;
  linkedRegistrationCode?: string;
  createdAt: string;
}

export interface ProductionInquiry {
  id: string;
  inquiryCode: string;
  organizationId?: string;
  requesterName: string;
  requesterContact: string;
  eventId?: string;
  contextType: 'event_organizer' | 'club_or_company';
  itemType:
  | 'เสื้อแข่งขันและเสื้อที่ระลึก'
  | 'เหรียญรางวัลและสายคล้อง'
  | 'ชุดเสื้อพร้อมเหรียญครบวงจร';
  serviceModel: 'produce_bulk' | 'full_preorder_fulfillment';
  packageEntitlementQty: number;
  addonStoreQty: number;
  organizerBufferQty: number;
  existingStockDeductedQty: number;
  netQtyToProduce: number;
  artworkVersion: string;
  targetDeliveryDate: string;
  quoteStatus: 'draft' | 'submitted' | 'quoted_demo' | 'accepted';
  productionStatus:
  | 'awaiting_approval'
  | 'ready_to_produce'
  | 'in_production'
  | 'qc_passed';
  createdAt: string;
}

export interface RaceEvent {
  id: string;
  code: string;
  organizationId: string;
  titleTh: string;
  titleEn: string;
  tagline: string;
  coverMotif: 'mountain' | 'coast' | 'heritage' | 'river' | 'trail';
  province: string;
  region: 'เหนือ' | 'กลางและกรุงเทพฯ' | 'อีสาน' | 'ใต้' | 'ตะวันออก';
  venue: string;
  eventDate: string;
  timezone: 'Asia/Bangkok';
  raceType: 'Road Race' | 'Trail' | 'City Fun Run';
  status: EventStatus;
  statusNote?: string;
  totalEventQuota: number;
  feeBearerPolicy: FeeBearerPolicy;
  editDeadlineDate: string;
  rulesVersion: string;
  kitPickupWindow: string;
  highlights: string[];
  categories: RaceCategory[];
  shirtStocks: ShirtStock[];
  products: EventProduct[];
  readinessChecks: ReadinessCheck[];
  officialResultsUrl?: string;
  verifiedPhotoAlbums?: {
    id: string;
    title: string;
    photographerCredit: string;
    photoCount: number;
    externalUrl: string;
  }[];
}

export interface RegistrationRecord {
  id: string;
  regCode: string;
  orderCode: string;
  eventId: string;
  organizationId: string;
  categoryId: string;
  runnerUserId?: string;
  buyerName: string;
  participantNameTh: string;
  participantNameEn: string;
  email: string;
  phoneMasked: string;
  emergencyContact: string;
  shirtSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL';
  bibNumber: string | null;
  qrCheckInToken: string;
  acceptedRulesVersion: string;
  marketingConsent: boolean;
  createdAt: string;
  paidAt: string | null;
  refundedAt: string | null;
  reservationExpiresAt: string | null;
  registrationStatus: RegistrationStatus;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  fulfillmentStatus: FulfillmentStatus;
  fulfillmentUpdatedBy?: string;
  fulfillmentUpdatedAt?: string;
  refundReason?: string;
  snapshotBaseSatang: number;
  snapshotPlatformFeeSatang: number;
  snapshotRunnerFeeSatang: number;
  snapshotOrganizerFeeSatang: number;
  snapshotTotalChargedSatang: number;
  snapshotRefundedSatang: number;
}

export interface PayoutBatch {
  id: string;
  payoutCode: string;
  organizationId: string;
  eventId: string;
  periodLabel: string;
  scheduledDate: string;
  grossSucceededSatang: number;
  deductedRefundSatang: number;
  deductedOrganizerFeeSatang: number;
  netPayoutSatang: number;
  status: PayoutStatus;
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  eventId?: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  actionSummary: string;
  detailChange: string;
}
