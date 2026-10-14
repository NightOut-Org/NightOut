import { z } from 'zod';
import { isoDatetime } from './common';

/**
 * โดเมน mini-ads — Native Mini-Ads: แบนเนอร์เล็กที่ทีม NightOut ลงให้ผู้ลงโฆษณา (ตาราง mini_ads · bucket site-media/ads/)
 * แสดง 1 ชิ้นต่อหน้าในหน้าแรก (HOME) / หน้าค้นหา (SEARCH) พร้อมป้าย "โฆษณา" · ไม่มีผลต่ออันดับ/ผลค้นหา · ห้ามแบรนด์แอลกอฮอล์ (ม.32)
 * Backoffice จัดการที่ /mini-ads · นับเห็น/คลิกรวมรายวัน (ไม่เก็บข้อมูลผู้ใช้)
 * แยกจากโปรโมทร้านแบบจ่ายเงิน (โดเมน promotion · ป้าย "แนะนำ · โฆษณา") — ไม่ใช้ enum/ตารางร่วมกัน
 */
export const MINI_AD_PLACEMENTS = ['HOME', 'SEARCH'] as const;
export const MiniAdPlacement = z.enum(MINI_AD_PLACEMENTS);
export type MiniAdPlacement = z.infer<typeof MiniAdPlacement>;
export const MINI_AD_PLACEMENT_LABELS: Record<MiniAdPlacement, string> = { HOME: 'หน้าแรก', SEARCH: 'หน้าค้นหา' };

/** ช่วงโฆษณายาวสุด (วัน) — ตรงกับ check ใน DB */
export const MINI_AD_MAX_DAYS = 366;

/**
 * ภาพต้องอยู่ใน site-media/ads/ (URL public ของ Supabase โฮสต์ไหนก็ได้ — http:// ไว้สำหรับ Supabase ในเครื่อง) หรือ path ใน public/ ของเว็บ (/images/…)
 * ห้ามโฮสต์ภาพภายนอก: ภาพถูกสลับหลังติ๊กยืนยันได้ + ส่ง IP ผู้ชมให้คนนอก · javascript:/data:/'//'/backslash ไม่ผ่าน
 */
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .regex(
    /^(https?:\/\/[^\s/\\]+\/storage\/v1\/object\/public\/site-media\/ads\/[A-Za-z0-9._-]+|\/images\/[^\s\\]+)$/,
    'ภาพต้องอัปโหลดผ่าน Backoffice (site-media/ads/) หรือเป็น path /images/…',
  );
/** ลิงก์ภายนอกต้องเป็น https:// · ลิงก์ในเว็บขึ้นต้นด้วย / (ห้าม // และห้าม \ — เบราว์เซอร์อ่าน /\ เป็น // = ออกนอกเว็บ) */
const linkUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^(https:\/\/[^\s/\\]+[^\s\\]*|\/(?![/\\])[^\s\\]*)$/, 'ลิงก์ต้องขึ้นต้นด้วย https:// หรือเป็นลิงก์ในเว็บที่ขึ้นต้นด้วย /');

/** field ของโฆษณา (ไม่มีค่าเริ่มต้น — ใช้ซ้ำใน PATCH ได้โดยไม่ทับของเดิม) */
const MiniAdFields = z.object({
  advertiser_name: z.string().trim().min(1).max(60).describe('ชื่อผู้ลงโฆษณา — แสดงคู่ป้าย "โฆษณา"'),
  title: z.string().trim().min(1).max(60).describe('หัวข้อบนการ์ด'),
  description: z.string().trim().max(120).describe('คำอธิบายสั้น (ว่างได้)'),
  cta_label: z.string().trim().min(1).max(20).describe('ข้อความปุ่ม เช่น "ดูเพิ่มเติม"'),
  image_url: imageUrl.describe('ภาพ 16:9 ใน bucket site-media (ads/<uuid>.webp) — อัปโหลดด้วย POST /storage/upload-url ก่อน'),
  link_url: linkUrl.describe('กดแล้วไปไหน: https://… (แท็บใหม่) หรือ /path ในเว็บ'),
  placements: z
    .array(MiniAdPlacement)
    .min(1)
    .max(2)
    .refine((p) => new Set(p).size === p.length, 'ตำแหน่งซ้ำ')
    .describe('HOME = หน้าแรก · SEARCH = หน้าค้นหา'),
  starts_at: isoDatetime.describe('เริ่มแสดง (รวม)'),
  ends_at: isoDatetime.describe('หยุดแสดง (ไม่รวม) — ต้องหลัง starts_at และไม่เกิน 366 วัน'),
  active: z.boolean().describe('false = ปิดไว้ (ไม่แสดงแม้อยู่ในช่วงวันที่)'),
  note: z.string().trim().max(300).nullable().describe('บันทึกภายใน (ไม่แสดงบนเว็บ)'),
});

