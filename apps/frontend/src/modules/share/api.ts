import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าบัตรจองจากลิงก์แชร์ · backend: domains/booking */

export type { ShareCard } from '@nightout/contracts';

/** key ของบัตรจอง — ใส่ user id ด้วย เพราะ `is_member` / `checkin_qr` ขึ้นกับคนที่ล็อกอิน (ล็อกอินแล้วโหลดใหม่เอง) */
export const shareCardKey = (token: string) => ['booking', 'share_card', token] as const;

/** GET /share-cards/:token — ไม่มีข้อมูลส่วนตัว · สมาชิกของกลุ่มได้ QR เช็กอินเพิ่ม (`checkin_qr`) */
export const useShareCard = (token: string, userId: string | null) =>
  useQuery({
    queryKey: [...shareCardKey(token), userId],
    queryFn: () => Rest.get<C.ShareCard | null>(`/share-cards/${encodeURIComponent(token)}`),
  });

/** POST /share-cards/:token/join — กด "ไปด้วย" (ต้องล็อกอิน · กดซ้ำไม่นับซ้ำ) */
export function joinShare(token: string) {
  return Rest.post<C.JoinShareResult>(`/share-cards/${encodeURIComponent(token)}/join`);
}
