import { BarCategory, Tier } from '@nightout/types';
import { z } from 'zod';
import { uuid } from './common';

/**
 * โดเมน catalog — ข้อมูลสาธารณะของเว็บ · อันดับร้าน (tier_scores)
 * แอดมินจัดการสไตล์ร้าน (/styles) / สั่งคำนวณอันดับใหม่ (/ranking "คำนวณใหม่")
 * สูตรคะแนน: rankingScore() ใน @nightout/utils (ต้องตรงกับ run_tier_scores() ใน migration 20261013001030)
 */

// ----------------------------- อันดับร้าน (สาธารณะ) -----------------------------
export const RankPeriod = z.enum(['WEEKLY', 'MONTHLY']);
export type RankPeriod = z.infer<typeof RankPeriod>;

/** GET /public/ranking */
export const RankingQuery = z.object({
  period: RankPeriod.default('WEEKLY').describe('รอบสัปดาห์ (เริ่มจันทร์) หรือเดือน (เริ่มวันที่ 1) ล่าสุด'),
  category: BarCategory.optional().describe('ประเภทร้าน · ไม่ส่ง = ทุกประเภท'),
  limit: z.coerce.number().int().min(1).max(50).default(10).describe('จำนวนร้าน 1–50'),
});
export type RankingQuery = z.input<typeof RankingQuery>;

export interface RankingRow {
  bar_id: string;
  /** 1.. เรียงตามโหวต (เช็กอินในรอบ) แล้วตามคะแนนรวม */
  rank: number;
  /** 1 การจองที่เช็กอินในรอบนี้ = 1 โหวต */
  votes: number;
  /** 0–100 */
  total_score: number;
  stars: 1 | 2 | 3 | 4 | 5;
  tier: Tier;
  /** YYYY-MM-DD */
  period_start: string;
  computed_at: string;
}

// ----------------------------- Backoffice: สไตล์ร้าน -----------------------------
/** ชื่อไอคอน Phosphor ที่หน้า /styles ให้เลือก (DB รับชื่อรูปแบบ PascalCase ใดก็ได้) */
export const STYLE_ICONS = [
  'MusicNotes', 'Coffee', 'Disc', 'BuildingOffice', 'ForkKnife', 'SpeakerSimpleNone', 'Tree', 'Door', 'BowlFood',
  'Microphone', 'Guitar', 'Sparkle', 'Moon', 'Confetti', 'GameController', 'Television', 'Waves', 'Heart', 'Users', 'Star',
] as const;
export type StyleIcon = (typeof STYLE_ICONS)[number];
export const StyleIconName = z.string().regex(/^[A-Z][A-Za-z0-9]{1,40}$/, 'ชื่อไอคอนไม่ถูกต้อง');

/** PUT /admin/styles — สไตล์ทั้งหมดเรียงตามที่แสดง (ต้องมีทุกสไตล์เดิม · ลบไม่ได้ ใช้ซ่อนแทน) */
export const SaveStylesBody = z.object({
  items: z
    .array(
      z.object({
        id: uuid.nullish().describe('ไม่ส่ง / null = สไตล์ใหม่ (ระบบตั้ง key ให้)'),
        name_th: z.string().trim().min(1).max(40).describe('ชื่อที่แสดง'),
        icon: StyleIconName.describe('ชื่อไอคอน Phosphor เช่น MusicNotes'),
        active: z.boolean().describe('false = ซ่อนจากตัวเลือก ตัวกรอง และการ์ดร้าน'),
      }),
    )
    .min(1)
    .max(50)
    .refine((a) => {
      const ids = a.flatMap((x) => (x.id ? [x.id] : []));
      return new Set(ids).size === ids.length;
    }, 'สไตล์ซ้ำกัน')
    .refine((a) => new Set(a.map((x) => x.name_th.trim().toLowerCase())).size === a.length, 'ชื่อสไตล์ซ้ำกัน')
    .describe('สไตล์ทั้งหมดเรียงตามที่แสดง'),
});
export type SaveStylesBody = z.infer<typeof SaveStylesBody>;
export interface SaveStylesResult {
  created: number;
  updated: number;
  total: number;
}

// ----------------------------- Backoffice: คำนวณอันดับ -----------------------------
/** POST /admin/ranking/recompute · POST /jobs/tier */
export interface RecomputeRankingResult {
  /** จำนวนร้านที่คำนวณ (ร้านที่แสดงอยู่) */
  bars: number;
  /** YYYY-MM-DD (จันทร์) */
  weekly_period_start: string;
  /** YYYY-MM-DD (วันที่ 1) */
  monthly_period_start: string;
  computed_at: string;
}

export const CATALOG_ERRORS = {
  INVALID_STYLES: 'ข้อมูลสไตล์ไม่ถูกต้อง (ต้องมีทุกสไตล์เดิม · ชื่อ 1–40 ตัวอักษร) — รีเฟรชหน้าแล้วลองใหม่',
  DUPLICATE_STYLE_NAME: 'ชื่อสไตล์ซ้ำกับที่มีอยู่แล้ว',
} as const satisfies Record<string, string>;
