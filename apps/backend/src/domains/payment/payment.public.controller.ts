import { Controller, Get, HttpCode, Param, Post, Req, type RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ApiDoc } from '../../common/api-doc';
import { PaymentService } from './payment.service';

/** payment · สาธารณะ — ช่องทางชำระที่เปิดอยู่ · webhook ของผู้ให้บริการ (ตรวจลายเซ็นแทนการล็อกอิน) */
@ApiTags('payment')
@Controller('payments')
export class PaymentPublicController {
  constructor(private readonly payments: PaymentService) {}

  @Get('config')
  @ApiDoc({
    summary: 'ช่องทางชำระ Table Fee ที่เปิดอยู่',
    description:
      'PROVIDER = หน้าชำระเงินของผู้ให้บริการ (ตั้ง PAYMENT_PROVIDER และพร้อมใช้) · SLIP = โอน PromptPay + แนบสลิปแบบเดิม · ไม่ต้องล็อกอิน (ไม่เรียก DB)',
    returns: '`mode` PROVIDER / SLIP · `provider` (mock / beam / null) · `provider_label` ชื่อที่แสดง (null เมื่อ SLIP)',
    auth: false,
    validates: false,
  })
  config() {
    return this.payments.config();
  }

  @Post('webhook/:provider')
  @HttpCode(200)
  @SkipThrottle()
  @ApiDoc({
    summary: 'Webhook จากผู้ให้บริการชำระเงิน',
    description:
      'ผู้ให้บริการเรียกเมื่อผลการชำระเปลี่ยน · ตรวจลายเซ็นจาก body ดิบด้วย adapter (mock: header `x-nightout-mock-signature` = `sha256=` HMAC-SHA256 ของ body ด้วย PAYMENT_WEBHOOK_SECRET) → ผิด = 401 PAYMENT_SIGNATURE_INVALID ไม่เขียน DB · ' +
      '`:provider` ไม่ตรงกับ PAYMENT_PROVIDER ที่เปิดอยู่ = 404 PAYMENT_PROVIDER_UNKNOWN · กันซ้ำด้วย event id · ' +
      'ชำระสำเร็จ → Table Fee VERIFIED (NightOut ถือไว้) + การจอง CONFIRMED ออก E-Ticket อัตโนมัติ · ' +
      'การจองไม่รอชำระแล้ว / ยอดไม่ตรง / ไม่รู้ยอด → ต้องคืนเงิน (ทำมือที่ระบบผู้ให้บริการ) + แจ้งลูกค้าและแอดมิน · หารายการไม่เจอ → แจ้งแอดมิน (rpc payment_apply_event)',
    returns:
      '`duplicate` event นี้เคยรับแล้ว · `intent_id` รายการชำระที่ผูกได้ (null = หาไม่เจอ) · ' +
      '`result` CONFIRMED / REFUND_REQUIRED / FAILED / EXPIRED / CANCELLED / IGNORED / NOT_FOUND / DUPLICATE',
    auth: false,
  })
  webhook(@Param('provider') provider: string, @Req() req: RawBodyRequest<Request>) {
    return this.payments.handleWebhook(provider.slice(0, 30), req.rawBody, req.headers);
  }
}
