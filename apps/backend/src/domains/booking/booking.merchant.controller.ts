import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { bearerOf } from '../../auth/bearer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthedRequest, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { BarId, BookingId, Id, TEAM_FORBIDDEN } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CheckInDto,
  CheckInPreviewQueryDto,
  MoveBookingDto,
  ReportNoTableDto,
  SalesStatsQueryDto,
  TableBoardQueryDto,
  TableOccupancyDto,
  TeamBookingStatusDto,
} from './booking.dto';

/** booking · ทีมร้าน — เปลี่ยนสถานะ เช็กอิน (ดูก่อนยืนยัน) ย้ายโต๊ะ ผังโต๊ะ แจ้งร้านไม่มีโต๊ะ ปลดโต๊ะ (Forfeited) สถิติยอดขาย (เจ้าของ/ผู้จัดการ) (ฟังก์ชันใน DB ตรวจ bar_staff + บทบาท) */
@ApiTags('booking')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller('merchant')
export class BookingMerchantController {
  constructor(private readonly db: SupabaseService) {}

  @Post('bookings/:bookingId/status')
  @HttpCode(200)
  @ApiDoc({
    summary: 'เปลี่ยนสถานะการจอง (ฝั่งร้าน)',
    description: 'ทีมร้านยืนยัน/ปฏิเสธ/เช็กอิน/ปิดงาน/ยกเลิกการจอง · DB ตรวจว่าเปลี่ยนสถานะได้ตาม state machine (rpc app_team_set_booking_status)',
    returns: '`id` รหัสการจอง · `status` สถานะใหม่',
    forbidden: TEAM_FORBIDDEN,
  })
  setStatus(@CurrentUser() me: AuthUser, @BookingId() id: string, @Body() b: TeamBookingStatusDto) {
    return this.db.rpc('app_team_set_booking_status', { p_actor: me.id, p_booking: id, p_to: b.to, p_reason: b.reason ?? null });
  }

