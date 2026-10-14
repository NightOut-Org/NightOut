import { z } from 'zod';

/** ชั้นบัญชี (ADR 0005) — ชื่อไทยกับลำดับอยู่ในตาราง roles */
export const UserRole = z.enum(['CUSTOMER', 'MERCHANT', 'STAFF', 'ADMIN', 'SUPER_ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

/** ประเภทร้าน */
export const BarCategory = z.enum(['PUB_BAR', 'CHILL', 'RESTAURANT']);
export type BarCategory = z.infer<typeof BarCategory>;

/** สถานะการตรวจสอบร้าน */
export const BarStatus = z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED']);
export type BarStatus = z.infer<typeof BarStatus>;

/** สถานะการจอง (ดู state machine ใน @nightout/utils) */
export const BookingStatus = z.enum([
  'PENDING',
  'AWAITING_DEPOSIT',
  'DEPOSIT_SUBMITTED',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_MERCHANT',
  'CHECKED_IN',
  'COMPLETED',
  'NO_SHOW',
  'EXPIRED',
]);
export type BookingStatus = z.infer<typeof BookingStatus>;

/** Tier ในหน้า Tier List (แปลงจากดาว) */
export const Tier = z.enum(['S', 'A', 'B', 'C']);
export type Tier = z.infer<typeof Tier>;

/** สถานะความแน่นของร้าน */
export const CrowdStatus = z.enum(['AVAILABLE', 'ALMOST_FULL', 'FULL']);
export type CrowdStatus = z.infer<typeof CrowdStatus>;

/** ธีมที่ผู้ใช้เลือก */
export const ThemeMode = z.enum(['LIGHT', 'DARK', 'SYSTEM']);
export type ThemeMode = z.infer<typeof ThemeMode>;

/** ประเภท billing event */
export const BillingEventType = z.enum(['CHECK_IN', 'NO_SHOW']);
export type BillingEventType = z.infer<typeof BillingEventType>;

/** วิธีคิดค่าคอมมิชชัน */
export const CommissionCalculation = z.enum(['PERCENTAGE', 'FIXED', 'FIXED_PER_PERSON']);
export type CommissionCalculation = z.infer<typeof CommissionCalculation>;

/** สายรถไฟฟ้าใกล้ร้าน (bars.transit_line · text + check ใน DB) */
export const TransitLine = z.enum(['BTS', 'MRT', 'ARL', 'SRT']);
export type TransitLine = z.infer<typeof TransitLine>;

/** สถานะคำขอแก้ตำแหน่งร้าน (bar_location_requests.status) */
export const LocationRequestStatus = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']);
export type LocationRequestStatus = z.infer<typeof LocationRequestStatus>;

/** ที่มาของแถว: ร้านขอแก้ / แอดมินตั้งแทน (ADMIN = อนุมัติในตัว เก็บเป็นประวัติ) */
export const LocationRequestSource = z.enum(['MERCHANT', 'ADMIN']);
export type LocationRequestSource = z.infer<typeof LocationRequestSource>;

/** ผลลงพื้นที่ตรวจ Safety ต่อข้อ — PASS ผ่าน (→ มี) · FAIL ไม่พบ (→ ไม่มี) · NA ไม่ได้ตรวจ (ไม่เปลี่ยนค่า) */
export const SafetyCheckResult = z.enum(['PASS', 'FAIL', 'NA']);
export type SafetyCheckResult = z.infer<typeof SafetyCheckResult>;

/**
 * วิธีที่ทีมงานตรวจข้อ Safety (bar_safety_features.verify_method · enum safety_verify_method · migration 20261013000800)
 * EVIDENCE = ตรวจหลักฐานจากร้าน (ปุ่ม "ยืนยันแล้ว" · ไม่ลงพื้นที่) · ON_SITE = ลงพื้นที่ตรวจ (มีบันทึกใน safety_inspections)
 */
export const SafetyVerifyMethod = z.enum(['EVIDENCE', 'ON_SITE']);
export type SafetyVerifyMethod = z.infer<typeof SafetyVerifyMethod>;

/** สถานะรายการชำระเงินออนไลน์ (payment_intents.status · migration 20261013001100) */
export const PaymentIntentStatus = z.enum(['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED']);
export type PaymentIntentStatus = z.infer<typeof PaymentIntentStatus>;

/** เงินที่ได้รับแล้วแต่ผูกกับการจองไม่ได้ → ต้องคืนเอง (ทำมือที่ระบบผู้ให้บริการ) */
export const PaymentRefundStatus = z.enum(['NONE', 'REQUIRED', 'REFUNDED']);
export type PaymentRefundStatus = z.infer<typeof PaymentRefundStatus>;

/** ชนิด event จาก webhook หลัง adapter แปลงแล้ว (payment_events.event_type) */
export const PaymentEventType = z.enum(['PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'IGNORED']);
export type PaymentEventType = z.infer<typeof PaymentEventType>;
