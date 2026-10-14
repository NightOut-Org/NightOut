import { BookingStatus } from '@nightout/types';
import { DEPOSIT_TERMS_VERSION, toThaiE164, type TableBoardStatus, type TableBoardStatusSource } from '@nightout/utils';
import { z } from 'zod';
import { isoDatetime, text, uuid } from './common';

/**
 * โดเมน booking — จองโต๊ะ ยกเลิก เปลี่ยนสถานะ เช็กอิน ย้ายโต๊ะ โซนว่าง บัตรแชร์
 * backend: apps/backend/src/domains/booking · frontend: services/api/booking.ts
 */

// ----------------------------- ลูกค้า -----------------------------
export const DepositTermsBody = z.object({
  accepted: z.literal(true).describe('ลูกค้าติ๊กยอมรับเงื่อนไขริบ Table Fee แล้ว'),
  terms_version: z.string().trim().min(1).max(40).describe(`เวอร์ชันของข้อความเงื่อนไข (ปัจจุบัน ${DEPOSIT_TERMS_VERSION})`),
  terms_text: z.string().trim().min(20).max(4000).describe('ข้อความเงื่อนไขที่แสดงข้าง checkbox (เก็บเป็นหลักฐาน)'),
});

/** POST /bookings */
export const CreateBookingBody = z.object({
  bar_id: uuid,
  zone_id: uuid,
  datetime: isoDatetime,
  pax: z.number().int().min(1).max(50),
  promotion_id: uuid.nullish(),
  note: text(200).nullish(),
  contact_phone: z
    .string()
    .max(20)
    .transform((v, ctx) => {
      const e164 = toThaiE164(v);
      if (!e164) ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
      return e164 ?? v;
    })
    .describe('เบอร์โทรที่ติดต่อได้ (เบอร์ไทย เช่น 081-234-5678) — เก็บเป็น E.164 · เบอร์ที่โดนแบนจองไม่ได้'),
  deposit_terms: DepositTermsBody.nullish().describe('ต้องส่งเมื่อการจองมีมัดจำ (ทุกร้านเก็บมัดจำ) — ไม่ส่ง = DEPOSIT_TERMS_REQUIRED'),
});
export type CreateBookingBody = z.input<typeof CreateBookingBody>;

export const CreateBookingResult = z.object({
  id: uuid,
  code: z.string(),
  status: BookingStatus,
  deposit_required: z.number(),
});
export type CreateBookingResult = z.infer<typeof CreateBookingResult>;

/** POST /bookings/:id/cancel */
export const CancelBookingBody = z.object({ reason: text(200).nullish() });
export type CancelBookingBody = z.infer<typeof CancelBookingBody>;

// ----------------------------- ร้าน -----------------------------
/** POST /merchant/bookings/:id/status */
export const TeamBookingStatusBody = z.object({
  to: z.enum(['CONFIRMED', 'REJECTED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED_BY_MERCHANT']),
  reason: text(200).nullish(),
});
export type TeamBookingStatusBody = z.infer<typeof TeamBookingStatusBody>;

/** POST /merchant/bookings/:id/move */
export const MoveBookingBody = z.object({
  zone_id: uuid.describe('โซนปลายทาง'),
  table_id: uuid.nullish().describe('โต๊ะปลายทาง (null = ไม่ระบุโต๊ะ ใช้ได้เฉพาะโซนที่ไม่มีโต๊ะ/เปิดจองแบบไม่ระบุโต๊ะ)'),
  reason: text(200).nullish().describe('เหตุผล (บันทึกใน audit log)'),
});
export type MoveBookingBody = z.infer<typeof MoveBookingBody>;
export interface MoveBookingResult {
  id: string;
  zone_id: string;
  zone_name: string;
  table_id: string | null;
  table_name: string | null;
}

/** POST /merchant/bars/:barId/check-in */
export const CheckInBody = z.object({ code: z.string().trim().min(3).max(120).describe('รหัสจอง NL-XXXXXX หรือข้อความจาก QR') });
export type CheckInBody = z.infer<typeof CheckInBody>;
export interface CheckInResult {
  id: string;
  code: string;
  pax: number;
  zone_name: string | null;
  customer_name: string | null;
}

