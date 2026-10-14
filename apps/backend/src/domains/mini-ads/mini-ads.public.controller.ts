import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PublicMiniAd, TrackMiniAdResult } from '@nightout/contracts';
import type { Request } from 'express';
import { bearerOf } from '../../auth/bearer';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { MiniAdsQueryDto, TrackMiniAdDto } from './mini-ads.dto';

/** สุ่มลำดับแบบ Fisher–Yates (สำเนาใหม่ · ไม่แก้ของเดิม) — แต่ละการเปิดหน้าเห็นโฆษณาคนละชิ้น */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** mini-ads · สาธารณะ — โฆษณาแบนเนอร์ที่กำลังแสดง + นับเห็น/คลิก (ไม่ต้องล็อกอิน · ไม่เก็บข้อมูลผู้ใช้) */
@ApiTags('mini-ads')
@Controller('public/mini-ads')
export class MiniAdsPublicController {
  constructor(private readonly db: SupabaseService) {}

  @Get()
  @ApiDoc({
    summary: 'โฆษณาแบนเนอร์ที่กำลังแสดง',
    description:
      'Native Mini-Ads ของตำแหน่ง `placement` (HOME หน้าแรก · SEARCH หน้าค้นหา) ที่เปิดใช้และอยู่ในช่วงวันที่ · สูงสุด 10 รายการ สุ่มลำดับทุกครั้ง — หน้าเว็บแสดงตัวแรกที่ผู้ใช้ไม่ได้ซ่อน · ไม่มีผลต่ออันดับหรือผลค้นหาร้าน (rpc mini_ads_live)',
    returns: 'รายการ `id` · `advertiser_name` · `title` · `description` · `cta_label` · `image_url` · `link_url` (ไม่มี = [])',
    auth: false,
  })
  async list(@Req() req: Request, @Query() q: MiniAdsQueryDto): Promise<PublicMiniAd[]> {
    const rows = await this.db.rpcAs<PublicMiniAd[] | null>(bearerOf(req), 'mini_ads_live', { p_placement: q.placement });
    return shuffled(rows ?? []);
  }

  @Post(':id/track')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiDoc({
    summary: 'นับการเห็น/คลิกโฆษณา',
    description:
      'หน้าเว็บเรียก IMPRESSION เมื่อการ์ดโผล่บนจอ ≥ 50% (ครั้งเดียวต่อการเปิดเว็บ) และ CLICK เมื่อกด · ไม่ต้องล็อกอิน · ไม่เก็บข้อมูลผู้ใช้ นับรวมรายวันต่อตำแหน่ง · โฆษณาที่ไม่ได้แสดงอยู่ไม่นับ (rpc mini_ad_track)',
    returns: '`tracked` (false = โฆษณาไม่ได้แสดงอยู่ในตำแหน่งนั้น)',
    auth: false,
  })
  track(@Id() id: string, @Body() b: TrackMiniAdDto) {
    return this.db.rpc<TrackMiniAdResult>('mini_ad_track', { p_ad: id, p_event: b.event, p_placement: b.placement });
  }
}
