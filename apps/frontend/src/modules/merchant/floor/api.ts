import type * as C from '@nightout/contracts';
import { TABLE_BOARD_POLL_MS } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';

/** API ของหน้าผังโต๊ะ · backend: domains/booking (ย้ายโต๊ะ/สถานะ ประกาศซ้ำกับ bookingDetail/api.ts ตาม ADR 0007) */

export const tableBoardKey = (barId: string) => ['booking', 'table_board', barId] as const;

/** GET /merchant/bars/:barId/table-board — โพลทุก TABLE_BOARD_POLL_MS (หยุดเองเมื่อแท็บถูกซ่อน · หยุดระหว่างลาก) */
export const useTableBoard = (barId: string, paused = false) =>
  useQuery({
    queryKey: tableBoardKey(barId),
    queryFn: () => Rest.get<C.TableBoard>(`/merchant/bars/${barId}/table-board`),
    refetchInterval: paused ? false : TABLE_BOARD_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    // โพลซ้ำเองทุก 10 วิอยู่แล้ว — ไม่ต้อง retry 3 รอบ (403 ก็ไม่ควรยิงซ้ำ)
    retry: 1,
    // เก็บข้อมูลเดิมไว้ระหว่าง refetch/ล้มเหลว → ป้าย "เชื่อมต่อไม่ได้" แทนหน้าว่าง
    placeholderData: (prev) => prev,
  });

/** POST /merchant/tables/:tableId/occupancy — ตั้งโต๊ะเป็น "กำลังใช้" (ไม่มีการจอง) / "ว่าง" · ทีมร้านทุกบทบาท */
export const setTableOccupancy = (tableId: string, body: C.TableOccupancyBody) =>
  Rest.post<C.TableOccupancyResult>(`/merchant/tables/${tableId}/occupancy`, body satisfies C.TableOccupancyBody);

/** POST /merchant/bookings/:id/move — ย้ายโต๊ะ (ทีมร้านทุกบทบาท · เวลาเดิม) · tableId null = ไม่ระบุโต๊ะ */
export const moveBooking = (bookingId: string, zoneId: string, tableId: string | null, reason?: string) =>
  Rest.post<C.MoveBookingResult>(`/merchant/bookings/${bookingId}/move`, {
    zone_id: zoneId,
    table_id: tableId,
    reason: reason?.trim() || null,
  } satisfies C.MoveBookingBody);

/** POST /merchant/bookings/:id/status — เช็กอิน (เวลา server · ตรวจช่วงเช็กอินที่ DB) / ลูกค้ากลับแล้ว (เสร็จสิ้น) */
export async function setBookingStatus(bookingId: string, to: 'CHECKED_IN' | 'COMPLETED') {
  await Rest.post(`/merchant/bookings/${bookingId}/status`, { to, reason: null } satisfies C.TeamBookingStatusBody);
}
