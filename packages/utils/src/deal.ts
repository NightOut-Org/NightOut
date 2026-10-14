/**
 * ดีลวันนี้ — วันตามปฏิทิน Asia/Bangkok ตรงกับที่ DB ตรวจโปรตอนจอง (`app_create_booking_core`:
 * `valid_from <= วันที่ <= valid_to` · `dow = any(days_of_week)` · `เวลา > cutoff_time` = ใช้ไม่ได้)
 * · ใช้ร่วมการ์ดร้าน / หน้าร้าน · ไม่ตัดวันตอน 06:00 (ต่างจาก "คืน" ของผังโต๊ะ `businessNightOf` โดยตั้งใจ)
 */

/** ประเทศไทยไม่มี DST → UTC+7 ตายตัว */
export const BANGKOK_UTC_OFFSET_MINUTES = 420;

/** วันที่ (YYYY-MM-DD) · วันในสัปดาห์ (0 = อาทิตย์) · นาทีของวัน (0–1439) ตามเวลากรุงเทพ ไม่ขึ้นกับ timezone ของเครื่อง */
export interface BangkokClock {
  date: string;
  day: number;
  minute: number;
}

export function bangkokClock(now: Date | number = Date.now()): BangkokClock {
  const ms = typeof now === 'number' ? now : now.getTime();
  const t = new Date(ms + BANGKOK_UTC_OFFSET_MINUTES * 60_000);
  return { date: t.toISOString().slice(0, 10), day: t.getUTCDay(), minute: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** "20:00" / "20:00:00" → 1200 · รูปแบบผิด → NaN */
export function hhmmToMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(hhmm.trim());
  if (!m) return Number.NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return Number.NaN;
  return h * 60 + min;
}

/**
 * ฟิลด์ที่ใช้ตัดสินดีล (ตรงกับ BarPromotion ของหน้าเว็บ) — days ว่าง/ครบ 7 วัน = ทุกวัน · validFrom/validTo = 'YYYY-MM-DD' (รวมวันนั้น)
 * moderationStatus มีเฉพาะร้านของทีมตัวเอง (my_bar_detail) — มีค่าแต่ไม่ใช่ 'APPROVED' = ลูกค้ายังไม่เห็น → ไม่ใช่ดีล
 */
export interface DealWindow {
  active?: boolean;
  moderationStatus?: string | null;
  days?: readonly number[] | null;
  cutoffTime?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}

export type DealTodayStatus = 'LIVE' | 'ENDED' | 'NOT_TODAY';

/** โปรที่ลูกค้าเห็นได้ (active !== false และ moderationStatus ว่างหรือ 'APPROVED') */
export function isPublicDeal(p: DealWindow): boolean {
  return p.active !== false && (p.moderationStatus == null || p.moderationStatus === 'APPROVED');
}

/**
 * LIVE = ใช้ได้วันนี้และยังไม่เลย cutoff (นาทีเท่ากับ cutoff ยังได้ — DB ใช้ `time > cutoff`)
 * · ENDED = ใช้ได้วันนี้แต่เลย cutoff · NOT_TODAY = อื่น ๆ (รวม active === false และ moderationStatus ที่ไม่ใช่ APPROVED)
 * · cutoffTime รูปแบบผิด (NaN) = ถือว่าไม่มี cutoff
 */
export function dealTodayStatus(p: DealWindow, now: Date | number = Date.now()): DealTodayStatus {
  if (!isPublicDeal(p)) return 'NOT_TODAY';
  const clock = bangkokClock(now);
  if (p.validFrom && clock.date < p.validFrom.slice(0, 10)) return 'NOT_TODAY';
  if (p.validTo && clock.date > p.validTo.slice(0, 10)) return 'NOT_TODAY';
  if (p.days && p.days.length > 0 && !p.days.includes(clock.day)) return 'NOT_TODAY';
  const cutoff = p.cutoffTime ? hhmmToMinutes(p.cutoffTime) : Number.NaN;
  if (!Number.isNaN(cutoff) && clock.minute > cutoff) return 'ENDED';
  return 'LIVE';
}

export interface DealsToday<T> {
  live: T[];
  ended: T[];
  otherDays: T[];
}

/** แยกโปรของร้านตามวันนี้ (คงลำดับเดิม) · ตัดโปรที่ !isPublicDeal และโปรที่หมดอายุแล้ว (validTo < วันนี้) ทิ้ง (ไม่อยู่กลุ่มไหนเลย) · closedToday = true → live/ended ว่าง ทุกโปรที่เหลือไปอยู่ otherDays */
export function groupDealsToday<T extends DealWindow>(
  promos: readonly T[],
  now: Date | number = Date.now(),
  opts: { closedToday?: boolean } = {},
): DealsToday<T> {
  const out: DealsToday<T> = { live: [], ended: [], otherDays: [] };
  const today = bangkokClock(now).date;
  for (const p of promos) {
    if (!isPublicDeal(p)) continue;
    // หมดอายุแล้ว (valid_to < วันนี้) — ลูกค้าไม่เห็นแล้ว (bar_detail กรอง `valid_to >= current_date`) แต่ my_bar_detail ของทีมร้านยังส่งมา
    if (p.validTo && p.validTo.slice(0, 10) < today) continue;
    if (opts.closedToday) {
      out.otherDays.push(p);
      continue;
    }
    const status = dealTodayStatus(p, now);
    if (status === 'LIVE') out.live.push(p);
    else if (status === 'ENDED') out.ended.push(p);
    else out.otherDays.push(p);
  }
  return out;
}
