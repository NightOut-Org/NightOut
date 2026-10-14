import {
  BadGatewayException,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { SupabaseService } from '../../supabase/supabase.service';
import { PAYMENT_PAYLOAD_MAX_CHARS, PaymentService, paymentReturnUrl } from './payment.service';
import { BeamPaymentProvider } from './providers/beam.provider';
import { createPaymentProvider, DEV_MOCK_WEBHOOK_SECRET } from './providers/create-provider';
import { MOCK_SIGNATURE_HEADER, MockPaymentProvider } from './providers/mock.provider';

const SECRET = 'test-webhook-secret-123';
const INTENT = '11111111-1111-4111-8111-111111111111';
const BOOKING = '22222222-2222-4222-8222-222222222222';
const ME = { id: '33333333-3333-4333-8333-333333333333', email: 'me@nightout.test' };

/** จับ error ที่ throw แล้วคืน { status, code } (code = ข้อความใน exception = รหัส error) */
async function failure(p: Promise<unknown>): Promise<{ status: number; code: string; error: unknown }> {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpException) return { status: e.getStatus(), code: e.message, error: e };
    throw e;
  }
  throw new Error('expected a rejection');
}

describe('MockPaymentProvider', () => {
  const mock = new MockPaymentProvider(SECRET);

  it('signs and verifies the raw body', () => {
    const body = Buffer.from('{"a":1}');
    expect(mock.verifyWebhook(body, { [MOCK_SIGNATURE_HEADER]: mock.sign(body) })).toBe(true);
    expect(mock.verifyWebhook(Buffer.from('{"a":2}'), { [MOCK_SIGNATURE_HEADER]: mock.sign(body) })).toBe(false);
    expect(mock.verifyWebhook(body, {})).toBe(false);
    expect(mock.verifyWebhook(body, { [MOCK_SIGNATURE_HEADER]: new MockPaymentProvider('another-secret-456').sign(body) })).toBe(false);
  });

  it('builds a signed PAID event that parses back', () => {
    const { body, headers } = mock.buildEvent({ intent_id: INTENT, amount: 500, outcome: 'PAID' });
    expect(mock.verifyWebhook(body, headers)).toBe(true);
    const ev = mock.parseWebhook(body);
    expect(ev).toMatchObject({ type: 'PAID', raw_type: 'payment.paid', intent_id: INTENT, provider_ref: `mock_${INTENT}`, amount: 500 });
    expect(ev.paid_at).toEqual(expect.any(String));
    expect(ev.event_id).toMatch(/^evt_mock_/);
  });

  it('builds a FAILED event with the mock decline code', () => {
    const ev = mock.parseWebhook(mock.buildEvent({ intent_id: INTENT, amount: 500, outcome: 'FAILED' }).body);
    expect(ev).toMatchObject({ type: 'FAILED', paid_at: null, failure_code: 'MOCK_DECLINED', failure_message: 'จำลองการชำระไม่สำเร็จ' });
  });

  it('rejects invalid JSON and a non-uuid intent id', () => {
    expect(() => mock.parseWebhook(Buffer.from('not json'))).toThrow();
    const bad = { id: 'evt_1', type: 'payment.paid', intent_id: 'abc', amount: 500, created_at: new Date().toISOString() };
    expect(() => mock.parseWebhook(Buffer.from(JSON.stringify(bad)))).toThrow();
  });

  it('opens the in-app checkout page', async () => {
    const out = await mock.createCheckout({
      intent_id: INTENT,
      booking_id: BOOKING,
      booking_code: 'NL-ABC123',
      bar_name: 'ร้านทดสอบ',
      amount: 500,
      currency: 'THB',
      description: 'Table Fee NL-ABC123 · ร้านทดสอบ',
      expires_at: '2026-10-13T20:30:00.000Z',
      return_url: null,
      customer_email: null,
    });
    expect(out).toEqual({ provider_ref: `mock_${INTENT}`, checkout_url: `/pay/mock/${INTENT}`, expires_at: '2026-10-13T20:30:00.000Z' });
  });
});

describe('BeamPaymentProvider (stub)', () => {
  it('is not ready and never accepts a webhook', async () => {
    const beam = new BeamPaymentProvider();
    expect(beam.ready).toBe(false);
    expect(beam.verifyWebhook()).toBe(false);
    expect((await failure(beam.createCheckout())).code).toBe('PAYMENT_PROVIDER_NOT_READY');
  });
});

