import type { TambonOption } from '@nightout/contracts';
import { amphoeLabel, areaLine, provinceLabel, tambonLabel, type AreaParts } from '@nightout/utils';
import { MASTER } from '@/services/data';
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

/** ตัวเลือกย่านทั้งประเทศ (ย่านที่ชอบ) — ชื่อซ้ำกันข้ามจังหวัดได้ จึงต่อท้ายด้วยจังหวัด · ใช้กับ Select ที่ค้นได้ */
export const districtSelectOptions = () =>
  MASTER.districts.map((d) => ({
    value: d.id,
    label: d.province ? `${d.name} (${provinceLabel({ province: d.province })})` : d.name,
  }));

/** ตำบล/แขวงจาก GET /public/tambons → "แขวงคลองตันเหนือ" + บรรทัดรอง "เขตวัฒนา กรุงเทพฯ" */
export function tambonOptionText(t: TambonOption) {
  const p = { tambon: t.name_th, amphoe: t.amphoe_th, province: t.province_th, provinceCode: t.province_code };
  return { label: tambonLabel(p), hint: [amphoeLabel(p), provinceLabel(p)].join(' ') };
}
