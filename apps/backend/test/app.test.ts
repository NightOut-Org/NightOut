import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

describe('NightOut API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // rawBody เหมือน bootstrap.ts (webhook ชำระเงินตรวจลายเซ็นจาก body ดิบ)
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', status_code: 200, code: null, err_msg: null, data: { status: 'ok' } });
  });

  it('POST /pricing/estimate validates and calculates', async () => {
    const res = await request(app.getHttpServer())
      .post('/pricing/estimate')
      .send({
        items: [{ name: 'set', qty: 2, unit_price: 1000 }],
        fees: { service_charge_rate: 10, vat_rate: 7, other_fees: 0 },
        pax: 4,
      })
      .expect(200);
    expect(res.body.data.estimated_total).toBe(2354);
    expect(res.body.data.per_person).toBe(588.5);
  });

  it('POST /pricing/estimate rejects invalid body', async () => {
    const res = await request(app.getHttpServer()).post('/pricing/estimate').send({ pax: 0 }).expect(400);
    // ทุก error เป็น ApiResponse เดียวกัน — err_msg ภาษาไทยพร้อมชื่อ field
    expect(res.body).toMatchObject({ status: 'no', status_code: 400, data: null, code: 'VALIDATION_FAILED' });
    expect(res.body.err_msg).toContain('ข้อมูลที่ส่งมาไม่ถูกต้อง');
  });

  // error ของ Nest ที่ไม่มีรหัสของเรา (route ไม่มี / guard) → รหัสตาม HTTP status + ข้อความไทย (ไม่หลุดข้อความอังกฤษถึงผู้ใช้)
  it('maps Nest errors without our code to HTTP_* codes with Thai messages', async () => {
    const res = await request(app.getHttpServer()).get('/no-such-route').expect(404);
    expect(res.body).toMatchObject({ status: 'no', status_code: 404, data: null, code: 'HTTP_NOT_FOUND', err_msg: 'ไม่พบข้อมูลที่ขอ' });
  });

  it('POST /jobs/* requires the job secret', async () => {
    await request(app.getHttpServer()).post('/jobs/booking-timeouts').expect(401);
    await request(app.getHttpServer())
      .post('/jobs/booking-timeouts')
      .set('x-job-secret', 'test-job-secret')
      .expect(200);
  });

  // ADR 0002: หน้าเว็บอ่านข้อมูลผ่าน API — endpoint ของผู้ใช้ต้องล็อกอิน · ข้อมูลที่ส่งมาต้องผ่าน validation
  it('GET /me/* requires a bearer token', async () => {
    const res = await request(app.getHttpServer()).get('/me/overview').expect(401);
    expect(res.body).toMatchObject({ status: 'no', status_code: 401, data: null, code: 'HTTP_UNAUTHORIZED', err_msg: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
    await request(app.getHttpServer()).get('/me/profile').expect(401);
    await request(app.getHttpServer()).get('/merchant/bars/00000000-0000-4000-8000-000000000000/team').expect(401);
    await request(app.getHttpServer()).put('/merchant/bars/00000000-0000-4000-8000-000000000000/safety').send({ items: [] }).expect(401);
    await request(app.getHttpServer()).put('/merchant/bars/00000000-0000-4000-8000-000000000000/settings').send({ booking: {} }).expect(401);
    await request(app.getHttpServer()).put('/merchant/bars/00000000-0000-4000-8000-000000000000/media').send({ paths: [], cover_path: null }).expect(401);
    await request(app.getHttpServer()).put('/merchant/bars/00000000-0000-4000-8000-000000000000/store').send({ media: { paths: [], cover_path: null } }).expect(401);
    await request(app.getHttpServer()).post('/storage/upload-url').send({ bucket: 'deposit-slips', path: 'a/b.jpg' }).expect(401);
    await request(app.getHttpServer()).post('/bookings/00000000-0000-4000-8000-000000000000/extend').expect(401);
    await request(app.getHttpServer()).post('/share-cards/abc123/join').expect(401);
    await request(app.getHttpServer()).get('/merchant/bars/00000000-0000-4000-8000-000000000000/safety/inspection').expect(401);
    await request(app.getHttpServer()).get('/merchant/bars/00000000-0000-4000-8000-000000000000/table-board').expect(401);
    await request(app.getHttpServer()).post('/merchant/tables/00000000-0000-4000-8000-000000000000/occupancy').send({ in_use: true }).expect(401);
    await request(app.getHttpServer()).get('/merchant/bars/00000000-0000-4000-8000-000000000000/sales-stats?days=30').expect(401);
  });

  it('GET /admin/* (reads) requires a bearer token', async () => {
    await request(app.getHttpServer()).get('/admin/dashboard').expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_bars').expect(401);
    await request(app.getHttpServer()).get('/admin/master/styles').expect(401);
    await request(app.getHttpServer()).get('/admin/roles').expect(401);
    await request(app.getHttpServer()).patch('/admin/users/roles').send({ changes: [] }).expect(401);
    await request(app.getHttpServer()).post('/admin/team-members').send({ nickname: 'x' }).expect(401);
    await request(app.getHttpServer()).post('/admin/users').send({ email: 'a@b.co' }).expect(401);
    await request(app.getHttpServer()).patch('/admin/team-members').send({ order: [] }).expect(401);
    await request(app.getHttpServer()).patch('/admin/bars/status').send({ changes: [] }).expect(401);
    await request(app.getHttpServer()).put('/admin/site-nav').send({ items: [] }).expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_bar_media').expect(401);
    await request(app.getHttpServer()).put('/admin/bars/00000000-0000-4000-8000-000000000000/media').send({ gallery: { paths: [], cover_path: null } }).expect(401);
    await request(app.getHttpServer()).post('/admin/bars/00000000-0000-4000-8000-000000000000/safety-inspections').send({ items: [] }).expect(401);
    await request(app.getHttpServer()).post('/admin/safety/00000000-0000-4000-8000-000000000000/verify').expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_safety_inspections').expect(401);
    await request(app.getHttpServer()).get('/admin/bars/00000000-0000-4000-8000-000000000000/table-board').expect(401);
  });

  it('read endpoints validate input before touching Supabase', async () => {
    await request(app.getHttpServer()).get('/bars/not-a-uuid/zone-availability?datetime=2026-10-03T20:00:00%2B07:00').expect(400);
    await request(app.getHttpServer()).get('/bars/00000000-0000-4000-8000-000000000000/zone-availability').expect(400);
    await request(app.getHttpServer()).post('/storage/signed-urls').send({ bucket: 'secret-bucket', paths: ['x/y.jpg'] }).expect(400);
    await request(app.getHttpServer()).post('/storage/signed-urls').send({ bucket: 'review-media', paths: ['../etc/passwd'] }).expect(400);
  });

  // เช็กอิน (ดูก่อนยืนยัน) · ร้านไม่มีโต๊ะ · Blacklist ร้าน (migration 20261013000700 / 000710) — ต้องล็อกอินก่อนถึง DB
  it('check-in preview, no-table and blacklist endpoints require a bearer token', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).get(`/merchant/bars/${id}/check-in/preview?code=NL-ABC123`).expect(401);
    await request(app.getHttpServer()).post(`/merchant/bookings/${id}/no-table`).send({ note: null }).expect(401);
    await request(app.getHttpServer()).post(`/admin/bars/${id}/blacklist`).send({ reason: 'ไม่มีโต๊ะให้ลูกค้า' }).expect(401);
    await request(app.getHttpServer()).post(`/admin/bars/${id}/blacklist/lift`).send({ reason: 'ร้านแก้ไขแล้ว' }).expect(401);
    await request(app.getHttpServer()).post('/admin/bar-strikes').send({ booking_code: 'NL-ABC123', note: 'ลูกค้าร้องเรียน' }).expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_bar_blacklist').expect(401);
  });

  // ทีมร้านปลดโต๊ะเองเมื่อเลยเวลาเก็บโต๊ะ (migration 20261013001500) — ต้องล็อกอินก่อนถึง DB
  it('team forfeit endpoint requires a bearer token', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).post(`/merchant/bookings/${id}/forfeit`).expect(401);
  });

  // แอดมิน: แก้ข้อมูลร้านแทน · สไตล์ร้าน · แบนเอง · คำนวณอันดับ (migration 20261013001000–001030)
  it('admin tools (details on behalf, styles, ban, ranking) require a bearer token', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).put('/admin/styles').send({ items: [] }).expect(401);
    await request(app.getHttpServer()).post('/admin/ranking/recompute').expect(401);
    await request(app.getHttpServer()).put(`/admin/bars/${id}/details`).send({ menu: [] }).expect(401);
    await request(app.getHttpServer()).post(`/admin/users/${id}/ban`).send({ reason: 'สแปมชุมชน' }).expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_ranking').expect(401);
    await request(app.getHttpServer()).get('/admin/master/districts').expect(401);
  });

  it('POST /jobs/tier requires the job secret', async () => {
    await request(app.getHttpServer()).post('/jobs/tier').expect(401);
    await request(app.getHttpServer()).post('/jobs/tier').set('x-job-secret', 'test-job-secret').expect(200);
  });

  it('GET /public/ranking validates the query', async () => {
    const res = await request(app.getHttpServer()).get('/public/ranking?period=YEARLY').expect(400);
    expect(res.body).toMatchObject({ status: 'no', status_code: 400, data: null, code: 'VALIDATION_FAILED' });
  });

  // ชำระ Table Fee ออนไลน์ (domains/payment · migration 20261013001100) — เทสต์ไม่ตั้ง PAYMENT_PROVIDER = flow สลิปเดิม
  it('GET /payments/config reports the slip flow when PAYMENT_PROVIDER is unset', async () => {
    const res = await request(app.getHttpServer()).get('/payments/config').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', data: { mode: 'SLIP', provider: null, provider_label: null } });
  });

  it('POST /payments/webhook/:provider answers 404 for a provider that is not enabled', async () => {
    const res = await request(app.getHttpServer()).post('/payments/webhook/mock').send({}).expect(404);
    expect(res.body).toMatchObject({ status: 'no', status_code: 404, data: null, code: 'PAYMENT_PROVIDER_UNKNOWN' });
  });

  it('payment endpoints for customers and admins require a bearer token', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).post(`/bookings/${id}/checkout`).expect(401);
    await request(app.getHttpServer()).get(`/bookings/${id}/payments`).expect(401);
    await request(app.getHttpServer()).get(`/payments/intents/${id}`).expect(401);
    await request(app.getHttpServer()).post(`/payments/mock/${id}/complete`).send({ outcome: 'PAID' }).expect(401);
    await request(app.getHttpServer()).post(`/admin/payments/${id}/refunded`).send({ note: 'คืนผ่าน dashboard' }).expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_payment_intents').expect(401);
  });

  // Native Mini-Ads (domains/mini-ads · migration 20261013001300) — Backoffice ต้องล็อกอิน · หน้าสาธารณะตรวจ query/body ก่อนถึง DB
  it('mini-ads admin endpoints require a bearer token', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).post('/admin/mini-ads').send({}).expect(401);
    await request(app.getHttpServer()).patch(`/admin/mini-ads/${id}`).send({ active: false }).expect(401);
    await request(app.getHttpServer()).delete(`/admin/mini-ads/${id}`).expect(401);
    await request(app.getHttpServer()).get('/admin/views/admin_mini_ads').expect(401);
  });

  it('public mini-ads endpoints validate input before touching Supabase', async () => {
    const id = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).get('/public/mini-ads?placement=MAP').expect(400);
    await request(app.getHttpServer()).get('/public/mini-ads').expect(400);
    await request(app.getHttpServer()).post('/public/mini-ads/not-a-uuid/track').send({ event: 'CLICK', placement: 'HOME' }).expect(400);
    await request(app.getHttpServer()).post(`/public/mini-ads/${id}/track`).send({ event: 'VIEW', placement: 'HOME' }).expect(400);
  });
});
