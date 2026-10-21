import type { BarCategory, CrowdStatus, Tier } from '@nightout/types';
import {
  areaMatches,
  fitsGroup,
  isNewBar,
  isReviewableStatus,
  scoreToStars,
  starsToTier,
} from '@nightout/utils';
import type {
  AppNotification,
  Bar,
  BarPromotion,
  BarWithTier,
  Booking,
  DemoUser,
  Review,
  SafetyKey,
} from './models';
import { getSessionUserId, getState } from './cache';

/** ฉลากหมวดร้าน / ความปลอดภัย (ข้อความที่แสดงบนหน้าเว็บ) */
export const SAFETY_LABELS: Record<SafetyKey, string> = {
  SECURITY: 'รปภ. / การ์ด',
  CCTV: 'กล้อง CCTV',
  FIRE_EXIT: 'ทางหนีไฟ + ถังดับเพลิง',
  FIRST_AID: 'ชุดปฐมพยาบาล',
  ID_CHECK: 'ตรวจบัตร 20+',
  PARKING_RIDE: 'ที่จอดรถ / เรียกรถกลับบ้าน',
  FEMALE_STAFF: 'พนักงานหญิงช่วยดูแล',
  LIGHTING: 'ทางเข้า/ที่จอดสว่าง',
  EMERGENCY_CONTACT: 'ช่องทางแจ้งเหตุฉุกเฉิน',
};

export const CATEGORY_LABELS: Record<BarCategory, string> = {
  PUB_BAR: 'ผับ / บาร์',
  CHILL: 'ร้านนั่งชิล',
  RESTAURANT: 'ร้านอาหารมีเครื่องดื่ม',
};

/* =========================== Bars / Ranking =========================== */

export function withTier(bar: Bar): BarWithTier {
  const isNew = isNewBar(bar.reviewCount);
  const stars = isNew ? null : scoreToStars(bar.score);
  return { ...bar, isNew, stars, tier: stars ? starsToTier(stars) : null };
}

export function safetyScore(bar: Bar): number {
  const yes = bar.safety.filter((s) => s.value === 'YES').length;
  return Math.round((yes / bar.safety.length) * 100);
}

export interface BarFilter {
  q?: string;
  category?: BarCategory | 'ALL';
  /** ชื่อย่าน / อำเภอ-เขต / จังหวัด (?district=) */
  district?: string;
  /** รหัสตำบล/แขวง (?tambon=) — ใช้แทน district (ชื่อตำบลซ้ำกันข้ามจังหวัด) */
  tambon?: string;
  /** ชื่อที่แสดงของตำบลที่เลือก (ไม่อยู่ใน URL · หน้าค้นหาขอจาก GET /public/tambons?code=) */
  tambonLabel?: string;
  styles?: string[];
  /** งบต่อหัวสูงสุด (บาท) — ร้านที่ไม่มีข้อมูลราคา (avgPerPerson = 0) ไม่แสดงเมื่อตั้งงบ */
  maxBudget?: number;
  /** จำนวนคนในกลุ่ม: ร้านต้องมีโซนที่ความจุ ≥ จำนวนนี้ */
  people?: number;
  crowd?: CrowdStatus[];
  minSafety?: number;
  /** true = เฉพาะร้านที่มี PR (ชาย/หญิง/LGBTQ+ อย่างน้อย 1 คน) · false / ไม่ระบุ = ทุกร้าน */
  hasPR?: boolean;
  /** distance = ใกล้ผู้ใช้ที่สุด — listBars ไม่รู้ตำแหน่ง (เรียงแบบ relevance) หน้า /search เรียงระยะต่อเอง */
  sort?: 'relevance' | 'rating' | 'price' | 'safety' | 'distance';
}

export function listBars(filter: BarFilter = {}): BarWithTier[] {
  const q = filter.q?.trim().toLowerCase();
  let bars = getState()
    .bars.filter((b) => b.status === 'APPROVED')
    .filter((b) => !filter.category || filter.category === 'ALL' || b.category === filter.category)
    .filter(
      (b) => !filter.district || areaMatches({ district: b.district, ...b.area }, filter.district),
    )
    .filter((b) => !filter.tambon || b.area?.tambonCode === filter.tambon)
    .filter((b) => !filter.styles?.length || filter.styles.every((s) => b.styles.includes(s)))
    .filter((b) => !filter.maxBudget || (b.avgPerPerson > 0 && b.avgPerPerson <= filter.maxBudget))
    .filter((b) => fitsGroup(b.zones, filter.people))
    .filter((b) => !filter.crowd?.length || filter.crowd.includes(b.crowd))
    .filter((b) => !filter.minSafety || safetyScore(b) >= filter.minSafety)
    .filter((b) => !filter.hasPR || b.pr.male + b.pr.female + (b.pr.lgbtq ?? 0) > 0)
    .filter(
      (b) =>
        !q ||
        b.name.toLowerCase().includes(q) ||
        b.district.includes(q) ||
        !!b.area?.amphoe.includes(q) ||
        !!b.area?.province.includes(q) ||
        !!b.area?.tambon.includes(q) ||
        // ชื่อถนน/ซอย (เช่น พหลโยธิน) ไม่ใช่พื้นที่ — หาจากที่อยู่ร้าน
        b.address.includes(q) ||
        b.styles.some((s) => s.toLowerCase().includes(q)),
    )
    .map(withTier);
  const sort = filter.sort ?? 'relevance';
  bars = [...bars].sort((a, b) => {
    if (sort === 'price') return a.avgPerPerson - b.avgPerPerson;
    if (sort === 'safety') return safetyScore(b) - safetyScore(a);
    if (sort === 'rating') return b.rating - a.rating;
    // relevance: ร้านโปรโมทขึ้นก่อน (ติดป้ายโฆษณา) แล้วเรียงตามคะแนน
    return Number(b.promoted) - Number(a.promoted) || b.score - a.score;
  });
  return bars;
}

