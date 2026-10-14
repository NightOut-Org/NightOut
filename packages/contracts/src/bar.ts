import { BarCategory, BarStatus, BookingStatus, CrowdStatus, SafetyCheckResult, TransitLine } from '@nightout/types';
import {
  BAR_ADDRESS_MAX,
  BAR_ADDRESS_MIN,
  PARKING_NOTE_MAX,
  SAFETY_CHECK_NOTE_MAX,
  SAFETY_INSPECTION_MAX_AGE_DAYS,
  SAFETY_INSPECTION_MAX_PHOTOS,
  SAFETY_INSPECTION_NOTE_MAX,
  TRANSIT_STATION_MAX,
  TRANSIT_WALK_MAX,
  isInThailand,
} from '@nightout/utils';
import { z } from 'zod';
import { hhmm, isoDatetime, objectPath, text, uuid } from './common';

/**
 * โดเมน bar — ข้อมูลร้าน เมนู โปรของร้าน ค่าธรรมเนียม โซน/โต๊ะ ความปลอดภัย ตั้งค่าการจอง บัญชีรับเงิน ความแน่น
 * สมัครลงร้าน (ลูกค้า) · อนุมัติ/ระงับ/ยืนยันหลักฐาน Safety + ลงพื้นที่ตรวจ Safety (Inspector)/ตรวจโปรของร้าน (แอดมิน) · ตำแหน่งร้าน (หมุด) + ค้นหาที่อยู่
 */

// ----------------------------- ตำแหน่งร้าน (หมุด · migration 20261013000600) -----------------------------
/** ตำแหน่งร้าน — หมุด + ที่อยู่ + ที่จอดรถ + รถไฟฟ้าใกล้สุด (ใช้ใน join / ร้านส่งตรวจ / แอดมิน) */
const barLocationShape = {
  lat: z.number().min(-90).max(90).describe('ละติจูด (ต้องอยู่ในไทย · เก็บทศนิยม 6 ตำแหน่ง)'),
  lng: z.number().min(-180).max(180).describe('ลองจิจูด'),
  address: z.string().trim().min(BAR_ADDRESS_MIN).max(BAR_ADDRESS_MAX).describe('ที่อยู่ที่ลูกค้าเห็น'),
  parking_note: z.string().trim().max(PARKING_NOTE_MAX).nullish().describe('ที่จอดรถ เช่น "จอดในซอยได้ 10 คัน ฟรี" · ว่าง = ไม่ระบุ'),
  transit_line: TransitLine.nullish().describe('สายรถไฟฟ้าใกล้สุด BTS / MRT / ARL / SRT'),
  transit_station: z.string().trim().max(TRANSIT_STATION_MAX).nullish().describe('ชื่อสถานี เช่น "อารีย์"'),
  transit_walk_minutes: z.number().int().min(1).max(TRANSIT_WALK_MAX).nullish().describe('เดินกี่นาทีจากสถานี'),
};

interface LocationCheckValue {
  lat: number;
  lng: number;
  transit_line?: TransitLine | null;
  transit_station?: string | null;
  transit_walk_minutes?: number | null;
}
/**
 * 3 ข้อตรวจของตำแหน่งร้าน (DB ตรวจซ้ำใน bar_location_from_json) — ใส่ทุก schema ที่มี barLocationShape ด้วย `.check(...locationChecks())`
 * (zod v4 `.extend` object ที่ refine แล้วไม่ได้ จึงสร้างชุดใหม่ต่อ schema)
 */
const locationChecks = () => [
  z.refine<LocationCheckValue>((v) => isInThailand(v.lat, v.lng), { message: 'หมุดต้องอยู่ในประเทศไทย', path: ['lat'] }),
  z.refine<LocationCheckValue>((v) => !!v.transit_line === !!v.transit_station?.trim(), {
    message: 'เลือกสายรถไฟฟ้าและกรอกชื่อสถานีให้ครบ (หรือเว้นว่างทั้งคู่)',
    path: ['transit_station'],
  }),
  z.refine<LocationCheckValue>((v) => v.transit_walk_minutes == null || !!v.transit_station?.trim(), {
    message: 'ใส่เวลาเดินได้เมื่อระบุสถานีแล้ว',
    path: ['transit_walk_minutes'],
  }),
];

/** PUT /merchant/bars/:barId/location — ร้าน (เจ้าของ/ผู้จัดการ) ปักหมุด + ที่อยู่ ที่จอดรถ รถไฟฟ้า · ร้านที่แสดงอยู่ = ส่งให้แอดมินตรวจ */
export const BarLocationBody = z.object(barLocationShape).check(...locationChecks());
export type BarLocationBody = z.infer<typeof BarLocationBody>;
export interface BarLocationResult {
  bar_id: string;
  /** PENDING = รอแอดมินตรวจ (ร้านที่แสดงอยู่) · APPLIED = บันทึกแล้ว (ร้านยังไม่เคยแสดง — ตรวจพร้อมการอนุมัติร้าน) */
  status: 'PENDING' | 'APPLIED';
  request_id: string | null;
}
/** DELETE /merchant/bars/:barId/location-request — ร้านยกเลิกคำขอที่รอตรวจ */
export interface CancelBarLocationResult {
  bar_id: string;
  request_id: string;
  cancelled: true;
}

