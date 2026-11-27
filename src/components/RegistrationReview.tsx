import type { ReactNode } from 'react';
import { tx } from '../i18n';
import { formatThb } from '../utils/pricing';
import { IconAlert, IconCheckCircle, IconClock } from './Icons';
import { QrCode } from './QrCode';

/* Review step and success screen shared by registration forms A and B. */

export interface ReviewRow {
  label: string;
  value: ReactNode;
  /** a row inside a section that is changed on another step (e.g. the shirt under "entry") */
  editStep?: number;
}

export interface ReviewSection {
  key: string;
  title: string;
  /** step to go back to when the runner wants to change this part */
  editStep?: number;
  rows: ReviewRow[];
}

export interface ReviewLine {
  label: string;
  sub?: string;
  satang: number;
}

/** A block of the price ledger; a titled block (e.g. souvenirs) can have its own edit link. */
export interface ReviewLedgerGroup {
  key: string;
  title?: string;
  editStep?: number;
  lines: ReviewLine[];
}

/**
 * Review step: one card with every part of the form (each part with its own edit link)
 * beside the price ledger, which holds the total and the pay button and follows the page.
 * In a narrow column the ledger goes under the details and a bar with the total and the
 * pay button stays at the bottom edge (container query, so forms A and B both work).
 */
export function RegistrationSummary({
  sections,
  ledger,
  totalSatang,
  onEdit,
  action,
  consent,
}: {
  sections: ReviewSection[];
  ledger: ReviewLedgerGroup[];
  totalSatang: number;
  onEdit: (step: number) => void;
  /** the step's forward action (go to payment); without it the page keeps its own buttons */
  action?: { label: string; onClick: () => void };
  /** the agreements to tick, shown right above the pay button (27 Nov 2026, user pick "ก") */
  consent?: ReactNode;
}) {
  const editLink = (step: number, what: string, text = tx('แก้ไข')) => (
    <button
      type="button"
      className="reg-review-edit"
      onClick={() => onEdit(step)}
      aria-label={`${tx('แก้ไข')} ${what}`}
    >
      {text}
    </button>
  );

  return (
    <div className="reg-review">
      <div className="reg-review-layout">
        <div className="reg-review-card reg-review-details">
          {sections.map((sec) => (
            <section key={sec.key} className="reg-review-part" aria-labelledby={`rv-${sec.key}`}>
              <header className="reg-review-part-head">
                <h3 id={`rv-${sec.key}`}>{sec.title}</h3>
                {sec.editStep !== undefined && editLink(sec.editStep, sec.title)}
              </header>
              <dl className="reg-review-rows">
                {sec.rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.value === '' || row.value === null || row.value === undefined ? '—' : row.value}
                      {row.editStep !== undefined && (
                        <> {editLink(row.editStep, row.label, tx('เปลี่ยน'))}</>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <section className="reg-review-card reg-review-ledger" aria-labelledby="rv-ledger">
          <h3 id="rv-ledger">{tx('ยอดชำระ')}</h3>
          {ledger
            .filter((g) => g.lines.length > 0)
            .map((g) => (
              <div key={g.key} className={`reg-review-group ${g.title ? 'has-title' : ''}`}>
                {g.title && (
                  <div className="reg-review-group-head">
                    <span>{g.title}</span>
                    {g.editStep !== undefined && editLink(g.editStep, g.title)}
                  </div>
                )}
                <dl className="reg-review-lines">
                  {g.lines.map((l) => (
                    <div key={l.label}>
                      <dt>
                        {l.label}
                        {l.sub && <span className="muted-inline">{l.sub}</span>}
                      </dt>
                      <dd className="mono-num">{formatThb(l.satang, true)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          <div className="reg-review-total">
            <span>{tx('ยอดชำระสุทธิ')}</span>
            <strong className="mono-num">{formatThb(totalSatang, true)}</strong>
          </div>
          {consent && <div className="reg-review-consent">{consent}</div>}
          {action && (
            <button type="button" className="btn-primary reg-review-pay" onClick={action.onClick}>
              {tx(action.label)}
            </button>
          )}
        </section>
      </div>

      {action && (
      <div className="reg-review-bar" aria-hidden="true">
        <span className="reg-review-bar-total">
          <span>{tx('ยอดชำระสุทธิ')}</span>
          <strong className="mono-num">{formatThb(totalSatang, true)}</strong>
        </span>
        <button type="button" className="btn-primary reg-review-pay" tabIndex={-1} onClick={action.onClick}>
          {tx(action.label)}
        </button>
      </div>
      )}
    </div>
  );
}

export type DoneTone = 'success' | 'pending' | 'stopped';

/** Success screen: its own centred card, large check mark, key facts, then actions. */
export function RegistrationDone({
  title,
  subtitle,
  items,
  note,
  qr,
  details,
  tone = 'success',
  children,
}: {
  title: string;
  /** extra on-screen content under the facts (the saved entry details); hidden when printing */
  details?: ReactNode;
  /** the mark at the top: paid, waiting for payment, or cancelled / expired (27 Nov 2026) */
  tone?: DoneTone;
  /** a scannable QR (the check-in token) under the facts */
  qr?: { value: string; caption: string; used?: string };
  subtitle?: ReactNode;
  items: { label: string; value: ReactNode; mono?: boolean; accent?: boolean }[];
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`reg-done is-${tone}`} aria-labelledby="reg-done-title">
      {/* head and body are plain wrappers on the page (display: contents); the history popup
          lays them out as a header row and two columns so the card fits without scrolling */}
      <div className="reg-done-head">
        <div className="reg-done-mark" aria-hidden="true">
          {tone === 'pending' ? (
            <IconClock size={72} />
          ) : tone === 'stopped' ? (
            <IconAlert size={72} />
          ) : (
            <IconCheckCircle size={72} />
          )}
        </div>
        <div className="reg-done-heading">
          <h2 id="reg-done-title">{title}</h2>
          {subtitle && <p className="reg-done-sub">{subtitle}</p>}
        </div>
      </div>
      <div className="reg-done-body">
        <div className="reg-done-main">
          <dl className="reg-done-facts">
            {items.map((it) => (
              <div key={it.label}>
                <dt>{it.label}</dt>
                <dd className={`${it.mono ? 'mono-code' : ''} ${it.accent ? 'is-accent' : ''}`.trim()}>
                  {it.value}
                </dd>
              </div>
            ))}
          </dl>
          {details}
        </div>
        {qr && (
          <figure className={`reg-done-qr${qr.used ? ' is-used' : ''}`}>
            <QrCode value={qr.value} size={176} label={qr.caption} />
            <figcaption>
              <span>{qr.caption}</span>
              <span className="mono-code">{qr.value}</span>
              {qr.used && <strong className="reg-done-qr-used">{qr.used}</strong>}
            </figcaption>
          </figure>
        )}
      </div>
      {note && <p className="reg-done-note">{note}</p>}
      {children && <div className="reg-done-actions">{children}</div>}
    </section>
  );
}
