import { BarCategory, BarStatus, CrowdStatus } from '@nightout/types';
import { z } from 'zod';
import { hhmm, objectPath, text, uuid } from './common';

/**
 * โดเมน bar — ข้อมูลร้าน เมนู โปรของร้าน ค่าธรรมเนียม โซน/โต๊ะ ความปลอดภัย ตั้งค่าการจอง บัญชีรับเงิน ความแน่น
 * สมัครลงร้าน (ลูกค้า) · อนุมัติ/ระงับ/ยืนยัน Safety/ตรวจโปรของร้าน (แอดมิน)
 */

// ----------------------------- ลูกค้า -----------------------------
/** POST /merchant/join */
export const MerchantJoinBody = z.object({
  name: z.string().trim().min(1).max(80),
  category: BarCategory,
  district_id: uuid.nullish(),
  address: z.string().trim().min(3).max(300),
  license: text(100).nullish(),
});
export type MerchantJoinBody = z.infer<typeof MerchantJoinBody>;
export interface MerchantJoinResult {
  id: string;
  slug: string;
  status: 'PENDING_REVIEW';
}

// ----------------------------- ทีมร้าน -----------------------------
export const BarLinkType = z.enum(['INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'LINE_OA', 'WEBSITE', 'REVIEW_CLIP']);

/** PATCH /merchant/bars/:barId/info · ส่วน `info` ของ PUT /merchant/bars/:barId/store — ส่งเฉพาะ field ที่แก้ */
export const BarInfoBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(400).nullable(),
    address: z.string().trim().min(3).max(300),
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
  INVALID_BAR_INFO: 'กรอกชื่อร้านและที่อยู่ให้ครบ',
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
} as const satisfies Record<string, string>;
