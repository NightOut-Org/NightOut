import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type * as C from '@nightout/contracts';
import { bearerOf } from '../../auth/bearer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthedRequest, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { BarId, TEAM_FORBIDDEN } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { BarMediaService } from './bar-media.service';
import {
  BarInfoDto,
  BarLocationDto,
  BarMediaDto,
  BarPromotionsDto,
  BarStoreDto,
  CrowdDto,
  FeesDto,
  MenuDto,
  PromotionsPageDto,
  SaveSafetyDto,
  SettingsPageDto,
  ZonesDto,
} from './bar.dto';
import { PayoutCryptoService } from './payout-crypto.service';

/**
 * bar · ทีมร้าน — ข้อมูลร้าน ตำแหน่งร้าน (หมุด) รูปร้าน เมนู โปร ค่าธรรมเนียม โซน ความปลอดภัย ตั้งค่าการจอง บัญชีรับเงิน ความแน่น
 * ฟังก์ชันใน DB ตรวจ bar_staff + บทบาท: STAFF ทำได้แค่ความแน่น · เจ้าของ/ผู้จัดการ ทุกอย่าง (รวมบัญชีรับเงิน — requirement "Owner/Manager")
 */
@ApiTags('bar')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller('merchant/bars/:barId')
export class BarMerchantController {
  constructor(
    private readonly db: SupabaseService,
    private readonly crypto: PayoutCryptoService,
    private readonly media: BarMediaService,
  ) {}

  @Post('crowd')
  @HttpCode(200)
  @ApiDoc({
    summary: 'อัปเดตความแน่นของร้าน',
    description: 'ตั้งสถานะ ว่าง/ใกล้เต็ม/เต็ม ที่ลูกค้าเห็นบนการ์ดร้าน (เกิน 60 นาทีไม่อัปเดต = ไม่ทราบสถานะ) (rpc app_set_crowd)',
    returns: '`bar_id` · `current_crowd` สถานะปัจจุบัน',
    forbidden: TEAM_FORBIDDEN,
  })
  crowd(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: CrowdDto) {
    return this.db.rpc('app_set_crowd', { p_actor: me.id, p_bar: bar, p_status: b.status });
  }

  @Patch('info')
  @ApiDoc({
    summary: 'แก้ข้อมูลร้าน',
    description: 'แก้ชื่อ คำอธิบาย เบอร์โทร ย่าน สไตล์ เวลาเปิด-ปิด และลิงก์โซเชียล (ที่อยู่/หมุดแก้ที่ PUT …/location) · ส่งเฉพาะ field ที่ต้องการแก้ · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_update_bar_info)',
    returns: '`id` รหัสร้าน',
    forbidden: TEAM_FORBIDDEN,
  })
  info(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: BarInfoDto) {
    return this.db.rpc('app_update_bar_info', { p_actor: me.id, p_bar: bar, p: b });
  }

  @Put('media')
  @ApiDoc({
    summary: 'ตั้งรูปร้าน (ปก + แกลเลอรี)',
    description:
      'แทนที่แกลเลอรีทั้งชุดตามลำดับ (สูงสุด 10 รูป · อัปโหลดเข้า bucket bar-media/<bar_id>/gallery/ เองก่อนด้วย POST /storage/upload-url แล้วส่ง path) · `cover_path` = รูปปกที่ใช้บนการ์ด/แผนที่/หัวหน้าร้าน (ต้องอยู่ในแกลเลอรี · null = ใช้รูปแทน) · ไฟล์ที่เอาออกถูกลบจาก Storage · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_set_bar_media)',
    returns: '`bar_id` · `count` จำนวนรูป · `cover_image_url` URL รูปปก · `paths` แกลเลอรีที่บันทึก',
    forbidden: TEAM_FORBIDDEN,
  })
  setMedia(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: BarMediaDto) {
    return this.media.setGallery('app_set_bar_media', me.id, bar, b);
  }

