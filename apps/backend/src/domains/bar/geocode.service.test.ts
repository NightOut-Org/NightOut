import { Logger, ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { GeocodeService } from './geocode.service';

const BASE = 'https://geo.test';
const UA = 'NightOut-test/1.0 (+https://nightout.test)';

/** ConfigService ปลอม — ค่าเหมือน env ที่ผ่าน EnvSchema แล้ว (GEOCODER_MIN_INTERVAL_MS = 0 ไม่ต้องรอคิวในเทสต์) */
function makeService(env: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    GEOCODER_URL: BASE,
    GEOCODER_USER_AGENT: UA,
    GEOCODER_MIN_INTERVAL_MS: 0,
    ...env,
  };
  const config = {
    get: (key: string) => values[key],
    getOrThrow: (key: string) => {
      if (values[key] === undefined) throw new Error(`missing ${key}`);
      return values[key];
    },
  };
  return new GeocodeService(config as unknown as ConfigService);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const SIAM = {
  display_name: 'สยามพารากอน, ถนนพระรามที่ 1, แขวงปทุมวัน, เขตปทุมวัน, กรุงเทพมหานคร, 10330, ประเทศไทย',
  lat: '13.7462463',
  lon: '100.5347140',
  type: 'mall',
  category: 'shop',
};
const TOKYO = { display_name: 'Tokyo, Japan', lat: '35.6812', lon: '139.7671', type: 'city' };

let fetchMock: Mock<typeof fetch>;
let warn: Mock;

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined) as unknown as Mock;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** URL + headers ของการเรียก fetch ครั้งที่ n */
function sent(n = 0) {
  const [input, init] = fetchMock.mock.calls[n]!;
  return { url: new URL(String(input)), headers: new Headers(init?.headers), init };
}

/** error ของ geocoder ต้องเป็น 503 + รหัสของตัวเอง (ห้าม 429 — ApiExceptionFilter เขียนรหัสทับเป็น TOO_MANY_REQUESTS) */
async function expectGeoError(p: Promise<unknown>, code: 'GEOCODER_BUSY' | 'GEOCODER_UNAVAILABLE') {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(ServiceUnavailableException);
  expect((e as ServiceUnavailableException).message).toBe(code);
  expect((e as ServiceUnavailableException).getStatus()).toBe(503);
}