/** GET /merchant/bars/:barId/check-in/preview?code= — ดูการจองก่อนกดยืนยันเช็กอิน (ไม่เปลี่ยนสถานะ · ไม่มียอดเงิน) */
export const CheckInPreviewQuery = z.object({
  code: z.string().trim().min(3).max(120).describe('รหัสจอง NL-XXXXXX หรือข้อความจาก QR (NIGHTOUT:<booking id>)'),
});
export type CheckInPreviewQuery = z.infer<typeof CheckInPreviewQuery>;
/** เหตุที่ยังกดยืนยันเช็กอินไม่ได้ (ตรงกับ trigger bookings_check_in_window + สถานะ) */
export type CheckInBlockReason = 'NOT_CONFIRMED' | 'ALREADY_CHECKED_IN' | 'TOO_EARLY' | 'TOO_LATE';
/** ผลของ bar_check_in_preview — ทีมร้านทุกบทบาทเห็น (Staff/PR ด้วย) จึงไม่มียอดเงิน/เบอร์โทร */
export interface CheckInPreview {
  id: string;
  code: string;
  status: BookingStatus;
  booking_datetime: string;
  /** เวลาปลดโต๊ะ (รวมเวลาที่ต่อแล้ว) */
  auto_cancel_at: string;
  /** เวลาที่ลูกค้ากด "ขอต่อเวลา 15 นาที" (null = ยังไม่ต่อ) */
  extended_at: string | null;
  pax: number;
  zone_name: string | null;
  table_name: string | null;
  customer_name: string | null;
  promotion_title: string | null;
  customer_note: string | null;
  /** เช็กอินแล้วเมื่อไร (null = ยัง) */
  checked_in_at: string | null;
  /** เช็กอินได้ตั้งแต่ (3 ชม. ก่อนเวลาจอง — CHECK_IN_EARLY_HOURS) */
  check_in_opens_at: string;
  /** วันของเวลาจอง = วันนี้ (เวลาไทย) */
  is_today: boolean;
  /** กดยืนยันเช็กอินได้ไหม ณ เวลา server */
  can_check_in: boolean;
  block_reason: CheckInBlockReason | null;
  server_now: string;
}

/** POST /merchant/bookings/:bookingId/no-table — ร้านรับจองแล้วแต่ไม่มีโต๊ะให้ (ทีมร้านทุกบทบาท) → คืน Table Fee เต็ม/ยกเลิก + บันทึกประวัติร้าน */
export const ReportNoTableBody = z.object({
  note: text(300).nullish().describe('รายละเอียดเพิ่ม (ไม่บังคับ) — ทีม NightOut เห็นในหน้า Blacklist ร้าน'),
});
export type ReportNoTableBody = z.infer<typeof ReportNoTableBody>;
export interface ReportNoTableResult {
  booking_id: string;
  booking_status: BookingStatus;
  /** Table Fee ที่เข้าคิวคืนลูกค้า (บาท) · null = ไม่มี Table Fee ที่คืนได้ (ยกเลิกอย่างเดียว) */
  refund_amount: number | null;
  /** ร้านไม่มีโต๊ะกี่ครั้งใน 90 วันล่าสุด (รวมครั้งนี้) */
  strikes_90d: number;
}

/** GET merchant/bars/:barId/bookings/:id/table-options */
export interface TableOption {
  zone_id: string;
  zone_name: string;
  table_id: string | null;
  table_name: string | null;
  seats: number | null;
  available: boolean;
  is_current: boolean;
  zone_remaining_pax: number;
}

/**
 * GET /merchant/bars/:barId/table-board?night=YYYY-MM-DD (ทีมร้านทุกบทบาท)
 * · Backoffice ดูอย่างเดียวด้วย query + response เดียวกัน
 */
export const TableBoardQuery = z.object({
  night: z.iso.date().optional().describe('คืนที่ต้องการ (วันที่ตามเวลาไทย · ไม่ส่ง = คืนนี้ ตัดวันตอน 06:00)'),
});
export type TableBoardQuery = z.infer<typeof TableBoardQuery>;

