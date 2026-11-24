import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EventCoreText, EventRegisterCardConfig, RaceEvent } from '../types';
import { CORE_TEXT_LIMITS, coreTextOf } from '../data/eventDataPieces';
import { CARD_ICONS, normalizePageContent } from '../data/eventDetailLayout';
import { isTotalQuotaEnabled } from '../utils/eventConfig';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { CardIconPicker, CardInspector, TextList, withCardIcon } from './PageItemEditors';
import { PREVIEW_PARAM } from './pagePreview';

type Content = { coreText: Required<EventCoreText>; card: EventRegisterCardConfig };

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** parts of the page the form edits; the same keys mark the sections in the preview */
type PartKey = 'about' | 'racepack' | 'schedule' | 'card';
const PREVIEW_WIDTH = { desktop: 1280, phone: 390 } as const;
type Device = keyof typeof PREVIEW_WIDTH | 'off';

/**
 * Live look at the event page next to the form: the real page in an iframe (`?preview=page`) that
 * gets the unsaved text by postMessage as a look-only preview — nothing in it can be clicked through
 * or edited. Clicking a section in it jumps the form to that part; editing a part scrolls it into view.
 */
function ContentPreview({
  event,
  content,
  active,
  device,
  onPick,
}: {
  event: RaceEvent;
  content: Content;
  active: PartKey | null;
  device: Exclude<Device, 'off'>;
  onPick: (key: PartKey) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const width = PREVIEW_WIDTH[device];
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / width) : 1;

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth));
    ro.observe(el);
    setBoxWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const send = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage(
      {
        type: 'kr-page-preview',
        page: { layout: [], customBlocks: [], coreText: content.coreText, card: content.card },
        selected: active,
        readOnly: true,
      },
      window.location.origin
    );
  }, [content, active]);

  useEffect(() => {
    if (ready) send();
  }, [ready, send]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow) return;
      const data = e.data as { type?: string; key?: string };
      if (data?.type === 'kr-page-ready') setReady(true);
      if (data?.type === 'kr-page-pick' && (data.key === 'about' || data.key === 'racepack' || data.key === 'schedule' || data.key === 'card')) {
        onPick(data.key);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPick]);

  return (
    <div ref={boxRef} className={`pcs-preview-frame is-${device}`}>
      {!ready && <p className="pcs-preview-loading">{tx('กำลังโหลดตัวอย่าง…')}</p>}
      <iframe
        ref={frameRef}
        key={device}
        title={tx('ตัวอย่างหน้ารายละเอียดงาน (ดูอย่างเดียว)')}
        src={`/events/${encodeURIComponent(event.id)}?preview=${PREVIEW_PARAM}`}
        style={{ width, height: `${100 / scale}%`, transform: `scale(${scale})` }}
        onLoad={() => send()}
      />
    </div>
  );
}

/**
 * "Page content" (24 Nov 2026): the event page is one template for every event, and the organizer
 * only fills in its text — about the event, highlights, what runners get (with icons), the schedule
 * and the register card's two lines. Prices, seats, venue and souvenirs come from their own menus.
 * See docs/registration-form-editor-plan.md (part A).
 */
