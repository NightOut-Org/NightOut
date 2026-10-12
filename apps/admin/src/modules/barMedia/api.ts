import type * as C from '@nightout/contracts';
import { barMediaPath, type BarMediaFolder } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { useAdminView, type AdminActionInput } from '@/services/adminData';
import { requestUploadUrl } from '@/services/api/storage';
import { toWebp } from '@/ui/utils/image';

/** API ของหน้ารูปร้าน · backend: domains/backoffice (อ่าน admin_bar_media) · domains/bar (bar.admin.controller.ts) */

/** GET /admin/views/admin_bar_media เรียงตามชื่อร้าน */
export const useBarMedia = () =>
  useAdminView('admin_bar_media', { order: { column: 'name', ascending: true } });

/** PUT /admin/bars/:id/media — บันทึก Drawer ครั้งเดียว: แกลเลอรี + ปก และ/หรือ รูปเมนูที่เปลี่ยน (ส่งให้ useAdminAction().mutate พร้อม success) */
export const barMediaAction = (barId: string, body: C.AdminBarMediaBody): AdminActionInput => ({
  method: 'PUT',
  path: `bars/${barId}/media`,
  body,
});

/** POST /admin/bars/:id/media/discard — ลบไฟล์ที่เพิ่งอัปโหลดแต่บันทึกไม่สำเร็จ (ไฟล์ที่ใช้อยู่ไม่ถูกลบ) */
export const discardBarMedia = (barId: string, paths: string[]) =>
  Rest.post<{ removed: number }>(`/admin/bars/${barId}/media/discard`, { paths } satisfies C.DiscardBarMediaBody);

/** ย่อเป็น webp แล้วอัปโหลดเข้า bar-media/<bar_id>/<folder>/ (policy ให้แอดมิน + MFA เขียนได้) → คืน path */
export async function uploadBarImage(
  barId: string,
  folder: BarMediaFolder,
  file: File,
): Promise<string> {
  const blob = await toWebp(file, folder === 'gallery' ? 1920 : 800, 0.82);
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() ?? 'jpg');
  const path = barMediaPath(barId, folder, ext);
  const { upload_url } = await requestUploadUrl('bar-media', path);
  await Rest.upload(upload_url, blob, { 'x-upsert': 'false' });
  return path;
}
