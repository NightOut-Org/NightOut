import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { canCreateRole } from '@nightout/contracts';
import type { UserRole } from '@nightout/types';
import { AdminGuard, SuperAdminGuard } from '../../auth/admin.guard';
import { bearerOf } from '../../auth/bearer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthedRequest, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { AccountUsersService } from './account-users.service';
import { BanUserDto, CreateUserDto, SetUsersRoleDto, UnbanUserDto, UpdateUserAccountDto } from './account.dto';

/** account · Backoffice — ผู้ใช้ ชั้นบัญชี (ADR 0005) · แบน/ปลดแบนพร้อมเหตุผล (แบนเอง + แบนอัตโนมัติจากสลิปปลอม) · audit log ในธุรกรรมเดียว */
@ApiTags('account')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class AccountAdminController {
  constructor(
    private readonly db: SupabaseService,
    private readonly users: AccountUsersService,
  ) {}

  @Get('roles')
  @ApiDoc({
    summary: 'รายการชั้นบัญชี',
    description:
      'ห้าชั้นจากตาราง roles เรียงตาม sort_order พร้อมสิทธิ์ของผู้เรียก — แอดมินสร้างบัญชีได้แค่ลูกค้า / ร้านค้า / พนักงาน · แก้ชั้นของบัญชีที่มีอยู่ได้เฉพาะ SUPER_ADMIN',
    returns:
      'รายการ `code` · `label_th` · `sort_order` · `can_enter_backoffice` · `can_create` ผู้เรียกเลือกชั้นนี้ตอนสร้างบัญชีได้ · `can_assign` ผู้เรียกแก้บัญชีอื่นเป็นชั้นนี้ได้',
    forbidden: ADMIN_FORBIDDEN,
    validates: false,
  })
  async roles(@Req() req: AuthedRequest) {
    const rows = await this.db.selectAs<{ code: UserRole; label_th: string; sort_order: number; can_enter_backoffice: boolean }[]>(
      bearerOf(req),
      'roles?select=code,label_th,sort_order,can_enter_backoffice&order=sort_order',
    );
    const actor = req.user?.role;
    return rows.map((r) => ({ ...r, can_create: canCreateRole(actor, r.code), can_assign: actor === 'SUPER_ADMIN' }));
  }

  @Post('users')
  @ApiDoc({
    summary: 'เพิ่มผู้ใช้',
    description:
      'สร้างบัญชีที่ยืนยันอีเมลแล้ว ใช้เข้าสู่ระบบได้ทันที · เลือกประเภทบัญชี: ลูกค้า / เจ้าของร้าน / ผู้จัดการร้าน / พนักงานร้าน (3 แบบนี้ต้องเลือกร้าน) / แอดมิน / ซูเปอร์แอดมิน (2 แบบหลังเฉพาะ SUPER_ADMIN) · ไม่ใส่รหัสผ่าน = ระบบสุ่มให้ · Supabase Auth admin → rpc admin_finish_new_user (พลาด = ลบบัญชีทิ้ง) · บันทึก audit log',
    returns: '`id` · `email` · `display_name` · `role` · `bar_id` · `bar_role` · `password` (เฉพาะเมื่อระบบสุ่มให้ — แสดงครั้งเดียว ไม่ถูกเก็บ)',
    status: 201,
    forbidden: 'ไม่ใช่ ADMIN · `SUPER_ADMIN_REQUIRED` เมื่อสร้างแอดมิน / ซูเปอร์แอดมิน โดยไม่ใช่ SUPER_ADMIN',
  })
  createUser(@CurrentUser() me: AuthUser, @Body() b: CreateUserDto) {
    return this.users.create(me.id, me.role, b);
  }

  // ต้องอยู่ก่อน PATCH users/:id — ไม่งั้น "roles" ถูกจับเป็น :id
  @Patch('users/roles')
  @UseGuards(SuperAdminGuard)
  @ApiDoc({
    summary: 'แก้ชั้นบัญชีหลายคน (บันทึกหน้าผู้ใช้)',
    description:
      'หน้า /users แก้ชั้นบัญชีในหน้าแล้วบันทึกครั้งเดียว · เฉพาะ SUPER_ADMIN ใช้แก้บัญชีที่สร้างผิด · `changes` = เฉพาะคนที่เปลี่ยน ตั้งเป็น CUSTOMER / MERCHANT / STAFF / ADMIN / SUPER_ADMIN · ' +
      'ชั้นใหม่เป็น CUSTOMER / ADMIN / SUPER_ADMIN → หลุดจากทุกร้าน (เลิกเป็นเจ้าของ + ถอนจากทีม) · ' +
      'ห้ามเหลือ SUPER_ADMIN เป็นศูนย์ (`LAST_SUPER_ADMIN`) · ธุรกรรมเดียว (คนไหนพลาด = ไม่บันทึกเลย) · audit log ต่อคน (rpc admin_set_users_role → admin_set_user_role)',
    returns: '`updated` จำนวนคนที่บันทึก · `bars_detached` จำนวนร้านที่หลุดรวม',
    forbidden: 'ไม่ใช่ SUPER_ADMIN (`SUPER_ADMIN_REQUIRED`)',
  })
  setUsersRole(@CurrentUser() me: AuthUser, @Body() b: SetUsersRoleDto) {
    return this.db.rpc('admin_set_users_role', { p_actor: me.id, p_changes: b.changes });
  }

  @Patch('users/:id')
  @ApiDoc({
    summary: 'แก้ข้อมูลบัญชี',
    description: 'SUPER_ADMIN แก้ได้ทุกบัญชี · ADMIN แก้ได้เฉพาะบัญชีตัวเอง · เปลี่ยนอีเมล/รหัสผ่านใน Supabase Auth และชื่อ/เบอร์ใน public.users (rpc admin_update_user_account)',
    returns: '`id` · `email` · `display_name` · `phone_e164`',
    forbidden: 'ADMIN แก้ได้เฉพาะบัญชีตัวเอง (`SELF_ONLY`)',
  })
  updateUser(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: UpdateUserAccountDto) {
    return this.users.update(me.id, me.role, id, b);
  }

  @Delete('users/:id')
  @UseGuards(SuperAdminGuard)
  @HttpCode(200)
  @ApiDoc({
    summary: 'ลบบัญชีผู้ใช้',
    description: 'เฉพาะ SUPER_ADMIN ปิดบัญชีและระงับการเข้าสู่ระบบ โดยไม่ลบข้อมูลอ้างอิงการจอง (rpc admin_delete_user + ban ใน Auth)',
    returns: '`id` · `deleted` = true',
    forbidden: 'ไม่ใช่ SUPER_ADMIN',
  })
  async deleteUser(@CurrentUser() me: AuthUser, @Id() id: string) {
    const result = await this.db.rpc<{ id: string; deleted: boolean }>('admin_delete_user', { p_actor: me.id, p_user: id });
    await this.db.banUser(id);
    return result;
  }

  @Post('users/:id/ban')
  @HttpCode(200)
  @ApiDoc({
    summary: 'แบนบัญชี',
    description:
      'แบนลูกค้าหรือบัญชีทีมร้านเอง (ต้องมีเหตุผล 3–300 ตัวอักษร — เจ้าของบัญชีเห็นในแจ้งเตือน) · ถูกแบน = จองโต๊ะไม่ได้ + ชุมชนอ่านได้อย่างเดียว · ' +
      'การจองเดิมและร้านไม่ถูกแตะ (ระงับร้านที่ PATCH /admin/bars/status) · `ban_phones` = แบนทุกเบอร์ที่บัญชีนี้เคยใช้ · ' +
      'แบนตัวเอง/บัญชีทีมงานไม่ได้ · audit log + แจ้งเจ้าของบัญชี (rpc admin_ban_user)',
    returns: '`id` · `banned` = true · `banned_at` · `phones_banned` จำนวนเบอร์ที่แบนเพิ่ม',
    forbidden: ADMIN_FORBIDDEN + ' · `CANNOT_BAN_SELF` / `CANNOT_BAN_ADMIN`',
  })
  ban(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: BanUserDto) {
    return this.db.rpc('admin_ban_user', { p_actor: me.id, p_user: id, p_reason: b.reason, p_ban_phones: b.ban_phones ?? false });
  }

  @Post('users/:id/unban')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ปลดแบนผู้ใช้',
    description:
      'ปลดแบนทั้งที่แบนเองและแบนอัตโนมัติจากสลิปปลอม · ต้องมีเหตุผล 3–300 ตัวอักษร (บันทึกใน audit log) · ' +
      'ปลดเบอร์โทรที่โดนแบนเพราะบัญชีนี้ + ล้างธงสลิปปลอมที่นับอยู่ · แจ้งเจ้าของบัญชี (rpc admin_unban_user · audit log)',
    returns: '`id` · `banned` = false · `phones_unbanned` จำนวนเบอร์ที่ปลด · `flags_cleared` จำนวนธงที่ล้าง',
    forbidden: ADMIN_FORBIDDEN,
  })
  unban(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: UnbanUserDto) {
    return this.db.rpc('admin_unban_user', { p_actor: me.id, p_user: id, p_reason: b.reason });
  }
}
