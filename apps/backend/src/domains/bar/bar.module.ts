import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { BarAdminController } from './bar.admin.controller';
import { BarMeController } from './bar.me.controller';
import { BarMerchantController } from './bar.merchant.controller';
import { BarMediaService } from './bar-media.service';
import { GeocodeService } from './geocode.service';
import { PayoutCryptoService } from './payout-crypto.service';

/**
 * โดเมน bar — ร้าน: ข้อมูล ตำแหน่งร้าน (หมุด) รูปร้าน เมนู โปร ค่าธรรมเนียม โซน/โต๊ะ ความปลอดภัย ตั้งค่าการจอง บัญชีรับเงิน ความแน่น · สมัครลงร้าน · แอดมินอนุมัติ/ระงับ/ตรวจหมุด/แก้ข้อมูลร้านแทน · Blacklist ร้าน/ร้านไม่มีโต๊ะ (ข้อร้องเรียนลูกค้า)
 * DB: app_merchant_join, app_update_bar_info, app_request_bar_location, app_cancel_bar_location_request, app_set_bar_media, app_set_menu, app_set_bar_promotions, app_set_fees, app_set_zones, app_set_safety(_evidence),
 *     app_update_booking_settings, app_set_payout_account, app_set_crowd, admin_set_bar_status, admin_review_bar_location, admin_set_bar_location, admin_set_bar_media, admin_set_menu_item_image, admin_verify_safety (ยืนยันจากหลักฐาน · EVIDENCE),
 *     admin_inspect_safety (ลงพื้นที่ตรวจ · ON_SITE), admin_moderate_bar_promotion,
 *     admin_blacklist_bar, admin_unblacklist_bar, admin_report_no_table,
 *     admin_save_bar_details (แอดมินแก้ข้อมูลร้าน/เมนูและราคาแทนร้าน → bar_info_apply + bar_menu_apply · view admin_bar_details)
 * ค้นหาที่อยู่ (GET /geocode/*): GeocodeService = proxy → OSM Nominatim (เฉพาะไทย · cache · ≤ 1 ครั้ง/วินาที)
 * อ่าน: bar_detail / my_bar_detail (catalog · account overview) · bar_safety_inspection_latest (GET /merchant/bars/:barId/safety/inspection)
 */
@Module({
  controllers: [BarMeController, BarMerchantController, BarAdminController],
  providers: [SupabaseJwtGuard, AdminGuard, PayoutCryptoService, BarMediaService, GeocodeService],
})
export class BarModule {}
