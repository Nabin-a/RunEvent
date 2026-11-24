import { useEffect, useId, useRef, useState } from 'react';
import type {
  EventCoreText,
  EventCustomBlock,
  EventDataSource,
  EventDetailBlockId,
  EventPageItem,
  EventPageItemKind,
  EventRegisterCardConfig,
  RaceEvent,
} from '../types';
import { CORE_TEXT_LIMITS, DATA_SOURCES, dataPieceHasContent, dataSourceDef, defaultDataOptions } from '../data/eventDataPieces';
import { CARD_ICONS, CARD_LIMITS, PAGE_LIMITS, coreBlockDef, isCoreBlock, isSafeLink, newPageId } from '../data/eventDetailLayout';
import { tx, txf } from '../i18n';
import { FaIcon } from './FaIcon';
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, downscaleImage, readFileAsDataUrl } from './EventMediaManager';

/**
 * Right pane of the page editor: settings of whatever is selected in the preview —
 * a built-in block, a free block, or one piece inside a free block.
 */

export interface PaletteEntry {
  id: 'block' | EventPageItemKind | `data:${EventDataSource}`;
  label: string;
  icon: string;
  group: 'layout' | 'content' | 'media' | 'data';
  /** extra words for the palette search (English) */
  keywords: string;
}

/** the palette, chosen from the WordPress core blocks that fit an event page (23 Nov 2026) */
export const PALETTE: PaletteEntry[] = [
  { id: 'block', label: 'บล็อกอิสระ', icon: 'table-columns', group: 'layout', keywords: 'block section columns' },
  { id: 'divider', label: 'เส้นคั่น', icon: 'minus', group: 'layout', keywords: 'divider separator line' },
  { id: 'heading', label: 'หัวข้อย่อย', icon: 'heading', group: 'content', keywords: 'heading title' },
  { id: 'text', label: 'ข้อความ', icon: 'paragraph', group: 'content', keywords: 'text paragraph' },
  { id: 'list', label: 'รายการ', icon: 'list-ul', group: 'content', keywords: 'list bullet' },
  { id: 'table', label: 'ตาราง', icon: 'table', group: 'content', keywords: 'table grid' },
  { id: 'faq', label: 'คำถามที่พบบ่อย', icon: 'circle-question', group: 'content', keywords: 'faq question accordion' },
  { id: 'cards', label: 'การ์ด', icon: 'table-cells-large', group: 'content', keywords: 'cards race pack items grid' },
  { id: 'timeline', label: 'ไทม์ไลน์', icon: 'timeline', group: 'content', keywords: 'timeline schedule agenda steps' },
  { id: 'image', label: 'ภาพ', icon: 'image', group: 'media', keywords: 'image photo picture' },
  { id: 'gallery', label: 'แกลเลอรี', icon: 'images', group: 'media', keywords: 'gallery photos logos sponsors' },
  { id: 'file', label: 'ไฟล์ PDF', icon: 'file-pdf', group: 'media', keywords: 'file pdf download rules map' },
  { id: 'link', label: 'ปุ่มลิงก์', icon: 'link', group: 'media', keywords: 'link button url' },
  // event data, read-only and live (phase A, 24 Nov 2026)
  ...DATA_SOURCES.map((d): PaletteEntry => ({ id: `data:${d.id}`, label: d.label, icon: d.icon, group: 'data', keywords: d.keywords })),
];

export const PALETTE_GROUPS: { id: PaletteEntry['group']; label: string }[] = [
  { id: 'layout', label: 'โครง' },
  { id: 'content', label: 'เนื้อหา' },
  { id: 'media', label: 'สื่อและลิงก์' },
  { id: 'data', label: 'ข้อมูลงาน (ค่าจริง แก้ที่เมนูต้นทาง)' },
];

/** a block placed inside a column: not in the palette (it comes from dragging a block in) */
const NESTED_ENTRY: PaletteEntry = { id: 'nested', label: 'บล็อกซ้อน', icon: 'layer-group', group: 'layout', keywords: 'nested block' };
/** the palette entry of a piece kind, or of a piece (a data piece is found by its source) */
export const kindEntry = (k: string | Pick<EventPageItem, 'kind' | 'source'>) => {
  const id = typeof k === 'string' ? k : k.kind === 'data' ? `data:${k.source}` : k.kind;
  return PALETTE.find((p) => p.id === id) ?? (id === 'nested' ? NESTED_ENTRY : undefined);
};

export const BLOCK_ICON: Record<EventDetailBlockId, string> = {
  about: 'circle-info',
  categories: 'person-running',
  racepack: 'shirt',
  schedule: 'clock',
  venue: 'location-dot',
  merch: 'bag-shopping',
};

export function newItem(paletteId: Exclude<PaletteEntry['id'], 'block'>): EventPageItem {
  const id = newPageId('it');
  if (paletteId.startsWith('data:')) {
    const source = paletteId.slice(5) as EventDataSource;
    return { id, kind: 'data', source, options: defaultDataOptions(source) };
  }
  const kind = paletteId as EventPageItemKind;
  switch (kind) {
    case 'heading':
      return { id, kind, text: tx('หัวข้อย่อย') };
    case 'list':
      return { id, kind, items: [''], ordered: false };
    case 'table':
      return { id, kind, rows: [[tx('หัวคอลัมน์ 1'), tx('หัวคอลัมน์ 2')], ['', '']] };
    case 'faq':
      return { id, kind, faqs: [{ q: '', a: '' }] };
    case 'image':
      return { id, kind, imageUrl: '', imageAlt: '' };
    case 'gallery':
      return { id, kind, images: [] };
    case 'file':
      return { id, kind, fileUrl: '', fileName: '', label: '' };
    case 'link':
      return { id, kind, label: '', href: '' };
    case 'cards':
      return { id, kind, cards: [{ title: tx('หัวข้อการ์ด'), detail: '', scope: '' }, { title: tx('หัวข้อการ์ด'), detail: '', scope: '' }] };
    case 'timeline':
      return { id, kind, timeline: [{ timeLabel: '07:00', title: tx('กิจกรรม'), detail: '' }, { timeLabel: '08:00', title: tx('กิจกรรม'), detail: '' }] };
    case 'divider':
      return { id, kind };
    default:
      return { id, kind: 'text', text: '' };
  }
}

/** a move button of a piece: focusable at the ends too, described for screen readers */
function PieceMover({
  icon,
  label,
  blocked,
  why,
  to,
  onMove,
}: {
  icon: string;
  label: string;
  blocked: boolean;
  why: string;
  to: string;
  onMove: () => void;
}) {
  const id = useId();
  return (
    <>
      <button
        type="button"
        className="pe-icon-btn"
        aria-disabled={blocked || undefined}
        aria-label={label}
        aria-describedby={id}
        title={label}
        onClick={() => {
          if (!blocked) onMove();
        }}
      >
        <FaIcon name={icon} />
      </button>
      <span id={id} className="sr-only">
        {blocked ? why : to}
      </span>
    </>
  );
}

