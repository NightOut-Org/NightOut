import type { IncomingHttpHeaders } from 'node:http';
import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CheckoutResult, PaymentConfig, PaymentIntentView, PaymentWebhookResult } from '@nightout/contracts';
import type { AuthUser } from '../../auth/supabase-jwt.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { createPaymentProvider } from './providers/create-provider';
import { MockPaymentProvider } from './providers/mock.provider';
import type { CreateCheckoutResult, PaymentProvider, PaymentWebhookEvent } from './providers/payment-provider';

/** ผลของ rpc app_payment_start */
interface PaymentStartRow {
  intent_id: string;
  provider: string;
  amount: number | string;
  expires_at: string;
  /** null = เพิ่งสร้าง ยังไม่ได้เปิดหน้าชำระเงินกับผู้ให้บริการ */
  checkout_url: string | null;
  reused: boolean;
  booking_id: string;
  booking_code: string;
  bar_name: string;
  customer_email: string | null;
}

/** ผลของ rpc app_payment_attach (สำเร็จ) */
interface PaymentAttachRow {
  intent_id: string;
  provider: string;
  amount: number | string;
  expires_at: string;
  checkout_url: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** payment_events.payload มี check ≤ 64 KB — เกินแล้ว DB ตอบ 23514 ผู้ให้บริการจะส่งซ้ำไม่จบ จึงตัดก่อน */
export const PAYMENT_PAYLOAD_MAX_CHARS = 60_000;

/** ลิงก์กลับหลังชำระ — หน้าชำระ Table Fee ตรวจผลอัตโนมัติเมื่อเห็น `?payment=return` */
export function paymentReturnUrl(base: string, bookingId: string): string {
  return `${base}/bookings/${bookingId}/deposit?payment=return`;
}

/**
 * payment — ชั้นชำระเงินกลาง ไม่ผูกผู้ให้บริการ
 * - เลือก adapter ตาม PAYMENT_PROVIDER (ไม่ตั้ง / ยังไม่พร้อม = flow โอน + แนบสลิปเดิม)
 * - เปิดหน้าชำระ: app_payment_start → adapter.createCheckout → app_payment_attach
 * - webhook: ตรวจลายเซ็นจาก body ดิบ → แปลง event → payment_apply_event (กันซ้ำ · ยืนยันการจอง/ต้องคืนเงิน ใน DB)
 */
@Injectable()
export class PaymentService {
  private readonly log = new Logger('Payment');
  private readonly provider: PaymentProvider | null;
  private readonly corsOrigins: string[];
  private readonly webAppUrl: string | undefined;

  constructor(
    private readonly db: SupabaseService,
    config: ConfigService,
  ) {
    this.provider = createPaymentProvider(
      {
        PAYMENT_PROVIDER: config.get<'mock' | 'beam'>('PAYMENT_PROVIDER'),
        PAYMENT_WEBHOOK_SECRET: config.get<string>('PAYMENT_WEBHOOK_SECRET'),
        PAYMENT_ALLOW_MOCK_IN_PRODUCTION: config.get<string>('PAYMENT_ALLOW_MOCK_IN_PRODUCTION'),
        NODE_ENV: config.get<string>('NODE_ENV'),
        VERCEL: process.env.VERCEL,
      },
      this.log,
    );
    this.corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean);
    this.webAppUrl = config.get<string>('WEB_APP_URL') || undefined;
  }

  /** ช่องทางที่เปิดอยู่ (GET /payments/config) */
  config(): PaymentConfig {
    const p = this.provider;
    return { mode: p ? 'PROVIDER' : 'SLIP', provider: p?.name ?? null, provider_label: p?.label ?? null };
  }

  /** เปิดชำระออนไลน์แล้ว → ปิดส่งสลิปใหม่ */
  isProviderMode(): boolean {
    return !!this.provider;
  }

  /** origin ของเว็บลูกค้า: WEB_APP_URL ก่อน · ไม่ตั้ง = Origin ของ request ถ้าอยู่ใน CORS_ORIGINS · ไม่รู้ = null */
  returnBase(origin?: string): string | null {
    if (this.webAppUrl) {
      try {
        return new URL(this.webAppUrl).origin;
      } catch {
        return null;
      }
    }
    const o = origin?.trim().replace(/\/$/, '');
    return o && this.corsOrigins.includes(o) ? o : null;
  }

