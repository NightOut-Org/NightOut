import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { paymentProviderLabel } from '@nightout/utils';
import type { CreateCheckoutResult, PaymentProvider, PaymentWebhookEvent } from './payment-provider';

/**
 * Beam Payment — **โครง (stub) รอเชื่อม** · ยังไม่มีคีย์และเจ้าของยังไม่ยืนยันว่าจะใช้ Beam (2026-10-13)
 * `ready = false` → createPaymentProvider() คืน null → ระบบใช้ flow โอน + แนบสลิปต่อ (ตั้ง PAYMENT_PROVIDER=beam ก็ยังไม่เปิด)
 *
 * adapter ตัวจริง (Beam หรือรายอื่น) ต้องทำ:
 * 1. createCheckout — เรียก API สร้างหน้าชำระเงินของผู้ให้บริการ ส่ง `intent_id` เป็น reference/metadata + `return_url`
 *    คืน `checkout_url` ที่เป็น https://… และ `provider_ref` (id session/charge ฝั่งเขา)
 * 2. verifyWebhook — ตรวจ HMAC ใน header ของผู้ให้บริการด้วย secret ของเขาเอง จาก body ดิบ (timingSafeEqual · ห้าม parse ก่อน)
 * 3. parseWebhook — แปลง event ของเขา → PAID / FAILED / EXPIRED / CANCELLED / IGNORED · ยอดเป็นบาท (ไม่ใช่ THB = null)
 * 4. ตัดเลขบัตร/ข้อมูลส่วนตัวออกจาก `payload` ก่อนเก็บลง payment_events
 * 5. ตั้ง `ready = true` เมื่อมีคีย์แล้ว (เพิ่ม env ของผู้ให้บริการใน config/env.ts ตอนนั้น)
 */
export class BeamPaymentProvider implements PaymentProvider {
  readonly name = 'beam';
  readonly label = paymentProviderLabel('beam');
  /** true เมื่อเชื่อม API จริงและมีคีย์แล้ว */
  readonly ready: boolean = false;

  createCheckout(): Promise<CreateCheckoutResult> {
    return Promise.reject(new ServiceUnavailableException('PAYMENT_PROVIDER_NOT_READY'));
  }

  verifyWebhook(): boolean {
    return false;
  }

  parseWebhook(): PaymentWebhookEvent {
    throw new BadRequestException('PAYMENT_WEBHOOK_INVALID');
  }
}