const periodOk = (b: { starts_at?: string; ends_at?: string }) => {
  if (!b.starts_at || !b.ends_at) return true;
  const ms = Date.parse(b.ends_at) - Date.parse(b.starts_at);
  return ms > 0 && ms <= MINI_AD_MAX_DAYS * 86_400_000;
};
const PERIOD_ERROR = { message: 'วันสิ้นสุดต้องหลังวันเริ่ม และรวมไม่เกิน 1 ปี', path: ['ends_at'] };
// ข้อความไทยของ zod (POST ที่ไม่ติ๊ก = 400 VALIDATION_FAILED ก่อนถึง DB · PATCH ที่แก้เนื้อหาแต่ไม่ส่ง = DB ตอบ MINI_AD_NO_ALCOHOL_CONFIRM_REQUIRED)
const confirmNoAlcohol = z
  .literal(true, { error: 'ต้องติ๊กยืนยันว่าไม่ใช่แบรนด์หรือสินค้าเครื่องดื่มแอลกอฮอล์ (ม.32)' })
  .describe('ติ๊กยืนยันว่าไม่ใช่แบรนด์/สินค้าเครื่องดื่มแอลกอฮอล์ (MINI_AD_NO_ALCOHOL_TEXT)');

/** POST /admin/mini-ads */
export const MiniAdBody = MiniAdFields.extend({
  description: MiniAdFields.shape.description.default(''),
  cta_label: MiniAdFields.shape.cta_label.default('ดูเพิ่มเติม'),
  active: MiniAdFields.shape.active.default(true),
  note: MiniAdFields.shape.note.optional(),
  confirm_no_alcohol: confirmNoAlcohol,
}).refine(periodOk, PERIOD_ERROR);
export type MiniAdBody = z.input<typeof MiniAdBody>;

/** PATCH /admin/mini-ads/:id — ส่งเฉพาะ field ที่แก้ · แก้เนื้อหา (ผู้ลงโฆษณา/หัวข้อ/คำอธิบาย/ปุ่ม/ภาพ/ลิงก์) ต้องส่ง confirm_no_alcohol: true */
export const UpdateMiniAdBody = MiniAdFields.partial()
  .extend({ confirm_no_alcohol: confirmNoAlcohol.optional() })
  .refine((b) => Object.keys(b).some((k) => k !== 'confirm_no_alcohol'), 'ไม่มีอะไรให้บันทึก')
  .refine(periodOk, PERIOD_ERROR);
export type UpdateMiniAdBody = z.infer<typeof UpdateMiniAdBody>;

export interface SaveMiniAdResult {
  id: string;
  title: string;
  active: boolean;
  placements: MiniAdPlacement[];
  starts_at: string;
  ends_at: string;
}
export interface DeleteMiniAdResult {
  id: string;
  deleted: true;
}

/** GET /public/mini-ads?placement= */
export const MiniAdsQuery = z.object({ placement: MiniAdPlacement });
export type MiniAdsQuery = z.infer<typeof MiniAdsQuery>;
/** โฆษณาที่กำลังแสดง (rpc mini_ads_live · สุ่มลำดับทุกครั้ง · สูงสุด 10) */
export interface PublicMiniAd {
  id: string;
  advertiser_name: string;
  title: string;
  description: string;
  cta_label: string;
  image_url: string;
  link_url: string;
}

/** POST /public/mini-ads/:id/track */
export const MINI_AD_EVENTS = ['IMPRESSION', 'CLICK'] as const;
export const TrackMiniAdBody = z.object({ event: z.enum(MINI_AD_EVENTS), placement: MiniAdPlacement });
export type TrackMiniAdBody = z.infer<typeof TrackMiniAdBody>;
export interface TrackMiniAdResult {
  tracked: boolean;
}

export const MINI_ADS_ERRORS = {
  MINI_AD_NOT_FOUND: 'ไม่พบโฆษณานี้แล้ว (อาจถูกลบไปแล้ว) — รีเฟรชหน้าแล้วลองใหม่',
  INVALID_MINI_AD:
    'ข้อมูลโฆษณาไม่ครบหรือไม่ถูกต้อง (ต้องมีภาพที่อัปโหลดผ่าน Backoffice ผู้ลงโฆษณา หัวข้อ ลิงก์ https:// หรือ / อย่างน้อย 1 ตำแหน่ง และวันสิ้นสุดหลังวันเริ่มไม่เกิน 1 ปี)',
  MINI_AD_NO_ALCOHOL_CONFIRM_REQUIRED:
    'ต้องติ๊กยืนยันว่าไม่ใช่แบรนด์หรือสินค้าเครื่องดื่มแอลกอฮอล์ก่อนบันทึก (พ.ร.บ.ควบคุมเครื่องดื่มแอลกอฮอล์ ม.32)',
  MINI_AD_INVALID_EVENT: 'ประเภทการนับโฆษณาไม่ถูกต้อง',
} as const satisfies Record<string, string>;
