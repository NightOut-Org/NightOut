import type { TambonOption } from '@nightout/contracts';
import { amphoeLabel, areaLine, provinceLabel, tambonLabel, type AreaParts } from '@nightout/utils';
import type { Bar } from '@/services/models';

/** พื้นที่ของร้าน (ย่าน + ตำบล/อำเภอ/จังหวัดจากหมุด) ในรูปที่ @nightout/utils ใช้ */
const parts = (b: Pick<Bar, 'district' | 'area'>): AreaParts => ({
  district: b.district || null,
  ...b.area,
});

/** แบบสั้นบนการ์ด: "ย่านทองหล่อ" · ไม่อยู่ในย่านไหน = "เขตวัฒนา" / "อำเภอเมืองเชียงใหม่" */
export function barPlace(b: Pick<Bar, 'district' | 'area'>): string {
  if (b.district) return `ย่าน${b.district}`;
  const p = parts(b);
  return amphoeLabel(p) || provinceLabel(p);
}

/** แบบเต็มบนหน้าร้าน: "ย่านทองหล่อ เขตวัฒนา กรุงเทพฯ" */
export const barPlaceFull = (b: Pick<Bar, 'district' | 'area'>) =>
  areaLine(parts(b), { tambon: false });

/** รหัส pcode ของตำบล/แขวง TH###### (ย่านเป็น uuid · อำเภอ TH#### · จังหวัด TH##) */
export const isTambonCode = (v: string) => /^TH[0-9]{6}$/.test(v);
const isAreaCode = (v: string) => /^TH([0-9]{2}|[0-9]{4}|[0-9]{6})$/.test(v);

/** ค่าจาก AreaMultiSelect (id ย่านปนรหัสพื้นที่) → body ของ PATCH /me/profile */
export function splitAreaPicks(values: string[] | undefined) {
  const v = values ?? [];
  return { district_ids: v.filter((x) => !isAreaCode(x)), area_codes: v.filter(isAreaCode) };
}

/** ที่ร้านเก็บไว้ (ย่าน + รหัสพื้นที่) → ค่าตั้งต้นของ AreaMultiSelect */
export const joinAreaPicks = (districtIds: string[], areaCodes: string[]) => [
  ...districtIds,
  ...areaCodes,
];

/** ตำบล/แขวงจาก GET /public/tambons → "แขวงคลองตันเหนือ" + บรรทัดรอง "เขตวัฒนา กรุงเทพฯ" */
export function tambonOptionText(t: TambonOption) {
  const p = {
    tambon: t.name_th,
    amphoe: t.amphoe_th,
    province: t.province_th,
    provinceCode: t.province_code,
  };
  return { label: tambonLabel(p), hint: [amphoeLabel(p), provinceLabel(p)].join(' ') };
}
