import { Body, Controller, Delete, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard, SuperAdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateTeamMemberDto, SaveTeamPageDto, UpdateTeamMemberDto } from './site-team.dto';

const SUPER_ONLY = 'ไม่ใช่ SUPER_ADMIN (`SUPER_ADMIN_REQUIRED`)';

/**
 * site-team · Backoffice — จัดการทีมงานหน้า /about (rpc admin_save_team_member, admin_delete_team_member, admin_save_team_page · audit log)
 * เพิ่ม / ลบ / สลับลำดับ = SUPER_ADMIN · แก้ / ซ่อน = SUPER_ADMIN ทุกแถว หรือ ADMIN เฉพาะแถวที่ contacts.email ตรงกับอีเมลตัวเอง (DB ตรวจ)
 */
@ApiTags('site-team')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin/team-members')
export class SiteTeamAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  @ApiDoc({
    summary: 'เพิ่มทีมงาน',
    description:
      'เฉพาะ SUPER_ADMIN · เพิ่มคนในหน้าเกี่ยวกับเรา (ต่อท้ายลำดับ) · รูปอัปโหลดเข้า bucket team-photos ก่อนด้วย POST /storage/upload-url แล้วส่ง URL มา · บันทึก audit log',
    returns: '`id` · `nickname` · `active` · `sort_order`',
    status: 201,
    forbidden: SUPER_ONLY,
  })
  create(@CurrentUser() me: AuthUser, @Body() b: CreateTeamMemberDto) {
    return this.db.rpc('admin_save_team_member', { p_actor: me.id, p_id: null, p: b });
  }

  @Patch()
  @ApiDoc({
    summary: 'บันทึกหน้าจัดการทีมงาน (ลำดับ + แสดงบนเว็บ)',
    description:
      'หน้า /team แก้ในหน้าแล้วบันทึกครั้งเดียว · `order` = id ทีมงานทั้งหมดเรียงบน→ล่าง → sort_order 10, 20, 30, … (เฉพาะ SUPER_ADMIN · ไม่ส่ง = ไม่เปลี่ยนลำดับ) · `active` = เฉพาะแถวที่เปลี่ยน (SUPER_ADMIN ทุกแถว · ADMIN เฉพาะแถวที่ `contacts.email` ตรงกับอีเมลตัวเอง) · ธุรกรรมเดียว (แถวไหนไม่มีสิทธิ์ = ไม่บันทึกเลย) · audit log ต่อแถว + ลำดับ (rpc admin_save_team_page → admin_save_team_member + admin_reorder_team_members)',
    returns: '`reordered` จำนวนแถวที่เปลี่ยนลำดับ · `active_updated` จำนวนแถวที่เปลี่ยนการแสดง',
    forbidden: 'ไม่ใช่แอดมิน · `SUPER_ADMIN_REQUIRED` ADMIN ส่ง `order` · `TEAM_MEMBER_NOT_OWN` แถวของคนอื่น',
  })
  savePage(@CurrentUser() me: AuthUser, @Body() b: SaveTeamPageDto) {
    return this.db.rpc('admin_save_team_page', { p_actor: me.id, p_ids: b.order ?? null, p_active: b.active ?? null });
  }

  @Patch(':id')
  @ApiDoc({
    summary: 'แก้ข้อมูลทีมงาน',
    description:
      'ส่งเฉพาะ field ที่ต้องการแก้ เช่น `{ "active": false }` = ซ่อนจากหน้าเว็บ · SUPER_ADMIN แก้ได้ทุกแถว · ADMIN แก้ได้เฉพาะแถวที่ `contacts.email` ตรงกับอีเมลบัญชีตัวเอง และเปลี่ยนอีเมลนั้นไม่ได้ · บันทึก audit log (ก่อน/หลัง)',
    returns: '`id` · `nickname` · `active` · `sort_order`',
    forbidden: 'ไม่ใช่แอดมิน · `TEAM_MEMBER_NOT_OWN` แถวของคนอื่น · `TEAM_MEMBER_EMAIL_LOCKED` ADMIN เปลี่ยน/ลบอีเมลของแถว',
  })
  update(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: UpdateTeamMemberDto) {
    return this.db.rpc('admin_save_team_member', { p_actor: me.id, p_id: id, p: b });
  }

  @Delete(':id')
  @UseGuards(SuperAdminGuard)
  @ApiDoc({
    summary: 'ลบทีมงาน',
    description: 'เฉพาะ SUPER_ADMIN · ลบถาวร (ถ้าแค่ไม่อยากให้แสดง ใช้ PATCH active=false) · บันทึก audit log',
    returns: '`id` · `deleted` = true',
    forbidden: SUPER_ONLY,
  })
  remove(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.db.rpc('admin_delete_team_member', { p_actor: me.id, p_id: id });
  }
}
