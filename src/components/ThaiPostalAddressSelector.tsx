import { RequiredFieldText } from './RequiredFieldText';
import React, { useMemo, useRef, useState } from 'react';
import {
  ALL_THAI_PROVINCES,
  findPostalCodeForLocation,
  getDistrictsForPostalAndProvince,
  getEntriesByPostalCode,
  getProvincesForPostalCode,
  getSubdistrictsForSelection,
  resolveCascadeFromPostal,
  THAI_POSTAL_ENTRIES,
  UNIQUE_POSTAL_CODES,
} from '../data/thaiPostalAddresses';
import { getLang, tx, txf } from '../i18n';
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

  const provinceOptions = useMemo(() => {
    const opts = getProvincesForPostalCode(value.postalCode);
    if (value.province && !opts.includes(value.province)) {
      return [value.province, ...opts];
    }
    return opts;
  }, [value.postalCode, value.province]);

  const districtOptions = useMemo(() => {
    const opts = getDistrictsForPostalAndProvince(
      value.postalCode,
      value.province
    );
    if (value.district && !opts.includes(value.district)) {
      return [value.district, ...opts];
    }
    return opts;
  }, [value.postalCode, value.province, value.district]);

  const subdistrictOptions = useMemo(() => {
    const opts = getSubdistrictsForSelection(
      value.postalCode,
      value.province,
      value.district
    );
    if (value.subdistrict && !opts.includes(value.subdistrict)) {
      return [value.subdistrict, ...opts];
    }
    return opts;
  }, [value.postalCode, value.province, value.district, value.subdistrict]);

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

  const handleProvinceChange = (nextProv: string) => {
    const districtsInZip = getEntriesByPostalCode(value.postalCode).filter(
      (e) => e.province === nextProv
    );
    if (districtsInZip.length > 0) {
      const nextDist = districtsInZip[0].district;
      const nextSub = districtsInZip[0].subdistricts[0] ?? '';
      onChange({
        ...value,
        country: value.country || 'Thailand',
        province: nextProv,
        district: nextDist,
        subdistrict: nextSub,
      });
      return;
    }
    // Fallback when user changes province outside current zip: sync zip + district + subdistrict cleanly
    const firstProvEntry = THAI_POSTAL_ENTRIES.find(
      (e) => e.province === nextProv
    );
    onChange({
      ...value,
      country: value.country || 'Thailand',
      postalCode: firstProvEntry?.postalCode ?? value.postalCode,
      province: nextProv,
      district: firstProvEntry?.district ?? '',
      subdistrict: firstProvEntry?.subdistricts[0] ?? '',
    });
  };

  const handleDistrictChange = (nextDist: string) => {
    const exactInZip = getEntriesByPostalCode(value.postalCode).find(
      (e) => e.province === value.province && e.district === nextDist
    );
    if (exactInZip) {
      onChange({
        ...value,
        country: value.country || 'Thailand',
        district: nextDist,
        subdistrict: exactInZip.subdistricts[0] ?? '',
      });
      return;
    }
    const fallbackEntry = THAI_POSTAL_ENTRIES.find(
      (e) => e.province === value.province && e.district === nextDist
    );
    onChange({
      ...value,
      country: value.country || 'Thailand',
      postalCode: fallbackEntry?.postalCode ?? value.postalCode,
      district: nextDist,
      subdistrict: fallbackEntry?.subdistricts[0] ?? '',
    });
  };

  const addrTrim = value.address.trim();
  const zipTrim = value.postalCode.trim();
  const subdTrim = value.subdistrict.trim();
  const distTrim = value.district.trim();
  const provTrim = value.province.trim();

  const formattedSummary = useMemo(() => {
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
    const phone = displayPhone(contactPhone);
    const email = (contactEmail ?? '').trim();
    const lines = [address];
    if (phone) lines.push(txf('โทร {0}', phone));
    if (email) lines.push(txf('อีเมล {0}', email));
    return lines.join('\n');
  }, [addrTrim, zipTrim, subdTrim, distTrim, provTrim, isEn, contactPhone, contactEmail]);

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

  // Typeable subdistrict / district / province. Suggestions are scoped by what is already
  // known (postal code first, then province); typing a name that matches one place fills in
  // the fields after it.
  const scopeEntries = useMemo(() => {
    if (zipMatches.length > 0) return zipMatches;
    const prov = value.province.trim();
    if (prov) {
      const inProv = THAI_POSTAL_ENTRIES.filter((e) => e.province === prov);
      if (inProv.length > 0) return inProv;
    }
    const sub = value.subdistrict.trim();
    if (sub) {
      const withSub = THAI_POSTAL_ENTRIES.filter((e) => e.subdistricts.includes(sub));
      if (withSub.length > 0) return withSub;
    }
    return THAI_POSTAL_ENTRIES;
  }, [zipMatches, value.province, value.subdistrict]);

  const subdistrictSuggestions = useMemo(() => {
    const q = value.subdistrict.trim();
    let entries = scopeEntries;
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
  }, [scopeEntries, value.subdistrict]);

  const districtSuggestions = useMemo(() => {
    const q = value.district.trim();
    let entries = scopeEntries;
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
  }, [scopeEntries, value.district]);

  const provinceSuggestions = useMemo(() => {
    const fromZip = Array.from(new Set(zipMatches.map((e) => e.province)));
    return fromZip.length > 0 ? fromZip : ALL_THAI_PROVINCES;
  }, [zipMatches]);

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
        const withSub = THAI_POSTAL_ENTRIES.filter(
          (e) => e.district === o.data.dist && e.province === o.data.prov && (!sub || e.subdistricts.includes(sub))
        );
        onChange({
          ...withCountry(),
          district: o.data.dist,
          province: o.data.prov,
          postalCode: sub && withSub.length === 1 ? withSub[0].postalCode : value.postalCode,
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
      onType={(text) => onChange({ ...withCountry(), province: text })}
      onPick={(o) => onChange({ ...withCountry(), province: o.data })}
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
        <div className="postal-flow-cell">{typeableSubField}</div>
        <div className="postal-flow-cell">{typeableDistField}</div>
        <div className="postal-flow-cell">{typeableProvField}</div>
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

        {typeableSubField}
        {typeableDistField}
        {typeableProvField}

        <p className="postal-compact-summary" aria-live="polite">
          <span className="postal-compact-summary-label">{tx('สรุปที่อยู่')}</span>
          <span>{formattedSummary.split('\n')[0]}</span>
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
            {typeableSubField}
            {typeableDistField}
            {typeableProvField}
          </>
        ) : (
          <>
            {/* 3. แขวง / ตำบล (Original <select> Dropdown) */}
            <div className="form-row">
              <label htmlFor={`${idPrefix}-subd`}>
                {tx('แขวง / ตำบล')}{' '}
                {required ? <RequiredFieldText text="*" /> : ''}
              </label>
              {subdistrictOptions.length > 0 ? (
                <select
                  id={`${idPrefix}-subd`}
                  value={value.subdistrict}
                  onChange={(e) => {
                    const nextSub = e.target.value;
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
                >
                  {subdistrictOptions.map((s) => (
                    <option key={s} value={s}>
                      {tx(s)}
                    </option>
                  ))}
                </select>
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

            {/* 4. เขต / อำเภอ (Original <select> Dropdown) */}
            <div className="form-row">
              <label htmlFor={`${idPrefix}-dist`}>
                {tx('เขต / อำเภอ')}{' '}
                {required ? <RequiredFieldText text="*" /> : ''}
              </label>
              {districtOptions.length > 0 ? (
                <select
                  id={`${idPrefix}-dist`}
                  value={value.district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  required={required}
                >
                  {districtOptions.map((d) => (
                    <option key={d} value={d}>
                      {tx(d)}
                    </option>
                  ))}
                </select>
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

            {/* 5. จังหวัด (Original <select> Dropdown) */}
            <div className="form-row">
              <label htmlFor={`${idPrefix}-prov`}>
                {tx('จังหวัด')}{' '}
                {required ? <RequiredFieldText text="*" /> : ''}
              </label>
              <select
                id={`${idPrefix}-prov`}
                value={value.province}
                onChange={(e) => handleProvinceChange(e.target.value)}
                required={required}
              >
                {provinceOptions.map((p) => (
                  <option key={p} value={p}>
                    {tx(p)}
                  </option>
                ))}
              </select>
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
