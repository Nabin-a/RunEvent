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

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multiselect'
  | 'file'
  | 'image_choice'
  | 'address'
  | 'size_selector'
  | 'distance_selector'
  /** form content, not a question (24 Nov 2026): a sub-heading / a paragraph of explanation */
  | 'heading'
  | 'note';

export type FormFieldPolicy = 'LOCKED' | 'CONFIGURABLE' | 'CUSTOMIZABLE';

export interface ConditionalRule {
  id: string;
  sourceFieldKey: string;
  operator: 'equals' | 'not_equals' | 'contains';
  value: string;
  targetType: 'field' | 'step';
  targetKey: string;
}

export interface RegistrationStepDef {
  id: string;
  key: string;
  titleTh: string;
  descriptionTh: string;
  order: number;
  enabled: boolean;
  isSystemLocked: boolean;
  visibilityCondition?: ConditionalRule;
}

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

export type AuthProviderType = 'password' | 'google' | 'line' | 'facebook';

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

export type ShirtSizeCode = string;
export type ShirtCutType = 'Unisex' | 'Men' | 'Women';
export type ShirtFitType = 'Regular Fit' | 'Slim Fit' | 'Oversize';

export interface ShirtSizeMeasurement {
  chestInch: string;
  lengthInch: string;
}

export interface PlatformShirtSizeOption {
  code: ShirtSizeCode;
  label: string;
  enabled: boolean;
  sortOrder: number;
  chartByType: Record<ShirtCutType, ShirtSizeMeasurement>;
}

export type ProfileCompletionSectionKey =
  | 'personal'
  | 'contact'
  | 'running_prefs'
  | 'emergency'
  | 'address';

export interface PlatformProfileConfig {
  shirtSizes: PlatformShirtSizeOption[];
  requiredProfileSections: ProfileCompletionSectionKey[];
  distanceOptions: string[];
  runningTypeOptions: string[];
}

export interface RunnerEmergencyContact {
  id: string;
  contactName: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

export interface RunnerSavedAddress {
  id: string;
  addressName: string;
  recipientName: string;
  phone: string;
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface RunnerSocialLinks {
  facebook?: string;
  instagram?: string;
  line?: string;
  strava?: string;
  website?: string;
  otherLinks?: { id: string; label: string; url: string }[];
}

export interface RunnerNotificationPrefs {
  emailNotification: boolean;
  smsNotification: boolean;
  eventUpdates: boolean;
  registrationConfirmation: boolean;
  paymentConfirmation: boolean;
  raceReminder: boolean;
  raceResultAnnouncement: boolean;
  marketingPromotion: boolean;
}

export interface RaceResultSnapshot {
  gunTime: string;
  chipTime: string;
  paceMinPerKm: string;
  overallRank: string;
  categoryRank: string;
  status: 'Finisher' | 'DNF' | 'DNS';
  certificateCode: string;
  verifiedAt: string;
}

export interface RunnerAchievement {
  id: string;
  title: string;
  eventId: string;
  eventNameTh: string;
  achievementType:
    | 'Finisher'
    | 'Personal Best'
    | 'Age Group Podium'
    | 'Official Record';
  achievementDate: string;
  medalOrAward: string;
  certificateCode: string;
  distanceKm: number;
  finishTime?: string;
}

export interface LoginHistoryEntry {
  id: string;
  timestamp: string;
  method: string;
  deviceLabel: string;
  ipOrLocation: string;
  status: 'success' | 'revoked' | 'failed';
}

/** One consent decision (PDPA). Terms acceptance and marketing opt-in are recorded separately. */
export interface ConsentRecord {
  id: string;
  type: 'terms' | 'privacy' | 'marketing';
  granted: boolean;
  /** Document version the user saw; only set for terms/privacy. */
  version?: string;
  recordedAt: string;
  source: 'signup' | 'account_settings' | 'login_prompt';
}

export interface SavedParticipant {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nicknameEn?: string;
  dateOfBirth?: string;
  gender?: 'ชาย' | 'หญิง' | 'ไม่ระบุ';
  nationality?: string;
  idType?: 'none' | 'thai_id' | 'passport';
  idNumber?: string;
  phone?: string;
  preferredShirtSize?: ShirtSizeCode;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  relationshipToOwner?: string;
  lastUsedAt?: string;
}

export interface RunnerProfileData {
  // 1. Personal Information
  avatarDataUrl?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  nicknameEn?: string;
  dateOfBirth?: string;
  gender?: 'ชาย' | 'หญิง' | 'ไม่ระบุ';
  phone?: string;
  phoneVerified?: boolean;
  nationality?: string;
  idType?: 'none' | 'thai_id' | 'passport';
  idNumber?: string;
  country?: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  postalCode?: string;
  address?: string;