/**
 * POST /admin/bar-location-requests/:id/review — อนุมัติ (ปรับก่อนได้) / ตีกลับพร้อมเหตุผล
 * ต้องเป็น object เดียว (ห้าม z.discriminatedUnion ที่ระดับบนสุด — `class X extends createZodDto(union)` คอมไพล์ไม่ผ่าน TS2509
 * เพราะ instance type เป็น union)
 */
export const ReviewBarLocationBody = z
  .object({
    approve: z.boolean().describe('true = อนุมัติ · false = ตีกลับ'),
    location: BarLocationBody.optional().describe('อนุมัติ: แอดมินปรับก่อนอนุมัติ (ไม่ส่ง = ใช้ตามที่ร้านขอ) · ตีกลับ: ไม่ใช้'),
    reason: z.string().trim().max(500).nullish().describe('ตีกลับ: บังคับ (ร้านเห็นข้อความนี้) · อนุมัติ: ไม่ใช้'),
  })
  .refine((v) => v.approve || !!v.reason?.trim(), { message: 'ตีกลับต้องใส่เหตุผล', path: ['reason'] })
  .refine((v) => !(v.approve === false && v.location), { message: 'ตีกลับไม่ต้องส่งตำแหน่ง', path: ['location'] });
export type ReviewBarLocationBody = z.infer<typeof ReviewBarLocationBody>;
export interface ReviewBarLocationResult {
  id: string;
  bar_id: string;
  status: 'APPROVED' | 'REJECTED';
  admin_edited: boolean;
}

/** PUT /admin/bars/:id/location — แอดมินตั้งตำแหน่งแทนร้าน (มีผลทันที · ทุกสถานะร้าน · ยกเลิกคำขอที่รอตรวจ) */
export const AdminSetBarLocationBody = z
  .object({
    ...barLocationShape,
    note: z.string().trim().max(500).nullish().describe('ข้อความถึงร้าน (แสดงในแจ้งเตือน)'),
  })
  .check(...locationChecks());
export type AdminSetBarLocationBody = z.infer<typeof AdminSetBarLocationBody>;
export interface AdminSetBarLocationResult {
  bar_id: string;
  request_id: string;
}

/** GET /geocode/search — ค้นหาที่อยู่ (backend → OSM Nominatim เฉพาะไทย · กดค้นหาเท่านั้น ไม่ใช่ autocomplete) */
export const GeocodeSearchQuery = z.object({
  q: z.string().trim().min(2).max(120).describe('คำค้น เช่น "ซอยอารีย์ 1"'),
  limit: z.coerce.number().int().min(1).max(8).default(5).describe('จำนวนผลสูงสุด'),
});
export type GeocodeSearchQuery = z.input<typeof GeocodeSearchQuery>;
export interface GeocodePlace {
  label: string;
  lat: number;
  lng: number;
  kind: string | null;
}
export interface GeocodeSearchResult {
  results: GeocodePlace[];
}

/** GET /geocode/reverse — พิกัด → ที่อยู่ (ใช้เติมช่องที่อยู่หลังลากหมุด) */
export const GeocodeReverseQuery = z
  .object({ lat: z.coerce.number().describe('ละติจูด'), lng: z.coerce.number().describe('ลองจิจูด') })
  .refine((v) => isInThailand(v.lat, v.lng), { message: 'หมุดต้องอยู่ในประเทศไทย', path: ['lat'] });
export type GeocodeReverseQuery = z.input<typeof GeocodeReverseQuery>;
export interface GeocodeReverseResult {
  label: string | null;
  lat: number;
  lng: number;
}

// ----------------------------- ลูกค้า -----------------------------
/** POST /merchant/join — ปักหมุดตอนสมัคร (ตรวจพร้อมการอนุมัติร้าน) */
export const MerchantJoinBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    category: BarCategory,
    district_id: uuid.nullish(),
    license: text(100).nullish(),
    ...barLocationShape,
  })
  .check(...locationChecks());
export type MerchantJoinBody = z.infer<typeof MerchantJoinBody>;
export interface MerchantJoinResult {
  id: string;
  slug: string;
  status: 'PENDING_REVIEW';
}

// ----------------------------- ทีมร้าน -----------------------------
export const BarLinkType = z.enum(['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'LINE_OA', 'WEBSITE', 'REVIEW_CLIP']);

/**
 * PATCH /merchant/bars/:barId/info · ส่วน `info` ของ PUT /merchant/bars/:barId/store — ส่งเฉพาะ field ที่แก้
 * ไม่มี `address` แล้ว — ที่อยู่ + หมุดแก้ผ่าน PUT /merchant/bars/:barId/location เท่านั้น (zod ตัด key ที่ไม่รู้จักทิ้ง)
 */
export const BarInfoBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(400).nullable(),
    phone: z.string().trim().max(30).nullable(),
    district_id: uuid.nullable(),
    style_keys: z.array(z.string().max(40)).max(20),
    hours: z
      .array(
        z.object({
          day_of_week: z.number().int().min(0).max(6),
          open_time: hhmm.nullable(),
          close_time: hhmm.nullable(),
          is_closed: z.boolean(),
        }),
      )
      .max(7),
    links: z.array(z.object({ type: BarLinkType, url: z.url().startsWith('https://') })).max(10),
  })
  .partial();
