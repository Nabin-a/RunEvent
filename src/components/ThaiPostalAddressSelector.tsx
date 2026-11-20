import { RequiredFieldText } from './RequiredFieldText';
import React, { useMemo, useState } from 'react';
import {
  findPostalCodeForLocation,
  getDistrictsForPostalAndProvince,
  getEntriesByPostalCode,
  getProvincesForPostalCode,
  getSubdistrictsForSelection,
  resolveCascadeFromPostal,
  THAI_POSTAL_ENTRIES,
  UNIQUE_POSTAL_CODES,
} from '../data/thaiPostalAddresses';
import { getLang, tx } from '../i18n';

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
    if (isEn) {
      const parts = [
        addrTrim ? tx(addrTrim) : '',
        subdTrim ? tx(subdTrim) : '',
        distTrim ? tx(distTrim) : '',
        provTrim ? tx(provTrim) : '',
        zipTrim,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : tx('— ยังไม่ได้กรอกข้อมูลที่อยู่ —');
    }
    const isBkk = provTrim.includes('กรุงเทพ');
    const subdLabel = subdTrim ? (isBkk ? `แขวง${subdTrim}` : `ต.${subdTrim}`) : '';
    const distLabel = distTrim ? (isBkk ? `เขต${distTrim}` : `อ.${distTrim}`) : '';
    const provLabel = provTrim ? (isBkk ? provTrim : `จ.${provTrim}`) : '';
    const parts = [addrTrim, subdLabel, distLabel, provLabel, zipTrim].filter(
      Boolean
    );
    return parts.length > 0 ? parts.join(' ') : tx('— ยังไม่ได้กรอกข้อมูลที่อยู่ —');
  }, [addrTrim, zipTrim, subdTrim, distTrim, provTrim, isEn]);

  return (
    <div className="postal-two-col-grid">
      {/* COLUMN 1: All Fields Stacked in Column 1 (Original Dropdown Selects Preserved) */}
      <div className="postal-inputs-col">
        {/* 1. ที่อยู่ */}
        {showStreetAddress && (
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
        )}

        {/* 2. รหัสไปรษณีย์ */}
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
          {value.postalCode.length === 5 && (
            <span className="muted-inline" style={{ fontSize: '0.75rem' }}>
              {zipMatches.length > 0
                ? `${tx('พบพื้นที่ตรงรหัส')} ${value.postalCode} (${zipMatches.length} ${tx('อำเภอ/เขต')})`
                : tx('รหัสไปรษณีย์นอกรายการหลัก — เลือกหรือพิมพ์ที่อยู่ต่อได้')}
            </span>
          )}
        </div>

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
          rows={4}
          value={formattedSummary}
          disabled
          readOnly
        />
      </div>
    </div>
  );
};
