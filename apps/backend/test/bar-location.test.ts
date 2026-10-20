import type { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { AppModule } from '../src/app.module';
import { SupabaseJwtGuard, type AuthedRequest } from '../src/auth/supabase-jwt.guard';

// ConfigModule อ่าน env ตอน import AppModule — ปิดการเว้นระยะเรียก Nominatim ในเทสต์ (ค่าจริง 1100 ms) · ชี้ไป host ปลอม
vi.hoisted(() => {
  vi.stubEnv('GEOCODER_MIN_INTERVAL_MS', '0');
  vi.stubEnv('GEOCODER_URL', 'https://geo.test');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const BAR = '00000000-0000-4000-8000-000000000000';
const LOCATION = { lat: 13.7563, lng: 100.5018, address: 'ซอยอารีย์ 1 พญาไท กรุงเทพฯ' };

/** ตำแหน่งร้าน (หมุด) + ค้นหาที่อยู่ — ทุกเส้นต้องล็อกอิน (ADR 0002) · geocode ไม่เปิดให้คนไม่ล็อกอินใช้ Nominatim ผ่านเรา */
describe('bar location + geocode endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('GET /geocode/* requires a bearer token', async () => {
    const res = await request(app.getHttpServer()).get('/geocode/search').query({ q: 'สยาม' }).expect(401);
    expect(res.body).toMatchObject({ status: 'no', status_code: 401, data: null, code: 'HTTP_UNAUTHORIZED', err_msg: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
    await request(app.getHttpServer()).get('/geocode/reverse').query({ lat: 13.7, lng: 100.5 }).expect(401);
  });

  it('merchant location endpoints require a bearer token', async () => {
    await request(app.getHttpServer()).put(`/merchant/bars/${BAR}/location`).send(LOCATION).expect(401);
    await request(app.getHttpServer()).delete(`/merchant/bars/${BAR}/location-request`).expect(401);
  });

  it('admin location endpoints require a bearer token', async () => {
    await request(app.getHttpServer()).put(`/admin/bars/${BAR}/location`).send(LOCATION).expect(401);
    await request(app.getHttpServer()).post(`/admin/bar-location-requests/${BAR}/review`).send({ approve: true }).expect(401);
  });
});

/** ล็อกอินแล้ว (guard ปลอม) + Nominatim ปลอม (stub fetch) — ตรวจ DTO / รูปคำตอบ / รหัส error ผ่าน ApiExceptionFilter จริง */
describe('geocode proxy (signed in)', () => {
  let fetchMock: Mock<typeof fetch>;

  async function createApp(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(SupabaseJwtGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest<AuthedRequest>().user = { id: BAR };
          return true;
        },
      })
      .compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    return app;
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('validation + response', () => {
    let app: INestApplication;
    beforeAll(async () => {
      app = await createApp();
    });
    afterAll(async () => {
      await app?.close();
    });

    it('GET /geocode/search returns Thai places in the ApiResponse envelope (default limit 5)', async () => {
      fetchMock.mockResolvedValue(
        json([
          { display_name: 'สยามพารากอน, ถนนพระรามที่ 1, กรุงเทพมหานคร, ประเทศไทย', lat: '13.7462463', lon: '100.534714', type: 'mall' },
          { display_name: 'Tokyo, Japan', lat: '35.68', lon: '139.69', type: 'city' },
        ]),
      );
      const res = await request(app.getHttpServer()).get('/geocode/search').query({ q: 'สยามพารากอน' }).expect(200);

      expect(res.body).toMatchObject({
        status: 'ok',
        data: { results: [{ label: 'สยามพารากอน, ถนนพระรามที่ 1, กรุงเทพมหานคร', lat: 13.746246, lng: 100.534714, kind: 'mall' }] },
      });
      expect(res.body.data.results).toHaveLength(1);
      const url = new URL(String(fetchMock.mock.calls[0]![0]));
      expect(url.origin + url.pathname).toBe('https://geo.test/search');
      expect(url.searchParams.get('limit')).toBe('5');
      expect(url.searchParams.get('countrycodes')).toBe('th');
    });

    it('rejects too-short queries and pins outside Thailand before calling Nominatim', async () => {
      const short = await request(app.getHttpServer()).get('/geocode/search').query({ q: 'a' }).expect(400);
      expect(short.body).toMatchObject({ status: 'no', code: 'VALIDATION_FAILED' });
      await request(app.getHttpServer()).get('/geocode/search').query({ q: 'สยาม', limit: 50 }).expect(400);
      await request(app.getHttpServer()).get('/geocode/reverse').query({ lat: 35.68, lng: 139.69 }).expect(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('GET /geocode/reverse coerces the query and returns label null when nothing is found', async () => {
      fetchMock.mockResolvedValue(json({ error: 'Unable to geocode' }));
      const res = await request(app.getHttpServer()).get('/geocode/reverse').query({ lat: '13.75', lng: '100.5' }).expect(200);
      expect(res.body.data).toEqual({ label: null, lat: 13.75, lng: 100.5 });
    });

    it('maps upstream failures to 503 with GEOCODER_* codes (not TOO_MANY_REQUESTS)', async () => {
      fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
      const busy = await request(app.getHttpServer()).get('/geocode/search').query({ q: 'ทองหล่อ' }).expect(503);
      expect(busy.body).toMatchObject({ status: 'no', status_code: 503, code: 'GEOCODER_BUSY', err_msg: 'ค้นหาที่อยู่ถี่เกินไป รอสักครู่แล้วลองใหม่' });

      fetchMock.mockResolvedValueOnce(new Response('down', { status: 500 }));
      const down = await request(app.getHttpServer()).get('/geocode/search').query({ q: 'ทองหล่อ' }).expect(503);
      expect(down.body).toMatchObject({ code: 'GEOCODER_UNAVAILABLE', err_msg: 'ค้นหาที่อยู่ไม่ได้ชั่วคราว — ลากหมุดหรือวางพิกัดเองได้' });
    });

    it('PUT /merchant/bars/:barId/location validates the pin before the DB', async () => {
      const res = await request(app.getHttpServer())
        .put(`/merchant/bars/${BAR}/location`)
        .send({ ...LOCATION, lat: 35.68, lng: 139.69 })
        .expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(res.body.err_msg).toContain('lat');
    });
  });

  it('limits geocode calls to 30 per minute per IP', async () => {
    const app = await createApp();
    try {
      fetchMock.mockImplementation(async () => json({ display_name: 'อารีย์, กรุงเทพมหานคร, ประเทศไทย' }));
      for (let i = 0; i < 30; i++) {
        await request(app.getHttpServer()).get('/geocode/reverse').query({ lat: 13.78, lng: 100.54 }).expect(200);
      }
      const res = await request(app.getHttpServer()).get('/geocode/reverse').query({ lat: 13.78, lng: 100.54 }).expect(429);
      expect(res.body).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
      expect(fetchMock).toHaveBeenCalledTimes(1); // ที่เหลือมาจาก cache
    } finally {
      await app.close();
    }
  });
});