export type BarInfoBody = z.infer<typeof BarInfoBody>;

/** PUT /merchant/bars/:barId/menu — แทนที่ทั้งหมด */
export const MenuBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(80).nullish(),
        category: z.string().trim().max(40),
        name: z.string().trim().min(1).max(80),
        price: z.number().min(0).max(1_000_000),
        available: z.boolean(),
        image_path: objectPath.nullish().describe('รูปเมนูใน bucket bar-media/<bar_id>/menu/… · ไม่ส่ง = คงรูปเดิม · null = ลบรูป'),
      }),
    )
    .max(500),
});
export type MenuBody = z.infer<typeof MenuBody>;

/** รูปแกลเลอรีร้านได้สูงสุดกี่รูป (DB ตรวจซ้ำใน bar_media_save) */
export const BAR_GALLERY_MAX = 10;

/** PUT /merchant/bars/:barId/media · ส่วน `media` / `gallery` ของ PUT /merchant/bars/:barId/store · PUT /admin/bars/:id/media — แกลเลอรีทั้งชุดตามลำดับ + รูปปก (ต้องอยู่ในแกลเลอรี) */
export const BarMediaBody = z
  .object({
    paths: z
      .array(objectPath)
      .max(BAR_GALLERY_MAX)
      .refine((p) => new Set(p).size === p.length, 'รูปซ้ำกัน')
      .describe('path ใน bucket bar-media/<bar_id>/gallery/… เรียงตามที่แสดง'),
    cover_path: objectPath.nullable().describe('รูปปก — ต้องเป็นหนึ่งใน paths · null = ไม่มีปก (ใช้รูปแทน)'),
  })
  .refine((b) => b.cover_path === null || b.paths.includes(b.cover_path), { message: 'รูปปกต้องอยู่ในแกลเลอรี', path: ['cover_path'] });
export type BarMediaBody = z.infer<typeof BarMediaBody>;
export interface BarMediaResult {
  bar_id: string;
  count: number;
  cover_image_url: string | null;
  paths: string[];
}

/** PUT /admin/menu-items/:id/image — ตั้ง/ลบรูปเมนู 1 รายการแทนร้าน */
/** PUT /merchant/bars/:barId/store — หน้า "ข้อมูลร้าน" บันทึกครั้งเดียว: ข้อมูลร้าน และ/หรือ แกลเลอรี (ส่งเฉพาะส่วนที่แก้ · อย่างน้อย 1 ส่วน) */
export const BarStoreBody = z
  .object({
    info: BarInfoBody.optional().describe('ข้อมูลร้าน (ไม่ส่ง = ไม่แตะ)'),
    media: BarMediaBody.optional().describe('แกลเลอรี + ปก (ไม่ส่ง = ไม่แตะ)'),
  })
  .refine((b) => b.info !== undefined || b.media !== undefined, 'ไม่มีอะไรให้บันทึก');
export type BarStoreBody = z.infer<typeof BarStoreBody>;
export interface BarStoreResult {
  bar_id: string;
  info_updated: boolean;
  gallery: BarMediaResult | null;
}

/** เมนู 1 รายการที่แอดมินแก้แทนร้าน — ไม่มีรูป (รูปคงเดิม · จัดการที่ /bar-media) */
export const AdminMenuItem = z.object({
  id: z.string().max(80).nullish().describe('id เดิม (uuid) · ไม่ส่ง/ไม่ใช่ uuid = รายการใหม่'),
  category: z.string().trim().max(40),
  name: z.string().trim().min(1).max(80),
  price: z.number().min(0).max(1_000_000),
  available: z.boolean(),
});
export type AdminMenuItem = z.infer<typeof AdminMenuItem>;

/** ส่วน `info` ของ PUT /admin/bars/:id/details — ไม่มีที่อยู่/หมุด (แก้ที่หน้าตรวจตำแหน่งร้าน) */
export const AdminBarInfoBody = BarInfoBody.pick({
  name: true,
  description: true,
  phone: true,
  district_id: true,
  style_keys: true,
  hours: true,
  links: true,
}).refine(
  (b) =>
    !b.hours ||
    (new Set(b.hours.map((h) => h.day_of_week)).size === b.hours.length &&
      b.hours.every((h) => h.is_closed || (!!h.open_time && !!h.close_time))),
  { message: 'เวลาเปิด-ปิดไม่ครบหรือมีวันซ้ำ', path: ['hours'] },
);
export type AdminBarInfoBody = z.infer<typeof AdminBarInfoBody>;

