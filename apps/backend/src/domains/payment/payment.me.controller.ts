import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PaymentIntentView } from '@nightout/contracts';
import { bearerOf } from '../../auth/bearer';
import { CurrentUser } from '../../auth/current-user.decorator';
import { SupabaseJwtGuard, type AuthedRequest, type AuthUser } from '../../auth/supabase-jwt.guard';
import { ApiDoc } from '../../common/api-doc';
import { Id } from '../../common/params';
import { SupabaseService } from '../../supabase/supabase.service';
import { MockCompleteDto } from './payment.dto';
import { PaymentService } from './payment.service';

const INTENT_FIELDS =
  '`id` · `booking_id` · `booking_code` · `bar_name` · `provider` · `status` PENDING / PAID / FAILED / EXPIRED / CANCELLED (PENDING ที่เลยเวลา = EXPIRED) · ' +
  '`amount` · `checkout_url` (เฉพาะ PENDING ที่ยังไม่หมดเวลา) · `expires_at` · `paid_at` · `failure_code` · `failure_message` · ' +
  '`refund_status` NONE / REQUIRED / REFUNDED · `applied` ผูกกับการจองแล้ว (การจอง CONFIRMED) · `created_at`';

/** payment · ลูกค้า — เปิดหน้าชำระ Table Fee · ตรวจผลการชำระ · หน้าชำระเงินจำลอง (mock) */
@ApiTags('payment')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller()
export class PaymentMeController {
  constructor(
    private readonly db: SupabaseService,
    private readonly payments: PaymentService,
  ) {}

  @Post('bookings/:id/checkout')
  @HttpCode(200)
  @ApiDoc({
    summary: 'เปิดหน้าชำระ Table Fee',
    description:
      'เฉพาะการจองของตัวเองที่ AWAITING_DEPOSIT · ใช้หน้าเดิมซ้ำถ้ายังไม่หมดเวลา · หมดเวลาตาม deposit_timeout ของการจอง (≤ 30 นาทีต่อครั้ง) · ' +
      'ยังไม่เปิดชำระออนไลน์ → 503 PAYMENT_PROVIDER_NOT_CONFIGURED · ผู้ให้บริการขัดข้อง → 502 PAYMENT_PROVIDER_ERROR · กำลังเปิดอยู่ → 409 PAYMENT_IN_PROGRESS · ' +
      'หมดเวลาชำระของการจอง → 409 PAYMENT_WINDOW_CLOSED (rpc app_payment_start → adapter.createCheckout → app_payment_attach)',
    returns:
      '`intent_id` · `provider` · `amount` · `expires_at` · `checkout_url` (ขึ้นต้นด้วย `/` = หน้าในเว็บเรา (mock) · https://… = ผู้ให้บริการ) · `reused` ใช้หน้าเดิมที่ยังไม่หมดเวลา',
  })
  checkout(@CurrentUser() me: AuthUser, @Id() id: string, @Req() req: AuthedRequest) {
    return this.payments.startCheckout(me, id, req.headers.origin);
  }

  @Get('bookings/:id/payments')
  @ApiDoc({
    summary: 'รายการชำระเงินของการจอง',
    description: 'ของการจองตัวเองเท่านั้น (ใหม่สุดก่อน ≤ 20) · หน้ากลับจากผู้ให้บริการใช้ตรวจผล (rpc my_payment_intents)',
    returns: `รายการ ${INTENT_FIELDS}`,
  })
  forBooking(@Req() req: AuthedRequest, @Id() id: string) {
    return this.db.rpcAs<PaymentIntentView[]>(bearerOf(req), 'my_payment_intents', { p_booking: id, p_intent: null });
  }

  @Get('payments/intents/:id')
  @ApiDoc({
    summary: 'รายการชำระเงิน 1 รายการ',
    description: 'ของตัวเองเท่านั้น · ไม่พบ → 404 PAYMENT_INTENT_NOT_FOUND (rpc my_payment_intents)',
    returns: INTENT_FIELDS,
  })
  async intent(@Req() req: AuthedRequest, @Id() id: string) {
    const rows = await this.db.rpcAs<PaymentIntentView[]>(bearerOf(req), 'my_payment_intents', { p_booking: null, p_intent: id });
    const row = rows[0];
    if (!row) throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    return row;
  }

  @Post('payments/mock/:id/complete')
  @HttpCode(200)
  @ApiDoc({
    summary: 'จำลองผลการชำระ (เฉพาะ PAYMENT_PROVIDER=mock)',
    description:
      'ปุ่มบนหน้าชำระเงินจำลอง `/pay/mock/:intentId` — สร้าง webhook ที่เซ็นแล้วส่งเข้าเส้นทางเดียวกับผู้ให้บริการจริง (ลายเซ็น + payment_apply_event) · ' +
      'เฉพาะรายการของตัวเองที่ยัง PENDING (rpc my_payment_intents) · ไม่ได้เปิด mock → 404 PAYMENT_MOCK_DISABLED · ปิดไปแล้ว → 409 PAYMENT_INTENT_NOT_PENDING',
    returns: '`duplicate` · `intent_id` · `result` CONFIRMED (PAID) / FAILED / REFUND_REQUIRED …',
  })
  completeMock(@Req() req: AuthedRequest, @Id() id: string, @Body() b: MockCompleteDto) {
    return this.payments.completeMock(bearerOf(req), id, b.outcome);
  }
}
