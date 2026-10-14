import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type * as C from '@nightout/contracts';
import { THAILAND_BOUNDS, isInThailand, roundCoord } from '@nightout/utils';

/** รอ Nominatim ต่อครั้งไม่เกินนี้ */
const TIMEOUT_MS = 8_000;
/** cache ผลค้นหา/ที่อยู่จากหมุด 24 ชม. · สูงสุด 500 รายการ (เต็ม = ทิ้งตัวเก่าสุด) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
/** คิวรอเรียก Nominatim ยาวได้ไม่เกินนี้ (≈ 4–5 คำขอที่ 1.1 วินาที) — เกิน = GEOCODER_BUSY ทันที ไม่เข้าคิว */
const QUEUE_MAX_WAIT_MS = 5_000;
/** กรอบประเทศไทยในรูปแบบ viewbox ของ Nominatim: ตะวันตก,เหนือ,ตะวันออก,ใต้ */
const TH_VIEWBOX = [THAILAND_BOUNDS.west, THAILAND_BOUNDS.north, THAILAND_BOUNDS.east, THAILAND_BOUNDS.south].join(',');

/** แถวผลลัพธ์ของ Nominatim (format=jsonv2) — เฉพาะ field ที่ใช้ */
interface NominatimPlace {
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
  category?: string;
  error?: string;
}

const stripCountry = (label: string) => label.replace(/,\s*ประเทศไทย$/, '').trim();
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** error ของ geocoder ใช้ 503 + รหัสของตัวเองเสมอ (429 ไม่ได้ — ApiExceptionFilter เขียนรหัสทับเป็น TOO_MANY_REQUESTS) */
const busy = () => new ServiceUnavailableException('GEOCODER_BUSY');
const unavailable = () => new ServiceUnavailableException('GEOCODER_UNAVAILABLE');

/**
 * ค้นหาที่อยู่ / หาที่อยู่จากหมุด ผ่าน OpenStreetMap Nominatim (ADR geocoding backend proxy) — หน้าเว็บไม่เรียกบุคคลที่สามเอง
 * - เฉพาะประเทศไทย (countrycodes=th + กรอบประเทศไทย + กรองผลที่หลุดกรอบ)
 * - นโยบาย Nominatim: ระบุ User-Agent (+ email) · ≤ 1 ครั้ง/วินาที (GEOCODER_MIN_INTERVAL_MS · นับต่อ instance) · cache · ห้าม autocomplete (หน้าเว็บเรียกเมื่อกดค้นหาเท่านั้น)
 * - คิวยาวเกิน ~5 วินาที / upstream 429 = GEOCODER_BUSY · ล่ม/หมดเวลา/ตอบผิดรูป = GEOCODER_UNAVAILABLE (หน้าเว็บให้ลากหมุด/วางพิกัดเองแทน)
 * - ใช้ instance อื่น (self-host / เสียเงิน) ได้ด้วย GEOCODER_URL
 */
@Injectable()
export class GeocodeService {
  private readonly log = new Logger('Geocode');
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly email: string | undefined;
  private readonly minIntervalMs: number;

  private readonly cache = new Map<string, { at: number; value: unknown }>();
  /** คิวเรียก upstream — แต่ละคำขอได้คิวเมื่อพ้น lastStart + minIntervalMs (ไม่ต้องรอคำขอก่อนหน้าตอบ) */
  private queue: Promise<void> = Promise.resolve();
  private lastStart = 0;
  private waiting = 0;

  constructor(config: ConfigService) {
    const base = config.getOrThrow<string>('GEOCODER_URL');
    // ต่อ path แบบ relative — instance ที่อยู่ใต้ path ย่อย (เช่น https://x/nominatim) ยังใช้ได้
    this.baseUrl = base.endsWith('/') ? base : `${base}/`;
    this.userAgent = config.getOrThrow<string>('GEOCODER_USER_AGENT');
    this.email = config.get<string>('GEOCODER_EMAIL') || undefined;
    this.minIntervalMs = Math.max(0, Number(config.getOrThrow<number>('GEOCODER_MIN_INTERVAL_MS')) || 0);
  }

