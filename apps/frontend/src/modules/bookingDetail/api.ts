import type * as C from '@nightout/contracts';
import { Rest } from '@nightout/utils/rest';

/** API ของหน้ารายละเอียดการจอง · backend: domains/booking */

/** POST /bookings/:id/cancel — ลูกค้ายกเลิกการจองของตัวเอง */
export async function cancelBooking(bookingId: string, reason?: string) {
  await Rest.post(`/bookings/${bookingId}/cancel`, { reason: reason ?? null } satisfies C.CancelBookingBody);
}

/** POST /bookings/:id/extend — ขอต่อเวลา 15 นาที (ได้ 1 ครั้ง · ตั้งแต่ 15 นาทีก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ) */
export function extendBooking(bookingId: string) {
  return Rest.post<C.ExtendBookingResult>(`/bookings/${bookingId}/extend`);
}
