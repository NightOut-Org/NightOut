import { Rest } from '@nightout/utils/rest';
import { requestUploadUrl } from '@/services/api/storage';
import { toWebp } from '@/ui/utils/image';

export const MAX_SOURCE_IMAGE = 15 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

/** นามสกุลตามชนิดไฟล์จริงของ blob (เบราว์เซอร์ที่เข้ารหัส webp ไม่ได้ เช่น Safari จะได้ png กลับมา) */
const EXT_BY_TYPE: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' };

/**
 * อัปโหลดภาพโฆษณาเข้า bucket site-media (public) ที่ ads/<uuid> → คืน URL ถาวร
 * ย่อเป็น webp ด้านยาว 960px · ชื่อไฟล์สุ่ม + x-upsert: false = ภาพที่ยืนยันแล้วถูกเขียนทับไม่ได้
 */
export async function uploadMiniAdImage(file: File): Promise<string> {
  const blob = await toWebp(file, 960, 0.82);
  const ext = EXT_BY_TYPE[blob.type] ?? 'jpg';
  const path = `ads/${crypto.randomUUID()}.${ext}`;
  const { upload_url, public_url } = await requestUploadUrl('site-media', path);
  await Rest.upload(upload_url, blob, { 'x-upsert': 'false' });
  if (!public_url) throw new Error('ไม่ได้ URL ของรูปกลับมา');
  return public_url;
}

/** ตรวจไฟล์ก่อนอัปโหลด — คืนข้อความผิดพลาด หรือ null ถ้าใช้ได้ */
export function checkImage(file: File): string | null {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return 'ใช้ได้เฉพาะรูป JPG, PNG หรือ WebP';
  if (file.size > MAX_SOURCE_IMAGE) return 'รูปใหญ่เกิน 15MB';
  return null;
}
