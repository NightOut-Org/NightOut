import type * as C from '@nightout/contracts';
import { TABLE_BOARD_POLL_MS } from '@nightout/utils';
import { Rest } from '@nightout/utils/rest';
import { useQuery } from '@tanstack/react-query';
import { useAdminView } from '@/services/adminData';

/**
 * API ของหน้าผังโต๊ะร้าน (/table-board — ดูอย่างเดียว)
 * backend: domains/backoffice (อ่าน admin_bars) · domains/booking (booking.admin.controller.ts → rpc bar_table_board)
 */

/** GET /admin/views/admin_bars — รายชื่อร้านให้เลือก เรียงตามชื่อ */
export const useBars = () =>
  useAdminView('admin_bars', { order: { column: 'name', ascending: true } });

/**
 * GET /admin/bars/:barId/table-board — ผังโต๊ะคืนนี้ของร้าน (ข้อมูลชุดเดียวกับ /merchant/floor · ไม่มียอดเงิน/เบอร์โทร)
 * โพลทุก 10 วิ (หยุดเองเมื่อสลับแท็บ) · key ขึ้นต้น 'admin'
 */
export const useTableBoard = (barId: string | null) =>
  useQuery({
    queryKey: ['admin', 'booking', 'table-board', barId],
    // ไม่ส่ง night (C.TableBoardQuery) = คืนนี้
    queryFn: () => Rest.get<C.TableBoard>(`/admin/bars/${barId}/table-board`),
    enabled: !!barId,
    refetchInterval: TABLE_BOARD_POLL_MS,
    retry: 1,
  });
