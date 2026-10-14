import { Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { CommunityCategory, CommunityFeedResult, CommunityTrendingBar } from '@nightout/contracts';
import type { Request } from 'express';
import { bearerOf } from '../../auth/bearer';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { CommunityFeedQueryDto, feedArgs } from './community.dto';
import { CommunityService } from './community.service';

const THREAD_FIELDS =
  '`id` · `title` · `excerpt` · `category` · `category_name` · `author` {id, name, is_staff, team: {id, slug | null, name} | null} · `bar` {id, slug, name} | null · `reply_count` · `like_count` · `view_count` · `created_at` · `last_activity_at` · `edited_at` · `is_mine` · `is_pinned` · `is_saved` · `is_liked`';

/** community · สาธารณะ — ฟีด / อ่านกระทู้ / หมวด (อ่านในนามผู้เรียก: ล็อกอินแล้วได้ is_pinned / is_saved / is_liked ของตัวเอง) */
@ApiTags('community')
@Controller('public/community')
export class CommunityPublicController {
  constructor(
    private readonly db: SupabaseService,
    private readonly community: CommunityService,
  ) {}

  @Get('categories')
  @ApiDoc({
    summary: 'หมวดกระทู้',
    description: 'หมวดที่เปิดใช้ เรียงตามลำดับ + จำนวนกระทู้ที่แสดงอยู่ (rpc community_categories_list)',
    returns: 'รายการ `slug` · `name` · `sort_order` · `staff_only` (ตั้งได้เฉพาะทีม NightOut) · `team_only` (ตั้งได้เฉพาะทีมร้าน — ข่าวจากร้าน) · `thread_count`',
    auth: false,
    validates: false,
  })
  categories(@Req() req: Request) {
    return this.db.rpcAs<CommunityCategory[]>(bearerOf(req), 'community_categories_list', {});
  }

  @Get('threads')
  @ApiDoc({
    summary: 'ฟีดกระทู้',
    description:
      'กรองตาม `category` · `bar_id` · ค้นหา `q` (หัวข้อ/รายละเอียด/ชื่อร้าน) · `sort` = latest | popular | unanswered · แบ่งหน้าด้วย `limit` / `offset` · ล็อกอินแล้ว กระทู้ที่ฉันปักหมุดขึ้นก่อนเสมอ (คนอื่นไม่เห็นหมุดของฉัน) (rpc community_feed)',
    returns: `\`items\` (${THREAD_FIELDS}) · \`has_more\``,
    auth: false,
  })
  feed(@Req() req: Request, @Query() q: CommunityFeedQueryDto) {
    return this.db.rpcAs<CommunityFeedResult>(bearerOf(req), 'community_feed', feedArgs(q));
  }

  @Get('threads/:id')
  @ApiDoc({
    summary: 'อ่านกระทู้',
    description:
      'กระทู้ + ความเห็นทั้งหมดที่แสดงอยู่ (แบน · parent_id ชี้ความเห็นหลัก) · กระทู้ที่ถูกซ่อนเห็นเฉพาะเจ้าของ · ไฟล์แนบได้ signed URL (6 ชม.) ในนามผู้เรียก (rpc community_thread + Storage community-media)',
    returns: `${THREAD_FIELDS} · \`body\` · \`media\` [{id, kind, path, thumb_path, duration_sec, url, thumb_url}] · \`comments\` [{id, parent_id, body, author, like_count, created_at, edited_at, media, is_mine, is_liked}] · ไม่พบ = 404 THREAD_NOT_FOUND`,
    auth: false,
  })
  thread(@Req() req: Request, @Id() id: string) {
    return this.community.thread(bearerOf(req), id);
  }

  @Get('threads/:id/history')
  @ApiDoc({
    summary: 'ประวัติการแก้ไขกระทู้',
    description:
      'ทุกเวอร์ชันของกระทู้ ใหม่สุดก่อน (แถวแรก = ปัจจุบัน) · เห็นได้เท่ากับที่เห็นกระทู้ · ไฟล์แนบได้ signed URL ในนามผู้เรียก (rpc community_history)',
    returns: 'รายการ `title` · `category_name` · `bar` · `body` · `media` · `at` (เวอร์ชันนี้เริ่มแสดงเมื่อไร) · `is_current` · ไม่พบ = 404 THREAD_NOT_FOUND',
    auth: false,
  })
  threadHistory(@Req() req: Request, @Id() id: string) {
    return this.community.history(bearerOf(req), 'THREAD', id);
  }

  @Get('comments/:id/history')
  @ApiDoc({
    summary: 'ประวัติการแก้ไขความคิดเห็น',
    description:
      'ทุกเวอร์ชันของความเห็น ใหม่สุดก่อน (แถวแรก = ปัจจุบัน) · เห็นได้เมื่อความเห็นแสดงอยู่ · ไฟล์แนบได้ signed URL ในนามผู้เรียก (rpc community_history)',
    returns: 'รายการ `body` · `media` · `at` · `is_current` · ไม่พบ = 404 COMMENT_NOT_FOUND',
    auth: false,
  })
  commentHistory(@Req() req: Request, @Id() id: string) {
    return this.community.history(bearerOf(req), 'COMMENT', id);
  }

  @Post('threads/:id/view')
  @HttpCode(200)
  @ApiDoc({
    summary: 'นับยอดเข้าชมกระทู้',
    description: 'หน้าอ่านกระทู้เรียกครั้งเดียวต่อการเปิด · ไม่ต้องล็อกอิน (rpc community_add_view)',
    returns: '`thread_id` · `view_count` หรือ `null` ถ้ากระทู้ไม่แสดงอยู่',
    auth: false,
  })
  view(@Id() id: string) {
    return this.db.rpc<unknown>('community_add_view', { p_thread: id });
  }

  @Get('trending-bars')
  @ApiDoc({
    summary: 'ร้านที่ถูกพูดถึงสัปดาห์นี้',
    description:
      'ร้านที่ถูกแท็กในกระทู้มากที่สุด 7 วันล่าสุด · ไม่นับกระทู้ที่ทีมร้านแท็กร้านตัวเอง (รวมข่าวจากร้านทั้งหมด) · จำนวนเท่ากันเรียงตามยอดถูกใจ (rpc community_trending_bars)',
    returns: 'รายการ `id` · `slug` · `name` · `thread_count` (สูงสุด 3 ร้าน)',
    auth: false,
    validates: false,
  })
  trendingBars(@Req() req: Request) {
    return this.db.rpcAs<CommunityTrendingBar[]>(bearerOf(req), 'community_trending_bars', { p_days: 7, p_limit: 3 });
  }
}