/** one-line description of a piece for lists and announcements */
export function itemSummary(it: EventPageItem): string {
  const cut = (t: string) => (t.length > 32 ? `${t.slice(0, 32)}…` : t);
  switch (it.kind) {
    case 'heading':
    case 'text':
      return cut((it.text ?? '').trim()) || tx('(ว่าง)');
    case 'list':
      return txf('{0} ข้อ', (it.items ?? []).filter((x) => x.trim()).length);
    case 'table':
      return txf('{0} แถว × {1} คอลัมน์', it.rows?.length ?? 0, it.rows?.[0]?.length ?? 0);
    case 'faq':
      return txf('{0} คำถาม', (it.faqs ?? []).filter((f) => f.q.trim()).length);
    case 'image':
      return it.imageUrl ? cut(it.imageAlt || tx('ภาพ')) : tx('(ยังไม่มีภาพ)');
    case 'gallery':
      return txf('{0} ภาพ', it.images?.length ?? 0);
    case 'file':
      return it.fileName ? cut(it.fileName) : tx('(ยังไม่มีไฟล์)');
    case 'link':
      return cut(it.label || it.href || '') || tx('(ว่าง)');
    case 'divider':
      return tx('เส้นคั่น');
    case 'cards':
      return txf('{0} ใบ', (it.cards ?? []).length);
    case 'timeline':
      return txf('{0} รายการ', (it.timeline ?? []).length);
    case 'nested':
      return it.ref && isCoreBlock(it.ref) ? tx(coreBlockDef(it.ref).label) : tx('บล็อกอิสระ');
    case 'data':
      return txf('จาก {0}', tx(dataSourceDef(it.source)?.menuLabel ?? ''));
    default:
      return '';
  }
}

/* ------------------------------------------------------------------ */
/* Built-in block                                                      */
/* ------------------------------------------------------------------ */

/** data a built-in block shows that is edited in another menu */
const CORE_DATA_ROWS: Partial<Record<EventDetailBlockId, { label: string; menu: string; section: string; note?: string }[]>> = {
  categories: [{ label: 'ระยะ ราคา เวลาปล่อยตัว ที่นั่ง เกณฑ์อายุ', menu: 'ระยะ โควตา & คำถามสมัคร', section: 'evt_pricing_quota' }],
  racepack: [{ label: 'ตารางไซส์และสต็อกเสื้อ', menu: 'ระยะ โควตา & คำถามสมัคร', section: 'evt_pricing_quota' }],
  venue: [
    { label: 'สถานที่ จังหวัด ภาค เวอร์ชันกติกา', menu: 'ข้อมูลงาน', section: 'evt_overview', note: 'ตั้งไว้ตอนสร้างงาน ยังไม่มีหน้าจอแก้' },
    { label: 'ชื่อผู้จัดและอีเมลติดต่อ', menu: 'ทีมและตั้งค่าองค์กร', section: 'org_team_settings' },
  ],
  merch: [{ label: 'สินค้าที่ระลึก', menu: 'ร้านค้า & สินค้าของงานนี้', section: 'evt_storefront' }],
};

export type CoreTextKey = 'about' | 'racepack' | 'schedule';
export const isCoreTextKey = (id: string): id is CoreTextKey => id === 'about' || id === 'racepack' || id === 'schedule';

