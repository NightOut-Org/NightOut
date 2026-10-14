import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { CommunityAdminController } from './community.admin.controller';
import { CommunityMeController } from './community.me.controller';
import { CommunityPublicController } from './community.public.controller';
import { CommunityService } from './community.service';

/**
 * โดเมน community — ชุมชน/กระทู้ · ความเห็น · ถูกใจ · บันทึก · ปักหมุดส่วนตัว · ฉบับร่าง (เก็บที่ backend) · รายงาน · แอดมินจัดการ
 * ไฟล์แนบ: bucket community-media (private) — CommunityService ลบไฟล์ที่ไม่มีใครอ้าง + เติม signed URL
 * DB: app_community_* · admin_community_moderate · อ่าน: community_feed, community_thread, community_categories_list, community_trending_bars, my_community_drafts, my_community_team
 */
@Module({
  controllers: [CommunityPublicController, CommunityMeController, CommunityAdminController],
  providers: [SupabaseJwtGuard, AdminGuard, CommunityService],
})
export class CommunityModule {}