  @Post('bookings/:bookingId/move')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ย้ายโต๊ะ',
    description:
      'ทีมร้านทุกบทบาท (รวม PR/STAFF) ย้ายการจองที่ยังถือโต๊ะอยู่ (รอยืนยัน → เช็กอินแล้ว) ไปโซน/โต๊ะอื่น ช่วงเวลาเดิม · ' +
      'โต๊ะปลายทางต้องว่าง (TABLE_TAKEN) · ข้ามโซนต้องมีที่ว่างพอ (ZONE_FULL) · แจ้งลูกค้า + บันทึก audit log · ดูโต๊ะที่ว่างได้จาก GET merchant/bars/:barId/bookings/:bookingId/table-options (rpc app_team_move_booking)',
    returns: '`id` · `zone_id` · `zone_name` · `table_id` · `table_name`',
    forbidden: 'ไม่ใช่ทีมของร้านนี้',
  })
  move(@CurrentUser() me: AuthUser, @BookingId() id: string, @Body() b: MoveBookingDto) {
    return this.db.rpc('app_team_move_booking', {
      p_actor: me.id,
      p_booking: id,
      p_zone: b.zone_id,
      p_table: b.table_id ?? null,
      p_reason: b.reason ?? null,
    });
  }

  @Get('bars/:barId/bookings/:bookingId/table-options')
  @ApiDoc({
    summary: 'โซน/โต๊ะที่ย้ายการจองไปได้',
    description: 'ทุกโต๊ะ (และโซนที่จองแบบไม่ระบุโต๊ะได้) ของร้าน พร้อมสถานะว่าง ณ ช่วงเวลาของการจองนี้ — ใช้กับปุ่ม "ย้ายโต๊ะ" (rpc bar_booking_table_options)',
    returns:
      'รายการ `zone_id` · `zone_name` · `table_id` (null = ไม่ระบุโต๊ะ) · `table_name` · `seats` · `available` ย้ายไปได้ · `is_current` ที่นั่งปัจจุบัน · `zone_remaining_pax` ที่ว่างในโซน',
    forbidden: TEAM_FORBIDDEN,
  })
  tableOptions(@Req() req: AuthedRequest, @BookingId() bookingId: string) {
    return this.db.rpcAs<unknown[]>(bearerOf(req), 'bar_booking_table_options', { p_booking: bookingId });
  }

  @Get('bars/:barId/check-in/preview')
  @ApiDoc({
    summary: 'ดูการจองก่อนยืนยันเช็กอิน',
    description:
      'หลังสแกน QR / พิมพ์รหัสในหน้า /merchant/tonight — แสดงชื่อ จำนวนคน โซน/โต๊ะ เวลา ให้พนักงานตรวจก่อนกดยืนยัน (ยังไม่เปลี่ยนสถานะ · ไม่มียอดเงิน) · ทีมร้านทุกบทบาท · ' +
      'บอกว่ากดเช็กอินได้ไหมตามเวลา server (ตั้งแต่ 3 ชม. ก่อนเวลาจอง ถึงเวลาปลดโต๊ะ) · อ่านในนามผู้เรียก (rpc bar_check_in_preview)',
    returns:
      '`id` · `code` · `status` · `booking_datetime` · `auto_cancel_at` · `extended_at` · `pax` · `zone_name` · `table_name` · `customer_name` · `promotion_title` · `customer_note` · ' +
      '`checked_in_at` · `check_in_opens_at` · `is_today` · `can_check_in` · `block_reason` (NOT_CONFIRMED / ALREADY_CHECKED_IN / TOO_EARLY / TOO_LATE / null) · `server_now`',
    forbidden: TEAM_FORBIDDEN,
  })
  checkInPreview(@Req() req: AuthedRequest, @BarId() bar: string, @Query() q: CheckInPreviewQueryDto) {
    return this.db.rpcAs<unknown>(bearerOf(req), 'bar_check_in_preview', { p_bar: bar, p_code: q.code });
  }

  @Post('bars/:barId/check-in')
  @HttpCode(200)
  @ApiDoc({
    summary: 'เช็กอินลูกค้าด้วยรหัส/QR',
    description: 'สแกน QR หรือพิมพ์รหัสการจองที่หน้าร้าน · ผ่านแล้วนับเป็น 1 โหวตในหน้าจัดอันดับ (rpc app_check_in — รับ NL-XXXXXX, NIGHTOUT:<id> และ QR เก่า)',
    returns: '`id` · `code` · `pax` จำนวนคน · `zone_name` โซน · `customer_name` ชื่อลูกค้า',
    forbidden: TEAM_FORBIDDEN,
  })
  checkIn(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: CheckInDto) {
    return this.db.rpc('app_check_in', { p_actor: me.id, p_bar: bar, p_code: b.code });
  }

  @Post('bookings/:bookingId/no-table')
  @HttpCode(200)
  @ApiDoc({
    summary: 'แจ้งร้านไม่มีโต๊ะให้ลูกค้า',
    description:
      'การจองที่ยืนยันแล้ว/เช็กอินแล้ว → คืน Table Fee เต็มจำนวน (คิว "รอคืนลูกค้า" NightOut โอน) + ยกเลิกฝั่งร้านถ้ายังไม่เช็กอิน + บันทึกประวัติร้าน (bar_strikes 1 การจอง = 1 ครั้ง) + แจ้งแอดมินและทีมร้าน · ' +
      'แอดมินตัดสินใจ Blacklist ที่ Backoffice · ทีมร้านทุกบทบาท (rpc app_team_report_no_table → app_team_refund_deposit)',
    returns: '`booking_id` · `booking_status` · `refund_amount` (บาท · null = ไม่มี Table Fee ที่คืนได้) · `strikes_90d`',
    forbidden: TEAM_FORBIDDEN,
  })
  reportNoTable(@CurrentUser() me: AuthUser, @BookingId() id: string, @Body() b: ReportNoTableDto) {
    return this.db.rpc('app_team_report_no_table', { p_actor: me.id, p_booking: id, p_note: b.note ?? null });
  }

  @Post('bookings/:bookingId/forfeit')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ปลดโต๊ะ (Forfeited) — ลูกค้าไม่มาตามเวลา',
    description:
      'ทีมร้านทุกบทบาท (รวม PR/STAFF) กดปลดโต๊ะเองได้เฉพาะการจองที่ยืนยันแล้ว (ยังไม่เช็กอิน) และเลยเวลาเก็บโต๊ะ (`auto_cancel_at` รวมที่ลูกค้าขอต่อเวลาแล้ว) ตามเวลา server · ' +
      'ผลเหมือนงานอัตโนมัติ: สถานะ NO_SHOW "ปลดโต๊ะ (Forfeited)" · Table Fee เป็นของร้าน (คิวโอนให้ร้าน) · แจ้งลูกค้า ทีมร้าน และแอดมิน · บันทึก audit log `booking.forfeit` · ' +
      'ยังไม่เลยเวลา = BOOKING_NOT_OVERDUE · ไม่ใช่สถานะยืนยันแล้ว = BOOKING_NOT_CONFIRMED (rpc app_team_forfeit_booking)',
    returns: '`id` รหัสการจอง · `status` = NO_SHOW',
    forbidden: TEAM_FORBIDDEN,
  })
  forfeit(@CurrentUser() me: AuthUser, @BookingId() id: string) {
    return this.db.rpc('app_team_forfeit_booking', { p_actor: me.id, p_booking: id });
  }

  @Get('bars/:barId/table-board')
  @ApiDoc({
    summary: 'ผังโต๊ะของร้าน (คืนนี้)',
    description:
      'ทีมร้านทุกบทบาท (รวม PR/STAFF) — โซน/โต๊ะที่เปิดใช้ พร้อมสถานะ ณ เวลา server: `FREE` ว่าง · ' +
      '`RESERVED` จองแล้ว (การจองที่ยังไม่เช็กอิน เริ่มภายใน 60 นาที หรือเลยเวลานัดแต่ยังไม่ปลดโต๊ะ) · ' +
      '`IN_USE` กำลังใช้ (การจองที่เช็กอินแล้ว หรือทีมร้านตั้งเอง) + การจองของคืนนั้นทั้งหมดไว้วาดไทม์ไลน์ ' +
      '(ไม่มียอดเงิน/เบอร์โทร) · คืน = 06:00–06:00 เวลาไทย · `night` เปลี่ยนแค่รายการ bookings (สถานะโต๊ะคิด ณ ตอนนี้เสมอ) · ' +
      'หน้าเว็บโพลทุก 10 วินาที (rpc bar_table_board)',
    returns:
      '`bar_id` · `night` · `night_start` · `night_end` · `server_now` · `zones[]` (`id` · `name` · `capacity_pax` · ' +
      '`allow_zone_only_booking` · `sort_order` · `tables[]`: `id` · `name` · `seats` · `status` · `status_source` · ' +
      '`current_booking_id` · `next_booking_id` · `next_booking_at` · `occupancy`) · `bookings[]` (`id` · `code` · `status` · ' +
      '`zone_id` · `zone_name` · `table_id` · `table_name` · `booking_datetime` · `reserved_from` · `reserved_until` · `auto_cancel_at` · `extended_at` · ' +
      '`checked_in_at` · `completed_at` · `pax` · `customer_name` · `request_pr` · `customer_note` · `promotion_title`)',
    forbidden: TEAM_FORBIDDEN,
  })
  tableBoard(@Req() req: AuthedRequest, @BarId() barId: string, @Query() q: TableBoardQueryDto) {
    return this.db.rpcAs<unknown>(bearerOf(req), 'bar_table_board', { p_bar: barId, p_night: q.night ?? null });
  }

  @Post('tables/:tableId/occupancy')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ตั้งโต๊ะเป็น "กำลังใช้" / "ว่าง" (ไม่มีการจอง)',
    description:
      'ทีมร้านทุกบทบาท — ใช้เมื่อมีลูกค้านั่งโต๊ะโดยไม่มีการจองในระบบ (ไม่ใช่ระบบคิว Walk-in) · ' +
      'โต๊ะที่มีการจองเช็กอินอยู่ตั้งซ้ำไม่ได้ (TABLE_ALREADY_IN_USE) · ตั้งว่างโต๊ะที่ลูกค้าเช็กอินอยู่ไม่ได้ (TABLE_HAS_GUEST — ให้ปิดการจองแทน) · ' +
      'เช็กอิน (หรือย้ายการจองที่เช็กอินแล้ว) มาที่โต๊ะนี้ = ปิด "กำลังใช้" ให้อัตโนมัติ · ลืมตั้งว่างเกิน 12 ชม. ถือว่าหมดอายุ · ' +
      'โต๊ะ/โซนปิดใช้ = TABLE_NOT_ON_BOARD · บันทึก audit log `table.occupy` / `table.release` (rpc app_team_set_table_occupancy)',
    returns: '`table_id` · `in_use` · `occupancy_id` · `started_at` · `ended_at` (null เมื่อเพิ่งตั้งกำลังใช้)',
    forbidden: TEAM_FORBIDDEN,
  })
  setOccupancy(@CurrentUser() me: AuthUser, @Id('tableId') tableId: string, @Body() b: TableOccupancyDto) {
    return this.db.rpc('app_team_set_table_occupancy', {
      p_actor: me.id,
      p_table: tableId,
      p_in_use: b.in_use,
      p_pax: b.pax ?? null,
      p_note: b.note ?? null,
    });
  }

  @Get('bars/:barId/sales-stats')
  @ApiDoc({
    summary: 'ยอดขายเฉลี่ยของร้าน (ประมาณการ)',
    description:
      'เฉพาะเจ้าของ/ผู้จัดการ (Staff/PR ห้ามเห็นยอดเงินรวม → 403 NOT_BAR_MANAGER) · นับการจองตามเวลานัดใน `days` วันล่าสุด เทียบช่วงก่อนหน้าที่ยาวเท่ากัน · ' +
      'Table Fee = เงินที่ลูกค้าจ่ายผ่านแอปและร้านได้ (รวมที่รอโอน · ไม่รวมที่คืนลูกค้า) · ยอดใช้จ่ายโดยประมาณ = ราคาที่ประเมินตอนจอง (ถ้ามี) หรือราคาต่อคนโดยประมาณของร้าน × จำนวนคน ของการจองที่เช็กอินแล้ว — ไม่ใช่ยอดบิลจริงของร้าน (rpc bar_sales_stats)',
    returns:
      '`days` · `generated_at` · `current` / `previous` = { `table_fee_total` · `table_fee_bookings` · `table_fee_avg` · `checked_in_bookings` · `checked_in_pax` · `estimated_bookings` · `est_spend_total` · `est_spend_per_booking` · `est_spend_per_person` } (บาท · null = ไม่มีข้อมูล)',
    forbidden: 'ไม่ใช่เจ้าของ/ผู้จัดการของร้านนี้ (NOT_BAR_MANAGER)',
  })
  salesStats(@Req() req: AuthedRequest, @BarId() barId: string, @Query() q: SalesStatsQueryDto) {
    // อ่านในนามผู้เรียก — is_bar_manager() ใช้ auth.uid() ของ token (service_role จะได้ NOT_BAR_MANAGER เสมอ)
    return this.db.rpcAs<unknown>(bearerOf(req), 'bar_sales_stats', { p_bar: barId, p_days: q.days });
  }
}