  // 2. Running & Shirt Preferences
  preferredShirtSize?: ShirtSizeCode;
  preferredShirtType?: ShirtCutType;
  preferredShirtFit?: ShirtFitType;
  preferredDistances?: string[];
  preferredRunningTypes?: string[];
  runningGoal?: string;
  favoriteEventIds?: string[];
  runningExperience?: 'Beginner' | 'Intermediate' | 'Advanced';

  // 3. Emergency Contacts (Legacy single fields kept for backward compatibility + multi-list)
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  emergencyContacts?: RunnerEmergencyContact[];

  // 4. Address Book
  savedAddresses?: RunnerSavedAddress[];

  // 4.1 Saved Participants (สมัครให้ผู้อื่น)
  savedParticipants?: SavedParticipant[];

  // 7. Social Links
  socialLinks?: RunnerSocialLinks;

  // 9. Notification Preferences
  notificationPrefs?: RunnerNotificationPrefs;
}

export type OrganizationType =
  | 'Private Company'
  | 'Government Organization'
  | 'Sports Club / Association'
  | 'Independent Organizer'
  | 'Non-Profit Organization'
  | 'Other';

export type OrganizerVerificationWorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MORE_INFORMATION_REQUIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'SUSPENDED';

export interface OrganizerDocumentItem {
  id: string;
  category: 'identity' | 'organization' | 'authorization';
  docTypeLabel: string;
  fileName: string;
  fileSizeKb: number;
  mimeType: 'application/pdf' | 'image/jpeg' | 'image/png';
  expiryDate?: string;
  privateStorageKey: string;
}

export interface VerificationHistoryEntry {
  id: string;
  status: OrganizerVerificationWorkflowStatus;
  actorName: string;
  note: string;
  timestamp: string;
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
  runnerProfile?: RunnerProfileData;
  accountStatus?: 'active' | 'deactivated' | 'deletion_requested';
  deletionRequestReason?: string;
  deletionRequestedAt?: string;
  /** ISO time the account row was first created (missing for accounts created before this was tracked). */
  createdAt?: string;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  consents?: ConsentRecord[];
  loginHistory?: LoginHistoryEntry[];
  achievements?: RunnerAchievement[];
  isPlatformAdmin?: boolean;
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
  | 'organizer'
  | 'platform_admin'
  | 'account_security'
  | 'runner_profile';
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
  verificationStatus: 'verified' | 'pending_review' | 'suspended';
  workflowStatus?: OrganizerVerificationWorkflowStatus;
  referenceNumber?: string;
  orgType?: OrganizationType;
  businessRegNumber?: string;
  website?: string;
  orgPhone?: string;
  officeAddress?: {
    address: string;
    province: string;
    district: string;
    subdistrict: string;
    postalCode: string;
    country: string;
  };
  descriptionTh?: string;
  previousEvents?: string;
  facebookPage?: string;
  mainContact?: {
    name: string;
    position: string;
    phone: string;
    email: string;
  };
  documents?: OrganizerDocumentItem[];
  verificationHistory?: VerificationHistoryEntry[];
  submittedAt?: string;
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
  /** Which date the runner's age is counted on. Missing = 'race_day'. */
  ageBasis?: AgeBasis;
  /** Eligibility: youngest / oldest allowed age (whole years) on the basis date. */
  minAge?: number | null;
  maxAge?: number | null;
  /** Organizer-defined age groups (divisions) used for grouping and results. */
  ageGroups?: AgeGroupDef[];
}

/**
 * race_day  = age on the event date (default)
 * year_end  = age on 31 December of the event year (age = event year − birth year)
 */
export type AgeBasis = 'race_day' | 'year_end';

export type AgeGroupGender = 'all' | 'ชาย' | 'หญิง';

export interface AgeGroupDef {
  id: string;
  gender: AgeGroupGender;
  minAge: number;
  /** null = no upper bound ("60 ปีขึ้นไป") */
  maxAge: number | null;
}

/** Age and division frozen on the registration when it was created. */
export interface RegistrationAgeSnapshot {
  ageYears: number;
  basis: AgeBasis;
  basisDate: string;
  dateOfBirth: string;
  groupId: string | null;
  groupLabelTh: string | null;
  computedAt: string;
}

export interface ShirtStock {
  size: ShirtSizeCode;
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
  fieldKey?: string;
  label: string;
  descriptionTh?: string;
  placeholderTh?: string;
  type: CustomFieldType;
  stepKey?: string;
  required: boolean;
  options?: string[];     // ใช้เมื่อ type เป็น 'select' / 'radio' / 'multiselect'
  isSensitive: boolean;   // ถ้าเป็น true จะซ่อนจากเจ้าหน้าที่รับอุปกรณ์หน้างาน
  policy?: FormFieldPolicy;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  allowedFileTypes?: string;
  maxFileSizeMb?: number;
  regexPattern?: string;
  validationMessageTh?: string;
  visibilityCondition?: ConditionalRule;
  /** radio / multiselect: an "Other (please specify)" choice with a text box */
  allowOther?: boolean;
  /** multiselect: how many choices at least / at most */
  minChoices?: number;
  maxChoices?: number;
  /** shown only to runners of these distances (category codes); empty = everyone */
  categoryCodes?: string[];
  /** retired: kept for answers already given, no longer asked */
  hidden?: boolean;
  /** organizer's question that asks for sensitive data: waits for the Platform Owner, not asked until approved */
  approval?: 'pending' | 'approved';
}

/** a registration step the organizer adds (24 Nov 2026); placed after "runner details", before the shop */
export interface OrganizerFormStep {
  id: string;
  title: string;
  description?: string;
  /** shown only to runners of these distances (category codes); empty = everyone */
  categoryCodes?: string[];
  /** retired: kept because it holds answered questions */
  hidden?: boolean;
}

export interface GlobalFormFieldDef extends CustomRegistrationField {
  fieldKey: string;
  policy: FormFieldPolicy;
  categoryTag: 'system' | 'running_standard' | 'custom_library';
}

export interface FormTemplate {
  id: string;
  code: string;
  nameTh: string;
  descriptionTh: string;
  status: 'draft' | 'published';
  versionLabel: string;
  updatedAt: string;
  steps: RegistrationStepDef[];
  fieldIds: string[];
  conditionalRules: ConditionalRule[];
}

export interface EventFormVersionRecord {
  versionId: string;
  versionLabel: string;
  templateId: string;
  status: 'draft' | 'published';
  publishedAt: string;
  changeSummary: string;
  steps: RegistrationStepDef[];
  fields: CustomRegistrationField[];
  /** the organizer's own steps at that version */
  customSteps?: OrganizerFormStep[];
}

export interface OrganizerFieldRequest {
  id: string;
  requestCode: string;
  organizationId: string;
  eventId: string;
  requestedByName: string;
  requestedLabelTh: string;
  requestedFieldKey: string;
  inputType: CustomFieldType;
  targetStepKey: string;
  required: boolean;
  isSensitive: boolean;
  options?: string[];
  conditionHint?: string;
  reasonNote: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  resolvedAt?: string;
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
  | 'kratai_produce_bulk'
  | 'kratai_full_service';

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
  /** orders placed together from one storefront cart share this code */
  checkoutCode?: string;
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
  quotedTotalSatang?: number;
  adminNote?: string;
  createdAt: string;
}

/** Built-in sections of the public event page (their data comes from the event settings). */
export type EventDetailBlockId = 'about' | 'categories' | 'racepack' | 'schedule' | 'venue' | 'merch';

/** A layout slot: a built-in section, or `custom:<id>` for a free block the organizer added. */
export type EventDetailLayoutKey = EventDetailBlockId | `custom:${string}`;

export interface EventDetailLayoutItem {
  block: EventDetailLayoutKey;
  visible: boolean;
}

/** Kinds of pieces an organizer can drop into a free block (set chosen 23 Nov 2026). */
export type EventPageItemKind =
  | 'heading'
  | 'text'
  | 'list'
  | 'table'
  | 'faq'
  | 'image'
  | 'gallery'
  | 'file'
  | 'link'
  | 'divider'
  /** another block (built-in or free) placed inside a column; one level deep only (decision 23 Nov 2026) */
  | 'nested'
  /** read-only event data (prices, seats, sizes, venue…) shown live; see data/eventDataPieces.ts */
  | 'data'
  /** cards with a title, a description and a short tag (e.g. what runners get) */
  | 'cards'
  /** a time line: time, title, detail (e.g. the event schedule) */
  | 'timeline';

/** where a data piece reads from (phase A, 24 Nov 2026) */
export type EventDataSource = 'categories' | 'quota' | 'register' | 'sizechart' | 'venue' | 'contact' | 'kit' | 'products';

/** display choices of a data piece; the values themselves are never edited here */
export interface EventDataPieceOptions {
  /** categories / quota: only these categories (empty = all) */
  categoryIds?: string[];
  showAllTiers?: boolean;
  showAge?: boolean;
  layout?: 'cards' | 'table';
  quotaMode?: 'per-category' | 'total';
  quotaStyle?: 'number' | 'label';
  showStock?: boolean;
  showDate?: boolean;
  showRules?: boolean;
  /** products: how many to show (1-8) */
  productCount?: number;
  productCategory?: string;
}

/** one thing runners get (race pack card); `icon` = a CARD_ICONS name, `iconImage` = an uploaded icon */
export interface RacePackItem {
  title: string;
  detail: string;
  scope: string;
  icon?: string;
  iconImage?: string;
}

/** organizer text of the built-in blocks about / race pack / schedule */
export interface EventCoreText {
  about?: { paragraphs: string[]; highlights: string[] };
  racepack?: { items: RacePackItem[] };
  schedule?: { items: { timeLabel: string; title: string; detail: string }[] };
}

/** One piece inside a column of a free block. Only the fields of its kind are used. */
export interface EventPageItem {
  id: string;
  kind: EventPageItemKind;
  /** heading / text */
  text?: string;
  /** list */
  items?: string[];
  ordered?: boolean;
  /** table: rows of cells, the first row is the header */
  rows?: string[][];
  /** faq */
  faqs?: { q: string; a: string }[];
  /** image */
  imageUrl?: string;
  imageAlt?: string;
  /** gallery */
  images?: { url: string; alt: string }[];
  /** file (PDF) */
  fileUrl?: string;
  fileName?: string;
  /** link / file: button text */
  label?: string;
  /** link: address (http/https only) */
  href?: string;
  /** nested: the block shown here, a built-in id or `custom:<id>`; it is then not in the page layout */
  ref?: EventDetailLayoutKey;
  /** data: which event data it shows, and how */
  source?: EventDataSource;
  options?: EventDataPieceOptions;
  /** cards */
  /** cards; `icon` = a name from CARD_ICONS (empty = gift), `iconImage` = an uploaded icon (wins over `icon`) */
  cards?: { title: string; detail: string; scope: string; icon?: string; iconImage?: string }[];
  /** timeline */
  timeline?: { timeLabel: string; title: string; detail: string }[];
}

/** A free block: organizer-named section with 1-3 columns (one column on phones). */
export interface EventCustomBlock {
  id: string;
  title: string;
  columns: 1 | 2 | 3;
  /** one list of pieces per column; cells.length === columns */
  cells: EventPageItem[][];
}

/** what the organizer may change on the sticky register card (24 Nov 2026); prices, seats,
 *  categories, status and the register button always come from the system */
export interface EventRegisterCardConfig {
  /** small heading above the event name (default "สมัครร่วมงาน") */
  kicker?: string;
  /** one short promo line under the event name */
  promo?: string;
  showMascot?: boolean;
  /** the whole-event seat bar (only ever shown while the total cap is on) */
  showQuota?: boolean;
  showShortcuts?: boolean;
}

export interface EventDetailPage {
  layout: EventDetailLayoutItem[];
  customBlocks: EventCustomBlock[];
  /** the sticky register card's text and switches */
  card?: EventRegisterCardConfig;
  /** 2 = built-in blocks already turned into free blocks (24 Nov 2026); older pages are converted on read */
  v?: 2;
  /** edited text of the built-in blocks; copied onto the event when published */
  coreText?: EventCoreText;
}

export interface EventDetailPageVersion extends EventDetailPage {
  version: number;
  publishedAt: string;
  publishedBy: string;
}

export interface RaceEvent {
  id: string;
  code: string;
  organizationId: string;
  titleTh: string;
  titleEn: string;
  tagline: string;
  coverMotif: 'mountain' | 'coast' | 'heritage' | 'river' | 'trail';
  coverImageUrl?: string;
  coverImageAlt?: string;
  galleryImageUrls?: string[];
  province: string;
  region: 'เหนือ' | 'กลางและกรุงเทพฯ' | 'อีสาน' | 'ใต้' | 'ตะวันออก';
  venue: string;
  eventDate: string;
  timezone: 'Asia/Bangkok';
  raceType: 'Road Race' | 'Trail' | 'City Fun Run';
  status: EventStatus;
  statusNote?: string;
  totalEventQuota: number;
  /** Organizer switch for the whole-event cap. false = no total cap (per-distance quotas only)
   *  and the total is hidden on public pages. Unset = on (events created before the switch). */
  totalEventQuotaEnabled?: boolean;
  feeBearerPolicy: FeeBearerPolicy;
  editDeadlineDate: string;
  rulesVersion: string;
  kitPickupWindow: string;
  /** Race kit postal shipping fee set by the organizer (satang). Unset = sandbox sample fee. */
  kitShippingFeeSatang?: number;
  registrationPeriodLabel?: string;
  /** Published order and visibility of the sections on the public event page. Unset = default order. */
  detailLayout?: EventDetailLayoutItem[];
  /** Published free blocks referenced by `custom:<id>` entries of detailLayout. */
  detailCustomBlocks?: EventCustomBlock[];
  /** Organizer's unpublished edit of the page (page editor). */
  detailPageDraft?: EventDetailPage & { updatedAt: string; updatedBy: string };
  /** Published settings of the sticky register card. */
  detailRegisterCard?: EventRegisterCardConfig;
  /** 2 = the published page is already made of free blocks (see EventDetailPage.v) */
  detailPageV?: 2;
  /** Published versions, newest last (kept to the last 20). */
  detailPageVersions?: EventDetailPageVersion[];
  overviewParagraphs?: string[];
  racePackItems?: RacePackItem[];
  /** when the text of a published free-block page was copied back to the fields above (24 Nov 2026) */
  detailTextFromPageAt?: string;
  scheduleItems?: {
    timeLabel: string;
    title: string;
    detail: string;
  }[];
  highlights: string[];
  categories: RaceCategory[];
  shirtStocks: ShirtStock[];
  customSizeChart?: Record<string, ShirtSizeMeasurement>;
  products: EventProduct[];
  customFields?: CustomRegistrationField[];
  activeTemplateId?: string;
  publishedFormVersion?: string;
  formSteps?: RegistrationStepDef[];
  /** the organizer's own registration steps, in order (see OrganizerFormStep) */
  formCustomSteps?: OrganizerFormStep[];
  conditionalRules?: ConditionalRule[];
  formVersionHistory?: EventFormVersionRecord[];
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
  shirtSize: ShirtSizeCode;
  kitDeliveryMethod?: 'pickup_at_expo' | 'postal_shipping';
  shippingAddressSnapshot?: string;
  participantSnapshot?: {
    firstName?: string;
    lastName?: string;
    nickname?: string;
    firstNameEn?: string;
    lastNameEn?: string;
    nicknameEn?: string;
    phone?: string;
    nationality?: string;
    dateOfBirth?: string;
    gender?: string;
    idType?: 'none' | 'thai_id' | 'passport';
    idNumberMasked?: string;
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    emergencyContactPhone?: string;
    preferredShirtType?: ShirtCutType;
    preferredShirtFit?: ShirtFitType;
  };
  raceResult?: RaceResultSnapshot;
  bibNumber: string | null;
  qrCheckInToken: string;
  acceptedRulesVersion: string;
  /** payment and refund terms accepted at checkout (registrations made from Nov 2026) */
  acceptedPaymentTermsVersion?: string;
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
  /** race kit postal fee charged with this entry (part of snapshotTotalChargedSatang, goes to the organizer) */
  snapshotKitShippingSatang?: number;
  customAnswers?: Record<string, string | boolean>;
  formVersionUsed?: string;
  gender?: 'ชาย' | 'หญิง' | 'ไม่ระบุ';
  age?: number;
  ageSnapshot?: RegistrationAgeSnapshot;
  paymentMethod?: 'qr_promptpay' | 'credit_card' | 'mobile_banking';
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
