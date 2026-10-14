import type * as C from '@nightout/contracts';
import { baht } from '@/ui/utils/format';

/**
 * เหตุผลที่ร้านยกเลิกการจอง / คืน Table Fee (หน้า /merchant/bookings/:id)
 * NO_TABLE = "ร้านไม่มีโต๊ะให้ลูกค้า" → POST no-table (คืน Table Fee เต็ม + บันทึกประวัติร้าน · แอดมินตัดสิน Blacklist)
 */
export type MerchantCancelReason = 'NO_TABLE' | 'SHOP_CLOSED' | 'CUSTOMER_ASKED' | 'OTHER';

export const MERCHANT_CANCEL_REASONS: { key: MerchantCancelReason; label: string }[] = [
  { key: 'NO_TABLE', label: 'ร้านไม่มีโต๊ะให้ลูกค้า' },
  { key: 'SHOP_CLOSED', label: 'ร้านปิดกะทันหัน' },
  { key: 'CUSTOMER_ASKED', label: 'ลูกค้าขอยกเลิก' },
  { key: 'OTHER', label: 'อื่น ๆ (ระบุ)' },
];

/** รายละเอียดของ "ร้านไม่มีโต๊ะ" ส่งแยกเป็น note (ReportNoTableBody ≤ 300) */
const NO_TABLE_NOTE_MAX = 300;
const SEP = ' — ';
const labelOf = (key: MerchantCancelReason) =>
  MERCHANT_CANCEL_REASONS.find((r) => r.key === key)!.label;

/** ข้อความเหตุผลที่ส่ง API: ชื่อเหตุผล + " — รายละเอียด" (ถ้ามี) · OTHER = รายละเอียดอย่างเดียว */
export function reasonText(key: MerchantCancelReason, detail: string): string {
  const d = detail.trim();
  if (key === 'OTHER') return d;
  return d ? `${labelOf(key)}${SEP}${d}` : labelOf(key);
}

/** ต้องเลือกเหตุผล · OTHER ต้องพิมพ์รายละเอียดอย่างน้อย 3 ตัวอักษร */
export function isReasonValid(
  key: MerchantCancelReason | undefined,
  detail: string,
): key is MerchantCancelReason {
  if (!key) return false;
  return key !== 'OTHER' || detail.trim().length >= 3;
}

/** รายละเอียดยาวได้เท่าไร ให้ reasonText ยังไม่เกิน `limit` ของ API (คืน Table Fee 300 · ยกเลิก 200) */
export function detailMaxLength(key: MerchantCancelReason | undefined, limit: number): number {
  if (key === 'NO_TABLE') return NO_TABLE_NOTE_MAX;
  if (!key || key === 'OTHER') return limit;
  return limit - labelOf(key).length - SEP.length;
}

/** ข้อความหลังแจ้ง "ร้านไม่มีโต๊ะ" สำเร็จ (ใช้ทั้งกล่องคืนเงินและกล่องยกเลิก) */
export const noTableDoneText = (r: C.ReportNoTableResult) =>
  r.refund_amount == null
    ? 'บันทึกแล้ว — ยกเลิกการจองและแจ้งลูกค้าแล้ว'
    : `บันทึกแล้ว — คืน Table Fee ${baht(r.refund_amount)} ให้ลูกค้า (NightOut โอนคืน)`;
