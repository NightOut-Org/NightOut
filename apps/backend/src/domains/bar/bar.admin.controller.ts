import { Body, Controller, HttpCode, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { BarMediaService } from './bar-media.service';
import { AdminBarDetailsDto, AdminBarMediaDto, AdminReportNoTableDto, AdminSetBarLocationDto, ApproveDto, BarBlacklistDto, DiscardBarMediaDto, ReviewBarLocationDto, SafetyInspectionDto, SetBarStatusDto, SetBarsStatusDto } from './bar.dto';

/** bar · Backoffice — อนุมัติร้าน · แสดง/ระงับหลายร้าน · ตรวจ/ตั้งตำแหน่งร้าน (หมุด) · แก้ข้อมูลร้าน/เมนูและราคาแทนร้าน · รูปร้าน/รูปเมนูแทนร้าน · ยืนยันหลักฐาน Safety + ลงพื้นที่ตรวจ Safety (Inspector) · ตรวจถ้อยคำโปรของร้าน · Blacklist ร้าน/ร้านไม่มีโต๊ะ (audit log ในธุรกรรมเดียว) */
@ApiTags('bar')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class BarAdminController {
  constructor(
    private readonly db: SupabaseService,
    private readonly media: BarMediaService,
  ) {}

  @Patch('bars/status')
  @ApiDoc({
    summary: 'แสดง/ระงับร้านหลายร้าน (บันทึกหน้าจัดการร้าน)',
    description:
      'หน้า /bars แก้สวิตช์ในหน้าแล้วบันทึกครั้งเดียว · `changes` = เฉพาะร้านที่เปลี่ยน: APPROVED = แสดงบนเว็บ · SUSPENDED = ซ่อน (ต้องมี `reason` ร้านเห็นข้อความนี้) · รับเฉพาะร้านที่แสดง/ระงับอยู่แล้ว (`BAR_NOT_TOGGLEABLE` — ร้านใหม่อนุมัติที่ PATCH /admin/bars/:id/status) · ธุรกรรมเดียว (พลาด 1 ร้าน = ไม่บันทึกเลย) · audit log ต่อร้าน (rpc admin_set_bars_status → admin_set_bar_status)',
    returns: '`updated` จำนวนร้านที่บันทึก',
    forbidden: ADMIN_FORBIDDEN,
  })
  setStatuses(@CurrentUser() me: AuthUser, @Body() b: SetBarsStatusDto) {
    return this.db.rpc('admin_set_bars_status', { p_actor: me.id, p_changes: b.changes });
  }

  @Patch('bars/:id/status')
  @ApiDoc({
    summary: 'อนุมัติ/ไม่อนุมัติร้าน',
    description: 'หน้า /merchants (ข้อยกเว้นที่บันทึกทันที) · เปลี่ยนสถานะร้าน (APPROVED = ขึ้นหน้าเว็บ, REJECTED/SUSPENDED = ซ่อน) พร้อมเหตุผล · บันทึก audit log · อนุมัติร้านใหม่ = ตรวจหมุดไปพร้อมกัน (หมุดค่าเริ่มต้นของระบบเดิม → `BAR_LOCATION_NOT_SET`) (rpc admin_set_bar_status)',
    returns: '`id` รหัสร้าน · `status` สถานะใหม่',
    forbidden: ADMIN_FORBIDDEN,
  })
  setStatus(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: SetBarStatusDto) {
    return this.db.rpc('admin_set_bar_status', { p_actor: me.id, p_bar: id, p_status: b.status, p_reason: b.reason ?? null });
  }

  @Post('bar-location-requests/:id/review')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ตรวจคำขอแก้ตำแหน่งร้าน',
    description:
      'Backoffice /bar-locations · `approve: true` = หมุด/ข้อมูลใหม่แสดงทันที (ส่ง `location` = แอดมินปรับก่อนอนุมัติ) · `approve: false` + `reason` = ตีกลับ (ร้านเห็นเหตุผล) · audit log + แจ้งทีมร้าน (rpc admin_review_bar_location)',
    returns: '`id` · `bar_id` · `status` APPROVED / REJECTED · `admin_edited`',
    forbidden: ADMIN_FORBIDDEN,
  })
  reviewLocation(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: ReviewBarLocationDto) {
    return this.db.rpc('admin_review_bar_location', {
      p_actor: me.id,
      p_request: id,
      p_approve: b.approve,
      p_reason: b.approve ? null : (b.reason ?? null),
      p_location: b.approve ? (b.location ?? null) : null,
    });
  }

  @Put('bars/:id/location')
  @ApiDoc({
    summary: 'ตั้งตำแหน่งร้านแทนร้าน',
    description:
      'แอดมินแก้หมุด/ที่อยู่/ที่จอดรถ/รถไฟฟ้าแทนร้าน (ทุกสถานะร้าน รวมร้านใหม่ก่อนอนุมัติ) · มีผลทันทีและถือว่าตรวจแล้ว · ส่งค่าเดิม = ยืนยันหมุดเดิม · คำขอที่ค้างของร้านถูกยกเลิก · `note` = ข้อความถึงร้าน · audit log + แจ้งทีมร้าน (rpc admin_set_bar_location)',
    returns: '`bar_id` · `request_id` แถวประวัติ',
    forbidden: ADMIN_FORBIDDEN,
  })
  setLocation(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: AdminSetBarLocationDto) {
    const { note, ...loc } = b;
    return this.db.rpc('admin_set_bar_location', { p_actor: me.id, p_bar: id, p: loc, p_note: note ?? null });
  }

  @Put('bars/:id/details')
  @ApiDoc({
    summary: 'แก้ข้อมูลร้านแทนร้าน (ข้อมูลร้าน + เมนูและราคา)',
    description:
      'Drawer "แก้ข้อมูลร้าน" ใน /bars บันทึกครั้งเดียวในนาม NightOut · `info` = ชื่อ คำอธิบาย เบอร์โทร ย่าน สไตล์ (เฉพาะที่แสดงอยู่) เวลาเปิด-ปิด ลิงก์โซเชียล ' +
      '(ส่งเฉพาะ field ที่แก้ · ที่อยู่/หมุดไม่อยู่ในเส้นนี้ — แก้ที่ PUT /admin/bars/:id/location) · ' +
      '`menu` = เมนูทั้งชุดแทนที่ทั้งหมด (รูปเมนูคงเดิม จัดการที่ PUT /admin/bars/:id/media · รายการที่เอาออกถูกลบพร้อมไฟล์รูป) · ' +
      'อย่างน้อย 1 ส่วน · ธุรกรรมเดียว · audit ต่อส่วน + แจ้งทีมร้าน 1 ครั้ง (rpc admin_save_bar_details)',
    returns: '`bar_id` · `info_updated` · `menu_count` (null ถ้าไม่ได้ส่ง menu)',
    forbidden: ADMIN_FORBIDDEN,
  })
  saveDetails(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: AdminBarDetailsDto) {
    return this.media.saveAdminDetails(me.id, id, b);
  }

  @Put('bars/:id/media')
  @ApiDoc({
    summary: 'บันทึกรูปร้านแทนร้าน (ปก + แกลเลอรี + รูปเมนู)',
    description:
      'Drawer รูปร้านใน /bar-media แก้ในหน้าแล้วบันทึกครั้งเดียว ในนาม NightOut (เช่น ลบรูปไม่เหมาะสม · อัปโหลดรูปที่ร้านส่งมา) · `gallery` = แกลเลอรีทั้งชุด + `cover_path` (ไฟล์ใน bar-media/<bar_id>/gallery/) · `menu_images` = เฉพาะรายการเมนูที่เปลี่ยนรูป (`path` ใน bar-media/<bar_id>/menu/ · null = ลบรูป) · ส่งอย่างน้อย 1 ส่วน · ธุรกรรมเดียว · audit log ต่อรายการ + แจ้งทีมร้าน 1 ครั้ง · ไฟล์ที่ไม่ใช้แล้วถูกลบจาก Storage (rpc admin_save_bar_media)',
    returns: '`bar_id` · `gallery` = { `bar_id`, `count`, `cover_image_url`, `paths` } หรือ null · `menu_updated` จำนวนรูปเมนูที่เปลี่ยน',
    forbidden: ADMIN_FORBIDDEN,
  })
  saveMedia(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: AdminBarMediaDto) {
    return this.media.saveAdmin(me.id, id, b);
  }

  @Post('bars/:id/media/discard')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ลบไฟล์รูปที่อัปโหลดแต่บันทึกไม่สำเร็จ',
    description:
      'Drawer `/bar-media` เรียกเมื่อ PUT /admin/bars/:id/media พลาดหลังอัปโหลดไฟล์ไปแล้ว · ลบจาก bucket bar-media เฉพาะไฟล์ใน `<bar_id>/gallery/` หรือ `<bar_id>/menu/` ที่ไม่มีแถวไหนอ้าง (rpc bar_media_unused) · ไฟล์ที่ใช้อยู่ไม่ถูกลบ',
    returns: '`removed` จำนวนไฟล์ที่ลบ',
    forbidden: ADMIN_FORBIDDEN,
  })
  discardMedia(@Id() id: string, @Body() b: DiscardBarMediaDto) {
    return this.media.discard(id, b.paths);
  }

  @Post('safety/:id/verify')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ยืนยันข้อมูลความปลอดภัยจากหลักฐาน (ไม่ได้ลงพื้นที่)',
    description:
      'ปุ่ม "ยืนยันแล้ว" ในคิว /safety · แอดมินตรวจหลักฐานที่ร้านแนบแล้วยืนยันข้อความปลอดภัย 1 ข้อของร้าน → ADMIN_VERIFIED + `verify_method` = EVIDENCE (ลูกค้าเห็น "ตรวจหลักฐานแล้ว <วันที่>" — ต่างจากการลงพื้นที่ตรวจ ON_SITE ที่ POST /admin/bars/:id/safety-inspections) + บันทึกผู้ยืนยัน/วันที่ + ปิดรายงาน + คำนวณคะแนน Safety ใหม่ + audit log · ยืนยันได้เฉพาะข้อที่ร้านแจ้ง "มี" เอง (SELF_DECLARED) — ตรวจแล้ว/ร้านเปลี่ยนค่า → 409 SAFETY_ALREADY_VERIFIED (ไม่ทับผลลงพื้นที่) · ร้านยังไม่แนบหลักฐาน → 400 SAFETY_EVIDENCE_REQUIRED · แอดมินที่อยู่ในทีมของร้าน → 403 INSPECTOR_IS_BAR_MEMBER · ไม่พบรายการ → 404 SAFETY_FEATURE_NOT_FOUND (rpc admin_verify_safety)',
    returns: '`id` รหัสรายการ · `source` = ADMIN_VERIFIED · `verify_method` = EVIDENCE',
    forbidden: ADMIN_FORBIDDEN,
  })
  verifySafety(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.db.rpc('admin_verify_safety', { p_actor: me.id, p_feature: id });
  }

  @Post('bars/:id/safety-inspections')
  @ApiDoc({
    summary: 'บันทึกผลลงพื้นที่ตรวจ Safety (Inspector)',
    description:
      'Drawer "ลงพื้นที่ตรวจร้านนี้" ใน /safety · แอดมินทุกคนลงพื้นที่ตรวจร้านได้ (ยกเว้นร้านที่ตัวเองอยู่ในทีม → INSPECTOR_IS_BAR_MEMBER) · ' +
      '`items` = ผลต่อข้อ PASS (ผ่าน → ลูกค้าเห็น "มี" + "ทีมงานลงพื้นที่ตรวจ <วันที่>") / FAIL (ไม่พบ → "ไม่มี") / NA (ไม่ได้ตรวจ · ไม่เปลี่ยนค่า) + หมายเหตุ + รูปสูงสุด 3 รูปต่อข้อ (อัปโหลดเข้า bucket bar-verifications/<bar_id>/inspections/ ก่อนด้วย POST /storage/upload-url) · ' +
      'ข้อที่ผ่าน/ไม่พบ → ADMIN_VERIFIED + `verify_method` = ON_SITE · ต้องมี PASS หรือ FAIL อย่างน้อย 1 ข้อ · `inspected_at` ย้อนได้ไม่เกิน 30 วัน และไม่ก่อนการตรวจครั้งล่าสุดของร้าน · ' +
      'บันทึกชื่อผู้ตรวจ + วันที่ (แก้ไม่ได้ ตรวจใหม่ได้) · ปิดรายงานจากลูกค้าของข้อที่ตรวจ · คิด Safety Score ใหม่ · audit log · แจ้งเจ้าของ/ผู้จัดการร้าน · ธุรกรรมเดียว (rpc admin_inspect_safety)',
    returns: '`id` รหัสการตรวจ · `bar_id` · `inspected_at` · `pass_count` · `fail_count` · `na_count` · `safety_score` คะแนนใหม่',
    forbidden: ADMIN_FORBIDDEN,
  })
  inspectSafety(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: SafetyInspectionDto) {
    return this.db.rpc('admin_inspect_safety', {
      p_actor: me.id,
      p_bar: id,
      p_items: b.items,
      p_note: b.note?.trim() || null,
      p_inspected_at: b.inspected_at ?? null,
    });
  }

  @Post('bar-promotions/:id/moderate')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ตรวจโปรโมชันของร้าน',
    description: 'อนุมัติหรือปฏิเสธโปรที่ร้านตั้ง ก่อนแสดงให้ลูกค้าเห็น (rpc admin_moderate_bar_promotion)',
    returns: '`id` รหัสโปร · `moderation_status` APPROVED / REJECTED',
    forbidden: ADMIN_FORBIDDEN,
  })
  moderatePromotion(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: ApproveDto) {
    return this.db.rpc('admin_moderate_bar_promotion', { p_actor: me.id, p_promotion: id, p_approve: b.approve, p_reason: b.reason ?? null });
  }

  @Post('bars/:id/blacklist')
  @HttpCode(200)
  @ApiDoc({
    summary: 'Blacklist ร้าน',
    description:
      'หน้า /bar-blacklist · ซ่อนร้านจากเว็บและปิดรับจองใหม่จนกว่าแอดมินจะปลด (สถานะ SUSPENDED + blacklisted_at · ระหว่างนี้เปลี่ยนสถานะทางอื่นไม่ได้ — BAR_BLACKLISTED) · ' +
      'เหตุผลบังคับ (ร้านเห็น) · การจองเดิมยังอยู่ · audit log + แจ้งทีมร้าน (rpc admin_blacklist_bar)',
    returns: '`id` · `status` = SUSPENDED · `blacklisted_at` · `upcoming_bookings`',
    forbidden: ADMIN_FORBIDDEN,
  })
  blacklist(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: BarBlacklistDto) {
    return this.db.rpc('admin_blacklist_bar', { p_actor: me.id, p_bar: id, p_reason: b.reason });
  }

  @Post('bars/:id/blacklist/lift')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ปลด Blacklist ร้าน',
    description: 'ร้านกลับมาแสดง (APPROVED) และรับจองได้ทันที · เหตุผลบังคับ · audit log + แจ้งทีมร้าน (rpc admin_unblacklist_bar)',
    returns: '`id` · `status` = APPROVED · `blacklisted_at` = null',
    forbidden: ADMIN_FORBIDDEN,
  })
  liftBlacklist(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: BarBlacklistDto) {
    return this.db.rpc('admin_unblacklist_bar', { p_actor: me.id, p_bar: id, p_reason: b.reason });
  }

  @Post('bar-strikes')
  @HttpCode(200)
  @ApiDoc({
    summary: 'บันทึกร้านไม่มีโต๊ะ (ข้อร้องเรียนลูกค้า)',
    description:
      'หน้า /bar-blacklist · ลูกค้าร้องเรียนว่าร้านรับจองแล้วไม่มีโต๊ะ → แอดมินบันทึกแทนร้าน: Override คืน Table Fee เต็มจำนวน (HELD / PAYOUT_PENDING / REFUND_PENDING → REFUND_PENDING ไปโอนคืนที่ /deposits "รอคืนลูกค้า") + ' +
      'ยกเลิกการจองถ้ายังไม่เช็กอิน + บันทึกประวัติร้าน (bar_strikes source=ADMIN · 1 การจอง = 1 ครั้ง) + แจ้งลูกค้าและทีมร้าน · ' +
      'ใช้กับการจองที่ยืนยันแล้ว / เช็กอินแล้ว / จบแล้ว / ปลดโต๊ะ / ร้านยกเลิกแล้ว (ร้านเลือกเหตุผลอื่นเพื่อเลี่ยงประวัติ — สถานะคงเดิม แต่ Override เหตุผลคืนเงิน) (rpc admin_report_no_table)',
    returns: '`booking_id` · `booking_code` · `booking_status` · `refund_amount` (บาท · null = ไม่มี Table Fee ที่คืนผ่านระบบได้) · `strikes_90d`',
    forbidden: ADMIN_FORBIDDEN,
  })
  reportNoTable(@CurrentUser() me: AuthUser, @Body() b: AdminReportNoTableDto) {
    return this.db.rpc('admin_report_no_table', { p_actor: me.id, p_code: b.booking_code, p_note: b.note });
  }
}