  /** POST /bookings/:id/checkout — เปิด (หรือใช้ซ้ำ) หน้าชำระเงินของผู้ให้บริการ */
  async startCheckout(me: AuthUser, bookingId: string, origin?: string): Promise<CheckoutResult> {
    const p = this.provider;
    if (!p) throw new ServiceUnavailableException('PAYMENT_PROVIDER_NOT_CONFIGURED');
    const base = this.returnBase(origin);
    const returnUrl = base ? paymentReturnUrl(base, bookingId) : null;

    const s = await this.db.rpc<PaymentStartRow>('app_payment_start', {
      p_actor: me.id,
      p_booking: bookingId,
      p_provider: p.name,
      p_return_url: returnUrl,
    });
    const amount = Number(s.amount);
    if (s.reused && s.checkout_url) {
      return { intent_id: s.intent_id, provider: s.provider, amount, expires_at: s.expires_at, checkout_url: s.checkout_url, reused: true };
    }

    let out: CreateCheckoutResult;
    try {
      out = await p.createCheckout({
        intent_id: s.intent_id,
        booking_id: s.booking_id,
        booking_code: s.booking_code,
        bar_name: s.bar_name,
        amount,
        currency: 'THB',
        description: `Table Fee ${s.booking_code} · ${s.bar_name}`,
        expires_at: s.expires_at,
        return_url: returnUrl,
        customer_email: s.customer_email ?? me.email ?? null,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`เปิดหน้าชำระเงิน ${p.name} ไม่สำเร็จ (intent ${s.intent_id}): ${msg}`);
      await this.db
        .rpc('app_payment_attach', {
          p_actor: me.id,
          p_intent: s.intent_id,
          p_provider_ref: null,
          p_checkout_url: null,
          p_expires_at: null,
          p_error: msg.slice(0, 300),
        })
        .catch(() => undefined);
      if (e instanceof HttpException) throw e;
      throw new BadGatewayException('PAYMENT_PROVIDER_ERROR');
    }

    const a = await this.db.rpc<PaymentAttachRow>('app_payment_attach', {
      p_actor: me.id,
      p_intent: s.intent_id,
      p_provider_ref: out.provider_ref,
      p_checkout_url: out.checkout_url,
      p_expires_at: out.expires_at ?? null,
      p_error: null,
    });
    return { intent_id: s.intent_id, provider: s.provider, amount, expires_at: a.expires_at, checkout_url: a.checkout_url, reused: false };
  }

  /** POST /payments/webhook/:provider — ตรวจลายเซ็นก่อนแตะ DB เสมอ */
  async handleWebhook(providerName: string, raw: Buffer | undefined, headers: IncomingHttpHeaders): Promise<PaymentWebhookResult> {
    const p = this.provider;
    if (!p || p.name !== providerName) throw new NotFoundException('PAYMENT_PROVIDER_UNKNOWN');
    if (!raw?.length) throw new BadRequestException('PAYMENT_WEBHOOK_INVALID');
    if (!p.verifyWebhook(raw, headers)) {
      this.log.warn(`webhook ${p.name}: ลายเซ็นไม่ถูกต้อง (${raw.length} bytes)`);
      throw new UnauthorizedException('PAYMENT_SIGNATURE_INVALID');
    }

    let ev: PaymentWebhookEvent;
    try {
      ev = p.parseWebhook(raw, headers);
    } catch {
      throw new BadRequestException('PAYMENT_WEBHOOK_INVALID');
    }
    const intentId = ev.intent_id && UUID_RE.test(ev.intent_id) ? ev.intent_id : null;
    const payload = JSON.stringify(ev.payload ?? {}).length <= PAYMENT_PAYLOAD_MAX_CHARS ? (ev.payload ?? {}) : { truncated: true };

    return this.db.rpc<PaymentWebhookResult>('payment_apply_event', {
      p_provider: p.name,
      p_event_id: ev.event_id,
      p_event_type: ev.type,
      p_raw_type: ev.raw_type,
      p_intent: intentId,
      p_provider_ref: ev.provider_ref,
      p_amount: ev.amount,
      p_paid_at: ev.paid_at,
      p_failure_code: ev.failure_code ?? null,
      p_failure_message: ev.failure_message ?? null,
      p_payload: payload,
    });
  }

  /** POST /payments/mock/:id/complete — ปุ่มบนหน้าชำระเงินจำลอง (ส่ง webhook ที่เซ็นแล้วเข้าเส้นทางเดียวกับของจริง) */
  async completeMock(token: string | null, intentId: string, outcome: 'PAID' | 'FAILED'): Promise<PaymentWebhookResult> {
    const p = this.provider;
    if (!(p instanceof MockPaymentProvider)) throw new NotFoundException('PAYMENT_MOCK_DISABLED');
    const [it] = await this.db.rpcAs<PaymentIntentView[]>(token, 'my_payment_intents', { p_booking: null, p_intent: intentId });
    if (!it) throw new NotFoundException('PAYMENT_INTENT_NOT_FOUND');
    if (it.status !== 'PENDING') throw new ConflictException('PAYMENT_INTENT_NOT_PENDING');
    const { body, headers } = p.buildEvent({ intent_id: it.id, amount: Number(it.amount), outcome });
    return this.handleWebhook(p.name, body, headers);
  }
}
