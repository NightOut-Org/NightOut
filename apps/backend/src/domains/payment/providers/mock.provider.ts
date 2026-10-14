import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';
import { paymentProviderLabel } from '@nightout/utils';
import { z } from 'zod';
import type { CreateCheckoutInput, CreateCheckoutResult, PaymentProvider, PaymentWebhookEvent } from './payment-provider';

/** header ลายเซ็นของ webhook จำลอง: `sha256=<hex HMAC-SHA256 ของ body ดิบ ด้วย PAYMENT_WEBHOOK_SECRET>` */
export const MOCK_SIGNATURE_HEADER = 'x-nightout-mock-signature';

const MockEvent = z.object({
  id: z.string().min(1).max(200),
  type: z.enum(['payment.paid', 'payment.failed']),
  intent_id: z.uuid(),
  provider_ref: z.string().max(200).nullish(),
  amount: z.number().positive(),
  created_at: z.iso.datetime({ offset: true }),
});

/**
 * ผู้ให้บริการจำลอง (PAYMENT_PROVIDER=mock) — ใช้ทดสอบก่อนเชื่อมผู้ให้บริการจริง ไม่มีการตัดเงิน
 * หน้าชำระเงินคือ `/pay/mock/:intentId` ในเว็บเรา · ปุ่มบนหน้านั้นสร้าง webhook ที่เซ็นแล้ว (buildEvent) ส่งเข้าเส้นทางเดียวกับของจริง
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly label = paymentProviderLabel('mock');
  readonly ready = true;

  constructor(private readonly secret: string) {}

  createCheckout(i: CreateCheckoutInput): Promise<CreateCheckoutResult> {
    return Promise.resolve({ provider_ref: `mock_${i.intent_id}`, checkout_url: `/pay/mock/${i.intent_id}`, expires_at: i.expires_at });
  }

  sign(body: Buffer): string {
    return 'sha256=' + createHmac('sha256', this.secret).update(body).digest('hex');
  }

  verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): boolean {
    const given = Buffer.from(String(headers[MOCK_SIGNATURE_HEADER] ?? ''));
    const expected = Buffer.from(this.sign(rawBody));
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  parseWebhook(rawBody: Buffer): PaymentWebhookEvent {
    const ev = MockEvent.parse(JSON.parse(rawBody.toString('utf8')));
    const paid = ev.type === 'payment.paid';
    return {
      event_id: ev.id,
      type: paid ? 'PAID' : 'FAILED',
      raw_type: ev.type,
      intent_id: ev.intent_id,
      provider_ref: ev.provider_ref ?? null,
      amount: ev.amount,
      paid_at: paid ? ev.created_at : null,
      failure_code: paid ? null : 'MOCK_DECLINED',
      failure_message: paid ? null : 'จำลองการชำระไม่สำเร็จ',
      payload: ev,
    };
  }

  /** ใช้กับปุ่มบนหน้าชำระเงินจำลอง: สร้าง webhook ที่เซ็นแล้วเหมือนผู้ให้บริการส่งมา */
  buildEvent(i: { intent_id: string; amount: number; outcome: 'PAID' | 'FAILED' }): { body: Buffer; headers: IncomingHttpHeaders } {
    const body = Buffer.from(
      JSON.stringify({
        id: `evt_mock_${randomUUID()}`,
        type: i.outcome === 'PAID' ? 'payment.paid' : 'payment.failed',
        intent_id: i.intent_id,
        provider_ref: `mock_${i.intent_id}`,
        amount: i.amount,
        created_at: new Date().toISOString(),
      }),
    );
    return { body, headers: { 'content-type': 'application/json', [MOCK_SIGNATURE_HEADER]: this.sign(body) } };
  }
}