export function CoreInspector({
  blockId,
  visible,
  onToggle,
  text,
  onText,
  onOpenSection,
  hiddenOnPublic,
}: {
  blockId: EventDetailBlockId;
  visible: boolean;
  onToggle: () => void;
  /** the block's editable text (about / race pack / schedule) */
  text?: Required<EventCoreText>[CoreTextKey];
  onText?: (next: Required<EventCoreText>[CoreTextKey]) => void;
  onOpenSection?: (section: string) => void;
  /** nothing to show on the live page (e.g. no souvenirs) */
  hiddenOnPublic?: boolean;
}) {
  const def = coreBlockDef(blockId);
  const rows = CORE_DATA_ROWS[blockId] ?? [];
  const L = CORE_TEXT_LIMITS;
  return (
    <div className="pe-panel pe-inspector">
      <h2>
        <FaIcon name={BLOCK_ICON[blockId]} />
        {tx(def.label)}
      </h2>
      <p className="pe-hint">{def.locked ? tx('บล็อกหลัก — ย้ายได้ ซ่อนหรือเปลี่ยนชื่อไม่ได้') : tx('บล็อกมาตรฐาน — ย้ายและซ่อนได้')}</p>
      {hiddenOnPublic && (
        <p className="pe-warn" role="note">
          <FaIcon name="eye-slash" />
          <span>{tx('งานนี้ยังไม่มีข้อมูลของส่วนนี้ หน้าจริงจะไม่แสดง')}</span>
        </p>
      )}

      {text && onText && blockId === 'about' && 'paragraphs' in text && (
        <>
          <span className="pe-label">{tx('ข้อความ (แก้ได้ หรือดับเบิลคลิกในตัวอย่างหน้า)')}</span>
          <TextList
            title={tx('ย่อหน้า')}
            rows={text.paragraphs.map((p) => ({ p }))}
            fields={[{ key: 'p', label: tx('ย่อหน้า'), multi: true, max: L.paragraph }]}
            max={L.paragraphs}
            blank={{ p: '' }}
            onChange={(rows) => onText({ ...text, paragraphs: rows.map((r) => r.p) })}
          />
          <TextList
            title={tx('จุดเด่น')}
            rows={text.highlights.map((h) => ({ h }))}
            fields={[{ key: 'h', label: tx('จุดเด่น'), max: L.highlight }]}
            max={L.highlights}
            blank={{ h: '' }}
            onChange={(rows) => onText({ ...text, highlights: rows.map((r) => r.h) })}
          />
        </>
      )}
      {text && onText && blockId === 'racepack' && 'items' in text && 'scope' in (text.items[0] ?? { scope: '' }) && (
        <>
          <span className="pe-label">{tx('ข้อความ (แก้ได้ หรือดับเบิลคลิกในตัวอย่างหน้า)')}</span>
          <TextList
            title={tx('สิ่งที่ได้รับ')}
            rows={(text as Required<EventCoreText>['racepack']).items.map((i) => ({
              title: i.title,
              detail: i.detail,
              scope: i.scope,
              icon: i.icon ?? '',
              iconImage: i.iconImage ?? '',
            }))}
            fields={[
              { key: 'title', label: tx('ชื่อ'), max: L.racepackTitle },
              { key: 'detail', label: tx('คำอธิบาย'), multi: true, max: L.racepackDetail },
              { key: 'scope', label: tx('ใครได้รับ'), max: L.racepackScope },
            ]}
            max={L.racepackItems}
            blank={{ title: '', detail: '', scope: '', icon: '', iconImage: '' }}
            onChange={(rows) => onText({ items: rows.map((r) => withCardIcon({ title: r.title, detail: r.detail, scope: r.scope }, r)) })}
          />
        </>
      )}
      {text && onText && blockId === 'schedule' && 'items' in text && (
        <>
          <span className="pe-label">{tx('ข้อความ (แก้ได้ หรือดับเบิลคลิกในตัวอย่างหน้า)')}</span>
          <p className="pe-hint">{tx('ช่วงรับอุปกรณ์และเวลาปล่อยตัวที่อยากให้ตรงกับระบบเสมอ ใช้ชิ้นข้อมูล "วันรับอุปกรณ์" หรือ "ระยะและค่าสมัคร" แทน')}</p>
          <TextList
            title={tx('กำหนดการ')}
            rows={(text as Required<EventCoreText>['schedule']).items}
            fields={[
              { key: 'timeLabel', label: tx('เวลา'), max: L.scheduleTime },
              { key: 'title', label: tx('หัวข้อ'), max: L.scheduleTitle },
              { key: 'detail', label: tx('รายละเอียด'), multi: true, max: L.scheduleDetail },
            ]}
            max={L.scheduleItems}
            blank={{ timeLabel: '', title: '', detail: '' }}
            onChange={(items) => onText({ items })}
          />
        </>
      )}

      {rows.length > 0 && (
        <div className="pe-source-rows">
          <span className="pe-label">{tx('ข้อมูลจากระบบ (แก้ที่เมนูต้นทาง)')}</span>
          {rows.map((r) => (
            <div key={r.label} className="pe-source-row">
              <span>
                {tx(r.label)}
                {r.note && <span className="muted-inline"> · {tx(r.note)}</span>}
              </span>
              {onOpenSection && (
                <button type="button" className="btn-ghost-sm" onClick={() => onOpenSection(r.section)}>
                  <FaIcon name="arrow-up-right-from-square" />
                  <span>{txf('ไปที่ {0}', tx(r.menu))}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!def.locked && (
        <button type="button" className="btn-secondary" onClick={onToggle}>
          <FaIcon name={visible ? 'eye-slash' : 'eye'} />
          <span>{visible ? tx('ซ่อนบล็อกนี้') : tx('แสดงบล็อกนี้')}</span>
        </button>
      )}
    </div>
  );
}

/** the sticky register card: two short lines and three switches; the rest comes from the system */
export function CardInspector({
  card,
  totalQuotaOn,
  onChange,
  onOpenSection,
}: {
  card: EventRegisterCardConfig;
  totalQuotaOn: boolean;
  onChange: (next: EventRegisterCardConfig) => void;
  onOpenSection?: (section: string) => void;
}) {
  const set = (patch: Partial<EventRegisterCardConfig>) => onChange({ ...card, ...patch });
  return (
    <div className="pe-panel pe-inspector">
      <h2>
        <FaIcon name="id-card" />
        {tx('การ์ดสมัคร')}
      </h2>
      <p className="pe-hint">{tx('การ์ดด้านขวาของหน้า เลื่อนตามผู้อ่าน ย้ายหรือลบไม่ได้')}</p>
      <label className="pe-label" htmlFor="pe-card-kicker">{tx('ข้อความหัวการ์ด')}</label>
      <input
        id="pe-card-kicker"
        type="text"
        value={card.kicker ?? ''}
        maxLength={CARD_LIMITS.kicker}
        placeholder={tx('สมัครร่วมงาน')}
        onChange={(e) => set({ kicker: e.target.value || undefined })}
      />
      <label className="pe-label" htmlFor="pe-card-promo">{tx('ข้อความโปรโมต (1 บรรทัด)')}</label>
      <input
        id="pe-card-promo"
        type="text"
        value={card.promo ?? ''}
        maxLength={CARD_LIMITS.promo}
        placeholder={tx('เช่น Early bird ถึง 30 พ.ย.')}
        onChange={(e) => set({ promo: e.target.value || undefined })}
      />
      <span className="pe-label">{tx('แสดงบนการ์ด')}</span>
      <label className="pe-check">
        <input type="checkbox" checked={card.showMascot !== false} onChange={(e) => set({ showMascot: e.target.checked })} />
        <span>{tx('มาสคอต')}</span>
      </label>
      <label className="pe-check">
        <input type="checkbox" checked={card.showQuota !== false} onChange={(e) => set({ showQuota: e.target.checked })} />
        <span>{tx('แถบโควตารวมทั้งงาน')}</span>
      </label>
      {!totalQuotaOn && <p className="pe-hint">{tx('งานนี้ปิดโควตารวมอยู่ แถบนี้จึงไม่แสดงอยู่แล้ว')}</p>}
      <div className="pe-source-rows">
        <span className="pe-label">{tx('ข้อมูลจากระบบ (แก้ที่เมนูต้นทาง)')}</span>
        <div className="pe-source-row">
          <span>{tx('สถานะงาน ช่วงรับสมัคร ราคา โควตา ระยะ และปุ่มสมัคร')}</span>
          {onOpenSection && (
            <button type="button" className="btn-ghost-sm" onClick={() => onOpenSection('evt_pricing_quota')}>
              <FaIcon name="arrow-up-right-from-square" />
              <span>{txf('ไปที่ {0}', tx('ระยะ โควตา & คำถามสมัคร'))}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

type CardRow = NonNullable<EventPageItem['cards']>[number];

/** a card with a new icon (empty / the default gift is not stored) */
export function withCardIcon(card: CardRow, patch: { icon?: string; iconImage?: string }): CardRow {
  const next = { ...card, ...patch };
  if (!next.icon || next.icon === 'gift') delete next.icon;
  if (!next.iconImage) delete next.iconImage;
  return next;
}

/**
 * Choose a card's icon: one of CARD_ICONS, or an uploaded picture (scaled to 128 px PNG).
 * Used in the right pane and in the pop-up over the preview.
 */
export function CardIconPicker({
  index,
  icon,
  iconImage,
  onPick,
  onError,
  autoFocus,
}: {
  index: number;
  icon?: string;
  iconImage?: string;
  onPick: (patch: { icon?: string; iconImage?: string }) => void;
  onError: (text: string) => void;
  autoFocus?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_MIME.includes(file.type)) return onError(tx('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP'));
    if (file.size > MAX_UPLOAD_BYTES) return onError(tx('ไฟล์ใหญ่เกิน 8 MB'));
    setBusy(true);
    try {
      const url = await downscaleImage(await readFileAsDataUrl(file), 128, 'image/png');
      if (url.length > PAGE_LIMITS.cardIconChars) return onError(tx('ภาพยังใหญ่เกินไปหลังย่อ ลองใช้ภาพที่เล็กลง'));
      onPick({ iconImage: url });
    } catch {
      onError(tx('อ่านไฟล์ภาพไม่ได้'));
    } finally {
      setBusy(false);
    }
  };
  const now = icon || 'gift';
  return (
    <>
      <div className="pe-icon-grid" role="group" aria-label={txf('เลือกไอคอนการ์ดที่ {0}', index + 1)}>
        {CARD_ICONS.map((ic) => {
          const on = !iconImage && now === ic.name;
          return (
            <button
              key={ic.name}
              type="button"
              className={`pe-icon-choice${on ? ' is-on' : ''}`}
              aria-pressed={on}
              aria-label={tx(ic.label)}
              title={tx(ic.label)}
              autoFocus={autoFocus && on}
              onClick={() => onPick({ icon: ic.name, iconImage: '' })}
            >
              <FaIcon name={ic.name} />
            </button>
          );
        })}
      </div>
      <div className="pe-icon-upload">
        <label className="btn-ghost-sm">
          <FaIcon name="upload" />
          <span>{busy ? tx('กำลังย่อภาพ…') : tx('อัปโหลดไอคอนเอง')}</span>
          <input
            type="file"
            className="sr-only"
            accept={ALLOWED_MIME.join(',')}
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {iconImage && (
          <button type="button" className="btn-ghost-sm" onClick={() => onPick({ iconImage: '' })}>
            <FaIcon name="xmark" />
            <span>{tx('เลิกใช้ภาพที่อัปโหลด')}</span>
          </button>
        )}
      </div>
      <p className="pe-hint">{tx('JPG, PNG หรือ WebP ระบบย่อเหลือ 128 px · PNG พื้นใสจะคงพื้นใส')}</p>
    </>
  );
}

/**
 * A short editable list of text rows (add, remove, move up/down).
 * `inline`: one single-line field per row, drawn on one line with a bullet or number; Enter adds a
 * row below (text after the caret moves with it), Backspace in an empty row removes it, and
 * pasting several lines makes several rows.
 */
export function TextList<R extends Record<string, string>>({
  title,
  rows,
  fields,
  max,
  blank,
  onChange,
  inline,
  addLabel,
  renderExtra,
}: {
  title: string;
  rows: R[];
  fields: { key: keyof R & string; label: string; multi?: boolean; max: number }[];
  max: number;
  blank: R;
  onChange: (rows: R[]) => void;
  inline?: { marker: 'bullet' | 'number' };
  addLabel?: string;
  /** more controls under a row's fields (e.g. a card's icon) */
  renderExtra?: (row: R, index: number) => React.ReactNode;
}) {
  const set = (i: number, key: keyof R, value: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));
  const listRef = useRef<HTMLOListElement>(null);
  // the row to focus once the new rows are drawn (after adding or removing from the keyboard)
  const focusRow = useRef<number | null>(null);
  useEffect(() => {
    const at = focusRow.current;
    if (at === null) return;
    focusRow.current = null;
    const input = listRef.current?.querySelectorAll<HTMLTextAreaElement>('li .pe-text-list-line')[at];
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
  const key = fields[0].key;
  const limit = fields[0].max;
  const row = (text: string) => ({ ...blank, [key]: text.slice(0, limit) }) as R;
  const onRowKey = (i: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!inline || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    if (e.key === 'Enter') {
      e.preventDefault();
      if (rows.length >= max) return;
      const pos = el.selectionStart ?? el.value.length;
      const next = [...rows];
      next[i] = row(el.value.slice(0, pos));
      next.splice(i + 1, 0, row(el.value.slice(pos)));
      focusRow.current = i + 1;
      onChange(next);
    } else if (e.key === 'Backspace' && el.value === '' && rows.length > 1) {
      e.preventDefault();
      focusRow.current = Math.max(0, i - 1);
      onChange(rows.filter((_, j) => j !== i));
    }
  };
  const onRowPaste = (i: number, e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!inline) return;
    const lines = e.clipboardData
      .getData('text')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*(?:[-*\u2022\u00b7]|\d+[.)])\s+/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    const el = e.currentTarget;
    const before = el.value.slice(0, el.selectionStart ?? el.value.length);
    const after = el.value.slice(el.selectionEnd ?? el.value.length);
    const rest = lines.slice(1);
    rest[rest.length - 1] += after;
    const added = rest.slice(0, Math.max(0, max - rows.length)).map(row);
    const next = [...rows];
    next[i] = row(before + lines[0]);
    next.splice(i + 1, 0, ...added);
    focusRow.current = i + added.length;
    onChange(next);
  };
  const addRow = () => {
    if (rows.length >= max) return;
    if (inline) focusRow.current = rows.length;
    onChange([...rows, { ...blank }]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <fieldset className={`pe-text-list${inline ? ' is-inline' : ''}`}>
      <legend>
        {title} <span className="muted-inline">({rows.length}/{max})</span>
      </legend>
      <ol ref={listRef}>
        {rows.map((r, i) => (
          <li key={i}>
            {inline && (
              <span className="pe-text-list-marker" aria-hidden="true">
                {inline.marker === 'number' ? `${i + 1}.` : '•'}
              </span>
            )}
            {fields.map((f) =>
              inline ? (
                // one line of text that wraps (and grows) instead of scrolling sideways; Enter = next row
                <textarea
                  key={f.key}
                  className="pe-text-list-line"
                  rows={1}
                  value={r[f.key]}
                  maxLength={f.max}
                  aria-label={`${f.label} ${i + 1}`}
                  placeholder={f.label}
                  onChange={(e) => set(i, f.key, e.target.value.replace(/\r?\n/g, ' '))}
                  onKeyDown={(e) => onRowKey(i, e)}
                  onPaste={(e) => onRowPaste(i, e)}
                />
              ) : f.multi ? (
                <textarea
                  key={f.key}
                  rows={2}
                  value={r[f.key]}
                  maxLength={f.max}
                  aria-label={`${f.label} ${i + 1}`}
                  placeholder={f.label}
                  onChange={(e) => set(i, f.key, e.target.value)}
                />
              ) : (
                <input
                  key={f.key}
                  type="text"
                  value={r[f.key]}
                  maxLength={f.max}
                  aria-label={`${f.label} ${i + 1}`}
                  placeholder={f.label}
                  onChange={(e) => set(i, f.key, e.target.value)}
                />
              )
            )}
            {renderExtra?.(r, i)}
            <span className="pe-text-list-actions">
              <button type="button" className="pe-icon-btn" aria-label={txf('เลื่อน {0} ข้อที่ {1} ขึ้น', title, i + 1)} aria-disabled={i === 0 || undefined} onClick={() => move(i, -1)}>
                <FaIcon name="arrow-up" />
              </button>
              <button type="button" className="pe-icon-btn" aria-label={txf('เลื่อน {0} ข้อที่ {1} ลง', title, i + 1)} aria-disabled={i === rows.length - 1 || undefined} onClick={() => move(i, 1)}>
                <FaIcon name="arrow-down" />
              </button>
              <button type="button" className="pe-icon-btn is-danger" aria-label={txf('ลบ {0} ข้อที่ {1}', title, i + 1)} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                <FaIcon name="trash-can" />
              </button>
            </span>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-ghost-sm" disabled={rows.length >= max} onClick={addRow}>
        <FaIcon name="plus" />
        <span>{addLabel ?? txf('เพิ่ม{0}', title)}</span>
      </button>
      {inline && <p className="pe-hint">{tx('Enter = เพิ่มข้อถัดไป · วางข้อความหลายบรรทัดได้หลายข้อในครั้งเดียว')}</p>}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ */
/* Free block                                                          */
/* ------------------------------------------------------------------ */

export function BlockInspector({
  block,
  visible,
  onTitle,
  onColumns,
  onSelectItem,
  onToggle,
  onDuplicate,
  onRemove,
  modLabel,
}: {
  block: EventCustomBlock;
  visible: boolean;
  onTitle: (t: string) => void;
  onColumns: (n: 1 | 2 | 3) => void;
  onSelectItem: (itemId: string) => void;
  onToggle: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  modLabel: string;
}) {
  return (
    <div className="pe-panel pe-inspector">
      <h2>
        <FaIcon name="table-columns" />
        {tx('บล็อกอิสระ')}
      </h2>
      <div className="form-row">
        <label htmlFor={`pe-title-${block.id}`}>{tx('ชื่อหัวข้อ')}</label>
        <input
          id={`pe-title-${block.id}`}
          type="text"
          value={block.title}
          maxLength={PAGE_LIMITS.title}
          onChange={(e) => onTitle(e.target.value)}
          aria-invalid={!block.title.trim()}
        />
        {!block.title.trim() && <span className="field-error">{tx('ตั้งชื่อหัวข้อก่อนเผยแพร่')}</span>}
      </div>

      <div className="form-row">
        <span className="pe-label" id={`pe-cols-${block.id}`}>
          {tx('จำนวนคอลัมน์ (มือถือแสดง 1 คอลัมน์)')}
        </span>
        <div className="pe-seg" role="group" aria-labelledby={`pe-cols-${block.id}`}>
          {([1, 2, 3] as const).map((n) => (
            <button key={n} type="button" aria-pressed={block.columns === n} className={block.columns === n ? 'is-on' : ''} onClick={() => onColumns(n)}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* an outline of the pieces (keyboard path to select one); editing happens on the piece */}
      <div className="pe-piece-outline">
        <span className="pe-label">{tx('ชิ้นส่วนในบล็อกนี้')}</span>
        {block.cells.every((c) => c.length === 0) && (
          <p className="pe-hint">{tx('ลากชิ้นส่วนจากคลังมาวางในคอลัมน์ของบล็อกนี้ในตัวอย่างหน้า')}</p>
        )}
        {block.cells.map((items, col) =>
          items.length === 0 ? null : (
            <div key={col}>
              {block.columns > 1 && <span className="pe-col-name">{txf('คอลัมน์ {0}', col + 1)}</span>}
              <ul>
                {items.map((it) => (
                  <li key={it.id}>
                    <button type="button" className="pe-piece-btn" onClick={() => onSelectItem(it.id)}>
                      <FaIcon name={kindEntry(it)?.icon ?? 'square'} />
                      <span className="pe-piece-kind">{tx(kindEntry(it)?.label ?? '')}</span>
                      <span className="pe-piece-sum">{itemSummary(it)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      <div className="pe-block-actions">
        <button type="button" className="btn-ghost-sm" onClick={onToggle}>
          <FaIcon name={visible ? 'eye-slash' : 'eye'} />
          <span>{visible ? tx('ซ่อน') : tx('แสดง')}</span>
        </button>
        <button type="button" className="btn-ghost-sm" onClick={onDuplicate} title={`${modLabel}+D`}>
          <FaIcon name="clone" />
          <span>{tx('ทำสำเนา')}</span>
        </button>
        <button type="button" className="btn-ghost-sm pe-remove-block" onClick={onRemove} title="Delete">
          <FaIcon name="trash-can" />
          <span>{tx('ลบบล็อกนี้')}</span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One piece                                                           */
/* ------------------------------------------------------------------ */

export function ItemInspector({
  item,
  block,
  col,
  index,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onBack,
  onError,
  event,
  onOpenSection,
}: {
  item: EventPageItem;
  block: EventCustomBlock;
  col: number;
  index: number;
  onChange: (patch: Partial<EventPageItem>) => void;
  onMove: (dCol: number, dIdx: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onBack: () => void;
  onError: (text: string) => void;
  /** for data pieces: the event's categories / products and the menus that own them */
  event?: RaceEvent;
  onOpenSection?: (section: string) => void;
}) {
  const entry = kindEntry(item);
  const count = block.cells[col]?.length ?? 0;
  return (
    <div className="pe-panel pe-inspector">
      <button type="button" className="btn-ghost-sm pe-back" onClick={onBack}>
        <FaIcon name="arrow-turn-up" />
        <span>{txf('บล็อก: {0}', block.title)}</span>
      </button>
      <h2>
        <FaIcon name={entry?.icon ?? 'square'} />
        {tx(entry?.label ?? '')}
      </h2>

      {item.kind === 'data' && event ? (
        <DataFields item={item} event={event} onChange={onChange} onOpenSection={onOpenSection} />
      ) : (
        <ItemFields item={item} onChange={onChange} onError={onError} />
      )}

      <div className="pe-move">
        <span className="pe-label">{txf('ตำแหน่ง: คอลัมน์ {0} ลำดับ {1}', col + 1, index + 1)}</span>
        {/* buttons stay focusable at the ends (aria-disabled) and say where the piece would go */}
        <div className="pe-move-buttons">
          <PieceMover icon="arrow-up" label={tx('เลื่อนขึ้น')} blocked={index === 0} why={tx('อยู่บนสุดของคอลัมน์แล้ว')}
            to={txf('ไปลำดับที่ {0} ในคอลัมน์ {1}', index, col + 1)} onMove={() => onMove(0, -1)} />
          <PieceMover icon="arrow-down" label={tx('เลื่อนลง')} blocked={index >= count - 1} why={tx('อยู่ล่างสุดของคอลัมน์แล้ว')}
            to={txf('ไปลำดับที่ {0} ในคอลัมน์ {1}', index + 2, col + 1)} onMove={() => onMove(0, 1)} />
          {block.columns > 1 && (
            <>
              <PieceMover icon="arrow-left" label={tx('ย้ายไปคอลัมน์ซ้าย')} blocked={col === 0} why={tx('อยู่คอลัมน์ซ้ายสุดแล้ว')}
                to={txf('ไปท้ายคอลัมน์ {0}', col)} onMove={() => onMove(-1, 0)} />
              <PieceMover icon="arrow-right" label={tx('ย้ายไปคอลัมน์ขวา')} blocked={col >= block.columns - 1} why={tx('อยู่คอลัมน์ขวาสุดแล้ว')}
                to={txf('ไปท้ายคอลัมน์ {0}', col + 2)} onMove={() => onMove(1, 0)} />
            </>
          )}
        </div>
      </div>

      <div className="pe-block-actions">
        <button type="button" className="btn-ghost-sm" onClick={onDuplicate}>
          <FaIcon name="clone" />
          <span>{tx('ทำสำเนา')}</span>
        </button>
        <button type="button" className="btn-ghost-sm pe-remove-block" onClick={onRemove} title="Delete">
          <FaIcon name="trash-can" />
          <span>{tx('ลบชิ้นส่วนนี้')}</span>
        </button>
      </div>
    </div>
  );
}

/** display options of a data piece; the values come from the menus that own them */
function DataFields({
  item,
  event,
  onChange,
  onOpenSection,
}: {
  item: EventPageItem;
  event: RaceEvent;
  onChange: (patch: Partial<EventPageItem>) => void;
  onOpenSection?: (section: string) => void;
}) {
  const def = dataSourceDef(item.source);
  const o = item.options ?? {};
  const set = (patch: Partial<NonNullable<EventPageItem['options']>>) => onChange({ options: { ...o, ...patch } });
  const fid = `pe-d-${item.id}`;
  if (!def) return null;
  const has = dataPieceHasContent(event, item);
  const productCats = [...new Set(event.products.map((p) => p.categoryLabel))];
  const pickCats = (item.source === 'categories' || (item.source === 'quota' && o.quotaMode !== 'total')) && event.categories.length > 1;
  return (
    <div className="pe-data-fields">
      <p className="pe-hint">
        {txf('ข้อมูลจาก {0}', tx(def.menuLabel))}
        {def.note ? ` · ${tx(def.note)}` : ''}
      </p>
      <p className="pe-hint">{tx('ตัวเลขเป็นค่าปัจจุบันเสมอ แก้ที่เมนูต้นทางแล้วหน้าเปลี่ยนตามทันทีโดยไม่ต้องเผยแพร่ใหม่')}</p>
      {!has && (
        <p className="pe-warn" role="note">
          <FaIcon name="eye-slash" />
          <span>{tx('งานนี้ยังไม่มีข้อมูลนี้ หน้าจริงจะไม่แสดงชิ้นนี้')}</span>
        </p>
      )}
      {onOpenSection && (
        <button type="button" className="btn-secondary" onClick={() => onOpenSection(def.section)}>
          <FaIcon name="arrow-up-right-from-square" />
          <span>{txf('ไปแก้ที่ {0}', tx(def.menuLabel))}</span>
        </button>
      )}

      {item.source === 'quota' && (
        <>
          <label className="pe-label" htmlFor={`${fid}-mode`}>{tx('แสดง')}</label>
          <select id={`${fid}-mode`} value={o.quotaMode ?? 'per-category'} onChange={(e) => set({ quotaMode: e.target.value as 'per-category' | 'total' })}>
            <option value="per-category">{tx('รายระยะ')}</option>
            <option value="total">{tx('รวมทั้งงาน')}</option>
          </select>
          <label className="pe-label" htmlFor={`${fid}-style`}>{tx('รูปแบบ')}</label>
          <select id={`${fid}-style`} value={o.quotaStyle ?? 'number'} onChange={(e) => set({ quotaStyle: e.target.value as 'number' | 'label' })}>
            <option value="number">{tx('ตัวเลข (เหลือ x / y)')}</option>
            <option value="label">{tx('ข้อความ (ยังว่าง / ใกล้เต็ม / เต็มแล้ว)')}</option>
          </select>
        </>
      )}
      {pickCats && (
        <fieldset className="pe-faq-edit">
          <legend>{tx('ระยะที่แสดง (ไม่เลือก = ทุกระยะ)')}</legend>
          {event.categories.map((c) => {
            const on = o.categoryIds?.includes(c.id) ?? false;
            return (
              <label key={c.id} className="pe-check">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    set({ categoryIds: on ? (o.categoryIds ?? []).filter((x) => x !== c.id) : [...(o.categoryIds ?? []), c.id] })
                  }
                />
                <span>{tx(c.name)}</span>
              </label>
            );
          })}
        </fieldset>
      )}
      {item.source === 'categories' && (
        <>
          <label className="pe-label" htmlFor={`${fid}-layout`}>{tx('รูปแบบ')}</label>
          <select id={`${fid}-layout`} value={o.layout ?? 'cards'} onChange={(e) => set({ layout: e.target.value as 'cards' | 'table' })}>
            <option value="cards">{tx('การ์ด')}</option>
            <option value="table">{tx('ตาราง')}</option>
          </select>
          <label className="pe-check">
            <input type="checkbox" checked={o.showAllTiers !== false} onChange={(e) => set({ showAllTiers: e.target.checked })} />
            <span>{tx('แสดงทุกช่วงราคา')}</span>
          </label>
          <label className="pe-check">
            <input type="checkbox" checked={o.showAge !== false} onChange={(e) => set({ showAge: e.target.checked })} />
            <span>{tx('แสดงเกณฑ์อายุ')}</span>
          </label>
        </>
      )}
      {item.source === 'sizechart' && (
        <label className="pe-check">
          <input type="checkbox" checked={o.showStock !== false} onChange={(e) => set({ showStock: e.target.checked })} />
          <span>{tx('แสดงสต็อกคงเหลือ')}</span>
        </label>
      )}
      {item.source === 'venue' && (
        <label className="pe-check">
          <input type="checkbox" checked={o.showDate !== false} onChange={(e) => set({ showDate: e.target.checked })} />
          <span>{tx('แสดงวันงาน')}</span>
        </label>
      )}
      {item.source === 'contact' && (
        <label className="pe-check">
          <input type="checkbox" checked={o.showRules !== false} onChange={(e) => set({ showRules: e.target.checked })} />
          <span>{tx('แสดงเวอร์ชันกติกา')}</span>
        </label>
      )}
      {item.source === 'products' && (
        <>
          <label className="pe-label" htmlFor={`${fid}-count`}>{tx('จำนวนสินค้าที่แสดง (1–8)')}</label>
          <input
            id={`${fid}-count`}
            type="number"
            min={1}
            max={8}
            value={o.productCount ?? 4}
            onChange={(e) => set({ productCount: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })}
          />
          {productCats.length > 1 && (
            <>
              <label className="pe-label" htmlFor={`${fid}-cat`}>{tx('หมวดสินค้า')}</label>
              <select id={`${fid}-cat`} value={o.productCategory ?? ''} onChange={(e) => set({ productCategory: e.target.value || undefined })}>
                <option value="">{tx('ทุกหมวด')}</option>
                {productCats.map((c) => (
                  <option key={c} value={c}>
                    {tx(c)}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ItemFields({
  item,
  onChange,
  onError,
}: {
  item: EventPageItem;
  onChange: (patch: Partial<EventPageItem>) => void;
  onError: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const fid = `pe-f-${item.id}`;

  const pickImage = async (file: File | undefined, maxEdge: number, maxChars: number): Promise<string | null> => {
    if (!file) return null;
    if (!ALLOWED_MIME.includes(file.type)) {
      onError(tx('รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP'));
      return null;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onError(tx('ไฟล์ใหญ่เกิน 8 MB'));
      return null;
    }
    const url = await downscaleImage(await readFileAsDataUrl(file), maxEdge);
    if (url.length > maxChars) {
      onError(tx('ภาพยังใหญ่เกินไปหลังย่อ ลองใช้ภาพที่เล็กลง'));
      return null;
    }
    return url;
  };

  switch (item.kind) {
    case 'heading':
      return (
        <div className="form-row">
          <label htmlFor={fid}>{tx('ข้อความหัวข้อย่อย')}</label>
          <input id={fid} type="text" maxLength={PAGE_LIMITS.heading} value={item.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      );
    case 'text':
      return (
        <div className="form-row">
          <label htmlFor={fid}>{tx('ข้อความ (เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่)')}</label>
          <textarea id={fid} rows={7} maxLength={PAGE_LIMITS.text} value={item.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      );
    case 'list':
      return (
        <>
          <TextList
            title={tx('รายการ')}
            rows={(item.items ?? []).map((text) => ({ text }))}
            fields={[{ key: 'text', label: tx('ข้อความ'), max: PAGE_LIMITS.listItem }]}
            max={PAGE_LIMITS.listItems}
            blank={{ text: '' }}
            inline={{ marker: item.ordered ? 'number' : 'bullet' }}
            addLabel={tx('เพิ่มข้อ')}
            onChange={(rows) => onChange({ items: rows.map((r) => r.text) })}
          />
          <label className="pe-check">
            <input type="checkbox" checked={item.ordered === true} onChange={(e) => onChange({ ordered: e.target.checked })} />
            <span>{tx('ใส่เลขลำดับ (1, 2, 3)')}</span>
          </label>
        </>
      );
    case 'table': {
      const rows = item.rows ?? [['']];
      const width = rows[0]?.length ?? 1;
      const setCell = (r: number, c: number, v: string) =>
        onChange({ rows: rows.map((row, ri) => (ri === r ? row.map((cell, ci) => (ci === c ? v : cell)) : row)) });
      return (
        <>
          <div className="pe-table-edit" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
            {rows.map((row, r) =>
              row.map((cell, c) => (
                <input
                  key={`${r}-${c}`}
                  type="text"
                  className={r === 0 ? 'is-head' : ''}
                  maxLength={PAGE_LIMITS.tableCell}
                  value={cell}
                  aria-label={r === 0 ? txf('หัวคอลัมน์ {0}', c + 1) : txf('แถว {0} คอลัมน์ {1}', r, c + 1)}
                  onChange={(e) => setCell(r, c, e.target.value)}
                />
              ))
            )}
          </div>
          <p className="pe-hint">{tx('แถวแรกเป็นหัวตาราง')}</p>
          <div className="pe-block-actions">
            <button type="button" className="btn-ghost-sm" disabled={rows.length >= PAGE_LIMITS.tableRows} onClick={() => onChange({ rows: [...rows, Array(width).fill('')] })}>
              <FaIcon name="plus" />
              <span>{tx('แถว')}</span>
            </button>
            <button type="button" className="btn-ghost-sm" disabled={rows.length <= 2} onClick={() => onChange({ rows: rows.slice(0, -1) })}>
              <FaIcon name="minus" />
              <span>{tx('แถว')}</span>
            </button>
            <button type="button" className="btn-ghost-sm" disabled={width >= PAGE_LIMITS.tableCols} onClick={() => onChange({ rows: rows.map((row) => [...row, '']) })}>
              <FaIcon name="plus" />
              <span>{tx('คอลัมน์')}</span>
            </button>
            <button type="button" className="btn-ghost-sm" disabled={width <= 1} onClick={() => onChange({ rows: rows.map((row) => row.slice(0, -1)) })}>
              <FaIcon name="minus" />
              <span>{tx('คอลัมน์')}</span>
            </button>
          </div>
        </>
      );
    }
    case 'faq': {
      const faqs = item.faqs ?? [];
      const setFaq = (i: number, patch: Partial<{ q: string; a: string }>) =>
        onChange({ faqs: faqs.map((f, fi) => (fi === i ? { ...f, ...patch } : f)) });
      return (
        <>
          {faqs.map((f, i) => (
            <fieldset key={i} className="pe-faq-edit">
              <legend>{txf('คำถามที่ {0}', i + 1)}</legend>
              <input type="text" maxLength={PAGE_LIMITS.faqQuestion} value={f.q} placeholder={tx('คำถาม')} aria-label={txf('คำถามที่ {0}', i + 1)} onChange={(e) => setFaq(i, { q: e.target.value })} />
              <textarea rows={3} maxLength={PAGE_LIMITS.faqAnswer} value={f.a} placeholder={tx('คำตอบ')} aria-label={txf('คำตอบข้อ {0}', i + 1)} onChange={(e) => setFaq(i, { a: e.target.value })} />
              <button type="button" className="btn-ghost-sm pe-remove-block" onClick={() => onChange({ faqs: faqs.filter((_, fi) => fi !== i) })}>
                <FaIcon name="trash-can" />
                <span>{tx('ลบคำถามนี้')}</span>
              </button>
            </fieldset>
          ))}
          <button type="button" className="btn-secondary" disabled={faqs.length >= PAGE_LIMITS.faqs} onClick={() => onChange({ faqs: [...faqs, { q: '', a: '' }] })}>
            <FaIcon name="plus" />
            <span>{tx('เพิ่มคำถาม')}</span>
          </button>
        </>
      );
    }
    case 'image':
      return (
        <div className="pe-image">
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="pe-image-empty">{tx('ยังไม่มีภาพ')}</span>}
          <label className="btn-secondary pe-upload">
            <FaIcon name="upload" />
            <span>{busy ? tx('กำลังย่อภาพ…') : item.imageUrl ? tx('เปลี่ยนภาพ') : tx('เลือกภาพ')}</span>
            <input
              type="file"
              accept={ALLOWED_MIME.join(',')}
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                setBusy(true);
                try {
                  const url = await pickImage(file, 1200, PAGE_LIMITS.imageChars);
                  if (url) onChange({ imageUrl: url, imageAlt: item.imageAlt || (file?.name ?? '').replace(/\.[^.]+$/, '') });
                } catch {
                  onError(tx('อ่านไฟล์ภาพไม่สำเร็จ'));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
          <label className="pe-label" htmlFor={fid}>
            {tx('คำอธิบายภาพ (สำหรับผู้ใช้โปรแกรมอ่านหน้าจอ)')}
          </label>
          <input id={fid} type="text" maxLength={PAGE_LIMITS.alt} value={item.imageAlt ?? ''} onChange={(e) => onChange({ imageAlt: e.target.value })} />
        </div>
      );
    case 'gallery': {
      const images = item.images ?? [];
      return (
        <div className="pe-gallery-edit">
          {images.length > 0 && (
            <ul>
              {images.map((g, i) => (
                <li key={i}>
                  <img src={g.url} alt="" />
                  <input
                    type="text"
                    maxLength={PAGE_LIMITS.alt}
                    value={g.alt}
                    placeholder={tx('คำอธิบายภาพ')}
                    aria-label={txf('คำอธิบายภาพที่ {0}', i + 1)}
                    onChange={(e) => onChange({ images: images.map((x, xi) => (xi === i ? { ...x, alt: e.target.value } : x)) })}
                  />
                  <button type="button" className="pe-icon-btn is-danger" aria-label={txf('ลบภาพที่ {0}', i + 1)} onClick={() => onChange({ images: images.filter((_, xi) => xi !== i) })}>
                    <FaIcon name="trash-can" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className={`btn-secondary pe-upload ${images.length >= PAGE_LIMITS.galleryImages ? 'is-disabled' : ''}`}>
            <FaIcon name="upload" />
            <span>{busy ? tx('กำลังย่อภาพ…') : txf('เพิ่มภาพ ({0}/{1})', images.length, PAGE_LIMITS.galleryImages)}</span>
            <input
              type="file"
              multiple
              accept={ALLOWED_MIME.join(',')}
              className="sr-only"
              disabled={images.length >= PAGE_LIMITS.galleryImages}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, PAGE_LIMITS.galleryImages - images.length);
                e.target.value = '';
                setBusy(true);
                try {
                  const added: { url: string; alt: string }[] = [];
                  for (const f of files) {
                    const url = await pickImage(f, 900, PAGE_LIMITS.galleryImageChars);
                    if (url) added.push({ url, alt: f.name.replace(/\.[^.]+$/, '') });
                  }
                  if (added.length) onChange({ images: [...images, ...added] });
                } catch {
                  onError(tx('อ่านไฟล์ภาพไม่สำเร็จ'));
                } finally {
                  setBusy(false);
                }
              }}
            />
          </label>
        </div>
      );
    }
    case 'file':
      return (
        <div className="pe-image">
          <span className="pe-image-empty">
            <FaIcon name="file-pdf" /> {item.fileName || tx('ยังไม่มีไฟล์')}
          </span>
          <label className="btn-secondary pe-upload">
            <FaIcon name="upload" />
            <span>{item.fileUrl ? tx('เปลี่ยนไฟล์ PDF') : tx('เลือกไฟล์ PDF (ไม่เกิน 2 MB)')}</span>
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                if (file.type !== 'application/pdf') return onError(tx('รองรับเฉพาะไฟล์ PDF'));
                if (file.size > 2 * 1024 * 1024) return onError(tx('ไฟล์ PDF ใหญ่เกิน 2 MB'));
                try {
                  const url = await readFileAsDataUrl(file);
                  if (url.length > PAGE_LIMITS.fileChars) return onError(tx('ไฟล์ PDF ใหญ่เกิน 2 MB'));
                  onChange({ fileUrl: url, fileName: file.name.slice(0, PAGE_LIMITS.fileName), label: item.label || file.name.replace(/\.pdf$/i, '') });
                } catch {
                  onError(tx('อ่านไฟล์ไม่สำเร็จ'));
                }
              }}
            />
          </label>
          <label className="pe-label" htmlFor={fid}>
            {tx('ข้อความบนปุ่มดาวน์โหลด')}
          </label>
          <input id={fid} type="text" maxLength={PAGE_LIMITS.label} value={item.label ?? ''} placeholder={tx('เช่น ดาวน์โหลดระเบียบการ')} onChange={(e) => onChange({ label: e.target.value })} />
        </div>
      );
    case 'link':
      return (
        <div className="pe-link">
          <label className="pe-label" htmlFor={fid}>
            {tx('ข้อความบนปุ่ม')}
          </label>
          <input id={fid} type="text" maxLength={PAGE_LIMITS.label} value={item.label ?? ''} placeholder={tx('ข้อความบนปุ่ม เช่น ดูระเบียบการ')} onChange={(e) => onChange({ label: e.target.value })} />
          <label className="pe-label" htmlFor={`${fid}-href`}>
            {tx('ลิงก์ (https://)')}
          </label>
          <input
            id={`${fid}-href`}
            type="url"
            maxLength={PAGE_LIMITS.href}
            value={item.href ?? ''}
            placeholder="https://"
            aria-invalid={Boolean(item.href) && !isSafeLink(item.href ?? '')}
            onChange={(e) => onChange({ href: e.target.value.trim() })}
          />
          {item.href && !isSafeLink(item.href) && <span className="field-error">{tx('ลิงก์ต้องขึ้นต้นด้วย https://')}</span>}
        </div>
      );
    case 'divider':
      return <p className="pe-hint">{tx('เส้นคั่นไม่มีค่าให้ตั้ง ย้ายหรือลบได้อย่างเดียว')}</p>;
    case 'cards': {
      const cards = item.cards ?? [];
      return (
        <TextList
          title={tx('การ์ด')}
          rows={cards.map((c) => ({ title: c.title, detail: c.detail, scope: c.scope, icon: c.icon ?? '', iconImage: c.iconImage ?? '' }))}
          renderExtra={(_, i) => {
            const c = cards[i];
            const current = CARD_ICONS.find((x) => x.name === (c?.icon || 'gift'));
            return (
              <details className="pe-icon-pick">
                <summary>
                  <span className="pe-icon-pick-now" aria-hidden="true">
                    {c?.iconImage ? <img src={c.iconImage} alt="" /> : <FaIcon name={c?.icon || 'gift'} />}
                  </span>
                  <span>
                    {tx('ไอคอน')}: {c?.iconImage ? tx('ภาพที่อัปโหลด') : tx(current?.label ?? '')}
                  </span>
                </summary>
                <CardIconPicker
                  index={i}
                  icon={c?.icon}
                  iconImage={c?.iconImage}
                  onPick={(patch) => onChange({ cards: cards.map((x, j) => (j === i ? withCardIcon(x, patch) : x)) })}
                  onError={onError}
                />
              </details>
            );
          }}
          fields={[
            { key: 'title', label: tx('หัวข้อ'), max: CORE_TEXT_LIMITS.racepackTitle },
            { key: 'detail', label: tx('คำอธิบาย'), multi: true, max: CORE_TEXT_LIMITS.racepackDetail },
            { key: 'scope', label: tx('ป้ายสั้น (เช่น ใครได้รับ)'), max: CORE_TEXT_LIMITS.racepackScope },
          ]}
          max={CORE_TEXT_LIMITS.racepackItems}
          blank={{ title: '', detail: '', scope: '', icon: '', iconImage: '' }}
          onChange={(rows) =>
            // rows carry the icon too (no input for it), so a moved row takes its icon along
            onChange({
              cards: rows.map(({ icon, iconImage, ...texts }) => ({
                ...texts,
                ...(icon && icon !== 'gift' ? { icon } : {}),
                ...(iconImage ? { iconImage } : {}),
              })),
            })
          }
        />
      );
    }
    case 'timeline':
      return (
        <TextList
          title={tx('รายการ')}
          rows={item.timeline ?? []}
          fields={[
            { key: 'timeLabel', label: tx('เวลา'), max: CORE_TEXT_LIMITS.scheduleTime },
            { key: 'title', label: tx('หัวข้อ'), max: CORE_TEXT_LIMITS.scheduleTitle },
            { key: 'detail', label: tx('รายละเอียด'), multi: true, max: CORE_TEXT_LIMITS.scheduleDetail },
          ]}
          max={CORE_TEXT_LIMITS.scheduleItems}
          blank={{ timeLabel: '', title: '', detail: '' }}
          onChange={(timeline) => onChange({ timeline })}
        />
      );
    default:
      return null;
  }
}
