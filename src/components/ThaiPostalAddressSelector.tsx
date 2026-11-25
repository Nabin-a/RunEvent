import { RequiredFieldText } from './RequiredFieldText';
import React, { useMemo, useRef, useState } from 'react';
import {
  ALL_THAI_PROVINCES,
  findPostalCodeForLocation,
  getEntriesByPostalCode,
  getSubdistrictsForSelection,
  resolveCascadeFromPostal,
  THAI_POSTAL_ENTRIES,
  UNIQUE_POSTAL_CODES,
} from '../data/thaiPostalAddresses';
import { getLang, tx, txf } from '../i18n';
import { SelectMenu } from './SelectMenu';
import { displayPhone } from '../utils/phone';

export interface CascadingAddressValue {
  country: string;
  postalCode: string;
  province: string;
  district: string;
  subdistrict: string;
  address: string;
}

interface ThaiPostalAddressSelectorProps {
  idPrefix: string;
  value: CascadingAddressValue;
  onChange: (next: CascadingAddressValue) => void;
  showCountry?: boolean;
  showStreetAddress?: boolean;
  streetAddressLabel?: string;
  streetAddressPlaceholder?: string;
  required?: boolean;
  singleColumn?: boolean;
  /** Shown above the address in the read-only summary when given (recipient / owner). */
  contactName?: string | null;
  /** Shown under the address in the read-only summary when given. */
  contactPhone?: string | null;
  contactEmail?: string | null;
  /** Rendered under the summary box, e.g. a "save to address book" action. */
  summaryFooter?: React.ReactNode;
  /**
   * Compact two-column layout (registration form A): one area dropdown
   * ("subdistrict · district · province") picked after the postal code, a one-line summary,
   * and `compactLead` fields placed first in the same grid.
   */
  compact?: boolean;
  compactLead?: React.ReactNode;
  /** Subdistrict / district / province as typeable fields with suggestions (always on in compact mode). */
  typeableArea?: boolean;
  /**
   * Two-column "flow" layout (profile address dialog): `topLeft` | `topRight` on the first row,
   * then the left column carries `left` and the address fields while the summary rises right under
   * `topRight`. Fields are in reading order in the page, so Tab and phones follow
   * topLeft, topRight, left, address fields, summary. Area fields are always typeable here.
   */
  flow?: { topLeft: React.ReactNode; topRight: React.ReactNode; left?: React.ReactNode };
}

function districtsOfProvince(province: string): string[] {
  return Array.from(
    new Set(THAI_POSTAL_ENTRIES.filter((e) => e.province === province).map((e) => e.district)),
  ).sort((x, y) => x.localeCompare(y, 'th'));
}

/** postal codes used in a province, or in one district of it */
function zipsOfArea(province: string, district?: string): string[] {
  return Array.from(
    new Set(
      THAI_POSTAL_ENTRIES.filter((e) => e.province === province && (!district || e.district === district)).map(
        (e) => e.postalCode,
      ),
    ),
  );
}

function zipFitsArea(zip: string, province: string, district?: string): boolean {
  return Boolean(zip) && zipsOfArea(province, district).includes(zip);
}

interface TypeaheadOption<T> {
  key: string;
  value: string;
  hint?: string;
  data: T;
}

/**
 * Text field with its own suggestion list: focusing it shows every option in scope,
 * typing filters them, and picking one hands back the whole option (so a name that exists
 * in several places resolves to the place the runner picked). Free text is still allowed.
 */
