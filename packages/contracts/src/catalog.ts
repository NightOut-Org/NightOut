import { BarCategory, Tier } from '@nightout/types';
import { z } from 'zod';
import { uuid } from './common';

/**
 * โดเมน catalog — ข้อมูลสาธารณะของเว็บ · อันดับร้าน (tier_scores)
 * แอดมินจัดการสไตล์ร้าน (/styles) / สั่งคำนวณอันดับใหม่ (/ranking "คำนวณใหม่")
 * สูตรคะแนน (ดาว / Tier): rankingScore() ใน @nightout/utils (ต้องตรงกับ run_tier_scores() ใน migration 20261024000100)
 * อันดับหน้า /ranking = เช็กอินผ่าน NightOut ในรอบเท่านั้น (public_ranking · ไม่ใช้คะแนนรวม)
 */

// ----------------------------- อันดับร้าน (สาธารณะ) -----------------------------
export const RankPeriod = z.enum(['WEEKLY', 'MONTHLY']);
export type RankPeriod = z.infer<typeof RankPeriod>;

/** GET /public/ranking */
export const RankingQuery = z.object({
  period: RankPeriod.default('WEEKLY').describe(
    'รอบสัปดาห์ (เริ่มจันทร์) หรือเดือน (เริ่มวันที่ 1) ล่าสุด',
  ),
  category: BarCategory.optional().describe('ประเภทร้าน · ไม่ส่ง = ทุกประเภท'),
  limit: z.coerce.number().int().min(1).max(50).default(10).describe('จำนวนร้าน 1–50'),
});
export type RankingQuery = z.input<typeof RankingQuery>;

export interface RankingRow {
  bar_id: string;
  /** 1.. เรียงตามโหวต (เช็กอินผ่าน NightOut ในรอบ) · เท่ากัน = ร้านที่ถึงยอดก่อนอยู่บน · 0 โหวต = ต่อท้ายตามชื่อร้าน */
  rank: number;
  /** 1 การจองที่เช็กอินในรอบนี้ = 1 โหวต */
  votes: number;
  /** เช็กอินล่าสุดในรอบ (ตัดสินเมื่อโหวตเท่ากัน) · null = ยังไม่มีเช็กอินในรอบ */
  last_checkin_at: string | null;
  /** ดาว / Tier ของร้านในรอบนั้น (สูตรคะแนนรวม · ไม่มีผลต่ออันดับ) · null = ร้านใหม่ (รีวิว < 5) */
  stars: 1 | 2 | 3 | 4 | 5 | null;
  tier: Tier | null;
  is_new: boolean;
  /** YYYY-MM-DD */
  period_start: string;
  computed_at: string;
}

// ----------------------------- พื้นที่ (จังหวัด → อำเภอ/เขต → ตำบล/แขวง + ย่าน) -----------------------------
/** GET /public/area — พื้นที่ของพิกัด (ตอนร้านปักหมุด) · rpc area_at_point */
export const AreaAtPointQuery = z.object({
  lat: z.coerce.number().min(-90).max(90).describe('ละติจูด'),
  lng: z.coerce.number().min(-180).max(180).describe('ลองจิจูด'),
});
export type AreaAtPointQuery = z.input<typeof AreaAtPointQuery>;

/** รหัส pcode ของ OCHA (TH10 · TH1039 · TH103902) + ชื่อไทยไม่มีคำนำหน้า (คำว่า เขต/อำเภอ/แขวง/ตำบล ใส่ตอนแสดงด้วย areaLabel ใน @nightout/utils) */
export interface AreaRef {
  code: string;
  name_th: string;
}
export interface AreaAtPointResult {
  tambon: AreaRef | null;
  amphoe: AreaRef | null;
  province: AreaRef | null;
  /** ย่านที่หมุดอยู่ในรัศมี · null = ไม่อยู่ในย่านไหน */
  district: { id: string; slug: string; name_th: string } | null;
}

/** GET /public/tambons — ค้นตำบล/แขวงทั้งประเทศจากชื่อ (≥ 2 ตัวอักษร) หรือขอชื่อจากรหัส · rpc search_tambons */
export const TambonSearchQuery = z
  .object({
    q: z.string().trim().min(2).max(40).optional().describe('ชื่อตำบล/แขวง (บางส่วนก็ได้)'),
    code: z
      .string()
      .regex(/^TH[0-9]{6}$/)
      .optional()
      .describe('รหัส pcode ของตำบล เช่น TH103902 — ส่งแทน q เพื่อขอชื่อ'),
    codes: z
      .string()
      .regex(/^TH[0-9]{6}(,TH[0-9]{6}){0,19}$/)
      .optional()
      .describe('หลายรหัสคั่นด้วย , (≤ 20) — โปรไฟล์ขอชื่อตำบลที่ชอบ'),
  })
  .refine((v) => [v.q, v.code, v.codes].filter(Boolean).length === 1, {
    message: 'ส่ง q, code หรือ codes อย่างใดอย่างหนึ่ง',
    path: ['q'],
  });
export type TambonSearchQuery = z.input<typeof TambonSearchQuery>;

/** ตำบล/แขวง 1 แห่ง (ชื่อไม่มีคำนำหน้า) · ชื่อซ้ำกันข้ามจังหวัดได้ → กรองร้านด้วย `code` */
export interface TambonOption {
  code: string;
  name_th: string;
  amphoe_code: string;
  amphoe_th: string;
  province_code: string;
  province_th: string;
}

/** แถวของ view bar_areas (ใน GET /public/catalog `areas`) */
export interface BarAreaRow {
  bar_id: string;
  tambon_code: string;
  tambon_th: string;
  amphoe_code: string;
  amphoe_th: string;
  province_code: string;
  province_th: string;
}

// ----------------------------- Backoffice: สไตล์ร้าน -----------------------------
/** ชื่อไอคอน Phosphor ที่หน้า /styles ให้เลือก (DB รับชื่อรูปแบบ PascalCase ใดก็ได้) */
export const STYLE_ICONS = [
  'MusicNotes',
  'Coffee',
  'Disc',
  'BuildingOffice',
  'ForkKnife',
  'SpeakerSimpleNone',
  'Tree',
  'Door',
  'BowlFood',
  'Microphone',
  'Guitar',
  'Sparkle',
  'Moon',
  'Confetti',
  'GameController',
  'Television',
  'Waves',
  'Heart',
  'Users',
  'Star',
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
    .refine(
      (a) => new Set(a.map((x) => x.name_th.trim().toLowerCase())).size === a.length,
      'ชื่อสไตล์ซ้ำกัน',
    )
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
  INVALID_STYLES:
    'ข้อมูลสไตล์ไม่ถูกต้อง (ต้องมีทุกสไตล์เดิม ชื่อ 1–40 ตัวอักษร) — รีเฟรชหน้าแล้วลองใหม่',
  DUPLICATE_STYLE_NAME: 'ชื่อสไตล์ซ้ำกับที่มีอยู่แล้ว',
} as const satisfies Record<string, string>;