export function EventPageContent({
  event,
  canEdit,
  onSave,
  onOpenSection,
}: {
  event: RaceEvent;
  canEdit: boolean;
  onSave: (content: Content) => Promise<{ ok: boolean; error?: string }>;
  onOpenSection: (section: string) => void;
}) {
  const start = useMemo<Content>(() => ({ coreText: coreTextOf(event), card: event.detailRegisterCard ?? {} }), [event]);
  const [draft, setDraft] = useState<Content>(start);
  const [saved, setSaved] = useState<Content>(start);
  const [status, setStatus] = useState<{ tone: 'idle' | 'saving' | 'ok' | 'err'; text: string }>({ tone: 'idle', text: '' });
  const [device, setDevice] = useState<Device>('desktop');
  const [activePart, setActivePart] = useState<PartKey | null>(null);
  /** a section clicked in the preview: bring its part of the form into view */
  const jumpTo = useCallback((key: PartKey) => {
    setActivePart(key);
    const el = document.getElementById(`pcs-part-${key}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
  }, []);
  /** focus or a click inside a part of the form follows in the preview */
  const partProps = (key: PartKey) => ({
    id: `pcs-part-${key}`,
    onFocusCapture: () => setActivePart(key),
    onPointerDownCapture: () => setActivePart(key),
  });
  const dirty = !sameJson(draft, saved);
  const L = CORE_TEXT_LIMITS;
  const text = draft.coreText;
  const setText = (patch: Partial<Required<EventCoreText>>) => setDraft((d) => ({ ...d, coreText: { ...d.coreText, ...patch } }));

  // leaving the browser tab with unsaved text asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const save = async () => {
    if (!canEdit || status.tone === 'saving') return;
    const checked = normalizePageContent(draft);
    if (!checked.ok) {
      setStatus({ tone: 'err', text: checked.error });
      return;
    }
    setStatus({ tone: 'saving', text: tx('กำลังบันทึก…') });
    const res = await onSave(draft);
    if (res.ok) {
      setSaved(draft);
      setStatus({ tone: 'ok', text: tx('บันทึกแล้ว หน้างานแสดงข้อความใหม่ทันที') });
    } else {
      setStatus({ tone: 'err', text: res.error || tx('บันทึกไม่สำเร็จ ลองอีกครั้ง') });
    }
  };

  const racepackRows = text.racepack.items.map((i) => ({
    title: i.title,
    detail: i.detail,
    scope: i.scope,
    icon: i.icon ?? '',
    iconImage: i.iconImage ?? '',
  }));

  return (
    <div className="canvas-stack page-content-settings">
      <div className="page-guide-header">
        <h1>{tx('เนื้อหาหน้ารายละเอียดงาน')}</h1>
        <p className="page-purpose-desc">
          {tx('ทุกงานใช้หน้าตาเดียวกัน กรอกข้อความของแต่ละส่วนแล้วกดบันทึก ส่วนราคา ที่นั่ง สถานที่ และของที่ระลึก ระบบดึงจากเมนูที่เกี่ยวข้องให้เอง')}
        </p>
      </div>

      <div className="pcs-bar" role="region" aria-label={tx('บันทึกเนื้อหาหน้างาน')}>
        <span className={`pcs-status is-${status.tone}`} role="status" aria-live="polite">
          {status.text ||
            (dirty ? tx('มีการแก้ไขที่ยังไม่บันทึก') : canEdit ? tx('ยังไม่มีการแก้ไข') : tx('ดูอย่างเดียว — บทบาทนี้แก้เนื้อหาหน้างานไม่ได้'))}
        </span>
        <span className="pcs-actions">
          <span className="pcs-seg" role="group" aria-label={tx('ตัวอย่างหน้างาน')}>
            {(
              [
                ['desktop', 'desktop', tx('เดสก์ท็อป')],
                ['phone', 'mobile-screen', tx('มือถือ')],
                ['off', 'eye-slash', tx('ซ่อนตัวอย่าง')],
              ] as const
            ).map(([d, icon, label]) => (
              <button key={d} type="button" aria-pressed={device === d} className={device === d ? 'is-on' : ''} onClick={() => setDevice(d)}>
                <FaIcon name={icon} />
                <span>{label}</span>
              </button>
            ))}
          </span>
          <a className="btn-secondary" href={`/events/${encodeURIComponent(event.id)}`} target="_blank" rel="noreferrer">
            <FaIcon name="arrow-up-right-from-square" />
            <span>{tx('ดูหน้างาน')}</span>
          </a>
          {canEdit && (
            <>
              <button type="button" className="btn-secondary" aria-disabled={!dirty || undefined} onClick={() => dirty && setDraft(saved)}>
                <FaIcon name="rotate-left" />
                <span>{tx('ยกเลิกการแก้ไข')}</span>
              </button>
              <button type="button" className="btn-primary" onClick={() => void save()}>
                <FaIcon name="floppy-disk" />
                <span>{status.tone === 'saving' ? tx('กำลังบันทึก…') : tx('บันทึก')}</span>
              </button>
            </>
          )}
        </span>
      </div>

      <div className={`pcs-layout${device === 'off' ? ' is-solo' : ''}`}>
      <div className="pcs-form">
      <fieldset className="pcs-fields" disabled={!canEdit}>
        <section className={`clean-panel${activePart === 'about' ? ' is-active' : ''}`} {...partProps('about')}>
          <div className="section-title-bar">
            <h2 tabIndex={-1}>
              <FaIcon name="circle-info" /> {tx('เกี่ยวกับงาน')}
            </h2>
          </div>
          <p className="pcs-hint">{tx('เล่าว่างานนี้คืออะไร เส้นทางเป็นอย่างไร เหมาะกับใคร ขึ้นย่อหน้าใหม่ด้วยปุ่ม "เพิ่มย่อหน้า"')}</p>
          <TextList
            title={tx('ย่อหน้า')}
            rows={text.about.paragraphs.map((p) => ({ p }))}
            fields={[{ key: 'p', label: tx('ย่อหน้า'), multi: true, max: L.paragraph }]}
            max={L.paragraphs}
            blank={{ p: '' }}
            addLabel={tx('เพิ่มย่อหน้า')}
            onChange={(rows) => setText({ about: { ...text.about, paragraphs: rows.map((r) => r.p) } })}
          />
          <TextList
            title={tx('จุดเด่น')}
            rows={text.about.highlights.map((h) => ({ h }))}
            fields={[{ key: 'h', label: tx('จุดเด่น'), max: L.highlight }]}
            max={L.highlights}
            blank={{ h: '' }}
            inline={{ marker: 'bullet' }}
            addLabel={tx('เพิ่มจุดเด่น')}
            onChange={(rows) => setText({ about: { ...text.about, highlights: rows.map((r) => r.h) } })}
          />
        </section>

        <section className={`clean-panel${activePart === 'racepack' ? ' is-active' : ''}`} {...partProps('racepack')}>
          <div className="section-title-bar">
            <h2 tabIndex={-1}>
              <FaIcon name="gift" /> {tx('สิ่งที่ได้รับ')}
            </h2>
          </div>
          <p className="pcs-hint">{tx('การ์ดละ 1 อย่าง เช่น เสื้อ ป้าย BIB เหรียญ เลือกไอคอนหรืออัปโหลดเองได้ ตารางไซส์เสื้อดึงจากเมนูเสื้อให้เอง')}</p>
          <TextList
            title={tx('การ์ด')}
            rows={racepackRows}
            fields={[
              { key: 'title', label: tx('ชื่อ'), max: L.racepackTitle },
              { key: 'detail', label: tx('คำอธิบาย'), multi: true, max: L.racepackDetail },
              { key: 'scope', label: tx('ใครได้รับ'), max: L.racepackScope },
            ]}
            max={L.racepackItems}
            blank={{ title: '', detail: '', scope: '', icon: '', iconImage: '' }}
            addLabel={tx('เพิ่มการ์ด')}
            renderExtra={(r, i) => {
              const current = CARD_ICONS.find((x) => x.name === (r.icon || 'gift'));
              return (
                <details className="pe-icon-pick">
                  <summary>
                    <span className="pe-icon-pick-now" aria-hidden="true">
                      {r.iconImage ? <img src={r.iconImage} alt="" /> : <FaIcon name={r.icon || 'gift'} />}
                    </span>
                    <span>
                      {tx('ไอคอน')}: {r.iconImage ? tx('ภาพที่อัปโหลด') : tx(current?.label ?? '')}
                    </span>
                  </summary>
                  <CardIconPicker
                    index={i}
                    icon={r.icon}
                    iconImage={r.iconImage}
                    onPick={(p) =>
                      setText({
                        racepack: { items: text.racepack.items.map((x, j) => (j === i ? withCardIcon(x, p) : x)) },
                      })
                    }
                    onError={(t) => setStatus({ tone: 'err', text: t })}
                  />
                </details>
              );
            }}
            onChange={(rows) =>
              setText({
                racepack: {
                  items: rows.map((r) => withCardIcon({ title: r.title, detail: r.detail, scope: r.scope }, { icon: r.icon, iconImage: r.iconImage })),
                },
              })
            }
          />
        </section>

        <section className={`clean-panel${activePart === 'schedule' ? ' is-active' : ''}`} {...partProps('schedule')}>
          <div className="section-title-bar">
            <h2 tabIndex={-1}>
              <FaIcon name="timeline" /> {tx('กำหนดการ')}
            </h2>
          </div>
          <p className="pcs-hint">{tx('เรียงตามเวลา เช่น วันรับอุปกรณ์ เวลาปล่อยตัว พิธีมอบรางวัล')}</p>
          <TextList
            title={tx('รายการ')}
            rows={text.schedule.items}
            fields={[
              { key: 'timeLabel', label: tx('วันเวลา'), max: L.scheduleTime },
              { key: 'title', label: tx('หัวข้อ'), max: L.scheduleTitle },
              { key: 'detail', label: tx('รายละเอียด'), multi: true, max: L.scheduleDetail },
            ]}
            max={L.scheduleItems}
            blank={{ timeLabel: '', title: '', detail: '' }}
            addLabel={tx('เพิ่มรายการ')}
            onChange={(items) => setText({ schedule: { items } })}
          />
        </section>

        <section className={`clean-panel${activePart === 'card' ? ' is-active' : ''}`} {...partProps('card')}>
          <CardInspector
            card={draft.card}
            totalQuotaOn={isTotalQuotaEnabled(event)}
            onChange={(card) => setDraft((d) => ({ ...d, card }))}
            onOpenSection={onOpenSection}
          />
        </section>
      </fieldset>

      <section className="clean-panel pcs-from-system">
        <div className="section-title-bar">
          <h2>
            <FaIcon name="database" /> {tx('ส่วนที่ระบบดึงมาให้เอง')}
          </h2>
        </div>
        <ul>
          <li>
            <span>{tx('ระยะ ราคา เกณฑ์อายุ และที่นั่งว่าง')}</span>
            <button type="button" className="btn-ghost-sm" onClick={() => onOpenSection('evt_pricing_quota')}>
              <FaIcon name="arrow-right" />
              <span>{txf('ไปที่ {0}', tx('ระยะ โควตา & คำถามสมัคร'))}</span>
            </button>
          </li>
          <li>
            <span>{tx('สถานที่ วันงาน ผู้จัด และเวอร์ชันกติกา')}</span>
            <span className="muted-inline">{tx('จากข้อมูลงานและองค์กร')}</span>
          </li>
          <li>
            <span>{tx('ตารางไซส์เสื้อและของที่ระลึก')}</span>
            <span className="muted-inline">{tx('ไม่มีสินค้า = ไม่แสดงส่วนของที่ระลึก')}</span>
          </li>
        </ul>
      </section>
      </div>

      {device !== 'off' && (
        <aside className="pcs-preview" aria-label={tx('ตัวอย่างหน้ารายละเอียดงาน')}>
          <div className="pcs-preview-head">
            <span>
              <FaIcon name="eye" /> {tx('ตัวอย่างหน้างาน')}
            </span>
            <span className={`pcs-preview-note${dirty ? ' is-dirty' : ''}`}>
              {dirty ? tx('แสดงข้อความที่ยังไม่บันทึก') : tx('ตรงกับหน้าจริง')}
            </span>
          </div>
          <ContentPreview event={event} content={draft} active={activePart} device={device} onPick={jumpTo} />
          <p className="pcs-hint">{tx('คลิกส่วนในตัวอย่างเพื่อไปแก้ส่วนนั้น ปุ่มและลิงก์ในตัวอย่างกดใช้ไม่ได้')}</p>
        </aside>
      )}
      </div>
    </div>
  );
}
