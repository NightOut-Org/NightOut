import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CommunityDraftKind,
  type AddCommunityCommentResult,
  type CommunityDraft,
  type CommunityFeedResult,
  type CommunityLikeResult,
  type CommunityPinResult,
  type CommunitySaveResult,
  type CommunityTeamBar,
  type CreateCommunityThreadResult,
  type UpdateCommunityCommentResult,
} from '@nightout/contracts';
import type { Request } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import { bearerOf } from '../../auth/bearer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CommunityCommentDto,
  CommunityReportDto,
  CommunityThreadDto,
  CommunityToggleDto,
  DeleteCommunityDraftQueryDto,
  feedArgs,
  MyCommunityFeedQueryDto,
  SaveCommunityDraftDto,
  UpdateCommunityCommentDto,
} from './community.dto';
import { CommunityService } from './community.service';

/**
 * community · ลูกค้า (ล็อกอินแล้ว) — ตั้ง/แก้/ลบกระทู้ · ความเห็น · ถูกใจ · บันทึก · ปักหมุดส่วนตัว · ฉบับร่าง · รายงาน
 * rpc app_community_* · อ่าน: community_feed (scope) · my_community_drafts · my_community_team (สิทธิ์ทีมร้าน)
 */
@ApiTags('community')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller()
export class CommunityMeController {
  constructor(
    private readonly db: SupabaseService,
    private readonly community: CommunityService,
  ) {}

  // ---- อ่านของฉัน ----
  @Get('me/community/threads')
  @ApiDoc({
    summary: 'กระทู้ของฉัน / ที่บันทึกไว้ / ที่ปักหมุด',
    description: '`scope` = mine (รวมกระทู้ที่ถูกซ่อน) | saved | pinned · ตัวกรองอื่นเหมือน GET /public/community/threads (rpc community_feed)',
    returns: '`items` (แถวเดียวกับฟีด) · `has_more`',
  })
  mine(@Req() req: Request, @Query() q: MyCommunityFeedQueryDto) {
    return this.db.rpcAs<CommunityFeedResult>(bearerOf(req), 'community_feed', feedArgs(q, q.scope));
  }

  @Get('me/community/drafts')
  @ApiDoc({
    summary: 'ฉบับร่างของฉัน',
    description: 'ร่างที่ยังไม่หมดอายุ (แก้ล่าสุดไม่เกิน 7 วัน) ทุกช่อง — NEW 1 ร่าง · REPLY / EDIT / EDIT_COMMENT 1 ร่างต่อกระทู้ (rpc my_community_drafts)',
    returns: 'รายการ `id` · `kind` · `thread_id` · `payload` {category, title, body, bar_id, parent_id, comment_id, media} · `updated_at` (ใหม่สุดก่อน)',
    validates: false,
  })
  drafts(@Req() req: Request) {
    return this.db.rpcAs<CommunityDraft[]>(bearerOf(req), 'my_community_drafts', {});
  }

  @Get('me/community/team')
  @ApiDoc({
    summary: 'ร้านที่ฉันอยู่ในทีม (สิทธิ์ชุมชน)',
    description:
      'ทีมร้าน = รับคำเชิญแล้วและยังไม่ถูกถอด ของร้านที่แสดงอยู่หรือถูกระงับ (ทุกบทบาท) · ทีมร้านตั้งกระทู้ได้เฉพาะหมวด "ข่าวจากร้าน" ต้องแท็กร้านตัวเองที่แสดงอยู่ ไม่เกิน 3 กระทู้ต่อร้านใน 7 วันล่าสุด (นับรวมทั้งทีม รวมกระทู้ที่ลบ/ถูกซ่อน) · ร้านถูกระงับ = มีป้ายแต่ตั้งข่าวไม่ได้ · รายการว่าง = ไม่ใช่ทีมร้าน (rpc my_community_team)',
    returns:
      'รายการ `bar_id` · `slug` · `name` · `role` · `can_post` (ร้านแสดงอยู่ = ตั้งข่าวได้) · `shop_news_used` · `shop_news_limit` · `next_slot_at` (โพสต์ข่าวได้อีกเมื่อไร · null = ยังเหลือโควตา) — ร้านที่แสดงอยู่ก่อน',
    validates: false,
  })
  team(@Req() req: Request) {
    return this.db.rpcAs<CommunityTeamBar[]>(bearerOf(req), 'my_community_team', {});
  }

