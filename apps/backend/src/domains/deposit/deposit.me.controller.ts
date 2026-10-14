import { Body, ConflictException, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { PaymentService } from '../payment/payment.service';
import { SubmitDepositDto } from './deposit.dto';

/** deposit · ลูกค้า — ส่งสลิปมัดจำ (rpc app_submit_deposit) · ปิดเมื่อเปิดชำระออนไลน์ (PAYMENT_PROVIDER) */
@ApiTags('deposit')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller()
export class DepositMeController {
  constructor(
    private readonly db: SupabaseService,
    private readonly payments: PaymentService,
  ) {}

  @Post('bookings/:id/deposit')
  @HttpCode(200)
  @ApiDoc({
    summary: 'ส่งสลิปมัดจำ',
    description:
      'หลังโอนมัดจำเข้า PromptPay ของ NightOut ให้อัปโหลดสลิปเข้า Storage `deposit-slips/<user_id>/…` เองก่อน (POST /storage/upload-url) แล้วส่ง `slip_path` มาที่เส้นนี้ · ใช้ได้เฉพาะการจองของตัวเองที่ยังรอมัดจำ · บัญชีที่ถูกแบนส่งไม่ได้ · ' +
      'เปิดชำระออนไลน์แล้ว (PAYMENT_PROVIDER) → 409 SLIP_FLOW_DISABLED (ชำระผ่าน POST /bookings/:id/checkout แทน)',
    returns: '`id` รหัสมัดจำ · `booking_id` · `status` = SUBMITTED (รอแอดมินตรวจ)',
  })
  submit(@CurrentUser() me: AuthUser, @Id() id: string, @Body() b: SubmitDepositDto) {
    if (this.payments.isProviderMode()) throw new ConflictException('SLIP_FLOW_DISABLED');
    return this.db.rpc('app_submit_deposit', { p_actor: me.id, p_booking: id, p_slip_path: b.slip_path, p_slip_ref: b.slip_ref ?? null });
  }
}
