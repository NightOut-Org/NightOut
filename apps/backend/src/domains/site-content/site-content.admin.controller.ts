import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SaveSiteNavResult } from '@nightout/contracts';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { SaveSiteNavDto } from './site-content.dto';

/** site-content · Backoffice — เมนู navbar ของเว็บลูกค้า (rpc admin_save_site_nav · audit log) · เนื้อหาหน้าแรกแก้จาก Backoffice ไม่ได้แล้ว (2026-10-15) */
@ApiTags('site-content')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class SiteContentAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Put('site-nav')
  @ApiDoc({
    summary: 'บันทึกเมนู navbar ของเว็บลูกค้า',
    description:
      'หน้า /home-content · ส่งครบทุกเมนู (home · search · community · ranking · bookings · about) พร้อมชื่อที่แสดง (1–20 ตัวอักษร) ' +
      'และลำดับ/ซ่อน-แสดง แยก desktop (navbar) กับ mobile (แถบเมนูล่าง) · ลำดับแต่ละชุด 0..n-1 ไม่ซ้ำ · หน้าหลักซ่อนไม่ได้ · ' +
      'ลิงก์และไอคอนตายตัวในโค้ดหน้าเว็บ · ธุรกรรมเดียว · audit log เมื่อมีการเปลี่ยน (rpc admin_save_site_nav)',
    returns: '`updated` จำนวนเมนูที่เปลี่ยน',
    forbidden: ADMIN_FORBIDDEN,
  })
  saveNav(@CurrentUser() me: AuthUser, @Body() b: SaveSiteNavDto) {
    return this.db.rpc<SaveSiteNavResult>('admin_save_site_nav', { p_actor: me.id, p_items: b.items });
  }
}
