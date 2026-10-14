import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { ModerateCommunityDto } from './community.dto';

/**
 * community · Backoffice — จัดการกระทู้/ความเห็นที่ถูกรายงาน (rpc admin_community_moderate · อ่านผ่าน view admin_community_threads / admin_community_comments)
 * view admin_community_* มี `team_bar` (ป้ายทีมร้านตอนโพสต์) + `excluded_like_count` (ถูกใจจากทีมร้านของร้านที่แท็ก — ไม่นับใน like_count)
 */
@ApiTags('community')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin/community')
export class CommunityAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Post('threads/:id/moderate')
  @HttpCode(200)
  @ApiDoc({
    summary: 'จัดการกระทู้',
    description:
      'KEEP (ปิดรายงาน) / HIDE / REMOVE / RESTORE · HIDE / REMOVE ต้องส่ง `reason` (ไม่ส่ง = 400 VALIDATION_FAILED) — เหตุผลส่งถึงเจ้าของโพสต์ในแจ้งเตือน · ปิดรายงานที่ค้างทุกครั้ง · แจ้งเจ้าของเมื่อซ่อน/ลบ · audit log · หน้า Backoffice มีแท็บ "โพสต์ทีมร้าน" ไว้ตรวจโปรโมชันแอลกอฮอล์และการพูดถึงร้านอื่นในทางเสีย (rpc admin_community_moderate)',
    returns: '`id` · `target` = THREAD · `status` สถานะใหม่',
    forbidden: ADMIN_FORBIDDEN,
  })
  thread(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: ModerateCommunityDto) {
    return this.db.rpc<unknown>('admin_community_moderate', {
      p_actor: me.id,
      p_target: 'THREAD',
      p_id: id,
      p_action: b.action,
      p_reason: b.reason ?? null,
    });
  }

  @Post('comments/:id/moderate')
  @HttpCode(200)
  @ApiDoc({
    summary: 'จัดการความคิดเห็น',
    description:
      'เหมือนจัดการกระทู้ · HIDE / REMOVE ต้องส่ง `reason` (ไม่ส่ง = 400 VALIDATION_FAILED) — เหตุผลส่งถึงเจ้าของความเห็นในแจ้งเตือน · ความเห็นจากทีมร้านตรวจได้ในแท็บ "โพสต์ทีมร้าน" · ซ่อนความเห็นหลัก = ตอบกลับใต้ความเห็นนั้นถูกซ่อนตาม · นับจำนวนตอบกลับของกระทู้ใหม่ (rpc admin_community_moderate)',
    returns: '`id` · `target` = COMMENT · `status` สถานะใหม่',
    forbidden: ADMIN_FORBIDDEN,
  })
  comment(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: ModerateCommunityDto) {
    return this.db.rpc<unknown>('admin_community_moderate', {
      p_actor: me.id,
      p_target: 'COMMENT',
      p_id: id,
      p_action: b.action,
      p_reason: b.reason ?? null,
    });
  }
}
