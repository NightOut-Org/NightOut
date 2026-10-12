import { Body, Controller, HttpCode, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { BarMediaService } from './bar-media.service';
import { AdminBarMediaDto, ApproveDto, DiscardBarMediaDto, SetBarStatusDto, SetBarsStatusDto } from './bar.dto';

/** bar · Backoffice — อนุมัติร้าน · แสดง/ระงับหลายร้าน · รูปร้าน/รูปเมนูแทนร้าน · ยืนยัน Safety · ตรวจถ้อยคำโปรของร้าน (audit log ในธุรกรรมเดียว) */
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
    description: 'หน้า /merchants (ข้อยกเว้นที่บันทึกทันที) · เปลี่ยนสถานะร้าน (APPROVED = ขึ้นหน้าเว็บ, REJECTED/SUSPENDED = ซ่อน) พร้อมเหตุผล · บันทึก audit log (rpc admin_set_bar_status)',
    returns: '`id` รหัสร้าน · `status` สถานะใหม่',
    forbidden: ADMIN_FORBIDDEN,
  })
  setStatus(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: SetBarStatusDto) {
    return this.db.rpc('admin_set_bar_status', { p_actor: me.id, p_bar: id, p_status: b.status, p_reason: b.reason ?? null });
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
    summary: 'ยืนยันข้อมูลความปลอดภัย',
    description: 'แอดมินตรวจหลักฐานแล้วยืนยันข้อความปลอดภัย 1 ข้อของร้าน → ADMIN_VERIFIED + ปิดรายงาน + คำนวณคะแนน Safety ใหม่ (rpc admin_verify_safety)',
    returns: '`id` รหัสรายการ · `source` = ADMIN_VERIFIED',
    forbidden: ADMIN_FORBIDDEN,
  })
  verifySafety(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.db.rpc('admin_verify_safety', { p_actor: me.id, p_feature: id });
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
}
