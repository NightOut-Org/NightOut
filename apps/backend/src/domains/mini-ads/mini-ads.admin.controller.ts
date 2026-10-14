import { Body, Controller, Delete, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, Id } from '../../common/params';
import { CreateMiniAdDto, UpdateMiniAdDto } from './mini-ads.dto';
import { MiniAdsService } from './mini-ads.service';

const SAVE_RETURNS = '`id` · `title` · `active` · `placements` · `starts_at` · `ends_at`';

/**
 * mini-ads · Backoffice — เพิ่ม/แก้/ลบโฆษณาแบนเนอร์ (แอดมินทุกคนที่ผ่าน MFA · audit log ทุกครั้ง)
 * อ่านรายการผ่าน view admin_mini_ads (GET /admin/views/admin_mini_ads) · ห้ามแบรนด์/สินค้าเครื่องดื่มแอลกอฮอล์ (ม.32)
 */
@ApiTags('mini-ads')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin/mini-ads')
export class MiniAdsAdminController {
  constructor(private readonly ads: MiniAdsService) {}

  @Post()
  @ApiDoc({
    summary: 'เพิ่มโฆษณาแบนเนอร์',
    description:
      'ภาพอัปโหลดเข้า bucket site-media (ads/<uuid>.webp) ก่อนด้วย POST /storage/upload-url แล้วส่ง URL · ต้องส่ง `confirm_no_alcohol: true` (ไม่ใช่แบรนด์/สินค้าเครื่องดื่มแอลกอฮอล์ — ม.32) · บันทึกผู้ยืนยัน + audit log (rpc admin_save_mini_ad)',
    returns: SAVE_RETURNS,
    status: HttpStatus.CREATED,
    forbidden: ADMIN_FORBIDDEN,
  })
  create(@CurrentUser() me: AuthUser, @Body() b: CreateMiniAdDto) {
    return this.ads.save(me.id, null, b);
  }

  @Patch(':id')
  @ApiDoc({
    summary: 'แก้โฆษณาแบนเนอร์',
    description:
      'ส่งเฉพาะ field ที่แก้ · แก้เนื้อหา (ผู้ลงโฆษณา หัวข้อ คำอธิบาย ปุ่ม ภาพ ลิงก์) ต้องส่ง `confirm_no_alcohol: true` อีกครั้ง · เปิด/ปิด วันที่ ตำแหน่ง บันทึกภายใน ไม่ต้องยืนยันซ้ำ · ภาพเก่าที่ไม่มีโฆษณาไหนใช้แล้วถูกลบจาก Storage · audit log ก่อน/หลัง (rpc admin_save_mini_ad)',
    returns: SAVE_RETURNS,
    forbidden: ADMIN_FORBIDDEN,
  })
  update(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: UpdateMiniAdDto) {
    return this.ads.save(me.id, id, b);
  }

  @Delete(':id')
  @ApiDoc({
    summary: 'ลบโฆษณาแบนเนอร์',
    description:
      'ลบถาวรพร้อมยอดเห็น/คลิก (ยอดรวมเก็บใน audit log) · ถ้าแค่ไม่อยากให้แสดง ใช้ PATCH active=false · ภาพที่ไม่มีโฆษณาไหนใช้แล้วถูกลบจาก Storage (rpc admin_delete_mini_ad)',
    returns: '`id` · `deleted` = true',
    forbidden: ADMIN_FORBIDDEN,
  })
  remove(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.ads.remove(me.id, id);
  }
}
