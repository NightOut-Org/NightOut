import type { PaymentIntentStatus, PaymentRefundStatus } from '@nightout/types';
import { z } from 'zod';
import { text } from './common';

/**
 * โดเมน payment — ชั้นชำระเงินกลาง ไม่ผูกผู้ให้บริการ (payment_intents + adapter + webhook)
 * ตั้ง PAYMENT_PROVIDER (backend) แล้วหน้า /bookings/:id/deposit เปลี่ยนเป็นหน้าชำระเงิน · ไม่ตั้ง = โอน + แนบสลิปเดิม
 */

/** GET /payments/config */
export interface PaymentConfig {
  /** PROVIDER = หน้าชำระเงินของผู้ให้บริการ · SLIP = โอน PromptPay + แนบสลิป (เดิม) */
  mode: 'PROVIDER' | 'SLIP';
  provider: string | null;
  provider_label: string | null;
}

/** POST /bookings/:id/checkout (ไม่มี body) */
export interface CheckoutResult {
  intent_id: string;
  provider: string;
  amount: number;
  expires_at: string;
  /** ลิงก์หน้าชำระเงิน — ขึ้นต้นด้วย '/' = หน้าในเว็บเรา (mock) · https://… = ผู้ให้บริการ */
  checkout_url: string;
  /** ใช้หน้าชำระเงินเดิมที่ยังไม่หมดเวลา */
  reused: boolean;
}

/** GET /bookings/:id/payments (ใหม่สุดก่อน · ≤ 20) · GET /payments/intents/:id — rpc my_payment_intents */
export interface PaymentIntentView {
  id: string;
  booking_id: string;
  booking_code: string;
  bar_name: string;
  provider: string;
  /** PENDING ที่เลยเวลาแล้วเป็น EXPIRED */
  status: PaymentIntentStatus;
  amount: number;
  /** มีเฉพาะ PENDING ที่ยังไม่หมดเวลา */
  checkout_url: string | null;
  expires_at: string;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  refund_status: PaymentRefundStatus;
  /** ชำระแล้วและผูกกับการจองแล้ว (การจอง CONFIRMED) */
  applied: boolean;
  created_at: string;
}

/** POST /payments/mock/:id/complete — ปุ่มบนหน้าชำระเงินจำลอง */
export const MockCompleteBody = z.object({ outcome: z.enum(['PAID', 'FAILED']).describe('ผลที่จะจำลอง') });
export type MockCompleteBody = z.infer<typeof MockCompleteBody>;

export type PaymentApplyResult =
  | 'CONFIRMED'
  | 'REFUND_REQUIRED'
  | 'FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'IGNORED'
  | 'NOT_FOUND'
  | 'DUPLICATE';

/** POST /payments/webhook/:provider · POST /payments/mock/:id/complete */
export interface PaymentWebhookResult {
  duplicate: boolean;
  intent_id: string | null;
  result: PaymentApplyResult;
}

/** POST /admin/payments/:id/refunded — แอดมินคืนเงินที่ระบบผู้ให้บริการแล้ว มาบันทึก */
export const MarkPaymentRefundedBody = z.object({
  note: z.string().trim().min(3).max(300).describe('คืนอย่างไร เช่น คืนผ่านหน้า Dashboard ของผู้ให้บริการ'),
  refund_ref: text(120).optional().describe('เลขอ้างอิงการคืนเงินจากผู้ให้บริการ'),
});
export type MarkPaymentRefundedBody = z.infer<typeof MarkPaymentRefundedBody>;
export interface MarkPaymentRefundedResult {
  id: string;
  refund_status: 'REFUNDED';
  refunded_at: string;
}

export const PAYMENT_ERRORS = {
  PAYMENT_PROVIDER_NOT_CONFIGURED: 'ยังไม่ได้เปิดชำระเงินออนไลน์ — ชำระด้วยการโอนและแนบสลิป',
  PAYMENT_PROVIDER_NOT_READY: 'ระบบชำระเงินยังไม่พร้อมใช้งาน ลองใหม่ภายหลัง',
  PAYMENT_PROVIDER_UNKNOWN: 'ไม่รู้จักผู้ให้บริการชำระเงินนี้',
  PAYMENT_PROVIDER_ERROR: 'เปิดหน้าชำระเงินไม่สำเร็จ ลองใหม่อีกครั้ง',
  PAYMENT_SIGNATURE_INVALID: 'ลายเซ็น webhook ไม่ถูกต้อง',
  PAYMENT_WEBHOOK_INVALID: 'ข้อมูล webhook ไม่ถูกต้อง',
  PAYMENT_INTENT_NOT_FOUND: 'ไม่พบรายการชำระเงินนี้',
  PAYMENT_INTENT_NOT_PENDING: 'รายการชำระเงินนี้ปิดไปแล้ว — กลับไปกดชำระใหม่',
  PAYMENT_IN_PROGRESS: 'กำลังเปิดหน้าชำระเงิน รอสักครู่แล้วลองใหม่',
  PAYMENT_WINDOW_CLOSED: 'หมดเวลาชำระ Table Fee ของการจองนี้แล้ว — จองใหม่อีกครั้ง',
  BOOKING_NOT_AWAITING_PAYMENT: 'การจองนี้ไม่ต้องชำระ Table Fee แล้ว',
  PAYMENT_MOCK_DISABLED: 'ระบบชำระเงินจำลองไม่ได้เปิดอยู่',
  PAYMENT_REFUND_NOT_REQUIRED: 'รายการนี้ไม่ต้องคืนเงิน หรือบันทึกว่าคืนแล้ว',
  PAYMENT_REFUND_NOTE_REQUIRED: 'ระบุหมายเหตุการคืนเงิน (อย่างน้อย 3 ตัวอักษร)',
} as const satisfies Record<string, string>;
