import type { SafetyCheckResult, SafetyVerifyMethod } from '@nightout/types';

/**
 * Safety — ทีมงานตรวจข้อความปลอดภัยของร้าน 2 วิธี (ต้องแยกให้เห็นทุกที่ · ห้ามคำว่า "Safety Verified" / "ยืนยันโดย NightOut")
 * - EVIDENCE: ปุ่ม "ยืนยันแล้ว" ใน Backoffice — ตรวจจากหลักฐานที่ร้านแนบ ไม่ได้ลงพื้นที่
 * - ON_SITE: Inspector (แอดมินทุกคน) ลงพื้นที่ตรวจตาม checklist — ผ่าน / ไม่พบ / ไม่ได้ตรวจ + หมายเหตุ + รูป (safety_inspections)
 * ใช้ร่วม: Backoffice /safety · หน้าร้าน /merchant/safety · ป้าย Safety หน้าบ้าน · contracts (ขีดจำกัดของ body)
 */

/** ผลต่อข้อ — ลำดับปุ่มใน Drawer ลงพื้นที่ตรวจ */
export const SAFETY_CHECK_RESULTS = ['PASS', 'FAIL', 'NA'] as const satisfies readonly SafetyCheckResult[];
export const SAFETY_CHECK_LABELS: Record<SafetyCheckResult, string> = {
  PASS: 'ผ่าน',
  FAIL: 'ไม่พบ',
  NA: 'ไม่ได้ตรวจ',
};
/** รูปต่อข้อ — DB ตรวจซ้ำ (check cardinality ≤ 3) */
export const SAFETY_INSPECTION_MAX_PHOTOS = 3;
/** บันทึกย้อนหลังได้ไม่เกิน (วัน) — DB ตรวจซ้ำ */
export const SAFETY_INSPECTION_MAX_AGE_DAYS = 30;
/** หมายเหตุรวมของการตรวจ 1 ครั้ง */
export const SAFETY_INSPECTION_NOTE_MAX = 1000;
/** หมายเหตุต่อข้อ */
export const SAFETY_CHECK_NOTE_MAX = 500;

/** ผลตรวจ → ค่าที่ลูกค้าเห็น (null = ไม่เปลี่ยน) — ตรงกับ admin_inspect_safety ใน DB */
export function safetyCheckValue(r: SafetyCheckResult): 'YES' | 'NO' | null {
  return r === 'PASS' ? 'YES' : r === 'FAIL' ? 'NO' : null;
}

/** นับผล ผ่าน / ไม่พบ / ไม่ได้ตรวจ */
export function countSafetyChecks(items: readonly { result: SafetyCheckResult }[]): {
  pass: number;
  fail: number;
  na: number;
} {
  const n = { pass: 0, fail: 0, na: 0 };
  for (const { result } of items) {
    if (result === 'PASS') n.pass += 1;
    else if (result === 'FAIL') n.fail += 1;
    else n.na += 1;
  }
  return n;
}

/** path รูปจากการลงพื้นที่ — bar-verifications/<bar_id>/inspections/<uuid>.<ext> (DB ตรวจรูปแบบเดียวกันใน safety_inspection_photo_ok) */
export function safetyInspectionPhotoPath(barId: string, ext: string, id: string = crypto.randomUUID()): string {
  return `${barId}/inspections/${id}.${ext.replace(/^\./, '').toLowerCase()}`;
}

/** วิธีตรวจ (bar_safety_features.verify_method) — ลำดับที่แสดง */
export const SAFETY_VERIFY_METHODS = ['EVIDENCE', 'ON_SITE'] as const satisfies readonly SafetyVerifyMethod[];
/** ป้ายของแต่ละวิธี — ต่อท้ายด้วยวันที่ เช่น "ทีมงานลงพื้นที่ตรวจ 13 ต.ค. 69" */
export const SAFETY_VERIFY_METHOD_LABELS: Record<SafetyVerifyMethod, string> = {
  EVIDENCE: 'ตรวจหลักฐานแล้ว',
  ON_SITE: 'ทีมงานลงพื้นที่ตรวจ',
};
/** ป้ายของข้อที่ ADMIN_VERIFIED — ไม่รู้วิธี (ข้อมูลก่อนแยกวิธี) = ตรวจหลักฐาน เพื่อไม่อ้างว่าลงพื้นที่ */
export function safetyVerifyLabel(method: SafetyVerifyMethod | null | undefined): string {
  return SAFETY_VERIFY_METHOD_LABELS[method ?? 'EVIDENCE'];
}