export interface TableBoardOccupancy {
  id: string;
  pax: number | null;
  note: string | null;
  started_at: string;
  started_by_name: string | null;
}
export interface TableBoardTable {
  id: string;
  name: string;
  seats: number;
  status: TableBoardStatus;
  /** null เมื่อ FREE */
  status_source: TableBoardStatusSource | null;
  /** การจองที่เช็กอินอยู่ (IN_USE/BOOKING) หรือที่กำลังจะมา (RESERVED) · null เมื่อ FREE / MANUAL */
  current_booking_id: string | null;
  /** การจองถัดไปคืนนี้ที่ยังไม่เช็กอิน (ไม่นับ current) — ใช้เตือน "มีจอง HH:mm" */
  next_booking_id: string | null;
  next_booking_at: string | null;
  /** ทีมร้านตั้ง "กำลังใช้" เอง (ยังไม่ตั้งว่าง) */
  occupancy: TableBoardOccupancy | null;
}
export interface TableBoardZone {
  id: string;
  name: string;
  capacity_pax: number;
  allow_zone_only_booking: boolean;
  sort_order: number;
  tables: TableBoardTable[];
}
/** การจองของคืนนั้น (ไม่มียอดเงิน / เบอร์โทร) — สถานะ PENDING…CHECKED_IN + COMPLETED + NO_SHOW */
export interface TableBoardBooking {
  id: string;
  code: string;
  status: BookingStatus;
  zone_id: string;
  /** ชื่อโซน/โต๊ะของการจอง (รวมโซน/โต๊ะที่ปิดใช้แล้ว — ผังแสดงเฉพาะที่เปิดใช้ จึงต้องส่งชื่อมาเอง) */
  zone_name: string;
  table_id: string | null;
  table_name: string | null;
  booking_datetime: string;
  reserved_from: string;
  reserved_until: string;
  auto_cancel_at: string;
  extended_at: string | null;
  checked_in_at: string | null;
  completed_at: string | null;
  pax: number;
  customer_name: string | null;
  request_pr: 'MALE' | 'FEMALE' | 'LGBTQ' | null;
  customer_note: string | null;
  promotion_title: string | null;
}
export interface TableBoard {
  bar_id: string;
  /** 'YYYY-MM-DD' */
  night: string;
  night_start: string;
  night_end: string;
  /** เวลา server ตอนคำนวณสถานะ — status / current / next ของโต๊ะคิด "ณ ตอนนี้" เสมอ แม้ส่ง night อื่น (night เปลี่ยนแค่รายการ bookings) */
  server_now: string;
  zones: TableBoardZone[];
  bookings: TableBoardBooking[];
}

/** POST /merchant/tables/:tableId/occupancy — ตั้งโต๊ะเป็น "กำลังใช้" (ไม่มีการจอง) / "ว่าง" · ทีมร้านทุกบทบาท */
export const TableOccupancyBody = z.object({
  in_use: z.boolean().describe('true = ตั้งเป็นกำลังใช้ (มีลูกค้านั่งโดยไม่มีการจองในระบบ) · false = ตั้งเป็นว่าง'),
  pax: z.number().int().min(1).max(50).nullish().describe('จำนวนคน (ไม่บังคับ · ใช้ตอน in_use = true)'),
  note: text(100).nullish().describe('หมายเหตุสั้น ๆ (ไม่บังคับ)'),
});
export type TableOccupancyBody = z.infer<typeof TableOccupancyBody>;
export interface TableOccupancyResult {
  table_id: string;
  in_use: boolean;
  occupancy_id: string;
  started_at: string;
  ended_at: string | null;
}

/** GET /merchant/bars/:barId/sales-stats — ยอดขายเฉลี่ย (ประมาณการ) · เฉพาะเจ้าของ/ผู้จัดการ */
export const SalesStatsQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30).describe('ย้อนหลังกี่วัน (เทียบกับช่วงก่อนหน้าที่ยาวเท่ากัน)'),
});
export type SalesStatsQuery = z.input<typeof SalesStatsQuery>;
/** ตัวเลขของ 1 ช่วง (บาท) — null = ไม่มีข้อมูลให้คำนวณ */
export interface SalesStatsPeriod {
  /** Table Fee ที่ร้านได้ (รวมที่รอโอน · ไม่รวมที่คืนลูกค้า) */
  table_fee_total: number;
  table_fee_bookings: number;
  table_fee_avg: number | null;
  /** การจองที่เช็กอินแล้ว (CHECKED_IN / COMPLETED) และจำนวนคน */
  checked_in_bookings: number;
  checked_in_pax: number;
  /** ยอดใช้จ่ายโดยประมาณ — ราคาที่ประเมินตอนจอง (ถ้ามี) หรือราคาต่อคนโดยประมาณของร้าน × จำนวนคน · ไม่ใช่ยอดบิลจริง */
  estimated_bookings: number;
  est_spend_total: number;
  est_spend_per_booking: number | null;
  est_spend_per_person: number | null;
}
export interface SalesStatsResult {
  days: number;
  generated_at: string;
  current: SalesStatsPeriod;
  previous: SalesStatsPeriod;
}

