/**
 * พื้นที่ร้าน (จังหวัด → อำเภอ/เขต → ตำบล/แขวง + ย่าน) — DB หาให้จากหมุด (…20261020000500)
 * ชื่อใน DB ไม่มีคำนำหน้า (OCHA COD-AB) · คำว่า เขต/แขวง (กทม.) หรือ อำเภอ/ตำบล ใส่ตอนแสดง
 */
export const BANGKOK_PROVINCE_CODE = 'TH10';

export interface AreaParts {
  /** ชื่อย่าน (ไม่มีคำว่า "ย่าน") */
  district?: string | null;
  tambon?: string | null;
  amphoe?: string | null;
  province?: string | null;
  /** รหัสจังหวัด (pcode) — กทม. ใช้ เขต/แขวง */
  provinceCode?: string | null;
}

const isBangkok = (a: Pick<AreaParts, 'province' | 'provinceCode'>) =>
  a.provinceCode === BANGKOK_PROVINCE_CODE || a.province === 'กรุงเทพมหานคร';

export const districtLabel = (name: string) => `ย่าน${name}`;
export const amphoeLabel = (a: AreaParts) =>
  a.amphoe ? `${isBangkok(a) ? 'เขต' : 'อำเภอ'}${a.amphoe}` : '';
export const tambonLabel = (a: AreaParts) =>
  a.tambon ? `${isBangkok(a) ? 'แขวง' : 'ตำบล'}${a.tambon}` : '';
/** ชื่อจังหวัดแบบสั้น (กทม. = "กรุงเทพฯ") */
export const provinceLabel = (a: AreaParts) =>
  a.province ? (isBangkok(a) ? 'กรุงเทพฯ' : a.province) : '';

/** "ย่านทองหล่อ เขตวัฒนา กรุงเทพฯ" · ไม่มีย่าน = ใช้ตำบลแทน · ส่วนที่ไม่มีข้าม */
export function areaLine(a: AreaParts, opts: { tambon?: boolean } = {}): string {
  const head = a.district ? districtLabel(a.district) : opts.tambon !== false ? tambonLabel(a) : '';
  return [head, amphoeLabel(a), provinceLabel(a)].filter(Boolean).join(' ');
}

/** ชื่อพื้นที่ตรงกับคำค้น (ชื่อย่าน / ตำบล / อำเภอ / จังหวัด · ไม่สนคำนำหน้า "ย่าน" "เขต" "อำเภอ" "จังหวัด") */
export function areaMatches(a: AreaParts, query: string): boolean {
  const q = query.trim().replace(/^(ย่าน|เขต|อำเภอ|อ\.|แขวง|ตำบล|ต\.|จังหวัด|จ\.)\s*/, '');
  if (!q) return true;
  if (q === 'กรุงเทพ' || q === 'กรุงเทพฯ' || q === 'กทม' || q === 'กทม.') return isBangkok(a);
  return [a.district, a.tambon, a.amphoe, a.province].some((n) => !!n && n === q);
}
