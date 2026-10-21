/**
 * ข้อมูลใน cache ที่หน้าเว็บใช้ (catalog + ของผู้ใช้) — หน้า import จากที่นี่
 *
 * อ่าน (cache):  selectors.ts อ่านจาก cache.ts ที่ services/sync.ts เติมข้อมูลจาก API
 * เรียก API รายเส้น (อ่านสด/เขียน): อยู่ใน modules/<หน้า>/api.ts ของหน้านั้น (ADR 0007) — ไม่ผ่านไฟล์นี้
 */
export * from './models';
export * from './selectors';
export { getState } from './cache';
export { promptPayPayload } from '@nightout/utils';
export { AREA_OPTIONS, DISTRICTS, MASTER, STYLES, currentProfile, myPrefs, type AreaOpt } from '@/services/sync';
