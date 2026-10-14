/** ป้ายบนโฆษณาแบนเนอร์ (Native Mini-Ads) — ต้องเห็นชัดทุกครั้งที่แสดง (หน้าเว็บ + ตัวอย่างใน Backoffice) */
export const MINI_AD_LABEL = 'โฆษณา';

/** ข้อความที่แอดมินติ๊กยืนยันทุกครั้งที่สร้าง/แก้เนื้อหาโฆษณา (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.32) */
export const MINI_AD_NO_ALCOHOL_TEXT =
  'ยืนยันว่าโฆษณานี้ไม่ใช่แบรนด์หรือสินค้าเครื่องดื่มแอลกอฮอล์ ไม่มีชื่อ โลโก้ สี หรือสัญลักษณ์ของแบรนด์เหล้า/เบียร์ ' +
  '(รวมถึงโซดา น้ำดื่ม หรือสินค้าอื่นที่ใช้แบรนด์ร่วมกับเหล้า/เบียร์) และไม่มีถ้อยคำชวนดื่ม — พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.32';

/** สถานะที่ Backoffice แสดง — ต้องตรงกับเงื่อนไข "กำลังแสดง" ใน DB (mini_ad_is_live: active and starts_at <= now() < ends_at) */
export type MiniAdState = 'LIVE' | 'SCHEDULED' | 'ENDED' | 'OFF';
export interface MiniAdSchedule {
  active: boolean;
  starts_at: string;
  ends_at: string;
}

/** ENDED (เลยวันสิ้นสุด) มาก่อน OFF (ปิดอยู่) → SCHEDULED (ยังไม่ถึงวันเริ่ม) → LIVE */
export function miniAdState(ad: MiniAdSchedule, now: Date = new Date()): MiniAdState {
  const t = now.getTime();
  if (t >= Date.parse(ad.ends_at)) return 'ENDED';
  if (!ad.active) return 'OFF';
  if (t < Date.parse(ad.starts_at)) return 'SCHEDULED';
  return 'LIVE';
}

/** อัตราคลิก (%) ทศนิยม 1 ตำแหน่ง · ยังไม่มีคนเห็น = null */
export function miniAdCtr(impressions: number, clicks: number): number | null {
  if (!impressions) return null;
  return Math.round((clicks / impressions) * 1000) / 10;
}
