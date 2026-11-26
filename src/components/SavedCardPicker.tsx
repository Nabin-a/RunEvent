import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { tx, txf } from '../i18n';
import { IconSearch } from './Icons';
import { Pager, matchesQuery } from './ListPager';
import { useEscapeToClose } from './modalShared';

/** how many cards the form shows before the rest go behind search / "ดูทั้งหมด" */
export const SAVED_CARD_LIMIT = 5;
/** rows per page in the "ดูทั้งหมด" dialog */
export const SAVED_ALL_PAGE_SIZE = 10;

const matches = matchesQuery;

interface SavedCardPickerProps<T> {
  items: T[];
  selectedId: string | undefined;
  getId: (item: T) => string;
  /** every text the search box should find (names, nickname, phone, address…) */
  searchText: (item: T) => string;
  /** title of a row in the "ดูทั้งหมด" list, also used for the A–Z sort */
  title: (item: T) => string;
  /** one short line under the title in the "ดูทั้งหมด" list */
  meta: (item: T) => string;
  /** a tag beside the title (primary contact / default address) */
  badge?: (item: T) => React.ReactNode;
  /** form order: most useful first (recently used / default / primary); stable otherwise */
  compare?: (a: T, b: T) => number;
  /** name of that order in the "ดูทั้งหมด" sort menu */
  orderLabel: string;
  /** the card itself (a <label> with the radio input) */
  renderCard: (item: T) => React.ReactNode;
  onPick: (id: string) => void;
  groupLabel: string;
  searchPlaceholder: string;
  allTitle: string;
  idPrefix: string;
}

/**
 * Saved-item cards for the registration form (participants, emergency contacts, addresses).
 * Shows at most 5 cards in `compare` order (a pick does not move a card). More than 5 adds a search box
 * and a "ดูทั้งหมด (n)" list in a dialog, so a long book never makes the page long
 * (25 Nov 2026, user request: "ถ้าเคยสมัครให้เพื่อนเป็นหลัก 100 คน").
 */
export function SavedCardPicker<T>({
  items,
  selectedId,
  getId,
  searchText,
  title,
  meta,
  badge,
  compare,
  orderLabel,
  renderCard,
  onPick,
  groupLabel,
  searchPlaceholder,
  allTitle,
  idPrefix,
}: SavedCardPickerProps<T>) {
  const [query, setQuery] = useState('');
  const [allOpen, setAllOpen] = useState(false);
  const many = items.length > SAVED_CARD_LIMIT;

  const ordered = useMemo(() => (compare ? [...items].sort(compare) : items), [items, compare]);
  const found = useMemo(
    () => (query.trim() ? ordered.filter((x) => matches(searchText(x), query)) : ordered),
    [ordered, query, searchText]
  );

  let shown = found.slice(0, SAVED_CARD_LIMIT);
  // the cards keep their order when one is picked (26 Nov 2026, user request); without a
  // search, a pick from "ดูทั้งหมด" that is not among the cards takes the last card's place
  if (!query.trim() && selectedId && !shown.some((x) => getId(x) === selectedId)) {
    const picked = items.find((x) => getId(x) === selectedId);
    if (picked) shown = [...shown.slice(0, SAVED_CARD_LIMIT - 1), picked];
  }

  return (
    <div className="saved-picker">
      {many && (
        <div className="saved-picker-tools">
          <label className="saved-picker-search">
            <IconSearch size={16} />
            <span className="sr-only">{tx(searchPlaceholder)}</span>
            <input
              type="search"
              autoComplete="off"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx(searchPlaceholder)}
              aria-controls={`${idPrefix}-cards`}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={() => setAllOpen(true)}>
            {txf('ดูทั้งหมด ({0})', items.length)}
          </button>
        </div>
      )}

      {many && (
        <p className="saved-picker-count muted-inline" aria-live="polite">
          {query.trim()
            ? found.length === 0
              ? txf('ไม่พบรายการที่ตรงกับ “{0}”', query.trim())
              : found.length > SAVED_CARD_LIMIT
                ? txf('พบ {0} รายการ แสดง {1} รายการแรก', found.length, SAVED_CARD_LIMIT)
                : txf('พบ {0} รายการ', found.length)
            : txf('แสดง {0} จาก {1} รายการ', shown.length, items.length)}
        </p>
      )}

      {shown.length > 0 && (
        <div
          id={`${idPrefix}-cards`}
          className="reg-lab-choices reg-lab-book"
          role="radiogroup"
          aria-label={tx(groupLabel)}
        >
          {shown.map((x) => (
            <React.Fragment key={getId(x)}>{renderCard(x)}</React.Fragment>
          ))}
        </div>
      )}

      {allOpen && (
        <SavedAllDialog
          items={ordered}
          selectedId={selectedId}
          getId={getId}
          searchText={searchText}
          title={title}
          meta={meta}
          badge={badge}
          orderLabel={orderLabel}
          heading={allTitle}
          searchPlaceholder={searchPlaceholder}
          idPrefix={idPrefix}
          onClose={() => setAllOpen(false)}
          onPick={(id) => {
            onPick(id);
            setQuery('');
            setAllOpen(false);
          }}
        />
      )}
    </div>
  );
}