/** PUT /admin/bars/:id/details — Drawer "แก้ข้อมูลร้าน" บันทึกครั้งเดียว (ส่งเฉพาะส่วนที่แก้ อย่างน้อย 1 ส่วน) */
export const AdminBarDetailsBody = z
  .object({
    info: AdminBarInfoBody.optional().describe('ข้อมูลร้าน — ส่งเฉพาะ field ที่แก้ (ไม่ส่ง = ไม่แตะ)'),
    menu: z.array(AdminMenuItem).max(500).optional().describe('เมนูทั้งชุด แทนที่ทั้งหมด (ไม่ส่ง = ไม่แตะ)'),
  })
  .refine((b) => (b.info !== undefined && Object.keys(b.info).length > 0) || b.menu !== undefined, 'ไม่มีอะไรให้บันทึก');
export type AdminBarDetailsBody = z.infer<typeof AdminBarDetailsBody>;
export interface AdminBarDetailsResult {
  bar_id: string;
  info_updated: boolean;
  /** จำนวนเมนูหลังบันทึก · null = ไม่ได้แตะเมนู */
  menu_count: number | null;
}

/** PUT /merchant/bars/:barId/promotions — แทนที่ทั้งหมด (โปรใหม่/แก้ข้อความ → รอแอดมินตรวจ) */
export const BarPromotionsBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().max(80).nullish(),
        title: z.string().trim().min(1).max(60),
        description: z.string().trim().max(160).nullish(),
        cutoff_time: hhmm.nullish(),
        days: z.array(z.number().int().min(0).max(6)).max(7).nullish(),
        active: z.boolean(),
      }),
    )
    .max(30),
});
export type BarPromotionsBody = z.infer<typeof BarPromotionsBody>;
export interface BarPromotionsResult {
  bar_id: string;
  count: number;
  pending: number;
}

/** PUT /merchant/bars/:barId/fees · ส่วน `fees` ของ PUT /merchant/bars/:barId/promotions-page */
export const FeesBody = z.object({
  service_charge: z.number().min(0).max(30).describe('%'),
  vat: z.number().min(0).max(10).describe('%'),
  other: z.number().min(0).max(100_000).describe('บาทต่อบิล'),
});
export type FeesBody = z.infer<typeof FeesBody>;

/**
 * PUT /merchant/bars/:barId/promotions-page — หน้าโปรโมชันบันทึกครั้งเดียว: โปรทั้งชุด (แทนที่ทั้งหมด · โปรใหม่/แก้ข้อความ → รอแอดมินตรวจ)
 * และ/หรือ ค่าธรรมเนียม (ส่งเฉพาะส่วนที่แก้ อย่างน้อย 1 ส่วน)
 */
export const PromotionsPageBody = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().max(80).nullish(),
          title: z.string().trim().min(1).max(60),
          description: z.string().trim().max(160).nullish(),
          cutoff_time: hhmm.nullish(),
          days: z.array(z.number().int().min(0).max(6)).max(7).nullish(),
          active: z.boolean(),
        }),
      )
      .max(30)
      .optional()
      .describe('โปรทั้งชุด (ไม่ส่ง = ไม่แตะ)'),
    fees: FeesBody.optional().describe('ค่าธรรมเนียม (ไม่ส่ง = ไม่แตะ)'),
  })
  .refine((b) => b.items !== undefined || b.fees !== undefined, 'ไม่มีอะไรให้บันทึก');
export type PromotionsPageBody = z.infer<typeof PromotionsPageBody>;
export interface PromotionsPageResult {
  bar_id: string;
  /** จำนวนโปร (0 ถ้าไม่ได้ส่ง items) */
  count: number;
  /** จำนวนโปรที่รอแอดมินตรวจถ้อยคำ */
  pending: number;
  fees_updated: boolean;
}

/** PUT /merchant/bars/:barId/zones — แทนที่ทั้งหมด */
export const ZonesBody = z.object({
  zones: z
    .array(
      z.object({
        id: z.string().max(80).nullish(),
        name: z.string().trim().min(1).max(60),
        capacity_pax: z.number().int().min(1).max(2000),
        default_duration_minutes: z.number().int().min(30).max(720),
        tables: z
          .array(z.object({ id: z.string().max(80).nullish(), name: z.string().trim().min(1).max(30), seats: z.number().int().min(1).max(50) }))
          .max(200),
      }),
    )
    .max(30),
});
export type ZonesBody = z.infer<typeof ZonesBody>;

