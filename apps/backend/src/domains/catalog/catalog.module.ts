import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { CatalogAdminController } from './catalog.admin.controller';
import { CatalogPublicController } from './catalog.public.controller';

/**
 * โดเมน catalog — ข้อมูลสาธารณะที่หน้าเว็บโหลดตอนเปิด (view bar_detail, public_reviews, bar_cards, search_bars, nearby_bars · master: districts, styles, platform_settings, promotion_packages)
 * · อันดับร้าน (rpc public_ranking ← tier_scores) · Backoffice: สไตล์ร้าน (rpc admin_save_styles · view admin_styles) · คำนวณดาว/อันดับ (rpc admin_recompute_ranking → run_tier_scores · view admin_ranking)
 */
@Module({ controllers: [CatalogPublicController, CatalogAdminController], providers: [SupabaseJwtGuard, AdminGuard] })
export class CatalogModule {}