describe('createPaymentProvider', () => {
  const log = { warn: vi.fn() };
  beforeEach(() => log.warn.mockReset());

  it('returns null when PAYMENT_PROVIDER is unset', () => {
    expect(createPaymentProvider({}, log)).toBeNull();
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('uses mock in development (dev secret when none is set)', () => {
    const p = createPaymentProvider({ PAYMENT_PROVIDER: 'mock', NODE_ENV: 'development' }, log);
    expect(p).toBeInstanceOf(MockPaymentProvider);
    const body = Buffer.from('x');
    expect((p as MockPaymentProvider).sign(body)).toBe(new MockPaymentProvider(DEV_MOCK_WEBHOOK_SECRET).sign(body));
  });

  it('blocks mock on a deploy unless explicitly allowed', () => {
    expect(createPaymentProvider({ PAYMENT_PROVIDER: 'mock', NODE_ENV: 'production', PAYMENT_WEBHOOK_SECRET: SECRET }, log)).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(createPaymentProvider({ PAYMENT_PROVIDER: 'mock', VERCEL: '1', PAYMENT_ALLOW_MOCK_IN_PRODUCTION: 'false' }, log)).toBeNull();
  });

  it('needs a webhook secret for mock on a deploy', () => {
    expect(createPaymentProvider({ PAYMENT_PROVIDER: 'mock', NODE_ENV: 'production', PAYMENT_ALLOW_MOCK_IN_PRODUCTION: 'true' }, log)).toBeNull();
    expect(log.warn).toHaveBeenCalledTimes(1);
    const p = createPaymentProvider(
      { PAYMENT_PROVIDER: 'mock', NODE_ENV: 'production', PAYMENT_ALLOW_MOCK_IN_PRODUCTION: 'true', PAYMENT_WEBHOOK_SECRET: SECRET },
      log,
    );
    expect(p).toBeInstanceOf(MockPaymentProvider);
  });

  it('falls back to the slip flow for the beam stub', () => {
    expect(createPaymentProvider({ PAYMENT_PROVIDER: 'beam', NODE_ENV: 'development' }, log)).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('stub'));
  });
});

describe('paymentReturnUrl', () => {
  it('points back to the deposit page with ?payment=return', () => {
    expect(paymentReturnUrl('https://nightout.day', BOOKING)).toBe(`https://nightout.day/bookings/${BOOKING}/deposit?payment=return`);
  });
});

describe('PaymentService', () => {
  let rpc: Mock;
  let rpcAs: Mock;

  function makeService(env: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = { NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:5173,http://localhost:5174', ...env };
    const config = { get: (key: string) => values[key] };
    const db = { rpc, rpcAs };
    return new PaymentService(db as unknown as SupabaseService, config as unknown as ConfigService);
  }
  const mockEnv = { PAYMENT_PROVIDER: 'mock', PAYMENT_WEBHOOK_SECRET: SECRET };
  const startRow = (over: Record<string, unknown> = {}) => ({
    intent_id: INTENT,
    provider: 'mock',
    amount: 500,
    expires_at: '2026-10-13T20:30:00+00:00',
    checkout_url: null,
    reused: false,
    booking_id: BOOKING,
    booking_code: 'NL-ABC123',
    bar_name: 'ร้านทดสอบ',
    customer_email: 'me@nightout.test',
    ...over,
  });

  beforeEach(() => {
    rpc = vi.fn();
    rpcAs = vi.fn();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the slip flow when no provider is configured', async () => {
    const s = makeService();
    expect(s.config()).toEqual({ mode: 'SLIP', provider: null, provider_label: null });
    expect(s.isProviderMode()).toBe(false);
    const f = await failure(s.startCheckout(ME, BOOKING));
    expect(f.error).toBeInstanceOf(ServiceUnavailableException);
    expect(f).toMatchObject({ status: 503, code: 'PAYMENT_PROVIDER_NOT_CONFIGURED' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('reports provider mode with the mock label', () => {
    const s = makeService(mockEnv);
    expect(s.isProviderMode()).toBe(true);
    expect(s.config()).toMatchObject({ mode: 'PROVIDER', provider: 'mock' });
    expect(s.config().provider_label).toContain('จำลอง');
  });

  it('builds the return url from WEB_APP_URL, else an allowed request origin', () => {
    expect(makeService({ WEB_APP_URL: 'https://nightout.day/some/path' }).returnBase('https://evil.example')).toBe('https://nightout.day');
    const s = makeService();
    expect(s.returnBase('http://localhost:5173')).toBe('http://localhost:5173');
    expect(s.returnBase('https://evil.example')).toBeNull();
    expect(s.returnBase(undefined)).toBeNull();
  });

  it('reuses an open checkout without calling the provider again', async () => {
    const s = makeService(mockEnv);
    const create = vi.spyOn(MockPaymentProvider.prototype, 'createCheckout');
    rpc.mockResolvedValueOnce(startRow({ reused: true, checkout_url: `/pay/mock/${INTENT}` }));
    const out = await s.startCheckout(ME, BOOKING, 'http://localhost:5173');
    expect(out).toEqual({
      intent_id: INTENT,
      provider: 'mock',
      amount: 500,
      expires_at: '2026-10-13T20:30:00+00:00',
      checkout_url: `/pay/mock/${INTENT}`,
      reused: true,
    });
    expect(create).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('app_payment_start', {
      p_actor: ME.id,
      p_booking: BOOKING,
      p_provider: 'mock',
      p_return_url: `http://localhost:5173/bookings/${BOOKING}/deposit?payment=return`,
    });
  });

  it('creates a checkout and attaches it to the intent', async () => {
    const s = makeService(mockEnv);
    rpc
      .mockResolvedValueOnce(startRow({ amount: '500.00' }))
      .mockResolvedValueOnce({ intent_id: INTENT, provider: 'mock', amount: 500, expires_at: '2026-10-13T20:20:00+00:00', checkout_url: `/pay/mock/${INTENT}` });
    const out = await s.startCheckout(ME, BOOKING);
    expect(out).toEqual({
      intent_id: INTENT,
      provider: 'mock',
      amount: 500,
      expires_at: '2026-10-13T20:20:00+00:00',
      checkout_url: `/pay/mock/${INTENT}`,
      reused: false,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'app_payment_start', expect.objectContaining({ p_return_url: null }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_payment_attach', {
      p_actor: ME.id,
      p_intent: INTENT,
      p_provider_ref: `mock_${INTENT}`,
      p_checkout_url: `/pay/mock/${INTENT}`,
      p_expires_at: '2026-10-13T20:30:00+00:00',
      p_error: null,
    });
  });

  it('marks the intent failed and answers 502 when the provider errors', async () => {
    const s = makeService(mockEnv);
    vi.spyOn(MockPaymentProvider.prototype, 'createCheckout').mockRejectedValueOnce(new Error('connect ETIMEDOUT'));
    rpc.mockResolvedValueOnce(startRow()).mockResolvedValueOnce({ intent_id: INTENT, status: 'FAILED' });
    const f = await failure(s.startCheckout(ME, BOOKING));
    expect(f.error).toBeInstanceOf(BadGatewayException);
    expect(f).toMatchObject({ status: 502, code: 'PAYMENT_PROVIDER_ERROR' });
    expect(rpc).toHaveBeenNthCalledWith(2, 'app_payment_attach', expect.objectContaining({ p_intent: INTENT, p_checkout_url: null, p_error: 'connect ETIMEDOUT' }));
  });

  it('keeps the provider HttpException (e.g. not ready) as-is', async () => {
    const s = makeService(mockEnv);
    vi.spyOn(MockPaymentProvider.prototype, 'createCheckout').mockRejectedValueOnce(new ServiceUnavailableException('PAYMENT_PROVIDER_NOT_READY'));
    rpc.mockResolvedValueOnce(startRow()).mockRejectedValueOnce(new Error('db down'));
    const f = await failure(s.startCheckout(ME, BOOKING));
    expect(f).toMatchObject({ status: 503, code: 'PAYMENT_PROVIDER_NOT_READY' });
  });

  it('answers 404 for a webhook of another provider', async () => {
    const s = makeService(mockEnv);
    const f = await failure(s.handleWebhook('beam', Buffer.from('{}'), {}));
    expect(f.error).toBeInstanceOf(NotFoundException);
    expect(f.code).toBe('PAYMENT_PROVIDER_UNKNOWN');
    expect((await failure(makeService().handleWebhook('mock', Buffer.from('{}'), {}))).code).toBe('PAYMENT_PROVIDER_UNKNOWN');
  });

  it('rejects an empty body and a bad signature without touching the DB', async () => {
    const s = makeService(mockEnv);
    expect(await failure(s.handleWebhook('mock', undefined, {}))).toMatchObject({ status: 400, code: 'PAYMENT_WEBHOOK_INVALID' });
    const { body } = new MockPaymentProvider(SECRET).buildEvent({ intent_id: INTENT, amount: 500, outcome: 'PAID' });
    const f = await failure(s.handleWebhook('mock', body, { [MOCK_SIGNATURE_HEADER]: 'sha256=deadbeef' }));
    expect(f.error).toBeInstanceOf(UnauthorizedException);
    expect(f).toMatchObject({ status: 401, code: 'PAYMENT_SIGNATURE_INVALID' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a signed body that is not a valid event', async () => {
    const s = makeService(mockEnv);
    const body = Buffer.from('{"id":"x"}');
    const headers = { [MOCK_SIGNATURE_HEADER]: new MockPaymentProvider(SECRET).sign(body) };
    expect(await failure(s.handleWebhook('mock', body, headers))).toMatchObject({ status: 400, code: 'PAYMENT_WEBHOOK_INVALID' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('applies a valid signed webhook through payment_apply_event', async () => {
    const s = makeService(mockEnv);
    rpc.mockResolvedValueOnce({ duplicate: false, intent_id: INTENT, result: 'CONFIRMED' });
    const { body, headers } = new MockPaymentProvider(SECRET).buildEvent({ intent_id: INTENT, amount: 500, outcome: 'PAID' });
    const out = await s.handleWebhook('mock', body, headers);
    expect(out).toEqual({ duplicate: false, intent_id: INTENT, result: 'CONFIRMED' });
    expect(rpc).toHaveBeenCalledWith(
      'payment_apply_event',
      expect.objectContaining({
        p_provider: 'mock',
        p_event_type: 'PAID',
        p_raw_type: 'payment.paid',
        p_intent: INTENT,
        p_provider_ref: `mock_${INTENT}`,
        p_amount: 500,
        p_failure_code: null,
        p_failure_message: null,
        p_paid_at: expect.any(String),
        p_payload: expect.objectContaining({ intent_id: INTENT, type: 'payment.paid' }),
      }),
    );
  });

  it('truncates a payload that would break the 64 KB DB check', async () => {
    const s = makeService(mockEnv);
    rpc.mockResolvedValueOnce({ duplicate: false, intent_id: INTENT, result: 'CONFIRMED' });
    vi.spyOn(MockPaymentProvider.prototype, 'parseWebhook').mockReturnValueOnce({
      event_id: 'evt_big',
      type: 'PAID',
      raw_type: 'payment.paid',
      intent_id: INTENT,
      provider_ref: null,
      amount: 500,
      paid_at: new Date().toISOString(),
      payload: { blob: 'x'.repeat(PAYMENT_PAYLOAD_MAX_CHARS + 1) },
    });
    const { body, headers } = new MockPaymentProvider(SECRET).buildEvent({ intent_id: INTENT, amount: 500, outcome: 'PAID' });
    await s.handleWebhook('mock', body, headers);
    expect(rpc).toHaveBeenCalledWith('payment_apply_event', expect.objectContaining({ p_payload: { truncated: true } }));
  });

  it('drops an intent id that is not a uuid (DB matches by provider_ref instead)', async () => {
    const s = makeService(mockEnv);
    rpc.mockResolvedValueOnce({ duplicate: false, intent_id: null, result: 'NOT_FOUND' });
    vi.spyOn(MockPaymentProvider.prototype, 'parseWebhook').mockReturnValueOnce({
      event_id: 'evt_ref',
      type: 'PAID',
      raw_type: 'payment.paid',
      intent_id: 'not-a-uuid',
      provider_ref: 'ref_1',
      amount: 500,
      paid_at: null,
      payload: {},
    });
    const { body, headers } = new MockPaymentProvider(SECRET).buildEvent({ intent_id: INTENT, amount: 500, outcome: 'PAID' });
    await s.handleWebhook('mock', body, headers);
    expect(rpc).toHaveBeenCalledWith('payment_apply_event', expect.objectContaining({ p_intent: null, p_provider_ref: 'ref_1' }));
  });

  describe('completeMock', () => {
    const intentRow = (status: string) => ({ id: INTENT, booking_id: BOOKING, provider: 'mock', status, amount: 500 });

    it('is disabled unless the mock provider is active', async () => {
      const f = await failure(makeService().completeMock('token', INTENT, 'PAID'));
      expect(f).toMatchObject({ status: 404, code: 'PAYMENT_MOCK_DISABLED' });
      expect(rpcAs).not.toHaveBeenCalled();
    });

    it('needs an own PENDING intent', async () => {
      const s = makeService(mockEnv);
      rpcAs.mockResolvedValueOnce([]);
      expect(await failure(s.completeMock('token', INTENT, 'PAID'))).toMatchObject({ status: 404, code: 'PAYMENT_INTENT_NOT_FOUND' });
      rpcAs.mockResolvedValueOnce([intentRow('EXPIRED')]);
      expect(await failure(s.completeMock('token', INTENT, 'PAID'))).toMatchObject({ status: 409, code: 'PAYMENT_INTENT_NOT_PENDING' });
      expect(rpc).not.toHaveBeenCalled();
    });

    it('sends a signed event through the webhook path', async () => {
      const s = makeService(mockEnv);
      rpcAs.mockResolvedValueOnce([intentRow('PENDING')]);
      rpc.mockResolvedValueOnce({ duplicate: false, intent_id: INTENT, result: 'FAILED' });
      const out = await s.completeMock('token', INTENT, 'FAILED');
      expect(out.result).toBe('FAILED');
      expect(rpcAs).toHaveBeenCalledWith('token', 'my_payment_intents', { p_booking: null, p_intent: INTENT });
      expect(rpc).toHaveBeenCalledWith(
        'payment_apply_event',
        expect.objectContaining({ p_provider: 'mock', p_event_type: 'FAILED', p_intent: INTENT, p_amount: 500, p_failure_code: 'MOCK_DECLINED' }),
      );
    });
  });
});