export const SafetyValue = z.enum(['YES', 'NO', 'UNKNOWN']);
export type SafetyValue = z.infer<typeof SafetyValue>;
/** PUT /merchant/bars/:barId/safety — หน้า /merchant/safety บันทึกครั้งเดียว: เฉพาะข้อที่เปลี่ยนค่า และ/หรือ แนบหลักฐาน */
export const SaveSafetyBody = z.object({
  items: z
    .array(
      z
        .object({
          key: z.string().trim().min(1).max(40).describe('รหัสข้อ เช่น CCTV'),
          value: SafetyValue.optional().describe('ไม่ส่ง = ไม่เปลี่ยนค่า'),
          evidence_path: objectPath.optional().describe('หลักฐานใน bucket bar-verifications/<bar_id>/… (อัปโหลดก่อน)'),
        })
        .refine((i) => i.value !== undefined || i.evidence_path !== undefined, 'ต้องมีค่าหรือหลักฐานอย่างน้อย 1 อย่าง'),
    )
    .min(1)
    .max(50)
    .refine((a) => new Set(a.map((x) => x.key.toUpperCase())).size === a.length, 'ข้อซ้ำกัน'),
});
export type SaveSafetyBody = z.infer<typeof SaveSafetyBody>;
export interface SaveSafetyResult {
  bar_id: string;
  values_updated: number;
  evidence_added: number;
}

// ----------------------------- ลงพื้นที่ตรวจ Safety (Inspector · migration 20261013000800) -----------------------------
/** 1 ข้อในผลลงพื้นที่ตรวจที่ร้านเห็น */
export interface SafetyInspectionItemView {
  feature_key: string;
  name_th: string;
  result: SafetyCheckResult;
  note: string | null;
  /** bucket bar-verifications (ขอ URL ชั่วคราวด้วย POST /storage/signed-urls) */
  photo_paths: string[];
}
/** GET /merchant/bars/:barId/safety/inspection — ผลลงพื้นที่ตรวจครั้งล่าสุด (เจ้าของ/ผู้จัดการ · ไม่เคยตรวจ = null · ไม่มีชื่อผู้ตรวจ) */
export interface SafetyInspectionSummary {
  id: string;
  inspected_at: string;
  note: string | null;
  pass_count: number;
  fail_count: number;
  na_count: number;
  /** คะแนนหลังตรวจครั้งนั้น */
  safety_score: number | null;
  items: SafetyInspectionItemView[];
}

/** ตั้งค่าการจอง/มัดจำ/PR (ส่วน `booking` ของ PUT /merchant/bars/:barId/settings) — ส่งเฉพาะ field ที่แก้ */
export const BookingSettingsBody = z
  .object({
    deposit_amount: z.number().min(0).max(100_000),
    deposit_unit: z.enum(['PER_TABLE', 'PER_PERSON']),
    deposit_policy: z.string().trim().max(500),
    grace_minutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
    pr_male: z.number().int().min(0).max(99),
    pr_female: z.number().int().min(0).max(99),
    pr_lgbtq: z.number().int().min(0).max(99),
  })
  .partial();
export type BookingSettingsBody = z.infer<typeof BookingSettingsBody>;

/** บัญชีรับเงิน (ส่วน `payout` ของ PUT /merchant/bars/:barId/settings · เจ้าของเท่านั้น) — เลขบัญชีถูกเข้ารหัสที่ API ก่อนลง DB */
export const PayoutAccountBody = z.object({
  bank_code: z.string().trim().min(2).max(40),
  account_name: z.string().trim().min(1).max(120),
  account_no: z.string().regex(/^\d{10,15}$/, 'เลขบัญชี 10–15 หลัก'),
});
export type PayoutAccountBody = z.infer<typeof PayoutAccountBody>;

/** PUT /merchant/bars/:barId/settings — หน้าตั้งค่าการจองบันทึกครั้งเดียว: ตั้งค่า และ/หรือ บัญชีรับเงิน (ส่งเฉพาะส่วนที่แก้) */
export const SettingsPageBody = z
  .object({
    booking: BookingSettingsBody.optional().describe('ตั้งค่าการจอง/มัดจำ/PR (ไม่ส่ง = ไม่แตะ)'),
    payout: PayoutAccountBody.optional().describe('บัญชีรับเงินใหม่ (ไม่ส่ง = ไม่แตะ · เจ้าของเท่านั้น)'),
  })
  .refine((b) => b.booking !== undefined || b.payout !== undefined, 'ไม่มีอะไรให้บันทึก');
export type SettingsPageBody = z.infer<typeof SettingsPageBody>;
export interface SettingsPageResult {
  bar_id: string;
  settings_updated: boolean;
  /** 4 ตัวท้ายของบัญชีใหม่ (null ถ้าไม่ได้ส่ง payout) */
  account_no_last4: string | null;
}

/** POST /merchant/bars/:barId/crowd */
export const CrowdBody = z.object({ status: CrowdStatus });
export type CrowdBody = z.infer<typeof CrowdBody>;

// ----------------------------- แอดมิน -----------------------------
/** PATCH /admin/bars/:id/status — อนุมัติ/ไม่อนุมัติร้าน (หน้า /merchants) */
export const SetBarStatusBody = z.object({ status: BarStatus, reason: z.string().trim().min(1).max(500).optional() });
export type SetBarStatusBody = z.infer<typeof SetBarStatusBody>;