interface SavedAllDialogProps<T> {
  items: T[];
  selectedId: string | undefined;
  getId: (item: T) => string;
  searchText: (item: T) => string;
  title: (item: T) => string;
  meta: (item: T) => string;
  /** a tag beside the title (primary contact / default address) */
  badge?: (item: T) => React.ReactNode;
  orderLabel: string;
  heading: string;
  searchPlaceholder: string;
  idPrefix: string;
  onClose: () => void;
  onPick: (id: string) => void;
}

/** the whole list: search + sort, one line per item, scrolls inside the dialog */
function SavedAllDialog<T>({
  items,
  selectedId,
  getId,
  searchText,
  title,
  meta,
  badge,
  orderLabel,
  heading,
  searchPlaceholder,
  idPrefix,
  onClose,
  onPick,
}: SavedAllDialogProps<T>) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'order' | 'name'>('order');
  useEscapeToClose(onClose);

  const list = useMemo(() => {
    const hit = items.filter((x) => matches(searchText(x), query));
    return sort === 'name' ? [...hit].sort((a, b) => title(a).localeCompare(title(b), 'th')) : hit;
  }, [items, query, sort, searchText, title]);

  // pages of 10; opens on the page that holds the picked item, back to page 1 on a new search/sort
  const pageCount = Math.max(1, Math.ceil(list.length / SAVED_ALL_PAGE_SIZE));
  const [page, setPage] = useState(() => {
    const at = items.findIndex((x) => getId(x) === selectedId);
    return at < 0 ? 0 : Math.floor(at / SAVED_ALL_PAGE_SIZE);
  });
  const [listKey, setListKey] = useState(`${query}|${sort}`);
  if (listKey !== `${query}|${sort}`) {
    setListKey(`${query}|${sort}`);
    setPage(0);
  }
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = list.slice(safePage * SAVED_ALL_PAGE_SIZE, (safePage + 1) * SAVED_ALL_PAGE_SIZE);
  // keep the list at its top when the page changes
  const [bodyEl, setBodyEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    bodyEl?.scrollTo({ top: 0 });
  }, [safePage, bodyEl]);

  return createPortal(
    <div
      className="runner-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="runner-modal-dialog saved-all-dialog" role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-all-title`}>
        <div className="runner-modal-header">
          <div>
            <h3 id={`${idPrefix}-all-title`}>{tx(heading)}</h3>
            <p className="muted-inline">{txf('ทั้งหมด {0} รายการ', items.length)}</p>
          </div>
          <button type="button" className="runner-modal-close-btn" aria-label={tx('ปิด')} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="saved-all-tools">
          <label className="saved-picker-search">
            <IconSearch size={16} />
            <span className="sr-only">{tx(searchPlaceholder)}</span>
            <input
              type="search"
              autoComplete="off"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx(searchPlaceholder)}
              aria-controls={`${idPrefix}-all-list`}
            />
          </label>
          <div className="saved-all-sort" role="group" aria-label={tx('เรียงตาม')}>
            {(
              [
                ['order', orderLabel],
                ['name', 'ชื่อ ก–ฮ'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`filter-pill ${sort === key ? 'active' : ''}`}
                aria-pressed={sort === key}
                onClick={() => setSort(key)}
              >
                {tx(label)}
              </button>
            ))}
          </div>
        </div>
        <div className="runner-modal-body" ref={setBodyEl}>
          {list.length === 0 ? (
            <p className="muted-inline" role="status">
              {txf('ไม่พบรายการที่ตรงกับ “{0}”', query.trim())}
            </p>
          ) : (
            <ul id={`${idPrefix}-all-list`} className="saved-all-list">
              {pageItems.map((x) => {
                const id = getId(x);
                const picked = id === selectedId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      className={`saved-all-row ${picked ? 'is-picked' : ''}`}
                      aria-pressed={picked}
                      onClick={() => onPick(id)}
                    >
                      <span className="custom-radio-circle" aria-hidden="true" />
                      <span className="saved-all-row-copy">
                        <span className="reg-card-head">
                          <strong>{title(x)}</strong>
                          {badge?.(x)}
                        </span>
                        <span className="muted-inline">{meta(x)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {pageCount > 1 && (
          <Pager
            className="saved-all-pager"
            page={safePage}
            pageCount={pageCount}
            pageSize={SAVED_ALL_PAGE_SIZE}
            shown={pageItems.length}
            total={list.length}
            onPage={setPage}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