  @Put('me/community/drafts')
  @ApiDoc({
    summary: 'บันทึกร่าง',
    description:
      'แทนที่ร่างเดิมของช่องเดียวกัน (kind + thread_id) · หน้าเว็บบันทึกอัตโนมัติเมื่อหยุดพิมพ์ · `payload.media` = ไฟล์ที่อัปโหลดเข้า community-media แล้ว (DB ตรวจว่ามีจริง) · ไฟล์ที่เอาออกจากร่าง/ร่างเกิน 7 วัน ถูกลบจาก Storage · ร่าง EDIT ได้เฉพาะเจ้าของกระทู้ · ร่าง EDIT_COMMENT ต้องมี payload.comment_id = ความเห็นของฉันในกระทู้นั้น (rpc app_community_save_draft)',
    returns: '`id` · `kind` · `thread_id` · `payload` · `updated_at`',
  })
  saveDraft(@CurrentUser() me: AuthUser, @Body() b: SaveCommunityDraftDto) {
    return this.community.write<CommunityDraft>('app_community_save_draft', {
      p_actor: me.id,
      p_kind: b.kind,
      p_thread: b.thread_id ?? null,
      p_payload: b.payload,
    });
  }

  @Delete('me/community/drafts/:kind')
  @ApiDoc({
    summary: 'ทิ้งร่าง',
    description: '`kind` = NEW | REPLY | EDIT | EDIT_COMMENT · ที่ไม่ใช่ NEW ระบุ `thread_id` ใน query · ไฟล์แนบของร่างถูกลบจาก Storage (rpc app_community_delete_draft)',
    returns: '`kind` · `thread_id` · `deleted` (มีร่างให้ลบไหม)',
  })
  deleteDraft(
    @CurrentUser() me: AuthUser,
    @Param('kind', new ZodValidationPipe(CommunityDraftKind)) kind: CommunityDraftKind,
    @Query() q: DeleteCommunityDraftQueryDto,
  ) {
    return this.community.write<object>('app_community_delete_draft', { p_actor: me.id, p_kind: kind, p_thread: q.thread_id ?? null });
  }

  // ---- กระทู้ ----
  @Post('community/threads')
  @ApiDoc({
    summary: 'ตั้งกระทู้',
    description:
      'หมวด staff_only (ประกาศ) ตั้งได้เฉพาะทีม NightOut · หมวด "ข่าวจากร้าน" (shop-news · team_only) ตั้งได้เฉพาะทีมร้าน ต้องแท็กร้านตัวเองที่แสดงอยู่ (APPROVED) ร้านละไม่เกิน 3 กระทู้ใน 7 วันล่าสุด (นับรวมทั้งทีม · ทุกสถานะ) เกิน = 409 COMMUNITY_SHOP_NEWS_LIMIT · บัญชีทีมร้าน (รวมทีมของร้านที่ถูกระงับ) ตั้งกระทู้หมวดอื่นไม่ได้ · โพสต์ตอนอยู่ทีมร้านได้ป้าย `author.team` · แท็กร้านได้ 1 ร้าน (ร้านที่แสดงอยู่) · `media` ≤ 6 ไฟล์ (อัปโหลดเข้า community-media/<user_id>/ ก่อน · วิดีโอ ≤ 60 วิ) · สำเร็จแล้วร่าง NEW ถูกลบ (rpc app_community_create_thread)',
    returns: '`id` รหัสกระทู้ใหม่',
    status: 201,
    forbidden:
      'หมวดประกาศ = ทีม NightOut (COMMUNITY_CATEGORY_STAFF_ONLY) · ข่าวจากร้าน = ทีมร้านแท็กร้านตัวเอง (COMMUNITY_CATEGORY_TEAM_ONLY / COMMUNITY_SHOP_NEWS_OWN_BAR) · ทีมร้านตั้งหมวดอื่นไม่ได้ (COMMUNITY_TEAM_CATEGORY) · บัญชีถูกระงับ (COMMUNITY_BANNED)',
  })
  create(@CurrentUser() me: AuthUser, @Body() b: CommunityThreadDto) {
    return this.community.write<CreateCommunityThreadResult>('app_community_create_thread', {
      p_actor: me.id,
      p_category: b.category,
      p_title: b.title,
      p_body: b.body ?? '',
      p_bar: b.bar_id ?? null,
      p_media: b.media ?? [],
    });
  }

