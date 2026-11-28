import React, { useEffect, useMemo, useRef, useState } from 'react';
import { tx, txf } from '../i18n';
import { IconArrowLeft, IconArrowRight, IconSearch } from './Icons';

/** rows per page */
export const LIST_PAGE_SIZE = 10;

const digitsOf = (s: string) => s.replace(/\D/g, '');

/** case-insensitive text match; 3+ digits also match phone numbers written with dashes or +66 */
export const matchesQuery = (hay: string, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (hay.toLowerCase().includes(q)) return true;
  const d = digitsOf(q);
  if (d.length < 3) return false;
  const hd = digitsOf(hay);
  // "0812345678" should also find "+66 81-234-5678"
  return hd.includes(d) || (d.startsWith('0') && hd.includes(d.slice(1)));
};

/** the page numbers to draw: every page up to 7, otherwise first, last and the pages around the current one */
export const pageNumbers = (page: number, pageCount: number): (number | 'gap')[] => {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i);
  // keep the row the same width: 5 numbers near either end, 3 in the middle
  const from = page <= 3 ? 1 : page >= pageCount - 4 ? pageCount - 5 : page - 1;
  const to = page <= 3 ? 4 : page >= pageCount - 4 ? pageCount - 2 : page + 1;
  const out: (number | 'gap')[] = [0];
  if (from > 1) out.push('gap');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pageCount - 2) out.push('gap');
  out.push(pageCount - 1);
  return out;
};

/**
 * Numbered page buttons ‹ 1 2 3 … 8 › (28 Nov 2026, user chose numbered pages over the old
 * "หน้า x / y" row, everywhere the pager is used; the "แสดง a–b จาก n รายการ" line under them
 * was taken out at the user's request). pageSize / shown / total stay in the props for callers.
 */
export const Pager: React.FC<{
  page: number;
  pageCount: number;
  pageSize: number;
  shown: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}> = ({ page, pageCount, onPage, className = '' }) => (
  <nav className={`list-pager${className ? ` ${className}` : ''}`} aria-label={tx('เลือกหน้า')}>
    <div className="list-pager-buttons">
      <button
        type="button"
        className="list-pager-btn is-step"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        aria-label={tx('หน้าก่อนหน้า')}
      >
        <IconArrowLeft size={16} />
      </button>
      {pageNumbers(page, pageCount).map((n, i) =>
        n === 'gap' ? (
          <span key={`gap-${i}`} className="list-pager-gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            className={`list-pager-btn${n === page ? ' is-current' : ''}`}
            aria-current={n === page ? 'page' : undefined}
            aria-label={txf('หน้า {0}', n + 1)}
            onClick={() => n !== page && onPage(n)}
          >
            {n + 1}
          </button>
        )
      )}
      <button
        type="button"
        className="list-pager-btn is-step"
        disabled={page >= pageCount - 1}
        onClick={() => onPage(page + 1)}
        aria-label={tx('หน้าถัดไป')}
      >
        <IconArrowRight size={16} />
      </button>
    </div>
  </nav>
);

/**
 * Search box + pages of 10 for a saved list on the profile page (25 Nov 2026, user request:
 * "หน้า profile ทำเป็น search bar กับ pagination"). Both appear only when the list is longer
 * than one page; `children` draws the rows of the current page.
 */
export function SearchPagedList<T>({
  items,
  searchText,
  searchPlaceholder,
  idPrefix,
  pageSize = LIST_PAGE_SIZE,
  children,
}: {
  items: T[];
  searchText: (item: T) => string;
  searchPlaceholder: string;
  idPrefix: string;
  pageSize?: number;
  children: (pageItems: T[]) => React.ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  // search and pages only when the list needs more than one page (user request 25 Nov 2026);
  // counted on the whole list so the search box stays while a search narrows it
  const searchable = items.length > pageSize;

  const found = useMemo(
    () => (query.trim() ? items.filter((x) => matchesQuery(searchText(x), query)) : items),
    [items, query, searchText]
  );
  const pageCount = Math.max(1, Math.ceil(found.length / pageSize));
  // after a delete the last page may be gone
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = found.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const goTo = (next: number) => {
    setPage(next);
    const el = listRef.current;
    // the next page starts at the top of the list, below the sticky top bar
    const bar = document.querySelector('.global-topbar')?.getBoundingClientRect().height ?? 0;
    if (el && el.getBoundingClientRect().top < bar) el.scrollIntoView({ block: 'start' });
  };
  // a list that shrinks below the search threshold drops its old search
  useEffect(() => {
    if (!searchable && query) setQuery('');
  }, [searchable, query]);

  return (
    <div className="list-search-paged" ref={listRef}>
      {searchable && (
        <div className="list-search-tools">
          <label className="saved-picker-search">
            <IconSearch size={16} />
            <span className="sr-only">{tx(searchPlaceholder)}</span>
            <input
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder={tx(searchPlaceholder)}
              aria-controls={`${idPrefix}-rows`}
            />
          </label>
          <span className="muted-inline list-search-count" aria-live="polite">
            {query.trim()
              ? found.length === 0
                ? txf('ไม่พบรายการที่ตรงกับ “{0}”', query.trim())
                : txf('พบ {0} รายการ', found.length)
              : txf('ทั้งหมด {0} รายการ', items.length)}
          </span>
        </div>
      )}

      {pageItems.length > 0 && <div id={`${idPrefix}-rows`}>{children(pageItems)}</div>}

      {pageCount > 1 && (
        <Pager
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          shown={pageItems.length}
          total={found.length}
          onPage={goTo}
        />
      )}
    </div>
  );
}
