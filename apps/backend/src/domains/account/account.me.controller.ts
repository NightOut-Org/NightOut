import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { RoleInfo } from '@nightout/contracts';
import { bearerOf } from '../../auth/bearer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthedRequest, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { AccountAvatarService } from './account-avatar.service';
import { AccountOAuthService } from './account-oauth.service';
import { MarkReadDto, OAuthSignupCompleteDto, OAuthSignupVerifyDto, SetAvatarDto, UpdateProfileDto } from './account.dto';

const inList = (ids: string[]) => `in.(${ids.map(encodeURIComponent).join(',')})`;

/**
 * account · ฉัน — โปรไฟล์ ความชอบ ข้อมูลรวมหลังล็อกอิน แจ้งเตือน ร้านโปรด ลบบัญชี
 * อ่านด้วย token ของผู้ใช้ (RLS) · เขียนผ่าน rpc app_update_profile, app_mark_notifications_read, app_toggle_favorite, app_delete_account, app_complete_oauth_signup, app_set_avatar, app_remove_avatar
 */
@ApiTags('account')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller('me')
export class AccountMeController {
  constructor(
    private readonly db: SupabaseService,
    private readonly oauth: AccountOAuthService,
    private readonly avatar: AccountAvatarService,
  ) {}

  @Get('profile')
  @ApiDoc({
    summary: 'โปรไฟล์ของฉัน',
    description: 'แถวของผู้ใช้ใน public.users — ชั้นบัญชีอ่านจาก DB (ไม่ใช่ user_metadata) พร้อมชื่อไทยจากตาราง roles · เปลี่ยนชั้นตัวเองไม่ได้',
    returns:
      '`id` · `display_name` · `role` รหัสชั้นบัญชี · `role_label` ชื่อไทยของชั้น · `can_enter_backoffice` เข้าหลังบ้านได้ไหม (ยังต้องผ่าน MFA) · `phone_e164` เบอร์ล่าสุดที่ใช้จอง (หน้า Checkout เติมให้) · `banned_at` ถูกระงับเมื่อ (null = ปกติ · ถูกแบน = จองไม่ได้ + ชุมชนอ่านได้อย่างเดียว) · `ban_reason` เหตุผลที่ถูกระงับ · `avatar_url` URL รูปโปรไฟล์ (null = ใช้ตัวย่อชื่อ)',
    validates: false,
  })
  async profile(@Req() req: AuthedRequest, @CurrentUser() me: AuthUser) {
    const rows = await this.db.selectAs<
      {
        id: string;
        display_name: string;
        role: string;
        phone_e164: string | null;
        banned_at: string | null;
        ban_reason: string | null;
        avatar_url: string | null;
        roles: { label_th: string; can_enter_backoffice: boolean } | null;
      }[]
    >(bearerOf(req), `users?select=id,display_name,role,phone_e164,banned_at,ban_reason,avatar_url,roles(label_th,can_enter_backoffice)&id=eq.${me.id}`);
    if (!rows[0]) throw new NotFoundException('USER_NOT_FOUND');
    const { roles, ...u } = rows[0];
    return { ...u, role_label: roles?.label_th ?? u.role, can_enter_backoffice: roles?.can_enter_backoffice ?? false };
  }

  @Get('roles')
  @ApiDoc({
    summary: 'ชั้นบัญชีทั้งหมดพร้อมสี',
    description:
      'ทุกชั้นจากตาราง roles เรียงต่ำ → สูง (sort_order) — หน้าเว็บใช้ชื่อและสีของชั้นในป้าย วงรอบรูป พื้นหลังหน้า /profile รายการชั้นบัญชี และปุ่ม/เมนูบัญชีบน navbar · Super Admin แก้สีที่ Backoffice /settings',
    returns: 'รายการ `code` รหัสชั้น · `label_th` ชื่อไทย · `color` สีหลักของชั้น #RRGGBB · `sort_order`',
    validates: false,
  })
  roles(@Req() req: AuthedRequest) {
    return this.db.selectAs<RoleInfo[]>(bearerOf(req), 'roles?select=code,label_th,color,sort_order&order=sort_order');
  }

  @Patch('profile')
  @ApiDoc({
    summary: 'แก้โปรไฟล์และความชอบ',
    description: 'แก้ชื่อที่แสดง สไตล์ร้าน/ย่านที่ชอบ งบต่อคน จำนวนคนที่ไปบ่อย ธีม และสถานะ onboarding · ส่งเฉพาะ field ที่ต้องการแก้ (rpc app_update_profile)',
    returns: '`id` รหัสผู้ใช้',
  })
  updateProfile(@CurrentUser() me: AuthUser, @Body() b: UpdateProfileDto) {
    return this.db.rpc('app_update_profile', { p_actor: me.id, p: b });
  }

