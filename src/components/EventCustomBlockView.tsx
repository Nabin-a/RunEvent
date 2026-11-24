import type React from 'react';
import type { EventCustomBlock, EventPageItem } from '../types';
import { tx } from '../i18n';
import { FaIcon } from './FaIcon';
import { ScheduleTimeline } from './ScheduleTimeline';

/**
 * A free block on the public event page: the organizer's title and 1-3 columns of
 * pieces (heading, text, list, table, FAQ, image, gallery, PDF file, link, divider).
 * Columns stack on phones. Organizer text is shown as written (not translated).
 * Empty pieces are skipped on the live page; in the editor preview they show a
 * placeholder, every column and piece carries data attributes the editor uses as
 * drop targets, and clicking a piece selects it in the editor. Text the organizer typed
 * is also marked `data-page-edit` (target + raw value) so it can be edited in place in the
 * preview (pagePreview.ts draws the editing box; the editor saves the result).
 * A `nested` piece draws another block (built-in or free) inside the column through
 * `renderNested`; a nested free block uses a smaller heading and no card of its own.
 */
export function EventCustomBlockView({
  block,
  sectionId,
  preview = false,
  selectedKey = null,
  onPick,
  nested = false,
  renderNested,
  renderData,
  dataHasContent,
}: {
  block: EventCustomBlock;
  sectionId: string;
  preview?: boolean;
  /** editor selection, e.g. `item:<blockId>:<itemId>` */
  selectedKey?: string | null;
  onPick?: (key: string) => void;
  /** drawn inside a column of another free block */
  nested?: boolean;
  /** draws the block a `nested` piece points at */
  renderNested?: (ref: string) => React.ReactNode;
  /** draws a `data` piece (event data, read-only) */
  renderData?: (item: EventPageItem) => React.ReactNode;
  /** does a `data` piece have anything to show */
  dataHasContent?: (item: EventPageItem) => boolean;
}) {
  const titleId = `${sectionId}-title`;
  const Title = nested ? 'h3' : 'h2';
  // nothing in it would show on the public page: leave the whole block out there (the editor says so)
  const showsSomething = block.cells.some((c) => c.some((it) => pieceShows(it, renderNested, dataHasContent)));
  if (!preview && !showsSomething) return null;
  return (
    <section
      id={sectionId}
      className={`clean-panel custom-block ${nested ? 'is-nested' : ''}`}
      aria-labelledby={titleId}
    >
      <Title id={titleId} className="custom-block-title" {...editable(preview, `title:${block.id}`, 'line', block.title)}>
        {block.title}
      </Title>
      {preview && !showsSomething && (
        <p className="custom-block-empty data-piece-empty">{tx('บล็อกนี้ยังไม่มีอะไรแสดง หน้าจริงจะไม่แสดงบล็อกนี้')}</p>
      )}
      <div className={`custom-block-grid cols-${block.columns}`}>
        {block.cells.map((items, col) => (
          <div
            key={col}
            className="custom-block-col"
            {...(preview ? { 'data-page-col': `${block.id}:${col}` } : {})}
          >
            {items.map((item) => {
              if (!preview) {
                return <PageItem key={item.id} item={item} preview={false} renderNested={renderNested} renderData={renderData} />;
              }
              const view = (
                <PageItem
                  item={item}
                  preview
                  editBase={`item:${block.id}:${item.id}`}
                  renderNested={renderNested}
                  renderData={renderData}
                />
              );
              const key = `item:${block.id}:${item.id}`;
              return (
                <div
                  key={item.id}
                  data-page-item={`${block.id}:${item.id}`}
                  className={`custom-block-piece ${item.kind === 'nested' ? 'is-nested-block' : ''} ${selectedKey === key ? 'is-picked' : ''}`}
                  onClickCapture={(e) => {
                    // a piece of a nested free block picks itself; anything else inside this
                    // piece (buttons and links of a nested built-in block too) must not act
                    if ((e.target as HTMLElement).closest('[data-page-item]') !== e.currentTarget) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onPick?.(key);
                  }}
                >
                  {view}
                </div>
              );
            })}
            {preview && items.length === 0 && (
              <p className="custom-block-empty">{tx('ลากชิ้นส่วนจากคลังมาวางในคอลัมน์นี้')}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** marks organizer text that can be edited in place in the editor preview */
type EditMode = 'line' | 'multi';
const editable = (preview: boolean, target: string | null | undefined, mode: EditMode, value: string) =>
  preview && target ? { 'data-page-edit': target, 'data-edit-mode': mode, 'data-edit-value': value } : {};

/** would this piece show anything on the public page */
function pieceShows(
  it: EventPageItem,
  renderNested?: (ref: string) => React.ReactNode,
  dataHasContent?: (item: EventPageItem) => boolean
): boolean {
  switch (it.kind) {
    case 'heading':
    case 'text':
      return !!it.text?.trim();
    case 'list':
      return (it.items ?? []).some((x) => x.trim());
    case 'table':
      return (it.rows ?? []).some((r) => r.some((c) => c.trim()));
    case 'faq':
      return (it.faqs ?? []).some((f) => f.q.trim());
    case 'image':
      return !!it.imageUrl;
    case 'gallery':
      return (it.images ?? []).length > 0;
    case 'file':
      return !!it.fileUrl;
    case 'link':
      return !!it.href && !!it.label;
    case 'nested':
      return !!it.ref && !!renderNested && renderNested(it.ref) != null;
    case 'cards':
      return (it.cards ?? []).some((c) => c.title.trim());
    case 'timeline':
      return (it.timeline ?? []).some((t) => t.title.trim() || t.timeLabel.trim());
    case 'data':
      return !!dataHasContent?.(it);
    default:
      return false;
  }
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

function Empty({ preview, text, edit }: { preview: boolean; text: string; edit?: ReturnType<typeof editable> }) {
  return preview ? (
    <p className="custom-block-empty" {...edit}>
      {text}
    </p>
  ) : null;
}

function PageItem({
  item,
  preview,
  editBase,
  renderNested,
  renderData,
}: {
  item: EventPageItem;
  preview: boolean;
  editBase?: string;
  renderNested?: (ref: string) => React.ReactNode;
  renderData?: (item: EventPageItem) => React.ReactNode;
}) {
  /** edit target of one field of this piece, e.g. `item:<blockId>:<itemId>:text` */
  const ed = (path: string, mode: EditMode, value: string) => editable(preview, editBase && `${editBase}:${path}`, mode, value);
  switch (item.kind) {
    case 'heading':
      return item.text?.trim() ? (
        <h3 className="custom-block-heading" {...ed('text', 'line', item.text)}>
          {item.text}
        </h3>
      ) : (
        <Empty preview={preview} text={tx('หัวข้อย่อยว่าง')} edit={ed('text', 'line', '')} />
      );
    case 'text': {
      const paras = paragraphs(item.text ?? '');
      if (paras.length === 0) return <Empty preview={preview} text={tx('ข้อความว่าง')} edit={ed('text', 'multi', '')} />;
      return (
        <div className="custom-block-text" {...ed('text', 'multi', item.text ?? '')}>
          {paras.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      );
    }
    case 'list': {
      // keep each line's place in item.items so an in-place edit lands on the right one
      const rows = (item.items ?? []).map((x, at) => ({ text: x.trim(), at })).filter((r) => r.text);
      if (rows.length === 0) return <Empty preview={preview} text={tx('รายการว่าง')} edit={ed('items.0', 'line', '')} />;
      const List = item.ordered ? 'ol' : 'ul';
      return (
        <List className="custom-block-list">
          {rows.map((r) => (
            <li key={r.at} {...ed(`items.${r.at}`, 'line', r.text)}>
              {r.text}
            </li>
          ))}
        </List>
      );
    }
    case 'table': {
      const rows = item.rows ?? [];
      const hasBody = rows.slice(1).some((r) => r.some((c) => c.trim()));
      if (rows.length === 0 || (!rows[0].some((c) => c.trim()) && !hasBody)) {
        return <Empty preview={preview} text={tx('ตารางว่าง')} />;
      }
      return (
        <div className="table-scroll custom-block-table-wrap">
          <table className="custom-block-table">
            <thead>
              <tr>
                {rows[0].map((c, i) => (
                  <th key={i} scope="col" {...ed(`rows.0.${i}`, 'line', c)}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} {...ed(`rows.${ri + 1}.${ci}`, 'line', c)}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'faq': {
      const faqs = (item.faqs ?? []).map((f, at) => ({ ...f, at })).filter((f) => f.q.trim());
      if (faqs.length === 0) return <Empty preview={preview} text={tx('ยังไม่มีคำถาม')} />;
      return (
        <div className="custom-block-faq">
          {faqs.map((f) => (
            // answers stay open in the editor preview so they can be read and edited there
            <details key={f.at} open={preview || undefined}>
              <summary {...ed(`faqs.${f.at}.q`, 'line', f.q)}>{f.q}</summary>
              <div className="custom-block-faq-a" {...ed(`faqs.${f.at}.a`, 'multi', f.a)}>
                {paragraphs(f.a).map((p, pi) => (
                  <p key={pi}>{p}</p>
                ))}
                {preview && !f.a.trim() && <p className="custom-block-empty">{tx('ยังไม่มีคำตอบ')}</p>}
              </div>
            </details>
          ))}
        </div>
      );
    }
    case 'image':
      if (!item.imageUrl) return <Empty preview={preview} text={tx('ยังไม่ได้เลือกภาพ')} />;
      return (
        <figure className="custom-block-figure">
          <img src={item.imageUrl} alt={item.imageAlt ?? ''} loading="lazy" decoding="async" />
          {item.imageAlt && <figcaption {...ed('imageAlt', 'line', item.imageAlt)}>{item.imageAlt}</figcaption>}
        </figure>
      );
    case 'gallery': {
      const images = item.images ?? [];
      if (images.length === 0) return <Empty preview={preview} text={tx('แกลเลอรียังไม่มีภาพ')} />;
      return (
        <ul className="custom-block-gallery">
          {images.map((g, i) => (
            <li key={i}>
              <img src={g.url} alt={g.alt} loading="lazy" decoding="async" />
            </li>
          ))}
        </ul>
      );
    }
    case 'file':
      if (!item.fileUrl) return <Empty preview={preview} text={tx('ยังไม่ได้เลือกไฟล์ PDF')} />;
      return (
        <a
          className="btn-secondary custom-block-link"
          href={item.fileUrl}
          download={item.fileUrl.startsWith('data:') ? item.fileName || 'document.pdf' : undefined}
          target={item.fileUrl.startsWith('data:') ? undefined : '_blank'}
          rel="noopener noreferrer"
        >
          <FaIcon name="file-pdf" />
          <span {...ed('label', 'line', item.label ?? '')}>{item.label || item.fileName || tx('ดาวน์โหลดไฟล์')}</span>
        </a>
      );
    case 'link':
      if (!item.href || !item.label) return <Empty preview={preview} text={tx('ลิงก์ยังไม่ครบ')} />;
      return (
        <a className="btn-secondary custom-block-link" href={item.href} target="_blank" rel="noopener noreferrer">
          <span {...ed('label', 'line', item.label)}>{item.label}</span>
          <FaIcon name="arrow-up-right-from-square" />
        </a>
      );
    case 'divider':
      return <hr className="custom-block-divider" />;
    case 'data':
      return renderData ? <>{renderData(item)}</> : null;
    case 'cards': {
      const cards = (item.cards ?? []).map((c, at) => ({ ...c, at })).filter((c) => preview || c.title.trim());
      if (cards.length === 0) return <Empty preview={preview} text={tx('ยังไม่มีการ์ด')} />;
      // editor preview: each card can be dragged to reorder (list `p~<blockId>~<itemId>`)
      const list = editBase ? editBase.replace(/^item:/, 'p~').replace(':', '~') : '';
      return (
        <div className="racepack-grid custom-block-cards">
          {cards.map((c) => (
            <div key={c.at} className="racepack-item-card" {...(preview && list ? { 'data-core-item': `${list}:${c.at}` } : {})}>
              <div className="cta-inline-row">
                <span className="custom-card-icon-slot" {...(preview && editBase ? { 'data-page-icon': `${editBase}:cards.${c.at}` } : {})}>
                  {c.iconImage ? <img className="custom-card-icon" src={c.iconImage} alt="" /> : <FaIcon name={c.icon || 'gift'} />}
                </span>
                <strong {...ed(`cards.${c.at}.title`, 'line', c.title)}>{c.title || tx('(ว่าง)')}</strong>
              </div>
              {(c.detail || preview) && (
                <p className="muted-block" {...ed(`cards.${c.at}.detail`, 'multi', c.detail)}>
                  {c.detail}
                </p>
              )}
              {(c.scope || preview) && (
                <span className="mono-code" {...ed(`cards.${c.at}.scope`, 'line', c.scope)}>
                  {c.scope}
                </span>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'timeline': {
      const rows = item.timeline ?? [];
      if (rows.length === 0) return <Empty preview={preview} text={tx('ยังไม่มีรายการในไทม์ไลน์')} />;
      const list = editBase ? editBase.replace(/^item:/, 'p~').replace(':', '~') : undefined;
      return (
        <ScheduleTimeline
          items={rows}
          editBase={preview && editBase ? `${editBase}:timeline` : undefined}
          dragList={preview ? list : undefined}
        />
      );
    }
    case 'nested': {
      const inner = item.ref && renderNested ? renderNested(item.ref) : null;
      if (!inner) return <Empty preview={preview} text={tx('บล็อกที่ซ้อนอยู่ไม่มีแล้ว')} />;
      return <div className="custom-block-nested">{inner}</div>;
    }
    default:
      return null;
  }
}
