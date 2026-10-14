import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { SupabaseService } from '../../supabase/supabase.service';
import { GeocodeReverseQueryDto, GeocodeSearchQueryDto, MerchantJoinDto } from './bar.dto';
import { GeocodeService } from './geocode.service';

/** จำกัดต่อ IP สำหรับค้นหาที่อยู่ (นอกจากคิว ≤ 1 ครั้ง/วินาที ไป Nominatim ใน GeocodeService) */
const GEOCODE_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

/** bar · ผู้ใช้ที่ล็อกอิน — สมัครลงร้าน (rpc app_merchant_join) · ค้นหาที่อยู่/หาที่อยู่จากหมุด สำหรับปักหมุดร้าน (proxy → OSM Nominatim) */
@ApiTags('bar')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller()
export class BarMeController {
  constructor(
    private readonly db: SupabaseService,
    private readonly geo: GeocodeService,
  ) {}

  @Post('merchant/join')
  @ApiDoc({
    summary: 'สมัครลงร้าน',
    description:
      'เจ้าของร้านส่งข้อมูลร้านเพื่อขอลงในระบบ · ร้านจะอยู่สถานะ PENDING_REVIEW จนแอดมินอนุมัติ · ผู้สมัครกลายเป็น MERCHANT/OWNER ของร้านนั้น · ต้องปักหมุด (`lat`,`lng` ในไทย) + `address` · ใส่ที่จอดรถ/รถไฟฟ้าใกล้สุดได้ · หมุดถูกตรวจพร้อมการอนุมัติร้าน',
    returns: '`id` รหัสร้าน · `slug` · `status` = PENDING_REVIEW',
    status: 201,
  })
  join(@CurrentUser() me: AuthUser, @Body() b: MerchantJoinDto) {
    return this.db.rpc('app_merchant_join', { p_actor: me.id, p: b });
  }

  @Get('geocode/search')
  @Throttle(GEOCODE_THROTTLE)
  @ApiDoc({
    summary: 'ค้นหาที่อยู่/สถานที่ (ปักหมุดร้าน)',
    description:
      'ค้นตำแหน่งในประเทศไทยผ่าน OpenStreetMap Nominatim โดย backend เป็นตัวกลาง (ไม่มี key · countrycodes=th + กรอบประเทศไทย) ใช้ในหน้า /merchant/location · /merchant/join · Backoffice ตรวจหมุด · เรียกเมื่อผู้ใช้กดค้นหาเท่านั้น (ห้ามใช้ทำ autocomplete ตามนโยบาย Nominatim) · cache 24 ชม. · เรียก Nominatim ไม่เกิน 1 ครั้ง/วินาที · 30 ครั้ง/นาที/IP · `GEOCODER_UNAVAILABLE` / `GEOCODER_BUSY` = ลากหมุดหรือวางพิกัดเองแทน',
    returns: '`results` = [{ `label` ชื่อ/ที่อยู่, `lat`, `lng`, `kind` ประเภทสถานที่ }] (ว่าง = ไม่พบ)',
  })
  geocodeSearch(@Query() q: GeocodeSearchQueryDto) {
    return this.geo.search(q.q, q.limit);
  }

  @Get('geocode/reverse')
  @Throttle(GEOCODE_THROTTLE)
  @ApiDoc({
    summary: 'หาที่อยู่จากหมุด',
    description:
      'แปลงพิกัดหมุด (ต้องอยู่ในไทย) เป็นที่อยู่ผ่าน OpenStreetMap Nominatim โดย backend เป็นตัวกลาง · ปุ่ม "ใช้ที่อยู่จากหมุด" ใน /merchant/location · /merchant/join · Backoffice · cache 24 ชม. · 30 ครั้ง/นาที/IP · `GEOCODER_UNAVAILABLE` / `GEOCODER_BUSY` = พิมพ์ที่อยู่เอง',
    returns: '`label` ที่อยู่ (null = ไม่พบ) · `lat` · `lng`',
  })
  geocodeReverse(@Query() q: GeocodeReverseQueryDto) {
    return this.geo.reverse(q.lat, q.lng);
  }
}
