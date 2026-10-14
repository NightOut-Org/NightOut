import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { BookingAdminController } from './booking.admin.controller';
import { BookingMeController } from './booking.me.controller';
import { BookingMerchantController } from './booking.merchant.controller';
import { BookingPublicController } from './booking.public.controller';

/** โดเมน booking — จอง ยกเลิก สถานะ เช็กอิน (ดูก่อนยืนยัน) ย้ายโต๊ะ ผังโต๊ะ (+ Backoffice ดูอย่างเดียว) ร้านไม่มีโต๊ะ โซนว่าง บัตรแชร์ สถิติยอดขาย · DB:app_create_booking(_core), app_cancel_booking, app_team_*, app_check_in, bar_check_in_preview, app_team_report_no_table, zone_availability, bar_booking_table_options, bar_table_board, app_team_set_table_occupancy, get_share_card, bar_sales_stats */
@Module({ controllers: [BookingPublicController, BookingMeController, BookingMerchantController, BookingAdminController], providers: [SupabaseJwtGuard, AdminGuard] })
export class BookingModule {}
