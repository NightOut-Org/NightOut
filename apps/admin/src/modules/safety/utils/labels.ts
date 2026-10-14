import type { Db, SafetyCheckResult, SafetyVerifyMethod } from '@nightout/types';
import { SAFETY_CHECK_LABELS, SAFETY_VERIFY_METHOD_LABELS } from '@nightout/utils';
import type { TagLabel } from '@/ui/utils/labels';

/** ป้ายของหน้า /safety (ใช้เฉพาะหน้านี้) */

/** ผลลงพื้นที่ต่อข้อ */
export const SAFETY_CHECK_TAG: Record<SafetyCheckResult, TagLabel> = {
  PASS: { text: SAFETY_CHECK_LABELS.PASS, color: 'green' },
  FAIL: { text: SAFETY_CHECK_LABELS.FAIL, color: 'red' },
  NA: { text: SAFETY_CHECK_LABELS.NA, color: 'default' },
};

/** วิธีที่ทีมงานตรวจ (bar_safety_features.verify_method) — ต้องแยกให้เห็นทุกที่ */
export const SAFETY_VERIFY_TAG: Record<SafetyVerifyMethod, TagLabel> = {
  EVIDENCE: { text: SAFETY_VERIFY_METHOD_LABELS.EVIDENCE, color: 'blue' },
  ON_SITE: { text: SAFETY_VERIFY_METHOD_LABELS.ON_SITE, color: 'green' },
};

/** ค่าที่ร้านแจ้ง / ลูกค้าเห็น */
export const SAFETY_VALUE_TEXT: Record<Db.Enums<'safety_value'>, string> = {
  YES: 'มี',
  NO: 'ไม่มี',
  UNKNOWN: 'ไม่ระบุ',
};

/** สิ่งที่ผู้ตรวจต้องดูต่อข้อ (key ที่ไม่รู้จัก = ไม่มีคำแนะนำ) */
export const SAFETY_INSPECTION_HINTS: Readonly<Record<string, string>> = {
  SECURITY: 'มี รปภ./การ์ดประจำทางเข้าในเวลาทำการ · แต่งกายหรือมีป้ายชัดเจน',
  CCTV: 'กล้องครอบคลุมทางเข้า ทางเดิน และที่จอดรถ · เปิดใช้งานจริง (ดูจอหรือไฟสถานะ)',
  FIRE_EXIT: 'ป้ายทางออกฉุกเฉินมีไฟ · ทางหนีไฟไม่ถูกกีดขวางหรือล็อก · ถังดับเพลิงไม่หมดอายุและหยิบได้',
  FIRST_AID: 'มีชุดปฐมพยาบาลในร้าน ของไม่หมดอายุ · พนักงานรู้ว่าอยู่ที่ไหน',
  ID_CHECK: 'ตรวจบัตรประชาชนลูกค้าก่อนเข้าร้าน (อายุ 20 ปีขึ้นไป)',
  PARKING_RIDE: 'มีที่จอดรถ หรือช่วยเรียกรถ/แท็กซี่ให้ลูกค้ากลับบ้าน',
  FEMALE_STAFF: 'มีพนักงานหญิงช่วยดูแลลูกค้าในเวลาทำการ',
  LIGHTING: 'ทางเข้าและที่จอดรถมีไฟสว่างพอ ไม่มีจุดมืด',
  EMERGENCY_CONTACT: 'ติดเบอร์ฉุกเฉิน/ช่องทางแจ้งเหตุให้ลูกค้าเห็นชัด · พนักงานรู้ขั้นตอน',
};
