/**
 * เช็กอินด้วย E-Ticket (requirement "สแกนเช็กอิน"): กล้อง/เครื่องสแกน/พิมพ์รหัส → ดูการจอง (bar_check_in_preview) → กดยืนยัน (app_check_in)
 */
export const CHECK_IN_QR_PREFIX = 'NIGHTOUT:';

/** ข้อความใน QR เช็กอิน (E-Ticket / บัตรแชร์) — ตรงกับ app_check_in / get_share_card */
export const checkInQrValue = (bookingId: string) => `${CHECK_IN_QR_PREFIX}${bookingId}`;

const QR_RE = /^NIGHTOUT:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
/** รหัสจอง NL-XXXXXX (app_create_booking สร้าง 6 ตัว · รับ 4–10 เผื่ออนาคต) — ขีดหลัง NL พิมพ์หรือไม่พิมพ์ก็ได้ */
const CODE_RE = /^NL-?([0-9A-Z]{4,10})$/;

/**
 * ข้อความที่สแกน/พิมพ์ → รหัสที่ส่ง API หรือ null ถ้าไม่ใช่ E-Ticket ของ NightOut
 * - "nightout:<UUID>" (trim, ไม่สนตัวเล็ก/ใหญ่) → `NIGHTOUT:<uuid ตัวเล็ก>` (uuid ต้องถูกรูปแบบ)
 * - รหัสจอง "nl-3f8k2a" / "NL3F8K2A" → "NL-3F8K2A" (หลัง NL- เป็น [0-9A-Z]{4,10})
 * - อย่างอื่น (URL, ข้อความว่าง ฯลฯ) → null
 */
export function parseCheckInScan(raw: string): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  const qr = QR_RE.exec(v);
  if (qr) return checkInQrValue(qr[1]!.toLowerCase());
  const code = CODE_RE.exec(v.toUpperCase());
  if (code) return `NL-${code[1]}`;
  return null;
}
