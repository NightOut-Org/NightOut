import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { uploadSafetyEvidence } from '@/services/api/storage';

/** API ของหน้าความปลอดภัยของร้าน · backend: domains/bar */

/** PUT /merchant/bars/:barId/safety — บันทึกทั้งหน้าครั้งเดียว: เฉพาะข้อที่เปลี่ยนค่า และ/หรือ แนบหลักฐาน */
export async function saveSafety(barId: string, body: C.SaveSafetyBody) {
  return Rest.put<C.SaveSafetyResult>(`/merchant/bars/${barId}/safety`, body);
}

/** อัปโหลดหลักฐาน (รูป/PDF) เข้า bar-verifications/<bar_id>/… → คืน path ไว้ส่งใน `evidence_path` ของ saveSafety */
export function uploadSafetyProof(barId: string, key: string, file: Blob) {
  return uploadSafetyEvidence(barId, key, file);
}
