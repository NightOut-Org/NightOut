import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MarkPaymentRefundedResult } from '@nightout/contracts';
import { AdminGuard } from '../../auth/admin.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { ADMIN_FORBIDDEN, Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { MarkPaymentRefundedDto } from './payment.dto';

/** payment · Backoffice — บันทึกว่าคืนเงินแล้ว (rpc admin_payment_mark_refunded · audit + แจ้งลูกค้าในธุรกรรมเดียว) · อ่านรายการผ่าน /admin/views/admin_payment_intents */
@ApiTags('payment')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard, AdminGuard)
@Controller('admin')
export class PaymentAdminController {
  constructor(private readonly db: SupabaseService) {}

  @Post('payments/:id/refunded')
  @HttpCode(200)
  @ApiDoc({
    summary: 'บันทึกว่าคืนเงินแล้ว',
    description:
      'เงินที่ชำระผ่านผู้ให้บริการแล้วแต่ผูกกับการจองไม่ได้ (`refund_status` = REQUIRED เช่น การจองหมดเวลาก่อนเงินเข้า หรือยอดไม่ตรง) · ' +
      'ระบบยังไม่คืนเงินอัตโนมัติ — แอดมินคืนที่ระบบผู้ให้บริการเองก่อน แล้วบันทึกที่นี่พร้อม `note` (≥ 3 ตัว) และ `refund_ref` · ' +
      'ไม่ต้องคืน/คืนแล้ว → 409 PAYMENT_REFUND_NOT_REQUIRED · audit + แจ้งลูกค้า (rpc admin_payment_mark_refunded)',
    returns: '`id` รหัสรายการชำระ · `refund_status` = REFUNDED · `refunded_at`',
    forbidden: ADMIN_FORBIDDEN,
  })
  markRefunded(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: MarkPaymentRefundedDto) {
    return this.db.rpc<MarkPaymentRefundedResult>('admin_payment_mark_refunded', {
      p_actor: me.id,
      p_intent: id,
      p_note: b.note,
      p_ref: b.refund_ref ?? null,
    });
  }
}
