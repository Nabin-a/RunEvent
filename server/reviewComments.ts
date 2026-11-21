import type { Express, Request, Response } from 'express';
import { db } from './db';
import type { UserAccount } from '../src/types';

/**
 * Review comments for testers (sandbox / team demo only).
 *
 * A thread is a root comment pinned to a spot on a page (route + element selector +
 * offset inside that element) plus its replies. Threads live in their own table so the
 * "reset demo data" button does not wipe the team's feedback.
 */

export interface ReviewCommentRow {
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

const MAX_BODY = 2000;
const MAX_SELECTOR = 600;

export function initReviewCommentsSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS review_comments (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES review_comments(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      selector TEXT NOT NULL DEFAULT '',
      offset_x REAL NOT NULL DEFAULT 0,
      offset_y REAL NOT NULL DEFAULT 0,
      anchor_text TEXT NOT NULL DEFAULT '',
      viewport TEXT NOT NULL DEFAULT '',
      lang TEXT NOT NULL DEFAULT 'th',
      body TEXT NOT NULL,
      author_user_id TEXT,
      author_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      resolved_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_review_comments_parent ON review_comments(parent_id);
  `);
}

interface DbRow {
  id: string;
  parent_id: string | null;
  path: string;
  selector: string;
  offset_x: number;
  offset_y: number;
  anchor_text: string;
  viewport: string;
  lang: string;
  body: string;
  author_user_id: string | null;
  author_name: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

const toRow = (r: DbRow): ReviewCommentRow => ({
  id: r.id,
  parentId: r.parent_id,
  path: r.path,
  selector: r.selector,
  offsetX: r.offset_x,
  offsetY: r.offset_y,
  anchorText: r.anchor_text,
  viewport: r.viewport,
  lang: r.lang,
  body: r.body,
  authorUserId: r.author_user_id,
  authorName: r.author_name,
  status: r.status === 'resolved' ? 'resolved' : 'open',
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
  resolvedBy: r.resolved_by,
});

const listAll = (): ReviewCommentRow[] =>
  (db.prepare('SELECT * FROM review_comments ORDER BY created_at ASC, rowid ASC').all() as unknown as DbRow[]).map(
    toRow
  );

const clamp01 = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
};

const newId = () => `rc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function registerReviewCommentRoutes(
  app: Express,
  deps: {
    guard: (req: Request, res: Response, next: () => void) => void;
    sessionUser: (req: Request) => UserAccount | null;
    now: () => string;
  }
): void {
  initReviewCommentsSchema();
  const { guard, sessionUser, now } = deps;
  const authorOf = (req: Request) => {
    const user = sessionUser(req);
    return {
      id: user?.id ?? null,
      name: user?.fullNameTh?.trim() || user?.contactEmail || 'ผู้ทดสอบ (Guest)',
    };
  };

  app.get('/api/review-comments', guard, (_req, res) => {
    res.json({ ok: true, comments: listAll() });
  });

  // New thread (with an anchor) or a reply (parentId)
  app.post('/api/review-comments', guard, (req, res) => {
    const b = req.body ?? {};
    const body = String(b.body ?? '').trim();
    if (!body) return res.status(400).json({ ok: false, error: 'กรุณาพิมพ์ข้อความ' });
    if (body.length > MAX_BODY) {
      return res.status(400).json({ ok: false, error: `ข้อความยาวเกิน ${MAX_BODY} ตัวอักษร` });
    }
    const author = authorOf(req);
    const parentId = b.parentId ? String(b.parentId) : null;
    let path = String(b.path ?? '').slice(0, 300);
    if (parentId) {
      const parent = db
        .prepare('SELECT id, parent_id, path FROM review_comments WHERE id = ?')
        .get(parentId) as { id: string; parent_id: string | null; path: string } | undefined;
      if (!parent || parent.parent_id) {
        return res.status(404).json({ ok: false, error: 'ไม่พบความคิดเห็นที่จะตอบกลับ' });
      }
      path = parent.path;
    } else if (!path.startsWith('/')) {
      return res.status(400).json({ ok: false, error: 'ไม่ทราบหน้าที่ปักหมุด' });
    }
    const id = newId();
    db.prepare(
      `INSERT INTO review_comments (
        id, parent_id, path, selector, offset_x, offset_y, anchor_text, viewport, lang,
        body, author_user_id, author_name, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    ).run(
      id,
      parentId,
      path,
      parentId ? '' : String(b.selector ?? '').slice(0, MAX_SELECTOR),
      parentId ? 0 : clamp01(b.offsetX),
      parentId ? 0 : clamp01(b.offsetY),
      parentId ? '' : String(b.anchorText ?? '').slice(0, 120),
      parentId ? '' : String(b.viewport ?? '').slice(0, 20),
      b.lang === 'en' ? 'en' : 'th',
      body,
      author.id,
      author.name,
      now()
    );
    // a reply re-opens a resolved thread, like Google Docs
    if (parentId) {
      db.prepare(
        "UPDATE review_comments SET status = 'open', resolved_at = NULL, resolved_by = NULL WHERE id = ?"
      ).run(parentId);
    }
    res.json({ ok: true, id, comments: listAll() });
  });

  // Resolve / re-open a thread
  app.patch('/api/review-comments/:id', guard, (req, res) => {
    const status = req.body?.status === 'resolved' ? 'resolved' : 'open';
    const row = db
      .prepare('SELECT id, parent_id FROM review_comments WHERE id = ?')
      .get(String(req.params.id)) as { id: string; parent_id: string | null } | undefined;
    if (!row || row.parent_id) {
      return res.status(404).json({ ok: false, error: 'ไม่พบความคิดเห็น' });
    }
    const author = authorOf(req);
    db.prepare(
      'UPDATE review_comments SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?'
    ).run(
      status,
      status === 'resolved' ? now() : null,
      status === 'resolved' ? author.name : null,
      row.id
    );
    res.json({ ok: true, comments: listAll() });
  });
}
