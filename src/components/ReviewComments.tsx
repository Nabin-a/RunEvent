import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tx, txf } from '../i18n';
import { IconCheckCircle, IconClose } from './Icons';

/**
 * Google-Docs-style review comments for testers (only rendered when the server runs
 * with sandbox tools on: local dev and the team demo VM).
 *
 * - "Comment" mode: hover outlines the element under the pointer, a click drops a pin
 *   there. The pin is anchored to that element (CSS path + offset inside it), so it
 *   follows scrolling, inner scroll areas and resizes.
 * - A pin opens its thread: replies, resolve / re-open. A reply re-opens a thread.
 * - The panel lists every thread on every page and jumps to the pin.
 * Threads are stored on the server (SQLite) so the whole team sees the same ones.
 */

export interface ReviewComment {
  id: string;
  parentId: string | null;
  path: string;
  selector: string;
  offsetX: number;
  offsetY: number;
  anchorText: string;
  viewport: string;
  lang: string;
  body: string;
  authorUserId: string | null;
  authorName: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

interface Thread {
  root: ReviewComment;
  replies: ReviewComment[];
  no: number;
}

interface Anchor {
  selector: string;
  offsetX: number;
  offsetY: number;
  anchorText: string;
}

interface Props {
  path: string;
  lang: 'th' | 'en';
  placing: boolean;
  onPlacingChange: (next: boolean) => void;
  panelOpen: boolean;
  onPanelOpenChange: (next: boolean) => void;
  onOpenCountChange: (n: number) => void;
  onNavigatePath: (path: string) => void;
}

const UI_ATTR = 'data-review-ui';
const POLL_MS = 20000;

/* ------------------------------------------------------------------------ */
/* anchoring                                                                */
/* ------------------------------------------------------------------------ */

const usableId = (id: string) => id && !id.includes(':') && !/\d{6,}/.test(id);

/** Short CSS path to an element: stops at the nearest element with a stable id. */
function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 10) {
    if (usableId(cur.id)) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      return parts.join(' > ');
    }
    const tag = cur.tagName.toLowerCase();
    const parent: Element | null = cur.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const same = Array.from(parent.children).filter((c) => c.tagName === cur!.tagName);
    parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag);
    cur = parent;
  }
  return ['body', ...parts].join(' > ');
}

function findAnchor(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}

function pinPoint(c: ReviewComment): { x: number; y: number } | null {
  const el = findAnchor(c.selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + c.offsetX * r.width, y: r.top + c.offsetY * r.height };
}

const isOurUi = (t: EventTarget | null) =>
  t instanceof Element && Boolean(t.closest(`[${UI_ATTR}]`));

/* ------------------------------------------------------------------------ */
/* api                                                                      */
/* ------------------------------------------------------------------------ */

async function api(
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  body?: unknown
): Promise<{ ok: boolean; comments?: ReviewComment[]; id?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return await res.json();
  } catch {
    return { ok: false, error: tx('เชื่อมต่อระบบ comment ไม่ได้') };
  }
}

const fmtTime = (iso: string, lang: 'th' | 'en') => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(d);
};

/* ------------------------------------------------------------------------ */
/* component                                                                */
/* ------------------------------------------------------------------------ */

