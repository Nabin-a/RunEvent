import React, { useMemo, useState } from 'react';
import {
  EventProduct,
  MerchOrderRecord,
  Organization,
  ProductionInquiry,
  RaceCategory,
  RaceEvent,
  RegistrationRecord,
  ReturnIntent,
  UserAccount,
} from '../types';
import {
  calculateFeeQuote,
  feePolicyLabel,
  formatThb,
  getCurrentTier,
} from '../utils/pricing';
import {
  EventCoverArtwork,
  IconAlert,
  IconArrowLeft,
  IconArrowRight,
  IconBag,
  IconBib,
  IconCalendar,
  IconCamera,
  IconCheckCircle,
  IconLock,
  IconMapPin,
  IconQr,
  IconSearch,
  IconShirt,
} from './Icons';
import {
  EventStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  RegStatusBadge,
} from './StatusBadges';

export type CustomerSubView =
  | 'directory'
  | 'event_detail'
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
  currentUser: UserAccount | null;
  onNavigate: (
    view: CustomerSubView,
    eventId?: string | null,
    tab?: 'register' | 'storefront' | 'info_results'
  ) => void;
  onRequireLoginWithIntent: (intent: ReturnIntent) => void;
  onOpenAccountSecurity: () => void;
  onOpenOrganizerDashboard: (orgId: string, eventId?: string) => void;
  onCreateRegistrationAndOptionalAddon: (payload: {
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
    newSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL'
  ) => void;
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
  currentUser,
  onNavigate,
  onRequireLoginWithIntent,
  onOpenAccountSecurity,
  onOpenOrganizerDashboard,
  onCreateRegistrationAndOptionalAddon,
  onCreateStandaloneMerchOrder,
  onUpdateRunnerShirtSize,
  onCreateClubProductionInquiry,
}) => {
  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState<
    'all' | 'open' | 'has_shop' | 'completed'
  >('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Event detail & step-by-step registration state
  const [detailTab, setDetailTab] = useState<
    'register' | 'storefront' | 'info_results'
  >(initialEventTab);
  const [regStep, setRegStep] = useState<1 | 2 | 3>(1);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [shirtSize, setShirtSize] = useState<
    'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL'
  >('M');
  const [includeAddonId, setIncludeAddonId] = useState<string>('none');
  const [addonSize, setAddonSize] = useState<string>('M');
  const [registerForSelf, setRegisterForSelf] = useState(true);
  const [buyerName, setBuyerName] = useState(
    currentUser?.fullNameTh ?? 'กานต์พิชชา วัฒนากูล'
  );
  const [participantNameTh, setParticipantNameTh] = useState(
    currentUser?.fullNameTh ?? 'กานต์พิชชา วัฒนากูล'
  );
  const [participantNameEn, setParticipantNameEn] = useState(
    currentUser?.fullNameEn ?? 'Kanpitcha Wattanakul'
  );
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [simulateWebhookSuccess, setSimulateWebhookSuccess] = useState(true);
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
    '199 ถ.นิมมานเหมินท์ อ.เมือง จ.เชียงใหม่ 50200 (จำลอง)'
  );
  const [linkedRegForMerch, setLinkedRegForMerch] = useState<string>('');
  const [createdMerchReceipt, setCreatedMerchReceipt] =
    useState<MerchOrderRecord | null>(null);

  // Club/Company custom production inquiry state (no race event needed)
  const [clubName, setClubName] = useState('ชมรมวิ่งเช้าสวนลุมฯ (ตัวอย่าง)');
  const [clubContact, setClubContact] = useState('club-contact@example.local');
  const [clubItemType, setClubItemType] = useState<
    ProductionInquiry['itemType']
  >('เสื้อแข่งขันและเสื้อที่ระลึก');
  const [clubQty, setClubQty] = useState<number>(150);
  const [clubDate, setClubDate] = useState('2027-01-20');
  const [createdClubRfq, setCreatedClubRfq] =
    useState<ProductionInquiry | null>(null);

  React.useEffect(() => {
    setDetailTab(initialEventTab);
  }, [initialEventTab, selectedEventId]);

  React.useEffect(() => {
    if (currentUser) {
      setBuyerName(currentUser.fullNameTh);
      if (registerForSelf) {
        setParticipantNameTh(currentUser.fullNameTh);
        setParticipantNameEn(currentUser.fullNameEn);
      }
    }
  }, [currentUser, registerForSelf]);

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
    tab: 'register' | 'storefront' | 'info_results' = 'register',
    prelinkRegCode = ''
  ) => {
    const resolvedTab =
      ev.status !== 'published' && tab === 'register' ? 'info_results' : tab;
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
    setDetailTab(resolvedTab);
    onNavigate('event_detail', ev.id, resolvedTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRegistrationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

    if (!currentUser.contactEmail || !currentUser.emailVerified) {
      setCheckoutError(
        'บัญชีของคุณยังไม่ได้ยืนยันอีเมลติดต่อ กรุณากดปุ่ม "เพิ่มและยืนยันอีเมล" ด้านล่างก่อนออกใบยืนยันสิทธิ์แข่งขัน'
      );
      return;
    }

    const finalBuyer = buyerName.trim();
    const finalParticipant = registerForSelf
      ? finalBuyer
      : participantNameTh.trim();

    if (!finalBuyer || !finalParticipant) {
      setCheckoutError('กรุณากรอกชื่อผู้ชำระเงินและชื่อผู้เข้าแข่งขันให้ครบถ้วน');
      return;
    }
    if (!acceptedRules) {
      setCheckoutError(
        `กรุณาติ๊กยอมรับกติกาการแข่งขัน (${selectedEvent.rulesVersion}) ก่อนยืนยัน`
      );
      return;
    }

    const catSeats = getCategoryOpenSeats(selectedEvent.id, activeCategory);
    const eventSeats = getEventOpenSeats(selectedEvent);
    if (catSeats <= 0 || eventSeats <= 0) {
      setCheckoutError('ขออภัย โควตาเต็มแล้ว ระบบป้องกันการขายเกินอัตโนมัติ');
      return;
    }

    setCheckoutError(null);
    const res = onCreateRegistrationAndOptionalAddon({
      eventId: selectedEvent.id,
      categoryId: activeCategory.id,
      buyerName: finalBuyer,
      participantNameTh: finalParticipant,
      participantNameEn: participantNameEn.trim() || 'Demo Participant',
      shirtSize,
      marketingConsent,
      simulateImmediateWebhook: simulateWebhookSuccess,
      addonProduct: selectedAddonProduct,
      addonSize,
    });
    setCreatedResult(res);
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
            <span>กลับหน้ารวมงานวิ่ง</span>
          </button>
        </div>

        <section className="clean-panel">
          <h1>บริการสั่งผลิตเสื้อวิ่งและเหรียญรางวัลสำหรับชมรม ทีม และองค์กร</h1>
          <p className="muted-block">
            ส่งความต้องการเพื่อขอใบเสนอราคาได้โดยไม่จำเป็นต้องเปิดรับสมัครงานวิ่งในระบบ
            (คำขอราคายังไม่ใช่คำสั่งเริ่มผลิตจริง จนกว่าจะยืนยันแบบ จำนวน ราคา และเงื่อนไขชำระ)
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
                <label htmlFor="clb-name">ชื่อชมรม / บริษัท / ผู้ติดต่อ</label>
                <input
                  id="clb-name"
                  type="text"
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  required
                />
              </div>
              <div className="form-row">
                <label htmlFor="clb-mail">อีเมลหรือเบอร์ติดต่อกลับ</label>
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
                <label htmlFor="clb-item">ประเภทสินค้าที่ต้องการสั่งผลิต</label>
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
                    เสื้อวิ่งชมรม / เสื้อกิจกรรมองค์กร
                  </option>
                  <option value="เหรียญรางวัลและสายคล้อง">
                    เหรียญที่ระลึกพร้อมสายคล้องพิมพ์ลาย
                  </option>
                  <option value="ชุดเสื้อพร้อมเหรียญครบวงจร">
                    ชุดเสื้อพร้อมเหรียญครบวงจร
                  </option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="clb-qty">จำนวนประมาณการ (ชิ้น)</label>
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
                <label htmlFor="clb-date">วันที่ต้องการใช้งานสินค้า</label>
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
                ส่งคำขอใบเสนอราคาสั่งผลิต (จำลอง)
              </button>
            </div>

            {createdClubRfq && (
              <div className="success-callout" role="status">
                <IconCheckCircle size={18} />
                <div>
                  <strong>
                    บันทึกคำขอราคา {createdClubRfq.inquiryCode} เรียบร้อยแล้ว
                  </strong>
                  <p>
                    ทีมประสานงานจะตรวจสอบแบบและส่งใบเสนอราคาให้พิจารณาอนุมัติก่อนเริ่มผลิตจริง
                  </p>
                </div>
              </div>
            )}
          </form>

          {productionInquiries.filter((q) => q.contextType === 'club_or_company')
            .length > 0 && (
            <div style={{ marginTop: '1.25rem' }}>
              <h2>รายการคำขอราคาของชมรม/บริษัทที่ส่งแล้ว</h2>
              <div className="table-scroll">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>รหัสคำขอ</th>
                      <th>ผู้ขอ / ช่องทางติดต่อ</th>
                      <th>รายการ</th>
                      <th className="num-col">จำนวนประมาณการ</th>
                      <th>สถานะใบเสนอราคา</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionInquiries
                      .filter((q) => q.contextType === 'club_or_company')
                      .map((rfq) => (
                        <tr key={rfq.id}>
                          <td className="mono-code">{rfq.inquiryCode}</td>
                          <td>
                            <strong>{rfq.requesterName}</strong>
                            <div className="muted-inline">
                              {rfq.requesterContact}
                            </div>
                          </td>
                          <td>{rfq.itemType}</td>
                          <td className="num-col mono-num">
                            {rfq.netQtyToProduce} ชิ้น
                          </td>
                          <td>
                            <span className="status-pill badge-amber">
                              รอทีมงานส่งใบเสนอราคา
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
            <h1>บัตรวิ่งและคำสั่งซื้อสินค้าของฉัน</h1>
            <p className="muted-block">
              แยกแสดงระหว่าง <strong>สิทธิ์เข้าร่วมการแข่งขัน (รับ BIB)</strong> และ{' '}
              <strong>คำสั่งซื้อสินค้าที่ระลึก</strong> อย่างชัดเจนเพื่อความสะดวกรวดเร็วในวันรับของ
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onNavigate('directory', null)}
          >
            <IconArrowLeft size={15} />
            <span>ดูงานวิ่งทั้งหมด</span>
          </button>
        </div>

        {!currentUser ? (
          <div className="empty-state-box">
            <h2>กรุณาเข้าสู่ระบบเพื่อดูบัตรวิ่งและคำสั่งซื้อของคุณ</h2>
            <p>
              รองรับการเข้าสู่ระบบด้วยอีเมล, Google, LINE หรือเลือกสลับบัญชีตัวอย่างเพื่อดูข้อมูลทันที
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
              <span>เข้าสู่ระบบ</span>
            </button>
          </div>
        ) : (
          <div className="hub-sections-stack">
            <section className="clean-panel" aria-label="ใบสมัครวิ่งของฉัน">
              <div className="section-title-bar">
                <div>
                  <h2>
                    1. ใบสมัครวิ่งและบัตร QR รับอุปกรณ์แข่งขัน (
                    <span className="mono-num">{myRegistrations.length}</span>)
                  </h2>
                  <p className="muted-inline">
                    แสดง QR Token นี้ที่จุดเช็กอินนักวิ่งเพื่อรับป้าย BIB และเสื้อตามสิทธิ์สมัคร
                  </p>
                </div>
              </div>

              {myRegistrations.length === 0 ? (
                <div className="subtle-empty-note">
                  บัญชีนี้ยังไม่มีใบสมัครวิ่ง (ลูกค้าทั่วไปสามารถดูคำสั่งซื้อสินค้าที่ระลึกได้ในหัวข้อที่ 2 ด้านล่าง)
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
                            <span className="mono-code">{reg.regCode}</span>
                            <RegStatusBadge status={reg.registrationStatus} />
                            <PaymentStatusBadge status={reg.paymentStatus} />
                            <FulfillmentStatusBadge
                              status={reg.fulfillmentStatus}
                            />
                          </div>
                          <h3>{ev?.titleTh ?? reg.eventId}</h3>
                          <p className="muted-block">
                            ระยะทาง: <strong>{cat?.name}</strong> · วันงาน:{' '}
                            <span className="mono-num">{ev?.eventDate}</span> ·
                            ผู้เข้าแข่งขัน: <strong>{reg.participantNameTh}</strong>{' '}
                            (ผู้สั่งซื้อ: {reg.buyerName})
                          </p>
                          <p className="muted-inline">
                            ชำระสุทธิ:{' '}
                            <strong className="mono-num">
                              {formatThb(reg.snapshotTotalChargedSatang, true)}
                            </strong>{' '}
                            (ไม่แก้ยอดใบสมัครย้อนหลังหากมีการสั่งซื้อของที่ระลึกเพิ่มภายหลัง)
                          </p>

                          <div className="cta-inline-row" style={{ marginTop: '0.55rem' }}>
                            {canEditShirt && (
                              <div className="inline-shirt-editor">
                                <label htmlFor={`my-shirt-${reg.id}`}>
                                  แก้ขนาดเสื้อสิทธิ์สมัคร (ถึง {ev.editDeadlineDate}):
                                </label>
                                <select
                                  id={`my-shirt-${reg.id}`}
                                  value={reg.shirtSize}
                                  onChange={(e) =>
                                    onUpdateRunnerShirtSize(
                                      reg.id,
                                      e.target.value as
                                        | 'XS'
                                        | 'S'
                                        | 'M'
                                        | 'L'
                                        | 'XL'
                                        | '2XL'
                                    )
                                  }
                                >
                                  {(
                                    ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const
                                  ).map((s) => (
                                    <option key={s} value={s}>
                                      ไซส์ {s}
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
                                <span>ซื้อเสื้อ/เหรียญที่ระลึกเพิ่ม (สร้างออเดอร์ใหม่)</span>
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
                                  <span>ดูผลและรูปภาพหลังงาน</span>
                                </button>
                              )}
                          </div>
                        </div>

                        <div className="pass-qr-card">
                          <div className="pass-bib-num mono-num">
                            {reg.bibNumber ?? 'รอกำหนด BIB'}
                          </div>
                          <div className="qr-token-box">
                            <IconQr size={26} />
                            <div>
                              <div className="mono-code">
                                {reg.qrCheckInToken}
                              </div>
                              <small>เสื้อตามสิทธิ์: ไซส์ {reg.shirtSize}</small>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="clean-panel" aria-label="คำสั่งซื้อสินค้าที่ระลึก">
              <div className="section-title-bar">
                <div>
                  <h2>
                    2. คำสั่งซื้อสินค้าที่ระลึกและพรีออเดอร์ (
                    <span className="mono-num">{myMerchOrders.length}</span>)
                  </h2>
                  <p className="muted-inline">
                    ใช้รหัสรับสินค้าด้านขวาในการรับของที่บูธร้านค้า (ไม่ต้องมีเลข BIB และไม่กระทบสถานะเช็กอินวิ่ง)
                  </p>
                </div>
              </div>

              {myMerchOrders.length === 0 ? (
                <div className="subtle-empty-note">
                  ยังไม่มีคำสั่งซื้อสินค้าที่ระลึกในบัญชีนี้
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
                              {ord.merchOrderCode}
                            </span>
                            <PaymentStatusBadge status={ord.paymentStatus} />
                            {ord.linkedRegistrationCode && (
                              <span className="muted-inline">
                                อ้างอิงใบสมัคร {ord.linkedRegistrationCode}
                              </span>
                            )}
                          </div>
                          <h3>{ord.productNameTh}</h3>
                          <p className="muted-block">
                            งาน: {ev?.titleTh} · ขนาด:{' '}
                            <strong>{ord.variantSize}</strong> · จำนวน{' '}
                            <span className="mono-num">{ord.quantity}</span> ชิ้น
                            (รับแล้ว{' '}
                            <span className="mono-num">{ord.deliveredQty}</span>/
                            <span className="mono-num">{ord.quantity}</span>) ·
                            ยอดรวม{' '}
                            <strong className="mono-num">
                              {formatThb(ord.totalPaidSatang, true)}
                            </strong>
                          </p>
                          <p className="muted-inline">
                            {ord.sellerLabel} ·{' '}
                            {ord.deliveryMethod === 'pickup_at_expo'
                              ? 'รับที่บูธร้านค้าหน้างาน'
                              : `จัดส่งไปรษณีย์: ${ord.shippingAddress ?? ''}`}
                          </p>
                        </div>

                        <div className="pass-qr-card">
                          <span className="muted-inline">รหัสรับสินค้า</span>
                          <strong className="mono-code">{ord.pickupToken}</strong>
                          <small className="muted-inline">
                            สถานะส่งมอบ:{' '}
                            {ord.fulfillmentStatus === 'completed'
                              ? 'รับสินค้าครบแล้ว'
                              : ord.fulfillmentStatus === 'partial_received'
                              ? 'รับสินค้าบางส่วนแล้ว'
                              : ord.fulfillmentStatus === 'ready_or_shipped'
                              ? 'พร้อมรับ / จัดส่งแล้ว'
                              : 'กำลังเตรียมของ'}
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

  /* ================= SUBVIEW 2: EVENT DETAIL (REGISTRATION + STOREFRONT) ================= */
  if (subView === 'event_detail' && selectedEvent) {
    const org = organizations.find(
      (o) => o.id === selectedEvent.organizationId
    );
    const openSeats = getEventOpenSeats(selectedEvent);
    const canManageThisEvent = currentUser?.memberships.some(
      (m) => m.organizationId === selectedEvent.organizationId
    );

    return (
      <main className="customer-container">
        <div className="detail-back-bar">
          <button
            type="button"
            className="btn-ghost-sm"
            onClick={() => onNavigate('directory', null)}
          >
            <IconArrowLeft size={15} />
            <span>กลับหน้ารวมงานวิ่งทั้งหมด</span>
          </button>

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
              จัดการงานนี้ใน Organizer Dashboard
            </button>
          )}
        </div>

        <section className="event-detail-hero">
          <div className="detail-cover-box">
            <EventCoverArtwork
              motif={selectedEvent.coverMotif}
              className="detail-cover-svg"
            />
          </div>

          <div className="detail-hero-body">
            <div className="detail-meta-top">
              <EventStatusBadge status={selectedEvent.status} />
              <span className="race-type-tag">{selectedEvent.raceType}</span>
              <span className="mono-code">{selectedEvent.code}</span>
            </div>

            <h1>{selectedEvent.titleTh}</h1>
            <p className="muted-block">{selectedEvent.tagline}</p>

            <div className="detail-key-facts">
              <div>
                <IconCalendar size={16} />
                <span>
                  วันแข่งขัน:{' '}
                  <strong className="mono-num">{selectedEvent.eventDate}</strong>
                </span>
              </div>
              <div>
                <IconMapPin size={16} />
                <span>
                  {selectedEvent.province} · {selectedEvent.venue}
                </span>
              </div>
              <div>
                <IconBib size={16} />
                <span>
                  โควตาว่างรวม:{' '}
                  <strong className="mono-num">
                    {openSeats} / {selectedEvent.totalEventQuota}
                  </strong>{' '}
                  สิทธิ์ · ผู้จัด: {org?.nameTh}
                </span>
              </div>
            </div>
          </div>
        </section>

        {selectedEvent.statusNote && (
          <div className="status-explanation-banner" role="status">
            <IconAlert size={17} />
            <span>{selectedEvent.statusNote}</span>
          </div>
        )}

        <div
          className="detail-mode-tabs"
          role="tablist"
          aria-label="เลือกส่วนบริการของงานวิ่งนี้"
        >
          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'register'}
            className={`detail-tab-btn ${
              detailTab === 'register' ? 'active' : ''
            }`}
            onClick={() => setDetailTab('register')}
          >
            <IconBib size={16} />
            <span>สมัครเข้าร่วมวิ่ง (รับสิทธิ์ BIB)</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'storefront'}
            className={`detail-tab-btn ${
              detailTab === 'storefront' ? 'active' : ''
            }`}
            onClick={() => setDetailTab('storefront')}
          >
            <IconBag size={16} />
            <span>
              ร้านค้าของงาน ({selectedEvent.products.length} รายการ — ไม่สมัครวิ่งก็ซื้อได้)
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={detailTab === 'info_results'}
            className={`detail-tab-btn ${
              detailTab === 'info_results' ? 'active' : ''
            }`}
            onClick={() => setDetailTab('info_results')}
          >
            <IconCamera size={16} />
            <span>กำหนดการ & ผลการแข่งขัน/รูปภาพ</span>
          </button>
        </div>

        {/* TAB 1: RACE REGISTRATION + OPTIONAL MERCH ADD-ON */}
        {detailTab === 'register' && (
          <section className="clean-panel">
            {selectedEvent.status !== 'published' ? (
              <div className="empty-state-box">
                <h2>งานวิ่งนี้ไม่ได้เปิดรับสมัครในขณะนี้</h2>
                <p>
                  คุณสามารถเปิดดูผลการแข่งขัน อัลบั้มภาพหลังงาน หรือเลือกซื้อสินค้าที่ระลึกที่เปิดขายในแท็บร้านค้าของงานได้
                </p>
                <div className="cta-inline-row">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setDetailTab('info_results')}
                  >
                    ดูผลการแข่งขันและรูปภาพ
                  </button>
                  {selectedEvent.products.length > 0 && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setDetailTab('storefront')}
                    >
                      เปิดร้านค้าของงาน
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
                    ? 'ยืนยันการสมัครวิ่งเรียบร้อยแล้ว'
                    : 'กันโควตาชั่วคราวแล้ว (รอชำระเงินภายใน 15 นาที)'}
                </h2>
                <p className="muted-block">
                  ใบสมัคร <strong className="mono-code">{createdResult.reg.regCode}</strong>
                  {createdResult.addonOrder && (
                    <>
                      {' '}
                      และคำสั่งซื้อสินค้าเพิ่ม{' '}
                      <strong className="mono-code">
                        {createdResult.addonOrder.merchOrderCode}
                      </strong>
                    </>
                  )}{' '}
                  ถูกบันทึกเข้าสู่ระบบจำลองและอัปเดตไปยังหน้า Dashboard ผู้จัดงานทันที
                </p>

                <div className="receipt-summary-box">
                  <div>
                    <span className="muted-inline">ผู้เข้าแข่งขัน</span>
                    <strong>{createdResult.reg.participantNameTh}</strong>
                  </div>
                  <div>
                    <span className="muted-inline">เสื้อตามสิทธิ์สมัคร</span>
                    <strong>ไซส์ {createdResult.reg.shirtSize}</strong>
                  </div>
                  <div>
                    <span className="muted-inline">QR Token รับ BIB</span>
                    <strong className="mono-code">
                      {createdResult.reg.qrCheckInToken}
                    </strong>
                  </div>
                  <div>
                    <span className="muted-inline">ยอดค่าสมัครสุทธิ</span>
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
                    ไปหน้าบัตรวิ่งและคำสั่งซื้อของฉัน
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setCreatedResult(null);
                      setRegStep(1);
                    }}
                  >
                    สมัครเพิ่มอีกท่าน
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegistrationSubmit} className="wizard-stack">
                <div className="wizard-steps-indicator">
                  <button
                    type="button"
                    className={`step-pill ${regStep === 1 ? 'current' : 'done'}`}
                    onClick={() => setRegStep(1)}
                  >
                    1. เลือกระยะทาง & เสื้อ
                  </button>
                  <button
                    type="button"
                    className={`step-pill ${
                      regStep === 2 ? 'current' : regStep > 2 ? 'done' : ''
                    }`}
                    onClick={() => setRegStep(2)}
                  >
                    2. ข้อมูลผู้สมัคร & กติกา
                  </button>
                  <button
                    type="button"
                    className={`step-pill ${regStep === 3 ? 'current' : ''}`}
                    onClick={() => setRegStep(3)}
                  >
                    3. สรุปยอดแยกรายการ & ยืนยัน
                  </button>
                </div>

                {regStep === 1 && activeCategory && (
                  <div className="wizard-pane">
                    <h2>เลือกระยะทาง เสื้อตามสิทธิ์ และสินค้าซื้อเพิ่ม (ไม่บังคับ)</h2>
                    <p className="muted-block">
                      นโยบายค่าบริการงานนี้:{' '}
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
                                <strong>{cat.code}</strong>
                              </span>
                              <span className="mono-num muted-inline">
                                ว่าง {left}/{cat.categoryQuota}
                              </span>
                            </div>
                            <strong>{cat.name}</strong>
                            <span className="muted-inline mono-num">
                              ปล่อยตัว {cat.startTimeLocal} น. · Cut-off{' '}
                              {cat.cutoffHours} ชม.
                            </span>
                            <div className="dist-opt-price">
                              <strong className="mono-num">
                                {formatThb(quote.runnerNetPaySatang, true)}
                              </strong>
                              <small className="muted-inline">
                                ช่วง {tier.label} (ป้าย{' '}
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
                      <h3>ขนาดเสื้อแข่งขันที่รวมในแพ็กเกจสมัครแล้ว</h3>
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
                                <strong>ไซส์ {st.size}</strong>
                                <span className="mono-num">เหลือ {rem}</span>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    {selectedEvent.products.length > 0 && (
                      <div className="addon-box">
                        <h3>ซื้อสินค้าที่ระลึกเพิ่มพร้อมการสมัคร (ทางเลือก — แยกรายการจากค่าสมัคร)</h3>
                        <div className="form-grid-2">
                          <div className="form-row">
                            <label htmlFor="addon-sel">เลือกรายการซื้อเพิ่ม</label>
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
                                ไม่ซื้อสินค้าเพิ่ม (รับเฉพาะสิทธิ์ตามแพ็กเกจสมัคร)
                              </option>
                              {selectedEvent.products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  + {p.nameTh} ({formatThb(p.priceSatang)})
                                </option>
                              ))}
                            </select>
                          </div>

                          {selectedAddonProduct && (
                            <div className="form-row">
                              <label htmlFor="addon-sz">ขนาดสินค้าซื้อเพิ่ม</label>
                              <select
                                id="addon-sz"
                                value={addonSize}
                                onChange={(e) => setAddonSize(e.target.value)}
                              >
                                {selectedAddonProduct.availableSizes.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
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
                        ระยะที่เลือก: <strong>{activeCategory.name}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setRegStep(2)}
                      >
                        <span>ถัดไป: ข้อมูลผู้สมัคร</span>
                        <IconArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {regStep === 2 && (
                  <div className="wizard-pane">
                    <h2>กรอกข้อมูลผู้เข้าแข่งขันและยอมรับกติกางาน</h2>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={registerForSelf}
                        onChange={(e) => setRegisterForSelf(e.target.checked)}
                      />
                      <span>สมัครให้ตนเอง (ผู้ซื้อและผู้เข้าแข่งขันเป็นบุคคลเดียวกัน)</span>
                    </label>

                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="reg-b-name">ชื่อ-นามสกุลผู้ซื้อคำสั่งซื้อ</label>
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
                            ชื่อ-นามสกุลผู้เข้าแข่งขันจริง
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
                        <label htmlFor="reg-p-en">ชื่อภาษาอังกฤษบนป้าย BIB</label>
                        <input
                          id="reg-p-en"
                          type="text"
                          value={participantNameEn}
                          onChange={(e) => setParticipantNameEn(e.target.value)}
                        />
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
                          <strong>[จำเป็น]</strong> ยอมรับกติกาการแข่งขันและเงื่อนไขความปลอดภัยฉบับ{' '}
                          <span className="mono-code">
                            {selectedEvent.rulesVersion}
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
                          [ไม่บังคับ] ยินยอมรับข่าวสารประชาสัมพันธ์จากผู้จัดงาน
                        </span>
                      </label>
                    </div>

                    <div className="wizard-nav-row">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setRegStep(1)}
                      >
                        ย้อนกลับ
                      </button>
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => setRegStep(3)}
                      >
                        <span>ถัดไป: ตรวจสอบยอดรวม</span>
                        <IconArrowRight size={15} />
                      </button>
                    </div>
                  </div>
                )}

                {regStep === 3 && activeCategory && (
                  <div className="wizard-pane">
                    <h2>สรุปยอดชำระแยกรายการก่อนยืนยัน</h2>
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
                              ค่าสมัครวิ่ง {activeCategory.name} ({tier.label}) ·
                              เสื้อสิทธิ์สมัครไซส์ {shirtSize}
                            </span>
                            <span className="mono-num">
                              {formatThb(quote.baseSatang, true)}
                            </span>
                          </div>
                          <div className="breakdown-line">
                            <span>ค่าบริการแพลตฟอร์มฝั่งผู้สมัคร</span>
                            <span className="mono-num">
                              {formatThb(quote.runnerFeeSatang, true)}
                            </span>
                          </div>
                          {selectedAddonProduct && (
                            <div className="breakdown-line">
                              <span>
                                สินค้าซื้อเพิ่ม: {selectedAddonProduct.nameTh} (
                                {addonSize}) — รับหน้างาน
                              </span>
                              <span className="mono-num">
                                {formatThb(addonSatang, true)}
                              </span>
                            </div>
                          )}
                          <div className="breakdown-line breakdown-total">
                            <strong>ยอดชำระสุทธิรวมทั้งหมด</strong>
                            <strong className="mono-num text-vermilion">
                              {formatThb(grandTotal, true)}
                            </strong>
                          </div>
                        </div>
                      );
                    })()}

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={simulateWebhookSuccess}
                        onChange={(e) =>
                          setSimulateWebhookSuccess(e.target.checked)
                        }
                      />
                      <span>
                        จำลองผลชำระเงินสำเร็จทันทีผ่าน Webhook (หากเอาออกจะพักไว้เป็นรายการกันโควตารอชำระ)
                      </span>
                    </label>

                    {checkoutError && (
                      <div className="error-callout" role="alert">
                        <IconAlert size={16} />
                        <div className="callout-flex">
                          <span>{checkoutError}</span>
                          {currentUser && !currentUser.emailVerified && (
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={onOpenAccountSecurity}
                            >
                              ไปหน้าเพิ่มและยืนยันอีเมล
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
                        ย้อนกลับ
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
                          <span>เข้าสู่ระบบเพื่อยืนยันการสมัคร</span>
                        </button>
                      ) : (
                        <button type="submit" className="btn-cta-accent">
                          <IconCheckCircle size={16} />
                          <span>ยืนยันการสมัครและชำระเงินจำลอง</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </form>
            )}
          </section>
        )}

        {/* TAB 2: EVENT STOREFRONT FOR GENERAL CUSTOMERS */}
        {detailTab === 'storefront' && (
          <section className="clean-panel">
            <h2>
              หน้าร้านประจำงานวิ่ง (ลูกค้าทั่วไปซื้อได้โดยไม่เกิดใบสมัครวิ่ง)
            </h2>
            <p className="muted-block">
              ระบุผู้ขาย สถานะพร้อมขาย/พรีออเดอร์ เพดานขั้นต่ำ วันปิดรับ และผู้รับผิดชอบจัดส่งอย่างชัดเจนในทุกรายการ
              {linkedRegForMerch && (
                <>
                  {' '}
                  · กำลังสั่งซื้อเพิ่มโดยอ้างอิงใบสมัครเดิม{' '}
                  <span className="mono-code">{linkedRegForMerch}</span>{' '}
                  (สร้างคำสั่งซื้อใหม่แยกจากยอดใบสมัครเดิม)
                </>
              )}
            </p>

            {selectedEvent.products.length === 0 ? (
              <div className="subtle-empty-note">
                งานวิ่งนี้ยังไม่ได้เปิดรายการสินค้าหน้าร้านเพิ่มเติม
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
                            <span>{prd.categoryLabel}</span>
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
                                ? 'พร้อมขายตามสต็อก'
                                : `พรีออเดอร์ · ปิดรับ ${prd.preorderCloseDate}`}
                            </span>
                          </span>
                        </div>

                        <h3>{prd.nameTh}</h3>
                        <p className="muted-block">{prd.description}</p>

                        <div className="merch-policy-meta">
                          <div>
                            <strong>{prd.sellerLabel}</strong> ·{' '}
                            {prd.fulfillmentOwnerLabel}
                          </div>
                          <div>กำหนดส่งมอบ: {prd.estimatedDeliveryNote}</div>
                          <div>เงื่อนไข: {prd.refundAndMinPolicyNote}</div>
                        </div>

                        <div className="merch-item-foot">
                          <div>
                            <strong className="net-price-figure mono-num">
                              {formatThb(prd.priceSatang)}
                            </strong>
                            <span className="muted-inline mono-num">
                              {' '}
                              · คงเหลือ {remaining}/{prd.stockOrCeiling} ชิ้น
                              {prd.preorderMinQty
                                ? ` (ยอดจองปัจจุบัน ${prd.soldCount}/${prd.preorderMinQty} ขั้นต่ำ)`
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
                            {isPicked ? 'เลือกอยู่' : 'เลือกสินค้านี้'}
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
                    <h3>สรุปคำสั่งซื้อสินค้า</h3>
                    <p className="muted-inline">
                      สินค้า: <strong>{activeProduct.nameTh}</strong>
                    </p>

                    <div className="form-grid-2">
                      <div className="form-row">
                        <label htmlFor="sf-size">ขนาด / ตัวเลือก</label>
                        <select
                          id="sf-size"
                          value={merchSize}
                          onChange={(e) => setMerchSize(e.target.value)}
                        >
                          {activeProduct.availableSizes.map((sz) => (
                            <option key={sz} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-row">
                        <label htmlFor="sf-qty">จำนวน</label>
                        <select
                          id="sf-qty"
                          value={merchQty}
                          onChange={(e) => setMerchQty(Number(e.target.value))}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n} ชิ้น
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="sf-deliv">ช่องทางรับสินค้า</label>
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
                          รับที่บูธร้านค้าหน้างานด้วยหลักฐานคำสั่งซื้อ (ฟรีค่าส่ง)
                        </option>
                        <option value="postal_shipping">
                          จัดส่งทางไปรษณีย์ (+
                          {formatThb(activeProduct.shippingFeeSatang)})
                        </option>
                      </select>
                    </div>

                    {(selectedEvent.status === 'completed' ||
                      deliveryMethod === 'postal_shipping') && (
                      <div className="form-row">
                        <label htmlFor="sf-addr">ที่อยู่สำหรับจัดส่งพัสดุ</label>
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
                        <span>ค่าสินค้า ({merchQty} ชิ้น)</span>
                        <span className="mono-num">
                          {formatThb(activeProduct.priceSatang * merchQty, true)}
                        </span>
                      </div>
                      <div className="breakdown-line">
                        <span>ค่าจัดส่ง</span>
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
                        <strong>ยอดรวมคำสั่งซื้อนี้</strong>
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
                        <span>เข้าสู่ระบบเพื่อสั่งซื้อสินค้า</span>
                      </button>
                    ) : (
                      <button type="submit" className="btn-primary btn-full">
                        <IconBag size={16} />
                        <span>ชำระเงินจำลองและออกรหัสรับสินค้า</span>
                      </button>
                    )}

                    {createdMerchReceipt && (
                      <div className="success-callout" role="status">
                        <IconCheckCircle size={18} />
                        <div>
                          <strong>
                            สร้างคำสั่งซื้อ {createdMerchReceipt.merchOrderCode}{' '}
                            สำเร็จ
                          </strong>
                          <p>
                            รหัสรับของ: <code>{createdMerchReceipt.pickupToken}</code>{' '}
                            (คำสั่งซื้อนี้ไม่สร้างสิทธิ์แข่งขันหรือเลข BIB)
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

        {/* TAB 3: SCHEDULE & RESULTS/PHOTOS */}
        {detailTab === 'info_results' && (
          <section className="clean-panel">
            <h2>กำหนดการรับอุปกรณ์และบริการหลังงาน</h2>
            <p className="muted-block">
              จุดและเวลารับเสื้อแข่งขัน/ป้าย BIB:{' '}
              <strong>{selectedEvent.kitPickupWindow}</strong>
            </p>
            <ul className="compact-bullet-list">
              {selectedEvent.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>

            {selectedEvent.verifiedPhotoAlbums &&
              selectedEvent.verifiedPhotoAlbums.length > 0 && (
                <div className="completed-showcase-box">
                  <h3>ผลการแข่งขันและอัลบั้มภาพหลังงาน (ผู้จัดตรวจสอบแล้ว)</h3>
                  <div className="album-list">
                    {selectedEvent.verifiedPhotoAlbums.map((alb) => (
                      <div key={alb.id} className="album-item-row">
                        <div>
                          <strong>{alb.title}</strong>
                          <div className="muted-inline">
                            {alb.photographerCredit} ·{' '}
                            <span className="mono-num">
                              {alb.photoCount.toLocaleString('th-TH')}
                            </span>{' '}
                            ภาพ
                          </div>
                        </div>
                        <span className="status-pill badge-forest">
                          <IconCamera size={13} />
                          <span>ตรวจสอบแล้ว</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </section>
        )}
      </main>
    );
  }

  /* ================= SUBVIEW 1: MODERN MINIMAL DIRECTORY ================= */
  return (
    <main className="customer-container">
      <section className="minimal-hero">
        <div className="minimal-hero-copy">
          <h1>ค้นหางานวิ่งทั่วไทย สมัครง่าย เห็นราคาสุทธิชัดเจนก่อนจ่าย</h1>
          <p className="muted-block">
            ลงสมัครงานวิ่งพร้อมรับบัตร QR รับอุปกรณ์หน้างาน หรือเลือกซื้อเสื้อและเหรียญที่ระลึกจากหน้าร้านแต่ละงานได้ทันทีโดยไม่ต้องสมัครแข่ง
          </p>
        </div>

        <div className="minimal-hero-search">
          <label htmlFor="dir-q" className="field-caption">
            ค้นหาชื่องานวิ่ง จังหวัด หรือสถานที่ปล่อยตัว
          </label>
          <div className="input-with-icon">
            <IconSearch size={17} />
            <input
              id="dir-q"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="พิมพ์ชื่อจังหวัดหรือชื่องาน เช่น เชียงใหม่, ภูเก็ต..."
            />
          </div>

          <div className="quick-pill-bar" role="group" aria-label="หมวดงานวิ่ง">
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
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="clean-filter-strip" aria-label="ตัวกรองระยะทางและภูมิภาค">
        <div className="inline-select-group">
          <div className="inline-select-item">
            <label htmlFor="flt-dist">ระยะทาง</label>
            <select
              id="flt-dist"
              value={distanceFilter}
              onChange={(e) => setDistanceFilter(e.target.value)}
            >
              <option value="all">ทุกระยะทาง</option>
              <option value="5k">Fun Run ~ 5K</option>
              <option value="10k">Mini Marathon 10K</option>
              <option value="21k">Half Marathon 21.1K</option>
              <option value="trail">Trail Running</option>
            </select>
          </div>

          <div className="inline-select-item">
            <label htmlFor="flt-reg">ภูมิภาค</label>
            <select
              id="flt-reg"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            >
              <option value="all">ทุกภูมิภาค</option>
              <option value="เหนือ">ภาคเหนือ</option>
              <option value="ใต้">ภาคใต้</option>
              <option value="กลางและกรุงเทพฯ">ภาคกลางและกรุงเทพฯ</option>
              <option value="อีสาน">ภาคอีสาน</option>
            </select>
          </div>
        </div>

        <span className="muted-inline">
          พบ <strong className="mono-num">{filteredEvents.length}</strong> งานวิ่ง
        </span>
      </section>

      {filteredEvents.length === 0 ? (
        <div className="empty-state-box">
          <h2>ไม่พบงานวิ่งตามตัวกรองที่เลือก</h2>
          <p>สามารถล้างตัวกรองเพื่อดูงานวิ่งทั้งหมดที่เปิดแสดงผลได้ทันที</p>
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
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <section className="modern-event-grid" aria-label="รายการงานวิ่ง">
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
                  <EventCoverArtwork
                    motif={ev.coverMotif}
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
                      <strong className="mono-num">{ev.eventDate}</strong>
                    </span>
                    <span>
                      <IconMapPin size={14} /> {ev.province}
                    </span>
                    <span className="race-type-tag">{ev.raceType}</span>
                  </div>

                  <h2>{ev.titleTh}</h2>
                  <p className="card-tagline">{ev.tagline}</p>

                  <div className="category-chip-group">
                    {ev.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className={`category-bib-chip tone-${cat.colorTag}`}
                      >
                        <strong>{cat.code}</strong>
                      </span>
                    ))}
                    {ev.products.length > 0 && (
                      <span className="shop-available-pill">
                        <IconBag size={13} />
                        <span>ร้านเสื้อ/เหรียญ ({ev.products.length})</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="card-footer-bar">
                  <div className="card-price-block">
                    {sampleQuote && (
                      <>
                        <span className="muted-inline">
                          เริ่มต้นสุทธิ{' '}
                          {ev.feeBearerPolicy === 'organizer_absorbs'
                            ? '(ฟรีค่าบริการ)'
                            : '(รวมค่าบริการ)'}
                        </span>
                        <strong className="card-price-num mono-num">
                          {formatThb(sampleQuote.runnerNetPaySatang, true)}
                        </strong>
                      </>
                    )}
                    <small className="muted-inline mono-num">
                      ว่าง {openSeats}/{ev.totalEventQuota} สิทธิ์
                    </small>
                  </div>

                  <div className="card-actions">
                    {ev.products.length > 0 && (
                      <button
                        type="button"
                        className="btn-ghost-sm"
                        onClick={() => openEventPage(ev, 'storefront')}
                      >
                        ร้านค้างาน
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
                          ? 'สมัครวิ่ง'
                          : ev.status === 'completed'
                          ? 'ผล & รูปภาพ'
                          : 'รายละเอียด'}
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
        aria-label="บริการสั่งทำเสื้อและเหรียญสำหรับชมรมหรือองค์กร"
      >
        <div>
          <h2>ต้องการสั่งทำเสื้อวิ่งหรือเหรียญที่ระลึกสำหรับชมรม ทีม หรือกิจกรรมบริษัท?</h2>
          <p className="muted-block">
            ส่งแบบหรือความต้องการเพื่อขอใบเสนอราคาผลิตกับทีมงานได้โดยไม่จำเป็นต้องเปิดงานวิ่งบนแพลตฟอร์ม
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onNavigate('custom_production', null)}
        >
          <IconShirt size={16} />
          <span>ขอใบเสนอราคาสั่งผลิต</span>
        </button>
      </section>
    </main>
  );
};
