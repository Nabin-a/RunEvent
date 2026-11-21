import React from 'react';
import type { AgeGroupDef, AgeGroupGender, RaceEvent } from '../types';
import {
  ageBasisDate,
  categoryUsesAge,
  formatAgeBasis,
  formatAgeLimit,
  formatAgeRange,
  formatBasisDate,
  resolveAgeBasis,
} from '../utils/age';
import { tx } from '../i18n';

const GENDER_ORDER: AgeGroupGender[] = ['ชาย', 'หญิง', 'all'];

function genderHeading(g: AgeGroupGender): string {
  return g === 'all' ? tx('ทุกเพศ') : tx(g);
}

/**
 * Public "age rules & age groups" section on the event page.
 * Shows, per distance, how age is counted, the allowed ages and the divisions by gender,
 * so runners know their group before they register. Renders nothing when no
 * distance has age rules.
 */
export const EventAgeGroupsSection: React.FC<{ event: RaceEvent; id: string }> = ({ event, id }) => {
  const categories = event.categories.filter(categoryUsesAge);
  if (categories.length === 0) return null;

  return (
    <section id={id} className="clean-panel age-public-section">
      <h2>{tx('เกณฑ์อายุและรุ่นอายุ')}</h2>
      <p className="muted-block">
        {tx('ระบบคำนวณอายุจากวันเกิดของผู้เข้าแข่งขันและจัดรุ่นให้อัตโนมัติตอนสมัคร เกณฑ์ตัดสินรางวัลตามรุ่นให้ดูกติกาของผู้จัดงาน')}
      </p>

      <div className="age-public-list">
        {event.categories.map((cat) => {
          const basis = resolveAgeBasis(cat);
          const limit = formatAgeLimit(cat);
          const groups = cat.ageGroups ?? [];
          const byGender = GENDER_ORDER.map((g) => ({
            gender: g,
            items: groups
              .filter((x) => x.gender === g)
              .sort((a: AgeGroupDef, b: AgeGroupDef) => a.minAge - b.minAge),
          })).filter((x) => x.items.length > 0);

          return (
            <article key={cat.id} className="age-public-card" aria-labelledby={`agepub-${cat.id}`}>
              <header className="age-public-head">
                <span className={`category-bib-chip tone-${cat.colorTag}`}>
                  <strong>{tx(cat.code)}</strong>
                </span>
                <h3 id={`agepub-${cat.id}`}>{tx(cat.name)}</h3>
              </header>
              <p className="age-public-meta">
                <strong>{limit ?? tx('ไม่จำกัดอายุ')}</strong>
                <span className="muted-inline">
                  {' · '}
                  {formatAgeBasis(basis)} ({formatBasisDate(ageBasisDate(event.eventDate, basis))})
                </span>
              </p>
              {byGender.length === 0 ? (
                <p className="muted-inline">{tx('ระยะนี้ไม่แบ่งรุ่นอายุ')}</p>
              ) : (
                <div className="age-public-genders">
                  {byGender.map(({ gender, items }) => (
                    <div key={gender} className="age-public-gender">
                      <h4>{genderHeading(gender)}</h4>
                      <ul>
                        {items.map((g) => (
                          <li key={g.id} className="mono-num">
                            {formatAgeRange(g.minAge, g.maxAge)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
