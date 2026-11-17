import React, { useMemo, useState } from 'react';
import {
  DemoUser,
  Organization,
  RaceCategory,
  RaceEvent,
  RegistrationRecord,
} from '../types';
import {
  calculateFeeQuote,
  feePolicyLabel,
  formatThb,
  getCurrentTier,
} from '../utils/pricing';
import {
  IconAlert,
  IconArrowRight,
  IconBib,
  IconCalendar,
  IconCamera,
  IconCheckCircle,
  IconMapPin,
  IconQr,
  IconSearch,
} from './Icons';
import {
  EventStatusBadge,
  FulfillmentStatusBadge,
  PaymentStatusBadge,
  RegStatusBadge,
} from './StatusBadges';

interface PublicEventsViewProps {
  events: RaceEvent[];
  organizations: Organization[];
  registrations: RegistrationRecord[];
  currentUser: DemoUser | null;
  onRequireRunnerLogin: () => void;
  onOpenOrganizerDashboard: (orgId: string, eventId?: string) => void;
  onCreateDemoRegistration: (payload: {
    eventId: string;
    categoryId: string;
    buyerName: string;
    participantNameTh: string;
    participantNameEn: string;
    shirtSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL';
    marketingConsent: boolean;
    simulateImmediateWebhook: boolean;
  }) => RegistrationRecord;
  onUpdateRunnerShirtSize: (
    regId: string,
    newSize: 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL'
  ) => void;
}

