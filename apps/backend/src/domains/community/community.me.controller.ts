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
  type CreateCommunityThreadResult,
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
} from './community.dto';
import { CommunityService } from './community.service';

/**
 * community · ลูกค้า (ล็อกอินแล้ว) — ตั้ง/แก้/ลบกระทู้ · ความเห็น · ถูกใจ · บันทึก · ปักหมุดส่วนตัว · ฉบับร่าง · รายงาน
 * rpc app_community_* · อ่าน: community_feed (scope) · my_community_drafts
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
    description: 'ร่างที่ยังไม่หมดอายุ (แก้ล่าสุดไม่เกิน 7 วัน) ทุกช่อง — NEW 1 ร่าง · REPLY / EDIT 1 ร่างต่อกระทู้ (rpc my_community_drafts)',
    returns: 'รายการ `id` · `kind` · `thread_id` · `payload` {category, title, body, bar_id, parent_id} · `updated_at` (ใหม่สุดก่อน)',
    validates: false,
  })
  drafts(@Req() req: Request) {
    return this.db.rpcAs<CommunityDraft[]>(bearerOf(req), 'my_community_drafts', {});
  }

  @Put('me/community/drafts')
  @ApiDoc({
    summary: 'บันทึกร่าง',
    description:
      'แทนที่ร่างเดิมของช่องเดียวกัน (kind + thread_id) · หน้าเว็บบันทึกอัตโนมัติเมื่อหยุดพิมพ์ · `payload.media` = ไฟล์ที่อัปโหลดเข้า community-media แล้ว (DB ตรวจว่ามีจริง) · ไฟล์ที่เอาออกจากร่าง/ร่างเกิน 7 วัน ถูกลบจาก Storage · ร่าง EDIT ได้เฉพาะเจ้าของกระทู้ (rpc app_community_save_draft)',
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
    description: '`kind` = NEW | REPLY | EDIT · REPLY / EDIT ระบุ `thread_id` ใน query · ไฟล์แนบของร่างถูกลบจาก Storage (rpc app_community_delete_draft)',
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
      'หมวด staff_only (ประกาศ) ตั้งได้เฉพาะทีม NightOut · แท็กร้านได้ 1 ร้าน (ร้านที่แสดงอยู่) · `media` ≤ 6 ไฟล์ (อัปโหลดเข้า community-media/<user_id>/ ก่อน · วิดีโอ ≤ 60 วิ) · สำเร็จแล้วร่าง NEW ถูกลบ (rpc app_community_create_thread)',
    returns: '`id` รหัสกระทู้ใหม่',
    status: 201,
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
    description: 'เฉพาะเจ้าของกระทู้ · ส่งครบทุกช่อง (`media` = ไฟล์ทั้งชุด · ไฟล์ที่เอาออกถูกลบจาก Storage) · บันทึก edited_at · ร่าง EDIT ของกระทู้นี้ถูกลบ (rpc app_community_update_thread)',
    returns: '`id`',
    forbidden: 'ไม่ใช่เจ้าของกระทู้ (NOT_THREAD_OWNER)',
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
    returns: '`thread_id` · `liked` · `like_count`',
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
      '`parent_id` = ความเห็นที่ตอบ (ตอบกลับซ้อนได้ชั้นเดียว) · `media` ≤ 6 ไฟล์ (มีไฟล์แล้วไม่ต้องพิมพ์ข้อความ) · แจ้งเตือนเจ้าของกระทู้และเจ้าของความเห็นที่ถูกตอบ · ร่าง REPLY ของกระทู้นี้ถูกลบ (rpc app_community_add_comment)',
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

  @Delete('community/comments/:id')
  @ApiDoc({
    summary: 'ลบความคิดเห็นของฉัน',
    description: 'เฉพาะเจ้าของความเห็น (rpc app_community_delete_comment)',
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
    returns: '`comment_id` · `liked` · `like_count`',
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
