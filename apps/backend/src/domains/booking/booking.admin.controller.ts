import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/admin.guard';
import { bearerOf } from '../../auth/bearer';
import { SupabaseJwtGuard, type AuthedRequest } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, BarId } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { TableBoardQueryDto } from './booking.dto';

/** booking · Backoffice — ดูผังโต๊ะของร้านแบบอ่านอย่างเดียว (เจ้าของอนุมัติ 2026-10-13 · ไม่มีการแก้จากหลังบ้าน) */
@ApiTags('booking')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class BookingAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Get('bars/:barId/table-board')
  @ApiDoc({
    summary: 'ผังโต๊ะของร้าน (Backoffice ดูอย่างเดียว)',
    description:
      'แอดมินเลือกร้านแล้วดูผังโต๊ะ/ไทม์ไลน์คืนนี้ — ข้อมูลชุดเดียวกับ GET merchant/bars/:barId/table-board ' +
      '(สถานะโต๊ะ FREE / RESERVED / IN_USE ณ เวลา server + การจองของคืน 06:00–06:00 เวลาไทย · ไม่มียอดเงิน/เบอร์โทร) · ' +
      '`night` เปลี่ยนแค่รายการ bookings (สถานะโต๊ะคิด ณ ตอนนี้เสมอ) · อ่านในนามผู้เรียก: DB ตรวจ is_admin() เอง (rpc bar_table_board)',
    returns:
      '`bar_id` · `night` · `night_start` · `night_end` · `server_now` · `zones[]` (`tables[]` พร้อม `status` · `status_source` · ' +
      '`current_booking_id` · `next_booking_id` · `next_booking_at` · `occupancy`) · `bookings[]` — รูปเดียวกับ TableBoard ใน @nightout/contracts',
    forbidden: ADMIN_FORBIDDEN,
  })
  tableBoard(@Req() req: AuthedRequest, @BarId() barId: string, @Query() q: TableBoardQueryDto) {
    return this.db.rpcAs<unknown>(bearerOf(req), 'bar_table_board', { p_bar: barId, p_night: q.night ?? null });
  }
}
