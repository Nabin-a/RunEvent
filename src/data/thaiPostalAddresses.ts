import rawDataset from './thaiPostalDataset.json';

export interface ThaiPostalDistrictEntry {
  postalCode: string;
  province: string;
  district: string;
  subdistricts: string[];
}

/**
 * ฐานข้อมูลที่อยู่และรหัสไปรษณีย์ไทยครบทั้งประเทศ:
 * - 77 จังหวัด (ครบทุกจังหวัดในประเทศไทย)
 * - 928 อำเภอ / เขต (878 อำเภอ + 50 เขตกรุงเทพมหานคร)
 * - 7,457 ตำบล / แขวง (เขตบางบอนแยกเป็น 4 แขวงตามประกาศกรุงเทพมหานคร: บางบอนเหนือ บางบอนใต้ คลองบางพราน คลองบางบอน — แก้ 25 พ.ย. 2026)
 * - 970 รหัสไปรษณีย์ 5 หลักมาตรฐานไปรษณีย์ไทย
 */
export const THAI_POSTAL_ENTRIES: ThaiPostalDistrictEntry[] =
  rawDataset as ThaiPostalDistrictEntry[];

const ENTRIES_BY_ZIP = new Map<string, ThaiPostalDistrictEntry[]>();
const ENTRIES_BY_PROV = new Map<string, ThaiPostalDistrictEntry[]>();

for (const entry of THAI_POSTAL_ENTRIES) {
  const byZip = ENTRIES_BY_ZIP.get(entry.postalCode);
  if (byZip) {
    byZip.push(entry);
  } else {
    ENTRIES_BY_ZIP.set(entry.postalCode, [entry]);
  }

  const byProv = ENTRIES_BY_PROV.get(entry.province);
  if (byProv) {
    byProv.push(entry);
  } else {
    ENTRIES_BY_PROV.set(entry.province, [entry]);
  }
}

export const ALL_THAI_PROVINCES: string[] = Array.from(
  ENTRIES_BY_PROV.keys()
).sort((a, b) => a.localeCompare(b, 'th'));

export const UNIQUE_POSTAL_CODES: {
  postalCode: string;
  summaryTh: string;
}[] = Array.from(ENTRIES_BY_ZIP.entries())
  .map(([postalCode, entries]) => {
    const provs = Array.from(new Set(entries.map((e) => e.province)));
    const dists = Array.from(new Set(entries.map((e) => e.district)));
    const distPreview =
      dists.length > 3
        ? `${dists.slice(0, 3).join(', ')} +${dists.length - 3}`
        : dists.join(', ');
    return {
      postalCode,
      summaryTh: `${provs.join('/')} · ${distPreview}`,
    };
  })
  .sort((a, b) => a.postalCode.localeCompare(b.postalCode));

export function getEntriesByPostalCode(
  postalCode: string
): ThaiPostalDistrictEntry[] {
  const clean = postalCode.trim();
  if (!clean) return [];
  return ENTRIES_BY_ZIP.get(clean) ?? [];
}

export function getProvincesForPostalCode(postalCode: string): string[] {
  const matched = getEntriesByPostalCode(postalCode);
  if (matched.length > 0) {
    return Array.from(new Set(matched.map((e) => e.province)));
  }
  return ALL_THAI_PROVINCES;
}

export function getDistrictsForPostalAndProvince(
  postalCode: string,
  province: string
): string[] {
  const matchedZip = getEntriesByPostalCode(postalCode).filter(
    (e) => e.province === province
  );
  if (matchedZip.length > 0) {
    return Array.from(new Set(matchedZip.map((e) => e.district)));
  }
  const byProv = ENTRIES_BY_PROV.get(province) ?? [];
  return Array.from(new Set(byProv.map((e) => e.district))).sort((a, b) =>
    a.localeCompare(b, 'th')
  );
}

export function getSubdistrictsForSelection(
  postalCode: string,
  province: string,
  district: string
): string[] {
  const cleanZip = postalCode.trim();
  if (cleanZip.length === 5) {
    const exact = getEntriesByPostalCode(cleanZip).find(
      (e) => e.province === province && e.district === district
    );
    if (exact) return exact.subdistricts;
  }
  // Union all subdistricts in (province, district) across its postal codes when zip is empty/unmatched
  const byProv = ENTRIES_BY_PROV.get(province) ?? [];
  const merged = new Set<string>();
  for (const e of byProv) {
    if (e.district === district) {
      for (const s of e.subdistricts) merged.add(s);
    }
  }
  return Array.from(merged).sort((a, b) => a.localeCompare(b, 'th'));
}

export function findPostalCodeForLocation(
  province: string,
  district: string,
  subdistrict?: string
): string | null {
  const byProv = ENTRIES_BY_PROV.get(province) ?? [];
  const inDistrict = byProv.filter((e) => e.district === district);
  if (inDistrict.length === 0) return null;
  if (subdistrict) {
    const exactSub = inDistrict.find((e) =>
      e.subdistricts.includes(subdistrict)
    );
    if (exactSub) return exactSub.postalCode;
  }
  return inDistrict[0].postalCode;
}

export function resolveCascadeFromPostal(
  nextPostalCode: string,
  prevProvince = '',
  prevDistrict = '',
  prevSubdistrict = ''
): {
  postalCode: string;
  province: string;
  district: string;
  subdistrict: string;
  matched: boolean;
} {
  const cleanZip = nextPostalCode.replace(/\D/g, '').slice(0, 5);
  const matches = getEntriesByPostalCode(cleanZip);
  if (matches.length === 0) {
    return {
      postalCode: cleanZip,
      province: prevProvince,
      district: prevDistrict,
      subdistrict: prevSubdistrict,
      matched: false,
    };
  }

  const provinces = Array.from(new Set(matches.map((m) => m.province)));
  const province = provinces.includes(prevProvince)
    ? prevProvince
    : provinces[0];

  const districts = Array.from(
    new Set(
      matches
        .filter((m) => m.province === province)
        .map((m) => m.district)
    )
  );
  const district = districts.includes(prevDistrict)
    ? prevDistrict
    : districts[0];

  const entry = matches.find(
    (m) => m.province === province && m.district === district
  );
  const subs = entry?.subdistricts ?? [];
  const subdistrict = subs.includes(prevSubdistrict)
    ? prevSubdistrict
    : (subs[0] ?? '');

  return {
    postalCode: cleanZip,
    province,
    district,
    subdistrict,
    matched: true,
  };
}