export const ReviewComments: React.FC<Props> = ({
  path,
  lang,
  placing,
  onPlacingChange,
  panelOpen,
  onPanelOpenChange,
  onOpenCountChange,
  onNavigatePath,
}) => {
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [draft, setDraft] = useState<Anchor | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [filter, setFilter] = useState<'open' | 'resolved'>('open');
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  // a thread to open once its page has rendered (jump from the panel)
  const pendingJump = useRef<string | null>(null);

  const load = useCallback(async () => {
    const res = await api('GET', '/api/review-comments');
    if (res.ok && res.comments) setComments(res.comments);
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const threads: Thread[] = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    return roots.map((root, i) => ({
      root,
      replies: comments.filter((c) => c.parentId === root.id),
      no: i + 1,
    }));
  }, [comments]);

  const openCount = threads.filter((t) => t.root.status === 'open').length;
  useEffect(() => onOpenCountChange(openCount), [openCount, onOpenCountChange]);

  const pageThreads = threads.filter(
    (t) => t.root.path === path && (t.root.status === 'open' || t.root.id === activeId)
  );

  /* ---- keep pins glued to their elements (scroll, inner scroll, resize, re-render) ---- */
  useEffect(() => {
    if (pageThreads.length === 0 && !draft) return;
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setTick((n) => n + 1);
      });
    };
    window.addEventListener('scroll', bump, { capture: true, passive: true });
    window.addEventListener('resize', bump);
    const interval = window.setInterval(bump, 1000);
    return () => {
      window.removeEventListener('scroll', bump, { capture: true });
      window.removeEventListener('resize', bump);
      window.clearInterval(interval);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pageThreads.length, draft]);

  /* ---- comment mode: outline under the pointer, click drops a pin ---- */
  useEffect(() => {
    if (!placing) {
      setHoverRect(null);
      return;
    }
    document.body.classList.add('review-placing');
    const onMove = (e: PointerEvent) => {
      if (isOurUi(e.target)) {
        setHoverRect(null);
        return;
      }
      const el = e.target as Element | null;
      setHoverRect(el && el !== document.body ? el.getBoundingClientRect() : null);
    };
    const swallow = (e: Event) => {
      if (isOurUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (isOurUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as Element;
      const r = el.getBoundingClientRect();
      setDraft({
        selector: cssPath(el),
        offsetX: r.width ? (e.clientX - r.left) / r.width : 0,
        offsetY: r.height ? (e.clientY - r.top) / r.height : 0,
        anchorText: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 80),
      });
      setActiveId(null);
      onPlacingChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onPlacingChange(false);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerdown', swallow, true);
    window.addEventListener('mousedown', swallow, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('review-placing');
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerdown', swallow, true);
      window.removeEventListener('mousedown', swallow, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [placing, onPlacingChange]);

  /* ---- jump from the panel once the target page is on screen ---- */
  useEffect(() => {
    const id = pendingJump.current;
    if (!id) return;
    const t = threads.find((x) => x.root.id === id);
    if (!t || t.root.path !== path) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = findAnchor(t.root.selector);
      tries += 1;
      if (el || tries > 20) {
        window.clearInterval(timer);
        pendingJump.current = null;
        el?.scrollIntoView({ block: 'center', behavior: 'auto' });
        setActiveId(id);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [path, threads]);

  const jumpTo = (t: Thread) => {
    onPanelOpenChange(false);
    setDraft(null);
    pendingJump.current = t.root.id;
    if (t.root.path !== path) onNavigatePath(t.root.path);
    else setTick((n) => n + 1);
    // same page: the effect above runs on the next render
    if (t.root.path === path) {
      const el = findAnchor(t.root.selector);
      el?.scrollIntoView({ block: 'center', behavior: 'auto' });
      pendingJump.current = null;
      setActiveId(t.root.id);
    }
  };

  /* ---- actions ---- */
  const createThread = async (body: string) => {
    if (!draft) return false;
    const res = await api('POST', '/api/review-comments', {
      ...draft,
      body,
      path,
      lang,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
    if (!res.ok || !res.comments) {
      setError(res.error ?? tx('บันทึก comment ไม่สำเร็จ'));
      return false;
    }
    setError(null);
    setComments(res.comments);
    setDraft(null);
    setActiveId(res.id ?? null);
    return true;
  };

  const reply = async (parentId: string, body: string) => {
    const res = await api('POST', '/api/review-comments', { parentId, body, lang });
    if (!res.ok || !res.comments) {
      setError(res.error ?? tx('บันทึก comment ไม่สำเร็จ'));
      return false;
    }
    setError(null);
    setComments(res.comments);
    return true;
  };

  const setStatus = async (id: string, status: 'open' | 'resolved') => {
    const res = await api('PATCH', `/api/review-comments/${encodeURIComponent(id)}`, { status });
    if (res.ok && res.comments) {
      setComments(res.comments);
      if (status === 'resolved') setActiveId(null);
    }
  };

  const active = threads.find((t) => t.root.id === activeId) ?? null;
  const draftPoint = draft
    ? pinPoint({ ...(draft as Anchor), id: 'draft' } as ReviewComment)
    : null;
  const activePoint = active ? pinPoint(active.root) : null;
  const listed = threads.filter((t) => t.root.status === filter).reverse();

  return (
    <div className="review-layer" {...{ [UI_ATTR]: '' }}>
      {placing && (
        <>
          {hoverRect && (
            <div
              className="review-hover-box"
              aria-hidden="true"
              style={{
                transform: `translate(${hoverRect.left}px, ${hoverRect.top}px)`,
                width: hoverRect.width,
                height: hoverRect.height,
              }}
            />
          )}
          <div className="review-placing-hint" role="status">
            <span>{tx('คลิกจุดที่ต้องการแสดงความคิดเห็น')}</span>
            <button type="button" className="btn-ghost-sm" onClick={() => onPlacingChange(false)}>
              {tx('ยกเลิก')} (Esc)
            </button>
          </div>
        </>
      )}

      {/* pins of this page */}
      {pageThreads.map((t) => {
        const p = pinPoint(t.root);
        if (!p) return null;
        return (
          <button
            key={t.root.id}
            type="button"
            className={`review-pin ${t.root.id === activeId ? 'is-active' : ''} ${
              t.root.status === 'resolved' ? 'is-resolved' : ''
            }`}
            style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            aria-label={txf('ความคิดเห็นที่ {0} โดย {1}', t.no, t.root.authorName)}
            aria-expanded={t.root.id === activeId}
            onClick={() => {
              setDraft(null);
              setActiveId(t.root.id === activeId ? null : t.root.id);
            }}
          >
            {t.no}
          </button>
        );
      })}

      {/* new thread composer */}
      {draft && draftPoint && (
        <>
          <span
            className="review-pin is-draft"
            aria-hidden="true"
            style={{ transform: `translate(${draftPoint.x}px, ${draftPoint.y}px)` }}
          >
            +
          </span>
          <Popover at={draftPoint} onClose={() => setDraft(null)} label={tx('ความคิดเห็นใหม่')}>
            {draft.anchorText && <p className="review-anchor-text">“{draft.anchorText}”</p>}
            <Composer
              autoFocus
              placeholder={tx('พิมพ์ความคิดเห็น เช่น ปุ่มนี้กดแล้วไม่ไปต่อ')}
              submitLabel={tx('ส่งความคิดเห็น')}
              onSubmit={createThread}
              onCancel={() => setDraft(null)}
            />
            {error && <p className="review-error" role="alert">{error}</p>}
          </Popover>
        </>
      )}

      {/* thread */}
      {active && activePoint && !draft && (
        <Popover
          at={activePoint}
          onClose={() => setActiveId(null)}
          label={txf('ความคิดเห็นที่ {0}', active.no)}
        >
          <div className="review-thread-head">
            <span className="review-thread-no">#{active.no}</span>
            {active.root.status === 'resolved' ? (
              <button
                type="button"
                className="btn-ghost-sm"
                onClick={() => void setStatus(active.root.id, 'open')}
              >
                {tx('เปิดใหม่')}
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost-sm review-resolve-btn"
                onClick={() => void setStatus(active.root.id, 'resolved')}
              >
                <IconCheckCircle size={14} />
                <span>{tx('แก้แล้ว')}</span>
              </button>
            )}
          </div>
          <ol className="review-messages">
            {[active.root, ...active.replies].map((m) => (
              <li key={m.id}>
                <div className="review-msg-meta">
                  <strong>{m.authorName}</strong>
                  <span>{fmtTime(m.createdAt, lang)}</span>
                </div>
                <p className="review-msg-body">{m.body}</p>
              </li>
            ))}
          </ol>
          {active.root.status === 'resolved' && active.root.resolvedBy && (
            <p className="review-resolved-note">
              {txf('แก้แล้วโดย {0}', active.root.resolvedBy)}
            </p>
          )}
          <Composer
            key={active.root.id}
            placeholder={tx('ตอบกลับ')}
            submitLabel={tx('ตอบกลับ')}
            onSubmit={(body) => reply(active.root.id, body)}
          />
          {error && <p className="review-error" role="alert">{error}</p>}
        </Popover>
      )}

      {/* all threads */}
      {panelOpen && (
        <aside className="review-panel" aria-label={tx('ความคิดเห็นทั้งหมด')}>
          <div className="review-panel-head">
            <strong>{tx('ความคิดเห็นจากการทดสอบ')}</strong>
            <button
              type="button"
              className="btn-ghost-sm"
              aria-label={tx('ปิด')}
              onClick={() => onPanelOpenChange(false)}
            >
              <IconClose size={14} />
            </button>
          </div>
          <div className="review-panel-tabs" role="tablist">
            {(['open', 'resolved'] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className={filter === f ? 'is-active' : ''}
                onClick={() => setFilter(f)}
              >
                {f === 'open' ? tx('ยังเปิดอยู่') : tx('แก้แล้ว')} (
                {threads.filter((t) => t.root.status === f).length})
              </button>
            ))}
          </div>
          {listed.length === 0 ? (
            <p className="review-empty">
              {filter === 'open'
                ? tx('ยังไม่มีความคิดเห็นที่เปิดอยู่ กด "ปักหมุด comment" แล้วคลิกจุดบนหน้าเว็บ')
                : tx('ยังไม่มีความคิดเห็นที่แก้แล้ว')}
            </p>
          ) : (
            <ul className="review-list">
              {listed.map((t) => (
                <li key={t.root.id}>
                  <button type="button" className="review-list-item" onClick={() => jumpTo(t)}>
                    <span className="review-thread-no">#{t.no}</span>
                    <span className="review-list-copy">
                      <span className="review-list-body">{t.root.body}</span>
                      <span className="review-list-meta">
                        {t.root.authorName} · {fmtTime(t.root.createdAt, lang)} ·{' '}
                        <span className="mono-code">{t.root.path}</span>
                        {t.replies.length > 0 && ` · ${txf('{0} คำตอบ', t.replies.length)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------------ */
/* pieces                                                                   */
/* ------------------------------------------------------------------------ */

const Popover: React.FC<{
  at: { x: number; y: number };
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ at, label, onClose, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: at.x + 18, top: at.y - 12 });

  // keep the card on screen: right of the pin, flipped left / up when there is no room
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const margin = 8;
    let left = at.x + 18;
    if (left + w > window.innerWidth - margin) left = at.x - 18 - w;
    left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));
    let top = at.y - 12;
    top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
    setPos({ left, top });
  }, [at.x, at.y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="review-popover"
      role="dialog"
      aria-label={label}
      style={{ transform: `translate(${pos.left}px, ${pos.top}px)` }}
    >
      <button type="button" className="review-popover-close" aria-label={tx('ปิด')} onClick={onClose}>
        <IconClose size={13} />
      </button>
      {children}
    </div>
  );
};

const Composer: React.FC<{
  placeholder: string;
  submitLabel: string;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
}> = ({ placeholder, submitLabel, autoFocus, onSubmit, onCancel }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const ok = await onSubmit(body);
    setBusy(false);
    if (ok) setText('');
  };
  return (
    <form
      className="review-composer"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <textarea
        value={text}
        rows={3}
        maxLength={2000}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Ctrl/Cmd + Enter sends, plain Enter makes a new line
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
      />
      <div className="review-composer-actions">
        {onCancel && (
          <button type="button" className="btn-ghost-sm" onClick={onCancel}>
            {tx('ยกเลิก')}
          </button>
        )}
        <button type="submit" className="btn-primary review-send-btn" disabled={!text.trim() || busy}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
};