export function getBarBySlug(slug: string): BarWithTier | null {
  const b = getState().bars.find((x) => x.slug === slug);
  return b ? withTier(b) : null;
}

export function getBar(id: string): BarWithTier | null {
  const b = getState().bars.find((x) => x.id === id);
  return b ? withTier(b) : null;
}

export function tierList(
  category: BarCategory | 'ALL' = 'ALL',
  district?: string,
): Record<Tier, BarWithTier[]> {
  const out: Record<Tier, BarWithTier[]> = { S: [], A: [], B: [], C: [] };
  for (const b of listBars({ category, district, sort: 'rating' })) if (b.tier) out[b.tier].push(b);
  (Object.keys(out) as Tier[]).forEach((t) => out[t].sort((a, b) => b.score - a.score));
  return out;
}

/* =========================== ผู้ใช้ปัจจุบัน =========================== */

export function currentUser(): DemoUser | null {
  const id = getSessionUserId();
  return id ? (getState().users.find((u) => u.id === id) ?? null) : null;
}

export function favorites(): string[] {
  const u = currentUser();
  return u ? (getState().favorites[u.id] ?? []) : [];
}

export function myNotifications(): AppNotification[] {
  const u = currentUser();
  return u ? getState().notifications.filter((n) => n.userId === u.id) : [];
}

/* =========================== Bookings =========================== */

export function myBookings(): Booking[] {
  const u = currentUser();
  return u ? getState().bookings.filter((b) => b.userId === u.id) : [];
}

export function barBookings(barId: string): Booking[] {
  return getState()
    .bookings.filter((b) => b.barId === barId)
    .sort((a, b) => a.datetime.localeCompare(b.datetime));
}

export function getBooking(id: string): Booking | null {
  return getState().bookings.find((b) => b.id === id) ?? null;
}

/** เวลาที่ระบบปลดโต๊ะ (auto_cancel_at จาก DB · ไม่มีให้ใช้เวลาจอง + grace ของร้าน) */
export function autoCancelAt(b: Booking): Date {
  if (b.autoCancelAt) return new Date(b.autoCancelAt);
  const bar = getBar(b.barId);
  return new Date(new Date(b.datetime).getTime() + (bar?.gracePeriodMinutes ?? 30) * 60_000);
}

/** จำนวนมัดจำของการจองนี้ (ต่อโต๊ะ หรือ ต่อคน) */
export function depositFor(bar: Bar, pax: number): number {
  return bar.deposit.unit === 'PER_PERSON' ? bar.deposit.amount * pax : bar.deposit.amount;
}

export function promotionApplies(p: BarPromotion, datetime: string): boolean {
  if (!p.active) return false;
  const d = new Date(datetime);
  if (p.days?.length && !p.days.includes(d.getDay())) return false;
  if (p.cutoffTime) {
    const [h, m] = p.cutoffTime.split(':').map(Number);
    if (d.getHours() * 60 + d.getMinutes() > h! * 60 + m!) return false;
  }
  return true;
}

/* =========================== Reviews =========================== */

/** ร้านนี้ผู้ใช้ปัจจุบันรีวิวได้ไหม — คืน booking ที่มัดจำผ่านแล้วแต่ยังไม่รีวิว (ถ้ามี) */
export function reviewableBooking(barId: string): Booking | null {
  const u = currentUser();
  if (!u) return null;
  return (
    getState().bookings.find(
      (b) => b.barId === barId && b.userId === u.id && isReviewableStatus(b.status) && !b.reviewed,
    ) ?? null
  );
}

export function barReviews(barId: string): Review[] {
  return getState()
    .reviews.filter((r) => r.barId === barId && (!r.status || r.status === 'PUBLISHED'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function myReviews(): Review[] {
  const u = currentUser();
  return u ? getState().reviews.filter((r) => r.userId === u.id) : [];
}