  @Put('avatar')
  @ApiDoc({
    summary: 'ตั้งรูปโปรไฟล์',
    description:
      'หน้าเว็บอัปโหลดไฟล์เข้า bucket `avatars` ที่ `<user_id>/<ไฟล์>` (POST /storage/upload-url) แล้วส่ง path มาที่นี่ · DB ตรวจว่า path อยู่ในโฟลเดอร์ของผู้เรียกและมีไฟล์จริง · รูปเดิมถูกลบจาก Storage (rpc app_set_avatar)',
    returns: '`avatar_url` URL ถาวรของรูปใหม่',
  })
  setAvatar(@CurrentUser() me: AuthUser, @Body() b: SetAvatarDto) {
    return this.avatar.set(me.id, b.path);
  }

  @Delete('avatar')
  @ApiDoc({
    summary: 'ลบรูปโปรไฟล์',
    description: 'กลับไปใช้ตัวย่อชื่อ · ไฟล์ถูกลบจาก Storage (rpc app_remove_avatar) · ไม่มีรูปอยู่แล้วก็ตอบสำเร็จ',
    returns: '`avatar_url` = null',
    validates: false,
  })
  removeAvatar(@CurrentUser() me: AuthUser) {
    return this.avatar.remove(me.id);
  }

  @Get('overview')
  @ApiDoc({
    summary: 'ข้อมูลทั้งหมดของฉัน',
    description:
      'การจอง · แจ้งเตือน 100 รายการล่าสุด · ร้านโปรด · รีวิวของฉัน · ความชอบ · ร้านที่ฉันอยู่ในทีม (ทุกสถานะ) + การจองของร้าน + ประวัติโปรโมท · รีวิวที่ฉันรายงาน — หน้าเว็บโหลดหลังล็อกอินและทุก 60 วิ (view booking_detail, my_favorites, my_reviews, my_bar_detail)',
    returns:
      '`bookings` · `notifications` · `favorites` · `reviews` · `preferences` (หรือ null) · `bars` · `team_bookings` · `listings` · `review_reports` (แถวจาก view ของ DB)',
    validates: false,
  })
  async overview(@Req() req: AuthedRequest, @CurrentUser() me: AuthUser) {
    const t = bearerOf(req);
    const [bookings, notifications, favorites, reviews, prefs, bars, reviewReports] = await Promise.all([
      this.db.selectAs<unknown[]>(t, `booking_detail?select=*&user_id=eq.${me.id}&order=booking_datetime.desc`),
      this.db.selectAs<unknown[]>(t, `notifications?select=id,user_id,title,body,payload,read_at,created_at&user_id=eq.${me.id}&order=created_at.desc&limit=100`),
      this.db.selectAs<unknown[]>(t, 'my_favorites?select=id'),
      this.db.selectAs<unknown[]>(t, 'my_reviews?select=*&order=created_at.desc'),
      this.db.selectAs<unknown[]>(t, `user_preferences?select=*&user_id=eq.${me.id}&limit=1`),
      this.db.selectAs<{ id: string }[]>(t, 'my_bar_detail?select=*&order=created_at'),
      this.db.selectAs<unknown[]>(t, `review_reports?select=review_id&reporter_id=eq.${me.id}`),
    ]);
    const barIds = bars.map((b) => b.id);
    const [teamBookings, listings] = barIds.length
      ? await Promise.all([
          this.db.selectAs<unknown[]>(t, `booking_detail?select=*&bar->>id=${inList(barIds)}&order=booking_datetime.desc&limit=1000`),
          this.db.selectAs<unknown[]>(
            t,
            `promoted_listings?select=id,bar_id,placement,price_paid,status,created_at,promotion_packages(name,duration_days)&bar_id=${inList(barIds)}&order=created_at.desc`,
          ),
        ])
      : [[], []];
    return { bookings, notifications, favorites, reviews, preferences: prefs[0] ?? null, bars, team_bookings: teamBookings, listings, review_reports: reviewReports };
  }

  @Post('favorites/:barId/toggle')
  @HttpCode(200)
  @ApiDoc({
    summary: 'บันทึก/เอาออกร้านโปรด',
    description: 'กดครั้งแรกบันทึกเป็นร้านโปรด กดอีกครั้งเอาออก (rpc app_toggle_favorite)',
    returns: '`bar_id` · `favorite` สถานะหลังกด (true = เป็นร้านโปรด)',
  })
  toggleFavorite(@CurrentUser() me: AuthUser, @Id('barId') barId: string) {
    return this.db.rpc('app_toggle_favorite', { p_actor: me.id, p_bar: barId });
  }

  @Post('notifications/read')
  @HttpCode(200)
  @ApiDoc({
    summary: 'อ่านแจ้งเตือนแล้ว',
    description: 'ทำเครื่องหมายแจ้งเตือนว่าอ่านแล้ว · ส่ง `ids` = เฉพาะรายการนั้น · ไม่ส่ง = อ่านทั้งหมด (rpc app_mark_notifications_read)',
    returns: '`updated` จำนวนแจ้งเตือนที่อัปเดต',
  })
  markRead(@CurrentUser() me: AuthUser, @Body() b: MarkReadDto) {
    return this.db.rpc('app_mark_notifications_read', { p_actor: me.id, p_ids: b.ids ?? null });
  }

