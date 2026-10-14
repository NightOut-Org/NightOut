import { BeamPaymentProvider } from './beam.provider';
import { MockPaymentProvider } from './mock.provider';
import type { PaymentProvider } from './payment-provider';

/** ลับของ mock ในเครื่อง dev (ไม่ตั้ง PAYMENT_WEBHOOK_SECRET) — deploy ต้องตั้งเอง */
export const DEV_MOCK_WEBHOOK_SECRET = 'nightout-dev-mock-webhook-secret';

export interface PaymentEnv {
  PAYMENT_PROVIDER?: 'mock' | 'beam';
  PAYMENT_WEBHOOK_SECRET?: string;
  PAYMENT_ALLOW_MOCK_IN_PRODUCTION?: string;
  NODE_ENV?: string;
  VERCEL?: string;
}

/** ผู้ให้บริการที่ใช้งานได้จริงตอนนี้ — null = ใช้ flow สลิป (ไม่ตั้ง / ยังไม่พร้อม / mock ถูกปิดบน deploy) */
export function createPaymentProvider(env: PaymentEnv, log: { warn(msg: string): void }): PaymentProvider | null {
  switch (env.PAYMENT_PROVIDER) {
    case undefined:
      return null;
    case 'mock': {
      const deployed = !!env.VERCEL || env.NODE_ENV === 'production';
      if (deployed && env.PAYMENT_ALLOW_MOCK_IN_PRODUCTION !== 'true') {
        log.warn('PAYMENT_PROVIDER=mock ถูกปิดบน deploy — ตั้ง PAYMENT_ALLOW_MOCK_IN_PRODUCTION=true ถ้าจะเดโม');
        return null;
      }
      if (deployed && !env.PAYMENT_WEBHOOK_SECRET) {
        log.warn('PAYMENT_PROVIDER=mock บน deploy ต้องตั้ง PAYMENT_WEBHOOK_SECRET (≥ 16 ตัว) — ใช้ flow สลิปต่อ');
        return null;
      }
      return new MockPaymentProvider(env.PAYMENT_WEBHOOK_SECRET ?? DEV_MOCK_WEBHOOK_SECRET);
    }
    case 'beam': {
      const beam = new BeamPaymentProvider();
      if (!beam.ready) {
        log.warn('PAYMENT_PROVIDER=beam ยังเป็นโครง (stub) — ใช้ flow สลิปต่อ');
        return null;
      }
      return beam;
    }
    default:
      return null;
  }
}
