import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type * as C from '@nightout/contracts';
import type { Request } from 'express';
import { bearerOf } from '../../auth/bearer';
import { ApiDoc } from '../../common/api-doc';
import { SupabaseService } from '../../supabase/supabase.service';
import { RankingQueryDto } from './catalog.dto';

/**
 * catalog · สาธารณะ — ข้อมูลตั้งต้นของเว็บ (ร้าน รีวิว ย่าน สไตล์ ตั้งค่า แพ็กเกจโปรโมท) · อันดับร้านรายสัปดาห์/รายเดือน · ไม่บังคับล็อกอิน
 * ส่ง token ของผู้เรียกต่อให้ Supabase (ถ้ามี) → RLS ตัดสินสิทธิ์เหมือนเดิม (ADR 0002)
 */
@ApiTags('catalog')
@Controller('public')
export class CatalogPublicController {
  constructor(private readonly db: SupabaseService) {}

  @Get('catalog')
  @ApiDoc({
    summary: 'ข้อมูลตั้งต้นของเว็บ',
    description: 'ร้านที่อนุมัติแล้ว (view bar_detail) · รีวิวสาธารณะล่าสุด 2,000 รายการ (public_reviews) · ย่าน · สไตล์ · ตั้งค่า PromptPay · แพ็กเกจโปรโมท — หน้าเว็บโหลดครั้งเดียวตอนเปิด',
    returns: '`bars` · `reviews` · `districts` · `styles` · `settings` · `packages` (แถวจาก DB ตรงๆ, key เป็น snake_case)',
    auth: false,
    validates: false,
  })
  async catalog(@Req() req: Request) {
    const t = bearerOf(req);
    const [bars, reviews, districts, styles, settings, packages] = await Promise.all([
      this.db.selectAs<unknown[]>(t, 'bar_detail?select=*&order=name'),
      this.db.selectAs<unknown[]>(t, 'public_reviews?select=*&order=created_at.desc&limit=2000'),
      this.db.selectAs<unknown[]>(t, 'districts?select=id,name_th&order=sort_order'),
      this.db.selectAs<unknown[]>(t, 'styles?select=id,key,name_th&order=sort_order'),
      this.db.selectAs<unknown[]>(t, 'platform_settings?select=key,value'),
      this.db.selectAs<unknown[]>(t, 'promotion_packages?select=id,name,placement,duration_days,price&order=price'),
    ]);
    return { bars, reviews, districts, styles, settings, packages };
  }

  @Get('ranking')
  @ApiDoc({
    summary: 'อันดับร้าน (รายสัปดาห์ / รายเดือน)',
    description:
      'รอบล่าสุดจาก tier_scores ที่ job คำนวณทุกคืน · เรียงตามโหวต (การจองที่เช็กอินในรอบ) แล้วตามคะแนนรวม ' +
      '(รีวิว 50 · เช็กอิน 30 · Safety 20 — ร้านที่ยังไม่มีเช็กอินใน 90 วันคิดรีวิว + Safety เต็ม 100 · โฆษณาไม่มีผล) · ' +
      'ไม่รวมร้านรีวิวน้อยกว่า 5 และร้านที่ไม่ได้แสดง · ยังไม่เคยคำนวณ = [] (rpc public_ranking)',
    returns:
      'รายการ `bar_id` · `rank` · `votes` เช็กอินในรอบ · `total_score` 0–100 · `stars` 1–5 · `tier` S/A/B/C · `period_start` (YYYY-MM-DD) · `computed_at`',
    auth: false,
  })
  ranking(@Req() req: Request, @Query() q: RankingQueryDto) {
    return this.db.rpcAs<C.RankingRow[]>(bearerOf(req), 'public_ranking', {
      p_period: q.period,
      p_category: q.category ?? null,
      p_limit: q.limit,
    });
  }
}