/** PATCH /admin/bars/status — หน้า /bars บันทึกครั้งเดียว: แสดง ↔ ระงับ หลายร้าน (ระงับต้องมีเหตุผล) */
export const SetBarsStatusBody = z.object({
  changes: z
    .array(
      z.discriminatedUnion('status', [
        z.object({ id: uuid, status: z.literal('APPROVED') }),
        z.object({ id: uuid, status: z.literal('SUSPENDED'), reason: z.string().trim().min(1).max(500).describe('ร้านเห็นข้อความนี้') }),
      ]),
    )
    .min(1)
    .max(200)
    .refine((c) => new Set(c.map((x) => x.id)).size === c.length, 'ร้านซ้ำกัน')
    .describe('เฉพาะร้านที่เปลี่ยน · ร้านต้องแสดง/ระงับอยู่แล้ว'),
});
export type SetBarsStatusBody = z.infer<typeof SetBarsStatusBody>;
export interface SetBarsStatusResult {
  updated: number;
}

/** PUT /admin/bars/:id/media — Drawer รูปร้านบันทึกครั้งเดียว: แกลเลอรี และ/หรือ รูปเมนูหลายรายการ */
export const AdminBarMediaBody = z
  .object({
    gallery: BarMediaBody.optional().describe('แกลเลอรี + ปก (ไม่ส่ง = ไม่แตะ)'),
    menu_images: z
      .array(z.object({ id: uuid, path: objectPath.nullable().describe('path ใน bar-media/<bar_id>/menu/… · null = ลบรูป') }))
      .max(500)
      .refine((m) => new Set(m.map((x) => x.id)).size === m.length, 'รายการเมนูซ้ำกัน')
      .optional()
      .describe('เฉพาะรายการเมนูที่เปลี่ยนรูป'),
  })
  .refine((b) => b.gallery !== undefined || !!b.menu_images?.length, 'ไม่มีอะไรให้บันทึก');
export type AdminBarMediaBody = z.infer<typeof AdminBarMediaBody>;

/** POST /admin/bars/:id/media/discard — ลบไฟล์ที่เพิ่งอัปโหลดแต่บันทึกไม่สำเร็จ (ลบเฉพาะไฟล์ที่ไม่มีแถวไหนอ้าง) */
export const DiscardBarMediaBody = z.object({
  paths: z.array(objectPath).min(1).max(BAR_GALLERY_MAX + 500).describe('path ใน bucket bar-media/<bar_id>/{gallery,menu}/…'),
});
export type DiscardBarMediaBody = z.infer<typeof DiscardBarMediaBody>;
export interface AdminBarMediaResult {
  bar_id: string;
  gallery: BarMediaResult | null;
  menu_updated: number;
}

/** POST /admin/bars/:id/safety-inspections — บันทึกผลลงพื้นที่ตรวจ 1 ครั้ง (แอดมินทุกคน · แก้ภายหลังไม่ได้ ตรวจใหม่ได้) · ข้อที่ผ่าน/ไม่พบ → verify_method ON_SITE */
export const SafetyInspectionBody = z.object({
  inspected_at: isoDatetime
    .optional()
    .describe(`เวลาที่ลงพื้นที่จริง — ไม่ส่ง = ตอนนี้ · ห้ามอนาคต · ย้อนได้ไม่เกิน ${SAFETY_INSPECTION_MAX_AGE_DAYS} วัน และไม่ก่อนการตรวจครั้งล่าสุดของร้าน`),
  note: text(SAFETY_INSPECTION_NOTE_MAX).optional().describe('หมายเหตุรวม (ร้านเห็น)'),
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40).describe('รหัสข้อ เช่น FIRE_EXIT'),
        result: SafetyCheckResult.describe('PASS = ผ่าน (→ มี) · FAIL = ไม่พบ (→ ไม่มี) · NA = ไม่ได้ตรวจ (ไม่เปลี่ยนค่า)'),
        note: text(SAFETY_CHECK_NOTE_MAX).optional().describe('หมายเหตุของข้อนี้ (ร้านเห็น)'),
        photo_paths: z
          .array(objectPath)
          .max(SAFETY_INSPECTION_MAX_PHOTOS)
          .refine((p) => new Set(p).size === p.length, 'รูปซ้ำกัน')
          .optional()
          .describe('รูปใน bar-verifications/<bar_id>/inspections/… (อัปโหลดก่อนด้วย POST /storage/upload-url)'),
      }),
    )
    .min(1)
    .max(50)
    .refine((a) => new Set(a.map((x) => x.key.toUpperCase())).size === a.length, 'ข้อซ้ำกัน')
    .refine((a) => a.some((x) => x.result !== 'NA'), 'ต้องมีผล "ผ่าน" หรือ "ไม่พบ" อย่างน้อย 1 ข้อ'),
});
export type SafetyInspectionBody = z.infer<typeof SafetyInspectionBody>;
export interface SafetyInspectionResult {
  id: string;
  bar_id: string;
  inspected_at: string;
  pass_count: number;
  fail_count: number;
  na_count: number;
  safety_score: number | null;
}
/** POST /admin/safety/:id/verify — ปุ่ม "ยืนยันแล้ว": ตรวจจากหลักฐานที่ร้านแนบ (ไม่ได้ลงพื้นที่) → verify_method EVIDENCE */
export interface VerifySafetyResult {
  id: string;
  source: 'ADMIN_VERIFIED';
  verify_method: 'EVIDENCE';
}

