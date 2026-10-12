import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { dataUrlToBlob, uploadBarMedia } from '@/services/api/storage';
import { compressImage } from '@/ui/utils/media';

/** API ของหน้าข้อมูลร้าน · backend: domains/bar */

/** PUT /merchant/bars/:barId/store — บันทึกทั้งหน้าครั้งเดียว: ข้อมูลร้าน และ/หรือ แกลเลอรี + ปก (ส่งเฉพาะส่วนที่แก้) */
export async function saveStore(barId: string, body: C.BarStoreBody) {
  return Rest.put<C.BarStoreResult>(`/merchant/bars/${barId}/store`, body);
}

/** ย่อรูป (ด้านยาว 1920px) แล้วอัปโหลดเข้า bar-media/<bar_id>/gallery/ — คืน path ไว้ส่งใน `media` ของ saveStore */
export async function uploadGalleryPhoto(barId: string, file: File) {
  const blob = await dataUrlToBlob(await compressImage(file, 1920, 0.82));
  return uploadBarMedia(barId, 'gallery', blob);
}