  @Patch('community/threads/:id')
  @ApiDoc({
    summary: 'แก้กระทู้',
    description:
      'เฉพาะเจ้าของกระทู้ · ส่งครบทุกช่อง (`media` = ไฟล์ทั้งชุด · ไฟล์ที่เอาออกถูกลบจาก Storage) · บันทึก edited_at · ร่าง EDIT ของกระทู้นี้ถูกลบ · ข่าวจากร้านเปลี่ยนหมวด/ร้านที่แท็กไม่ได้ และย้ายกระทู้อื่นมาเป็นข่าวจากร้านไม่ได้ (400 COMMUNITY_SHOP_NEWS_LOCKED · แก้ไม่กินโควตา) · ทีมร้านแท็กร้านตัวเองเพิ่มในกระทู้นอกหมวดข่าวไม่ได้ (403 COMMUNITY_TEAM_OWN_TAG) · ร้านที่แท็กเปลี่ยน = นับยอดถูกใจใหม่ (rpc app_community_update_thread)',
    returns: '`id`',
    forbidden:
      'ไม่ใช่เจ้าของกระทู้ (NOT_THREAD_OWNER) · ข่าวจากร้านแก้ได้เฉพาะทีมของร้านที่แท็ก (COMMUNITY_CATEGORY_TEAM_ONLY / COMMUNITY_SHOP_NEWS_OWN_BAR) · ทีมร้านย้ายหมวด/แท็กร้านตัวเองนอกหมวดข่าวไม่ได้ (COMMUNITY_TEAM_CATEGORY / COMMUNITY_TEAM_OWN_TAG)',
  })
  update(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CommunityThreadDto) {
    return this.community.write<CreateCommunityThreadResult>('app_community_update_thread', {
      p_actor: me.id,
      p_thread: id,
      p_category: b.category,
      p_title: b.title,
      p_body: b.body ?? '',
      p_bar: b.bar_id ?? null,
      p_media: b.media ?? [],
    });
  }

  @Delete('community/threads/:id')
  @ApiDoc({
    summary: 'ลบกระทู้ของฉัน',
    description: 'เจ้าของลบได้ (ซ่อนจากทุกคน · หมุดและร่างของกระทู้นี้ถูกลบ) (rpc app_community_delete_thread)',
    returns: '`id` · `status` = DELETED',
    forbidden: 'ไม่ใช่เจ้าของกระทู้ (NOT_THREAD_OWNER)',
  })
  remove(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.community.write<object>('app_community_delete_thread', { p_actor: me.id, p_thread: id });
  }

  @Put('community/threads/:id/like')
  @ApiDoc({
    summary: 'ถูกใจกระทู้',
    description: '`on` = true ถูกใจ / false เลิก (rpc app_community_set_like)',
    returns:
      '`thread_id` · `liked` · `like_count` · `counted` (false = ทีมร้านถูกใจในกระทู้ที่แท็กร้านตัวเอง — ไม่นับใน like_count · เลิกถูกใจแล้วก็ false)',
  })
  like(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CommunityToggleDto) {
    return this.db.rpc<CommunityLikeResult>('app_community_set_like', { p_actor: me.id, p_thread: id, p_on: b.on });
  }

  @Put('community/threads/:id/save')
  @ApiDoc({
    summary: 'บันทึกกระทู้ไว้อ่าน',
    description: '`on` = true บันทึก / false เอาออก · ดูได้ที่ GET /me/community/threads?scope=saved (rpc app_community_set_save)',
    returns: '`thread_id` · `saved`',
  })
  save(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CommunityToggleDto) {
    return this.db.rpc<CommunitySaveResult>('app_community_set_save', { p_actor: me.id, p_thread: id, p_on: b.on });
  }

  @Put('community/threads/:id/pin')
  @ApiDoc({
    summary: 'ปักหมุดกระทู้ (ส่วนตัว)',
    description:
      'ปักแล้วกระทู้ขึ้นบนสุดในฟีดของฉันเท่านั้น (คนอื่นไม่เห็น) · ปักพร้อมกันได้ 3 กระทู้ เกิน = 409 COMMUNITY_PIN_LIMIT · กระทู้ที่ถูกซ่อน/ลบไม่กินโควตา (rpc app_community_set_pin)',
    returns: '`thread_id` · `pinned` · `pin_count` จำนวนหมุดของฉันตอนนี้',
  })
  pin(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CommunityToggleDto) {
    return this.db.rpc<CommunityPinResult>('app_community_set_pin', { p_actor: me.id, p_thread: id, p_on: b.on });
  }