  @Put('store')
  @ApiDoc({
    summary: 'บันทึกหน้าข้อมูลร้าน (ข้อมูลร้าน + รูปร้าน)',
    description:
      'หน้า /merchant/store แก้ในหน้าแล้วบันทึกครั้งเดียว · `info` = ชื่อ คำอธิบาย เบอร์โทร ย่าน สไตล์ เวลาเปิด-ปิด ลิงก์โซเชียล (ส่งเฉพาะ field ที่แก้ · ที่อยู่/หมุดแก้ที่ PUT …/location) · `media` = แกลเลอรีทั้งชุดตามลำดับ (สูงสุด 10 รูป · อัปโหลดเข้า bucket bar-media/<bar_id>/gallery/ ก่อนด้วย POST /storage/upload-url แล้วส่ง path) + `cover_path` (ต้องอยู่ในแกลเลอรี · null = ใช้รูปแทน) · ส่งเฉพาะส่วนที่แก้ อย่างน้อย 1 ส่วน · ธุรกรรมเดียว (พลาด = ไม่บันทึกทั้งคู่) · ไฟล์ที่เอาออกถูกลบจาก Storage · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_save_bar_store → app_update_bar_info + app_set_bar_media)',
    returns: '`bar_id` · `info_updated` · `gallery` = { `bar_id`, `count`, `cover_image_url`, `paths` } หรือ null ถ้าไม่ได้ส่ง media',
    forbidden: TEAM_FORBIDDEN,
  })
  saveStore(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: BarStoreDto) {
    return this.media.saveStore(me.id, bar, b);
  }

  @Put('location')
  @ApiDoc({
    summary: 'ส่งตำแหน่งร้าน (หมุด · ที่อยู่ · ที่จอดรถ · รถไฟฟ้า)',
    description:
      'หน้า /merchant/location · ร้านที่แสดง/ระงับอยู่ → สร้างคำขอรอแอดมินตรวจ (ระหว่างรอลูกค้าเห็นหมุดเดิม · ส่งใหม่ = แทนคำขอเดิม · แจ้งแอดมิน) · ร้านที่ยังไม่เคยแสดง → บันทึกทันที (ตรวจพร้อมการอนุมัติร้าน) · เหมือนเดิมทุกช่อง = `LOCATION_UNCHANGED` · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_request_bar_location)',
    returns: '`bar_id` · `status` PENDING (รอตรวจ) / APPLIED (บันทึกแล้ว) · `request_id` (null ถ้า APPLIED)',
    forbidden: TEAM_FORBIDDEN,
  })
  requestLocation(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: BarLocationDto) {
    return this.db.rpc('app_request_bar_location', { p_actor: me.id, p_bar: bar, p: b });
  }

  @Delete('location-request')
  @ApiDoc({
    summary: 'ยกเลิกคำขอแก้ตำแหน่งที่รอตรวจ',
    description:
      'หน้า /merchant/location ปุ่ม "ยกเลิกคำขอ" · ลูกค้ายังเห็นหมุดเดิมต่อ · ไม่มีคำขอรอตรวจ = `LOCATION_REQUEST_NOT_FOUND` · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_cancel_bar_location_request)',
    returns: '`bar_id` · `request_id` · `cancelled` = true',
    validates: false,
    forbidden: TEAM_FORBIDDEN,
  })
  cancelLocationRequest(@CurrentUser() me: AuthUser, @BarId() bar: string) {
    return this.db.rpc('app_cancel_bar_location_request', { p_actor: me.id, p_bar: bar });
  }

  @Put('menu')
  @ApiDoc({
    summary: 'ตั้งเมนูและราคา',
    description:
      'แทนที่เมนูทั้งหมดของร้าน (ราคาแสดงเพื่อประเมินงบ ไม่มีสั่งล่วงหน้า) · `image_path` ต่อรายการ = รูปใน bucket bar-media/<bar_id>/menu/ (ไม่ส่ง = คงรูปเดิม · null = ลบรูป) · รูปที่ถูกแทน/ลบถูกลบจาก Storage (rpc app_set_menu)',
    returns: '`bar_id` · `count` จำนวนรายการที่บันทึก',
    forbidden: TEAM_FORBIDDEN,
  })
  menu(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: MenuDto) {
    return this.media.setMenu(me.id, bar, b);
  }