function TypeaheadField<T>({
  id,
  label,
  required,
  value,
  placeholder,
  options,
  onType,
  onPick,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string;
  placeholder: string;
  options: TypeaheadOption<T>[];
  onType: (text: string) => void;
  onPick: (option: TypeaheadOption<T>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `${id}-options`;

  const q = value.trim();
  const shown = useMemo(() => {
    const list = filtering && q ? options.filter((o) => o.value.includes(q)) : options;
    return list.slice(0, 60);
  }, [options, filtering, q]);

  const pick = (o: TypeaheadOption<T>) => {
    onPick(o);
    setOpen(false);
    setFiltering(false);
    setActive(-1);
  };

  return (
    <div className="form-row postal-lookup-wrap">
      <label htmlFor={id}>
        {label} {required ? <RequiredFieldText text="*" /> : ''}
      </label>
      <div className="postal-typeahead">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && shown.length > 0}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          required={required}
          onFocus={() => {
            setOpen(true);
            setFiltering(false);
          }}
          onClick={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => {
            onType(e.target.value);
            setFiltering(true);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && open && active >= 0 && shown[active]) {
              e.preventDefault();
              pick(shown[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          className="postal-typeahead-toggle"
          tabIndex={-1}
          aria-label={tx('แสดงตัวเลือก')}
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) {
              setOpen(false);
            } else {
              setFiltering(false);
              setOpen(true);
              inputRef.current?.focus();
            }
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && shown.length > 0 && (
        <div id={listId} className="postal-suggestions-popover" role="listbox" aria-label={label}>
          {shown.map((o, i) => (
            <button
              key={o.key}
              id={`${listId}-${i}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={i === active}
              className={`postal-suggestion-item ${i === active || o.value === value ? 'active' : ''}`}
              onMouseDown={(ev) => {
                ev.preventDefault();
                pick(o);
              }}
            >
              <strong>{tx(o.value)}</strong>
              {o.hint && <span className="muted-inline">{o.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ชุดข้อมูลที่อยู่แบบ 2 คอลัมน์:
 * - Column 1: ช่องกรอกและ dropdown select แบบเดิมเรียงในคอลัมน์เดียวตามลำดับ
 *   ที่อยู่ -> รหัสไปรษณีย์ -> แขวง/ตำบล -> เขต/อำเภอ -> จังหวัด
 * - Column 2: สรุปที่อยู่อัตโนมัติแบบ disabled
 */
export const ThaiPostalAddressSelector: React.FC<
  ThaiPostalAddressSelectorProps
> = ({
  idPrefix,
  value,
  onChange,
  showStreetAddress = true,
  streetAddressLabel = 'ที่อยู่ (บ้านเลขที่ อาคาร ซอย ถนน)',
  streetAddressPlaceholder = 'เช่น 199/8 ถ.ห้วยแก้ว หมู่บ้านล้านนาวิว',
  required = false,
  contactName,
  contactPhone,
  contactEmail,
  summaryFooter,
  compact = false,
  compactLead,
  typeableArea = false,
  flow,
}) => {
  const [zipFocused, setZipFocused] = useState(false);
  const isEn = getLang() === 'en';

  const zipMatches = useMemo(
    () => getEntriesByPostalCode(value.postalCode),
    [value.postalCode]
  );

  const zipSuggestions = useMemo(() => {
    const q = value.postalCode.trim();
    if (!q) return UNIQUE_POSTAL_CODES.slice(0, 12);
    return UNIQUE_POSTAL_CODES.filter(
      (item) =>
        item.postalCode.startsWith(q) || item.summaryTh.includes(q)
    ).slice(0, 12);
  }, [value.postalCode]);

  // Lists go from broad to narrow (25 Nov 2026, user request): every province; the districts of
  // the chosen province, narrowed to the postal code when one of that province is filled in; the
  // subdistricts of the chosen district. A typed postal code fills the fields; picking a
  // subdistrict fills the postal code.
  const provinceOptions = useMemo(() => {
    if (value.province && !ALL_THAI_PROVINCES.includes(value.province)) {
      return [value.province, ...ALL_THAI_PROVINCES];
    }
    return ALL_THAI_PROVINCES;
  }, [value.province]);

  const districtOptions = useMemo(() => {
    // districts of the province; a postal code of that province narrows them further
    const inZip = Array.from(
      new Set(zipMatches.filter((e) => e.province === value.province).map((e) => e.district)),
    );
    const opts = value.province ? (inZip.length > 0 ? inZip : districtsOfProvince(value.province)) : [];
    if (value.district && !opts.includes(value.district)) {
      return [value.district, ...opts];
    }
    return opts;
  }, [value.province, value.district, zipMatches]);

  const subdistrictOptions = useMemo(() => {
    const opts =
      value.province && value.district
        ? getSubdistrictsForSelection('', value.province, value.district)
        : [];
    if (value.subdistrict && !opts.includes(value.subdistrict)) {
      return [value.subdistrict, ...opts];
    }
    return opts;
  }, [value.province, value.district, value.subdistrict]);

  const applyPostalCascade = (rawZip: string) => {
    const cascaded = resolveCascadeFromPostal(
      rawZip,
      value.province,
      value.district,
      value.subdistrict
    );
    onChange({
      ...value,
      country: value.country || 'Thailand',
      postalCode: cascaded.postalCode,
      province: cascaded.province,
      district: cascaded.district,
      subdistrict: cascaded.subdistrict,
    });
  };

  /** keep what still fits the new province / district, clear the rest for the runner to pick */
  const handleProvinceChange = (nextProv: string) => {
    if (nextProv === value.province) return;
    onChange({
      ...value,
      country: value.country || 'Thailand',
      province: nextProv,
      district: '',
      subdistrict: '',
      postalCode: zipFitsArea(value.postalCode, nextProv) ? value.postalCode : '',
    });
  };

  const handleDistrictChange = (nextDist: string) => {
    if (nextDist === value.district) return;
    const zips = zipsOfArea(value.province, nextDist);
    onChange({
      ...value,
      country: value.country || 'Thailand',
      district: nextDist,
      subdistrict: '',
      // one postal code for the whole district: fill it now; several: wait for the subdistrict
      postalCode: zips.length === 1 ? zips[0] : zips.includes(value.postalCode) ? value.postalCode : '',
    });
  };

  const addrTrim = value.address.trim();
  const zipTrim = value.postalCode.trim();
  const subdTrim = value.subdistrict.trim();
  const distTrim = value.district.trim();
  const provTrim = value.province.trim();

  const addressLine = useMemo(() => {
    let address: string;
    if (isEn) {
      const parts = [
        addrTrim ? tx(addrTrim) : '',
        subdTrim ? tx(subdTrim) : '',
        distTrim ? tx(distTrim) : '',
        provTrim ? tx(provTrim) : '',
        zipTrim,
      ].filter(Boolean);
      address = parts.length > 0 ? parts.join(', ') : tx('— ยังไม่ได้กรอกข้อมูลที่อยู่ —');
    } else {
      const isBkk = provTrim.includes('กรุงเทพ');
      const subdLabel = subdTrim ? (isBkk ? `แขวง${subdTrim}` : `ต.${subdTrim}`) : '';
      const distLabel = distTrim ? (isBkk ? `เขต${distTrim}` : `อ.${distTrim}`) : '';
      const provLabel = provTrim ? (isBkk ? provTrim : `จ.${provTrim}`) : '';
      const parts = [addrTrim, subdLabel, distLabel, provLabel, zipTrim].filter(Boolean);
      address = parts.length > 0 ? parts.join(' ') : tx('— ยังไม่ได้กรอกข้อมูลที่อยู่ —');
    }
    return address;
  }, [addrTrim, zipTrim, subdTrim, distTrim, provTrim, isEn]);

  // summary: recipient name, address, phone, email (each only when given)
  const formattedSummary = useMemo(() => {
    const name = (contactName ?? '').trim();
    const phone = displayPhone(contactPhone);
    const email = (contactEmail ?? '').trim();
    const lines: string[] = [];
    if (name) lines.push(name);
    lines.push(addressLine);
    if (phone) lines.push(txf('โทร {0}', phone));
    if (email) lines.push(txf('อีเมล {0}', email));
    return lines.join('\n');
  }, [addressLine, contactName, contactPhone, contactEmail]);

  // street + postal fields are shared by the stacked and the compact layouts
  const streetField = showStreetAddress && (
      <div className="form-row">
        <label htmlFor={`${idPrefix}-addr`}>
          {tx(streetAddressLabel)}{' '}
          {required ? <RequiredFieldText text="*" /> : ''}
        </label>
        <input
          id={`${idPrefix}-addr`}
          type="text"
          value={value.address}
          onChange={(e) =>
            onChange({
              ...value,
              country: value.country || 'Thailand',
              address: e.target.value,
            })
          }
          placeholder={tx(streetAddressPlaceholder)}
          required={required}
        />
      </div>
    );

  const zipField = (
      <div className="form-row postal-lookup-wrap">
        <label htmlFor={`${idPrefix}-zip`}>
          {tx('รหัสไปรษณีย์')}{' '}
          {required ? <RequiredFieldText text="*" /> : ''}
        </label>
        <input
          id={`${idPrefix}-zip`}
          type="text"
          inputMode="numeric"
          maxLength={5}
          className="mono-code"
          placeholder={tx('เช่น 50200, 10110, 83000')}
          value={value.postalCode}
          onFocus={() => setZipFocused(true)}
          onBlur={() => {
            setTimeout(() => setZipFocused(false), 150);
          }}
          onChange={(e) => applyPostalCascade(e.target.value)}
          required={required}
        />
        {zipFocused && zipSuggestions.length > 0 && (
          <div
            className="postal-suggestions-popover"
            role="listbox"
            aria-label={tx('ตัวเลือกรหัสไปรษณีย์')}
          >
            {zipSuggestions.map((s) => (
              <button
                key={s.postalCode}
                type="button"
                className={`postal-suggestion-item ${
                  s.postalCode === value.postalCode ? 'active' : ''
                }`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  applyPostalCascade(s.postalCode);
                  setZipFocused(false);
                }}
              >
                <strong className="mono-code">{s.postalCode}</strong>
                <span className="muted-inline">{tx(s.summaryTh)}</span>
              </button>
            ))}
          </div>
        )}
        {!compact && value.postalCode.length === 5 && (
          <span className="muted-inline" style={{ fontSize: '0.75rem' }}>
            {zipMatches.length > 0
              ? `${tx('พบพื้นที่ตรงรหัส')} ${value.postalCode} (${zipMatches.length} ${tx('อำเภอ/เขต')})`
              : tx('รหัสไปรษณีย์นอกรายการหลัก — เลือกหรือพิมพ์ที่อยู่ต่อได้')}
          </span>
        )}
      </div>
  );

  // Typeable subdistrict / district / province. Suggestions go from broad to narrow: the
  // districts of the chosen province, the subdistricts of the chosen district (25 Nov 2026, user
  // request). With no province yet, the postal code (or a typed subdistrict) scopes them; typing
  // a name that matches one place fills in the fields around it.
  const scopeEntries = useMemo(() => {
    const prov = value.province.trim();
    if (prov) {
      const inProv = THAI_POSTAL_ENTRIES.filter((e) => e.province === prov);
      if (inProv.length > 0) return inProv;
    }
    if (zipMatches.length > 0) return zipMatches;
    const sub = value.subdistrict.trim();
    if (sub) {
      const withSub = THAI_POSTAL_ENTRIES.filter((e) => e.subdistricts.includes(sub));
      if (withSub.length > 0) return withSub;
    }
    return THAI_POSTAL_ENTRIES;
  }, [zipMatches, value.province, value.subdistrict]);

  // subdistricts: only those of the chosen district once one is chosen
  const subdistrictScope = useMemo(() => {
    const dist = value.district.trim();
    if (dist) {
      const inDist = scopeEntries.filter((e) => e.district === dist);
      if (inDist.length > 0) return inDist;
    }
    return scopeEntries;
  }, [scopeEntries, value.district]);

  const subdistrictSuggestions = useMemo(() => {
    const q = value.subdistrict.trim();
    let entries = subdistrictScope;
    if (q && entries !== THAI_POSTAL_ENTRIES && !entries.some((e) => e.subdistricts.some((x) => x.includes(q)))) {
      entries = THAI_POSTAL_ENTRIES;
    }
    const scoped = entries !== THAI_POSTAL_ENTRIES;
    if (!scoped && !q) return [];
    const out: { sub: string; dist: string; prov: string; zip: string }[] = [];
    const seen = new Set<string>();
    for (const e of entries) {
      for (const sub of e.subdistricts) {
        if (!scoped && !sub.includes(q)) continue;
        const key = `${sub}|${e.district}|${e.province}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ sub, dist: e.district, prov: e.province, zip: e.postalCode });
        if (out.length >= 60) return out;
      }
    }
    return out;
  }, [subdistrictScope, value.subdistrict]);

  const districtSuggestions = useMemo(() => {
    const q = value.district.trim();
    // the postal code narrows the districts too, when it belongs to the chosen province
    const zipInScope = zipMatches.filter((e) => scopeEntries.includes(e));
    let entries = zipInScope.length > 0 ? zipInScope : scopeEntries;
    if (q && entries !== THAI_POSTAL_ENTRIES && !entries.some((e) => e.district.includes(q))) {
      entries = THAI_POSTAL_ENTRIES;
    }
    const scoped = entries !== THAI_POSTAL_ENTRIES;
    if (!scoped && !q) return [];
    const out: { dist: string; prov: string }[] = [];
    const seen = new Set<string>();
    for (const e of entries) {
      if (!scoped && !e.district.includes(q)) continue;
      const key = `${e.district}|${e.province}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ dist: e.district, prov: e.province });
      if (out.length >= 60) break;
    }
    return out;
  }, [scopeEntries, zipMatches, value.district]);

  const provinceSuggestions = ALL_THAI_PROVINCES;

  const withCountry = () => ({ ...value, country: value.country || 'Thailand' });

  const handleSubdistrictType = (text: string) => {
    const name = text.trim();
    let hits = name ? scopeEntries.filter((e) => e.subdistricts.includes(name)) : [];
    if (name && hits.length === 0) hits = THAI_POSTAL_ENTRIES.filter((e) => e.subdistricts.includes(name));
    const places = new Set(hits.map((e) => `${e.district}|${e.province}`));
    if (hits.length > 0 && places.size === 1) {
      onChange({
        ...withCountry(),
        subdistrict: text,
        district: hits[0].district,
        province: hits[0].province,
        postalCode: hits[0].postalCode,
      });
      return;
    }
    if (hits.length > 1 && !places.has(`${value.district}|${value.province}`)) {
      onChange({ ...withCountry(), subdistrict: text, district: '', province: '', postalCode: '' });
      return;
    }
    onChange({ ...withCountry(), subdistrict: text });
  };

  const handleDistrictType = (text: string) => {
    const name = text.trim();
    let hits = name ? scopeEntries.filter((e) => e.district === name) : [];
    if (name && hits.length === 0) hits = THAI_POSTAL_ENTRIES.filter((e) => e.district === name);
    const provs = new Set(hits.map((e) => e.province));
    if (hits.length > 0 && provs.size === 1) {
      const sub = value.subdistrict.trim();
      const withSub = sub ? hits.filter((e) => e.subdistricts.includes(sub)) : [];
      onChange({
        ...withCountry(),
        district: text,
        province: hits[0].province,
        postalCode: withSub.length === 1 ? withSub[0].postalCode : value.postalCode,
      });
      return;
    }
    onChange({ ...withCountry(), district: text });
  };

  const typeableSubField = (
    <TypeaheadField
      id={`${idPrefix}-subd`}
      label={tx('แขวง / ตำบล')}
      required={required}
      value={value.subdistrict}
      placeholder={tx('พิมพ์หรือเลือกแขวง / ตำบล')}
      options={subdistrictSuggestions.map((o) => ({
        key: `${o.sub}|${o.dist}|${o.prov}`,
        value: o.sub,
        hint: `${tx(o.dist)} · ${tx(o.prov)} ${o.zip}`,
        data: o,
      }))}
      onType={handleSubdistrictType}
      onPick={(o) =>
        onChange({
          ...withCountry(),
          subdistrict: o.data.sub,
          district: o.data.dist,
          province: o.data.prov,
          postalCode: o.data.zip,
        })
      }
    />
  );

  const typeableDistField = (
    <TypeaheadField
      id={`${idPrefix}-dist`}
      label={tx('เขต / อำเภอ')}
      required={required}
      value={value.district}
      placeholder={tx('พิมพ์หรือเลือกเขต / อำเภอ')}
      options={districtSuggestions.map((o) => ({
        key: `${o.dist}|${o.prov}`,
        value: o.dist,
        hint: tx(o.prov),
        data: o,
      }))}
      onType={handleDistrictType}
      onPick={(o) => {
        const sub = value.subdistrict.trim();
        const inDist = THAI_POSTAL_ENTRIES.filter(
          (e) => e.district === o.data.dist && e.province === o.data.prov,
        );
        const withSub = sub ? inDist.filter((e) => e.subdistricts.includes(sub)) : [];
        const zips = Array.from(new Set(inDist.map((e) => e.postalCode)));
        onChange({
          ...withCountry(),
          district: o.data.dist,
          province: o.data.prov,
          // a subdistrict from another district is cleared, so the list shows this district's
          subdistrict: withSub.length > 0 ? value.subdistrict : '',
          postalCode:
            withSub.length === 1
              ? withSub[0].postalCode
              : zips.length === 1
                ? zips[0]
                : zips.includes(value.postalCode)
                  ? value.postalCode
                  : '',
        });
      }}
    />
  );

  const typeableProvField = (
    <TypeaheadField
      id={`${idPrefix}-prov`}
      label={tx('จังหวัด')}
      required={required}
      value={value.province}
      placeholder={tx('พิมพ์หรือเลือกจังหวัด')}
      options={provinceSuggestions.map((pv) => ({ key: pv, value: pv, data: pv }))}
      onType={(text) => {
        // a typed name that is a whole province counts as picking it
        if (ALL_THAI_PROVINCES.includes(text.trim()) && text.trim() !== value.province) {
          handleProvinceChange(text.trim());
          return;
        }
        onChange({ ...withCountry(), province: text });
      }}
      onPick={(o) => handleProvinceChange(o.data)}
    />
  );

  if (flow) {
    return (
      <div className="postal-flow-grid">
        <div className="postal-flow-cell">{flow.topLeft}</div>
        <div className="postal-flow-cell postal-flow-right">{flow.topRight}</div>
        {flow.left && <div className="postal-flow-cell">{flow.left}</div>}
        {streetField && <div className="postal-flow-cell">{streetField}</div>}
        <div className="postal-flow-cell">{zipField}</div>
        {/* broad to narrow: province, district, subdistrict (25 Nov 2026, user request) */}
        <div className="postal-flow-cell">{typeableProvField}</div>
        <div className="postal-flow-cell">{typeableDistField}</div>
        <div className="postal-flow-cell">{typeableSubField}</div>
        <div className="postal-flow-summary">
          <div className="postal-summary-head">
            <label htmlFor={`${idPrefix}-summary`}>{tx('สรุปที่อยู่')}</label>
            <span className="muted-inline postal-summary-hint">{tx('แสดงผลอัตโนมัติ (แก้ไขไม่ได้)')}</span>
          </div>
          <textarea
            id={`${idPrefix}-summary`}
            className="postal-summary-textarea"
            rows={6}
            value={formattedSummary}
            disabled
            readOnly
          />
          {summaryFooter}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="postal-compact-grid">
        {compactLead}
        {zipField}
        {streetField && <div className="postal-compact-full">{streetField}</div>}

        {typeableProvField}
        {typeableDistField}
        {typeableSubField}

        <p className="postal-compact-summary" aria-live="polite">
          <span className="postal-compact-summary-label">{tx('สรุปที่อยู่')}</span>
          <span>{addressLine}</span>
        </p>
        {summaryFooter && <div className="postal-compact-full">{summaryFooter}</div>}
      </div>
    );
  }

  return (
    <div className="postal-two-col-grid">
      {/* COLUMN 1: All Fields Stacked in Column 1 (Original Dropdown Selects Preserved) */}
      <div className="postal-inputs-col">
        {streetField}

        {zipField}

        {typeableArea ? (
          <>
            {typeableProvField}
            {typeableDistField}
            {typeableSubField}
          </>
        ) : (
          <>
            {/* 3. จังหวัด (broad to narrow: province, district, subdistrict — 25 Nov 2026, user request) (Original <select> Dropdown) */}
            <div className="form-row">
              <label htmlFor={`${idPrefix}-prov`}>
                {tx('จังหวัด')}{' '}
                {required ? <RequiredFieldText text="*" /> : ''}
              </label>
              <SelectMenu
                id={`${idPrefix}-prov`}
                value={value.province}
                placeholder={tx('เลือกจังหวัด')}
                onChange={handleProvinceChange}
                required={required}
                options={provinceOptions.map((p) => ({ value: p, label: tx(p) }))}
              />
            </div>

            {/* 4. เขต / อำเภอ (Original <select> Dropdown) */}
            <div className="form-row">
              <label htmlFor={`${idPrefix}-dist`}>
                {tx('เขต / อำเภอ')}{' '}
                {required ? <RequiredFieldText text="*" /> : ''}
              </label>
              {districtOptions.length > 0 ? (
                <SelectMenu
                  id={`${idPrefix}-dist`}
                  value={value.district}
                  placeholder={tx('เลือกเขต / อำเภอ')}
                  onChange={handleDistrictChange}
                  required={required}
                  options={districtOptions.map((d) => ({ value: d, label: tx(d) }))}
                />
              ) : (
                <input
                  id={`${idPrefix}-dist`}
                  type="text"
                  value={value.district}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      country: value.country || 'Thailand',
                      district: e.target.value,
                    })
                  }
                  placeholder={tx('ระบุเขต / อำเภอ')}
                  required={required}
                />
              )}
            </div>

            {/* 5. แขวง / ตำบล (Original <select> Dropdown) */}
            <div className="form-row">
              <label htmlFor={`${idPrefix}-subd`}>
                {tx('แขวง / ตำบล')}{' '}
                {required ? <RequiredFieldText text="*" /> : ''}
              </label>
              {subdistrictOptions.length > 0 ? (
                <SelectMenu
                  id={`${idPrefix}-subd`}
                  value={value.subdistrict}
                  placeholder={tx('เลือกแขวง / ตำบล')}
                  options={subdistrictOptions.map((sd) => ({ value: sd, label: tx(sd) }))}
                  onChange={(nextSub) => {
                    const syncedZip = findPostalCodeForLocation(
                      value.province,
                      value.district,
                      nextSub
                    );
                    onChange({
                      ...value,
                      country: value.country || 'Thailand',
                      postalCode: syncedZip ?? value.postalCode,
                      subdistrict: nextSub,
                    });
                  }}
                  required={required}
                />
              ) : (
                <input
                  id={`${idPrefix}-subd`}
                  type="text"
                  value={value.subdistrict}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      country: value.country || 'Thailand',
                      subdistrict: e.target.value,
                    })
                  }
                  placeholder={tx('ระบุแขวง / ตำบล')}
                  required={required}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* COLUMN 2: Disabled Address Summary */}
      <div className="postal-summary-col">
        <div className="postal-summary-head">
          <label htmlFor={`${idPrefix}-summary`}>{tx('สรุปที่อยู่')}</label>
          <span className="muted-inline postal-summary-hint">
            {tx('แสดงผลอัตโนมัติ (แก้ไขไม่ได้)')}
          </span>
        </div>

        <textarea
          id={`${idPrefix}-summary`}
          className="postal-summary-textarea"
          rows={6}
          value={formattedSummary}
          disabled
          readOnly
        />
        {summaryFooter}
      </div>
    </div>
  );
};
