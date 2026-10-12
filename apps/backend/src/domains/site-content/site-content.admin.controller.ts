import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { SaveHomePageResult } from '@nightout/contracts';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { SaveHomePageDto } from './site-content.dto';

/** site-content · Backoffice — แก้เนื้อหาหน้าแรกทั้งหน้าในคำขอเดียว (rpc admin_save_home_page → admin_save_home_content / admin_save_home_category / admin_save_home_popular · audit log) */
@ApiTags('site-content')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class SiteContentAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Put('home-page')
  @ApiDoc({
    summary: 'บันทึกหน้าแรก (Hero · หัวข้อ section · การ์ดหมวด · ร้านยอดนิยม)',
    description:
      'หน้า /home-content แก้ในหน้าแล้วบันทึกครั้งเดียว · ส่งเฉพาะส่วนที่แก้ อย่างน้อย 1 ส่วน · ' +
      '`content` = field ของ Hero / หัวข้อ section ที่แก้ (`hero_image_url: null` = ภาพตั้งต้น) · ' +
      '`categories` = เฉพาะการ์ดที่แก้ คู่กับ `slot` (popular · pub · food · live · rooftop · chill · outdoor · party) · ' +
      '`popular.bar_ids` = ร้านยอดนิยมทั้งรายการตามลำดับ (สูงสุด 8 · เฉพาะร้าน APPROVED · `[]` = ไม่ปัก) · ' +
      'ภาพอัปโหลดเข้า bucket site-media ก่อนด้วย POST /storage/upload-url แล้วส่ง URL · ธุรกรรมเดียว · audit log ต่อส่วน (rpc admin_save_home_page)',
    returns: '`content_updated` · `categories_updated` จำนวนการ์ด · `popular_updated`',
    forbidden: ADMIN_FORBIDDEN,
  })
  savePage(@CurrentUser() me: AuthUser, @Body() b: SaveHomePageDto) {
    return this.db.rpc<SaveHomePageResult>('admin_save_home_page', {
      p_actor: me.id,
      p_content: b.content ?? null,
      p_categories: b.categories ?? null,
      p_popular: b.popular?.bar_ids ?? null,
    });
  }
}