  // ---- ความเห็น ----
  @Post('community/threads/:id/comments')
  @ApiDoc({
    summary: 'แสดงความคิดเห็น / ตอบกลับ',
    description:
      '`parent_id` = ความเห็นที่ตอบ (ตอบกลับซ้อนได้ชั้นเดียว) · `media` ≤ 6 ไฟล์ (มีไฟล์แล้วไม่ต้องพิมพ์ข้อความ) · แจ้งเตือนเจ้าของกระทู้และเจ้าของความเห็นที่ถูกตอบ · ความเห็นจากบัญชีทีมร้านได้ป้าย `author.team` และแจ้งเตือนแสดง "(ทีมร้าน · ชื่อร้าน)" · ร่าง REPLY ของกระทู้นี้ถูกลบ (rpc app_community_add_comment)',
    returns: '`id` · `thread_id` · `parent_id` (ความเห็นหลักที่ผูกจริง)',
    status: 201,
  })
  comment(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CommunityCommentDto) {
    return this.community.write<AddCommunityCommentResult>('app_community_add_comment', {
      p_actor: me.id,
      p_thread: id,
      p_body: b.body ?? '',
      p_parent: b.parent_id ?? null,
      p_media: b.media ?? [],
    });
  }

  @Patch('community/comments/:id')
  @ApiDoc({
    summary: 'แก้ความคิดเห็นของฉัน',
    description:
      'เฉพาะเจ้าของความเห็น · ส่งข้อความ + `media` ทั้งชุด (มีไฟล์แล้วไม่ต้องพิมพ์ข้อความ) · เนื้อหาเปลี่ยนจริงเท่านั้นที่เก็บเวอร์ชันเดิมลงประวัติ + บันทึก edited_at (ไฟล์ของเวอร์ชันเดิมเก็บไว้ให้ประวัติ) · ร่าง EDIT_COMMENT ของความเห็นนี้ถูกลบ (rpc app_community_update_comment)',
    returns: '`id` · `thread_id` · `edited_at`',
    forbidden: 'ไม่ใช่เจ้าของความเห็น (NOT_COMMENT_OWNER) · บัญชีถูกระงับ (COMMUNITY_BANNED)',
  })
  updateComment(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: UpdateCommunityCommentDto) {
    return this.community.write<UpdateCommunityCommentResult>('app_community_update_comment', {
      p_actor: me.id,
      p_comment: id,
      p_body: b.body ?? '',
      p_media: b.media ?? [],
    });
  }

  @Delete('community/comments/:id')
  @ApiDoc({
    summary: 'ลบความคิดเห็นของฉัน',
    description: 'เฉพาะเจ้าของความเห็น · ไฟล์แนบ ประวัติการแก้ไข และร่างแก้ความเห็นนี้ถูกลบ (rpc app_community_delete_comment)',
    returns: '`id` · `thread_id` · `status` = DELETED',
    forbidden: 'ไม่ใช่เจ้าของความเห็น (NOT_COMMENT_OWNER)',
  })
  removeComment(@CurrentUser() me: AuthUser, @Id() id: string) {
    return this.community.write<object>('app_community_delete_comment', { p_actor: me.id, p_comment: id });
  }

  @Put('community/comments/:id/like')
  @ApiDoc({
    summary: 'ถูกใจความคิดเห็น',
    description: '`on` = true / false (rpc app_community_set_comment_like)',
    returns:
      '`comment_id` · `liked` · `like_count` · `counted` (false = ทีมร้านถูกใจความเห็นในกระทู้ที่แท็กร้านตัวเอง — ไม่นับใน like_count · เลิกถูกใจแล้วก็ false)',
  })
  likeComment(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: CommunityToggleDto) {
    return this.db.rpc<CommunityLikeResult>('app_community_set_comment_like', { p_actor: me.id, p_comment: id, p_on: b.on });
  }

  @Post('community/reports')
  @HttpCode(200)
  @ApiDoc({
    summary: 'รายงานกระทู้ / ความคิดเห็น',
    description: 'ระบุ `thread_id` หรือ `comment_id` อย่างใดอย่างหนึ่ง · 1 คนรายงานเรื่องเดิมได้ครั้งเดียว · แจ้งเตือนแอดมิน (rpc app_community_report)',
    returns: '`thread_id` · `comment_id` · `reported` = true',
  })
  report(@CurrentUser() me: AuthUser, @Body() b: CommunityReportDto) {
    return this.db.rpc<unknown>('app_community_report', {
      p_actor: me.id,
      p_thread: b.thread_id ?? null,
      p_comment: b.comment_id ?? null,
      p_reason: b.reason,
      p_detail: b.detail ?? null,
    });
  }
}