  @Put('promotions')
  @ApiDoc({
    summary: 'ตั้งโปรโมชันของร้าน',
    description: 'แทนที่โปรทั้งหมด (เช่น มาก่อน 2 ทุ่ม มิกเซอร์ 4 จ่าย 3 · ห้ามโปรแอลกอฮอล์) · โปรใหม่/แก้ไขต้องรอแอดมินตรวจก่อนแสดง (rpc app_set_bar_promotions)',
    returns: '`bar_id` · `count` จำนวนโปร · `pending` จำนวนที่รอตรวจ',
    forbidden: TEAM_FORBIDDEN,
  })
  promotions(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: BarPromotionsDto) {
    return this.db.rpc('app_set_bar_promotions', { p_actor: me.id, p_bar: bar, p_items: b.items });
  }

  @Put('fees')
  @ApiDoc({
    summary: 'ตั้งค่าบริการ / VAT / ค่าอื่นๆ',
    description: 'ใช้คำนวณราคาประเมินในหน้าร้าน (rpc app_set_fees)',
    returns: '`bar_id`',
    forbidden: TEAM_FORBIDDEN,
  })
  fees(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: FeesDto) {
    return this.db.rpc('app_set_fees', { p_actor: me.id, p_bar: bar, p_service_charge: b.service_charge, p_vat: b.vat, p_other: b.other });
  }

  @Put('promotions-page')
  @ApiDoc({
    summary: 'บันทึกหน้าโปรโมชัน (โปร + ค่าธรรมเนียม)',
    description:
      'หน้า /merchant/promotions แก้ในหน้าแล้วบันทึกครั้งเดียว · `items` = โปรทั้งชุด แทนที่ทั้งหมด (โปรใหม่/แก้ข้อความต้องรอแอดมินตรวจก่อนแสดง · ห้ามโปรแอลกอฮอล์) · `fees` = Service Charge % / VAT % / ค่าอื่นต่อบิล ใช้คำนวณราคาประเมิน · ส่งเฉพาะส่วนที่แก้ อย่างน้อย 1 ส่วน · ธุรกรรมเดียว · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_save_promotions_page → app_set_bar_promotions + app_set_fees)',
    returns: '`bar_id` · `count` จำนวนโปร · `pending` จำนวนที่รอตรวจ · `fees_updated`',
    forbidden: TEAM_FORBIDDEN,
  })
  promotionsPage(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: PromotionsPageDto) {
    return this.db.rpc('app_save_promotions_page', { p_actor: me.id, p_bar: bar, p_items: b.items ?? null, p_fees: b.fees ?? null });
  }

  @Put('zones')
  @ApiDoc({
    summary: 'ตั้งโซนและโต๊ะ',
    description: 'แทนที่โซนทั้งหมด พร้อมความจุ ระยะเวลานั่งเริ่มต้น และรายชื่อโต๊ะ (ใช้คำนวณโซนว่างตอนจอง) · โซน/โต๊ะที่ไม่ส่งมา = ปิดใช้ (rpc app_set_zones)',
    returns: '`bar_id` · `zones` จำนวนโซนที่บันทึก',
    forbidden: TEAM_FORBIDDEN,
  })
  zones(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: ZonesDto) {
    return this.db.rpc('app_set_zones', { p_actor: me.id, p_bar: bar, p_zones: b.zones });
  }

  @Put('safety')
  @ApiDoc({
    summary: 'บันทึกข้อมูลความปลอดภัย (หลายข้อ)',
    description:
      'หน้า /merchant/safety แก้ในหน้าแล้วบันทึกครั้งเดียว · `items` = เฉพาะข้อที่เปลี่ยน: `value` YES/NO/UNKNOWN (กลับเป็นร้านแจ้งเอง + คิดคะแนนความปลอดภัยใหม่) และ/หรือ `evidence_path` หลักฐาน (อัปโหลดเข้า bucket bar-verifications/<bar_id>/… ก่อนด้วย POST /storage/upload-url) ให้แอดมินตรวจ · ธุรกรรมเดียว · แจ้งแอดมิน 1 ครั้งถ้ามีหลักฐาน · เจ้าของ/ผู้จัดการเท่านั้น (rpc app_save_safety → app_set_safety)',
    returns: '`bar_id` · `values_updated` จำนวนข้อที่เปลี่ยนค่า · `evidence_added` จำนวนหลักฐานที่แนบ',
    forbidden: TEAM_FORBIDDEN,
  })
  saveSafety(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: SaveSafetyDto) {
    return this.db.rpc('app_save_safety', { p_actor: me.id, p_bar: bar, p_items: b.items });
  }

