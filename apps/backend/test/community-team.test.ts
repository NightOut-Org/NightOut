import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

const ID = '00000000-0000-4000-8000-000000000000';

/** ชุมชน · สิทธิ์ทีมร้าน — เส้นใหม่/เส้นที่เปลี่ยนต้องล็อกอินก่อน (กติกา reason ของ HIDE/REMOVE ตรวจใน contracts.test.ts) */
describe('community shop-team endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('GET /me/community/team requires a bearer token', async () => {
    const res = await request(app.getHttpServer()).get('/me/community/team').expect(401);
    expect(res.body).toMatchObject({ status: 'no', status_code: 401, data: null, code: 'Missing bearer token' });
  });

  it('PUT /community/threads/:id/like requires a bearer token', async () => {
    await request(app.getHttpServer()).put(`/community/threads/${ID}/like`).send({ on: true }).expect(401);
  });

  it('POST /admin/community/threads/:id/moderate requires a bearer token (guards run before the body pipe)', async () => {
    await request(app.getHttpServer()).post(`/admin/community/threads/${ID}/moderate`).send({ action: 'HIDE' }).expect(401);
  });
});
