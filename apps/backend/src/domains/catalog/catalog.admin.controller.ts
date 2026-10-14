import { Body, Controller, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type * as C from '@nightout/contracts';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { SaveStylesDto } from './catalog.dto';

/**
 * catalog · Backoffice — สไตล์ร้าน (/styles: เพิ่ม / เปลี่ยนชื่อ / ซ่อน / เรียงลำดับ) · สั่งคำนวณดาว/อันดับใหม่ (/ranking "คำนวณใหม่")
 * อ่านผ่าน GET /admin/views/admin_styles · admin_ranking · audit log ในธุรกรรมเดียว
 */
@ApiTags('catalog')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class CatalogAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Put('styles')
  @ApiDoc({
    summary: 'บันทึกสไตล์ร้าน (เพิ่ม / เปลี่ยนชื่อ / ซ่อน / เรียงลำดับ)',
    description:
      'หน้า /styles บันทึกครั้งเดียว · `items` = ทุกสไตล์เรียงตามที่แสดง (สไตล์เดิมต้องอยู่ครบ — ลบไม่ได้ ใช้ซ่อนแทน · ไม่มี id = สไตล์ใหม่) · ' +
      'ซ่อน = หายจากตัวเลือกของร้าน ตัวกรองหน้าค้นหา และการ์ดร้าน (ร้านที่เลือกไว้ไม่หาย) · ประเภทร้าน/ประเภทโปรแก้ผ่าน migration เท่านั้น · ' +
      'ชื่อซ้ำ → `DUPLICATE_STYLE_NAME` · audit ต่อสไตล์ (rpc admin_save_styles)',
    returns: '`created` · `updated` · `total`',
    forbidden: ADMIN_FORBIDDEN,
  })
  saveStyles(@CurrentUser() me: AuthUser, @Body() b: SaveStylesDto) {
    return this.db.rpc<C.SaveStylesResult>('admin_save_styles', { p_actor: me.id, p_items: b.items });
  }

  @Post('ranking/recompute')
  @HttpCode(200)
  @ApiDoc({
    summary: 'คำนวณดาว/อันดับใหม่',
    description:
      'คำนวณคะแนนรวมของทุกร้านที่แสดงอยู่ทันที (เหมือน job ทุกคืน) → tier_scores รอบสัปดาห์+เดือนปัจจุบัน + bar_stats · ' +
      'รีวิว 50 · เช็กอิน 30 · Safety 20 (ร้านที่ยังไม่มีเช็กอินใน 90 วัน = รีวิว + Safety คิดเต็ม 100) · โฆษณาไม่มีผล · audit (rpc admin_recompute_ranking → run_tier_scores)',
    returns: '`bars` จำนวนร้านที่คำนวณ · `weekly_period_start` · `monthly_period_start` · `computed_at`',
    forbidden: ADMIN_FORBIDDEN,
    validates: false,
  })
  recomputeRanking(@CurrentUser() me: AuthUser) {
    return this.db.rpc<C.RecomputeRankingResult>('admin_recompute_ranking', { p_actor: me.id });
  }
}
