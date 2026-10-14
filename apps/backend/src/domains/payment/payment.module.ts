import { Module } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseJwtGuard } from '../../auth/supabase-jwt.guard';
import { PaymentAdminController } from './payment.admin.controller';
import { PaymentMeController } from './payment.me.controller';
import { PaymentPublicController } from './payment.public.controller';
import { PaymentService } from './payment.service';

/**
 * โดเมน payment — ชั้นชำระ Table Fee ออนไลน์ ไม่ผูกผู้ให้บริการ (payment intents + adapter ใน providers/ + webhook + mock สำหรับ dev)
 * ตั้ง PAYMENT_PROVIDER (และ adapter พร้อม) → หน้า /bookings/:id/deposit เป็นหน้าชำระเงิน + ปิดส่งสลิป (DepositModule ถาม isProviderMode()) · ไม่ตั้ง = โอน + แนบสลิปเดิม
 * DB (migration 20261013001100_payment_intents): app_payment_start, app_payment_attach, payment_apply_event, admin_payment_mark_refunded, my_payment_intents
 * · trigger payment_close_on_booking_end · view admin_payment_intents, admin_payment_unmatched
 */
@Module({
  controllers: [PaymentPublicController, PaymentMeController, PaymentAdminController],
  providers: [SupabaseJwtGuard, AdminGuard, PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