// ----------------------------- สาธารณะ -----------------------------
/** GET /bars/:barId/zone-availability?datetime= */
export const ZoneAvailabilityQuery = z.object({ datetime: isoDatetime.describe('เวลาที่จะจอง (ISO 8601 มี timezone)') });
export type ZoneAvailabilityQuery = z.infer<typeof ZoneAvailabilityQuery>;
export interface ZoneAvailabilityRow {
  zone_id: string;
  zone_name: string;
  capacity_pax: number;
  remaining_pax: number;
  free_tables: number;
  total_tables: number;
  full: boolean;
}

/** GET /share-cards/:token */
export interface ShareCard {
  booking_datetime: string;
  pax: number;
  status: string;
  zone_name: string;
  bar_name: string;
  bar_slug: string;
  address: string;
  lat: number;
  lng: number;
  host_first_name: string;
  going_count: number;
  /** Table Fee ของการจองนี้ (บาท) — หน้าเว็บหารด้วย pax ให้เพื่อนเห็นยอดต่อหัว (ผู้จองจ่ายคนเดียว) */
  deposit_required: number;
  /** ผู้เรียกเป็นผู้จอง หรือเพื่อนที่กด "ไปด้วย" แล้ว (ไม่ล็อกอิน = false) */
  is_member: boolean;
  /** QR เช็กอิน `NIGHTOUT:<booking id>` — เฉพาะสมาชิกของกลุ่ม และการจอง CONFIRMED · ใครถึงร้านก่อนสแกนได้เลย (เช็กอินทั้งโต๊ะ) */
  checkin_qr: string | null;
}

/** POST /share-cards/:token/join — เพื่อนกด "ไปด้วย" (ต้องล็อกอิน · กดซ้ำได้ ไม่นับซ้ำ) */
export interface JoinShareResult {
  joined: boolean;
  going_count: number;
}

/** POST /bookings/:id/extend — ผู้จองขอต่อเวลา 15 นาที (ได้ 1 ครั้ง · ตั้งแต่ 15 นาทีก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ) */
export interface ExtendBookingResult {
  id: string;
  /** เวลาปลดโต๊ะใหม่ */
  auto_cancel_at: string;
  extended_at: string;
}

/** POST /merchant/bookings/:id/forfeit — ทีมร้านทุกบทบาทกด "ปลดโต๊ะ (Forfeited)" เองเมื่อเลยเวลาเก็บโต๊ะ (app_team_forfeit_booking · คอมเมนต์ #76) */
export interface TeamForfeitResult {
  id: string;
  status: 'NO_SHOW';
}