  @Get('safety/inspection')
  @ApiDoc({
    summary: 'ผลลงพื้นที่ตรวจ Safety ครั้งล่าสุด',
    description:
      'หน้า /merchant/safety — วันที่ทีมงานลงพื้นที่ · ผล ผ่าน/ไม่พบ/ไม่ได้ตรวจ ต่อข้อ + หมายเหตุ + รูป (bucket bar-verifications) · ไม่มีชื่อผู้ตรวจ · เฉพาะการลงพื้นที่ (ON_SITE — การยืนยันจากหลักฐานไม่อยู่ในนี้) · เจ้าของ/ผู้จัดการเท่านั้น (บทบาทอื่น/ไม่ใช่ทีมได้ null) (rpc bar_safety_inspection_latest)',
    returns:
      'object `id` · `inspected_at` · `note` · `pass_count` · `fail_count` · `na_count` · `safety_score` · `items[]` (`feature_key`, `name_th`, `result`, `note`, `photo_paths`) หรือ `null` ถ้ายังไม่เคยตรวจ หรือผู้เรียกไม่ใช่เจ้าของ/ผู้จัดการ',
  })
  latestInspection(@Req() req: AuthedRequest, @BarId() bar: string) {
    return this.db.rpcAs<C.SafetyInspectionSummary | null>(bearerOf(req), 'bar_safety_inspection_latest', { p_bar: bar });
  }

  /** เลขบัญชีเข้ารหัสที่นี่ก่อนส่งลง DB — DB/หน้าเว็บเห็นแค่ 4 ตัวท้าย */
  @Put('settings')
  @ApiDoc({
    summary: 'บันทึกหน้าตั้งค่าการจอง (ตั้งค่า + บัญชีรับเงิน)',
    description:
      'หน้า /merchant/settings แก้ในหน้าแล้วบันทึกครั้งเดียว · ส่งเฉพาะส่วนที่แก้ อย่างน้อย 1 ส่วน · ' +
      '`booking` = ยอดมัดจำ (ต่อโต๊ะ/ต่อคน) นโยบายมัดจำ เวลาเก็บโต๊ะ และจำนวน PR ชาย/หญิง/LGBTQ+ (ส่งเฉพาะ field ที่แก้ · เจ้าของ/ผู้จัดการ) · ' +
      '`payout` = บัญชีที่ NightOut โอนเงินมัดจำให้หลังลูกค้าเช็กอิน (เจ้าของเท่านั้น · เลขบัญชีถูกเข้ารหัส AES-256-GCM ที่ API ก่อนลง DB ด้วย PAYOUT_ENCRYPTION_KEY) · ' +
      'ธุรกรรมเดียว — ผู้จัดการส่ง `payout` = ไม่บันทึกทั้งคู่ (rpc app_save_settings_page → app_update_booking_settings + app_set_payout_account)',
    returns: '`bar_id` · `settings_updated` · `account_no_last4` 4 ตัวท้ายของบัญชีใหม่ (null ถ้าไม่ได้ส่ง payout)',
    forbidden: TEAM_FORBIDDEN,
  })
  saveSettings(@CurrentUser() me: AuthUser, @BarId() bar: string, @Body() b: SettingsPageDto) {
    return this.db.rpc('app_save_settings_page', {
      p_actor: me.id,
      p_bar: bar,
      p_settings: b.booking ?? null,
      p_payout: b.payout
        ? {
            bank_code: b.payout.bank_code,
            account_name: b.payout.account_name,
            account_no_enc: this.crypto.encrypt(b.payout.account_no),
            last4: b.payout.account_no.slice(-4),
          }
        : null,
    });
  }
}
