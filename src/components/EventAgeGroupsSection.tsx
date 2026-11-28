import React from 'react';
import type { AgeGroupDef, AgeGroupGender, RaceCategory, RaceEvent } from '../types';
import {
  ageBasisDate,
  formatAgeBasis,
  formatAgeRange,
  formatBasisDate,
  resolveAgeBasis,
} from '../utils/age';
import { tx } from '../i18n';

const GENDER_ORDER: AgeGroupGender[] = ['ชาย', 'หญิง', 'all'];

function genderHeading(g: AgeGroupGender): string {
  return g === 'all' ? tx('ทุกเพศ') : tx(g);
}

/** True when the distance splits runners into age groups worth a "see age groups" toggle. */
export function categoryHasAgeGroups(cat: RaceCategory): boolean {
  return (cat.ageGroups ?? []).length > 0;
}

/**
 * Age groups of one distance on the public event page, inside its distance card:
 * how age is counted, then the divisions by gender.
 */
export const CategoryAgeGroups: React.FC<{ event: RaceEvent; cat: RaceCategory }> = ({ event, cat }) => {
  const basis = resolveAgeBasis(cat);
  const groups = cat.ageGroups ?? [];
  const byGender = GENDER_ORDER.map((g) => ({
    gender: g,
    items: groups
      .filter((x) => x.gender === g)
      .sort((a: AgeGroupDef, b: AgeGroupDef) => a.minAge - b.minAge),
  })).filter((x) => x.items.length > 0);

  return (
    <div className="cat-age-body">
      <p className="age-public-meta muted-inline">
        {formatAgeBasis(basis)} ({formatBasisDate(ageBasisDate(event.eventDate, basis))}) ·{' '}
        {tx('ระบบจัดรุ่นให้อัตโนมัติจากวันเกิดตอนสมัคร')}
      </p>
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
    </div>
  );
};
