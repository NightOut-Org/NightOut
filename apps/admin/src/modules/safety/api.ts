import type * as C from '@nightout/contracts';
import { safetyInspectionPhotoPath } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { useAdminView, type AdminActionInput, type ViewFilter } from '@/services/adminData';
import { requestUploadUrl } from '@/services/api/storage';
import { toWebp } from '@/ui/utils/image';

/**
 * API ของหน้ายืนยัน Safety · backend: domains/backoffice (อ่าน) · domains/bar (bar.admin.controller.ts)
 * ทีมงานตรวจได้ 2 วิธี (แยกให้เห็นทุกที่): "ยืนยันแล้ว" = ตรวจหลักฐาน (EVIDENCE) · ลงพื้นที่ตรวจตาม checklist (ON_SITE)
 */

/** ร้านทั้งหมด (ตัวกรองร้าน) เรียงตามชื่อ */
export const useSafetyBars = () =>
  useAdminView('admin_bars', { order: { column: 'name', ascending: true } });

/** ข้อที่ร้านแจ้งว่า "มี" แต่ยังไม่มีผลลงพื้นที่ (รอตรวจ + ตรวจหลักฐานแล้ว · กรองที่ server ด้วย awaiting_visit) เก่าสุดก่อน · barId = เฉพาะร้านนั้น */
export const useSafetyQueue = (barId?: string | null) =>
  useAdminView('admin_safety_queue', {
    filters: [['awaiting_visit', true], ...(barId ? [['bar_id', barId] as ViewFilter] : [])],
    order: { column: 'updated_at', ascending: true },
  });

/** checklist ทุกข้อของร้าน (ร้านยังไม่แจ้ง = UNKNOWN) สำหรับ Drawer ลงพื้นที่ตรวจ */
export const useBarSafety = (barId: string) =>
  useAdminView('admin_bar_safety', {
    filters: [['bar_id', barId]],
    order: { column: 'sort_order', ascending: true },
  });

/** ประวัติการลงพื้นที่ตรวจ ล่าสุดก่อน · barId = เฉพาะร้านนั้น */
export const useSafetyInspections = (barId?: string | null) =>
  useAdminView('admin_safety_inspections', {
    filters: barId ? [['bar_id', barId]] : [],
    order: { column: 'inspected_at', ascending: false },
    limit: 200,
  });

/** POST /admin/safety/:id/verify — ปุ่ม "ยืนยันแล้ว": ตรวจจากหลักฐานที่ร้านแนบ ไม่ได้ลงพื้นที่ (→ C.VerifySafetyResult) */
export const verifySafetyAction = (safetyId: string): AdminActionInput => ({
  method: 'POST',
  path: `safety/${safetyId}/verify`,
});

/** POST /admin/bars/:id/safety-inspections — บันทึกผลลงพื้นที่ตรวจ 1 ครั้ง (→ C.SafetyInspectionResult) */
export const inspectSafetyAction = (barId: string, body: C.SafetyInspectionBody): AdminActionInput => ({
  method: 'POST',
  path: `bars/${barId}/safety-inspections`,
  body,
});

/** นามสกุลตามชนิดไฟล์จริง — bucket bar-verifications รับ jpeg/png/webp (Safari อาจได้ png แทน webp) */
const PHOTO_EXT: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

/** ย่อรูปแล้วอัปโหลดเข้า bar-verifications/<bar_id>/inspections/ (policy ให้แอดมิน + MFA เขียนได้เฉพาะโฟลเดอร์นี้) → คืน path */
export async function uploadInspectionPhoto(barId: string, file: File): Promise<string> {
  let blob: Blob;
  try {
    blob = await toWebp(file, 1600, 0.8);
  } catch {
    throw new Error('เปิดรูปนี้ไม่ได้ (เช่น HEIC) — ถ่ายใหม่หรือเลือกไฟล์ JPG/PNG');
  }
  const ext = PHOTO_EXT[blob.type];
  if (!ext) throw new Error('ไฟล์นี้ไม่ใช่รูป JPG/PNG/WEBP');
  const path = safetyInspectionPhotoPath(barId, ext);
  const { upload_url } = await requestUploadUrl('bar-verifications', path);
  await Rest.upload(upload_url, blob, { 'x-upsert': 'false' });
  return path;
}
