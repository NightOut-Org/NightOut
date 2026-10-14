import type { BookingStatus } from '@nightout/types';

/**
 * กติกาเวลาของการจอง (requirement ข้อ 3 "กฎที่ใช้ทั้งระบบ") — ตรงกับ DB migration …20261013000500_booking_timing_rules
 *   · แจ้งเตือนผู้จอง + เพื่อนที่กด "ไปด้วย" ก่อนเวลาจอง 15 นาที (run_booking_timeouts)
 *   · เก็บโต๊ะตาม grace ที่ร้านตั้ง (bookings.auto_cancel_at) · ลูกค้ากด "ขอต่อเวลา 15 นาที" ได้ 1 ครั้ง (app_extend_booking)
 *   · เตือนก่อนปลดโต๊ะ 5 นาที ถ้ายังไม่ต่อเวลา · เลยเวลา → ปลดโต๊ะ (Forfeited = สถานะ NO_SHOW) ร้านได้ Table Fee
 *   · เช็กอินได้ตั้งแต่ 3 ชม. ก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ (trigger bookings_check_in_window)
 */
export const BOOKING_REMINDER_MINUTES = 15;
export const BOOKING_EXTENSION_MINUTES = 15;
export const BOOKING_RELEASE_WARNING_MINUTES = 5;
export const CHECK_IN_EARLY_HOURS = 3;
/** โต๊ะทั่วไป: ยกเลิกล่วงหน้าอย่างน้อยกี่ชั่วโมงจึงคืน Table Fee เต็ม (ค่าเริ่มต้นของ bar_booking_settings.refund_before_hours · ทุกร้านใช้ค่านี้) */
export const DEFAULT_REFUND_BEFORE_HOURS = 6;

const MINUTE = 60_000;

export interface BookingTiming {
  status: BookingStatus;
  /** เวลานัดเข้าร้าน */
  datetime: string | Date;
  /** เวลาปลดโต๊ะ (รวมเวลาที่ต่อแล้ว) */
  autoCancelAt: string | Date;
  /** เวลาที่กดต่อเวลา (null = ยังไม่เคยต่อ) */
  extendedAt?: string | Date | null;
}

const ms = (v: string | Date) => new Date(v).getTime();

/** กด "ขอต่อเวลา 15 นาที" ได้ไหม — CONFIRMED · ยังไม่เคยต่อ · ตั้งแต่ 15 นาทีก่อนเวลาจอง จนถึงเวลาปลดโต๊ะ */
export function canExtendBooking(b: BookingTiming, now: Date = new Date()): boolean {
  if (b.status !== 'CONFIRMED' || b.extendedAt) return false;
  const t = now.getTime();
  return t >= ms(b.datetime) - BOOKING_EXTENSION_MINUTES * MINUTE && t < ms(b.autoCancelAt);
}

/** ช่วงที่สแกนเช็กอินได้: 3 ชม. ก่อนเวลาจอง → เวลาปลดโต๊ะ */
export function checkInWindow(b: Pick<BookingTiming, 'datetime' | 'autoCancelAt'>): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(ms(b.datetime) - CHECK_IN_EARLY_HOURS * 60 * MINUTE),
    closesAt: new Date(ms(b.autoCancelAt)),
  };
}

/**
 * ทีมร้าน (ทุกบทบาท รวม STAFF/PR) กด "ปลดโต๊ะ (Forfeited)" เองได้ไหม — CONFIRMED และเลยเวลาเก็บโต๊ะ (auto_cancel_at รวมเวลาที่ต่อแล้ว)
 * ผลเหมือน job อัตโนมัติ: NO_SHOW + ร้านได้ Table Fee + แจ้งเตือน (app_team_forfeit_booking · คอมเมนต์ #76)
 */
export function canTeamForfeit(b: Pick<BookingTiming, 'status' | 'autoCancelAt'>, now: Date = new Date()): boolean {
  return b.status === 'CONFIRMED' && now.getTime() >= ms(b.autoCancelAt);
}