describe('GeocodeService.search', () => {
  it('asks Nominatim for Thailand only and identifies itself', async () => {
    fetchMock.mockResolvedValue(json([]));
    await makeService().search('ซอยอารีย์ 1', 5);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, headers, init } = sent();
    expect(url.origin + url.pathname).toBe(`${BASE}/search`);
    expect(url.searchParams.get('q')).toBe('ซอยอารีย์ 1');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('countrycodes')).toBe('th');
    expect(url.searchParams.get('bounded')).toBe('1');
    expect(url.searchParams.get('viewbox')).toBe('97.3,20.6,105.7,5.5');
    expect(url.searchParams.get('accept-language')).toBe('th');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.has('email')).toBe(false);
    expect(headers.get('user-agent')).toBe(UA);
    expect(headers.get('accept-language')).toBe('th');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends the contact email when configured and keeps a sub-path base URL', async () => {
    fetchMock.mockResolvedValue(json([]));
    await makeService({ GEOCODER_URL: 'https://geo.test/nominatim', GEOCODER_EMAIL: 'ops@nightout.test' }).search('สยาม', 3);

    const { url } = sent();
    expect(url.origin + url.pathname).toBe('https://geo.test/nominatim/search');
    expect(url.searchParams.get('email')).toBe('ops@nightout.test');
    expect(url.searchParams.get('limit')).toBe('3');
  });

  it('strips ", ประเทศไทย" and drops results outside Thailand', async () => {
    fetchMock.mockResolvedValue(json([SIAM, TOKYO, { display_name: 'ไม่มีพิกัด' }]));
    const r = await makeService().search('สยาม', 5);

    expect(r).toEqual({
      results: [
        {
          label: 'สยามพารากอน, ถนนพระรามที่ 1, แขวงปทุมวัน, เขตปทุมวัน, กรุงเทพมหานคร, 10330',
          lat: 13.746246,
          lng: 100.534714,
          kind: 'mall',
        },
      ],
    });
  });

  it('falls back to category for kind, then null', async () => {
    fetchMock.mockResolvedValue(
      json([
        { ...SIAM, type: undefined },
        { ...SIAM, type: undefined, category: undefined },
      ]),
    );
    const r = await makeService().search('สยาม', 5);
    expect(r.results.map((p) => p.kind)).toEqual(['shop', null]);
  });

  it('serves a repeated search from cache (no second upstream call)', async () => {
    fetchMock.mockImplementation(async () => json([SIAM]));
    const geo = makeService();
    const first = await geo.search('Siam Paragon', 5);
    const second = await geo.search('  siam paragon ', 5);

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // limit ต่างกัน = คนละ cache
    await geo.search('Siam Paragon', 3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('expires cached results after 24 hours', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    fetchMock.mockImplementation(async () => json([SIAM]));
    const geo = makeService();

    await geo.search('สยาม', 5);
    vi.setSystemTime(new Date('2026-10-14T11:59:00Z'));
    await geo.search('สยาม', 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-10-14T12:00:01Z'));
    await geo.search('สยาม', 5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps at most 500 cached entries (oldest evicted first)', async () => {
    fetchMock.mockImplementation(async () => json([]));
    const geo = makeService();
    for (let i = 0; i <= 500; i++) await geo.search(`ซอย ${i}`, 5);
    expect(fetchMock).toHaveBeenCalledTimes(501);

    await geo.search('ซอย 500', 5); // ใหม่สุด — ยังอยู่
    expect(fetchMock).toHaveBeenCalledTimes(501);
    await geo.search('ซอย 0', 5); // เก่าสุด — ถูกทิ้งแล้ว
    expect(fetchMock).toHaveBeenCalledTimes(502);
  });

  it('URL-encodes the query (cannot inject extra params)', async () => {
    fetchMock.mockResolvedValue(json([]));
    await makeService().search('ซอย 1&limit=50#x', 5);

    const { url } = sent();
    expect(url.searchParams.getAll('q')).toEqual(['ซอย 1&limit=50#x']);
    expect(url.searchParams.getAll('limit')).toEqual(['5']);
    expect(url.hash).toBe('');
  });

  it('spaces upstream calls by GEOCODER_MIN_INTERVAL_MS and rejects a long queue with GEOCODER_BUSY', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined)); // Nominatim ค้าง
    const geo = makeService({ GEOCODER_MIN_INTERVAL_MS: 2000 });

    // 3 คำขอแรกเข้าคิวได้ (รอสูงสุด 4 วินาที) · คำขอที่ 4 ต้องรอ 6 วินาที > 5 วินาที → ปฏิเสธทันที
    void geo.search('ร้าน 1', 5);
    void geo.search('ร้าน 2', 5);
    void geo.search('ร้าน 3', 5);
    await expectGeoError(geo.search('ร้าน 4', 5), 'GEOCODER_BUSY');

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not queue cache hits', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(json([SIAM]));
    const geo = makeService({ GEOCODER_MIN_INTERVAL_MS: 2000 });
    await geo.search('สยาม', 5);

    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    void geo.search('ร้าน 1', 5);
    void geo.search('ร้าน 2', 5);
    void geo.search('ร้าน 3', 5);
    // คิวเต็มแล้ว แต่คำค้นที่ cache ไว้ยังตอบได้ทันที
    await expect(geo.search('สยาม', 5)).resolves.toMatchObject({ results: [{ kind: 'mall' }] });
  });

  it('maps upstream failures to 503 codes and does not cache them', async () => {
    const geo = makeService();

    fetchMock.mockResolvedValueOnce(new Response('oops', { status: 500 }));
    await expectGeoError(geo.search('สยาม', 5), 'GEOCODER_UNAVAILABLE');

    fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
    await expectGeoError(geo.search('สยาม', 5), 'GEOCODER_BUSY');

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await expectGeoError(geo.search('สยาม', 5), 'GEOCODER_UNAVAILABLE');

    fetchMock.mockRejectedValueOnce(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    await expectGeoError(geo.search('สยาม', 5), 'GEOCODER_UNAVAILABLE');

    fetchMock.mockResolvedValueOnce(new Response('<html>not json</html>', { status: 200 }));
    await expectGeoError(geo.search('สยาม', 5), 'GEOCODER_UNAVAILABLE');

    fetchMock.mockResolvedValueOnce(json({ error: 'unexpected' }));
    await expectGeoError(geo.search('สยาม', 5), 'GEOCODER_UNAVAILABLE');

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(warn).toHaveBeenCalled();
  });
});

describe('GeocodeService.reverse', () => {
  it('asks /reverse for the pin and strips the country suffix', async () => {
    fetchMock.mockResolvedValue(json(SIAM));
    const r = await makeService().reverse(13.7462463, 100.534714);

    expect(r).toEqual({
      label: 'สยามพารากอน, ถนนพระรามที่ 1, แขวงปทุมวัน, เขตปทุมวัน, กรุงเทพมหานคร, 10330',
      lat: 13.746246,
      lng: 100.534714,
    });
    const { url, headers } = sent();
    expect(url.origin + url.pathname).toBe(`${BASE}/reverse`);
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('lat')).toBe('13.746246');
    expect(url.searchParams.get('lon')).toBe('100.534714');
    expect(url.searchParams.get('zoom')).toBe('18');
    expect(url.searchParams.get('accept-language')).toBe('th');
    expect(headers.get('user-agent')).toBe(UA);
  });

  it('returns label null when Nominatim finds nothing', async () => {
    fetchMock.mockResolvedValue(json({ error: 'Unable to geocode' }));
    await expect(makeService().reverse(13.7, 100.5)).resolves.toEqual({ label: null, lat: 13.7, lng: 100.5 });
  });

  it('caches by ~1 m (5 decimals) and echoes the asked pin', async () => {
    fetchMock.mockResolvedValue(json(SIAM));
    const geo = makeService();
    await geo.reverse(13.700001, 100.500001);
    const second = await geo.reverse(13.700004, 100.500002);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toMatchObject({ lat: 13.700004, lng: 100.500002 });
  });

  it('maps upstream failures to GEOCODER_UNAVAILABLE', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 502 }));
    await expectGeoError(makeService().reverse(13.7, 100.5), 'GEOCODER_UNAVAILABLE');
  });
});
