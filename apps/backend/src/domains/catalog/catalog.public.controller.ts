import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type * as C from '@nightout/contracts';
import type { Request } from 'express';
import { bearerOf } from '../../auth/bearer';
import { ApiDoc } from '../../common/api-doc';
import { SupabaseService } from '../../supabase/supabase.service';
import { AreaAtPointQueryDto, RankingQueryDto, TambonSearchQueryDto } from './catalog.dto';

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
    description:
      'ร้านที่อนุมัติแล้ว (view bar_detail) · พื้นที่ของร้าน ตำบล/อำเภอ/จังหวัด (view bar_areas) · รีวิวสาธารณะล่าสุด 2,000 รายการ (public_reviews) · ' +
      'ย่าน 850 / อำเภอ-เขต 928 / จังหวัด 77 ทั้งประเทศ (ตัวเลือกพื้นที่ในหน้าค้นหา · ต่ำกว่า max rows 1,000 ของ PostgREST) · สไตล์ · ตั้งค่า PromptPay · แพ็กเกจโปรโมท — หน้าเว็บโหลดครั้งเดียวตอนเปิด',
    returns:
      '`bars` · `areas` · `reviews` · `districts` · `amphoes` · `provinces` · `styles` · `settings` · `packages` (แถวจาก DB ตรงๆ, key เป็น snake_case)',
    auth: false,
    validates: false,
  })
  async catalog(@Req() req: Request) {
    const t = bearerOf(req);
    const [bars, areas, reviews, districts, amphoes, provinces, styles, settings, packages] = await Promise.all([
      this.db.selectAs<unknown[]>(t, 'bar_detail?select=*&order=name'),
      this.db.selectAs<C.BarAreaRow[]>(t, 'bar_areas?select=*'),
      this.db.selectAs<unknown[]>(t, 'public_reviews?select=*&order=created_at.desc&limit=2000'),
      this.db.selectAs<unknown[]>(
        t,
        'districts?select=id,name_th,province_th,sort_order&order=sort_order,name_th',
      ),
      this.db.selectAs<unknown[]>(t, 'amphoes?select=code,name_th,province_code&order=code'),
      this.db.selectAs<unknown[]>(t, 'provinces?select=code,name_th&order=code'),
      this.db.selectAs<unknown[]>(t, 'styles?select=id,key,name_th,icon&order=sort_order'),
      this.db.selectAs<unknown[]>(t, 'platform_settings?select=key,value'),
      this.db.selectAs<unknown[]>(
        t,
        'promotion_packages?select=id,name,placement,duration_days,price&order=price',
      ),
    ]);
    return { bars, areas, reviews, districts, amphoes, provinces, styles, settings, packages };
  }

  @Get('area')
  @ApiDoc({
    summary: 'พื้นที่ของพิกัด',
    description:
      'หาตำบล/แขวง อำเภอ/เขต จังหวัด จากขอบเขตการปกครอง (OCHA) และย่านที่พิกัดอยู่ในรัศมี — ใช้แสดงตอนร้านปักหมุด ' +
      '(ค่าจริงของร้าน DB คำนวณเองเมื่อหมุดเปลี่ยน) · rpc area_at_point',
    returns:
      '`tambon` · `amphoe` · `province` {code, name_th} · `district` {id, slug, name_th} — นอกประเทศไทย/ไม่พบ = null',
    auth: false,
  })
  area(@Req() req: Request, @Query() q: AreaAtPointQueryDto) {
    return this.db.rpcAs<C.AreaAtPointResult>(bearerOf(req), 'area_at_point', {
      p_lat: q.lat,
      p_lng: q.lng,
    });
  }

  @Get('tambons')
  @ApiDoc({
    summary: 'ค้นหาตำบล/แขวง',
    description:
      'ค้นตำบล/แขวงทั้งประเทศ 7,425 แห่งจากชื่อ (q ≥ 2 ตัวอักษร · ชื่อตรงทั้งคำก่อน แล้วขึ้นต้นด้วยคำค้น) หรือขอชื่อจากรหัส (code = 1 รหัส · codes = หลายรหัสคั่นด้วย ,) — ' +
      'ตัวกรองพื้นที่ของหน้าค้นหา (ชื่อตำบลซ้ำกันข้ามจังหวัดได้ จึงกรองร้านด้วยรหัส) · rpc search_tambons',
    returns:
      'สูงสุด 20 รายการ `code` · `name_th` · `amphoe_code` · `amphoe_th` · `province_code` · `province_th`',
    auth: false,
  })
  tambons(@Req() req: Request, @Query() q: TambonSearchQueryDto) {
    return this.db.rpcAs<C.TambonOption[]>(bearerOf(req), 'search_tambons', {
      p_q: q.q ?? null,
      p_codes: q.codes ? q.codes.split(',') : q.code ? [q.code] : null,
      p_limit: 20,
    });
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