// ----------------------------- Blacklist ร้าน · ร้านไม่มีโต๊ะ (migration 20261013000700) -----------------------------
/** POST /admin/bars/:id/blacklist · POST /admin/bars/:id/blacklist/lift */
export const BarBlacklistBody = z.object({
  reason: z.string().trim().min(3).max(500).describe('เหตุผล (ร้านเห็นข้อความนี้ · ลง audit log)'),
});
export type BarBlacklistBody = z.infer<typeof BarBlacklistBody>;
export interface BarBlacklistResult {
  id: string;
  status: 'APPROVED' | 'SUSPENDED';
  blacklisted_at: string | null;
  /** เฉพาะตอน Blacklist: การจองที่ยังไม่ถึงเวลา (PENDING…CONFIRMED) ที่ยังค้างอยู่ */
  upcoming_bookings?: number;
}

/** POST /admin/bar-strikes — ลูกค้าร้องเรียนว่าร้านไม่มีโต๊ะ: แอดมินบันทึกแทนร้าน + คืน Table Fee (Override) */
export const AdminReportNoTableBody = z.object({
  booking_code: z.string().trim().min(3).max(20).describe('รหัสจอง NL-XXXXXX ของการจองที่ลูกค้าร้องเรียน'),
  note: z.string().trim().min(3).max(300).describe('รายละเอียดข้อร้องเรียน (บังคับ · ทีมร้านเห็นในแจ้งเตือน)'),
});
export type AdminReportNoTableBody = z.infer<typeof AdminReportNoTableBody>;
export interface AdminReportNoTableResult {
  booking_id: string;
  booking_code: string;
  booking_status: BookingStatus;
  /** Table Fee ที่เข้าคิว "รอคืนลูกค้า" (บาท) · null = ไม่มี Table Fee ที่คืนผ่านระบบได้ (เช่น โอนให้ร้านไปแล้ว) */
  refund_amount: number | null;
  /** ร้านไม่มีโต๊ะกี่ครั้งใน 90 วันล่าสุด (รวมครั้งนี้) */
  strikes_90d: number;
}

