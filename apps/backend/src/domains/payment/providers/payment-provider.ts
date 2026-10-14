import type { IncomingHttpHeaders } from 'node:http';
import type { PaymentEventType } from '@nightout/types';

/** ข้อมูลที่ส่งให้ผู้ให้บริการตอนเปิดหน้าชำระเงิน (มาจาก rpc app_payment_start) */
export interface CreateCheckoutInput {
  /** payment_intents.id — ส่งเป็น reference/metadata ให้ผู้ให้บริการ แล้ว webhook ส่งกลับมา */
  intent_id: string;
  booking_id: string;
  booking_code: string;
  bar_name: string;
  /** บาท */
  amount: number;
  currency: 'THB';
  /** "Table Fee NL-XXXXXX · <ร้าน>" */
  description: string;
  expires_at: string;
  /** ลิงก์กลับหลังชำระ (`/bookings/:id/deposit?payment=return`) · null = ไม่รู้ origin ของเว็บ */
  return_url: string | null;
  customer_email: string | null;
}

export interface CreateCheckoutResult {
  /** id ฝั่งผู้ให้บริการ (session / charge) */
  provider_ref: string | null;
  /** ขึ้นต้นด้วย '/' = หน้าในเว็บเรา (mock) · ผู้ให้บริการจริงต้องเป็น https://… */
  checkout_url: string;
  /** ผู้ให้บริการกำหนดเวลาหมดเอง (DB ใช้ค่าที่เร็วกว่า) */
  expires_at?: string | null;
}

/** event หลัง adapter แปลงจากรูปแบบของผู้ให้บริการแล้ว */
export interface PaymentWebhookEvent {
  /** id ของ event ฝั่งผู้ให้บริการ — กันซ้ำด้วย (provider, event_id) */
  event_id: string;
  type: PaymentEventType;
  raw_type: string;
  /** payment_intents.id ที่เราส่งไปตอนสร้างหน้าชำระ (ต้องเป็น uuid · ไม่ใช่ = null) */
  intent_id: string | null;
  provider_ref: string | null;
  /** ยอดเป็น "บาท" (ไม่ใช่สตางค์) · PAID ต้องมีเสมอ (ไม่มีใน webhook = adapter ถาม API ผู้ให้บริการ) · สกุลเงินไม่ใช่ THB = null → DB ไม่ยืนยันโต๊ะ (ต้องคืนเงิน) */
  amount: number | null;
  paid_at: string | null;
  failure_code?: string | null;
  failure_message?: string | null;
  /** เก็บใน payment_events.payload — ตัดเลขบัตร/ข้อมูลส่วนตัวออกก่อน */
  payload: Record<string, unknown>;
}

/** adapter ของผู้ให้บริการ 1 ราย — เพิ่มรายใหม่ = class ใหม่ + case ใน create-provider.ts (ไม่แตะ DB/หน้าเว็บ) */
export interface PaymentProvider {
  /** = payment_intents.provider (a-z0-9_) */
  readonly name: string;
  /** paymentProviderLabel(name) */
  readonly label: string;
  /** false = ยังเป็นโครง → ระบบใช้ flow สลิปต่อ */
  readonly ready: boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  /** ตรวจลายเซ็นจาก body ดิบ (ห้าม parse ก่อน) */
  verifyWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): boolean;
  /** แปลง body ที่ผ่านการตรวจลายเซ็นแล้ว · ข้อมูลผิดรูปแบบ = throw */
  parseWebhook(rawBody: Buffer, headers: IncomingHttpHeaders): PaymentWebhookEvent;
}
