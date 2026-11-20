import React, { useMemo } from 'react';
import { getLang, tx } from '../i18n';
import { WheelColumn, WheelSheet, WheelTrigger, useDraft, type WheelItem } from './WheelPicker';

/**
 * Nationality picker (iOS wheel). Stored value stays the English country name used across
 * the app (e.g. "Thailand") so existing profiles and registrations keep working. Labels are
 * localised with Intl.DisplayNames (TH/EN). Thailand is pinned first and is the default.
 */
const REGION_CODES = [
  'TH', 'KH', 'LA', 'MM', 'MY', 'SG', 'VN', 'ID', 'PH', 'BN', 'TL',
  'CN', 'HK', 'TW', 'JP', 'KR', 'IN', 'BD', 'NP', 'LK', 'PK',
  'AU', 'NZ', 'GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'CH', 'AT', 'IT', 'ES', 'PT',
  'SE', 'NO', 'DK', 'FI', 'PL', 'RU', 'US', 'CA', 'MX', 'BR', 'AR',
  'AE', 'SA', 'IL', 'TR', 'ZA', 'KE',
];

const englishNames = new Intl.DisplayNames(['en'], { type: 'region' });

interface NationalitySelectProps {
  id: string;
  value: string;
  onChange: (englishCountryName: string) => void;
}

export const NationalitySelect: React.FC<NationalitySelectProps> = ({ id, value, onChange }) => {
  const lang = getLang();

  // Older profiles may hold free text ("ไทย", custom values): map Thai to Thailand and keep
  // any other unknown value as an extra option so nothing is silently lost.
  const normalized = value.trim() === 'ไทย' ? 'Thailand' : value.trim() || 'Thailand';

  const items = useMemo<WheelItem[]>(() => {
    const local = new Intl.DisplayNames([lang === 'en' ? 'en' : 'th'], { type: 'region' });
    const list = REGION_CODES.map((code) => ({
      value: englishNames.of(code) ?? code,
      label: local.of(code) ?? code,
    }));
    const [thailand, ...rest] = list;
    rest.sort((a, b) => String(a.label).localeCompare(String(b.label), lang === 'en' ? 'en' : 'th'));
    const all: WheelItem[] = [thailand, ...rest];
    if (!all.some((o) => o.value === normalized)) {
      all.push({ value: normalized, label: tx(normalized) });
    }
    return all;
  }, [lang, normalized]);

  const currentIndex = Math.max(0, items.findIndex((o) => o.value === normalized));
  const sheet = useDraft<number>(currentIndex);

  return (
    <div className="wheel-field">
      <WheelTrigger
        id={id}
        label={items[currentIndex]?.label}
        placeholder={tx('เลือกสัญชาติ')}
        hasValue
        expanded={sheet.open}
        onOpen={() => sheet.openWith(currentIndex)}
      />
      <WheelSheet
        open={sheet.open}
        title={tx('สัญชาติ')}
        onCancel={() => sheet.setOpen(false)}
        onDone={() => {
          onChange(items[sheet.draft]?.value ?? 'Thailand');
          sheet.setOpen(false);
        }}
      >
        <WheelColumn
          items={items}
          selectedIndex={sheet.draft}
          onChange={sheet.setDraft}
          ariaLabel={tx('สัญชาติ')}
          autoFocus
        />
      </WheelSheet>
    </div>
  );
};
