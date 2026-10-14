import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าคืนนี้ (ความแน่น + ดูการจองก่อนเช็กอิน + เช็กอิน) · backend: domains/bar · domains/booking */

/** POST /merchant/bars/:barId/crowd */
export async function setCrowd(barId: string, status: C.CrowdBody['status']) {
  await Rest.post(`/merchant/bars/${barId}/crowd`, { status } satisfies C.CrowdBody);
}

/** GET /merchant/bars/:barId/check-in/preview?code= — ดูการจองก่อนยืนยัน (สดทุกครั้ง · ไม่มียอดเงิน · ทีมร้านทุกบทบาท) */
export const useCheckInPreview = (barId: string, code: string | null) =>
  useQuery({
    queryKey: ['booking', 'check_in_preview', barId, code],
    enabled: !!code,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: () =>
      Rest.get<C.CheckInPreview>(`/merchant/bars/${barId}/check-in/preview`, {
        params: { code: code! } satisfies C.CheckInPreviewQuery,
      }),
  });

/** POST /merchant/bars/:barId/check-in — รหัส NL-XXXXXX หรือข้อความจาก QR (หลังกดยืนยันใน CheckInConfirmModal) */
export const checkIn = (barId: string, code: string) =>
  Rest.post<C.CheckInResult>(`/merchant/bars/${barId}/check-in`, { code } satisfies C.CheckInBody);

/** POST /merchant/bookings/:id/forfeit — ปลดโต๊ะ (Forfeited) เองเมื่อเลยเวลาเก็บโต๊ะ (ทีมร้านทุกบทบาท · ผลเหมือน job ปลดโต๊ะอัตโนมัติ) */
export const forfeitBooking = (bookingId: string) =>
  Rest.post<C.TeamForfeitResult>(`/merchant/bookings/${bookingId}/forfeit`);