  /** ลบบัญชี: ปิดบัญชีใน DB + ระงับการเข้าสู่ระบบ (ข้อมูลส่วนตัวถูกล้างตามรอบ retention) */
  @Post('delete')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ลบบัญชี',
    description: 'ปิดบัญชีใน DB และระงับการเข้าสู่ระบบทันที · ต้องไม่มีการจองที่ยังไม่จบ · ซูเปอร์แอดมินคนสุดท้ายลบไม่ได้ · ข้อมูลส่วนตัวถูกล้างตามรอบ retention (rpc app_delete_account + ban ใน Auth)',
    returns: '`id` รหัสผู้ใช้ · `deleted` = true',
  })
  async deleteAccount(@CurrentUser() me: AuthUser) {
    const r = await this.db.rpc('app_delete_account', { p_actor: me.id });
    await this.db.banUser(me.id);
    return r;
  }

  // ---- สมัครด้วย Google / Facebook (ล็อกอินครั้งแรกยังไม่มี public.users — /me/profile = USER_NOT_FOUND) ----

  @Post('oauth-signup/verify')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ยืนยันอายุจากบัญชี Google / Facebook',
    description:
      'หน้าเว็บเรียกหลังล็อกอิน Google/Facebook ครั้งแรก (ยังไม่มีบัญชี) พร้อม `provider_token` จาก session · backend ดึงวันเกิดจาก Google People API / Facebook Graph เอง (ผู้ใช้แก้ไม่ได้) และตรวจว่า token เป็นของบัญชีที่ล็อกอิน · ' +
      'วันเกิดครบ วัน/เดือน/ปี และอายุ ≥ 20 → พักวันเกิดไว้ใน app_metadata ของ Auth (30 นาที) รอยอมรับเงื่อนไข · ไม่มีวันเกิด/ไม่มีปีเกิด (`OAUTH_BIRTHDATE_MISSING`) หรืออายุ < 20 (`OAUTH_AGE_UNDER_20`) หรือไม่มีอีเมล (`OAUTH_EMAIL_MISSING`) → **ลบบัญชี Auth (ไม่สร้างบัญชี)** ตอบ 403 · ' +
      'ไม่ส่ง token และยังไม่เคยยืนยัน/หมดเวลา = `OAUTH_RELOGIN_REQUIRED` · มีบัญชีแล้ว = `REGISTERED`',
    returns:
      '`status` REGISTERED (มีบัญชีแล้ว) / NEEDS_CONSENT (อายุผ่าน รอยอมรับเงื่อนไข) · `provider` google/facebook · `email` · `display_name` ชื่อจากบัญชีผู้ให้บริการ · `terms_version` · `privacy_version`',
    forbidden: 'ยืนยันอายุไม่ผ่าน (บัญชี Auth ถูกลบแล้ว) หรือ token ไม่ใช่ของบัญชีที่ล็อกอิน',
  })
  verifyOAuthSignup(@CurrentUser() me: AuthUser, @Body() b: OAuthSignupVerifyDto) {
    return this.oauth.verify(me.id, b.provider_token);
  }

  @Post('oauth-signup/complete')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ยอมรับเงื่อนไขแล้วสร้างบัญชี (Google / Facebook)',
    description:
      'ผู้ใช้ติ๊กยอมรับเงื่อนไขการใช้งาน + นโยบายความเป็นส่วนตัว (PDPA) หลังยืนยันอายุผ่าน → สร้างบัญชี CUSTOMER ด้วยวันเกิดที่ backend ดึงไว้ · วิธียืนยันอายุ = GOOGLE / FACEBOOK · บันทึก consent ใน user_consents (rpc app_complete_oauth_signup) · ยังไม่ยืนยันอายุ/หมดเวลา = `OAUTH_RELOGIN_REQUIRED` · เรียกซ้ำ = คืนบัญชีเดิม',
    returns: '`id` รหัสผู้ใช้ · `created` false = มีบัญชีอยู่แล้ว',
  })
  completeOAuthSignup(@CurrentUser() me: AuthUser, @Body() b: OAuthSignupCompleteDto) {
    return this.oauth.complete(me.id, b);
  }

  @Delete('oauth-signup')
  @ApiDoc({
    summary: 'ไม่ยอมรับเงื่อนไข — ยกเลิกการสมัครด้วย Google / Facebook',
    description: 'ลบบัญชี Auth ที่ Supabase สร้างไว้ตอนล็อกอินแต่ยังไม่ได้สร้างโปรไฟล์ (หน้าเว็บออกจากระบบต่อ) · บัญชีที่สร้างแล้วไม่ถูกแตะ',
    returns: '`deleted` true = ลบแล้ว · false = มีบัญชีอยู่แล้ว (ไม่ลบ)',
    validates: false,
  })
  cancelOAuthSignup(@CurrentUser() me: AuthUser) {
    return this.oauth.cancel(me.id);
  }
}
