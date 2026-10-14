import type { PaymentIntentStatus, PaymentRefundStatus } from '@nightout/types';

/**
 * ชั้นชำระเงินกลาง (โดเมน payment) — ป้าย/ค่าคงที่ที่หน้าเว็บ Backoffice และ backend ใช้ร่วมกัน
 * ไม่ผูกผู้ให้บริการ: ชื่อผู้ให้บริการในระบบ = payment_intents.provider (mock / beam …)
 */

/** ป้ายสถานะรายการชำระเงิน (หน้าเว็บ + Backoffice) */
export const PAYMENT_STATUS_LABEL: Record<PaymentIntentStatus, string> = {
  PENDING: 'รอชำระ',
  PAID: 'ชำระแล้ว',
  FAILED: 'ไม่สำเร็จ',
  EXPIRED: 'หมดเวลา',
  CANCELLED: 'ยกเลิก',
};

/** ป้ายสถานะคืนเงินของรายการที่ชำระแล้วแต่ผูกกับการจองไม่ได้ (คืนเองที่ระบบผู้ให้บริการ) */
export const PAYMENT_REFUND_LABEL: Record<PaymentRefundStatus, string> = {
  NONE: '-',
  REQUIRED: 'ต้องคืนเงิน',
  REFUNDED: 'คืนเงินแล้ว',
};

/** ชื่อผู้ให้บริการที่ลูกค้า/แอดมินเห็น (ชื่อในระบบ = payment_intents.provider) */
const PROVIDER_LABEL: Record<string, string> = {
  mock: 'ระบบชำระเงินจำลอง (ทดสอบ)',
  beam: 'Beam Payment',
};

/** ชื่อช่องทางชำระที่แสดง · ไม่มีผู้ให้บริการ = โอน + แนบสลิป (flow เดิม) · ไม่รู้จัก = ชื่อในระบบ */
export function paymentProviderLabel(provider: string | null | undefined): string {
  if (!provider) return 'โอน + แนบสลิป';
  return PROVIDER_LABEL[provider] ?? provider;
}

/** หน้ากลับจากผู้ให้บริการตรวจผลทุกกี่ ms และนานสุดเท่าไร */
export const PAYMENT_POLL_MS = 3000;
export const PAYMENT_POLL_MAX_MS = 120_000;

/** checkout_url ของ mock เป็น path ในเว็บเรา ('/pay/mock/<id>') · ของจริงเป็น https://… · '//host' ไม่นับ (protocol-relative = เว็บอื่น) */
export function isInAppCheckoutUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}
