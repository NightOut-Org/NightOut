import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { signedUrls, uploadSafetyEvidence } from '@/services/api/storage';

/** API ของหน้าความปลอดภัยของร้าน · backend: domains/bar */

/** PUT /merchant/bars/:barId/safety — บันทึกทั้งหน้าครั้งเดียว: เฉพาะข้อที่เปลี่ยนค่า และ/หรือ แนบหลักฐาน */
export async function saveSafety(barId: string, body: C.SaveSafetyBody) {
  return Rest.put<C.SaveSafetyResult>(`/merchant/bars/${barId}/safety`, body);
}

/** อัปโหลดหลักฐาน (รูป/PDF) เข้า bar-verifications/<bar_id>/… → คืน path ไว้ส่งใน `evidence_path` ของ saveSafety */
export function uploadSafetyProof(barId: string, key: string, file: Blob) {
  return uploadSafetyEvidence(barId, key, file);
}

/** GET /merchant/bars/:barId/safety/inspection — ผลลงพื้นที่ตรวจครั้งล่าสุด (null = ยังไม่เคยตรวจ · ไม่มีชื่อผู้ตรวจ) */
export const useLatestInspection = (barId: string) =>
  useQuery({
    queryKey: ['bar', 'safety-inspection', barId],
    queryFn: () => Rest.get<C.SafetyInspectionSummary | null>(`/merchant/bars/${barId}/safety/inspection`),
  });

/** URL ชั่วคราวของรูปจากการลงพื้นที่ตรวจ (bucket bar-verifications · ทีมร้านอ่านได้) → { path: url } */
export const useInspectionPhotoUrls = (paths: string[]) =>
  useQuery({
    queryKey: ['bar', 'safety-inspection-photos', paths],
    enabled: paths.length > 0,
    staleTime: 5 * 3_600_000,
    queryFn: async (): Promise<Record<string, string>> => Object.fromEntries(await signedUrls('bar-verifications', paths)),
  });
