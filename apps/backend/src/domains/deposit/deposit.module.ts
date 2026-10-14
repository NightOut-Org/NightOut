import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { PaymentModule } from '../payment/payment.module';
import { DepositAdminController } from './deposit.admin.controller';
import { DepositMeController } from './deposit.me.controller';
import { DepositMerchantController } from './deposit.merchant.controller';

/** โดเมน deposit — ส่งสลิป ตรวจ ปิดยอด คืนมัดจำ สมุดมัดจำ · DB: app_submit_deposit, app_team_refund_deposit, admin_review_deposit, admin_settle_deposit, bar_deposit_ledger, booking_deposit_summary · ส่งสลิปใหม่ปิดเมื่อเปิดชำระออนไลน์ (PaymentService.isProviderMode) */
@Module({
  imports: [PaymentModule],
  controllers: [DepositMeController, DepositMerchantController, DepositAdminController],
  providers: [SupabaseJwtGuard, AdminGuard],
})
export class DepositModule {}
