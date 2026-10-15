import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { SiteContentAdminController } from './site-content.admin.controller';
import { SiteContentPublicController } from './site-content.public.controller';

/** โดเมน site-content — เนื้อหาหน้าแรก (ตาราง home_content / home_categories · bucket site-media) + เมนู navbar (ตาราง site_nav_items) */
@Module({ controllers: [SiteContentPublicController, SiteContentAdminController], providers: [SupabaseJwtGuard, AdminGuard] })
export class SiteContentModule {}