export const BAR_ERRORS = {
  NOT_BAR_MEMBER: 'บัญชีนี้ไม่ได้อยู่ในทีมของร้านนี้',
  NOT_BAR_MANAGER: 'เฉพาะเจ้าของหรือผู้จัดการร้านเท่านั้น',
  NOT_BAR_OWNER: 'เฉพาะเจ้าของร้านเท่านั้น',
  INVALID_LINK: 'ลิงก์โซเชียลไม่ตรงกับแพลตฟอร์ม (ต้องขึ้นต้นด้วย https://)',
  INVALID_PROMOTION: 'ชื่อโปรต้องยาว 1–60 ตัวอักษร',
  INVALID_FEES: 'ค่าธรรมเนียมไม่ถูกต้อง',
  INVALID_PROMOTIONS_PAGE: 'ไม่มีอะไรให้บันทึก',
  INVALID_SETTINGS_PAGE: 'ไม่มีอะไรให้บันทึก',
  INVALID_PAYOUT_ACCOUNT: 'ข้อมูลบัญชีไม่ครบ',
  APPLICATION_PENDING: 'คุณมีร้านที่รอตรวจอยู่แล้ว',
  INVALID_BAR_INFO: 'กรอกชื่อร้านให้ครบ (1–80 ตัวอักษร)',
  SAFETY_FEATURE_NOT_FOUND: 'ไม่พบมาตรการนี้',
  INVALID_EVIDENCE_PATH: 'อัปโหลดหลักฐานไม่สำเร็จ',
  INVALID_SAFETY_ITEMS: 'ข้อมูลความปลอดภัยไม่ถูกต้อง — รีเฟรชหน้าแล้วลองใหม่',
  INVALID_MENU_ITEM: 'กรอกชื่อรายการและราคา (ไม่ติดลบ) ให้ครบ',
  INVALID_MENU_IMAGE: 'รูปเมนูไม่ถูกต้องหรืออัปโหลดไม่สำเร็จ — ลองอัปโหลดใหม่',
  INVALID_BAR_MEDIA: `รูปร้านไม่ถูกต้อง (สูงสุด ${BAR_GALLERY_MAX} รูป · รูปปกต้องอยู่ในแกลเลอรี) — ลองอัปโหลดใหม่`,
  MENU_ITEM_NOT_FOUND: 'ไม่พบรายการเมนูนี้ (อาจถูกลบไปแล้ว)',
  INVALID_BAR_STORE: 'ไม่มีอะไรให้บันทึก',
  INVALID_BAR_STATUS_CHANGES: 'ข้อมูลการแสดง/ระงับร้านไม่ถูกต้อง (ระงับต้องใส่เหตุผล) — รีเฟรชหน้าแล้วลองใหม่',
  BAR_NOT_TOGGLEABLE: 'มีร้านที่ยังไม่ผ่านการอนุมัติ — จัดการที่หน้าร้านสมัครใหม่',
  INVALID_BAR_LOCATION: 'ข้อมูลตำแหน่งไม่ครบ — ปักหมุด กรอกที่อยู่ 3–300 ตัวอักษร · รถไฟฟ้าต้องมีทั้งสายและชื่อสถานี',
  LOCATION_OUTSIDE_THAILAND: 'หมุดต้องอยู่ในประเทศไทย',
  LOCATION_UNCHANGED: 'ตำแหน่งเหมือนเดิม — ไม่มีอะไรให้ส่งตรวจ',
  LOCATION_REQUEST_NOT_FOUND: 'ไม่พบคำขอแก้ตำแหน่งที่รอตรวจ (อาจถูกตรวจหรือยกเลิกไปแล้ว)',
  LOCATION_REQUEST_ALREADY_REVIEWED: 'คำขอนี้ถูกตรวจไปแล้ว — รีเฟรชหน้าแล้วลองใหม่',
  LOCATION_REJECT_REASON_REQUIRED: 'ตีกลับต้องใส่เหตุผล (ร้านเห็นข้อความนี้)',
  BAR_LOCATION_NOT_SET: 'ร้านนี้ยังไม่ได้ปักหมุดจริง — กด "ปักหมุด" ตั้งตำแหน่งก่อนอนุมัติ',
  GEOCODER_UNAVAILABLE: 'ค้นหาที่อยู่ไม่ได้ชั่วคราว — ลากหมุดหรือวางพิกัดเองได้',
  GEOCODER_BUSY: 'ค้นหาที่อยู่ถี่เกินไป รอสักครู่แล้วลองใหม่',
  BLACKLIST_REASON_REQUIRED: 'ระบุเหตุผลอย่างน้อย 3 ตัวอักษร (ร้านจะเห็นข้อความนี้)',
  BAR_ALREADY_BLACKLISTED: 'ร้านนี้ติด Blacklist อยู่แล้ว',
  BAR_NOT_BLACKLISTED: 'ร้านนี้ไม่ได้ติด Blacklist — รีเฟรชหน้าแล้วลองใหม่',
  BAR_NOT_BLACKLISTABLE: 'Blacklist ได้เฉพาะร้านที่เคยเปิดแสดงแล้ว (แสดง / ระงับ)',
  BAR_BLACKLISTED: 'ร้านนี้ติด Blacklist — ปลดที่หน้า "Blacklist ร้าน" ก่อนเปลี่ยนสถานะ',
  NO_TABLE_NOTE_REQUIRED: 'ระบุรายละเอียดข้อร้องเรียนอย่างน้อย 3 ตัวอักษร',
  NO_TABLE_ADMIN_NOT_ALLOWED: 'บันทึก "ร้านไม่มีโต๊ะ" ได้เฉพาะการจองที่ร้านรับแล้ว (ยืนยันแล้ว / เช็กอินแล้ว / จบแล้ว / ปลดโต๊ะ / ร้านยกเลิกแล้ว)',
  INVALID_INSPECTION: 'ผลตรวจไม่ถูกต้อง — ต้องมีอย่างน้อย 1 ข้อที่ "ผ่าน" หรือ "ไม่พบ" · ข้อไม่ซ้ำ · หมายเหตุไม่ยาวเกิน',
  INVALID_INSPECTION_PHOTO: `รูปจากการตรวจไม่ถูกต้องหรืออัปโหลดไม่สำเร็จ (สูงสุด ${SAFETY_INSPECTION_MAX_PHOTOS} รูปต่อข้อ) — ลองอัปโหลดใหม่`,
  INVALID_INSPECTION_TIME: `วันเวลาที่ลงพื้นที่ไม่ถูกต้อง — ห้ามเป็นอนาคต ย้อนได้ไม่เกิน ${SAFETY_INSPECTION_MAX_AGE_DAYS} วัน และต้องไม่ก่อนการตรวจครั้งล่าสุดของร้านนี้`,
  INSPECTOR_IS_BAR_MEMBER: 'คุณอยู่ในทีมของร้านนี้ จึงตรวจหรือยืนยัน Safety ของร้านนี้เองไม่ได้ — ให้แอดมินคนอื่นตรวจ',
  SAFETY_ALREADY_VERIFIED: 'รายการนี้ถูกตรวจไปแล้ว หรือร้านเปลี่ยนค่าแล้ว — รีเฟรชหน้าแล้วลองใหม่',
  SAFETY_EVIDENCE_REQUIRED: 'ร้านยังไม่แนบหลักฐานของข้อนี้ — ยืนยันจากหลักฐานไม่ได้ ให้ลงพื้นที่ตรวจแทน',
  INVALID_BAR_DETAILS: 'ไม่มีอะไรให้บันทึก หรือข้อมูลร้านไม่ถูกต้อง — รีเฟรชหน้าแล้วลองใหม่',
  INVALID_STYLE: 'มีสไตล์ที่ถูกซ่อนหรือไม่มีในระบบ — เลือกใหม่',
} as const satisfies Record<string, string>;