export const PublicEventsView: React.FC<PublicEventsViewProps> = ({
  events,
  organizations,
  registrations,
  currentUser,
  onRequireRunnerLogin,
  onOpenOrganizerDashboard,
  onCreateDemoRegistration,
  onUpdateRunnerShirtSize,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [lifecycleFilter, setLifecycleFilter] = useState<
    'all' | 'open' | 'completed'
  >('all');

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [buyerName, setBuyerName] = useState(
    currentUser?.fullNameTh.replace(' (นักวิ่งสาธิต)', '').replace(' (สาธิต)', '') ||
      'กานต์พิชชา วัฒนากูล'
  );
  const [participantNameTh, setParticipantNameTh] = useState(
    currentUser?.fullNameTh.replace(' (นักวิ่งสาธิต)', '').replace(' (สาธิต)', '') ||
      'กานต์พิชชา วัฒนากูล'
  );
  const [participantNameEn, setParticipantNameEn] = useState(
    currentUser?.fullNameEn || 'Kanpitcha Wattanakul'
  );
  const [shirtSize, setShirtSize] = useState<
    'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL'
  >('M');
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [simulateWebhookSuccess, setSimulateWebhookSuccess] = useState(true);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [createdReceipt, setCreatedReceipt] =
    useState<RegistrationRecord | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'discover' | 'my_entries'>(
    'discover'
  );

  // Public directory exposes published, closed, completed, and suspended (with notice), never internal drafts
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

      const matchesLifecycle =
        lifecycleFilter === 'all' ||
        (lifecycleFilter === 'open' && ev.status === 'published') ||
        (lifecycleFilter === 'completed' && ev.status === 'completed');

      return matchesText && matchesRegion && matchesDist && matchesLifecycle;
    });
  }, [
    publicVisibleEvents,
    searchQuery,
    regionFilter,
    distanceFilter,
    lifecycleFilter,
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

  const myRunnerRegistrations = useMemo(() => {
    if (!currentUser) return [];
    return registrations.filter(
      (r) =>
        r.runnerUserId === currentUser.id ||
        r.email.toLowerCase() === currentUser.email.toLowerCase()
    );
  }, [registrations, currentUser]);

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

  const openEventSheet = (ev: RaceEvent) => {
    setSelectedEventId(ev.id);
    setSelectedCatId(ev.categories[0]?.id ?? '');
    setAcceptedRules(false);
    setCheckoutError(null);
    setCreatedReceipt(null);
  };

  const handleDemoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent || !activeCategory) return;

    if (!participantNameTh.trim() || !buyerName.trim()) {
      setCheckoutError('กรุณาระบุชื่อผู้ซื้อและชื่อผู้เข้าร่วมการแข่งขันให้ครบถ้วน');
      return;
    }
    if (!acceptedRules) {
      setCheckoutError(
        `ต้องกดยอมรับกติกาการแข่งขัน (${selectedEvent.rulesVersion}) ก่อนสร้างรายการจองโควตา`
      );
      return;
    }
    const catSeats = getCategoryOpenSeats(selectedEvent.id, activeCategory);
    const eventSeats = getEventOpenSeats(selectedEvent);
    if (catSeats <= 0 || eventSeats <= 0) {
      setCheckoutError('โควตาระยะนี้หรือโควตารวมของงานเต็มแล้ว ระบบป้องกันการขายเกินอัตโนมัติ');
      return;
    }

    setCheckoutError(null);
    const receipt = onCreateDemoRegistration({
      eventId: selectedEvent.id,
      categoryId: activeCategory.id,
      buyerName: buyerName.trim(),
      participantNameTh: participantNameTh.trim(),
      participantNameEn: participantNameEn.trim() || 'Demo Runner',
      shirtSize,
      marketingConsent,
      simulateImmediateWebhook: simulateWebhookSuccess,
    });
    setCreatedReceipt(receipt);
  };

  return (
    <div className="public-shell">
      <header className="public-hero-banner">
        <div className="public-hero-main">
          <h1>ศูนย์รวมงานวิ่งไทยและระบบรับสมัครราคาสุทธิโปร่งใส</h1>
          <p className="public-hero-lead">
            รวมแนวคิดการค้นหางานวิ่งและอัลบั้มภาพหลังงานจากฝั่งประสบการณ์นักวิ่ง
            เข้ากับการตั้งราคาตามช่วงเวลา การกันโควตาแบบ Atomic และการแสดงผู้รับภาระค่าบริการชัดเจนก่อนชำระเงิน
          </p>

          <div className="public-subnav-row" role="tablist" aria-label="มุมมองฝั่งนักวิ่ง">
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'discover'}
              className={`subnav-tab ${activeSubTab === 'discover' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('discover')}
            >
              <IconSearch size={16} />
              <span>ค้นหางานวิ่งทั้งหมด ({publicVisibleEvents.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSubTab === 'my_entries'}
              className={`subnav-tab ${activeSubTab === 'my_entries' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('my_entries')}
            >
              <IconQr size={16} />
              <span>
                ใบสมัครและ QR รับอุปกรณ์ของฉัน ({myRunnerRegistrations.length})
              </span>
            </button>
          </div>
        </div>

        <aside className="business-model-callout" aria-label="สรุปกลไกโมเดลธุรกิจในต้นแบบ">
          <h2>กลไกโมเดลธุรกิจที่เชื่อมในหน้านี้</h2>
          <ul className="compact-bullet-list">
            <li>
              <strong>ผู้รับภาระค่าบริการเลือกได้ต่ออีเวนต์:</strong> ผู้จัดตั้งค่าได้ว่าให้นักวิ่งรับภาระ
              ผู้จัดรับภาระเอง หรือแบ่ง 50/50 และหน้านี้คำนวณราคาสุทธิทันที
            </li>
            <li>
              <strong>กันโควตาชั่วคราว + ยืนยันด้วย Webhook:</strong> แยกการจองโควตารอจ่ายออกจากสิทธิ์ยืนยันจริง
            </li>
            <li>
              <strong>บริการหลังงานระยะ MVP:</strong> งานที่จบแล้วแสดงลิงก์ผลและอัลบั้มภาพที่ผู้จัดตรวจแล้ว
              (ตลาดขายภาพ AI ค้นหา BIB อยู่ในแผนระยะถัดไป)
            </li>
          </ul>
        </aside>
      </header>

      {activeSubTab === 'my_entries' ? (
        <section className="runner-entries-panel" aria-label="ใบสมัครและสิทธิ์รับอุปกรณ์ของฉัน">
          <div className="section-title-bar">
            <h2>ใบสมัคร ประวัติการชำระ และบัตร QR รับอุปกรณ์</h2>
            {!currentUser && (
              <button
                type="button"
                className="btn-primary"
                onClick={onRequireRunnerLogin}
              >
                เข้าสู่ระบบบัญชีนักวิ่งสาธิต
              </button>
            )}
          </div>

          {!currentUser ? (
            <div className="empty-state-box">
              <h3>ยังไม่ได้เข้าสู่ระบบบัญชีนักวิ่ง</h3>
              <p>
                กดเข้าสู่ระบบด้วยบัญชีนักวิ่งสาธิตเพื่อดูตั๋ว QR รับอุปกรณ์ แก้ไซส์เสื้อก่อนเส้นตาย
                และเปิดลิงก์อัลบั้มภาพหลังงาน
              </p>
              <button
                type="button"
                className="btn-primary"
                onClick={onRequireRunnerLogin}
              >
                สลับไปหน้า Login เลือกบัญชีนักวิ่ง
              </button>
            </div>
          ) : myRunnerRegistrations.length === 0 ? (
            <div className="empty-state-box">
              <h3>ยังไม่มีประวัติใบสมัครในบัญชีนี้</h3>
              <p>เลือกงานวิ่งที่เปิดรับสมัครจากแท็บค้นหางานวิ่งเพื่อทดลองสมัครจำลอง</p>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setActiveSubTab('discover')}
              >
                กลับไปเลือกงานวิ่ง
              </button>
            </div>
          ) : (
            <div className="runner-ticket-list">
              {myRunnerRegistrations.map((reg) => {
                const ev = events.find((e) => e.id === reg.eventId);
                const cat = ev?.categories.find((c) => c.id === reg.categoryId);
                const canEditShirt =
                  ev &&
                  ev.status === 'published' &&
                  reg.registrationStatus === 'confirmed' &&
                  reg.fulfillmentStatus === 'ready';

                return (
                  <article key={reg.id} className="runner-ticket-row">
                    <div className="ticket-top-strip">
                      <span className="mono-code">{reg.regCode}</span>
                      <span>คำสั่งซื้อ {reg.orderCode}</span>
                      <RegStatusBadge status={reg.registrationStatus} />
                      <PaymentStatusBadge status={reg.paymentStatus} />
                      <FulfillmentStatusBadge status={reg.fulfillmentStatus} />
                    </div>
                    <div className="ticket-body-grid">
                      <div>
                        <h3>{ev?.titleTh ?? reg.eventId}</h3>
                        <p className="muted-block">
                          ระยะ: <strong>{cat?.name ?? reg.categoryId}</strong> ·
                          วันงาน: <strong>{ev?.eventDate}</strong> · ผู้เข้าร่วม:{' '}
                          <strong>{reg.participantNameTh}</strong> (ผู้ซื้อ:{' '}
                          {reg.buyerName})
                        </p>
                        <p className="muted-block">
                          ยอดชำระสุทธิ:{' '}
                          <strong className="mono-num">
                            {formatThb(reg.snapshotTotalChargedSatang, true)}
                          </strong>{' '}
                          (ค่าสมัคร {formatThb(reg.snapshotBaseSatang)} + ค่าบริการฝั่งนักวิ่ง{' '}
                          {formatThb(reg.snapshotRunnerFeeSatang, true)}) · ยอมรับกติกา{' '}
                          <span className="mono-code">{reg.acceptedRulesVersion}</span>
                        </p>

                        {canEditShirt && (
                          <div className="inline-shirt-editor">
                            <label htmlFor={`shirt-${reg.id}`}>
                              แก้ไซส์เสื้อด้วยตนเอง (เปิดให้แก้ก่อนเส้นตาย {ev.editDeadlineDate}):
                            </label>
                            <select
                              id={`shirt-${reg.id}`}
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
                              {(['XS', 'S', 'M', 'L', 'XL', '2XL'] as const).map(
                                (s) => (
                                  <option key={s} value={s}>
                                    ไซส์ {s}
                                  </option>
                                )
                              )}
                            </select>
                          </div>
                        )}

                        {ev?.verifiedPhotoAlbums &&
                          ev.verifiedPhotoAlbums.length > 0 && (
                            <div className="post-race-links">
                              <IconCamera size={16} />
                              <span>อัลบั้มภาพหลังงานที่ผู้จัดตรวจแล้ว:</span>
                              {ev.verifiedPhotoAlbums.map((alb) => (
                                <a
                                  key={alb.id}
                                  href={alb.externalUrl}
                                  onClick={(evClick) => {
                                    evClick.preventDefault();
                                    openEventSheet(ev);
                                  }}
                                >
                                  {alb.title} ({alb.photoCount.toLocaleString('th-TH')} ภาพ)
                                </a>
                              ))}
                            </div>
                          )}
                      </div>

                      <div className="ticket-qr-stub">
                        <div className="bib-callout-number mono-num">
                          {reg.bibNumber ?? 'รอกำหนด BIB'}
                        </div>
                        <div className="qr-token-box">
                          <IconQr size={28} />
                          <div>
                            <div className="mono-code">{reg.qrCheckInToken}</div>
                            <small>
                              QR Token แบบสุ่ม (ไม่บรรจุเลขบัตร/เบอร์โทรใน QR)
                            </small>
                          </div>
                        </div>
                        <div className="muted-inline">
                          ขนาดเสื้อที่บันทึก: <strong>{reg.shirtSize}</strong>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="filter-bar-panel" aria-label="ตัวกรองค้นหางานวิ่ง">
            <div className="filter-field filter-search">
              <label htmlFor="pub-search">ค้นหาชื่องาน จังหวัด หรือสถานที่ปล่อยตัว</label>
              <div className="input-with-icon">
                <IconSearch size={16} />
                <input
                  id="pub-search"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="เช่น ดอยสุเทพ, เชียงใหม่, ภูเก็ต..."
                />
              </div>
            </div>

            <div className="filter-field">
              <label htmlFor="pub-region">ภูมิภาค</label>
              <select
                id="pub-region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
              >
                <option value="all">ทุกภูมิภาค</option>
                <option value="เหนือ">ภาคเหนือ</option>
                <option value="ใต้">ภาคใต้</option>
                <option value="กลางและกรุงเทพฯ">ภาคกลางและกรุงเทพฯ</option>
                <option value="อีสาน">ภาคอีสาน</option>
                <option value="ตะวันออก">ภาคตะวันออก</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="pub-dist">ระยะทาง / ประเภท</label>
              <select
                id="pub-dist"
                value={distanceFilter}
                onChange={(e) => setDistanceFilter(e.target.value)}
              >
                <option value="all">ทุกระยะทาง</option>
                <option value="5k">Fun Run ~ 5 กม.</option>
                <option value="10k">Mini Marathon ~ 10 กม.</option>
                <option value="21k">Half Marathon 21.1 กม.</option>
                <option value="trail">งานวิ่งเทรล (Trail)</option>
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="pub-status">ช่วงสถานะงาน</label>
              <select
                id="pub-status"
                value={lifecycleFilter}
                onChange={(e) =>
                  setLifecycleFilter(
                    e.target.value as 'all' | 'open' | 'completed'
                  )
                }
              >
                <option value="all">ทุกสถานะที่เผยแพร่</option>
                <option value="open">กำลังเปิดรับสมัคร</option>
                <option value="completed">จบงานแล้ว (ดูผล/อัลบั้มภาพ)</option>
              </select>
            </div>
          </section>

          <div className="public-content-split">
            <section className="event-directory-list" aria-label="รายการงานวิ่ง">
              {filteredEvents.length === 0 ? (
                <div className="empty-state-box">
                  <h3>ไม่พบงานวิ่งที่ตรงกับตัวกรองปัจจุบัน</h3>
                  <p>
                    คำค้นหาหรือตัวกรองภูมิภาค/ระยะทางที่เลือกไม่มีรายการตรงกัน
                    สามารถล้างตัวกรองเพื่อดูงานวิ่งสาธิตทั้งหมดได้ทันที
                  </p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setRegionFilter('all');
                      setDistanceFilter('all');
                      setLifecycleFilter('all');
                    }}
                  >
                    ล้างตัวกรองทั้งหมด
                  </button>
                </div>
              ) : (
                filteredEvents.map((ev) => {
                  const org = organizations.find(
                    (o) => o.id === ev.organizationId
                  );
                  const openSeats = getEventOpenSeats(ev);
                  const lowestCat = [...ev.categories].sort(
                    (a, b) =>
                      getCurrentTier(a).priceSatang -
                      getCurrentTier(b).priceSatang
                  )[0];
                  const lowestTier = lowestCat
                    ? getCurrentTier(lowestCat)
                    : null;
                  const sampleQuote = lowestTier
                    ? calculateFeeQuote(
                        lowestTier.priceSatang,
                        ev.feeBearerPolicy
                      )
                    : null;
                  const isSelected = selectedEvent?.id === ev.id;

                  return (
                    <article
                      key={ev.id}
                      className={`event-bib-row ${isSelected ? 'selected' : ''} ${
                        ev.status === 'suspended' ? 'suspended-row' : ''
                      }`}
                    >
                      <div className="event-bib-header">
                        <div className="event-bib-meta">
                          <span className="mono-code">{ev.code}</span>
                          <span>ผู้จัด: {org?.nameTh ?? ev.organizationId}</span>
                        </div>
                        <div className="event-bib-badges">
                          <span className="race-type-tag">{ev.raceType}</span>
                          <EventStatusBadge status={ev.status} />
                        </div>
                      </div>

                      <div className="event-bib-content">
                        <div className="event-bib-info">
                          <h2>{ev.titleTh}</h2>
                          <div className="event-facts-inline">
                            <span>
                              <IconCalendar size={15} /> {ev.eventDate} ({ev.timezone})
                            </span>
                            <span>
                              <IconMapPin size={15} /> {ev.province} · {ev.venue}
                            </span>
                          </div>

                          {ev.statusNote && (
                            <p className="status-explanation-banner">
                              <IconAlert size={15} />
                              <span>{ev.statusNote}</span>
                            </p>
                          )}

                          <div className="category-chip-group" aria-label="ระยะทางที่เปิด">
                            {ev.categories.map((cat) => {
                              const tier = getCurrentTier(cat);
                              const quote = calculateFeeQuote(
                                tier.priceSatang,
                                ev.feeBearerPolicy
                              );
                              const catLeft = getCategoryOpenSeats(ev.id, cat);
                              return (
                                <span
                                  key={cat.id}
                                  className={`category-bib-chip tone-${cat.colorTag}`}
                                >
                                  <strong>{cat.code}</strong> · ป้าย{' '}
                                  <span className="mono-num">
                                    {formatThb(tier.priceSatang)}
                                  </span>{' '}
                                  (สุทธิ{' '}
                                  <span className="mono-num">
                                    {formatThb(quote.runnerNetPaySatang, true)}
                                  </span>
                                  ) · ว่าง{' '}
                                  <span className="mono-num">
                                    {catLeft}/{cat.categoryQuota}
                                  </span>
                                </span>
                              );
                            })}
                          </div>

                          {ev.verifiedPhotoAlbums &&
                            ev.verifiedPhotoAlbums.length > 0 && (
                              <div className="album-preview-strip">
                                <IconCamera size={15} />
                                <span>
                                  ประกาศผลและอัลบั้มภาพตรวจสอบแล้ว{' '}
                                  {ev.verifiedPhotoAlbums.length} อัลบั้ม
                                </span>
                              </div>
                            )}
                        </div>

                        <div className="event-bib-cta">
                          {sampleQuote && (
                            <div className="net-price-box">
                              <span className="muted-inline">
                                ราคาสุทธิเริ่มต้น ({lowestTier?.label})
                              </span>
                              <strong className="net-price-figure mono-num">
                                {formatThb(sampleQuote.runnerNetPaySatang, true)}
                              </strong>
                              <small className="fee-bearer-micro">
                                {ev.feeBearerPolicy === 'runner_pays'
                                  ? `รวมค่าบริการ ${formatThb(sampleQuote.runnerFeeSatang, true)} แล้ว`
                                  : ev.feeBearerPolicy === 'organizer_absorbs'
                                  ? 'ฟรีค่าบริการฝั่งนักวิ่ง (ผู้จัดรับภาระ)'
                                  : `แบ่งค่าบริการ 50% (+${formatThb(sampleQuote.runnerFeeSatang, true)})`}
                              </small>
                            </div>
                          )}

                          <div className="quota-mini-readout mono-num">
                            โควตารวมว่าง {openSeats} / {ev.totalEventQuota} สิทธิ์
                          </div>

                          <div className="cta-stack">
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => openEventSheet(ev)}
                            >
                              <span>
                                {ev.status === 'published'
                                  ? 'ดูราคาสุทธิ / จำลองสมัคร'
                                  : ev.status === 'completed'
                                  ? 'ดูผลการแข่งขัน & อัลบั้มภาพ'
                                  : 'ดูรายละเอียดสถานะงาน'}
                              </span>
                              <IconArrowRight size={15} />
                            </button>

                            {currentUser?.kind === 'organizer' &&
                              currentUser.memberships.some(
                                (m) => m.organizationId === ev.organizationId
                              ) && (
                                <button
                                  type="button"
                                  className="btn-ghost-sm"
                                  onClick={() =>
                                    onOpenOrganizerDashboard(
                                      ev.organizationId,
                                      ev.id
                                    )
                                  }
                                >
                                  เปิดจัดการใน Organizer Dashboard
                                </button>
                              )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </section>

            <aside
              className="event-detail-drawer"
              aria-label="รายละเอียดงานและการคำนวณราคาสุทธิ"
            >
              {!selectedEvent ? (
                <div className="drawer-placeholder">
                  <h2>เลือกงานวิ่งเพื่อดูโครงสร้างราคาสุทธิหรือทดลองสมัคร</h2>
                  <p>
                    คลิกปุ่ม <strong>“ดูราคาสุทธิ / จำลองสมัคร”</strong> จากรายการด้านซ้าย
                    เพื่อทดสอบการกันโควตาแบบ Atomic การคำนวณค่าบริการตามนโยบายผู้จัด
                    และการส่งข้อมูลเข้าสู่ Organizer Dashboard ทันที
                  </p>
                </div>
              ) : (
                <div className="drawer-active-body">
                  <div className="drawer-header-row">
                    <span className="mono-code">{selectedEvent.code}</span>
                    <EventStatusBadge status={selectedEvent.status} />
                  </div>
                  <h2>{selectedEvent.titleTh}</h2>
                  <p className="muted-block">
                    จัดวันที่ {selectedEvent.eventDate} · {selectedEvent.venue} ·
                    รับอุปกรณ์: {selectedEvent.kitPickupWindow}
                  </p>

                  <ul className="compact-bullet-list">
                    {selectedEvent.highlights.map((hl, idx) => (
                      <li key={idx}>{hl}</li>
                    ))}
                  </ul>

                  {selectedEvent.status === 'completed' && (
                    <div className="completed-showcase-box">
                      <h3>ผลการแข่งขันและอัลบั้มภาพหลังงาน (MVP Scope)</h3>
                      <p className="muted-block">
                        ผู้จัดตรวจสอบความถูกต้องของลิงก์ก่อนเผยแพร่ให้นักวิ่งเปิดดูจากบัญชีของตน
                      </p>
                      <div className="album-list">
                        {selectedEvent.verifiedPhotoAlbums?.map((alb) => (
                          <div key={alb.id} className="album-item-row">
                            <div>
                              <strong>{alb.title}</strong>
                              <div className="muted-inline">
                                โดย {alb.photographerCredit} ·{' '}
                                {alb.photoCount.toLocaleString('th-TH')} ภาพ
                              </div>
                            </div>
                            <span className="status-pill badge-forest">
                              <IconCamera size={13} /> ตรวจสอบแล้ว
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="backlog-note">
                        หมายเหตุแผนผลิตภัณฑ์: ระบบค้นหาภาพด้วยใบหน้า/BIB อัตโนมัติและการแบ่งรายได้ขายภาพให้ช่างภาพ
                        อยู่ในแผนระยะถัดไป (Phase 2 Backlog) ยังไม่เปิดใช้ใน MVP นี้
                      </p>
                    </div>
                  )}

                  {selectedEvent.status === 'suspended' && (
                    <div className="suspended-notice-box">
                      <h3>งานนี้ถูกระงับการรับสมัครชั่วคราว</h3>
                      <p>{selectedEvent.statusNote}</p>
                      <p className="muted-inline">
                        ผู้สมัครเดิมยังเข้าดูหลักฐานการชำระเงินและสถานะคำสั่งซื้อในแท็บใบสมัครของฉันได้ตามปกติ
                      </p>
                    </div>
                  )}

                  {selectedEvent.status === 'published' && activeCategory && (
                    <form
                      className="demo-checkout-form"
                      onSubmit={handleDemoSubmit}
                    >
                      <h3>จำลองการสมัครวิ่ง (1 คนต่อคำสั่งซื้อในรุ่น MVP)</h3>

                      <div className="form-row">
                        <label htmlFor="chk-cat">เลือกระยะทางแข่งขัน</label>
                        <select
                          id="chk-cat"
                          value={activeCategory.id}
                          onChange={(e) => {
                            setSelectedCatId(e.target.value);
                            setCreatedReceipt(null);
                          }}
                        >
                          {selectedEvent.categories.map((c) => {
                            const tier = getCurrentTier(c);
                            const left = getCategoryOpenSeats(
                              selectedEvent.id,
                              c
                            );
                            return (
                              <option key={c.id} value={c.id}>
                                {c.name} — ช่วง {tier.label}{' '}
                                {formatThb(tier.priceSatang)} (ว่าง {left} สิทธิ์)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {(() => {
                        const tier = getCurrentTier(activeCategory);
                        const quote = calculateFeeQuote(
                          tier.priceSatang,
                          selectedEvent.feeBearerPolicy
                        );
                        return (
                          <div className="price-breakdown-box">
                            <div className="breakdown-line">
                              <span>
                                ค่าสมัครช่วง {tier.label} ({activeCategory.code})
                              </span>
                              <span className="mono-num">
                                {formatThb(quote.baseSatang, true)}
                              </span>
                            </div>
                            <div className="breakdown-line">
                              <span>
                                ค่าบริการแพลตฟอร์มฝั่งนักวิ่ง (
                                {feePolicyLabel(selectedEvent.feeBearerPolicy)})
                              </span>
                              <span className="mono-num">
                                {formatThb(quote.runnerFeeSatang, true)}
                              </span>
                            </div>
                            <div className="breakdown-line breakdown-total">
                              <strong>ยอดชำระสุทธิที่นักวิ่งต้องจ่าย</strong>
                              <strong className="mono-num text-vermilion">
                                {formatThb(quote.runnerNetPaySatang, true)}
                              </strong>
                            </div>
                            <div className="breakdown-footnote">
                              ฝั่งผู้จัดจะได้รับยอดสุทธิหลังหักค่าบริการส่วนผู้จัด:{' '}
                              <strong className="mono-num">
                                {formatThb(quote.organizerNetReceiveSatang, true)}
                              </strong>{' '}
                              (อัตราจำลองในต้นแบบ: 5% + ฿15)
                            </div>
                          </div>
                        );
                      })()}

                      <div className="form-grid-2">
                        <div className="form-row">
                          <label htmlFor="chk-buyer">ชื่อผู้ซื้อคำสั่งซื้อ (Buyer)</label>
                          <input
                            id="chk-buyer"
                            type="text"
                            value={buyerName}
                            onChange={(e) => setBuyerName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="chk-part-th">
                            ชื่อผู้เข้าร่วมแข่งขัน (Participant)
                          </label>
                          <input
                            id="chk-part-th"
                            type="text"
                            value={participantNameTh}
                            onChange={(e) =>
                              setParticipantNameTh(e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="form-grid-2">
                        <div className="form-row">
                          <label htmlFor="chk-part-en">
                            ชื่อภาษาอังกฤษบนป้าย BIB
                          </label>
                          <input
                            id="chk-part-en"
                            type="text"
                            value={participantNameEn}
                            onChange={(e) =>
                              setParticipantNameEn(e.target.value)
                            }
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="chk-shirt">ขนาดเสื้อแข่งขัน</label>
                          <select
                            id="chk-shirt"
                            value={shirtSize}
                            onChange={(e) =>
                              setShirtSize(
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
                            {selectedEvent.shirtStocks
                              .filter((s) => s.total > 0)
                              .map((s) => {
                                const rem = Math.max(
                                  0,
                                  s.total - s.reservedOrConfirmed
                                );
                                return (
                                  <option
                                    key={s.size}
                                    value={s.size}
                                    disabled={rem <= 0}
                                  >
                                    ไซส์ {s.size} (คงเหลือ {rem} ตัว)
                                  </option>
                                );
                              })}
                          </select>
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
                            [ไม่บังคับ — แยกจากกติกางาน] ยินยอมรับข่าวสารงานวิ่งถัดไปจากผู้จัดงาน
                          </span>
                        </label>

                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={simulateWebhookSuccess}
                            onChange={(e) =>
                              setSimulateWebhookSuccess(e.target.checked)
                            }
                          />
                          <span>
                            จำลองผล Webhook ยืนยันรับเงินสำเร็จทันที (หากเอาออก
                            จะสร้างรายการ <code>pending_payment</code> กันโควตาชั่วคราว 15 นาที)
                          </span>
                        </label>
                      </div>

                      {checkoutError && (
                        <div className="error-callout" role="alert">
                          <IconAlert size={16} />
                          <span>{checkoutError}</span>
                        </div>
                      )}

                      <button type="submit" className="btn-primary btn-full">
                        <IconBib size={16} />
                        <span>
                          {simulateWebhookSuccess
                            ? 'ยืนยันสมัครและจำลอง Webhook ชำระเงินสำเร็จ'
                            : 'สร้างคำสั่งซื้อกันโควตาชั่วคราว (Pending Payment)'}
                        </span>
                      </button>

                      {createdReceipt && (
                        <div className="success-callout" role="status">
                          <IconCheckCircle size={18} />
                          <div>
                            <strong>
                              บันทึกข้อมูลจำลองสำเร็จ ({createdReceipt.regCode})
                            </strong>
                            <p>
                              สถานะสิทธิ์:{' '}
                              <code>{createdReceipt.registrationStatus}</code> ·
                              QR Token: <code>{createdReceipt.qrCheckInToken}</code>{' '}
                              — ข้อมูลนี้ถูกเพิ่มเข้าในตารางผู้สมัครและสมการการเงินของ
                              Organizer Dashboard แล้วทันที!
                            </p>
                          </div>
                        </div>
                      )}
                    </form>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </div>
  );
};