  /** GET /geocode/search — ค้นชื่อสถานที่/ถนน/ซอย ในไทย */
  async search(q: string, limit: number): Promise<C.GeocodeSearchResult> {
    const key = `s:${limit}:${q.trim().toLowerCase()}`;
    const cached = this.fromCache<C.GeocodeSearchResult>(key);
    if (cached) return cached;

    const body = await this.request('search', {
      q: q.trim(),
      format: 'jsonv2',
      countrycodes: 'th',
      'accept-language': 'th',
      limit: String(limit),
      viewbox: TH_VIEWBOX,
      bounded: '1',
    });
    if (!Array.isArray(body)) {
      this.log.warn(`search: unexpected response ${JSON.stringify(body).slice(0, 200)}`);
      throw unavailable();
    }
    const results = (body as NominatimPlace[])
      .map((p): C.GeocodePlace => ({
        label: stripCountry(p.display_name ?? ''),
        lat: roundCoord(Number(p.lat)),
        lng: roundCoord(Number(p.lon)),
        kind: p.type ?? p.category ?? null,
      }))
      .filter((p) => p.label && isInThailand(p.lat, p.lng))
      .slice(0, limit);
    return this.toCache(key, { results });
  }

  /** GET /geocode/reverse — ที่อยู่จากหมุด (label null = ไม่พบ) · lat/lng = หมุดที่ถาม */
  async reverse(lat: number, lng: number): Promise<C.GeocodeReverseResult> {
    const key = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
    let label = this.fromCache<string | null>(key);
    if (label === undefined) {
      const body = await this.request('reverse', {
        format: 'jsonv2',
        lat: String(roundCoord(lat)),
        lon: String(roundCoord(lng)),
        zoom: '18',
        'accept-language': 'th',
      });
      const place = (body ?? {}) as NominatimPlace;
      label = this.toCache(key, !place.error && place.display_name ? stripCountry(place.display_name) || null : null);
    }
    return { label, lat: roundCoord(lat), lng: roundCoord(lng) };
  }

  /** เรียก Nominatim 1 ครั้ง (ผ่านคิว) → JSON */
  private async request(path: 'search' | 'reverse', params: Record<string, string>): Promise<unknown> {
    await this.slot();
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (this.email) url.searchParams.set('email', this.email);

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, 'Accept-Language': 'th' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (e) {
      this.log.warn(`${path}: ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
      throw unavailable();
    }
    if (res.status === 429) {
      this.log.warn(`${path}: upstream 429 (rate limited)`);
      throw busy();
    }
    if (!res.ok) {
      this.log.warn(`${path}: upstream HTTP ${res.status}`);
      throw unavailable();
    }
    try {
      return await res.json();
    } catch (e) {
      this.log.warn(`${path}: invalid JSON (${e instanceof Error ? e.message : String(e)})`);
      throw unavailable();
    }
  }

  /** รอคิว: เรียก upstream ห่างกัน ≥ minIntervalMs · คิวยาวเกิน QUEUE_MAX_WAIT_MS = GEOCODER_BUSY ทันที */
  private slot(): Promise<void> {
    if (this.waiting * this.minIntervalMs > QUEUE_MAX_WAIT_MS) throw busy();
    this.waiting++;
    const turn = this.queue.then(async () => {
      const wait = this.lastStart + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastStart = Date.now();
      this.waiting--;
    });
    this.queue = turn;
    return turn;
  }

  private fromCache<T>(key: string): T | undefined {
    const hit = this.cache.get(key);
    if (!hit) return undefined;
    if (Date.now() - hit.at > CACHE_TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }
    return hit.value as T;
  }

  private toCache<T>(key: string, value: T): T {
    this.cache.delete(key);
    this.cache.set(key, { at: Date.now(), value });
    while (this.cache.size > CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return value;
  }
}