export const BOOKING_ERRORS = {
  BAR_NOT_FOUND: 'ไม่พบร้านนี้ หรือร้านยังไม่เปิดให้จอง',
  ZONE_NOT_FOUND: 'ไม่พบโซนนี้',
  ZONE_FULL: 'โซนนี้เต็มแล้วในช่วงเวลานั้น ลองเลือกโซนหรือเวลาอื่น',
  PAX_OUT_OF_RANGE: 'จำนวนคนเกินที่ร้านรับต่อการจอง',
  BOOKING_TOO_SOON: 'ต้องจองล่วงหน้ามากกว่านี้ ลองเลือกเวลาที่ช้าลง',
  BOOKING_TOO_FAR: 'จองล่วงหน้าไกลเกินที่ร้านเปิดรับ',
  PROMOTION_NOT_AVAILABLE: 'โปรโมชันนี้ใช้กับวัน/เวลาที่เลือกไม่ได้',
  BOOKING_NOT_FOUND: 'ไม่พบการจองนี้',
  INVALID_BOOKING_TRANSITION: 'เปลี่ยนสถานะการจองนี้ไม่ได้แล้ว (สถานะอาจเปลี่ยนไปแล้ว ลองรีเฟรช)',
  BOOKING_NOT_CONFIRMED: 'การจองนี้ยังไม่ได้ยืนยัน หรือเช็กอินไปแล้ว',
  CONTACT_PHONE_REQUIRED: 'กรอกเบอร์โทรที่ร้านติดต่อได้',
  INVALID_PHONE: 'เบอร์โทรไม่ถูกต้อง (เช่น 081-234-5678)',
  DEPOSIT_TERMS_REQUIRED: 'กรุณาติ๊กยอมรับเงื่อนไข Table Fee ก่อนจอง',
  ACCOUNT_BANNED: 'บัญชีนี้ถูกระงับการจอง — ดูเหตุผลในแจ้งเตือน หรือติดต่อ NightOut หากคิดว่าเป็นความผิดพลาด',
  PHONE_BANNED: 'เบอร์โทรนี้ถูกระงับการจอง — ติดต่อ NightOut หากคิดว่าเป็นความผิดพลาด',
  BOOKING_NOT_MOVABLE: 'ย้ายโต๊ะได้เฉพาะการจองที่ยังไม่จบ (ยังไม่ปิดโต๊ะ/ยกเลิก)',
  TABLE_NOT_FOUND: 'ไม่พบโต๊ะนี้ในโซนที่เลือก',
  TABLE_REQUIRED: 'โซนนี้ต้องเลือกโต๊ะ',
  TABLE_TAKEN: 'โต๊ะนี้มีการจองอื่นในช่วงเวลาเดียวกัน — เลือกโต๊ะอื่น',
  BOOKING_SAME_TABLE: 'การจองนี้อยู่ที่โต๊ะนี้อยู่แล้ว',
  BOOKING_ALREADY_EXTENDED: 'การจองนี้ขอต่อเวลาไปแล้ว (ต่อได้ 1 ครั้ง)',
  BOOKING_EXTEND_NOT_AVAILABLE: 'ขอต่อเวลาได้ตั้งแต่ 15 นาทีก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ',
  CHECK_IN_TOO_EARLY: 'ยังไม่ถึงเวลาเช็กอิน — เช็กอินได้ตั้งแต่ 3 ชั่วโมงก่อนเวลาจอง',
  CHECK_IN_TOO_LATE: 'เลยเวลาเก็บโต๊ะแล้ว — การจองนี้ถูกปลดโต๊ะ (Forfeited)',
  BOOKING_NOT_OVERDUE: 'ยังไม่เลยเวลาเก็บโต๊ะ — ปลดโต๊ะได้เมื่อเลยเวลาที่เก็บโต๊ะแล้ว',
  SHARE_NOT_FOUND: 'ลิงก์นี้หมดอายุหรือไม่ถูกต้อง',
  SHARE_CLOSED: 'การจองนี้จบแล้ว กด "ไปด้วย" ไม่ได้',
  NO_TABLE_NOT_ALLOWED: 'แจ้ง "ร้านไม่มีโต๊ะ" ได้เฉพาะการจองที่ยืนยันแล้วหรือเช็กอินแล้ว',
  NO_TABLE_ALREADY_REPORTED: 'การจองนี้แจ้งว่าร้านไม่มีโต๊ะไปแล้ว',
  TABLE_NOT_ON_BOARD: 'ไม่พบโต๊ะนี้ หรือโต๊ะถูกปิดใช้แล้ว — รีเฟรชผังโต๊ะ',
  TABLE_ALREADY_IN_USE: 'โต๊ะนี้กำลังใช้อยู่แล้ว (อาจมีคนในทีมอัปเดตก่อน) — รีเฟรชผังโต๊ะ',
  TABLE_NOT_IN_USE: 'โต๊ะนี้ว่างอยู่แล้ว — รีเฟรชผังโต๊ะ',
  TABLE_HAS_GUEST: 'โต๊ะนี้มีลูกค้าที่เช็กอินแล้ว — กด "ลูกค้ากลับแล้ว · ปิดโต๊ะ" ที่การจองนั้นแทน',
  INVALID_STATS_RANGE: 'ช่วงเวลาของสถิติไม่ถูกต้อง (1–366 วัน)',
} as const satisfies Record<string, string>;
