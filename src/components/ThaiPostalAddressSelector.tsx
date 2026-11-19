import { RequiredFieldText } from './RequiredFieldText';
import React, { useMemo, useState } from 'react';
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
 * - Column 1: ช่อง input text ทั้งหมดเรียงตามลำดับ ที่อยู่ -> รหัสไปรษณีย์ -> แขวง/ตำบล -> เขต/อำเภอ -> จังหวัด
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
    const fromZip = getProvincesForPostalCode(value.postalCode);
    const base = fromZip.length > 0 ? fromZip : ALL_THAI_PROVINCES;
    if (value.province && !base.includes(value.province)) {
      return [value.province, ...base];
    }
    return base;
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
    const cleanZip = rawZip.replace(/\D/g, '').slice(0, 5);
    const cascaded = resolveCascadeFromPostal(
      cleanZip,
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

  const handleSubdistrictInput = (nextSub: string) => {
    const syncedZip = findPostalCodeForLocation(
      value.province,
      value.district,
      nextSub.trim()
    );
    onChange({
      ...value,
      country: value.country || 'Thailand',
      postalCode: syncedZip ?? value.postalCode,
      subdistrict: nextSub,
    });
  };

  const handleDistrictInput = (nextDist: string) => {
    const trimmed = nextDist.trim();
    const exactInZip = getEntriesByPostalCode(value.postalCode).find(
      (e) => e.province === value.province && e.district === trimmed
    );
    if (exactInZip) {
      onChange({
        ...value,
        country: value.country || 'Thailand',
        district: nextDist,
        subdistrict: exactInZip.subdistricts.includes(value.subdistrict)
          ? value.subdistrict
          : exactInZip.subdistricts[0] ?? value.subdistrict,
      });
      return;
    }
    const fallbackEntry = THAI_POSTAL_ENTRIES.find(
      (e) => e.province === value.province && e.district === trimmed
    );
    if (fallbackEntry) {
      onChange({
        ...value,
        country: value.country || 'Thailand',
        postalCode: fallbackEntry.postalCode,
        district: nextDist,
        subdistrict: fallbackEntry.subdistricts[0] ?? value.subdistrict,
      });
      return;
    }
    onChange({
      ...value,
      country: value.country || 'Thailand',
      district: nextDist,
    });
  };

  const handleProvinceInput = (nextProv: string) => {
    const trimmed = nextProv.trim();
    const districtsInZip = getEntriesByPostalCode(value.postalCode).filter(
      (e) => e.province === trimmed
    );
    if (districtsInZip.length > 0) {
      const nextDist = districtsInZip[0].district;
      const nextSub = districtsInZip[0].subdistricts[0] ?? value.subdistrict;
      onChange({
        ...value,
        country: value.country || 'Thailand',
        province: nextProv,
        district: nextDist,
        subdistrict: nextSub,
      });
      return;
    }
    const firstProvEntry = THAI_POSTAL_ENTRIES.find(
      (e) => e.province === trimmed
    );
    if (firstProvEntry) {
      onChange({
        ...value,
        country: value.country || 'Thailand',
        postalCode: firstProvEntry.postalCode,
        province: nextProv,
        district: firstProvEntry.district,
        subdistrict: firstProvEntry.subdistricts[0] ?? value.subdistrict,
      });
      return;
    }
    onChange({
      ...value,
      country: value.country || 'Thailand',
      province: nextProv,
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
      {/* COLUMN 1: All Input Text Controls in Exact Order */}
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

        {/* 3. แขวง / ตำบล */}
        <div className="form-row">
          <label htmlFor={`${idPrefix}-subd`}>
            {tx('แขวง / ตำบล')}{' '}
            {required ? <RequiredFieldText text="*" /> : ''}
          </label>
          <input
            id={`${idPrefix}-subd`}
            type="text"
            list={`${idPrefix}-subd-list`}
            value={value.subdistrict}
            onChange={(e) => handleSubdistrictInput(e.target.value)}
            placeholder={tx('ระบุแขวง / ตำบล')}
            required={required}
          />
          <datalist id={`${idPrefix}-subd-list`}>
            {subdistrictOptions.map((s) => (
              <option key={s} value={s}>
                {tx(s)}
              </option>
            ))}
          </datalist>
        </div>

        {/* 4. เขต / อำเภอ */}
        <div className="form-row">
          <label htmlFor={`${idPrefix}-dist`}>
            {tx('เขต / อำเภอ')}{' '}
            {required ? <RequiredFieldText text="*" /> : ''}
          </label>
          <input
            id={`${idPrefix}-dist`}
            type="text"
            list={`${idPrefix}-dist-list`}
            value={value.district}
            onChange={(e) => handleDistrictInput(e.target.value)}
            placeholder={tx('ระบุเขต / อำเภอ')}
            required={required}
          />
          <datalist id={`${idPrefix}-dist-list`}>
            {districtOptions.map((d) => (
              <option key={d} value={d}>
                {tx(d)}
              </option>
            ))}
          </datalist>
        </div>

        {/* 5. จังหวัด */}
        <div className="form-row">
          <label htmlFor={`${idPrefix}-prov`}>
            {tx('จังหวัด')}{' '}
            {required ? <RequiredFieldText text="*" /> : ''}
          </label>
          <input
            id={`${idPrefix}-prov`}
            type="text"
            list={`${idPrefix}-prov-list`}
            value={value.province}
            onChange={(e) => handleProvinceInput(e.target.value)}
            placeholder={tx('ระบุจังหวัด')}
            required={required}
          />
          <datalist id={`${idPrefix}-prov-list`}>
            {provinceOptions.map((p) => (
              <option key={p} value={p}>
                {tx(p)}
              </option>
            ))}
          </datalist>
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

        <div className="postal-summary-breakdown" aria-disabled="true">
          <div className="postal-summary-breakdown-title">
            {tx('ตรวจสอบแยกรายช่อง')}
          </div>
          <div className="postal-summary-dl">
            <span className="muted-inline">{tx('ที่อยู่:')}</span>
            <span className="postal-summary-val">
              {addrTrim ? (isEn ? tx(addrTrim) : addrTrim) : '-'}
            </span>

            <span className="muted-inline">{tx('รหัสไปรษณีย์:')}</span>
            <span className="postal-summary-val mono-num">
              {zipTrim || '-'}
            </span>

            <span className="muted-inline">{tx('แขวง / ตำบล:')}</span>
            <span className="postal-summary-val">
              {subdTrim ? (isEn ? tx(subdTrim) : subdTrim) : '-'}
            </span>

            <span className="muted-inline">{tx('เขต / อำเภอ:')}</span>
            <span className="postal-summary-val">
              {distTrim ? (isEn ? tx(distTrim) : distTrim) : '-'}
            </span>

            <span className="muted-inline">{tx('จังหวัด:')}</span>
            <span className="postal-summary-val">
              {provTrim ? (isEn ? tx(provTrim) : provTrim) : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
