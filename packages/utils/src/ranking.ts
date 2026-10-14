import type { Tier } from '@nightout/types';

/** จำนวนรีวิว (จากการเช็กอินจริง) ขั้นต่ำก่อนได้ดาว — น้อยกว่านี้แสดง "ร้านใหม่" */
export const MIN_REVIEWS_FOR_STARS = 5;

/** คะแนนรวม 0–100 → ดาว 1–5 */
export function scoreToStars(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

/** ดาว → Tier: S = 5★, A = 4★, B = 3★, C = 1–2★ */
export function starsToTier(stars: number): Tier {
  if (stars >= 5) return 'S';
  if (stars >= 4) return 'A';
  if (stars >= 3) return 'B';
  return 'C';
}

export function isNewBar(reviewCount: number): boolean {
  return reviewCount < MIN_REVIEWS_FOR_STARS;
}

// ----------------------------- คะแนนรวม (Tier List) -----------------------------
// ต้องตรงกับ run_tier_scores() ใน migration 20261013001030 (SQL ปัด round(x, 2) ทุกส่วนเหมือนกัน)

/** น้ำหนักคะแนนรวม 100 (เจ้าของตัดสิน 2026-10-13) — ไม่มีคะแนนความครบของราคา · โฆษณา/โปรโมทไม่มีผล */
export const RANKING_WEIGHTS = { review: 50, checkin: 30, safety: 20 } as const;
/** ค่าเฉลี่ยตั้งต้นแบบ Bayesian — ร้านรีวิวน้อยถูกดึงเข้าหา 3.5 ดาว (น้ำหนักเท่ากับ MIN_REVIEWS_FOR_STARS รีวิว) */
export const RANKING_PRIOR_RATING = 3.5;
/** นับเช็กอินย้อนหลังกี่วันเพื่อคิดคะแนนเช็กอิน */
export const RANKING_CHECKIN_WINDOW_DAYS = 90;
/** เช็กอินเท่านี้ในช่วงข้างบน = คะแนนเช็กอินเต็ม (สเกล log) */
export const RANKING_CHECKIN_TARGET = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** รีวิว 0–50: 50 × (Bayesian avg − 1) / 4 · avg = (5×3.5 + ratingAvg×n) / (5 + n) · ratingAvg null หรือ n ≤ 0 → n = 0 */
export function rankingReviewPoints(ratingAvg: number | null, ratingCount: number): number {
  const n = ratingAvg === null || !(ratingCount > 0) ? 0 : ratingCount;
  const avg = (MIN_REVIEWS_FOR_STARS * RANKING_PRIOR_RATING + (ratingAvg ?? 0) * n) / (MIN_REVIEWS_FOR_STARS + n);
  return round2(clamp((RANKING_WEIGHTS.review * (avg - 1)) / 4, 0, RANKING_WEIGHTS.review));
}

/** เช็กอิน 0–30: 30 × min(1, ln(1+n) / ln(1+30)) · n ≤ 0 → 0 */
export function rankingCheckinPoints(checkins: number): number {
  const n = Math.max(0, checkins);
  return round2(RANKING_WEIGHTS.checkin * Math.min(1, Math.log1p(n) / Math.log1p(RANKING_CHECKIN_TARGET)));
}

/** Safety 0–20: 20 × clamp(score, 0, 100) / 100 (null = 0) */
export function rankingSafetyPoints(safetyScore: number | null): number {
  return round2((RANKING_WEIGHTS.safety * clamp(safetyScore ?? 0, 0, 100)) / 100);
}

export interface RankingScoreInput {
  /** bar_stats.rating_avg (null = ยังไม่มีรีวิว) */
  ratingAvg: number | null;
  /** bar_stats.rating_count */
  ratingCount: number;
  /** เช็กอินใน RANKING_CHECKIN_WINDOW_DAYS วันล่าสุด */
  checkins: number;
  /** bar_stats.safety_score 0–100 (null = 0) */
  safetyScore: number | null;
}
export interface RankingScore {
  review: number;
  checkin: number;
  safety: number;
  /** 0–100 */
  total: number;
  /** true = ยังไม่มีเช็กอินในช่วง → total = (รีวิว + Safety) ขยายจากเต็ม 70 เป็น 100 */
  rescaled: boolean;
  isNew: boolean;
  stars: 1 | 2 | 3 | 4 | 5 | null;
  tier: Tier | null;
}

/**
 * คะแนนรวม 0–100 (ปัด 2 ตำแหน่งทุกส่วน)
 * - มีเช็กอิน ≥ 1 ในช่วง: total = min(100, รีวิว + เช็กอิน + Safety)
 * - ไม่มีเช็กอินเลย (เจ้าของตัดสิน — ไม่ลงโทษร้านที่ยังไม่มีข้อมูลเช็กอิน): total = min(100, (รีวิว + Safety) × 100 / 70)
 * isNew = isNewBar(ratingCount) · stars = isNew ? null : scoreToStars(total) · tier = starsToTier(stars)
 */
export function rankingScore(i: RankingScoreInput): RankingScore {
  const review = rankingReviewPoints(i.ratingAvg, i.ratingCount);
  const checkin = rankingCheckinPoints(i.checkins);
  const safety = rankingSafetyPoints(i.safetyScore);
  const rescaled = !(i.checkins > 0);
  const raw = rescaled
    ? ((review + safety) * 100) / (RANKING_WEIGHTS.review + RANKING_WEIGHTS.safety)
    : review + checkin + safety;
  const total = round2(Math.min(100, raw));
  const isNew = isNewBar(i.ratingCount);
  const stars = isNew ? null : scoreToStars(total);
  return { review, checkin, safety, total, rescaled, isNew, stars, tier: stars === null ? null : starsToTier(stars) };
}
