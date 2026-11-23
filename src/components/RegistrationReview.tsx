import type { ReactNode } from 'react';
import { tx } from '../i18n';
import { formatThb } from '../utils/pricing';
import { IconCheckCircle } from './Icons';

/* Review step and success screen shared by registration forms A and B. */

export interface ReviewRow {
  label: string;
  value: ReactNode;
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

/** One card per form part, each with its own "edit" link, then the price ledger. */
export function RegistrationSummary({
  sections,
  lines,
  totalSatang,
  onEdit,
}: {
  sections: ReviewSection[];
  lines: ReviewLine[];
  totalSatang: number;
  onEdit: (step: number) => void;
}) {
  return (
    <div className="reg-review">
      <div className="reg-review-grid">
        {sections.map((sec) => (
          <section key={sec.key} className="reg-review-card" aria-labelledby={`rv-${sec.key}`}>
            <header className="reg-review-card-head">
              <h3 id={`rv-${sec.key}`}>{sec.title}</h3>
              {sec.editStep !== undefined && (
                <button
                  type="button"
                  className="reg-review-edit"
                  onClick={() => onEdit(sec.editStep as number)}
                  aria-label={`${tx('แก้ไข')} ${sec.title}`}
                >
                  {tx('แก้ไข')}
                </button>
              )}
            </header>
            <dl className="reg-review-rows">
              {sec.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value === '' || row.value === null || row.value === undefined ? '—' : row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section className="reg-review-card reg-review-ledger" aria-labelledby="rv-ledger">
        <header className="reg-review-card-head">
          <h3 id="rv-ledger">{tx('สรุปยอดชำระ')}</h3>
        </header>
        <dl className="reg-review-lines">
          {lines.map((l) => (
            <div key={l.label}>
              <dt>
                {l.label}
                {l.sub && <span className="muted-inline">{l.sub}</span>}
              </dt>
              <dd className="mono-num">{formatThb(l.satang, true)}</dd>
            </div>
          ))}
          <div className="reg-review-total">
            <dt>{tx('ยอดชำระสุทธิทั้งหมด')}</dt>
            <dd className="mono-num">{formatThb(totalSatang, true)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/** Success screen: its own centred card, large check mark, key facts, then actions. */
export function RegistrationDone({
  title,
  subtitle,
  items,
  note,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  items: { label: string; value: ReactNode; mono?: boolean; accent?: boolean }[];
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="reg-done" aria-labelledby="reg-done-title">
      <div className="reg-done-mark" aria-hidden="true">
        <IconCheckCircle size={72} />
      </div>
      <h2 id="reg-done-title">{title}</h2>
      {subtitle && <p className="reg-done-sub">{subtitle}</p>}
      <dl className="reg-done-facts">
        {items.map((it) => (
          <div key={it.label}>
            <dt>{it.label}</dt>
            <dd className={`${it.mono ? 'mono-code' : ''} ${it.accent ? 'is-accent' : ''}`.trim()}>{it.value}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="reg-done-note">{note}</p>}
      {children && <div className="reg-done-actions">{children}</div>}
    </section>
  );
}
