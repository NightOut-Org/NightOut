import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
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

/** GET /public/area — ตำบล/อำเภอ/จังหวัด + ย่านของหมุด (rpc area_at_point · ค่าจริงของร้าน DB คำนวณเองตอนบันทึกหมุด) · ประกาศซ้ำกับ merchant/join ตาม ADR 0007 */
export const usePinArea = (pin?: { lat: number; lng: number } | null) =>
  useQuery({
    queryKey: [
      'catalog',
      'area',
      pin ? Number(pin.lat.toFixed(5)) : null,
      pin ? Number(pin.lng.toFixed(5)) : null,
    ],
    queryFn: () =>
      Rest.get<C.AreaAtPointResult>('/public/area', {
        params: { lat: pin!.lat, lng: pin!.lng } satisfies C.AreaAtPointQuery,
      }),
    enabled: !!pin,
    staleTime: Infinity,
  });
