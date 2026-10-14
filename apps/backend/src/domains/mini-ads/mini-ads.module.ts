import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { MiniAdsAdminController } from './mini-ads.admin.controller';
import { MiniAdsPublicController } from './mini-ads.public.controller';
import { MiniAdsService } from './mini-ads.service';

/** โดเมน mini-ads — Native Mini-Ads (ตาราง mini_ads / mini_ad_daily_stats · view admin_mini_ads · rpc mini_ads_live, mini_ad_track, admin_save_mini_ad, admin_delete_mini_ad · ภาพใน bucket site-media/ads/) */
@Module({
  controllers: [MiniAdsPublicController, MiniAdsAdminController],
  providers: [SupabaseJwtGuard, AdminGuard, MiniAdsService],
})
export class MiniAdsModule {}
